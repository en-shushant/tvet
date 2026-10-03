/**
 * What a reviewer checks before verifying a record: every value an editor
 * entered, one per line, grouped the way the paper documents are — identity
 * against the citizenship, each certificate against its certificate — with the
 * document itself a click away so it can sit in the other half of the screen.
 * Missing values are flagged rather than hidden. Ticks are the reviewer's own
 * progress and are not saved.
 */
import { useState } from 'react';
import { labelOfGeneral, labelOfVocational, levelOfQualification } from '../../constants/education.js';
import { sectionOf, totProviderOf } from './common.js';

const blank = (v) => v === null || v === undefined || String(v).trim() === '';

function Section({ id, title, rows, docs, onOpen, checked, onCheck }) {
  const missing = rows.filter(r => r.need && blank(r.value)).length;
  return (
    <section className={`rv-sec${checked ? ' is-checked' : ''}`} aria-labelledby={`rv-${id}`}>
      <header className="rv-sec-head">
        <label className="rv-tick">
          <input type="checkbox" checked={checked} onChange={e => onCheck(e.target.checked)} />
          <span id={`rv-${id}`} className="rv-sec-title">{title}</span>
        </label>
        {missing > 0 && <span className="rv-miss-count">{missing} missing</span>}
      </header>
      <dl className="rv-rows">
        {rows.filter(r => r.need || !blank(r.value)).map(r => (
          <div key={r.label} className={blank(r.value) ? 'is-missing' : undefined}>
            <dt>{r.label}</dt>
            <dd>{blank(r.value) ? 'Missing' : r.value}</dd>
          </div>
        ))}
      </dl>
      <div className="rv-docs">
        {docs.length ? docs.map(d => (
          <button key={d.id} type="button" className="rv-doc" onClick={() => onOpen(d)} title={`Open ${d.file_name} in a new tab`}>
            <span className="material-icons-round" aria-hidden="true">open_in_new</span>{d.doc_type}: {d.file_name}
          </button>
        )) : <span className="rv-nodoc">No document attached for this</span>}
      </div>
    </section>
  );
}

export default function ReviewChecklist({ person, onOpenDoc, actions }) {
  const docs = person.documents || [];
  const quals = person.qualifications || [];
  const exp = person.experience || [];
  // A document attached to this entry, else the documents of its kind not attached to anything.
  const docsFor = ({ qualId, expId, types }) => {
    const own = docs.filter(d => (qualId && d.qualification_id === qualId) || (expId && d.experience_id === expId));
    return own.length ? own
      : docs.filter(d => types.includes(d.doc_type) && !d.qualification_id && !d.experience_id);
  };

  const sections = [
    { id: 'id', title: 'Identity', docs: docsFor({ types: ['Citizenship'] }), rows: [
      { label: 'Full name', value: person.full_name, need: true },
      { label: 'Name in Nepali', value: person.full_name_np },
      { label: "Father's name", value: person.father_name, need: true },
      { label: "Grandfather's name", value: person.grandfather_name },
      { label: 'Date of birth (BS)', value: person.date_of_birth, need: true },
      { label: 'Gender', value: person.gender },
      { label: 'Citizenship no.', value: person.citizenship_no, need: true },
      { label: 'Issued in', value: person.citizenship_district },
      { label: 'Phone', value: person.phone, need: true },
      { label: 'Email', value: person.email },
      { label: 'Permanent address', value: person.permanent_address, need: true },
    ] },
    ...quals.filter(q => sectionOf(q) === 'general').map(q => ({
      id: `q${q.id}`, title: `Education · ${labelOfGeneral(q.education_level || levelOfQualification(q)) || 'General'}`,
      docs: docsFor({ qualId: q.id, types: ['Academic Certificate'] }), rows: [
        { label: 'Course / faculty', value: q.title, need: true },
        { label: 'College / institute', value: q.institution, need: true },
        { label: 'Board / university', value: q.board },
        { label: 'Passed (BS)', value: q.passed_year, need: true },
        { label: 'Division / %', value: q.division },
      ] })),
    ...quals.filter(q => sectionOf(q) === 'vocational').map(q => ({
      id: `q${q.id}`, title: `NSTB · ${[labelOfVocational(q.level), q.occupation_name].filter(Boolean).join(' · ') || 'Skill test'}`,
      docs: docsFor({ qualId: q.id, types: ['Skill Test Certificate'] }), rows: [
        { label: 'Trade', value: q.occupation_name, need: true },
        { label: 'Level', value: q.level && labelOfVocational(q.level), need: true },
        { label: 'Passed (BS)', value: q.passed_year, need: true },
        { label: 'Certificate no.', value: q.certificate_no, need: true },
        { label: 'Tested by', value: q.board },
        { label: 'Training institute', value: q.institution },
        { label: 'Notes', value: q.remarks },
      ] })),
    ...quals.filter(q => sectionOf(q) === 'training').map(q => ({
      id: `q${q.id}`, title: `${q.kind === 'TOT' ? 'TOT' : 'Training'} · ${q.title || 'Untitled'}`,
      docs: docsFor({ qualId: q.id, types: q.kind === 'TOT' ? ['TOT Certificate'] : ['Training Certificate'] }), rows: [
        { label: 'Title', value: q.title, need: true },
        { label: 'Given by', value: q.kind === 'TOT' && totProviderOf(q.institution) !== 'Other' && q.institution
          ? `${totProviderOf(q.institution)} — ${q.institution}` : q.institution, need: q.kind === 'TOT' },
        { label: 'Dates', value: (q.start_date_ad || q.end_date_ad)
          ? `${q.start_date_ad || '?'} to ${q.end_date_ad || '?'}${q.start_date ? ` (BS ${q.start_date} – ${q.end_date || '?'})` : ''}`
          : (q.start_date ? `BS ${q.start_date} – ${q.end_date || '?'}` : ''), need: q.kind === 'TOT' },
        { label: 'Length', value: q.duration_days ? `${q.duration_days} days` : q.duration_text },
        { label: 'Year (BS)', value: q.passed_year },
        { label: 'Certificate no.', value: q.certificate_no },
      ] })),
    ...exp.map(e => ({
      id: `e${e.id}`, title: `Work · ${e.organisation || 'Organisation'}`,
      docs: docsFor({ expId: e.id, types: ['Experience Letter'] }), rows: [
        { label: 'Organisation', value: e.organisation, need: true },
        { label: 'Position', value: e.position, need: true },
        { label: 'From', value: e.from_date, need: true },
        { label: 'To', value: e.is_current ? 'Present' : e.to_date, need: true },
        { label: 'Trade', value: e.occupation_name },
      ] })),
  ];

  const [ticked, setTicked] = useState({});
  const done = sections.filter(s => ticked[s.id]).length;
  const missing = sections.reduce((n, s) => n + s.rows.filter(r => r.need && blank(r.value)).length, 0);

  return (
    <section className="rv" aria-label="Review checklist">
      <header className="rv-head">
        <div>
          <h2 className="pp-h" style={{ margin: 0 }}>Check before verifying</h2>
          <p className="tw-hint" style={{ margin: '2px 0 0' }}>
            Compare each section with its document (opens in a new tab — put it beside this window), then tick it.
          </p>
        </div>
        <div className="rv-progress">
          <span><strong>{done}</strong> of {sections.length} checked</span>
          {missing > 0 && <span className="rv-miss-count">{missing} missing value{missing === 1 ? '' : 's'}</span>}
        </div>
      </header>
      <div className="rv-grid">
        {sections.map(s => (
          <Section key={s.id} {...s} onOpen={onOpenDoc} checked={!!ticked[s.id]}
            onCheck={v => setTicked(t => ({ ...t, [s.id]: v }))} />
        ))}
      </div>
      {actions && <footer className="rv-foot">{actions}</footer>}
    </section>
  );
}

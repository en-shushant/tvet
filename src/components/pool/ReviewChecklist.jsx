/**
 * What a reviewer checks before verifying a record: every value an editor
 * entered, one per line, grouped the way the paper documents are — identity
 * against the citizenship, each certificate against its certificate — with the
 * document itself a click away so it can sit in the other half of the screen.
 * Missing values are flagged rather than hidden. Ticks are the reviewer's own
 * progress and are not saved.
 */
import { useState, useEffect } from 'react';
import { api } from '../../utils/api.js';
import { toast } from '../ui/Feedback.jsx';
import { labelOfGeneral, labelOfVocational, levelOfQualification } from '../../constants/education.js';
import { sectionOf, totProviderOf } from './common.js';

const blank = (v) => v === null || v === undefined || String(v).trim() === '';

function Section({ id, title, rows, docs, onOpen, checked, onToggle, busy, canCheck, showAll }) {
  const missing = rows.filter(r => r.need && blank(r.value)).length;
  // A verified section folds to its title: what is left to check stays in view. Click the title to unfold it.
  const [open, setOpen] = useState(!checked);
  useEffect(() => { if (checked) setOpen(false); }, [checked]);
  const shown = open || showAll;
  return (
    <section className={`rv-sec${checked ? ' is-checked' : ''}${shown ? '' : ' is-folded'}`} aria-labelledby={`rv-${id}`} data-rv={id}>
      <header className="rv-sec-head">
        <button type="button" className="rv-fold" aria-expanded={shown} onClick={() => setOpen(o => !(o || showAll))}>
          <span className="material-icons-round" aria-hidden="true">{shown ? 'expand_more' : 'chevron_right'}</span>
          <span id={`rv-${id}`} className="rv-sec-title">{title}</span>
        </button>
        {missing > 0 && <span className="rv-miss-count">{missing} missing</span>}
        {!docs.length && <span className="material-icons-round rv-nofile" title="No document attached" aria-label="No document attached">attach_file</span>}
        {canCheck && (
          <button type="button" className={`rv-verify${checked ? ' is-on' : ''}`} disabled={busy}
            aria-pressed={checked} onClick={() => onToggle(!checked)}
            title={checked ? 'Verified — click to undo' : 'Mark this section as checked against its document'}>
            <span className="material-icons-round" aria-hidden="true">{checked ? 'check_circle' : 'radio_button_unchecked'}</span>
            {checked ? 'Verified' : 'Verify'}
          </button>
        )}
      </header>
      {shown && (
        <>
          <dl className="rv-rows">
            {rows.filter(r => r.need || !blank(r.value)).map(r => (
              <div key={r.label} className={blank(r.value) ? 'is-missing' : undefined}>
                <dt>{r.label}</dt>
                <dd>{blank(r.value) ? 'Missing' : r.value}</dd>
              </div>
            ))}
          </dl>
          {docs.length > 0 && (
            <div className="rv-docs">
              {docs.map(d => (
                <button key={d.id} type="button" className="rv-doc" onClick={() => onOpen(d)} title={`Open ${d.file_name} in a new tab`}>
                  <span className="material-icons-round" aria-hidden="true">open_in_new</span>{d.doc_type}: {d.file_name}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default function ReviewChecklist({ person, token, canCheck = false, onOpenDoc, onChanged, actions }) {
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

  // Saved on the server. A verified person has every section checked.
  const allIds = sections.map(x => x.id);
  const fromServer = () => new Set(person.is_verified === false ? (person.checked_sections || []) : allIds);
  const [checked, setChecked] = useState(fromServer);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setChecked(fromServer()); }, [person.id, person.is_verified, (person.checked_sections || []).join(',')]);
  const done = sections.filter(x => checked.has(x.id)).length;
  const missing = sections.reduce((n, x) => n + x.rows.filter(r => r.need && blank(r.value)).length, 0);
  const status = done === sections.length && sections.length ? 'verified' : done > 0 ? 'partial' : 'none';

  const toggle = async (id, on) => {
    setBusy(true);
    const before = checked;
    setChecked(c => { const n = new Set(c); on ? n.add(id) : n.delete(id); return n; });
    try {
      const r = await api('POST', `/hr/people/${person.id}/section-checks`, { section_id: id, checked: on, all: allIds }, token);
      if (r.is_verified && person.is_verified === false) toast(`Every section is verified — ${person.full_name} is now verified.`);
      onChanged?.(r);
      // Verified one? Go straight to the next that is not, so a run of Enter presses checks them all in turn.
      if (on) {
        const i = allIds.indexOf(id);
        const next = [...allIds.slice(i + 1), ...allIds.slice(0, i)].find(x => !before.has(x) && x !== id);
        if (next) setTimeout(() => {
          const btn = document.querySelector(`[data-rv="${next}"] .rv-verify`);
          btn?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          btn?.focus({ preventScroll: true });
        }, 60);
      }
    } catch (e) { setChecked(before); toast(e.message || 'Could not save that check.'); }
    finally { setBusy(false); }
  };

  const [showAll, setShowAll] = useState(false);
  const anyDocs = sections.some(x => x.docs.length > 0);
  const anyFolded = sections.some(x => checked.has(x.id));

  return (
    <section className="rv" aria-label="Review checklist">
      <header className="rv-head">
        <div className="rv-head-main">
          <h2 className="pp-h" style={{ margin: 0 }}>Check before verifying</h2>
          <span className={`rv-status is-${status}`}>
            {status === 'verified' ? 'Verified' : status === 'partial' ? 'Partially verified' : 'Not verified'}
          </span>
          <span className="rv-count"><strong>{done}</strong> of {sections.length}</span>
          {missing > 0 && <span className="rv-miss-count">{missing} missing value{missing === 1 ? '' : 's'}</span>}
          {anyFolded && <button type="button" className="tw-link" onClick={() => setShowAll(v => !v)}>{showAll ? 'Fold verified' : 'Show all details'}</button>}
        </div>
        <div className="rv-bar" role="progressbar" aria-valuemin={0} aria-valuemax={sections.length} aria-valuenow={done} aria-label="Sections verified">
          <span style={{ width: `${sections.length ? (done / sections.length) * 100 : 0}%` }} />
        </div>
        {!anyDocs && <p className="rv-note">No documents are attached to this person yet, so there is nothing to compare against.</p>}
      </header>
      <div className="rv-grid">
        {sections.map(s => (
          <Section key={s.id} {...s} onOpen={onOpenDoc} checked={checked.has(s.id)} busy={busy} canCheck={canCheck} showAll={showAll}
            onToggle={v => toggle(s.id, v)} />
        ))}
      </div>
      {actions && <footer className="rv-foot">{actions}</footer>}
    </section>
  );
}

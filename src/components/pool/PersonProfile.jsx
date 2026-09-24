import { useState } from 'react';
import { ErrorBanner } from '../ui/Modal.jsx';
import { Btn } from '../../md.jsx';
import { confirmDialog, toast } from '../ui/Feedback.jsx';
import { api } from '../../utils/api.js';
import { labelOfGeneral, labelOfVocational, levelOfQualification } from '../../constants/education.js';
import { experienceYears } from '../../utils/hrFit.js';
import { DOC_TYPES, initials, sectionOf, topGeneral, topVocational } from './common.js';

/**
 * A person in the pool, read the way a CV is read.
 *
 * Who they are and how to reach them first; then the four facts a bid is
 * judged on — highest education, years since qualifying, skill level, and
 * training — so the answer to "can we propose them?" is on screen before any
 * table is. The record follows in CV order, with the personal details and the
 * documents in a side column where they are looked up rather than read.
 */
export default function PersonProfile({ person, token, canDelete, onBack, onEdit, onDelete, onReload }) {
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState('CV');
  const [err, setErr] = useState('');

  const quals = person.qualifications || [];
  const general = quals.filter(q => sectionOf(q) === 'general');
  const vocational = quals.filter(q => sectionOf(q) === 'vocational');
  const trainings = quals.filter(q => sectionOf(q) === 'training');
  const tots = trainings.filter(q => q.kind === 'TOT').length;
  const years = experienceYears(person);

  const upload = async (file) => {
    if (!file) return;
    setUploading(true); setErr('');
    try {
      const b64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(',')[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      await api('POST', `/hr/people/${person.id}/documents`, {
        doc_type: docType, file_name: file.name, file_size: file.size,
        content_type: file.type, file_data: b64,
      }, token);
      await onReload();
      toast(`${file.name} attached.`);
    } catch (e) { setErr(e.message || 'Upload failed'); }
    finally { setUploading(false); }
  };

  /**
   * Fetch the file with the token, then open it as a blob.
   *
   * A plain link cannot carry the Authorization header, so it would hit the
   * download route unauthenticated and get a 401. These are personal records
   * behind a granted permission, so dropping the auth is not an option.
   */
  const openDoc = async (d) => {
    setErr('');
    try {
      const res = await fetch(`/api/hr/documents/${d.id}/download`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Could not open ${d.file_name} (${res.status})`);
      const url = URL.createObjectURL(await res.blob());
      window.open(url, '_blank', 'noopener');
      // Freed later rather than at once: revoking before the tab has read it leaves it blank.
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { setErr(e.message || 'Could not open the file'); }
  };

  const removeDoc = async (d) => {
    if (!await confirmDialog({ title: 'Remove document', message: `“${d.file_name}” will be deleted.`, confirmLabel: 'Delete', danger: true })) return;
    try { await api('DELETE', `/hr/documents/${d.id}`, null, token); await onReload(); }
    catch (e) { setErr(e.message); }
  };

  const docsByType = DOC_TYPES
    .map(t => ({ type: t, docs: (person.documents || []).filter(d => d.doc_type === t) }))
    .filter(g => g.docs.length);

  const facts = [
    { label: 'Highest education', value: topGeneral(person) || 'Not recorded' },
    { label: 'Since qualifying', value: Number.isInteger(years) ? `${years} year${years === 1 ? '' : 's'}` : '—',
      note: Number.isInteger(years) ? 'counted from the passed year' : 'no passed year recorded' },
    { label: 'Skill certificate', value: topVocational(person) || 'None' },
    { label: 'Training', value: trainings.length ? `${trainings.length}` : 'None',
      note: trainings.length ? (tots ? `incl. ${tots} TOT` : 'no TOT') : null },
  ];

  const contact = [
    person.phone && { icon: 'call', text: person.phone },
    person.email && { icon: 'mail', text: person.email },
    person.permanent_address && { icon: 'home', text: person.permanent_address },
  ].filter(Boolean);

  return (
    <div className="fade-in">
      <button type="button" className="tw-back" onClick={onBack}>← Trainer pool</button>
      <ErrorBanner msg={err} onDismiss={() => setErr('')} />

      <header className="pp-head">
        <div className="pp-avatar" aria-hidden="true">
          {person.photo ? <img src={person.photo} alt="" /> : initials(person.full_name)}
        </div>
        <div className="pp-id">
          <h1 className="tw-title">{person.full_name}
            {person.full_name_np && <span className="pp-np">{person.full_name_np}</span>}
          </h1>
          <div className="pp-tags">
            <span className="tw-tag gray">{person.person_type}</span>
            {person.designation && <span className="pp-designation">{person.designation}</span>}
            {person.is_active === false && <span className="tw-tag amber">No longer available</span>}
          </div>
          {contact.length > 0 && (
            <div className="pp-contact">
              {contact.map(c => (
                <span key={c.icon}><span className="material-icons-round" aria-hidden="true">{c.icon}</span>{c.text}</span>
              ))}
            </div>
          )}
        </div>
        <div className="pp-actions">
          {canDelete && (
            <button type="button" className="tw-x" aria-label={`Delete ${person.full_name}`} title="Delete"
              onClick={() => onDelete(person)}>
              <span className="material-icons-round" style={{ fontSize: 19 }}>delete_outline</span>
            </button>
          )}
          <Btn className="btn btn-primary btn-sm" onClick={() => onEdit(person)}>
            <span className="material-icons-round" style={{ fontSize: 15, verticalAlign: 'middle', marginRight: 4 }}>edit</span>
            Edit</Btn>
        </div>
      </header>

      <div className="pp-facts">
        {facts.map(f => (
          <div key={f.label} className="pp-fact">
            <span className="pp-fact-label">{f.label}</span>
            <span className="pp-fact-value">{f.value}</span>
            {f.note && <span className="pp-fact-note">{f.note}</span>}
          </div>
        ))}
      </div>

      <div className="pp-body">
        <main className="pp-main">
          <section className="pp-card">
            <h2 className="pp-h">Can train</h2>
            {person.eligible_occupations?.length ? (
              <div className="tw-people" style={{ marginTop: 0 }}>
                {person.eligible_occupations.map(o => (
                  <span key={o.id} className="pp-trade">{o.name}
                    {o.level && <span className="pp-trade-level">{o.level}</span>}</span>
                ))}
              </div>
            ) : (
              <p className="tw-empty">Nothing yet. A vocational certificate names its trade; a degree needs a qualification rule to grant trades.</p>
            )}
            {person.occupation_overrides?.length > 0 && (
              <p className="tw-hint" style={{ marginBottom: 0 }}>
                Set by hand: {person.occupation_overrides.map(o =>
                  `${o.occupation_name} (${o.mode === 'add' ? 'always' : 'never'})`).join(', ')}
              </p>
            )}
          </section>

          <section className="pp-card">
            <h2 className="pp-h">Education</h2>
            <h3 className="pp-sub">General</h3>
            {general.length ? (
              <table className="pp-table"><thead><tr>
                <th>Level</th><th>Course</th><th>College / board</th><th className="num">Passed</th><th>Division</th>
              </tr></thead><tbody>
                {general.map(q => (
                  <tr key={q.id}>
                    <td><strong>{labelOfGeneral(levelOfQualification(q)) || '—'}</strong></td>
                    <td>{q.title || '—'}{q.rule_name && <div className="pp-cell-sub">grants: {q.rule_name}</div>}</td>
                    <td>{q.institution || '—'}{q.board && <div className="pp-cell-sub">{q.board}</div>}</td>
                    <td className="num">{q.passed_year || '—'}</td>
                    <td>{q.division || '—'}</td>
                  </tr>
                ))}
              </tbody></table>
            ) : <p className="tw-empty">None recorded.</p>}

            <h3 className="pp-sub">Vocational</h3>
            {vocational.length ? (
              <table className="pp-table"><thead><tr>
                <th>Level</th><th>Trade</th><th>Tested by</th><th>Certificate</th><th className="num">Passed</th>
              </tr></thead><tbody>
                {vocational.map(q => (
                  <tr key={q.id}>
                    <td><strong>{labelOfVocational(q.level) || '—'}</strong></td>
                    <td>{q.occupation_name || '—'}</td>
                    <td>{q.board || 'NSTB'}{q.institution && <div className="pp-cell-sub">{q.institution}</div>}</td>
                    <td className="mono">{q.certificate_no || '—'}</td>
                    <td className="num">{q.passed_year || '—'}</td>
                  </tr>
                ))}
              </tbody></table>
            ) : <p className="tw-empty">None recorded.</p>}
          </section>

          <section className="pp-card">
            <h2 className="pp-h">Training &amp; TOT</h2>
            {trainings.length ? (
              <table className="pp-table"><thead><tr>
                <th>Title</th><th>Given by</th><th>Duration</th><th className="num">Year</th>
              </tr></thead><tbody>
                {trainings.map(q => (
                  <tr key={q.id}>
                    <td>{q.kind === 'TOT' && <span className="tw-tag gray">TOT</span>} {q.title || '—'}</td>
                    <td>{q.institution || '—'}</td>
                    <td>{q.duration_text || (q.duration_hours ? `${q.duration_hours} hours` : '—')}</td>
                    <td className="num">{q.passed_year || '—'}</td>
                  </tr>
                ))}
              </tbody></table>
            ) : <p className="tw-empty">None recorded.</p>}
          </section>

          <section className="pp-card">
            <h2 className="pp-h">Work experience</h2>
            {person.experience?.length ? (
              <ol className="pp-timeline">
                {person.experience.map(e => (
                  <li key={e.id}>
                    <div className="pp-when">{e.from_date || '?'} – {e.is_current ? 'present' : (e.to_date || '?')}</div>
                    <div className="pp-what"><strong>{e.position || 'Position not recorded'}</strong>
                      <span className="pp-org"> · {e.organisation || 'organisation not recorded'}</span></div>
                    {(e.country || e.project_name) && (
                      <div className="pp-cell-sub">{[e.project_name, e.country].filter(Boolean).join(' · ')}</div>
                    )}
                    {e.description && (
                      <ul className="pp-bullets">
                        {String(e.description).split('\n').map(s => s.replace(/^[•\-\s]+/, '').trim()).filter(Boolean)
                          .map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
            ) : <p className="tw-empty">None recorded.</p>}
          </section>
        </main>

        <aside className="pp-side">
          <section className="pp-card">
            <h2 className="pp-h">Personal details</h2>
            <dl className="pp-dl">
              {[
                ["Father's name", person.father_name],
                ["Grandfather's name", person.grandfather_name],
                ['Citizenship no.', person.citizenship_no && `${person.citizenship_no}${person.citizenship_district ? ` · ${person.citizenship_district}` : ''}`],
                ['Date of birth', person.date_of_birth],
                ['Gender', person.gender],
                ['Temporary address', person.temporary_address],
                ['Nationality', person.nationality],
                ['Profession', person.profession],
                ['Remarks', person.remarks],
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
              ))}
            </dl>
          </section>

          {person.languages?.length > 0 && (
            <section className="pp-card">
              <h2 className="pp-h">Languages</h2>
              <dl className="pp-dl">
                {person.languages.map((l, i) => (
                  <div key={i}><dt>{l.language}</dt>
                    <dd>{[l.speaking && `speaks ${l.speaking.toLowerCase()}`, l.reading && `reads ${l.reading.toLowerCase()}`,
                      l.writing && `writes ${l.writing.toLowerCase()}`].filter(Boolean).join(' · ') || '—'}</dd></div>
                ))}
              </dl>
            </section>
          )}

          <section className="pp-card">
            <h2 className="pp-h">Documents</h2>
            {docsByType.length ? docsByType.map(g => (
              <div key={g.type} className="pp-docs">
                <div className="pp-sub" style={{ margin: '0 0 4px' }}>{g.type}</div>
                {g.docs.map(d => (
                  <div key={d.id} className="pp-doc">
                    <span className="material-icons-round" aria-hidden="true">description</span>
                    <button type="button" className="pp-doc-name" onClick={() => openDoc(d)} title="Open">{d.file_name}</button>
                    <button type="button" className="tw-x" aria-label={`Remove ${d.file_name}`} onClick={() => removeDoc(d)}>
                      <span className="material-icons-round" style={{ fontSize: 16 }}>close</span>
                    </button>
                  </div>
                ))}
              </div>
            )) : <p className="tw-empty">Nothing attached yet.</p>}
            <div className="pp-attach">
              <select className="tw-in" aria-label="Kind of document" value={docType} onChange={e => setDocType(e.target.value)}>
                {DOC_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
              <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', margin: 0, whiteSpace: 'nowrap' }}>
                {uploading ? 'Uploading…' : 'Attach file'}
                <input type="file" style={{ display: 'none' }} disabled={uploading}
                  onChange={e => { upload(e.target.files?.[0]); e.target.value = ''; }} />
              </label>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

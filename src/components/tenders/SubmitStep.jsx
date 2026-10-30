import { useState } from 'react';
import Modal, { ErrorBanner } from '../ui/Modal.jsx';
import { Btn, MdTextField, MdSelect, MdOption } from '../../md.jsx';
import REPORT_CATALOG from '../../reports/catalog.js';
import { BIDDER_STATUSES, leadOf } from './common.js';
import Select from '../ui/Select.jsx';
import { CV_FORMATS } from '../../reports/cv.jsx';
import { todayISO, formatCvDate } from '../../reports/cvDate.js';

const FIELD_TAG = { detailed_tasks: 'Tasks', key_qualifications: 'Qualifications', adequacy: 'Adequacy', activities: 'Activities' };

/**
 * Step 5 — each bidder's documents, and how it fared.
 *
 * One card per bidder, one row per document. The result sits on the same card
 * because it is what decides the next document: an EOI bidder marked
 * Shortlisted is the one invited to propose.
 */
/** The files already built and saved for one bidder, newest first. */
function SavedDocs({ docs, bidderId, kind, onDownload, onRemove }) {
  const mine = docs.filter(d => d.bidder_id === bidderId && d.kind === kind);
  const [all, setAll] = useState(false);
  if (!mine.length) return null;
  const shown = all ? mine : mine.slice(0, 2);
  const when = (t) => new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const size = (n) => n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round((n || 0) / 1024))} KB`;
  return (
    <ul className="tw-saved" aria-label={`Saved ${kind} files`}>
      {shown.map((d, i) => (
        <li key={d.id}>
          <span className="material-icons-round" aria-hidden="true">description</span>
          <span className="tw-saved-name">{d.file_name}</span>
          <span className="tw-hint">{i === 0 && !all ? 'Latest · ' : ''}saved {when(d.created_at)}{d.created_by_name ? ` by ${d.created_by_name}` : ''} · {size(d.file_size)}</span>
          <span className="tw-saved-actions">
            <button type="button" className="tw-link" onClick={() => onDownload(d)}>Download</button>
            <button type="button" className="tw-link tw-link-danger" onClick={() => onRemove(d)}>Remove</button>
          </span>
        </li>
      ))}
      {mine.length > 2 && (
        <li><button type="button" className="tw-link" onClick={() => setAll(a => !a)}>
          {all ? 'Show fewer' : `${mine.length - 2} earlier version${mine.length - 2 === 1 ? '' : 's'}`}</button></li>
      )}
    </ul>
  );
}

export default function SubmitStep({ tender, busy, variants, advanced = false, docFamily, setDocFamily,
                                     onPrepareReport, onMakeCVs, onSetBidderStatus, docs = [], onDownloadDoc, onRemoveDoc,
                                     onAdvance, onOpenStage, onSaveVariant, footer }) {
  const bidders = tender.bidders || [];
  const isEOI = tender.stage === 'EOI';
  const shortlisted = bidders.filter(b => b.status === 'Shortlisted');
  const [variantModal, setVariantModal] = useState(null);
  // One format for the whole stage, chosen on the Notice step.
  const formatLabel = (CV_FORMATS.find(f => f.id === tender.cv_format)
    || CV_FORMATS.find(f => f.id === (tender.stage === 'RFP' ? 'ppmo_rfp' : 'ppmo_eoi'))).label;
  // The date printed on every CV's signature line: picked per bidder, today until changed.
  const [cvDate, setCvDate] = useState({});
  const [cvDateStyle, setCvDateStyle] = useState('bs');
  const dateOf = (b) => cvDate[b.id] === undefined ? todayISO() : cvDate[b.id];
  // Experience letters follow each CV unless switched off for a bidder.
  const [noLetters, setNoLetters] = useState({});
  const cvCount = (b) => (tender.people || []).filter(p => p.bidder_id === b.id).length;

  /**
   * Whether this bidder can be sent an RFP.
   *
   * On an EOI, only once it is marked Shortlisted — a proposal is invited from
   * a bidder that got through. On an RFP stage it always can: the only bidders
   * there are the ones carried forward because they were shortlisted, and
   * asking for the mark again would lock the very document the stage is for.
   */
  const rfpOpen = (b) => !isEOI || b.status === 'Shortlisted';

  const firmIds = [...new Set(bidders.flatMap(b => (b.firms || []).map(f => f.institute_id)))];
  const firmName = (id) => bidders.flatMap(b => b.firms || []).find(f => f.institute_id === id);
  const library = variants.filter(v => !v.institute_id || firmIds.includes(v.institute_id));

  return (
    <>
      <h2 className="tw-panel-title">Submit</h2>
      <p className="tw-panel-lede">
        Build each bidder&apos;s documents. The {isEOI ? 'EOI' : 'RFP'} opens in Reports already set up for
        that bidder — its firms, the fiscal year and this notice&apos;s trades. Record the result here once
        it is known.
      </p>

      <div className="tw-section-head" style={{ marginBottom: 14 }}>
        <label htmlFor="tender-doc-format" className="tw-section-title" style={{ fontWeight: 600 }}>
          Format the client asks for</label>
        {/* The client dictates the format, so it is chosen rather than fixed by
            the stage — the same choice the Reports menu offers. */}
        <Select id="tender-doc-format" className="tw-in" style={{ width: 'auto', minWidth: 240 }}
          value={docFamily} onChange={e => setDocFamily(e.target.value)}>
          {REPORT_CATALOG.map(fam => <option key={fam.id} value={fam.id}>{fam.label}</option>)}
        </Select>
      </div>

      {bidders.map(b => {
        const lead = leadOf(b);
        const n = cvCount(b);
        return (
          <div key={b.id} className="tw-bidder">
            <div className="tw-bidder-head">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="tw-bidder-name">{b.display_name}</div>
                {b.firms.length > 1 && (
                  <div className="tw-bidder-firms">Joint venture led by {lead?.name}</div>
                )}
              </div>
              <span className="tw-hint">Result</span>
              <Select className="tw-in" style={{ width: 'auto', minWidth: 150 }} aria-label={`Result for ${b.display_name}`}
                value={b.status || 'Preparing'} disabled={busy}
                onChange={e => onSetBidderStatus(b, e.target.value)}>
                {BIDDER_STATUSES.map(st => <option key={st} value={st}>{st}</option>)}
              </Select>
            </div>

            {isEOI && (
              <div className="tw-doc">
                <span className="tw-doc-name">EOI</span>
                <span className="tw-doc-what">
                  {b.firms.length > 1
                    ? 'Built from every partner’s experience, lead first.'
                    : `Built from ${lead?.acronym || lead?.name || 'the firm'}’s experience.`}
                </span>
                <Btn className={`btn btn-sm ${docs.some(d => d.bidder_id === b.id && d.kind === 'EOI') ? 'btn-secondary' : 'btn-primary'}`}
                  onClick={() => onPrepareReport(tender, 'EOI', b, docFamily)}>
                  {docs.some(d => d.bidder_id === b.id && d.kind === 'EOI') ? 'Build it again →' : 'Build the EOI →'}</Btn>
              </div>
            )}
            {isEOI && <SavedDocs docs={docs} bidderId={b.id} kind="EOI" onDownload={onDownloadDoc} onRemove={onRemoveDoc} />}

            <div className={`tw-doc${rfpOpen(b) ? '' : ' is-locked'}`}>
              <span className="tw-doc-name">RFP</span>
              <span className="tw-doc-what">
                {rfpOpen(b)
                  ? (isEOI ? 'The technical proposal, set up the same way.'
                           : 'The technical proposal, set up for this bidder.')
                  : 'Opens once this bidder is marked Shortlisted — a proposal is only invited from a bidder that got through the EOI.'}
              </span>
              <Btn className={`btn btn-sm ${isEOI ? 'btn-secondary' : 'btn-primary'}`} disabled={!rfpOpen(b)}
                onClick={() => onPrepareReport(tender, 'RFP', b, docFamily)}>
                {docs.some(d => d.bidder_id === b.id && d.kind === 'RFP') ? 'Build it again →' : 'Build the RFP →'}</Btn>
            </div>
            <SavedDocs docs={docs} bidderId={b.id} kind="RFP" onDownload={onDownloadDoc} onRemove={onRemoveDoc} />

            <div className="tw-doc">
              <span className="tw-doc-name">CV pack</span>
              <span className="tw-doc-what">
                {n ? `${n} CV${n === 1 ? '' : 's'} from the Team step${b.firms.length > 1 ? `, in ${lead?.acronym || lead?.name}’s wording` : ''}.`
                  : 'Nobody on this bidder’s team yet.'}
              </span>
              <Btn className="btn btn-secondary btn-sm" disabled={busy || !n} onClick={() => onMakeCVs(b, 'print', !noLetters[b.id], { date: dateOf(b), style: cvDateStyle })}>
                Print</Btn>
              <Btn className="btn btn-secondary btn-sm" disabled={busy || !n} onClick={() => onMakeCVs(b, 'word', !noLetters[b.id], { date: dateOf(b), style: cvDateStyle })}>
                Word</Btn>
            </div>
            <details className="tw-opts">
              <summary>CV options <span className="tw-hint">· {formatLabel} · dated {formatCvDate(dateOf(b), cvDateStyle) || 'blank'}{noLetters[b.id] ? ' · no letters' : ' · with letters'}</span></summary>
              <div className="tw-opts-body">
              <span className="tw-hint" title="Set on the Notice step">{formatLabel}</span>
              <label className="tw-hint" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
                title="Printed on the signature line of every CV in the pack. Clear it to leave the line blank.">
                CV date
                <input type="date" className="tw-in" style={{ width: 'auto' }} aria-label={`CV date for ${b.display_name}`}
                  value={dateOf(b)} onChange={e => setCvDate(d => ({ ...d, [b.id]: e.target.value }))} />
                <Select className="tw-in" style={{ width: 'auto' }} aria-label="How the CV date is written"
                  value={cvDateStyle} onChange={e => setCvDateStyle(e.target.value)}>
                  <option value="bs">BS</option>
                  <option value="ad">AD</option>
                </Select>
                {dateOf(b) && <span style={{ color: 'var(--text3)' }}>→ {formatCvDate(dateOf(b), cvDateStyle)}</span>}
              </label>
              <label className="tw-hint" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
                title="Each CV followed by the experience letter of each firm of ours it lists">
                <input type="checkbox" checked={!noLetters[b.id]} onChange={e => setNoLetters(x => ({ ...x, [b.id]: !e.target.checked }))} />
                Experience letters
              </label>
              </div>
            </details>
          </div>
        );
      })}

      {isEOI && (
        <section className="tw-section" style={{ marginTop: 20 }}>
          <div className="tw-section-head">
            <h3 className="tw-section-title">After the shortlist</h3>
          </div>
          {tender.led_to?.length > 0 ? (
            <div className="tw-hint" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              This EOI has already gone to RFP.
              {tender.led_to.map(c => (
                <Btn key={c.id} className="btn btn-secondary btn-sm" onClick={() => onOpenStage(c.id)}>
                  Open the {c.stage} →</Btn>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <Btn className="btn btn-primary btn-sm" disabled={busy || !shortlisted.length} onClick={onAdvance}>
                {shortlisted.length
                  ? `Take ${shortlisted.length === 1 ? shortlisted[0].display_name : `the ${shortlisted.length} shortlisted bidders`} to RFP →`
                  : 'Take the shortlisted bidders to RFP →'}</Btn>
              <span className="tw-hint">
                {shortlisted.length
                  ? 'Creates the RFP stage with the same notice, trades, posts and teams. The EOI stays as submitted.'
                  : 'Mark a bidder Shortlisted above first.'}
              </span>
            </div>
          )}
        </section>
      )}

      {advanced && <details className="tw-more" style={{ marginTop: 10 }}>
        <summary>CV wording library{library.length ? ` (${library.length})` : ''}</summary>
        <p className="tw-hint" style={{ marginTop: 0 }}>
          Each firm&apos;s own wording for the CV&apos;s &ldquo;Tasks assigned&rdquo;, &ldquo;Key
          qualifications&rdquo; and &ldquo;Adequacy for the assignment&rdquo;. A firm&apos;s wording for a post is
          used automatically for anyone proposed in that post; pick another per person on the Team step.
          In a joint venture every CV uses the lead firm&apos;s wording.
        </p>
        {library.length === 0
          ? <div className="tw-empty">No wording saved yet.</div>
          : (
            <div className="tw-picker-list" style={{ maxHeight: 'none' }}>
              {library.map(v => (
                <div key={v.id} className="tw-cand" style={{ background: 'var(--bg)' }}>
                  <span className="tw-tag gray">{FIELD_TAG[v.field] || v.field}</span>
                  <span className="tw-cand-main">{v.label}
                    <span className="tw-cand-sub">
                      {' · '}{v.institute_id ? (firmName(v.institute_id)?.acronym || firmName(v.institute_id)?.name) : 'shared'}
                    </span>
                  </span>
                  <Btn className="btn btn-ghost btn-sm" onClick={() => setVariantModal({ data: v })}>Edit</Btn>
                </div>
              ))}
            </div>
          )}
        <Btn className="btn btn-secondary btn-sm" style={{ marginTop: 8 }}
          onClick={() => setVariantModal({ data: null })}><span className="material-icons-round">add</span>Add wording</Btn>
      </details>}

      {footer({})}

      {variantModal && (
        <VariantForm variant={variantModal.data} firms={firmIds.map(id => firmName(id))}
          onClose={() => setVariantModal(null)}
          onSave={async (form) => { await onSaveVariant(form, variantModal.data); setVariantModal(null); }} />
      )}
    </>
  );
}

function VariantForm({ variant, firms, onSave, onClose }) {
  const [form, setForm] = useState(() => ({
    field: 'detailed_tasks', label: '', position: '', person_type: '', body: '',
    ...(variant || {}), institute_id: variant?.institute_id ?? firms[0]?.institute_id ?? '',
  }));
  const [err, setErr] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <Modal title={variant?.id ? 'Edit wording' : 'Add wording'} onClose={onClose} size="lg"
      footer={<>
        <Btn className="btn btn-secondary" onClick={onClose}>Cancel</Btn>
        <Btn className="btn btn-primary" onClick={async () => {
          if (!form.label.trim()) return setErr('Give this wording a label.');
          try { await onSave(form); } catch (e) { setErr(e.message); }
        }}>Save</Btn>
      </>}>
      <ErrorBanner msg={err} onDismiss={() => setErr('')} />
      <p className="tw-hint" style={{ margin: '0 0 12px' }}>
        Use <code>{'{firm}'}</code>, <code>{'{occupation}'}</code>, <code>{'{position}'}</code>,{' '}
        <code>{'{staffName}'}</code> and <code>{'{client}'}</code> — they are filled in when the CV is
        produced. Adequacy can also use <code>{'{events}'}</code>, <code>{'{clients}'}</code> and{' '}
        <code>{'{years}'}</code> from the person&apos;s jobs; a line whose value is missing is left out.
        Start a line with • for a bullet.
      </p>
      <div className="form-row form-row-2">
        <div className="form-group">
          <MdSelect label="Section" value={form.field} onChange={e => set('field', e.target.value)}>
            <MdOption value="detailed_tasks">Tasks assigned</MdOption>
            <MdOption value="key_qualifications">Key qualifications</MdOption>
            <MdOption value="adequacy">Adequacy for the assignment (prior work)</MdOption>
            <MdOption value="activities">Activities in a job (by the job’s position)</MdOption>
          </MdSelect>
        </div>
        <div className="form-group">
          <MdSelect label="Whose wording" value={String(form.institute_id || '')}
            onChange={e => set('institute_id', e.target.value)}>
            <MdOption value="">Shared by every firm</MdOption>
            {firms.filter(Boolean).map(f => (
              <MdOption key={f.institute_id} value={String(f.institute_id)}>{f.name}</MdOption>
            ))}
          </MdSelect>
        </div>
      </div>
      <div className="form-row form-row-2">
        <div className="form-group">
          <MdTextField label="Label *" value={form.label}
            onChange={e => set('label', e.target.value)} placeholder="e.g. Main Trainer — our wording" />
        </div>
        <div className="form-group">
          <MdTextField label="For which post" value={form.position || ''}
            onChange={e => set('position', e.target.value)} placeholder="e.g. Main Trainer" />
        </div>
      </div>
      <div className="form-group">
        <label>Text</label>
        <textarea rows={9} value={form.body || ''} onChange={e => set('body', e.target.value)}
          style={{ fontFamily: 'var(--font)', fontSize:13, lineHeight: 1.5 }} />
      </div>
    </Modal>
  );
}

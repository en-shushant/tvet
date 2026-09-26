import { useState } from 'react';
import Modal, { ErrorBanner } from '../ui/Modal.jsx';
import { Btn, MdTextField, MdSelect, MdOption } from '../../md.jsx';
import REPORT_CATALOG from '../../reports/catalog.js';
import { BIDDER_STATUSES, leadOf } from './common.js';
import Select from '../ui/Select.jsx';

/**
 * Step 5 — each bidder's documents, and how it fared.
 *
 * One card per bidder, one row per document. The result sits on the same card
 * because it is what decides the next document: an EOI bidder marked
 * Shortlisted is the one invited to propose.
 */
export default function SubmitStep({ tender, busy, variants, docFamily, setDocFamily,
                                     onPrepareReport, onMakeCVs, onSetBidderStatus,
                                     onAdvance, onOpenStage, onSaveVariant, footer }) {
  const bidders = tender.bidders || [];
  const isEOI = tender.stage === 'EOI';
  const shortlisted = bidders.filter(b => b.status === 'Shortlisted');
  const [variantModal, setVariantModal] = useState(null);
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
                <Btn className="btn btn-primary btn-sm" onClick={() => onPrepareReport(tender, 'EOI', b, docFamily)}>
                  Build the EOI →</Btn>
              </div>
            )}

            <div className={`tw-doc${rfpOpen(b) ? '' : ' is-locked'}`}>
              <span className="tw-doc-name">RFP</span>
              <span className="tw-doc-what">
                {rfpOpen(b)
                  ? (isEOI ? 'The technical proposal, set up the same way.'
                           : 'The technical proposal, set up for this bidder.')
                  : 'Opens once this bidder is marked Shortlisted — a proposal is only invited from a bidder that got through the EOI.'}
              </span>
              <Btn className={`btn btn-sm ${isEOI ? 'btn-secondary' : 'btn-primary'}`} disabled={!rfpOpen(b)}
                onClick={() => onPrepareReport(tender, 'RFP', b, docFamily)}>Build the RFP →</Btn>
            </div>

            <div className="tw-doc">
              <span className="tw-doc-name">CV pack</span>
              <span className="tw-doc-what">
                {n ? `${n} CV${n === 1 ? '' : 's'} in Form 5, from the Team step.` : 'Nobody on this bidder’s team yet.'}
              </span>
              <Btn className="btn btn-secondary btn-sm" disabled={busy || !n} onClick={() => onMakeCVs(b, 'print')}>
                Print</Btn>
              <Btn className="btn btn-secondary btn-sm" disabled={busy || !n} onClick={() => onMakeCVs(b, 'word')}>
                Word</Btn>
            </div>
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

      <details className="tw-more" style={{ marginTop: 10 }}>
        <summary>CV wording library{library.length ? ` (${library.length})` : ''}</summary>
        <p className="tw-hint" style={{ marginTop: 0 }}>
          Each firm&apos;s own wording for the CV&apos;s &ldquo;Tasks assigned&rdquo; and &ldquo;Key
          qualifications&rdquo;. Pick one per person on the Team step.
        </p>
        {library.length === 0
          ? <div className="tw-empty">No wording saved yet.</div>
          : (
            <div className="tw-picker-list" style={{ maxHeight: 'none' }}>
              {library.map(v => (
                <div key={v.id} className="tw-cand" style={{ background: 'var(--bg)' }}>
                  <span className="tw-tag gray">{v.field === 'detailed_tasks' ? 'Tasks' : 'Qualifications'}</span>
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
      </details>

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
        produced. Start a line with • for a bullet.
      </p>
      <div className="form-row form-row-2">
        <div className="form-group">
          <MdSelect label="Section" value={form.field} onChange={e => set('field', e.target.value)}>
            <MdOption value="detailed_tasks">Tasks assigned</MdOption>
            <MdOption value="key_qualifications">Key qualifications</MdOption>
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

import { useState, useMemo } from 'react';
import Modal, { ErrorBanner } from '../ui/Modal.jsx';
import { Btn, MdTextField, MdSelect, MdOption } from '../../md.jsx';
import { FISCAL_YEARS, CLIENT_TYPES } from '../../constants/data.js';
import { BLANK_TENDER, METHODS, STAGES, WEIGHTS, noticeOf } from './common.js';

/** What sits behind "More from the notice" — counted so a fold is never silent. */
const MORE_FIELDS = ['project_name', 'office_address', 'funding_agency', 'method', 'published_date',
  'document_deadline', 'submission_portal', 'client_website', 'weight_qualification',
  'weight_experience', 'weight_capacity', 'minimum_score', 'notes'];

/**
 * Step 1 — the notice.
 *
 * Only what identifies the bid and when it is due is asked up front. The rest
 * of what a notice prints (method, portal, weights, pass mark…) matters, but
 * not before anything else can happen, so it waits behind "More from the
 * notice" rather than making the first screen a wall of thirty fields.
 */
export default function NoticeStep({ tender, clients, onSave, onAddClient, footer }) {
  const [form, setForm] = useState(() => noticeOf(tender));
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [newClient, setNewClient] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const isNew = !tender?.id;

  // Only checked once at least one weight is entered — a blank notice section
  // is not a notice that scores everything at zero.
  const weightTotal = useMemo(() => {
    const vals = WEIGHTS.map(([k]) => form[k]).filter(v => v !== '' && v != null);
    if (!vals.length) return null;
    return vals.reduce((n, v) => n + (parseFloat(v) || 0), 0);
  }, [form.weight_qualification, form.weight_experience, form.weight_capacity]);

  const moreFilled = MORE_FIELDS.filter(k => {
    const v = form[k];
    return v !== '' && v != null && v !== BLANK_TENDER[k];
  }).length;

  const save = async () => {
    if (!form.title.trim()) return setErr('Give the tender a title — it is how the bid is found later.');
    setErr(''); setSaving(true);
    try { await onSave(form); }
    catch (e) { setErr(e.message || 'Could not save the notice.'); }
    finally { setSaving(false); }
  };

  return (
    <>
      <h2 className="tw-panel-title">The notice</h2>
      <p className="tw-panel-lede">
        Who is asking, for what, and by when. Copy it as the notice prints it — an e-GP notice is in AD
        while your fiscal year is BS, and nothing here is converted.
      </p>
      <ErrorBanner msg={err} onDismiss={() => setErr('')} />

      <div className="form-group">
        <MdTextField label="Title of the assignment *" value={form.title}
          onChange={e => set('title', e.target.value)}
          placeholder="e.g. Skill Development Training in Assistant Tailor Occupation" />
      </div>

      <div className="tw-grid-2">
        <div className="form-group">
          <MdSelect label="Employer / office" value={form.client_id || ''}
            onChange={e => set('client_id', e.target.value)}>
            <MdOption value="">— Not in the client list —</MdOption>
            {clients.map(c => <MdOption key={c.id} value={c.id}>{c.fullName || c.shortName}</MdOption>)}
          </MdSelect>
        </div>
        <div className="form-group">
          <MdTextField label="Reference number" value={form.reference_no || ''}
            onChange={e => set('reference_no', e.target.value)} placeholder="e.g. BNP-2082/083-CS-VST-1.7" />
        </div>
      </div>

      {!form.client_id && (
        <div className="form-group">
          <MdTextField label="Employer / office (typed)" value={form.client_name_manual || ''}
            onChange={e => set('client_name_manual', e.target.value)}
            placeholder="e.g. Budhanilkantha Municipality Office" />
          <div className="tw-hint" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            <span>New office? Typing it is fine — or add it so the next bid can pick it.</span>
            <Btn className="btn btn-secondary btn-sm" disabled={!form.client_name_manual?.trim()}
              onClick={() => setNewClient(form.client_name_manual.trim())}><span className="material-icons-round">add</span>Add to client list</Btn>
          </div>
        </div>
      )}

      <div className="tw-grid-3">
        <div className="form-group">
          <MdTextField label="Submission deadline" value={form.submission_date || ''}
            onChange={e => set('submission_date', e.target.value)} placeholder="e.g. 17-03-2026" />
        </div>
        <div className="form-group">
          <MdTextField label="Deadline time" value={form.submission_time || ''}
            onChange={e => set('submission_time', e.target.value)} placeholder="e.g. 12:00" />
        </div>
        <div className="form-group">
          <MdSelect label="Your fiscal year" value={form.fy || ''} onChange={e => set('fy', e.target.value)}>
            <MdOption value="">— Not set —</MdOption>
            {FISCAL_YEARS.map(f => <MdOption key={f} value={f}>{f}</MdOption>)}
          </MdSelect>
        </div>
      </div>

      <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span className="tw-hint">This notice is</span>
        <div className="tw-seg" role="group" aria-label="Stage of this notice">
          {STAGES.map(st => (
            <button key={st} type="button" aria-pressed={form.stage === st}
              onClick={() => set('stage', st)}>
              {st === 'EOI' ? 'an EOI' : 'an RFP'}
            </button>
          ))}
        </div>
        <span className="tw-hint">
          {form.stage === 'EOI'
            ? 'Shortlisted bidders can be taken on to an RFP later, without retyping any of this.'
            : tender?.parent_tender_id
              ? 'Taken on from the EOI — its trades, posts and teams came with it. Add this notice’s own reference and deadline.'
              : 'Use this when the proposal was invited without an EOI round of yours.'}
        </span>
      </div>

      <details className="tw-more">
        {/* Folded to keep the first screen short, but never silently: saying
            how many are filled tells someone reopening a bid that there is
            something in here worth checking. */}
        <summary>More from the notice{moreFilled ? ` · ${moreFilled} filled` : ''}</summary>
        <div className="form-group">
          <MdTextField label="Project name" value={form.project_name || ''}
            onChange={e => set('project_name', e.target.value)}
            placeholder="Often the same as the title — copy it as the notice prints it" />
        </div>
        <div className="tw-grid-2">
          <div className="form-group">
            <MdTextField label="Office address" value={form.office_address || ''}
              onChange={e => set('office_address', e.target.value)} placeholder="e.g. Budhanilkantha, Kathmandu" />
          </div>
          <div className="form-group">
            <MdTextField label="Funding agency" value={form.funding_agency || ''}
              onChange={e => set('funding_agency', e.target.value)} placeholder="e.g. Internal Resources" />
          </div>
          <div className="form-group">
            <MdSelect label="Method of consulting service" value={form.method || 'National'}
              onChange={e => set('method', e.target.value)}>
              {METHODS.map(m => <MdOption key={m} value={m}>{m}</MdOption>)}
            </MdSelect>
          </div>
          <div className="form-group">
            <MdTextField label="Notice date" value={form.published_date || ''}
              onChange={e => set('published_date', e.target.value)} placeholder="e.g. 26-02-2026" />
          </div>
          <div className="form-group">
            <MdTextField label="Documents obtainable until" value={form.document_deadline || ''}
              onChange={e => set('document_deadline', e.target.value)} placeholder="e.g. 17-03-2026 12:00" />
          </div>
          <div className="form-group">
            <MdTextField label="Submitted through" value={form.submission_portal || ''}
              onChange={e => set('submission_portal', e.target.value)} />
          </div>
          <div className="form-group">
            <MdTextField label="Client website" value={form.client_website || ''}
              onChange={e => set('client_website', e.target.value)} placeholder="e.g. www.budhanilkanthamun.gov.np" />
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.association_allowed !== false}
                style={{ width: 16, height: 16 }}
                onChange={e => set('association_allowed', e.target.checked)} />
              <span style={{ fontSize:13 }}>Consultants may associate (joint ventures allowed)</span>
            </label>
          </div>
        </div>

        <div className="tw-section-head" style={{ marginTop: 6 }}>
          <h3 className="tw-section-title">How it will be scored</h3>
          <span className="tw-hint">Leave blank if the notice does not say.</span>
        </div>
        <div className="tw-grid-2">
          {WEIGHTS.map(([key, label]) => (
            <div className="form-group" key={key}>
              <MdTextField label={label} value={form[key] ?? ''}
                onChange={e => set(key, e.target.value)} placeholder="e.g. 40" />
            </div>
          ))}
          <div className="form-group">
            <MdTextField label="Minimum score to pass" value={form.minimum_score ?? ''}
              onChange={e => set('minimum_score', e.target.value)} placeholder="e.g. 60" />
          </div>
        </div>
        {weightTotal !== null && weightTotal !== 100 && (
          <div className="tw-warn" style={{ marginBottom: 10 }}>
            The three weights come to {weightTotal}%, not 100% — worth checking against the notice.
          </div>
        )}
        <div className="form-group">
          <MdTextField label="Notes" value={form.notes || ''} onChange={e => set('notes', e.target.value)} />
        </div>
      </details>

      {footer({
        primary: (
          <Btn className="btn btn-primary" disabled={saving} onClick={save}>
            {saving ? 'Saving…' : isNew ? 'Create tender and continue →' : 'Save and continue →'}
          </Btn>
        ),
        note: isNew ? 'Nothing is saved until you create the tender.' : null,
      })}

      {newClient !== null && (
        <NewClientModal initialName={newClient} onClose={() => setNewClient(null)}
          onSave={async (c) => {
            const created = await onAddClient(c);
            // Selected straight away, and the typed copy dropped — leaving both
            // would show the bid as unlinked despite the client now existing.
            setForm(f => ({ ...f, client_id: created.id, client_name_manual: '' }));
            setNewClient(null);
          }} />
      )}
    </>
  );
}

/**
 * Add the employer to master data without leaving the tender.
 *
 * A notice often comes from an office nobody has bid to before. Typing the name
 * alone works — it is kept as free text and the Clients screen can reconcile it
 * — but it would not be selectable next time, and the second typing is where
 * the spelling drifts.
 */
function NewClientModal({ initialName, onSave, onClose }) {
  const [form, setForm] = useState({
    fullName: initialName || '', shortName: '', type: 'Government', address: '',
  });
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <Modal title="Add employer to the client list" onClose={onClose}
      footer={<>
        <Btn className="btn btn-secondary" onClick={onClose}>Cancel</Btn>
        <Btn className="btn btn-primary" disabled={saving || !form.fullName.trim() || !form.shortName.trim()}
          onClick={async () => {
            setErr(''); setSaving(true);
            try { await onSave(form); }
            catch (e) { setErr(e.message || 'Could not add the client'); }
            finally { setSaving(false); }
          }}>{saving ? 'Adding…' : 'Add and use'}</Btn>
      </>}>
      <ErrorBanner msg={err} onDismiss={() => setErr('')} />
      <div className="form-group">
        <MdTextField label="Full name *" value={form.fullName}
          onChange={e => set('fullName', e.target.value)} />
      </div>
      <div className="form-row form-row-2">
        <div className="form-group">
          <MdTextField label="Short name / acronym *" value={form.shortName}
            onChange={e => set('shortName', e.target.value)} placeholder="e.g. BNP" />
        </div>
        <div className="form-group">
          <MdSelect label="Type" value={form.type} onChange={e => set('type', e.target.value)}>
            {CLIENT_TYPES.map(t => <MdOption key={t} value={t}>{t}</MdOption>)}
          </MdSelect>
        </div>
      </div>
      <div className="form-group">
        <MdTextField label="Address" value={form.address} onChange={e => set('address', e.target.value)} />
      </div>
    </Modal>
  );
}

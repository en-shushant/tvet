/**
 * Everything the Bolpatra (EOI) report reads off one assignment, in one place.
 *
 * The five-step editor is the right place to change an assignment. It is the
 * wrong place to close gaps before a submission: that means opening each
 * assignment, finding the EOI step, and hunting for the blank field among the
 * filled ones.
 *
 * Every field the report touches is here and editable, including the client and
 * the districts — those live elsewhere in the data model (districts hang off
 * each occupation, not the assignment) which is why an earlier version sent you
 * back to the full editor for them. Sending someone away from the screen built
 * to finish the job was the wrong call.
 *
 * Missing fields are marked and can be shown on their own, so the panel works
 * both as "fix what is broken" and as "check the whole thing before I submit".
 */
import { useState, useMemo } from 'react';
import Modal from '../ui/Modal.jsx';
import { confirmDialog } from '../ui/Feedback.jsx';
import { Btn } from '../../md.jsx';
import SearchableSelect from '../ui/SearchableSelect.jsx';
import { DistrictSearch } from '../ExperienceForm.jsx';
import { getOccupation, getClient, fyToAD, uid } from '../../utils/format.js';
import { missingBolpatraFields } from '../../utils/bolpatraGaps.js';

/** Report sections, so the order on screen matches the order in the document. */
const FIELDS = [
  { field:'assignmentName',    label:'Assignment name',        section:'3(A) · 3(B) · 3(C)' },
  { field:'contractValue',     label:'Contract value (NPR)',   section:'3(A) · 3(B)' },
  { field:'ownServiceValue',   label:'Value of your firm’s services (NPR)', section:'3(B)',
    hint:'Falls back to the contract value when blank.' },
  { field:'startDate',         label:'Contract start date (BS)', section:'3(B)', placeholder:'2082/01/15' },
  { field:'endDate',           label:'Contract end date (BS)',   section:'3(B)', placeholder:'2082/04/10' },
  { field:'durationMonths',    label:'Duration (months)',      section:'3(B) · 3(C)',
    hint:'Derived from the contract dates when both are present.' },
  { field:'totalPersonMonths', label:'Total person-months',    section:'3(B)' },
  { field:'staffCount',        label:'No. of Staff',           section:'3(B)' },
  { field:'country',           label:'Country',                section:'3(B) · 3(C)',
    hint:'Defaults to Nepal when blank.' },
  { field:'jvPartnerNames',        label:'JV partner names',        section:'3(B)', jvOnly:true },
  { field:'jvPartnerPersonMonths', label:'JV partner person-months', section:'3(B)', jvOnly:true },
  { field:'descriptionOfWork',        label:'Description of work carried out',  section:'3(A)', long:true, template:'descTemplateId' },
  { field:'narrativeDescription',     label:'Narrative description of project', section:'3(B)', long:true, template:'narrativeTemplateId' },
  { field:'actualServicesDescription',label:'Description of actual services',   section:'3(B) footer', long:true, template:'servicesTemplateId' },
  // Same shape, different source: written from the firm's key-staff roster
  // rather than a chosen template, so it checks a list length instead of a
  // templateKey being set.
  { field:'seniorStaffDescription',   label:'Senior staff involved and functions performed', section:'3(B)',
    long:true, hasSource: (inst) => !!inst?.keyStaff?.length,
    sourceHint:'Written from the firm’s key-staff roster (Institute → Edit → EOI profile) when left blank.' },
];

/**
 * Read-only context for the assignment being fixed: FY, client, occupations
 * with their trainees/duration, and districts.
 *
 * Every blank the panel below asks about belongs to this same assignment, but
 * none of that surrounding detail is otherwise on screen while filling gaps —
 * only the field list. Someone entering a contract start date has no way to
 * confirm they're looking at the right occupation or FY without leaving the
 * modal. This mirrors the read-only assignment card elsewhere in the app, cut
 * down to what's static — nothing here is editable, so the summary can't
 * drift out of sync with the fields below it.
 */
function TrainingSummary({ exp, institute, clients }) {
  const client = getClient(clients, exp.clientId);
  const districts = [...new Set(
    (exp.occupations || []).flatMap(o => (o.locations || [])).map(l => l.district).filter(Boolean))];

  return (
    <div className="gap-summary">
      <div className="gap-summary-badges">
        <span className="gap-summary-badge gap-summary-badge-fy">
          FY {exp.fy}{fyToAD(exp.fy) ? ` · ${fyToAD(exp.fy)}` : ''}
        </span>
        {exp.trainingType && <span className="gap-summary-badge">{exp.trainingType}</span>}
        {exp.isJV && <span className="gap-summary-badge">JV</span>}
        {exp.contractValue && (
          <span className="gap-summary-badge">NPR {parseInt(exp.contractValue, 10).toLocaleString()}</span>
        )}
      </div>
      <div className="gap-summary-client">
        {client.fullName || exp.clientName || institute?.name || 'Unknown client'}
        {client.shortName ? ` (${client.shortName})` : ''}
      </div>

      {(exp.occupations || []).length > 0 && (
        <div className="gap-summary-occs">
          {exp.occupations.map((occ, i) => {
            const name = getOccupation(occ.ctevtOccupationId).name || occ.nameInLetter || `Occupation ${i + 1}`;
            return (
              <div key={occ.id || i} className="gap-summary-occ">
                <span className="gap-summary-occ-name">
                  {name}{occ.level ? <span className="gap-summary-occ-level"> · {occ.level}</span> : ''}
                </span>
                <span className="gap-summary-occ-stats">
                  {occ.trainees ? `${occ.trainees} trainees` : ''}
                  {occ.trainees && occ.duration ? ' · ' : ''}
                  {occ.duration ? `${occ.duration}h` : ''}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {districts.length > 0 && (
        <div className="gap-summary-districts">
          {districts.map(d => <span key={d} className="gap-summary-district">{d}</span>)}
        </div>
      )}
    </div>
  );
}

export default function BolpatraGapsModal({ exp, institute, clients = [], onSave, onClose }) {
  const [form, setForm] = useState(() => ({ ...exp, occupations: (exp.occupations || []).map(o => ({ ...o })) }));
  const [onlyMissing, setOnlyMissing] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  /**
   * What was missing when the panel opened, captured once.
   *
   * Filling a field must not remove it from the page. An earlier version
   * recomputed the visible list on every keystroke, so typing into the last
   * remaining gap made the whole form vanish and be replaced by "nothing
   * outstanding" — hiding the value just typed, claiming the assignment was
   * complete when nothing had been saved, and inviting a close that silently
   * discarded the work.
   */
  const [initialGapKeys] = useState(
    () => new Set(missingBolpatraFields(exp, institute).map(g => g.key)));

  // Live, so a filled field can be ticked rather than removed.
  const gaps = missingBolpatraFields(form, institute);
  const missingKeys = useMemo(() => new Set(gaps.map(g => g.key)), [gaps]);
  const resolvedCount = [...initialGapKeys].filter(k => !missingKeys.has(k)).length;
  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify({ ...exp, occupations: (exp.occupations || []).map(o => ({ ...o })) }),
    [form, exp]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const clientMissing = missingKeys.has('client');
  const locationMissing = missingKeys.has('location');

  // A field stays on screen once shown: currently missing, or missing when the
  // panel opened and now filled but not yet saved.
  const wasMissing = (key) => initialGapKeys.has(key);
  const relevant = (f) => missingKeys.has(f.field) || wasMissing(f.field)
    || (f.field === 'startDate' && (missingKeys.has('dates') || wasMissing('dates')));

  const visible = FIELDS.filter(f => {
    if (f.jvOnly && !form.isJV) return false;
    return onlyMissing ? relevant(f) : true;
  });

  const showClient = !onlyMissing || missingKeys.has('client') || wasMissing('client');
  const showLocations = !onlyMissing || missingKeys.has('location') || wasMissing('location');

  /**
   * Districts hang off occupations, and an occupation can carry several — the
   * report joins them all into one location cell. So these add and remove
   * rather than overwrite; an earlier version edited only the first, which
   * quietly made a multi-district occupation look single-district.
   */
  const addOccDistrict = (occIdx, district, province) => setForm(f => ({
    ...f,
    occupations: f.occupations.map((o, i) => {
      if (i !== occIdx || !district) return o;
      const existing = o.locations || [];
      if (existing.some(l => l.district === district)) return o;   // no duplicates
      return { ...o, locations: [...existing, { id: uid(), district, province, localLevels: [] }] };
    }),
  }));

  const removeOccDistrict = (occIdx, district) => setForm(f => ({
    ...f,
    occupations: f.occupations.map((o, i) => i !== occIdx
      ? o
      : { ...o, locations: (o.locations || []).filter(l => l.district !== district) }),
  }));

  const requestClose = async () => {
    if (!dirty) return onClose();
    const ok = await confirmDialog({
      title: 'Discard these changes?',
      message: 'The fields you filled here have not been saved.',
      confirmLabel: 'Discard', danger: true,
    });
    if (ok) onClose();
  };

  const save = async () => {
    setErr(''); setSaving(true);
    try { await onSave(form); }
    catch (e) { setErr(e.message || 'Failed to save'); setSaving(false); }
  };

  return (
    <Modal title="EOI details" onClose={requestClose} size="lg"
      footer={<>
        <Btn className="btn btn-secondary" onClick={requestClose}>Cancel</Btn>
        <Btn className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Btn>
      </>}>

      {err && <div className="gap-error">{err}</div>}

      <TrainingSummary exp={form} institute={institute} clients={clients} />

      <div className="gap-head">
        <p className="gap-intro">
          <strong>{form.assignmentName || 'This assignment'}</strong>
          {gaps.length > 0
            ? ` — ${gaps.length} ${gaps.length === 1 ? 'field' : 'fields'} the report would leave blank.`
            : resolvedCount > 0
              // Deliberately not "nothing missing": nothing is written until Save.
              ? ` — ${resolvedCount} filled. Save to apply.`
              : ' — prints in full, nothing missing.'}
        </p>
        <label className="gap-toggle">
          <input type="checkbox" checked={onlyMissing} onChange={e => setOnlyMissing(e.target.checked)}/>
          Only what’s missing
        </label>
      </div>

      {onlyMissing && gaps.length === 0 && initialGapKeys.size === 0 ? (
        <div className="gap-clear">
          Nothing outstanding. Untick above to review every field the report uses.
        </div>
      ) : (
        <>
          {showClient && (
            <div className={`gap-field${clientMissing ? ' gap-field-missing' : ''}`}>
              <label>Client <span className="gap-section">3(A) · 3(B)</span></label>
              {form.manualClient ? (
                <input value={form.clientName || ''} placeholder="Type client name"
                  onChange={e => set('clientName', e.target.value)}/>
              ) : (
                <SearchableSelect
                  value={form.clientId}
                  onChange={v => set('clientId', v)}
                  placeholder="— Select client —"
                  options={clients.map(c => ({ value: c.id, label: `${c.shortName} — ${c.fullName}` }))}/>
              )}
              <button type="button" className="gap-linkbtn"
                onClick={() => { set('manualClient', !form.manualClient); set('clientId',''); set('clientName',''); }}>
                {form.manualClient ? '← Choose from the list' : '+ Enter a name instead'}
              </button>
            </div>
          )}

          {visible.map(f => (
            <div key={f.field}
              className={`gap-field${
                missingKeys.has(f.field) || (f.field==='startDate' && missingKeys.has('dates')) ? ' gap-field-missing'
                : wasMissing(f.field) || (f.field==='startDate' && wasMissing('dates')) ? ' gap-field-fixed' : ''}`}>
              <label htmlFor={`gap-${f.field}`}>
                {f.label} <span className="gap-section">{f.section}</span>
                {!missingKeys.has(f.field) && wasMissing(f.field) && (
                  <span className="gap-fixed-tag">filled — not saved yet</span>
                )}
              </label>
              {(() => {
                const fromTemplate = f.template && institute?.[f.template];
                const fromRoster = f.hasSource && f.hasSource(institute);
                if (fromTemplate) return <p className="gap-hint">Written from the firm’s assigned template when left blank.</p>;
                if (fromRoster) return <p className="gap-hint">{f.sourceHint}</p>;
                return f.hint ? <p className="gap-hint">{f.hint}</p> : null;
              })()}
              {f.long
                ? <textarea id={`gap-${f.field}`} rows={4} value={form[f.field] || ''}
                    onChange={e => set(f.field, e.target.value)}/>
                : <input id={`gap-${f.field}`} value={form[f.field] || ''} placeholder={f.placeholder}
                    onChange={e => set(f.field, e.target.value)}/>}
            </div>
          ))}

          {showLocations && (
            <div className={`gap-field${locationMissing ? ' gap-field-missing' : ''}`}>
              <label>Districts <span className="gap-section">3(A) · 3(B) · 3(C)</span></label>
              <p className="gap-hint">
                Held against each occupation rather than the assignment, so they are set per row.
              </p>
              {form.occupations.length === 0 ? (
                <div className="gap-note">
                  This assignment has no occupations yet — add one in the full editor first.
                </div>
              ) : form.occupations.map((occ, i) => {
                const districts = (occ.locations || []).map(l => l.district).filter(Boolean);
                return (
                  <div key={occ.id || i} className="gap-occ-row">
                    <span className="gap-occ-name">
                      {getOccupation(occ.ctevtOccupationId).name || occ.nameInLetter || `Occupation ${i + 1}`}
                    </span>
                    <div className="gap-occ-district">
                      {districts.length > 0 && (
                        <div className="gap-chips">
                          {districts.map(d => (
                            <span key={d} className="gap-chip-district">
                              {d}
                              <button type="button" aria-label={`Remove ${d}`}
                                onClick={() => removeOccDistrict(i, d)}>&times;</button>
                            </span>
                          ))}
                        </div>
                      )}
                      {/* Cleared after each pick so the field is always ready for
                          the next district rather than showing the last one. */}
                      <DistrictSearch key={districts.join('|')} value=""
                        onChange={(district, province) => addOccDistrict(i, district, province)}/>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

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
import { Btn } from '../../md.jsx';
import SearchableSelect from '../ui/SearchableSelect.jsx';
import { DistrictSearch } from '../ExperienceForm.jsx';
import { getOccupation } from '../../utils/format.js';
import { missingBolpatraFields } from '../../utils/bolpatraGaps.js';
import { uid } from '../../utils/format.js';

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
  { field:'country',           label:'Country',                section:'3(B) · 3(C)',
    hint:'Defaults to Nepal when blank.' },
  { field:'jvPartnerNames',        label:'JV partner names',        section:'3(B)', jvOnly:true },
  { field:'jvPartnerPersonMonths', label:'JV partner person-months', section:'3(B)', jvOnly:true },
  { field:'descriptionOfWork',        label:'Description of work carried out',  section:'3(A)', long:true, template:'descTemplateId' },
  { field:'narrativeDescription',     label:'Narrative description of project', section:'3(B)', long:true, template:'narrativeTemplateId' },
  { field:'actualServicesDescription',label:'Description of actual services',   section:'3(B) footer', long:true, template:'servicesTemplateId' },
];

export default function BolpatraGapsModal({ exp, institute, clients = [], onSave, onClose }) {
  const [form, setForm] = useState(() => ({ ...exp, occupations: (exp.occupations || []).map(o => ({ ...o })) }));
  const [onlyMissing, setOnlyMissing] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  // Recomputed from the working copy, so the list shrinks as fields are filled.
  const gaps = missingBolpatraFields(form, institute);
  const missingKeys = useMemo(() => new Set(gaps.map(g => g.key)), [gaps]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const clientMissing = missingKeys.has('client');
  const locationMissing = missingKeys.has('location');

  const visible = FIELDS.filter(f => {
    if (f.jvOnly && !form.isJV) return false;
    if (!onlyMissing) return true;
    // durationMonths and dates share a key in the gap check.
    return missingKeys.has(f.field) || (f.field === 'startDate' && missingKeys.has('dates'));
  });

  const showClient = !onlyMissing || clientMissing;
  const showLocations = !onlyMissing || locationMissing;

  /** Districts hang off occupations, so each one is edited in place. */
  const setOccDistrict = (occIdx, district, province) => setForm(f => ({
    ...f,
    occupations: f.occupations.map((o, i) => {
      if (i !== occIdx) return o;
      const locations = o.locations && o.locations.length
        ? o.locations.map((l, li) => li === 0 ? { ...l, district, province } : l)
        : [{ id: uid(), district, province, localLevels: [] }];
      return { ...o, locations };
    }),
  }));

  const save = async () => {
    setErr(''); setSaving(true);
    try { await onSave(form); }
    catch (e) { setErr(e.message || 'Failed to save'); setSaving(false); }
  };

  return (
    <Modal title="EOI details" onClose={onClose} size="lg"
      footer={<>
        <Btn className="btn btn-secondary" onClick={onClose}>Cancel</Btn>
        <Btn className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Btn>
      </>}>

      {err && <div className="gap-error">{err}</div>}

      <div className="gap-head">
        <p className="gap-intro">
          <strong>{form.assignmentName || 'This assignment'}</strong>
          {gaps.length === 0
            ? ' — prints in full, nothing missing.'
            : ` — ${gaps.length} ${gaps.length === 1 ? 'field' : 'fields'} the report would leave blank.`}
        </p>
        <label className="gap-toggle">
          <input type="checkbox" checked={onlyMissing} onChange={e => setOnlyMissing(e.target.checked)}/>
          Only what’s missing
        </label>
      </div>

      {onlyMissing && gaps.length === 0 ? (
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
              className={`gap-field${missingKeys.has(f.field) || (f.field==='startDate' && missingKeys.has('dates')) ? ' gap-field-missing' : ''}`}>
              <label htmlFor={`gap-${f.field}`}>
                {f.label} <span className="gap-section">{f.section}</span>
              </label>
              {(f.hint || (f.template && institute?.[f.template])) && (
                <p className="gap-hint">
                  {f.template && institute?.[f.template]
                    ? 'Written from the firm’s assigned template when left blank.'
                    : f.hint}
                </p>
              )}
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
              ) : form.occupations.map((occ, i) => (
                <div key={occ.id || i} className="gap-occ-row">
                  <span className="gap-occ-name">
                    {getOccupation(occ.ctevtOccupationId).name || occ.nameInLetter || `Occupation ${i + 1}`}
                  </span>
                  <div className="gap-occ-district">
                    <DistrictSearch
                      value={(occ.locations || [])[0]?.district || ''}
                      onChange={(district, province) => setOccDistrict(i, district, province)}/>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

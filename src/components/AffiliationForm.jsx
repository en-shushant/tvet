import { useState } from 'react';
import Modal from './ui/Modal.jsx';
import { ErrorBanner } from './ui/Modal.jsx';
import SearchableSelect from './ui/SearchableSelect.jsx';
import { AFFILIATION_TYPES, OCCUPATIONS } from '../constants/data.js';

const uid = () => Math.random().toString(36).slice(2,9);

function AffiliationForm({record, onSave, onClose}) {
  const [form, setForm] = useState(record || {
    patraNo:'', chalaniNo:'', affiliationDate:'', type:'Thap Choto Awadhi',
    validityYears:2, expiryDate:'', status:'Active', remarks:'', programs:[]
  });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const [err, setErr] = useState('');

  const addProg = () => set('programs', [...form.programs, {id:uid(), name:'', level:'Level 1', duration:'', seats:20}]);
  const setProg = (i,k,v) => set('programs', form.programs.map((p,idx)=>idx===i?{...p,[k]:v}:p));
  const removeProg = (i) => set('programs', form.programs.filter((_,idx)=>idx!==i));

  return (
    <Modal title={record ? 'Edit Affiliation' : 'Add Affiliation'} onClose={onClose} size="modal-lg"
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={async()=>{setErr('');try{await onSave(form);}catch(e){setErr(e.message||'Failed to save');}}}>Save affiliation</button>
      </>}>
      <ErrorBanner msg={err} onDismiss={()=>setErr('')}/>
      <div className="form-row form-row-3">
        <div className="form-group">
          <label>Affiliation No. <span style={{fontWeight:400, color:'var(--text3)'}}>(Chalani no./Patra Sankhya)</span></label>
          <input value={form.chalaniNo} onChange={e=>set('chalaniNo',e.target.value)} placeholder="e.g. 3496"/>
        </div>
        <div className="form-group">
          <label>Affiliation date *</label>
          <input value={form.affiliationDate} onChange={e=>set('affiliationDate',e.target.value)} placeholder="YYYY/MM/DD"/>
        </div>
      </div>
      <div className="form-row form-row-3">
        <div className="form-group">
          <label>Affiliation type</label>
          <select value={form.type} onChange={e=>set('type',e.target.value)}>
            {AFFILIATION_TYPES.map(t=><option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Validity (years)</label>
          <input type="number" value={form.validityYears} onChange={e=>set('validityYears',parseInt(e.target.value))}/>
        </div>
        <div className="form-group">
          <label>Expiry date</label>
          <input value={form.expiryDate} onChange={e=>set('expiryDate',e.target.value)} placeholder="YYYY/MM/DD"/>
        </div>
      </div>
      <div className="form-row form-row-2">
        <div className="form-group">
          <label>Status</label>
          <select value={form.status} onChange={e=>set('status',e.target.value)}>
            <option>Active</option><option>Expired</option><option>Pending Renewal</option>
          </select>
        </div>
      </div>

      <div className="sub-section">
        <div className="sub-section-title">Affiliated programs</div>
        {form.programs.map((prog, i) => (
          <div className="repeatable-row" key={prog.id||i}>
            <button className="remove-btn" onClick={()=>removeProg(i)}>✕</button>
            <div className="form-row" style={{gridTemplateColumns:'2fr 1fr 1fr 1fr', gap:8, marginBottom:0}}>
              <div>
                <label>Program / occupation name</label>
                <SearchableSelect value={prog.name} onChange={v=>setProg(i,'name',v)} placeholder="— Select —"
                  options={OCCUPATIONS.map(o=>({value:o.name,label:o.name}))}/>
              </div>
              <div><label>Level</label>
                <select value={prog.level} onChange={e=>setProg(i,'level',e.target.value)}>
                  <option>Level 1</option><option>Level 2</option><option>Professional</option>
                </select>
              </div>
              <div><label>Duration (hrs)</label>
                <input type="number" value={prog.duration} onChange={e=>setProg(i,'duration',e.target.value)}/>
              </div>
              <div><label>Seats/batch</label>
                <input type="number" value={prog.seats} onChange={e=>setProg(i,'seats',e.target.value)}/>
              </div>
            </div>
          </div>
        ))}
        <button className="add-row-btn" onClick={addProg}>+ Add program</button>
      </div>
    </Modal>
  );
}
export default AffiliationForm;

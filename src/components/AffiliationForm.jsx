import { useState } from 'react';
import Modal from './ui/Modal.jsx';
import { ErrorBanner } from './ui/Modal.jsx';
import { useUnsavedGuard } from './ui/UnsavedGuard.jsx';
import SearchableSelect from './ui/SearchableSelect.jsx';
import { AFFILIATION_TYPES, OCCUPATIONS } from '../constants/data.js';
import { Btn, MdTextField, MdSelect, MdOption } from '../md.jsx';

const uid = () => Math.random().toString(36).slice(2,9);

function AffiliationForm({record, onSave, onClose}) {
  const [form, setForm] = useState(record || {
    patraNo:'', chalaniNo:'', affiliationDate:'', type:'Thap Choto Awadhi',
    validityYears:2, expiryDate:'', status:'Active', remarks:'', programs:[]
  });
  const { handleClose, markDirty, markClean, UnsavedModal } = useUnsavedGuard(onClose);
  const set = (k,v) => { markDirty(); setForm(f=>({...f,[k]:v})); };
  const [err, setErr] = useState('');

  const addProg = () => set('programs', [...form.programs, {id:uid(), name:'', level:'Level 1', duration:'', seats:20}]);
  const setProg = (i,k,v) => set('programs', form.programs.map((p,idx)=>idx===i?{...p,[k]:v}:p));
  const removeProg = (i) => set('programs', form.programs.filter((_,idx)=>idx!==i));

  return (
    <>{UnsavedModal}
    <Modal title={record ? 'Edit Affiliation' : 'Add Affiliation'} onClose={handleClose} size="lg"
      footer={<>
        <Btn className="btn btn-secondary" onClick={handleClose}>Cancel</Btn>
        <Btn className="btn btn-primary" onClick={async()=>{setErr('');try{markClean();await onSave(form);}catch(e){markDirty();setErr(e.message||'Failed to save');}}}>Save affiliation</Btn>
      </>}>
      <ErrorBanner msg={err} onDismiss={()=>setErr('')}/>
      <div className="form-row form-row-3">
        <div className="form-group">
          <MdTextField label="Affiliation No. (Chalani / Patra Sankhya)" value={form.chalaniNo}
            onChange={e=>set('chalaniNo',e.target.value)} placeholder="e.g. 3496"/>
        </div>
        <div className="form-group">
          <MdTextField label="Affiliation date *" value={form.affiliationDate}
            onChange={e=>set('affiliationDate',e.target.value)} placeholder="YYYY/MM/DD"/>
        </div>
      </div>
      <div className="form-row form-row-3">
        <div className="form-group">
          <MdSelect label="Affiliation type" value={form.type} onChange={e=>set('type',e.target.value)}>
            {AFFILIATION_TYPES.map(t=><MdOption key={t} value={t}>{t}</MdOption>)}
          </MdSelect>
        </div>
        <div className="form-group">
          <MdTextField type="number" label="Validity (years)" value={form.validityYears}
            onChange={e=>set('validityYears',parseInt(e.target.value))}/>
        </div>
        <div className="form-group">
          <MdTextField label="Expiry date" value={form.expiryDate}
            onChange={e=>set('expiryDate',e.target.value)} placeholder="YYYY/MM/DD"/>
        </div>
      </div>
      <div className="form-row form-row-2">
        <div className="form-group">
          <MdSelect label="Status" value={form.status} onChange={e=>set('status',e.target.value)}>
            <MdOption value="Active">Active</MdOption>
            <MdOption value="Expired">Expired</MdOption>
            <MdOption value="Pending Renewal">Pending Renewal</MdOption>
          </MdSelect>
        </div>
      </div>

      <div className="sub-section">
        <div className="sub-section-title">Affiliated programs</div>
        {form.programs.map((prog, i) => (
          <div className="repeatable-row" key={prog.id||i}>
            <button className="remove-btn" onClick={()=>removeProg(i)}>✕</button>
            <div className="form-row" style={{gridTemplateColumns:'2fr 1fr 1fr 1fr', gap:8, marginBottom:0}}>
              <div className="form-group" style={{marginBottom:0}}>
                <label>Program / occupation name</label>
                <SearchableSelect value={prog.name} onChange={v=>setProg(i,'name',v)} placeholder="— Select —"
                  options={OCCUPATIONS.map(o=>({value:o.name,label:o.name}))}/>
              </div>
              <div className="form-group" style={{marginBottom:0}}>
                <MdSelect label="Level" value={prog.level} onChange={e=>setProg(i,'level',e.target.value)}>
                  <MdOption value="Level 1">Level 1</MdOption>
                  <MdOption value="Level 2">Level 2</MdOption>
                  <MdOption value="Professional">Professional</MdOption>
                </MdSelect>
              </div>
              <div className="form-group" style={{marginBottom:0}}>
                <MdTextField type="number" label="Duration (hrs)"
                  value={prog.duration} onChange={e=>setProg(i,'duration',e.target.value)}/>
              </div>
              <div className="form-group" style={{marginBottom:0}}>
                <MdTextField type="number" label="Seats/batch"
                  value={prog.seats} onChange={e=>setProg(i,'seats',e.target.value)}/>
              </div>
            </div>
          </div>
        ))}
        <button className="add-row-btn" onClick={addProg}>+ Add program</button>
      </div>
    </Modal>
    </>
  );
}
export default AffiliationForm;

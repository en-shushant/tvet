import { useState } from 'react';
import Modal from './ui/Modal.jsx';
import { ErrorBanner } from './ui/Modal.jsx';
import { useUnsavedGuard } from './ui/UnsavedGuard.jsx';
import SearchableSelect from './ui/SearchableSelect.jsx';
import { FISCAL_YEARS } from '../constants/data.js';
import { Btn, MdTextField } from '../md.jsx';
import { fyToAD } from '../utils/format.js';


function TaxForm({record, onSave, onClose}) {
  const [form, setForm] = useState(record || {
    fy:'2081/82', turnover:'', taxableIncome:'', taxPaid:'',
    certDate:'', karChutaNo:'', patraNo:'', incomeStatementDate:'', remarks:''
  });
  const { handleClose, markDirty, markClean, UnsavedModal } = useUnsavedGuard(onClose);
  const set = (k,v) => { markDirty(); setForm(f=>({...f,[k]:v})); };
  const [err, setErr] = useState('');

  return (
    <>{UnsavedModal}
    <Modal title={record ? 'Edit Tax Clearance' : 'Add Tax Clearance'} onClose={handleClose}
      footer={<>
        <Btn className="btn btn-secondary" onClick={handleClose}>Cancel</Btn>
        <Btn className="btn btn-primary" onClick={async()=>{setErr('');try{markClean();await onSave(form);}catch(e){markDirty();setErr(e.message||'Failed to save');}}}>Save record</Btn>
      </>}>
      <ErrorBanner msg={err} onDismiss={()=>setErr('')}/>
      <div className="form-row form-row-2">
        <div className="form-group">
          <label>Fiscal year *</label>
          <SearchableSelect value={form.fy} onChange={v=>set('fy',v)} placeholder="— Select FY —"
            options={FISCAL_YEARS.slice().reverse().map(fy=>({value:fy,label:`${fy}  (${fyToAD(fy)})`}))}/>
        </div>
        <div className="form-group">
          <MdTextField label="Certificate date *" value={form.certDate}
            onChange={e=>set('certDate',e.target.value)} placeholder="YYYY/MM/DD"/>
        </div>
      </div>
      <div className="form-row form-row-3">
        <div className="form-group">
          <MdTextField type="number" label="Total turnover / Karobar (NPR) *"
            value={form.turnover} onChange={e=>set('turnover',parseInt(e.target.value)||'')}/>
        </div>
        <div className="form-group">
          <MdTextField type="number" label="Taxable income / Kar Yogya Aay (NPR) *"
            value={form.taxableIncome} onChange={e=>set('taxableIncome',parseInt(e.target.value)||'')}/>
        </div>
        <div className="form-group">
          <MdTextField type="number" label="Tax paid / Dakhila Gareko Kar (NPR) *"
            value={form.taxPaid} onChange={e=>set('taxPaid',parseInt(e.target.value)||'')}/>
        </div>
      </div>
      <div className="form-row form-row-3">
        <div className="form-group">
          <MdTextField label="Kar Chukta No." value={form.karChutaNo}
            onChange={e=>set('karChutaNo',e.target.value)}/>
        </div>
        <div className="form-group">
          <MdTextField label="Patra Sankhya (Letter no.)" value={form.patraNo}
            onChange={e=>set('patraNo',e.target.value)}/>
        </div>
        <div className="form-group">
          <MdTextField label="Income statement date" value={form.incomeStatementDate}
            onChange={e=>set('incomeStatementDate',e.target.value)} placeholder="YYYY/MM/DD"/>
        </div>
      </div>
      <div className="form-group">
        <MdTextField type="textarea" label="Remarks" value={form.remarks}
          onChange={e=>set('remarks',e.target.value)} rows={2}/>
      </div>
    </Modal>
    </>
  );
}
export default TaxForm;

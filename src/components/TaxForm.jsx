import { useState } from 'react';
import Modal from './ui/Modal.jsx';
import { ErrorBanner } from './ui/Modal.jsx';
import SearchableSelect from './ui/SearchableSelect.jsx';
import { FISCAL_YEARS } from '../constants/data.js';

const fyToAD = (fy) => {
  if (!fy) return '';
  const parts = fy.split('/');
  if (parts.length !== 2) return '';
  const y1 = parseInt(parts[0]);
  if (isNaN(y1)) return '';
  return `${y1-57}/${String(y1-57+1).slice(-2)}`;
};

function TaxForm({record, onSave, onClose}) {
  const [form, setForm] = useState(record || {
    fy:'2081/82', turnover:'', taxableIncome:'', taxPaid:'',
    certDate:'', karChutaNo:'', patraNo:'', incomeStatementDate:'', remarks:''
  });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const [err, setErr] = useState('');

  return (
    <Modal title={record ? 'Edit Tax Clearance' : 'Add Tax Clearance'} onClose={onClose}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={async()=>{setErr('');try{await onSave(form);}catch(e){setErr(e.message||'Failed to save');}}}>Save record</button>
      </>}>
      <ErrorBanner msg={err} onDismiss={()=>setErr('')}/>
      <div className="form-row form-row-2">
        <div className="form-group">
          <label>Fiscal year *</label>
          <SearchableSelect value={form.fy} onChange={v=>set('fy',v)} placeholder="— Select FY —"
            options={FISCAL_YEARS.slice().reverse().map(fy=>({value:fy,label:`${fy}  (${fyToAD(fy)})`}))}/>
        </div>
        <div className="form-group">
          <label>Certificate date *</label>
          <input value={form.certDate} onChange={e=>set('certDate',e.target.value)} placeholder="YYYY/MM/DD"/>
        </div>
      </div>
      <div className="form-row form-row-3">
        <div className="form-group">
          <label>Total turnover / Karobar (NPR) *</label>
          <input type="number" value={form.turnover} onChange={e=>set('turnover',parseInt(e.target.value)||'')}/>
        </div>
        <div className="form-group">
          <label>Taxable income / Kar Yogya Aay (NPR) *</label>
          <input type="number" value={form.taxableIncome} onChange={e=>set('taxableIncome',parseInt(e.target.value)||'')}/>
        </div>
        <div className="form-group">
          <label>Tax paid / Dakhila Gareko Kar (NPR) *</label>
          <input type="number" value={form.taxPaid} onChange={e=>set('taxPaid',parseInt(e.target.value)||'')}/>
        </div>
      </div>
      <div className="form-row form-row-3">
        <div className="form-group">
          <label>Kar Chukta No.</label>
          <input value={form.karChutaNo} onChange={e=>set('karChutaNo',e.target.value)}/>
        </div>
        <div className="form-group">
          <label>Patra Sankhya (Letter no.)</label>
          <input value={form.patraNo} onChange={e=>set('patraNo',e.target.value)}/>
        </div>
        <div className="form-group">
          <label>Income statement date</label>
          <input value={form.incomeStatementDate} onChange={e=>set('incomeStatementDate',e.target.value)} placeholder="YYYY/MM/DD"/>
        </div>
      </div>
      <div className="form-group">
        <label>Remarks</label>
        <textarea value={form.remarks} onChange={e=>set('remarks',e.target.value)} rows={2}/>
      </div>
    </Modal>
  );
}
export default TaxForm;

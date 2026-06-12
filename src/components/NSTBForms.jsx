import { useState } from 'react';
import Modal from './ui/Modal.jsx';
import { ErrorBanner } from './ui/Modal.jsx';
import SearchableSelect from './ui/SearchableSelect.jsx';
import { FISCAL_YEARS, NSTB_LEVELS, OCCUPATIONS } from '../constants/data.js';

const fyToAD = (fy) => {
  if (!fy) return '';
  const parts = fy.split('/');
  if (parts.length !== 2) return '';
  const y1 = parseInt(parts[0]);
  if (isNaN(y1)) return '';
  return `${y1-57}/${String(y1-57+1).slice(-2)}`;
};

// ─── NSTB FORM ───────────────────────────────────────────────────────────────

const EMPTY_OCC_ROW = () => ({ _id: Date.now() + Math.random(), occupation:'', level:'Level 1', applied:'', appeared:'', pass:'' });

// Edit modal — single record, keep as modal
function NSTBEditModal({record, onSave, onClose}) {
  const [shared, setShared] = useState({ fy: record.fy, letterNo: record.letterNo||'', letterDate: record.letterDate||'', letterType: record.letterType||'Annual', remarks: record.remarks||'' });
  const [row, setRow] = useState({ occupation: record.occupation, level: record.level, applied: record.applied, appeared: record.appeared, pass: record.pass });
  const [err, setErr] = useState('');
  const setS = (k,v) => setShared(s=>({...s,[k]:v}));
  const setR = (k,v) => setRow(r=>({...r,[k]:v}));
  const handleSave = async () => {
    if (!row.occupation.trim()) { setErr('Occupation is required.'); return; }
    setErr('');
    try { await onSave({ ...record, ...shared, ...row }); }
    catch(e) { setErr(e.message || 'Failed to save'); }
  };
  return (
    <Modal title="Edit NSTB Record" onClose={onClose}
      footer={<><button className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={handleSave}>Save</button></>}>
      <ErrorBanner msg={err} onDismiss={()=>setErr('')}/>
      <div className="form-row form-row-3" style={{marginBottom:12}}>
        <div className="form-group"><label>Fiscal year *</label>
          <SearchableSelect value={shared.fy} onChange={v=>setS('fy',v)} options={FISCAL_YEARS.slice().reverse().map(fy=>({value:fy,label:`${fy} (${fyToAD(fy)})`}))}/>
        </div>
        <div className="form-group"><label>Letter no.</label><input value={shared.letterNo} onChange={e=>setS('letterNo',e.target.value)}/></div>
        <div className="form-group"><label>Letter date</label><input value={shared.letterDate} onChange={e=>setS('letterDate',e.target.value)} placeholder="YYYY/MM/DD"/></div>
      </div>
      <div className="form-row form-row-2" style={{marginBottom:16}}>
        <div className="form-group"><label>Letter type</label>
          <select value={shared.letterType} onChange={e=>setS('letterType',e.target.value)}><option>Annual</option><option>Consolidated</option></select>
        </div>
        <div className="form-group"><label>Remarks</label><input value={shared.remarks} onChange={e=>setS('remarks',e.target.value)}/></div>
      </div>
      <div className="form-group"><label>Occupation *</label>
        <SearchableSelect value={row.occupation} onChange={v=>setR('occupation',v)} placeholder="— Select occupation —"
          options={OCCUPATIONS.map(o=>({value:o.name, label:o.name}))}/>
      </div>
      <div className="form-row" style={{gridTemplateColumns:'2fr 1fr 1fr 1fr', gap:8}}>
        <div className="form-group" style={{marginBottom:0}}><label>Level</label>
          <select value={row.level} onChange={e=>setR('level',e.target.value)}>{NSTB_LEVELS.map(l=><option key={l}>{l}</option>)}</select>
        </div>
        <div className="form-group" style={{marginBottom:0}}><label>Applied</label>
          <input type="number" value={row.applied} onChange={e=>setR('applied',e.target.value===''?'':parseInt(e.target.value))}/>
        </div>
        <div className="form-group" style={{marginBottom:0}}><label>Appeared</label>
          <input type="number" value={row.appeared} onChange={e=>setR('appeared',e.target.value===''?'':parseInt(e.target.value))}/>
        </div>
        <div className="form-group" style={{marginBottom:0}}><label>Pass</label>
          <input type="number" value={row.pass} onChange={e=>setR('pass',e.target.value===''?'':parseInt(e.target.value))}/>
        </div>
      </div>
    </Modal>
  );
}

// Add subpage — shared letter + compact table, one occupation per line
function NSTBBulkPage({instituteName, onSave, onBack}) {
  const [shared, setShared] = useState({ fy:'2081/82', letterNo:'', letterDate:'', letterType:'Annual', remarks:'' });
  const [rows, setRows] = useState([EMPTY_OCC_ROW()]);
  const setS = (k,v) => setShared(s=>({...s,[k]:v}));
  const setOcc = (id,k,v) => setRows(rs => rs.map(r => r._id===id ? {...r,[k]:v} : r));
  const addRow = () => setRows(rs => [...rs, EMPTY_OCC_ROW()]);
  const removeRow = (id) => setRows(rs => rs.filter(r => r._id !== id));

  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    const valid = rows.filter(r => r.occupation.trim());
    if (!valid.length) { setErr('Fill at least one occupation name.'); return; }
    setSaving(true); setErr('');
    try { await onSave(valid.map(row => ({ ...shared, ...row }))); }
    catch(e) { setErr(e.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const thS = {fontSize:11, fontWeight:600, color:'var(--text3)', padding:'6px 8px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap'};
  const tdS = {padding:'5px 4px', verticalAlign:'middle'};

  return (
    <div style={{paddingBottom:40}}>
      <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:10}}>
        <div>
          <button onClick={onBack} style={{background:'none',border:'none',cursor:'pointer',color:'var(--accent)',fontSize:13,padding:0,marginBottom:4,display:'flex',alignItems:'center',gap:4}}>
            ← Back to {instituteName}
          </button>
          <h2 style={{margin:0, fontSize:18, fontWeight:700}}>Add NSTB Records</h2>
          <div style={{fontSize:12, color:'var(--text3)', marginTop:4}}>One occupation per row — all rows share the same letter details.</div>
        </div>
        <div style={{display:'flex', gap:8}}>
          <button className="btn btn-ghost" onClick={addRow}>+ Add row</button>
          <button className="btn btn-secondary" onClick={onBack}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : `Save ${rows.length} record${rows.length>1?'s':''}`}</button>
        </div>
      </div>

      {/* Shared letter details */}
      <div style={{background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:'14px 16px', marginBottom:20}}>
        <div style={{fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:12}}>Letter details (shared for all rows)</div>
        <div className="form-row form-row-3" style={{marginBottom:8}}>
          <div className="form-group" style={{marginBottom:0}}><label>Fiscal year *</label>
            <SearchableSelect value={shared.fy} onChange={v=>setS('fy',v)} options={FISCAL_YEARS.slice().reverse().map(fy=>({value:fy,label:`${fy} (${fyToAD(fy)})`}))}/>
          </div>
          <div className="form-group" style={{marginBottom:0}}><label>Letter no.</label>
            <input value={shared.letterNo} onChange={e=>setS('letterNo',e.target.value)} placeholder="Patra Sankhya"/>
          </div>
          <div className="form-group" style={{marginBottom:0}}><label>Letter date</label>
            <input value={shared.letterDate} onChange={e=>setS('letterDate',e.target.value)} placeholder="YYYY/MM/DD"/>
          </div>
        </div>
        <div className="form-row form-row-2">
          <div className="form-group" style={{marginBottom:0}}><label>Letter type</label>
            <select value={shared.letterType} onChange={e=>setS('letterType',e.target.value)}><option>Annual</option><option>Consolidated</option></select>
          </div>
          <div className="form-group" style={{marginBottom:0}}><label>Remarks</label>
            <input value={shared.remarks} onChange={e=>setS('remarks',e.target.value)}/>
          </div>
        </div>
      </div>

      {/* Occupation table */}
      <div style={{overflowX:'auto'}}>
        <table style={{width:'100%', borderCollapse:'collapse', fontSize:12}}>
          <thead>
            <tr>
              <th style={{...thS, width:28}}>#</th>
              <th style={thS}>Occupation *</th>
              <th style={{...thS, width:120}}>Level</th>
              <th style={{...thS, width:90}}>Applied</th>
              <th style={{...thS, width:90}}>Appeared</th>
              <th style={{...thS, width:90}}>Pass</th>
              <th style={{...thS, width:80}}>Pass %</th>
              <th style={{...thS, width:32}}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => {
              const passRate = (parseInt(row.appeared)>0 && parseInt(row.pass)>=0) ? ((parseInt(row.pass)/parseInt(row.appeared))*100).toFixed(1) : null;
              return (
                <tr key={row._id} style={{borderBottom:'1px solid var(--border)', background: idx%2===0?'var(--bg1)':'var(--bg2)'}}>
                  <td style={{...tdS, textAlign:'center', color:'var(--text3)', fontSize:11}}>{idx+1}</td>
                  <td style={tdS}>
                    <SearchableSelect value={row.occupation} onChange={v=>setOcc(row._id,'occupation',v)} placeholder="— Select occupation —"
                      options={OCCUPATIONS.map(o=>({value:o.name, label:o.name}))}/>
                  </td>
                  <td style={tdS}>
                    <select value={row.level} onChange={e=>setOcc(row._id,'level',e.target.value)} style={{fontSize:11, width:'100%'}}>
                      {NSTB_LEVELS.map(l=><option key={l}>{l}</option>)}
                    </select>
                  </td>
                  <td style={tdS}><input type="number" value={row.applied} onChange={e=>setOcc(row._id,'applied',e.target.value===''?'':parseInt(e.target.value))} style={{fontSize:11, width:'100%'}}/></td>
                  <td style={tdS}><input type="number" value={row.appeared} onChange={e=>setOcc(row._id,'appeared',e.target.value===''?'':parseInt(e.target.value))} style={{fontSize:11, width:'100%'}}/></td>
                  <td style={tdS}><input type="number" value={row.pass} onChange={e=>setOcc(row._id,'pass',e.target.value===''?'':parseInt(e.target.value))} style={{fontSize:11, width:'100%'}}/></td>
                  <td style={{...tdS, textAlign:'center', fontWeight:600, color: passRate>70?'var(--green,#16a34a)':passRate>50?'var(--accent)':'var(--red)'}}>
                    {passRate ? passRate+'%' : '—'}
                  </td>
                  <td style={{...tdS, textAlign:'center'}}>
                    {rows.length > 1 && <button onClick={()=>removeRow(row._id)} style={{background:'none',border:'none',color:'var(--text3)',cursor:'pointer',fontSize:14}}>🗑</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {err && <ErrorBanner msg={err} onDismiss={()=>setErr('')}/>}
      <div style={{position:'sticky', bottom:0, background:'var(--bg1)', borderTop:'1px solid var(--border)', padding:'12px 0', marginTop:20, display:'flex', justifyContent:'flex-end', gap:8}}>
        <button className="btn btn-ghost" onClick={addRow}>+ Add row</button>
        <button className="btn btn-secondary" onClick={onBack}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave}>Save {rows.length} record{rows.length>1?'s':''}</button>
      </div>
    </div>
  );
}

// Keep old name as alias for backward compat with editNSTB modal
function NSTBForm({record, onSave, onClose}) {
  return <NSTBEditModal record={record} onSave={onSave} onClose={onClose}/>;
}

export { NSTBEditModal, NSTBBulkPage };
export default NSTBForm;

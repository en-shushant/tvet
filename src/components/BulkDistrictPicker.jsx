import { useState, useMemo } from 'react';
import { PROVINCES, getAllDistricts, FISCAL_YEARS, TRAINING_TYPES, OCCUPATIONS } from '../constants/data.js';
import SearchableSelect from './ui/SearchableSelect.jsx';
import { ErrorBanner } from './ui/Modal.jsx';

function DistrictMultiPicker({onAdd, buttonLabel='+ Add districts'}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState([]); // [{province, district}]
  const [browseProvince, setBrowseProvince] = useState('');

  const isSelected = (province, district) => selected.some(s => s.province===province && s.district===district);
  const toggle = (province, district) => setSelected(s =>
    isSelected(province, district)
      ? s.filter(x => !(x.province===province && x.district===district))
      : [...s, {province, district}]
  );

  const filteredDistricts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q) return getAllDistricts().filter(d => d.district.toLowerCase().includes(q) || d.province.toLowerCase().includes(q));
    if (browseProvince) return getAllDistricts().filter(d => d.province === browseProvince);
    return getAllDistricts();
  }, [search, browseProvince]);

  const handleAdd = () => {
    if (!selected.length) return;
    onAdd(selected.map(d => ({province: d.province, district: d.district, localLevel:'', localLevelType:''})));
    setSelected([]); setSearch(''); setOpen(false);
  };

  if (!open) return (
    <button onClick={()=>setOpen(true)} style={{fontSize:11,color:'var(--blue)',background:'none',border:'none',cursor:'pointer',padding:0}}>{buttonLabel}</button>
  );

  return (
    <div style={{background:'var(--bg1)', border:'1px solid var(--accent)', borderRadius:8, padding:'10px 12px', marginTop:4, width:'100%'}}>
      <div style={{display:'flex', gap:6, alignItems:'center', marginBottom:8}}>
        <input value={search} onChange={e=>{setSearch(e.target.value);setBrowseProvince('');}}
          placeholder="Search districts across all provinces…" style={{flex:1, fontSize:12}}/>
        <select value={browseProvince} onChange={e=>{setBrowseProvince(e.target.value);setSearch('');}} style={{fontSize:12, padding:'4px 6px'}}>
          <option value="">All provinces</option>
          {PROVINCES.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}
        </select>
        {selected.length > 0 && <button className="btn btn-primary btn-sm" onClick={handleAdd}>Add {selected.length}</button>}
        <button onClick={()=>{setOpen(false);setSelected([]);setSearch('');}} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text3)',fontSize:14,flexShrink:0}}>✕</button>
      </div>
      {selected.length > 0 && (
        <div style={{display:'flex', flexWrap:'wrap', gap:4, marginBottom:8}}>
          {selected.map(s => (
            <span key={s.province+s.district} onClick={()=>toggle(s.province,s.district)}
              style={{fontSize:11, padding:'2px 8px', borderRadius:10, background:'var(--accent)', color:'#fff', cursor:'pointer'}}>
              {s.district} ✕
            </span>
          ))}
        </div>
      )}
      <div style={{display:'flex', flexWrap:'wrap', gap:5, maxHeight:180, overflowY:'auto'}}>
        {filteredDistricts.map(d => (
          <button key={d.province+d.district} onClick={()=>toggle(d.province,d.district)}
            style={{fontSize:11, padding:'3px 8px', borderRadius:10, border:'1px solid var(--border)',
              background: isSelected(d.province,d.district) ? 'var(--accent)' : 'var(--bg2)',
              color: isSelected(d.province,d.district) ? '#fff' : 'var(--text1)', cursor:'pointer'}}>
            {d.district}{!browseProvince && !search && <span style={{fontSize:9, opacity:0.6, marginLeft:3}}>{d.province.split(' ')[0]}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
// Legacy alias
const BulkDistrictPicker = ({onAdd}) => <DistrictMultiPicker onAdd={onAdd} buttonLabel="+ Add multiple districts"/>;


function BulkAssignmentForm({instituteName, clients, onSave, onBack}) {
  const uid = () => Math.random().toString(36).slice(2);
  const emptyRow = () => ({
    id: uid(), fy:'2081/82', assignmentName:'', manualClient:false,
    clientId:'', clientName:'', trainingType:'Short Term',
    occupations:[{id:uid(), nameInLetter:'', ctevtOccupationId:'', trainees:''}],
    districts:[],
  });
  const [rows, setRows] = useState([emptyRow()]);
  const [err, setErr] = useState('');

  const setRow = (i, k, v) => setRows(rs => rs.map((r,idx) => idx===i ? {...r,[k]:v} : r));
  const addRow = () => setRows(rs => [...rs, emptyRow()]);
  const removeRow = (i) => setRows(rs => rs.filter((_,idx)=>idx!==i));
  const setOcc = (ri, oi, k, v) => setRows(rs => rs.map((r,idx) => idx!==ri ? r : {
    ...r, occupations: r.occupations.map((o,oidx)=>oidx===oi?{...o,[k]:v}:o)
  }));
  const addOcc = (ri) => setRows(rs => rs.map((r,idx)=>idx!==ri?r:{...r, occupations:[...r.occupations,{id:uid(),nameInLetter:'',ctevtOccupationId:'',trainees:''}]}));
  const removeOcc = (ri, oi) => setRows(rs => rs.map((r,idx)=>idx!==ri?r:{...r,occupations:r.occupations.filter((_,oidx)=>oidx!==oi)}));

  const toOccValue = (rawId) => rawId;
  const fromOccValue = (v) => (typeof v==='string'&&v.startsWith('c:')) ? parseInt(v.slice(2)) : v;

  const handleSave = () => {
    const valid = rows.filter(r => r.assignmentName.trim() && r.fy);
    if (!valid.length) { setErr('Fill at least assignment name and FY for each row.'); return; }
    onSave(valid);
  };

  const occOptions = OCCUPATIONS.map(o=>({value:o.id, label:o.name}));
  const thStyle = {fontSize:11, fontWeight:600, color:'var(--text3)', padding:'6px 8px', background:'var(--bg2)', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap'};
  const tdStyle = {padding:'6px 4px', verticalAlign:'top'};

  return (
    <div style={{padding:'0 0 40px 0'}}>
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:10}}>
        <div>
          <button onClick={onBack} style={{background:'none',border:'none',cursor:'pointer',color:'var(--accent)',fontSize:13,padding:0,marginBottom:4,display:'flex',alignItems:'center',gap:4}}>← Back to {instituteName}</button>
          <h2 style={{margin:0, fontSize:18, fontWeight:700}}>Bulk Add Assignments</h2>
          <div style={{fontSize:12, color:'var(--text3)', marginTop:4}}>Fill each row as one assignment. Rows with blank assignment name will be skipped.</div>
        </div>
        <div style={{display:'flex', gap:8}}>
          <button className="btn btn-ghost" onClick={addRow}>+ Add row</button>
          <button className="btn btn-secondary" onClick={onBack}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save {rows.length} assignment{rows.length>1?'s':''}</button>
        </div>
      </div>
      <div style={{overflowX:'auto'}}>
        <table style={{width:'100%', borderCollapse:'collapse', fontSize:12}}>
          <thead>
            <tr>
              <th style={thStyle}>FY</th>
              <th style={thStyle}>Assignment Name *</th>
              <th style={thStyle}>Client</th>
              <th style={thStyle}>Occupations (name · trainees)</th>
              <th style={thStyle}>Districts</th>
              <th style={{...thStyle, width:28}}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={row.id} style={{borderBottom:'1px solid var(--border)'}}>
                <td style={tdStyle}>
                  <select value={row.fy} onChange={e=>setRow(ri,'fy',e.target.value)} style={{fontSize:11, minWidth:100}}>
                    {FISCAL_YEARS.slice().reverse().map(fy=><option key={fy}>{fy}</option>)}
                  </select>
                </td>
                <td style={tdStyle}>
                  <input value={row.assignmentName} onChange={e=>setRow(ri,'assignmentName',e.target.value)} style={{fontSize:11, minWidth:180}} placeholder="Assignment name"/>
                  <div style={{marginTop:4}}>
                    <select value={row.trainingType} onChange={e=>setRow(ri,'trainingType',e.target.value)} style={{fontSize:11, width:'100%'}}>
                      {TRAINING_TYPES.map(t=><option key={t}>{t}</option>)}
                    </select>
                  </div>
                </td>
                <td style={tdStyle}>
                  {row.manualClient
                    ? <div style={{display:'flex', flexDirection:'column', gap:4}}>
                        <input value={row.clientName} onChange={e=>setRow(ri,'clientName',e.target.value)} placeholder="Client name" style={{fontSize:11, minWidth:120}}/>
                        <button onClick={()=>{setRow(ri,'manualClient',false);setRow(ri,'clientName','');}} style={{fontSize:10,color:'var(--blue)',background:'none',border:'none',cursor:'pointer',padding:0,textAlign:'left'}}>← Use list</button>
                      </div>
                    : <div style={{display:'flex', flexDirection:'column', gap:4}}>
                        <SearchableSelect value={row.clientId} onChange={v=>setRow(ri,'clientId',v)} placeholder="— Client —" options={clients.map(c=>({value:c.id,label:c.shortName||c.fullName}))}/>
                        <button onClick={()=>{setRow(ri,'manualClient',true);setRow(ri,'clientId','');}} style={{fontSize:10,color:'var(--blue)',background:'none',border:'none',cursor:'pointer',padding:0,textAlign:'left'}}>+ Manual</button>
                      </div>
                  }
                </td>
                <td style={tdStyle}>
                  {row.occupations.map((occ,oi)=>(
                    <div key={occ.id} style={{display:'flex', gap:4, marginBottom:4, alignItems:'center'}}>
                      <input value={occ.nameInLetter} onChange={e=>setOcc(ri,oi,'nameInLetter',e.target.value)} placeholder="Name in letter" style={{fontSize:11, width:140}}/>
                      <input type="number" value={occ.trainees} onChange={e=>setOcc(ri,oi,'trainees',e.target.value)} placeholder="Trainees" style={{fontSize:11, width:70}}/>
                      <SearchableSelect value={toOccValue(occ.ctevtOccupationId)} onChange={v=>setOcc(ri,oi,'ctevtOccupationId',fromOccValue(v))} placeholder="CTEVT occ." options={occOptions}/>
                      {row.occupations.length > 1 && <button onClick={()=>removeOcc(ri,oi)} style={{background:'none',border:'none',color:'var(--text3)',cursor:'pointer',fontSize:13,padding:'0 2px'}}>✕</button>}
                    </div>
                  ))}
                  <button onClick={()=>addOcc(ri)} style={{fontSize:10,color:'var(--blue)',background:'none',border:'none',cursor:'pointer',padding:0}}>+ occ</button>
                </td>
                <td style={tdStyle}>
                  <div style={{display:'flex', flexWrap:'wrap', gap:3, marginBottom:4}}>
                    {row.districts.map(d=>(
                      <span key={d.province+d.district} style={{fontSize:10, padding:'1px 6px', borderRadius:8, background:'var(--accent-light)', color:'var(--accent)', cursor:'pointer'}}
                        onClick={()=>setRow(ri,'districts',row.districts.filter(x=>!(x.province===d.province&&x.district===d.district)))}>
                        {d.district} ✕
                      </span>
                    ))}
                  </div>
                  <DistrictMultiPicker buttonLabel="+ Districts" onAdd={locs=>setRow(ri,'districts',[...row.districts,...locs.filter(l=>!row.districts.some(d=>d.district===l.district&&d.province===l.province))])}/>
                </td>
                <td style={{...tdStyle, textAlign:'center'}}>
                  {rows.length > 1 && <button onClick={()=>removeRow(ri)} style={{background:'none',border:'none',color:'var(--text3)',cursor:'pointer',fontSize:14}}>🗑</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {err && <ErrorBanner msg={err} onDismiss={()=>setErr('')}/>}
      <div style={{position:'sticky', bottom:0, background:'var(--bg1)', borderTop:'1px solid var(--border)', padding:'12px 0', marginTop:20, display:'flex', justifyContent:'flex-end', gap:8}}>
        <button className="btn btn-ghost" onClick={addRow}>+ Add row</button>
        <button className="btn btn-secondary" onClick={onBack}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave}>Save {rows.length} assignment{rows.length>1?'s':''}</button>
      </div>
    </div>
  );
}

export { DistrictMultiPicker, BulkDistrictPicker, BulkAssignmentForm };

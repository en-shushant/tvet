import { useState, useMemo } from 'react';
import { PROVINCES, getAllDistricts } from '../constants/data.js';

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


export { DistrictMultiPicker, BulkDistrictPicker };

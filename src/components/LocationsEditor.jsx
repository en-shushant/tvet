import { useState, useEffect } from 'react';
import { PROVINCES, setProvinces, LOCAL_LEVEL_TYPES } from '../constants/data.js';
import { api } from '../utils/api.js';
import Modal from './ui/Modal.jsx';
import { ErrorBanner } from './ui/Modal.jsx';

function LocationsEditor({token}) {
  const [provinces, setProvinces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [selProvince, setSelProvince] = useState(null);
  const [selDistrict, setSelDistrict] = useState(null);
  // modal state: {type:'province'|'district'|'ll', item?:obj}
  const [modal, setModal] = useState(null);

  const load = () => {
    setLoading(true);
    api('GET', '/locations', null, token)
      .then(data => {
        setProvinces(data);
        setLoading(false);
        // rehydrate PROVINCES so dropdowns update live
        PROVINCES.length = 0;
        data.forEach(p => PROVINCES.push({
          id: p.id, name: p.name,
          districts: (p.districts||[]).map(d => ({
            id: d.id, name: d.name,
            local_levels: (d.local_levels||[]).map(ll => ({name: ll.name, type: ll.type}))
          }))
        }));
      })
      .catch(e => { setErr(e.message); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const province = provinces.find(p => p.id === selProvince);
  const district = province?.districts?.find(d => d.id === selDistrict);

  const del = async (url, onSuccess) => {
    setErr('');
    try { await api('DELETE', url, null, token); onSuccess(); }
    catch(e) { setErr(e.message); }
  };

  const SaveModal = ({title, fields, onSave}) => {
    const [form, setForm] = useState(fields.reduce((a,f)=>({...a,[f.key]:f.default||''}),{}));
    const set = (k,v) => setForm(f=>({...f,[k]:v}));
    const [saving, setSaving] = useState(false);
    const [merr, setMerr] = useState('');
    const submit = async () => {
      setSaving(true); setMerr('');
      try { await onSave(form); setModal(null); load(); }
      catch(e) { setMerr(e.message); setSaving(false); }
    };
    return (
      <Modal title={title} onClose={()=>setModal(null)}
        footer={<><button className="btn btn-secondary" onClick={()=>setModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving?'Saving…':'Save'}</button></>}>
        {merr && <ErrorBanner msg={merr} onDismiss={()=>setMerr('')}/>}
        {fields.map(f => (
          <div key={f.key} className="form-group">
            <label>{f.label}{f.required&&' *'}</label>
            {f.type==='select'
              ? <select value={form[f.key]} onChange={e=>set(f.key,e.target.value)}>
                  {f.options.map(o=><option key={o} value={o}>{o}</option>)}
                </select>
              : <input value={form[f.key]} onChange={e=>set(f.key,e.target.value)} placeholder={f.placeholder||''}/>
            }
          </div>
        ))}
      </Modal>
    );
  };

  if (loading) return <div style={{padding:24,color:'var(--text3)'}}>Loading locations…</div>;

  return (
    <div>
      {err && <ErrorBanner msg={err} onDismiss={()=>setErr('')}/>}
      <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>

        {/* Provinces column */}
        <div className="card" style={{width:220,padding:0,overflow:'hidden',flexShrink:0}}>
          <div style={{padding:'10px 14px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <span style={{fontWeight:600,fontSize:13}}>Provinces ({provinces.length})</span>
            <button className="btn btn-primary btn-sm" onClick={()=>setModal({type:'addProvince'})}>+</button>
          </div>
          {provinces.map(p=>(
            <div key={p.id} onClick={()=>{setSelProvince(p.id);setSelDistrict(null);}}
              style={{padding:'8px 14px',cursor:'pointer',background:selProvince===p.id?'var(--primary-light)':'',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',gap:6}}>
              <span style={{fontSize:13,fontWeight:selProvince===p.id?600:400}}>{p.name}</span>
              <div style={{display:'flex',gap:4,flexShrink:0}}>
                <button className="btn btn-ghost btn-sm" style={{padding:'1px 5px'}} onClick={e=>{e.stopPropagation();setModal({type:'editProvince',item:p});}}>✏</button>
                <button className="btn btn-danger btn-sm" style={{padding:'1px 5px'}} onClick={e=>{e.stopPropagation();del(`/locations/provinces/${p.id}`,()=>{setSelProvince(null);load();});}}>🗑</button>
              </div>
            </div>
          ))}
        </div>

        {/* Districts column */}
        {province && (
          <div className="card" style={{width:230,padding:0,overflow:'hidden',flexShrink:0}}>
            <div style={{padding:'10px 14px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span style={{fontWeight:600,fontSize:13}}>Districts ({(province.districts||[]).length})</span>
              <button className="btn btn-primary btn-sm" onClick={()=>setModal({type:'addDistrict'})}>+</button>
            </div>
            {(province.districts||[]).map(d=>(
              <div key={d.id} onClick={()=>setSelDistrict(d.id)}
                style={{padding:'8px 14px',cursor:'pointer',background:selDistrict===d.id?'var(--primary-light)':'',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',gap:6}}>
                <span style={{fontSize:13,fontWeight:selDistrict===d.id?600:400}}>{d.name}</span>
                <div style={{display:'flex',gap:4,flexShrink:0}}>
                  <button className="btn btn-ghost btn-sm" style={{padding:'1px 5px'}} onClick={e=>{e.stopPropagation();setModal({type:'editDistrict',item:d});}}>✏</button>
                  <button className="btn btn-danger btn-sm" style={{padding:'1px 5px'}} onClick={e=>{e.stopPropagation();del(`/locations/districts/${d.id}`,()=>{setSelDistrict(null);load();});}}>🗑</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Local levels column */}
        {district && (
          <div className="card" style={{flex:1,padding:0,overflow:'hidden'}}>
            <div style={{padding:'10px 14px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span style={{fontWeight:600,fontSize:13}}>Local Levels — {district.name} ({(district.local_levels||[]).length})</span>
              <button className="btn btn-primary btn-sm" onClick={()=>setModal({type:'addLL'})}>+</button>
            </div>
            <table style={{width:'100%'}}>
              <thead><tr><th>#</th><th>Name</th><th>Type</th><th></th></tr></thead>
              <tbody>
                {(district.local_levels||[]).map((ll,i)=>(
                  <tr key={ll.id}>
                    <td className="mono text-muted" style={{fontSize:11}}>{i+1}</td>
                    <td style={{fontSize:13}}>{ll.name}</td>
                    <td><span style={{fontSize:11,background:'var(--primary-light)',borderRadius:4,padding:'1px 6px'}}>{ll.type}</span></td>
                    <td style={{display:'flex',gap:4}}>
                      <button className="btn btn-ghost btn-sm" onClick={()=>setModal({type:'editLL',item:ll})}>✏</button>
                      <button className="btn btn-danger btn-sm" onClick={()=>del(`/locations/local-levels/${ll.id}`,load)}>🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!province && <div style={{color:'var(--text3)',fontSize:13,paddingTop:8}}>← Select a province to view its districts</div>}
        {province && !district && <div style={{color:'var(--text3)',fontSize:13,paddingTop:8}}>← Select a district to view its local levels</div>}
      </div>

      {/* Modals */}
      {modal?.type==='addProvince' && <SaveModal title="Add Province"
        fields={[{key:'name',label:'Province name',required:true,placeholder:'e.g. Koshi Province'}]}
        onSave={f=>api('POST','/locations/provinces',f,token)}/>}
      {modal?.type==='editProvince' && <SaveModal title="Edit Province"
        fields={[{key:'name',label:'Province name',required:true,default:modal.item.name}]}
        onSave={f=>api('PUT',`/locations/provinces/${modal.item.id}`,f,token)}/>}
      {modal?.type==='addDistrict' && <SaveModal title={`Add District in ${province.name}`}
        fields={[{key:'name',label:'District name',required:true,placeholder:'e.g. Taplejung'}]}
        onSave={f=>api('POST','/locations/districts',{...f,province_id:province.id},token)}/>}
      {modal?.type==='editDistrict' && <SaveModal title="Edit District"
        fields={[{key:'name',label:'District name',required:true,default:modal.item.name}]}
        onSave={f=>api('PUT',`/locations/districts/${modal.item.id}`,f,token)}/>}
      {modal?.type==='addLL' && <SaveModal title={`Add Local Level in ${district.name}`}
        fields={[
          {key:'name',label:'Name',required:true,placeholder:'e.g. Phungling'},
          {key:'type',label:'Type',required:true,type:'select',default:'Municipality',options:LOCAL_LEVEL_TYPES},
        ]}
        onSave={f=>api('POST','/locations/local-levels',{...f,district_id:district.id},token)}/>}
      {modal?.type==='editLL' && <SaveModal title="Edit Local Level"
        fields={[
          {key:'name',label:'Name',required:true,default:modal.item.name},
          {key:'type',label:'Type',required:true,type:'select',default:modal.item.type,options:LOCAL_LEVEL_TYPES},
        ]}
        onSave={f=>api('PUT',`/locations/local-levels/${modal.item.id}`,f,token)}/>}
    </div>
  );
}
export default LocationsEditor;

import { useState, useMemo } from 'react';
import Modal from './ui/Modal.jsx';
import { ErrorBanner } from './ui/Modal.jsx';
import LocationsEditor from './LocationsEditor.jsx';
import { CLIENT_TYPES, TRAINING_TYPES, SECTORS, NSTB_LEVELS, INSTITUTE_TYPES, INSTITUTE_STATUSES, AFFILIATION_TYPES, LOCAL_LEVEL_TYPES, FISCAL_YEARS, OCCUPATIONS, getTrainingTypes, saveTrainingTypes, setTrainingTypesVar } from '../constants/data.js';
import { api, clientToAPI, normClient } from '../utils/api.js';
import { getSession } from '../utils/auth.js';

const uid = () => Math.random().toString(36).slice(2,9);

function MasterData({clients, onUpdateClients, token, isAdmin, isEditor, isSuperAdmin}) {
  const [tab, setTab] = useState('clients');
  const [clientModal, setClientModal] = useState(null);
  const [search, setSearch] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [occModal, setOccModal] = useState(null);
  const [trainingTypes, setTrainingTypes] = useState(getTrainingTypes());
  const [ttInput, setTtInput] = useState('');
  const [editTt, setEditTt] = useState(null); // {idx, val}

  const canManageOccs = !!(isAdmin || isEditor);

  useEffect(() => {
    window.__masterOpenOccForm = () => { setTab('occupations'); setOccModal({}); };
    return () => { delete window.__masterOpenOccForm; };
  }, []);

  const saveTT = (list) => { saveTrainingTypes(list); setTrainingTypesVar(list); setTrainingTypes(list); };
  const addTT = () => { const v = ttInput.trim(); if (!v) return; saveTT([...trainingTypes, v]); setTtInput(''); };
  const removeTT = (i) => saveTT(trainingTypes.filter((_,idx)=>idx!==i));
  const updateTT = (i, v) => { const l = [...trainingTypes]; l[i]=v; saveTT(l); setEditTt(null); };

  const ClientForm = ({client, onSave, onClose}) => {
    const [form, setForm] = useState(client || {fullName:'', shortName:'', type:'Government', address:'', remarks:''});
    const set = (k,v) => setForm(f=>({...f,[k]:v}));
    return (
      <Modal title={client ? 'Edit client' : 'Add new client'} onClose={onClose}
        footer={<>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={()=>onSave(form)}>Save client</button>
        </>}>
        <div className="form-group"><label>Full name *</label><input value={form.fullName} onChange={e=>set('fullName',e.target.value)} placeholder="Official full name"/></div>
        <div className="form-row form-row-2">
          <div className="form-group"><label>Short name / acronym *</label><input value={form.shortName} onChange={e=>set('shortName',e.target.value)} placeholder="e.g. PCTVET, FEB"/></div>
          <div className="form-group"><label>Client type</label>
            <select value={form.type} onChange={e=>set('type',e.target.value)}>
              {CLIENT_TYPES.map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group"><label>Address</label><input value={form.address} onChange={e=>set('address',e.target.value)}/></div>
        <div className="form-group"><label>Remarks</label><textarea value={form.remarks} onChange={e=>set('remarks',e.target.value)} rows={2}/></div>
      </Modal>
    );
  };

  const [masterErr, setMasterErr] = useState('');
  const saveClient = async (form) => {
    setMasterErr('');
    try {
      if(form.id) {
        await api('PUT', `/clients/${form.id}`, clientToAPI(form), token);
        onUpdateClients(clients.map(c=>c.id===form.id ? {...c,...form} : c));
      } else {
        const created = await api('POST', '/clients', clientToAPI(form), token);
        onUpdateClients([...clients, normClient(created)]);
      }
      setClientModal(null);
    } catch(err) {
      setMasterErr('Failed to save client: ' + err.message);
    }
  };

  const OccupationForm = ({occ, onSave, onClose}) => {
    const [form, setForm] = useState(occ || {name:'', sector: SECTORS[0]||'', duration:'', level:''});
    const set = (k,v) => setForm(f=>({...f,[k]:v}));
    return (
      <Modal title={occ ? 'Edit occupation' : 'Add occupation'} onClose={onClose}
        footer={<>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={()=>onSave(form)}>Save</button>
        </>}>
        <div className="form-group"><label>Occupation name *</label><input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Full occupation name"/></div>
        <div className="form-row form-row-2">
          <div className="form-group"><label>Sector *</label>
            <select value={form.sector} onChange={e=>set('sector',e.target.value)}>
              {SECTORS.map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group"><label>Level <span style={{fontWeight:400,color:'var(--text3)'}}>(optional)</span></label>
            <select value={form.level||''} onChange={e=>set('level',e.target.value)}>
              <option value="">— Not specified —</option>
              <option>Level 1</option>
              <option>Level 2</option>
              <option>Level 3</option>
              <option>Professional</option>
            </select>
          </div>
        </div>
        <div className="form-group"><label>Duration (hrs) <span style={{fontWeight:400,color:'var(--text3)'}}>(optional)</span></label><input type="number" value={form.duration||''} onChange={e=>set('duration',e.target.value)} placeholder="e.g. 390"/></div>
      </Modal>
    );
  };

  const saveOccupation = async (form) => {
    try {
      const body = { name: form.name, sector: form.sector, duration: form.duration || null, level: form.level || null };
      if (form.id) {
        const updated = await api('PUT', `/occupations/${form.id}`, body, token);
        const idx = OCCUPATIONS.findIndex(o => o.id === updated.id);
        if (idx >= 0) OCCUPATIONS[idx] = updated;
      } else {
        const created = await api('POST', '/occupations', body, token);
        OCCUPATIONS.push(created);
      }
      setOccModal(null);
    } catch(err) { setMasterErr('Failed to save: ' + err.message); }
  };

  const deleteOccupation = async (occ) => {
    if (!confirm(`Delete "${occ.name}"?`)) return;
    setMasterErr('');
    try {
      await api('DELETE', `/occupations/${occ.id}`, null, token);
      const idx = OCCUPATIONS.findIndex(o => o.id === occ.id);
      if (idx >= 0) OCCUPATIONS.splice(idx, 1);
      setOccModal(null);
    } catch(err) { setMasterErr('Failed to delete: ' + err.message); }
  };

  const allDisplayOccs = OCCUPATIONS.filter(o => {
    const matchSearch = !search || o.name.toLowerCase().includes(search.toLowerCase());
    const matchSector = !sectorFilter || o.sector === sectorFilter;
    return matchSearch && matchSector;
  });
  const filteredOccs = allDisplayOccs;

  const [clientSearch, setClientSearch] = useState('');
  const filteredClients = clients.filter(c =>
    !clientSearch ||
    c.fullName.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.shortName.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.type.toLowerCase().includes(clientSearch.toLowerCase())
  );

  const occPagination = usePagination(filteredOccs, 25);
  const clientPagination = usePagination(filteredClients, 20);

  return (
    <div className="fade-in">
      {masterErr && <ErrorBanner msg={masterErr} onDismiss={()=>setMasterErr('')}/>}
      <div className="tabs">
        <button className={`tab ${tab==='clients'?'active':''}`} onClick={()=>setTab('clients')}>Clients ({clients.length})</button>
        <button className={`tab ${tab==='occupations'?'active':''}`} onClick={()=>setTab('occupations')}>Occupations ({OCCUPATIONS.length})</button>
        <button className={`tab ${tab==='training_types'?'active':''}`} onClick={()=>setTab('training_types')}>Training Types ({trainingTypes.length})</button>
        {isSuperAdmin && <button className={`tab ${tab==='locations'?'active':''}`} onClick={()=>setTab('locations')}>Locations</button>}
      </div>

      {tab==='clients' && (
        <>
          <div style={{display:'flex', gap:12, marginBottom:16}}>
            <div className="search-wrap" style={{flex:1}}>
              <span className="search-icon">🔍</span>
              <input value={clientSearch} onChange={e=>setClientSearch(e.target.value)} placeholder="Search clients by name, acronym or type..."/>
            </div>
            <button className="btn btn-primary btn-sm" onClick={()=>setClientModal({type:'add'})}>+ Add client</button>
          </div>
          <div className="card" style={{padding:0, overflow:'hidden'}}>
            <table>
              <thead><tr><th>Short name</th><th>Full name</th><th>Type</th><th>Address</th><th></th></tr></thead>
              <tbody>
                {clientPagination.paged.map(c=>(
                  <tr key={c.id}>
                    <td><strong className="mono">{c.shortName}</strong></td>
                    <td style={{fontSize:12}}>{c.fullName}</td>
                    <td><span className="badge badge-info">{c.type}</span></td>
                    <td style={{fontSize:12, color:'var(--text3)'}}>{c.address}</td>
                    <td><button className="btn btn-ghost btn-sm" onClick={()=>setClientModal({type:'edit', data:c})}>✏</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination {...clientPagination} label="clients"/>
          {clientModal?.type === 'add' && <ClientForm onSave={saveClient} onClose={()=>setClientModal(null)}/>}
          {clientModal?.type === 'edit' && <ClientForm client={clientModal.data} onSave={saveClient} onClose={()=>setClientModal(null)}/>}
        </>
      )}

      {tab==='occupations' && (
        <>
          <div style={{display:'flex', gap:12, marginBottom:16}}>
            <div className="search-wrap" style={{flex:1}}>
              <span className="search-icon">🔍</span>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search occupations..."/>
            </div>
            <select value={sectorFilter} onChange={e=>setSectorFilter(e.target.value)} style={{width:220}}>
              <option value="">All sectors ({SECTORS.length})</option>
              {SECTORS.map(s=><option key={s}>{s}</option>)}
            </select>
            {canManageOccs && <button className="btn btn-primary btn-sm" onClick={()=>setOccModal({type:'add'})}>+ Add occupation</button>}
          </div>
          <div style={{fontSize:12, color:'var(--text3)', marginBottom:8}}>
            {filteredOccs.length} occupation{filteredOccs.length!==1?'s':''} {sectorFilter ? `in ${sectorFilter}` : 'across all sectors'}

          </div>
          <div className="card" style={{padding:0, overflow:'hidden'}}>
            <table>
              <thead><tr><th>#</th><th>Occupation name</th><th>Sector</th><th>Level</th><th>Duration</th><th></th></tr></thead>
              <tbody>
                {occPagination.paged.map((o, idx)=>(
                  <tr key={o.id}>
                    <td className="mono text-muted" style={{fontSize:11}}>{occPagination.start + idx + 1}</td>
                    <td style={{fontWeight:500, fontSize:13}}>{o.name}</td>
                    <td><span className="badge badge-gray" style={{fontSize:10}}>{o.sector}</span></td>
                    <td>{o.level ? <span className="badge badge-info" style={{fontSize:10}}>{o.level}</span> : <span className="text-muted">—</span>}</td>
                    <td className="mono">{o.duration ? o.duration+' hrs' : '—'}</td>
                    <td style={{display:'flex', gap:4}}>
                      {canManageOccs && <button className="btn btn-ghost btn-sm" onClick={()=>setOccModal({type:'edit', data:o})}>✏</button>}
                      {isAdmin && <button className="btn btn-danger btn-sm" onClick={()=>deleteOccupation(o)}>🗑</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination {...occPagination} label="occupations"/>
          {occModal?.type === 'add' && <OccupationForm onSave={saveOccupation} onClose={()=>setOccModal(null)}/>}
          {occModal?.type === 'edit' && <OccupationForm occ={occModal.data} onSave={saveOccupation} onClose={()=>setOccModal(null)}/>}
        </>
      )}

      {tab==='training_types' && (
        <div style={{maxWidth:520}}>
          <div style={{marginBottom:16, fontSize:13, color:'var(--text3)'}}>
            Training types appear in the assignment form. Changes are saved locally in your browser.
          </div>
          <div style={{display:'flex', gap:8, marginBottom:20}}>
            <input value={ttInput} onChange={e=>setTtInput(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&addTT()}
              placeholder="New training type name…" style={{flex:1}}/>
            <button className="btn btn-primary btn-sm" onClick={addTT}>+ Add</button>
          </div>
          <div className="card" style={{padding:0, overflow:'hidden'}}>
            <table>
              <thead><tr><th>#</th><th>Training type</th><th></th></tr></thead>
              <tbody>
                {trainingTypes.map((t, i) => (
                  <tr key={i}>
                    <td className="mono text-muted" style={{fontSize:11}}>{i+1}</td>
                    <td style={{fontSize:13}}>
                      {editTt?.idx === i
                        ? <input autoFocus value={editTt.val} onChange={e=>setEditTt({idx:i, val:e.target.value})}
                            onKeyDown={e=>{if(e.key==='Enter') updateTT(i,editTt.val); if(e.key==='Escape') setEditTt(null);}}
                            style={{width:'100%'}}/>
                        : t
                      }
                    </td>
                    <td style={{display:'flex', gap:4}}>
                      {editTt?.idx === i
                        ? <>
                            <button className="btn btn-primary btn-sm" onClick={()=>updateTT(i,editTt.val)}>Save</button>
                            <button className="btn btn-ghost btn-sm" onClick={()=>setEditTt(null)}>✕</button>
                          </>
                        : <>
                            <button className="btn btn-ghost btn-sm" onClick={()=>setEditTt({idx:i, val:t})}>✏</button>
                            <button className="btn btn-danger btn-sm" onClick={()=>removeTT(i)}>🗑</button>
                          </>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{marginTop:12}}>
            <button className="btn btn-ghost btn-sm" onClick={()=>saveTT([...TRAINING_TYPES_DEFAULT])}>
              ↺ Reset to defaults
            </button>
          </div>
        </div>
      )}

      {tab==='locations' && isSuperAdmin && <LocationsEditor token={token}/>}
    </div>
  );
}

export default MasterData;

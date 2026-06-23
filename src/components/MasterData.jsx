import { useState, useEffect, useMemo } from 'react';
import { usePagination } from '../utils/hooks.js';
import Pagination from './ui/Pagination.jsx';
import Modal from './ui/Modal.jsx';
import { ErrorBanner } from './ui/Modal.jsx';
import LocationsEditor from './LocationsEditor.jsx';
import { CLIENT_TYPES, TRAINING_TYPES, TRAINING_TYPES_DEFAULT, SECTORS, NSTB_LEVELS, INSTITUTE_TYPES, INSTITUTE_STATUSES, AFFILIATION_TYPES, LOCAL_LEVEL_TYPES, FISCAL_YEARS, OCCUPATIONS, getTrainingTypes, saveTrainingTypes, setTrainingTypesVar, getFiscalYears, saveFiscalYears, setFiscalYearsVar } from '../constants/data.js';
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
  const [editTt, setEditTt] = useState(null);
  const [fiscalYears, setFiscalYears] = useState(getFiscalYears());
  const [fyInput, setFyInput] = useState('');
  const [editFy, setEditFy] = useState(null);

  const canManageOccs = !!(isAdmin || isEditor);

  // Tools/Consumables tab state
  const [toolsOccId, setToolsOccId] = useState('');
  const [toolsOccSearch, setToolsOccSearch] = useState(null);
  const [toolsOccDropdown, setToolsOccDropdown] = useState(false);
  const [toolsLevel, setToolsLevel] = useState('');
  const [toolsList, setToolsList] = useState([]);
  const [toolsLoading, setToolsLoading] = useState(false);
  const [toolModal, setToolModal] = useState(null);
  const [toolsBulkMode, setToolsBulkMode] = useState(false);
  const [bulkRows, setBulkRows] = useState([]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [toolsSelected, setToolsSelected] = useState([]);
  const [toolCounts, setToolCounts] = useState([]);
  const [toolsSearch, setToolsSearch] = useState('');

  const loadToolCounts = async () => {
    try {
      const data = await api('GET', '/occupation-tools/counts', null, token);
      setToolCounts(data || []);
    } catch { setToolCounts([]); }
  };

  useEffect(() => { if (tab === 'tools') loadToolCounts(); }, [tab]);

  const getToolCount = (occId, level) => {
    const c = toolCounts.find(r => r.occupation_id === occId && r.level === level);
    return c ? c.count : 0;
  };
  const getOccTotalCount = (occId) => toolCounts.filter(r => r.occupation_id === occId).reduce((s, r) => s + r.count, 0);
  const getOccLevelsWithTools = (occId) => toolCounts.filter(r => r.occupation_id === occId).map(r => ({ level: r.level, count: r.count }));

  const selectOccTool = (occId, level) => {
    setToolsOccId(String(occId));
    setToolsLevel(level);
    loadTools(String(occId), level);
  };

  const emptyRow = () => ({_key: uid(), name:'', description:'', unit:'', quantity:'', ownership:'Own', type:'Tool', remarks:''});
  const addBulkRows = (n) => setBulkRows(prev => [...prev, ...Array.from({length:n}, emptyRow)]);
  const enterBulkMode = () => { setBulkRows(Array.from({length:5}, emptyRow)); setToolsBulkMode(true); };

  const loadTools = async (occId, level) => {
    if (!occId || !level) { setToolsList([]); return; }
    setToolsLoading(true);
    try {
      const data = await api('GET', `/occupation-tools/${occId}/${encodeURIComponent(level)}`, null, token);
      setToolsList(data);
    } catch { setToolsList([]); }
    setToolsLoading(false);
  };

  const saveTool = async (form) => {
    try {
      if (form.id) {
        const updated = await api('PUT', `/occupation-tools/${form.id}`, form, token);
        setToolsList(prev => prev.map(t => t.id === updated.id ? updated : t));
      } else {
        const created = await api('POST', '/occupation-tools', { ...form, occupation_id: parseInt(toolsOccId), level: toolsLevel }, token);
        setToolsList(prev => [...prev, created]);
      }
      setToolModal(null);
    } catch (err) { setMasterErr('Failed to save tool: ' + err.message); }
  };

  const saveBulkRows = async () => {
    const valid = bulkRows.filter(r => r.description.trim());
    if (!valid.length) { setMasterErr('Add at least one row with a description.'); return; }
    setBulkSaving(true);
    let created = 0;
    for (const row of valid) {
      try {
        const item = await api('POST', '/occupation-tools', { ...row, occupation_id: parseInt(toolsOccId), level: toolsLevel }, token);
        setToolsList(prev => [...prev, item]);
        created++;
      } catch (err) { setMasterErr(`Failed to save row "${row.description}": ${err.message}`); }
    }
    setBulkSaving(false);
    if (created > 0) { setToolsBulkMode(false); setBulkRows([]); loadToolCounts(); }
  };

  const deleteTool = async (id) => {
    if (!confirm('Delete this item?')) return;
    try {
      await api('DELETE', `/occupation-tools/${id}`, null, token);
      setToolsList(prev => prev.filter(t => t.id !== id));
      setToolsSelected(prev => prev.filter(x => x !== id));
      loadToolCounts();
    } catch (err) { setMasterErr('Failed to delete: ' + err.message); }
  };

  const deleteSelectedTools = async () => {
    if (!toolsSelected.length) return;
    if (!confirm(`Delete ${toolsSelected.length} selected item${toolsSelected.length!==1?'s':''}?`)) return;
    for (const id of toolsSelected) {
      try {
        await api('DELETE', `/occupation-tools/${id}`, null, token);
        setToolsList(prev => prev.filter(t => t.id !== id));
      } catch (err) { setMasterErr('Failed to delete: ' + err.message); }
    }
    setToolsSelected([]);
    loadToolCounts();
  };

  const toggleToolSelect = (id) => setToolsSelected(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);
  const toggleAllTools = () => setToolsSelected(prev => prev.length === toolsList.length ? [] : toolsList.map(t=>t.id));

  useEffect(() => {
    window.__masterOpenOccForm = () => { setTab('occupations'); setOccModal({}); };
    return () => { delete window.__masterOpenOccForm; };
  }, []);

  const saveTT = (list) => { saveTrainingTypes(list); setTrainingTypesVar(list); setTrainingTypes(list); };
  const addTT = () => { const v = ttInput.trim(); if (!v) return; saveTT([...trainingTypes, v]); setTtInput(''); };
  const removeTT = (i) => saveTT(trainingTypes.filter((_,idx)=>idx!==i));
  const updateTT = (i, v) => { const l = [...trainingTypes]; l[i]=v; saveTT(l); setEditTt(null); };

  const saveFY = (list) => { saveFiscalYears(list); setFiscalYearsVar(list); setFiscalYears(list); };
  const addFY = () => {
    const v = fyInput.trim();
    if (!v) return;
    if (!/^\d{4}\/\d{2}$/.test(v)) { alert('Format must be YYYY/YY e.g. 2083/84'); return; }
    if (fiscalYears.includes(v)) return;
    const sorted = [...fiscalYears, v].sort();
    saveFY(sorted); setFyInput('');
  };
  const removeFY = (i) => saveFY(fiscalYears.filter((_,idx)=>idx!==i));
  const updateFY = (i, v) => { if (!/^\d{4}\/\d{2}$/.test(v)) return; const l=[...fiscalYears]; l[i]=v; saveFY(l.sort()); setEditFy(null); };

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

  const ToolForm = ({tool, onSave, onClose}) => {
    const [form, setForm] = useState(tool || {name:'', description:'', unit:'', quantity:'', ownership:'Own', type:'Tool', remarks:''});
    const set = (k,v) => setForm(f=>({...f,[k]:v}));
    return (
      <Modal title={tool ? 'Edit item' : 'Add tool / consumable'} onClose={onClose}
        footer={<>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={()=>onSave(form)}>Save</button>
        </>}>
        <div className="form-row form-row-2">
          <div className="form-group"><label>Name</label><input value={form.name||''} onChange={e=>set('name',e.target.value)} placeholder="e.g. Wire Stripper"/></div>
          <div className="form-group"><label>Description *</label><input value={form.description} onChange={e=>set('description',e.target.value)} placeholder="e.g. 6 inch insulated handle"/></div>
        </div>
        <div className="form-row form-row-2">
          <div className="form-group"><label>Unit</label><input value={form.unit||''} onChange={e=>set('unit',e.target.value)} placeholder="e.g. Piece, Meter, Set"/></div>
          <div className="form-group"><label>Quantity</label><input type="number" value={form.quantity||''} onChange={e=>set('quantity',e.target.value)} placeholder="e.g. 10"/></div>
        </div>
        <div className="form-row form-row-2">
          <div className="form-group"><label>Ownership</label>
            <select value={form.ownership||'Own'} onChange={e=>set('ownership',e.target.value)}>
              <option>Own</option>
              <option>Rented</option>
            </select>
          </div>
          <div className="form-group"><label>Type</label>
            <select value={form.type||'Tool'} onChange={e=>set('type',e.target.value)}>
              <option>Tool</option>
              <option>Consumable</option>
              <option>Safety Tool</option>
              <option>Stationery</option>
            </select>
          </div>
        </div>
        <div className="form-group"><label>Remarks</label><input value={form.remarks||''} onChange={e=>set('remarks',e.target.value)}/></div>
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
        <button className={`tab ${tab==='tools'?'active':''}`} onClick={()=>setTab('tools')}>Tools / Consumables</button>
        <button className={`tab ${tab==='training_types'?'active':''}`} onClick={()=>setTab('training_types')}>Training Types ({trainingTypes.length})</button>
        {isSuperAdmin && <button className={`tab ${tab==='fiscal_years'?'active':''}`} onClick={()=>setTab('fiscal_years')}>Fiscal Years ({fiscalYears.length})</button>}
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

      {tab==='tools' && (
        <>
          {/* ── Occupation list with tool counts ── */}
          <div style={{display:'flex', gap:12, marginBottom:12}}>
            <div className="search-wrap" style={{flex:1}}>
              <span className="search-icon">🔍</span>
              <input value={toolsSearch} onChange={e=>setToolsSearch(e.target.value)} placeholder="Search occupations..."/>
            </div>
          </div>
          <div className="card" style={{padding:0, overflow:'hidden', marginBottom:16}}>
            <table>
              <thead>
                <tr>
                  <th style={{width:40}}>#</th>
                  <th>Occupation</th>
                  <th>Sector</th>
                  <th style={{width:80}}>Level 1</th>
                  <th style={{width:80}}>Level 2</th>
                  <th style={{width:80}}>Level 3</th>
                  <th style={{width:90}}>Professional</th>
                  <th style={{width:60}}>Total</th>
                </tr>
              </thead>
              <tbody>
                {OCCUPATIONS.filter(o => !toolsSearch || o.name.toLowerCase().includes(toolsSearch.toLowerCase())).map((o, idx) => {
                  const total = getOccTotalCount(o.id);
                  const isActive = String(o.id) === String(toolsOccId);
                  return (
                    <tr key={o.id} style={{background: isActive ? 'var(--primary-light,#eff6ff)' : undefined}}>
                      <td className="mono text-muted" style={{fontSize:11}}>{idx+1}</td>
                      <td>
                        <span style={{fontWeight:500, fontSize:13, cursor:'pointer', color:'var(--primary)'}}
                          onClick={()=>{ setToolsOccId(String(o.id)); setToolsLevel('Level 1'); loadTools(String(o.id), 'Level 1'); }}>
                          {o.name}
                        </span>
                      </td>
                      <td><span className="badge badge-gray" style={{fontSize:10}}>{o.sector}</span></td>
                      {['Level 1','Level 2','Level 3','Professional'].map(lv => {
                        const cnt = getToolCount(o.id, lv);
                        return (
                          <td key={lv} style={{textAlign:'center'}}>
                            {cnt > 0 ? (
                              <span style={{cursor:'pointer', color:'var(--primary)', fontWeight:600, fontSize:12}}
                                onClick={()=>selectOccTool(o.id, lv)}>{cnt}</span>
                            ) : (
                              <span className="text-muted" style={{fontSize:11, cursor:'pointer'}}
                                onClick={()=>selectOccTool(o.id, lv)}>—</span>
                            )}
                          </td>
                        );
                      })}
                      <td style={{textAlign:'center', fontWeight: total > 0 ? 600 : 400, fontSize:12}}>
                        {total > 0 ? total : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── Selected occupation detail ── */}
          {toolsOccId && toolsLevel && (
            <div className="card" style={{padding:0, overflow:'hidden'}}>
              <div style={{padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8}}>
                <div>
                  <span style={{fontWeight:600, fontSize:14}}>
                    {OCCUPATIONS.find(o=>String(o.id)===String(toolsOccId))?.name || ''}
                  </span>
                  <span style={{margin:'0 8px', color:'var(--text3)'}}>—</span>
                  <select value={toolsLevel} onChange={e=>{ setToolsLevel(e.target.value); loadTools(toolsOccId, e.target.value); setToolsSelected([]); }} style={{fontSize:13, padding:'3px 8px', borderRadius:4, border:'1px solid var(--border)'}}>
                    <option>Level 1</option>
                    <option>Level 2</option>
                    <option>Level 3</option>
                    <option>Professional</option>
                  </select>
                </div>
                <div style={{display:'flex', gap:8, alignItems:'center'}}>
                  {canManageOccs && toolsSelected.length > 0 && (
                    <button className="btn btn-danger btn-sm" onClick={deleteSelectedTools}>Delete {toolsSelected.length} selected</button>
                  )}
                  {canManageOccs && !toolsBulkMode && (
                    <button className="btn btn-primary btn-sm" onClick={enterBulkMode}>+ Add items</button>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={()=>{ setToolsOccId(''); setToolsLevel(''); setToolsList([]); setToolsSelected([]); setToolsBulkMode(false); }}>✕ Close</button>
                </div>
              </div>

              {/* Bulk entry form */}
              {toolsBulkMode && (
                <div style={{padding:16, borderBottom:'1px solid var(--border)', background:'var(--surface-raised,#fafbfc)'}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10}}>
                    <div style={{fontWeight:600, fontSize:13}}>Add Items</div>
                    <div style={{display:'flex', gap:6, alignItems:'center'}}>
                      <span style={{fontSize:12, color:'var(--text3)'}}>Add rows:</span>
                      {[1,2,3,5,10,20].map(n=>(
                        <button key={n} className="btn btn-ghost btn-sm" style={{padding:'2px 8px', fontSize:11}} onClick={()=>addBulkRows(n)}>+{n}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{overflowX:'auto'}}>
                    <table style={{width:'100%', borderCollapse:'collapse'}}>
                      <thead>
                        <tr>
                          <th style={{width:30, padding:'6px 4px', fontSize:11}}></th>
                          <th style={{padding:'6px 8px', fontSize:11}}>#</th>
                          <th style={{padding:'6px 8px', fontSize:11, width:130}}>Name</th>
                          <th style={{padding:'6px 8px', fontSize:11}}>Description *</th>
                          <th style={{padding:'6px 8px', fontSize:11, width:80}}>Unit</th>
                          <th style={{padding:'6px 8px', fontSize:11, width:60}}>Qty</th>
                          <th style={{padding:'6px 8px', fontSize:11, width:100}}>Ownership</th>
                          <th style={{padding:'6px 8px', fontSize:11, width:110}}>Type</th>
                          <th style={{padding:'6px 8px', fontSize:11}}>Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkRows.map((row, i) => (
                          <tr key={row._key}>
                            <td style={{padding:'3px 4px', textAlign:'center'}}>
                              <button className="btn btn-ghost btn-sm" style={{padding:'1px 4px', fontSize:11, color:'var(--danger,#ef4444)'}}
                                onClick={()=>setBulkRows(prev=>prev.filter((_,idx)=>idx!==i))}>✕</button>
                            </td>
                            <td style={{padding:'3px 4px', fontSize:11, textAlign:'center', color:'var(--text3)'}}>{i+1}</td>
                            <td style={{padding:'3px 4px'}}><input value={row.name} onChange={e=>setBulkRows(prev=>{const n=[...prev];n[i]={...n[i],name:e.target.value};return n;})} placeholder="Name" style={{fontSize:12, padding:'4px 6px'}}/></td>
                            <td style={{padding:'3px 4px'}}><input value={row.description} onChange={e=>setBulkRows(prev=>{const n=[...prev];n[i]={...n[i],description:e.target.value};return n;})} placeholder="Description" style={{fontSize:12, padding:'4px 6px'}}/></td>
                            <td style={{padding:'3px 4px'}}><input value={row.unit} onChange={e=>setBulkRows(prev=>{const n=[...prev];n[i]={...n[i],unit:e.target.value};return n;})} placeholder="Unit" style={{fontSize:12, padding:'4px 6px'}}/></td>
                            <td style={{padding:'3px 4px'}}><input type="number" value={row.quantity} onChange={e=>setBulkRows(prev=>{const n=[...prev];n[i]={...n[i],quantity:e.target.value};return n;})} style={{fontSize:12, padding:'4px 6px'}}/></td>
                            <td style={{padding:'3px 4px'}}>
                              <select value={row.ownership} onChange={e=>setBulkRows(prev=>{const n=[...prev];n[i]={...n[i],ownership:e.target.value};return n;})} style={{fontSize:12, padding:'4px 6px'}}>
                                <option>Own</option><option>Rented</option>
                              </select>
                            </td>
                            <td style={{padding:'3px 4px'}}>
                              <select value={row.type} onChange={e=>setBulkRows(prev=>{const n=[...prev];n[i]={...n[i],type:e.target.value};return n;})} style={{fontSize:12, padding:'4px 6px'}}>
                                <option>Tool</option><option>Consumable</option><option>Safety Tool</option><option>Stationery</option>
                              </select>
                            </td>
                            <td style={{padding:'3px 4px'}}><input value={row.remarks} onChange={e=>setBulkRows(prev=>{const n=[...prev];n[i]={...n[i],remarks:e.target.value};return n;})} placeholder="Remarks" style={{fontSize:12, padding:'4px 6px'}}/></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:10}}>
                    <span style={{fontSize:12, color:'var(--text3)'}}>{bulkRows.length} row{bulkRows.length!==1?'s':''} · {bulkRows.filter(r=>r.description.trim()).length} with data</span>
                    <div style={{display:'flex', gap:8}}>
                      <button className="btn btn-secondary btn-sm" onClick={()=>{setToolsBulkMode(false);setBulkRows([]);}}>Cancel</button>
                      <button className="btn btn-primary btn-sm" onClick={saveBulkRows} disabled={bulkSaving || !bulkRows.some(r=>r.description.trim())}>
                        {bulkSaving ? 'Saving...' : `Save ${bulkRows.filter(r=>r.description.trim()).length} item${bulkRows.filter(r=>r.description.trim()).length!==1?'s':''}`}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Existing items table */}
              {toolsLoading ? (
                <div style={{padding:24, textAlign:'center', color:'var(--text3)'}}>Loading...</div>
              ) : (
                <div style={{overflowX:'auto'}}>
                  <table>
                    <thead>
                      <tr>
                        {canManageOccs && <th style={{width:30}}><input type="checkbox" checked={toolsList.length>0 && toolsSelected.length===toolsList.length} onChange={toggleAllTools}/></th>}
                        <th style={{width:40}}>S.N.</th>
                        <th>Name</th>
                        <th>Description</th>
                        <th>Unit</th>
                        <th>Qty</th>
                        <th>Ownership</th>
                        <th>Type</th>
                        <th>Remarks</th>
                        {canManageOccs && <th></th>}
                      </tr>
                    </thead>
                    <tbody>
                      {toolsList.length === 0 && (
                        <tr><td colSpan={canManageOccs ? 10 : 8} style={{textAlign:'center', color:'var(--text3)', padding:20}}>No items yet. Click "+ Add items" above.</td></tr>
                      )}
                      {toolsList.map((t, i) => (
                        <tr key={t.id} style={{background: toolsSelected.includes(t.id) ? 'var(--primary-light,#eff6ff)' : undefined}}>
                          {canManageOccs && <td style={{textAlign:'center'}}><input type="checkbox" checked={toolsSelected.includes(t.id)} onChange={()=>toggleToolSelect(t.id)}/></td>}
                          <td className="mono" style={{textAlign:'center'}}>{i+1}</td>
                          <td style={{fontSize:13, fontWeight:500}}>{t.name || '—'}</td>
                          <td style={{fontSize:13}}>{t.description}</td>
                          <td>{t.unit || '—'}</td>
                          <td className="mono" style={{textAlign:'right'}}>{t.quantity ?? '—'}</td>
                          <td>{t.ownership || '—'}</td>
                          <td><span className="badge" style={{fontSize:10,
                            background:{Tool:'#d1ecf1',Consumable:'#fef3cd','Safety Tool':'#d4edda',Stationery:'#e2d9f3'}[t.type]||'#eee',
                            color:{Tool:'#0c5460',Consumable:'#856404','Safety Tool':'#155724',Stationery:'#4a1d96'}[t.type]||'#333',
                          }}>{t.type}</span></td>
                          <td style={{fontSize:12, color:'var(--text3)'}}>{t.remarks || ''}</td>
                          {canManageOccs && (
                            <td style={{display:'flex', gap:4}}>
                              <button className="btn btn-ghost btn-sm" onClick={()=>setToolModal(t)}>✏</button>
                              <button className="btn btn-danger btn-sm" onClick={()=>deleteTool(t.id)}>🗑</button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {toolModal !== null && (
            <ToolForm tool={toolModal.id ? toolModal : null} onSave={saveTool} onClose={()=>setToolModal(null)} />
          )}
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

      {tab==='fiscal_years' && isSuperAdmin && (
        <div style={{maxWidth:520}}>
          <div style={{marginBottom:16, fontSize:13, color:'var(--text3)'}}>
            Fiscal years available in dropdowns. Format: <span className="mono">YYYY/YY</span> (e.g. 2083/84). Changes are saved locally.
          </div>
          <div style={{display:'flex', gap:8, marginBottom:20}}>
            <input value={fyInput} onChange={e=>setFyInput(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&addFY()}
              placeholder="e.g. 2084/85" style={{flex:1}} maxLength={7}/>
            <button className="btn btn-primary btn-sm" onClick={addFY}>+ Add</button>
          </div>
          <div className="card" style={{padding:0, overflow:'hidden'}}>
            <table>
              <thead><tr><th>#</th><th>Fiscal Year (BS)</th><th>AD</th><th></th></tr></thead>
              <tbody>
                {fiscalYears.map((fy, i) => {
                  const y = parseInt(fy);
                  const ad = isNaN(y) ? '' : `${y-57}/${String(y-56).slice(-2)}`;
                  return (
                    <tr key={i}>
                      <td className="mono text-muted" style={{fontSize:11}}>{i+1}</td>
                      <td style={{fontSize:13}}>
                        {editFy?.idx===i
                          ? <input autoFocus value={editFy.val} onChange={e=>setEditFy({idx:i,val:e.target.value})}
                              onKeyDown={e=>{if(e.key==='Enter')updateFY(i,editFy.val);if(e.key==='Escape')setEditFy(null);}}
                              style={{width:90}} maxLength={7}/>
                          : <span className="mono">{fy}</span>
                        }
                      </td>
                      <td className="mono text-muted" style={{fontSize:11}}>{ad}</td>
                      <td style={{display:'flex', gap:4}}>
                        {editFy?.idx===i
                          ? <>
                              <button className="btn btn-primary btn-sm" onClick={()=>updateFY(i,editFy.val)}>Save</button>
                              <button className="btn btn-ghost btn-sm" onClick={()=>setEditFy(null)}>✕</button>
                            </>
                          : <>
                              <button className="btn btn-ghost btn-sm" onClick={()=>setEditFy({idx:i,val:fy})}>✏</button>
                              <button className="btn btn-danger btn-sm" onClick={()=>removeFY(i)}>🗑</button>
                            </>
                        }
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{marginTop:12, display:'flex', gap:8}}>
            <button className="btn btn-ghost btn-sm" onClick={()=>{
              const fys=[];
              for(let y=2065;y<=2083;y++) fys.push(`${y}/${String(y+1).slice(-2)}`);
              saveFY(fys);
            }}>↺ Reset to defaults</button>
          </div>
        </div>
      )}

      {tab==='locations' && isSuperAdmin && <LocationsEditor token={token}/>}
    </div>
  );
}

export default MasterData;

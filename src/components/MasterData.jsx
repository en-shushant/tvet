import { useState, useEffect, useMemo } from 'react';
import { usePagination } from '../utils/hooks.js';
import Pagination from './ui/Pagination.jsx';
import Modal from './ui/Modal.jsx';
import { ErrorBanner } from './ui/Modal.jsx';
import { Btn, MdTextField, MdSelect, MdOption } from '../md.jsx';
import LocationsEditor from './LocationsEditor.jsx';
import { CLIENT_TYPES, TRAINING_TYPES, TRAINING_TYPES_DEFAULT, SECTORS, NSTB_LEVELS, INSTITUTE_TYPES, INSTITUTE_STATUSES, AFFILIATION_TYPES, LOCAL_LEVEL_TYPES, FISCAL_YEARS, OCCUPATIONS, getTrainingTypes, saveTrainingTypes, setTrainingTypesVar, getFiscalYears, saveFiscalYears, setFiscalYearsVar, getCurrentFY, saveCurrentFY, notifyMasterData } from '../constants/data.js';
import { api, clientToAPI, normClient } from '../utils/api.js';
import { getSession } from '../utils/auth.js';
import { uid } from '../utils/format.js';
import { confirmDialog, toast } from './ui/Feedback.jsx';
import { PageHeader, PillTabs } from './ui/primitives.jsx';
import { useOccupations } from '../utils/useMasterData.js';


function MasterData({clients, onUpdateClients, token, isAdmin, isEditor, isSuperAdmin, onGoToClients, initialTab}) {
  // Deep-linked from the command palette (#master/tools and friends), so
  // "go to tools" lands on the tab rather than on Clients.
  const [tab, setTab] = useState(initialTab || 'clients');
  const [clientModal, setClientModal] = useState(null);
  const [search, setSearch] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [occModal, setOccModal] = useState(null);
  /**
   * Occupations picked for merging, and how much each is used.
   *
   * The list carries near-duplicates — "Commis III" beside "General Cook
   * (Commis III)", two spellings of "House Keeping Cleaner" — and choosing
   * which one survives is only safe when you can see which one the assignments
   * are actually attached to.
   */
  const [selectedOccIds, setSelectedOccIds] = useState(() => new Set());
  const [occUsage, setOccUsage] = useState({});
  const [merging, setMerging] = useState(false);
  const [trainingTypes, setTrainingTypes] = useState(getTrainingTypes());
  const [ttInput, setTtInput] = useState('');
  const [editTt, setEditTt] = useState(null);
  const [fiscalYears, setFiscalYears] = useState(getFiscalYears());
  const [currentFY, setCurrentFY] = useState(getCurrentFY);
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

  // Usage counts drive the merge dialog's "which one should survive" hint.
  useEffect(() => {
    if (tab !== 'occupations') return;
    api('GET', '/occupations/usage', null, token)
      .then(rows => setOccUsage(Object.fromEntries(rows.map(r => [r.id, r]))))
      .catch(() => setOccUsage({}));
  }, [tab, token]);

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

  const [bulkType, setBulkType] = useState('Tool');
  const emptyRow = (type='Tool') => ({_key: uid(), name:'', description:'', unit:'', quantity:'', ownership:'Own', type, remarks:''});
  const addBulkRows = (n) => setBulkRows(prev => [...prev, ...Array.from({length:n}, () => emptyRow(bulkType))]);
  const enterBulkMode = (type) => { setBulkType(type); setBulkRows(Array.from({length:5}, () => emptyRow(type))); setToolsBulkMode(true); };

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
    const valid = bulkRows.filter(r => r.name.trim());
    if (!valid.length) { setMasterErr('Add at least one row with a name.'); return; }
    setBulkSaving(true);
    let created = 0;
    for (const row of valid) {
      try {
        const item = await api('POST', '/occupation-tools', { ...row, occupation_id: parseInt(toolsOccId), level: toolsLevel }, token);
        setToolsList(prev => [...prev, item]);
        created++;
      } catch (err) { setMasterErr(`Failed to save row "${row.name}": ${err.message}`); }
    }
    setBulkSaving(false);
    if (created > 0) { setToolsBulkMode(false); setBulkRows([]); loadToolCounts(); }
  };

  const deleteTool = async (id) => {
    if (!await confirmDialog({ title:'Delete item', message:'This item will be permanently deleted.', confirmLabel:'Delete', danger:true })) return;
    try {
      await api('DELETE', `/occupation-tools/${id}`, null, token);
      setToolsList(prev => prev.filter(t => t.id !== id));
      setToolsSelected(prev => prev.filter(x => x !== id));
      loadToolCounts();
    } catch (err) { setMasterErr('Failed to delete: ' + err.message); }
  };

  const deleteSelectedTools = async () => {
    if (!toolsSelected.length) return;
    if (!await confirmDialog({ title:'Delete selected items', message:`${toolsSelected.length} item${toolsSelected.length!==1?'s':''} will be permanently deleted.`, confirmLabel:'Delete', danger:true })) return;
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
    if (!/^\d{4}\/\d{2}$/.test(v)) { toast.error('Fiscal year must look like 2083/84.'); return; }
    if (fiscalYears.includes(v)) return;
    const sorted = [...fiscalYears, v].sort();
    saveFY(sorted); setFyInput('');
  };
  const removeFY = (i) => saveFY(fiscalYears.filter((_,idx)=>idx!==i));
  const updateFY = (i, v) => { if (!/^\d{4}\/\d{2}$/.test(v)) return; const l=[...fiscalYears]; l[i]=v; saveFY(l.sort()); setEditFy(null); };

  const ClientForm = ({client, onSave, onClose}) => {
    const [form, setForm] = useState(client || {fullName:'', shortName:'', type:'Government', address:'', remarks:'', phone:'', email:'', website:'', signatoryName:'', signatoryPosition:'', letterhead:null, nameNp:'', addressNp:'', includesOjt:false});
    const set = (k,v) => setForm(f=>({...f,[k]:v}));
    return (
      <Modal title={client ? 'Edit client' : 'Add new client'} onClose={onClose}
        footer={<>
          <Btn className="btn btn-secondary" onClick={onClose}>Cancel</Btn>
          <Btn className="btn btn-primary" onClick={()=>onSave(form)}>Save client</Btn>
        </>}>
        <div className="form-group">
          <MdTextField label="Full name *" value={form.fullName} onChange={e=>set('fullName',e.target.value)} placeholder="Official full name"/>
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <MdTextField label="Short name / acronym *" value={form.shortName} onChange={e=>set('shortName',e.target.value)} placeholder="e.g. PCTVET, FEB"/>
          </div>
          <div className="form-group">
            <MdSelect label="Client type" value={form.type} onChange={e=>set('type',e.target.value)}>
              {CLIENT_TYPES.map(t=><MdOption key={t} value={t}>{t}</MdOption>)}
            </MdSelect>
          </div>
        </div>
        <div className="form-group">
          <MdTextField label="Address" value={form.address||''} onChange={e=>set('address',e.target.value)}/>
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <MdTextField label="Phone" value={form.phone||''} onChange={e=>set('phone',e.target.value)} placeholder="Office phone number"/>
          </div>
          <div className="form-group">
            <MdTextField type="email" label="Email" value={form.email||''} onChange={e=>set('email',e.target.value)} placeholder="Office email"/>
          </div>
        </div>
        <div className="form-group">
          <MdTextField label="Website (optional)" value={form.website||''} onChange={e=>set('website',e.target.value)} placeholder="https://"/>
        </div>

        {/* Letter generation fields */}
        <div style={{margin:'16px 0 10px', borderTop:'1px solid var(--border)', paddingTop:14}}>
          <div style={{fontSize:12.5, fontWeight:600, color:'var(--text2)', marginBottom:10, letterSpacing:'0.2px'}}>
            Letter Generation
          </div>
          <div style={{fontSize:11.5, color:'var(--text3)', marginBottom:12}}>
            Used in the recipient and signature blocks when generating shortlisting letters for this organization.
          </div>
          <div className="form-row form-row-2">
            <div className="form-group">
              <MdTextField label="Name in Nepali (नाम)" value={form.nameNp||''} onChange={e=>set('nameNp',e.target.value)} placeholder="e.g. नागार्जुन नगरपालिका"/>
            </div>
            <div className="form-group">
              <MdTextField label="Address in Nepali (ठेगाना)" value={form.addressNp||''} onChange={e=>set('addressNp',e.target.value)} placeholder="e.g. काठमाडौँ"/>
            </div>
          </div>
          <div style={{fontSize:11.5, color:'var(--text3)', marginTop:-4, marginBottom:12}}>
            Shown in the letter's श्री … block. Falls back to the English name and address when blank.
          </div>
          <div className="form-row form-row-2">
            <div className="form-group">
              <MdTextField label="Authorized Signatory Name" value={form.signatoryName||''} onChange={e=>set('signatoryName',e.target.value)} placeholder="e.g. Ram Prasad Sharma"/>
            </div>
            <div className="form-group">
              <MdTextField label="Signatory Position / Designation" value={form.signatoryPosition||''} onChange={e=>set('signatoryPosition',e.target.value)} placeholder="e.g. Project Director"/>
            </div>
          </div>
          <label style={{display:'flex', alignItems:'flex-start', gap:10, padding:'10px 12px',
            border:'1px solid var(--border)', borderRadius:8, marginBottom:14, cursor:'pointer'}}>
            <input type="checkbox" style={{marginTop:2}} checked={!!form.includesOjt}
              onChange={e=>set('includesOjt', e.target.checked)}/>
            <span>
              <span style={{fontWeight:600, fontSize:13}}>Assignments include on-the-job training</span>
              <span style={{display:'block', fontSize:12, color:'var(--text3)', marginTop:2}}>
                Tick for projects that run an OJT phase — EVENT, RERP/SAMRIDDHI and ENSSURE.
                The 3(B) services templates then include the OJT step for this client's assignments.
              </span>
            </span>
          </label>
          <div className="form-group">
            <label>Letterhead Image <span style={{fontWeight:400,color:'var(--text3)'}}>(optional — shown at top of generated letters)</span></label>
            <div style={{display:'flex', alignItems:'center', gap:12}}>
              {form.letterhead && <img src={form.letterhead} alt="letterhead" style={{height:48, maxWidth:220, objectFit:'contain', border:'1px solid var(--border)', borderRadius:6, background:'#fff', padding:4}}/>}
              <label style={{cursor:'pointer'}}>
                <input type="file" accept="image/*" style={{display:'none'}} onChange={e=>{
                  const file=e.target.files[0]; if(!file) return;
                  const reader=new FileReader();
                  reader.onload=ev=>set('letterhead',ev.target.result);
                  reader.readAsDataURL(file);
                }}/>
                <span className="btn btn-secondary btn-sm">{form.letterhead ? '🔄 Change' : '📷 Upload letterhead'}</span>
              </label>
              {form.letterhead && <span className="btn btn-ghost btn-sm" style={{cursor:'pointer'}} onClick={()=>set('letterhead',null)}>✕ Remove</span>}
            </div>
            <div className="input-hint">PNG or JPG — recommended width 600–800px, height 80–120px. Max ~500 KB.</div>
          </div>
        </div>

        <div className="form-group">
          <MdTextField type="textarea" label="Remarks" value={form.remarks||''} onChange={e=>set('remarks',e.target.value)} rows={2}/>
        </div>
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
          <Btn className="btn btn-secondary" onClick={onClose}>Cancel</Btn>
          <Btn className="btn btn-primary" onClick={()=>onSave(form)}>Save</Btn>
        </>}>
        <div className="form-group">
          <MdTextField label="Occupation name *" value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Full occupation name"/>
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <MdSelect label="Sector *" value={form.sector} onChange={e=>set('sector',e.target.value)}>
              {SECTORS.map(s=><MdOption key={s} value={s}>{s}</MdOption>)}
            </MdSelect>
          </div>
          <div className="form-group">
            <MdSelect label="Level (optional)" value={form.level||''} onChange={e=>set('level',e.target.value)}>
              <MdOption value="">— Not specified —</MdOption>
              <MdOption value="N/A">N/A</MdOption>
              <MdOption value="Level 1">Level 1</MdOption>
              <MdOption value="Level 2">Level 2</MdOption>
              <MdOption value="Level 3">Level 3</MdOption>
              <MdOption value="Professional">Professional</MdOption>
            </MdSelect>
          </div>
        </div>
        <div className="form-group">
          <MdTextField type="number" label="Duration (hrs) (optional)" value={form.duration||''} onChange={e=>set('duration',e.target.value)} placeholder="e.g. 390"/>
        </div>
      </Modal>
    );
  };

  const ToolForm = ({tool, onSave, onClose}) => {
    const [form, setForm] = useState(tool || {name:'', description:'', unit:'', quantity:'', ownership:'Own', type:'Tool', remarks:''});
    const set = (k,v) => setForm(f=>({...f,[k]:v}));
    return (
      <Modal title={tool ? 'Edit item' : 'Add tool / consumable'} onClose={onClose}
        footer={<>
          <Btn className="btn btn-secondary" onClick={onClose}>Cancel</Btn>
          <Btn className="btn btn-primary" onClick={()=>onSave(form)}>Save</Btn>
        </>}>
        <div className="form-row form-row-2">
          <div className="form-group">
            <MdTextField label="Name *" value={form.name||''} onChange={e=>set('name',e.target.value)} placeholder="e.g. Wire Stripper"/>
          </div>
          <div className="form-group">
            <MdTextField label="Description" value={form.description||''} onChange={e=>set('description',e.target.value)} placeholder="e.g. 6 inch insulated handle"/>
          </div>
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <MdTextField label="Unit" value={form.unit||''} onChange={e=>set('unit',e.target.value)} placeholder="e.g. Piece, Meter, Set"/>
          </div>
          <div className="form-group">
            <MdTextField type="number" label="Quantity" value={form.quantity||''} onChange={e=>set('quantity',e.target.value)} placeholder="e.g. 10"/>
          </div>
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <MdSelect label="Ownership" value={form.ownership||'Own'} onChange={e=>set('ownership',e.target.value)}>
              <MdOption value="Own">Own</MdOption>
              <MdOption value="Rented">Rented</MdOption>
            </MdSelect>
          </div>
          <div className="form-group">
            <MdSelect label="Type" value={form.type||'Tool'} onChange={e=>set('type',e.target.value)}>
              <MdOption value="Tool">Tool</MdOption>
              <MdOption value="Consumable">Consumable</MdOption>
              <MdOption value="Safety Tool">Safety Tool</MdOption>
              <MdOption value="Stationery">Stationery</MdOption>
            </MdSelect>
          </div>
        </div>
        <div className="form-group">
          <MdTextField label="Remarks" value={form.remarks||''} onChange={e=>set('remarks',e.target.value)}/>
        </div>
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
      notifyMasterData();
      setOccModal(null);
    } catch(err) { setMasterErr('Failed to save: ' + err.message); }
  };

  const toggleOccSelect = (id) => setSelectedOccIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const mergeOccupations = async (targetId) => {
    const sourceIds = [...selectedOccIds].filter(id => id !== targetId);
    const target = OCCUPATIONS.find(o => o.id === targetId);
    const names = sourceIds.map(id => OCCUPATIONS.find(o => o.id === id)?.name).filter(Boolean);
    const totals = sourceIds.reduce((n, id) => n + (occUsage[id]?.assignments || 0), 0);

    const ok = await confirmDialog({
      title: `Merge into “${target?.name}”?`,
      message:
        `${names.join(', ')} will be folded into ${target?.name}. ` +
        `${totals} assignment row${totals === 1 ? '' : 's'} will be repointed, and their tools moved across. ` +
        `The merged occupations are deactivated, not deleted.`,
      confirmLabel: 'Merge', danger: true,
    });
    if (!ok) return;

    setMasterErr(''); setMerging(true);
    try {
      const res = await api('POST', '/occupations/merge', { targetId, sourceIds }, token);
      // Drop the merged ones from the in-memory list and tell every subscriber.
      for (const m of res.merged) {
        const i = OCCUPATIONS.findIndex(o => o.id === m.id);
        if (i >= 0) OCCUPATIONS.splice(i, 1);
      }
      notifyMasterData();
      setSelectedOccIds(new Set());
      setOccModal(null);
      const rows = await api('GET', '/occupations/usage', null, token).catch(() => []);
      setOccUsage(Object.fromEntries(rows.map(r => [r.id, r])));
      toast(`Merged into ${res.target.name} — ${res.movedAssignments} assignment rows and ${res.movedTools} tools moved.`);
    } catch (err) {
      setMasterErr('Merge failed: ' + err.message);
    } finally { setMerging(false); }
  };

  const deleteOccupation = async (occ) => {
    if (!await confirmDialog({ title:'Delete occupation', message:`“${occ.name}” will be permanently deleted.`, confirmLabel:'Delete', danger:true })) return;
    setMasterErr('');
    try {
      await api('DELETE', `/occupations/${occ.id}`, null, token);
      const idx = OCCUPATIONS.findIndex(o => o.id === occ.id);
      if (idx >= 0) OCCUPATIONS.splice(idx, 1);
      notifyMasterData();
      setOccModal(null);
    } catch(err) { setMasterErr('Failed to delete: ' + err.message); }
  };

  // Was OCCUPATIONS read directly: the list refreshed only because saving also
  // closed the modal, so a mutation with no accompanying state change was
  // invisible.
  const occupations = useOccupations();
  const allDisplayOccs = occupations.filter(o => {
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

      <PageHeader title="Master data"
        sub="Reference records the rest of the registry is built from"/>

      {/* Was the app's last screen on the old .tab markup, while every other
          screen had moved to pill tabs. Same component now, so the counts and
          the active state look the same everywhere. Locations and fiscal years
          stay superadmin-only — the tab list is filtered, not just hidden. */}
      <PillTabs
        tabs={[
          { id:'clients',        label:'Clients',            badge:clients.length },
          { id:'occupations',    label:'Occupations',        badge:occupations.length },
          { id:'tools',          label:'Tools / consumables' },
          { id:'training_types', label:'Training types',     badge:trainingTypes.length },
          ...(isSuperAdmin ? [
            { id:'fiscal_years', label:'Fiscal years',       badge:fiscalYears.length },
            { id:'locations',    label:'Locations' },
          ] : []),
        ]}
        value={tab} onChange={setTab} ariaLabel="Master data sections"/>

      {tab==='clients' && (
        <>
          <div style={{display:'flex', gap:12, marginBottom:16}}>
            <div className="search-wrap" style={{flex:1}}>
              <span className="search-icon">🔍</span>
              <input value={clientSearch} onChange={e=>setClientSearch(e.target.value)} placeholder="Search clients by name, acronym or type..."/>
            </div>
            {onGoToClients && (
              // Editing lives here; engagement history lives on the Clients
              // screen. Linking beats rebuilding it in a second place.
              <Btn className="btn btn-secondary btn-sm" onClick={onGoToClients}>View engagement</Btn>
            )}
            <Btn className="btn btn-primary btn-sm" onClick={()=>setClientModal({type:'add'})}>+ Add client</Btn>
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
                    <td><Btn className="btn btn-ghost btn-sm" onClick={()=>setClientModal({type:'edit', data:c})}>✏</Btn></td>
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
            {canManageOccs && <Btn className="btn btn-primary btn-sm" onClick={()=>setOccModal({type:'add'})}>+ Add occupation</Btn>}
          </div>
          <div style={{fontSize:12, color:'var(--text3)', marginBottom:8}}>
            {filteredOccs.length} occupation{filteredOccs.length!==1?'s':''} {sectorFilter ? `in ${sectorFilter}` : 'across all sectors'}

          </div>
          {isAdmin && selectedOccIds.size > 0 && (
            <div className="bulk-bar">
              <span className="bulk-count">
                {selectedOccIds.size} selected
                {selectedOccIds.size < 2 && <span className="bulk-note"> · pick at least two to merge</span>}
              </span>
              <Btn className="btn btn-secondary btn-sm" disabled={selectedOccIds.size < 2 || merging}
                onClick={() => { if (selectedOccIds.size >= 2 && !merging) setOccModal({ type:'merge' }); }}>
                {merging ? 'Merging…' : 'Merge…'}
              </Btn>
              <Btn className="btn btn-ghost btn-sm" onClick={() => setSelectedOccIds(new Set())}>Clear</Btn>
            </div>
          )}
          <div className="card" style={{padding:0, overflow:'hidden'}}>
            <table>
              <thead><tr>
                {isAdmin && <th style={{width:34}}></th>}
                <th>#</th><th>Occupation name</th><th>Sector</th><th>Level</th><th>Duration</th>
                <th style={{textAlign:'right'}}>Used by</th><th></th>
              </tr></thead>
              <tbody>
                {occPagination.paged.map((o, idx)=>(
                  <tr key={o.id}>
                    {isAdmin && (
                      <td>
                        <input type="checkbox" style={{width:'auto', margin:0}}
                          checked={selectedOccIds.has(o.id)}
                          onChange={() => toggleOccSelect(o.id)}
                          aria-label={`Select ${o.name} for merging`}/>
                      </td>
                    )}
                    <td className="mono text-muted" style={{fontSize:11}}>{occPagination.start + idx + 1}</td>
                    <td style={{fontWeight:500, fontSize:13}}>{o.name}</td>
                    <td><span className="badge badge-gray" style={{fontSize:10}}>{o.sector}</span></td>
                    <td>{o.level ? <span className="badge badge-info" style={{fontSize:10}}>{o.level}</span> : <span className="text-muted">—</span>}</td>
                    <td className="mono">{o.duration ? o.duration+' hrs' : '—'}</td>
                    <td className="mono" style={{textAlign:'right', fontSize:11.5, color:'var(--text3)'}}>
                      {occUsage[o.id]
                        ? `${occUsage[o.id].assignments} assignment${occUsage[o.id].assignments === 1 ? '' : 's'}`
                        : '—'}
                    </td>
                    <td style={{display:'flex', gap:4}}>
                      {canManageOccs && <Btn className="btn btn-ghost btn-sm" onClick={()=>setOccModal({type:'edit', data:o})}>✏</Btn>}
                      {isAdmin && <Btn className="btn btn-danger btn-sm" onClick={()=>deleteOccupation(o)}>🗑</Btn>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination {...occPagination} label="occupations"/>
          {occModal?.type === 'merge' && (
            <Modal title="Merge occupations" onClose={()=>setOccModal(null)}
              footer={<Btn className="btn btn-secondary" onClick={()=>setOccModal(null)}>Cancel</Btn>}>
              <p style={{fontSize:13, color:'var(--text2)', margin:'0 0 14px'}}>
                Choose the one to keep. The others are folded into it: their assignments
                are repointed and their tools moved across, then they are deactivated.
              </p>
              <div className="merge-options">
                {[...selectedOccIds].map(id => {
                  const o = OCCUPATIONS.find(x => x.id === id);
                  if (!o) return null;
                  const use = occUsage[id] || { assignments: 0, tools: 0 };
                  return (
                    <button key={id} type="button" className="merge-option"
                      disabled={merging} onClick={() => mergeOccupations(id)}>
                      <span className="merge-option-name">{o.name}</span>
                      <span className="merge-option-meta">
                        {o.sector}{o.level ? ` · ${o.level}` : ''} · {use.assignments} assignment
                        {use.assignments === 1 ? '' : 's'} · {use.tools} tool{use.tools === 1 ? '' : 's'}
                      </span>
                      <span className="merge-option-cta">Keep this one</span>
                    </button>
                  );
                })}
              </div>
            </Modal>
          )}
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
                {OCCUPATIONS.filter(o => {
                  if (toolsSearch) return o.name.toLowerCase().includes(toolsSearch.toLowerCase());
                  return getOccTotalCount(o.id) > 0;
                }).map((o, idx) => {
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
                    <option>N/A</option>
                    <option>Level 1</option>
                    <option>Level 2</option>
                    <option>Level 3</option>
                    <option>Professional</option>
                  </select>
                </div>
                <div style={{display:'flex', gap:8, alignItems:'center'}}>
                  {canManageOccs && toolsSelected.length > 0 && (
                    <Btn className="btn btn-danger btn-sm" onClick={deleteSelectedTools}>Delete {toolsSelected.length} selected</Btn>
                  )}
                  {canManageOccs && !toolsBulkMode && (
                    <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
                      {[['Tool','#0c5460','#d1ecf1'],['Consumable','#856404','#fef3cd'],['Safety Tool','#155724','#d4edda'],['Stationery','#4a1d96','#e2d9f3']].map(([t,color,bg])=>(
                        <button key={t} className="btn btn-sm" style={{background:bg, color, border:`1px solid ${color}40`, fontWeight:600}} onClick={()=>enterBulkMode(t)}>+ Add {t}s</button>
                      ))}
                    </div>
                  )}
                  <Btn className="btn btn-ghost btn-sm" onClick={()=>{ setToolsOccId(''); setToolsLevel(''); setToolsList([]); setToolsSelected([]); setToolsBulkMode(false); }}>✕ Close</Btn>
                </div>
              </div>

              {/* Bulk entry form */}
              {toolsBulkMode && (
                <div style={{padding:16, borderBottom:'1px solid var(--border)', background:'var(--surface-raised,#fafbfc)'}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10}}>
                    <div style={{fontWeight:600, fontSize:13}}>Add {bulkType}s</div>
                    <div style={{display:'flex', gap:6, alignItems:'center'}}>
                      <span style={{fontSize:12, color:'var(--text3)'}}>Add rows:</span>
                      {[1,2,3,5,10,20].map(n=>(
                        <Btn key={n} className="btn btn-ghost btn-sm" style={{padding:'2px 8px', fontSize:11}} onClick={()=>addBulkRows(n)}>+{n}</Btn>
                      ))}
                    </div>
                  </div>
                  <div style={{overflowX:'auto'}}>
                    <table style={{width:'100%', borderCollapse:'collapse'}}>
                      <thead>
                        <tr>
                          <th style={{width:30, padding:'6px 4px', fontSize:11}}></th>
                          <th style={{padding:'6px 8px', fontSize:11, width:32}}>#</th>
                          <th style={{padding:'6px 8px', fontSize:11, width:160}}>Name *</th>
                          <th style={{padding:'6px 8px', fontSize:11}}>Description</th>
                          <th style={{padding:'6px 8px', fontSize:11, width:60}}>QTY</th>
                          <th style={{padding:'6px 8px', fontSize:11, width:80}}>Unit</th>
                          <th style={{padding:'6px 8px', fontSize:11, width:100}}>Ownership</th>
                          <th style={{padding:'6px 8px', fontSize:11}}>Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkRows.map((row, i) => (
                          <tr key={row._key}>
                            <td style={{padding:'3px 4px', textAlign:'center'}}>
                              <Btn className="btn btn-ghost btn-sm" style={{padding:'1px 4px', fontSize:11, color:'var(--danger,#ef4444)'}}
                                onClick={()=>setBulkRows(prev=>prev.filter((_,idx)=>idx!==i))}>✕</Btn>
                            </td>
                            <td style={{padding:'3px 4px', fontSize:11, textAlign:'center', color:'var(--text3)'}}>{i+1}</td>
                            <td style={{padding:'3px 4px'}}><input tabIndex={1} value={row.name} onChange={e=>setBulkRows(prev=>{const n=[...prev];n[i]={...n[i],name:e.target.value};return n;})} placeholder="Name" style={{fontSize:12, padding:'4px 6px'}}/></td>
                            <td style={{padding:'3px 4px'}}><input tabIndex={1} value={row.description} onChange={e=>setBulkRows(prev=>{const n=[...prev];n[i]={...n[i],description:e.target.value};return n;})} placeholder="Description" style={{fontSize:12, padding:'4px 6px'}}/></td>
                            <td style={{padding:'3px 4px'}}><input tabIndex={1} type="number" value={row.quantity} onChange={e=>setBulkRows(prev=>{const n=[...prev];n[i]={...n[i],quantity:e.target.value};return n;})} style={{fontSize:12, padding:'4px 6px'}}/></td>
                            <td style={{padding:'3px 4px'}}><input tabIndex={1} value={row.unit} onChange={e=>setBulkRows(prev=>{const n=[...prev];n[i]={...n[i],unit:e.target.value};return n;})} placeholder="Unit" style={{fontSize:12, padding:'4px 6px'}}/></td>
                            <td style={{padding:'3px 4px'}}>
                              <select tabIndex={-1} value={row.ownership} onChange={e=>setBulkRows(prev=>{const n=[...prev];n[i]={...n[i],ownership:e.target.value};return n;})} style={{fontSize:12, padding:'4px 6px'}}>
                                <option>Own</option><option>Rented</option><option>Borrowed</option><option>Government</option>
                              </select>
                            </td>
                            <td style={{padding:'3px 4px'}}><input tabIndex={-1} value={row.remarks} onChange={e=>setBulkRows(prev=>{const n=[...prev];n[i]={...n[i],remarks:e.target.value};return n;})} placeholder="Remarks" style={{fontSize:12, padding:'4px 6px'}}/></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:10}}>
                    <span style={{fontSize:12, color:'var(--text3)'}}>{bulkRows.length} row{bulkRows.length!==1?'s':''} · {bulkRows.filter(r=>r.name.trim()).length} with data</span>
                    <div style={{display:'flex', gap:8}}>
                      <Btn className="btn btn-secondary btn-sm" onClick={()=>{setToolsBulkMode(false);setBulkRows([]);}}>Cancel</Btn>
                      <Btn className="btn btn-primary btn-sm" onClick={saveBulkRows} disabled={bulkSaving || !bulkRows.some(r=>r.name.trim())}>
                        {bulkSaving ? 'Saving...' : `Save ${bulkRows.filter(r=>r.name.trim()).length} item${bulkRows.filter(r=>r.name.trim()).length!==1?'s':''}`}
                      </Btn>
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
                              <Btn className="btn btn-ghost btn-sm" onClick={()=>setToolModal(t)}>✏</Btn>
                              <Btn className="btn btn-danger btn-sm" onClick={()=>deleteTool(t.id)}>🗑</Btn>
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
            <Btn className="btn btn-primary btn-sm" onClick={addTT}>+ Add</Btn>
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
                            <Btn className="btn btn-primary btn-sm" onClick={()=>updateTT(i,editTt.val)}>Save</Btn>
                            <Btn className="btn btn-ghost btn-sm" onClick={()=>setEditTt(null)}>✕</Btn>
                          </>
                        : <>
                            <Btn className="btn btn-ghost btn-sm" onClick={()=>setEditTt({idx:i, val:t})}>✏</Btn>
                            <Btn className="btn btn-danger btn-sm" onClick={()=>removeTT(i)}>🗑</Btn>
                          </>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{marginTop:12}}>
            <Btn className="btn btn-ghost btn-sm" onClick={()=>saveTT([...TRAINING_TYPES_DEFAULT])}>
              ↺ Reset to defaults
            </Btn>
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
            <Btn className="btn btn-primary btn-sm" onClick={addFY}>+ Add</Btn>
          </div>
          <div className="card" style={{padding:0, overflow:'hidden'}}>
            <table>
              <thead><tr><th>#</th><th>Fiscal Year (BS)</th><th>AD</th><th></th></tr></thead>
              <tbody>
                {fiscalYears.map((fy, i) => {
                  const y = parseInt(fy);
                  const ad = isNaN(y) ? '' : `${y-57}/${String(y-56).slice(-2)}`;
                  const isCurrent = fy === currentFY;
                  return (
                    <tr key={i} style={isCurrent ? {background:'var(--success-light)'} : {}}>
                      <td className="mono text-muted" style={{fontSize:11}}>{i+1}</td>
                      <td style={{fontSize:13}}>
                        <div style={{display:'flex', alignItems:'center', gap:8}}>
                          {editFy?.idx===i
                            ? <input autoFocus value={editFy.val} onChange={e=>setEditFy({idx:i,val:e.target.value})}
                                onKeyDown={e=>{if(e.key==='Enter')updateFY(i,editFy.val);if(e.key==='Escape')setEditFy(null);}}
                                style={{width:90}} maxLength={7}/>
                            : <span className="mono">{fy}</span>
                          }
                          {isCurrent && (
                            <span style={{fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:100, background:'var(--success)', color:'#fff'}}>
                              Current
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="mono text-muted" style={{fontSize:11}}>{ad}</td>
                      <td style={{display:'flex', gap:4, alignItems:'center'}}>
                        {editFy?.idx===i
                          ? <>
                              <Btn className="btn btn-primary btn-sm" onClick={()=>updateFY(i,editFy.val)}>Save</Btn>
                              <Btn className="btn btn-ghost btn-sm" onClick={()=>setEditFy(null)}>✕</Btn>
                            </>
                          : <>
                              {!isCurrent && (
                                <Btn className="btn btn-ghost btn-sm" title="Set as current FY"
                                  onClick={() => { saveCurrentFY(fy); setCurrentFY(fy); }}
                                  style={{fontSize:11}}>
                                  Set current
                                </Btn>
                              )}
                              <Btn className="btn btn-ghost btn-sm" onClick={()=>setEditFy({idx:i,val:fy})}>✏</Btn>
                              <Btn className="btn btn-danger btn-sm" onClick={()=>removeFY(i)}>🗑</Btn>
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
            <Btn className="btn btn-ghost btn-sm" onClick={()=>{
              const fys=[];
              for(let y=2065;y<=2083;y++) fys.push(`${y}/${String(y+1).slice(-2)}`);
              saveFY(fys);
            }}>↺ Reset to defaults</Btn>
          </div>
        </div>
      )}

      {tab==='locations' && isSuperAdmin && <LocationsEditor token={token}/>}
    </div>
  );
}

export default MasterData;

import { useState, useRef, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import Modal from './ui/Modal.jsx';
import { ErrorBanner } from './ui/Modal.jsx';
import SearchableSelect from './ui/SearchableSelect.jsx';
import { DropdownPanel } from './ui/SearchableSelect.jsx';
import { BulkDistrictPicker } from './BulkDistrictPicker.jsx';
import { PROVINCES, FISCAL_YEARS, TRAINING_TYPES, SECTORS, OCCUPATIONS, CLIENT_TYPES, getAllDistricts } from '../constants/data.js';
import { api } from '../utils/api.js';
import { getSession } from '../utils/auth.js';

const fmt = (n) => n ? Number(n).toLocaleString('en-IN') : '—';
const fyToAD = (fy) => {
  if (!fy) return '';
  const parts = fy.split('/');
  if (parts.length !== 2) return '';
  const y1 = parseInt(parts[0]);
  if (isNaN(y1)) return '';
  const ad1 = y1 - 57;
  const ad2 = ad1 + 1;
  return `${ad1}/${String(ad2).slice(-2)}`;
};
const uid = () => Math.random().toString(36).slice(2,9);

function getOccupation(id) {
  const rawId = typeof id === 'string' && id.startsWith('c:') ? parseInt(id.slice(2)) : id;
  return OCCUPATIONS.find(o => o.id === rawId) || {};
}

function DistrictSearch({ value, onChange }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const filtered = q.length > 0
    ? getAllDistricts().filter(d => d.district.toLowerCase().includes(q.toLowerCase()) || d.province.toLowerCase().includes(q.toLowerCase())).slice(0, 14)
    : getAllDistricts().slice(0, 14);
  return (
    <div ref={ref} style={{position:'relative'}}>
      <input value={open ? q : (value||'')} placeholder="Search district…"
        onFocus={() => { setOpen(true); setQ(''); }}
        onChange={e => { setQ(e.target.value); setOpen(true); }}
        style={{paddingRight: value && !open ? 28 : 12}}
      />
      {value && !open && (
        <button onClick={e=>{e.stopPropagation(); onChange('',''); setQ('');}} style={{position:'absolute',right:6,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'var(--text3)',fontSize:14,padding:0,lineHeight:1}}>✕</button>
      )}
      {open && ReactDOM.createPortal(
        <DropdownPanel anchor={ref} search={q} setSearch={setQ}
          filtered={filtered.map(d=>({value:d.district+'||'+d.province, label:d.district+' ('+d.province+')'}))}
          value={value ? value+'||'+(ALL_DISTRICTS.find(d=>d.district===value)?.province||'') : ''}
          onChange={v=>{ const [dist,prov]=v.split('||'); onChange(dist,prov); setOpen(false); setQ(''); }}
          setOpen={setOpen}
        />, document.body
      )}
    </div>
  );
}

function LocalLevelSearch({ province, district, value, onChange }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const allLL = useMemo(() => {
    const p = PROVINCES.find(p=>p.name===province);
    if (!p) return [];
    const d = (p.districts||[]).find(d=>d.name===district);
    return d ? (d.local_levels||[]) : [];
  }, [province, district]);
  const filtered = q.length > 0
    ? allLL.filter(l=>l.name.toLowerCase().includes(q.toLowerCase())).slice(0,14)
    : allLL.slice(0,14);
  return (
    <div ref={ref} style={{position:'relative'}}>
      <input value={q} placeholder={district ? '+ Add local level…' : '— District first —'}
        disabled={!district}
        onFocus={() => setOpen(true)}
        onChange={e => { setQ(e.target.value); setOpen(true); }}
      />
      {open && district && ReactDOM.createPortal(
        <DropdownPanel anchor={ref} search={q} setSearch={setQ}
          filtered={filtered.map(l=>({value:l.name, label:l.name+' ('+l.type+')'}))}
          value=''
          onChange={v=>{ const ll=allLL.find(l=>l.name===v); onChange(v, ll?.type||''); setOpen(false); setQ(''); }}
          setOpen={setOpen}
        />, document.body
      )}
    </div>
  );
}

function QuickAddOccupationModal({name, onSave, onClose}) {
  const token = getSession()?.token;
  const [form, setForm] = useState({name: name||'', sector: SECTORS[0]||'', level:''});
  const [err, setErr] = useState('');
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const handleSave = async () => {
    if (!form.name.trim() || !form.sector) return setErr('Name and sector are required.');
    setErr('');
    try {
      const saved = await api('POST', '/occupations', {name:form.name, sector:form.sector, level:form.level||null}, token);
      OCCUPATIONS.push(saved);
      OCCUPATIONS.sort((a,b)=>a.name.localeCompare(b.name));
      onSave(saved);
    } catch(e) { setErr(e.message); }
  };
  return (
    <Modal title={`Add new occupation`} onClose={onClose}
      footer={<><button className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={handleSave}>Save &amp; select</button></>}>
      <ErrorBanner msg={err} onDismiss={()=>setErr('')}/>
      <div className="form-row form-row-2">
        <div className="form-group"><label>Name *</label>
          <input value={form.name} onChange={e=>set('name',e.target.value)}/>
        </div>
        <div className="form-group"><label>Sector *</label>
          <select value={form.sector} onChange={e=>set('sector',e.target.value)}>
            {SECTORS.map(s=><option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="form-group"><label>Level (optional)</label>
        <select value={form.level} onChange={e=>set('level',e.target.value)}>
          <option value="">— Not specified —</option>
          <option>Level 1</option><option>Level 2</option><option>Level 3</option><option>Professional</option>
        </select>
      </div>
    </Modal>
  );
}

function ExperienceForm({exp, clients, onSave, onClose, onDuplicate, onSaveClient}) {
  const _sess = getSession();
  const canManageOccs = _sess?.role === 'admin' || _sess?.role === 'editor' || _sess?.role === 'superadmin';
  const [quickAddOcc, setQuickAddOcc] = useState(null); // {name, occIdx}
  const [saveClientModal, setSaveClientModal] = useState(null);
  const [saveClientErr, setSaveClientErr] = useState('');
  const [formErr, setFormErr] = useState('');
  const [form, setForm] = useState(exp || {
    clientId:'', clientName:'', manualClient:false,
    fy:'2081/82', assignmentName:'', trainingType:'Short Term',
    contractValue:'', startDate:'', endDate:'', startFY:'', endFY:'', remarks:'',
    isGesi:false, isResidential:false, isJV:false, jvRole:'Lead', jvPartners:'',
    occupations:[], locations:[], referenceFile:null, referenceFileName:''
  });

  const fileInputRef = useRef(null);

  const set = (k, v) => setForm(f => ({...f, [k]: v}));

  const addOcc = () => set('occupations', [...form.occupations, {id:uid(), nameInLetter:'', ctevtOccupationId:'', trainees:'', duration:'', level:'', skillTestProvisioned:false, skillTestAppeared:'', skillTestPass:'', employmentProvisioned:false, employmentActual:'', locations:[]}]);
  const setOcc = (i, k, v) => setForm(f => ({...f, occupations: f.occupations.map((o,idx)=>idx===i?{...o,[k]:v}:o)}));
  const removeOcc = (i) => setForm(f => ({...f, occupations: f.occupations.filter((_,idx)=>idx!==i)}));
  const addOccLoc = (oi) => setForm(f => ({...f, occupations: f.occupations.map((o,idx)=>idx===oi?{...o,locations:[...(o.locations||[]),{id:uid(),province:'',district:'',localLevels:[]}]}:o)}));
  const setOccLoc = (oi, li, k, v) => {
    setForm(f => {
      const locs = f.occupations[oi].locations.map((l,idx) => {
        if(idx!==li) return l;
        const updated = {...l, [k]:v};
        if(k==='province'){updated.district='';updated.localLevels=[];}
        if(k==='district'){updated.localLevels=[];}
        return updated;
      });
      return {...f, occupations: f.occupations.map((o,idx)=>idx===oi?{...o,locations:locs}:o)};
    });
  };
  const addOccLocLL = (oi, li, name, type) => setForm(f => {
    const locs = f.occupations[oi].locations.map((l,idx) => {
      if(idx!==li) return l;
      if((l.localLevels||[]).find(x=>x.name===name)) return l;
      return {...l, localLevels:[...(l.localLevels||[]),{name,type:type||''}]};
    });
    return {...f, occupations: f.occupations.map((o,idx)=>idx===oi?{...o,locations:locs}:o)};
  });
  const removeOccLocLL = (oi, li, llName) => setForm(f => {
    const locs = f.occupations[oi].locations.map((l,idx) =>
      idx!==li ? l : {...l, localLevels:(l.localLevels||[]).filter(x=>x.name!==llName)}
    );
    return {...f, occupations: f.occupations.map((o,idx)=>idx===oi?{...o,locations:locs}:o)};
  });
  const removeOccLoc = (oi, li) => setForm(f => ({...f, occupations: f.occupations.map((o,idx)=>idx===oi?{...o,locations:o.locations.filter((_,i)=>i!==li)}:o)}));

  const addLoc = () => set('locations', [...form.locations, {id:uid(), province:'', district:'', localLevel:'', localLevelType:''}]);
  const setLoc = (i, k, v) => {
    setForm(f => {
      const newLocs = f.locations.map((l,idx)=>{
        if(idx!==i) return l;
        const updated = {...l,[k]:v};
        if(k==='province') { updated.district=''; updated.localLevel=''; updated.localLevelType=''; }
        if(k==='district') { updated.localLevel=''; updated.localLevelType=''; }
        return updated;
      });
      return {...f, locations: newLocs};
    });
  };
  const removeLoc = (i) => setForm(f => ({...f, locations: f.locations.filter((_,idx)=>idx!==i)}));

  // Namespace custom occ IDs to avoid collision with built-in IDs (both start at 1)
  const toOccValue = (rawId) => {
    if (!rawId && rawId !== 0) return rawId;
    return rawId;
  };
  const fromOccValue = (v) => {
    if (typeof v === 'string' && v.startsWith('c:')) return parseInt(v.slice(2));
    return v;
  };

  const getDistricts = (provName) => {
    const prov = PROVINCES.find(p=>p.name===provName);
    return prov ? prov.districts : [];
  };

  const getLocalLevels = (provName, distName) => {
    const prov = PROVINCES.find(p=>p.name===provName);
    if(!prov) return [];
    const dist = prov.districts.find(d=>d.name===distName);
    return dist ? dist.local_levels : [];
  };

  const handleSaveTemplate = () => {
    if(!templateName.trim()) { alert('Enter a template name.'); return; }
    saveTemplate({
      name: templateName,
      clientId: form.clientId,
      assignmentName: form.assignmentName,
      trainingType: form.trainingType,
      occupations: form.occupations.map(o => ({...o, trainees:'', skillTestAppeared:'', skillTestPass:'', employmentActual:'', id:uid()})),
      locations: form.locations.map(l => ({...l, id:uid()})),
    });
    setTemplates(getTemplates());
    setTemplateName('');
    setShowSaveTemplate(false);
    alert('Template saved!');
  };

  const handleLoadTemplate = (tpl) => {
    setForm(f => ({
      ...f,
      clientId: tpl.clientId || f.clientId,
      assignmentName: tpl.assignmentName,
      trainingType: tpl.trainingType,
      occupations: tpl.occupations.map(o => ({...o, id:uid()})),
      locations: tpl.locations.map(l => ({...l, id:uid()})),
    }));
    setShowTemplates(false);
  };

  const handleDeleteTemplate = (id) => {
    deleteTemplate(id);
    setTemplates(getTemplates());
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      set('referenceFile', ev.target.result);
      set('referenceFileName', file.name);
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
    <Modal title={exp ? 'Edit Assignment' : 'Add Assignment'} onClose={onClose} size="modal-lg"
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={async()=>{setFormErr('');try{await onSave(form);}catch(e){setFormErr(e.message||'Failed to save');}}} >Save assignment</button>
      </>}>
      <ErrorBanner msg={formErr} onDismiss={()=>setFormErr('')}/>

      {/* Assignment level */}
      <div className="form-row form-row-2">
        <div className="form-group">
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4}}>
            <label style={{marginBottom:0}}>Client *</label>
            <button type="button" className="btn btn-ghost btn-sm" style={{fontSize:11, padding:'1px 6px'}}
              onClick={()=>{ set('manualClient', !form.manualClient); set('clientId',''); set('clientName',''); }}>
              {form.manualClient ? '← Use list' : '+ Manual entry'}
            </button>
          </div>
          {form.manualClient
            ? <div style={{display:'flex', gap:6, alignItems:'center'}}>
                <input style={{flex:1}} value={form.clientName||''} onChange={e=>set('clientName',e.target.value)} placeholder="Type client name"/>
                {onSaveClient && form.clientName?.trim() && token && (() => {
                  // Decode JWT payload (no verify — server is the source of truth) to check role.
                  try { const p = JSON.parse(atob(token.split('.')[1])); if (p.role === 'admin') return (
                    <button type="button" className="btn btn-ghost btn-sm" style={{fontSize:11, whiteSpace:'nowrap'}}
                      onClick={()=>setSaveClientModal({fullName: form.clientName.trim(), shortName:'', type:'Government', address:'', remarks:''})}>
                      💾 Save to list
                    </button>
                  ); } catch {}
                  return null;
                })()}
              </div>
            : <SearchableSelect
                value={form.clientId}
                onChange={v => set('clientId', v)}
                placeholder="— Select client —"
                options={clients.map(c => ({ value: c.id, label: `${c.shortName} — ${c.fullName}` }))}
              />
          }
        </div>
        <div className="form-group">
          <label>Fiscal year *</label>
          <SearchableSelect
            value={form.fy}
            onChange={v => set('fy', v)}
            placeholder="— Select FY —"
            options={FISCAL_YEARS.slice().reverse().map(fy => ({ value: fy, label: `${fy}  (${fyToAD(fy)})` }))}
          />
        </div>
      </div>
      <div className="form-group">
        <label>Assignment name *</label>
        <input value={form.assignmentName} onChange={e=>set('assignmentName',e.target.value)} placeholder="As stated in the experience letter"/>
      </div>
      <div className="form-row form-row-3">
        <div className="form-group">
          <label>Training type</label>
          <select value={form.trainingType} onChange={e=>set('trainingType',e.target.value)}>
            {TRAINING_TYPES.map(t=><option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Contract amount (NPR)</label>
          <input type="number" value={form.contractValue} onChange={e=>set('contractValue',e.target.value)} placeholder="Optional"/>
        </div>
        <div className="form-group">
          <label>Remarks</label>
          <input value={form.remarks} onChange={e=>set('remarks',e.target.value)} placeholder="Optional"/>
        </div>
      </div>
      <div style={{display:'flex', gap:24, marginBottom:16, padding:'10px 14px', background:'var(--bg2)', borderRadius:'var(--radius)', border:'1px solid var(--border)'}}>
        <label style={{display:'flex', alignItems:'center', gap:8, cursor:'pointer', userSelect:'none'}}>
          <input type="checkbox" checked={!!form.isGesi} onChange={e=>set('isGesi', e.target.checked)}
            style={{width:16, height:16, accentColor:'var(--accent)', cursor:'pointer'}}/>
          <div>
            <div style={{fontSize:13, fontWeight:600}}>GESI</div>
            <div style={{fontSize:11, color:'var(--text3)'}}>Gender Equality & Social Inclusion</div>
          </div>
        </label>
        <label style={{display:'flex', alignItems:'center', gap:8, cursor:'pointer', userSelect:'none'}}>
          <input type="checkbox" checked={!!form.isResidential} onChange={e=>set('isResidential', e.target.checked)}
            style={{width:16, height:16, accentColor:'var(--blue,#3b82f6)', cursor:'pointer'}}/>
          <div>
            <div style={{fontSize:13, fontWeight:600}}>Residential</div>
            <div style={{fontSize:11, color:'var(--text3)'}}>Trainees provided accommodation</div>
          </div>
        </label>
        <label style={{display:'flex', alignItems:'center', gap:8, cursor:'pointer', userSelect:'none'}}>
          <input type="checkbox" checked={!!form.isJV} onChange={e=>set('isJV', e.target.checked)}
            style={{width:16, height:16, accentColor:'var(--orange,#f59e0b)', cursor:'pointer'}}/>
          <div>
            <div style={{fontSize:13, fontWeight:600}}>JV</div>
            <div style={{fontSize:11, color:'var(--text3)'}}>Joint Venture assignment</div>
          </div>
        </label>
      </div>
      {form.isJV && (
        <div style={{display:'flex', gap:16, marginBottom:16, padding:'12px 14px', background:'color-mix(in srgb, var(--orange,#f59e0b) 8%, var(--bg2))', borderRadius:'var(--radius)', border:'1px solid color-mix(in srgb, var(--orange,#f59e0b) 30%, var(--border))'}}>
          <div style={{flex:1}}>
            <label className="form-label">JV Role</label>
            <select className="form-input" value={form.jvRole} onChange={e=>set('jvRole', e.target.value)}>
              <option value="Lead">Lead</option>
              <option value="JV Member">JV Member</option>
              <option value="Subconsultant">Subconsultant</option>
            </select>
          </div>
          <div style={{flex:1}}>
            <label className="form-label">Number of JV Partners</label>
            <input type="number" className="form-input" min="1" placeholder="e.g. 3"
              value={form.jvPartners} onChange={e=>set('jvPartners', e.target.value)}/>
          </div>
        </div>
      )}
      <div className="form-row form-row-2">
        <div className="form-group">
          <label>Start FY (multi-year contract)</label>
          <SearchableSelect value={form.startFY} onChange={v=>set('startFY',v)} placeholder="— Same as FY —"
            options={[{value:'',label:'— Same as FY —'}, ...FISCAL_YEARS.slice().reverse().map(fy=>({value:fy,label:`${fy}  (${fyToAD(fy)})`}))]}/>
        </div>
        <div className="form-group">
          <label>End FY (multi-year contract)</label>
          <SearchableSelect value={form.endFY} onChange={v=>set('endFY',v)} placeholder="— Same as FY —"
            options={[{value:'',label:'— Same as FY —'}, ...FISCAL_YEARS.slice().reverse().map(fy=>({value:fy,label:`${fy}  (${fyToAD(fy)})`}))]}/>
        </div>
      </div>
      <div className="form-row form-row-2">
        <div className="form-group">
          <label>Contract start date</label>
          <input value={form.startDate} onChange={e=>set('startDate',e.target.value)} placeholder="YYYY/MM/DD"/>
        </div>
        <div className="form-group">
          <label>Contract end date</label>
          <input value={form.endDate} onChange={e=>set('endDate',e.target.value)} placeholder="YYYY/MM/DD"/>
        </div>
      </div>

      {/* Reference letter upload — item 9 */}
      <div className="form-group">
        <label>Reference letter / document</label>
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          <button className="btn btn-secondary btn-sm" onClick={()=>fileInputRef.current?.click()}>
            📎 {form.referenceFileName ? 'Change file' : 'Attach file'}
          </button>
          {form.referenceFileName && (
            <span style={{fontSize:12, color:'var(--accent)', display:'flex', alignItems:'center', gap:6}}>
              📄 {form.referenceFileName}
              <button style={{background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:14}} onClick={()=>{set('referenceFile',null);set('referenceFileName','');}}>✕</button>
            </span>
          )}
          {form.referenceFile && form.referenceFileName?.match(/\.(jpg|jpeg|png|gif)$/i) && (
            <button className="btn btn-ghost btn-sm" onClick={()=>window.open(form.referenceFile)}>👁 Preview</button>
          )}
          {form.referenceFile && form.referenceFileName?.match(/\.pdf$/i) && (
            <button className="btn btn-ghost btn-sm" onClick={()=>{
              const w=window.open(); w.document.write(`<iframe src="${form.referenceFile}" width="100%" height="100%" style="border:none"/>`);
            }}>👁 Preview PDF</button>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.gif" style={{display:'none'}} onChange={handleFileChange}/>
        <div className="input-hint">Attach the scanned experience letter (PDF or image)</div>
      </div>

      {/* Occupations */}
      <div className="sub-section">
        <div className="sub-section-title">Occupation rows</div>
        {form.occupations.map((occ, i) => (
          <div className="repeatable-row" key={occ.id||i}>
            <button className="remove-btn" onClick={()=>removeOcc(i)}>✕</button>
            <div className="form-row form-row-2" style={{marginBottom:8}}>
              <div className="form-group" style={{marginBottom:0}}>
                <label>Occupation name in letter</label>
                <input value={occ.nameInLetter} onChange={e=>setOcc(i,'nameInLetter',e.target.value)} placeholder="As written by client"/>
              </div>
              <div className="form-group" style={{marginBottom:0}}>
                <label>Occupation</label>
                <SearchableSelect
                  value={toOccValue(occ.ctevtOccupationId)}
                  onChange={v => setOcc(i,'ctevtOccupationId', fromOccValue(v))}
                  placeholder="— Select —"
                  options={[
                    ...OCCUPATIONS.map(o => ({ value: o.id, label: o.name })),
                  ]}
                  onAddNew={canManageOccs ? (name => setQuickAddOcc({name, occIdx:i})) : undefined}
                />
              </div>
            </div>
            <div className="form-row" style={{gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr 1fr', gap:8, marginBottom:8}}>
              <div><label>Duration (hrs)</label><input type="number" value={occ.duration} onChange={e=>setOcc(i,'duration',e.target.value)}/></div>
              <div><label>Level</label><select value={occ.level||''} onChange={e=>setOcc(i,'level',e.target.value)}><option value="">—</option><option>Level 1</option><option>Level 2</option><option>Level 3</option><option>Professional</option></select></div>
              <div><label>Trainees</label><input type="number" value={occ.trainees} onChange={e=>setOcc(i,'trainees',e.target.value)}/></div>
              <div><label>ST Appeared</label><input type="number" value={occ.skillTestAppeared} onChange={e=>setOcc(i,'skillTestAppeared',e.target.value)} placeholder="Optional"/></div>
              <div><label>ST Pass</label><input type="number" value={occ.skillTestPass} onChange={e=>setOcc(i,'skillTestPass',e.target.value)} placeholder="Optional"/></div>
              <div><label>Employ%</label><input type="number" value={occ.employmentActual} onChange={e=>setOcc(i,'employmentActual',e.target.value)} placeholder="Optional"/></div>
            </div>
            <div style={{display:'flex', gap:16, marginBottom:8}}>
              <label className="toggle-wrap">
                <button className={`toggle ${occ.skillTestProvisioned?'on':''}`} onClick={()=>setOcc(i,'skillTestProvisioned',!occ.skillTestProvisioned)}/>
                Skill test provisioned
              </label>
              <label className="toggle-wrap">
                <button className={`toggle ${occ.employmentProvisioned?'on':''}`} onClick={()=>setOcc(i,'employmentProvisioned',!occ.employmentProvisioned)}/>
                Employment provisioned
              </label>
            </div>
            {/* Per-occupation locations */}
            <div style={{background:'var(--bg2)', borderRadius:6, padding:'8px 10px'}}>
              <div style={{fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:6}}>LOCATIONS</div>
              {(occ.locations||[]).map((loc, li) => (
                <div key={loc.id||li} style={{marginBottom:8,padding:'8px 10px',background:'var(--surface)',borderRadius:6,border:'1px solid var(--border)'}}>
                  <div style={{display:'grid', gridTemplateColumns:'1fr auto', gap:6, marginBottom:6, alignItems:'end'}}>
                    <div style={{position:'relative'}}>
                      {li===0 && <label>District</label>}
                      <DistrictSearch value={loc.district} onChange={(district, province) => {
                        setOccLoc(i,li,'district',district);
                        setOccLoc(i,li,'province',province);
                      }}/>
                    </div>
                    <button onClick={()=>removeOccLoc(i,li)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text3)',fontSize:16,padding:'0 4px',alignSelf:'center',marginBottom:2}}>✕</button>
                  </div>
                  {loc.district && (
                    <div>
                      <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:6}}>
                        {(loc.localLevels||[]).map(ll => (
                          <span key={ll.name} style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:11,fontWeight:500,
                            background:'color-mix(in srgb,var(--primary) 12%,transparent)',color:'var(--primary)',
                            borderRadius:4,padding:'2px 6px'}}>
                            {ll.name}
                            <button onClick={()=>removeOccLocLL(i,li,ll.name)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--primary)',fontSize:11,padding:0,lineHeight:1,opacity:0.7}}>✕</button>
                          </span>
                        ))}
                      </div>
                      <LocalLevelSearch province={loc.province} district={loc.district} value=''
                        onChange={(ll, type) => { if(ll) addOccLocLL(i,li,ll,type); }}/>
                    </div>
                  )}
                </div>
              ))}
              <div style={{display:'flex', gap:12, alignItems:'center', flexWrap:'wrap', marginTop:4}}>
                <button onClick={()=>addOccLoc(i)} style={{fontSize:11,color:'var(--primary)',background:'none',border:'none',cursor:'pointer',padding:0}}>+ Add location row</button>
                <span style={{color:'var(--border)'}}>|</span>
                <BulkDistrictPicker onAdd={(locs)=>setOcc(i,'locations',[...(occ.locations||[]),...locs.map(l=>({id:uid(),...l}))])}/>
              </div>
            </div>
          </div>
        ))}
        <button className="add-row-btn" onClick={addOcc}>+ Add occupation row</button>
      </div>
    </Modal>
    {saveClientModal && (
      <Modal title="Save client to Master data" onClose={()=>setSaveClientModal(null)}
        footer={<>
          <button className="btn btn-secondary" onClick={()=>setSaveClientModal(null)}>Cancel</button>
          <button className="btn btn-primary" onClick={async()=>{
            if(!saveClientModal.fullName.trim()) { setSaveClientErr('Full name is required'); return; }
            if(!saveClientModal.shortName.trim()) { setSaveClientErr('Short name is required'); return; }
            setSaveClientErr('');
            try {
              const newClient = await onSaveClient(saveClientModal);
              set('clientId', newClient.id);
              set('manualClient', false);
              set('clientName', '');
              setSaveClientModal(null);
            } catch(err) { setSaveClientErr('Failed to save client: ' + err.message); }
          }}>Save & select</button>
        </>}>
        <ErrorBanner msg={saveClientErr} onDismiss={()=>setSaveClientErr('')}/>
        <div style={{fontSize:12, color:'var(--text2)', marginBottom:12}}>
          Save <strong>{saveClientModal.fullName}</strong> to the clients list so it can be reused in future assignments.
        </div>
        <div className="form-group"><label>Full name *</label>
          <input value={saveClientModal.fullName} onChange={e=>setSaveClientModal(m=>({...m,fullName:e.target.value}))} placeholder="Official full name"/>
        </div>
        <div className="form-row form-row-2">
          <div className="form-group"><label>Short name / acronym *</label>
            <input value={saveClientModal.shortName} onChange={e=>setSaveClientModal(m=>({...m,shortName:e.target.value}))} placeholder="e.g. PCTVET"/>
          </div>
          <div className="form-group"><label>Client type</label>
            <select value={saveClientModal.type} onChange={e=>setSaveClientModal(m=>({...m,type:e.target.value}))}>
              {CLIENT_TYPES.map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group"><label>Address</label>
          <input value={saveClientModal.address} onChange={e=>setSaveClientModal(m=>({...m,address:e.target.value}))}/>
        </div>
      </Modal>
    )}
    {quickAddOcc && <QuickAddOccupationModal name={quickAddOcc.name} onSave={saved=>{setOcc(quickAddOcc.occIdx,'ctevtOccupationId',saved.id);setQuickAddOcc(null);}} onClose={()=>setQuickAddOcc(null)}/>}
    </>
  );
}

export { DistrictSearch, LocalLevelSearch, QuickAddOccupationModal };
export default ExperienceForm;

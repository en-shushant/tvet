import { useState, useRef, useEffect, useMemo, Fragment } from 'react';
import ReactDOM from 'react-dom';
import Modal from './ui/Modal.jsx';
import { ErrorBanner } from './ui/Modal.jsx';
import { useUnsavedGuard } from './ui/UnsavedGuard.jsx';
import SearchableSelect from './ui/SearchableSelect.jsx';
import { DropdownPanel } from './ui/SearchableSelect.jsx';
import { Btn, MdTextField, MdSelect, MdOption, MdToggle } from '../md.jsx';
import { BulkDistrictPicker } from './BulkDistrictPicker.jsx';
import { PROVINCES, FISCAL_YEARS, TRAINING_TYPES, SECTORS, OCCUPATIONS, CLIENT_TYPES, getAllDistricts } from '../constants/data.js';
import { api } from '../utils/api.js';
import { getSession } from '../utils/auth.js';
import { fillDescriptionTemplate } from '../utils/descriptionTemplates.js';
import { fillNarrativeTemplate, fillServicesTemplate } from '../utils/specificTemplates.js';
import { fyToAD, uid } from '../utils/format.js';
import { toast } from './ui/Feedback.jsx';



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
      footer={<><Btn className="btn btn-secondary" onClick={onClose}>Cancel</Btn><Btn className="btn btn-primary" onClick={handleSave}>Save &amp; select</Btn></>}>
      <ErrorBanner msg={err} onDismiss={()=>setErr('')}/>
      <div className="form-row form-row-2">
        <div className="form-group">
          <MdTextField label="Name *" value={form.name} onChange={e=>set('name',e.target.value)}/>
        </div>
        <div className="form-group">
          <MdSelect label="Sector *" value={form.sector} onChange={e=>set('sector',e.target.value)}>
            {SECTORS.map(s=><MdOption key={s} value={s}>{s}</MdOption>)}
          </MdSelect>
        </div>
      </div>
      <div className="form-group">
        <MdSelect label="Level (optional)" value={form.level} onChange={e=>set('level',e.target.value)}>
          <MdOption value="">— Not specified —</MdOption>
          <MdOption value="N/A">N/A</MdOption>
          <MdOption value="Level 1">Level 1</MdOption>
          <MdOption value="Level 2">Level 2</MdOption>
          <MdOption value="Level 3">Level 3</MdOption>
          <MdOption value="Professional">Professional</MdOption>
        </MdSelect>
      </div>
    </Modal>
  );
}

/** Blank and non-numeric both mean "not recorded", not zero. */
const num = (v) => {
  if (v === '' || v == null) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Row-level consistency checks, surfaced as you type rather than on save.
 *
 * Note `employmentActual` is stored as `employment_actual_pct` — a percentage,
 * not a headcount — so it is bounded to 0–100 rather than compared to trainees.
 */
function occIssues(occ) {
  const out = [];
  const trainees = num(occ.trainees);
  const appeared = num(occ.skillTestAppeared);
  const passed = num(occ.skillTestPass);
  const emp = num(occ.employmentActual);
  if (trainees != null && appeared != null && appeared > trainees)
    out.push(`Skill test appeared (${appeared}) is more than trainees (${trainees}).`);
  if (appeared != null && passed != null && passed > appeared)
    out.push(`Skill test passed (${passed}) is more than appeared (${appeared}).`);
  if (passed != null && appeared == null && trainees != null && passed > trainees)
    out.push(`Skill test passed (${passed}) is more than trainees (${trainees}).`);
  if (emp != null && (emp < 0 || emp > 100))
    out.push(`Employment is a percentage, so it must be between 0 and 100.`);
  [['trainees', trainees], ['duration', num(occ.duration)], ['skillTestAppeared', appeared], ['skillTestPass', passed]]
    .forEach(([k, v]) => { if (v != null && v < 0) out.push(`${k === 'duration' ? 'Hours' : 'Counts'} cannot be negative.`); });
  return [...new Set(out)];
}

/** Derived, never typed — the brief's rule that percentages follow from counts. */
function passRate(occ) {
  const appeared = num(occ.skillTestAppeared), passed = num(occ.skillTestPass);
  if (!appeared || passed == null) return '';
  return `${Math.round((passed / appeared) * 100)}%`;
}

function ExperienceForm({exp, clients, institute, onSave, onClose, onDuplicate, onSaveClient}) {
  const _sess = getSession();
  const token = _sess?.token;
  const canManageOccs = _sess?.role === 'admin' || _sess?.role === 'editor' || _sess?.role === 'superadmin';
  const [quickAddOcc, setQuickAddOcc] = useState(null); // {name, occIdx}
  // One occupation's locations open at a time — keeps the table scannable.
  const [expandedOcc, setExpandedOcc] = useState(null);
  const [saveClientModal, setSaveClientModal] = useState(null);
  const [saveClientErr, setSaveClientErr] = useState('');
  const [formErr, setFormErr] = useState('');
  const [form, setForm] = useState(() => {
    const defaults = {
      clientId:'', clientName:'', manualClient:false,
      fy:'2081/82', assignmentName:'', trainingType:'Short Term',
      contractValue:'', startDate:'', endDate:'', startFY:'', endFY:'', remarks:'',
      isGesi:false, isResidential:false, isJV:false, jvRole:'Lead', jvPartners:'',
      occupations:[], locations:[], referenceFile:null, referenceFileName:'',
      country:'Nepal', descriptionOfWork:'', durationMonths:'', totalPersonMonths:'',
      ownServiceValue:'', jvPartnerNames:'', jvPartnerPersonMonths:'',
      narrativeDescription:'', actualServicesDescription:'',
      numGroups:'', durationDays:''
    };
    return exp ? {...defaults, ...exp} : defaults;
  });
  const [showReportFields, setShowReportFields] = useState(false);
  const [showOverrides, setShowOverrides] = useState(false);
  const { handleClose, markDirty, markClean, UnsavedModal } = useUnsavedGuard(onClose);

  // Mark dirty whenever form changes after initial render
  useEffect(() => { markDirty(); }, [form]);

  const fileInputRef = useRef(null);

  const set = (k, v) => setForm(f => ({...f, [k]: v}));

  const addOcc = () => set('occupations', [...form.occupations, {id:uid(), nameInLetter:'', ctevtOccupationId:'', trainees:'', duration:'', level:'', skillTestProvisioned:false, skillTestAppeared:'', skillTestPass:'', employmentProvisioned:false, employmentActual:'', locations:[]}]);
  const setOcc = (i, k, v) => setForm(f => ({...f, occupations: f.occupations.map((o,idx)=>idx===i?{...o,[k]:v}:o)}));

  /**
   * Selecting an occupation pulls its level and standard hours from master data.
   * Only fills blanks — a value already typed for this assignment is deliberate
   * and outranks the default, so it is never overwritten.
   */
  const pickOccupation = (i, id) => setForm(f => ({...f, occupations: f.occupations.map((o, idx) => {
    if (idx !== i) return o;
    const master = OCCUPATIONS.find(x => String(x.id) === String(id));
    return {
      ...o,
      ctevtOccupationId: id,
      level: o.level || master?.level || '',
      duration: (o.duration === '' || o.duration == null) ? (master?.duration ?? '') : o.duration,
    };
  })}));
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

  // Assignment-level `form.locations` is carried through save/duplicate untouched so
  // the /assignments contract and the assignment_locations table keep working, but
  // it has no editor: districts are captured per occupation (addOccLoc above).
  // The add/set/remove handlers for it were unreachable and have been removed.

  // Namespace custom occ IDs to avoid collision with built-in IDs (both start at 1)
  const toOccValue = (rawId) => {
    if (!rawId && rawId !== 0) return rawId;
    return rawId;
  };
  const fromOccValue = (v) => {
    if (typeof v === 'string' && v.startsWith('c:')) return parseInt(v.slice(2));
    return v;
  };

  // Long-text field backed by this firm's auto-fill template. The template text is
  // derived entirely from data already captured on this form (client, occupations,
  // trainees, districts), so the button exists to avoid retyping it per assignment.
  // Firms without a configured template still get a normal textarea.
  const TemplateField = ({ label, field, templateKey, filler, placeholder, hint, rows = 5, style }) => {
    const variationId = institute?.[templateKey];
    return (
      <div className="form-group" style={style}>
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginBottom:4}}>
          <label style={{fontSize:12, fontWeight:500, color:'var(--text2)'}}>{label}</label>
          <button type="button"
            disabled={!variationId}
            onClick={() => set(field, filler(variationId, form, institute, clients))}
            title={variationId
              ? 'Generate from this firm’s template using the details already entered above'
              : 'No template set for this firm — an admin can assign one on the firm’s Overview tab'}
            style={{display:'flex', alignItems:'center', gap:4, fontSize:11, padding:'3px 9px',
              borderRadius:6, border:'1px solid var(--border)', fontFamily:'var(--font)',
              background: variationId ? 'var(--bg2)' : 'transparent',
              color: variationId ? 'var(--accent)' : 'var(--text3)',
              cursor: variationId ? 'pointer' : 'not-allowed',
              opacity: variationId ? 1 : 0.55}}>
            <span className="material-icons-round" style={{fontSize:13}}>auto_awesome</span> Auto-fill
          </button>
        </div>
        <textarea
          value={form[field] || ''}
          onChange={e => set(field, e.target.value)}
          placeholder={placeholder}
          rows={rows}
          style={{width:'100%', padding:'8px 12px', borderRadius:'var(--radius)',
            border:'1px solid var(--border)', background:'var(--bg2)', color:'var(--text)',
            fontSize:13, fontFamily:'var(--font)', resize:'vertical', boxSizing:'border-box'}}
        />
        {hint && <div className="input-hint">{hint}</div>}
      </div>
    );
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
    if(!templateName.trim()) { toast.error('Enter a template name.'); return; }
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
    toast.success('Template saved');
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
    <Modal title={exp ? 'Edit Assignment' : 'Add Assignment'} onClose={handleClose} size="xl"
      footer={<>
        <Btn className="btn btn-secondary" onClick={handleClose}>Cancel</Btn>
        <Btn className="btn btn-primary" onClick={async()=>{setFormErr('');if(form.occupations.some(o=>!o.ctevtOccupationId)){setFormErr('Please select an occupation for all occupation rows.');return;}const bad=form.occupations.flatMap(occIssues);if(bad.length){setFormErr(bad[0]);return;}try{markClean();await onSave(form);}catch(e){markDirty();setFormErr(e.message||'Failed to save');}}}>Save assignment</Btn>
      </>}>
      <ErrorBanner msg={formErr} onDismiss={()=>setFormErr('')}/>

      {/* Assignment level */}
      <div className="form-row form-row-2">
        <div className="form-group">
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4}}>
            <label style={{marginBottom:0}}>Client *</label>
            <Btn type="button" className="btn btn-ghost btn-sm" style={{fontSize:11, padding:'1px 6px'}}
              onClick={()=>{ set('manualClient', !form.manualClient); set('clientId',''); set('clientName',''); }}>
              {form.manualClient ? '← Use list' : '+ Manual entry'}
            </Btn>
          </div>
          {form.manualClient
            ? <div style={{display:'flex', gap:6, alignItems:'center'}}>
                <input style={{flex:1}} value={form.clientName||''} onChange={e=>set('clientName',e.target.value)} placeholder="Type client name"/>
                {onSaveClient && form.clientName?.trim() && token && (() => {
                  // Decode JWT payload (no verify — server is the source of truth) to check role.
                  try { const p = JSON.parse(atob(token.split('.')[1])); if (p.role === 'admin' || p.role === 'editor' || p.role === 'superadmin') return (
                    <Btn type="button" className="btn btn-ghost btn-sm" style={{fontSize:11, whiteSpace:'nowrap'}}
                      onClick={()=>setSaveClientModal({fullName: form.clientName.trim(), shortName:'', type:'Government', address:'', remarks:''})}>
                      💾 Save to list
                    </Btn>
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
        <MdTextField label="Assignment name *" value={form.assignmentName} onChange={e=>set('assignmentName',e.target.value)} placeholder="As stated in the experience letter"/>
      </div>
      <div className="form-row form-row-3">
        <div className="form-group">
          <MdSelect label="Training type" value={form.trainingType} onChange={e=>set('trainingType',e.target.value)}>
            {TRAINING_TYPES.map(t=><MdOption key={t} value={t}>{t}</MdOption>)}
          </MdSelect>
        </div>
        <div className="form-group">
          <MdTextField type="number" label="Contract amount (NPR)" value={form.contractValue} onChange={e=>set('contractValue',e.target.value)} placeholder="Optional"/>
        </div>
        <div className="form-group">
          <MdTextField label="Remarks" value={form.remarks} onChange={e=>set('remarks',e.target.value)} placeholder="Optional"/>
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
            style={{width:16, height:16, accentColor:'var(--orange)', cursor:'pointer'}}/>
          <div>
            <div style={{fontSize:13, fontWeight:600}}>JV</div>
            <div style={{fontSize:11, color:'var(--text3)'}}>Joint Venture assignment</div>
          </div>
        </label>
      </div>
      {form.isJV && (
        <div style={{display:'flex', gap:16, marginBottom:16, padding:'12px 14px', background:'color-mix(in srgb, var(--orange) 8%, var(--bg2))', borderRadius:'var(--radius)', border:'1px solid color-mix(in srgb, var(--orange) 30%, var(--border))'}}>
          <div style={{flex:1}}>
            <MdSelect label="JV Role" value={form.jvRole} onChange={e=>set('jvRole', e.target.value)}>
              <MdOption value="Lead">Lead</MdOption>
              <MdOption value="JV Member">JV Member</MdOption>
              <MdOption value="Subconsultant">Subconsultant</MdOption>
            </MdSelect>
          </div>
          <div style={{flex:1}}>
            <MdTextField type="number" label="Number of JV Partners" value={form.jvPartners}
              onChange={e=>set('jvPartners', e.target.value)} placeholder="e.g. 3"/>
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
          <MdTextField label="Contract start date (BS)" value={form.startDate} onChange={e=>set('startDate',e.target.value)} placeholder="e.g. 2081/04/27"/>
        </div>
        <div className="form-group">
          <MdTextField label="Contract end date (BS)" value={form.endDate} onChange={e=>set('endDate',e.target.value)} placeholder="e.g. 2082/03/15"/>
        </div>
      </div>

      {/* Reference letter upload */}
      <div className="form-group">
        <label>Reference letter / document</label>
        <div style={{display:'flex', gap:8, alignItems:'flex-start'}}>
          <div style={{flex:1}}>
            <div style={{display:'flex', gap:8, alignItems:'center', marginBottom: form.referenceFile ? 8 : 0}}>
              <Btn className="btn btn-secondary btn-sm" onClick={()=>fileInputRef.current?.click()}>
                📎 {form.referenceFileName ? 'Change file' : 'Attach file'}
              </Btn>
              {form.referenceFile && (
                <Btn className="btn btn-ghost btn-sm" onClick={()=>{set('referenceFile',null);set('referenceFileName','');}}>✕ Remove</Btn>
              )}
              {form.referenceFile && form.referenceFileName?.match(/\.pdf$/i) && (
                <Btn className="btn btn-ghost btn-sm" onClick={()=>{
                  const w=window.open(); w.document.write(`<iframe src="${form.referenceFile}" width="100%" height="100%" style="border:none"/>`);
                }}>👁 Preview PDF</Btn>
              )}
            </div>
            {form.referenceFile && (
              <div>
                <input className="form-input" style={{fontSize:12}}
                  placeholder="File label (e.g. Experience Letter – CTEVT 2081)"
                  value={form.referenceFileName}
                  onChange={e=>set('referenceFileName', e.target.value)}/>
              </div>
            )}
          </div>
          {form.referenceFile && form.referenceFileName?.match(/\.(jpg|jpeg|png|gif|webp)$/i) && (
            <img src={form.referenceFile} alt="preview"
              style={{width:64, height:64, objectFit:'cover', borderRadius:'var(--radius)', border:'1px solid var(--border)', cursor:'pointer', flexShrink:0}}
              onClick={()=>window.open(form.referenceFile)}/>
          )}
          {form.referenceFile && form.referenceFileName?.match(/\.pdf$/i) && (
            <div style={{width:64, height:64, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', borderRadius:'var(--radius)', border:'1px solid var(--border)', background:'var(--bg2)', fontSize:10, color:'var(--text3)', flexShrink:0, cursor:'pointer'}}
              onClick={()=>{const w=window.open(); w.document.write(`<iframe src="${form.referenceFile}" width="100%" height="100%" style="border:none"/>`)}}>
              <span className="material-icons-round" style={{fontSize:24, color:'var(--error)'}}>picture_as_pdf</span>PDF
            </div>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.gif,.webp" style={{display:'none'}} onChange={handleFileChange}/>
        <div className="input-hint">Attach the scanned experience letter (PDF or image) and set a display label</div>
      </div>

      {/* EOI report details */}
      <div className="sub-section" style={{marginBottom:16}}>
        <button type="button" onClick={()=>setShowReportFields(s=>!s)}
          style={{width:'100%', background:'none', border:'1px solid var(--border)', borderRadius: showReportFields ? 'var(--radius) var(--radius) 0 0' : 'var(--radius)', cursor:'pointer', padding:'10px 14px', display:'flex', alignItems:'center', justifyContent:'space-between', fontFamily:'var(--font)'}}>
          <span style={{fontSize:13, fontWeight:600, display:'flex', alignItems:'center', gap:6}}><span className="material-icons-round" style={{fontSize:16}}>assignment</span> EOI report details</span>
          <span style={{fontSize:11, color:'var(--text3)'}}>{showReportFields ? '▲ Hide' : '▼ Show — required for generating EOI report'}</span>
        </button>
        {showReportFields && (
          <div style={{padding:'14px', border:'1px solid var(--border)', borderTop:'none', borderRadius:'0 0 var(--radius) var(--radius)'}}>
            <div className="form-row form-row-2">
              <div className="form-group">
                <MdTextField label="Country" value={form.country} onChange={e=>set('country', e.target.value)} placeholder="Nepal"/>
              </div>
              <div className="form-group">
                <MdTextField type="number" label="Duration of assignment (months)" value={form.durationMonths} onChange={e=>set('durationMonths', e.target.value)} placeholder="e.g. 8"/>
              </div>
            </div>
            <div className="form-row form-row-2">
              <div className="form-group">
                <MdTextField type="number" label="Total person-months of assignment" value={form.totalPersonMonths} onChange={e=>set('totalPersonMonths', e.target.value)} placeholder="e.g. 24"/>
              </div>
              <div className="form-group">
                <MdTextField type="number" label="Value of firm's services (NPR) — if different from contract value" value={form.ownServiceValue} onChange={e=>set('ownServiceValue', e.target.value)} placeholder="Leave blank to use contract amount"/>
              </div>
            </div>
            {form.isJV && (
              <div className="form-row form-row-2">
                <div className="form-group">
                  <MdTextField label="Name of JV partner(s) / sub-consultants" value={form.jvPartnerNames} onChange={e=>set('jvPartnerNames', e.target.value)} placeholder="e.g. ABC Consultants, XYZ Pvt. Ltd."/>
                </div>
                <div className="form-group">
                  <MdTextField type="number" label="Person-months by JV partners / sub-consultants" value={form.jvPartnerPersonMonths} onChange={e=>set('jvPartnerPersonMonths', e.target.value)} placeholder="e.g. 10"/>
                </div>
              </div>
            )}
            {/* The report writes these three from the firm's assigned template
                using the details above, so they normally need no input at all.
                Filling one here overrides the generated text for this assignment
                only — kept for the occasional case a template cannot express. */}
            {(() => {
              const OVERRIDES = [
                { label:'Description of work carried out — 3(A)', field:'descriptionOfWork',
                  templateKey:'descTemplateId', filler:fillDescriptionTemplate, rows:3,
                  placeholder:'Leave empty to use the firm’s template.' },
                { label:'Narrative description of Project — 3(B)', field:'narrativeDescription',
                  templateKey:'narrativeTemplateId', filler:fillNarrativeTemplate,
                  placeholder:'Leave empty to use the firm’s template.',
                  hint:'Each new line becomes a separate paragraph in the Word report.' },
                { label:'Description of actual services provided — 3(B)', field:'actualServicesDescription',
                  templateKey:'servicesTemplateId', filler:fillServicesTemplate,
                  placeholder:'Leave empty to use the firm’s template.', style:{marginBottom:0} },
              ];
              const setCount = OVERRIDES.filter(o => (form[o.field] || '').trim()).length;
              return (
                <div style={{marginTop:4}}>
                  <button type="button" onClick={()=>setShowOverrides(s=>!s)}
                    style={{width:'100%', background:'none', cursor:'pointer', fontFamily:'var(--font)',
                      border:'1px solid var(--border)', padding:'9px 12px',
                      borderRadius: showOverrides ? 'var(--radius) var(--radius) 0 0' : 'var(--radius)',
                      display:'flex', alignItems:'center', justifyContent:'space-between', gap:8}}>
                    <span style={{fontSize:12.5, fontWeight:600, display:'flex', alignItems:'center', gap:6}}>
                      <span className="material-icons-round" style={{fontSize:15}}>edit_note</span>
                      Narrative text
                      {setCount > 0 && (
                        <span style={{fontSize:10, fontWeight:700, background:'var(--accent)', color:'#fff',
                          borderRadius:10, padding:'1px 7px'}}>{setCount} overridden</span>
                      )}
                    </span>
                    <span style={{fontSize:11, color:'var(--text3)'}}>
                      {showOverrides ? '▲ Hide' : '▼ Written automatically — open to override'}
                    </span>
                  </button>
                  {showOverrides && (
                    <div style={{padding:14, border:'1px solid var(--border)', borderTop:'none',
                      borderRadius:'0 0 var(--radius) var(--radius)'}}>
                      <div style={{fontSize:11.5, color:'var(--text3)', marginBottom:12, lineHeight:1.5}}>
                        The report generates all three from this firm’s template and the details entered above,
                        and keeps them current as those details change. Fill a box only to override it for this
                        assignment; Auto-fill drops in the generated text so you can edit from it.
                      </div>
                      {OVERRIDES.map(o => <TemplateField key={o.field} {...o} />)}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Occupations
          One table row per occupation rather than a stack of full-width cards:
          five occupations used to run past a screen and a half, which made the
          numbers impossible to compare against each other. Locations stay
          per-occupation but collapse to a district summary until opened. */}
      <div className="sub-section">
        <div className="sub-section-title">Occupations</div>
        <div className="occ-table-wrap">
          <table className="occ-table">
            <thead>
              <tr>
                <th style={{width:'22%'}}>Occupation *</th>
                <th style={{width:'18%'}}>Name in letter</th>
                <th style={{width:110}}>Level</th>
                <th style={{width:70}}>Hours</th>
                {/* Reads as a funnel left to right: how many trained, how many
                    sat the skill test, how many passed, how many got work. */}
                <th style={{width:84}}>Trainees</th>
                <th style={{width:88}}>Appeared</th>
                <th style={{width:80}}>Passed</th>
                <th style={{width:92}}>Employed&nbsp;%</th>
                <th style={{width:120}}>Districts</th>
                <th style={{width:32}} aria-label="Remove"></th>
              </tr>
            </thead>
            <tbody>
        {form.occupations.map((occ, i) => {
          const issues = occIssues(occ);
          const open = expandedOcc === (occ.id || i);
          const districts = (occ.locations||[]).map(l => l.district).filter(Boolean);
          return (
          <Fragment key={occ.id||i}>
            <tr className={issues.length ? 'occ-row occ-row-invalid' : 'occ-row'}>
              <td>
                <SearchableSelect
                  value={toOccValue(occ.ctevtOccupationId)}
                  onChange={v => pickOccupation(i, fromOccValue(v))}
                  placeholder="— Select —"
                  options={[
                    ...OCCUPATIONS.map(o => ({ value: o.id, label: o.name })),
                  ]}
                  onAddNew={canManageOccs ? (name => setQuickAddOcc({name, occIdx:i})) : undefined}
                />
              </td>
              <td><input className="occ-in" value={occ.nameInLetter} placeholder="As written by client"
                onChange={e=>setOcc(i,'nameInLetter',e.target.value)}/></td>
              <td>
                <select className="occ-in" value={occ.level||''} onChange={e=>setOcc(i,'level',e.target.value)}>
                  <option value="">—</option>
                  <option value="N/A">N/A</option>
                  <option value="Level 1">Level 1</option>
                  <option value="Level 2">Level 2</option>
                  <option value="Level 3">Level 3</option>
                  <option value="Professional">Professional</option>
                </select>
              </td>
              <td><input className="occ-in occ-num" type="number" value={occ.duration} onChange={e=>setOcc(i,'duration',e.target.value)}/></td>
              <td><input className="occ-in occ-num" type="number" value={occ.trainees} onChange={e=>setOcc(i,'trainees',e.target.value)}/></td>
              <td><input className="occ-in occ-num" type="number" value={occ.skillTestAppeared} onChange={e=>setOcc(i,'skillTestAppeared',e.target.value)}/></td>
              <td>
                <input className="occ-in occ-num" type="number" value={occ.skillTestPass} onChange={e=>setOcc(i,'skillTestPass',e.target.value)}/>
                {passRate(occ) && <div className="occ-derived">{passRate(occ)} pass</div>}
              </td>
              <td><input className="occ-in occ-num" type="number" value={occ.employmentActual} onChange={e=>setOcc(i,'employmentActual',e.target.value)}/></td>
              <td>
                <button type="button" className="occ-loc-btn" aria-expanded={open}
                  onClick={()=>setExpandedOcc(open ? null : (occ.id || i))}>
                  {districts.length === 0 ? 'Add districts'
                    : districts.length === 1 ? districts[0]
                    : `${districts.length} districts`}
                  <span aria-hidden="true">{open ? '▾' : '▸'}</span>
                </button>
              </td>
              <td><button className="remove-btn occ-remove" tabIndex={-1} title="Remove occupation" onClick={()=>removeOcc(i)}>✕</button></td>
            </tr>

            {issues.length > 0 && (
              <tr className="occ-issue-row"><td colSpan={10}>
                {issues.map(m => <div key={m} className="occ-issue">{m}</div>)}
              </td></tr>
            )}

            {open && (
            <tr className="occ-detail-row"><td colSpan={10}>
            <div style={{display:'flex', gap:16, marginBottom:10, flexWrap:'wrap'}}>
              <label className="toggle-wrap">
                <MdToggle selected={occ.skillTestProvisioned} onChange={()=>setOcc(i,'skillTestProvisioned',!occ.skillTestProvisioned)}/>
                Skill test provisioned
              </label>
              <label className="toggle-wrap">
                <MdToggle selected={occ.employmentProvisioned} onChange={()=>setOcc(i,'employmentProvisioned',!occ.employmentProvisioned)}/>
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
            </td></tr>
            )}
          </Fragment>
          );
        })}
            </tbody>
          </table>
        </div>
        {form.occupations.length === 0 && (
          <div className="occ-empty">No occupations yet. Add one to record trainees, skill tests and districts.</div>
        )}
        <button className="add-row-btn" onClick={addOcc}>+ Add occupation</button>
      </div>
    </Modal>
    {UnsavedModal}
    {saveClientModal && (
      <Modal title="Save client to Master data" onClose={()=>setSaveClientModal(null)}
        footer={<>
          <Btn className="btn btn-secondary" onClick={()=>setSaveClientModal(null)}>Cancel</Btn>
          <Btn className="btn btn-primary" onClick={async()=>{
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
          }}>Save & select</Btn>
        </>}>
        <ErrorBanner msg={saveClientErr} onDismiss={()=>setSaveClientErr('')}/>
        <div style={{fontSize:12, color:'var(--text2)', marginBottom:12}}>
          Save <strong>{saveClientModal.fullName}</strong> to the clients list so it can be reused in future assignments.
        </div>
        <div className="form-group">
          <MdTextField label="Full name *" value={saveClientModal.fullName} onChange={e=>setSaveClientModal(m=>({...m,fullName:e.target.value}))} placeholder="Official full name"/>
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <MdTextField label="Short name / acronym *" value={saveClientModal.shortName} onChange={e=>setSaveClientModal(m=>({...m,shortName:e.target.value}))} placeholder="e.g. PCTVET"/>
          </div>
          <div className="form-group">
            <MdSelect label="Client type" value={saveClientModal.type} onChange={e=>setSaveClientModal(m=>({...m,type:e.target.value}))}>
              {CLIENT_TYPES.map(t=><MdOption key={t} value={t}>{t}</MdOption>)}
            </MdSelect>
          </div>
        </div>
        <div className="form-group">
          <MdTextField label="Address" value={saveClientModal.address} onChange={e=>setSaveClientModal(m=>({...m,address:e.target.value}))}/>
        </div>
      </Modal>
    )}
    {quickAddOcc && <QuickAddOccupationModal name={quickAddOcc.name} onSave={saved=>{pickOccupation(quickAddOcc.occIdx,saved.id);setQuickAddOcc(null);}} onClose={()=>setQuickAddOcc(null)}/>}
    </>
  );
}

export { DistrictSearch, LocalLevelSearch, QuickAddOccupationModal };
export default ExperienceForm;

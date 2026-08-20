import { useState } from 'react';
import Modal from './ui/Modal.jsx';
import { ErrorBanner } from './ui/Modal.jsx';
import { useUnsavedGuard } from './ui/UnsavedGuard.jsx';
import { INSTITUTE_TYPES, INSTITUTE_STATUSES, CONSTITUTION_TYPES } from '../constants/data.js';
import { Btn, MdTextField, MdSelect, MdOption, MdToggle } from '../md.jsx';
import { DESCRIPTION_VARIATIONS } from '../utils/descriptionTemplates.js';
import { NARRATIVE_VARIATIONS, SERVICES_VARIATIONS } from '../utils/specificTemplates.js';
import { getSession } from '../utils/auth.js';


function InstituteForm({institute, onSave, onClose, isSuperAdmin}) {
  const [form, setForm] = useState(institute || {
    name:'', acronym:'', regNo:'', regDate:'', pan:'', permanentAccountNo:'',
    contactPerson:'', phone:'', mobile:'', email:'', address:'',
    type:'Private', status:'Active', renewalDue:'', remarks:'', logo:null, website:'', googleMapLink:'', latitude:'', longitude:'',
    isShortlistingOnly: false,
    nameNp: '', addressNp: '', contactPersonNp: '',
    letterhead: null, sign: null, stamp: null,
    letterTopMargin: 15, letterLrPadding: 5, letterBottomPadding: 15,
    constitutionType:'', fax:'', contactDesignation:'', localAgent:'',
    orgProfile:'', totalStaff:'', professionalStaff:'', keyStaff:[],
    descTemplateId:'', narrativeTemplateId:'', servicesTemplateId:'',
  });
  const [showEoi, setShowEoi] = useState(false);
  const [showTpl, setShowTpl] = useState(false);
  const _role = getSession()?.role;
  const canSetTemplates = _role === 'admin' || _role === 'superadmin';

  const { handleClose, markDirty, markClean, UnsavedModal } = useUnsavedGuard(onClose);
  const set = (k, v) => { markDirty(); setForm(f => ({...f, [k]: v})); };

  // Key staff roster — what "Name of Senior Staff ... Functions Performed" on
  // every assignment's 3(B) is auto-written from, the same way the templates
  // above drive the three narrative fields. Kept at firm level rather than
  // per-assignment because the same people usually lead every project.
  const addKeyStaff = () => { markDirty(); setForm(f => ({...f, keyStaff:[...(f.keyStaff||[]), {name:'', position:''}]})); };
  const updateKeyStaff = (i, k, v) => { markDirty(); setForm(f => ({...f, keyStaff:(f.keyStaff||[]).map((s, j) => j===i ? {...s,[k]:v} : s)})); };
  const removeKeyStaff = (i) => { markDirty(); setForm(f => ({...f, keyStaff:(f.keyStaff||[]).filter((_, j) => j!==i)})); };
  const [err, setErr] = useState('');
  const handleSave = () => {
    if(!form.name.trim()) { setErr('Institute name is required.'); return; }
    if(!form.isShortlistingOnly && !form.regNo.trim()) { setErr('Registration number is required.'); return; }
    markClean();
    onSave(form);
  };

  return (
    <>{UnsavedModal}
    <Modal title={institute ? 'Edit Institute Profile' : 'Add New Institute'} onClose={handleClose} size="lg"
      footer={<>
        <Btn className="btn btn-secondary" onClick={handleClose}>Cancel</Btn>
        <Btn className="btn btn-primary" onClick={handleSave}>
          {institute ? 'Save changes' : 'Add institute'}
        </Btn>
      </>}>
      {/* Logo */}
      <div className="form-group">
        <label>Institute logo</label>
        <div style={{display:'flex', alignItems:'center', gap:12}}>
          {form.logo && <img src={form.logo} alt="logo" style={{width:52, height:52, objectFit:'contain', border:'1px solid var(--border)', borderRadius:6, background:'#fff', padding:3}}/>}
          <label style={{cursor:'pointer'}}>
            <input type="file" accept="image/*" style={{display:'none'}} onChange={e=>{
              const file=e.target.files[0]; if(!file) return;
              const reader=new FileReader();
              reader.onload=ev=>set('logo',ev.target.result);
              reader.readAsDataURL(file);
            }}/>
            <span className="btn btn-secondary btn-sm">{form.logo ? <><span className="material-icons-round" style={{fontSize:14,verticalAlign:'middle',marginRight:4}}>sync</span>Change logo</> : <><span className="material-icons-round" style={{fontSize:14,verticalAlign:'middle',marginRight:4}}>photo_camera</span>Upload logo</>}</span>
          </label>
          {form.logo && <span className="btn btn-ghost btn-sm" style={{cursor:'pointer'}} onClick={()=>set('logo',null)}><span className="material-icons-round" style={{fontSize:14,verticalAlign:'middle',marginRight:4}}>close</span>Remove</span>}
        </div>
        <div className="input-hint">PNG or JPG shown on the institute card. Max ~500 KB recommended.</div>
      </div>

      <div className="form-row form-row-2">
        <div className="form-group">
          <MdTextField label="Institute name *" value={form.name}
            onChange={e=>set('name',e.target.value)} placeholder="Full official name"/>
        </div>
        <div className="form-group">
          <MdTextField label="Acronym / Short name" value={form.acronym||''}
            onChange={e=>set('acronym',e.target.value)} placeholder="e.g. WLTTI, NVA"
            supporting-text="Used in reports and comparison view"/>
        </div>
      </div>
      <div className="form-row form-row-2">
        <div className="form-group">
          <MdTextField
            label={`Registration number${form.isShortlistingOnly ? ' (optional)' : ' *'}`}
            value={form.regNo} onChange={e=>set('regNo',e.target.value)}
            placeholder="e.g. XYZ/001/2065"/>
        </div>
      </div>
      <div className="form-row form-row-2">
        <div className="form-group">
          <MdTextField label="Registration date" value={form.regDate}
            onChange={e=>set('regDate',e.target.value)} placeholder="YYYY/MM/DD"/>
        </div>
        <div className="form-group">
          <MdTextField label="PAN / VAT (Sthayee Lekha no.)" value={form.pan}
            onChange={e=>set('pan',e.target.value)} placeholder="9-digit PAN"/>
        </div>
      </div>
      <div className="form-row form-row-3">
        <div className="form-group">
          <MdTextField label="Contact person" value={form.contactPerson}
            onChange={e=>set('contactPerson',e.target.value)}/>
        </div>
        <div className="form-group">
          <MdTextField label="Phone" value={form.phone}
            onChange={e=>set('phone',e.target.value)}/>
        </div>
        <div className="form-group">
          <MdTextField label="Mobile" value={form.mobile||''}
            onChange={e=>set('mobile',e.target.value)}/>
        </div>
        <div className="form-group">
          <MdTextField type="email" label="Email" value={form.email}
            onChange={e=>set('email',e.target.value)}/>
        </div>
      </div>
      <div className="form-group">
        <MdTextField label="Address" value={form.address}
          onChange={e=>set('address',e.target.value)} placeholder="Full address"/>
      </div>
      <div className="form-group">
        <MdTextField label="Website (optional)" value={form.website||''}
          onChange={e=>set('website',e.target.value)} placeholder="https://www.example.com"/>
      </div>
      <div className="form-group">
        <MdTextField label="Google Maps Link (optional)" value={form.googleMapLink||''}
          onChange={e=>set('googleMapLink',e.target.value)} placeholder="https://maps.app.goo.gl/..."
          supporting-text="Paste the share link for exact location"/>
      </div>
      <div className="form-row form-row-2">
        <div className="form-group">
          <MdTextField type="number" label="Latitude (optional)" value={form.latitude||''}
            onChange={e=>set('latitude',e.target.value)} placeholder="e.g. 27.7172" step="any"/>
        </div>
        <div className="form-group">
          <MdTextField type="number" label="Longitude (optional)" value={form.longitude||''}
            onChange={e=>set('longitude',e.target.value)} placeholder="e.g. 85.3240" step="any"/>
        </div>
      </div>
      <div style={{fontSize:11, color:'var(--text3)', marginTop:-8, marginBottom:16}}>
        <span className="material-icons-round" style={{fontSize:14,verticalAlign:'middle',marginRight:4}}>lightbulb</span> From Google Maps: right-click your location → copy the coordinates shown at top, or copy from the URL.
      </div>
      <div className="form-row form-row-3">
        <div className="form-group">
          <MdSelect label="Institute type" value={form.type} onChange={e=>set('type',e.target.value)}>
            {INSTITUTE_TYPES.map(t=><MdOption key={t} value={t}>{t}</MdOption>)}
          </MdSelect>
        </div>
        <div className="form-group">
          <MdSelect label="Status" value={form.status} onChange={e=>set('status',e.target.value)}>
            {INSTITUTE_STATUSES.map(s=><MdOption key={s} value={s}>{s}</MdOption>)}
          </MdSelect>
        </div>
        <div className="form-group">
          <MdTextField label="Renewal due date" value={form.renewalDue}
            onChange={e=>set('renewalDue',e.target.value)} placeholder="YYYY/MM/DD"/>
        </div>
      </div>
      <div className="form-group">
        <MdTextField type="textarea" label="Remarks" value={form.remarks}
          onChange={e=>set('remarks',e.target.value)} rows={2}/>
      </div>

      {/* Per-firm auto-fill templates. Assigning a different variation to each
          firm keeps two firms bidding the same tender from submitting visibly
          identical prose. Drives the Auto-fill buttons on the assignment form. */}
      {canSetTemplates && (
        <div style={{marginBottom:16}}>
          <button type="button" onClick={()=>setShowTpl(s=>!s)}
            style={{width:'100%', background:'none', border:'1px solid var(--border)', cursor:'pointer',
              borderRadius: showTpl ? 'var(--radius) var(--radius) 0 0' : 'var(--radius)',
              padding:'10px 14px', display:'flex', alignItems:'center', justifyContent:'space-between',
              fontFamily:'var(--font)'}}>
            <span style={{fontSize:13, fontWeight:600, display:'flex', alignItems:'center', gap:6}}>
              <span className="material-icons-round" style={{fontSize:16}}>auto_awesome</span>
              Auto-fill templates
            </span>
            <span style={{fontSize:11, color:'var(--text3)'}}>
              {showTpl ? <><span className="material-icons-round" style={{fontSize:15, verticalAlign:'middle', marginRight:4}}>expand_less</span>Hide</> : <><span className="material-icons-round" style={{fontSize:15, verticalAlign:'middle', marginRight:4}}>expand_more</span>Show — wording used by this firm\u2019s assignments</>}
            </span>
          </button>
          {showTpl && (
            <div style={{padding:14, border:'1px solid var(--border)', borderTop:'none',
              borderRadius:'0 0 var(--radius) var(--radius)'}}>
              {[
                { key:'descTemplateId',      label:'3(A) Description of work carried out', variations: DESCRIPTION_VARIATIONS },
                { key:'narrativeTemplateId', label:'3(B) Narrative description of project', variations: NARRATIVE_VARIATIONS },
                { key:'servicesTemplateId',  label:'3(B) Description of actual services provided', variations: SERVICES_VARIATIONS },
              ].map((slot, i, arr) => {
                const chosen = slot.variations.find(v => v.id === form[slot.key]);
                return (
                  <div key={slot.key} style={{marginBottom: i < arr.length-1 ? 16 : 0}}>
                    <MdSelect label={slot.label} value={form[slot.key] || ''}
                      onChange={e=>set(slot.key, e.target.value)}>
                      <MdOption value="">— No template —</MdOption>
                      {slot.variations.map(v => <MdOption key={v.id} value={v.id}>{v.label}</MdOption>)}
                    </MdSelect>
                    {chosen && (
                      <div style={{fontSize:11, color:'var(--text2)', background:'var(--bg2)',
                        border:'1px solid var(--border)', borderRadius:'var(--radius)',
                        padding:'7px 10px', marginTop:6, fontStyle:'italic',
                        whiteSpace:'pre-wrap', lineHeight:1.5}}>
                        {chosen.preview.length > 240 ? chosen.preview.slice(0,240) + '…' : chosen.preview}
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="input-hint" style={{marginTop:10}}>
                Placeholders in braces are replaced with this firm\u2019s own assignment data when the Auto-fill button is used.
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bolpatra / Standard EOI — Section 2 (Applicant's Information Form) */}
      <div style={{marginBottom:16}}>
        <button type="button" onClick={()=>setShowEoi(s=>!s)}
          style={{width:'100%', background:'none', border:'1px solid var(--border)', cursor:'pointer',
            borderRadius: showEoi ? 'var(--radius) var(--radius) 0 0' : 'var(--radius)',
            padding:'10px 14px', display:'flex', alignItems:'center', justifyContent:'space-between',
            fontFamily:'var(--font)'}}>
          <span style={{fontSize:13, fontWeight:600, display:'flex', alignItems:'center', gap:6}}>
            <span className="material-icons-round" style={{fontSize:16}}>business</span>
            EOI / Bolpatra profile
          </span>
          <span style={{fontSize:11, color:'var(--text3)'}}>
            {showEoi ? <><span className="material-icons-round" style={{fontSize:15, verticalAlign:'middle', marginRight:4}}>expand_less</span>Hide</> : <><span className="material-icons-round" style={{fontSize:15, verticalAlign:'middle', marginRight:4}}>expand_more</span>Show — used in the Applicant's Information Form</>}
          </span>
        </button>
        {showEoi && (
          <div style={{padding:14, border:'1px solid var(--border)', borderTop:'none',
            borderRadius:'0 0 var(--radius) var(--radius)'}}>
            <div className="form-row form-row-2">
              <div className="form-group">
                <MdSelect label="Type of constitution" value={form.constitutionType||''}
                  onChange={e=>set('constitutionType',e.target.value)}>
                  <MdOption value="">—</MdOption>
                  {CONSTITUTION_TYPES.map(t => <MdOption key={t} value={t}>{t}</MdOption>)}
                </MdSelect>
              </div>
              <div className="form-group">
                <MdTextField label="Fax number" value={form.fax||''}
                  onChange={e=>set('fax',e.target.value)} placeholder="Optional"/>
              </div>
            </div>
            <div className="form-row form-row-2">
              <div className="form-group">
                <MdTextField label="Contact person designation" value={form.contactDesignation||''}
                  onChange={e=>set('contactDesignation',e.target.value)} placeholder="e.g. Managing Director"/>
              </div>
              <div className="form-group">
                <MdTextField label="Authorized local agent" value={form.localAgent||''}
                  onChange={e=>set('localAgent',e.target.value)} placeholder="Name / address / telephone"/>
              </div>
            </div>
            <div className="form-row form-row-2">
              <div className="form-group">
                <MdTextField type="number" label="Total number of staff" value={form.totalStaff||''}
                  onChange={e=>set('totalStaff',e.target.value)} placeholder="e.g. 45"/>
              </div>
              <div className="form-group">
                <MdTextField type="number" label="Regular professional staff" value={form.professionalStaff||''}
                  onChange={e=>set('professionalStaff',e.target.value)} placeholder="e.g. 12"/>
              </div>
            </div>
            <div className="form-group">
              <MdTextField type="textarea" label="Consultant's organization / company profile"
                value={form.orgProfile||''} onChange={e=>set('orgProfile',e.target.value)} rows={4}
                placeholder="Background and organization of the consultant"/>
            </div>

            {/* Drives the "Name of Senior Staff and Designation ... Involved
                and Functions Performed" field on every assignment's 3(B) —
                auto-written from this roster the same way the templates above
                write the three narrative fields. */}
            <div className="form-group" style={{marginBottom:0}}>
              <label style={{fontSize:12, fontWeight:500, color:'var(--text2)', display:'block', marginBottom:6}}>
                Key staff (Project Director, Team Leader, etc.)
              </label>
              {(form.keyStaff||[]).length > 0 && (
                <div style={{display:'flex', flexDirection:'column', gap:8, marginBottom:8}}>
                  {form.keyStaff.map((s, i) => (
                    <div key={i} style={{display:'flex', gap:8, alignItems:'center'}}>
                      <input className="form-input" style={{flex:1}} placeholder="Name"
                        value={s.name||''} onChange={e=>updateKeyStaff(i,'name',e.target.value)}/>
                      <input className="form-input" style={{flex:1}} placeholder="Position — e.g. Team Leader"
                        value={s.position||''} onChange={e=>updateKeyStaff(i,'position',e.target.value)}/>
                      <button type="button" onClick={()=>removeKeyStaff(i)} aria-label={`Remove ${s.name || 'staff member'}`}
                        style={{background:'none', border:'none', cursor:'pointer', color:'var(--text3)', padding:4, flexShrink:0}}>
                        <span className="material-icons-round" style={{fontSize:18}}>close</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button type="button" onClick={addKeyStaff}
                style={{display:'flex', alignItems:'center', gap:4, fontSize:12, fontWeight:600, color:'var(--accent)',
                  background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:'var(--font)'}}>
                <span className="material-icons-round" style={{fontSize:15}}>add</span> Add staff member
              </button>
              <div className="input-hint" style={{marginTop:6}}>
                Used to auto-fill the senior-staff field on each assignment&rsquo;s EOI details when left blank.
              </div>
            </div>
          </div>
        )}
      </div>
      {isSuperAdmin && (
        <div style={{
          display:'flex', alignItems:'flex-start', gap:14,
          padding:'14px 16px', borderRadius:12,
          background: form.isShortlistingOnly ? 'var(--warning-light)' : 'var(--bg)',
          border: `1px solid ${form.isShortlistingOnly ? 'rgba(255,174,31,.35)' : 'var(--border)'}`,
          transition:'background .15s, border-color .15s', marginBottom:4,
        }}>
          <MdToggle
            selected={form.isShortlistingOnly}
            onChange={e=>set('isShortlistingOnly',e.target.selected)}
            style={{flexShrink:0, marginTop:2}}
          />
          <div>
            <div style={{fontWeight:600, fontSize:13.5, color:'var(--text)'}}>Shortlisting Only</div>
            <div style={{fontSize:12, color:'var(--text3)', marginTop:2}}>
              This firm will only be visible in the Shortlisting section — hidden from the main Institutes list for all non-superadmin users.
            </div>
          </div>
        </div>
      )}
      <ErrorBanner msg={err} onDismiss={()=>setErr('')}/>
    </Modal>
    </>
  );
}
export default InstituteForm;

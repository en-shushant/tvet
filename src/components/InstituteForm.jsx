import { useState } from 'react';
import Modal from './ui/Modal.jsx';
import { ErrorBanner } from './ui/Modal.jsx';
import { INSTITUTE_TYPES, INSTITUTE_STATUSES } from '../constants/data.js';

function InstituteForm({institute, onSave, onClose}) {
  const [form, setForm] = useState(institute || {
    name:'', acronym:'', regNo:'', regDate:'', pan:'', permanentAccountNo:'',
    contactPerson:'', phone:'', email:'', address:'',
    type:'Private', status:'Active', renewalDue:'', remarks:'', logo:null, website:'', googleMapLink:'', latitude:'', longitude:''
  });

  const set = (k, v) => setForm(f => ({...f, [k]: v}));
  const [err, setErr] = useState('');
  const handleSave = () => {
    if(!form.name.trim()) { setErr('Institute name is required.'); return; }
    if(!form.regNo.trim()) { setErr('Registration number is required.'); return; }
    onSave(form);
  };

  return (
    <Modal title={institute ? 'Edit Institute Profile' : 'Add New Institute'} onClose={onClose} size="modal-lg"
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave}>
          {institute ? 'Save changes' : 'Add institute'}
        </button>
      </>}>
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
            <span className="btn btn-secondary btn-sm">{form.logo ? '🔄 Change logo' : '📷 Upload logo'}</span>
          </label>
          {form.logo && <span className="btn btn-ghost btn-sm" style={{cursor:'pointer'}} onClick={()=>set('logo',null)}>✕ Remove</span>}
        </div>
        <div className="input-hint">PNG or JPG shown on the institute card. Max ~500 KB recommended.</div>
      </div>
      <div className="form-row form-row-2">
        <div className="form-group">
          <label>Institute name *</label>
          <input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="Full official name"/>
        </div>
        <div className="form-group">
          <label>Acronym / Short name *</label>
          <input value={form.acronym||''} onChange={e=>set('acronym',e.target.value)} placeholder="e.g. WLTTI, NVA"/>
          <div className="input-hint">Used in reports and comparison view</div>
        </div>
      </div>
      <div className="form-row form-row-2">
        <div className="form-group">
          <label>Registration number *</label>
          <input value={form.regNo} onChange={e=>set('regNo',e.target.value)} placeholder="e.g. XYZ/001/2065"/>
        </div>
      </div>
      <div className="form-row form-row-2">
        <div className="form-group">
          <label>Registration date</label>
          <input value={form.regDate} onChange={e=>set('regDate',e.target.value)} placeholder="YYYY/MM/DD"/>
        </div>
        <div className="form-group">
          <label>PAN / VAT <span style={{fontWeight:400, color:'var(--text3)'}}>(Sthayee Lekha no.)</span></label>
          <input value={form.pan} onChange={e=>set('pan',e.target.value)} placeholder="9-digit PAN"/>
        </div>
      </div>
      <div className="form-row form-row-3">
        <div className="form-group">
          <label>Contact person</label>
          <input value={form.contactPerson} onChange={e=>set('contactPerson',e.target.value)}/>
        </div>
        <div className="form-group">
          <label>Phone</label>
          <input value={form.phone} onChange={e=>set('phone',e.target.value)}/>
        </div>
        <div className="form-group">
          <label>Email</label>
          <input type="email" value={form.email} onChange={e=>set('email',e.target.value)}/>
        </div>
      </div>
      <div className="form-group">
        <label>Address</label>
        <input value={form.address} onChange={e=>set('address',e.target.value)} placeholder="Full address"/>
      </div>
      <div className="form-group">
        <label>Website <span style={{fontWeight:400, color:'var(--text3)'}}>(optional)</span></label>
        <input value={form.website||''} onChange={e=>set('website',e.target.value)} placeholder="https://www.example.com"/>
      </div>
      <div className="form-group">
        <label>Google Maps Link <span style={{fontWeight:400, color:'var(--text3)'}}>(optional — paste the share link for exact location)</span></label>
        <input value={form.googleMapLink||''} onChange={e=>set('googleMapLink',e.target.value)} placeholder="https://maps.app.goo.gl/..."/>
      </div>
      <div className="form-row form-row-2">
        <div className="form-group">
          <label>Latitude <span style={{fontWeight:400, color:'var(--text3)'}}>(optional)</span></label>
          <input type="number" step="any" value={form.latitude||''} onChange={e=>set('latitude',e.target.value)} placeholder="e.g. 27.7172"/>
        </div>
        <div className="form-group">
          <label>Longitude <span style={{fontWeight:400, color:'var(--text3)'}}>(optional)</span></label>
          <input type="number" step="any" value={form.longitude||''} onChange={e=>set('longitude',e.target.value)} placeholder="e.g. 85.3240"/>
        </div>
      </div>
      <div style={{fontSize:11, color:'var(--text3)', marginTop:-8, marginBottom:4}}>
        💡 From Google Maps: right-click your location → the coordinates shown at top can be copied. Or open the Google Maps link above and copy from the URL.
      </div>
      <div className="form-row form-row-3">
        <div className="form-group">
          <label>Institute type</label>
          <select value={form.type} onChange={e=>set('type',e.target.value)}>
            {INSTITUTE_TYPES.map(t=><option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Status</label>
          <select value={form.status} onChange={e=>set('status',e.target.value)}>
            {INSTITUTE_STATUSES.map(s=><option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Renewal due date</label>
          <input value={form.renewalDue} onChange={e=>set('renewalDue',e.target.value)} placeholder="YYYY/MM/DD"/>
        </div>
      </div>
      <div className="form-group">
        <label>Remarks</label>
        <textarea value={form.remarks} onChange={e=>set('remarks',e.target.value)} rows={2}/>
      </div>
      <ErrorBanner msg={err} onDismiss={()=>setErr('')}/>
    </Modal>
  );
}
export default InstituteForm;

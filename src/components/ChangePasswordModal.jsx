import { useState } from 'react';
import Modal from './ui/Modal.jsx';
import { ErrorBanner } from './ui/Modal.jsx';
import { api } from '../utils/api.js';
import { getSession } from '../utils/auth.js';
import { Btn, MdTextField } from '../md.jsx';

function ChangePasswordModal({ onClose }) {
  const token = getSession()?.token;
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [err, setErr] = useState('');
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const handleSave = async () => {
    if (!form.current) return setErr('Enter your current password.');
    if (form.next.length < 6) return setErr('New password must be at least 6 characters.');
    if (form.next !== form.confirm) return setErr('New passwords do not match.');
    setSaving(true); setErr('');
    try {
      await api('PUT', '/auth/password', { current_password: form.current, new_password: form.next }, token);
      setSuccess(true);
    } catch(e) { setErr(e.message || 'Failed to change password'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title="Change Password" onClose={onClose}
      footer={!success && <>
        <Btn className="btn btn-secondary" onClick={onClose}>Cancel</Btn>
        <Btn className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Change Password'}
        </Btn>
      </>}>
      {success ? (
        <div style={{textAlign:'center', padding:'24px 0'}}>
          <span className="material-icons-round" style={{fontSize:48, color:'var(--success)'}}>check_circle</span>
          <div style={{fontWeight:600, marginTop:12, marginBottom:16}}>Password changed!</div>
          <Btn className="btn btn-primary" onClick={onClose}>Done</Btn>
        </div>
      ) : (
        <>
          <div className="form-group">
            <MdTextField type="password" label="Current password" autoFocus
              value={form.current} onChange={e=>set('current',e.target.value)}/>
          </div>
          <div className="form-group">
            <MdTextField type="password" label="New password"
              value={form.next} onChange={e=>set('next',e.target.value)}
              supporting-text="At least 6 characters"/>
          </div>
          <div className="form-group">
            <MdTextField type="password" label="Confirm new password"
              value={form.confirm} onChange={e=>set('confirm',e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&handleSave()}/>
          </div>
          <ErrorBanner msg={err} onDismiss={()=>setErr('')}/>
        </>
      )}
    </Modal>
  );
}
export default ChangePasswordModal;

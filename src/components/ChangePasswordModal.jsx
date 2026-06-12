import { useState } from 'react';
import ReactDOM from 'react-dom';
import Modal from './ui/Modal.jsx';
import { ErrorBanner } from './ui/Modal.jsx';
import { api } from '../utils/api.js';
import { getSession } from '../utils/auth.js';

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
  return ReactDOM.createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:400}} onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Change Password</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{padding:'20px 24px 24px'}}>
          {success ? (
            <div style={{textAlign:'center',padding:'16px 0'}}>
              <span className="material-icons-round" style={{fontSize:48,color:'var(--success)'}}>check_circle</span>
              <div style={{fontWeight:600,marginTop:12,marginBottom:8}}>Password changed!</div>
              <button className="btn btn-primary" onClick={onClose}>Done</button>
            </div>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label">Current password</label>
                <input className="form-input" type="password" autoFocus value={form.current} onChange={e=>set('current',e.target.value)} placeholder="Current password"/>
              </div>
              <div className="form-group">
                <label className="form-label">New password</label>
                <input className="form-input" type="password" value={form.next} onChange={e=>set('next',e.target.value)} placeholder="At least 6 characters"/>
              </div>
              <div className="form-group">
                <label className="form-label">Confirm new password</label>
                <input className="form-input" type="password" value={form.confirm} onChange={e=>set('confirm',e.target.value)} placeholder="Repeat new password"
                  onKeyDown={e=>e.key==='Enter'&&handleSave()}/>
              </div>
              {err && <div style={{color:'var(--error)',fontSize:12,marginBottom:10}}>{err}</div>}
              <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?'Saving…':'Change Password'}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>, document.body
  );
}
export default ChangePasswordModal;

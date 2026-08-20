import { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import Modal from './ui/Modal.jsx';
import { ErrorBanner } from './ui/Modal.jsx';
import { Btn, MdTextField, MdSelect, MdOption } from '../md.jsx';
import SearchableSelect from './ui/SearchableSelect.jsx';
import { api, normInst, clientToAPI, normClient } from '../utils/api.js';
import { API_URL_KEY, getApiBase } from '../utils/api.js';
import { getSession, setSession, clearSession, loadUsers, saveUsers } from '../utils/auth.js';
import { INSTITUTE_TYPES, OCCUPATIONS } from '../constants/data.js';
import { confirmDialog } from './ui/Feedback.jsx';
import { initialsFor, tintFor } from './ui/primitives.jsx';

function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [capToken, setCapToken] = useState('');
  const [widgetKey, setWidgetKey] = useState(0);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const turnstileRef = useRef(null);
  const turnstileIdRef = useRef(undefined);
  const [showSettings, setShowSettings] = useState(false);
  const [apiUrl, setApiUrl] = useState(() => {
    try { return localStorage.getItem(API_URL_KEY) || ''; } catch { return ''; }
  });

  useEffect(() => {
    if (turnstileIdRef.current !== undefined && window.turnstile) {
      try { window.turnstile.remove(turnstileIdRef.current); } catch {}
      turnstileIdRef.current = undefined;
    }
    const render = () => {
      if (!window.turnstile || !turnstileRef.current) return;
      turnstileIdRef.current = window.turnstile.render(turnstileRef.current, {
        sitekey: '0x4AAAAAAD-IUm1QHVVxIjkr',
        action: 'turnstile-spin-v2',
        callback: (token) => setCapToken(token),
        'expired-callback': () => setCapToken(''),
        'error-callback': () => setCapToken(''),
      });
    };
    if (window.__turnstileReady) {
      render();
    } else {
      window.__turnstileCallbacks = window.__turnstileCallbacks || [];
      window.__turnstileCallbacks.push(render);
    }
    return () => {
      if (turnstileIdRef.current !== undefined && window.turnstile) {
        try { window.turnstile.remove(turnstileIdRef.current); } catch {}
      }
    };
  }, [widgetKey]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const emailVal = email.trim() || emailRef.current?.value?.trim() || '';
    const passwordVal = password || passwordRef.current?.value || '';
    if (!emailVal || !passwordVal) { setError('Email and password are required.'); return; }
    if (!capToken) { setError('Please complete the CAPTCHA verification.'); return; }
    setError('');
    setLoading(true);
    try {
      const data = await api('POST', '/auth/login', { email: emailVal, password: passwordVal, 'cf-turnstile-response': capToken });
      const session = {
        id: data.user.id,
        fullName: data.user.name,
        email: data.user.email,
        role: data.user.role,
        photo: data.user.photo || null,
        token: data.token,
      };
      setSession(session);
      onLogin(session);
    } catch (err) {
      setError(err.message || 'Invalid credentials.');
      // Token is single-use — remount widget so user can solve a fresh challenge
      setCapToken('');
      setWidgetKey(k => k + 1);
    } finally {
      setLoading(false);
    }
  };

  const saveApiUrl = () => {
    try {
      if (apiUrl.trim()) localStorage.setItem(API_URL_KEY, apiUrl.trim());
      else localStorage.removeItem(API_URL_KEY);
    } catch {}
    setShowSettings(false);
  };

  return (
    <div style={{minHeight:'100vh', display:'flex', fontFamily:'var(--font)', background:'var(--bg)'}}>
      {/* Left branding panel */}
      <div className="login-panel-left" style={{
        width:'45%', background:'var(--sidebar-bg)',
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        padding:'48px', position:'relative', overflow:'hidden',
        flexShrink:0,
      }}>
        {/* decorative circles */}
        <div style={{position:'absolute',top:-80,right:-80,width:320,height:320,borderRadius:'50%',background:'rgba(93,135,255,0.08)'}}/>
        <div style={{position:'absolute',bottom:-60,left:-60,width:240,height:240,borderRadius:'50%',background:'rgba(93,135,255,0.06)'}}/>
        <div style={{position:'relative',zIndex:1,textAlign:'center',maxWidth:340}}>
          <div style={{display:'flex',justifyContent:'center',marginBottom:28}}>
            <img src="/logo.png" alt="TVETtrack" style={{width:'100%',maxWidth:300,filter:'brightness(0) invert(1)'}}/>
          </div>
          <div style={{fontSize:14,color:'rgba(255,255,255,0.45)',lineHeight:1.7,marginBottom:40}}>
            Nepal's training institute compliance and performance registry system.
          </div>
          {[
            {icon:'fact_check', text:'License & tax compliance tracking'},
            {icon:'bar_chart', text:'Training performance analytics'},
            {icon:'account_balance', text:'CTEVT affiliation management'},
          ].map(f => (
            <div key={f.text} style={{display:'flex',alignItems:'center',gap:14,marginBottom:18,textAlign:'left'}}>
              <div style={{width:40,height:40,borderRadius:10,background:'rgba(93,135,255,0.18)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <span className="material-icons-round" style={{fontSize:20,color:'var(--primary)'}}>{f.icon}</span>
              </div>
              <span style={{fontSize:13.5,color:'rgba(255,255,255,0.6)',fontWeight:500}}>{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right login form */}
      <div className="login-panel-right" style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'48px 32px'}}>
        <div style={{width:'100%',maxWidth:420}}>
          <div style={{marginBottom:36}}>
            <div style={{fontSize:28,fontWeight:800,color:'var(--text)',letterSpacing:-0.5,marginBottom:8}}>Welcome back</div>
            <div style={{fontSize:14,color:'var(--text3)'}}>Sign in to your TVETtrack account</div>
          </div>
          <div style={{background:'var(--surface)',borderRadius:16,padding:'36px 40px',boxShadow:'var(--shadow-md)',border:'1px solid var(--border)'}}>
            <form onSubmit={handleSubmit}>
              <div style={{marginBottom:20}}>
                <MdTextField ref={emailRef} type="email" label="Email address" value={email}
                  onChange={e=>setEmail(e.target.value)}
                  placeholder="you@organization.com" autoFocus required style={{width:'100%'}}/>
              </div>
              <div style={{marginBottom:20}}>
                <MdTextField ref={passwordRef} type="password" label="Password" value={password}
                  onChange={e=>setPassword(e.target.value)}
                  placeholder="Enter your password" required style={{width:'100%'}}/>
              </div>
              <div style={{marginBottom:20}}>
                <div ref={turnstileRef} />
              </div>
              {error && (
                <div style={{background:'var(--error-light)',color:'var(--error)',border:'1px solid rgba(250,137,107,0.3)',borderRadius:10,padding:'11px 15px',fontSize:13,marginBottom:20,display:'flex',alignItems:'center',gap:8}}>
                  <span className="material-icons-round" style={{fontSize:16}}>error_outline</span>
                  {error}
                </div>
              )}
              <Btn type="submit" className="btn btn-primary" disabled={loading}
                style={{width:'100%',justifyContent:'center',padding:'12px',fontSize:14.5}}>
                {loading
                  ? <><span className="material-icons-round" style={{fontSize:16,animation:'spin 1s linear infinite'}}>refresh</span> Signing in…</>
                  : <><span className="material-icons-round" style={{fontSize:16}}>login</span> Sign In</>}
              </Btn>
            </form>
          </div>
          <div style={{textAlign:'center',marginTop:24,fontSize:12,color:'var(--text3)'}}>
            © {new Date().getFullYear()} TVETtrack · Nepal TVET Registry
          </div>
        </div>
      </div>
    </div>
  );
}

function AssignFirmsModal({ user, institutes, onSave, onClose }) {
  const token = getSession()?.token;
  const [assignedIds, setAssignedIds] = useState([]);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    api('GET', `/users/${user.id}/institutes`, null, token)
      .then(ids => setAssignedIds(ids.map(id => parseInt(id))))
      .catch(() => {});
  }, []);

  const sorted = useMemo(() => [...(institutes||[])].sort((a,b)=>a.name.localeCompare(b.name)), [institutes]);
  const filtered = sorted.filter(i => {
    const q = search.toLowerCase();
    return !q || i.name.toLowerCase().includes(q) || (i.acronym||'').toLowerCase().includes(q);
  });

  const toggle = (id) => setAssignedIds(prev => prev.includes(id) ? prev.filter(x=>x!==id) : [...prev, id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api('PUT', `/users/${user.id}/institutes`, { institute_ids: assignedIds }, token);
      onSave(assignedIds);
    } catch(e) {
      setErr(e.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  return ReactDOM.createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth:480}} onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Assign firms — {user.name}</div>
          <Btn className="btn btn-ghost btn-sm" onClick={onClose}><span className="material-icons-round" style={{fontSize:16}}>close</span></Btn>
        </div>
        <div style={{padding:'16px 24px 24px'}}>
          <div className="search-wrap" style={{marginBottom:12}}>
            <span className="search-icon material-icons-round" style={{fontSize:16}}>search</span>
            <input className="search-input" placeholder="Search firms…" value={search} autoFocus
              onChange={e=>setSearch(e.target.value)}/>
          </div>
          <div style={{maxHeight:320,overflowY:'auto',border:'1px solid var(--border)',borderRadius:8}}>
            {filtered.length === 0
              ? <div style={{padding:'12px 16px',color:'var(--text3)',fontSize:13}}>No firms found</div>
              : filtered.map(inst => {
                const checked = assignedIds.includes(inst.id);
                return (
                  <label key={inst.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 14px',cursor:'pointer',
                    borderBottom:'1px solid var(--border)',background:checked?'color-mix(in srgb, var(--primary) 8%, transparent)':'transparent'}}>
                    <input type="checkbox" checked={checked} onChange={()=>toggle(inst.id)}
                      style={{width:'auto',padding:0,border:'none',background:'none',flexShrink:0,accentColor:'var(--primary)'}}/>
                    {inst.acronym && <span style={{fontWeight:700,fontSize:12,color:'var(--primary)',minWidth:52,fontFamily:'var(--font-mono)'}}>{inst.acronym}</span>}
                    <span style={{fontSize:13,color:'var(--text)'}}>{inst.name}</span>
                  </label>
                );
              })
            }
          </div>
          <div style={{fontSize:12,color:'var(--text3)',marginTop:8}}>{assignedIds.length} firm{assignedIds.length!==1?'s':''} selected</div>
          {err && <div style={{color:'var(--error)',fontSize:12,marginTop:6}}>{err}</div>}
          <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:16}}>
            <Btn className="btn btn-secondary" onClick={onClose}>Cancel</Btn>
            <Btn className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving?'Saving…':'Save'}</Btn>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function UserModal({ user, institutes, isSuperAdmin, onSave, onClose }) {
  const token = getSession()?.token;
  const isEdit = !!user;
  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    password: '',
    role: user?.role || 'viewer',
    is_active: user?.is_active !== false,
    photo: user?.photo || null,
  });
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name.trim() || !form.email.trim()) return setErr('Name and email are required.');
    if (!isEdit && !form.password.trim()) return setErr('Password is required.');
    setSaving(true);
    try {
      if (isEdit) {
        await api('PUT', `/users/${user.id}`, form, token);
      } else {
        await api('POST', '/users', form, token);
      }
      onSave();
    } catch(e) {
      setErr(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return ReactDOM.createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{isEdit ? 'Edit user' : 'Add user'}</div>
          <Btn className="btn btn-ghost btn-sm" onClick={onClose}><span className="material-icons-round" style={{fontSize:16}}>close</span></Btn>
        </div>
        <div style={{ padding: '20px 24px 24px' }}>
          <div style={{display:'flex', alignItems:'center', gap:16, marginBottom:16}}>
            <div style={{position:'relative'}}>
              {form.photo
                ? <img src={form.photo} alt="" style={{width:60,height:60,borderRadius:'50%',objectFit:'cover',border:'2px solid var(--border)'}}/>
                : <div style={{width:60,height:60,borderRadius:'50%',background:`var(${tintFor(form.name || '')})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,fontWeight:600,color:'var(--text)'}}>
                    {form.name ? initialsFor(form.name) : '?'}
                  </div>
              }
            </div>
            <div>
              <label style={{cursor:'pointer'}}>
                <input type="file" accept="image/*" style={{display:'none'}} onChange={e=>{
                  const file=e.target.files[0]; if(!file) return;
                  const reader=new FileReader();
                  reader.onload=ev=>setForm(f=>({...f,photo:ev.target.result}));
                  reader.readAsDataURL(file);
                }}/>
                <span className="btn btn-secondary btn-sm"><span className="material-icons-round" style={{fontSize:14,verticalAlign:'middle',marginRight:4}}>photo_camera</span>{form.photo?'Change photo':'Upload photo'}</span>
              </label>
              {form.photo && <span className="btn btn-ghost btn-sm" style={{cursor:'pointer',marginLeft:6}} onClick={()=>setForm(f=>({...f,photo:null}))}><span className="material-icons-round" style={{fontSize:14,verticalAlign:'middle',marginRight:4}}>close</span>Remove</span>}
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <MdTextField label="Full name" value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder="Full name"/>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <MdTextField label="Email" value={form.email} onChange={e => setForm(f=>({...f,email:e.target.value}))} placeholder="email@example.com" disabled={isEdit}/>
            </div>
            <div className="form-group">
              <MdSelect label="Role" value={form.role} onChange={e => setForm(f=>({...f,role:e.target.value}))}>
                {isSuperAdmin && <MdOption value="superadmin">Superadmin</MdOption>}
                {isSuperAdmin && <MdOption value="admin">Admin</MdOption>}
                <MdOption value="editor">Editor</MdOption>
                <MdOption value="viewer">Viewer</MdOption>
                <MdOption value="shortlist">Shortlist</MdOption>
              </MdSelect>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <MdTextField type="password" label={isEdit ? 'New password (leave blank to keep)' : 'Password'} value={form.password} onChange={e => setForm(f=>({...f,password:e.target.value}))} placeholder={isEdit ? 'Leave blank to keep' : 'Password'}/>
            </div>
          </div>
          {isEdit && (
            <div className="form-row">
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm(f=>({...f,is_active:e.target.checked}))} />
                  Account active
                </label>
              </div>
            </div>
          )}
          {err && <div style={{ color: 'var(--red)', fontSize: 12, margin: '8px 0' }}>{err}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
            <Btn className="btn btn-secondary" onClick={onClose}>Cancel</Btn>
            <Btn className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Btn>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function UserManagement({institutes, isSuperAdmin}) {
  const token = getSession()?.token;
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [assignModal, setAssignModal] = useState(null);
  const [search, setSearch] = useState('');
  const [userInstitutes, setUserInstitutes] = useState({});

  const loadUserInstitutes = (userList) => {
    const assignable = userList.filter(u => u.role === 'editor' || u.role === 'shortlist');
    assignable.forEach(u => {
      api('GET', `/users/${u.id}/institutes`, null, token)
        .then(ids => setUserInstitutes(prev => ({ ...prev, [u.id]: ids.map(id => parseInt(id)) })))
        .catch(() => {});
    });
  };

  const reload = () => {
    setLoading(true);
    api('GET', '/users', null, token)
      .then(rows => { setUsers(rows); setLoading(false); loadUserInstitutes(rows); })
      .catch(() => setLoading(false));
  };
  useEffect(reload, []);

  const roleBadge = (role) => {
    if (role === 'superadmin') return <span className="badge badge-purple"><span className="material-icons-round" style={{fontSize:12,verticalAlign:'middle',marginRight:3}}>admin_panel_settings</span>Superadmin</span>;
    if (role === 'admin') return <span className="badge badge-purple" style={{opacity:0.8}}><span className="material-icons-round" style={{fontSize:12,verticalAlign:'middle',marginRight:3}}>shield</span>Admin</span>;
    if (role === 'editor') return <span className="badge badge-active"><span className="material-icons-round" style={{fontSize:12,verticalAlign:'middle',marginRight:3}}>edit</span>Editor</span>;
    if (role === 'shortlist') return <span className="badge badge-warning"><span className="material-icons-round" style={{fontSize:12,verticalAlign:'middle',marginRight:3}}>checklist</span>Shortlist</span>;
    return <span className="badge badge-info"><span className="material-icons-round" style={{fontSize:12,verticalAlign:'middle',marginRight:3}}>visibility</span>Viewer</span>;
  };

  const [actionErr, setActionErr] = useState('');
  const toggleActive = async (u) => {
    setActionErr('');
    try {
      await api('PUT', `/users/${u.id}`, { name: u.name, email: u.email, role: u.role, is_active: !u.is_active, photo: u.photo || null }, token);
      reload();
    } catch(e) { setActionErr(e.message); }
  };

  const deleteUser = async (u) => {
    if (!await confirmDialog({ title:'Delete user', message:`${u.name} will be permanently deleted. This cannot be undone.`, confirmLabel:'Delete', danger:true })) return;
    setActionErr('');
    try {
      await api('DELETE', `/users/${u.id}`, null, token);
      reload();
    } catch(e) { setActionErr(e.message); }
  };

  const filtered = users.filter(u =>
    !search ||
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      {actionErr && <ErrorBanner msg={actionErr} onDismiss={()=>setActionErr('')}/>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div className="search-wrap" style={{ flex: 1, maxWidth: 300 }}>
          <span className="search-icon material-icons-round" style={{fontSize:16}}>search</span>
          <input className="search-input" placeholder="Search users…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Btn className="btn btn-primary btn-sm" onClick={() => setModal('add')}>+ Add user</Btn>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Email</th><th>Role</th><th>Assigned Firms</th><th>Status</th><th>Created</th><th></th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan="7" style={{textAlign:'center',padding:20,color:'var(--text3)'}}>Loading…</td></tr>
                : filtered.map(u => {
                const assignedInsts = (u.role === 'editor' || u.role === 'shortlist')
                  ? (userInstitutes[u.id] || []).map(id => institutes.find(i => i.id === id)).filter(Boolean)
                  : [];
                return (
                <tr key={u.id}>
                  <td>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      {u.photo
                        ? <img src={u.photo} alt="" style={{width:32,height:32,borderRadius:'50%',objectFit:'cover',flexShrink:0}}/>
                        : <div style={{width:32,height:32,borderRadius:'50%',background:`var(${tintFor(u.name)})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:600,color:'var(--text)',flexShrink:0}}>{initialsFor(u.name)}</div>
                      }
                      <span style={{fontWeight:500}}>{u.name}</span>
                    </div>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text2)' }}>{u.email}</td>
                  <td>{roleBadge(u.role)}</td>
                  <td>
                    {(u.role === 'editor' || u.role === 'shortlist') ? (
                      <div style={{display:'flex',flexWrap:'wrap',gap:4,alignItems:'center'}}>
                        {assignedInsts.length === 0
                          ? <span style={{fontSize:12,color:'var(--text3)'}}>None</span>
                          : assignedInsts.map(i => (
                              <span key={i.id} title={i.name} style={{fontSize:11,fontWeight:700,fontFamily:'var(--font-mono)',
                                background:'color-mix(in srgb, var(--primary) 12%, transparent)',
                                color:'var(--primary)',borderRadius:4,padding:'2px 6px'}}>
                                {i.acronym || i.name.slice(0,6)}
                              </span>
                            ))
                        }
                      </div>
                    ) : <span style={{color:'var(--text3)',fontSize:12}}>—</span>}
                  </td>
                  <td><span className={`badge ${u.is_active ? 'badge-active' : 'badge-gray'}`}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td style={{ color: 'var(--text3)', fontSize: 12 }}>{u.created_at?.slice(0,10)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      {(u.role === 'editor' || u.role === 'shortlist') && (
                        <Btn className="btn btn-secondary btn-sm" onClick={() => setAssignModal(u)}>
                          <span className="material-icons-round" style={{fontSize:13,verticalAlign:'middle',marginRight:3}}>business</span>
                          Assign Firms
                        </Btn>
                      )}
                      <Btn className="btn btn-ghost btn-sm" onClick={() => setModal(u)}>Edit</Btn>
                      <Btn className={`btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-secondary'}`}
                        onClick={() => toggleActive(u)}>
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </Btn>
                      {isSuperAdmin && <Btn className="btn btn-danger btn-sm" onClick={() => deleteUser(u)}><span className="material-icons-round" style={{fontSize:14}}>delete</span></Btn>}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {modal === 'add' && <UserModal institutes={institutes} isSuperAdmin={isSuperAdmin} onSave={()=>{setModal(null);reload();}} onClose={() => setModal(null)} />}
      {modal && modal !== 'add' && <UserModal user={modal} institutes={institutes} isSuperAdmin={isSuperAdmin} onSave={()=>{setModal(null);reload();}} onClose={() => setModal(null)} />}
      {assignModal && <AssignFirmsModal user={assignModal} institutes={institutes}
        onSave={(ids) => { setUserInstitutes(prev => ({...prev, [assignModal.id]: ids})); setAssignModal(null); }}
        onClose={() => setAssignModal(null)} />}
    </div>
  );
}

export { AssignFirmsModal, UserModal, UserManagement };
export default LoginPage;

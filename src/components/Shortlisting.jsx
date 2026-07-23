import { useState, useEffect, useMemo, useCallback } from 'react';
import Modal from './ui/Modal.jsx';
import { api } from '../utils/api.js';
import { getSession } from '../utils/auth.js';

const fmt = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';

function statusColor(s) {
  if (s === 'Active')  return { bg: 'var(--success-light)', color: '#0b9b85' };
  if (s === 'Expired') return { bg: 'var(--error-light)',   color: '#c0391e' };
  return { bg: 'var(--bg2)', color: 'var(--text3)' };
}

// ── Add/Edit Modal ─────────────────────────────────────────────────────────────
function ShortlistForm({ initial, institutes, clients, onSave, onClose, saving }) {
  const empty = {
    client_id: '', institute_id: '', standing_list_name: '',
    shortlist_date: '', valid_until: '', status: 'Active', remarks: '',
  };
  const [form, setForm] = useState(initial ? {
    client_id:          initial.client_id    ?? '',
    institute_id:       initial.institute_id ?? '',
    standing_list_name: initial.standing_list_name ?? '',
    shortlist_date:     initial.shortlist_date ? initial.shortlist_date.slice(0,10) : '',
    valid_until:        initial.valid_until   ? initial.valid_until.slice(0,10)     : '',
    status:             initial.status        ?? 'Active',
    remarks:            initial.remarks       ?? '',
  } : empty);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const [err, setErr] = useState('');

  const handleSave = async () => {
    if (!form.institute_id) return setErr('Please select a firm (institute).');
    if (!form.shortlist_date) return setErr('Shortlisting date is required.');
    setErr('');
    await onSave(form);
  };

  return (
    <Modal
      title={initial?.id ? 'Edit Shortlist Entry' : 'Add Shortlist Entry'}
      onClose={onClose}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : initial?.id ? 'Update' : 'Add'}
        </button>
      </>}
    >
      {err && <div style={{ background:'var(--error-light)', color:'#c0391e', borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:13 }}>{err}</div>}

      <div className="form-row form-row-2">
        <div className="form-group">
          <label>Organization (Client)</label>
          <select value={form.client_id} onChange={e => set('client_id', e.target.value)}>
            <option value="">— Select organization —</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.fullName || c.full_name}{c.shortName || c.short_name ? ` (${c.shortName || c.short_name})` : ''}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label>Firm (Institute) *</label>
          <select value={form.institute_id} onChange={e => set('institute_id', e.target.value)}>
            <option value="">— Select firm —</option>
            {institutes.map(i => <option key={i.id} value={i.id}>{i.acronym ? `[${i.acronym}] ` : ''}{i.name}</option>)}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label>Standing List Name</label>
        <input
          value={form.standing_list_name}
          onChange={e => set('standing_list_name', e.target.value)}
          placeholder="e.g. Roster of Firms 2024, ADB Consultants List…"
        />
      </div>

      <div className="form-row form-row-2">
        <div className="form-group">
          <label>Shortlisting Date *</label>
          <input type="date" value={form.shortlist_date} onChange={e => set('shortlist_date', e.target.value)} />
        </div>
        <div className="form-group">
          <label>Valid Until</label>
          <input type="date" value={form.valid_until} onChange={e => set('valid_until', e.target.value)} />
        </div>
      </div>

      <div className="form-row form-row-2">
        <div className="form-group">
          <label>Status</label>
          <select value={form.status} onChange={e => set('status', e.target.value)}>
            <option value="Active">Active</option>
            <option value="Expired">Expired</option>
            <option value="Pending">Pending</option>
          </select>
        </div>
        <div className="form-group">
          <label>Remarks</label>
          <input value={form.remarks} onChange={e => set('remarks', e.target.value)} placeholder="Optional notes" />
        </div>
      </div>
    </Modal>
  );
}

// ── Delete Confirm Modal ───────────────────────────────────────────────────────
function ConfirmModal({ message, onConfirm, onClose, saving }) {
  return (
    <Modal title="Confirm Delete" onClose={onClose} footer={<>
      <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
      <button className="btn btn-danger" onClick={onConfirm} disabled={saving}>{saving ? 'Deleting…' : 'Delete'}</button>
    </>}>
      <p style={{ margin:0, color:'var(--text2)' }}>{message}</p>
    </Modal>
  );
}

// ── Row ────────────────────────────────────────────────────────────────────────
function ShortlistRow({ row, idx, canEdit, isAdmin, onEdit, onDelete }) {
  const sc = statusColor(row.status);
  const altBg = idx % 2 === 1 ? 'var(--bg)' : 'var(--surface)';
  const hoverBg = idx % 2 === 1 ? 'var(--bg2)' : 'var(--bg)';
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:12, padding:'13px 20px',
      borderBottom:'1px solid var(--border)', background:altBg, transition:'background .12s',
    }}
      onMouseEnter={e => e.currentTarget.style.background = hoverBg}
      onMouseLeave={e => e.currentTarget.style.background = altBg}
    >
      {/* Firm name */}
      <div style={{flex:2, minWidth:0}}>
        <div style={{fontWeight:600, fontSize:13.5, color:'var(--text)'}}>
          {row.institute_acronym ? <span style={{color:'var(--text3)', fontWeight:500}}>[{row.institute_acronym}] </span> : null}
          {row.institute_name}
        </div>
        {row.standing_list_name && <div style={{fontSize:11.5, color:'var(--text3)', marginTop:2}}>{row.standing_list_name}</div>}
      </div>

      {/* Organization */}
      <div style={{flex:2, minWidth:0, fontSize:13, color:'var(--text2)'}}>
        {row.client_name
          ? <>{row.client_short ? <span style={{fontWeight:600}}>{row.client_short}</span> : null}
            {row.client_short && <span style={{color:'var(--text3)'}}> · </span>}
            {row.client_short ? <span style={{color:'var(--text3)'}}>{row.client_name}</span> : <span>{row.client_name}</span>}
          </>
          : <span style={{color:'var(--text3)', fontStyle:'italic'}}>No organization</span>
        }
      </div>

      {/* Date */}
      <div style={{width:110, fontSize:12.5, color:'var(--text3)', flexShrink:0}}>
        {fmt(row.shortlist_date)}
        {row.valid_until && <div style={{fontSize:11, marginTop:2}}>→ {fmt(row.valid_until)}</div>}
      </div>

      {/* Status */}
      <div style={{width:80, flexShrink:0}}>
        <span style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:100, ...sc }}>
          {row.status}
        </span>
      </div>

      {/* Remarks */}
      <div style={{flex:1, fontSize:12, color:'var(--text3)', minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>
        {row.remarks || ''}
      </div>

      {/* Actions */}
      <div style={{display:'flex', gap:2, flexShrink:0}}>
        {canEdit && (
          <button title="Edit" onClick={() => onEdit(row)}
            style={{width:30,height:30,borderRadius:50,border:'none',background:'transparent',color:'var(--text3)',cursor:'pointer',display:'inline-flex',alignItems:'center',justifyContent:'center'}}
            onMouseEnter={e=>{e.currentTarget.style.background='var(--bg2)';e.currentTarget.style.color='var(--text)';}}
            onMouseLeave={e=>{e.currentTarget.style.background='';e.currentTarget.style.color='var(--text3)';}}
          ><span className="material-icons-round" style={{fontSize:15}}>edit</span></button>
        )}
        {isAdmin && (
          <button title="Delete" onClick={() => onDelete(row)}
            style={{width:30,height:30,borderRadius:50,border:'none',background:'transparent',color:'var(--text3)',cursor:'pointer',display:'inline-flex',alignItems:'center',justifyContent:'center'}}
            onMouseEnter={e=>{e.currentTarget.style.background='var(--error-light)';e.currentTarget.style.color='var(--error)';}}
            onMouseLeave={e=>{e.currentTarget.style.background='';e.currentTarget.style.color='var(--text3)';}}
          ><span className="material-icons-round" style={{fontSize:15}}>delete</span></button>
        )}
      </div>
    </div>
  );
}

// ── Group header ───────────────────────────────────────────────────────────────
function GroupHeader({ label, sub, count, expanded, onToggle }) {
  return (
    <button onClick={onToggle} style={{
      width:'100%', display:'flex', alignItems:'center', gap:12,
      padding:'14px 20px', background:'var(--surface)', border:'none',
      cursor:'pointer', textAlign:'left', fontFamily:'inherit',
      borderBottom: expanded ? '1px solid var(--border)' : 'none',
      transition:'background .12s',
    }}
      onMouseEnter={e=>e.currentTarget.style.background='var(--bg)'}
      onMouseLeave={e=>e.currentTarget.style.background='var(--surface)'}
    >
      <span className="material-icons-round" style={{fontSize:16, color:'var(--text3)', flexShrink:0}}>
        {expanded ? 'expand_more' : 'chevron_right'}
      </span>
      <div style={{flex:1}}>
        <div style={{fontWeight:600, fontSize:13.5, color:'var(--text)'}}>{label}</div>
        {sub && <div style={{fontSize:11.5, color:'var(--text3)', marginTop:1}}>{sub}</div>}
      </div>
      <span style={{fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:100, background:'var(--primary-light)', color:'var(--primary-dark)', flexShrink:0}}>
        {count} {count === 1 ? 'entry' : 'entries'}
      </span>
    </button>
  );
}

// ── Table header row ───────────────────────────────────────────────────────────
function TableHead({ groupBy }) {
  return (
    <div style={{display:'flex', alignItems:'center', gap:12, padding:'9px 20px', background:'var(--bg)', borderBottom:'1px solid var(--border)'}}>
      <div style={{flex:2, fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.6px'}}>{groupBy === 'org' ? 'Firm' : 'Organization'}</div>
      <div style={{flex:2, fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.6px'}}>{groupBy === 'org' ? 'Organization' : 'Firm'}</div>
      <div style={{width:110, fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.6px', flexShrink:0}}>Date / Validity</div>
      <div style={{width:80, fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.6px', flexShrink:0}}>Status</div>
      <div style={{flex:1, fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.6px'}}>Remarks</div>
      <div style={{width:70, flexShrink:0}}></div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Shortlisting({ institutes, clients, isAdmin, isEditor }) {
  const session = getSession();
  const token = session?.token;
  const canEdit = !!(isAdmin || isEditor);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(null); // {type:'add'|'edit'|'delete', data?}
  const [expanded, setExpanded] = useState({});
  const [groupBy, setGroupBy] = useState('org'); // 'org' | 'firm'
  const [filterOrg, setFilterOrg] = useState('');
  const [filterFirm, setFilterFirm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api('GET', '/shortlists', null, token);
      setRows(data);
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => rows.filter(r => {
    if (filterOrg    && String(r.client_id)    !== filterOrg)    return false;
    if (filterFirm   && String(r.institute_id) !== filterFirm)   return false;
    if (filterStatus && r.status !== filterStatus)               return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = [r.institute_name, r.institute_acronym, r.client_name, r.client_short, r.standing_list_name, r.remarks].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }), [rows, filterOrg, filterFirm, filterStatus, search]);

  // Group the filtered rows
  const grouped = useMemo(() => {
    const map = new Map();
    for (const row of filtered) {
      const key = groupBy === 'org'
        ? (row.client_id ? String(row.client_id) : '__none__')
        : String(row.institute_id);
      if (!map.has(key)) map.set(key, { label: '', sub: '', rows: [] });
      const g = map.get(key);
      if (groupBy === 'org') {
        g.label = row.client_name || 'No Organization';
        g.sub   = row.client_short || '';
      } else {
        g.label = row.institute_name || '—';
        g.sub   = row.institute_acronym || '';
      }
      g.rows.push(row);
    }
    return [...map.entries()].sort((a,b) => a[1].label.localeCompare(b[1].label));
  }, [filtered, groupBy]);

  const toggle = (key) => setExpanded(e => ({ ...e, [key]: !e[key] }));

  const handleSave = async (form) => {
    setSaving(true);
    try {
      if (modal?.data?.id) {
        await api('PUT', `/shortlists/${modal.data.id}`, form, token);
      } else {
        await api('POST', '/shortlists', form, token);
      }
      await load();
      setModal(null);
    } catch(e) { alert(e.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await api('DELETE', `/shortlists/${modal.data.id}`, null, token);
      await load();
      setModal(null);
    } catch(e) { alert(e.message || 'Delete failed'); }
    finally { setSaving(false); }
  };

  // Sort institutes alphabetically for the dropdown
  const sortedInstitutes = useMemo(() =>
    [...institutes].sort((a,b) => a.name.localeCompare(b.name)), [institutes]);

  return (
    <div className="fade-in" style={{display:'flex', flexDirection:'column', gap:20}}>

      {/* ── Header ── */}
      <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16, flexWrap:'wrap'}}>
        <div>
          <div style={{fontSize:22, fontWeight:600, color:'var(--text)', letterSpacing:-0.3}}>Shortlisting</div>
          <div style={{fontSize:13, color:'var(--text3)', marginTop:3}}>
            Track firms shortlisted for standing lists across organizations
          </div>
        </div>
        {canEdit && (
          <button className="btn btn-primary" onClick={() => setModal({ type:'add' })}>
            <span className="material-icons-round" style={{fontSize:16}}>add</span>
            Add Entry
          </button>
        )}
      </div>

      {/* ── Controls bar ── */}
      <div style={{
        background:'var(--surface)', borderRadius:16, padding:'14px 18px',
        boxShadow:'var(--shadow)', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap',
      }}>
        {/* Search */}
        <div className="search-wrap" style={{flex:1, minWidth:180}}>
          <span className="material-icons-round search-icon" style={{fontSize:18}}>search</span>
          <input
            placeholder="Search firm, organization, list name…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{paddingLeft:36}}
          />
        </div>

        {/* Filter: Org */}
        <select value={filterOrg} onChange={e => setFilterOrg(e.target.value)} style={{minWidth:160}}>
          <option value="">All organizations</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.shortName || c.short_name || c.fullName || c.full_name}</option>)}
        </select>

        {/* Filter: Firm */}
        <select value={filterFirm} onChange={e => setFilterFirm(e.target.value)} style={{minWidth:160}}>
          <option value="">All firms</option>
          {sortedInstitutes.map(i => <option key={i.id} value={i.id}>{i.acronym ? `[${i.acronym}] ` : ''}{i.name}</option>)}
        </select>

        {/* Filter: Status */}
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{minWidth:120}}>
          <option value="">All statuses</option>
          <option value="Active">Active</option>
          <option value="Expired">Expired</option>
          <option value="Pending">Pending</option>
        </select>

        <div style={{height:28, width:1, background:'var(--border)', flexShrink:0}}/>

        {/* Group by toggle */}
        <div style={{display:'flex', background:'var(--bg)', borderRadius:100, padding:3, gap:2, flexShrink:0}}>
          {[['org','By Organization'],['firm','By Firm']].map(([v,lbl]) => (
            <button key={v} onClick={() => setGroupBy(v)} style={{
              padding:'5px 14px', borderRadius:100, border:'none', cursor:'pointer',
              fontFamily:'inherit', fontSize:12.5, fontWeight:500, transition:'all .15s',
              background: groupBy===v ? 'var(--surface)' : 'transparent',
              color: groupBy===v ? 'var(--primary)' : 'var(--text3)',
              boxShadow: groupBy===v ? 'var(--shadow)' : 'none',
            }}>{lbl}</button>
          ))}
        </div>

        <div style={{fontSize:12, color:'var(--text3)', whiteSpace:'nowrap', flexShrink:0}}>
          {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
        </div>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div style={{textAlign:'center', padding:60, color:'var(--text3)'}}>
          <span className="spin material-icons-round" style={{fontSize:28}}>sync</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><span className="material-icons-round" style={{fontSize:44, opacity:.3}}>playlist_add_check</span></div>
          <div className="empty-state-title">No shortlist entries yet</div>
          <div className="empty-state-sub">{canEdit ? 'Click "Add Entry" to record a shortlisting.' : 'No records found.'}</div>
        </div>
      ) : (
        <div style={{display:'flex', flexDirection:'column', gap:10}}>
          {grouped.map(([key, group]) => {
            const isOpen = expanded[key] !== false; // default open
            return (
              <div key={key} style={{background:'var(--surface)', borderRadius:16, boxShadow:'var(--shadow)', overflow:'hidden'}}>
                <GroupHeader
                  label={group.label}
                  sub={group.sub || null}
                  count={group.rows.length}
                  expanded={isOpen}
                  onToggle={() => toggle(key)}
                />
                {isOpen && (
                  <>
                    <TableHead groupBy={groupBy} />
                    {group.rows.map((row, i) => (
                      <ShortlistRow
                        key={row.id} row={row} idx={i}
                        canEdit={canEdit} isAdmin={isAdmin}
                        onEdit={(r) => setModal({ type:'edit', data:r })}
                        onDelete={(r) => setModal({ type:'delete', data:r })}
                      />
                    ))}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modals ── */}
      {(modal?.type === 'add' || modal?.type === 'edit') && (
        <ShortlistForm
          initial={modal.data}
          institutes={sortedInstitutes}
          clients={clients}
          onSave={handleSave}
          onClose={() => setModal(null)}
          saving={saving}
        />
      )}
      {modal?.type === 'delete' && (
        <ConfirmModal
          message={`Delete this shortlist entry for "${modal.data.institute_name}"? This cannot be undone.`}
          onConfirm={handleDelete}
          onClose={() => setModal(null)}
          saving={saving}
        />
      )}
    </div>
  );
}

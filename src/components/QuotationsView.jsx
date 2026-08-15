/**
 * QuotationsView — sidebar screen for managing shortlisting and contracts
 * Two tabs: Shortlisting (table of all entries) + Contracts (all contracts + quotations)
 */
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Modal from './ui/Modal.jsx';
import { Btn, MdTextField, MdSelect, MdOption } from '../md.jsx';
import { api } from '../utils/api.js';
import { getSession } from '../utils/auth.js';
import { FISCAL_YEARS, getCurrentFY } from '../constants/data.js';
import { adToBS, bsToAD, BS_MONTHS, BS_DATA, toNpNum, BS_YEARS } from '../constants/nepali.js';
import { fmtDate } from '../utils/format.js';
import { toast } from './ui/Feedback.jsx';

const FYS = [...FISCAL_YEARS].reverse();
const QUOTE_STATUS = ['Quoted', 'Awarded', 'Rejected'];

// ── helpers ──────────────────────────────────────────────────────────────────
const npNum = n => String(n).split('').map(d => '०१२३४५६७८९'[+d] ?? d).join('');
const fmtNPR = v => v != null ? `NPR ${Number(v).toLocaleString()}` : '—';


function NepaliDatePicker({ label, value, onChange, required }) {
  const parsed = useMemo(() => {
    if (!value) return { y:'', m:'', d:'' };
    const [yr, mo, dy] = value.slice(0,10).split('-').map(Number);
    const bs = adToBS(new Date(Date.UTC(yr, mo-1, dy)));
    return { y: bs.y, m: bs.m, d: bs.d };
  }, [value]);

  const [sel, setSel] = useState(parsed);
  useEffect(() => { setSel(parsed); }, [value]);

  const monthLen = sel.y && sel.m ? (BS_DATA[sel.y]?.[sel.m-1] || 30) : 32;
  const days = Array.from({ length: monthLen }, (_, i) => i+1);

  const emit = (next) => {
    setSel(next);
    if (next.y && next.m && next.d) onChange(bsToAD(next.y, next.m, next.d));
  };
  const setY = v => emit({ y: Number(v), m: sel.m, d: Math.min(sel.d || 1, BS_DATA[Number(v)]?.[sel.m-1] || 30) });
  const setM = v => emit({ y: sel.y, m: Number(v), d: Math.min(sel.d || 1, BS_DATA[sel.y]?.[Number(v)-1] || 30) });
  const setD = v => emit({ y: sel.y, m: sel.m, d: Number(v) });

  const ss = { height:36, borderRadius:8, border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)', padding:'0 8px', fontSize:13, cursor:'pointer' };
  const preview = sel.y && sel.m && sel.d ? `${npNum(sel.d)} ${BS_MONTHS[sel.m-1]} ${npNum(sel.y)}` : '';

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      {label && <label style={{ fontSize:12.5, fontWeight:600, color:'var(--text2)' }}>{label}{required && ' *'}</label>}
      <div style={{ display:'flex', gap:6 }}>
        <select value={sel.y||''} onChange={e=>setY(e.target.value)} style={{...ss, flex:2}}>
          <option value=''>वर्ष</option>
          {BS_YEARS.map(y=><option key={y} value={y}>{npNum(y)}</option>)}
        </select>
        <select value={sel.m||''} onChange={e=>setM(e.target.value)} style={{...ss, flex:2}} disabled={!sel.y}>
          <option value=''>महिना</option>
          {BS_MONTHS.map((mn,i)=><option key={i+1} value={i+1}>{mn}</option>)}
        </select>
        <select value={sel.d||''} onChange={e=>setD(e.target.value)} style={{...ss, flex:1}} disabled={!sel.y||!sel.m}>
          <option value=''>गते</option>
          {days.map(d=><option key={d} value={d}>{npNum(d)}</option>)}
        </select>
      </div>
      {preview && <div style={{ fontSize:12, color:'var(--text3)' }}>{preview}</div>}
    </div>
  );
}

async function uploadFile(file, token) {
  const fd = new FormData(); fd.append('file', file);
  const res = await fetch('/api/upload', { method:'POST', headers:{ Authorization:`Bearer ${token}` }, body:fd });
  if (!res.ok) throw new Error('Upload failed');
  return (await res.json()).url;
}

function AgreementUpload({ value, onChange, token }) {
  const [uploading, setUploading] = useState(false);
  const handle = async e => {
    const file = e.target.files[0]; if (!file) return;
    e.target.value = ''; setUploading(true);
    try { onChange(await uploadFile(file, token)); } catch {}
    finally { setUploading(false); }
  };
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      {value && <a href={value} target="_blank" rel="noreferrer" style={{ fontSize:12, color:'var(--primary)', display:'flex', alignItems:'center', gap:3 }}><span className="material-icons-round" style={{fontSize:13}}>description</span>Agreement</a>}
      <label style={{ cursor: uploading ? 'wait' : 'pointer' }}>
        <input type="file" accept="image/*,application/pdf" style={{ display:'none' }} onChange={handle} disabled={uploading}/>
        <span className="btn btn-ghost btn-sm" style={{ fontSize:11 }}>{uploading ? 'Uploading…' : value ? 'Replace' : '+ Agreement'}</span>
      </label>
    </div>
  );
}

// ── Shortlisting tab ──────────────────────────────────────────────────────────
function ShortlistTab({ institutes, clients, isAdmin, canEdit, token }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterFY, setFilterFY] = useState('');
  const [filterOrg, setFilterOrg] = useState('');
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(null); // {type, data?}

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows(await api('GET', '/shortlists', null, token)); }
    catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const currentFY = getCurrentFY();

  const orgs = useMemo(() => {
    const seen = new Map();
    rows.forEach(r => {
      const k = r.client_id ? String(r.client_id) : (r.client_name_manual || '');
      const lbl = r.client_name || r.client_name_manual || '';
      if (k && !seen.has(k)) seen.set(k, lbl);
    });
    return [...seen.entries()].sort((a,b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filtered = useMemo(() => rows.filter(r => {
    if (filterFY && r.fy !== filterFY) return false;
    if (filterOrg) {
      const k = r.client_id ? String(r.client_id) : (r.client_name_manual || '');
      if (k !== filterOrg) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      if (!r.institute_name?.toLowerCase().includes(q) && !(r.client_name||'').toLowerCase().includes(q) && !(r.institute_acronym||'').toLowerCase().includes(q)) return false;
    }
    return true;
  }), [rows, filterFY, filterOrg, search]);

  const handleDelete = async () => {
    setSaving(true);
    try {
      await api('DELETE', `/shortlists/${modal.data.id}`, null, token);
      await load(); setModal(null);
    } catch(e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const sc = s => s === 'Active' ? {bg:'var(--success-light)',cl:'var(--success)'} : s === 'Expired' ? {bg:'var(--error-light)',cl:'var(--error)'} : {bg:'var(--warning-light)',cl:'#b45309'};

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center', marginBottom:16 }}>
        <div className="search-wrap" style={{ flex:1, minWidth:200 }}>
          <span className="material-icons-round search-icon" style={{fontSize:16}}>search</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search firm or org…"/>
        </div>
        <select value={filterFY} onChange={e=>setFilterFY(e.target.value)}
          style={{ height:38, borderRadius:8, border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)', padding:'0 10px', fontSize:13, cursor:'pointer' }}>
          <option value="">All FYs</option>
          {FYS.map(fy => <option key={fy} value={fy}>{fy}</option>)}
        </select>
        <select value={filterOrg} onChange={e=>setFilterOrg(e.target.value)}
          style={{ height:38, borderRadius:8, border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)', padding:'0 10px', fontSize:13, cursor:'pointer', maxWidth:220 }}>
          <option value="">All Orgs</option>
          {orgs.map(([k,lbl]) => <option key={k} value={k}>{lbl}</option>)}
        </select>
        <span style={{ fontSize:12, color:'var(--text3)', whiteSpace:'nowrap' }}>{filtered.length} entries</span>
        {canEdit && (
          <button onClick={() => setModal({type:'add'})}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 14px', borderRadius:8, border:'none', background:'var(--primary)', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:600 }}>
            <span className="material-icons-round" style={{fontSize:15}}>add</span> Add Entry
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card" style={{ overflow:'hidden', padding:0 }}>
        {/* Header */}
        <div style={{ display:'flex', gap:10, padding:'9px 16px', background:'var(--bg)', borderBottom:'1px solid var(--border)' }}>
          {['FIRM','ORGANIZATION','FY','DATE','STATUS','CONTRACT'].map((h,i) => (
            <div key={h} style={{ fontSize:10.5, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.5px',
              flex: i===0||i===1 ? 2 : i===5 ? 1.5 : 0, width: i===2?70:i===3?100:i===4?80:undefined, flexShrink:0 }}>
              {h}
            </div>
          ))}
          <div style={{ width:60, flexShrink:0 }}/>
        </div>

        {loading ? (
          <div style={{ padding:40, textAlign:'center', color:'var(--text3)' }}>
            <span className="spin material-icons-round" style={{fontSize:24}}>sync</span>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding:32, textAlign:'center', color:'var(--text3)', fontSize:13 }}>No entries match the filter.</div>
        ) : filtered.map((r,i) => {
          const c = sc(r.status);
          return (
            <div key={r.id} style={{ display:'flex', gap:10, alignItems:'center', padding:'11px 16px', borderBottom:'1px solid var(--border)', background: i%2===1?'var(--bg)':'var(--surface)' }}>
              {/* Firm */}
              <div style={{ flex:2, minWidth:0 }}>
                <div style={{ fontWeight:600, fontSize:13 }}>
                  {r.institute_acronym && <span style={{ color:'var(--text3)', fontWeight:500 }}>[{r.institute_acronym}] </span>}
                  {r.institute_name}
                </div>
              </div>
              {/* Org */}
              <div style={{ flex:2, fontSize:12.5, color:'var(--text2)', minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {r.client_short && <span style={{ fontWeight:600 }}>{r.client_short} · </span>}
                {r.client_name || r.client_name_manual || <span style={{ fontStyle:'italic', color:'var(--text3)' }}>—</span>}
              </div>
              {/* FY */}
              <div style={{ width:70, flexShrink:0 }}>
                <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:100, background:'var(--primary-light)', color:'var(--primary-dark)' }}>{r.fy||'—'}</span>
              </div>
              {/* Date */}
              <div style={{ width:100, fontSize:12, color:'var(--text3)', flexShrink:0 }}>{fmtDate(r.shortlist_date)}</div>
              {/* Status */}
              <div style={{ width:80, flexShrink:0 }}>
                <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:100, background:c.bg, color:c.cl }}>{r.status}</span>
              </div>
              {/* Contract */}
              <div style={{ flex:1.5, fontSize:12, minWidth:0 }}>
                {r.contract_amount === 0
                  ? <span style={{ color:'var(--success)', fontWeight:600 }}>Free</span>
                  : r.contract_amount != null
                    ? <span style={{ fontWeight:600 }}>{fmtNPR(r.contract_amount)}</span>
                    : <span style={{ color:'var(--text3)' }}>—</span>}
                {r.shortlist_doc && <a href={r.shortlist_doc} target="_blank" rel="noreferrer" style={{ display:'block', fontSize:11, color:'var(--primary)', marginTop:2 }}>
                  <span className="material-icons-round" style={{fontSize:12,verticalAlign:'middle'}}>receipt</span> Receipt
                </a>}
              </div>
              {/* Actions */}
              <div style={{ width:60, display:'flex', gap:2, justifyContent:'flex-end', flexShrink:0 }}>
                {canEdit && <button title="Edit" onClick={() => setModal({type:'edit', data:r})}
                  style={{ width:28,height:28,borderRadius:50,border:'none',background:'transparent',color:'var(--text3)',cursor:'pointer',display:'inline-flex',alignItems:'center',justifyContent:'center' }}
                  onMouseEnter={e=>{e.currentTarget.style.background='var(--bg2)';e.currentTarget.style.color='var(--text)';}}
                  onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='var(--text3)';}}>
                  <span className="material-icons-round" style={{fontSize:14}}>edit</span>
                </button>}
                {isAdmin && <button title="Delete" onClick={() => setModal({type:'delete', data:r})}
                  style={{ width:28,height:28,borderRadius:50,border:'none',background:'transparent',color:'var(--text3)',cursor:'pointer',display:'inline-flex',alignItems:'center',justifyContent:'center' }}
                  onMouseEnter={e=>{e.currentTarget.style.background='var(--error-light)';e.currentTarget.style.color='var(--error)';}}
                  onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='var(--text3)';}}>
                  <span className="material-icons-round" style={{fontSize:14}}>delete</span>
                </button>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modals */}
      {modal?.type === 'delete' && (
        <Modal title="Confirm Delete" onClose={()=>setModal(null)} compact footer={<>
          <Btn className="btn btn-secondary" onClick={()=>setModal(null)}>Cancel</Btn>
          <Btn className="btn btn-danger" onClick={handleDelete} disabled={saving}>{saving?'Deleting…':'Delete'}</Btn>
        </>}>
          <p style={{margin:0}}>Delete this shortlist entry for <strong>{modal.data.institute_name}</strong>? Cannot be undone.</p>
        </Modal>
      )}
    </div>
  );
}

// ── Contracts tab ─────────────────────────────────────────────────────────────
function ContractsTab({ isAdmin, canEdit, token }) {
  const [contracts, setContracts] = useState([]);
  const [quotations, setQuotations] = useState({}); // keyed by contract_id
  const [shortlists, setShortlists] = useState([]);  // all shortlist rows for dropdown
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [filterFY, setFilterFY] = useState('');
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [cModal, setCModal] = useState(null);
  const [qModal, setQModal] = useState(null);

  const loadContracts = useCallback(async () => {
    setLoading(true);
    try {
      const [cs, sl] = await Promise.all([
        api('GET', '/contracts', null, token),
        api('GET', '/shortlists', null, token),
      ]);
      setContracts(cs);
      setShortlists(sl);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [token]);

  const loadQ = useCallback(async (id) => {
    const rows = await api('GET', `/quotations?contract_id=${id}`, null, token);
    setQuotations(q => ({ ...q, [id]: rows }));
  }, [token]);

  useEffect(() => { loadContracts(); }, [loadContracts]);

  const toggle = async (id) => {
    const opening = !expanded[id];
    setExpanded(e => ({ ...e, [id]: opening }));
    if (opening && !quotations[id]) await loadQ(id);
  };

  const shortlistedOrgs = useMemo(() => {
    const seen = new Map();
    shortlists.forEach(sl => {
      if (sl.client_id && !seen.has(String(sl.client_id))) {
        seen.set(String(sl.client_id), {
          id: sl.client_id,
          full_name: sl.client_name || '',
          short_name: sl.client_short || '',
        });
      }
    });
    return [...seen.values()].sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [shortlists]);

  const filtered = useMemo(() => contracts.filter(c => {
    if (filterFY && c.fy !== filterFY) return false;
    if (search && !c.title.toLowerCase().includes(search.toLowerCase()) && !(c.client_name||'').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [contracts, filterFY, search]);

  const handleContractSave = async (data) => {
    setSaving(true);
    try {
      if (cModal?.data?.id) await api('PUT', `/contracts/${cModal.data.id}`, data, token);
      else await api('POST', '/contracts', data, token);
      await loadContracts(); setCModal(null);
    } catch(e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleContractDelete = async () => {
    setSaving(true);
    try {
      await api('DELETE', `/contracts/${cModal.data.id}`, null, token);
      await loadContracts(); setCModal(null);
    } catch(e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleQSave = async (form) => {
    setSaving(true);
    try {
      if (qModal?.data?.id) await api('PUT', `/quotations/${qModal.data.id}`, form, token);
      else await api('POST', '/quotations', { ...form, contract_id: qModal.contractId }, token);
      await loadQ(qModal.contractId); setQModal(null);
    } catch(e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleQDelete = async () => {
    setSaving(true);
    try {
      await api('DELETE', `/quotations/${qModal.data.id}`, null, token);
      await loadQ(qModal.contractId); setQModal(null);
    } catch(e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const sc = s => s === 'Awarded' ? {bg:'var(--success-light)',cl:'var(--success)'} : s === 'Rejected' ? {bg:'var(--error-light)',cl:'var(--error)'} : {bg:'var(--primary-light)',cl:'var(--primary-dark)'};

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center', marginBottom:16 }}>
        <div className="search-wrap" style={{ flex:1, minWidth:200 }}>
          <span className="material-icons-round search-icon" style={{fontSize:16}}>search</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search contract title or org…"/>
        </div>
        <select value={filterFY} onChange={e=>setFilterFY(e.target.value)}
          style={{ height:38, borderRadius:8, border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)', padding:'0 10px', fontSize:13 }}>
          <option value="">All FYs</option>
          {FYS.map(fy => <option key={fy} value={fy}>{fy}</option>)}
        </select>
        <span style={{ fontSize:12, color:'var(--text3)' }}>{filtered.length} contracts</span>
        {canEdit && (
          <button onClick={() => setCModal({type:'add'})}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 14px', borderRadius:8, border:'none', background:'var(--primary)', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:600 }}>
            <span className="material-icons-round" style={{fontSize:15}}>add</span> New Contract
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ padding:40, textAlign:'center', color:'var(--text3)' }}><span className="spin material-icons-round" style={{fontSize:24}}>sync</span></div>
      ) : filtered.length === 0 ? (
        <div style={{ padding:32, textAlign:'center', color:'var(--text3)', fontSize:13 }}>No contracts yet.</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {filtered.map(c => {
            const isOpen = !!expanded[c.id];
            const quotes = quotations[c.id] || [];
            const awarded = quotes.find(q => q.status === 'Awarded');
            // shortlist options for this contract's client + fy
            const slOptions = shortlists.filter(sl =>
              (c.client_id ? sl.client_id === c.client_id : sl.client_name_manual === c.client_name_manual)
              && sl.fy === c.fy
            );
            // already-added firm ids to prevent duplicates
            const addedIds = new Set(quotes.map(q => q.shortlist_id));
            const availableOptions = slOptions.filter(sl => !addedIds.has(sl.id));

            return (
              <div key={c.id} className="card" style={{ padding:0, overflow:'hidden' }}>
                {/* Contract header row */}
                <div style={{ display:'flex', alignItems:'center', gap:10, padding:'13px 18px', cursor:'pointer', background: isOpen ? 'var(--bg)' : 'var(--surface)' }}
                  onClick={() => toggle(c.id)}>
                  <span className="material-icons-round" style={{ fontSize:15, color:'var(--text3)', flexShrink:0 }}>
                    {isOpen ? 'expand_more' : 'chevron_right'}
                  </span>
                  <span className="material-icons-round" style={{ fontSize:18, color:'var(--primary)', flexShrink:0 }}>gavel</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:14, color:'var(--text)' }}>{c.title}</div>
                    <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>
                      {c.client_name || c.client_name_manual || 'No org'}
                      {c.description && <span> · {c.description}</span>}
                    </div>
                  </div>
                  <span style={{ fontSize:11, fontWeight:600, padding:'2px 10px', borderRadius:100, background:'var(--primary-light)', color:'var(--primary-dark)', flexShrink:0 }}>FY {c.fy}</span>
                  {awarded
                    ? <span style={{ fontSize:11, fontWeight:600, padding:'2px 10px', borderRadius:100, background:'var(--success-light)', color:'var(--success)', flexShrink:0 }}>
                        Awarded · {fmtNPR(awarded.contract_amount)}
                      </span>
                    : <span style={{ fontSize:11, color:'var(--text3)', flexShrink:0 }}>{c.quotation_count} quote{c.quotation_count!==1?'s':''}</span>
                  }
                  {canEdit && (
                    <div style={{ display:'flex', gap:2, flexShrink:0 }} onClick={e=>e.stopPropagation()}>
                      <IcoBtn icon="edit" title="Edit" onHoverBg="var(--bg2)" hoverColor="var(--text)" onClick={()=>setCModal({type:'edit',data:c})}/>
                      {isAdmin && <IcoBtn icon="delete" title="Delete" onHoverBg="var(--error-light)" hoverColor="var(--error)" onClick={()=>setCModal({type:'delete',data:c})}/>}
                    </div>
                  )}
                </div>

                {/* Quotations */}
                {isOpen && (
                  <div style={{ borderTop:'1px solid var(--border)' }}>
                    {/* Sub-header */}
                    <div style={{ display:'flex', gap:8, padding:'7px 20px', background:'var(--bg)', borderBottom:'1px solid var(--border)' }}>
                      {['FIRM','QUOTE DATE','QUOTED (NPR)','STATUS','CONTRACT AMT (EX-VAT)','AGREEMENT',''].map((h,i) => (
                        <div key={i} style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.5px',
                          flex: i===0?2:i===4||i===5?1.5:0,
                          width: i===1?110:i===2?120:i===3?84:i===6?60:undefined, flexShrink:0 }}>
                          {h}
                        </div>
                      ))}
                    </div>

                    {quotes.length === 0 ? (
                      <div style={{ padding:'12px 20px', fontSize:12.5, color:'var(--text3)', fontStyle:'italic' }}>No quotations yet.</div>
                    ) : quotes.map((q,qi) => {
                      const c2 = sc(q.status);
                      return (
                        <div key={q.id} style={{ display:'flex', gap:8, alignItems:'center', padding:'10px 20px', borderBottom:'1px solid var(--border)', background: qi%2===1?'var(--bg)':'var(--surface)' }}>
                          <div style={{ flex:2, fontWeight:600, fontSize:13 }}>
                            {q.institute_acronym && <span style={{color:'var(--text3)',fontWeight:500}}>[{q.institute_acronym}] </span>}
                            {q.institute_name}
                            <span style={{ fontSize:10.5, color:'var(--text3)', marginLeft:6 }}>FY {q.shortlist_fy}</span>
                          </div>
                          <div style={{ width:110, fontSize:12.5, color:'var(--text2)', flexShrink:0 }}>{fmtDate(q.quotation_date)}</div>
                          <div style={{ width:120, fontSize:13, fontWeight:600, flexShrink:0 }}>{q.quoted_amount!=null?Number(q.quoted_amount).toLocaleString():'—'}</div>
                          <div style={{ width:84, flexShrink:0 }}>
                            <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:100, background:c2.bg, color:c2.cl }}>{q.status}</span>
                          </div>
                          <div style={{ flex:1.5 }}>
                            {q.status==='Awarded'
                              ? <span style={{ fontSize:13, fontWeight:700, color:'var(--success)' }}>{fmtNPR(q.contract_amount)}</span>
                              : <span style={{ color:'var(--text3)' }}>—</span>}
                          </div>
                          <div style={{ flex:1.5 }}>
                            {q.agreement_doc
                              ? <a href={q.agreement_doc} target="_blank" rel="noreferrer" style={{ fontSize:12, color:'var(--primary)', display:'flex', alignItems:'center', gap:3 }}>
                                  <span className="material-icons-round" style={{fontSize:13}}>description</span>View
                                </a>
                              : <span style={{ color:'var(--text3)', fontSize:12 }}>—</span>}
                          </div>
                          <div style={{ width:60, display:'flex', gap:2, justifyContent:'flex-end', flexShrink:0 }}>
                            {canEdit && <IcoBtn icon="edit" title="Edit" onHoverBg="var(--bg2)" hoverColor="var(--text)" onClick={()=>setQModal({type:'edit',contractId:c.id,data:q})}/>}
                            {isAdmin && <IcoBtn icon="delete" title="Delete" onHoverBg="var(--error-light)" hoverColor="var(--error)" onClick={()=>setQModal({type:'delete',contractId:c.id,data:q})}/>}
                          </div>
                        </div>
                      );
                    })}

                    {canEdit && availableOptions.length > 0 && (
                      <div style={{ padding:'10px 20px' }}>
                        <button onClick={() => setQModal({type:'add', contractId:c.id, options: availableOptions})}
                          style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:8, border:'1px dashed var(--border)', background:'transparent', color:'var(--text3)', cursor:'pointer', fontSize:12 }}>
                          <span className="material-icons-round" style={{fontSize:14}}>add</span> Add Quotation
                        </button>
                      </div>
                    )}
                    {canEdit && availableOptions.length === 0 && slOptions.length === 0 && (
                      <div style={{ padding:'8px 20px', fontSize:11.5, color:'var(--text3)', fontStyle:'italic' }}>
                        No firms shortlisted for this org/FY. Shortlist firms first.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Contract modals */}
      {(cModal?.type==='add'||cModal?.type==='edit') && (
        <ContractFormModal initial={cModal.data} clients={shortlistedOrgs} onSave={handleContractSave} onClose={()=>setCModal(null)} saving={saving}/>
      )}
      {cModal?.type==='delete' && (
        <ConfirmModal message={`Delete contract "${cModal.data.title}"? All its quotations will be removed.`} onConfirm={handleContractDelete} onClose={()=>setCModal(null)} saving={saving}/>
      )}

      {/* Quotation modals */}
      {(qModal?.type==='add'||qModal?.type==='edit') && (
        <QuotationFormModal
          initial={qModal.data}
          slOptions={qModal.options || (qModal.data ? [] : [])}
          onSave={handleQSave}
          onClose={()=>setQModal(null)}
          saving={saving}
          token={token}
        />
      )}
      {qModal?.type==='delete' && (
        <ConfirmModal message={`Delete quotation from "${qModal.data.institute_name}"?`} onConfirm={handleQDelete} onClose={()=>setQModal(null)} saving={saving}/>
      )}
    </div>
  );
}

// ── Small icon button ─────────────────────────────────────────────────────────
function IcoBtn({ icon, title, onClick, onHoverBg, hoverColor }) {
  return (
    <button title={title} onClick={onClick}
      style={{ width:28,height:28,borderRadius:50,border:'none',background:'transparent',color:'var(--text3)',cursor:'pointer',display:'inline-flex',alignItems:'center',justifyContent:'center' }}
      onMouseEnter={e=>{e.currentTarget.style.background=onHoverBg;e.currentTarget.style.color=hoverColor;}}
      onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color='var(--text3)';}}>
      <span className="material-icons-round" style={{fontSize:14}}>{icon}</span>
    </button>
  );
}

// ── Client combobox ───────────────────────────────────────────────────────────
function ClientCombobox({ clients, value, onChange }) {
  const selected = clients.find(c => String(c.id) === String(value));
  const [query, setQuery] = useState(selected ? (selected.full_name || selected.fullName || '') : '');
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const ref = useRef(null);
  const inputRef = useRef(null);

  const filtered = useMemo(() => {
    if (!query) return clients;
    const q = query.toLowerCase();
    return clients.filter(c => {
      const name = (c.full_name || c.fullName || '').toLowerCase();
      const short = (c.short_name || c.shortName || '').toLowerCase();
      return name.includes(q) || short.includes(q);
    });
  }, [clients, query]);

  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setFocused(false); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const select = c => { onChange(String(c.id)); setQuery(c.full_name || c.fullName || ''); setOpen(false); setFocused(false); };
  const clear = e => { e.preventDefault(); onChange(''); setQuery(''); setOpen(true); inputRef.current?.focus(); };

  const up = query.length > 0 || focused;
  const bc = focused ? 'var(--primary)' : 'var(--md-sys-color-outline,#79747e)';
  const bw = focused ? 2 : 1;

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <div onClick={() => { inputRef.current?.focus(); setOpen(true); }}
        style={{ position:'relative', border:`${bw}px solid ${bc}`, borderRadius:4, padding:'0 12px', minHeight:56, boxSizing:'border-box', cursor:'text' }}>
        <span style={{ position:'absolute', left:12, top: up?-10:'50%', transform: up?'translateY(0) scale(0.75)':'translateY(-50%) scale(1)',
          transformOrigin:'left center', fontSize:16, color: focused?'var(--primary)':'var(--md-sys-color-outline,#79747e)',
          pointerEvents:'none', background:'var(--surface,#fff)', padding:'0 4px', transition:'top .12s,transform .12s,color .12s', lineHeight:1 }}>
          Organization (Client)
        </span>
        <div style={{ display:'flex', alignItems:'center', paddingTop:18, paddingBottom:6 }}>
          <input ref={inputRef} value={query}
            onChange={e => { setQuery(e.target.value); onChange(''); setOpen(true); }}
            onFocus={() => { setFocused(true); setOpen(true); }}
            style={{ flex:1, border:'none', outline:'none', background:'transparent', fontSize:16, color:'var(--text)', fontFamily:'inherit', minWidth:0 }}/>
          {query
            ? <button onMouseDown={clear} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:18, lineHeight:1, padding:'2px 0 2px 4px' }}>×</button>
            : <span style={{ color:'var(--text3)', fontSize:18, lineHeight:1, userSelect:'none' }}>▾</span>}
        </div>
      </div>
      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 2px)', left:0, right:0, zIndex:9999,
          background:'var(--surface,#fff)', border:'1px solid var(--border)', borderRadius:8,
          boxShadow:'0 4px 24px rgba(0,0,0,.18)', maxHeight:220, overflowY:'auto' }}>
          {filtered.length === 0
            ? <div style={{ padding:'12px 16px', color:'var(--text3)', fontSize:13 }}>No matches</div>
            : filtered.map(c => {
                const name = c.full_name || c.fullName || '';
                const short = c.short_name || c.shortName || '';
                return (
                  <div key={c.id} onMouseDown={() => select(c)}
                    style={{ padding:'10px 16px', cursor:'pointer', fontSize:13,
                      background: String(c.id)===String(value)?'var(--primary-light)':'transparent' }}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--bg)'}
                    onMouseLeave={e=>e.currentTarget.style.background=String(c.id)===String(value)?'var(--primary-light)':'transparent'}>
                    {short && <span style={{ fontWeight:600, marginRight:6 }}>{short}</span>}
                    {name}
                  </div>
                );
              })}
        </div>
      )}
    </div>
  );
}

// ── Contract form modal ───────────────────────────────────────────────────────
function ContractFormModal({ initial, clients, onSave, onClose, saving }) {
  const [form, setForm] = useState({
    client_id: initial?.client_id ? String(initial.client_id) : '',
    client_name_manual: initial?.client_name_manual || '',
    fy: initial?.fy || '',
    title: initial?.title || '',
    description: initial?.description || '',
  });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  return (
    <Modal title={initial?.id?'Edit Contract':'New Contract'} onClose={onClose} compact footer={<>
      <Btn className="btn btn-secondary" onClick={onClose}>Cancel</Btn>
      <Btn className="btn btn-primary" onClick={()=>onSave(form)} disabled={saving||!form.fy||!form.title}>
        {saving?'Saving…':'Save'}
      </Btn>
    </>}>
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        <MdSelect label="Fiscal Year *" value={form.fy} onChange={e=>set('fy',e.target.value)}>
          <MdOption value="">— Select FY —</MdOption>
          {FYS.map(fy=><MdOption key={fy} value={fy}>{fy}</MdOption>)}
        </MdSelect>
        <MdTextField label="Contract Title *" value={form.title} onChange={e=>set('title',e.target.value)} placeholder="e.g. Barista Training"/>
        <ClientCombobox clients={clients} value={form.client_id} onChange={v => { set('client_id', v); set('client_name_manual', ''); }}/>
        <MdTextField label="Description" value={form.description} onChange={e=>set('description',e.target.value)} placeholder="Optional"/>
      </div>
    </Modal>
  );
}

// ── Quotation form modal ──────────────────────────────────────────────────────
function QuotationFormModal({ initial, slOptions, onSave, onClose, saving, token }) {
  const today = new Date().toISOString().slice(0,10);
  const [form, setForm] = useState({
    shortlist_id: initial?.shortlist_id ? String(initial.shortlist_id) : '',
    quotation_date: initial?.quotation_date ? initial.quotation_date.slice(0,10) : today,
    quoted_amount: initial?.quoted_amount != null ? String(initial.quoted_amount) : '',
    status: initial?.status || 'Quoted',
    contract_amount: initial?.contract_amount != null ? String(initial.contract_amount) : '',
    agreement_doc: initial?.agreement_doc || null,
    remarks: initial?.remarks || '',
  });
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const isAwarded = form.status === 'Awarded';
  const isEdit = !!initial?.id;
  return (
    <Modal title={isEdit?'Edit Quotation':'Add Quotation'} onClose={onClose} compact footer={<>
      <Btn className="btn btn-secondary" onClick={onClose}>Cancel</Btn>
      <Btn className="btn btn-primary"
        onClick={()=>onSave({
          ...form,
          shortlist_id: Number(form.shortlist_id),
          quoted_amount: form.quoted_amount!==''?Number(form.quoted_amount):null,
          contract_amount: isAwarded&&form.contract_amount!==''?Number(form.contract_amount):null,
        })}
        disabled={saving||!form.shortlist_id}>
        {saving?'Saving…':'Save'}
      </Btn>
    </>}>
      <div style={{display:'flex',flexDirection:'column',gap:14}}>
        {!isEdit && (
          <MdSelect label="Firm *" value={form.shortlist_id} onChange={e=>set('shortlist_id',e.target.value)}>
            <MdOption value="">— Select shortlisted firm —</MdOption>
            {slOptions.map(sl=>(
              <MdOption key={sl.id} value={String(sl.id)}>
                {sl.institute_acronym?`[${sl.institute_acronym}] `:''}{sl.institute_name} · {sl.fy}
              </MdOption>
            ))}
          </MdSelect>
        )}
        {isEdit && <div style={{fontSize:13,fontWeight:600,color:'var(--text2)'}}>Firm: {initial.institute_name}</div>}
        <NepaliDatePicker label="Quotation Date *" value={form.quotation_date} onChange={v=>set('quotation_date',v)}/>
        <MdTextField type="number" label="Quoted Amount (NPR)" value={form.quoted_amount} onChange={e=>set('quoted_amount',e.target.value)} placeholder="Optional"/>
        <MdSelect label="Status" value={form.status} onChange={e=>set('status',e.target.value)}>
          {QUOTE_STATUS.map(s=><MdOption key={s} value={s}>{s}</MdOption>)}
        </MdSelect>
        {isAwarded && <>
          <MdTextField type="number" label="Contract Amount ex-VAT (NPR) *" value={form.contract_amount} onChange={e=>set('contract_amount',e.target.value)} placeholder="e.g. 498328"/>
          <div>
            <div style={{fontSize:12.5,fontWeight:600,color:'var(--text2)',marginBottom:6}}>Agreement Document</div>
            <AgreementUpload value={form.agreement_doc} onChange={v=>set('agreement_doc',v)} token={token}/>
          </div>
        </>}
        <MdTextField label="Remarks" value={form.remarks} onChange={e=>set('remarks',e.target.value)} placeholder="Optional"/>
      </div>
    </Modal>
  );
}

// ── Confirm modal ─────────────────────────────────────────────────────────────
function ConfirmModal({ message, onConfirm, onClose, saving }) {
  return (
    <Modal title="Confirm" onClose={onClose} compact footer={<>
      <Btn className="btn btn-secondary" onClick={onClose}>Cancel</Btn>
      <Btn className="btn btn-danger" onClick={onConfirm} disabled={saving}>{saving?'Deleting…':'Delete'}</Btn>
    </>}>
      <p style={{margin:0,color:'var(--text2)'}}>{message}</p>
    </Modal>
  );
}

// ── Main QuotationsView ───────────────────────────────────────────────────────
export default function QuotationsView({ institutes, clients, isAdmin, isEditor, isShortlistOnly }) {
  const session = getSession();
  const token = session?.token;
  const canEdit = !!(isAdmin || isEditor || isShortlistOnly);
  const [tab, setTab] = useState('shortlisting');

  const tabStyle = (id) => ({
    padding:'10px 20px', border:'none', background:'transparent', cursor:'pointer',
    fontSize:13.5, fontWeight:600, fontFamily:'inherit',
    color: tab===id ? 'var(--primary)' : 'var(--text3)',
    borderBottom: tab===id ? '2px solid var(--primary)' : '2px solid transparent',
    transition:'color .15s, border-color .15s',
  });

  return (
    <div className="fade-in">
      <div className="page-header mb-6">
        <div>
          <div className="page-header-title">Quotations</div>
          <div className="page-header-sub">Manage shortlisting and contract awards</div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display:'flex', gap:0, borderBottom:'1px solid var(--border)', marginBottom:20, background:'var(--surface)', borderRadius:'12px 12px 0 0', padding:'0 8px', boxShadow:'var(--shadow)' }}>
        <button style={tabStyle('shortlisting')} onClick={()=>setTab('shortlisting')}>
          <span className="material-icons-round" style={{fontSize:15, verticalAlign:'middle', marginRight:6}}>playlist_add_check</span>
          Shortlisting
        </button>
        <button style={tabStyle('contracts')} onClick={()=>setTab('contracts')}>
          <span className="material-icons-round" style={{fontSize:15, verticalAlign:'middle', marginRight:6}}>gavel</span>
          Contracts & Quotations
        </button>
      </div>

      {tab === 'shortlisting' && (
        <ShortlistTab
          institutes={institutes} clients={clients}
          isAdmin={isAdmin} canEdit={canEdit} token={token}
        />
      )}
      {tab === 'contracts' && (
        <ContractsTab isAdmin={isAdmin} canEdit={canEdit} token={token}/>
      )}
    </div>
  );
}

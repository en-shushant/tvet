import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Modal from './ui/Modal.jsx';
import { Btn, MdTextField, MdSelect, MdOption } from '../md.jsx';
import { api } from '../utils/api.js';
import { getSession } from '../utils/auth.js';
import { getCurrentFY } from '../constants/data.js';

import { toast } from './ui/Feedback.jsx';
import { NepaliDatePicker, ConfirmModal, LetterBuilderWrapper, FYS, ACCEPT, uploadToR2 } from './shortlisting/common.jsx';
import { StandingListModal, AssignFirmsModal, LetterOptsModal, BillModal, LETTER_TYPES } from './shortlisting/modals.jsx';
import { ShortlistRow, GroupHeader, TableHead, printShortlistReport } from './shortlisting/table.jsx';
import { ContractsPanel } from './shortlisting/ContractsPanel.jsx';
import { bsDateLabel } from '../utils/neaLetter.js';

function ShortlistDocUpload({ value, onChange, token }) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const isPdf = value && (value.toLowerCase().endsWith('.pdf') || value.startsWith('data:application/pdf'));
  const handleFile = async e => {
    const file = e.target.files[0]; if (!file) return;
    e.target.value = ''; setErr(''); setUploading(true);
    try { onChange(await uploadToR2(file, token)); }
    catch (ex) { setErr(ex.message); }
    finally { setUploading(false); }
  };
  return (
    <div className="form-group">
      <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>
        Shortlist Certificate / Bill <span style={{ fontWeight: 400, color: 'var(--text3)' }}>(optional)</span>
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {value ? (
          <div style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
            {isPdf ? (
              <a href={value} target="_blank" rel="noreferrer" style={{ height: 56, width: 56, border: '1px solid var(--border)', borderRadius: 6, background: '#fff8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, textDecoration: 'none' }}>
                <span className="material-icons-round" style={{fontSize:20, color:'var(--text3)'}}>description</span>
                <span style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 600 }}>PDF</span>
              </a>
            ) : (
              <a href={value} target="_blank" rel="noreferrer">
                <img src={value} alt="" style={{ height: 56, maxWidth: 80, objectFit: 'contain', border: '1px solid var(--border)', borderRadius: 6, background: '#fff', padding: 2 }}/>
              </a>
            )}
            <button onClick={() => onChange(null)} style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: '#e53935', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}><span className="material-icons-round" style={{fontSize:12}}>close</span></button>
          </div>
        ) : (
          <div style={{ height: 56, width: 56, border: '1px dashed var(--border)', borderRadius: 6, background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>None</span>
          </div>
        )}
        <label style={{ cursor: uploading ? 'wait' : 'pointer' }}>
          <input type="file" accept={ACCEPT} style={{ display: 'none' }} onChange={handleFile} disabled={uploading}/>
          <span className="btn btn-secondary btn-sm">{uploading ? 'Uploading…' : value ? 'Change' : 'Upload'}</span>
        </label>
        {value && <span className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }} onClick={() => onChange(null)}><span className="material-icons-round" style={{fontSize:14,verticalAlign:'middle',marginRight:4}}>close</span>Remove</span>}
      </div>
      {err && <div style={{ fontSize: 11, color: '#c0391e', marginTop: 4 }}>{err}</div>}
    </div>
  );
}

// Full-screen PDF preview with print / download, shown after generating.
function ClientCombobox({ clients, value, onChange }) {
  const selected = clients.find(c => String(c.id) === String(value));
  const [query, setQuery] = useState(selected ? (selected.fullName || selected.full_name) : '');
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const ref = useRef(null);
  const inputRef = useRef(null);

  const filtered = useMemo(() => {
    if (!query) return clients;
    const q = query.toLowerCase();
    return clients.filter(c => {
      const name = (c.fullName || c.full_name || '').toLowerCase();
      const short = (c.shortName || c.short_name || '').toLowerCase();
      return name.includes(q) || short.includes(q);
    });
  }, [clients, query]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setFocused(false); } };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (c) => {
    onChange(String(c.id));
    setQuery(c.fullName || c.full_name);
    setOpen(false);
    setFocused(false);
  };

  const hasValue = query.length > 0;
  const borderColor = focused ? 'var(--primary)' : 'var(--md-sys-color-outline, #79747e)';
  const borderWidth = focused ? 2 : 1;
  const labelColor = focused ? 'var(--primary)' : 'var(--md-sys-color-outline, #79747e)';
  const labelUp = hasValue || focused;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* MD outlined-style container */}
      <div
        onClick={() => { inputRef.current?.focus(); setOpen(true); }}
        style={{
          position: 'relative', border: `${borderWidth}px solid ${borderColor}`,
          borderRadius: 4, padding: '0 12px', minHeight: 56, boxSizing: 'border-box',
          cursor: 'text', transition: 'border-color .15s, border-width .15s',
        }}
      >
        {/* Floating label */}
        <span style={{
          position: 'absolute', left: 12, top: labelUp ? -10 : '50%',
          transform: labelUp ? 'translateY(0) scale(0.75)' : 'translateY(-50%) scale(1)',
          transformOrigin: 'left center',
          fontSize: 16, color: labelColor, pointerEvents: 'none',
          background: 'var(--surface, #fff)', padding: '0 4px',
          transition: 'top .12s, transform .12s, color .12s, font-size .12s',
          lineHeight: 1,
        }}>
          Organization (Client)
        </span>
        <div style={{ display: 'flex', alignItems: 'center', paddingTop: 18, paddingBottom: 6 }}>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); onChange(''); setOpen(true); }}
            onFocus={() => { setFocused(true); setOpen(true); }}
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: 16, color: 'var(--text)', fontFamily: 'inherit', minWidth: 0,
            }}
          />
          {query ? (
            <button onMouseDown={e => { e.preventDefault(); onChange(''); setQuery(''); setOpen(true); inputRef.current?.focus(); }} style={{
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)',
              fontSize: 18, lineHeight: 1, padding: '2px 0 2px 4px', flexShrink: 0,
            }}>×</button>
          ) : (
            <span className="material-icons-round" style={{ color: 'var(--text3)', fontSize: 18, lineHeight: 1, userSelect: 'none' }}>expand_more</span>
          )}
        </div>
      </div>
      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0, zIndex: 9999,
          background: 'var(--surface, #fff)', border: '1px solid var(--border)',
          borderRadius: 8, boxShadow: '0 4px 24px rgba(0,0,0,.18)',
          maxHeight: 220, overflowY: 'auto',
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '12px 16px', color: 'var(--text3)', fontSize: 13 }}>No matches</div>
          ) : filtered.map(c => {
            const name = c.fullName || c.full_name;
            const short = c.shortName || c.short_name;
            const isSelected = String(c.id) === String(value);
            return (
              <div key={c.id} onMouseDown={() => select(c)} style={{
                padding: '10px 16px', cursor: 'pointer', fontSize: 14,
                borderBottom: '1px solid var(--border)',
                background: isSelected ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'transparent',
                color: isSelected ? 'var(--primary)' : 'var(--text)',
                fontWeight: isSelected ? 600 : 400,
              }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg)'; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
              >
                {name}{short && short !== name ? <span style={{ color: 'var(--text3)', marginLeft: 6, fontWeight: 400 }}>({short})</span> : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Nepali Date Picker ─────────────────────────────────────────────────────────

function ShortlistForm({ initial, institutes, clients, onSave, onClose, saving, token }) {
  const isEdit = !!initial?.id;
  const [multi, setMulti] = useState(false); // multi-firm mode (add only)
  const [selectedFirms, setSelectedFirms] = useState([]); // for multi mode
  const [firmSearch, setFirmSearch] = useState('');
  // manual org = not in client list
  const [manualOrg, setManualOrg] = useState(!!(initial?.client_name_manual && !initial?.client_id));

  const empty = {
    client_id: '', client_name_manual: '', institute_id: '', standing_list_name: '', fy: '',
    shortlist_date: '', status: 'Active', remarks: '', contract_amount: '', shortlist_doc: null,
    letter_type: 'basic',
  };
  const [form, setForm] = useState(initial ? {
    client_id:          initial.client_id    ?? '',
    client_name_manual: initial.client_name_manual ?? '',
    institute_id:       initial.institute_id ?? '',
    standing_list_name: initial.standing_list_name ?? '',
    fy:                 initial.fy           ?? '',
    shortlist_date:     initial.shortlist_date ? initial.shortlist_date.slice(0,10) : '',
    status:             initial.status        ?? 'Active',
    remarks:            initial.remarks       ?? '',
    contract_amount:    initial.contract_amount != null ? String(initial.contract_amount) : '',
    shortlist_doc:      initial.shortlist_doc ?? null,
    letter_type:        initial.letter_type   ?? 'basic',
  } : empty);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const [err, setErr] = useState('');

  const toggleFirm = (id) => setSelectedFirms(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  const filteredInstitutes = useMemo(() => {
    if (!firmSearch) return institutes;
    const q = firmSearch.toLowerCase();
    return institutes.filter(i => (i.name + ' ' + (i.acronym||'')).toLowerCase().includes(q));
  }, [institutes, firmSearch]);

  const handleSave = async () => {
    if (!form.fy) return setErr('Fiscal year is required.');
    if (!form.shortlist_date) return setErr('Shortlisting date is required.');
    if (multi && !isEdit) {
      if (selectedFirms.length === 0) return setErr('Select at least one firm.');
      setErr('');
      // Pass array — parent saves all in parallel then reloads once
      await onSave(selectedFirms.map(instId => ({ ...form, institute_id: instId })));
    } else {
      if (!form.institute_id) return setErr('Please select a firm.');
      setErr('');
      await onSave(form);
    }
  };

  return (
    <Modal
      title={isEdit ? 'Edit Shortlist Entry' : 'Add Shortlist Entry'}
      onClose={onClose}
      compact
      footer={<>
        <Btn className="btn btn-secondary" onClick={onClose}>Cancel</Btn>
        <Btn className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Update' : multi ? `Add ${selectedFirms.length || ''} Firms` : 'Add'}
        </Btn>
      </>}
    >
      {err && <div style={{ background:'var(--error-light)', color:'#c0391e', borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:13 }}>{err}</div>}

      {/* Common fields */}
      <div className="form-row form-row-2">
        <div className="form-group">
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4}}>
            <span style={{fontSize:13, fontWeight:500}}>Organization (Client)</span>
            <button type="button"
              onClick={() => { setManualOrg(v => !v); set('client_id', ''); set('client_name_manual', ''); }}
              style={{fontSize:11.5, color:'var(--primary)', background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:'inherit', fontWeight:500}}>
              {manualOrg ? '← Select from list' : 'Enter manually →'}
            </button>
          </div>
          {manualOrg ? (
            <MdTextField label="Organization name" value={form.client_name_manual} onChange={e => set('client_name_manual', e.target.value)}
              placeholder="Organization name…" />
          ) : (
            <ClientCombobox clients={clients} value={form.client_id} onChange={v => set('client_id', v)} />
          )}
        </div>
        <div className="form-group">
          <MdSelect label="Fiscal Year *" value={form.fy} onChange={e => set('fy', e.target.value)}>
            <MdOption value="">— Select FY —</MdOption>
            {FYS.map(fy => <MdOption key={fy} value={fy}>{fy}</MdOption>)}
          </MdSelect>
        </div>
      </div>

      <div className="form-row form-row-2">
        <div className="form-group">
          <MdSelect label="Standing List Name" value={form.standing_list_name} onChange={e => set('standing_list_name', e.target.value)}>
            <MdOption value="">— Select or leave blank —</MdOption>
            <MdOption value="Standing List">Standing List</MdOption>
            <MdOption value="Roster of Firms">Roster of Firms</MdOption>
            <MdOption value="ADB Consultants List">ADB Consultants List</MdOption>
          </MdSelect>
        </div>
        <NepaliDatePicker label="Shortlisting Date" value={form.shortlist_date} onChange={v => set('shortlist_date', v)} required />
      </div>

      <div className="form-row form-row-2">
        <div className="form-group">
          <MdSelect label="Status" value={form.status} onChange={e => set('status', e.target.value)}>
            <MdOption value="Active">Active</MdOption>
            <MdOption value="Expired">Expired</MdOption>
            <MdOption value="Pending">Pending</MdOption>
          </MdSelect>
        </div>
        <div className="form-group">
          <MdSelect label="Letter Format" value={form.letter_type} onChange={e => set('letter_type', e.target.value)}>
            {LETTER_TYPES.map(t => <MdOption key={t.value} value={t.value}>{t.label}</MdOption>)}
          </MdSelect>
        </div>
      </div>

      <div className="form-group">
        <MdTextField type="number" label="Contract Amount (NPR)" value={form.contract_amount} onChange={e => set('contract_amount', e.target.value)} placeholder="Optional" />
      </div>

      <div className="form-group">
        <MdTextField label="Remarks" value={form.remarks} onChange={e => set('remarks', e.target.value)} placeholder="Optional notes" />
      </div>

      <ShortlistDocUpload value={form.shortlist_doc} onChange={v => set('shortlist_doc', v)} token={token}/>

      {/* Firm selection */}
      {!isEdit && (
        <div style={{display:'flex', gap:8, marginBottom:10}}>
          {[['single','Single firm'],['multi','Multiple firms']].map(([v,lbl]) => (
            <button key={v} type="button" onClick={() => { setMulti(v==='multi'); setSelectedFirms([]); set('institute_id',''); }}
              style={{
                padding:'6px 16px', borderRadius:100, border:'none', cursor:'pointer',
                fontFamily:'inherit', fontSize:12.5, fontWeight:500, transition:'all .15s',
                background: (multi ? v==='multi' : v==='single') ? 'var(--primary)' : 'var(--bg)',
                color:      (multi ? v==='multi' : v==='single') ? '#fff'            : 'var(--text3)',
              }}>{lbl}</button>
          ))}
        </div>
      )}

      {/* Single firm dropdown */}
      {(!isEdit && !multi) && (
        <div className="form-group">
          <MdSelect label="Firm (Institute) *" value={form.institute_id} onChange={e => set('institute_id', e.target.value)}>
            <MdOption value="">— Select firm —</MdOption>
            {institutes.map(i => <MdOption key={i.id} value={String(i.id)}>{i.acronym ? `[${i.acronym}] ` : ''}{i.name}</MdOption>)}
          </MdSelect>
        </div>
      )}

      {/* Edit: show firm as read-only dropdown */}
      {isEdit && (
        <div className="form-group">
          <MdSelect label="Firm (Institute)" value={form.institute_id} onChange={e => set('institute_id', e.target.value)}>
            <MdOption value="">— Select firm —</MdOption>
            {institutes.map(i => <MdOption key={i.id} value={String(i.id)}>{i.acronym ? `[${i.acronym}] ` : ''}{i.name}</MdOption>)}
          </MdSelect>
        </div>
      )}

      {/* Multi-firm checklist */}
      {(!isEdit && multi) && (
        <div className="form-group">
          <div style={{fontSize:13, fontWeight:500, color:'var(--text2)', marginBottom:6}}>
            Select Firms * <span style={{color:'var(--text3)', fontWeight:400}}>({selectedFirms.length} selected)</span>
          </div>
          <div style={{border:'1.5px solid var(--border)', borderRadius:10, overflow:'hidden'}}>
            {/* Search bar */}
            <div style={{display:'flex', alignItems:'center', gap:8, padding:'10px 14px', borderBottom:'1px solid var(--border)', background:'var(--bg)'}}>
              <span className="material-icons-round" style={{color:'var(--text3)', fontSize:17, flexShrink:0}}>search</span>
              <input
                placeholder="Search firms…"
                value={firmSearch}
                onChange={e => setFirmSearch(e.target.value)}
                style={{border:'none', background:'transparent', outline:'none', width:'100%', fontSize:13, color:'var(--text)', fontFamily:'inherit'}}
              />
              {firmSearch && (
                <button type="button" onClick={() => setFirmSearch('')}
                  style={{background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:16, padding:0, lineHeight:1}}>×</button>
              )}
            </div>
            {/* List */}
            <div style={{maxHeight:240, overflowY:'auto', overflowX:'hidden'}}>
              {filteredInstitutes.length === 0 ? (
                <div style={{padding:'16px 14px', color:'var(--text3)', fontSize:13, textAlign:'center'}}>No matches</div>
              ) : filteredInstitutes.map(i => {
                const checked = selectedFirms.includes(i.id);
                return (
                  <label key={i.id} onClick={() => toggleFirm(i.id)} style={{
                    display:'flex', alignItems:'center', gap:12, padding:'10px 14px',
                    cursor:'pointer', borderBottom:'1px solid var(--border)',
                    background: checked ? 'color-mix(in srgb, var(--primary) 10%, transparent)' : 'transparent',
                    transition:'background .1s', boxSizing:'border-box', width:'100%',
                  }}
                    onMouseEnter={e=>{ if(!checked) e.currentTarget.style.background='var(--bg)'; }}
                    onMouseLeave={e=>{ if(!checked) e.currentTarget.style.background='transparent'; }}
                  >
                    <input type="checkbox" checked={checked} onChange={() => {}} onClick={e => e.stopPropagation()}
                      style={{accentColor:'var(--primary)', flexShrink:0, width:16, height:16}} />
                    <span style={{flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                      fontSize:13, color: checked ? 'var(--primary)' : 'var(--text)', fontWeight: checked ? 600 : 400}}>
                      {i.acronym ? <span style={{color:'var(--text3)', marginRight:5}}>[{i.acronym}]</span> : null}
                      {i.name}
                    </span>
                  </label>
                );
              })}
            </div>
            {/* Footer */}
            {selectedFirms.length > 0 && (
              <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 14px', borderTop:'1px solid var(--border)', background:'var(--bg)'}}>
                <span style={{fontSize:12, color:'var(--text3)'}}>{selectedFirms.length} firm{selectedFirms.length>1?'s':''} selected</span>
                <button type="button" onClick={() => setSelectedFirms([])}
                  style={{background:'none', border:'none', color:'var(--primary)', cursor:'pointer', fontSize:12, padding:0, fontFamily:'inherit'}}>
                  Clear all
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── Letter Options Modal ───────────────────────────────────────────────────────
export default function Shortlisting({ institutes, clients, isAdmin, isEditor, isShortlistOnly, isSuperAdmin }) {
  const session = getSession();
  const token = session?.token;
  const canEdit = !!(isAdmin || isEditor || isShortlistOnly);

  const [rows, setRows] = useState([]);
  const [standingLists, setStandingLists] = useState([]);
  const [listModal, setListModal] = useState(null);   // {type:'new'|'edit'|'assign', data?}
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(null); // {type:'add'|'edit'|'delete', data?}
  const [showPageBuilder, setShowPageBuilder] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [groupBy, setGroupBy] = useState('org'); // 'fy' | 'org' | 'firm'
  const [filterOrg, setFilterOrg] = useState('');
  const [filterFirm, setFilterFirm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  /**
   * Starts on the current fiscal year, which is what people are working in.
   *
   * Applied lazily rather than as the initial value: if the registry holds
   * nothing for that year the filter is left off instead of opening on an empty
   * screen with a filter the user did not set. See the effect below.
   */
  const [filterFY, setFilterFY] = useState('');
  const [fyDefaulted, setFyDefaulted] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, lists] = await Promise.all([
        api('GET', '/shortlists', null, token),
        api('GET', '/standing-lists', null, token).catch(() => []),
      ]);
      setRows(data);
      setStandingLists(lists || []);
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  /**
   * Does one assigned firm pass the filter bar?
   *
   * Organisation is matched by name, not client_id: firms are attached to a
   * standing list by POST /standing-lists/:id/firms, which copies the list's
   * client_name_manual and never sets client_id — so every one of these rows
   * has client_id NULL and an id comparison could only ever match nothing.
   */
  const firmMatches = useCallback((r, list) => {
    if (filterFirm && String(r.institute_id) !== filterFirm) return false;
    if (filterStatus && (r.status || list?.status) !== filterStatus) return false;
    if (filterFY) {
      const fy = r.fy || list?.fy || '';
      if (fy !== filterFY) return false;
    }
    if (filterOrg) {
      const c = clients.find(x => String(x.id) === String(filterOrg));
      const names = [c?.shortName, c?.short_name, c?.fullName, c?.full_name]
        .filter(Boolean).map(n => String(n).toLowerCase());
      const onRow = String(r.client_name_manual || list?.client_name_manual || '').toLowerCase();
      const byId = r.client_id != null && String(r.client_id) === String(filterOrg);
      if (!byId && !(onRow && names.some(n => onRow.includes(n) || n.includes(onRow)))) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      const hay = [r.institute_name, r.institute_acronym, r.client_name, r.client_short,
        r.client_name_manual, list?.client_name_manual, r.standing_list_name, list?.name,
        r.fy || list?.fy, r.remarks].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }, [filterFirm, filterStatus, filterFY, filterOrg, search, clients]);

  // Firms assigned to each standing list, with the filter bar applied.
  // Previously built straight off `rows`, so the only section with any data in
  // it ignored every filter on the page.
  const firmsByList = useMemo(() => {
    const byId = new Map(standingLists.map(l => [String(l.id), l]));
    const m = new Map();
    for (const r of rows) {
      if (!r.standing_list_id) continue;
      const k = String(r.standing_list_id);
      if (!firmMatches(r, byId.get(k))) continue;
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(r);
    }
    return m;
  }, [rows, standingLists, firmMatches]);

  /** Unfiltered membership, for counts and actions that must ignore filtering. */
  const allFirmsByList = useMemo(() => {
    const m = new Map();
    for (const r of rows) {
      if (!r.standing_list_id) continue;
      const k = String(r.standing_list_id);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(r);
    }
    return m;
  }, [rows]);

  const handleListSave = async (data) => {
    setSaving(true);
    try {
      if (listModal?.data?.id) await api('PUT', `/standing-lists/${listModal.data.id}`, data, token);
      else                     await api('POST', '/standing-lists', data, token);
      setListModal(null);
      await load();
    } finally { setSaving(false); }
  };

  const handleAssignFirms = async (toAdd, toRemove) => {
    setSaving(true);
    try {
      const id = listModal.data.id;
      if (toAdd.length)
        await api('POST', `/standing-lists/${id}/firms`, { institute_ids: toAdd }, token);
      for (const instId of toRemove)
        await api('DELETE', `/standing-lists/${id}/firms/${instId}`, null, token);
      setListModal(null);
      await load();
    } finally { setSaving(false); }
  };

  // Deleting a list cascades to its firm entries, so force=1 is only sent once
  // the user has confirmed against the actual count.
  const handleListDelete = async () => {
    const list = listModal.data;
    setSaving(true);
    try {
      await api('DELETE', `/standing-lists/${list.id}?force=1`, null, token);
      setListModal(null);
      await load();
    } catch (e) { toast.error(e.message || 'Delete failed'); }
    finally { setSaving(false); }
  };

  const filtered = useMemo(() => rows.filter(r => {
    if (r.standing_list_id) return false; // shown under its standing list
    if (filterOrg    && String(r.client_id)    !== filterOrg)    return false;
    if (filterFirm   && String(r.institute_id) !== filterFirm)   return false;
    if (filterStatus && r.status !== filterStatus)               return false;
    if (filterFY     && r.fy !== filterFY)                       return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = [r.institute_name, r.institute_acronym, r.client_name, r.client_short, r.standing_list_name, r.fy, r.remarks].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }), [rows, filterOrg, filterFirm, filterStatus, filterFY, search]);

  // Group the filtered rows
  const grouped = useMemo(() => {
    const map = new Map();
    for (const row of filtered) {
      let key, label, sub;
      if (groupBy === 'fy') {
        key = row.fy || '__none__';
        label = row.fy ? `FY ${row.fy}` : 'No Fiscal Year';
        sub = '';
      } else if (groupBy === 'org') {
        key = row.client_id ? String(row.client_id) : (row.client_name_manual ? `m:${row.client_name_manual}` : '__none__');
        label = row.client_name || row.client_name_manual || 'No Organization';
        sub = row.client_short || '';
      } else {
        key = String(row.institute_id);
        label = row.institute_name || '—';
        sub = row.institute_acronym || '';
      }
      if (!map.has(key)) map.set(key, { label, sub, rows: [] });
      map.get(key).rows.push(row);
    }
    // Sort: FY descending (newest first), others alphabetical
    return [...map.entries()].sort((a, b) =>
      groupBy === 'fy'
        ? b[0].localeCompare(a[0])
        : a[1].label.localeCompare(b[1].label)
    );
  }, [filtered, groupBy]);

  const toggle = (key) => setExpanded(e => ({ ...e, [key]: !e[key] }));

  const handleSave = async (formOrArray) => {
    setSaving(true);
    try {
      if (Array.isArray(formOrArray)) {
        // Bulk: save all in parallel
        await Promise.all(formOrArray.map(f => api('POST', '/shortlists', f, token)));
      } else if (modal?.data?.id) {
        await api('PUT', `/shortlists/${modal.data.id}`, formOrArray, token);
      } else {
        await api('POST', '/shortlists', formOrArray, token);
      }
      await load();
      setModal(null);
    } catch(e) { toast.error(e.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleBillSave = async (id, patch) => {
    setSaving(true);
    try {
      const existing = rows.find(r => r.id === id);
      await api('PUT', `/shortlists/${id}`, { ...existing, ...patch }, token);
      await load();
    } catch(e) { toast.error(e.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await api('DELETE', `/shortlists/${modal.data.id}`, null, token);
      await load();
      setModal(null);
    } catch(e) { toast.error(e.message || 'Delete failed'); }
    finally { setSaving(false); }
  };

  // Sort institutes alphabetically for the dropdown
  const sortedInstitutes = useMemo(() =>
    [...institutes].sort((a,b) => a.name.localeCompare(b.name)), [institutes]);

  /** Filter select: sized to content, tinted while it is actually narrowing. */
  const fSel = (active, min) => ({
    width:'auto', minWidth:min, maxWidth:210, flexShrink:0, fontSize:12.5,
    padding:'6px 30px 6px 11px', borderRadius:8, cursor:'pointer', lineHeight:1.4,
    border:`1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
    background: active ? 'var(--primary-light,#eff6ff)' : 'var(--surface)',
    color: active ? 'var(--primary)' : 'var(--text)',
    fontWeight: active ? 600 : 400,
  });

  const currentFY = getCurrentFY();

  /**
   * Open on the current fiscal year, but only once the data is in and only if
   * that year is actually represented. Defaulting blind would greet anyone
   * whose registry has nothing for the current year with an empty page and a
   * filter they never set.
   */
  useEffect(() => {
    if (fyDefaulted || loading || !rows.length) return;
    setFyDefaulted(true);
    const years = new Set([
      ...rows.map(r => r.fy).filter(Boolean),
      ...standingLists.map(l => l.fy).filter(Boolean),
    ]);
    if (!years.size) return;
    // The year set in Master Data when there is one; otherwise the newest year
    // actually on record, so "the active year" still means something on a
    // registry where nobody has configured it.
    const target = currentFY && years.has(currentFY)
      ? currentFY
      : [...years].sort().at(-1);
    if (target) setFilterFY(target);
  }, [rows, standingLists, loading, currentFY, fyDefaulted]);

  /**
   * Standing lists to show. With a filter on, a list with nothing matching is
   * hidden rather than left as an empty header implying it has no firms at all.
   */
  const visibleStandingLists = useMemo(() => {
    const anyFilter = !!(filterOrg || filterFirm || filterStatus || filterFY || search);
    if (!anyFilter) return standingLists;
    return standingLists.filter(l => (firmsByList.get(String(l.id)) || []).length > 0);
  }, [standingLists, firmsByList, filterOrg, filterFirm, filterStatus, filterFY, search]);

  /**
   * Everything on screen: the firms under each visible standing list, plus any
   * legacy rows that belong to no list.
   *
   * The count and the print action used to read `filtered`, which excludes
   * every row carrying a standing_list_id — and since all 143 rows in this
   * registry sit under a list, that read "0 entries" permanently and printed
   * nothing, whatever the filters said.
   */
  const visibleRows = useMemo(() => {
    const fromLists = visibleStandingLists.flatMap(l => firmsByList.get(String(l.id)) || []);
    return [...fromLists, ...filtered];
  }, [visibleStandingLists, firmsByList, filtered]);

  return (
    <div className="fade-in" style={{display:'flex', flexDirection:'column', gap:20}}>
      {showPageBuilder && <LetterBuilderWrapper row={rows[0] || {}} onClose={() => setShowPageBuilder(false)} allRows={rows}/>}

      {/* ── Header ── */}
      <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16, flexWrap:'wrap'}}>
        <div>
          <div style={{fontSize:22, fontWeight:600, color:'var(--text)', letterSpacing:-0.3}}>Shortlisting</div>
          <div style={{fontSize:13, color:'var(--text3)', marginTop:3}}>
            Track firms shortlisted for standing lists across organizations
          </div>
        </div>
        <div style={{display:'flex', gap:8, alignItems:'center'}}>
          {isSuperAdmin && (
            <Btn className="btn btn-secondary" onClick={() => setShowPageBuilder(true)}>
              <span className="material-icons-round" style={{fontSize:16}}>edit_note</span>
              Letter Builder
            </Btn>
          )}
          {canEdit && (
            <Btn className="btn btn-primary" onClick={() => setListModal({ type:'new' })}>
              <span className="material-icons-round" style={{fontSize:16}}>playlist_add</span>
              New Shortlist
            </Btn>
          )}
        </div>
      </div>

      {/* ── Standing lists: create the list, then assign firms to it ── */}
      {!loading && visibleStandingLists.length > 0 && (
        <div style={{display:'flex', flexDirection:'column', gap:10, marginBottom:16}}>
          {visibleStandingLists.map(list => {
            const firms = firmsByList.get(String(list.id)) || [];
            const open  = expanded[`sl:${list.id}`] === true;
            return (
              <div key={list.id} style={{background:'var(--surface)', borderRadius:16, boxShadow:'var(--shadow)', overflow:'hidden'}}>
                <div style={{display:'flex', alignItems:'center', gap:10, padding:'12px 18px'}}>
                  <button onClick={() => toggle(`sl:${list.id}`)}
                    style={{background:'none', border:'none', cursor:'pointer', color:'var(--text3)', display:'flex', padding:0}}>
                    <span className="material-icons-round">{open ? 'expand_more' : 'chevron_right'}</span>
                  </button>
                  <div style={{flex:1, minWidth:0, cursor:'pointer'}} onClick={() => toggle(`sl:${list.id}`)}>
                    <div style={{fontSize:14.5, fontWeight:600, color:'var(--text)'}}>
                      {list.client_name_manual || 'Untitled organization'}
                    </div>
                    <div style={{fontSize:12, color:'var(--text3)', marginTop:2}}>
                      {[list.name, list.fy && `FY ${list.fy}`, bsDateLabel(list.list_date)].filter(Boolean).join('  ·  ')}
                    </div>
                  </div>
                  <span style={{fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:100,
                    background: firms.length ? 'var(--primary-light)' : 'var(--bg2)',
                    color: firms.length ? 'var(--primary-dark)' : 'var(--text3)', flexShrink:0}}>
                    {firms.length} firm{firms.length === 1 ? '' : 's'}
                  </span>
                  {canEdit && (
                    <>
                      <Btn className="btn btn-secondary" style={{fontSize:12}}
                        onClick={() => setListModal({ type:'assign', data:list })}>
                        <span className="material-icons-round" style={{fontSize:15}}>group_add</span>
                        Assign firms
                      </Btn>
                      <button title="Edit shortlist" onClick={() => setListModal({ type:'edit', data:list })}
                        style={{width:30, height:30, borderRadius:50, border:'none', background:'transparent', color:'var(--text3)', cursor:'pointer'}}>
                        <span className="material-icons-round" style={{fontSize:17}}>edit</span>
                      </button>
                      {isAdmin && (
                        <button title="Delete shortlist" onClick={() => setListModal({ type:'delete', data:list })}
                          style={{width:30, height:30, borderRadius:50, border:'none', background:'transparent', color:'var(--text3)', cursor:'pointer'}}
                          onMouseEnter={e=>{e.currentTarget.style.background='var(--error-light)'; e.currentTarget.style.color='var(--error)';}}
                          onMouseLeave={e=>{e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--text3)';}}>
                          <span className="material-icons-round" style={{fontSize:17}}>delete</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
                {open && (
                  firms.length === 0 ? (
                    <div style={{padding:'18px 20px', borderTop:'1px solid var(--border)', fontSize:13, color:'var(--text3)'}}>
                      No firms assigned yet — use “Assign firms” to add them.
                    </div>
                  ) : (
                    <>
                      <TableHead groupBy="org"/>
                      {firms.map((row, i) => (
                        <ShortlistRow
                          key={row.id} row={row} idx={i}
                          canEdit={canEdit} isAdmin={isAdmin} isSuperAdmin={isSuperAdmin}
                          showFY={false}
                          onEdit={(r) => setModal({ type:'edit', data:r })}
                          onDelete={(r) => setModal({ type:'delete', data:r })}
                          onBillSave={handleBillSave}
                          saving={saving}
                          token={token}
                        />
                      ))}
                    </>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}

      {listModal?.type === 'delete' ? (() => {
        const n = (allFirmsByList.get(String(listModal.data.id)) || []).length;
        return (
          <Modal title="Delete shortlist" onClose={() => setListModal(null)} footer={<>
            <Btn className="btn btn-secondary" onClick={() => setListModal(null)}>Cancel</Btn>
            <Btn className="btn btn-danger" disabled={saving} onClick={handleListDelete}>
              {saving ? 'Deleting…' : n > 0 ? `Delete list and ${n} entr${n === 1 ? 'y' : 'ies'}` : 'Delete list'}
            </Btn>
          </>}>
            <div style={{fontSize:14, color:'var(--text)', lineHeight:1.6}}>
              Delete <b>{listModal.data.client_name_manual || 'this shortlist'}</b>
              {listModal.data.name ? <> — {listModal.data.name}</> : null}?
            </div>
            {n > 0 && (
              <div style={{marginTop:12, padding:'10px 14px', borderRadius:10, background:'var(--error-light)', color:'#c0391e', fontSize:13, lineHeight:1.6}}>
                This also permanently deletes the <b>{n}</b> firm entr{n === 1 ? 'y' : 'ies'} assigned to it,
                along with their amounts, documents and remarks. This cannot be undone.
              </div>
            )}
          </Modal>
        );
      })() : listModal?.type === 'assign' ? (
        <AssignFirmsModal
          list={listModal.data}
          institutes={sortedInstitutes}
          assignedIds={new Set((allFirmsByList.get(String(listModal.data.id)) || []).map(r => r.institute_id))}
          onSave={handleAssignFirms}
          onClose={() => setListModal(null)}
          saving={saving}
        />
      ) : listModal ? (
        <StandingListModal
          list={listModal.type === 'edit' ? listModal.data : null}
          onSave={handleListSave}
          onClose={() => setListModal(null)}
          saving={saving}
        />
      ) : null}

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
        <select value={filterOrg} onChange={e => setFilterOrg(e.target.value)} style={fSel(!!filterOrg, 170)}>
          <option value="">All organizations</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.shortName || c.short_name || c.fullName || c.full_name}</option>)}
        </select>

        {/* Filter: Firm */}
        <select value={filterFirm} onChange={e => setFilterFirm(e.target.value)} style={fSel(!!filterFirm, 170)}>
          <option value="">All firms</option>
          {sortedInstitutes.map(i => <option key={i.id} value={i.id}>{i.acronym ? `[${i.acronym}] ` : ''}{i.name}</option>)}
        </select>

        {/* Filter: FY */}
        <select value={filterFY} onChange={e => setFilterFY(e.target.value)} style={fSel(!!filterFY, 120)}>
          <option value="">All FYs</option>
          {FYS.map(fy => <option key={fy} value={fy}>{fy}</option>)}
        </select>

        {/* Filter: Status */}
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={fSel(!!filterStatus, 130)}>
          <option value="">All statuses</option>
          <option value="Active">Active</option>
          <option value="Expired">Expired</option>
          <option value="Pending">Pending</option>
        </select>

        {/* The FY filter applies itself on load, so there has to be an obvious
            way out of it — otherwise a year with no data looks like a bug. */}
        {(filterOrg || filterFirm || filterFY || filterStatus) && (
          <button onClick={() => { setFilterOrg(''); setFilterFirm(''); setFilterFY(''); setFilterStatus(''); }}
            title="Clear all filters"
            style={{display:'inline-flex', alignItems:'center', gap:4, background:'none', border:'none',
              cursor:'pointer', color:'var(--text3)', fontSize:12, fontWeight:600, padding:'4px 2px', flexShrink:0}}>
            <span className="material-icons-round" style={{fontSize:14}}>close</span>Clear
          </button>
        )}

        <div style={{height:28, width:1, background:'var(--border)', flexShrink:0}}/>

        {/* Group by toggle */}
        <div style={{display:'flex', background:'var(--bg)', borderRadius:100, padding:3, gap:2, flexShrink:0}}>
          {[['fy','By FY'],['org','By Organization'],['firm','By Firm']].map(([v,lbl]) => (
            <button key={v} onClick={() => setGroupBy(v)} style={{
              padding:'5px 14px', borderRadius:100, border:'none', cursor:'pointer',
              fontFamily:'inherit', fontSize:12.5, fontWeight:500, transition:'all .15s',
              background: groupBy===v ? 'var(--surface)' : 'transparent',
              color: groupBy===v ? 'var(--primary)' : 'var(--text3)',
              boxShadow: groupBy===v ? 'var(--shadow)' : 'none',
            }}>{lbl}</button>
          ))}
        </div>

        {/* Expand / collapse all groups */}
        <div style={{display:'flex', gap:2, background:'var(--bg)', borderRadius:100, padding:3, flexShrink:0}}>
          {[['expand','Expand all','unfold_more'],['collapse','Collapse all','unfold_less']].map(([act,lbl,icon]) => (
            <button key={act} title={lbl}
              onClick={() => setExpanded(act === 'expand'
                ? Object.fromEntries(grouped.map(([k]) => [k, true]))
                : {})}
              style={{
                display:'flex', alignItems:'center', gap:4,
                padding:'5px 12px', borderRadius:100, border:'none', cursor:'pointer',
                fontFamily:'inherit', fontSize:12.5, fontWeight:500,
                background:'transparent', color:'var(--text3)', transition:'all .15s',
              }}
              onMouseEnter={e=>{ e.currentTarget.style.background='var(--surface)'; e.currentTarget.style.color='var(--primary)'; }}
              onMouseLeave={e=>{ e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--text3)'; }}>
              <span className="material-icons-round" style={{fontSize:16}}>{icon}</span>
              {lbl}
            </button>
          ))}
        </div>

        <div style={{fontSize:12, color:'var(--text3)', whiteSpace:'nowrap', flexShrink:0}}>
          {visibleRows.length} {visibleRows.length === 1 ? 'entry' : 'entries'}
        </div>

        {/* Print report — only for firm/org views, not FY */}
        {groupBy !== 'fy' && visibleRows.length > 0 && (
          <button
            title="Print report"
            onClick={() => printShortlistReport(visibleRows, groupBy, {
              org:    filterOrg    ? (clients.find(c => String(c.id) === filterOrg)?.short_name || filterOrg) : '',
              firm:   filterFirm   ? (sortedInstitutes.find(i => String(i.id) === filterFirm)?.name || filterFirm) : '',
              fy:     filterFY,
              status: filterStatus,
              search,
            })}
            style={{
              display:'flex', alignItems:'center', gap:5,
              padding:'6px 14px', borderRadius:100, border:'1px solid var(--border)',
              background:'var(--surface)', color:'var(--text2)', cursor:'pointer',
              fontFamily:'inherit', fontSize:12.5, fontWeight:500, flexShrink:0,
              transition:'all .15s',
            }}
            onMouseEnter={e=>{ e.currentTarget.style.borderColor='var(--primary)'; e.currentTarget.style.color='var(--primary)'; }}
            onMouseLeave={e=>{ e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.color='var(--text2)'; }}>
            <span className="material-icons-round" style={{fontSize:16}}>print</span>
            Print Report
          </button>
        )}
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div style={{textAlign:'center', padding:60, color:'var(--text3)'}}>
          <span className="spin material-icons-round" style={{fontSize:28}}>sync</span>
        </div>
      ) : filtered.length === 0 ? (
        standingLists.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon"><span className="material-icons-round" style={{fontSize:44, opacity:.3}}>playlist_add_check</span></div>
            <div className="empty-state-title">No shortlists yet</div>
            <div className="empty-state-sub">{canEdit ? 'Click "New Shortlist" to create one, then assign firms to it.' : 'No records found.'}</div>
          </div>
        )
      ) : (
        <div style={{display:'flex', flexDirection:'column', gap:10}}>
          {grouped.map(([key, group]) => {
            // Default collapsed — expanding every group up front renders all
            // rows at once and makes the page slow to load.
            const isOpen = expanded[key] === true;
            // For org grouping, extract client_id / client_name_manual from first row
            const firstRow = group.rows[0];
            const orgClientId   = groupBy === 'org' ? (firstRow?.client_id || null) : null;
            const orgClientManual = groupBy === 'org' && !orgClientId ? (firstRow?.client_name_manual || null) : null;
            const showContracts = groupBy === 'org' && (orgClientId || orgClientManual);
            return (
              <div key={key} style={{background:'var(--surface)', borderRadius:16, boxShadow:'var(--shadow)', overflow:'hidden'}}>
                <GroupHeader
                  label={group.label}
                  sub={group.sub || null}
                  count={group.rows.length}
                  expanded={isOpen}
                  onToggle={() => toggle(key)}
                  isCurrent={groupBy === 'fy' && currentFY && key === currentFY}
                />
                {isOpen && (
                  <>
                    <TableHead groupBy={groupBy} />
                    {group.rows.map((row, i) => (
                      <ShortlistRow
                        key={row.id} row={row} idx={i}
                        canEdit={canEdit} isAdmin={isAdmin} isSuperAdmin={isSuperAdmin}
                        showFY={groupBy !== 'fy'}
                        onEdit={(r) => setModal({ type:'edit', data:r })}
                        onDelete={(r) => setModal({ type:'delete', data:r })}
                        onBillSave={handleBillSave}
                        saving={saving}
                        token={token}
                      />
                    ))}
                    {showContracts && (
                      <ContractsPanel
                        clientId={orgClientId}
                        clientNameManual={orgClientManual}
                        groupRows={group.rows}
                        canEdit={canEdit}
                        isAdmin={isAdmin}
                        token={token}
                      />
                    )}
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
          token={token}
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

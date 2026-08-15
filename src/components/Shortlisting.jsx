import { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import Modal from './ui/Modal.jsx';
import { Btn, MdTextField, MdSelect, MdOption, MdToggle } from '../md.jsx';
import { api } from '../utils/api.js';
import { getSession } from '../utils/auth.js';
import { FISCAL_YEARS, getCurrentFY } from '../constants/data.js';

import { fmtDate } from '../utils/format.js';
import { toast } from './ui/Feedback.jsx';
import { statusColor, parseDocUrls, NepaliDatePicker, ConfirmModal } from './shortlisting/common.jsx';
import { ContractsPanel } from './shortlisting/ContractsPanel.jsx';
import { bsDateLabel, openShortlistLetter } from '../utils/neaLetter.js';

const LetterBuilderLazy = lazy(() => import('./LetterBuilder.jsx'));
function LetterBuilderWrapper({ row, onClose, allRows }) {
  return (
    <Suspense fallback={null}>
      <LetterBuilderLazy row={row} token={getSession()?.token} onClose={onClose} allRows={allRows}/>
    </Suspense>
  );
}

const FYS = [...FISCAL_YEARS].reverse(); // newest first

const ACCEPT = 'image/*';
async function uploadToR2(file, token) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/api/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (err.error === 'blank_page') throw new Error('Blank page detected — skipped.');
    throw new Error(err.message || err.error || 'Upload failed');
  }
  return (await res.json()).url;
}
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
                <span style={{ fontSize: 20 }}>📄</span>
                <span style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 600 }}>PDF</span>
              </a>
            ) : (
              <a href={value} target="_blank" rel="noreferrer">
                <img src={value} alt="" style={{ height: 56, maxWidth: 80, objectFit: 'contain', border: '1px solid var(--border)', borderRadius: 6, background: '#fff', padding: 2 }}/>
              </a>
            )}
            <button onClick={() => onChange(null)} style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: '#e53935', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>✕</button>
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
        {value && <span className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }} onClick={() => onChange(null)}>✕ Remove</span>}
      </div>
      {err && <div style={{ fontSize: 11, color: '#c0391e', marginTop: 4 }}>{err}</div>}
    </div>
  );
}

// Full-screen PDF preview with print / download, shown after generating.
function LetterPreviewModal({ url, filename, onClose }) {
  const frameRef = useRef(null);

  const handlePrint = () => {
    // Chrome's built-in PDF viewer exposes print() on the frame; if the browser
    // blocks it, fall back to opening the PDF in its own tab.
    try {
      const w = frameRef.current?.contentWindow;
      if (w) { w.focus(); w.print(); return; }
    } catch {}
    window.open(url, '_blank', 'noopener');
  };

  return (
    <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:1300, display:'flex', flexDirection:'column'}}>
      <div style={{display:'flex', alignItems:'center', gap:10, padding:'10px 20px', background:'var(--surface)', borderBottom:'1px solid var(--border)', flexShrink:0}}>
        <div style={{fontWeight:700, fontSize:16, color:'var(--text)'}}>Letter Preview</div>
        <div style={{marginLeft:'auto', display:'flex', gap:8, alignItems:'center'}}>
          <Btn className="btn btn-secondary" onClick={handlePrint}>
            <span className="material-icons-round" style={{fontSize:16}}>print</span> Print
          </Btn>
          <a href={url} download={filename}
            className="btn btn-primary"
            style={{textDecoration:'none', display:'inline-flex', alignItems:'center', gap:6}}>
            <span className="material-icons-round" style={{fontSize:16}}>download</span> Download
          </a>
          <button onClick={onClose} style={{background:'none', border:'none', cursor:'pointer', fontSize:22, lineHeight:1, color:'var(--text3)', padding:'0 4px'}}>×</button>
        </div>
      </div>
      <iframe ref={frameRef} src={url} title="Letter preview"
        style={{flex:1, border:'none', background:'#666', width:'100%'}}/>
    </div>
  );
}

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
            <span style={{ color: 'var(--text3)', fontSize: 18, lineHeight: 1, userSelect: 'none' }}>▾</span>
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
              <span style={{color:'var(--text3)', fontSize:15, flexShrink:0}}>🔍</span>
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
const DOC_LABELS = {
  ocrReg:   'OCR दर्ता प्रमाणपत्र',
  ocrRen:   'OCR नवीकरण प्रमाणपत्र',
  llReg:    'स्थानीय तह दर्ता प्रमाणपत्र',
  llRen:    'स्थानीय तह नवीकरण प्रमाणपत्र',
  vat:      'भ्याट दर्ता प्रमाणपत्र',
  taxClear: 'कर चुक्ता प्रमाणपत्र',
  vatExt:   'भ्याट म्याद थप प्रमाणपत्र',
  ctevtAff: 'CTEVT सम्बन्धन पत्र',
  ctevtRen: 'CTEVT नवीकरण पत्र',
};

const SERVICE_TYPES = [
  'सीपमूलक तथा व्यावसायिक तालिम कार्यक्रमहरु सञ्चालन',
  'परामर्श सेवा',
  'अन्य सेवा',
];

// Create / edit a standing list. Firms are assigned separately, so a list can
// exist before any firm is on it.
const LETTER_TYPES = [
  { value: 'basic',     label: 'Basic Shortlisting' },
  { value: 'nea_ssemd', label: 'NEA SSEMD' },
  { value: 'nea_essd',  label: 'NEA ESSD' },
];

function StandingListModal({ list, onSave, onClose, saving }) {
  const [f, setF] = useState(() => ({
    letter_type:          list?.letter_type          || 'basic',
    addressee:            list?.addressee            || '',
    client_name_manual:   list?.client_name_manual   || '',
    client_name2_manual:  list?.client_name2_manual  || '',
    client_address_manual: list?.client_address_manual || '',
    name:        list?.name || '',
    fy:          list?.fy || getCurrentFY(),
    list_date:   list?.list_date ? String(list.list_date).slice(0, 10) : new Date().toISOString().slice(0, 10),
    valid_until: list?.valid_until ? String(list.valid_until).slice(0, 10) : '',
    status:      list?.status || 'Active',
    remarks:     list?.remarks || '',
  }));
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const valid = !!f.client_name_manual.trim();

  // Build the live letter-address preview
  const addrLine1 = `श्री ${f.addressee.trim() || 'कार्यालय प्रमुख'} ज्यू,`;
  const addrLines = [
    addrLine1,
    f.client_name_manual.trim() || '…',
    f.client_name2_manual.trim() || null,
    f.client_address_manual.trim() || '…',
  ].filter(Boolean);

  return (
    <Modal title={list ? 'Edit shortlist' : 'New shortlist'} onClose={onClose} footer={<>
      <Btn className="btn btn-secondary" onClick={onClose}>Cancel</Btn>
      <Btn className="btn btn-primary" disabled={!valid || saving}
        onClick={() => onSave({
          ...f,
          letter_type:           f.letter_type || 'basic',
          addressee:             f.addressee.trim() || null,
          client_name_manual:    f.client_name_manual.trim(),
          client_name2_manual:   f.client_name2_manual.trim() || null,
          client_address_manual: f.client_address_manual.trim() || null,
        })}>
        {saving ? 'Saving…' : list ? 'Save changes' : 'Create shortlist'}
      </Btn>
    </>}>
      <div style={{display:'flex', flexDirection:'column', gap:12}}>
        {/* Letter format */}
        <div className="form-group">
          <MdSelect label="Letter format" value={f.letter_type} onChange={e=>set('letter_type', e.target.value)}>
            {LETTER_TYPES.map(t => <MdOption key={t.value} value={t.value}>{t.label}</MdOption>)}
          </MdSelect>
        </div>
        {/* Address block — printed verbatim at the top of the generated letter */}
        <div className="form-group">
          <MdTextField label="Addressee title" value={f.addressee}
            onChange={e=>set('addressee', e.target.value)} placeholder="e.g. कार्यालय प्रमुख"/>
          <div style={{fontSize:11, color:'var(--text3)', marginTop:4}}>
            Printed as: <b>श्री {f.addressee.trim() || 'कार्यालय प्रमुख'} ज्यू,</b>
          </div>
        </div>
        <div className="form-group">
          <MdTextField label="Organization name *" value={f.client_name_manual}
            onChange={e=>set('client_name_manual', e.target.value)} placeholder="e.g. नेपाल विद्युत प्राधिकरण"/>
        </div>
        <div className="form-group">
          <MdTextField label="Department / Level 2 (optional)" value={f.client_name2_manual}
            onChange={e=>set('client_name2_manual', e.target.value)} placeholder="e.g. वातावरण तथा सामाजिक अध्ययन विभाग"/>
        </div>
        <div className="form-group">
          <MdTextField label="Organization address" value={f.client_address_manual}
            onChange={e=>set('client_address_manual', e.target.value)} placeholder="e.g. लाजिम्पाट, काठमाडौं"/>
        </div>
        <div style={{
          fontSize:12, color:'var(--text2)', background:'var(--bg)', border:'1px solid var(--border)',
          borderRadius:8, padding:'8px 12px', lineHeight:1.7, marginTop:-4,
        }}>
          <div style={{fontSize:11, color:'var(--text3)', marginBottom:4}}>Printed in the letter as:</div>
          {addrLines.map((l, i) => <div key={i}>{l}</div>)}
        </div>
        <div className="form-group">
          <MdTextField label="Shortlist name" value={f.name} onChange={e=>set('name', e.target.value)}
            placeholder="e.g. Standing List 2081/82"/>
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <MdSelect label="Fiscal year" value={f.fy} onChange={e=>set('fy', e.target.value)}>
              {FYS.map(y => <MdOption key={y} value={y}>{y}</MdOption>)}
            </MdSelect>
          </div>
          <div className="form-group">
            <MdSelect label="Status" value={f.status} onChange={e=>set('status', e.target.value)}>
              {['Active','Expired','Pending'].map(s => <MdOption key={s} value={s}>{s}</MdOption>)}
            </MdSelect>
          </div>
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <MdTextField type="date" label="Shortlist date" value={f.list_date} onChange={e=>set('list_date', e.target.value)}/>
          </div>
          <div className="form-group">
            <MdTextField type="date" label="Valid until (optional)" value={f.valid_until} onChange={e=>set('valid_until', e.target.value)}/>
          </div>
        </div>
        <div className="form-group">
          <MdTextField label="Remarks" value={f.remarks} onChange={e=>set('remarks', e.target.value)}/>
        </div>
      </div>
    </Modal>
  );
}

// Bulk-assign firms to an existing standing list.
function AssignFirmsModal({ list, institutes, assignedIds, onSave, onClose, saving }) {
  const [picked, setPicked] = useState(() => new Set(assignedIds));
  const [q, setQ] = useState('');

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return institutes;
    return institutes.filter(i =>
      `${i.name} ${i.acronym || ''}`.toLowerCase().includes(needle)
    );
  }, [institutes, q]);

  const toggle = id => setPicked(s => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const toAdd    = [...picked].filter(id => !assignedIds.has(id));
  const toRemove = [...assignedIds].filter(id => !picked.has(id));
  const changed  = toAdd.length + toRemove.length;

  return (
    <Modal title={`Manage firms${list?.name ? ` — ${list.name}` : ''}`} onClose={onClose} footer={<>
      <Btn className="btn btn-secondary" onClick={onClose}>Cancel</Btn>
      <Btn className="btn btn-primary" disabled={!changed || saving}
        onClick={() => onSave(toAdd, toRemove)}>
        {saving ? 'Saving…' : changed ? `Save (${toAdd.length > 0 ? `+${toAdd.length}` : ''}${toAdd.length > 0 && toRemove.length > 0 ? ' ' : ''}${toRemove.length > 0 ? `−${toRemove.length}` : ''})` : 'No changes'}
      </Btn>
    </>}>
      <div style={{display:'flex', flexDirection:'column', gap:10}}>
        <MdTextField label="Search firms" value={q} onChange={e=>setQ(e.target.value)} placeholder="Name or acronym"/>
        <div style={{fontSize:12, color:'var(--text3)'}}>
          {picked.size} of {institutes.length} firm{institutes.length !== 1 ? 's' : ''} selected
        </div>
        <div style={{maxHeight:340, overflowY:'auto', border:'1px solid var(--border)', borderRadius:10}}>
          {visible.length === 0 ? (
            <div style={{padding:20, textAlign:'center', color:'var(--text3)', fontSize:13}}>
              No firms match your search.
            </div>
          ) : visible.map(i => {
            const on = picked.has(i.id);
            return (
              <label key={i.id} style={{
                display:'flex', alignItems:'center', gap:10, padding:'9px 12px', cursor:'pointer',
                borderBottom:'1px solid var(--border)',
                background: on ? 'color-mix(in srgb, var(--primary) 10%, transparent)' : 'transparent',
              }}>
                <input type="checkbox" checked={on} onChange={()=>toggle(i.id)} style={{accentColor:'var(--primary)'}}/>
                <span style={{fontSize:13, color:'var(--text)'}}>
                  {i.acronym ? <b>[{i.acronym}] </b> : ''}{i.name}
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}

function ViewDocumentsModal({ instituteId, token, onClose }) {
  const [inst, setInst] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    api('GET', `/institutes/${instituteId}`, null, token)
      .then(r => { if (!cancelled) setInst(r); })
      .catch(e => { if (!cancelled) setErr(e.message || 'Could not load documents.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [instituteId, token]);

  const Thumb = ({ src }) => {
    const isPdf = src && (src.toLowerCase().includes('.pdf') || src.toLowerCase().includes('application/pdf'));
    return (
      <a href={src} target="_blank" rel="noreferrer" style={{
        display:'flex', alignItems:'center', justifyContent:'center',
        width:64, height:64, borderRadius:8, overflow:'hidden',
        border:'1.5px solid var(--border)', background:'#fff', flexShrink:0,
        textDecoration:'none', gap:4, flexDirection:'column',
      }}>
        {isPdf
          ? <>
              <span className="material-icons-round" style={{fontSize:28, color:'var(--error)'}}>picture_as_pdf</span>
              <span style={{fontSize:9, color:'var(--text2)', fontWeight:600}}>PDF</span>
            </>
          : <img src={src} alt="" style={{width:'100%', height:'100%', objectFit:'contain', display:'block'}}/>
        }
      </a>
    );
  };

  const Row = ({ label, urls }) => (
    <div style={{display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderBottom:'1px solid var(--border)'}}>
      <div style={{flex:'0 0 220px', fontSize:13, color: urls.length ? 'var(--text)' : 'var(--text3)', fontWeight: urls.length ? 600 : 400}}>
        {label}
      </div>
      <div style={{flex:1, display:'flex', gap:8, flexWrap:'wrap'}}>
        {urls.length
          ? urls.map((u, i) => <Thumb key={i} src={u}/>)
          : <span style={{fontSize:12, color:'var(--text3)', fontStyle:'italic'}}>Not uploaded</span>}
      </div>
    </div>
  );

  const docRows = inst ? [
    { label: 'Letterhead',            urls: parseDocUrls(inst.letterhead) },
    { label: 'Logo',                  urls: parseDocUrls(inst.logo) },
    { label: 'Authorized Signature',  urls: parseDocUrls(inst.sign) },
    { label: 'Stamp / Seal',          urls: parseDocUrls(inst.stamp) },
    ...Object.entries({
      ocrReg:   inst.ocr_registration,
      ocrRen:   inst.ocr_renewal,
      llReg:    inst.local_level_registration,
      llRen:    inst.local_level_renewal,
      vat:      inst.vat_registration,
      taxClear: inst.tax_clearance_doc,
      vatExt:   inst.vat_extension,
      ctevtAff: inst.ctevt_affiliation,
      ctevtRen: inst.ctevt_renewal,
    }).map(([k, src]) => ({ label: DOC_LABELS[k], urls: parseDocUrls(src) })),
  ] : [];

  return (
    <Modal title={inst ? `Documents — ${inst.acronym || inst.name}` : 'Documents'} onClose={onClose} footer={
      <Btn className="btn btn-secondary" onClick={onClose}>Close</Btn>
    }>
      {loading ? (
        <div style={{textAlign:'center', padding:30, color:'var(--text3)'}}>
          <span className="spin material-icons-round" style={{fontSize:24}}>sync</span>
        </div>
      ) : err ? (
        <div style={{color:'#c0391e', fontSize:13, padding:'8px 4px'}}>{err}</div>
      ) : (
        <div style={{border:'1px solid var(--border)', borderRadius:10, overflow:'hidden'}}>
          {docRows.map((r, i) => <Row key={i} label={r.label} urls={r.urls}/>)}
        </div>
      )}
    </Modal>
  );
}

function LetterOptsModal({ row, token, onClose, onOpenBuilder }) {
  const [inclSign, setInclSign]   = useState(false);
  const [inclStamp, setInclStamp] = useState(false);
  const [inclLh, setInclLh]       = useState(true);
  const [inclDocs, setInclDocs]   = useState({});
  const [freshRow, setFreshRow]   = useState(row);
  const [instLoading, setInstLoading] = useState(true);
  const [instFetchErr, setInstFetchErr] = useState(false);

  // The shortlist list query omits the institute's images and document URLs —
  // they're only needed here, and carrying them on every row made #shortlisting
  // slow to load. Fetch the full institute on demand instead.
  useEffect(() => {
    const instId = row.institute_id;
    if (!instId) { setInstLoading(false); return; }
    let cancelled = false;
    setInstLoading(true);
    api('GET', `/institutes/${instId}`, null, token)
      .then(inst => {
        if (cancelled) return;
        // NOTE: this endpoint returns raw snake_case columns. It previously read
        // inst.letterTopMargin etc., which were always undefined — so the
        // configured page margins were silently discarded.
        // api() returns raw snake_case JSON — no normalization layer here.
        // Use ?? r.* for margins so a null DB value falls back to whatever
        // the shortlist list JOIN already provided (same column, same table).
        setFreshRow(r => ({
          ...r,
          institute_letter_top_margin:     inst.letter_top_margin     ?? r.institute_letter_top_margin,
          institute_letter_lr_padding:     inst.letter_lr_padding     ?? r.institute_letter_lr_padding,
          institute_letter_bottom_padding: inst.letter_bottom_padding ?? r.institute_letter_bottom_padding,
          institute_service_type:          inst.service_type          || r.institute_service_type,
          institute_logo:       inst.logo,
          institute_letterhead: inst.letterhead,
          institute_sign:       inst.sign,
          institute_stamp:      inst.stamp,
          institute_ocr_registration:         inst.ocr_registration,
          institute_ocr_renewal:              inst.ocr_renewal,
          institute_local_level_registration: inst.local_level_registration,
          institute_local_level_renewal:      inst.local_level_renewal,
          institute_vat_registration:         inst.vat_registration,
          institute_vat_extension:            inst.vat_extension,
          institute_ctevt_affiliation:        inst.ctevt_affiliation,
          institute_ctevt_renewal:            inst.ctevt_renewal,
          institute_tax_clearance_doc:        inst.tax_clearance_doc,
        }));
      })
      .catch(() => { if (!cancelled) setInstFetchErr(true); })
      .finally(() => { if (!cancelled) setInstLoading(false); });
    return () => { cancelled = true; };
  }, [row.institute_id, token]);

  const hasDocs = useMemo(() => ({
    ocrReg:   !!freshRow.institute_ocr_registration,
    ocrRen:   !!freshRow.institute_ocr_renewal,
    llReg:    !!freshRow.institute_local_level_registration,
    llRen:    !!freshRow.institute_local_level_renewal,
    vat:      !!freshRow.institute_vat_registration,
    taxClear: !!freshRow.institute_tax_clearance_doc,
    vatExt:   !!freshRow.institute_vat_extension,
    ctevtAff: !!freshRow.institute_ctevt_affiliation,
    ctevtRen: !!freshRow.institute_ctevt_renewal,
  }), [freshRow]);

  // Default every available document / image to checked once they arrive
  useEffect(() => { setInclDocs({ ...hasDocs }); }, [hasDocs]);
  useEffect(() => {
    setInclSign(!!freshRow.institute_sign);
    setInclStamp(!!freshRow.institute_stamp);
    setInclLh(!!freshRow.institute_letterhead);
  }, [freshRow.institute_sign, freshRow.institute_stamp, freshRow.institute_letterhead]);

  const anyDocs = Object.values(hasDocs).some(Boolean);
  const toggle = k => setInclDocs(d => ({...d, [k]: !d[k]}));

  const [pdfUrl, setPdfUrl] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState(null);

  // Release the blob URL when this modal goes away
  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

  const [skipWarning, setSkipWarning] = useState([]);

  const handleGenerate = async () => {
    setGenerating(true);
    setGenError(null);
    try {
      const { url, skipped } = await openShortlistLetter(freshRow, {
        includeSign: inclSign, includeStamp: inclStamp, includeLh: inclLh,
        docs: inclDocs, serviceType: freshRow.institute_service_type,
      });
      if (skipped.length) setSkipWarning(skipped);
      setPdfUrl(url);
    } catch (e) {
      console.error('[letter] generation failed:', e);
      setGenError(e?.message || 'Letter generation failed. Check the browser console for details.');
    } finally { setGenerating(false); }
  };

  if (pdfUrl) {
    const name = `${freshRow.institute_acronym || freshRow.institute_name || 'shortlist'}-letter.pdf`;
    return (
      <>
        {skipWarning.length > 0 && (
          <div style={{position:'fixed', inset:0, zIndex:1400, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,.4)'}}>
            <div style={{background:'var(--surface)', borderRadius:12, padding:'24px 28px', maxWidth:420, width:'90%', boxShadow:'0 8px 32px rgba(0,0,0,.25)'}}>
              <div style={{fontWeight:700, fontSize:15, color:'var(--error)', marginBottom:10}}>Some documents could not be attached</div>
              <div style={{fontSize:13, color:'var(--text2)', marginBottom:12, lineHeight:1.6}}>
                The following selected documents were skipped because the file could not be fetched, is password-protected, or is in an unsupported format:
              </div>
              <ul style={{paddingLeft:18, margin:'0 0 16px', fontSize:13, color:'var(--text)'}}>
                {skipWarning.map(l => <li key={l}>{l}</li>)}
              </ul>
              <div style={{fontSize:12, color:'var(--text3)', marginBottom:16}}>
                Re-upload the file in the firm's profile page (Documents tab) to fix this.
              </div>
              <button className="btn btn-primary" style={{width:'100%'}} onClick={() => setSkipWarning([])}>View Letter Anyway</button>
            </div>
          </div>
        )}
        <LetterPreviewModal url={pdfUrl} filename={name} onClose={onClose}/>
      </>
    );
  }

  return (
    <Modal title="Generate Letter" onClose={onClose} footer={<>
      <Btn className="btn btn-secondary" onClick={onClose}>Cancel</Btn>
      {onOpenBuilder && <Btn className="btn btn-secondary" onClick={() => { onClose(); onOpenBuilder(); }}>✏ Builder</Btn>}
      <Btn className="btn btn-primary" onClick={handleGenerate} disabled={instLoading || generating}>
        {generating ? 'Generating…' : instLoading ? 'Loading…' : 'Generate Preview'}
      </Btn>
    </>}>
      <div style={{display:'flex', flexDirection:'column', gap:12}}>

        {genError && (
          <div style={{padding:'10px 14px', borderRadius:8, background:'rgba(220,38,38,.08)', border:'1px solid rgba(220,38,38,.25)', color:'var(--error,#dc2626)', fontSize:13, lineHeight:1.5}}>
            <strong>Generation failed:</strong> {genError}
          </div>
        )}

        {/* Signature toggle */}
        <label style={{display:'flex', alignItems:'center', gap:14, padding:'12px 14px', borderRadius:10, border:'1px solid var(--border)', background:'var(--bg)', cursor:'pointer'}}>
          <MdToggle selected={inclSign} onChange={e=>setInclSign(e.target.selected)} style={{flexShrink:0}}/>
          <div style={{flex:1}}>
            <div style={{fontWeight:600, fontSize:13, color:'var(--text)'}}>Include signature</div>
            <div style={{fontSize:12, color:'var(--text3)', marginTop:2, lineHeight:1.4}}>
              {freshRow.institute_sign ? 'Signature appears in the letter and on each attached document.' : 'No signature uploaded yet — add it in the firm profile.'}
            </div>
          </div>
        </label>

        {/* Stamp toggle */}
        <label style={{display:'flex', alignItems:'center', gap:14, padding:'12px 14px', borderRadius:10, border:'1px solid var(--border)', background:'var(--bg)', cursor:'pointer'}}>
          <MdToggle selected={inclStamp} onChange={e=>setInclStamp(e.target.selected)} style={{flexShrink:0}}/>
          <div style={{flex:1}}>
            <div style={{fontWeight:600, fontSize:13, color:'var(--text)'}}>Include stamp</div>
            <div style={{fontSize:12, color:'var(--text3)', marginTop:2, lineHeight:1.4}}>
              {freshRow.institute_stamp ? 'Stamp appears in the letter and on each attached document.' : 'No stamp uploaded yet — add it in the firm profile.'}
            </div>
          </div>
        </label>

        {/* Letterhead toggle */}
        <label style={{display:'flex', alignItems:'center', gap:14, padding:'12px 14px', borderRadius:10, border:'1px solid var(--border)', background:'var(--bg)', cursor:'pointer'}}>
          <MdToggle selected={inclLh} onChange={e=>setInclLh(e.target.selected)} style={{flexShrink:0}}/>
          <div style={{flex:1}}>
            <div style={{fontWeight:600, fontSize:13, color:'var(--text)'}}>Include letterhead</div>
            <div style={{fontSize:12, color:'var(--text3)', marginTop:2, lineHeight:1.4}}>
              {freshRow.institute_letterhead ? 'Letterhead background image appears behind the letter.' : 'No letterhead uploaded yet — add it in the firm profile.'}
            </div>
          </div>
        </label>

        {/* Document attachments */}
        {anyDocs ? (
          <div style={{borderRadius:10, border:'1px solid var(--border)', overflow:'hidden'}}>
            <div style={{padding:'10px 14px', borderBottom:'1px solid var(--border)', background:'var(--bg)'}}>
              <span style={{fontWeight:600, fontSize:12.5, color:'var(--text2)'}}>Attach supporting documents</span>
            </div>
            <div style={{display:'flex', flexDirection:'column'}}>
              {Object.entries(hasDocs).filter(([,v])=>v).map(([k], i, arr) => (
                <label key={k} style={{
                  display:'flex', alignItems:'center', gap:10, cursor:'pointer', fontSize:13,
                  padding:'9px 14px', background:'var(--surface)', color:'var(--text)',
                  borderBottom: i < arr.length-1 ? '1px solid var(--border)' : 'none',
                  transition:'background .1s',
                }}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--bg)'}
                  onMouseLeave={e=>e.currentTarget.style.background='var(--surface)'}
                >
                  <input type="checkbox" checked={inclDocs[k]||false} onChange={()=>toggle(k)}
                    style={{accentColor:'var(--primary)', flexShrink:0, width:15, height:15}}/>
                  <span>{DOC_LABELS[k]}</span>
                </label>
              ))}
            </div>
          </div>
        ) : (
          <div style={{display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderRadius:10, border:`1px solid ${instFetchErr ? 'var(--error)' : 'var(--border)'}`, background: instFetchErr ? 'var(--error-light)' : 'var(--bg)'}}>
            <span className="material-icons-round" style={{fontSize:18, color: instFetchErr ? 'var(--error)' : 'var(--text3)', opacity: instFetchErr ? 1 : .5}}>
              {instFetchErr ? 'cloud_off' : 'description'}
            </span>
            <div style={{fontSize:12, color: instFetchErr ? 'var(--error)' : 'var(--text3)', lineHeight:1.5}}>
              {instFetchErr
                ? 'Could not load institute details — documents may be unavailable. Check your connection and try again.'
                : 'No documents uploaded for this institute. Upload OCR, VAT, and CTEVT certificates in the institute profile to attach them here.'}
            </div>
          </div>
        )}

      </div>
    </Modal>
  );
}

// ── Contracts & Quotations ────────────────────────────────────────────────────

const QUOTE_STATUS = ['Quoted', 'Awarded', 'Rejected'];
const statusColor2 = s => s === 'Awarded' ? {bg:'var(--success-light)',color:'var(--success)'} : s === 'Rejected' ? {bg:'var(--error-light)',color:'var(--error)'} : {bg:'var(--primary-light)',color:'var(--primary-dark)'};

// Upload button for agreement PDFs or images
function BillModal({ row, token, onSave, onClose, saving }) {
  const [doc, setDoc] = useState(row.shortlist_doc ?? null);
  const [amount, setAmount] = useState(row.contract_amount != null ? String(row.contract_amount) : '');
  const [isFree, setIsFree] = useState(row.contract_amount === 0);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');

  const isPdf = doc && (doc.toLowerCase().endsWith('.pdf') || doc.startsWith('data:application/pdf'));

  const handleFile = async e => {
    const file = e.target.files[0]; if (!file) return;
    e.target.value = ''; setErr(''); setUploading(true);
    try { setDoc(await uploadToR2(file, token)); }
    catch (ex) { setErr(ex.message); }
    finally { setUploading(false); }
  };

  const handleSave = () => {
    onSave({
      shortlist_doc: doc,
      contract_amount: isFree ? 0 : (amount !== '' ? Number(amount) : null),
    });
  };

  return (
    <Modal
      title="Bill / Certificate & Cost"
      onClose={onClose}
      compact
      footer={<>
        <Btn className="btn btn-secondary" onClick={onClose}>Cancel</Btn>
        <Btn className="btn btn-primary" onClick={handleSave} disabled={saving || uploading}>
          {saving ? 'Saving…' : 'Save'}
        </Btn>
      </>}
    >
      <div style={{display:'flex', flexDirection:'column', gap:18}}>

        {/* Doc upload */}
        <div>
          <div style={{fontSize:13, fontWeight:600, color:'var(--text2)', marginBottom:8}}>
            Shortlist Certificate / Bill
            <span style={{fontWeight:400, color:'var(--text3)', marginLeft:6}}>(optional)</span>
          </div>
          <div style={{display:'flex', alignItems:'center', gap:12, flexWrap:'wrap'}}>
            {doc ? (
              <div style={{position:'relative', display:'inline-flex', flexDirection:'column', alignItems:'center'}}>
                {isPdf ? (
                  <a href={doc} target="_blank" rel="noreferrer" style={{height:64, width:64, border:'1px solid var(--border)', borderRadius:8, background:'#fff8f0', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2, textDecoration:'none'}}>
                    <span style={{fontSize:24}}>📄</span>
                    <span style={{fontSize:9, color:'var(--text3)', fontWeight:600}}>PDF</span>
                  </a>
                ) : (
                  <a href={doc} target="_blank" rel="noreferrer">
                    <img src={doc} alt="" style={{height:64, maxWidth:90, objectFit:'contain', border:'1px solid var(--border)', borderRadius:8, background:'#fff', padding:3}}/>
                  </a>
                )}
                <button onClick={() => setDoc(null)} style={{position:'absolute', top:-6, right:-6, width:18, height:18, borderRadius:'50%', background:'#e53935', color:'#fff', border:'none', cursor:'pointer', fontSize:11, display:'flex', alignItems:'center', justifyContent:'center', padding:0}}>✕</button>
              </div>
            ) : (
              <div style={{height:64, width:64, border:'1px dashed var(--border)', borderRadius:8, background:'var(--bg2)', display:'flex', alignItems:'center', justifyContent:'center'}}>
                <span style={{fontSize:11, color:'var(--text3)'}}>None</span>
              </div>
            )}
            <label style={{cursor: uploading ? 'wait' : 'pointer'}}>
              <input type="file" accept={ACCEPT} style={{display:'none'}} onChange={handleFile} disabled={uploading}/>
              <span className="btn btn-secondary btn-sm">{uploading ? 'Uploading…' : doc ? 'Replace' : 'Upload'}</span>
            </label>
            {doc && <span className="btn btn-ghost btn-sm" style={{cursor:'pointer'}} onClick={() => setDoc(null)}>✕ Remove</span>}
          </div>
          {err && <div style={{fontSize:11, color:'#c0391e', marginTop:4}}>{err}</div>}
        </div>

        {/* Cost section */}
        <div style={{borderTop:'1px solid var(--border)', paddingTop:16}}>
          <div style={{fontSize:13, fontWeight:600, color:'var(--text2)', marginBottom:10}}>Shortlisting Charge</div>

          {/* Free toggle */}
          <label style={{display:'flex', alignItems:'center', gap:10, cursor:'pointer', marginBottom:12}}>
            <input type="checkbox" checked={isFree} onChange={e => { setIsFree(e.target.checked); if (e.target.checked) setAmount(''); }}
              style={{accentColor:'var(--primary)', width:16, height:16}}/>
            <span style={{fontSize:13.5, color:'var(--text)'}}>Free / No charge</span>
          </label>

          {!isFree && (
            <MdTextField
              type="number"
              label="Shortlisting Charge (NPR)"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="e.g. 150000"
            />
          )}

          {isFree && (
            <div style={{fontSize:12, color:'var(--success)', background:'var(--success-light)', borderRadius:8, padding:'8px 12px'}}>
              This entry is marked as free / no cost.
            </div>
          )}
        </div>

      </div>
    </Modal>
  );
}

// ── Row ────────────────────────────────────────────────────────────────────────
function ShortlistRow({ row, idx, canEdit, isAdmin, isSuperAdmin, onEdit, onDelete, onBillSave, saving, token, showFY=true }) {
  const sc = statusColor(row.status);
  const altBg = idx % 2 === 1 ? 'var(--bg)' : 'var(--surface)';
  const hoverBg = idx % 2 === 1 ? 'var(--bg2)' : 'var(--bg)';
  const [showLetterOpts, setShowLetterOpts] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [showBill, setShowBill] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const hasBill = !!(row.shortlist_doc);
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
        {(row.client_name || row.client_name_manual)
          ? <>{row.client_short ? <span style={{fontWeight:600}}>{row.client_short}</span> : null}
            {row.client_short && <span style={{color:'var(--text3)'}}> · </span>}
            <span style={row.client_short ? {color:'var(--text3)'} : {}}>
              {row.client_name || row.client_name_manual}
            </span>
            {row.client_name_manual && !row.client_name && (
              <span style={{fontSize:10, marginLeft:5, color:'var(--text3)', fontStyle:'italic'}}>manual</span>
            )}
          </>
          : <span style={{color:'var(--text3)', fontStyle:'italic'}}>No organization</span>
        }
      </div>

      {/* FY — hidden when already grouped by FY */}
      {showFY && (
        <div style={{width:80, fontSize:12, fontWeight:600, color:'var(--primary-dark)', background:'var(--primary-light)', borderRadius:100, padding:'3px 10px', flexShrink:0, textAlign:'center'}}>
          {row.fy || '—'}
        </div>
      )}

      {/* Contract / Bill */}
      <div style={{flex:1, minWidth:0}}>
        {row.contract_amount === 0
          ? <span style={{fontSize:12, color:'var(--success)', fontWeight:600}}>Free</span>
          : row.contract_amount != null
            ? <span style={{fontSize:13, fontWeight:700, color:'var(--text)'}}>NPR {Number(row.contract_amount).toLocaleString()}</span>
            : <span style={{fontSize:12, color:'var(--text3)', fontStyle:'italic'}}>—</span>
        }
        {hasBill && row.shortlist_doc && (
          <a href={typeof row.shortlist_doc === 'string' ? row.shortlist_doc : JSON.parse(row.shortlist_doc)[0]} target="_blank" rel="noreferrer"
            style={{display:'block', fontSize:11, color:'var(--primary)', marginTop:2}}>
            <span className="material-icons-round" style={{fontSize:12, verticalAlign:'middle'}}>receipt</span> View Receipt
          </a>
        )}
      </div>

      {/* Actions */}
      <div style={{display:'flex', gap:2, flexShrink:0}}>
        {showLetterOpts && <LetterOptsModal row={row} token={token} onClose={()=>setShowLetterOpts(false)} onOpenBuilder={isSuperAdmin ? ()=>setShowBuilder(true) : null}/>}
        {showBuilder && <LetterBuilderWrapper row={row} onClose={()=>setShowBuilder(false)}/>}
        {showBill && <BillModal row={row} token={token} saving={saving} onClose={()=>setShowBill(false)} onSave={async (patch) => { await onBillSave(row.id, patch); setShowBill(false); }}/>}
        {showDocs && <ViewDocumentsModal instituteId={row.institute_id} token={token} onClose={()=>setShowDocs(false)}/>}
        <button title="View Documents" onClick={() => setShowDocs(true)}
          style={{width:30,height:30,borderRadius:50,border:'none',background:'transparent',color:'var(--text3)',cursor:'pointer',display:'inline-flex',alignItems:'center',justifyContent:'center'}}
          onMouseEnter={e=>{e.currentTarget.style.background='var(--bg2)';e.currentTarget.style.color='var(--text)';}}
          onMouseLeave={e=>{e.currentTarget.style.background='';e.currentTarget.style.color='var(--text3)';}}
        ><span className="material-icons-round" style={{fontSize:15}}>folder_open</span></button>
        {canEdit && (
          <button title={hasBill ? 'Bill uploaded — click to update' : 'Upload bill / certificate'} onClick={() => setShowBill(true)}
            style={{width:30,height:30,borderRadius:50,border:'none',background: hasBill ? 'var(--success-light)' : 'transparent',color: hasBill ? 'var(--success)' : 'var(--text3)',cursor:'pointer',display:'inline-flex',alignItems:'center',justifyContent:'center'}}
            onMouseEnter={e=>{e.currentTarget.style.background='var(--success-light)';e.currentTarget.style.color='#0b9b85';}}
            onMouseLeave={e=>{e.currentTarget.style.background= hasBill ? 'var(--success-light)' : '';e.currentTarget.style.color= hasBill ? 'var(--success)' : 'var(--text3)';}}
          ><span className="material-icons-round" style={{fontSize:15}}>receipt</span></button>
        )}
        <button title="Generate Letter"
          onClick={() => setShowLetterOpts(true)}
          style={{width:30,height:30,borderRadius:50,border:'none',background:'transparent',color:'var(--text3)',cursor:'pointer',display:'inline-flex',alignItems:'center',justifyContent:'center'}}
          onMouseEnter={e=>{e.currentTarget.style.background='var(--primary-light)';e.currentTarget.style.color='var(--primary-dark)';}}
          onMouseLeave={e=>{e.currentTarget.style.background='';e.currentTarget.style.color='var(--text3)';}}
        ><span className="material-icons-round" style={{fontSize:15}}>description</span></button>
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
function GroupHeader({ label, sub, count, expanded, onToggle, isCurrent }) {
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
      <div style={{flex:1, display:'flex', alignItems:'center', gap:8}}>
        <div style={{fontWeight:600, fontSize:13.5, color:'var(--text)'}}>{label}</div>
        {isCurrent && (
          <span style={{fontSize:10, fontWeight:700, padding:'2px 9px', borderRadius:100, background:'var(--success)', color:'#fff', flexShrink:0}}>
            Current
          </span>
        )}
        {sub && <div style={{fontSize:11.5, color:'var(--text3)'}}>{sub}</div>}
      </div>
      <span style={{fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:100, background:'var(--primary-light)', color:'var(--primary-dark)', flexShrink:0}}>
        {count} {count === 1 ? 'entry' : 'entries'}
      </span>
    </button>
  );
}

// ── Table header row ───────────────────────────────────────────────────────────
function TableHead({ groupBy }) {
  const col = {fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.6px'};
  return (
    <div style={{display:'flex', alignItems:'center', gap:12, padding:'9px 20px', background:'var(--bg)', borderBottom:'1px solid var(--border)'}}>
      <div style={{flex:2, ...col}}>Firm</div>
      <div style={{flex:2, ...col}}>Organization</div>
      {groupBy !== 'fy' && <div style={{width:80, ...col, flexShrink:0}}>FY</div>}
      <div style={{flex:1, ...col}}>Contract</div>
      <div style={{width:90, flexShrink:0}}></div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
function printShortlistReport(rows, groupBy, filters = {}) {
  // Group rows
  const map = new Map();
  for (const r of rows) {
    let key, label;
    if (groupBy === 'firm') {
      key = String(r.institute_id);
      label = [r.institute_acronym ? `[${r.institute_acronym}]` : '', r.institute_name].filter(Boolean).join(' ');
    } else {
      key = r.client_id ? String(r.client_id) : (r.client_name_manual || '__none__');
      label = r.client_name || r.client_name_manual || 'Unknown Organization';
    }
    if (!map.has(key)) map.set(key, { label, rows: [] });
    map.get(key).rows.push(r);
  }
  const groups = [...map.entries()].sort((a, b) => a[1].label.localeCompare(b[1].label));

  const statusColor = (s) =>
    s === 'Active'  ? '#166534' :
    s === 'Expired' ? '#991b1b' : '#92400e';
  const statusBg = (s) =>
    s === 'Active'  ? '#dcfce7' :
    s === 'Expired' ? '#fee2e2' : '#fef3c7';

  const filterDesc = [
    filters.org    && `Organization: ${filters.org}`,
    filters.firm   && `Firm: ${filters.firm}`,
    filters.fy     && `FY: ${filters.fy}`,
    filters.status && `Status: ${filters.status}`,
    filters.search && `Search: "${filters.search}"`,
  ].filter(Boolean).join('  ·  ');

  const totalRows = rows.length;

  const sectionsHtml = groups.map(([, g]) => {
    const isOrgView = groupBy === 'org';
    const rowsHtml = g.rows.map((r, i) => {
      const name  = isOrgView
        ? [r.institute_acronym ? `[${r.institute_acronym}]` : '', r.institute_name].filter(Boolean).join(' ')
        : (r.client_name || r.client_name_manual || '—');
      const list  = r.standing_list_name || r.client_short || '—';
      const date  = fmtDate(r.shortlist_date);
      const valid = fmtDate(r.valid_until);
      const fy    = r.fy || '—';
      const amt   = r.contract_amount ? `NPR ${Number(r.contract_amount).toLocaleString()}` : '—';
      const st    = r.status || 'Active';
      return `<tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
        <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;font-weight:500">${i + 1}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:12px">${name}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#6b7280">${list}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:12px">${date}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#6b7280">${valid}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#6b7280">${fy}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#4b5563">${amt}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:12px">
          <span style="padding:2px 8px;border-radius:100px;font-size:11px;font-weight:600;background:${statusBg(st)};color:${statusColor(st)}">${st}</span>
        </td>
      </tr>`;
    }).join('');

    const colHeader = isOrgView ? 'Firm' : 'Organization';
    return `
      <div style="margin-bottom:32px;page-break-inside:avoid">
        <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:8px;padding-bottom:6px;border-bottom:2px solid #1e3a5f">
          <div style="font-size:14px;font-weight:700;color:#1e3a5f">${g.label}</div>
          <div style="font-size:11px;color:#6b7280;font-weight:500">${g.rows.length} entr${g.rows.length === 1 ? 'y' : 'ies'}</div>
        </div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden">
          <thead>
            <tr style="background:#1e3a5f;color:#fff">
              <th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;width:32px">#</th>
              <th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600">${colHeader}</th>
              <th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600">List / Short Name</th>
              <th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600">Shortlist Date</th>
              <th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600">Valid Until</th>
              <th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600">FY</th>
              <th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600">Amount</th>
              <th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600">Status</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>`;
  }).join('');

  const reportTitle = groupBy === 'firm' ? 'Shortlisting Report — By Firm' : 'Shortlisting Report — By Organization';
  const now = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' });

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>${reportTitle}</title>
<style>
  @page { size: A4 landscape; margin: 15mm 18mm; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #111; margin: 0; }
  .no-print { margin-bottom: 20px; }
  @media print { .no-print { display: none; } }
</style>
</head><body>
<div class="no-print">
  <button onclick="window.print()" style="padding:10px 24px;background:#1e3a5f;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;margin-right:10px">
    🖨 Print / Save as PDF
  </button>
  <button onclick="window.close()" style="padding:10px 20px;background:#f3f4f6;color:#374151;border:none;border-radius:8px;font-size:14px;cursor:pointer">
    Close
  </button>
</div>

<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
  <div>
    <div style="font-size:20px;font-weight:700;color:#1e3a5f;letter-spacing:-0.3px">${reportTitle}</div>
    ${filterDesc ? `<div style="font-size:11px;color:#6b7280;margin-top:3px">${filterDesc}</div>` : ''}
  </div>
  <div style="text-align:right;font-size:11px;color:#6b7280">
    <div>Generated: ${now}</div>
    <div style="margin-top:2px;font-weight:600;color:#374151">${totalRows} total entr${totalRows === 1 ? 'y' : 'ies'} · ${groups.length} ${groupBy === 'firm' ? 'firm' : 'organization'}${groups.length === 1 ? '' : 's'}</div>
  </div>
</div>
<hr style="border:none;border-top:3px solid #1e3a5f;margin:0 0 20px">

${sectionsHtml}

<div style="margin-top:24px;padding-top:10px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af;display:flex;justify-content:space-between">
  <span>TVETtrack — Shortlisting Report</span>
  <span>Total: ${totalRows} ${totalRows === 1 ? 'entry' : 'entries'}</span>
</div>
</body></html>`;

  const w = window.open('', '_blank', 'width=1100,height=800');
  if (w) { w.document.write(html); w.document.close(); }
}

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
  const [filterFY, setFilterFY] = useState('');
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

  // Firms currently assigned to each standing list
  const firmsByList = useMemo(() => {
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

  const currentFY = getCurrentFY();

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
      {!loading && standingLists.length > 0 && (
        <div style={{display:'flex', flexDirection:'column', gap:10, marginBottom:16}}>
          {standingLists.map(list => {
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
        const n = (firmsByList.get(String(listModal.data.id)) || []).length;
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
          assignedIds={new Set((firmsByList.get(String(listModal.data.id)) || []).map(r => r.institute_id))}
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
        <select value={filterOrg} onChange={e => setFilterOrg(e.target.value)} style={{minWidth:160}}>
          <option value="">All organizations</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.shortName || c.short_name || c.fullName || c.full_name}</option>)}
        </select>

        {/* Filter: Firm */}
        <select value={filterFirm} onChange={e => setFilterFirm(e.target.value)} style={{minWidth:160}}>
          <option value="">All firms</option>
          {sortedInstitutes.map(i => <option key={i.id} value={i.id}>{i.acronym ? `[${i.acronym}] ` : ''}{i.name}</option>)}
        </select>

        {/* Filter: FY */}
        <select value={filterFY} onChange={e => setFilterFY(e.target.value)} style={{minWidth:120}}>
          <option value="">All FYs</option>
          {FYS.map(fy => <option key={fy} value={fy}>{fy}</option>)}
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
          {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
        </div>

        {/* Print report — only for firm/org views, not FY */}
        {groupBy !== 'fy' && filtered.length > 0 && (
          <button
            title="Print report"
            onClick={() => printShortlistReport(filtered, groupBy, {
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

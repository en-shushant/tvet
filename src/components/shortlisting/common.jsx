/**
 * Small pieces shared across the shortlisting screens.
 *
 * These were defined inline in Shortlisting.jsx and referenced from both the
 * main table and the contracts panel, so they had to come out first — the
 * contracts panel could not be extracted while it still reached back into its
 * parent for a date picker and a confirmation dialog.
 */
import { useState, useEffect, lazy, Suspense } from 'react';
import Modal from '../ui/Modal.jsx';
import { Btn } from '../../md.jsx';
import { adToBS, bsToAD, BS_MONTHS, BS_DATA, toNpNum, BS_YEARS } from '../../constants/nepali.js';
import { FISCAL_YEARS } from '../../constants/data.js';
import { getSession } from '../../utils/auth.js';

export function statusColor(s) {
  if (s === 'Active')  return { bg: 'var(--success-light)', color: '#0b9b85' };
  if (s === 'Expired') return { bg: 'var(--error-light)',   color: '#c0391e' };
  return { bg: 'var(--bg2)', color: 'var(--text3)' };
}

// ── Searchable client combobox ──────────────────────────────────────────────

export function parseDocUrls(src) {
  if (!src) return [];
  try { const p = JSON.parse(src); return Array.isArray(p) ? p : [src]; }
  catch { return [src]; }
}

// Read-only view of everything uploaded for a firm — letter images plus every
// supporting document — reachable directly from the shortlisting row so
// nobody has to leave this page to check what's on file.

export function NepaliDatePicker({ label, value, onChange, required }) {
  // value is AD ISO string (YYYY-MM-DD) or ''
  const toBS = (adStr) => {
    if (!adStr) return { y: '', m: '', d: '' };
    const [y, m, d] = adStr.slice(0, 10).split('-').map(Number);
    const bs = adToBS(new Date(Date.UTC(y, m - 1, d)));
    return { y: bs.y, m: bs.m, d: bs.d };
  };

  const [bs, setBs] = useState(() => toBS(value));
  useEffect(() => { setBs(toBS(value)); }, [value]);

  const maxDays = (bs.y && bs.m && BS_DATA[bs.y]) ? BS_DATA[bs.y][bs.m - 1] : 32;

  const handleChange = (field, val) => {
    const next = { ...bs, [field]: val ? Number(val) : '' };
    setBs(next);
    if (next.y && next.m && next.d) {
      const clampedD = Math.min(next.d, BS_DATA[next.y]?.[next.m - 1] || next.d);
      onChange(bsToAD(next.y, next.m, clampedD));
    } else {
      onChange('');
    }
  };

  const sel = (val, opts, placeholder) => (
    <select value={val || ''} onChange={e => handleChange(opts === 'year' ? 'y' : opts === 'month' ? 'm' : 'd', e.target.value)}
      style={{ flex: 1, padding: '14px 8px 14px 12px', border: '1px solid var(--md-sys-color-outline,#79747e)', borderRadius: 4, background: 'var(--surface)', color: val ? 'var(--text)' : 'var(--text3)', fontSize: 15, fontFamily: 'inherit', appearance: 'none', cursor: 'pointer' }}>
      <option value="">{placeholder}</option>
      {opts === 'year'  && BS_YEARS.map(y => <option key={y} value={y}>{toNpNum(y)}</option>)}
      {opts === 'month' && BS_MONTHS.map((mn, i) => <option key={i+1} value={i+1}>{mn}</option>)}
      {opts === 'day'   && Array.from({length: maxDays}, (_,i) => i+1).map(d => <option key={d} value={d}>{toNpNum(d)}</option>)}
    </select>
  );

  return (
    <div className="form-group">
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 6 }}>
        {label}{required && <span style={{ color: 'var(--error)' }}> *</span>}
      </label>
      <div style={{ display: 'flex', gap: 6 }}>
        {sel(bs.y, 'year',  'वर्ष')}
        {sel(bs.m, 'month', 'महिना')}
        {sel(bs.d, 'day',   'गते')}
      </div>
      {bs.y && bs.m && bs.d && (
        <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 4 }}>
          {toNpNum(bs.d)} {BS_MONTHS[bs.m - 1]} {toNpNum(bs.y)}
        </div>
      )}
    </div>
  );
}

// ── Add/Edit Modal ─────────────────────────────────────────────────────────────

export function ConfirmModal({ message, onConfirm, onClose, saving }) {
  return (
    <Modal title="Confirm Delete" onClose={onClose} footer={<>
      <Btn className="btn btn-secondary" onClick={onClose}>Cancel</Btn>
      <Btn className="btn btn-danger" onClick={onConfirm} disabled={saving}>{saving ? 'Deleting…' : 'Delete'}</Btn>
    </>}>
      <p style={{ margin:0, color:'var(--text2)' }}>{message}</p>
    </Modal>
  );
}

// ── Bill Upload Modal ──────────────────────────────────────────────────────────

/* Shared with the results table and the screen itself. */
const LetterBuilderLazy = lazy(() => import('../LetterBuilder.jsx'));
export function LetterBuilderWrapper({ row, onClose, allRows }) {
  return (
    <Suspense fallback={null}>
      <LetterBuilderLazy row={row} token={getSession()?.token} onClose={onClose} allRows={allRows}/>
    </Suspense>
  );
}

/** File picker filter for scanned documents. */
export const ACCEPT = 'image/*';

export const FYS = [...FISCAL_YEARS].reverse(); // newest first

/** Uploads a file and returns its stored URL. Shared by the modals and the
 *  contracts panel, both of which accept scanned documents. */
export async function uploadToR2(file, token) {
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

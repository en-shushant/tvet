/**
 * Add a trade to Master Data from inside the person form, without leaving it —
 * for a certificate (typed, or read from NSTB) whose trade is not listed yet.
 * The same POST /occupations the assignment form uses; the new trade is added
 * to the shared list at once, so every picker sees it.
 */
import { useState } from 'react';
import { api } from '../../utils/api.js';
import { getSession } from '../../utils/auth.js';
import { OCCUPATIONS, SECTORS, notifyMasterData } from '../../constants/data.js';
import { VOCATIONAL_LEVELS } from '../../constants/education.js';
import Select from '../ui/Select.jsx';

export default function NewTradeForm({ initialName = '', level = '', onDone, onCancel }) {
  const [name, setName] = useState(initialName);
  const [sector, setSector] = useState('');
  const [lvl, setLvl] = useState(VOCATIONAL_LEVELS.some(l => l.value === level) && level !== 'Technician' ? level : '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    if (!name.trim() || !sector) return setErr('A trade needs its name and sector.');
    const dup = OCCUPATIONS.find(o => o.name.trim().toLowerCase() === name.trim().toLowerCase() && (o.level || '') === lvl);
    if (dup) { onDone(dup); return; }
    setBusy(true); setErr('');
    try {
      const saved = await api('POST', '/occupations', { name: name.trim(), sector, level: lvl || null }, getSession()?.token);
      OCCUPATIONS.push(saved);
      OCCUPATIONS.sort((a, b) => a.name.localeCompare(b.name));
      notifyMasterData();
      onDone(saved);
    } catch (e) { setErr(e.message || 'Could not add the trade.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="new-trade" role="group" aria-label="New trade">
      <div className="new-trade-title">Add a trade to the occupation list</div>
      <div className="new-trade-grid">
        <label><span className="nstb-label">Trade</span>
          <input className="tw-in" value={name} onChange={e => setName(e.target.value)} autoFocus/></label>
        <label><span className="nstb-label">Sector</span>
          <Select className="tw-in" value={sector} onChange={e => setSector(e.target.value)}>
            <option value="">Choose…</option>
            {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
          </Select></label>
        <label><span className="nstb-label">Level</span>
          <Select className="tw-in" value={lvl} onChange={e => setLvl(e.target.value)}>
            <option value="">No level</option>
            {VOCATIONAL_LEVELS.filter(l => l.value !== 'Technician').map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </Select></label>
      </div>
      {err && <div className="nstb-msg is-bad" role="alert">{err}</div>}
      <div className="new-trade-actions">
        <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel} disabled={busy}>Cancel</button>
        <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={busy}>
          {busy ? 'Adding…' : 'Add trade'}</button>
      </div>
    </div>
  );
}

/**
 * Nothing typed is lost, even mid-step.
 *
 * Every change is copied to this browser at once and sent to the server a few
 * seconds after typing stops, without moving to the next step or checking
 * that the step is complete. A draft left on the device (a dropped connection,
 * a closed tab) is offered back the next time the step opens. `ProgressNote`
 * is the "Saved · 2:41 pm" line and the Save progress button.
 */
import { useEffect, useRef, useState } from 'react';
import { Btn } from '../../md.jsx';

const KEY = (k) => `tvettrack_draft_${k}`;
const readDraft = (k) => { try { return JSON.parse(localStorage.getItem(KEY(k)) || 'null'); } catch { return null; } };
const writeDraft = (k, v) => { try { localStorage.setItem(KEY(k), JSON.stringify(v)); } catch { /* storage full or off */ } };
const clearDraft = (k) => { try { localStorage.removeItem(KEY(k)); } catch { /* ignore */ } };

/**
 * @param key      one per tender step, e.g. `notice-12`
 * @param value    the step's whole editable state
 * @param restore  puts a saved draft back into the step's state
 * @param persist  async (value) => void — sends it to the server; may throw
 * @param saved    optional: what the server holds now, when `value` is a copy of data
 *                 that arrives from the server (re-baselines the "unsaved" test)
 * @param enabled  false pauses autosave (e.g. while nothing is being edited)
 */
export function useProgress({ key, value, restore, persist, saved, enabled = true, delay = 2500 }) {
  const first = useRef(JSON.stringify(value));
  const last = useRef(first.current);       // what the server last accepted
  const [status, setStatus] = useState({ at: null, saving: false, error: '', restored: false });
  const latest = useRef(value); latest.current = value;
  const persistRef = useRef(persist); persistRef.current = persist;

  // A draft from an interrupted session comes back once.
  useEffect(() => {
    const d = readDraft(key);
    if (d && JSON.stringify(d.value) !== first.current) {
      restore(d.value); setStatus(s => ({ ...s, restored: true }));
    }
  }, [key]);

  const sendNow = async () => {
    const snapshot = JSON.stringify(latest.current);
    if (snapshot === last.current) return true;
    setStatus(s => ({ ...s, saving: true, error: '' }));
    try {
      await persistRef.current(latest.current);
      last.current = snapshot; clearDraft(key);
      setStatus({ at: new Date(), saving: false, error: '', restored: false });
      return true;
    } catch (e) {
      setStatus(s => ({ ...s, saving: false, error: e.message || 'Not saved yet — kept on this device.' }));
      return false;
    }
  };

  useEffect(() => { if (saved !== undefined) last.current = JSON.stringify(saved); }, [JSON.stringify(saved), key]);

  useEffect(() => {
    const snapshot = JSON.stringify(value);
    if (snapshot === last.current || !enabled) return undefined;
    writeDraft(key, { value, at: Date.now() });
    const t = setTimeout(sendNow, delay);
    return () => clearTimeout(t);
  }, [JSON.stringify(value), key, enabled]);

  // Closing the tab with something unsent: ask first.
  useEffect(() => {
    const warn = (e) => { if (JSON.stringify(latest.current) !== last.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  return { ...status, sendNow, dirty: JSON.stringify(value) !== last.current,
    markSaved: () => { last.current = JSON.stringify(latest.current); clearDraft(key); } };
}

export function ProgressNote({ progress, canSave = true }) {
  const { at, saving, error, restored, dirty, sendNow } = progress;
  const when = at ? at.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' }) : '';
  return (
    <span className="tw-progress" role="status" aria-live="polite">
      {restored && !at && <span className="tw-progress-restored">Restored your unsaved changes · </span>}
      {saving ? 'Saving…'
        : error ? <span className="tw-progress-bad">{error}</span>
        : dirty ? 'Unsaved changes'
        : when ? `Saved · ${when}` : ''}
      {canSave && (
        <Btn className="btn btn-ghost btn-sm" disabled={saving || !dirty} onClick={sendNow}>Save progress</Btn>
      )}
    </span>
  );
}

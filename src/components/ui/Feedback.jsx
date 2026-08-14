import { useState, useEffect, useCallback } from 'react';
import Modal from './Modal.jsx';
import { Btn } from '../../md.jsx';

/**
 * App-wide toasts and confirmation dialogs.
 *
 * Replaces window.alert/confirm, which block the main thread, ignore the theme
 * and are announced inconsistently by screen readers. The API is module-level
 * rather than context-based so non-component modules (utils/export.js, the report
 * families) can call it without prop threading.
 *
 * Mount <FeedbackHost /> once, at the app root.
 */

let emit = null;          // set by FeedbackHost once mounted
const queued = [];        // calls made before mount are replayed, never dropped

function dispatch(action) {
  if (emit) emit(action);
  else queued.push(action);
}

/** Non-blocking notice. `type` is 'error' | 'success' | 'info'. */
export function toast(message, type = 'info') {
  if (!message) return;
  dispatch({ kind: 'toast', message: String(message), type });
}
toast.error = (m) => toast(m, 'error');
toast.success = (m) => toast(m, 'success');
toast.info = (m) => toast(m, 'info');

/**
 * Promise-based replacement for window.confirm.
 * Resolves true when confirmed, false when dismissed.
 */
export function confirmDialog({ title = 'Are you sure?', message, confirmLabel = 'Confirm', danger = false } = {}) {
  return new Promise(resolve => {
    dispatch({ kind: 'confirm', title, message, confirmLabel, danger, resolve });
  });
}

const TOAST_STYLE = {
  error:   { fg: 'var(--red,#dc2626)',   icon: 'error_outline' },
  success: { fg: 'var(--green)',         icon: 'check_circle' },
  info:    { fg: 'var(--accent)',        icon: 'info' },
};

export function FeedbackHost() {
  const [toasts, setToasts] = useState([]);
  const [ask, setAsk] = useState(null);

  const handle = useCallback((action) => {
    if (action.kind === 'toast') {
      const id = Math.random().toString(36).slice(2, 9);
      setToasts(t => [...t, { id, ...action }]);
      // Errors linger — they usually need reading; notices clear quickly.
      setTimeout(() => setToasts(t => t.filter(x => x.id !== id)),
        action.type === 'error' ? 7000 : 3500);
    } else {
      setAsk(action);
    }
  }, []);

  useEffect(() => {
    emit = handle;
    while (queued.length) handle(queued.shift());
    return () => { emit = null; };
  }, [handle]);

  const settle = (result) => { ask?.resolve(result); setAsk(null); };

  return (
    <>
      <div aria-live="polite" style={{
        position:'fixed', bottom:20, right:20, zIndex:9000,
        display:'flex', flexDirection:'column', gap:8, maxWidth:'min(420px, calc(100vw - 40px))',
      }}>
        {toasts.map(t => {
          const s = TOAST_STYLE[t.type] || TOAST_STYLE.info;
          return (
            <div key={t.id} role={t.type === 'error' ? 'alert' : 'status'}
              style={{
                display:'flex', alignItems:'flex-start', gap:9, padding:'10px 13px',
                background:'var(--surface)', border:`1px solid color-mix(in srgb, ${s.fg} 35%, var(--border))`,
                borderLeft:`3px solid ${s.fg}`, borderRadius:8, fontSize:12.5, color:'var(--text)',
                boxShadow:'0 4px 14px rgba(0,0,0,.16)',
              }}>
              <span className="material-icons-round" style={{fontSize:16, color:s.fg, flexShrink:0}}>{s.icon}</span>
              <span style={{flex:1, lineHeight:1.45}}>{t.message}</span>
              <button onClick={() => setToasts(x => x.filter(y => y.id !== t.id))} aria-label="Dismiss"
                style={{background:'none', border:'none', cursor:'pointer', color:'var(--text3)', padding:0, lineHeight:1}}>
                <span className="material-icons-round" style={{fontSize:15}}>close</span>
              </button>
            </div>
          );
        })}
      </div>

      {ask && (
        <Modal title={ask.title} compact onClose={() => settle(false)}
          footer={<>
            <Btn className="btn btn-secondary" onClick={() => settle(false)}>Cancel</Btn>
            <Btn className={ask.danger ? 'btn btn-danger' : 'btn btn-primary'} onClick={() => settle(true)}>
              {ask.confirmLabel}
            </Btn>
          </>}>
          <div style={{fontSize:13, color:'var(--text2)', lineHeight:1.55}}>{ask.message}</div>
        </Modal>
      )}
    </>
  );
}

export default FeedbackHost;

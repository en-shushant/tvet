import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Btn } from '../../md.jsx';

/**
 * What the form fields in this dialog hold right now, as one string: text fields, checkboxes, selects,
 * the Material fields and the app's own pickers (which show their choice as text), and uploaded images.
 * Two snapshots that differ mean a value was changed.
 */
function snapshot(root) {
  const parts = [];
  root.querySelectorAll('input,textarea,select').forEach(e => {
    if (e.type === 'file') return;
    parts.push(e.type === 'checkbox' || e.type === 'radio' ? (e.checked ? '1' : '0') : String(e.value ?? ''));
  });
  root.querySelectorAll('md-outlined-text-field,md-filled-text-field,md-outlined-select,md-filled-select').forEach(e => parts.push(String(e.value ?? '')));
  root.querySelectorAll('md-switch').forEach(e => parts.push(e.selected ? '1' : '0'));
  root.querySelectorAll('md-checkbox,md-radio').forEach(e => parts.push(e.checked ? '1' : '0'));
  root.querySelectorAll('.sel-trigger').forEach(e => parts.push(e.textContent || ''));
  root.querySelectorAll('img').forEach(e => parts.push(String((e.getAttribute('src') || '').length)));
  return parts.join('\u0001');
}

/** The words on a button that only closes the dialog. */
const CLOSES = /^\s*(cancel|close)\s*$/i;

/**
 * The "ask before throwing away typing" behaviour, for a dialog of any build.
 *
 * Give the dialog's box `ref`, `onClickCapture` and put `prompt` inside the overlay; close it with
 * `requestClose`. If a form value was changed, closing any way (Esc when `escape` is on, a click outside, the ×,
 * or a Cancel / Close button) asks first. Saving closes through the parent, which is not asked about.
 *
 * Changed means different from how the form looked when the person first touched it: until then the starting
 * point follows the form, so values that arrive late from the server do not count as changes.
 */
export function useCloseGuard(onClose, { guard = true, escape = false } = {}) {
  const ref = useRef(null);
  const base = useRef('');
  const touched = useRef(false);
  const [asking, setAsking] = useState(false);
  const askingRef = useRef(false);
  askingRef.current = asking;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Follow the form until the first real touch, then hold.
  useEffect(() => {
    if (!guard) return undefined;
    const el = ref.current;
    if (!el) return undefined;
    const take = () => { if (!touched.current) base.current = snapshot(el); };
    take();
    const t = setInterval(take, 250);
    const touch = () => { touched.current = true; };
    el.addEventListener('pointerdown', touch, true);
    el.addEventListener('keydown', touch, true);
    return () => { clearInterval(t); el.removeEventListener('pointerdown', touch, true); el.removeEventListener('keydown', touch, true); };
  }, [guard]);

  const isDirty = () => guard && touched.current && !!ref.current && snapshot(ref.current) !== base.current;
  const requestClose = () => {
    if (askingRef.current) return;
    if (isDirty()) { setAsking(true); return; }
    closeRef.current();
  };

  useEffect(() => {
    if (!escape) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') requestClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [escape]); // eslint-disable-line react-hooks/exhaustive-deps

  // A Cancel or Close button inside the dialog is a close like any other.
  const onClickCapture = (e) => {
    if (!guard) return;
    const b = e.target.closest?.('button, md-text-button, md-outlined-button, md-filled-tonal-button, [data-md]');
    if (!b || !ref.current?.contains(b) || b.classList.contains('modal-close')) return;
    if (!CLOSES.test(b.textContent.replace(/^[a-z_]+\s+(?=[A-Z])/, ''))) return;
    if (isDirty()) { e.stopPropagation(); e.preventDefault(); setAsking(true); }
  };

  const prompt = asking ? (
    <Modal title="Discard your changes?" compact guard={false} onClose={() => setAsking(false)}
      footer={<>
        <Btn className="btn btn-secondary" onClick={() => setAsking(false)}>Keep editing</Btn>
        <Btn className="btn btn-danger" onClick={() => { setAsking(false); closeRef.current(); }}>Discard changes</Btn>
      </>}>
      <p style={{ margin: 0, color: 'var(--text2)', lineHeight: 1.5 }}>
        You changed some values and have not saved them. Closing now will lose them.
      </p>
    </Modal>
  ) : null;

  return { ref, requestClose, onClickCapture, prompt };
}

/**
 * A dialog. If it holds a form and a value was changed, closing it any way asks first (see useCloseGuard),
 * so typing is never thrown away by a stray click. A dialog with its own unsaved-changes handling passes
 * `guard={false}`.
 */
export default function Modal({ title, onClose, children, footer, size = '', compact = false, guard = true }) {
  const g = useCloseGuard(onClose, { guard, escape: true });
  const sizeClass = size === 'lg' ? 'modal-lg' : size === 'xl' ? 'modal-xl' : '';

  return createPortal(
    <div
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) g.requestClose(); }}
    >
      <div ref={g.ref} className={`modal ${sizeClass}${compact ? ' modal-compact' : ''}`} role="dialog" aria-modal="true" onClickCapture={g.onClickCapture}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={g.requestClose} aria-label="Close">
            <span className="material-icons-round" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
      {g.prompt}
    </div>,
    document.body
  );
}

export function ErrorBanner({ msg, onDismiss }) {
  if (!msg) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 12px',
      background: 'color-mix(in srgb, var(--red,#dc2626) 10%, transparent)',
      border: '1px solid color-mix(in srgb, var(--red,#dc2626) 30%, transparent)',
      borderRadius: 8, color: 'var(--red,#dc2626)', fontSize: 12, marginBottom: 12,
    }}>
      <span className="material-icons-round" style={{ fontSize: 14, flexShrink: 0 }}>error_outline</span>
      <span style={{ flex: 1 }}>{msg}</span>
      {onDismiss && (
        <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, lineHeight: 1, fontSize: 16 }}><span className="material-icons-round" style={{fontSize:16}}>close</span></button>
      )}
    </div>
  );
}

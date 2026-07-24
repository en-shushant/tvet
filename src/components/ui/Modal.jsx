import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MdDialogEl } from '../../md.jsx';
import { Btn } from '../../md.jsx';

export default function Modal({ title, onClose, children, footer, size = '' }) {
  const ref = useRef(null);

  // open on mount, listen for dialog cancel (Escape key / scrim click)
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.show();
    const onCancel = () => onClose();
    el.addEventListener('cancel', onCancel);
    return () => el.removeEventListener('cancel', onCancel);
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => {
    ref.current?.close();
    onClose();
  };

  // Portal to document.body so position:fixed inside md-dialog isn't
  // trapped by any ancestor CSS transform in the app layout.
  return createPortal(
    <MdDialogEl ref={ref} size={size || undefined}>
      <div slot="headline" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 500 }}>{title}</span>
        <button
          onClick={handleClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text3)', borderRadius: '50%',
            width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background .15s',
          }}
          onMouseOver={e => e.currentTarget.style.background = 'var(--bg2)'}
          onMouseOut={e => e.currentTarget.style.background = 'none'}
        >
          <span className="material-icons-round" style={{ fontSize: 18 }}>close</span>
        </button>
      </div>
      <div slot="content" style={{ paddingTop: 4 }}>{children}</div>
      {footer && (
        <div slot="actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {footer}
        </div>
      )}
    </MdDialogEl>,
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
        <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, lineHeight: 1, fontSize: 16 }}>✕</button>
      )}
    </div>
  );
}

import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function Modal({ title, onClose, children, footer, size = '', compact = false }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const sizeClass = size === 'lg' ? 'modal-lg' : size === 'xl' ? 'modal-xl' : '';

  return createPortal(
    <div
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`modal ${sizeClass}${compact ? ' modal-compact' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <span className="material-icons-round" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
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
        <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, lineHeight: 1, fontSize: 16 }}>✕</button>
      )}
    </div>
  );
}

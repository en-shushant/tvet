import { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

export default function Modal({title, onClose, children, footer, size=''}) {
  const modalRef = useRef(null);

  useEffect(() => {
    const el = modalRef.current;
    if (!el) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const focusable = el.querySelectorAll('input:not([disabled]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"]):not([disabled])');
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first || !el.contains(document.activeElement)) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last || !el.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      }
    };
    el.addEventListener('keydown', handleKeyDown);
    return () => el.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return ReactDOM.createPortal(
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div ref={modalRef} className={`modal ${size}`}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onClose} title="Close">
            <span className="material-icons-round" style={{fontSize:18}}>close</span>
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

export function ErrorBanner({msg, onDismiss}) {
  if (!msg) return null;
  return (
    <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',background:'color-mix(in srgb, var(--red,#dc2626) 10%, transparent)',border:'1px solid color-mix(in srgb, var(--red,#dc2626) 30%, transparent)',borderRadius:8,color:'var(--red,#dc2626)',fontSize:12,marginBottom:12}}>
      <span className="material-icons-round" style={{fontSize:14,flexShrink:0}}>error_outline</span>
      <span style={{flex:1}}>{msg}</span>
      {onDismiss && <button onClick={onDismiss} style={{background:'none',border:'none',cursor:'pointer',color:'inherit',padding:0,lineHeight:1,fontSize:16}}>✕</button>}
    </div>
  );
}

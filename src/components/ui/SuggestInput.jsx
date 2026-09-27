/**
 * A text input with suggestions drawn by the app, anchored under the field.
 *
 * Replaces <datalist>, whose list the browser draws itself: unstyled, with its
 * own arrow in the field, and in some browsers detached from the input
 * altogether. Free text stays allowed — suggestions only help.
 */
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function SuggestInput({ value, onChange, suggestions = [], className = '', placeholder, ...rest }) {
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [pos, setPos] = useState(null);

  const matches = useMemo(() => {
    const q = String(value || '').trim().toLowerCase();
    const seen = new Set();
    return suggestions
      .filter(s => { const k = s.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
      .filter(s => !q || (s.toLowerCase().includes(q) && s.toLowerCase() !== q))
      .slice(0, 8);
  }, [suggestions, value]);
  const show = open && matches.length > 0;

  const place = () => {
    const r = inputRef.current?.getBoundingClientRect();
    if (r) setPos({ left: r.left, top: r.bottom + 4, width: r.width });
  };
  useLayoutEffect(() => { if (show) place(); }, [show, value]);
  useLayoutEffect(() => {
    const el = listRef.current;
    if (show && el?.showPopover && !el.matches(':popover-open')) { try { el.showPopover(); } catch { /* ignore */ } }
  }, [show, pos]);
  useEffect(() => {
    if (!show) return undefined;
    const close = (e) => { if (!listRef.current?.contains(e.target) && e.target !== inputRef.current) setOpen(false); };
    const onScroll = (e) => { if (!listRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', place);
    return () => {
      document.removeEventListener('mousedown', close, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', place);
    };
  }, [show]);

  const pick = (s) => { onChange(s); setOpen(false); setActive(-1); };
  const onKeyDown = (e) => {
    if (!show) { if (e.key === 'ArrowDown' && matches.length) { setOpen(true); setActive(0); e.preventDefault(); } return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(matches.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(matches[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); }
    else if (e.key === 'Tab') setOpen(false);
  };

  return (
    <>
      <input ref={inputRef} className={className} value={value || ''} placeholder={placeholder} autoComplete="off"
        role="combobox" aria-expanded={show} aria-controls={show ? listId : undefined} aria-autocomplete="list"
        aria-activedescendant={show && active >= 0 ? `${listId}-${active}` : undefined}
        onChange={e => { onChange(e.target.value); setOpen(true); setActive(-1); }}
        onFocus={() => setOpen(true)} onKeyDown={onKeyDown} {...rest}/>
      {show && pos && createPortal(
        <div ref={listRef} id={listId} role="listbox" className="sel-list" popover="manual"
          onMouseDown={e => e.preventDefault()}
          style={{ left: pos.left, top: pos.top, minWidth: pos.width, maxHeight: 280 }}>
          <div className="sel-group" role="presentation">From qualification rules</div>
          {matches.map((s, i) => (
            <div key={s} id={`${listId}-${i}`} role="option" aria-selected={i === active}
              className={`sel-opt${i === active ? ' is-active' : ''}`}
              onMouseEnter={() => setActive(i)} onClick={() => pick(s)}>
              <span>{s}</span>
            </div>
          ))}
        </div>,
        document.body)}
    </>
  );
}

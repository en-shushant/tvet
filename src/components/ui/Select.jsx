/**
 * A drop-in for <select> whose open list is drawn by the app, not the OS.
 *
 * Safari and Firefox do not let a page style a native select's list, so the
 * app's dropdowns opened as grey system menus there. This draws the list
 * itself, in the app's theme, the same in every browser.
 *
 * A hidden native <select> stays underneath as the source of truth: picking an
 * item sets its value and fires a real `change` event, so every existing
 * `onChange={e => … e.target.value}` handler, `defaultValue`, and code that
 * reads a select by id keeps working unchanged.
 */
import { Children, Fragment, isValidElement, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/** <option>/<optgroup> children, flattened through fragments and arrays. */
function readItems(children, group = null, out = []) {
  Children.forEach(children, (c) => {
    if (!isValidElement(c)) return;
    if (c.type === Fragment) return readItems(c.props.children, group, out);
    if (c.type === 'optgroup') return readItems(c.props.children, c.props.label, out);
    if (c.type === 'option') {
      const label = Children.toArray(c.props.children).join('');
      out.push({ value: String(c.props.value ?? label), label, disabled: !!c.props.disabled,
        hidden: !!c.props.hidden, group });
    }
  });
  return out;
}

const setNativeValue = (el, v) => {
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, v);
  el.dispatchEvent(new Event('change', { bubbles: true }));
};

export default function Select({
  children, className = '', style, value, defaultValue, onChange, disabled, id, title,
  'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledby, ...rest
}) {
  const items = useMemo(() => readItems(children), [children]);
  const nativeRef = useRef(null);
  const btnRef = useRef(null);
  const listRef = useRef(null);
  const listId = useId();
  const [inner, setInner] = useState(() => String(defaultValue ?? items[0]?.value ?? ''));
  const current = value !== undefined && value !== null ? String(value) : inner;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [pos, setPos] = useState(null);
  const typed = useRef({ s: '', t: 0 });

  const shown = items.filter(i => !i.hidden);
  const selected = items.find(i => i.value === current) || (value === undefined ? items[0] : null);

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom - 8;
    const want = Math.min(320, shown.length * 34 + 10);
    const up = below < Math.min(want, 180) && r.top > below;
    setPos({ left: r.left, width: r.width, top: up ? undefined : r.bottom + 4,
      bottom: up ? window.innerHeight - r.top + 4 : undefined,
      maxHeight: Math.max(120, Math.min(320, (up ? r.top : below) - 8)) });
  };

  const openList = () => {
    if (disabled) return;
    place();
    setActive(Math.max(0, shown.findIndex(i => i.value === current)));
    setOpen(true);
  };
  const close = (refocus = true) => { setOpen(false); if (refocus) btnRef.current?.focus(); };
  const pick = (item) => {
    if (!item || item.disabled) return;
    if (nativeRef.current && item.value !== current) setNativeValue(nativeRef.current, item.value);
    close();
  };

  useLayoutEffect(() => { if (open) place(); }, [open]);
  // Modals are native dialogs in the browser's top layer; a list appended to
  // <body> would open behind them. As a popover it joins the top layer above.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (open && el?.showPopover && !el.matches(':popover-open')) {
      try { el.showPopover(); } catch { /* already shown or unsupported */ }
    }
  }, [open, pos]);
  // Once drawn, keep it on screen: a trigger near the right edge gets a list
  // aligned to its right edge instead of one running past the window.
  useLayoutEffect(() => {
    const el = listRef.current, r = btnRef.current?.getBoundingClientRect();
    if (!open || !el || !r || !pos) return;
    const w = el.offsetWidth;
    if (pos.left + w > window.innerWidth - 8) {
      const left = Math.max(8, Math.min(r.right, window.innerWidth - 8) - w);
      if (left !== pos.left) setPos(p => ({ ...p, left }));
    }
  }, [open, pos]);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!listRef.current?.contains(e.target) && !btnRef.current?.contains(e.target)) close(false);
    };
    // Scrolling anything but the list itself would leave it floating in the wrong place.
    const onScroll = (e) => { if (!listRef.current?.contains(e.target)) close(false); };
    const onResize = () => close(false);
    document.addEventListener('mousedown', onDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);                                            
  useEffect(() => {
    if (open && active >= 0) listRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const step = (from, dir) => {
    let i = from;
    for (let n = 0; n < shown.length; n++) {
      i = Math.min(shown.length - 1, Math.max(0, i + dir));
      if (!shown[i].disabled) return i;
      if (i === 0 || i === shown.length - 1) break;
    }
    return from;
  };
  const typeahead = (ch) => {
    const now = Date.now();
    typed.current = { s: (now - typed.current.t < 700 ? typed.current.s : '') + ch.toLowerCase(), t: now };
    const at = shown.findIndex(i => !i.disabled && i.label.toLowerCase().startsWith(typed.current.s));
    return at;
  };

  const onKeyDown = (e) => {
    if (disabled) return;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); openList(); }
      else if (e.key.length === 1 && /\S/.test(e.key)) {
        const at = typeahead(e.key);
        if (at >= 0) pick(shown[at]);
      }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => step(a, 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => step(a, -1)); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(step(-1, 1)); }
    else if (e.key === 'End') { e.preventDefault(); setActive(step(shown.length, -1)); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(shown[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'Tab') close(false);
    else if (e.key.length === 1 && /\S/.test(e.key)) {
      const at = typeahead(e.key);
      if (at >= 0) setActive(at);
    }
  };

  let lastGroup = null;
  return (
    <>
      <button ref={btnRef} type="button" className={`sel-trigger ${className}`.trim()} style={style}
        disabled={disabled} title={title} aria-haspopup="listbox" aria-expanded={open}
        aria-controls={open ? listId : undefined} aria-label={ariaLabel} aria-labelledby={ariaLabelledby}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        onClick={() => (open ? close() : openList())} onKeyDown={onKeyDown}>
        <span className={`sel-value${selected ? '' : ' is-empty'}`}>{selected?.label ?? ''}</span>
      </button>
      <select ref={nativeRef} id={id} className="sel-native" tabIndex={-1} aria-hidden="true"
        disabled={disabled} {...(value !== undefined ? { value: value ?? '' } : { defaultValue })}
        onChange={(e) => { setInner(e.target.value); onChange?.(e); }} {...rest}>
        {children}
      </select>
      {open && pos && createPortal(
        <div ref={listRef} id={listId} role="listbox" className="sel-list" popover="manual"
          aria-label={ariaLabel} onMouseDown={e => e.preventDefault()}
          style={{ left: pos.left, top: pos.top, bottom: pos.bottom, minWidth: pos.width, maxHeight: pos.maxHeight }}>
          {shown.length === 0 && <div className="sel-empty">No options</div>}
          {shown.map((item, i) => {
            const head = item.group && item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            return (
              <Fragment key={`${item.group || ''}:${item.value}:${i}`}>
                {head && <div className="sel-group" role="presentation">{head}</div>}
                <div id={`${listId}-${i}`} data-i={i} role="option" aria-selected={item.value === current}
                  aria-disabled={item.disabled || undefined}
                  className={`sel-opt${i === active ? ' is-active' : ''}${item.value === current ? ' is-selected' : ''}${item.group ? ' in-group' : ''}`}
                  onMouseEnter={() => !item.disabled && setActive(i)} onClick={() => pick(item)}>
                  <span>{item.label}</span>
                  {item.value === current && <span className="material-icons-round sel-check" aria-hidden="true">check</span>}
                </div>
              </Fragment>
            );
          })}
        </div>,
        document.body)}
    </>
  );
}

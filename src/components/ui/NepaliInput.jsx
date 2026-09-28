/**
 * A text field that types Nepali from English, like Google's Nepali input tool:
 * "namaste" becomes नमस्ते when you press space. While a word is being typed, a
 * list offers alternatives (↑/↓, Enter or click). The अ/A button switches to
 * plain typing; the choice is remembered.
 *
 * onChange receives an event-like { target: { value } }, so it drops in for <input>.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../utils/api.js';
import { getSession } from '../../utils/auth.js';

const MODE_KEY = 'tvettrack_nepali_typing';
const cache = new Map();
const WORD_AT_END = /[A-Za-z]+$/;

export async function fetchSuggestions(word) {
  const key = word.toLowerCase();
  if (cache.has(key)) return cache.get(key);
  let list = [];
  try {
    const r = await api('GET', `/transliterate?q=${encodeURIComponent(word)}`, null, getSession()?.token);
    list = Array.isArray(r?.suggestions) ? r.suggestions : [];
  } catch { list = []; }
  if (list.length) cache.set(key, list);
  return list;
}

/** The Latin word just before the caret, and where it starts. */
export function wordBefore(text, caret) {
  const m = text.slice(0, caret).match(WORD_AT_END);
  return m ? { word: m[0], start: caret - m[0].length } : null;
}

export default function NepaliInput({ value, onChange, multiline = false, className = '', style, ...rest }) {
  const ref = useRef(null);
  const listRef = useRef(null);
  const listId = useId();
  const [on, setOn] = useState(() => { try { return localStorage.getItem(MODE_KEY) !== 'off'; } catch { return true; } });
  const [sugs, setSugs] = useState([]);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState(null);
  const pendingCaret = useRef(null);
  const text = String(value ?? '');
  const show = on && sugs.length > 0;

  const emit = (v, caret) => { pendingCaret.current = caret; onChange?.({ target: { value: v } }); };
  useLayoutEffect(() => {
    if (pendingCaret.current != null && ref.current) {
      ref.current.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }
  });

  const place = () => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ left: r.left, top: r.bottom + 4, width: Math.min(r.width, 320) });
  };
  useLayoutEffect(() => { if (show) place(); }, [show, text]);
  useLayoutEffect(() => {
    const el = listRef.current;
    if (show && el?.showPopover && !el.matches(':popover-open')) { try { el.showPopover(); } catch { /* ignore */ } }
  }, [show, pos]);

  // Suggestions for the word being typed, debounced.
  useEffect(() => {
    if (!on) { setSugs([]); return undefined; }
    const el = ref.current;
    const w = el && document.activeElement === el ? wordBefore(text, el.selectionStart ?? text.length) : null;
    if (!w) { setSugs([]); return undefined; }
    let live = true;
    const t = setTimeout(async () => {
      const list = await fetchSuggestions(w.word);
      if (live) { setSugs(list); setActive(0); }
    }, cache.has(w.word.toLowerCase()) ? 0 : 150);
    return () => { live = false; clearTimeout(t); };
  }, [text, on]);

  /** Swap the word before the caret for Nepali, then add `after`. */
  const commit = async (choice, after = '') => {
    const el = ref.current;
    const caret = el?.selectionStart ?? text.length;
    const w = wordBefore(text, caret);
    if (!w) { if (after) emit(text.slice(0, caret) + after + text.slice(caret), caret + after.length); return; }
    const np = choice ?? (await fetchSuggestions(w.word))[0] ?? w.word;
    const cur = ref.current?.value ?? text;   // the field may have changed while fetching
    const next = cur.slice(0, w.start) + np + after + cur.slice(caret);
    setSugs([]);
    emit(next, w.start + np.length + after.length);
  };

  const onKeyDown = (e) => {
    rest.onKeyDown?.(e);
    if (!on || e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const el = ref.current;
    const hasWord = el && wordBefore(text, el.selectionStart ?? 0) && el.selectionStart === el.selectionEnd;
    if (show && e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(sugs.length - 1, a + 1)); return; }
    if (show && e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)); return; }
    if (show && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setSugs([]); return; }
    if (!hasWord) return;
    if (e.key === ' ' || e.key === ',' || e.key === '?' || e.key === '!' || e.key === '/' || e.key === '(' || e.key === ')') {
      e.preventDefault(); commit(show ? sugs[active] : null, e.key); return;
    }
    if (e.key === '.' || e.key === '|') { e.preventDefault(); commit(show ? sugs[active] : null, '।'); return; }
    if (e.key === 'Enter' && (show || !multiline)) {
      e.preventDefault(); commit(show ? sugs[active] : null, multiline ? '\n' : ''); return;
    }
    if (e.key === 'Tab' && show) commit(sugs[active]);
  };

  const toggle = () => {
    const v = !on; setOn(v); setSugs([]);
    try { localStorage.setItem(MODE_KEY, v ? 'on' : 'off'); } catch { /* ignore */ }
    ref.current?.focus();
  };

  const Tag = multiline ? 'textarea' : 'input';
  const { onKeyDown: _k, onBlur, ...fieldProps } = rest;
  return (
    <span className={`np-field${multiline ? ' is-multi' : ''}`} style={style?.width ? { width: style.width } : undefined}>
      <Tag ref={ref} className={className} style={style} value={text} lang={on ? 'ne' : undefined}
        autoComplete="off" spellCheck={!on}
        role="combobox" aria-expanded={show} aria-controls={show ? listId : undefined} aria-autocomplete="list"
        {...fieldProps}
        onChange={e => onChange?.(e)}
        onKeyDown={onKeyDown}
        onBlur={e => { if (on && wordBefore(text, e.target.selectionStart ?? text.length)) commit(show ? sugs[active] : null); else setSugs([]); onBlur?.(e); }}/>
      <button type="button" className={`np-toggle${on ? ' is-on' : ''}`} onMouseDown={e => e.preventDefault()} onClick={toggle}
        title={on ? 'Nepali typing on — type in English, press space to convert. Click for plain typing.' : 'Plain typing. Click to type Nepali from English.'}
        aria-pressed={on} aria-label="Nepali typing">{on ? 'अ' : 'A'}</button>
      {show && pos && createPortal(
        <div ref={listRef} id={listId} role="listbox" className="sel-list np-list" popover="manual"
          onMouseDown={e => e.preventDefault()}
          style={{ left: pos.left, top: pos.top, minWidth: Math.max(160, pos.width) }}>
          {sugs.map((s, i) => (
            <div key={s} role="option" aria-selected={i === active}
              className={`sel-opt${i === active ? ' is-active' : ''}`}
              onMouseEnter={() => setActive(i)} onClick={() => commit(s)}>
              <span>{s}</span>{i === 0 && <span className="np-hint">space</span>}
            </div>
          ))}
        </div>,
        document.body)}
    </span>
  );
}

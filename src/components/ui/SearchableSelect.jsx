import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import ReactDOM from 'react-dom';

export function DropdownPanel({ anchor, search, setSearch, filtered, value, onChange, setOpen, onAddNew }) {
  const [pos, setPos] = useState({ top: 0, left: 0, width: 200 });
  const [hlIdx, setHlIdx] = useState(-1);
  const listRef = useRef(null);
  useLayoutEffect(() => {
    if (anchor.current) {
      const r = anchor.current.getBoundingClientRect();
      setPos({ top: r.bottom + 2, left: r.left, width: r.width });
    }
  }, []);
  useEffect(() => { setHlIdx(-1); }, [search]);
  const handleKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHlIdx(i => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHlIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && hlIdx >= 0 && filtered[hlIdx]) { e.preventDefault(); onChange(filtered[hlIdx].value); setOpen(false); }
    else if (e.key === 'Escape') { setOpen(false); }
  };
  useEffect(() => {
    if (hlIdx >= 0 && listRef.current) {
      const el = listRef.current.children[hlIdx];
      if (el) el.scrollIntoView({ block: 'nearest' });
    }
  }, [hlIdx]);
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const bg = isDark ? '#1e1e2e' : '#ffffff';
  const border = isDark ? '#3a3a4e' : '#d1d5db';
  const text1 = isDark ? '#e2e8f0' : '#1e293b';
  const text3 = isDark ? '#64748b' : '#94a3b8';
  const bg2 = isDark ? '#2a2a3e' : '#f1f5f9';
  const hlBg = isDark ? '#333355' : '#e0e7ff';
  return (
    <div onMouseDown={e => e.stopPropagation()} style={{position:'fixed', zIndex:99999, top:pos.top, left:pos.left, width:pos.width,
      background:bg, border:`1px solid ${border}`, borderRadius:6,
      boxShadow:'0 8px 32px rgba(0,0,0,0.32)', overflow:'hidden'}}>
      <div style={{padding:'6px 8px', borderBottom:`1px solid ${border}`}}>
        <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Search…" style={{width:'100%', border:'none', background:'transparent',
            outline:'none', fontSize:13, color:text1, boxSizing:'border-box'}}/>
      </div>
      <div ref={listRef} style={{maxHeight:220, overflowY:'auto'}}>
        {filtered.length === 0
          ? <div style={{padding:'10px 12px', color:text3, fontSize:12}}>No results</div>
          : filtered.map((o, idx) => (
              <div key={o.value} onClick={() => { onChange(o.value); setOpen(false); }}
                style={{padding:'7px 12px', cursor:'pointer', fontSize:13,
                  color: o.value == value ? '#6366f1' : text1,
                  background: idx === hlIdx ? hlBg : o.value == value ? 'rgba(99,102,241,0.1)' : 'transparent',
                  fontWeight: o.value == value ? 600 : 400}}
                onMouseEnter={e => { setHlIdx(idx); e.currentTarget.style.background=bg2; }}
                onMouseLeave={e => e.currentTarget.style.background = idx === hlIdx ? hlBg : o.value == value ? 'rgba(99,102,241,0.1)' : 'transparent'}>
                {o.label}
              </div>
            ))
        }
      </div>
      {onAddNew && search.trim() && filtered.length === 0 && (
        <div style={{padding:'6px 8px', borderTop:`1px solid ${border}`}}>
          <div onClick={() => { onAddNew(search.trim()); setOpen(false); }}
            style={{padding:'6px 10px', cursor:'pointer', fontSize:12, color:'#6366f1', fontWeight:500,
              borderRadius:4, border:'1px dashed #6366f1', textAlign:'center'}}
            onMouseEnter={e=>e.currentTarget.style.background='rgba(99,102,241,0.08)'}
            onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
            ＋ Add "{search.trim()}" as new occupation
          </div>
        </div>
      )}
    </div>
  );
}

export default function SearchableSelect({ value, onChange, options, placeholder = '— Select —', disabled = false, onAddNew }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);
  const btnRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setSearch('');
      if (btnRef.current) btnRef.current.focus();
    }
  }, [open]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find(o => o.value == value);
  const filtered = search
    ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  return (
    <div ref={ref} style={{position:'relative'}}>
      <button ref={btnRef} type="button" disabled={disabled} onClick={() => !disabled && setOpen(o => !o)}
        style={{width:'100%', textAlign:'left', padding:'6px 10px', background:'var(--bg2)',
          border:'1px solid var(--border)', borderRadius:6, color: selected ? 'var(--text1)' : 'var(--text3)',
          cursor: disabled ? 'not-allowed' : 'pointer', fontSize:13, display:'flex',
          justifyContent:'space-between', alignItems:'center', minHeight:34}}>
        <span style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1}}>
          {selected ? selected.label : placeholder}
        </span>
        <span style={{marginLeft:6, color:'var(--text3)', fontSize:10, flexShrink:0}}>{open ? '▲' : '▼'}</span>
      </button>
      {open && ReactDOM.createPortal(
        <DropdownPanel
          anchor={ref}
          search={search}
          setSearch={setSearch}
          filtered={filtered}
          value={value}
          onChange={onChange}
          setOpen={setOpen}
          onAddNew={onAddNew}
        />,
        document.body
      )}
    </div>
  );
}

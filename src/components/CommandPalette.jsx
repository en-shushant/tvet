/**
 * Global search and actions — ⌘K / Ctrl-K.
 *
 * Replaces the institute-only search that lived in the sidebar, widening it to
 * clients and occupations and adding the actions people otherwise hunt through
 * navigation for. Matching mirrors the old sidebar behaviour (name, acronym,
 * registration number, PAN) so nothing that used to be findable stops being so.
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useOccupations } from '../utils/useMasterData.js';

const MAX_PER_GROUP = 5;

export default function CommandPalette({ open, onClose, institutes = [], clients = [], actions = [] }) {
  const OCCUPATIONS = useOccupations();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => { if (open) { setQ(''); setActive(0); } }, [open]);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    // With no query, show the actions — the palette doubles as a launcher.
    if (!term) return actions.length ? [{ key: 'actions', label: 'Actions', items: actions }] : [];

    const hit = (...vals) => vals.some(v => v && String(v).toLowerCase().includes(term));
    const out = [];

    const inst = institutes
      .filter(i => hit(i.name, i.acronym, i.regNo, i.pan, i.address))
      .slice(0, MAX_PER_GROUP)
      .map(i => ({
        id: `inst-${i.id}`,
        label: i.name,
        meta: [i.acronym, i.regNo && `Reg. ${i.regNo}`].filter(Boolean).join(' · '),
        icon: 'account_balance',
        run: () => window.__paletteOpenInstitute?.(i),
      }));
    if (inst.length) out.push({ key: 'institutes', label: 'Institutes', items: inst });

    const cl = clients
      .filter(c => hit(c.fullName, c.shortName, c.address))
      .slice(0, MAX_PER_GROUP)
      .map(c => ({
        id: `client-${c.id}`,
        label: c.fullName || c.shortName,
        meta: [c.shortName, c.type].filter(Boolean).join(' · '),
        icon: 'apartment',
        run: () => window.__paletteGo?.('master'),
      }));
    if (cl.length) out.push({ key: 'clients', label: 'Clients', items: cl });

    const occ = OCCUPATIONS
      .filter(o => hit(o.name, o.sector))
      .slice(0, MAX_PER_GROUP)
      .map(o => ({
        id: `occ-${o.id}`,
        label: o.name,
        meta: [o.sector, o.level].filter(Boolean).join(' · '),
        icon: 'construction',
        run: () => window.__paletteGo?.('master'),
      }));
    if (occ.length) out.push({ key: 'occupations', label: 'Occupations', items: occ });

    const acts = actions.filter(a => hit(a.label)).slice(0, MAX_PER_GROUP);
    if (acts.length) out.push({ key: 'actions', label: 'Actions', items: acts });

    return out;
  }, [q, institutes, clients, actions, OCCUPATIONS]);

  // Flattened for keyboard traversal across group boundaries.
  const flat = useMemo(() => groups.flatMap(g => g.items), [groups]);
  useEffect(() => { setActive(0); }, [q]);

  const choose = (item) => { onClose(); item?.run?.(); };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(flat.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(flat[active]); }
  };

  // Keep the highlighted row in view when arrowing past the fold.
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  let idx = -1;
  return createPortal(
    <div onClick={onClose} role="presentation"
      style={{position:'fixed', inset:0, zIndex:'var(--z-modal)', display:'flex',
        alignItems:'flex-start', justifyContent:'center', paddingTop:'12vh',
        background:'rgba(16,20,28,.45)', backdropFilter:'blur(2px)'}}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Search TVETtrack"
        style={{width:'min(620px, calc(100vw - 32px))', background:'var(--surface)',
          borderRadius:'var(--radius-card)', boxShadow:'var(--shadow-lg)', overflow:'hidden'}}>

        <div style={{display:'flex', alignItems:'center', gap:10, padding:'14px 18px',
          borderBottom:'1px solid var(--border)'}}>
          <span className="material-icons-round" aria-hidden="true"
            style={{fontSize:20, color:'var(--text3)'}}>search</span>
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKeyDown}
            placeholder="Search institutes, clients, occupations…"
            aria-label="Search TVETtrack"
            style={{flex:1, border:'none', outline:'none', background:'transparent',
              fontSize:15, fontFamily:'var(--font)', color:'var(--text)'}}/>
          <kbd style={{fontSize:11, color:'var(--text3)', border:'1px solid var(--border)',
            borderRadius:6, padding:'2px 6px'}}>esc</kbd>
        </div>

        <div ref={listRef} style={{maxHeight:'52vh', overflowY:'auto', padding:'8px 0'}}>
          {flat.length === 0 ? (
            <div style={{padding:'28px 18px', textAlign:'center', color:'var(--text3)', fontSize:13}}>
              Nothing matches “{q}”.
            </div>
          ) : groups.map(g => (
            <div key={g.key}>
              <div style={{fontSize:10, fontWeight:700, letterSpacing:'.6px', textTransform:'uppercase',
                color:'var(--text3)', padding:'8px 18px 4px'}}>{g.label}</div>
              {g.items.map(item => {
                idx += 1;
                const isActive = idx === active;
                const myIdx = idx;
                return (
                  <button key={item.id} data-active={isActive}
                    onMouseEnter={() => setActive(myIdx)}
                    onClick={() => choose(item)}
                    style={{display:'flex', alignItems:'center', gap:11, width:'100%', textAlign:'left',
                      padding:'9px 18px', border:'none', cursor:'pointer', fontFamily:'var(--font)',
                      background: isActive ? 'var(--bg2)' : 'transparent'}}>
                    <span className="material-icons-round" aria-hidden="true"
                      style={{fontSize:17, color:'var(--text3)', flexShrink:0}}>{item.icon || 'chevron_right'}</span>
                    <span style={{flex:1, minWidth:0}}>
                      <span style={{display:'block', fontSize:13.5, color:'var(--text)',
                        overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{item.label}</span>
                      {item.meta && (
                        <span style={{display:'block', fontSize:11.5, color:'var(--text3)',
                          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{item.meta}</span>
                      )}
                    </span>
                    {isActive && <span style={{fontSize:11, color:'var(--text3)'}}>↵</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

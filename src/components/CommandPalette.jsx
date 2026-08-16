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

const MAX_PER_GROUP = 6;

/**
 * Trailing words that mean "open this institute on that tab".
 *
 * So "wltti documents" goes straight to the Documents tab rather than to the
 * institute's front page, which is where you were headed anyway — the search
 * was only ever the first half of the journey.
 *
 * Compliance resolves to nstb because Compliance is a group header rather than
 * a pane; nstb is the record type it opens on by default.
 */
const TAB_WORDS = [
  { tab: 'profile',    label: 'Overview',    words: ['overview', 'profile', 'details', 'info'] },
  { tab: 'experience', label: 'Assignments', words: ['experience', 'assignments', 'assignment', 'work', 'projects', 'eoi'] },
  { tab: 'clients',    label: 'Clients',     words: ['clients', 'client'] },
  { tab: 'nstb',       label: 'Compliance',  words: ['compliance', 'nstb', 'tax', 'affiliation', 'infrastructure', 'renewal'] },
  { tab: 'documents',  label: 'Documents',   words: ['documents', 'document', 'docs', 'files', 'papers'] },
];

/**
 * Splits "wltti documents" into a name to match and a tab to open. Only a
 * trailing word counts, and only when something remains to search on — a bare
 * "documents" should still find the Documents screen, not every institute.
 */
function splitTabSuffix(term) {
  const parts = term.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { name: term, tab: null, tabLabel: null };
  const last = parts[parts.length - 1];
  const hit = TAB_WORDS.find(t => t.words.some(w => w === last || w.startsWith(last) && last.length >= 3));
  if (!hit) return { name: term, tab: null, tabLabel: null };
  return { name: parts.slice(0, -1).join(' '), tab: hit.tab, tabLabel: hit.label };
}

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

    // With no query, show the actions grouped as they were declared, so the
    // palette doubles as a map of the app rather than a flat list of five.
    if (!term) {
      const byGroup = new Map();
      for (const a of actions) {
        const g = a.group || 'Actions';
        if (!byGroup.has(g)) byGroup.set(g, []);
        byGroup.get(g).push(a);
      }
      return [...byGroup.entries()].map(([label, items]) => ({ key: label, label, items }));
    }

    /**
     * Rank by where the match lands, not merely whether it matched. Typing
     * "nab" should put Nabaratna above a firm with "nab" buried mid-address,
     * which a plain `includes` filter cannot express.
     */
    const scoreFor = (needle, vals) => {
      if (!needle) return 0;
      const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const wordStart = new RegExp(`\\b${escaped}`);
      let best = 0;
      for (const v of vals) {
        if (!v) continue;
        const t = String(v).toLowerCase();
        if (t === needle) best = Math.max(best, 100);
        else if (t.startsWith(needle)) best = Math.max(best, 80);
        // A word starting with the term, e.g. "Manpower" in "Brilliant Manpower".
        else if (wordStart.test(t)) best = Math.max(best, 60);
        else if (t.includes(needle)) best = Math.max(best, 30);
      }
      return best;
    };
    const score = (...vals) => scoreFor(term, vals);

    // Returns the built items plus the group's best score, so groups can be
    // ordered by relevance rather than by category. `overrideTerm` lets the
    // institute list match on the name alone when a tab word was typed after it.
    const ranked = (rows, fields, build, overrideTerm) => {
      const needle = overrideTerm === undefined ? term : overrideTerm;
      const hits = rows
        .map(r => ({ r, s: scoreFor(needle, fields(r)) }))
        .filter(x => x.s > 0)
        .sort((a, b) => b.s - a.s);
      return { items: hits.slice(0, MAX_PER_GROUP).map(x => build(x.r)), best: hits[0]?.s || 0 };
    };

    const out = [];
    const { name, tab, tabLabel } = splitTabSuffix(term);

    // Institutes first: searching a firm by name is the commonest reason to
    // open this, and burying it under navigation would be perverse.
    const instTerm = tab ? name : term;
    const inst = ranked(institutes,
      i => [i.name, i.acronym, i.regNo, i.pan, i.address],
      i => ({
        id: `inst-${i.id}`,
        label: i.name,
        // When a tab was asked for, say so instead of repeating the address.
        meta: tabLabel
          ? `${i.acronym ? i.acronym + ' · ' : ''}Open ${tabLabel}`
          : [i.acronym, i.regNo && `Reg. ${i.regNo}`, i.address].filter(Boolean).join(' · '),
        icon: tabLabel ? 'open_in_new' : 'account_balance',
        run: () => window.__paletteOpenInstitute?.(i, tab),
      }), instTerm);
    if (inst.items.length) out.push({ key: 'institutes', label: 'Institutes', items: inst.items, best: inst.best + 1 });

    const cl = ranked(clients,
      c => [c.fullName, c.shortName, c.type, c.address],
      c => ({
        id: `client-${c.id}`,
        label: c.fullName || c.shortName,
        meta: [c.shortName, c.type].filter(Boolean).join(' · '),
        icon: 'apartment',
        run: () => window.__paletteGo?.('clients'),
      }));
    if (cl.items.length) out.push({ key: 'clients', label: 'Clients', items: cl.items, best: cl.best });

    const occ = ranked(OCCUPATIONS,
      o => [o.name, o.sector, o.level],
      o => ({
        id: `occ-${o.id}`,
        label: o.name,
        meta: [o.sector, o.level].filter(Boolean).join(' · '),
        icon: 'work',
        run: () => window.__paletteGo?.('master/occupations'),
      }));
    if (occ.items.length) out.push({ key: 'occupations', label: 'Occupations', items: occ.items, best: occ.best });

    // Actions match on their keywords too, so "vat", "eoi" or "palika" find the
    // screen that deals with them without knowing its title.
    const actHits = actions
      .map(a => ({ a, s: score(a.label, a.keywords, a.group) }))
      .filter(x => x.s > 0)
      .sort((x, y) => y.s - x.s);
    if (actHits.length) out.push({
      key: 'actions', label: 'Actions', best: actHits[0].s,
      items: actHits.slice(0, 8).map(x => ({
        ...x.a, meta: x.a.group && x.a.group !== 'Actions' ? x.a.group : undefined })),
    });

    // Strongest match first. "vat" should lead with the screen that deals with
    // VAT, not with a firm whose name happens to contain those letters inside
    // "Private". Institutes carry a +1 so they win a genuine tie, since looking
    // one up is the commonest reason to open this at all.
    return out.sort((a, b) => (b.best || 0) - (a.best || 0));
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
            placeholder="Search institutes, clients, occupations, or jump to a screen…"
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

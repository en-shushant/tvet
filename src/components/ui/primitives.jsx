/**
 * Shared presentation primitives.
 *
 * These exist so screens stop hand-rolling the same card, badge and empty state
 * with inline styles — the app currently carries ~1,776 inline style objects
 * against ~1,015 className uses, which is why no two screens quite match.
 *
 * Everything reads from the tokens in index.css; none of these should hardcode a
 * colour. Pastel-surfaced cards deliberately take no border and no shadow —
 * separation comes from fill alone.
 */
import { useState } from 'react';

/* ── Page header ─────────────────────────────────────────────────────────── */

/**
 * Page title with optional breadcrumb and right-aligned actions.
 * `emphasis` splits the title so the second half reads bold against a light
 * first half, as in "My **Organization**".
 */
export function PageHeader({ title, emphasis, sub, breadcrumb, actions }) {
  return (
    <header className="shell-head">
      <div style={{flex:1, minWidth:0}}>
        {breadcrumb && (
          <nav style={{fontSize:'var(--fs-meta)', color:'var(--text3)', marginBottom:6}}>{breadcrumb}</nav>
        )}
        <h1 className="page-title">
          {title}{emphasis && <strong> {emphasis}</strong>}
        </h1>
        {sub && <div className="shell-head-sub">{sub}</div>}
      </div>
      {actions && <div style={{display:'flex', gap:8, alignItems:'center', flexShrink:0}}>{actions}</div>}
    </header>
  );
}

/* ── KPI card ────────────────────────────────────────────────────────────── */

/**
 * A metric in the reference's frame: the label and its icon sit in the pale
 * frame, the number on the white panel below it. `tone` is accepted for the
 * screens that still pass one, but every tile now shares the neutral frame —
 * one card language across the app rather than a colour per tile.
 */
// The older pastel names map onto a small set of tints for the icon chip.
const KPI_TONES = { blue: 'blue', periwinkle: 'indigo', info: 'sky', mint: 'teal', lilac: 'violet',
  cream: 'amber', warning: 'amber', error: 'rose', success: 'teal', pink: 'rose' };

export function KpiCard({ label, value, unit, icon, tone, footer, onClick }) {
  const interactive = typeof onClick === 'function';
  return (
    <div
      className={`frame kpi-card tone-${KPI_TONES[tone] || 'blue'}${interactive ? ' is-link' : ''}`}
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}>
      <div className="frame-head">
        <span style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{label}</span>
        {icon && <span className="frame-head-action"><span className="kpi-icon material-icons-round" aria-hidden="true">{icon}</span></span>}
      </div>
      <div className="frame-body">
        <div style={{display:'flex', alignItems:'baseline', flexWrap:'wrap'}}>
          <span className="kpi-value">{value}</span>
          {unit && <span className="kpi-unit">{unit}</span>}
        </div>
        {footer && <div className="kpi-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ── Emphasis card ───────────────────────────────────────────────────────── */

/**
 * The one card per screen that carries the primary action. In the reference
 * the strong colour is saved for the active control, so this is a framed card
 * with a near-black accent line rather than a solid black slab.
 */
export function InkCard({ title, sub, children, style }) {
  return (
    <div className="frame" style={style}>
      <div className="frame-body" style={{display:'flex', flexDirection:'column'}}>
        {title && <div style={{fontSize:'var(--fs-card)', fontWeight:600, lineHeight:1.35, color:'var(--text)'}}>{title}</div>}
        {sub && <div style={{fontSize:'var(--fs-meta)', color:'var(--text3)', marginTop:4}}>{sub}</div>}
        {children && <div style={{marginTop:'auto', paddingTop:14}}>{children}</div>}
      </div>
    </div>
  );
}

/* ── Status badge ────────────────────────────────────────────────────────── */

const STATUS_TONES = {
  success: { bg:'var(--success-light)', fg:'var(--success-dark)', dot:'var(--success)', line:'color-mix(in srgb, var(--success) 22%, transparent)' },
  warning: { bg:'var(--warning-light)', fg:'#92400e',            dot:'var(--warning)', line:'color-mix(in srgb, var(--warning) 25%, transparent)' },
  error:   { bg:'var(--error-light)',   fg:'var(--red)',          dot:'var(--error)',   line:'color-mix(in srgb, var(--error) 20%, transparent)' },
  info:    { bg:'var(--surface)',       fg:'var(--text)',         dot:'var(--text2)',   line:'var(--border)' },
  neutral: { bg:'var(--surface)',       fg:'var(--text2)',        dot:'var(--text3)',   line:'var(--border)' },
};

/** Small squared tag with a leading dot. `tone` is semantic, not a colour name. */
export function StatusBadge({ tone = 'neutral', children, title }) {
  const t = STATUS_TONES[tone] || STATUS_TONES.neutral;
  return (
    <span title={title} style={{display:'inline-flex', alignItems:'center', gap:6, height:22,
      background:t.bg, color:t.fg, border:`.5px solid ${t.line}`, borderRadius:6,
      padding:'0 8px', fontSize:'var(--fs-meta)', fontWeight:500, whiteSpace:'nowrap'}}>
      <span aria-hidden="true" style={{width:6, height:6, borderRadius:'50%', background:t.dot, flexShrink:0}}/>
      {children}
    </span>
  );
}

/* ── Pill tabs ───────────────────────────────────────────────────────────── */

/**
 * The reference's segmented control: equal segments in a hairline tray, the
 * current one filled near-black. `tabs` is [{ id, label, badge }].
 */
export function PillTabs({ tabs, value, onChange, ariaLabel = 'Sections' }) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="seg"
      style={{display:'inline-flex', marginBottom:16, maxWidth:'100%', flexWrap:'wrap'}}>
      {tabs.map(t => {
        const active = t.id === value;
        return (
          <button key={t.id} type="button" role="tab" aria-selected={active} onClick={() => onChange(t.id)}
            style={{flex:'0 0 auto', padding:'0 14px', display:'inline-flex', alignItems:'center', gap:6}}>
            {t.label}
            {t.badge != null && (
              <span style={{fontSize:11, fontWeight:500, opacity: active ? .7 : .6}}>{t.badge}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ── Segmented progress ──────────────────────────────────────────────────── */

/**
 * Discrete blocks rather than a continuous bar — filled blocks solid, the
 * remainder dashed outlines. Reads as "5 of 8" at a glance, which suits counts
 * (documents complete, years recorded) better than a percentage bar.
 */
export function SegmentedProgress({ filled, total, tone = 'var(--primary)', label }) {
  const n = Math.max(0, Math.min(total, filled));
  return (
    <div>
      <div style={{display:'flex', gap:6}} role="img"
        aria-label={label || `${n} of ${total}`}>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} style={{
            flex:1, height:26, borderRadius:8,
            background: i < n ? tone : 'transparent',
            border: i < n ? 'none' : '1px dashed var(--border2)',
          }}/>
        ))}
      </div>
      {label && <div style={{fontSize:'var(--fs-meta)', color:'var(--on-pastel-muted)', marginTop:8}}>{label}</div>}
    </div>
  );
}

/* ── Empty state ─────────────────────────────────────────────────────────── */

export function EmptyState({ icon = 'inbox', title, body, action }) {
  return (
    <div style={{textAlign:'center', padding:'48px 24px'}}>
      <span aria-hidden="true" style={{display:'inline-flex', width:40, height:40, borderRadius:10,
        alignItems:'center', justifyContent:'center', border:'.5px solid var(--border)',
        background:'var(--surface)', boxShadow:'0 4px 7px rgba(0,0,0,.04)'}}>
        <span className="material-icons-round" style={{fontSize:20, color:'var(--text3)'}}>{icon}</span>
      </span>
      <div style={{fontSize:'var(--fs-card)', fontWeight:500, color:'var(--text)', marginTop:12}}>{title}</div>
      {body && (
        <div style={{fontSize:'var(--fs-body)', color:'var(--text3)', marginTop:4,
          maxWidth:400, marginLeft:'auto', marginRight:'auto', lineHeight:1.55}}>{body}</div>
      )}
      {action && <div style={{marginTop:16}}>{action}</div>}
    </div>
  );
}

export function Skeleton({ w = '100%', h = 14, r = 8, style }) {
  return <div className="skeleton" style={{width:w, height:h, borderRadius:r, ...style}}/>;
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} style={{display:'flex', gap:12, padding:'12px 0',
          borderBottom:'1px solid var(--border)'}}>
          {Array.from({ length: cols }, (_, c) => (
            <Skeleton key={c} w={c === 0 ? '30%' : '16%'} />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ── Institute avatar ────────────────────────────────────────────────────── */

/** Corporate suffixes carry no identity, so they never contribute an initial. */
const NOISE_WORDS = new Set([
  'pvt', 'pvt.', 'private', 'ltd', 'ltd.', 'limited', 'company', 'co', 'co.',
  'and', 'of', 'the', '&',
]);

/**
 * Two letters, preferring the acronym people actually use for the institute.
 * Falls back to the initials of the first meaningful words in the name.
 */
export function initialsFor(name = '', acronym = '') {
  const acr = acronym.replace(/[^A-Za-z]/g, '');
  if (acr.length >= 2) return acr.slice(0, 2).toUpperCase();

  const words = name.split(/\s+/)
    .map(w => w.replace(/[^A-Za-z.]/g, ''))
    .filter(w => w && !NOISE_WORDS.has(w.toLowerCase()));
  if (words.length === 0) return (acr || name.trim().slice(0, 2) || '?').slice(0, 2).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Only the fill varies; the letters stay near-black (and near-white in dark
 * mode) rather than taking the tint's own hue. Semantic colours like --warning
 * are tuned for icons on white and drop well below a readable contrast ratio
 * against a pale surface, and colouring an avatar green or red would also imply
 * a status the institute does not have.
 */
const AVATAR_TINTS = [
  '--pastel-periwinkle', '--pastel-blue', '--pastel-mint',
  '--pastel-pink', '--pastel-cream', '--pastel-lilac',
];

/** Stable per-institute tint, so the same firm looks the same on every screen. */
export function tintFor(key = '') {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
}

/**
 * The institute's logo where one exists, its initials where one does not.
 *
 * The previous fallback was a generic bank icon, identical for all 25
 * institutes, so it occupied avatar-sized space while carrying no information.
 * Initials are at least identifying, and the tint is derived from the name so a
 * firm keeps the same colour everywhere it appears.
 *
 * A logo that genuinely 404s falls back to the same initials rather than
 * leaving the browser's broken-image glyph.
 *
 * Failure is tracked per-URL, not as a boolean. `useCachedLogo` renders the raw
 * URL first and swaps in a cached object URL once one is ready, so a boolean
 * would latch on the first source and permanently hide a logo that loads fine
 * from the second. `fallbackSrc` is that raw URL: if the cached copy is stale or
 * unreadable we retry the original before giving up on the logo entirely.
 */
export function InstituteAvatar({ src, fallbackSrc, name = '', acronym = '', size = 42, radius = 12 }) {
  const [failedSrcs, setFailedSrcs] = useState(() => new Set());
  const noteFailure = (bad) => setFailedSrcs(prev => {
    if (prev.has(bad)) return prev;
    const next = new Set(prev);
    next.add(bad);
    return next;
  });

  // First source that has not already failed for this institute.
  const candidate = [src, fallbackSrc].find(u => u && !failedSrcs.has(u));

  if (candidate) {
    return (
      <img key={candidate} src={candidate} alt="" onError={() => noteFailure(candidate)}
        style={{width:size, height:size, objectFit:'contain', borderRadius:radius,
          background:'#fff', padding:Math.max(2, Math.round(size * 0.07)), flexShrink:0}}/>
    );
  }

  const bg = tintFor(name || acronym);
  return (
    <div aria-hidden="true"
      style={{width:size, height:size, borderRadius:radius, background:`var(${bg})`,
        display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
        color:'var(--text)', fontWeight:700, letterSpacing:'.02em',
        fontSize:Math.round(size * 0.38), fontFamily:'var(--font)', userSelect:'none'}}>
      {initialsFor(name, acronym)}
    </div>
  );
}

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
    <header style={{display:'flex', alignItems:'flex-start', gap:16, flexWrap:'wrap', marginBottom:22}}>
      <div style={{flex:1, minWidth:0}}>
        {breadcrumb && (
          <nav style={{fontSize:'var(--fs-meta)', color:'var(--text3)', marginBottom:6}}>{breadcrumb}</nav>
        )}
        {/* Title and emphasis are one family at two weights — see .page-title. */}
        <h1 className="page-title">
          {title}{emphasis && <strong> {emphasis}</strong>}
        </h1>
        {sub && <p style={{fontSize:'var(--fs-body)', color:'var(--text3)', margin:'6px 0 0'}}>{sub}</p>}
      </div>
      {actions && <div style={{display:'flex', gap:8, alignItems:'center', flexShrink:0}}>{actions}</div>}
    </header>
  );
}

/* ── KPI card ────────────────────────────────────────────────────────────── */

/**
 * Large metric on a pastel surface.
 * `value` is rendered oversized; `unit` sits small and muted beside it, the way
 * "780 / 1 000" reads in the reference.
 */
export function KpiCard({ label, value, unit, icon, tone = 'periwinkle', footer, onClick }) {
  const [hover, setHover] = useState(false);
  const interactive = typeof onClick === 'function';
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={interactive ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      style={{
        background:`var(--pastel-${tone})`,
        borderRadius:'var(--radius-card)',
        padding:'18px 20px 20px',
        cursor: interactive ? 'pointer' : 'default',
        transition:'transform .16s, box-shadow .16s',
        transform: interactive && hover ? 'translateY(-2px)' : 'none',
        boxShadow: interactive && hover ? 'var(--shadow-hover)' : 'none',
        minWidth:0,
      }}>
      <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:14}}>
        {icon && (
          <span style={{width:30, height:30, borderRadius:'var(--radius-pill)', flexShrink:0,
            background:'var(--canvas-card)', display:'flex', alignItems:'center', justifyContent:'center'}}>
            <span className="material-icons-round" style={{fontSize:16, color:'var(--on-pastel)'}}>{icon}</span>
          </span>
        )}
        <span style={{fontSize:'var(--fs-card)', fontWeight:700, color:'var(--on-pastel)',
          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{label}</span>
      </div>
      <div style={{display:'flex', alignItems:'baseline', gap:8}}>
        <span style={{fontSize:'var(--fs-kpi)', fontWeight:800, lineHeight:1,
          letterSpacing:'-0.03em', color:'var(--on-pastel)'}}>{value}</span>
        {unit && <span style={{fontSize:'var(--fs-body)', color:'var(--on-pastel-muted)'}}>{unit}</span>}
      </div>
      {footer && (
        <div style={{marginTop:12, fontSize:'var(--fs-meta)', color:'var(--on-pastel-muted)'}}>{footer}</div>
      )}
    </div>
  );
}

/* ── Emphasis card ───────────────────────────────────────────────────────── */

/** The single high-contrast card per screen — carries the primary action. */
export function InkCard({ title, sub, children, style }) {
  return (
    <div style={{background:'var(--ink)', color:'var(--on-ink)', borderRadius:'var(--radius-card)',
      padding:'20px 22px', display:'flex', flexDirection:'column', ...style}}>
      {title && <div style={{fontSize:'var(--fs-title)', fontWeight:700, lineHeight:1.25}}>{title}</div>}
      {sub && <div style={{fontSize:'var(--fs-meta)', color:'var(--on-ink-muted)', marginTop:6}}>{sub}</div>}
      {children && <div style={{marginTop:'auto', paddingTop:16}}>{children}</div>}
    </div>
  );
}

/* ── Status badge ────────────────────────────────────────────────────────── */

const STATUS_TONES = {
  success: { bg:'var(--success-light)', fg:'var(--success-dark, #0b7a68)', dot:'var(--success)' },
  warning: { bg:'var(--warning-light)', fg:'#8A5A00',                      dot:'var(--warning)' },
  error:   { bg:'var(--error-light)',   fg:'#B3261E',                      dot:'var(--error)' },
  info:    { bg:'var(--primary-light)', fg:'var(--primary-dark)',          dot:'var(--primary)' },
  neutral: { bg:'var(--bg2)',           fg:'var(--text2)',                 dot:'var(--text3)' },
};

/** Small pill with a leading dot. `tone` is semantic, not a colour name. */
export function StatusBadge({ tone = 'neutral', children, title }) {
  const t = STATUS_TONES[tone] || STATUS_TONES.neutral;
  return (
    <span title={title} style={{display:'inline-flex', alignItems:'center', gap:6,
      background:t.bg, color:t.fg, borderRadius:'var(--radius-pill)',
      padding:'3px 10px', fontSize:'var(--fs-meta)', fontWeight:600, whiteSpace:'nowrap'}}>
      <span aria-hidden="true" style={{width:6, height:6, borderRadius:'50%', background:t.dot, flexShrink:0}}/>
      {children}
    </span>
  );
}

/* ── Pill tabs ───────────────────────────────────────────────────────────── */

/**
 * Rounded tab strip. The active tab is solid ink; the rest are a pale fill with
 * no border. `tabs` is [{ id, label, badge }].
 */
export function PillTabs({ tabs, value, onChange, ariaLabel = 'Sections' }) {
  return (
    <div role="tablist" aria-label={ariaLabel}
      style={{display:'flex', gap:8, flexWrap:'wrap', marginBottom:18}}>
      {tabs.map(t => {
        const active = t.id === value;
        return (
          <button key={t.id} role="tab" aria-selected={active} onClick={() => onChange(t.id)}
            style={{
              display:'inline-flex', alignItems:'center', gap:7,
              background: active ? 'var(--ink)' : 'var(--bg2)',
              color: active ? 'var(--on-ink)' : 'var(--text2)',
              border:'none', borderRadius:'var(--radius-pill)',
              padding:'9px 18px', fontSize:'var(--fs-body)',
              fontWeight: active ? 700 : 500,
              fontFamily:'var(--font)', cursor:'pointer', transition:'background .16s, color .16s',
            }}>
            {t.label}
            {t.badge != null && (
              <span style={{fontSize:11, fontWeight:700, opacity:.65}}>{t.badge}</span>
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
    <div style={{textAlign:'center', padding:'56px 24px'}}>
      <span className="material-icons-round" aria-hidden="true"
        style={{fontSize:42, color:'var(--text3)', opacity:.4}}>{icon}</span>
      <div style={{fontSize:'var(--fs-card)', fontWeight:700, color:'var(--text)', marginTop:12}}>{title}</div>
      {body && (
        <div style={{fontSize:'var(--fs-body)', color:'var(--text3)', marginTop:6,
          maxWidth:380, marginLeft:'auto', marginRight:'auto', lineHeight:1.55}}>{body}</div>
      )}
      {action && <div style={{marginTop:18}}>{action}</div>}
    </div>
  );
}

/* ── Skeletons ───────────────────────────────────────────────────────────── */

/** Placeholder block. Prefer these over a full-screen spinner. */
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

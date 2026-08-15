import { useState, useEffect, useMemo } from 'react';
import { useCachedLogo } from '../utils/logoCache.js';
import Pagination from './ui/Pagination.jsx';
import { Btn } from '../md.jsx';
import { usePagination } from '../utils/hooks.js';
import { fmt, daysUntilRenewal } from '../utils/format.js';
import { PageHeader, StatusBadge, EmptyState, InstituteAvatar } from './ui/primitives.jsx';

const VIEW_KEY = 'tvettrack_institutes_view';

const STATUS_TONE = {
  'Active': 'success',
  'Pending Renewal': 'warning',
  'Expired': 'error',
};

function RenewalNote({ renewalDue }) {
  const days = daysUntilRenewal(renewalDue);
  if (days == null) {
    return <span style={{fontSize:'var(--fs-meta)', color:'var(--text3)'}}>Renewal date not set</span>;
  }
  const overdue = days < 0;
  return (
    <span style={{fontSize:'var(--fs-meta)', color: overdue ? 'var(--error)' : days <= 60 ? 'var(--warning)' : 'var(--text3)'}}>
      {overdue ? `Renewal overdue by ${Math.abs(days)} days` : `Renewal in ${days} days`}
    </span>
  );
}

/** Logo where the institute has one, its own initials where it does not. */
function InstLogo({ inst, size = 42 }) {
  const src = useCachedLogo(inst.logo);
  // fallbackSrc is the raw URL: the cache layer may hand back an object URL that
  // is stale or unreadable, and the original usually still loads.
  return <InstituteAvatar src={src} fallbackSrc={inst.logo}
    name={inst.name} acronym={inst.acronym} size={size}/>;
}

/* ── Card ────────────────────────────────────────────────────────────────── */

function InstituteCard({ inst, onSelect, showStats }) {
  const [hover, setHover] = useState(false);
  return (
    <div onClick={() => onSelect(inst)}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      role="button" tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter') onSelect(inst); }}
      style={{background:'var(--canvas-card)', borderRadius:'var(--radius-card)', padding:'18px 20px',
        cursor:'pointer', transition:'transform .16s, box-shadow .16s',
        transform: hover ? 'translateY(-2px)' : 'none',
        boxShadow: hover ? 'var(--shadow-hover)' : 'var(--shadow-flat)'}}>

      <div style={{display:'flex', alignItems:'flex-start', gap:12, marginBottom:14}}>
        <InstLogo inst={inst}/>
        <div style={{flex:1, minWidth:0}}>
          <div style={{fontSize:'var(--fs-card)', fontWeight:700, lineHeight:1.3, color:'var(--text)'}}>
            {inst.name}
          </div>
          <div style={{display:'flex', alignItems:'center', gap:8, marginTop:6, flexWrap:'wrap'}}>
            {inst.acronym && (
              <span style={{fontSize:'var(--fs-meta)', fontWeight:700, color:'var(--text3)'}}>{inst.acronym}</span>
            )}
            <StatusBadge tone={STATUS_TONE[inst.status] || 'neutral'}>{inst.status}</StatusBadge>
          </div>
        </div>
      </div>

      <div style={{fontSize:'var(--fs-meta)', color:'var(--text3)', lineHeight:1.7, marginBottom:showStats ? 14 : 10}}>
        <div style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{inst.address || '—'}</div>
        <div>Reg. {inst.regNo || '—'}</div>
      </div>

      {showStats && (
        <div style={{display:'flex', gap:18, paddingTop:14, borderTop:'1px solid var(--border)'}}>
          {[
            ['Trainees', fmt(inst.totalTrainees)],
            ['Clients', inst.totalClients || 0],
            ['Programs', inst.totalAffPrograms || 0],
          ].map(([label, value]) => (
            <div key={label} style={{minWidth:0}}>
              <div style={{fontSize:17, fontWeight:800, color:'var(--text)', letterSpacing:'-0.02em'}}>{value}</div>
              <div style={{fontSize:11, color:'var(--text3)', marginTop:1}}>{label}</div>
            </div>
          ))}
          <div style={{marginLeft:'auto', alignSelf:'flex-end', textAlign:'right'}}>
            <RenewalNote renewalDue={inst.renewalDue}/>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Table ───────────────────────────────────────────────────────────────── */

function InstituteTable({ rows, onSelect, showStats }) {
  const TH = { textAlign:'left', fontSize:11, fontWeight:700, letterSpacing:'.4px',
    textTransform:'uppercase', color:'var(--text3)', padding:'10px 12px', whiteSpace:'nowrap' };
  const TD = { padding:'11px 12px', fontSize:'var(--fs-body)', color:'var(--text2)',
    borderTop:'1px solid var(--border)' };
  return (
    <div style={{background:'var(--canvas-card)', borderRadius:'var(--radius-card)', overflow:'hidden'}}>
      <div style={{overflowX:'auto'}}>
        <table style={{width:'100%', borderCollapse:'collapse', minWidth:720}}>
          <thead>
            <tr>
              <th style={TH}>Institute</th>
              <th style={TH}>Status</th>
              {showStats && <th style={{...TH, textAlign:'right'}}>Trainees</th>}
              {showStats && <th style={{...TH, textAlign:'right'}}>Clients</th>}
              {showStats && <th style={{...TH, textAlign:'right'}}>Programs</th>}
              <th style={TH}>Renewal</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(inst => (
              <tr key={inst.id} onClick={() => onSelect(inst)} style={{cursor:'pointer'}}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={TD}>
                  <div style={{display:'flex', alignItems:'center', gap:10}}>
                    <InstLogo inst={inst} size={30}/>
                    <div style={{minWidth:0}}>
                      <div style={{fontWeight:600, color:'var(--text)', overflow:'hidden',
                        textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:340}}>{inst.name}</div>
                      <div style={{fontSize:11, color:'var(--text3)'}}>
                        {[inst.acronym, inst.regNo && `Reg. ${inst.regNo}`].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                  </div>
                </td>
                <td style={TD}><StatusBadge tone={STATUS_TONE[inst.status] || 'neutral'}>{inst.status}</StatusBadge></td>
                {showStats && <td style={{...TD, textAlign:'right', fontVariantNumeric:'tabular-nums'}}>{fmt(inst.totalTrainees)}</td>}
                {showStats && <td style={{...TD, textAlign:'right', fontVariantNumeric:'tabular-nums'}}>{inst.totalClients || 0}</td>}
                {showStats && <td style={{...TD, textAlign:'right', fontVariantNumeric:'tabular-nums'}}>{inst.totalAffPrograms || 0}</td>}
                <td style={TD}><RenewalNote renewalDue={inst.renewalDue}/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── List ────────────────────────────────────────────────────────────────── */

function InstituteList({ institutes, onSelect, onAdd, initialSearch = '', isShortlistOnly = false }) {
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState('All');
  // Remembered, because browsing and administrative work want different views.
  const [view, setView] = useState(() => {
    try { return localStorage.getItem(VIEW_KEY) || 'cards'; } catch { return 'cards'; }
  });
  useEffect(() => { try { localStorage.setItem(VIEW_KEY, view); } catch {} }, [view]);

  useEffect(() => { if (initialSearch) setSearch(initialSearch); }, [initialSearch]);

  // Matching is unchanged: name, registration number, acronym, PAN.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return institutes.filter(i => {
      const matchSearch = !q ||
        i.name.toLowerCase().includes(q) ||
        (i.regNo || '').toLowerCase().includes(q) ||
        (i.acronym && i.acronym.toLowerCase().includes(q)) ||
        (i.pan && i.pan.includes(search.trim()));
      return matchSearch && (statusFilter === 'All' || i.status === statusFilter);
    });
  }, [institutes, search, statusFilter]);

  const { paged, page, setPage, totalPages, total, start, end } = usePagination(filtered, view === 'table' ? 25 : 12);
  const showStats = !isShortlistOnly;

  const counts = useMemo(() => ({
    All: institutes.length,
    'Active': institutes.filter(i => i.status === 'Active').length,
    'Pending Renewal': institutes.filter(i => i.status === 'Pending Renewal').length,
    'Expired': institutes.filter(i => i.status === 'Expired').length,
  }), [institutes]);

  return (
    <div className="fade-in">
      <PageHeader
        title="Institutes"
        sub={`${filtered.length} of ${institutes.length}`}
        actions={onAdd && (
          <Btn className="btn btn-primary" onClick={onAdd}>
            <span className="material-icons-round" style={{fontSize:16}}>add</span> Add institute
          </Btn>
        )}
      />

      <div style={{display:'flex', gap:12, flexWrap:'wrap', alignItems:'center', marginBottom:18}}>
        <div className="search-wrap" style={{flex:1, minWidth:240, maxWidth:420}}>
          <span className="material-icons-round search-icon" style={{fontSize:18}}>search</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, acronym, registration or PAN…"
            aria-label="Search institutes"/>
        </div>

        <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
          {['All','Active','Pending Renewal','Expired'].map(sf => {
            const active = statusFilter === sf;
            return (
              <button key={sf} onClick={() => { setStatusFilter(sf); setPage(1); }}
                style={{display:'inline-flex', alignItems:'center', gap:6, border:'none',
                  background: active ? 'var(--ink)' : 'var(--bg2)',
                  color: active ? 'var(--on-ink)' : 'var(--text2)',
                  borderRadius:'var(--radius-pill)', padding:'7px 14px',
                  fontSize:'var(--fs-body)', fontWeight: active ? 700 : 500,
                  fontFamily:'var(--font)', cursor:'pointer', transition:'background .16s'}}>
                {sf}
                <span style={{fontSize:11, opacity:.6}}>{counts[sf]}</span>
              </button>
            );
          })}
        </div>

        <div style={{display:'flex', background:'var(--bg2)', borderRadius:'var(--radius-pill)', padding:3, marginLeft:'auto'}}>
          {[['cards','grid_view','Cards'], ['table','view_list','Table']].map(([id, icon, label]) => (
            <button key={id} onClick={() => { setView(id); setPage(1); }}
              aria-label={`${label} view`} aria-pressed={view === id} title={`${label} view`}
              style={{display:'flex', alignItems:'center', gap:6, border:'none', cursor:'pointer',
                background: view === id ? 'var(--canvas-card)' : 'transparent',
                color: view === id ? 'var(--text)' : 'var(--text3)',
                borderRadius:'var(--radius-pill)', padding:'6px 13px',
                fontSize:'var(--fs-meta)', fontWeight:600, fontFamily:'var(--font)',
                boxShadow: view === id ? 'var(--shadow-flat)' : 'none', transition:'background .14s'}}>
              <span className="material-icons-round" style={{fontSize:16}}>{icon}</span>{label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{background:'var(--canvas-card)', borderRadius:'var(--radius-card)'}}>
          <EmptyState icon="account_balance"
            title={search || statusFilter !== 'All' ? 'No institutes match' : 'No institutes yet'}
            body={search || statusFilter !== 'All'
              ? 'Try a different search term, or clear the status filter.'
              : 'Institutes you add will be listed here.'}
            action={search || statusFilter !== 'All'
              ? <Btn className="btn btn-secondary btn-sm"
                  onClick={() => { setSearch(''); setStatusFilter('All'); }}>Clear filters</Btn>
              : onAdd && <Btn className="btn btn-primary btn-sm" onClick={onAdd}>Add institute</Btn>}/>
        </div>
      ) : (
        <>
          {view === 'cards' ? (
            <div style={{display:'grid', gap:14, gridTemplateColumns:'repeat(auto-fill, minmax(330px, 1fr))'}}>
              {paged.map(inst => (
                <InstituteCard key={inst.id} inst={inst} onSelect={onSelect} showStats={showStats}/>
              ))}
            </div>
          ) : (
            <InstituteTable rows={paged} onSelect={onSelect} showStats={showStats}/>
          )}
          <Pagination page={page} setPage={setPage} totalPages={totalPages}
            total={total} start={start} end={end} label="institutes"/>
        </>
      )}
    </div>
  );
}

export default InstituteList;

import { useState, useEffect, Suspense } from 'react';
// Eager: needed for the very first paint on any visit — the logged-out entry,
// the default screen, and the chrome that is always mounted. Everything else is
// split out below, so a cold load no longer ships all sixteen screens at once.
import LoginPage from './components/LoginPage.jsx';
import Dashboard from './components/Dashboard.jsx';
import ChangePasswordModal from './components/ChangePasswordModal.jsx';
import CommandPalette from './components/CommandPalette.jsx';
import { UserManagement } from './components/LoginPage.jsx';

// Lazy: reached only by navigating, so their cost belongs on that navigation
// rather than on first paint. One <Suspense> around the screen switch below
// covers all of them.
const ShortlistDashboard = lazyChunk(() => import('./components/ShortlistDashboard.jsx'));
const QuotationsView     = lazyChunk(() => import('./components/QuotationsView.jsx'));
const InstituteList      = lazyChunk(() => import('./components/InstituteList.jsx'));
const InstituteDetail    = lazyChunk(() => import('./components/InstituteDetail.jsx'));
const InstituteForm      = lazyChunk(() => import('./components/InstituteForm.jsx'));
const AnalyticsView      = lazyChunk(() => import('./components/AnalyticsView.jsx'));
const ComplianceCentre   = lazyChunk(() => import('./components/ComplianceCentre.jsx'));
const DocumentsCentre    = lazyChunk(() => import('./components/DocumentsCentre.jsx'));
const DataQuality        = lazyChunk(() => import('./components/DataQuality.jsx'));
const ClientsView        = lazyChunk(() => import('./components/ClientsView.jsx'));
const ProjectCompliance  = lazyChunk(() => import('./components/ProjectCompliance.jsx'));
const MasterData         = lazyChunk(() => import('./components/MasterData.jsx'));
const NSTBBulkPage       = lazyChunk(() => import('./components/NSTBForms.jsx').then(m => ({ default: m.NSTBBulkPage })));
// Design-system reference, reachable at #styleguide. Not in navigation.
const StyleGuide = lazyChunk(() => import('./components/StyleGuide.jsx'));
const ReportsView = lazyChunk(() => import('./components/ReportsView.jsx'));
const Shortlisting = lazyChunk(() => import('./components/Shortlisting.jsx'));
import { ErrorBanner } from './components/ui/Modal.jsx';
import StatusBadge from './components/ui/StatusBadge.jsx';
import { PROVINCES, OCCUPATIONS, FISCAL_YEARS, getAllDistricts, notifyMasterData } from './constants/data.js';
import { getNepaliDate } from './constants/nepali.js';

import { lazyChunk } from './utils/lazyChunk.js';
import { api, normInst, normClient, instToAPI, nstbToAPI } from './utils/api.js';
import { preloadLogos } from './utils/logoCache.js';
import { getSession, setSession as setSessionStorage, clearSession } from './utils/auth.js';

// ─── APP ─────────────────────────────────────────────────────────────────────

const INST_KEY = 'tvettrack_institutes';
const CLIENT_KEY = 'tvettrack_clients';

function loadData(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function saveData(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch(e) { console.error('Storage error', e); }
}

function App() {
  const [session, setSession] = useState(() => getSession());

  // Hash-based routing: #screen or #detail/instituteId
  const parseHash = () => {
    const h = window.location.hash.replace('#','');
    if (!h) return { screen: 'dashboard', instId: null };
    const parts = h.split('/');
    return { screen: parts[0] || 'dashboard', instId: parts[1] || null };
  };
  const [screen, setScreen] = useState(() => {
    const s = parseHash().screen;
    // shortlist role: allow dashboard, institutes, detail, shortlisting; default to dashboard
    if (session?.role === 'shortlist' && !['dashboard','institutes','detail','shortlisting','quotations'].includes(s)) return 'dashboard';
    return s;
  });
  // A nav id may carry a sub-route, e.g. 'master/tools'. The hash already
  // splits on '/', so this needs no new routing — only somewhere to keep it.
  //
  // Must stay up here with the other hooks: this component early-returns for
  // the login, loading and api-error states below, so a hook declared after
  // those returns changes the hook count between renders and crashes React
  // ("Rendered fewer hooks than expected") the moment the app moves between
  // those states — which is what it does on every cold load.
  const [subRoute, setSubRoute] = useState(() => parseHash().instId);
  const [selectedInstitute, setSelectedInstitute] = useState(null);
  const [nstbAddInstitute, setNstbAddInstitute] = useState(null);
  const [institutes, setInstitutes] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [showAddInstitute, setShowAddInstitute] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [jumpToTab, setJumpToTab] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const isSuperAdmin = session?.role === 'superadmin';
  const isAdmin = session?.role === 'admin' || isSuperAdmin;
  const isEditor = session?.role === 'editor';
  const isShortlistOnly = session?.role === 'shortlist';

  const token = session?.token;

  // Clear sessions from old localStorage format (no JWT token)
  useEffect(() => {
    if (session && !session.token) {
      clearSession();
      setSession(null);
    }
  }, []);

  // Bridges the command palette calls when a result is chosen.
  useEffect(() => {
    window.__paletteGo = (id) => handleNavigate(id);
    // A tab may come with it, e.g. searching "WLTTI documents".
    window.__paletteOpenInstitute = (inst, tab) =>
      handleSelectInstitute(inst).then(() => { if (tab) setJumpToTab(tab); });
    return () => { delete window.__paletteGo; delete window.__paletteOpenInstitute; };
  });

  // ⌘K / Ctrl-K opens global search from anywhere.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(o => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Listen for session-expired events from the api() helper (401 responses)
  useEffect(() => {
    const handler = () => {
      setSession(null);
      setApiError('Your session expired. Please sign in again.');
    };
    window.addEventListener('tvettrack:session-expired', handler);
    return () => window.removeEventListener('tvettrack:session-expired', handler);
  }, []);

  // Sync screen state with browser back/forward (hashchange)
  useEffect(() => {
    const onHashChange = () => {
      const { screen: s, instId } = parseHash();
      setScreen(s || 'dashboard');
      if (s === 'detail' && instId) {
        // If we already have this institute loaded, restore it without a fetch
        setSelectedInstitute(prev => {
          if (prev && String(prev.id) === String(instId)) return prev;
          // Otherwise fetch (navigated via browser back to a different detail)
          api('GET', `/institutes/${instId}`, null, getSession()?.token)
            .then(full => setSelectedInstitute(normInst(full)))
            .catch(() => { window.location.hash = 'institutes'; setScreen('institutes'); });
          return prev; // keep showing old while loading
        });
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Load institutes and clients — stale-while-revalidate from sessionStorage cache
  useEffect(() => {
    // Never leave the spinner latched on if we bail out before fetching
    if (!session || !token) { setLoading(false); return; }
    setApiError('');

    const CACHE_KEY = 'tvettrack_cache_v1';
    let cached = null;
    try { cached = JSON.parse(sessionStorage.getItem(CACHE_KEY)); } catch {}

    const applyData = (insts, cls, occs, locs, fromCache) => {
      const normed = insts.map(normInst);
      setInstitutes(normed);
      preloadLogos(normed.map(i => i.logo).filter(Boolean));
      setClients(cls.map(normClient));
      OCCUPATIONS.splice(0, OCCUPATIONS.length, ...occs);
      if (locs?.length) {
        PROVINCES.length = 0;
        locs.forEach(p => PROVINCES.push({
          id: p.id, name: p.name,
          districts: (p.districts||[]).map(d => ({
            id: d.id, name: d.name,
            local_levels: (d.local_levels||[]).map(ll => ({name: ll.name, type: ll.type}))
          }))
        }));
      }
      // Both arrays were just replaced wholesale; tell subscribers once.
      notifyMasterData();
      if (!fromCache) {
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ insts, cls, occs, locs, ts: Date.now() })); } catch {}
      }
    };

    const restoreRoute = () => {
      const { screen: s, instId } = parseHash();
      if (s === 'detail' && instId) {
        api('GET', `/institutes/${instId}`, null, token)
          .then(full => { setSelectedInstitute(normInst(full)); setScreen('detail'); })
          .catch(() => { window.location.hash = 'institutes'; setScreen('institutes'); });
      } else if (s && s !== 'dashboard') {
        setScreen(s);
      }
    };

    const fetchAll = () => Promise.all([
      api('GET', '/institutes', null, token),
      api('GET', '/clients', null, token),
      api('GET', '/occupations', null, token).catch(() => []),
      api('GET', '/locations', null, token).catch(() => []),
    ]);

    // A corrupt/outdated cache entry must never be able to wedge the app
    const applyCached = () => {
      if (!cached) return false;
      try {
        applyData(cached.insts, cached.cls, cached.occs || [], cached.locs || [], true);
        return true;
      } catch {
        try { sessionStorage.removeItem(CACHE_KEY); } catch {}
        return false;
      }
    };

    // If cache is fresh (< 5 min), show it instantly and skip the loading spinner
    const cacheAge = cached ? Date.now() - (cached.ts || 0) : Infinity;
    if (cached && cacheAge < 5 * 60 * 1000 && applyCached()) {
      setLoading(false);
      restoreRoute();
      // Refresh in background silently
      fetchAll()
        .then(([insts, cls, occs, locs]) => applyData(insts, cls, occs, locs, false))
        .catch(() => {});
    } else {
      setLoading(true);
      fetchAll()
        .then(([insts, cls, occs, locs]) => {
          applyData(insts, cls, occs, locs, false);
          restoreRoute();
        })
        .catch(err => {
          // Fall back to stale cache if the network/API fails
          if (applyCached()) restoreRoute();
          else setApiError(err.message || 'Could not load data.');
        })
        // Runs even if applyData/restoreRoute above threw, so the spinner
        // can never latch on permanently.
        .finally(() => setLoading(false));
    }
  }, [session]);

  /**
   * Logos, fetched separately and merged in once the list is already on screen.
   *
   * They are base64 data URIs (uploads go through FileReader.readAsDataURL), so
   * they are the blobs GET /institutes deliberately strips to stay fast. Asking
   * for them in their own request keeps the list quick while still getting logos
   * rendered — previously an institute only showed one after its detail page had
   * been visited and merged one into the row.
   *
   * Deliberately not written to the sessionStorage cache: a couple of dozen
   * base64 images would blow the quota and wedge caching for everything else.
   */
  useEffect(() => {
    if (!session || !token) return;
    let alive = true;
    api('GET', '/institutes/logos', null, token)
      .then(rows => {
        if (!alive || !rows?.length) return;
        const byId = new Map(rows.map(r => [r.id, r.logo]));
        setInstitutes(insts => insts.map(i => byId.has(i.id) ? { ...i, logo: byId.get(i.id) } : i));
      })
      .catch(() => {}); // Avatars fall back to initials; nothing else depends on this.
    return () => { alive = false; };
  }, [session, token]);

  if (!session) {
    return <LoginPage onLogin={(s) => setSession(s)} />;
  }

  if (loading) {
    return (
      <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16,background:'var(--bg)'}}>
        <div style={{width:56,height:56,borderRadius:14,background:'var(--primary)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 8px 24px rgba(93,135,255,0.35)'}}>
          <span className="material-icons-round spin" style={{fontSize:28,color:'#fff'}}>sync</span>
        </div>
        <div style={{fontSize:15,fontWeight:600,color:'var(--text2)'}}>Loading registry…</div>
        <div style={{fontSize:13,color:'var(--text3)'}}>Fetching institute data</div>
      </div>
    );
  }

  if (apiError) {
    return (
      <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16,background:'var(--bg)',padding:24}}>
        <div style={{width:64,height:64,borderRadius:16,background:'var(--error-light)',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <span className="material-icons-round" style={{fontSize:32,color:'var(--error)'}}>cloud_off</span>
        </div>
        <div style={{fontSize:18,fontWeight:700,color:'var(--text)'}}>Could not connect</div>
        <div style={{fontSize:13,color:'var(--text3)',maxWidth:380,textAlign:'center'}}>{apiError}</div>
        <div style={{display:'flex',gap:10,marginTop:4}}>
          <button className="btn btn-primary" onClick={() => { setApiError(''); setLoading(true); Promise.all([api('GET','/institutes',null,token),api('GET','/clients',null,token),api('GET','/occupations',null,token).catch(()=>[])]).then(([i,c,o])=>{setInstitutes(i.map(normInst));setClients(c.map(normClient));OCCUPATIONS.splice(0,OCCUPATIONS.length,...o);notifyMasterData();setLoading(false);}).catch(e=>{setApiError(e.message);setLoading(false);}); }}>
            <span className="material-icons-round" style={{fontSize:16}}>refresh</span> Retry
          </button>
          <button className="btn btn-secondary" onClick={() => { clearSession(); setSession(null); setApiError(''); }}>
            <span className="material-icons-round" style={{fontSize:16}}>logout</span> Sign out
          </button>
        </div>
        <div style={{fontSize:11.5,color:'var(--text3)',maxWidth:360,textAlign:'center'}}>
          Open DevTools (F12) → Console for details, or try disabling browser extensions.
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    clearSession();
    setSession(null);
    window.location.hash = '';
    setScreen('dashboard');
  };

  const handleNavigate = (rawId) => {
    const [id, sub] = String(rawId).split('/');
    setSubRoute(sub || null);
    if (isShortlistOnly && id !== 'shortlisting' && id !== 'quotations' && id !== 'dashboard' && id !== 'institutes' && id !== 'detail' && id !== 'documents') return;
    if (id === 'master' && !isAdmin && !isEditor) return;
    if (id === 'users' && !isAdmin) return;
    if ((id === 'summary' || id === 'comparison' || id === 'compliance') && isEditor) return;
    window.location.hash = sub ? `${id}/${sub}` : id;
    setScreen(id);
    if (id === 'institutes') setSelectedInstitute(null);
    setMobileSidebarOpen(false);
  };

  // Grouped so the rail reads in clusters rather than one long list. Ids, icons
  // and role gating are unchanged — only presentation and order.
  const navItems = [
    {id:'dashboard', icon:'dashboard', label:'Dashboard', group:'Main'},
    {id:'institutes', icon:'account_balance', label:'Institutes', group:'Main'},
    // Summary and Comparison share this entry; the screen id stays whichever
    // tab is open, so their hashes and role gating are untouched.
    {id:'summary', icon:'insights', label:'Analytics', group:'Analytics', editorHidden: true, shortlistHidden: true},
    {id:'reports', icon:'description', label:'Reports', group:'Analytics', shortlistHidden: true},
    {id:'renewals', icon:'event_repeat', label:'Renewals & Compliance', group:'Operations', shortlistHidden: true},
    {id:'documents', icon:'folder_shared', label:'Documents', group:'Operations'},
    {id:'clients', icon:'apartment', label:'Clients', group:'Main', shortlistHidden: true},
    {id:'quality', icon:'rule', label:'Data Quality', group:'System', shortlistHidden: true},
    {id:'compliance', icon:'fact_check', label:'Project Compliance', group:'Operations', editorHidden: true, shortlistHidden: true},
    {id:'shortlisting', icon:'playlist_add_check', label:'Shortlisting', group:'Operations'},
    {id:'quotations', icon:'gavel', label:'Quotations', group:'Operations'},
    {id:'master', icon:'category', label:'Master Data', group:'System', adminOnly: false, editorHidden: false, shortlistHidden: true},
    {id:'users', icon:'manage_accounts', label:'User Management', group:'System', adminOnly: true, shortlistHidden: true},
  ];
  const NAV_GROUPS = ['Main', 'Analytics', 'Operations', 'System'];
  const visibleNav = navItems.filter(item =>
    (!item.adminOnly || isAdmin) && (!item.editorHidden || !isEditor) && (!item.shortlistHidden || !isShortlistOnly));

  const handleSelectInstitute = async (inst) => {
    // Show immediately if we already have full data (has experience array)
    if (inst.experience !== undefined) {
      setSelectedInstitute(inst);
      window.location.hash = `detail/${inst.id}`;
      setScreen('detail');
    }
    try {
      const full = await api('GET', `/institutes/${inst.id}`, null, token);
      const normalized = normInst(full);
      setSelectedInstitute(normalized);
      setInstitutes(insts => insts.map(i => i.id === normalized.id ? normalized : i));
      window.location.hash = `detail/${inst.id}`;
      setScreen('detail');
    } catch (err) {
      if (inst.experience === undefined) {
        setApiError('Failed to load institute: ' + err.message);
      }
    }
  };

  const handleRefreshInstitute = async (id) => {
    try {
      const full = await api('GET', `/institutes/${id}`, null, token);
      const normalized = normInst(full);
      setInstitutes(insts => insts.map(i => i.id === normalized.id ? normalized : i));
      setSelectedInstitute(normalized);
    } catch (err) {
      setApiError('Failed to refresh institute: ' + err.message);
    }
  };

  const handleUpdateInstitute = (updated) => {
    setInstitutes(insts => insts.map(i => i.id === updated.id ? updated : i));
    setSelectedInstitute(updated);
    invalidateCache();
  };

  const handleAddInstitute = async (form) => {
    try {
      const created = await api('POST', '/institutes', instToAPI(form), token);
      const normalized = normInst(created);
      setInstitutes(i => [...i, {...normalized, experience:[], nstb:[], taxClearance:[], affiliation:[]}]);
      setShowAddInstitute(false);
    } catch (err) {
      setApiError('Failed to add institute: ' + err.message);
    }
  };

  const handleDeleteInstitute = (id) => {
    setInstitutes(insts => insts.filter(i => i.id !== id));
    setSelectedInstitute(null);
    invalidateCache();
    window.location.hash = 'institutes';
    setScreen('institutes');
  };

  const invalidateCache = () => { try { sessionStorage.removeItem('tvettrack_cache_v1'); } catch {} };

  const handleUpdateClients = (updated) => { setClients(updated); invalidateCache(); };

  const pageTitles = {
    dashboard: 'Dashboard',
    institutes: 'Institutes',
    detail: selectedInstitute?.name,
    nstbAdd: 'Add NSTB Records',
    summary: 'Analytics',
    comparison: 'Analytics',
    shortlisting: 'Shortlisting',
    quotations: 'Quotations',
    renewals: 'Renewals & Compliance',
    documents: 'Documents',
    clients: 'Clients',
    quality: 'Data Quality',
    reports: 'Reports',
    master: 'Master data',
    users: 'User management',
  };

  return (
    <>
    <a href="#main" className="skip-link">Skip to main content</a>
    <div className="app-shell">
      {/* Sidebar */}
      {mobileSidebarOpen && <div className="mobile-backdrop" onClick={()=>setMobileSidebarOpen(false)}/>}
      <div className={`sidebar${sidebarCollapsed?' collapsed':''}${mobileSidebarOpen?' mobile-open':''}`}>
        <button className="sidebar-toggle" onClick={()=>setSidebarCollapsed(c=>!c)}
          aria-label={sidebarCollapsed?'Expand sidebar':'Collapse sidebar'}
          title={sidebarCollapsed?'Expand sidebar':'Collapse sidebar'}>
          <span className="material-icons-round" style={{fontSize:14}}>{sidebarCollapsed?'chevron_right':'chevron_left'}</span>
        </button>
        <div className="sidebar-logo">
          {!sidebarCollapsed ? (
            <>
              <img src="/logo.png" alt="TVETtrack" style={{width:'100%',maxWidth:180,display:'block',margin:'0 auto',filter:'brightness(0) invert(1)'}}/>
            </>
          ) : (
            <img src="/logo.png" alt="TVETtrack" style={{width:40,height:40,objectFit:'contain',display:'block',margin:'0 auto',filter:'brightness(0) invert(1)'}}/>
          )}
        </div>
        <nav className="sidebar-nav">
          {NAV_GROUPS.map(group => {
            const items = visibleNav.filter(i => i.group === group);
            if (!items.length) return null;
            return (
              <div key={group} className="nav-group">
                <div className="nav-section-label">{group}</div>
                {items.map(item => (
                  <button
                    key={item.id}
                    className={`nav-item ${screen===item.id || (screen==='detail' && item.id==='institutes') || (screen==='comparison' && item.id==='summary')?'active':''}`}
                    onClick={() => handleNavigate(item.id)}
                    title={sidebarCollapsed ? item.label : ''}
                  >
                    <span className="nav-icon material-icons-round">{item.icon}</span>
                    <span className="nav-label">{item.label}</span>
                  </button>
                ))}
              </div>
            );
          })}
          <div className="search-section" style={{padding:'0 2px', marginTop:4}}>
            <button className="nav-item" onClick={() => setPaletteOpen(true)}
              title={sidebarCollapsed ? 'Search  (\u2318K)' : ''}>
              <span className="nav-icon material-icons-round">search</span>
              <span className="nav-label" style={{display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%'}}>
                Search
                <kbd style={{fontSize:10, opacity:.55, border:'1px solid rgba(255,255,255,.22)',
                  borderRadius:5, padding:'1px 5px'}}>{'\u2318K'}</kbd>
              </span>
            </button>
          </div>
        </nav>
        <div className="sidebar-footer">
          <div className="user-pill">
            {session.photo
              ? <img src={session.photo} alt="" style={{width:34,height:34,borderRadius:'50%',objectFit:'cover',flexShrink:0}}/>
              : <div className="user-avatar">{(session.fullName||session.email||'?').slice(0,2).toUpperCase()}</div>}
            {!sidebarCollapsed && (
              <div style={{flex:1, minWidth:0, overflow:'hidden'}}>
                <div className="user-name" style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{session.fullName||session.email}</div>
                <div className="user-role">{session.role}</div>
              </div>
            )}
            {!sidebarCollapsed && (
              <div style={{display:'flex',gap:2}}>
                <button className="logout-btn" title="Change password" onClick={()=>setShowChangePwd(true)}>
                  <span className="material-icons-round" style={{fontSize:18}}>lock</span>
                </button>
                <button className="logout-btn" title="Sign out" onClick={handleLogout}>
                  <span className="material-icons-round" style={{fontSize:18}}>logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="main" id="main" role="main">
        <div className="topbar">
          <button className="topbar-hamburger" onClick={()=>setMobileSidebarOpen(o=>!o)}
            aria-label={mobileSidebarOpen?'Close menu':'Open menu'}
            aria-expanded={mobileSidebarOpen}>
            <span className="material-icons-round" style={{fontSize:22}}>menu</span>
          </button>
          <div style={{flex:1}}>
            <div className="topbar-title">{pageTitles[screen]}</div>
            {screen === 'detail' && selectedInstitute && (
              <div className="breadcrumb" style={{marginTop:2}}>
                <span className="breadcrumb-sep">Institutes</span>
                <span className="material-icons-round breadcrumb-sep" style={{fontSize:14}}>chevron_right</span>
                <span className="breadcrumb-cur">{selectedInstitute.acronym || selectedInstitute.name}</span>
              </div>
            )}
          </div>
          {((screen === 'dashboard' || screen === 'institutes') && isAdmin || ((screen === 'shortlisting' || screen === 'dashboard' || screen === 'institutes') && isShortlistOnly)) && (
            <button className="btn btn-primary btn-sm" onClick={()=>setShowAddInstitute(true)}>
              <span className="material-icons-round" style={{fontSize:15}}>add</span>
              Add Institute
            </button>
          )}
          {screen === 'summary' && <span className="text-sm text-muted">Select institute and filters to generate report</span>}
          {screen === 'comparison' && <span className="text-sm text-muted">Select institutes to compare side by side</span>}
          {screen === 'compliance' && <span className="text-sm text-muted">Match firms to project criteria</span>}
          {/* User avatar chip in topbar */}
          <div style={{display:'flex',alignItems:'center',gap:10,marginLeft:8,paddingLeft:16,borderLeft:'1px solid var(--border)'}}>
            {session.photo
              ? <img src={session.photo} alt="" style={{width:34,height:34,borderRadius:'50%',objectFit:'cover'}}/>
              : <div style={{width:34,height:34,borderRadius:'50%',background:'var(--primary)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:'#fff',flexShrink:0}}>{(session.fullName||session.email||'?').slice(0,2).toUpperCase()}</div>}
            <div className="topbar-user-name" style={{display:'flex',flexDirection:'column',lineHeight:1.3}}>
              <span style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{session.fullName||session.email}</span>
              <span style={{fontSize:11,color:'var(--text3)',textTransform:'capitalize'}}>{session.role}</span>
            </div>
          </div>
        </div>

        <div className="page-content">
          {/* One boundary for every lazily-loaded screen below, so navigating
              shows a single consistent placeholder instead of each screen
              inventing its own. */}
          <Suspense fallback={
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:10,padding:'56px 24px',color:'var(--text3)'}}>
              <span className="material-icons-round spin" style={{fontSize:20}}>sync</span>
              <span style={{fontSize:13.5}}>Loading…</span>
            </div>
          }>
          {screen === 'dashboard' && !isShortlistOnly && <Dashboard institutes={institutes} isEditor={isEditor} onNavigate={(s, inst, tab)=>{ if(inst) handleSelectInstitute(inst).then(()=>{ if(tab) setJumpToTab(tab); }); else setScreen(s); }}/>}
          {screen === 'dashboard' && isShortlistOnly && <ShortlistDashboard institutes={institutes} onNavigate={(inst) => { handleSelectInstitute(inst); }}/>}
          {screen === 'institutes' && <InstituteList institutes={isShortlistOnly ? institutes : isAdmin ? institutes : institutes.filter(i => !i.isShortlistingOnly)} onSelect={handleSelectInstitute} onAdd={(isAdmin || isShortlistOnly) ? ()=>setShowAddInstitute(true) : null} initialSearch={globalSearch} isShortlistOnly={isShortlistOnly}/>}
          {screen === 'detail' && selectedInstitute && (
            <InstituteDetail
              institute={selectedInstitute}
              clients={clients}
              onUpdateClients={handleUpdateClients}
              onBack={()=>{ window.location.hash='institutes'; setScreen('institutes'); setJumpToTab(null); }}
              onUpdate={handleUpdateInstitute}
              onRefresh={handleRefreshInstitute}
              onDelete={handleDeleteInstitute}
              token={token}
              isAdmin={isAdmin}
              isEditor={isEditor}
              isSuperAdmin={isSuperAdmin}
              isShortlistOnly={isShortlistOnly}
              jumpToTab={jumpToTab}
              onAddNSTB={()=>{ setNstbAddInstitute(selectedInstitute); window.location.hash=`nstbAdd/${selectedInstitute.id}`; setScreen('nstbAdd'); }}
            />
          )}
          {screen === 'nstbAdd' && nstbAddInstitute && (
            <NSTBBulkPage
              instituteName={nstbAddInstitute.name}
              onSave={async (rows) => {
                await Promise.all(rows.map(row => api('POST', '/nstb', nstbToAPI(row, nstbAddInstitute.id), token)));
                await handleRefreshInstitute(nstbAddInstitute.id);
                window.location.hash=`detail/${nstbAddInstitute.id}`; setScreen('detail');
              }}
              onBack={()=>{ window.location.hash=`detail/${nstbAddInstitute.id}`; setScreen('detail'); }}
            />
          )}
          {(screen === 'summary' || screen === 'comparison') && (
            <AnalyticsView tab={screen} onTab={handleNavigate} institutes={institutes} clients={clients}/>
          )}
          {screen === 'renewals' && (
            <ComplianceCentre
              institutes={isAdmin ? institutes : institutes.filter(i => !i.isShortlistingOnly)}
              onOpenInstitute={handleSelectInstitute}/>
          )}
          {screen === 'documents' && (
            <DocumentsCentre
              institutes={isShortlistOnly ? institutes : isAdmin ? institutes : institutes.filter(i => !i.isShortlistingOnly)}
              token={token}
              onOpenInstitute={(inst, t) => handleSelectInstitute(inst).then(() => { if (t) setJumpToTab(t); })}/>
          )}
          {screen === 'clients' && (
            <ClientsView clients={clients} token={token}
              onGoToMasterData={() => handleNavigate('master')}/>
          )}
          {screen === 'quality' && (
            <DataQuality
              institutes={isAdmin ? institutes : institutes.filter(i => !i.isShortlistingOnly)}
              onOpenInstitute={(inst, t) => handleSelectInstitute(inst).then(() => { if (t) setJumpToTab(t); })}/>
          )}
          {screen === 'compliance' && <ProjectCompliance institutes={institutes} clients={clients}/>}
          {screen === 'shortlisting' && <Suspense fallback={<div style={{padding:40,textAlign:'center',color:'var(--text3)'}}>Loading…</div>}><Shortlisting institutes={institutes} clients={clients} isAdmin={isAdmin} isEditor={isEditor} isShortlistOnly={isShortlistOnly} isSuperAdmin={isSuperAdmin} token={token}/></Suspense>}
          {screen === 'quotations' && <QuotationsView institutes={institutes} clients={clients} isAdmin={isAdmin} isEditor={isEditor} isShortlistOnly={isShortlistOnly}/>}
          {screen === 'reports' && <Suspense fallback={<div style={{padding:40,textAlign:'center',color:'var(--text3)'}}>Loading reports…</div>}><ReportsView institutes={institutes} clients={clients}/></Suspense>}
          {screen === 'master' && (isAdmin || isEditor) && <MasterData initialTab={subRoute} onGoToClients={()=>handleNavigate('clients')} clients={clients} onUpdateClients={handleUpdateClients} token={token} isAdmin={isAdmin} isEditor={isEditor} isSuperAdmin={isSuperAdmin}/>}
          {screen === 'master' && !isAdmin && !isEditor && (
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'60%',gap:12,color:'var(--text3)'}}>
              <span className="material-icons-round" style={{fontSize:40, color:'var(--text3)', opacity:.5}}>lock</span>
              <div style={{fontSize:16,fontWeight:600,color:'var(--text2)'}}>Access restricted</div>
              <div style={{fontSize:13}}>Admin role required to manage master data.</div>
            </div>
          )}
          {screen === 'styleguide' && <Suspense fallback={<div style={{padding:40}}/>}><StyleGuide/></Suspense>}
          {screen === 'users' && isAdmin && <UserManagement institutes={institutes} isSuperAdmin={isSuperAdmin}/>}
          {screen === 'users' && !isAdmin && (
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'60%',gap:12,color:'var(--text3)'}}>
              <span className="material-icons-round" style={{fontSize:40, color:'var(--text3)', opacity:.5}}>lock</span>
              <div style={{fontSize:16,fontWeight:600,color:'var(--text2)'}}>Access restricted</div>
              <div style={{fontSize:13}}>Admin role required to manage users.</div>
            </div>
          )}
          </Suspense>
        </div>
      </div>

      {/* Global modals */}
      {showAddInstitute && (
        <InstituteForm onSave={handleAddInstitute} onClose={()=>setShowAddInstitute(false)} isSuperAdmin={isAdmin}/>
      )}
      {showChangePwd && <ChangePasswordModal onClose={()=>setShowChangePwd(false)}/>}
      {/* Bridged through window rather than props so the palette stays decoupled
          from this component's navigation internals. */}
      <CommandPalette
        open={paletteOpen}
        onClose={()=>setPaletteOpen(false)}
        institutes={institutes}
        clients={clients}
        actions={[
          // Every screen the current role can reach, plus the Master data tabs,
          // which are otherwise two clicks deep and unsearchable. `keywords`
          // exist so people can type what they call the thing — "eoi",
          // "bolpatra", "renewal", "vat" — rather than the label we chose.
          ...((isAdmin || isShortlistOnly) ? [{ id:'a-inst', label:'Add institute', icon:'add_business',
            group:'Create', keywords:'new firm add register',
            run:()=>setShowAddInstitute(true) }] : []),

          { id:'a-dash',  label:'Dashboard',  icon:'dashboard',       group:'Go to',
            keywords:'home overview start', run:()=>handleNavigate('dashboard') },
          { id:'a-insts', label:'Institutes', icon:'account_balance', group:'Go to',
            keywords:'firms companies training centers providers', run:()=>handleNavigate('institutes') },
          ...(!isShortlistOnly ? [
            { id:'a-clients', label:'Clients', icon:'apartment', group:'Go to',
              keywords:'organisations organizations donors employers engagement',
              run:()=>handleNavigate('clients') },
          ] : []),
          ...(!isEditor && !isShortlistOnly ? [
            { id:'a-summary', label:'Analytics — Summary', icon:'bar_chart', group:'Go to',
              keywords:'statistics totals figures trainees', run:()=>handleNavigate('summary') },
            { id:'a-compare', label:'Analytics — Comparison', icon:'compare_arrows', group:'Go to',
              keywords:'compare side by side jv joint venture', run:()=>handleNavigate('comparison') },
          ] : []),
          ...(!isShortlistOnly ? [
            { id:'a-reports', label:'Reports', icon:'description', group:'Go to',
              keywords:'eoi bolpatra docx export generate helvetas enssure tools consumables',
              run:()=>handleNavigate('reports') },
            { id:'a-renewals', label:'Renewals & Compliance', icon:'event_repeat', group:'Go to',
              keywords:'renewal expiry overdue tax clearance nstb affiliation lapsed',
              run:()=>handleNavigate('renewals') },
          ] : []),
          { id:'a-docs', label:'Documents', icon:'folder_shared', group:'Go to',
            keywords:'ocr vat ctevt registration paperwork files uploads',
            run:()=>handleNavigate('documents') },
          ...(!isEditor && !isShortlistOnly ? [
            { id:'a-projcomp', label:'Project Compliance', icon:'fact_check', group:'Go to',
              keywords:'match firms criteria eligibility bid shortlist jv',
              run:()=>handleNavigate('compliance') },
          ] : []),
          { id:'a-shortlist', label:'Shortlisting', icon:'playlist_add_check', group:'Go to',
            keywords:'standing list nea letters roster', run:()=>handleNavigate('shortlisting') },
          { id:'a-quotes', label:'Quotations', icon:'gavel', group:'Go to',
            keywords:'quote bid price contract', run:()=>handleNavigate('quotations') },
          ...(!isShortlistOnly ? [{ id:'a-quality', label:'Data Quality', icon:'rule', group:'Go to',
            keywords:'missing gaps incomplete blank problems', run:()=>handleNavigate('quality') }] : []),
          ...(isAdmin ? [{ id:'a-users', label:'User Management', icon:'manage_accounts', group:'Go to',
            keywords:'accounts roles permissions access', run:()=>handleNavigate('users') }] : []),

          ...((isAdmin || isEditor) ? [
            { id:'m-tools', label:'Tools & consumables', icon:'construction', group:'Master data',
              keywords:'tools consumables equipment materials stationery safety',
              run:()=>handleNavigate('master/tools') },
            { id:'m-occ', label:'Occupations', icon:'work', group:'Master data',
              keywords:'trades courses skills sectors levels', run:()=>handleNavigate('master/occupations') },
            { id:'m-cli', label:'Client records', icon:'apartment', group:'Master data',
              keywords:'add edit client organisation', run:()=>handleNavigate('master/clients') },
            { id:'m-tt', label:'Training types', icon:'school', group:'Master data',
              keywords:'short term long term type', run:()=>handleNavigate('master/training_types') },
            ...(isSuperAdmin ? [
              { id:'m-fy', label:'Fiscal years', icon:'event', group:'Master data',
                keywords:'fy year bikram sambat current', run:()=>handleNavigate('master/fiscal_years') },
              { id:'m-loc', label:'Locations', icon:'place', group:'Master data',
                keywords:'province district palika local level municipality',
                run:()=>handleNavigate('master/locations') },
            ] : []),
          ] : []),
        ]}
      />
    </div>
    </>
  );
}

export default App;

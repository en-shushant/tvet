import React, { useState, useEffect, useMemo } from 'react';
import { useCachedLogo } from '../utils/logoCache.js';
import { InstituteAvatar } from './ui/primitives.jsx';
import ReactDOM from 'react-dom';
import Modal from './ui/Modal.jsx';
import { ErrorBanner } from './ui/Modal.jsx';
import SearchableSelect from './ui/SearchableSelect.jsx';
import StatusBadge from './ui/StatusBadge.jsx';
import Pagination from './ui/Pagination.jsx';
import InstituteForm from './InstituteForm.jsx';
import ExperienceForm from './ExperienceForm.jsx';
import NSTBForm from './NSTBForms.jsx';
import TaxForm from './TaxForm.jsx';
import AffiliationForm from './AffiliationForm.jsx';
import ExpCard from './ExpCard.jsx';
import ClientDocuments from './ClientDocuments.jsx';
import { FISCAL_YEARS, NSTB_LEVELS } from '../constants/data.js';
import { api, instToAPI, expToAPI, nstbToAPI, taxToAPI, affToAPI, clientToAPI, normClient } from '../utils/api.js';
import { Btn, MdTextField } from '../md.jsx';
import { getSession } from '../utils/auth.js';
import { usePagination } from '../utils/hooks.js';
import { exportSummaryToMD, exportSummaryToPDF, exportSummaryToCSV } from '../utils/export.js';
import { generateEoiDocx } from '../utils/generateEoiDocx.js';
import { fmt, fyToAD, getClient, getOccupation, pct } from '../utils/format.js';
import { toast } from './ui/Feedback.jsx';





function InstituteDetail({institute, clients, onUpdateClients, onBack, onUpdate, onRefresh, onDelete, token, isAdmin, isEditor, isSuperAdmin, isShortlistOnly, jumpToTab, onBulkAdd, onAddNSTB}) {
  const logoSrc = useCachedLogo(institute.logo);
  const VALID_TABS = ['profile','experience','clients','nstb','tax','affiliation','infrastructure','documents'];
  const tabKey = `inst_tab_${institute.id}`;
  const savedTab = sessionStorage.getItem(tabKey);
  const defaultTab = isShortlistOnly ? 'documents' : (jumpToTab || (VALID_TABS.includes(savedTab) ? savedTab : 'profile'));
  const [tab, setTab] = useState(defaultTab);
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null); // {message, onConfirm}
  // Writers (admin + editor + shortlist) can edit documents; viewers are read-only.
  const canEdit = !!(isAdmin || isEditor || isShortlistOnly);

  const [lastCompliance, setLastCompliance] = useState(
    ['nstb','tax','affiliation','infrastructure'].includes(defaultTab) ? defaultTab : 'nstb');
  const switchTab = (t) => {
    setTab(t);
    sessionStorage.setItem(tabKey, t);
    if (['nstb','tax','affiliation','infrastructure'].includes(t)) setLastCompliance(t);
  };

  useEffect(() => { if(jumpToTab) switchTab(jumpToTab); }, [jumpToTab]);

  // Unique clients for this institute derived from experience
  /**
   * Headline figures, preferring what this page actually loaded.
   *
   * Falls back to the list endpoint's aggregates only while `experience` is
   * still empty — that is the first paint after arriving from the list, where
   * the aggregates are the only numbers available.
   */
  const kpis = useMemo(() => {
    const exps = institute.experience || [];
    if (exps.length === 0) {
      return {
        trainees: institute.totalTrainees || 0,
        stAppeared: institute.totalStAppeared || 0,
        programs: institute.totalAffPrograms || 0,
        districts: 0,
      };
    }
    const sumOcc = (key) => exps.reduce((total, e) =>
      total + (e.occupations || []).reduce((n, o) => n + (parseInt(o[key]) || 0), 0), 0);
    return {
      trainees: sumOcc('trainees'),
      stAppeared: sumOcc('skillTestAppeared'),
      districts: new Set(exps.flatMap(e =>
        (e.occupations || []).flatMap(o => (o.locations || []).map(l => l.district).filter(Boolean)))).size,
      // Affiliations are fetched with their programs; count them rather than
      // trusting an aggregate this endpoint never returns.
      programs: (institute.affiliation || []).reduce((n, a) => n + (a.programs || []).length, 0)
        || institute.totalAffPrograms || 0,
    };
  }, [institute]);

  const instituteClients = useMemo(() => {
    const seen = new Map();
    for (const exp of institute.experience) {
      const id = exp.clientId || ('manual:' + exp.clientName);
      if (!seen.has(id)) {
        const c = exp.clientId ? clients.find(c => c.id === exp.clientId) : null;
        seen.set(id, {
          id: exp.clientId || null,
          name: c ? (c.shortName || c.fullName) : (exp.clientName || '—'),
          fullName: c ? c.fullName : (exp.clientName || '—'),
          type: c ? c.type : '—',
          assignmentCount: 0,
        });
      }
      seen.get(id).assignmentCount++;
    }
    return [...seen.values()].sort((a,b)=>a.name.localeCompare(b.name));
  }, [institute.experience, clients]);

  /* Compliance folds four record types behind one top-level tab, so the strip
     stops being eight items wide. The panels themselves are untouched — `tab`
     still holds the specific sub-tab id, which also keeps the dashboard's
     deep links (jumpToTab: 'tax', 'nstb', 'affiliation') working unchanged. */
  const COMPLIANCE_TABS = [
    {id:'nstb',           label:'NSTB',              count:institute.nstb.length},
    {id:'tax',            label:'Tax clearance',     count:institute.taxClearance.length},
    {id:'affiliation',    label:'CTEVT affiliation', count:institute.affiliation.length},
    {id:'infrastructure', label:'Infrastructure',    count:(institute.infrastructure||[]).length},
  ];
  const complianceIds = COMPLIANCE_TABS.map(t => t.id);
  const inCompliance = complianceIds.includes(tab);
  const complianceCount = COMPLIANCE_TABS.reduce((n, t) => n + t.count, 0);

  const tabs = [
    {id:'profile',    label:'Overview', shortlistHidden: true},
    {id:'experience', label:'Assignments', count:institute.experience.length, shortlistHidden: true},
    {id:'clients',    label:'Clients', count:instituteClients.length, shortlistHidden: true},
    {id:'__compliance', label:'Compliance', count:complianceCount, shortlistHidden: true},
    {id:'documents',  label:'Documents'},
  ].filter(t => !isShortlistOnly || !t.shortlistHidden);

  const [saveErr, setSaveErr] = useState('');
  const withSave = (fn) => async (...args) => {
    setSaving(true); setSaveErr('');
    try { await fn(...args); }
    catch(err) { setSaveErr(err.message || 'An error occurred'); throw err; }
    finally { setSaving(false); }
  };

  const saveProfile = withSave(async (form) => {
    await api('PUT', `/institutes/${institute.id}`, instToAPI(form), token);
    await onRefresh(institute.id);
    setModal(null);
  });

  const saveClientToMaster = async (form) => {
    const created = await api('POST', '/clients', clientToAPI(form), token);
    const newClient = normClient(created);
    if (onUpdateClients) onUpdateClients([...clients, newClient]);
    return newClient;
  };

  // `keepOpen` backs "Save & add another": persist and refresh, but leave the
  // form mounted so the next assignment can be entered without reopening it.
  const saveExperience = withSave(async (form, opts = {}) => {
    if(!form.manualClient && !form.clientId) throw new Error('Please select a client or use manual entry.');
    if(form.manualClient && !form.clientName?.trim()) throw new Error('Please enter a client name.');
    if(!form.assignmentName.trim()) throw new Error('Assignment name is required.');
    if(form.id) {
      await api('PUT', `/assignments/${form.id}`, expToAPI(form, institute.id), token);
    } else {
      await api('POST', '/assignments', expToAPI(form, institute.id), token);
    }
    await onRefresh(institute.id);
    if (!opts.keepOpen) setModal(null);
  });

  const deleteExperience = (id) => setConfirmModal({
    message: 'Delete this assignment? This cannot be undone.',
    onConfirm: withSave(async () => {
      await api('DELETE', `/assignments/${id}`, null, token);
      await onRefresh(institute.id);
    }),
  });

  const saveNSTB = withSave(async (formOrArray) => {
    if (Array.isArray(formOrArray)) {
      await Promise.all(formOrArray.map(f => api('POST', '/nstb', nstbToAPI(f, institute.id), token)));
    } else if (formOrArray.id) {
      await api('PUT', `/nstb/${formOrArray.id}`, nstbToAPI(formOrArray, institute.id), token);
    } else {
      await api('POST', '/nstb', nstbToAPI(formOrArray, institute.id), token);
    }
    await onRefresh(institute.id);
    setModal(null);
  });

  const deleteNSTB = (id) => setConfirmModal({
    message: 'Delete this NSTB record?',
    onConfirm: withSave(async () => {
      await api('DELETE', `/nstb/${id}`, null, token);
      await onRefresh(institute.id);
    }),
  });

  const saveTax = withSave(async (form) => {
    if(!form.fy) throw new Error('Fiscal year is required.');
    if(!form.turnover || !form.taxableIncome || !form.taxPaid) throw new Error('Turnover, Taxable Income and Tax Paid are required.');
    if(form.id) {
      await api('PUT', `/tax/${form.id}`, taxToAPI(form, institute.id), token);
    } else {
      await api('POST', '/tax', taxToAPI(form, institute.id), token);
    }
    await onRefresh(institute.id);
    setModal(null);
  });

  const deleteTax = (id) => setConfirmModal({
    message: 'Delete this tax clearance record?',
    onConfirm: withSave(async () => {
      await api('DELETE', `/tax/${id}`, null, token);
      await onRefresh(institute.id);
    }),
  });

  const saveAffiliation = withSave(async (form) => {
    if(!form.affiliationDate) throw new Error('Affiliation date is required.');
    if(form.id) {
      await api('PUT', `/affiliations/${form.id}`, affToAPI(form, institute.id), token);
    } else {
      await api('POST', '/affiliations', affToAPI(form, institute.id), token);
    }
    await onRefresh(institute.id);
    setModal(null);
  });

  const deleteAffiliation = (id) => setConfirmModal({
    message: 'Delete this affiliation record?',
    onConfirm: withSave(async () => {
      await api('DELETE', `/affiliations/${id}`, null, token);
      await onRefresh(institute.id);
    }),
  });

  // Group by FY
  const groupByFY = (items, key='fy') => {
    const groups = {};
    items.forEach(item => {
      const fy = item[key] || 'Unknown';
      if(!groups[fy]) groups[fy] = [];
      groups[fy].push(item);
    });
    return Object.entries(groups).sort((a,b) => b[0].localeCompare(a[0]));
  };

  const [expandedFY, setExpandedFY] = useState({});
  const toggleFY = (fy) => setExpandedFY(e => ({...e, [fy]: !e[fy]}));
  const [expClientFilter, setExpClientFilter] = useState('');
  const [expOccFilter, setExpOccFilter] = useState('');
  const [expViewMode, setExpViewMode] = useState('fy'); // 'fy' | 'client'
  const [expMissingFilter, setExpMissingFilter] = useState(false);

  // Auto-expand all FY/client groups when institute loads or experience changes,
  // so users don't see a "blank" Experience tab with collapsed groups.
  useEffect(() => {
    const fyKeys = (institute.experience || []).map(e => 'exp-' + e.fy);
    const clientKeys = (institute.experience || []).map(e => 'client-' + (e.clientId || ('manual:' + (e.clientName || 'Unknown'))));
    setExpandedFY(prev => {
      const next = { ...prev };
      [...fyKeys, ...clientKeys].forEach(k => { if (!(k in next)) next[k] = true; });
      return next;
    });
  }, [institute.id, institute.experience.length]);

  return (
    <div className="fade-in">
      {/* Header */}
      {/* ── Header ── */}
      <button onClick={onBack}
        style={{display:'inline-flex', alignItems:'center', gap:4, border:'none', background:'none',
          cursor:'pointer', color:'var(--text3)', fontSize:'var(--fs-meta)', fontFamily:'var(--font)',
          padding:0, marginBottom:10}}>
        <span className="material-icons-round" style={{fontSize:15}}>chevron_left</span> Institutes
      </button>

      <div style={{display:'flex', alignItems:'flex-start', gap:16, flexWrap:'wrap', marginBottom:18}}>
        {/* Always present now: without a logo the header used to start with the
            name alone, so the page looked different depending on whether an
            unrelated file had been uploaded. */}
        <InstituteAvatar src={logoSrc} fallbackSrc={institute.logo}
          name={institute.name} acronym={institute.acronym} size={52} radius={14}/>
        <div style={{flex:1, minWidth:240}}>
          <h1 style={{fontSize:'var(--fs-title)', fontWeight:800, lineHeight:1.25,
            letterSpacing:'-0.01em', color:'var(--text)', margin:0}}>{institute.name}</h1>
          <div style={{display:'flex', alignItems:'center', gap:8, marginTop:8, flexWrap:'wrap'}}>
            {institute.acronym && (
              <span style={{fontSize:'var(--fs-meta)', fontWeight:700, color:'var(--text3)'}}>{institute.acronym}</span>
            )}
            <StatusBadge status={institute.status}/>
            {institute.type && (
              <span style={{fontSize:'var(--fs-meta)', color:'var(--text3)'}}>{institute.type}</span>
            )}
            {institute.isShortlistingOnly && (
              <span style={{fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:100,
                background:'var(--warning-light)', color:'#7A4D00'}}>Shortlisting only</span>
            )}
            {!canEdit && (
              <span style={{fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:100,
                background:'var(--bg2)', color:'var(--text3)'}}
                title="Your role does not have edit permission">Read-only</span>
            )}
          </div>
          <div style={{fontSize:'var(--fs-meta)', color:'var(--text3)', marginTop:8, lineHeight:1.7}}>
            {[institute.regNo && `Reg. ${institute.regNo}`, institute.pan && `PAN ${institute.pan}`]
              .filter(Boolean).join('  ·  ')}
            {institute.address && <div>{institute.address}</div>}
          </div>
        </div>
        <div style={{display:'flex', gap:8, flexWrap:'wrap', flexShrink:0}}>
          <Btn className="btn btn-secondary btn-sm" onClick={()=>switchTab('documents')}>
            <span className="material-icons-round" style={{fontSize:14}}>description</span> Documents
          </Btn>
          {canEdit && !isShortlistOnly && (
            <Btn className="btn btn-secondary btn-sm" onClick={()=>setModal({type:'editInstitute'})}>
              <span className="material-icons-round" style={{fontSize:14}}>edit</span> Edit
            </Btn>
          )}
          {isAdmin && (
            <Btn className="btn btn-danger btn-sm" onClick={()=>setModal({type:'deleteInstitute'})}>
              <span className="material-icons-round" style={{fontSize:14}}>delete</span> Delete
            </Btn>
          )}
        </div>
      </div>

      {/* Derived from the assignments this page has already fetched, not from the
          list endpoint's aggregates, and the only place they appear — the
          Assignments tab used to repeat clients/assignments/trainees/districts
          in its own strip. GET /institutes/:id is a plain SELECT * and
          carries none of total_trainees / total_st_appeared / total_aff_programs,
          so opening an institute zeroed them: the row read "— trainees" directly
          above a panel reporting 480. Deriving both from the same source means
          they cannot disagree. The list aggregates are still used as a fallback
          for the first paint, before the detail fetch lands. */}
      {!isShortlistOnly && (
        <div style={{display:'grid', gap:12, marginBottom:18,
          gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))'}}>
          {[
            ['Trainees',    fmt(kpis.trainees),    'periwinkle'],
            ['Assignments', institute.experience.length,    'blue'],
            ['Clients',     instituteClients.length,        'mint'],
            ['ST appeared', fmt(kpis.stAppeared),  'lilac'],
            ['Districts',   kpis.districts,        'pink'],
            ['Programs',    kpis.programs,         'cream'],
          ].map(([label, value, tone]) => (
            <div key={label} style={{background:`var(--pastel-${tone})`,
              borderRadius:'var(--radius-card)', padding:'14px 16px'}}>
              <div style={{fontSize:26, fontWeight:800, letterSpacing:'-0.02em',
                color:'var(--on-pastel)', lineHeight:1.1}}>{value}</div>
              <div style={{fontSize:'var(--fs-meta)', color:'var(--on-pastel-muted)', marginTop:4}}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Two-level strip: five top-level pills, with the compliance record types
          behind the fourth so the row stays readable. */}
      <div style={{display:'flex', gap:8, flexWrap:'wrap', marginBottom: inCompliance ? 10 : 18}}>
        {tabs.map(t => {
          const active = t.id === '__compliance' ? inCompliance : tab === t.id;
          const go = () => switchTab(t.id === '__compliance'
            // Return to whichever compliance record was last open.
            ? (complianceIds.includes(lastCompliance) ? lastCompliance : 'nstb')
            : t.id);
          return (
            <button key={t.id} onClick={go} role="tab" aria-selected={active}
              style={{display:'inline-flex', alignItems:'center', gap:7, border:'none',
                background: active ? 'var(--ink)' : 'var(--bg2)',
                color: active ? 'var(--on-ink)' : 'var(--text2)',
                borderRadius:'var(--radius-pill)', padding:'9px 18px',
                fontSize:'var(--fs-body)', fontWeight: active ? 700 : 500,
                fontFamily:'var(--font)', cursor:'pointer', transition:'background .16s'}}>
              {t.label}
              {t.count != null && <span style={{fontSize:11, opacity:.65}}>{t.count}</span>}
            </button>
          );
        })}
      </div>

      {inCompliance && (
        <div style={{display:'flex', gap:6, flexWrap:'wrap', marginBottom:18}}>
          {COMPLIANCE_TABS.map(t => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => switchTab(t.id)} aria-selected={active}
                style={{display:'inline-flex', alignItems:'center', gap:6, cursor:'pointer',
                  background:'transparent', fontFamily:'var(--font)',
                  border:'1px solid ' + (active ? 'var(--primary)' : 'var(--border)'),
                  color: active ? 'var(--primary)' : 'var(--text3)',
                  borderRadius:'var(--radius-pill)', padding:'6px 14px',
                  fontSize:'var(--fs-meta)', fontWeight: active ? 700 : 500}}>
                {t.label}<span style={{opacity:.65}}>{t.count}</span>
              </button>
            );
          })}
        </div>
      )}

      {saveErr && <ErrorBanner msg={saveErr} onDismiss={()=>setSaveErr('')}/>}

      {/* Profile tab */}
      {tab==='profile' && (
        <>
        <div className="grid-2">
          <div className="card">
            <div className="section-title">Identity</div>
            {[
              ['Institute name', institute.name],
              ['Acronym / Short name', institute.acronym || '—'],
              ['Registration no.', institute.regNo],
              ['Registration date', institute.regDate],
              ['PAN / VAT', institute.pan],
              ['Permanent account no.', institute.permanentAccountNo],
              ['Institute type', institute.type],
            ].map(([k,v])=>(
              <div key={k} style={{display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border)', fontSize:13}}>
                <span style={{color:'var(--text3)'}}>{k}</span>
                <span style={{fontWeight:500}}>{v||'—'}</span>
              </div>
            ))}
          </div>
          <div className="card">
            <div className="section-title">Contact & Status</div>
            {[
              ['Contact person', institute.contactPerson],
              ['Phone', institute.phone],
              ['Mobile', institute.mobile],
              ['Email', institute.email],
              ['Website', institute.website ? <a href={institute.website} target="_blank" rel="noreferrer" style={{color:'var(--accent)'}}>{institute.website}</a> : null],
              ['Location', (institute.latitude && institute.longitude)
                ? <span style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
                    <span style={{fontFamily:'var(--font-mono)', fontSize:12}}>{parseFloat(institute.latitude).toFixed(6)}, {parseFloat(institute.longitude).toFixed(6)}</span>
                    {institute.googleMapLink
                      ? <a href={institute.googleMapLink} target="_blank" rel="noreferrer" style={{color:'var(--accent)'}}>📍 Google Maps</a>
                      : <a href={`https://www.google.com/maps?q=${institute.latitude},${institute.longitude}`} target="_blank" rel="noreferrer" style={{color:'var(--accent)'}}>📍 Google Maps</a>}
                  </span>
                : institute.googleMapLink
                  ? <a href={institute.googleMapLink} target="_blank" rel="noreferrer" style={{color:'var(--accent)'}}>📍 View on Google Maps</a>
                  : null],
              ['Address', institute.address],
              ['Status', <StatusBadge status={institute.status}/>],
              ['Renewal due', institute.renewalDue],
              ['Remarks', institute.remarks],
            ].map(([k,v])=>(
              <div key={k} style={{display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border)', fontSize:13, alignItems:'center'}}>
                <span style={{color:'var(--text3)'}}>{k}</span>
                <span style={{fontWeight:500, textAlign:'right', maxWidth:220}}>{v||'—'}</span>
              </div>
            ))}
          </div>
        </div>{/* end grid-2 */}

        </>
      )}

      {/* Experience tab */}
      {tab==='experience' && (
        <>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, gap:8, flexWrap:'wrap'}}>
            <div style={{display:'flex', gap:6, alignItems:'center'}}>
              {/* View mode toggle */}
              <div style={{display:'flex', borderRadius:6, border:'1px solid var(--border)', overflow:'visible'}}>
                <button onClick={()=>setExpViewMode('fy')} style={{fontSize:12, padding:'5px 14px', whiteSpace:'nowrap', background: expViewMode==='fy' ? 'var(--accent)' : 'var(--bg2)', color: expViewMode==='fy' ? '#fff' : 'var(--text2)', border:'none', cursor:'pointer', borderRadius:'5px 0 0 5px'}}>By FY</button>
                <button onClick={()=>setExpViewMode('client')} style={{fontSize:12, padding:'5px 14px', whiteSpace:'nowrap', background: expViewMode==='client' ? 'var(--accent)' : 'var(--bg2)', color: expViewMode==='client' ? '#fff' : 'var(--text2)', border:'none', cursor:'pointer', borderLeft:'1px solid var(--border)', borderRadius:'0 5px 5px 0'}}>By Client</button>
              </div>
              {/* Client filter — works in both modes */}
              <select value={expClientFilter} onChange={e=>setExpClientFilter(e.target.value)} style={{fontSize:12, padding:'4px 8px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg2)', color:'var(--text1)', minWidth:160}}>
                <option value="">All clients</option>
                {[...new Map(institute.experience.filter(e=>e.clientId).map(e=>[e.clientId, getClient(clients,e.clientId)])).values()].filter(c=>c.id).map(c=>(
                  <option key={c.id} value={c.id}>{c.shortName||c.fullName}</option>
                ))}
              </select>
              <select value={expOccFilter} onChange={e=>setExpOccFilter(e.target.value)} style={{fontSize:12, padding:'4px 8px', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg2)', color:'var(--text1)', minWidth:160}}>
                <option value="">All occupations</option>
                <option value="__missing__">Missing occupation</option>
                {[...new Set(institute.experience.flatMap(e=>(e.occupations||[]).map(o=>(getOccupation(o.ctevtOccupationId).name||o.nameInLetter))).filter(Boolean))].sort().map(name=>(
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <button
                onClick={()=>setExpMissingFilter(v=>!v)}
                style={{fontSize:12, padding:'4px 10px', borderRadius:6, border:'1px solid var(--border)', cursor:'pointer', whiteSpace:'nowrap',
                  background: expMissingFilter ? '#fff3cd' : 'var(--bg2)',
                  color: expMissingFilter ? '#856404' : 'var(--text2)',
                  fontWeight: expMissingFilter ? 700 : 400}}
                title="Show only assignments where any occupation is missing level or duration (hrs)">
                <span className="material-icons-round" style={{fontSize:14,verticalAlign:'middle'}}>warning</span> Missing level/duration
              </button>
            </div>
            <div style={{display:'flex', gap:6}}>
              {institute.experience.length > 0 && (
                <Btn className="btn btn-secondary btn-sm" onClick={() => {
                  const visible = institute.experience.filter(e =>
                    (!expClientFilter || String(e.clientId) === String(expClientFilter)) &&
                    (!expOccFilter || (expOccFilter === '__missing__'
                      ? (e.occupations||[]).some(o => !o.ctevtOccupationId)
                      : (e.occupations||[]).some(o => (getOccupation(o.ctevtOccupationId).name||o.nameInLetter) === expOccFilter))) &&
                    (!expMissingFilter || (e.occupations||[]).some(o => !o.level || !o.duration))
                  );
                  generateEoiDocx(institute, visible, clients);
                }}>
                  <span className="material-icons-round" style={{fontSize:14}}>download</span> EOI Report (.docx)
                </Btn>
              )}
              {canEdit && <>
                <Btn className="btn btn-secondary btn-sm" onClick={onBulkAdd}>⊞ Bulk add</Btn>
                <Btn className="btn btn-primary btn-sm" onClick={()=>setModal({type:'addExp'})}>+ Add assignment</Btn>
              </>}
            </div>
          </div>

          {institute.experience.length === 0
            ? <div className="empty-state"><div className="empty-state-icon"><span className="material-icons-round" style={{fontSize:44,opacity:0.3}}>assignment</span></div><div className="empty-state-title">No assignments yet</div><div className="empty-state-sub">Add the first experience / assignment record</div></div>
            : expViewMode === 'fy'
              ? groupByFY(institute.experience.filter(e=>(!expClientFilter || String(e.clientId)===String(expClientFilter)) && (!expOccFilter || (expOccFilter==='__missing__' ? (e.occupations||[]).some(o=>!o.ctevtOccupationId) : (e.occupations||[]).some(o=>(getOccupation(o.ctevtOccupationId).name||o.nameInLetter)===expOccFilter))) && (!expMissingFilter || (e.occupations||[]).some(o=>!o.level || !o.duration)))).map(([fy, items]) => (
                <div key={fy} className="fy-group">
                  <button className="fy-header" onClick={()=>toggleFY('exp-'+fy)}>
                    <span>{expandedFY['exp-'+fy] ? '▼' : '▶'}</span>
                    <span>FY {fy}{fyToAD(fy) ? <span style={{color:'var(--text3)',fontWeight:400,fontSize:'0.88em'}}> ({fyToAD(fy)})</span> : ''}</span>
                    <span className="badge badge-info" style={{marginLeft:'auto'}}>{items.length} assignment{items.length>1?'s':''}</span>
                  </button>
                  {expandedFY['exp-'+fy] && (
                    <div className="fy-body">
                      {items.map((exp,i) => <ExpCard key={exp.id} idx={i} exp={exp} clients={clients} showFY={false} setModal={setModal} deleteExperience={deleteExperience} canEdit={canEdit} isAdmin={isAdmin}/>)}
                    </div>
                  )}
                </div>
              ))
              : (() => {
                  // Group by client
                  const clientMap = new Map();
                  institute.experience.filter(exp => (!expClientFilter || String(exp.clientId)===String(expClientFilter)) && (!expOccFilter || (exp.occupations||[]).some(o=>(getOccupation(o.ctevtOccupationId).name||o.nameInLetter)===expOccFilter)) && (!expMissingFilter || (exp.occupations||[]).some(o=>!o.level || !o.duration))).forEach(exp => {
                    const key = exp.clientId || ('manual:' + (exp.clientName||'Unknown'));
                    if (!clientMap.has(key)) clientMap.set(key, []);
                    clientMap.get(key).push(exp);
                  });
                  return [...clientMap.entries()].map(([key, exps]) => {
                    const client = getClient(clients, exps[0].clientId);
                    const clientLabel = client.shortName || client.fullName || exps[0].clientName || 'Unknown client';
                    const totalT = exps.reduce((s,e)=>s+e.occupations.reduce((ss,o)=>ss+(parseInt(o.trainees)||0),0),0);
                    const fys = [...new Set(exps.map(e=>e.fy))].sort();
                    return (
                      <div key={key} className="fy-group">
                        <button className="fy-header" onClick={()=>toggleFY('client-'+key)}>
                          <span>{expandedFY['client-'+key] ? '▼' : '▶'}</span>
                          <span style={{fontWeight:600}}>{clientLabel}</span>
                          <div style={{display:'flex', gap:6, marginLeft:'auto', alignItems:'center'}}>
                            <span className="badge badge-gray" style={{fontSize:10}}>{fys[0]}{fys.length>1?` – ${fys[fys.length-1]}`:''}</span>
                            <span className="badge badge-info">{exps.length} assignment{exps.length>1?'s':''}</span>
                            <span className="badge badge-active" style={{fontSize:10}}>{totalT.toLocaleString()} trainees</span>
                          </div>
                        </button>
                        {expandedFY['client-'+key] && (
                          <div className="fy-body">
                            {exps.sort((a,b)=>a.fy.localeCompare(b.fy)).map((exp,i) => <ExpCard key={exp.id} idx={i} exp={exp} clients={clients} showFY={true} setModal={setModal} deleteExperience={deleteExperience} canEdit={canEdit} isAdmin={isAdmin}/>)}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()
          }
        </>
      )}

      {/* NSTB tab */}
      {tab==='nstb' && (
        <>
          {canEdit && <div style={{display:'flex', justifyContent:'flex-end', marginBottom:12}}>
            <Btn className="btn btn-primary btn-sm" onClick={onAddNSTB}>+ Add NSTB records</Btn>
          </div>}
          {institute.nstb.length > 0 && (() => {
            const totA = institute.nstb.reduce((s,r)=>s+(parseInt(r.applied)||0),0);
            const totAp = institute.nstb.reduce((s,r)=>s+(parseInt(r.appeared)||0),0);
            const totP = institute.nstb.reduce((s,r)=>s+(parseInt(r.pass)||0),0);
            const passRate = totAp > 0 ? ((totP/totAp)*100).toFixed(1)+'%' : '—';
            const numStyle = {fontWeight:700, fontSize:20, fontFamily:'var(--font-mono)', color:'var(--accent)'};
            const lblStyle = {fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.5px', marginTop:2};
            return (
              <div style={{display:'flex', gap:0, background:'var(--bg2)', borderRadius:8, border:'1px solid var(--border)', marginBottom:12, padding:'10px 0'}}>
                {[['Applied', totA,'var(--accent)'],['Appeared', totAp,'var(--blue)'],['Pass', totP,'var(--green)'],['Pass rate', passRate,'var(--purple)']].map(([lbl,val,col],i,arr)=>(
                  <React.Fragment key={lbl}>
                    <div style={{textAlign:'center',flex:1}}>
                      <div style={{...numStyle,color:col}}>{val}</div>
                      <div style={lblStyle}>{lbl}</div>
                    </div>
                    {i<arr.length-1 && <div style={{width:1,background:'var(--border)',margin:'0 4px'}}/>}
                  </React.Fragment>
                ))}
              </div>
            );
          })()}
          {institute.nstb.length === 0
            ? <div className="empty-state"><div className="empty-state-icon">📝</div><div className="empty-state-title">No NSTB records yet</div></div>
            : groupByFY(institute.nstb).map(([fy, items]) => (
              <div key={fy} className="fy-group">
                <button className="fy-header" onClick={()=>toggleFY('nstb-'+fy)}>
                  <span>{expandedFY['nstb-'+fy] ? '▼' : '▶'}</span>
                  <span>FY {fy}{fyToAD(fy) ? <span style={{color:'var(--text3)',fontWeight:400,fontSize:'0.88em'}}> ({fyToAD(fy)})</span> : ''}</span>
                  <div style={{marginLeft:'auto', display:'flex', gap:8}}>
                    <span className="badge badge-info">Applied: {items.reduce((s,i)=>s+i.applied,0)}</span>
                    <span className="badge badge-active">Pass: {items.reduce((s,i)=>s+i.pass,0)}</span>
                  </div>
                </button>
                {expandedFY['nstb-'+fy] && (
                  <div className="table-wrap">
                    <table>
                      <thead><tr>
                        <th>Occupation</th><th>Level</th><th>Applied</th><th>Appeared</th><th>Pass</th>
                        <th>Appear rate</th><th>Pass rate</th><th>Letter</th><th></th>
                      </tr></thead>
                      <tbody>
                        {items.map(r=>(
                          <tr key={r.id}>
                            <td><strong>{r.occupation}</strong></td>
                            <td><span className="badge badge-purple">{r.level}</span></td>
                            <td className="mono">{r.applied}</td>
                            <td className="mono">{r.appeared}</td>
                            <td className="mono">{r.pass}</td>
                            <td><span className="badge badge-info">{pct(r.appeared, r.applied)}</span></td>
                            <td><span className={`badge ${parseFloat(pct(r.pass,r.appeared))>=70?'badge-active':'badge-pending'}`}>{pct(r.pass, r.appeared)}</span></td>
                            <td className="text-sm text-muted">{r.letterNo}</td>
                            <td style={{display:'flex', gap:4}}>
                              {canEdit && <Btn className="btn btn-ghost btn-sm" onClick={()=>setModal({type:'editNSTB', data:r})}>✏</Btn>}
                              {isAdmin && <Btn className="btn btn-danger btn-sm" onClick={()=>deleteNSTB(r.id)}><span className="material-icons-round" style={{fontSize:15}}>delete</span></Btn>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))
          }
        </>
      )}

      {/* Tax tab */}
      {tab==='tax' && (
        <>
          <div style={{display:'flex', justifyContent:'flex-end', marginBottom:12}}>
            {canEdit && <Btn className="btn btn-primary btn-sm" onClick={()=>setModal({type:'addTax'})}>+ Add tax clearance</Btn>}
          </div>
          {institute.taxClearance.length === 0
            ? <div className="empty-state"><div className="empty-state-icon">🧾</div><div className="empty-state-title">No tax clearance records</div></div>
            : (
              <div className="card" style={{padding:0, overflow:'hidden'}}>
                <table>
                  <thead><tr>
                    <th>Fiscal year</th><th>Total turnover (NPR)</th><th>Taxable income (NPR)</th>
                    <th>Tax paid (NPR)</th><th>Certificate date</th><th>Kar Chukta No.</th><th></th>
                  </tr></thead>
                  <tbody>
                    {institute.taxClearance.slice().sort((a,b)=>b.fy.localeCompare(a.fy)).map(t=>(
                      <tr key={t.id}>
                        <td><strong>{t.fy}</strong>{fyToAD(t.fy) && <span style={{color:'var(--text3)',fontWeight:400,fontSize:'0.85em'}}> ({fyToAD(t.fy)})</span>}</td>
                        <td className="mono">{fmt(t.turnover)}</td>
                        <td className="mono">{fmt(t.taxableIncome)}</td>
                        <td className="mono">{fmt(t.taxPaid)}</td>
                        <td className="text-sm">{t.certDate}</td>
                        <td className="mono text-sm">{t.karChutaNo}</td>
                        <td style={{display:'flex', gap:4}}>
                          {canEdit && <Btn className="btn btn-ghost btn-sm" onClick={()=>setModal({type:'editTax', data:t})}>✏</Btn>}
                          {isAdmin && <Btn className="btn btn-danger btn-sm" onClick={()=>deleteTax(t.id)}><span className="material-icons-round" style={{fontSize:15}}>delete</span></Btn>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </>
      )}

      {/* Affiliation tab */}
      {tab==='affiliation' && (
        <>
          <div style={{display:'flex', justifyContent:'flex-end', marginBottom:12}}>
            {canEdit && <Btn className="btn btn-primary btn-sm" onClick={()=>setModal({type:'addAffiliation'})}>+ Add affiliation</Btn>}
          </div>
          {institute.affiliation.length === 0
            ? <div className="empty-state"><div className="empty-state-icon">📜</div><div className="empty-state-title">No CTEVT affiliations</div></div>
            : institute.affiliation.map(aff=>(
              <div key={aff.id} className="fy-group" style={{marginBottom:8}}>
                <button className="fy-header" onClick={()=>toggleFY('aff-'+aff.id)}>
                  <span>{expandedFY['aff-'+aff.id] ? '▼' : '▶'}</span>
                  <span>{aff.type}</span>
                  {(aff.chalaniNo || aff.patraNo) && (
                    <span style={{fontSize:11, color:'var(--text3)', fontFamily:'var(--font-mono)'}}>
                      Aff. No: {aff.chalaniNo || aff.patraNo}
                    </span>
                  )}
                  <span style={{fontSize:12, color:'var(--text3)', marginLeft:8}}>{aff.affiliationDate} → {aff.expiryDate}</span>
                  <span className={`badge ${aff.status==='Active'?'badge-active':aff.status==='Expired'?'badge-expired':'badge-pending'}`} style={{marginLeft:'auto'}}>{aff.status}</span>
                  <span className="badge badge-gray" style={{marginLeft:8}}>{aff.programs.length} programs</span>
                  {canEdit && <Btn className="btn btn-ghost btn-sm" style={{marginLeft:8}} onClick={e=>{e.stopPropagation();setModal({type:'editAffiliation',data:aff});}}>✏</Btn>}
                  {isAdmin && <Btn className="btn btn-danger btn-sm" style={{marginLeft:4}} onClick={e=>{e.stopPropagation();deleteAffiliation(aff.id);}}><span className="material-icons-round" style={{fontSize:15}}>delete</span></Btn>}
                </button>
                {expandedFY['aff-'+aff.id] && (
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Program</th><th>Level</th><th>Duration (hrs)</th><th>Seats/batch</th></tr></thead>
                      <tbody>
                        {aff.programs.map((p,i)=>(
                          <tr key={i}>
                            <td>{p.name}</td>
                            <td><span className="badge badge-purple">{p.level}</span></td>
                            <td className="mono">{p.duration}</td>
                            <td className="mono">{p.seats}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))
          }
        </>
      )}

      {/* Infrastructure tab (D1) */}
      {tab==='infrastructure' && (
        <InfrastructureTab instituteId={institute.id} token={token} canEdit={canEdit} />
      )}

      {/* Documents tab */}
      {tab==='documents' && (
        <DocumentsTab institute={institute} token={token} canEdit={canEdit} onUpdate={onUpdate} isShortlistOnly={isShortlistOnly} />
      )}

      {/* Modals */}
      {modal?.type === 'editInstitute' && <InstituteForm institute={institute} onSave={saveProfile} onClose={()=>setModal(null)} isSuperAdmin={isAdmin || isSuperAdmin}/>}
      {modal?.type === 'deleteInstitute' && ReactDOM.createPortal(
        <div className="modal-overlay" onClick={()=>setModal(null)}>
          <div className="modal" style={{maxWidth:420}} onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Delete institute</span>
              <Btn className="btn btn-ghost btn-sm" onClick={()=>setModal(null)}>✕</Btn>
            </div>
            <div className="modal-body">
              <p style={{fontSize:14,color:'var(--text2)',marginBottom:8}}>
                Are you sure you want to permanently delete <strong>{institute.name}</strong>?
              </p>
              <p style={{fontSize:13,color:'var(--red)'}}>This will delete all experience, NSTB, tax, and affiliation records. This cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <Btn className="btn btn-secondary" onClick={()=>setModal(null)}>Cancel</Btn>
              <Btn className="btn btn-danger" disabled={saving} onClick={async()=>{
                setSaving(true); setSaveErr('');
                try { await api('DELETE', `/institutes/${institute.id}`, null, token); onDelete(institute.id); }
                catch(err) { setSaveErr(err.message); setSaving(false); }
              }}>{saving ? 'Deleting…' : 'Delete permanently'}</Btn>
            </div>
          </div>
        </div>,
        document.body
      )}
      {modal?.type === 'addExp' && <ExperienceForm institute={institute} clients={clients} exp={modal.data} onSave={saveExperience} onClose={()=>setModal(null)} onDuplicate={(f)=>setModal({type:'addExp', data:{...f, id:undefined}})} onSaveClient={saveClientToMaster}/>}
      {modal?.type === 'editExp' && <ExperienceForm institute={institute} clients={clients} exp={modal.data} onSave={saveExperience} onClose={()=>setModal(null)} onDuplicate={(f)=>setModal({type:'addExp', data:{...f, id:undefined}})} onSaveClient={saveClientToMaster}/>}
      {modal?.type === 'dupFY' && (
        <Modal title="Duplicate assignment to another FY" onClose={()=>setModal(null)}
          footer={<>
            <Btn className="btn btn-secondary" onClick={()=>setModal(null)}>Cancel</Btn>
            <Btn className="btn btn-primary" onClick={()=>{
              const fy = document.getElementById('dupFYSelect').value;
              saveExperience({...modal.data, id:undefined, fy});
            }}>Duplicate</Btn>
          </>}>
          <p style={{fontSize:13, color:'var(--text2)', marginBottom:16}}>
            Duplicating: <strong>{modal.data.assignmentName}</strong><br/>
            All occupation rows and locations will be copied. You can edit numbers after.
          </p>
          <div className="form-group">
            <label>Target fiscal year *</label>
            <select id="dupFYSelect" defaultValue={FISCAL_YEARS[FISCAL_YEARS.indexOf(modal.data.fy)+1] || FISCAL_YEARS[FISCAL_YEARS.length-1]}>
              {FISCAL_YEARS.slice().reverse().map(fy=><option key={fy} value={fy}>{fy}  ({fyToAD(fy)})</option>)}
            </select>
          </div>
        </Modal>
      )}
      {modal?.type === 'viewExp' && (() => {
        const exp = modal.data;
        const client = getClient(clients, exp.clientId);
        const allLocs = exp.occupations.flatMap(o=>(o.locations||[]));
        const districts = [...new Set(allLocs.map(l=>l.district).filter(Boolean))];
        return ReactDOM.createPortal(
          <div className="modal-overlay" onClick={()=>setModal(null)}>
            <div className="modal modal-lg" onClick={e=>e.stopPropagation()} style={{maxHeight:'90vh'}}>
              {/* Header */}
              <div className="modal-header" style={{background:'linear-gradient(135deg,var(--sidebar-bg) 0%,#2a4a6b 100%)', borderRadius:'var(--radius-xl) var(--radius-xl) 0 0', border:'none', padding:'22px 28px'}}>
                <div style={{flex:1}}>
                  <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:6}}>
                    <span style={{background:'rgba(93,135,255,0.25)', color:'#a8c4ff', fontSize:11, fontWeight:700, padding:'2px 10px', borderRadius:20, letterSpacing:'0.5px', textTransform:'uppercase'}}>
                      FY {exp.fy}{fyToAD(exp.fy)?` · ${fyToAD(exp.fy)}`:''}
                    </span>
                    {exp.trainingType && <span style={{background:'rgba(255,255,255,0.12)', color:'rgba(255,255,255,0.8)', fontSize:11, fontWeight:600, padding:'2px 10px', borderRadius:20}}>{exp.trainingType}</span>}
                    {exp.isGesi && <span style={{background:'rgba(168,85,247,0.25)', color:'#d8b4fe', fontSize:11, fontWeight:700, padding:'2px 10px', borderRadius:20}}>GESI</span>}
                    {exp.isResidential && <span style={{background:'rgba(59,130,246,0.25)', color:'#93c5fd', fontSize:11, fontWeight:700, padding:'2px 10px', borderRadius:20}}>Residential</span>}
                    {exp.contractValue && (
                      <span style={{background:'rgba(255,255,255,0.12)', color:'rgba(255,255,255,0.85)', fontSize:11, fontWeight:700, padding:'2px 10px', borderRadius:20}}>
                        NPR {parseInt(exp.contractValue).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div style={{fontSize:20, fontWeight:800, color:'#fff', lineHeight:1.3}}>{exp.assignmentName}</div>
                  <div style={{fontSize:13, color:'rgba(255,255,255,0.65)', marginTop:5}}>
                    {client.fullName || exp.clientName || 'Unknown client'}
                    {client.shortName ? <span style={{opacity:0.7}}> ({client.shortName})</span> : ''}
                  </div>
                </div>
                <button className="modal-close" onClick={()=>setModal(null)} style={{background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.2)', color:'#fff'}}>
                  <span className="material-icons-round" style={{fontSize:16}}>close</span>
                </button>
              </div>

              <div className="modal-body" style={{padding:'24px 28px'}}>
                {/* Meta row */}
                {(exp.startFY || exp.endFY) && (
                  <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:20, padding:'10px 14px', background:'var(--primary-light)', borderRadius:8, border:'1px solid var(--primary-mid)'}}>
                    <span className="material-icons-round" style={{fontSize:16, color:'var(--primary)'}}>date_range</span>
                    <span style={{fontSize:13, color:'var(--primary-dark)', fontWeight:600}}>Contract period: FY {exp.startFY||exp.fy} – {exp.endFY||exp.fy}</span>
                  </div>
                )}

                {/* Occupations */}
                <div style={{marginBottom:20}}>
                  <div style={{fontSize:11.5, fontWeight:800, color:'var(--text)', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:12}}>
                    Occupations &amp; Trainees
                  </div>
                  <div style={{display:'flex', flexDirection:'column', gap:8}}>
                    {exp.occupations.map((occ,i)=>{
                      const occName = getOccupation(occ.ctevtOccupationId).name || occ.nameInLetter || 'Unknown';
                      const sta = parseInt(occ.skillTestAppeared)||0;
                      const stp = parseInt(occ.skillTestPass)||0;
                      const pr = sta>0 ? Math.round(stp/sta*100) : null;
                      return (
                        <div key={i} style={{display:'flex', alignItems:'center', gap:12, padding:'12px 16px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, boxShadow:'0 1px 4px rgba(18,38,63,0.05)'}}>
                          <div style={{width:36, height:36, borderRadius:8, background:'var(--primary-light)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
                            <span className="material-icons-round" style={{fontSize:18, color:'var(--primary)'}}>school</span>
                          </div>
                          <div style={{flex:1, minWidth:0}}>
                            <div style={{fontWeight:700, fontSize:13.5, color:'var(--text)'}}>{occName}</div>
                            <div style={{display:'flex', gap:4, marginTop:2, flexWrap:'wrap'}}>
                              {occ.level && <span style={{fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:8, background:'var(--purple-light)', color:'var(--purple)', display:'inline-block'}}>{occ.level}</span>}
                              {occ.skillTestProvisioned && <span style={{fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:8, background:'color-mix(in srgb, var(--blue,#3b82f6) 15%, transparent)', color:'var(--blue,#3b82f6)', display:'inline-block'}}>Skill Test</span>}
                              {occ.employmentProvisioned && <span style={{fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:8, background:'color-mix(in srgb, var(--green) 15%, transparent)', color:'var(--green)', display:'inline-block'}}>Employment</span>}
                            </div>
                          </div>
                          <div style={{display:'flex', gap:16, flexShrink:0, flexWrap:'wrap', justifyContent:'flex-end'}}>
                            <div style={{textAlign:'center'}}>
                              <div style={{fontWeight:800, fontSize:18, color:'var(--primary)'}}>{parseInt(occ.trainees)||0}</div>
                              <div style={{fontSize:10, color:'var(--text3)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px'}}>Trainees</div>
                            </div>
                            {occ.duration && <div style={{textAlign:'center'}}>
                              <div style={{fontWeight:700, fontSize:15, color:'var(--text2)'}}>{occ.duration}h</div>
                              <div style={{fontSize:10, color:'var(--text3)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px'}}>Duration</div>
                            </div>}
                            {occ.skillTestProvisioned && <div style={{textAlign:'center'}}>
                              <div style={{fontWeight:700, fontSize:15, color:'var(--blue,#3b82f6)'}}>{sta}/{stp}</div>
                              <div style={{fontSize:10, color:'var(--text3)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px'}}>ST App/Pass</div>
                            </div>}
                            {sta > 0 && <div style={{textAlign:'center'}}>
                              <div style={{fontWeight:700, fontSize:15, color:pr>=70?'var(--success)':'var(--warning)'}}>{pr}%</div>
                              <div style={{fontSize:10, color:'var(--text3)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px'}}>Pass rate</div>
                            </div>}
                            {occ.employmentProvisioned && <div style={{textAlign:'center'}}>
                              <div style={{fontWeight:700, fontSize:15, color:'var(--green)'}}>{parseFloat(occ.employmentActual)||0}%</div>
                              <div style={{fontSize:10, color:'var(--text3)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px'}}>Employed</div>
                            </div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Locations */}
                {districts.length > 0 && (
                  <div style={{marginBottom:20}}>
                    <div style={{fontSize:11.5, fontWeight:800, color:'var(--text)', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:10}}>Districts</div>
                    <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                      {districts.map(d=>(
                        <span key={d} style={{display:'inline-flex', alignItems:'center', gap:4, fontSize:12.5, fontWeight:600, padding:'4px 10px', borderRadius:20, background:'var(--success-light)', color:'#0a7a68', border:'1px solid rgba(19,222,185,0.2)'}}>
                          <span className="material-icons-round" style={{fontSize:13}}>location_on</span>{d}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reference file */}
                {exp.referenceFile && (
                  <div style={{display:'flex', alignItems:'center', gap:12, padding:'12px 16px', background:'var(--bg)', borderRadius:10, border:'1px solid var(--border)'}}>
                    {exp.referenceFileName?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                      <img src={exp.referenceFile} alt={exp.referenceFileName||'letter'}
                        style={{width:64, height:64, objectFit:'cover', borderRadius:6, border:'1px solid var(--border)', cursor:'pointer', flexShrink:0}}
                        onClick={()=>window.open(exp.referenceFile)}/>
                    ) : (
                      <div style={{width:64, height:64, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg2)', cursor:'pointer', flexShrink:0}}
                        onClick={()=>{const w=window.open(); w.document.write(`<iframe src="${exp.referenceFile}" width="100%" height="100%" style="border:none"/>`)}}>
                        <span className="material-icons-round" style={{fontSize:28, color:'var(--error)'}}>picture_as_pdf</span>
                        <span style={{fontSize:9, color:'var(--text3)'}}>PDF</span>
                      </div>
                    )}
                    <span style={{fontSize:13, fontWeight:600, color:'var(--primary-dark)', cursor:'pointer', textDecoration:'underline'}}
                      onClick={()=>{ if(exp.referenceFile){ if(exp.referenceFileName?.match(/\.pdf$/i)){const w=window.open();w.document.write(`<iframe src="${exp.referenceFile}" width="100%" height="100%" style="border:none"/>`);} else {window.open(exp.referenceFile);}} }}>
                      {exp.referenceFileName || 'View letter'}
                    </span>
                  </div>
                )}

                {/* Remarks */}
                {exp.remarks && (
                  <div style={{marginTop:16, padding:'12px 16px', background:'var(--warning-light)', borderRadius:10, border:'1px solid rgba(255,174,31,0.2)'}}>
                    <div style={{fontSize:11, fontWeight:700, color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:4}}>Remarks</div>
                    <div style={{fontSize:13, color:'var(--text)'}}>{exp.remarks}</div>
                  </div>
                )}
              </div>

              <div className="modal-footer" style={{justifyContent:'space-between'}}>
                <div style={{fontSize:12, color:'var(--text3)'}}>Assignment ID #{exp.id}</div>
                <div style={{display:'flex', gap:8}}>
                  {canEdit && <Btn className="btn btn-secondary btn-sm" onClick={()=>setModal({type:'editExp', data:exp})}>
                    <span className="material-icons-round" style={{fontSize:14}}>edit</span> Edit
                  </Btn>}
                  <Btn className="btn btn-primary btn-sm" onClick={()=>setModal(null)}>Close</Btn>
                </div>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}
      {modal?.type === 'editNSTB' && <NSTBForm record={modal.data} onSave={saveNSTB} onClose={()=>setModal(null)}/>}
      {modal?.type === 'addTax' && <TaxForm onSave={saveTax} onClose={()=>setModal(null)}/>}
      {modal?.type === 'editTax' && <TaxForm record={modal.data} onSave={saveTax} onClose={()=>setModal(null)}/>}
      {modal?.type === 'addAffiliation' && <AffiliationForm onSave={saveAffiliation} onClose={()=>setModal(null)}/>}
      {modal?.type === 'editAffiliation' && <AffiliationForm record={modal.data} onSave={saveAffiliation} onClose={()=>setModal(null)}/>}

      {confirmModal && (
        <Modal
          title="Confirm Delete"
          onClose={() => setConfirmModal(null)}
          footer={<>
            <Btn className="btn btn-secondary" onClick={() => setConfirmModal(null)}>Cancel</Btn>
            <Btn className="btn btn-danger" disabled={saving} onClick={async () => {
              await confirmModal.onConfirm();
              setConfirmModal(null);
            }}>
              {saving ? 'Deleting…' : 'Delete'}
            </Btn>
          </>}
        >
          <p style={{ margin: 0, color: 'var(--text1)' }}>{confirmModal.message}</p>
        </Modal>
      )}

      {tab==='clients' && (
        <div>
          {instituteClients.length === 0
            ? <div className="empty-state"><div className="empty-state-icon">🤝</div><div className="empty-state-title">No clients yet</div><div className="empty-state-sub">Clients appear here once experience assignments are added.</div></div>
            : instituteClients.map(client => (
              <ClientDocuments key={client.id||client.name} client={client} instituteId={institute.id} token={token} canEdit={canEdit} isAdmin={isAdmin}/>
            ))
          }
        </div>
      )}
    </div>
  );
}
// ── Infrastructure Tab (D1 — Office Space and Training Facilities) ─────────────

const INFRA_COLS = ['S.N.', 'Particular', 'Description', 'Unit (Number)', 'Size', 'Ownership', 'Remark'];
const INFRA_BLANK = { particular:'', description:'', unit:'', size:'', ownership:'Own', remark:'' };
const OWNERSHIP_OPTS = ['Own', 'Rented', 'Leased', 'Borrowed', 'Government'];

function InfrastructureTab({ instituteId, token, canEdit }) {
  const [rows, setRows] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [bulkRows, setBulkRows] = useState([{...INFRA_BLANK}]);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [confirmModal, setConfirmModal] = useState(null);

  useEffect(() => {
    api('GET', `/infrastructure/${instituteId}`, null, token).then(setRows).catch(() => setRows([]));
  }, [instituteId, token]);

  const reload = () => api('GET', `/infrastructure/${instituteId}`, null, token).then(setRows);

  const startEdit = (row) => { setEditingId(row.id); setEditForm({ particular: row.particular, description: row.description||'', unit: row.unit||'', size: row.size||'', ownership: row.ownership||'Own', remark: row.remark||'' }); };
  const cancelEdit = () => setEditingId(null);

  const saveEdit = async () => {
    if (!editForm.particular.trim()) return setErr('Particular is required.');
    setErr('');
    await api('PUT', `/infrastructure/${editingId}`, editForm, token);
    setEditingId(null);
    reload();
  };

  const deleteRow = (id) => {
    setConfirmModal({
      message: 'Delete this infrastructure row?',
      onConfirm: async () => {
        await api('DELETE', `/infrastructure/${id}`, null, token);
        reload();
      },
    });
  };

  const updateBulk = (i, field, value) => setBulkRows(prev => prev.map((r, idx) => idx === i ? {...r, [field]: value} : r));
  const addBulkRow = () => setBulkRows(prev => [...prev, {...INFRA_BLANK}]);
  const removeBulkRow = (i) => setBulkRows(prev => prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i));

  const cancelAdd = () => { setAdding(false); setBulkRows([{...INFRA_BLANK}]); setErr(''); };

  const moveRow = async (id, direction) => {
    const idx = rows.findIndex(r => r.id === id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= rows.length) return;
    const a = rows[idx], b = rows[swapIdx];
    await Promise.all([
      api('PUT', `/infrastructure/${a.id}`, { ...a, sort_order: b.sort_order ?? swapIdx }, token),
      api('PUT', `/infrastructure/${b.id}`, { ...b, sort_order: a.sort_order ?? idx }, token),
    ]);
    reload();
  };

  const saveBulk = async () => {
    const valid = bulkRows.filter(r => r.particular.trim());
    if (!valid.length) return setErr('At least one row must have a Particular.');
    setErr(''); setSaving(true);
    try {
      await Promise.all(valid.map((r, i) => api('POST', '/infrastructure', { institute_id: instituteId, ...r, sort_order: (rows?.length || 0) + i }, token)));
      setBulkRows([{...INFRA_BLANK}]);
      setAdding(false);
      reload();
    } finally { setSaving(false); }
  };

  if (!rows) return <div style={{padding:24, color:'var(--text3)'}}>Loading…</div>;

  const tdS = { padding:'6px 10px', border:'1px solid var(--border)', fontSize:13, verticalAlign:'middle' };
  const thS = { ...tdS, background:'var(--bg2)', fontWeight:600 };
  const inp = { width:'100%', padding:'4px 6px', border:'1px solid var(--border)', borderRadius:4, fontSize:13, background:'var(--bg)', color:'var(--text1)' };

  return (
    <div>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
        <div style={{fontSize:13, color:'var(--text2)'}}>D1 — Office Space and Training Facilities (for ENSSURE report)</div>
        {canEdit && !adding && <Btn className="btn btn-primary btn-sm" onClick={()=>setAdding(true)}>+ Add rows</Btn>}
      </div>
      {err && <div style={{color:'#c00', marginBottom:8, fontSize:13}}>{err}</div>}
      <div className="table-wrap">
        <table style={{width:'100%', borderCollapse:'collapse'}}>
          <thead>
            <tr>{INFRA_COLS.map(h=><th key={h} style={thS}>{h}</th>)}{canEdit && <th style={thS}>Actions</th>}</tr>
          </thead>
          <tbody>
            {rows.map((row, i) => editingId === row.id ? (
              <tr key={row.id}>
                <td style={tdS}>{i+1}</td>
                {['particular','description','unit','size'].map(f=>(
                  <td key={f} style={tdS}><input style={inp} value={editForm[f]} onChange={e=>setEditForm(p=>({...p,[f]:e.target.value}))} /></td>
                ))}
                <td style={tdS}>
                  <select style={inp} value={editForm.ownership} onChange={e=>setEditForm(p=>({...p,ownership:e.target.value}))}>
                    {OWNERSHIP_OPTS.map(o=><option key={o}>{o}</option>)}
                  </select>
                </td>
                <td style={tdS}><input style={inp} value={editForm.remark} onChange={e=>setEditForm(p=>({...p,remark:e.target.value}))} /></td>
                <td style={tdS}>
                  <Btn className="btn btn-primary btn-sm" style={{marginRight:4}} onClick={saveEdit}>Save</Btn>
                  <Btn className="btn btn-ghost btn-sm" onClick={cancelEdit}>Cancel</Btn>
                </td>
              </tr>
            ) : (
              <tr key={row.id}>
                <td style={{...tdS, textAlign:'center'}}>{i+1}</td>
                <td style={tdS}>{row.particular}</td>
                <td style={tdS}>{row.description}</td>
                <td style={{...tdS, textAlign:'center'}}>{row.unit}</td>
                <td style={tdS}>{row.size}</td>
                <td style={{...tdS, textAlign:'center'}}>{row.ownership||'Own'}</td>
                <td style={tdS}>{row.remark}</td>
                {canEdit && <td style={tdS}>
                  <Btn className="btn btn-ghost btn-sm" style={{marginRight:2}} title="Move up" disabled={i===0} onClick={()=>moveRow(row.id,-1)}>↑</Btn>
                  <Btn className="btn btn-ghost btn-sm" style={{marginRight:4}} title="Move down" disabled={i===rows.length-1} onClick={()=>moveRow(row.id,1)}>↓</Btn>
                  <Btn className="btn btn-ghost btn-sm" style={{marginRight:4}} onClick={()=>startEdit(row)}>✏</Btn>
                  <Btn className="btn btn-danger btn-sm" onClick={()=>deleteRow(row.id)}><span className="material-icons-round" style={{fontSize:15}}>delete</span></Btn>
                </td>}
              </tr>
            ))}
            {rows.length === 0 && !adding && (
              <tr><td colSpan={canEdit?8:7} style={{...tdS, textAlign:'center', color:'var(--text3)', padding:24}}>No infrastructure rows yet. Click "+ Add rows" to begin.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Bulk add panel */}
      {adding && (
        <div style={{marginTop:16, border:'1px solid var(--border)', borderRadius:6, padding:12, background:'var(--bg2)'}}>
          <div style={{fontWeight:600, fontSize:13, marginBottom:8}}>Add rows</div>
          <div className="table-wrap">
            <table style={{width:'100%', borderCollapse:'collapse'}}>
              <thead>
                <tr>
                  <th style={thS}>#</th>
                  <th style={thS}>Particular *</th>
                  <th style={thS}>Description</th>
                  <th style={thS}>Unit (Number)</th>
                  <th style={thS}>Size</th>
                  <th style={thS}>Ownership</th>
                  <th style={thS}>Remark</th>
                  <th style={thS}></th>
                </tr>
              </thead>
              <tbody>
                {bulkRows.map((r, i) => (
                  <tr key={i}>
                    <td style={{...tdS, textAlign:'center', color:'var(--text3)', width:36}}>{rows.length + i + 1}</td>
                    <td style={tdS}><input style={inp} placeholder="e.g. Classroom" value={r.particular} onChange={e=>updateBulk(i,'particular',e.target.value)} /></td>
                    <td style={tdS}><input style={inp} value={r.description} onChange={e=>updateBulk(i,'description',e.target.value)} /></td>
                    <td style={tdS}><input style={inp} value={r.unit} onChange={e=>updateBulk(i,'unit',e.target.value)} /></td>
                    <td style={tdS}><input style={inp} value={r.size} onChange={e=>updateBulk(i,'size',e.target.value)} /></td>
                    <td style={tdS}>
                      <select style={inp} value={r.ownership} onChange={e=>updateBulk(i,'ownership',e.target.value)}>
                        {OWNERSHIP_OPTS.map(o=><option key={o}>{o}</option>)}
                      </select>
                    </td>
                    <td style={tdS}><input style={inp} value={r.remark} onChange={e=>updateBulk(i,'remark',e.target.value)} /></td>
                    <td style={{...tdS, textAlign:'center'}}>
                      <Btn className="btn btn-danger btn-sm" onClick={()=>removeBulkRow(i)} disabled={bulkRows.length===1}>✕</Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{display:'flex', gap:8, marginTop:10, alignItems:'center'}}>
            <Btn className="btn btn-ghost btn-sm" onClick={addBulkRow}>+ Add another row</Btn>
            <div style={{flex:1}}/>
            <Btn className="btn btn-ghost btn-sm" onClick={cancelAdd}>Cancel</Btn>
            <Btn className="btn btn-primary btn-sm" onClick={saveBulk} disabled={saving}>{saving ? 'Saving…' : `Save ${bulkRows.filter(r=>r.particular.trim()).length || ''} row(s)`}</Btn>
          </div>
        </div>
      )}

      {/* ── Themed delete confirmation modal ── */}
      {confirmModal && (
        <Modal
          title="Confirm Delete"
          onClose={() => setConfirmModal(null)}
          footer={<>
            <Btn className="btn btn-secondary" onClick={() => setConfirmModal(null)}>Cancel</Btn>
            <Btn className="btn btn-danger" disabled={saving} onClick={async () => {
              await confirmModal.onConfirm();
              setConfirmModal(null);
            }}>
              {saving ? 'Deleting…' : 'Delete'}
            </Btn>
          </>}
        >
          <p style={{ margin: 0, color: 'var(--text1)' }}>{confirmModal.message}</p>
        </Modal>
      )}
    </div>
  );
}

const ACCEPT = 'image/*';

function parseFiles(val) {
  if (!val) return [];
  try { const p = JSON.parse(val); return Array.isArray(p) ? p : [val]; }
  catch { return [val]; }
}
function filesToStore(arr) {
  if (!arr.length) return null;
  return arr.length === 1 ? arr[0] : JSON.stringify(arr);
}

// Remove white/near-white background from an image file, returns a new PNG File.
// Skips processing if the image already has transparency or has a dark background.
async function removeImageBackground(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = data.data;
      const w = canvas.width, h = canvas.height;
      // Sample corner pixel indices
      const cornerIdxs = [0, (w - 1) * 4, (h - 1) * w * 4, ((h - 1) * w + w - 1) * 4];
      // If any corner is already transparent, image already has no background — skip
      const anyTransparent = cornerIdxs.some(i => d[i + 3] < 128);
      if (anyTransparent) { URL.revokeObjectURL(url); return resolve(file); }
      const corners = cornerIdxs.map(i => [d[i], d[i + 1], d[i + 2]]);
      const bgR = Math.round(corners.reduce((s, c) => s + c[0], 0) / 4);
      const bgG = Math.round(corners.reduce((s, c) => s + c[1], 0) / 4);
      const bgB = Math.round(corners.reduce((s, c) => s + c[2], 0) / 4);
      const bgLuma = 0.299 * bgR + 0.587 * bgG + 0.114 * bgB;
      const threshold = 40;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] === 0) continue;
        const dr = Math.abs(d[i] - bgR);
        const dg = Math.abs(d[i + 1] - bgG);
        const db = Math.abs(d[i + 2] - bgB);
        if (dr < threshold && dg < threshold && db < threshold) d[i + 3] = 0;
      }
      ctx.putImageData(data, 0, 0);
      canvas.toBlob(blob => {
        if (!blob) return reject(new Error('Canvas conversion failed'));
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, '') + '.png', { type: 'image/png' }));
      }, 'image/png');
    };
    img.onerror = reject;
    img.src = url;
  });
}

// `kind` tells the server how to normalise: 'letterhead' (full-bleed A4),
// 'asset' (signature/stamp — keeps transparency), or 'document' (scanned page).
async function uploadToR2(file, token, kind = 'document') {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`/api/upload?kind=${encodeURIComponent(kind)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (err.error === 'blank_page') throw new Error('Blank page detected — skipped.');
    throw new Error(err.message || err.error || 'Upload failed');
  }
  const { url } = await res.json();
  return url;
}

const THUMB_SIZE = 80;

function FileThumb({ src, onRemove }) {
  const [hover, setHover] = useState(false);
  const [confirming, setConfirming] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setConfirming(false); }}
      style={{position:'relative', flexShrink:0, width:THUMB_SIZE, height:THUMB_SIZE, borderRadius:10,
        // white (not var(--bg)) so transparent signatures/stamps stay legible in dark mode
        overflow:'hidden', border:'1.5px solid var(--border)', background:'#fff', cursor: onRemove ? 'pointer' : 'default',
        boxShadow: hover ? '0 2px 8px rgba(0,0,0,.14)' : '0 1px 3px rgba(0,0,0,.07)',
        transition:'box-shadow .15s',
      }}
    >
      {/\.pdf($|\?)/i.test(src)
        ? <a href={src} target="_blank" rel="noreferrer" style={{display:'flex', width:'100%', height:'100%', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:2, textDecoration:'none'}}>
            <span className="material-icons-round" style={{fontSize:32, color:'var(--error)'}}>picture_as_pdf</span>
            <span style={{fontSize:9, fontWeight:700, color:'var(--text2)'}}>PDF</span>
          </a>
        : <a href={src} target="_blank" rel="noreferrer" style={{display:'block', width:'100%', height:'100%'}}>
            <img src={src} alt="" style={{width:'100%', height:'100%', objectFit:'contain', display:'block'}}/>
          </a>
      }
      {onRemove && hover && (
        confirming ? (
          <div style={{position:'absolute', inset:0, background:'rgba(229,57,53,.88)', display:'flex',
            flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4, backdropFilter:'blur(2px)'}}>
            <span style={{color:'#fff', fontSize:10.5, fontWeight:600, textAlign:'center', padding:'0 4px'}}>Remove?</span>
            <div style={{display:'flex', gap:6}}>
              <button onClick={e=>{e.preventDefault(); e.stopPropagation(); onRemove(); setConfirming(false);}}
                style={{background:'#fff', color:'#c0392b', border:'none', borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:700, cursor:'pointer'}}>
                Yes
              </button>
              <button onClick={e=>{e.preventDefault(); e.stopPropagation(); setConfirming(false);}}
                style={{background:'rgba(255,255,255,.25)', color:'#fff', border:'1px solid #fff', borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:600, cursor:'pointer'}}>
                No
              </button>
            </div>
          </div>
        ) : (
          <button onClick={e=>{e.preventDefault(); setConfirming(true);}}
            style={{position:'absolute', inset:0, width:'100%', height:'100%', background:'rgba(229,57,53,.72)',
              color:'#fff', border:'none', cursor:'pointer', fontSize:18, display:'flex', alignItems:'center',
              justifyContent:'center', backdropFilter:'blur(2px)'}}>✕</button>
        )
      )}
    </div>
  );
}

function DocMultiUpload({ label, hint, value, onChange, disabled, token, processFile, kind }) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const files = parseFiles(value);

  const addFiles = async e => {
    const picked = Array.from(e.target.files); e.target.value = '';
    if (!picked.length) return;
    setErr(''); setUploading(true);
    try {
      const processed = processFile ? await Promise.all(picked.map(f => processFile(f))) : picked;
      const urls = await Promise.all(processed.map(f => uploadToR2(f, token, kind)));
      onChange(filesToStore([...files, ...urls]));
    } catch (ex) { setErr(ex.message); }
    finally { setUploading(false); }
  };
  const remove = idx => onChange(filesToStore(files.filter((_, i) => i !== idx)));

  return (
    <div>
      {label && <label style={{fontSize:13, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:8}}>{label}</label>}
      <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
        {files.map((src, i) => (
          <FileThumb key={i} src={src} onRemove={!disabled ? () => remove(i) : null}/>
        ))}
        {!disabled && (
          <label style={{cursor: uploading ? 'wait' : 'pointer', flexShrink:0}}>
            <input type="file" accept={ACCEPT} multiple style={{display:'none'}} onChange={addFiles} disabled={uploading}/>
            <div style={{
              width: THUMB_SIZE, height: THUMB_SIZE,
              border:'2px dashed var(--primary)', borderRadius:10,
              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4,
              color:'var(--primary)', background:'color-mix(in srgb,var(--primary) 5%,transparent)',
              transition:'background .15s',
            }}
              onMouseEnter={e=>e.currentTarget.style.background='color-mix(in srgb,var(--primary) 12%,transparent)'}
              onMouseLeave={e=>e.currentTarget.style.background='color-mix(in srgb,var(--primary) 5%,transparent)'}
            >
              {uploading
                ? <span style={{fontSize:11, fontWeight:600}}>Uploading…</span>
                : <>
                    <span className="material-icons-round" style={{fontSize:22}}>add_photo_alternate</span>
                    <span style={{fontSize:10, fontWeight:600, lineHeight:1}}>Add</span>
                  </>
              }
            </div>
          </label>
        )}
        {!files.length && disabled && (
          <div style={{width:THUMB_SIZE, height:THUMB_SIZE, border:'1px dashed var(--border)', borderRadius:10,
            background:'var(--bg)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3}}>
            <span className="material-icons-round" style={{fontSize:20, color:'var(--text3)', opacity:.4}}>image_not_supported</span>
            <span style={{fontSize:10, color:'var(--text3)'}}>None</span>
          </div>
        )}
      </div>
      {err && <div style={{fontSize:11, color:'#c0391e', marginTop:4}}>{err}</div>}
      {hint && <div style={{fontSize:11, color:'var(--text3)', marginTop:4}}>{hint}</div>}
    </div>
  );
}

function DocImgUpload({ label, hint, value, onChange, disabled, token, processFile, kind }) {
  return (
    <DocMultiUpload
      label={label} hint={hint} token={token} disabled={disabled}
      processFile={processFile} kind={kind}
      value={value ? JSON.stringify([value]) : null}
      onChange={v => {
        const arr = parseFiles(v);
        onChange(arr.length ? arr[arr.length - 1] : null);
      }}
    />
  );
}

function DocumentsTab({ institute, token, canEdit, onUpdate, isShortlistOnly }) {
  const fromInst = (inst) => ({
    nameNp: inst.nameNp || '',
    addressNp: inst.addressNp || '',
    contactPersonNp: inst.contactPersonNp || '',
    letterhead: inst.letterhead || null,
    sign: inst.sign || null,
    stamp: inst.stamp || null,
    serviceType: inst.serviceType || 'सीपमूलक तथा व्यावसायिक तालिम कार्यक्रमहरु सञ्चालन',
    letterTopMargin: inst.letterTopMargin ?? 15,
    letterBottomPadding: inst.letterBottomPadding ?? 15,
    letterLrPadding: inst.letterLrPadding ?? 5,
    ocrRegistration: inst.ocrRegistration || null,
    ocrRenewal: inst.ocrRenewal || null,
    localLevelRegistration: inst.localLevelRegistration || null,
    localLevelRenewal: inst.localLevelRenewal || null,
    vatRegistration: inst.vatRegistration || null,
    taxClearanceDoc: inst.taxClearanceDoc || null,
    vatExtension: inst.vatExtension || null,
    ctevtAffiliation: inst.ctevtAffiliation || null,
    ctevtRenewal: inst.ctevtRenewal || null,
  });

  const [fields, setFields] = useState(() => fromInst(institute));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Re-sync from server when institute doc fields arrive (e.g. after initial load),
  // but only if the user hasn't started editing — otherwise uploads would be lost
  // when another tab's save triggers a parent re-render with a refreshed institute prop.
  useEffect(() => {
    if (!dirty) { setFields(fromInst(institute)); setSaved(false); }
  }, [institute.id, institute.ctevtAffiliation, institute.ocrRegistration]);

  // Always reset when switching to a different institute
  useEffect(() => { setFields(fromInst(institute)); setSaved(false); setDirty(false); }, [institute.id]);

  const set = (k, v) => { setSaved(false); setDirty(true); setFields(f => ({...f, [k]: v})); };

  const handleSave = async () => {
    setSaving(true); setErr('');
    try {
      await api('PUT', `/institutes/${institute.id}`, instToAPI({ ...institute, ...fields }), token);
      if (onUpdate) onUpdate({ ...institute, ...fields });
      setSaved(true); setDirty(false);
    } catch(e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const SectionTitle = ({children}) => (
    <div style={{fontWeight:700, fontSize:13, color:'var(--text2)', marginBottom:12, marginTop:20, paddingTop:16, borderTop:'1px solid var(--border)'}}>{children}</div>
  );

  const DOC_ROWS = [
    { label: 'OCR दर्ता', sub: 'Registration', key: 'ocrRegistration' },
    { label: 'OCR नवीकरण', sub: 'Renewal', key: 'ocrRenewal' },
    { label: 'स्थानीय तह दर्ता', sub: 'Local Level Reg.', key: 'localLevelRegistration' },
    { label: 'स्थानीय तह नवीकरण', sub: 'Local Level Renewal', key: 'localLevelRenewal' },
    { label: 'भ्याट दर्ता', sub: 'VAT Registration', key: 'vatRegistration' },
    { label: 'कर चुक्ता', sub: 'Tax Clearance', key: 'taxClearanceDoc' },
    { label: 'भ्याट म्याद थप', sub: 'VAT Date Extension', key: 'vatExtension' },
    { label: 'CTEVT सम्बन्धन', sub: 'Affiliation', key: 'ctevtAffiliation' },
    { label: 'CTEVT नवीकरण', sub: 'Renewal', key: 'ctevtRenewal' },
  ];

  return (
    <div style={{display:'flex', flexDirection:'column', gap:16}}>

      {/* ── Nepali Fields + Letter Images + Settings ── */}
      {!isShortlistOnly && <>
        <div className="card">
          <div className="section-title" style={{marginBottom:4}}>नेपाली विवरण</div>
          <div style={{fontSize:12, color:'var(--text3)', marginBottom:16}}>Used in the generated letter. Leave blank to fall back to English fields.</div>
          <div className="form-group">
            <MdTextField label="संस्थाको नाम (नेपालीमा)" value={fields.nameNp} disabled={!canEdit}
              onChange={e=>set('nameNp',e.target.value)} placeholder="e.g. वर्ल्ड लिङ्क टेक्निकल ट्रेनिङ् इन्स्टिच्च्यूट प्रा.लि." style={{width:'100%'}}/>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 20px'}}>
            <div className="form-group">
              <MdTextField label="ठेगाना (नेपालीमा)" value={fields.addressNp} disabled={!canEdit}
                onChange={e=>set('addressNp',e.target.value)} placeholder="e.g. टोखा-१०, काठमाडौं" style={{width:'100%'}}/>
            </div>
            <div className="form-group">
              <MdTextField label="मुख्य व्यक्तिको नाम (नेपालीमा)" value={fields.contactPersonNp} disabled={!canEdit}
                onChange={e=>set('contactPersonNp',e.target.value)} placeholder="e.g. ठाकुर सुवेदी" style={{width:'100%'}}/>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="section-title" style={{marginBottom:4}}>Letter Images</div>
          <div style={{fontSize:12, color:'var(--text3)', marginBottom:16}}>Signature and stamp are shown individually — toggle each in the Generate Letter dialog.</div>
          <DocImgUpload label="Letterhead" hint="Stretched full-bleed to A4 behind generated letters." value={fields.letterhead} onChange={v=>set('letterhead',v)} disabled={!canEdit} token={token} kind="letterhead"/>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 20px'}}>
            <DocImgUpload label="Authorized Signature" value={fields.sign} onChange={v=>set('sign',v)} disabled={!canEdit} token={token} processFile={removeImageBackground} kind="asset"/>
            <DocImgUpload label="Stamp / Seal" value={fields.stamp} onChange={v=>set('stamp',v)} disabled={!canEdit} token={token} processFile={removeImageBackground} kind="asset"/>
          </div>
        </div>

        <div className="card">
          <div className="section-title" style={{marginBottom:4}}>Letter Settings</div>
          <div style={{fontSize:12, color:'var(--text3)', marginBottom:16}}>Controls the layout of the generated letter.</div>
          <div className="form-group">
            <label style={{fontSize:12, fontWeight:600, color:'var(--text3)', display:'block', marginBottom:6}}>सेवाको प्रकार (Service Type)</label>
            <input list="service-type-list" value={fields.serviceType} onChange={e=>set('serviceType',e.target.value)} disabled={!canEdit}
              style={{width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)', fontSize:14}}/>
            <datalist id="service-type-list">
              <option value="सीपमूलक तथा व्यावसायिक तालिम कार्यक्रमहरु सञ्चालन"/>
              <option value="परामर्श सेवा"/>
              <option value="अन्य सेवा"/>
            </datalist>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'0 20px'}}>
            {[
              ['Top', 'letterTopMargin', 'Push text below the letterhead'],
              ['Bottom', 'letterBottomPadding', 'Space at the bottom of the page'],
              ['Left / Right', 'letterLrPadding', 'Horizontal margin inside the page'],
            ].map(([label, key, hint]) => (
              <div key={key} className="form-group">
                <MdTextField type="number" label={`${label} padding (mm)`} value={fields[key]} disabled={!canEdit}
                  onChange={e=>set(key, Number(e.target.value))} supporting-text={hint} style={{width:'100%'}}/>
              </div>
            ))}
          </div>
        </div>
      </>}

      {/* ── Supporting Documents ── */}
      <div className="card" style={{padding:0, overflow:'hidden'}}>
        {/* Header */}
        <div style={{padding:'18px 24px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12}}>
          <div>
            <div style={{fontWeight:700, fontSize:15, color:'var(--text)'}}>Supporting Documents</div>
            <div style={{fontSize:12, color:'var(--text3)', marginTop:2}}>
              Upload scanned images of certificates{!isShortlistOnly && ' — attach to generated letters'}.
            </div>
          </div>
          <div style={{display:'flex', gap:6, alignItems:'center'}}>
            {(() => {
              const filled = DOC_ROWS.filter(d => {
                const v = fields[d.key];
                if (!v) return false;
                try { const p = JSON.parse(v); return Array.isArray(p) ? p.length > 0 : !!v; } catch { return !!v; }
              }).length;
              return (
                <span style={{fontSize:12, fontWeight:600, padding:'4px 12px', borderRadius:100,
                  background: filled === DOC_ROWS.length ? 'var(--success-light)' : 'var(--primary-light)',
                  color: filled === DOC_ROWS.length ? '#0b9b85' : 'var(--primary-dark)'}}>
                  {filled} / {DOC_ROWS.length} uploaded
                </span>
              );
            })()}
          </div>
        </div>

        {/* Doc rows */}
        {DOC_ROWS.map((doc, i) => {
          const v = fields[doc.key];
          const hasFile = (() => { if (!v) return false; try { const p = JSON.parse(v); return Array.isArray(p) ? p.length > 0 : !!v; } catch { return !!v; } })();
          return (
            <div key={doc.key} style={{
              display:'flex', alignItems:'center', gap:16, padding:'14px 24px',
              borderBottom: i < DOC_ROWS.length - 1 ? '1px solid var(--border)' : 'none',
              background: i % 2 === 1 ? 'var(--bg)' : 'var(--surface)',
            }}>
              {/* Status dot */}
              <div style={{
                width:8, height:8, borderRadius:'50%', flexShrink:0,
                background: hasFile ? 'var(--success)' : 'var(--border2)',
              }}/>
              {/* Label */}
              <div style={{flex:'0 0 260px', minWidth:0}}>
                <div style={{fontWeight:600, fontSize:13.5, color:'var(--text)'}}>{doc.label}</div>
                <div style={{fontSize:11.5, color:'var(--text3)', marginTop:1}}>{doc.sub}</div>
              </div>
              {/* Upload widget */}
              <div style={{flex:1, minWidth:0}}>
                <DocMultiUpload label="" value={fields[doc.key]} onChange={v=>set(doc.key,v)} disabled={!canEdit} token={token}/>
              </div>
            </div>
          );
        })}

        {/* Save footer */}
        {canEdit && (
          <div style={{padding:'16px 24px', borderTop:'1px solid var(--border)', background:'var(--bg)', display:'flex', alignItems:'center', gap:12}}>
            <Btn className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save documents'}
            </Btn>
            {saved && <span style={{fontSize:12, color:'var(--success)', fontWeight:500}}>✓ Saved</span>}
            {err  && <span style={{fontSize:12, color:'var(--error)'}}>{err}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export default InstituteDetail;

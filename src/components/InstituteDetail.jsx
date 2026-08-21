import React, { useState, useEffect, useMemo } from 'react';
import { useCachedLogo } from '../utils/logoCache.js';
import { InstituteAvatar } from './ui/primitives.jsx';
import { missingBolpatraFields } from '../utils/bolpatraGaps.js';
import BolpatraGapsModal from './institute/BolpatraGapsModal.jsx';
import { InfrastructureTab } from './institute/InfrastructureTab.jsx';
import { DocumentsTab } from './institute/DocumentsTab.jsx';
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
import { fmt, fyToAD, getClient, getOccupation, pct } from '../utils/format.js';
import { toast } from './ui/Feedback.jsx';





function InstituteDetail({institute, clients, onUpdateClients, onBack, onUpdate, onRefresh, onDelete, token, isAdmin, isEditor, isSuperAdmin, isShortlistOnly, jumpToTab, onAddNSTB}) {
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

  /**
   * Where this firm has actually delivered training, consolidated.
   *
   * The districts were only ever visible one assignment at a time, with the
   * profile showing a bare count — so answering "have they worked in Banke?"
   * meant opening every assignment in turn. Grouped by province because that is
   * how the coverage question is usually asked.
   *
   * Trainees are summed per occupation row, and an occupation delivered across
   * several districts contributes its trainees to each: the row records one
   * figure for the whole row, so splitting it between districts would be
   * inventing a breakdown the data does not carry. Assignments are counted
   * distinctly, so a district is never credited twice for one assignment.
   */
  const districtCoverage = useMemo(() => {
    const byDistrict = new Map();
    for (const exp of (institute.experience || [])) {
      for (const occ of (exp.occupations || [])) {
        const trainees = parseInt(occ.trainees) || 0;
        for (const loc of (occ.locations || [])) {
          const name = (loc.district || '').trim();
          if (!name) continue;
          if (!byDistrict.has(name)) {
            byDistrict.set(name, { district: name, province: loc.province || '', assignments: new Set(), trainees: 0 });
          }
          const d = byDistrict.get(name);
          if (!d.province && loc.province) d.province = loc.province;
          d.assignments.add(exp.id);
          d.trainees += trainees;
        }
      }
    }
    const rows = [...byDistrict.values()]
      .map(d => ({ ...d, assignments: d.assignments.size }))
      .sort((a, b) => b.trainees - a.trainees || a.district.localeCompare(b.district));

    const provinces = new Map();
    for (const r of rows) {
      const key = r.province || 'Province not recorded';
      if (!provinces.has(key)) provinces.set(key, []);
      provinces.get(key).push(r);
    }
    return { rows, provinces: [...provinces.entries()] };
  }, [institute]);

  // How many assignments would print with a gap — shown on the chip so the
  // number is visible without having to filter first.
  const bolpatraGapCount = useMemo(
    () => (institute.experience || []).filter(e => missingBolpatraFields(e, institute).length > 0).length,
    [institute]);

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
  // '' | 'level' | 'duration' | 'either' — split so "missing level" (needed to
  // pick the right EOI level bracket) doesn't require wading through
  // assignments that are only missing duration, and vice versa.
  const [expMissingFilter, setExpMissingFilter] = useState('');
  const matchesMissingFilter = (occs) => {
    if (!expMissingFilter) return true;
    if (expMissingFilter === 'level') return (occs || []).some(o => !o.level);
    if (expMissingFilter === 'duration') return (occs || []).some(o => !o.duration);
    return (occs || []).some(o => !o.level || !o.duration);
  };
  // Assignments the EOI report would print with blanks in them.
  const [expBolpatraFilter, setExpBolpatraFilter] = useState(false);

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
                      ? <a href={institute.googleMapLink} target="_blank" rel="noreferrer" style={{color:'var(--accent)'}}><span className="material-icons-round" style={{fontSize:13, verticalAlign:'middle', marginRight:4}}>place</span>Google Maps</a>
                      : <a href={`https://www.google.com/maps?q=${institute.latitude},${institute.longitude}`} target="_blank" rel="noreferrer" style={{color:'var(--accent)'}}><span className="material-icons-round" style={{fontSize:13, verticalAlign:'middle', marginRight:4}}>place</span>Google Maps</a>}
                  </span>
                : institute.googleMapLink
                  ? <a href={institute.googleMapLink} target="_blank" rel="noreferrer" style={{color:'var(--accent)'}}><span className="material-icons-round" style={{fontSize:13, verticalAlign:'middle', marginRight:4}}>place</span>View on Google Maps</a>
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

        {/* Where training has actually been delivered — the profile carried a
            count, but which districts was only visible one assignment at a
            time. */}
        {!isShortlistOnly && districtCoverage.rows.length > 0 && (
          <div className="card" style={{marginTop:16}}>
            <div style={{display:'flex', alignItems:'baseline', justifyContent:'space-between', gap:10, flexWrap:'wrap'}}>
              <div className="section-title" style={{marginBottom:0}}>Districts with training experience</div>
              <div style={{fontSize:12, color:'var(--text3)'}}>
                {districtCoverage.rows.length} district{districtCoverage.rows.length !== 1 ? 's' : ''}
                {' · '}{districtCoverage.provinces.length} province{districtCoverage.provinces.length !== 1 ? 's' : ''}
              </div>
            </div>

            <div style={{display:'flex', flexDirection:'column', gap:14, marginTop:12}}>
              {districtCoverage.provinces.map(([province, rows]) => (
                <div key={province}>
                  <div style={{fontSize:10.5, fontWeight:700, color:'var(--text3)',
                    textTransform:'uppercase', letterSpacing:'.5px', marginBottom:7}}>
                    {province}
                  </div>
                  <div style={{display:'flex', flexWrap:'wrap', gap:7}}>
                    {rows.map(d => (
                      <span key={d.district}
                        title={`${d.district} — ${d.assignments} assignment${d.assignments !== 1 ? 's' : ''}, ${fmt(d.trainees)} trainees`}
                        style={{display:'inline-flex', alignItems:'center', gap:6, fontSize:12.5,
                          padding:'5px 11px', borderRadius:20, background:'var(--bg2)',
                          border:'1px solid var(--border)'}}>
                        <span className="material-icons-round" style={{fontSize:13, color:'var(--text3)'}}>location_on</span>
                        <span style={{fontWeight:600, color:'var(--text)'}}>{d.district}</span>
                        <span style={{color:'var(--text3)', fontSize:11.5}}>
                          {d.assignments}&nbsp;asgn · {fmt(d.trainees)}&nbsp;tr
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="input-hint" style={{marginTop:12}}>
              Trainees are counted per occupation row; a row delivered across several districts
              counts toward each, so these do not sum to the firm&rsquo;s total.
            </div>
          </div>
        )}

        </>
      )}

      {/* Experience tab */}
      {tab==='experience' && (
        <>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, gap:8, flexWrap:'wrap'}}>
            <div style={{display:'flex', gap:6, alignItems:'center', flexWrap:'wrap'}}>
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
              <select value={expMissingFilter} onChange={e=>setExpMissingFilter(e.target.value)}
                title="Show only assignments where an occupation is missing that field"
                style={{fontSize:12, padding:'4px 8px', borderRadius:6, border:'1px solid var(--border)',
                  background: expMissingFilter ? '#fff3cd' : 'var(--bg2)',
                  color: expMissingFilter ? '#856404' : 'var(--text1)',
                  fontWeight: expMissingFilter ? 700 : 400, minWidth:150}}>
                <option value="">Level/duration: all</option>
                <option value="level">Missing level</option>
                <option value="duration">Missing duration</option>
                <option value="either">Missing level or duration</option>
              </select>
              <button
                onClick={()=>setExpBolpatraFilter(v=>!v)}
                className={`gap-chip${expBolpatraFilter ? ' gap-chip-on' : ''}`}
                title="Show only assignments the EOI (Bolpatra) report would print with blank fields">
                <span className="material-icons-round" style={{fontSize:14,verticalAlign:'middle'}}>assignment_late</span>
                {' '}Bolpatra incomplete{bolpatraGapCount > 0 ? ` (${bolpatraGapCount})` : ''}
              </button>
            </div>
            <div style={{display:'flex', gap:6}}>
              {canEdit && (
                <Btn className="btn btn-primary btn-sm" onClick={()=>setModal({type:'addExp'})}>+ Add assignment</Btn>
              )}
            </div>
          </div>

          {institute.experience.length === 0
            ? <div className="empty-state"><div className="empty-state-icon"><span className="material-icons-round" style={{fontSize:44,opacity:0.3}}>assignment</span></div><div className="empty-state-title">No assignments yet</div><div className="empty-state-sub">Add the first experience / assignment record</div></div>
            : expViewMode === 'fy'
              ? groupByFY(institute.experience.filter(e=>(!expClientFilter || String(e.clientId)===String(expClientFilter)) && (!expOccFilter || (expOccFilter==='__missing__' ? (e.occupations||[]).some(o=>!o.ctevtOccupationId) : (e.occupations||[]).some(o=>(getOccupation(o.ctevtOccupationId).name||o.nameInLetter)===expOccFilter))) && matchesMissingFilter(e.occupations) && (!expBolpatraFilter || missingBolpatraFields(e, institute).length > 0))).map(([fy, items]) => (
                <div key={fy} className="fy-group">
                  <button className="fy-header" onClick={()=>toggleFY('exp-'+fy)}>
                    <span className="material-icons-round" style={{fontSize:18, verticalAlign:'middle'}}>{expandedFY['exp-'+fy] ? 'expand_more' : 'chevron_right'}</span>
                    <span>FY {fy}{fyToAD(fy) ? <span style={{color:'var(--text3)',fontWeight:400,fontSize:'0.88em'}}> ({fyToAD(fy)})</span> : ''}</span>
                    <span className="badge badge-info" style={{marginLeft:'auto'}}>{items.length} assignment{items.length>1?'s':''}</span>
                  </button>
                  {expandedFY['exp-'+fy] && (
                    <div className="fy-body">
                      {items.map((exp,i) => <ExpCard key={exp.id} idx={i} exp={exp} clients={clients} institute={institute} showFY={false} setModal={setModal} deleteExperience={deleteExperience} canEdit={canEdit} isAdmin={isAdmin}/>)}
                    </div>
                  )}
                </div>
              ))
              : (() => {
                  // Group by client
                  const clientMap = new Map();
                  institute.experience.filter(exp => (!expClientFilter || String(exp.clientId)===String(expClientFilter)) && (!expOccFilter || (exp.occupations||[]).some(o=>(getOccupation(o.ctevtOccupationId).name||o.nameInLetter)===expOccFilter)) && matchesMissingFilter(exp.occupations) && (!expBolpatraFilter || missingBolpatraFields(exp, institute).length > 0)).forEach(exp => {
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
                          <span><span className="material-icons-round" style={{fontSize:16, verticalAlign:'middle'}}>{expandedFY['client-'+key] ? 'expand_more' : 'chevron_right'}</span></span>
                          <span style={{fontWeight:600}}>{clientLabel}</span>
                          <div style={{display:'flex', gap:6, marginLeft:'auto', alignItems:'center'}}>
                            <span className="badge badge-gray" style={{fontSize:10}}>{fys[0]}{fys.length>1?` – ${fys[fys.length-1]}`:''}</span>
                            <span className="badge badge-info">{exps.length} assignment{exps.length>1?'s':''}</span>
                            <span className="badge badge-active" style={{fontSize:10}}>{totalT.toLocaleString()} trainees</span>
                          </div>
                        </button>
                        {expandedFY['client-'+key] && (
                          <div className="fy-body">
                            {exps.sort((a,b)=>a.fy.localeCompare(b.fy)).map((exp,i) => <ExpCard key={exp.id} idx={i} exp={exp} clients={clients} institute={institute} showFY={true} setModal={setModal} deleteExperience={deleteExperience} canEdit={canEdit} isAdmin={isAdmin}/>)}
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
            ? <div className="empty-state"><div className="empty-state-icon"><span className="material-icons-round" style={{fontSize:42, color:'var(--text3)', opacity:.4}}>description</span></div><div className="empty-state-title">No NSTB records yet</div></div>
            : groupByFY(institute.nstb).map(([fy, items]) => (
              <div key={fy} className="fy-group">
                <button className="fy-header" onClick={()=>toggleFY('nstb-'+fy)}>
                  <span><span className="material-icons-round" style={{fontSize:16, verticalAlign:'middle'}}>{expandedFY['nstb-'+fy] ? 'expand_more' : 'chevron_right'}</span></span>
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
                              {canEdit && <Btn className="btn btn-ghost btn-sm" onClick={()=>setModal({type:'editNSTB', data:r})}><span className="material-icons-round" style={{fontSize:14}}>edit</span></Btn>}
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
            ? <div className="empty-state"><div className="empty-state-icon"><span className="material-icons-round" style={{fontSize:42, color:'var(--text3)', opacity:.4}}>receipt_long</span></div><div className="empty-state-title">No tax clearance records</div></div>
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
                          {canEdit && <Btn className="btn btn-ghost btn-sm" onClick={()=>setModal({type:'editTax', data:t})}><span className="material-icons-round" style={{fontSize:14}}>edit</span></Btn>}
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
            ? <div className="empty-state"><div className="empty-state-icon"><span className="material-icons-round" style={{fontSize:42, color:'var(--text3)', opacity:.4}}>workspace_premium</span></div><div className="empty-state-title">No CTEVT affiliations</div></div>
            : institute.affiliation.map(aff=>(
              <div key={aff.id} className="fy-group" style={{marginBottom:8}}>
                <button className="fy-header" onClick={()=>toggleFY('aff-'+aff.id)}>
                  <span><span className="material-icons-round" style={{fontSize:16, verticalAlign:'middle'}}>{expandedFY['aff-'+aff.id] ? 'expand_more' : 'chevron_right'}</span></span>
                  <span>{aff.type}</span>
                  {(aff.chalaniNo || aff.patraNo) && (
                    <span style={{fontSize:11, color:'var(--text3)', fontFamily:'var(--font-mono)'}}>
                      Aff. No: {aff.chalaniNo || aff.patraNo}
                    </span>
                  )}
                  <span style={{fontSize:12, color:'var(--text3)', marginLeft:8}}>{aff.affiliationDate} → {aff.expiryDate}</span>
                  <span className={`badge ${aff.status==='Active'?'badge-active':aff.status==='Expired'?'badge-expired':'badge-pending'}`} style={{marginLeft:'auto'}}>{aff.status}</span>
                  <span className="badge badge-gray" style={{marginLeft:8}}>{aff.programs.length} programs</span>
                  {canEdit && <Btn className="btn btn-ghost btn-sm" style={{marginLeft:8}} onClick={e=>{e.stopPropagation();setModal({type:'editAffiliation',data:aff});}}><span className="material-icons-round" style={{fontSize:14}}>edit</span></Btn>}
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
              <Btn className="btn btn-ghost btn-sm" onClick={()=>setModal(null)}><span className="material-icons-round" style={{fontSize:16}}>close</span></Btn>
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
      {modal?.type === 'bolpatraGaps' && (
        <BolpatraGapsModal exp={modal.data} institute={institute} clients={clients}
          onSave={async (updated) => { await saveExperience(updated); }}
          onClose={()=>setModal(null)}/>
      )}
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
            ? <div className="empty-state"><div className="empty-state-icon"><span className="material-icons-round" style={{fontSize:42, color:'var(--text3)', opacity:.4}}>handshake</span></div><div className="empty-state-title">No clients yet</div><div className="empty-state-sub">Clients appear here once experience assignments are added.</div></div>
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

export default InstituteDetail;

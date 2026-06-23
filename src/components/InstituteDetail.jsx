import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import Modal from './ui/Modal.jsx';
import { ErrorBanner } from './ui/Modal.jsx';
import SearchableSelect from './ui/SearchableSelect.jsx';
import StatusBadge from './ui/StatusBadge.jsx';
import Pagination from './ui/Pagination.jsx';
import InstituteForm from './InstituteForm.jsx';
import ExperienceForm from './ExperienceForm.jsx';
import { NSTBEditModal, NSTBBulkPage } from './NSTBForms.jsx';
import NSTBForm from './NSTBForms.jsx';
import TaxForm from './TaxForm.jsx';
import AffiliationForm from './AffiliationForm.jsx';
import ExpCard from './ExpCard.jsx';
import ClientDocuments from './ClientDocuments.jsx';
import { FISCAL_YEARS, NSTB_LEVELS, OCCUPATIONS } from '../constants/data.js';
import { api, instToAPI, expToAPI, nstbToAPI, taxToAPI, affToAPI, clientToAPI, normClient } from '../utils/api.js';
import { DESCRIPTION_VARIATIONS } from '../utils/descriptionTemplates.js';
import { NARRATIVE_VARIATIONS, SERVICES_VARIATIONS } from '../utils/specificTemplates.js';
import { getSession } from '../utils/auth.js';
import { usePagination } from '../utils/hooks.js';
import { exportSummaryToMD, exportSummaryToPDF, exportSummaryToCSV } from '../utils/export.js';

const fmt = (n) => n ? Number(n).toLocaleString('en-IN') : '—';
const pct = (n, d) => d > 0 ? ((n/d)*100).toFixed(1) + '%' : '—';
const uid = () => Math.random().toString(36).slice(2,9);
const fyToAD = (fy) => {
  if (!fy) return '';
  const parts = fy.split('/');
  if (parts.length !== 2) return '';
  const y1 = parseInt(parts[0]);
  if (isNaN(y1)) return '';
  return `${y1-57}/${String(y1-57+1).slice(-2)}`;
};

function getClient(clients, id) {
  return clients.find(c => c.id === id) || {};
}

function getOccupation(id) {
  const rawId = typeof id === 'string' && id.startsWith('c:') ? parseInt(id.slice(2)) : id;
  return OCCUPATIONS.find(o => o.id === rawId) || {};
}

const useMemo2 = useMemo;

function InstituteDetail({institute, clients, onUpdateClients, onBack, onUpdate, onRefresh, onDelete, token, isAdmin, isEditor, jumpToTab, onBulkAdd, onAddNSTB}) {
  const [tab, setTab] = useState(jumpToTab || 'profile');
  const [modal, setModal] = useState(null);
  const [saving, setSaving] = useState(false);
  // Writers (admin + editor) can add/edit; viewers are read-only.
  const canEdit = !!(isAdmin || isEditor);

  useEffect(() => { if(jumpToTab) setTab(jumpToTab); }, [jumpToTab]);

  // Unique clients for this institute derived from experience
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

  const tabs = [
    {id:'profile', label:'Profile'},
    {id:'experience', label:`Experience (${institute.experience.length})`},
    {id:'clients', label:`Clients (${instituteClients.length})`},
    {id:'nstb', label:`NSTB (${institute.nstb.length})`},
    {id:'tax', label:`Tax Clearance (${institute.taxClearance.length})`},
    {id:'affiliation', label:`CTEVT Affiliation (${institute.affiliation.length})`},
  ];

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

  const saveExperience = withSave(async (form) => {
    if(!form.manualClient && !form.clientId) throw new Error('Please select a client or use manual entry.');
    if(form.manualClient && !form.clientName?.trim()) throw new Error('Please enter a client name.');
    if(!form.assignmentName.trim()) throw new Error('Assignment name is required.');
    if(form.id) {
      await api('PUT', `/assignments/${form.id}`, expToAPI(form, institute.id), token);
    } else {
      await api('POST', '/assignments', expToAPI(form, institute.id), token);
    }
    await onRefresh(institute.id);
    setModal(null);
  });

  const deleteExperience = withSave(async (id) => {
    if(!window.confirm('Delete this assignment? This cannot be undone.')) return;
    await api('DELETE', `/assignments/${id}`, null, token);
    await onRefresh(institute.id);
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

  const deleteNSTB = withSave(async (id) => {
    if(!window.confirm('Delete this NSTB record?')) return;
    await api('DELETE', `/nstb/${id}`, null, token);
    await onRefresh(institute.id);
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

  const deleteTax = withSave(async (id) => {
    if(!window.confirm('Delete this tax clearance record?')) return;
    await api('DELETE', `/tax/${id}`, null, token);
    await onRefresh(institute.id);
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

  const deleteAffiliation = withSave(async (id) => {
    if(!window.confirm('Delete this affiliation record?')) return;
    await api('DELETE', `/affiliations/${id}`, null, token);
    await onRefresh(institute.id);
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
  const [expViewMode, setExpViewMode] = useState('fy'); // 'fy' | 'client'

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
      <div style={{display:'flex', alignItems:'center', gap:12, marginBottom:20}}>
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← Back</button>
        <div style={{flex:1}}>
          <div style={{display:'flex', alignItems:'center', gap:10}}>
            {institute.logo && <img src={institute.logo} alt="" style={{width:40, height:40, objectFit:'contain', borderRadius:6, border:'1px solid var(--border)', background:'#fff', padding:3}}/>}
            <h2 style={{fontSize:18, fontWeight:600}}>{institute.name}</h2>
            {institute.acronym && <span className="badge badge-purple" style={{fontSize:12, fontFamily:'var(--font-mono)'}}>{institute.acronym}</span>}
            <StatusBadge status={institute.status}/>
            {!canEdit && <span className="badge badge-gray" title="Your role does not have edit permission" style={{fontSize:10}}>👁 Read-only</span>}
          </div>
          <div style={{fontSize:12, color:'var(--text3)', marginTop:2}}>
            Reg: {institute.regNo} &nbsp;·&nbsp; PAN: {institute.pan}
          </div>
        </div>
        {canEdit && <button className="btn btn-secondary btn-sm" onClick={()=>setModal({type:'editInstitute'})}>✏ Edit profile</button>}
        {isAdmin && <button className="btn btn-danger btn-sm" onClick={()=>setModal({type:'deleteInstitute'})}>🗑 Delete</button>}
      </div>

      {/* Tabs */}
      <div className="tabs">
        {tabs.map(t=><button key={t.id} className={`tab ${tab===t.id?'active':''}`} onClick={()=>setTab(t.id)}>{t.label}</button>)}
      </div>
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

        {/* Superadmin: description template assignment — hidden until PPMO format is finalized */}
        {false && getSession()?.role === 'superadmin' && (
          <div className="card" style={{marginTop:16}}>
            <div className="section-title">✨ Auto-fill templates (superadmin)</div>
            <div style={{fontSize:13, color:'var(--text3)', marginBottom:14}}>
              Assign variation templates for this firm. The matching ✨ Auto-fill button appears in the assignment form when adding or editing assignments.
            </div>
            {[
              { label: '3(A) Description of work carried out', key: 'descTemplateId', apiKey: 'desc_template_id', variations: DESCRIPTION_VARIATIONS },
              { label: '3(B) Narrative description of project', key: 'narrativeTemplateId', apiKey: 'narrative_template_id', variations: NARRATIVE_VARIATIONS },
              { label: '3(B) Description of actual services provided', key: 'servicesTemplateId', apiKey: 'services_template_id', variations: SERVICES_VARIATIONS },
            ].map(slot => (
              <div key={slot.key} style={{marginBottom:16, paddingBottom:16, borderBottom:'1px solid var(--border)'}}>
                <div style={{fontSize:12, fontWeight:600, color:'var(--text2)', marginBottom:6}}>{slot.label}</div>
                <div style={{display:'flex', gap:10, alignItems:'flex-start', flexWrap:'wrap'}}>
                  <select className="form-input" style={{maxWidth:360}}
                    value={institute[slot.key] || ''}
                    onChange={async e => {
                      const val = e.target.value;
                      try {
                        const updated = {...institute, [slot.key]: val};
                        await api('PUT', `/institutes/${institute.id}`, instToAPI(updated), token);
                        if (onUpdate) onUpdate(updated);
                      } catch(err) { alert('Failed to save: ' + err.message); }
                    }}>
                    <option value="">— No template —</option>
                    {slot.variations.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
                  </select>
                  {institute[slot.key] && (
                    <div style={{fontSize:11, color:'var(--text2)', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'6px 10px', maxWidth:460, fontStyle:'italic', whiteSpace:'pre-wrap', lineHeight:1.5}}>
                      {slot.variations.find(v => v.id === institute[slot.key])?.preview?.slice(0, 200)}{slot.variations.find(v => v.id === institute[slot.key])?.preview?.length > 200 ? '…' : ''}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
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
            </div>
            {canEdit && <div style={{display:'flex', gap:6}}>
              <button className="btn btn-secondary btn-sm" onClick={onBulkAdd}>⊞ Bulk add</button>
              <button className="btn btn-primary btn-sm" onClick={()=>setModal({type:'addExp'})}>+ Add assignment</button>
            </div>}
          </div>

          {institute.experience.length > 0 && (() => {
            const exps = institute.experience;
            const totalAssignments = exps.length;
            const totalTrained = exps.reduce((s,e)=>s+e.occupations.reduce((ss,o)=>ss+(parseInt(o.trainees)||0),0),0);
            const totalDistricts = new Set(exps.flatMap(e=>e.occupations.flatMap(o=>(o.locations||[]).map(l=>l.district).filter(Boolean)))).size;
            const uniqueClients = new Set(exps.map(e=>e.clientId||('m:'+e.clientName)).filter(Boolean)).size;
            const statStyle = {textAlign:'center', flex:1};
            const numStyle = {fontWeight:700, fontSize:20, fontFamily:'var(--font-mono)', color:'var(--accent)'};
            const lblStyle = {fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.5px', marginTop:2};
            return (
              <div style={{display:'flex', gap:0, background:'var(--bg2)', borderRadius:8, border:'1px solid var(--border)', marginBottom:12, padding:'10px 0'}}>
                {[['Clients', uniqueClients, 'var(--blue)'],['Assignments', totalAssignments,'var(--accent)'],['Trainees trained', totalTrained.toLocaleString(),'var(--accent)'],['Districts', totalDistricts,'var(--purple)']].map(([lbl,val,col],i,arr)=>(
                  <React.Fragment key={lbl}>
                    <div style={statStyle}>
                      <div style={{...numStyle,color:col}}>{val}</div>
                      <div style={lblStyle}>{lbl}</div>
                    </div>
                    {i<arr.length-1 && <div style={{width:1,background:'var(--border)',margin:'0 4px'}}/>}
                  </React.Fragment>
                ))}
              </div>
            );
          })()}
          {institute.experience.length === 0
            ? <div className="empty-state"><div className="empty-state-icon">📋</div><div className="empty-state-title">No assignments yet</div><div className="empty-state-sub">Add the first experience / assignment record</div></div>
            : expViewMode === 'fy'
              ? groupByFY(institute.experience.filter(e=>!expClientFilter || String(e.clientId)===String(expClientFilter))).map(([fy, items]) => (
                <div key={fy} className="fy-group">
                  <button className="fy-header" onClick={()=>toggleFY('exp-'+fy)}>
                    <span>{expandedFY['exp-'+fy] ? '▼' : '▶'}</span>
                    <span>FY {fy}{fyToAD(fy) ? <span style={{color:'var(--text3)',fontWeight:400,fontSize:'0.88em'}}> ({fyToAD(fy)})</span> : ''}</span>
                    <span className="badge badge-info" style={{marginLeft:'auto'}}>{items.length} assignment{items.length>1?'s':''}</span>
                  </button>
                  {expandedFY['exp-'+fy] && (
                    <div className="fy-body">
                      {items.map(exp => <ExpCard key={exp.id} exp={exp} clients={clients} showFY={false} setModal={setModal} deleteExperience={deleteExperience} canEdit={canEdit} isAdmin={isAdmin}/>)}
                    </div>
                  )}
                </div>
              ))
              : (() => {
                  // Group by client
                  const clientMap = new Map();
                  institute.experience.forEach(exp => {
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
                            {exps.sort((a,b)=>a.fy.localeCompare(b.fy)).map(exp => <ExpCard key={exp.id} exp={exp} clients={clients} showFY={true} setModal={setModal} deleteExperience={deleteExperience} canEdit={canEdit} isAdmin={isAdmin}/>)}
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
            <button className="btn btn-primary btn-sm" onClick={onAddNSTB}>+ Add NSTB records</button>
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
                {[['Applied', totA,'var(--accent)'],['Appeared', totAp,'var(--blue)'],['Pass', totP,'var(--green,#22c55e)'],['Pass rate', passRate,'var(--purple)']].map(([lbl,val,col],i,arr)=>(
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
                              {canEdit && <button className="btn btn-ghost btn-sm" onClick={()=>setModal({type:'editNSTB', data:r})}>✏</button>}
                              {isAdmin && <button className="btn btn-danger btn-sm" onClick={()=>deleteNSTB(r.id)}>🗑</button>}
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
            {canEdit && <button className="btn btn-primary btn-sm" onClick={()=>setModal({type:'addTax'})}>+ Add tax clearance</button>}
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
                          {canEdit && <button className="btn btn-ghost btn-sm" onClick={()=>setModal({type:'editTax', data:t})}>✏</button>}
                          {isAdmin && <button className="btn btn-danger btn-sm" onClick={()=>deleteTax(t.id)}>🗑</button>}
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
            {canEdit && <button className="btn btn-primary btn-sm" onClick={()=>setModal({type:'addAffiliation'})}>+ Add affiliation</button>}
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
                  {canEdit && <button className="btn btn-ghost btn-sm" style={{marginLeft:8}} onClick={e=>{e.stopPropagation();setModal({type:'editAffiliation',data:aff});}}>✏</button>}
                  {isAdmin && <button className="btn btn-danger btn-sm" style={{marginLeft:4}} onClick={e=>{e.stopPropagation();deleteAffiliation(aff.id);}}>🗑</button>}
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

      {/* Modals */}
      {modal?.type === 'editInstitute' && <InstituteForm institute={institute} onSave={saveProfile} onClose={()=>setModal(null)}/>}
      {modal?.type === 'deleteInstitute' && ReactDOM.createPortal(
        <div className="modal-overlay" onClick={()=>setModal(null)}>
          <div className="modal" style={{maxWidth:420}} onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Delete institute</span>
              <button className="btn btn-ghost btn-sm" onClick={()=>setModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{fontSize:14,color:'var(--text2)',marginBottom:8}}>
                Are you sure you want to permanently delete <strong>{institute.name}</strong>?
              </p>
              <p style={{fontSize:13,color:'var(--red)'}}>This will delete all experience, NSTB, tax, and affiliation records. This cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={()=>setModal(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={saving} onClick={async()=>{
                setSaving(true); setSaveErr('');
                try { await api('DELETE', `/institutes/${institute.id}`, null, token); onDelete(institute.id); }
                catch(err) { setSaveErr(err.message); setSaving(false); }
              }}>{saving ? 'Deleting…' : 'Delete permanently'}</button>
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
            <button className="btn btn-secondary" onClick={()=>setModal(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={()=>{
              const fy = document.getElementById('dupFYSelect').value;
              saveExperience({...modal.data, id:undefined, fy});
            }}>Duplicate</button>
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
        const totalTrainees = exp.occupations.reduce((s,o)=>s+(parseInt(o.trainees)||0),0);
        const totalSTA = exp.occupations.reduce((s,o)=>s+(parseInt(o.skillTestAppeared)||0),0);
        const totalSTP = exp.occupations.reduce((s,o)=>s+(parseInt(o.skillTestPass)||0),0);
        const passRate = totalSTA > 0 ? Math.round(totalSTP/totalSTA*100) : null;
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
                {/* KPI strip */}
                <div style={{display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:24}}>
                  {[
                    {label:'Total Trainees', value:totalTrainees.toLocaleString(), icon:'groups', color:'var(--primary)', bg:'var(--primary-light)'},
                    {label:'ST Appeared', value:totalSTA||'—', icon:'quiz', color:'var(--warning)', bg:'var(--warning-light)'},
                    {label:'Pass Rate', value:passRate!==null?`${passRate}%`:'—', icon:'verified', color:passRate>=70?'var(--success)':'var(--error)', bg:passRate>=70?'var(--success-light)':'var(--error-light)'},
                    {label:'Contract Value', value:exp.contractValue?`NPR ${parseInt(exp.contractValue).toLocaleString()}`:'—', icon:'payments', color:'var(--purple)', bg:'var(--purple-light)'},
                  ].map(k=>(
                    <div key={k.label} style={{background:'var(--bg)', borderRadius:10, padding:'14px 16px', border:'1px solid var(--border)'}}>
                      <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:8}}>
                        <div style={{width:32, height:32, borderRadius:8, background:k.bg, display:'flex', alignItems:'center', justifyContent:'center'}}>
                          <span className="material-icons-round" style={{fontSize:16, color:k.color}}>{k.icon}</span>
                        </div>
                      </div>
                      <div style={{fontSize:20, fontWeight:800, color:'var(--text)', lineHeight:1}}>{k.value}</div>
                      <div style={{fontSize:11, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.6px', marginTop:4, fontWeight:600}}>{k.label}</div>
                    </div>
                  ))}
                </div>

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
                              {occ.employmentProvisioned && <span style={{fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:8, background:'color-mix(in srgb, var(--green,#22c55e) 15%, transparent)', color:'var(--green,#22c55e)', display:'inline-block'}}>Employment</span>}
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
                              <div style={{fontWeight:700, fontSize:15, color:'var(--green,#22c55e)'}}>{parseFloat(occ.employmentActual)||0}%</div>
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
                        <span style={{fontSize:28}}>📄</span>
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
                  {canEdit && <button className="btn btn-secondary btn-sm" onClick={()=>setModal({type:'editExp', data:exp})}>
                    <span className="material-icons-round" style={{fontSize:14}}>edit</span> Edit
                  </button>}
                  <button className="btn btn-primary btn-sm" onClick={()=>setModal(null)}>Close</button>
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
export default InstituteDetail;

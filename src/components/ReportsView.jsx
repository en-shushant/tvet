import { useState, useEffect, useMemo } from 'react';
import { getSession } from '../utils/auth.js';
import { api, normInst } from '../utils/api.js';
import { exportToCSV } from '../utils/export.js';

const getClient = (clients, id) => (clients || []).find(c => c.id === id) || {};
const fmt = (n) => n ? Number(n).toLocaleString('en-IN') : '—';

const fyToYear = (fy) => {
  if (!fy) return '';
  const parts = fy.split('/');
  const y1 = parseInt(parts[0]);
  if (isNaN(y1)) return fy;
  return String(y1 - 57); // BS -> AD approx start year
};

const monthsBetween = (start, end) => {
  if (!start || !end) return '';
  const s = new Date(start), e = new Date(end);
  if (isNaN(s) || isNaN(e)) return '';
  const months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
  return months > 0 ? months : '';
};

const districtsOf = (exp) => {
  const all = (exp.occupations || []).flatMap(o => o.locations || []);
  return [...new Set(all.map(l => l.district).filter(Boolean))];
};

const REPORT_TYPES = [
  { id: '3a', label: '3(A) General Work Experience' },
  { id: '3b', label: '3(B) Specific Experience' },
  { id: '3c', label: '3(C) Geographic Experience' },
];

// Fields each report needs, used to flag assignments with missing data
const REQUIRED_FIELDS = {
  '3a': [['assignmentName','Name of assignment'], ['contractValue','Value of contract'], ['descriptionOfWork','Description of work']],
  '3b': [['descriptionOfWork','—'], ['durationMonths','Duration (months)'], ['totalPersonMonths','Total person-months'], ['narrativeDescription','Narrative description'], ['actualServicesDescription','Description of actual services']],
  '3c': [['country','Country/Region']],
};

function ReportsView({ institutes, clients, onOpenAssignment }) {
  const [selectedInst, setSelectedInst] = useState('');
  const [fullInst, setFullInst] = useState(null);
  const [loadingInst, setLoadingInst] = useState(false);
  const [reportType, setReportType] = useState('3a');
  const [selectedIds, setSelectedIds] = useState(null); // null = all

  useEffect(() => {
    if (!selectedInst) { setFullInst(null); return; }
    setLoadingInst(true);
    api('GET', `/institutes/${selectedInst}`, null, getSession()?.token)
      .then(data => { setFullInst(normInst(data)); setLoadingInst(false); setSelectedIds(null); })
      .catch(() => setLoadingInst(false));
  }, [selectedInst]);

  const experience = fullInst?.experience || [];
  const activeExps = useMemo(() => {
    if (selectedIds === null) return experience;
    return experience.filter(e => selectedIds.includes(e.id));
  }, [experience, selectedIds]);

  const toggleSelected = (id) => {
    setSelectedIds(prev => {
      const base = prev === null ? experience.map(e=>e.id) : prev;
      return base.includes(id) ? base.filter(x=>x!==id) : [...base, id];
    });
  };

  const missingFor = (exp) => REQUIRED_FIELDS[reportType].filter(([key]) => !exp[key] && key !== '—').map(([,label])=>label);

  const handlePrint = () => {
    const w = window.open('', '_blank');
    w.document.write(buildReportHTML(fullInst, activeExps, clients, reportType));
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  const handleCSV = () => {
    const rows = activeExps.map((exp, i) => buildCSVRow(exp, clients, reportType, i));
    exportToCSV(rows, `EOI_${REPORT_TYPES.find(r=>r.id===reportType).label.replace(/[^\w]+/g,'_')}_${fullInst?.acronym || fullInst?.name || 'report'}.csv`);
  };

  return (
    <div className="fade-in" style={{display:'flex', gap:20, alignItems:'flex-start'}}>
      {/* Filter panel */}
      <div className="filter-panel">
        <div className="filter-panel-header">
          <span style={{fontSize:14}}>📊</span>
          <span className="filter-panel-header-title">Reports</span>
        </div>
        <div className="filter-panel-body">
          <div className="filter-section">
            <div className="filter-label">Institute / Firm</div>
            <select className="form-input" value={selectedInst} onChange={e=>setSelectedInst(e.target.value)}>
              <option value="">— Select institute —</option>
              {institutes.map(i => <option key={i.id} value={i.id}>{i.name}{i.acronym ? ` (${i.acronym})` : ''}</option>)}
            </select>
          </div>
          <div className="filter-section">
            <div className="filter-label">Report type</div>
            {REPORT_TYPES.map(rt => (
              <label key={rt.id} className="multi-select-item">
                <input type="radio" name="report-type" checked={reportType===rt.id} onChange={()=>setReportType(rt.id)}/>
                {rt.label}
              </label>
            ))}
          </div>
          {fullInst && (
            <div className="filter-section">
              <div className="filter-label">Assignments ({activeExps.length}/{experience.length})</div>
              <div className="multi-select-list" style={{maxHeight:220, overflowY:'auto'}}>
                {experience.map(exp => (
                  <label key={exp.id} className="multi-select-item">
                    <input type="checkbox"
                      checked={selectedIds === null || selectedIds.includes(exp.id)}
                      onChange={()=>toggleSelected(exp.id)}/>
                    <span style={{fontSize:11.5, lineHeight:1.3}}>{exp.assignmentName || '(unnamed)'} <span style={{color:'var(--text3)'}}>· FY {exp.fy}</span></span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <div style={{flex:1, minWidth:0}}>
        {!selectedInst ? (
          <div className="empty-state" style={{background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)'}}>
            <div className="empty-state-icon">📊</div>
            <div className="empty-state-title">Select an institute</div>
            <div className="empty-state-sub">Choose a firm and a report type (3A / 3B / 3C) to generate an EOI-format report</div>
          </div>
        ) : loadingInst ? (
          <div className="empty-state" style={{background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)'}}>
            <div className="empty-state-icon">⏳</div>
            <div className="empty-state-title">Loading…</div>
          </div>
        ) : (
          <div className="card" style={{padding:0, overflow:'hidden'}}>
            <div style={{padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10}}>
              <span style={{fontWeight:600, fontSize:14}}>{REPORT_TYPES.find(r=>r.id===reportType).label}</span>
              <span style={{fontSize:12, color:'var(--text3)'}}>{activeExps.length} assignment{activeExps.length!==1?'s':''}</span>
              <div style={{marginLeft:'auto', display:'flex', gap:8}}>
                <button className="btn btn-secondary btn-sm" onClick={handleCSV} disabled={!activeExps.length}>⬇ CSV</button>
                <button className="btn btn-primary btn-sm" onClick={handlePrint} disabled={!activeExps.length}>🖨 Print / PDF</button>
              </div>
            </div>

            {activeExps.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🔍</div>
                <div className="empty-state-title">No assignments selected</div>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="summary-table">
                  <thead>
                    <tr>{reportColumns(reportType).map(c => <th key={c}>{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {activeExps.map((exp, i) => {
                      const missing = missingFor(exp);
                      return (
                        <tr key={exp.id}>
                          {renderRowCells(exp, clients, reportType, i)}
                          <td style={{fontSize:11}}>
                            {missing.length > 0 ? (
                              <span style={{color:'var(--orange,#f59e0b)', cursor: onOpenAssignment ? 'pointer':'default', textDecoration: onOpenAssignment ? 'underline':'none'}}
                                onClick={()=>onOpenAssignment && onOpenAssignment(exp)}
                                title={`Missing: ${missing.join(', ')}`}>
                                ⚠ Missing {missing.length} field{missing.length!==1?'s':''}
                              </span>
                            ) : <span style={{color:'var(--green,#22c55e)'}}>✓ Complete</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function reportColumns(type) {
  if (type === '3a') return ['S.N.', 'Name of assignment', 'Location', 'Value of contract', 'Year completed', 'Client', 'Description of work carried out', 'Status'];
  if (type === '3b') return ['Assignment / Client', 'Country & location', 'Contract value', 'Start – completion', 'Duration (months)', 'Person-months (total / JV)', 'JV partners', 'Narrative & services', 'Status'];
  return ['No.', 'Name of project', 'Location (country/region)', 'Execution year & duration', 'Status'];
}

function renderRowCells(exp, clients, type, i) {
  const client = getClient(clients, exp.clientId);
  const clientName = client.fullName || exp.clientName || '—';
  const districts = districtsOf(exp);
  const location = districts.length ? districts.join(', ') : '—';
  const yearCompleted = exp.endFY || exp.fy || '—';

  if (type === '3a') {
    return <>
      <td>{i+1}</td>
      <td style={{fontWeight:600}}>{exp.assignmentName || '—'}</td>
      <td style={{fontSize:12}}>{location}</td>
      <td className="mono">{exp.contractValue ? `NPR ${fmt(exp.contractValue)}` : '—'}</td>
      <td>{yearCompleted}</td>
      <td>{clientName}</td>
      <td style={{fontSize:12, maxWidth:260}}>{exp.descriptionOfWork || '—'}</td>
    </>;
  }
  if (type === '3b') {
    return <>
      <td><div style={{fontWeight:600}}>{exp.assignmentName || '—'}</div><div style={{fontSize:11, color:'var(--text3)'}}>{clientName}</div></td>
      <td style={{fontSize:12}}>{exp.country || 'Nepal'}<div style={{color:'var(--text3)'}}>{location}</div></td>
      <td className="mono">{exp.contractValue ? `NPR ${fmt(exp.contractValue)}` : '—'}{exp.ownServiceValue ? <div style={{fontSize:10,color:'var(--text3)'}}>own: NPR {fmt(exp.ownServiceValue)}</div> : null}</td>
      <td style={{fontSize:12}}>{exp.startDate||'—'} – {exp.endDate||'—'}</td>
      <td>{exp.durationMonths || monthsBetween(exp.startDate, exp.endDate) || '—'}</td>
      <td style={{fontSize:12}}>{exp.totalPersonMonths || '—'} / {exp.jvPartnerPersonMonths || '—'}</td>
      <td style={{fontSize:12}}>{exp.isJV ? (exp.jvPartnerNames || `${exp.jvRole}`) : '—'}</td>
      <td style={{fontSize:11, maxWidth:220}}>{exp.narrativeDescription || exp.actualServicesDescription || '—'}</td>
    </>;
  }
  return <>
    <td>{i+1}</td>
    <td style={{fontWeight:600}}>{exp.assignmentName || '—'}</td>
    <td style={{fontSize:12}}>{exp.country || 'Nepal'}{location !== '—' ? ` — ${location}` : ''}</td>
    <td style={{fontSize:12}}>{exp.fy}{exp.endFY && exp.endFY !== exp.fy ? `–${exp.endFY}` : ''}{exp.durationMonths ? ` (${exp.durationMonths} mo)` : ''}</td>
  </>;
}

function buildCSVRow(exp, clients, type, i) {
  const client = getClient(clients, exp.clientId);
  const clientName = client.fullName || exp.clientName || '';
  const districts = districtsOf(exp).join(', ');
  if (type === '3a') {
    return { 'S.N.': i+1, 'Name of assignment': exp.assignmentName||'', 'Location': districts, 'Value of contract': exp.contractValue||'', 'Year completed': exp.endFY||exp.fy||'', 'Client': clientName, 'Description of work carried out': exp.descriptionOfWork||'' };
  }
  if (type === '3b') {
    return {
      'Assignment name': exp.assignmentName||'', 'Approx contract value': exp.contractValue||'',
      'Country': exp.country||'Nepal', 'Location within country': districts,
      'Name of client': clientName, 'Address': client.address||'',
      'Start date': exp.startDate||'', 'Completion date': exp.endDate||'',
      'Duration (months)': exp.durationMonths || monthsBetween(exp.startDate, exp.endDate) || '',
      'Total person-months': exp.totalPersonMonths||'',
      'Approx value of services by firm': exp.ownServiceValue||'',
      'JV partner / sub-consultant names': exp.jvPartnerNames||'',
      'Person-months by JV partners': exp.jvPartnerPersonMonths||'',
      'Narrative description of project': exp.narrativeDescription||'',
      'Description of actual services provided': exp.actualServicesDescription||'',
    };
  }
  return { 'No.': i+1, 'Name of project': exp.assignmentName||'', 'Location (country/region)': `${exp.country||'Nepal'}${districts?` — ${districts}`:''}`, 'Execution year and duration': `${exp.fy}${exp.endFY && exp.endFY!==exp.fy?`–${exp.endFY}`:''}${exp.durationMonths?` (${exp.durationMonths} months)`:''}` };
}

function buildReportHTML(inst, exps, clients, type) {
  const cols = reportColumns(type).slice(0, -1); // drop Status col for print
  const rowsHtml = exps.map((exp, i) => `<tr>${cellsToHTML(exp, clients, type, i)}</tr>`).join('');
  const title = REPORT_TYPES.find(r=>r.id===type).label;
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title} — ${inst?.name||''}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:11px;color:#111;margin:24px}
    h1{font-size:16px;margin-bottom:2px}
    h2{font-size:13px;margin-top:0;color:#444}
    .meta{color:#555;font-size:11px;margin-bottom:14px}
    table{border-collapse:collapse;width:100%}
    th{background:#1e293b;color:#fff;padding:6px 8px;text-align:left;font-size:10.5px}
    td{padding:6px 8px;border-bottom:1px solid #e2e8f0;vertical-align:top}
    tr:nth-child(even) td{background:#f8fafc}
    @media print{body{margin:0}}
  </style></head><body>
  <h1>${title}</h1>
  <h2>${inst?.name || ''}${inst?.acronym?` (${inst.acronym})`:''}</h2>
  <div class="meta">Generated: ${new Date().toLocaleDateString('en-NP')} · ${exps.length} assignment(s)</div>
  <table><thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${rowsHtml}</tbody></table>
  <div style="margin-top:18px;color:#888;font-size:10px">Generated by TVETtrack — Nepal TVET Registry</div>
  </body></html>`;
}

function cellsToHTML(exp, clients, type, i) {
  const client = getClient(clients, exp.clientId);
  const clientName = client.fullName || exp.clientName || '—';
  const districts = districtsOf(exp).join(', ') || '—';
  if (type === '3a') {
    return `<td>${i+1}</td><td><strong>${esc(exp.assignmentName)||'—'}</strong></td><td>${esc(districts)}</td>
      <td>${exp.contractValue?`NPR ${fmt(exp.contractValue)}`:'—'}</td><td>${esc(exp.endFY||exp.fy)||'—'}</td>
      <td>${esc(clientName)}</td><td>${esc(exp.descriptionOfWork)||'—'}</td>`;
  }
  if (type === '3b') {
    return `<td><strong>${esc(exp.assignmentName)||'—'}</strong><br><small>${esc(clientName)}</small></td>
      <td>${esc(exp.country||'Nepal')}<br><small>${esc(districts)}</small></td>
      <td>${exp.contractValue?`NPR ${fmt(exp.contractValue)}`:'—'}</td>
      <td>${esc(exp.startDate)||'—'} – ${esc(exp.endDate)||'—'}</td>
      <td>${exp.durationMonths || monthsBetween(exp.startDate, exp.endDate) || '—'}</td>
      <td>${exp.totalPersonMonths||'—'} / ${exp.jvPartnerPersonMonths||'—'}</td>
      <td>${exp.isJV ? esc(exp.jvPartnerNames||exp.jvRole) : '—'}</td>
      <td>${esc(exp.narrativeDescription)||esc(exp.actualServicesDescription)||'—'}</td>`;
  }
  return `<td>${i+1}</td><td><strong>${esc(exp.assignmentName)||'—'}</strong></td>
    <td>${esc(exp.country||'Nepal')}${districts!=='—'?` — ${esc(districts)}`:''}</td>
    <td>${esc(exp.fy)}${exp.endFY && exp.endFY!==exp.fy?`–${esc(exp.endFY)}`:''}${exp.durationMonths?` (${exp.durationMonths} months)`:''}</td>`;
}

function esc(s) { return s ? String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])) : ''; }

export default ReportsView;

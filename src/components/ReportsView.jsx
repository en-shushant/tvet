import { useState, useEffect, useMemo } from 'react';
import { getSession } from '../utils/auth.js';
import { api, normInst } from '../utils/api.js';
import { exportToCSV } from '../utils/export.js';
import { fyInRange } from '../reports/helpers.js';
import REPORT_FAMILIES from '../reports/index.js';

function ReportsView({ institutes, clients }) {
  const [familyId, setFamilyId]       = useState(REPORT_FAMILIES[0].id);
  const [selectedInst, setSelectedInst] = useState('');
  const [fullInst, setFullInst]         = useState(null);
  const [loadingInst, setLoadingInst]   = useState(false);
  const [reportId, setReportId]         = useState(REPORT_FAMILIES[0].reports[0].id);
  const [selectedIds, setSelectedIds]   = useState(null); // null = all
  const [fromFY, setFromFY]             = useState('');
  const [toFY, setToFY]                 = useState('');

  const family = REPORT_FAMILIES.find(f => f.id === familyId) || REPORT_FAMILIES[0];
  const report = family.reports.find(r => r.id === reportId) || family.reports[0];

  // When family changes, reset report type to first in that family
  useEffect(() => {
    setReportId(family.reports[0].id);
  }, [familyId]);

  useEffect(() => {
    if (!selectedInst) { setFullInst(null); return; }
    setLoadingInst(true);
    setSelectedIds(null);
    setFromFY('');
    setToFY('');
    api('GET', `/institutes/${selectedInst}`, null, getSession()?.token)
      .then(data => { setFullInst(normInst(data)); setLoadingInst(false); })
      .catch(() => setLoadingInst(false));
  }, [selectedInst]);

  const experience = fullInst?.experience || [];

  // Sorted unique FY values across all assignments for the range selects
  const allFYs = useMemo(() =>
    [...new Set(experience.map(e => e.fy).filter(Boolean))].sort(),
    [experience]
  );

  // Assignments visible in the checklist (FY range applied)
  const rangeFiltered = useMemo(() =>
    experience.filter(e => fyInRange(e.fy, fromFY, toFY)),
    [experience, fromFY, toFY]
  );

  // Final set for the report (FY range + manual checkbox selection)
  const activeExps = useMemo(() => {
    if (selectedIds === null) return rangeFiltered;
    return rangeFiltered.filter(e => selectedIds.includes(e.id));
  }, [rangeFiltered, selectedIds]);

  const toggleSelected = (id) => {
    setSelectedIds(prev => {
      const base = prev === null ? rangeFiltered.map(e => e.id) : prev;
      return base.includes(id) ? base.filter(x => x !== id) : [...base, id];
    });
  };

  const selectAll  = () => setSelectedIds(null);
  const clearAll   = () => setSelectedIds([]);

  const missingFor = (exp) =>
    report.requiredFields.filter(([key]) => !exp[key]).map(([, label]) => label);

  const fyRangeLabel = fromFY || toFY
    ? `FY ${fromFY || '…'} – ${toFY || '…'}`
    : null;

  const handlePrint = () => {
    const w = window.open('', '_blank');
    w.document.write(family.buildPrintHTML(fullInst, activeExps, clients, report.id, fyRangeLabel));
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  const handleCSV = () => {
    const rows = activeExps.map((exp, i) => family.buildCSVRow(exp, clients, report.id, i));
    const fname = `${family.id.toUpperCase()}_${report.label.replace(/[^\w]+/g, '_')}_${fullInst?.acronym || fullInst?.name || 'report'}${fyRangeLabel ? `_${fyRangeLabel.replace(/[^\w]+/g,'_')}` : ''}.csv`;
    exportToCSV(rows, fname);
  };

  return (
    <div className="fade-in" style={{display:'flex', flexDirection:'column', gap:14}}>

      {/* ── Top selector bar ── */}
      <div className="card" style={{padding:'14px 18px', display:'flex', alignItems:'center', gap:20, flexWrap:'wrap'}}>
        <div style={{display:'flex', alignItems:'center', gap:8}}>
          <span style={{fontSize:12, fontWeight:600, color:'var(--text3)', whiteSpace:'nowrap'}}>REPORT FAMILY</span>
          <select className="form-input" style={{width:'auto', minWidth:160}} value={familyId} onChange={e => setFamilyId(e.target.value)}>
            {REPORT_FAMILIES.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </div>
        <div style={{width:1, height:28, background:'var(--border)'}}/>
        <div style={{display:'flex', alignItems:'center', gap:8}}>
          <span style={{fontSize:12, fontWeight:600, color:'var(--text3)', whiteSpace:'nowrap'}}>REPORT TYPE</span>
          <select className="form-input" style={{width:'auto', minWidth:220}} value={reportId} onChange={e => setReportId(e.target.value)}>
            {family.reports.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div style={{display:'flex', gap:20, alignItems:'flex-start'}}>

      {/* ── Filter panel ── */}
      <div className="filter-panel">
        <div className="filter-panel-header">
          <span style={{fontSize:14}}>🔍</span>
          <span className="filter-panel-header-title">Filters</span>
        </div>
        <div className="filter-panel-body">

          {/* Institute */}
          <div className="filter-section">
            <div className="filter-label">Institute / Firm</div>
            <select className="form-input" value={selectedInst} onChange={e => setSelectedInst(e.target.value)}>
              <option value="">— Select institute —</option>
              {institutes.map(i => <option key={i.id} value={i.id}>{i.name}{i.acronym ? ` (${i.acronym})` : ''}</option>)}
            </select>
          </div>

          {/* FY range — only show once an institute is loaded */}
          {fullInst && allFYs.length > 0 && (
            <div className="filter-section">
              <div className="filter-label">Fiscal year range</div>
              <div style={{display:'flex', gap:6, alignItems:'center'}}>
                <select className="form-input" style={{flex:1}} value={fromFY} onChange={e => { setFromFY(e.target.value); setSelectedIds(null); }}>
                  <option value="">From</option>
                  {allFYs.map(fy => <option key={fy} value={fy}>{fy}</option>)}
                </select>
                <span style={{color:'var(--text3)', fontSize:12}}>→</span>
                <select className="form-input" style={{flex:1}} value={toFY} onChange={e => { setToFY(e.target.value); setSelectedIds(null); }}>
                  <option value="">To</option>
                  {allFYs.map(fy => <option key={fy} value={fy}>{fy}</option>)}
                </select>
              </div>
              {(fromFY || toFY) && (
                <button className="btn btn-ghost btn-sm" style={{marginTop:4, fontSize:11}}
                  onClick={() => { setFromFY(''); setToFY(''); setSelectedIds(null); }}>
                  ✕ Clear range
                </button>
              )}
            </div>
          )}

          {/* Assignment checklist */}
          {fullInst && (
            <div className="filter-section">
              <div className="filter-label" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <span>Assignments ({activeExps.length}/{rangeFiltered.length})</span>
                <span style={{display:'flex', gap:6}}>
                  <button className="btn btn-ghost btn-sm" style={{fontSize:10, padding:'1px 5px'}} onClick={selectAll}>All</button>
                  <button className="btn btn-ghost btn-sm" style={{fontSize:10, padding:'1px 5px'}} onClick={clearAll}>None</button>
                </span>
              </div>
              {rangeFiltered.length === 0 ? (
                <div style={{fontSize:12, color:'var(--text3)', padding:'6px 0'}}>No assignments in this FY range.</div>
              ) : (
                <div className="multi-select-list" style={{maxHeight:220, overflowY:'auto'}}>
                  {rangeFiltered.map(exp => (
                    <label key={exp.id} className="multi-select-item">
                      <input type="checkbox"
                        checked={selectedIds === null || selectedIds.includes(exp.id)}
                        onChange={() => toggleSelected(exp.id)}/>
                      <span style={{fontSize:11.5, lineHeight:1.3}}>
                        {exp.assignmentName || '(unnamed)'}
                        <span style={{color:'var(--text3)'}}> · FY {exp.fy}</span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Results ── */}
      <div style={{flex:1, minWidth:0}}>
        {!selectedInst ? (
          <div className="empty-state" style={{background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)'}}>
            <div className="empty-state-icon">📊</div>
            <div className="empty-state-title">Select an institute</div>
            <div className="empty-state-sub">Choose a firm and report type to generate an experience report</div>
          </div>
        ) : loadingInst ? (
          <div className="empty-state" style={{background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)'}}>
            <div className="empty-state-icon">⏳</div>
            <div className="empty-state-title">Loading…</div>
          </div>
        ) : (
          <div className="card" style={{padding:0, overflow:'hidden'}}>
            <div style={{padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap'}}>
              <div>
                <span style={{fontWeight:600, fontSize:14}}>{report.label}</span>
                {fyRangeLabel && <span style={{fontSize:11, color:'var(--primary)', background:'var(--primary-light,#eff6ff)', borderRadius:4, padding:'1px 7px', marginLeft:8}}>{fyRangeLabel}</span>}
              </div>
              <span style={{fontSize:12, color:'var(--text3)'}}>{activeExps.length} assignment{activeExps.length !== 1 ? 's' : ''}</span>
              <div style={{marginLeft:'auto', display:'flex', gap:8}}>
                <button className="btn btn-secondary btn-sm" onClick={handleCSV} disabled={!activeExps.length}>⬇ CSV</button>
                <button className="btn btn-primary btn-sm" onClick={handlePrint} disabled={!activeExps.length}>🖨 Print / PDF</button>
              </div>
            </div>

            {activeExps.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🔍</div>
                <div className="empty-state-title">{rangeFiltered.length === 0 ? 'No assignments in this FY range' : 'No assignments selected'}</div>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="summary-table">
                  <thead>
                    <tr>
                      {report.columns.map(c => <th key={c}>{c}</th>)}
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeExps.map((exp, i) => {
                      const missing = missingFor(exp);
                      return (
                        <tr key={exp.id}>
                          {family.renderRowCells(exp, clients, report.id, i)}
                          <td style={{fontSize:11}}>
                            {missing.length > 0
                              ? <span style={{color:'var(--orange,#f59e0b)'}} title={`Missing: ${missing.join(', ')}`}>⚠ {missing.length} field{missing.length !== 1 ? 's' : ''}</span>
                              : <span style={{color:'var(--green,#22c55e)'}}>✓</span>}
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
    </div>{/* end two-column */}
    </div>
  );
}

export default ReportsView;

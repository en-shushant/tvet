import { useState, useEffect, useMemo } from 'react';
import { getSession } from '../utils/auth.js';
import { api, normInst } from '../utils/api.js';
import { exportToCSV } from '../utils/export.js';
import { fyInRange } from '../reports/helpers.js';
import REPORT_FAMILIES from '../reports/index.js';

function ReportsView({ institutes, clients }) {
  const [familyId, setFamilyId]         = useState(REPORT_FAMILIES[0].id);
  const [selectedInst, setSelectedInst] = useState('');
  const [fullInst, setFullInst]         = useState(null);
  const [loadingInst, setLoadingInst]   = useState(false);
  const [reportId, setReportId]         = useState(REPORT_FAMILIES[0].reports[0].id);
  const [selectedIds, setSelectedIds]   = useState(null); // null = all
  const [fromFY, setFromFY]             = useState('');
  const [toFY, setToFY]                 = useState('');
  const [selectedOccs, setSelectedOccs] = useState([]); // for Table 3 occupation filter
  const [occupations, setOccupations]   = useState([]);
  const [sortBy, setSortBy]             = useState('default'); // for Table 2 occupation sort

  // Tools report state
  const [toolsOccIds, setToolsOccIds]       = useState([]);
  const [toolsLevel, setToolsLevel]         = useState('');
  const [toolsTypeFilter, setToolsTypeFilter] = useState('all');
  const [toolsColumns, setToolsColumns]     = useState(['sn','name','description','unit','quantity','ownership','type','remarks']);
  const [toolsLayout, setToolsLayout]       = useState('combined');
  const [toolsData, setToolsData]           = useState({});
  const [toolsOccSearch, setToolsOccSearch] = useState('');

  const family = REPORT_FAMILIES.find(f => f.id === familyId) || REPORT_FAMILIES[0];
  const report = family.reports.find(r => r.id === reportId) || family.reports[0];
  const isAggregate = !!report.aggregate;

  // Load occupations once for name lookup in reports
  useEffect(() => {
    api('GET', '/occupations', null, getSession()?.token)
      .then(data => setOccupations(data || []))
      .catch(() => {});
  }, []);

  // Reset report type when family changes
  useEffect(() => {
    setReportId(family.reports[0].id);
  }, [familyId]);

  // Reset occupation filter when report changes
  useEffect(() => {
    setSelectedOccs([]);
  }, [reportId]);

  useEffect(() => {
    if (!selectedInst) { setFullInst(null); return; }
    setLoadingInst(true);
    setSelectedIds(null);
    setFromFY('');
    setToFY('');
    setSelectedOccs([]);
    api('GET', `/institutes/${selectedInst}`, null, getSession()?.token)
      .then(data => { setFullInst(normInst(data)); setLoadingInst(false); })
      .catch(() => setLoadingInst(false));
  }, [selectedInst]);

  const experience = fullInst?.experience || [];

  // All FYs across assignments + tax clearance + NSTB records
  const allFYs = useMemo(() => {
    const taxFYs  = (fullInst?.taxClearance || []).map(t => t.fy).filter(Boolean);
    const nstbFYs = (fullInst?.nstb || []).map(n => n.fy).filter(Boolean);
    const expFYs  = experience.map(e => e.fy).filter(Boolean);
    return [...new Set([...expFYs, ...taxFYs, ...nstbFYs])].sort();
  }, [experience, fullInst]);

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

  // All unique occupation names across active assignments (for occupation filter)
  const allOccNames = useMemo(() => {
    const names = new Set();
    for (const exp of activeExps) {
      for (const occ of (exp.occupations || [])) {
        let name = occ.nameInLetter || '';
        if (occupations.length && occ.ctevtOccupationId) {
          const found = occupations.find(o => String(o.id) === String(occ.ctevtOccupationId));
          if (found) name = found.name;
        }
        if (name) names.add(name);
      }
    }
    return [...names].sort();
  }, [activeExps, occupations]);

  const toggleOcc = (name) =>
    setSelectedOccs(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]);

  const toggleSelected = (id) => {
    setSelectedIds(prev => {
      const base = prev === null ? rangeFiltered.map(e => e.id) : prev;
      return base.includes(id) ? base.filter(x => x !== id) : [...base, id];
    });
  };

  const selectAll = () => setSelectedIds(null);
  const clearAll  = () => setSelectedIds([]);

  const missingFor = (exp) =>
    (report.requiredFields || []).filter(([key]) => !exp[key]).map(([, label]) => label);

  const fyRangeLabel = fromFY || toFY ? `FY ${fromFY || '…'} – ${toFY || '…'}` : null;
  const noInstitute = !!family.noInstitute;
  const opts = { fromFY, toFY, selectedOccs, occupations, sortBy,
    toolsOccIds, toolsLevel, toolsTypeFilter, toolsColumns, toolsLayout, toolsData };

  const handlePrint = () => {
    const w = window.open('', '_blank');
    w.document.write(family.buildPrintHTML(fullInst, activeExps, clients, report.id, fyRangeLabel, opts));
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  const handleCSV = () => {
    if (isAggregate) return;
    const rows = activeExps.map((exp, i) => family.buildCSVRow(exp, clients, report.id, i));
    const fname = `${family.id.toUpperCase()}_${report.label.replace(/[^\w]+/g, '_')}_${fullInst?.acronym || fullInst?.name || 'report'}${fyRangeLabel ? `_${fyRangeLabel.replace(/[^\w]+/g,'_')}` : ''}.csv`;
    exportToCSV(rows, fname);
  };

  const handleWord = () => family.downloadDOCX(fullInst, activeExps, report.id, opts);

  const canPrint = noInstitute
    ? (toolsOccIds.length > 0 && !!toolsLevel)
    : isAggregate ? !!fullInst : activeExps.length > 0;

  const toggleToolsOcc = (id) =>
    setToolsOccIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleToolsCol = (key) =>
    setToolsColumns(prev => prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key]);

  const TOOLS_ALL_COLS = [
    { key: 'sn', label: 'S.N.' }, { key: 'name', label: 'Name' },
    { key: 'description', label: 'Description' },
    { key: 'unit', label: 'Unit' }, { key: 'quantity', label: 'Quantity' },
    { key: 'ownership', label: 'Ownership' }, { key: 'type', label: 'Type' },
    { key: 'remarks', label: 'Remarks' },
  ];

  // Fetch tools data for print HTML (the JSX component fetches its own)
  const fetchToolsDataForPrint = async () => {
    const token = getSession()?.token;
    const result = {};
    for (const occId of toolsOccIds) {
      try {
        result[occId] = await api('GET', `/occupation-tools/${occId}/${encodeURIComponent(toolsLevel)}`, null, token);
      } catch { result[occId] = []; }
    }
    return result;
  };

  const handlePrintTools = async () => {
    const data = await fetchToolsDataForPrint();
    const printOpts = { ...opts, toolsData: data };
    const w = window.open('', '_blank');
    w.document.write(family.buildPrintHTML(null, [], clients, report.id, null, printOpts));
    w.document.close();
    setTimeout(() => w.print(), 300);
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
          <select className="form-input" style={{width:'auto', minWidth:240}} value={reportId} onChange={e => setReportId(e.target.value)}>
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

            {/* Tools-specific filters */}
            {noInstitute && (
              <>
                <div className="filter-section">
                  <div className="filter-label">Level</div>
                  <select className="form-input" value={toolsLevel} onChange={e => setToolsLevel(e.target.value)}>
                    <option value="">— Select level —</option>
                    <option>Level 1</option>
                    <option>Level 2</option>
                    <option>Level 3</option>
                    <option>Professional</option>
                  </select>
                </div>

                <div className="filter-section">
                  <div className="filter-label" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <span>Occupations ({toolsOccIds.length || 'none'})</span>
                    {toolsOccIds.length > 0 && (
                      <button className="btn btn-ghost btn-sm" style={{fontSize:10, padding:'1px 5px'}} onClick={() => setToolsOccIds([])}>Clear</button>
                    )}
                  </div>
                  <input className="form-input" value={toolsOccSearch} onChange={e => setToolsOccSearch(e.target.value)}
                    placeholder="Search occupations..." style={{fontSize:11, padding:'4px 8px', marginBottom:6}}/>
                  <div className="multi-select-list" style={{maxHeight:200, overflowY:'auto'}}>
                    {occupations.filter(o => !toolsOccSearch || o.name.toLowerCase().includes(toolsOccSearch.toLowerCase())).map(o => (
                      <label key={o.id} className="multi-select-item">
                        <input type="checkbox"
                          checked={toolsOccIds.includes(o.id)}
                          onChange={() => toggleToolsOcc(o.id)}/>
                        <span style={{fontSize:11.5, lineHeight:1.3}}>{o.name}{o.level ? ` (${o.level})` : ''}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="filter-section">
                  <div className="filter-label">Show</div>
                  <select className="form-input" value={toolsTypeFilter} onChange={e => setToolsTypeFilter(e.target.value)}>
                    <option value="all">All types</option>
                    <option value="tools">Tools only</option>
                    <option value="consumables">Consumables only</option>
                    <option value="safety">Safety Tools only</option>
                    <option value="stationery">Stationery only</option>
                  </select>
                </div>

                <div className="filter-section">
                  <div className="filter-label">Layout</div>
                  <select className="form-input" value={toolsLayout} onChange={e => setToolsLayout(e.target.value)}>
                    <option value="combined">Combined table</option>
                    <option value="separate_sections">Separate sections (one table)</option>
                    <option value="separate_tables">Separate tables</option>
                  </select>
                </div>

                <div className="filter-section">
                  <div className="filter-label">Columns</div>
                  <div className="multi-select-list">
                    {TOOLS_ALL_COLS.map(c => (
                      <label key={c.key} className="multi-select-item">
                        <input type="checkbox"
                          checked={toolsColumns.includes(c.key)}
                          onChange={() => toggleToolsCol(c.key)}
                          disabled={c.key === 'sn' || c.key === 'description'}/>
                        <span style={{fontSize:11.5}}>{c.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Institute */}
            {!noInstitute && <div className="filter-section">
              <div className="filter-label">Institute / Firm</div>
              <select className="form-input" value={selectedInst} onChange={e => setSelectedInst(e.target.value)}>
                <option value="">— Select institute —</option>
                {institutes.map(i => <option key={i.id} value={i.id}>{i.name}{i.acronym ? ` (${i.acronym})` : ''}</option>)}
              </select>
            </div>}

            {/* FY range */}
            {!noInstitute && fullInst && allFYs.length > 0 && (
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

            {/* Sort order — only for Table 2 */}
            {!noInstitute && fullInst && report.id === 'h2' && (
              <div className="filter-section">
                <div className="filter-label">Sort occupations by</div>
                <select className="form-input" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                  <option value="default">Default (data order)</option>
                  <option value="alpha">Alphabetical (A → Z)</option>
                  <option value="fy">Fiscal year (earliest first)</option>
                </select>
              </div>
            )}

            {/* Occupation filter — only for reports that need it (Table 3) */}
            {!noInstitute && fullInst && report.hasOccupationFilter && allOccNames.length > 0 && (
              <div className="filter-section">
                <div className="filter-label" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                  <span>Occupations ({selectedOccs.length || 'all'})</span>
                  {selectedOccs.length > 0 && (
                    <button className="btn btn-ghost btn-sm" style={{fontSize:10, padding:'1px 5px'}} onClick={() => setSelectedOccs([])}>Clear</button>
                  )}
                </div>
                <div className="multi-select-list" style={{maxHeight:200, overflowY:'auto'}}>
                  {allOccNames.map(name => (
                    <label key={name} className="multi-select-item">
                      <input type="checkbox"
                        checked={selectedOccs.includes(name)}
                        onChange={() => toggleOcc(name)}/>
                      <span style={{fontSize:11.5, lineHeight:1.3}}>{name}</span>
                    </label>
                  ))}
                </div>
                <div style={{fontSize:11, color:'var(--text3)', marginTop:4}}>
                  Leave all unchecked to include all occupations.
                </div>
              </div>
            )}

            {/* Assignment checklist — only for non-aggregate or aggregate that uses assignments */}
            {!noInstitute && fullInst && !isAggregate && (
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

            {/* For aggregate reports, show a simplified assignment count */}
            {!noInstitute && fullInst && isAggregate && (
              <div className="filter-section">
                <div className="filter-label" style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                  <span>Assignments ({rangeFiltered.length})</span>
                  <span style={{display:'flex', gap:6}}>
                    <button className="btn btn-ghost btn-sm" style={{fontSize:10, padding:'1px 5px'}} onClick={selectAll}>All</button>
                    <button className="btn btn-ghost btn-sm" style={{fontSize:10, padding:'1px 5px'}} onClick={clearAll}>None</button>
                  </span>
                </div>
                {rangeFiltered.length === 0 ? (
                  <div style={{fontSize:12, color:'var(--text3)', padding:'6px 0'}}>No assignments in this FY range.</div>
                ) : (
                  <div className="multi-select-list" style={{maxHeight:200, overflowY:'auto'}}>
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
          {!noInstitute && !selectedInst ? (
            <div className="empty-state" style={{background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)'}}>
              <div className="empty-state-icon">📊</div>
              <div className="empty-state-title">Select an institute</div>
              <div className="empty-state-sub">Choose a firm and report type to generate a report</div>
            </div>
          ) : !noInstitute && loadingInst ? (
            <div className="empty-state" style={{background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)'}}>
              <div className="empty-state-icon">⏳</div>
              <div className="empty-state-title">Loading…</div>
            </div>
          ) : (
            <div className="card" style={{padding:0, overflow:'hidden'}}>
              {/* Header row */}
              <div style={{padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap'}}>
                <div>
                  <span style={{fontWeight:600, fontSize:14}}>{report.label}</span>
                  {fyRangeLabel && <span style={{fontSize:11, color:'var(--primary)', background:'var(--primary-light,#eff6ff)', borderRadius:4, padding:'1px 7px', marginLeft:8}}>{fyRangeLabel}</span>}
                </div>
                {!isAggregate && (
                  <span style={{fontSize:12, color:'var(--text3)'}}>{activeExps.length} assignment{activeExps.length !== 1 ? 's' : ''}</span>
                )}
                <div style={{marginLeft:'auto', display:'flex', gap:8}}>
                  {!isAggregate && (
                    <button className="btn btn-secondary btn-sm" onClick={handleCSV} disabled={!activeExps.length}>⬇ CSV</button>
                  )}
                  {isAggregate && family.downloadDOCX && (
                    <button className="btn btn-secondary btn-sm" onClick={handleWord} disabled={!canPrint}>⬇ Word (.docx)</button>
                  )}
                  <button className="btn btn-primary btn-sm" onClick={noInstitute ? handlePrintTools : handlePrint} disabled={!canPrint}>🖨 Print / PDF</button>
                </div>
              </div>

              {/* Table body */}
              {isAggregate ? (
                <div style={{padding:20}}>
                  {family.renderAggregateTable(fullInst || null, activeExps, clients, report.id, opts)}
                </div>
              ) : activeExps.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🔍</div>
                  <div className="empty-state-title">
                    {rangeFiltered.length === 0 ? 'No assignments in this FY range' : 'No assignments selected'}
                  </div>
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
      </div>
    </div>
  );
}

export default ReportsView;

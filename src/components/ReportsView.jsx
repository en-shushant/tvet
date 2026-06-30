import { useState, useEffect, useMemo } from 'react';
import { getSession } from '../utils/auth.js';
import { api, normInst } from '../utils/api.js';
import { exportToCSV } from '../utils/export.js';
import { fyInRange, fyYear } from '../reports/helpers.js';
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
  const [filterTrainingTypes, setFilterTrainingTypes] = useState([]); // Helvetas training type filter
  const [filterDuration, setFilterDuration] = useState(''); // Helvetas duration filter
  const [filterDonorTypes, setFilterDonorTypes] = useState([]); // Donor/client type filter
  const [occSearch, setOccSearch] = useState('');

  // Multi-institute state (firm-wise report)
  const [fwInstIds, setFwInstIds] = useState([]);
  const [fwFullInsts, setFwFullInsts] = useState({});
  const [fwLoading, setFwLoading] = useState(false);
  const [fwInstSearch, setFwInstSearch] = useState('');
  const [nstbComparative, setNstbComparative] = useState(false);
  const [nstbThreshold, setNstbThreshold] = useState('');

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

  // Load multi-institute data for firm-wise
  const isMultiInst = !!family.multiInstitute;
  useEffect(() => {
    if (!isMultiInst) return;
    const token = getSession()?.token;
    const toLoad = fwInstIds.filter(id => !fwFullInsts[id]);
    if (!toLoad.length) return;
    setFwLoading(true);
    Promise.all(toLoad.map(id =>
      api('GET', `/institutes/${id}`, null, token).then(d => [id, normInst(d)]).catch(() => [id, null])
    )).then(results => {
      setFwFullInsts(prev => {
        const next = { ...prev };
        for (const [id, data] of results) { if (data) next[id] = data; }
        return next;
      });
      setFwLoading(false);
    });
  }, [fwInstIds, isMultiInst]);

  const toggleFwInst = (id) =>
    setFwInstIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const experience = fullInst?.experience || [];

  // All FYs across assignments + tax clearance + NSTB records
  const allFYs = useMemo(() => {
    if (isMultiInst) {
      const fys = new Set();
      for (const inst of Object.values(fwFullInsts)) {
        for (const e of (inst.experience || [])) if (e.fy) fys.add(e.fy);
        for (const n of (inst.nstb || [])) if (n.fy) fys.add(n.fy);
        for (const t of (inst.taxClearance || [])) if (t.fy) fys.add(t.fy);
      }
      return [...fys].sort();
    }
    const taxFYs  = (fullInst?.taxClearance || []).map(t => t.fy).filter(Boolean);
    const nstbFYs = (fullInst?.nstb || []).map(n => n.fy).filter(Boolean);
    const expFYs  = experience.map(e => e.fy).filter(Boolean);
    return [...new Set([...expFYs, ...taxFYs, ...nstbFYs])].sort();
  }, [experience, fullInst, isMultiInst, fwFullInsts]);

  // Assignments visible in the checklist (FY range applied)
  const rangeFiltered = useMemo(() =>
    experience.filter(e => fyInRange(e.fy, fromFY, toFY)),
    [experience, fromFY, toFY]
  );

  // Final set for the report (FY range + manual checkbox selection + training type/duration filters)
  const activeExps = useMemo(() => {
    let filtered = selectedIds === null ? rangeFiltered : rangeFiltered.filter(e => selectedIds.includes(e.id));
    if (filterTrainingTypes.length > 0) {
      filtered = filtered.filter(e => filterTrainingTypes.includes(e.trainingType || ''));
    }
    if (filterDonorTypes.length > 0) {
      filtered = filtered.filter(e => {
        const client = (clients || []).find(c => c.id === e.clientId);
        const ctype = client?.type || 'Other';
        return filterDonorTypes.includes(ctype);
      });
    }
    if (filterDuration) {
      filtered = filtered.filter(e => {
        const occs = e.occupations || [];
        return occs.some(occ => {
          const d = parseFloat(occ.duration) || 0;
          if (filterDuration === '160plus') return d >= 160;
          if (filterDuration === '390plus') return d >= 390;
          if (filterDuration === '390more') return d > 390;
          return true;
        });
      });
    }
    return filtered;
  }, [rangeFiltered, selectedIds, filterTrainingTypes, filterDuration, filterDonorTypes, clients]);

  // All training types present in range-filtered assignments
  const allTrainingTypes = useMemo(() => {
    const types = new Set();
    for (const e of rangeFiltered) { if (e.trainingType) types.add(e.trainingType); }
    return [...types].sort();
  }, [rangeFiltered]);

  const toggleTrainingType = (t) =>
    setFilterTrainingTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

  const allDonorTypes = useMemo(() => {
    const types = new Set();
    const addFromExps = (exps) => {
      for (const e of exps) {
        const client = (clients || []).find(c => c.id === e.clientId);
        types.add(client?.type || 'Other');
      }
    };
    if (isMultiInst) {
      for (const inst of Object.values(fwFullInsts)) addFromExps(inst.experience || []);
    } else {
      addFromExps(rangeFiltered);
    }
    return [...types].sort();
  }, [rangeFiltered, clients, isMultiInst, fwFullInsts]);

  const toggleDonorType = (t) =>
    setFilterDonorTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

  // All unique occupation names across active assignments (for occupation filter)
  const allOccNames = useMemo(() => {
    const names = new Set();
    const addFromExps = (exps) => {
      for (const exp of exps) {
        for (const occ of (exp.occupations || [])) {
          let name = occ.nameInLetter || '';
          if (occupations.length && occ.ctevtOccupationId) {
            const found = occupations.find(o => String(o.id) === String(occ.ctevtOccupationId));
            if (found) name = found.name;
          }
          if (name) names.add(name);
        }
      }
    };
    const addFromNSTB = (inst) => {
      for (const n of (inst?.nstb || [])) {
        if (n.occupation) names.add(n.occupation.trim());
      }
    };
    if (isMultiInst) {
      for (const inst of Object.values(fwFullInsts)) {
        addFromExps(inst.experience || []);
        if (reportId === 'fw2') addFromNSTB(inst);
      }
    } else {
      addFromExps(activeExps);
      if (reportId === 'fw2' && fullInst) addFromNSTB(fullInst);
    }
    return [...names].sort();
  }, [activeExps, occupations, isMultiInst, fwFullInsts, reportId, fullInst]);

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
      <div className="card" style={{padding:'14px 18px', display:'flex', alignItems:'center', gap:16, flexWrap:'wrap'}}>
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
        {!noInstitute && !isMultiInst && <>
          <div style={{width:1, height:28, background:'var(--border)'}}/>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <span style={{fontSize:12, fontWeight:600, color:'var(--text3)', whiteSpace:'nowrap'}}>FIRM</span>
            <select className="form-input" style={{width:'auto', minWidth:180}} value={selectedInst} onChange={e => setSelectedInst(e.target.value)}>
              <option value="">— Select —</option>
              {institutes.map(i => <option key={i.id} value={i.id}>{i.name}{i.acronym ? ` (${i.acronym})` : ''}</option>)}
            </select>
          </div>
        </>}
      </div>

      {/* ── Second row: FY range + duration ── */}
      {!noInstitute && (fullInst || isMultiInst) && (
        <div className="card" style={{padding:'10px 18px', display:'flex', alignItems:'center', gap:16, flexWrap:'wrap'}}>
          {allFYs.length > 0 && (
            <div style={{display:'flex', alignItems:'center', gap:8}}>
              <span style={{fontSize:11, fontWeight:600, color:'var(--text3)', whiteSpace:'nowrap'}}>FY RANGE</span>
              <select className="form-input" style={{width:'auto', minWidth:90, padding:'4px 8px', fontSize:12}} value={fromFY} onChange={e => { setFromFY(e.target.value); setSelectedIds(null); }}>
                <option value="">From</option>
                {allFYs.map(fy => <option key={fy} value={fy}>{fy}</option>)}
              </select>
              <span style={{color:'var(--text3)', fontSize:12}}>→</span>
              <select className="form-input" style={{width:'auto', minWidth:90, padding:'4px 8px', fontSize:12}} value={toFY} onChange={e => { setToFY(e.target.value); setSelectedIds(null); }}>
                <option value="">To</option>
                {allFYs.map(fy => <option key={fy} value={fy}>{fy}</option>)}
              </select>
              {(fromFY || toFY) && (
                <button className="btn btn-ghost btn-sm" style={{fontSize:10, padding:'2px 6px'}}
                  onClick={() => { setFromFY(''); setToFY(''); setSelectedIds(null); }}>✕</button>
              )}
            </div>
          )}
          <div style={{width:1, height:24, background:'var(--border)'}}/>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <span style={{fontSize:11, fontWeight:600, color:'var(--text3)', whiteSpace:'nowrap'}}>DURATION</span>
            <select className="form-input" style={{width:'auto', minWidth:140, padding:'4px 8px', fontSize:12}} value={filterDuration} onChange={e => setFilterDuration(e.target.value)}>
              <option value="">All trainings</option>
              <option value="160plus">160 hours or more</option>
              <option value="390plus">390 hours or more</option>
              <option value="390more">More than 390 hours</option>
            </select>
          </div>
          <div style={{marginLeft:'auto', fontSize:12, color:'var(--text3)'}}>
            {activeExps.length} assignment{activeExps.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* ── Two-column layout ── */}
      <div style={{display:'flex', gap:20, alignItems:'flex-start'}}>

        {/* ── Filter panel ── */}
        <div className="filter-panel">
          <div className="filter-panel-header">
            <span className="filter-panel-header-title">Filters</span>
          </div>
          <div className="filter-panel-body">

            {/* Multi-institute selector (firm-wise) */}
            {isMultiInst && (
              <div className="filter-section">
                <div className="filter-label">Firms</div>
                <input className="form-input" value={fwInstSearch} onChange={e => setFwInstSearch(e.target.value)}
                  placeholder="Search…" style={{fontSize:12, marginBottom:6}}/>
                <div className="multi-select-list" style={{maxHeight:220, overflowY:'auto'}}>
                  {institutes.filter(i => !fwInstSearch || i.name.toLowerCase().includes(fwInstSearch.toLowerCase()) || (i.acronym||'').toLowerCase().includes(fwInstSearch.toLowerCase())).map(i => (
                    <label key={i.id} className="multi-select-item">
                      <input type="checkbox" checked={fwInstIds.includes(i.id)} onChange={() => toggleFwInst(i.id)}/>
                      <span>{i.acronym || i.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Tools-specific filters */}
            {noInstitute && (
              <>
                <div className="filter-section">
                  <div className="filter-label">Level</div>
                  <select className="form-input" value={toolsLevel} onChange={e => setToolsLevel(e.target.value)}>
                    <option value="">— Select level —</option>
                    <option>Level 1</option><option>Level 2</option><option>Level 3</option><option>Professional</option>
                  </select>
                </div>

                <div className="filter-section">
                  <div className="filter-label">Occupations</div>
                  <input className="form-input" value={toolsOccSearch} onChange={e => setToolsOccSearch(e.target.value)}
                    placeholder="Search…" style={{fontSize:12, marginBottom:6}}/>
                  <div className="multi-select-list" style={{maxHeight:200, overflowY:'auto'}}>
                    {occupations.filter(o => !toolsOccSearch || o.name.toLowerCase().includes(toolsOccSearch.toLowerCase())).map(o => (
                      <label key={o.id} className="multi-select-item">
                        <input type="checkbox" checked={toolsOccIds.includes(o.id)} onChange={() => toggleToolsOcc(o.id)}/>
                        <span>{o.name}{o.level ? ` (${o.level})` : ''}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="filter-section">
                  <div className="filter-label">Type</div>
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
                    <option value="separate_sections">Separate sections</option>
                    <option value="separate_tables">Separate tables</option>
                  </select>
                </div>

                <div className="filter-section">
                  <div className="filter-label">Columns</div>
                  <div className="multi-select-list">
                    {TOOLS_ALL_COLS.map(c => (
                      <label key={c.key} className="multi-select-item">
                        <input type="checkbox" checked={toolsColumns.includes(c.key)} onChange={() => toggleToolsCol(c.key)}
                          disabled={c.key === 'sn' || c.key === 'description'}/>
                        <span>{c.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Training type */}
            {!noInstitute && !isMultiInst && fullInst && allTrainingTypes.length > 0 && (
              <div className="filter-section">
                <div className="filter-label">Training type</div>
                <div className="multi-select-list">
                  {allTrainingTypes.map(t => (
                    <label key={t} className="multi-select-item">
                      <input type="checkbox" checked={filterTrainingTypes.includes(t)} onChange={() => toggleTrainingType(t)}/>
                      <span>{t}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Donor type */}
            {!noInstitute && (fullInst || isMultiInst) && allDonorTypes.length > 0 && (
              <div className="filter-section">
                <div className="filter-label">Donor type</div>
                <div className="multi-select-list">
                  {allDonorTypes.map(t => (
                    <label key={t} className="multi-select-item">
                      <input type="checkbox" checked={filterDonorTypes.includes(t)} onChange={() => toggleDonorType(t)}/>
                      <span>{t}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Sort — Table 2 only */}
            {!noInstitute && !isMultiInst && fullInst && report.id === 'h2' && (
              <div className="filter-section">
                <div className="filter-label">Sort by</div>
                <select className="form-input" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                  <option value="default">Data order</option>
                  <option value="alpha">Alphabetical</option>
                  <option value="fy">Fiscal year</option>
                </select>
              </div>
            )}

            {/* Occupation */}
            {!noInstitute && (fullInst || isMultiInst) && report.hasOccupationFilter && allOccNames.length > 0 && (
              <div className="filter-section">
                <div className="filter-label">Occupation</div>
                <input className="form-input" value={occSearch} onChange={e => setOccSearch(e.target.value)}
                  placeholder="Search…" style={{fontSize:12, marginBottom:6}}/>
                <div className="multi-select-list" style={{maxHeight:200, overflowY:'auto'}}>
                  {allOccNames.filter(n => !occSearch || n.toLowerCase().includes(occSearch.toLowerCase())).map(name => (
                    <label key={name} className="multi-select-item">
                      <input type="checkbox" checked={selectedOccs.includes(name)} onChange={() => toggleOcc(name)}/>
                      <span>{name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Assignments */}
            {!noInstitute && !isMultiInst && fullInst && (
              <div className="filter-section">
                <div className="filter-label" style={{justifyContent:'space-between'}}>
                  <span>Assignments</span>
                  <span style={{display:'flex', gap:4, fontSize:10, fontWeight:400, letterSpacing:0}}>
                    <button className="btn btn-ghost btn-sm" style={{fontSize:10, padding:'1px 5px'}} onClick={selectAll}>All</button>
                    <button className="btn btn-ghost btn-sm" style={{fontSize:10, padding:'1px 5px'}} onClick={clearAll}>None</button>
                  </span>
                </div>
                {rangeFiltered.length === 0 ? (
                  <div style={{fontSize:12, color:'var(--text3)', padding:'6px 0'}}>No assignments in range.</div>
                ) : (
                  <div className="multi-select-list" style={{maxHeight:200, overflowY:'auto'}}>
                    {rangeFiltered.map(exp => (
                      <label key={exp.id} className="multi-select-item">
                        <input type="checkbox"
                          checked={selectedIds === null || selectedIds.includes(exp.id)}
                          onChange={() => toggleSelected(exp.id)}/>
                        <span>{exp.assignmentName || '(unnamed)'} <span style={{color:'var(--text3)', fontSize:10}}>· {exp.fy}</span></span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Reset */}
          {!noInstitute && (fullInst || isMultiInst) && (
            <button className="filter-reset-btn" onClick={() => {
              setFromFY(''); setToFY(''); setFilterDuration('');
              setFilterTrainingTypes([]); setFilterDonorTypes([]);
              setSelectedOccs([]); setSelectedIds(null); setOccSearch('');
            }}>
              ↻ Reset
            </button>
          )}
        </div>

        {/* ── Results ── */}
        <div style={{flex:1, minWidth:0}}>
          {isMultiInst ? (
            fwInstIds.length === 0 ? (
              <div className="empty-state" style={{background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)'}}>
                <div className="empty-state-icon">📊</div>
                <div className="empty-state-title">Select firms</div>
                <div className="empty-state-sub">Check one or more firms in the sidebar</div>
              </div>
            ) : fwLoading ? (
              <div className="empty-state" style={{background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)'}}>
                <div className="empty-state-icon">⏳</div>
                <div className="empty-state-title">Loading…</div>
              </div>
            ) : (
              <div style={{display:'flex', flexDirection:'column', gap:16}}>
                {/* Multi-inst header */}
                <div className="card" style={{padding:'14px 20px', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap'}}>
                  <div>
                    <span style={{fontWeight:600, fontSize:14}}>{report.label}</span>
                    <span style={{fontSize:12, color:'var(--text3)', marginLeft:8}}>{fwInstIds.length} firm{fwInstIds.length !== 1 ? 's' : ''}</span>
                    {fyRangeLabel && <span style={{fontSize:11, color:'var(--primary)', background:'var(--primary-light,#eff6ff)', borderRadius:4, padding:'1px 7px', marginLeft:8}}>{fyRangeLabel}</span>}
                  </div>
                  <div style={{marginLeft:'auto', display:'flex', alignItems:'center', gap:12}}>
                    {report.id === 'fw2' && (
                      <div style={{display:'flex', alignItems:'center', gap:10}}>
                        <label style={{display:'flex', alignItems:'center', gap:5, fontSize:12, cursor:'pointer', whiteSpace:'nowrap'}}>
                          <input type="checkbox" checked={nstbComparative} onChange={e => setNstbComparative(e.target.checked)} />
                          Comparative
                        </label>
                        {nstbComparative && (
                          <div style={{display:'flex', alignItems:'center', gap:5}}>
                            <label style={{fontSize:12, whiteSpace:'nowrap', color:'var(--text3)'}}>Threshold ≥</label>
                            <input
                              type="number" min="0" placeholder="e.g. 50"
                              value={nstbThreshold}
                              onChange={e => setNstbThreshold(e.target.value)}
                              style={{width:70, fontSize:12, padding:'2px 6px', border:'1px solid var(--border)', borderRadius:4}}
                            />
                          </div>
                        )}
                      </div>
                    )}
                    <button className="btn btn-primary btn-sm" onClick={() => {
                      const sections = fwInstIds.map(id => {
                        const inst = fwFullInsts[id];
                        if (!inst) return '';
                        let exps = (inst.experience || []).filter(e => fyInRange(e.fy, fromFY, toFY));
                        if (filterDonorTypes.length > 0) {
                          exps = exps.filter(e => {
                            const client = (clients || []).find(c => c.id === e.clientId);
                            return filterDonorTypes.includes(client?.type || 'Other');
                          });
                        }
                        if (filterDuration) {
                          exps = exps.filter(e => (e.occupations || []).some(occ => {
                            const d = parseFloat(occ.duration) || 0;
                            if (filterDuration === '160plus') return d >= 160;
                            if (filterDuration === '390plus') return d >= 390;
                            if (filterDuration === '390more') return d > 390;
                            return true;
                          }));
                        }
                        return family.buildPrintHTML(inst, exps, clients, report.id, fyRangeLabel, opts);
                      }).filter(Boolean);
                      if (!sections.length) return;
                      const first = sections[0];
                      const bodyParts = sections.map(html => {
                        const m = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
                        return m ? m[1] : '';
                      });
                      const combined = first.replace(/<body[^>]*>[\s\S]*<\/body>/i,
                        `<body>${bodyParts.join('<div style="page-break-before:always"></div>')}</body>`);
                      const w = window.open('', '_blank');
                      w.document.write(combined);
                      w.document.close();
                      setTimeout(() => w.print(), 300);
                    }} disabled={fwInstIds.length === 0}>🖨 Print / PDF</button>
                  </div>
                </div>

                {/* Cross-firm comparative table for NSTB */}
                {report.id === 'fw2' && nstbComparative && (() => {
                  // Collect all occupations and per-firm appeared totals
                  const firmData = fwInstIds.map(id => {
                    const inst = fwFullInsts[id];
                    if (!inst) return null;
                    const exps = (inst.experience || []).filter(e => fyInRange(e.fy, fromFY, toFY));
                    const activeFYYears = new Set(exps.map(e => fyYear(e.fy)).filter(Boolean));
                    const records = (inst.nstb || []).filter(n => activeFYYears.size === 0 || activeFYYears.has(fyYear(n.fy)));
                    const byOcc = {};
                    for (const n of records) {
                      const name = (n.occupation || '').trim();
                      if (!name) continue;
                      if (selectedOccs.length && !selectedOccs.some(o => o.toLowerCase() === name.toLowerCase())) continue;
                      if (!byOcc[name]) byOcc[name] = 0;
                      byOcc[name] += parseInt(n.appeared) || 0;
                    }
                    return { id, name: inst.acronym || inst.name || id, byOcc };
                  }).filter(Boolean);

                  const allOccs = [...new Set(firmData.flatMap(f => Object.keys(f.byOcc)))].sort();
                  if (!allOccs.length) return null;

                  const TH2 = { background:'#dce6f1', padding:'6px 8px', border:'1px solid #aab8c8', fontWeight:600, fontSize:11, textAlign:'center' };
                  const TD2 = { padding:'5px 8px', border:'1px solid #c8d4e0', fontSize:11 };
                  const TDN2 = { ...TD2, textAlign:'right' };

                  const threshold = nstbThreshold !== '' ? parseInt(nstbThreshold) : null;
                  return (
                    <div className="card" style={{padding:20, overflowX:'auto'}}>
                      <div style={{fontWeight:600, fontSize:13, marginBottom:10}}>
                        Comparative — Appeared Trainees by Occupation &amp; Firm
                        {fyRangeLabel && <span style={{fontWeight:400, fontSize:11, marginLeft:8, color:'var(--text3)'}}>({fyRangeLabel})</span>}
                      </div>
                      <table style={{borderCollapse:'collapse', width:'100%', minWidth: firmData.length * 120 + 200}}>
                        <thead>
                          <tr>
                            <th style={{...TH2, textAlign:'left'}}>Occupation</th>
                            {firmData.map(f => (
                              <th key={f.id} style={TH2}>
                                <div>{f.name}</div>
                                <div style={{fontWeight:400, fontSize:10, color:'#555'}}>Appeared</div>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {allOccs.map((occ, i) => {
                            const vals = firmData.map(f => f.byOcc[occ] || 0);
                            return (
                              <tr key={occ} style={{background: i % 2 === 0 ? '#fff' : '#f7f9fc'}}>
                                <td style={TD2}>{occ}</td>
                                {vals.map((v, j) => {
                                  const highlight = threshold !== null && !isNaN(threshold) && v >= threshold && v > 0;
                                  return (
                                    <td key={j} style={{
                                      ...TDN2,
                                      background: highlight ? '#d4edda' : undefined,
                                      color: highlight ? '#155724' : undefined,
                                      fontWeight: highlight ? 600 : undefined,
                                    }}>{v || '—'}</td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                          <tr style={{background:'#e8f0fe', fontWeight:600}}>
                            <td style={TD2}>Total</td>
                            {firmData.map((f, j) => {
                              const t = allOccs.reduce((s, occ) => s + (f.byOcc[occ] || 0), 0);
                              return <td key={j} style={TDN2}>{t || '—'}</td>;
                            })}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  );
                })()}

                {/* Per-firm tables */}
                {fwInstIds.map(id => {
                  const inst = fwFullInsts[id];
                  if (!inst) return null;
                  let exps = (inst.experience || []).filter(e => fyInRange(e.fy, fromFY, toFY));
                  if (filterDonorTypes.length > 0) {
                    exps = exps.filter(e => {
                      const client = (clients || []).find(c => c.id === e.clientId);
                      return filterDonorTypes.includes(client?.type || 'Other');
                    });
                  }
                  if (filterDuration) {
                    exps = exps.filter(e => (e.occupations || []).some(occ => {
                      const d = parseFloat(occ.duration) || 0;
                      if (filterDuration === '160plus') return d >= 160;
                      if (filterDuration === '390plus') return d >= 390;
                      if (filterDuration === '390more') return d > 390;
                      return true;
                    }));
                  }
                  return (
                    <div key={id} className="card" style={{padding:20}}>
                      {family.renderAggregateTable(inst, exps, clients, report.id, opts)}
                    </div>
                  );
                })}
              </div>
            )
          ) : !noInstitute && !selectedInst ? (
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

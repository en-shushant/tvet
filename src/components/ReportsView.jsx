import { useState, useEffect, useMemo } from 'react';
import { getSession } from '../utils/auth.js';
import { api, normInst } from '../utils/api.js';
import { exportToCSV } from '../utils/export.js';
import { Btn } from '../md.jsx';
import { fyInRange, fyYear } from '../reports/helpers.js';
import REPORT_FAMILIES from '../reports/index.js';
import { TOOL_COLUMN_OPTIONS, TOOL_TYPE_OPTIONS, DEFAULT_TOOL_COLS } from '../reports/bolpatra.jsx';

const FILTER_KEY = 'tvettrack_reports_filters_v1';
function loadFilters() {
  try { return JSON.parse(sessionStorage.getItem(FILTER_KEY)) || {}; } catch { return {}; }
}
function saveFilters(patch) {
  try {
    const cur = loadFilters();
    sessionStorage.setItem(FILTER_KEY, JSON.stringify({ ...cur, ...patch }));
  } catch {}
}

function ReportsView({ institutes, clients }) {
  const f = loadFilters();
  const [familyId, setFamilyId]         = useState(f.familyId || REPORT_FAMILIES[0].id);
  const [selectedInst, setSelectedInst] = useState(f.selectedInst || '');
  const [fullInst, setFullInst]         = useState(null);
  const [loadingInst, setLoadingInst]   = useState(false);
  const [reportId, setReportId]         = useState(f.reportId || REPORT_FAMILIES[0].reports[0].id);
  const [selectedIds, setSelectedIds]   = useState(null); // null = all
  const [fromFY, setFromFY]             = useState(f.fromFY || '');
  const [toFY, setToFY]                 = useState(f.toFY || '');
  // Turnover years are chosen independently of the experience years — bids often
  // ask for a different span of accounts than of work (see bolpatra 4(A)).
  const [turnFromFY, setTurnFromFY]     = useState(f.turnFromFY || '');
  const [turnToFY, setTurnToFY]         = useState(f.turnToFY || '');
  const [selectedOccs, setSelectedOccs] = useState([]); // for Table 3 occupation filter
  const [occupations, setOccupations]   = useState([]);
  const [sortBy, setSortBy]             = useState('default'); // for Table 2 occupation sort
  const [filterTrainingTypes, setFilterTrainingTypes] = useState([]); // Helvetas training type filter
  const [filterDuration, setFilterDuration] = useState(f.filterDuration || ''); // Helvetas duration filter
  const [filterDonorTypes, setFilterDonorTypes] = useState([]); // Donor/client type filter
  const [occSearch, setOccSearch] = useState('');

  // Multi-institute state (firm-wise report)
  const [fwInstIds, setFwInstIds] = useState([]);
  const [fwFullInsts, setFwFullInsts] = useState({});
  const [fwLoading, setFwLoading] = useState(false);
  const [fwInstSearch, setFwInstSearch] = useState('');
  // Explicit JV lead. Previously the lead was whichever firm happened to be ticked
  // first, which was invisible and uncorrectable without starting over.
  const [fwLeadId, setFwLeadId] = useState(null);
  // Level for the 4(B) tools tables — occupation_tools are stored per level.
  const [eoiToolsLevel, setEoiToolsLevel] = useState(f.eoiToolsLevel || 'Level 1');
  const [eoiTools, setEoiTools] = useState({});
  // Stored tool quantities are what one training event consumes. Each occupation
  // runs its own number of events, so this is a map of occupation id -> count
  // rather than one figure for the whole bid.
  const [eoiEventsByOcc, setEoiEventsByOcc] = useState(f.eoiEventsByOcc || {});
  const [eoiToolCols, setEoiToolCols] = useState(f.eoiToolCols || DEFAULT_TOOL_COLS);
  const [eoiToolTypes, setEoiToolTypes] = useState(f.eoiToolTypes || []);  // empty = all types
  // Multi-firm reports render only when asked. Building a joint-venture EOI
  // across several firms is expensive, and re-doing it on every checkbox tick
  // made the filters feel sluggish. Holds the filter signature that was last
  // rendered, so we can tell when what is on screen has gone out of date.
  const [renderedSig, setRenderedSig] = useState(null);
  const [nstbComparative, setNstbComparative] = useState(false);
  const [nstbThreshold, setNstbThreshold] = useState('');

  // Tools report state
  const [toolsOccIds, setToolsOccIds]       = useState([]);
  const [toolsLevel, setToolsLevel]         = useState('');
  const [toolsTypeFilter, setToolsTypeFilter] = useState('all');
  const [toolsColumns, setToolsColumns]     = useState(['sn','name','description','unit','quantity','ownership','type','remarks']);
  const [toolsLayout, setToolsLayout]       = useState('combined');
  const [toolsData, setToolsData]           = useState({});
  const [numGroups, setNumGroups]           = useState(1);
  const [toolsOccSearch, setToolsOccSearch] = useState('');

  // ENSSURE report state — multi-select proposed occupations
  const [enssureOccIds, setEnssureOccIds] = useState(f.enssureOccIds || []);
  const [enssureOccSearch, setEnssureOccSearch] = useState('');
  // ENSSURE D2/D3 explicit tools occupation + level + events multiplier
  const [enssureToolsOccId, setEnssureToolsOccId] = useState(f.enssureToolsOccId || '');
  const [enssureToolsOccSearch, setEnssureToolsOccSearch] = useState('');
  const [enssureToolsLevel, setEnssureToolsLevel] = useState(f.enssureToolsLevel || 'Level 1');
  const [enssureEvents, setEnssureEvents] = useState(f.enssureEvents || 1);
  const [enssureToolsData, setEnssureToolsData] = useState([]);

  // Persist key filter state to sessionStorage
  useEffect(() => { saveFilters({ familyId, selectedInst, reportId, fromFY, toFY, turnFromFY, turnToFY, eoiToolsLevel, eoiEventsByOcc, eoiToolCols, eoiToolTypes, filterDuration, enssureOccIds, enssureToolsOccId, enssureToolsLevel, enssureEvents }); },
    [familyId, selectedInst, reportId, fromFY, toFY, turnFromFY, turnToFY, eoiToolsLevel, eoiEventsByOcc, eoiToolCols, eoiToolTypes, filterDuration, enssureOccIds, enssureToolsOccId, enssureToolsLevel, enssureEvents]);

  // Fetch tools for explicitly selected D2/D3 occupation + level
  useEffect(() => {
    if (!enssureToolsOccId || !enssureToolsLevel) { setEnssureToolsData([]); return; }
    api('GET', `/occupation-tools/${enssureToolsOccId}/${encodeURIComponent(enssureToolsLevel)}`, null, getSession()?.token)
      .then(d => setEnssureToolsData(Array.isArray(d) ? d : []))
      .catch(() => setEnssureToolsData([]));
  }, [enssureToolsOccId, enssureToolsLevel]);

  const toggleEnssureOcc = (id) =>
    setEnssureOccIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

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
  const filtersOnTop = !!family.filtersOnTop;
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
    setFwInstIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      // Keep the lead valid: adopt the first firm when unset, drop it when deselected.
      setFwLeadId(cur => next.includes(cur) ? cur : (next[0] ?? null));
      return next;
    });

  // Tools for 4(B). Fetched here because buildPrintHTML and the DOCX builder are
  // synchronous over their inputs — same approach as fetchToolsDataForPrint below.
  const eoiOccIds = useMemo(() => {
    if (!selectedOccs.length || !occupations.length) return [];
    const wanted = selectedOccs.map(s => s.toLowerCase());
    return occupations.filter(o => wanted.includes(String(o.name).toLowerCase())).map(o => o.id);
  }, [selectedOccs, occupations]);

  useEffect(() => {
    if (!report.hasToolsPicker || !eoiOccIds.length || !eoiToolsLevel) { setEoiTools({}); return; }
    let cancelled = false;
    const token = getSession()?.token;
    Promise.all(eoiOccIds.map(id =>
      api('GET', `/occupation-tools/${id}/${encodeURIComponent(eoiToolsLevel)}`, null, token)
        .then(d => [id, Array.isArray(d) ? d : []]).catch(() => [id, []])
    )).then(pairs => { if (!cancelled) setEoiTools(Object.fromEntries(pairs)); });
    return () => { cancelled = true; };
  }, [eoiOccIds.join(','), eoiToolsLevel, report.hasToolsPicker]);

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
        if (reportId !== 'fw2') addFromExps(inst.experience || []);
        if (reportId === 'fw2') addFromNSTB(inst);
      }
    } else {
      if (reportId !== 'fw2') addFromExps(activeExps);
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
  const enssureOccs = enssureOccIds.map(id => occupations.find(o => String(o.id) === String(id))?.name).filter(Boolean);

  // Count C1 rows with missing skill test pass or employment data
  const enssureMissingCount = useMemo(() => {
    if (familyId !== 'enssure' || !fullInst) return 0;
    let n = 0;
    for (const exp of activeExps) {
      for (const occ of (exp.occupations || [])) {
        if ((occ.skillTestPass == null || occ.skillTestPass === '') ||
            (occ.employmentActual == null || occ.employmentActual === '')) n++;
      }
    }
    return n;
  }, [familyId, fullInst, activeExps]);

  const opts = { fromFY, toFY, turnoverFromFY: turnFromFY, turnoverToFY: turnToFY,
    bolpatraTools: eoiTools, eoiToolsLevel, eoiEventsByOcc, eoiToolCols, eoiToolTypes, selectedOccs, occupations, sortBy,
    toolsOccIds, toolsLevel, toolsTypeFilter, toolsColumns, toolsLayout, toolsData, numGroups,
    enssureOccs, enssureOccIds, enssureToolsData, enssureToolsOccId, enssureToolsLevel, enssureEvents,
    filterDuration, clients };

  // Assignments for one firm in multi-institute mode, with the sidebar filters
  // applied. Shared by the per-firm render, the print path and the Word export so
  // all three always agree on what is included.
  const fwExpsFor = (inst) => {
    let exps = (inst.experience || []).filter(e => fyInRange(e.fy, fromFY, toFY));
    if (filterDonorTypes.length > 0) {
      exps = exps.filter(e => {
        const client = (clients || []).find(c => c.id === e.clientId);
        return filterDonorTypes.includes(client?.type || 'Other');
      });
    }
    // Families that declare selfFilters apply duration themselves, so they can
    // scope it to one section instead of the whole document.
    if (filterDuration && !family.selfFilters) {
      exps = exps.filter(e => (e.occupations || []).some(occ => {
        const d = parseFloat(occ.duration) || 0;
        if (filterDuration === '160plus') return d >= 160;
        if (filterDuration === '390plus') return d >= 390;
        if (filterDuration === '390more') return d > 390;
        return true;
      }));
    }
    return exps;
  };

  // Lead first, then the rest in selection order — report families take position 0
  // to be the lead applicant.
  const fwSelectedFirms = () => {
    const ordered = fwInstIds.includes(fwLeadId)
      ? [fwLeadId, ...fwInstIds.filter(id => id !== fwLeadId)]
      : fwInstIds;
    return ordered.map(id => fwFullInsts[id]).filter(Boolean)
      .map(inst => ({ inst, exps: fwExpsFor(inst) }));
  };

  // Everything the rendered document depends on. Compared against renderedSig to
  // show whether what is on screen still matches the filters.
  const filterSig = JSON.stringify([
    reportId, fwInstIds, fwLeadId, fromFY, toFY, turnFromFY, turnToFY,
    selectedOccs, filterDuration, filterDonorTypes,
    eoiToolsLevel, eoiEventsByOcc, eoiToolCols, eoiToolTypes,
  ]);
  const isStale = renderedSig !== null && renderedSig !== filterSig;
  const showReport = () => setRenderedSig(filterSig);

  // A different report or firm set invalidates what is on screen rather than
  // silently leaving the previous document up.
  useEffect(() => { setRenderedSig(null); }, [reportId, familyId]);

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
              <span style={{fontSize:11, fontWeight:600, color:'var(--text3)', whiteSpace:'nowrap'}}
                title={report.hasTurnoverFY ? 'Fiscal years of the assignments shown in the experience sections' : undefined}>
                {report.hasTurnoverFY ? 'EXPERIENCE FY' : 'FY RANGE'}
              </span>
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
                <Btn className="btn btn-ghost btn-sm" style={{fontSize:10, padding:'2px 6px'}}
                  onClick={() => { setFromFY(''); setToFY(''); setSelectedIds(null); }}>✕</Btn>
              )}
            </div>
          )}

          {/* Turnover years, independent of the experience years above. */}
          {report.hasTurnoverFY && allFYs.length > 0 && (
            <>
              <div style={{width:1, height:24, background:'var(--border)'}}/>
              <div style={{display:'flex', alignItems:'center', gap:8}}>
                <span style={{fontSize:11, fontWeight:600, color:'var(--text3)', whiteSpace:'nowrap'}}
                  title="Fiscal years of the turnover rows in 4(A) Financial Capacity">TURNOVER FY</span>
                <select className="form-input" style={{width:'auto', minWidth:90, padding:'4px 8px', fontSize:12}} value={turnFromFY} onChange={e => setTurnFromFY(e.target.value)}>
                  <option value="">From</option>
                  {allFYs.map(fy => <option key={fy} value={fy}>{fy}</option>)}
                </select>
                <span style={{color:'var(--text3)', fontSize:12}}>→</span>
                <select className="form-input" style={{width:'auto', minWidth:90, padding:'4px 8px', fontSize:12}} value={turnToFY} onChange={e => setTurnToFY(e.target.value)}>
                  <option value="">To</option>
                  {allFYs.map(fy => <option key={fy} value={fy}>{fy}</option>)}
                </select>
                {(turnFromFY || turnToFY) && (
                  <Btn className="btn btn-ghost btn-sm" style={{fontSize:10, padding:'2px 6px'}}
                    onClick={() => { setTurnFromFY(''); setTurnToFY(''); }}>✕</Btn>
                )}
              </div>
            </>
          )}

          <div style={{width:1, height:24, background:'var(--border)'}}/>
          <div style={{display:'flex', alignItems:'center', gap:8}}>
            <span style={{fontSize:11, fontWeight:600, color:'var(--text3)', whiteSpace:'nowrap'}}
              title={family.selfFilters ? 'Narrows 3(B) Specific Experience only' : undefined}>DURATION</span>
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

      {/* Sidebar beside the results, or a full-width setup bar above them when the
          family asks for it (bolpatra — see filtersOnTop). */}
      <div style={filtersOnTop
        ? {display:'flex', flexDirection:'column', gap:16}
        : {display:'flex', gap:20, alignItems:'flex-start'}}>

        {/* ── Filter panel ── */}
        <div className={filtersOnTop ? 'filter-panel filter-panel-top' : 'filter-panel'}>
          <div className="filter-panel-header">
            <span className="filter-panel-header-title">{filtersOnTop ? 'Set up the document' : 'Filters'}</span>
          </div>
          <div className={filtersOnTop ? 'filter-panel-body filter-grid' : 'filter-panel-body'}>

            {/* ENSSURE — missing data warning badge */}
            {familyId === 'enssure' && fullInst && enssureMissingCount > 0 && (
              <div style={{background:'#fff3cd', border:'1px solid #ffc107', borderRadius:6, padding:'8px 12px', marginBottom:8, fontSize:12, color:'#856404'}}>
                <strong>⚠ {enssureMissingCount} occupation row{enssureMissingCount !== 1 ? 's' : ''}</strong> missing skill test pass or employment data — C1 will show "—" for those fields.
              </div>
            )}

            {/* ENSSURE — D2/D3 tools occupation + level + events */}
            {familyId === 'enssure' && fullInst && (
              <div className="filter-section" style={{borderBottom:'2px solid var(--accent)', marginBottom:8, paddingBottom:12}}>
                <div className="filter-label" style={{fontWeight:700, color:'var(--accent)', marginBottom:6}}>D2/D3 — Tools Occupation</div>
                <input className="form-input" value={enssureToolsOccSearch} onChange={e => setEnssureToolsOccSearch(e.target.value)}
                  placeholder="Search occupation…" style={{fontSize:12, marginBottom:4}}/>
                <select className="form-input" style={{marginBottom:6}}
                  value={enssureToolsOccId}
                  onChange={e => setEnssureToolsOccId(e.target.value)}>
                  <option value="">— Select occupation —</option>
                  {occupations
                    .filter(o => !enssureToolsOccSearch || o.name.toLowerCase().includes(enssureToolsOccSearch.toLowerCase()))
                    .map(o => <option key={o.id} value={o.id}>{o.name}{o.level ? ` (${o.level})` : ''}</option>)}
                </select>
                <div className="filter-label" style={{marginBottom:4}}>Level</div>
                <select className="form-input" style={{marginBottom:6}} value={enssureToolsLevel} onChange={e => setEnssureToolsLevel(e.target.value)}>
                  <option>N/A</option><option>Level 1</option><option>Level 2</option><option>Level 3</option><option>Professional</option><option>Technician</option>
                </select>
                <div className="filter-label" style={{marginBottom:4}}>Number of Events (multiplier)</div>
                <input type="number" min="1" className="form-input" value={enssureEvents}
                  onChange={e => setEnssureEvents(Math.max(1, parseInt(e.target.value) || 1))}/>
                {enssureToolsOccId && <div style={{fontSize:10, color:'var(--text3)', marginTop:4}}>Quantities × {enssureEvents} shown in D2/D3.</div>}
              </div>
            )}

            {/* ENSSURE — Proposed Occupations selector (C2) */}
            {familyId === 'enssure' && fullInst && (
              <div className="filter-section" style={{borderBottom:'1px solid var(--border)', marginBottom:8, paddingBottom:12}}>
                <div className="filter-label" style={{justifyContent:'space-between', fontWeight:700, color:'var(--accent)'}}>
                  <span>Proposed Occupations (C2)</span>
                  {enssureOccIds.length > 0 && (
                    <Btn className="btn btn-ghost btn-sm" style={{fontSize:10, padding:'1px 5px'}} onClick={() => setEnssureOccIds([])}>Clear</Btn>
                  )}
                </div>
                <input className="form-input" value={enssureOccSearch} onChange={e => setEnssureOccSearch(e.target.value)}
                  placeholder="Search…" style={{fontSize:12, marginBottom:6}}/>
                <div className="multi-select-list" style={{maxHeight:180, overflowY:'auto'}}>
                  {occupations.filter(o => !enssureOccSearch || o.name.toLowerCase().includes(enssureOccSearch.toLowerCase())).map(o => (
                    <label key={o.id} className="multi-select-item">
                      <input type="checkbox" checked={enssureOccIds.includes(o.id)}
                        onChange={() => toggleEnssureOcc(o.id)}/>
                      <span>{o.name}{o.level ? ` (${o.level})` : ''}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Multi-institute selector (firm-wise) */}
            {isMultiInst && (
              <div className="filter-section">
                <div className="filter-label" style={{justifyContent:'space-between'}}>
                  <span>Firms</span>
                  {fwInstIds.length > 0 && (
                    <Btn className="btn btn-ghost btn-sm" style={{fontSize:10, padding:'1px 5px'}}
                      onClick={() => { setFwInstIds([]); setFwLeadId(null); }}>Clear</Btn>
                  )}
                </div>

                {/* Selected firms, with the JV lead chosen explicitly rather than
                    inferred from which box happened to be ticked first. */}
                {fwInstIds.length > 0 && (
                  <div style={{marginBottom:8, border:'1px solid var(--border)', borderRadius:6, overflow:'hidden',
                    background:'var(--surface)'}}>
                    <div style={{fontSize:10, fontWeight:600, color:'var(--text3)', textTransform:'uppercase',
                      letterSpacing:'.4px', padding:'5px 8px', background:'var(--bg2)'}}>
                      {fwInstIds.length > 1
                        ? `Selected (${fwInstIds.length}) — mark the lead firm`
                        : 'Selected (1)'}
                    </div>
                    {fwInstIds.map(id => {
                      const i = institutes.find(x => x.id === id);
                      if (!i) return null;
                      const isLead = fwLeadId === id;
                      return (
                        <div key={id} style={{display:'flex', alignItems:'center', gap:8, padding:'6px 8px',
                          borderTop:'1px solid var(--border)', fontSize:12}}>
                          {fwInstIds.length > 1 && (
                            /* margin:0 overrides the global `label { display:block;
                               margin-bottom:6px }`, which pushed this out of the row
                               and let the firm name overlap the role chip. */
                            <label style={{display:'flex', alignItems:'center', gap:5, margin:0,
                              flexShrink:0, cursor:'pointer', whiteSpace:'nowrap'}}
                              title={isLead ? 'Lead firm' : 'Mark as lead firm'}>
                              <input type="radio" name="fw-lead" checked={isLead} onChange={() => setFwLeadId(id)}
                                style={{margin:0}}/>
                              <span style={{fontSize:10, fontWeight:700, width:30, display:'inline-block',
                                color: isLead ? 'var(--accent)' : 'var(--text3)'}}>
                                {isLead ? 'LEAD' : 'JV'}
                              </span>
                            </label>
                          )}
                          <span style={{flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}
                            title={i.name}>{i.acronym || i.name}</span>
                          <button onClick={() => toggleFwInst(id)} aria-label={`Remove ${i.acronym || i.name}`}
                            style={{background:'none', border:'none', cursor:'pointer', color:'var(--text3)', padding:0, lineHeight:1}}>
                            <span className="material-icons-round" style={{fontSize:15}}>close</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                <input className="form-input" value={fwInstSearch} onChange={e => setFwInstSearch(e.target.value)}
                  placeholder="Search to add…" style={{fontSize:12, marginBottom:6}}/>
                <div className="multi-select-list" style={{maxHeight:200, overflowY:'auto'}}>
                  {institutes.filter(i => !fwInstSearch || i.name.toLowerCase().includes(fwInstSearch.toLowerCase()) || (i.acronym||'').toLowerCase().includes(fwInstSearch.toLowerCase())).map(i => (
                    <label key={i.id} className="multi-select-item">
                      <input type="checkbox" checked={fwInstIds.includes(i.id)} onChange={() => toggleFwInst(i.id)}/>
                      <span>{i.acronym || i.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* 4(B) tools level — occupation_tools are stored per level, and the
                occupations themselves come from the shared Occupation filter. */}
            {report.hasToolsPicker && (
              <div className="filter-section">
                <div className="filter-label">Tools level — 4(B)</div>
                <select className="form-input" value={eoiToolsLevel} onChange={e => setEoiToolsLevel(e.target.value)}>
                  <option>N/A</option><option>Level 1</option><option>Level 2</option>
                  <option>Level 3</option><option>Professional</option><option>Technician</option>
                </select>
                <div className="filter-label" style={{marginTop:12}}>Training events per occupation</div>
                {eoiOccIds.length === 0 ? (
                  <div className="input-hint">Pick occupations below to list their tools.</div>
                ) : (
                  <>
                    {eoiOccIds.map(id => {
                      const o = occupations.find(x => x.id === id);
                      const n = eoiEventsByOcc[id] ?? 1;
                      return (
                        <div key={id} style={{display:'flex', alignItems:'center', gap:8, marginBottom:6}}>
                          <span style={{flex:1, minWidth:0, fontSize:12, overflow:'hidden',
                            textOverflow:'ellipsis', whiteSpace:'nowrap'}} title={o?.name}>{o?.name || id}</span>
                          <input type="number" min="1" className="form-input" value={n}
                            style={{width:68, flexShrink:0, padding:'4px 8px', fontSize:12}}
                            onChange={e => setEoiEventsByOcc(prev => ({
                              ...prev, [id]: Math.max(1, parseInt(e.target.value) || 1),
                            }))}/>
                        </div>
                      );
                    })}
                    <div className="input-hint" style={{marginTop:2}}>
                      Quantities are per event and scale by each occupation&rsquo;s count.
                    </div>
                  </>
                )}

              </div>
            )}

            {report.hasToolsPicker && (
              <div className="filter-section">
                <div className="filter-label">Include types</div>
                <div className="multi-select-list">
                  {TOOL_TYPE_OPTIONS.map(t => (
                    <label key={t} className="multi-select-item">
                      <input type="checkbox"
                        checked={eoiToolTypes.length === 0 || eoiToolTypes.includes(t)}
                        onChange={() => setEoiToolTypes(prev => {
                          // Empty means "all"; the first tick narrows from the full set.
                          const cur = prev.length ? prev : TOOL_TYPE_OPTIONS;
                          const next = cur.includes(t) ? cur.filter(x => x !== t) : [...cur, t];
                          return next.length === TOOL_TYPE_OPTIONS.length ? [] : next;
                        })}/>
                      <span>{t}</span>
                    </label>
                  ))}
                </div>

              </div>
            )}

            {report.hasToolsPicker && (
              <div className="filter-section">
                <div className="filter-label">Columns</div>
                <div className="multi-select-list">
                  {TOOL_COLUMN_OPTIONS.map(c => (
                    <label key={c.key} className="multi-select-item">
                      <input type="checkbox" checked={eoiToolCols.includes(c.key)}
                        disabled={c.key === 'sn' || c.key === 'name'}
                        onChange={() => setEoiToolCols(prev => prev.includes(c.key)
                          ? prev.filter(x => x !== c.key) : [...prev, c.key])}/>
                      <span>{c.label}</span>
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
                    <option>N/A</option><option>Level 1</option><option>Level 2</option><option>Level 3</option><option>Professional</option>
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
                  <div className="filter-label">Number of Groups</div>
                  <input
                    type="number" min="1" className="form-input"
                    value={numGroups}
                    onChange={e => setNumGroups(Math.max(1, parseInt(e.target.value) || 1))}
                    style={{width:'100%'}}
                  />
                  <div style={{fontSize:11, color:'var(--text3)', marginTop:3}}>
                    Quantities entered are for 1 group (20 trainees). Total = qty × groups.
                  </div>
                </div>

                <div className="filter-section">
                  <div className="filter-label">Columns</div>
                  <div className="multi-select-list">
                    {TOOLS_ALL_COLS.map(c => (
                      <label key={c.key} className="multi-select-item">
                        <input type="checkbox" checked={toolsColumns.includes(c.key)} onChange={() => toggleToolsCol(c.key)}
                          disabled={c.key === 'sn' || c.key === 'name'}/>
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
                    <Btn className="btn btn-ghost btn-sm" style={{fontSize:10, padding:'1px 5px'}} onClick={selectAll}>All</Btn>
                    <Btn className="btn btn-ghost btn-sm" style={{fontSize:10, padding:'1px 5px'}} onClick={clearAll}>None</Btn>
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
                <div className="empty-state-sub">
                  Pick one or more firms {filtersOnTop ? 'above' : 'in the sidebar'}, set the filters, then show the report
                </div>
              </div>
            ) : fwLoading ? (
              <div className="empty-state" style={{background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)'}}>
                <div className="empty-state-icon">⏳</div>
                <div className="empty-state-title">Loading…</div>
              </div>
            ) : renderedSig === null ? (
              /* Filters first, document second: nothing is built until asked. */
              <div className="empty-state" style={{background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)'}}>
                <div className="empty-state-icon">
                  <span className="material-icons-round" style={{fontSize:44, opacity:.35}}>tune</span>
                </div>
                <div className="empty-state-title">Ready when you are</div>
                <div className="empty-state-sub" style={{marginBottom:16}}>
                  {fwInstIds.length} firm{fwInstIds.length !== 1 ? 's' : ''} selected.
                  Finish setting the filters {filtersOnTop ? 'above' : 'on the left'}, then build the document.
                </div>
                <Btn className="btn btn-primary" onClick={showReport}>Show report</Btn>
              </div>
            ) : (
              <div style={{display:'flex', flexDirection:'column', gap:16}}>
                {/* Filters changed after the document was built — say so rather
                    than leaving a document on screen that no longer matches. */}
                {isStale && (
                  <div role="status" style={{display:'flex', alignItems:'center', gap:10, flexWrap:'wrap',
                    padding:'10px 16px', borderRadius:'var(--radius-lg)',
                    background:'color-mix(in srgb, var(--warning,#f59e0b) 12%, var(--surface))',
                    border:'1px solid color-mix(in srgb, var(--warning,#f59e0b) 35%, transparent)'}}>
                    <span className="material-icons-round" style={{fontSize:17, color:'var(--warning,#f59e0b)'}}>update</span>
                    <span style={{fontSize:12.5}}>Filters changed — this document was built with the previous settings.</span>
                    <Btn className="btn btn-primary btn-sm" style={{marginLeft:'auto'}} onClick={showReport}>Rebuild</Btn>
                  </div>
                )}
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
                    {family.downloadMultiDOCX && (
                      <Btn className="btn btn-secondary btn-sm"
                        onClick={() => family.downloadMultiDOCX(fwSelectedFirms(), clients, report.id, opts)}
                        disabled={fwInstIds.length === 0 || isStale}
                        title={isStale ? 'Rebuild first — the filters have changed since this was built' : undefined}>⬇ Word (.docx)</Btn>
                    )}
                    <Btn className="btn btn-primary btn-sm" onClick={() => {
                      const firms = fwSelectedFirms();
                      if (!firms.length) return;
                      let combined;
                      if (family.buildMultiPrintHTML) {
                        // Family controls cross-firm ordering (bolpatra groups by
                        // section, not by firm).
                        combined = family.buildMultiPrintHTML(firms, clients, report.id, fyRangeLabel, opts);
                      } else {
                        const docs = firms
                          .map(({ inst, exps }) => family.buildPrintHTML(inst, exps, clients, report.id, fyRangeLabel, opts))
                          .filter(Boolean);
                        if (!docs.length) return;
                        const bodyParts = docs.map(html => {
                          const m = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
                          return m ? m[1] : '';
                        });
                        combined = docs[0].replace(/<body[^>]*>[\s\S]*<\/body>/i,
                          `<body>${bodyParts.join('<div style="page-break-before:always"></div>')}</body>`);
                      }
                      const w = window.open('', '_blank');
                      w.document.write(combined);
                      w.document.close();
                      setTimeout(() => w.print(), 300);
                    }} disabled={fwInstIds.length === 0 || isStale}
                      title={isStale ? 'Rebuild first — the filters have changed since this was built' : undefined}>🖨 Print / PDF</Btn>
                  </div>
                </div>

                {/* Cross-firm comparative table for NSTB */}
                {report.id === 'fw2' && nstbComparative && (() => {
                  // Collect all occupations and per-firm appeared totals
                  const firmData = fwInstIds.map(id => {
                    const inst = fwFullInsts[id];
                    if (!inst) return null;
                    const records = (inst.nstb || []).filter(n => fyInRange(n.fy, fromFY || null, toFY || null));
                    const byOcc = {};
                    let allAppearedTotal = 0;
                    for (const n of records) {
                      const name = (n.occupation || '').trim();
                      if (!name) continue;
                      allAppearedTotal += parseInt(n.appeared) || 0;
                      if (selectedOccs.length && !selectedOccs.some(o => o.toLowerCase() === name.toLowerCase())) continue;
                      if (!byOcc[name]) byOcc[name] = 0;
                      byOcc[name] += parseInt(n.appeared) || 0;
                    }
                    return { id, name: inst.acronym || inst.name || id, byOcc, allAppearedTotal };
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
                            <td style={TD2}>Selected Occupations Total</td>
                            {firmData.map((f, j) => {
                              const t = allOccs.reduce((s, occ) => s + (f.byOcc[occ] || 0), 0);
                              return <td key={j} style={TDN2}>{t || '—'}</td>;
                            })}
                          </tr>
                          <tr style={{background:'#d0e4f7', fontWeight:700, borderTop:'2px solid #aab8c8'}}>
                            <td style={TD2}>Total Skill Test (All Occupations)</td>
                            {firmData.map((f, j) => (
                              <td key={j} style={TDN2}>{f.allAppearedTotal || '—'}</td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  );
                })()}

                {/* Families that order across firms themselves render one block
                    covering every selected firm (bolpatra groups by section). */}
                {family.renderMultiAggregate ? (
                  <div className="card" style={{padding:20}}>
                    {family.renderMultiAggregate(fwSelectedFirms(), clients, report.id, opts)}
                  </div>
                ) : fwInstIds.map(id => {
                  const inst = fwFullInsts[id];
                  if (!inst) return null;
                  const exps = fwExpsFor(inst);
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
                    <Btn className="btn btn-secondary btn-sm" onClick={handleCSV} disabled={!activeExps.length}>⬇ CSV</Btn>
                  )}
                  {isAggregate && family.downloadDOCX && (
                    <Btn className="btn btn-secondary btn-sm" onClick={handleWord} disabled={!canPrint}>⬇ Word (.docx)</Btn>
                  )}
                  <Btn className="btn btn-primary btn-sm" onClick={noInstitute ? handlePrintTools : handlePrint} disabled={!canPrint}>🖨 Print / PDF</Btn>
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
                                ? <span style={{color:'var(--warning)'}} title={`Missing: ${missing.join(', ')}`}><span className="material-icons-round" style={{fontSize:12,verticalAlign:'middle'}}>warning</span> {missing.length} field{missing.length !== 1 ? 's' : ''}</span>
                                : <span style={{color:'var(--green)'}}><span className="material-icons-round" style={{fontSize:12,verticalAlign:'middle'}}>check_circle</span></span>}
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

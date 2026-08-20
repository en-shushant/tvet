import { useState, useEffect, useMemo } from 'react';
import { getSession } from '../utils/auth.js';
import { api, normInst } from '../utils/api.js';
import { exportToCSV } from '../utils/export.js';
import { Btn } from '../md.jsx';
import { fyInRange, fyYear } from '../reports/helpers.js';
import { FISCAL_YEARS } from '../constants/data.js';
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

const WIZARD_STEPS = ['Report', 'Data & Filters', 'Configure', 'Preview'];

function ReportsView({ institutes, clients }) {
  const f = loadFilters();
  const [familyId, setFamilyId]         = useState(f.familyId || REPORT_FAMILIES[0].id);
  // Deliberately not seeded from persisted filters — restoring the last
  // selected firm here reloads its report the instant the page opens, before
  // the user has chosen anything this visit.
  const [selectedInst, setSelectedInst] = useState('');
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
  // Portfolio years (bagmati B.1) are also independent — a "current portfolio"
  // window doesn't have to match the experience tables' FY range.
  const [portfolioFromFY, setPortfolioFromFY] = useState(f.portfolioFromFY || '');
  const [portfolioToFY, setPortfolioToFY]     = useState(f.portfolioToFY || '');
  const [selectedOccs, setSelectedOccs] = useState([]); // for Table 3 occupation filter, and 4(B) tools
  /**
   * 3(B) Specific Experience's own occupation selection.
   *
   * Kept independent of `selectedOccs` (which drives the 4(B) tools list): a bid
   * wants tools limited to the occupations being tendered for, while the
   * "similar assignments" shown as experience are often a different, broader
   * set. Tying both to one control meant narrowing the tools list silently
   * narrowed the experience too.
   */
  const [eoiSpecificOccs, setEoiSpecificOccs] = useState(f.eoiSpecificOccs || []);
  /**
   * One tools schedule for all selected occupations, instead of a table each.
   *
   * The same drill appears under three trades; a bid wants the total, not three
   * tables to add up. Off by default — the per-occupation breakdown is what the
   * form asks for, and some clients want to see it that way.
   */
  const [eoiCombineTools, setEoiCombineTools] = useState(f.eoiCombineTools ?? false);
  const [eoiSingleTable, setEoiSingleTable] = useState(f.eoiSingleTable ?? false);
  const [occupations, setOccupations]   = useState([]);
  const [sortBy, setSortBy]             = useState('default'); // for Table 2 occupation sort
  const [filterTrainingTypes, setFilterTrainingTypes] = useState([]); // Helvetas training type filter
  const [filterDuration, setFilterDuration] = useState(f.filterDuration || ''); // Helvetas duration filter
  const [filterDonorTypes, setFilterDonorTypes] = useState([]); // Donor/client type filter
  const [occSearch, setOccSearch] = useState('');
  const [toolsOccSearch2, setToolsOccSearch2] = useState(''); // search for the separate 4(B) tools occupation picker (bolpatra 'full')
  const [firmSearch, setFirmSearch] = useState(''); // single-firm search list (UI only, not persisted)

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
  // The rendered document (or Tools schedule / multi-firm doc) is only built when
  // asked — everything in this component before that is "configuration". Holds
  // the filter signature that was last shown, so we can tell when the on-screen
  // preview has gone out of date against the current controls.
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

  // Which configuration section the right-hand panel is showing.
  const [activeSection, setActiveSection] = useState('firms');

  // Persist key filter state to sessionStorage
  useEffect(() => { saveFilters({ familyId, selectedInst, reportId, fromFY, toFY, turnFromFY, turnToFY, portfolioFromFY, portfolioToFY, eoiToolsLevel, eoiEventsByOcc, eoiToolCols, eoiToolTypes, eoiSpecificOccs, eoiCombineTools, eoiSingleTable, filterDuration, enssureOccIds, enssureToolsOccId, enssureToolsLevel, enssureEvents }); },
    [familyId, selectedInst, reportId, fromFY, toFY, turnFromFY, turnToFY, portfolioFromFY, portfolioToFY, eoiToolsLevel, eoiEventsByOcc, eoiToolCols, eoiToolTypes, eoiSpecificOccs, eoiCombineTools, eoiSingleTable, filterDuration, enssureOccIds, enssureToolsOccId, enssureToolsLevel, enssureEvents]);

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
  const filtersOnTop = !!family.filtersOnTop; // still read; no longer changes layout, kept for compatibility
  const noInstitute = !!family.noInstitute;
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

  // All FYs across assignments + tax clearance + NSTB records, plus the
  // app-wide fiscal years list — so a range filter (especially the
  // forward-looking ones like Portfolio FY) can reach a year the org has
  // defined even before any record is actually dated in it.
  const allFYs = useMemo(() => {
    if (isMultiInst) {
      const fys = new Set(FISCAL_YEARS);
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
    return [...new Set([...FISCAL_YEARS, ...expFYs, ...taxFYs, ...nstbFYs])].sort();
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

  // Every occupation in the master list, not just the ones the firm already has
  // recorded experience in. The bolpatra pickers (3(B) and 4(B) tools) need the
  // full list — a firm can propose an occupation, or need its tools listed, that
  // it has no past assignments for yet, and the picker shouldn't hide it.
  const allMasterOccNames = useMemo(() =>
    [...new Set(occupations.map(o => o.name).filter(Boolean))].sort(),
    [occupations]);

  const toggleOcc = (name) =>
    setSelectedOccs(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]);

  const toggleSpecificOcc = (name) =>
    setEoiSpecificOccs(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]);

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
    portfolioFromFY, portfolioToFY,
    bolpatraTools: eoiTools, eoiToolsLevel, eoiEventsByOcc, eoiToolCols, eoiToolTypes, selectedOccs,
    specificOccs: eoiSpecificOccs, eoiCombineTools, eoiSingleTable, occupations, sortBy,
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

  // Everything the rendered preview depends on, across every family (single
  // firm, multi-firm, or the firm-less Tools schedule) — compared against
  // renderedSig to show whether what is on screen still matches the controls.
  const filterSig = JSON.stringify([
    reportId, familyId, selectedInst, fwInstIds, fwLeadId,
    fromFY, toFY, turnFromFY, turnToFY, portfolioFromFY, portfolioToFY,
    selectedOccs, eoiSpecificOccs, filterDuration, filterDonorTypes, filterTrainingTypes, sortBy,
    eoiToolsLevel, eoiEventsByOcc, eoiToolCols, eoiToolTypes, eoiCombineTools, eoiSingleTable,
    toolsOccIds, toolsLevel, toolsTypeFilter, toolsColumns, toolsLayout, numGroups,
    enssureOccIds, enssureToolsOccId, enssureToolsLevel, enssureEvents,
  ]);
  const isStale = renderedSig !== null && renderedSig !== filterSig;
  const previewReady = renderedSig !== null;
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

  // Whether the "Preview Report" action is available at all — same gate as
  // canPrint for single-firm/no-firm reports, plus a firm-count gate for
  // multi-firm ones.
  const canPreview = noInstitute
    ? (toolsOccIds.length > 0 && !!toolsLevel)
    : isMultiInst ? fwInstIds.length > 0
    : !!fullInst;

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

  const handleReset = () => {
    setFromFY(''); setToFY(''); setFilterDuration('');
    setFilterTrainingTypes([]); setFilterDonorTypes([]);
    setSelectedOccs([]); setEoiSpecificOccs([]); setSelectedIds(null);
    setOccSearch(''); setToolsOccSearch2(''); setFirmSearch('');
    setRenderedSig(null);
  };

  // ── Which setup sections apply to the current family/report ──────────────
  const hasOccSection = report.hasOccupationFilter || report.hasSpecificOccFilter || noInstitute || (familyId === 'enssure' && !!fullInst);
  const hasToolsSection = report.hasToolsPicker || noInstitute || (familyId === 'enssure' && !!fullInst);
  const hasToolTypesSection = report.hasToolsPicker || noInstitute;
  const hasColumnsSection = report.hasToolsPicker || noInstitute;
  const hasFiltersSection = !noInstitute && (fullInst || isMultiInst);
  const hasAdvancedSection = !noInstitute && !isMultiInst && !!fullInst;

  const SECTIONS = [
    { id: 'firms', label: 'Firms', show: true },
    { id: 'occupations', label: 'Occupations', show: hasOccSection },
    { id: 'tools', label: 'Training Tools', show: hasToolsSection },
    { id: 'toolTypes', label: 'Tool Types', show: hasToolTypesSection },
    { id: 'columns', label: 'Columns', show: hasColumnsSection },
    { id: 'filters', label: 'Filters', show: hasFiltersSection },
    { id: 'advanced', label: 'Advanced', show: hasAdvancedSection },
  ].filter(s => s.show);

  useEffect(() => {
    if (!SECTIONS.some(s => s.id === activeSection)) setActiveSection('firms');
  }, [familyId, reportId]);

  // ── Summary bar — dynamic, clickable chips ────────────────────────────────
  const firmsCount = isMultiInst ? fwInstIds.length : (selectedInst ? 1 : 0);
  const occCount = (report.hasSpecificOccFilter ? eoiSpecificOccs.length : 0)
    + (report.hasOccupationFilter && !report.hasSpecificOccFilter ? selectedOccs.length : 0)
    + (report.hasOccupationFilter && report.hasSpecificOccFilter && report.hasToolsPicker ? selectedOccs.length : 0)
    + (familyId === 'enssure' ? enssureOccIds.length : 0);
  const levelLabel = report.hasToolsPicker ? eoiToolsLevel
    : noInstitute ? (toolsLevel || 'No level')
    : familyId === 'enssure' ? enssureToolsLevel
    : null;
  const toolTypesCount = report.hasToolsPicker ? (eoiToolTypes.length || TOOL_TYPE_OPTIONS.length)
    : noInstitute ? 1
    : null;
  const columnsCount = report.hasToolsPicker ? eoiToolCols.length
    : noInstitute ? toolsColumns.length
    : null;
  const filtersActiveCount = [
    !!(fromFY || toFY), !!(turnFromFY || turnToFY), !!(portfolioFromFY || portfolioToFY),
    !!filterDuration, filterDonorTypes.length > 0, filterTrainingTypes.length > 0,
  ].filter(Boolean).length;

  const summaryChips = [
    { section: 'firms', text: `${firmsCount} Firm${firmsCount !== 1 ? 's' : ''}`, show: true },
    { section: 'occupations', text: `${occCount} Occupation${occCount !== 1 ? 's' : ''}`, show: hasOccSection },
    { section: 'tools', text: levelLabel, show: hasToolsSection && !!levelLabel },
    { section: 'toolTypes', text: `${toolTypesCount} Tool Type${toolTypesCount !== 1 ? 's' : ''}`, show: hasToolTypesSection },
    { section: 'columns', text: `${columnsCount} Column${columnsCount !== 1 ? 's' : ''}`, show: hasColumnsSection },
    { section: 'filters', text: `Filters · ${filtersActiveCount} active`, show: hasFiltersSection },
  ].filter(c => c.show);

  // How many assignments the current configuration matches — used for the
  // prominent results number. Never hard-coded; always the real derived value.
  const matchingCount = noInstitute ? null
    : isMultiInst
      ? fwInstIds.reduce((sum, id) => sum + (fwFullInsts[id] ? fwExpsFor(fwFullInsts[id]).length : 0), 0)
      : activeExps.length;

  // Rough progress indicator — purely visual, never blocks navigation.
  const wizardStepIndex = !selectedInst && !isMultiInst && !fwInstIds.length ? 0
    : (isMultiInst ? fwInstIds.length === 0 : !fullInst) ? 1
    : !previewReady ? 2
    : 3;

  return (
    <div className="fade-in reports-redesign" style={{display:'flex', flexDirection:'column', gap:18, paddingBottom:8}}>

      {/* ── Header ── */}
      <div>
        <div style={{fontSize:23, fontWeight:700, color:'var(--text)', letterSpacing:-.3}}>Reports</div>
        <div style={{fontSize:13, color:'var(--text3)', marginTop:4}}>
          Create, configure and generate professional reports from your procurement and training data.
        </div>
        <div style={{display:'flex', alignItems:'center', gap:6, marginTop:12, fontSize:11.5, fontWeight:600, flexWrap:'wrap'}}>
          {WIZARD_STEPS.map((s, i) => (
            <span key={s} style={{display:'flex', alignItems:'center', gap:6}}>
              {i > 0 && <span style={{color:'var(--border)'}}>→</span>}
              <span style={{
                color: i === wizardStepIndex ? 'var(--primary)' : i < wizardStepIndex ? 'var(--text2)' : 'var(--text3)',
                padding:'3px 9px', borderRadius:100,
                background: i === wizardStepIndex ? 'var(--primary-light,#eff6ff)' : 'transparent',
              }}>
                {String(i + 1).padStart(2, '0')} {s}
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Report configuration ── */}
      <div className="card" style={{padding:'18px 20px'}}>
        <div style={{fontWeight:600, fontSize:14, marginBottom:14, color:'var(--text)'}}>Report Configuration</div>
        <div style={{display:'flex', gap:16, flexWrap:'wrap'}}>
          <div>
            <div style={{fontSize:11, fontWeight:600, color:'var(--text3)', marginBottom:5}}>REPORT FAMILY</div>
            <select className="form-input" style={{width:'auto', minWidth:200}} value={familyId} onChange={e => setFamilyId(e.target.value)}>
              {REPORT_FAMILIES.map(fam => <option key={fam.id} value={fam.id}>{fam.label}</option>)}
            </select>
          </div>
          <div>
            <div style={{fontSize:11, fontWeight:600, color:'var(--text3)', marginBottom:5}}>REPORT TYPE</div>
            <select className="form-input" style={{width:'auto', minWidth:260}} value={reportId} onChange={e => setReportId(e.target.value)}>
              {family.reports.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>
        </div>
        {report.description && (
          <div style={{fontSize:12, color:'var(--text3)', marginTop:12, fontStyle:'italic'}}>{report.description}</div>
        )}
      </div>

      {/* ── Configuration workspace: left nav + right panel ── */}
      <div className="card" style={{display:'flex', overflow:'hidden', padding:0, minHeight:360}}>
        <div style={{width:180, flexShrink:0, borderRight:'1px solid var(--border)', padding:'16px 0', background:'var(--bg,#f8fafc)'}}>
          <div style={{fontSize:10.5, fontWeight:700, color:'var(--text3)', letterSpacing:'.6px', padding:'0 18px 10px'}}>REPORT SETUP</div>
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)}
              style={{
                display:'flex', alignItems:'center', gap:9, width:'100%', textAlign:'left',
                padding:'10px 18px', border:'none', cursor:'pointer', fontSize:13,
                background: activeSection === s.id ? 'var(--primary-light,#eff6ff)' : 'transparent',
                borderLeft: activeSection === s.id ? '3px solid var(--primary)' : '3px solid transparent',
                fontWeight: activeSection === s.id ? 600 : 500,
                color: activeSection === s.id ? 'var(--primary)' : 'var(--text2)',
              }}>
              <span style={{fontSize:9, lineHeight:1}}>{activeSection === s.id ? '●' : '○'}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>

        <div style={{flex:1, minWidth:0, padding:'20px 22px', overflowY:'auto'}}>

          {/* ── FIRMS ── */}
          {activeSection === 'firms' && (
            <div>
              <div style={{fontWeight:600, fontSize:14, marginBottom:12}}>Select Firms</div>

              {isMultiInst ? (
                <>
                  <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:8}}>
                    <input className="form-input" value={fwInstSearch} onChange={e => setFwInstSearch(e.target.value)}
                      placeholder="Search firms…" style={{flex:1}}/>
                    {fwInstIds.length > 0 && (
                      <Btn className="btn btn-ghost btn-sm" onClick={() => { setFwInstIds([]); setFwLeadId(null); }}>Clear</Btn>
                    )}
                  </div>

                  {fwInstIds.length > 0 && (
                    <div style={{marginBottom:12, border:'1px solid var(--border)', borderRadius:10, overflow:'hidden', background:'var(--surface)'}}>
                      <div style={{fontSize:10.5, fontWeight:600, color:'var(--text3)', textTransform:'uppercase',
                        letterSpacing:'.4px', padding:'6px 10px', background:'var(--bg2)'}}>
                        {fwInstIds.length > 1 ? `Selected (${fwInstIds.length}) — mark the lead firm` : 'Selected (1)'}
                      </div>
                      {fwInstIds.map(id => {
                        const i = institutes.find(x => x.id === id);
                        if (!i) return null;
                        const isLead = fwLeadId === id;
                        return (
                          <div key={id} style={{display:'flex', alignItems:'center', gap:8, padding:'7px 10px',
                            borderTop:'1px solid var(--border)', fontSize:12.5}}>
                            {fwInstIds.length > 1 && (
                              <label style={{display:'flex', alignItems:'center', gap:5, margin:0,
                                flexShrink:0, cursor:'pointer', whiteSpace:'nowrap'}}
                                title={isLead ? 'Lead firm' : 'Mark as lead firm'}>
                                <input type="radio" name="fw-lead" checked={isLead} onChange={() => setFwLeadId(id)} style={{margin:0}}/>
                                <span style={{fontSize:10, fontWeight:700, width:30, display:'inline-block',
                                  color: isLead ? 'var(--primary)' : 'var(--text3)'}}>
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

                  <div className="multi-select-list" style={{maxHeight:280, overflowY:'auto'}}>
                    {institutes.filter(i => !fwInstSearch || i.name.toLowerCase().includes(fwInstSearch.toLowerCase()) || (i.acronym||'').toLowerCase().includes(fwInstSearch.toLowerCase())).map(i => (
                      <label key={i.id} className="multi-select-item">
                        <input type="checkbox" checked={fwInstIds.includes(i.id)} onChange={() => toggleFwInst(i.id)}/>
                        <span>{i.acronym || i.name}</span>
                      </label>
                    ))}
                  </div>
                  <div style={{fontSize:12, color:'var(--text3)', marginTop:10}}>{fwInstIds.length} firm{fwInstIds.length !== 1 ? 's' : ''} selected</div>
                </>
              ) : noInstitute ? (
                <div style={{fontSize:12.5, color:'var(--text3)'}}>This report doesn't require a firm — configure the occupations and tools below instead.</div>
              ) : (
                <>
                  <input className="form-input" value={firmSearch} onChange={e => setFirmSearch(e.target.value)}
                    placeholder="Search firms…" style={{width:'100%', marginBottom:8}}/>
                  <div className="multi-select-list" style={{maxHeight:320, overflowY:'auto'}}>
                    {institutes
                      .filter(i => !firmSearch || i.name.toLowerCase().includes(firmSearch.toLowerCase()) || (i.acronym||'').toLowerCase().includes(firmSearch.toLowerCase()))
                      .map(i => (
                        <label key={i.id} className="multi-select-item">
                          <input type="radio" name="single-firm" checked={String(selectedInst) === String(i.id)}
                            onChange={() => setSelectedInst(i.id)}/>
                          <span>{i.acronym ? `${i.acronym} — ` : ''}{i.name}</span>
                        </label>
                      ))}
                  </div>
                  <div style={{fontSize:12, color:'var(--text3)', marginTop:10}}>{selectedInst ? '1 firm selected' : 'No firm selected'}</div>
                  {loadingInst && <div style={{fontSize:12, color:'var(--text3)', marginTop:6}}>Loading firm data…</div>}
                </>
              )}
            </div>
          )}

          {/* ── OCCUPATIONS ── */}
          {activeSection === 'occupations' && (
            <div style={{display:'flex', flexDirection:'column', gap:22}}>

              {familyId === 'enssure' && fullInst && (
                <div>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
                    <div style={{fontWeight:600, fontSize:13.5}}>Proposed Occupations (C2)</div>
                    {enssureOccIds.length > 0 && (
                      <Btn className="btn btn-ghost btn-sm" onClick={() => setEnssureOccIds([])}>Clear</Btn>
                    )}
                  </div>
                  <input className="form-input" value={enssureOccSearch} onChange={e => setEnssureOccSearch(e.target.value)}
                    placeholder="Search…" style={{marginBottom:8}}/>
                  <div className="multi-select-list" style={{maxHeight:220, overflowY:'auto'}}>
                    {occupations.filter(o => !enssureOccSearch || o.name.toLowerCase().includes(enssureOccSearch.toLowerCase())).map(o => (
                      <label key={o.id} className="multi-select-item">
                        <input type="checkbox" checked={enssureOccIds.includes(o.id)} onChange={() => toggleEnssureOcc(o.id)}/>
                        <span>{o.name}{o.level ? ` (${o.level})` : ''}</span>
                      </label>
                    ))}
                  </div>
                  <div style={{fontSize:12, color:'var(--text3)', marginTop:8}}>{enssureOccIds.length} occupation{enssureOccIds.length !== 1 ? 's' : ''} selected</div>
                  {enssureOccIds.length > 0 && (
                    <div style={{display:'flex', flexWrap:'wrap', gap:6, marginTop:8}}>
                      {enssureOccs.map((name, i) => (
                        <span key={i} style={{display:'flex', alignItems:'center', gap:5, fontSize:11.5,
                          background:'var(--primary-light,#eff6ff)', color:'var(--primary)', borderRadius:100, padding:'3px 6px 3px 10px'}}>
                          {name}
                          <button onClick={() => toggleEnssureOcc(enssureOccIds[i])}
                            style={{background:'none', border:'none', cursor:'pointer', color:'inherit', display:'flex', padding:0}}>
                            <span className="material-icons-round" style={{fontSize:13}}>close</span>
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {report.hasSpecificOccFilter && allMasterOccNames.length > 0 && (
                <div>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
                    <div style={{fontWeight:600, fontSize:13.5}}>Occupation — 3(B) Specific Experience</div>
                    {eoiSpecificOccs.length > 0 && (
                      <Btn className="btn btn-ghost btn-sm" onClick={() => setEoiSpecificOccs([])}>Clear</Btn>
                    )}
                  </div>
                  <input className="form-input" value={occSearch} onChange={e => setOccSearch(e.target.value)}
                    placeholder="Search…" style={{marginBottom:8}}/>
                  <div className="multi-select-list" style={{maxHeight:220, overflowY:'auto'}}>
                    {allMasterOccNames.filter(n => !occSearch || n.toLowerCase().includes(occSearch.toLowerCase())).map(name => (
                      <label key={name} className="multi-select-item">
                        <input type="checkbox" checked={eoiSpecificOccs.includes(name)} onChange={() => toggleSpecificOcc(name)}/>
                        <span>{name}</span>
                      </label>
                    ))}
                  </div>
                  <div style={{fontSize:12, color:'var(--text3)', marginTop:8}}>{eoiSpecificOccs.length} selected</div>
                </div>
              )}

              {report.hasOccupationFilter && !report.hasSpecificOccFilter && (report.hasToolsPicker ? allMasterOccNames : allOccNames).length > 0 && (
                <div>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
                    <div style={{fontWeight:600, fontSize:13.5}}>{report.hasToolsPicker ? 'Occupation — 4(B) Tools' : 'Occupations'}</div>
                    {selectedOccs.length > 0 && (
                      <Btn className="btn btn-ghost btn-sm" onClick={() => setSelectedOccs([])}>Clear</Btn>
                    )}
                  </div>
                  <input className="form-input" value={occSearch} onChange={e => setOccSearch(e.target.value)}
                    placeholder="Search…" style={{marginBottom:8}}/>
                  <div className="multi-select-list" style={{maxHeight:220, overflowY:'auto'}}>
                    {(report.hasToolsPicker ? allMasterOccNames : allOccNames).filter(n => !occSearch || n.toLowerCase().includes(occSearch.toLowerCase())).map(name => (
                      <label key={name} className="multi-select-item">
                        <input type="checkbox" checked={selectedOccs.includes(name)} onChange={() => toggleOcc(name)}/>
                        <span>{name}</span>
                      </label>
                    ))}
                  </div>
                  <div style={{fontSize:12, color:'var(--text3)', marginTop:8}}>{selectedOccs.length} selected</div>
                  {selectedOccs.length > 0 && (
                    <div style={{display:'flex', flexWrap:'wrap', gap:6, marginTop:8}}>
                      {selectedOccs.map(name => (
                        <span key={name} style={{display:'flex', alignItems:'center', gap:5, fontSize:11.5,
                          background:'var(--primary-light,#eff6ff)', color:'var(--primary)', borderRadius:100, padding:'3px 6px 3px 10px'}}>
                          {name}
                          <button onClick={() => toggleOcc(name)}
                            style={{background:'none', border:'none', cursor:'pointer', color:'inherit', display:'flex', padding:0}}>
                            <span className="material-icons-round" style={{fontSize:13}}>close</span>
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {report.hasOccupationFilter && report.hasSpecificOccFilter && report.hasToolsPicker && allMasterOccNames.length > 0 && (
                <div>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
                    <div style={{fontWeight:600, fontSize:13.5}}>Occupation — 4(B) Tools</div>
                    {selectedOccs.length > 0 && (
                      <Btn className="btn btn-ghost btn-sm" onClick={() => setSelectedOccs([])}>Clear</Btn>
                    )}
                  </div>
                  <input className="form-input" value={toolsOccSearch2} onChange={e => setToolsOccSearch2(e.target.value)}
                    placeholder="Search…" style={{marginBottom:8}}/>
                  <div className="multi-select-list" style={{maxHeight:220, overflowY:'auto'}}>
                    {allMasterOccNames.filter(n => !toolsOccSearch2 || n.toLowerCase().includes(toolsOccSearch2.toLowerCase())).map(name => (
                      <label key={name} className="multi-select-item">
                        <input type="checkbox" checked={selectedOccs.includes(name)} onChange={() => toggleOcc(name)}/>
                        <span>{name}</span>
                      </label>
                    ))}
                  </div>
                  <div style={{fontSize:12, color:'var(--text3)', marginTop:8}}>{selectedOccs.length} selected</div>
                </div>
              )}

              {noInstitute && (
                <div>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8}}>
                    <div style={{fontWeight:600, fontSize:13.5}}>Occupations</div>
                    {toolsOccIds.length > 0 && (
                      <Btn className="btn btn-ghost btn-sm" onClick={() => setToolsOccIds([])}>Clear</Btn>
                    )}
                  </div>
                  <input className="form-input" value={toolsOccSearch} onChange={e => setToolsOccSearch(e.target.value)}
                    placeholder="Search…" style={{marginBottom:8}}/>
                  <div className="multi-select-list" style={{maxHeight:260, overflowY:'auto'}}>
                    {occupations.filter(o => !toolsOccSearch || o.name.toLowerCase().includes(toolsOccSearch.toLowerCase())).map(o => (
                      <label key={o.id} className="multi-select-item">
                        <input type="checkbox" checked={toolsOccIds.includes(o.id)} onChange={() => toggleToolsOcc(o.id)}/>
                        <span>{o.name}{o.level ? ` (${o.level})` : ''}</span>
                      </label>
                    ))}
                  </div>
                  <div style={{fontSize:12, color:'var(--text3)', marginTop:8}}>{toolsOccIds.length} selected</div>
                </div>
              )}
            </div>
          )}

          {/* ── TRAINING TOOLS ── */}
          {activeSection === 'tools' && (
            <div style={{display:'flex', flexDirection:'column', gap:22}}>
              <div style={{fontWeight:600, fontSize:14}}>Training Tools</div>

              {familyId === 'enssure' && fullInst && enssureMissingCount > 0 && (
                <div style={{background:'#fff3cd', border:'1px solid #ffc107', borderRadius:10, padding:'10px 14px', fontSize:12.5, color:'#856404'}}>
                  <span className="material-icons-round" style={{fontSize:15, verticalAlign:'middle', marginRight:5}}>warning</span>
                  <strong>{enssureMissingCount} occupation row{enssureMissingCount !== 1 ? 's' : ''}</strong> missing skill test pass or employment data — C1 will show "—" for those fields.
                </div>
              )}

              {familyId === 'enssure' && fullInst && (
                <div>
                  <div style={{fontWeight:600, fontSize:13.5, marginBottom:8}}>D2/D3 — Tools Occupation</div>
                  <input className="form-input" value={enssureToolsOccSearch} onChange={e => setEnssureToolsOccSearch(e.target.value)}
                    placeholder="Search occupation…" style={{marginBottom:8}}/>
                  <select className="form-input" style={{width:'100%', marginBottom:10}}
                    value={enssureToolsOccId} onChange={e => setEnssureToolsOccId(e.target.value)}>
                    <option value="">— Select occupation —</option>
                    {occupations
                      .filter(o => !enssureToolsOccSearch || o.name.toLowerCase().includes(enssureToolsOccSearch.toLowerCase()))
                      .map(o => <option key={o.id} value={o.id}>{o.name}{o.level ? ` (${o.level})` : ''}</option>)}
                  </select>
                  <div style={{display:'flex', gap:16, flexWrap:'wrap'}}>
                    <div>
                      <div style={{fontSize:11, fontWeight:600, color:'var(--text3)', marginBottom:5}}>LEVEL</div>
                      <select className="form-input" style={{width:'auto', minWidth:140}} value={enssureToolsLevel} onChange={e => setEnssureToolsLevel(e.target.value)}>
                        <option>N/A</option><option>Level 1</option><option>Level 2</option><option>Level 3</option><option>Professional</option><option>Technician</option>
                      </select>
                    </div>
                    <div>
                      <div style={{fontSize:11, fontWeight:600, color:'var(--text3)', marginBottom:5}}>EVENTS (MULTIPLIER)</div>
                      <input type="number" min="1" className="form-input" style={{width:100}} value={enssureEvents}
                        onChange={e => setEnssureEvents(Math.max(1, parseInt(e.target.value) || 1))}/>
                    </div>
                  </div>
                  {enssureToolsOccId && <div style={{fontSize:11.5, color:'var(--text3)', marginTop:8}}>Quantities × {enssureEvents} shown in D2/D3.</div>}
                </div>
              )}

              {report.hasToolsPicker && (
                <div>
                  <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:14}}>
                    <span style={{fontWeight:600, fontSize:13.5}}>Required Level</span>
                    <select className="form-input" style={{width:'auto', minWidth:160}} value={eoiToolsLevel} onChange={e => setEoiToolsLevel(e.target.value)}>
                      <option>N/A</option><option>Level 1</option><option>Level 2</option>
                      <option>Level 3</option><option>Professional</option><option>Technician</option>
                    </select>
                  </div>
                  <label className="filter-inline-check" style={{marginBottom:6}}>
                    <input type="checkbox" checked={eoiCombineTools} onChange={e => setEoiCombineTools(e.target.checked)}/>
                    <span style={{display:'flex', alignItems:'center', gap:5}}>
                      Combine into one schedule
                      <span className="material-icons-round" style={{fontSize:14, color:'var(--text3)', cursor:'help'}}
                        title="Merges every selected occupation into a single tools and equipment list, summing quantities for repeated items.">info</span>
                    </span>
                  </label>
                  <label className="filter-inline-check">
                    <input type="checkbox" checked={eoiSingleTable} onChange={e => setEoiSingleTable(e.target.checked)}/>
                    <span style={{display:'flex', alignItems:'center', gap:5}}>
                      All types in one table
                      <span className="material-icons-round" style={{fontSize:14, color:'var(--text3)', cursor:'help'}}
                        title="Tools, equipment, consumables, stationery and safety gear share a single table instead of one per type. Adds a Type column so the rows stay distinguishable.">info</span>
                    </span>
                  </label>

                  <div style={{fontWeight:600, fontSize:13, marginTop:18, marginBottom:8}}>Training events per occupation</div>
                  {eoiOccIds.length === 0 ? (
                    <div className="input-hint">Pick occupations under the Occupations section to list their tools.</div>
                  ) : (
                    <>
                      {eoiOccIds.map(id => {
                        const o = occupations.find(x => x.id === id);
                        const n = eoiEventsByOcc[id] ?? 1;
                        return (
                          <div key={id} style={{display:'flex', alignItems:'center', gap:8, marginBottom:8}}>
                            <span style={{flex:1, minWidth:0, fontSize:12.5, overflow:'hidden',
                              textOverflow:'ellipsis', whiteSpace:'nowrap'}} title={o?.name}>{o?.name || id}</span>
                            <input type="number" min="1" className="form-input" value={n}
                              style={{width:76, flexShrink:0}}
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

              {noInstitute && (
                <div style={{display:'flex', flexDirection:'column', gap:16}}>
                  <div style={{display:'flex', gap:16, flexWrap:'wrap'}}>
                    <div>
                      <div style={{fontSize:11, fontWeight:600, color:'var(--text3)', marginBottom:5}}>LEVEL</div>
                      <select className="form-input" style={{width:'auto', minWidth:160}} value={toolsLevel} onChange={e => setToolsLevel(e.target.value)}>
                        <option value="">— Select level —</option>
                        <option>N/A</option><option>Level 1</option><option>Level 2</option><option>Level 3</option><option>Professional</option>
                      </select>
                    </div>
                    <div>
                      <div style={{fontSize:11, fontWeight:600, color:'var(--text3)', marginBottom:5}}>LAYOUT</div>
                      <select className="form-input" style={{width:'auto', minWidth:180}} value={toolsLayout} onChange={e => setToolsLayout(e.target.value)}>
                        <option value="combined">Combined table</option>
                        <option value="separate_sections">Separate sections</option>
                        <option value="separate_tables">Separate tables</option>
                      </select>
                    </div>
                    <div>
                      <div style={{fontSize:11, fontWeight:600, color:'var(--text3)', marginBottom:5}}>NUMBER OF GROUPS</div>
                      <input type="number" min="1" className="form-input" style={{width:100}}
                        value={numGroups} onChange={e => setNumGroups(Math.max(1, parseInt(e.target.value) || 1))}/>
                    </div>
                  </div>
                  <div style={{fontSize:11.5, color:'var(--text3)'}}>
                    Quantities entered are for 1 group (20 trainees). Total = qty × groups.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TOOL TYPES ── */}
          {activeSection === 'toolTypes' && (
            <div>
              <div style={{fontWeight:600, fontSize:14, marginBottom:12}}>Tool Types</div>
              {report.hasToolsPicker && (
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
              )}
              {noInstitute && (
                <select className="form-input" style={{width:'auto', minWidth:200}} value={toolsTypeFilter} onChange={e => setToolsTypeFilter(e.target.value)}>
                  <option value="all">All types</option>
                  <option value="tools">Tools only</option>
                  <option value="consumables">Consumables only</option>
                  <option value="safety">Safety Tools only</option>
                  <option value="stationery">Stationery only</option>
                </select>
              )}
            </div>
          )}

          {/* ── COLUMNS ── */}
          {activeSection === 'columns' && (
            <div>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
                <div style={{fontWeight:600, fontSize:14}}>Report Columns</div>
                {report.hasToolsPicker && eoiToolCols.length > 2 && (
                  <Btn className="btn btn-ghost btn-sm" onClick={() => setEoiToolCols(['sn', 'name'])}>Clear</Btn>
                )}
                {noInstitute && toolsColumns.length > 2 && (
                  <Btn className="btn btn-ghost btn-sm" onClick={() => setToolsColumns(['sn', 'name'])}>Clear</Btn>
                )}
              </div>
              {report.hasToolsPicker && (
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
              )}
              {noInstitute && (
                <div className="multi-select-list">
                  {TOOLS_ALL_COLS.map(c => (
                    <label key={c.key} className="multi-select-item">
                      <input type="checkbox" checked={toolsColumns.includes(c.key)} onChange={() => toggleToolsCol(c.key)}
                        disabled={c.key === 'sn' || c.key === 'name'}/>
                      <span>{c.label}</span>
                    </label>
                  ))}
                </div>
              )}
              <div className="input-hint" style={{marginTop:10}}>
                S.N. and Name always stay enabled — every column layout needs them. Column order follows the list above; reordering isn't supported by the underlying report yet.
              </div>
            </div>
          )}

          {/* ── FILTERS ── */}
          {activeSection === 'filters' && (
            <div style={{display:'flex', flexDirection:'column', gap:22}}>
              <div style={{fontWeight:600, fontSize:14}}>Filters</div>

              {allFYs.length > 0 && (
                <div>
                  <div style={{fontSize:11, fontWeight:600, color:'var(--text3)', marginBottom:8}}
                    title={report.hasTurnoverFY ? 'Fiscal years of the assignments shown in the experience sections' : undefined}>
                    {report.hasTurnoverFY ? 'EXPERIENCE FY' : 'FY RANGE'}
                  </div>
                  <div style={{display:'flex', alignItems:'center', gap:8}}>
                    <select className="form-input" style={{width:'auto', minWidth:100}} value={fromFY} onChange={e => { setFromFY(e.target.value); setSelectedIds(null); }}>
                      <option value="">From</option>
                      {allFYs.map(fy => <option key={fy} value={fy}>{fy}</option>)}
                    </select>
                    <span style={{color:'var(--text3)'}}>→</span>
                    <select className="form-input" style={{width:'auto', minWidth:100}} value={toFY} onChange={e => { setToFY(e.target.value); setSelectedIds(null); }}>
                      <option value="">To</option>
                      {allFYs.map(fy => <option key={fy} value={fy}>{fy}</option>)}
                    </select>
                    {(fromFY || toFY) && (
                      <Btn className="btn btn-ghost btn-sm" onClick={() => { setFromFY(''); setToFY(''); setSelectedIds(null); }}>✕</Btn>
                    )}
                  </div>
                </div>
              )}

              {report.hasTurnoverFY && allFYs.length > 0 && (
                <div>
                  <div style={{fontSize:11, fontWeight:600, color:'var(--text3)', marginBottom:8}}
                    title="Fiscal years of the turnover rows in 4(A) Financial Capacity">TURNOVER FY</div>
                  <div style={{display:'flex', alignItems:'center', gap:8}}>
                    <select className="form-input" style={{width:'auto', minWidth:100}} value={turnFromFY} onChange={e => setTurnFromFY(e.target.value)}>
                      <option value="">From</option>
                      {allFYs.map(fy => <option key={fy} value={fy}>{fy}</option>)}
                    </select>
                    <span style={{color:'var(--text3)'}}>→</span>
                    <select className="form-input" style={{width:'auto', minWidth:100}} value={turnToFY} onChange={e => setTurnToFY(e.target.value)}>
                      <option value="">To</option>
                      {allFYs.map(fy => <option key={fy} value={fy}>{fy}</option>)}
                    </select>
                    {(turnFromFY || turnToFY) && (
                      <Btn className="btn btn-ghost btn-sm" onClick={() => { setTurnFromFY(''); setTurnToFY(''); }}>✕</Btn>
                    )}
                  </div>
                </div>
              )}

              {report.hasPortfolioFY && allFYs.length > 0 && (
                <div>
                  <div style={{fontSize:11, fontWeight:600, color:'var(--text3)', marginBottom:8}}
                    title="Fiscal years of the assignments shown in B.1 Current Portfolio">PORTFOLIO FY</div>
                  <div style={{display:'flex', alignItems:'center', gap:8}}>
                    <select className="form-input" style={{width:'auto', minWidth:100}} value={portfolioFromFY} onChange={e => setPortfolioFromFY(e.target.value)}>
                      <option value="">From</option>
                      {allFYs.map(fy => <option key={fy} value={fy}>{fy}</option>)}
                    </select>
                    <span style={{color:'var(--text3)'}}>→</span>
                    <select className="form-input" style={{width:'auto', minWidth:100}} value={portfolioToFY} onChange={e => setPortfolioToFY(e.target.value)}>
                      <option value="">To</option>
                      {allFYs.map(fy => <option key={fy} value={fy}>{fy}</option>)}
                    </select>
                    {(portfolioFromFY || portfolioToFY) && (
                      <Btn className="btn btn-ghost btn-sm" onClick={() => { setPortfolioFromFY(''); setPortfolioToFY(''); }}>✕</Btn>
                    )}
                  </div>
                </div>
              )}

              <div>
                <div style={{fontSize:11, fontWeight:600, color:'var(--text3)', marginBottom:8}}
                  title={family.selfFilters ? 'Narrows 3(B) Specific Experience only' : undefined}>TRAINING DURATION</div>
                <select className="form-input" style={{width:'auto', minWidth:200}} value={filterDuration} onChange={e => setFilterDuration(e.target.value)}>
                  <option value="">All trainings</option>
                  <option value="160plus">160 hours or more</option>
                  <option value="390plus">390 hours or more</option>
                  <option value="390more">More than 390 hours</option>
                </select>
              </div>

              {!isMultiInst && fullInst && allTrainingTypes.length > 0 && (
                <div>
                  <div style={{fontSize:11, fontWeight:600, color:'var(--text3)', marginBottom:8}}>TRAINING TYPE</div>
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

              {(fullInst || isMultiInst) && allDonorTypes.length > 0 && (
                <div>
                  <div style={{fontSize:11, fontWeight:600, color:'var(--text3)', marginBottom:8}}>DONOR TYPE</div>
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

              {!isMultiInst && fullInst && report.id === 'h2' && (
                <div>
                  <div style={{fontSize:11, fontWeight:600, color:'var(--text3)', marginBottom:8}}>SORT BY</div>
                  <select className="form-input" style={{width:'auto', minWidth:180}} value={sortBy} onChange={e => setSortBy(e.target.value)}>
                    <option value="default">Data order</option>
                    <option value="alpha">Alphabetical</option>
                    <option value="fy">Fiscal year</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {/* ── ADVANCED ── */}
          {activeSection === 'advanced' && (
            <div>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
                <div style={{fontWeight:600, fontSize:14}}>Assignments</div>
                <span style={{display:'flex', gap:6}}>
                  <Btn className="btn btn-ghost btn-sm" onClick={selectAll}>All</Btn>
                  <Btn className="btn btn-ghost btn-sm" onClick={clearAll}>None</Btn>
                </span>
              </div>
              <div className="input-hint" style={{marginBottom:10}}>
                Fine-tune which individual assignments (within the FY range and other filters above) are included.
              </div>
              {rangeFiltered.length === 0 ? (
                <div style={{fontSize:12.5, color:'var(--text3)', padding:'6px 0'}}>No assignments in range.</div>
              ) : (
                <div className="multi-select-list" style={{maxHeight:320, overflowY:'auto'}}>
                  {rangeFiltered.map(exp => (
                    <label key={exp.id} className="multi-select-item">
                      <input type="checkbox"
                        checked={selectedIds === null || selectedIds.includes(exp.id)}
                        onChange={() => toggleSelected(exp.id)}/>
                      <span>{exp.assignmentName || '(unnamed)'} <span style={{color:'var(--text3)', fontSize:10.5}}>· {exp.fy}</span></span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Configuration summary ── */}
      {summaryChips.length > 0 && (
        <div className="card" style={{padding:'12px 18px', display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
          {summaryChips.map((c, i) => (
            <span key={c.section} style={{display:'flex', alignItems:'center', gap:8}}>
              {i > 0 && <span style={{color:'var(--border)'}}>·</span>}
              <button onClick={() => setActiveSection(c.section)}
                style={{background:'none', border:'none', cursor:'pointer', color:'var(--text2)', fontSize:12.5, fontWeight:600, padding:'2px 4px'}}>
                {c.text}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* ── Results count ── */}
      {matchingCount !== null && (
        <div className="card" style={{padding:'22px', textAlign:'center'}}>
          <div style={{fontSize:38, fontWeight:700, color:'var(--text)', lineHeight:1}}>{matchingCount}</div>
          <div style={{fontSize:11.5, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.5px', marginTop:6}}>
            Matching Assignment{matchingCount !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* ── Preview ── */}
      <div className="card" style={{padding:20}}>
        <div style={{fontWeight:600, fontSize:14, marginBottom:14}}>Report Preview</div>

        {!previewReady ? (
          <div className="empty-state" style={{background:'var(--bg,#f8fafc)', border:'1px dashed var(--border)', borderRadius:'var(--radius-lg)', padding:'32px 20px'}}>
            <div className="empty-state-icon">
              <span className="material-icons-round" style={{fontSize:40, opacity:.35}}>description</span>
            </div>
            <div className="empty-state-sub" style={{marginBottom:16}}>
              Select your firms and configure the report to see a preview.
            </div>
            <Btn className="btn btn-primary" onClick={showReport} disabled={!canPreview}>Preview Report</Btn>
          </div>
        ) : (
          <div style={{display:'flex', flexDirection:'column', gap:16}}>
            {isStale && (
              <div role="status" style={{display:'flex', alignItems:'center', gap:10, flexWrap:'wrap',
                padding:'10px 16px', borderRadius:'var(--radius-lg)',
                background:'color-mix(in srgb, var(--warning,#f59e0b) 12%, var(--surface))',
                border:'1px solid color-mix(in srgb, var(--warning,#f59e0b) 35%, transparent)'}}>
                <span className="material-icons-round" style={{fontSize:17, color:'var(--warning,#f59e0b)'}}>update</span>
                <span style={{fontSize:12.5}}>Settings changed — this preview was built with the previous configuration.</span>
                <Btn className="btn btn-primary btn-sm" style={{marginLeft:'auto'}} onClick={showReport}>Rebuild</Btn>
              </div>
            )}

            {isMultiInst ? (
              fwLoading ? (
                <div className="empty-state">
                  <div className="empty-state-icon">⏳</div>
                  <div className="empty-state-title">Loading…</div>
                </div>
              ) : (
                <>
                  <div style={{display:'flex', alignItems:'center', gap:10, flexWrap:'wrap'}}>
                    <span style={{fontWeight:600, fontSize:13.5}}>{report.label}</span>
                    <span style={{fontSize:12, color:'var(--text3)'}}>{fwInstIds.length} firm{fwInstIds.length !== 1 ? 's' : ''}</span>
                    {fyRangeLabel && <span style={{fontSize:11, color:'var(--primary)', background:'var(--primary-light,#eff6ff)', borderRadius:4, padding:'1px 7px'}}>{fyRangeLabel}</span>}
                    {report.id === 'fw2' && (
                      <div style={{display:'flex', alignItems:'center', gap:10, marginLeft:'auto'}}>
                        <label style={{display:'flex', alignItems:'center', gap:5, fontSize:12, cursor:'pointer', whiteSpace:'nowrap'}}>
                          <input type="checkbox" checked={nstbComparative} onChange={e => setNstbComparative(e.target.checked)} />
                          Comparative
                        </label>
                        {nstbComparative && (
                          <div style={{display:'flex', alignItems:'center', gap:5}}>
                            <label style={{fontSize:12, whiteSpace:'nowrap', color:'var(--text3)'}}>Threshold ≥</label>
                            <input type="number" min="0" placeholder="e.g. 50" value={nstbThreshold}
                              onChange={e => setNstbThreshold(e.target.value)}
                              style={{width:70, fontSize:12, padding:'2px 6px', border:'1px solid var(--border)', borderRadius:4}}/>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {report.id === 'fw2' && nstbComparative && (() => {
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
                      <div style={{overflowX:'auto'}}>
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

                  {family.renderMultiAggregate ? (
                    family.renderMultiAggregate(fwSelectedFirms(), clients, report.id, opts)
                  ) : fwInstIds.map(id => {
                    const inst = fwFullInsts[id];
                    if (!inst) return null;
                    const exps = fwExpsFor(inst);
                    return (
                      <div key={id} style={{borderTop:'1px solid var(--border)', paddingTop:16}}>
                        {family.renderAggregateTable(inst, exps, clients, report.id, opts)}
                      </div>
                    );
                  })}
                </>
              )
            ) : (
              <>
                <div style={{display:'flex', alignItems:'center', gap:10, flexWrap:'wrap'}}>
                  <span style={{fontWeight:600, fontSize:13.5}}>{report.label}</span>
                  {fyRangeLabel && <span style={{fontSize:11, color:'var(--primary)', background:'var(--primary-light,#eff6ff)', borderRadius:4, padding:'1px 7px'}}>{fyRangeLabel}</span>}
                  {!isAggregate && <span style={{fontSize:12, color:'var(--text3)'}}>{activeExps.length} assignment{activeExps.length !== 1 ? 's' : ''}</span>}
                </div>

                {isAggregate ? (
                  family.renderAggregateTable(fullInst || null, activeExps, clients, report.id, opts)
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
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Sticky action bar ── */}
      <div style={{
        position:'sticky', bottom:0, zIndex:5, background:'var(--surface)', borderTop:'1px solid var(--border)',
        padding:'12px 18px', display:'flex', alignItems:'center', justifyContent:'space-between',
        borderRadius:'var(--radius-lg)', boxShadow:'var(--shadow)', flexWrap:'wrap', gap:10,
      }}>
        {!previewReady ? (
          <>
            <Btn className="btn btn-secondary" onClick={handleReset}>Reset</Btn>
            <Btn className="btn btn-primary" onClick={showReport} disabled={!canPreview}>Preview Report →</Btn>
          </>
        ) : (
          <>
            <Btn className="btn btn-secondary" onClick={() => setRenderedSig(null)}>← Edit Configuration</Btn>
            <div style={{display:'flex', gap:8}}>
              {!isAggregate && (
                <Btn className="btn btn-secondary" onClick={handleCSV} disabled={!activeExps.length}>Export CSV</Btn>
              )}
              {isAggregate && !isMultiInst && family.downloadDOCX && (
                <Btn className="btn btn-secondary" onClick={handleWord} disabled={!canPrint || isStale}
                  title={isStale ? 'Rebuild first — settings have changed since this was built' : undefined}>Export Word</Btn>
              )}
              {isMultiInst && family.downloadMultiDOCX && (
                <Btn className="btn btn-secondary"
                  onClick={() => family.downloadMultiDOCX(fwSelectedFirms(), clients, report.id, opts)}
                  disabled={fwInstIds.length === 0 || isStale}
                  title={isStale ? 'Rebuild first — settings have changed since this was built' : undefined}>Export Word</Btn>
              )}
              <Btn className="btn btn-primary" onClick={() => {
                if (noInstitute) { handlePrintTools(); return; }
                if (!isMultiInst) { handlePrint(); return; }
                const firms = fwSelectedFirms();
                if (!firms.length) return;
                let combined;
                if (family.buildMultiPrintHTML) {
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
              }} disabled={!canPrint || isStale}
                title={isStale ? 'Rebuild first — settings have changed since this was built' : undefined}>Export PDF</Btn>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ReportsView;

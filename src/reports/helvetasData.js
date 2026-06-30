// Shared data builders used by both the JSX renderer and DOCX exporter
import { fyInRange, fyYear, fmt } from './helpers.js';

export { fmt };

function occName(occ, occupations) {
  if (occupations && occupations.length && occ.ctevtOccupationId) {
    const id = occ.ctevtOccupationId;
    const found = occupations.find(o => String(o.id) === String(id));
    if (found) return found.name;
  }
  return occ.nameInLetter || '(unknown)';
}

export function buildTurnoverData(fullInst, fromFY, toFY) {
  const tax = (fullInst?.taxClearance || []).filter(t => fyInRange(t.fy, fromFY, toFY));
  const fys = [...new Set(tax.map(t => t.fy).filter(Boolean))].sort();
  const byFY = {};
  tax.forEach(t => { byFY[t.fy] = t.turnover; });
  const total = tax.reduce((s, t) => s + (parseFloat(t.turnover) || 0), 0);
  return { fys, byFY, total };
}

export function buildGeneralExpData(fullInst, activeExps, occupations = [], sortBy = 'default') {
  const allFYs = [...new Set(activeExps.map(e => e.fy).filter(Boolean))].sort();

  // byOcc[name][fy] = { trainees, employed }
  const byOcc = {};
  for (const exp of activeExps) {
    const fy = exp.fy;
    for (const occ of (exp.occupations || [])) {
      const name = occName(occ, occupations);
      if (!byOcc[name]) byOcc[name] = {};
      if (fy) {
        if (!byOcc[name][fy]) byOcc[name][fy] = { trainees: 0, employed: 0 };
        const t = parseInt(occ.trainees) || 0;
        byOcc[name][fy].trainees += t;
        byOcc[name][fy].employed += Math.round(t * (parseFloat(occ.employmentActual) || 0) / 100);
      }
    }
  }

  // NSTB skill-test pass — per occupation per FY
  const allFYYears = new Set(allFYs.map(fyYear).filter(Boolean));
  const nstbByOccFY = {};
  for (const n of (fullInst?.nstb || [])) {
    if (allFYYears.size > 0 && !allFYYears.has(fyYear(n.fy))) continue;
    const key = (n.occupation || '').toLowerCase().trim();
    if (!nstbByOccFY[key]) nstbByOccFY[key] = {};
    const yr = fyYear(n.fy);
    nstbByOccFY[key][yr] = (nstbByOccFY[key][yr] || 0) + (parseInt(n.pass) || 0);
  }

  // Build rows: one occupation with FY sub-rows + subtotal
  const occs = Object.entries(byOcc).map(([name, fyData]) => {
    const fys = allFYs.filter(fy => fyData[fy]);
    const nstbKey = name.toLowerCase().trim();
    const fyRows = fys.map(fy => ({
      fy,
      trainees:     fyData[fy].trainees || 0,
      skillTestPass: (nstbByOccFY[nstbKey] || {})[fyYear(fy)] || 0,
      employed:     fyData[fy].employed || 0,
    }));
    const subtotal = {
      trainees:     fyRows.reduce((s, r) => s + r.trainees, 0),
      skillTestPass: fyRows.reduce((s, r) => s + r.skillTestPass, 0),
      employed:     fyRows.reduce((s, r) => s + r.employed, 0),
    };
    return { name, fyRows, subtotal, firstFY: fys[0] || '' };
  });

  if (sortBy === 'alpha') occs.sort((a, b) => a.name.localeCompare(b.name));
  else if (sortBy === 'fy')   occs.sort((a, b) => a.firstFY.localeCompare(b.firstFY));
  // 'default' keeps insertion order

  const grandTotal = {
    trainees:     occs.reduce((s, o) => s + o.subtotal.trainees, 0),
    skillTestPass: occs.reduce((s, o) => s + o.subtotal.skillTestPass, 0),
    employed:     occs.reduce((s, o) => s + o.subtotal.employed, 0),
  };

  return { occs, grandTotal, allFYs };
}

export function buildSpecificOccData(fullInst, activeExps, selectedOccs, occupations = []) {
  const fys = [...new Set(activeExps.map(e => e.fy).filter(Boolean))].sort();
  const byFY = {};
  for (const fy of fys) byFY[fy] = { trainees: 0, skillTestPass: 0, employed: 0 };

  for (const exp of activeExps) {
    const fy = exp.fy;
    if (!fy || !byFY[fy]) continue;
    for (const occ of (exp.occupations || [])) {
      const name = occName(occ, occupations);
      if (selectedOccs.length > 0 && !selectedOccs.includes(name)) continue;
      byFY[fy].trainees += parseInt(occ.trainees) || 0;
      byFY[fy].employed += Math.round((parseInt(occ.trainees) || 0) * (parseFloat(occ.employmentActual) || 0) / 100);
    }
  }

  for (const n of (fullInst?.nstb || [])) {
    const matchFY = fys.find(f => fyYear(f) === fyYear(n.fy));
    if (!matchFY) continue;
    if (selectedOccs.length > 0) {
      const match = selectedOccs.some(o => o.toLowerCase().trim() === (n.occupation || '').toLowerCase().trim());
      if (!match) continue;
    }
    byFY[matchFY].skillTestPass += parseInt(n.pass) || 0;
  }

  const rows = fys.map(fy => ({ fy, ...byFY[fy] }));
  const totals = {
    trainees:      rows.reduce((s, r) => s + r.trainees, 0),
    skillTestPass: rows.reduce((s, r) => s + r.skillTestPass, 0),
    employed:      rows.reduce((s, r) => s + r.employed, 0),
  };

  return { rows, totals };
}

export function buildFirmWiseData(fullInst, activeExps, occupations = [], opts = {}) {
  const { selectedOccs = [] } = opts;
  const allFYs = [...new Set(activeExps.map(e => e.fy).filter(Boolean))].sort();

  // NSTB skill test data by occupation (appeared + pass), keyed by original name
  const allFYYears2 = new Set(allFYs.map(fyYear).filter(Boolean));
  const nstbByOcc = {};
  for (const n of (fullInst?.nstb || [])) {
    if (allFYYears2.size > 0 && !allFYYears2.has(fyYear(n.fy))) continue;
    const key = (n.occupation || '').trim();
    if (!nstbByOcc[key]) nstbByOcc[key] = { appeared: 0, pass: 0 };
    nstbByOcc[key].appeared += parseInt(n.appeared) || 0;
    nstbByOcc[key].pass += parseInt(n.pass) || 0;
  }

  // Build a case-insensitive lookup for NSTB matching
  const nstbLower = {};
  for (const [key, val] of Object.entries(nstbByOcc)) {
    const lk = key.toLowerCase();
    if (!nstbLower[lk]) nstbLower[lk] = { appeared: 0, pass: 0 };
    nstbLower[lk].appeared += val.appeared;
    nstbLower[lk].pass += val.pass;
  }

  // Per-occupation aggregation (training + employment from assignments, ST from NSTB)
  const byOcc = {};
  for (const exp of activeExps) {
    for (const occ of (exp.occupations || [])) {
      const name = occName(occ, occupations);
      if (selectedOccs.length && !selectedOccs.includes(name)) continue;
      if (!byOcc[name]) byOcc[name] = { trained: 0, employed: 0, empApplicable: 0 };
      const t = parseInt(occ.trainees) || 0;
      byOcc[name].trained += t;
      if (occ.employmentProvisioned) {
        byOcc[name].empApplicable += t;
        byOcc[name].employed += Math.round(t * (parseFloat(occ.employmentActual) || 0) / 100);
      }
    }
  }

  // Also add NSTB-only occupations that have no assignment data
  for (const nstbName of Object.keys(nstbByOcc)) {
    if (selectedOccs.length && !selectedOccs.includes(nstbName)) continue;
    if (!byOcc[nstbName]) byOcc[nstbName] = { trained: 0, employed: 0, empApplicable: 0 };
  }

  const usedNstbKeys = new Set();
  const occs = Object.entries(byOcc).map(([name, d]) => {
    const lk = name.toLowerCase().trim();
    const nstb = nstbLower[lk] || { appeared: 0, pass: 0 };
    if (nstb.appeared || nstb.pass) usedNstbKeys.add(lk);
    const empRate = d.empApplicable > 0 ? Math.round((d.employed / d.empApplicable) * 100) : 0;
    return { name, trained: d.trained, stAppeared: nstb.appeared, stPass: nstb.pass, employed: d.employed, empApplicable: d.empApplicable, empRate };
  }).sort((a, b) => a.name.localeCompare(b.name));

  // Grand totals from ALL occupations (ignore occupation filter)
  const byAll = {};
  for (const exp of activeExps) {
    for (const occ of (exp.occupations || [])) {
      const name = occName(occ, occupations);
      if (!byAll[name]) byAll[name] = { trained: 0, employed: 0, empApplicable: 0 };
      const t = parseInt(occ.trainees) || 0;
      byAll[name].trained += t;
      if (occ.employmentProvisioned) {
        byAll[name].empApplicable += t;
        byAll[name].employed += Math.round(t * (parseFloat(occ.employmentActual) || 0) / 100);
      }
    }
  }
  const totalNstbAppeared = Object.values(nstbByOcc).reduce((s, n) => s + n.appeared, 0);
  const totalNstbPass = Object.values(nstbByOcc).reduce((s, n) => s + n.pass, 0);
  const grand = {
    trained: Object.values(byAll).reduce((s, o) => s + o.trained, 0),
    stAppeared: totalNstbAppeared,
    stPass: totalNstbPass,
    employed: Object.values(byAll).reduce((s, o) => s + o.employed, 0),
    empApplicable: Object.values(byAll).reduce((s, o) => s + o.empApplicable, 0),
  };
  grand.empRate = grand.empApplicable > 0 ? Math.round((grand.employed / grand.empApplicable) * 100) : 0;

  return { occs, grand, allFYs };
}

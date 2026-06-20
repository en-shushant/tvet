// Shared data builders used by both the JSX renderer and DOCX exporter
import { fyInRange, fmt } from './helpers.js';

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
  const nstbByOccFY = {};
  for (const n of (fullInst?.nstb || [])) {
    if (!allFYs.includes(n.fy)) continue;
    const key = (n.occupation || '').toLowerCase().trim();
    if (!nstbByOccFY[key]) nstbByOccFY[key] = {};
    nstbByOccFY[key][n.fy] = (nstbByOccFY[key][n.fy] || 0) + (parseInt(n.pass) || 0);
  }

  // Build rows: one occupation with FY sub-rows + subtotal
  const occs = Object.entries(byOcc).map(([name, fyData]) => {
    const fys = allFYs.filter(fy => fyData[fy]);
    const nstbKey = name.toLowerCase().trim();
    const fyRows = fys.map(fy => ({
      fy,
      trainees:     fyData[fy].trainees || 0,
      skillTestPass: (nstbByOccFY[nstbKey] || {})[fy] || 0,
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
    if (!byFY[n.fy]) continue;
    if (selectedOccs.length > 0) {
      const match = selectedOccs.some(o => o.toLowerCase().trim() === (n.occupation || '').toLowerCase().trim());
      if (!match) continue;
    }
    byFY[n.fy].skillTestPass += parseInt(n.pass) || 0;
  }

  const rows = fys.map(fy => ({ fy, ...byFY[fy] }));
  const totals = {
    trainees:      rows.reduce((s, r) => s + r.trainees, 0),
    skillTestPass: rows.reduce((s, r) => s + r.skillTestPass, 0),
    employed:      rows.reduce((s, r) => s + r.employed, 0),
  };

  return { rows, totals };
}

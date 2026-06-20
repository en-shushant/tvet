// Shared data builders used by both the JSX renderer and DOCX exporter
import { fyInRange, fmt } from './helpers.js';

export { fmt };

export function buildTurnoverData(fullInst, fromFY, toFY) {
  const tax = (fullInst?.taxClearance || []).filter(t => fyInRange(t.fy, fromFY, toFY));
  const fys = [...new Set(tax.map(t => t.fy).filter(Boolean))].sort();
  const byFY = {};
  tax.forEach(t => { byFY[t.fy] = t.turnover; });
  const total = tax.reduce((s, t) => s + (parseFloat(t.turnover) || 0), 0);
  return { fys, byFY, total };
}

export function buildGeneralExpData(fullInst, activeExps) {
  // All FYs in sorted order across active assignments
  const allFYs = [...new Set(activeExps.map(e => e.fy).filter(Boolean))].sort();

  // byOcc[name] = { traineesByFY: {fy: count}, employed: total }
  const byOcc = {};
  for (const exp of activeExps) {
    const fy = exp.fy;
    for (const occ of (exp.occupations || [])) {
      const name = occ.nameInLetter || '(unknown)';
      if (!byOcc[name]) byOcc[name] = { traineesByFY: {}, employed: 0 };
      const t = parseInt(occ.trainees) || 0;
      if (fy) byOcc[name].traineesByFY[fy] = (byOcc[name].traineesByFY[fy] || 0) + t;
      byOcc[name].employed += Math.round(t * (parseFloat(occ.employmentActual) || 0) / 100);
    }
  }

  // NSTB skill-test pass — match by occupation name (case-insensitive), sum across all FYs
  const activeFYs = new Set(allFYs);
  const nstbByOcc = {};
  for (const n of (fullInst?.nstb || [])) {
    if (!activeFYs.has(n.fy)) continue;
    const key = (n.occupation || '').toLowerCase().trim();
    nstbByOcc[key] = (nstbByOcc[key] || 0) + (parseInt(n.pass) || 0);
  }

  const rows = Object.entries(byOcc).map(([name, d]) => {
    const totalTrainees = allFYs.reduce((s, fy) => s + (d.traineesByFY[fy] || 0), 0);
    return {
      name,
      traineesByFY:  d.traineesByFY,
      totalTrainees,
      skillTestPass: nstbByOcc[name.toLowerCase().trim()] || 0,
      employed:      d.employed,
    };
  });

  const totals = {
    traineesByFY:  allFYs.reduce((acc, fy) => {
      acc[fy] = rows.reduce((s, r) => s + (r.traineesByFY[fy] || 0), 0);
      return acc;
    }, {}),
    totalTrainees: rows.reduce((s, r) => s + r.totalTrainees, 0),
    skillTestPass: rows.reduce((s, r) => s + r.skillTestPass, 0),
    employed:      rows.reduce((s, r) => s + r.employed, 0),
  };

  return { rows, totals, allFYs };
}

export function buildSpecificOccData(fullInst, activeExps, selectedOccs) {
  const fys = [...new Set(activeExps.map(e => e.fy).filter(Boolean))].sort();
  const byFY = {};
  for (const fy of fys) byFY[fy] = { trainees: 0, skillTestPass: 0, employed: 0 };

  for (const exp of activeExps) {
    const fy = exp.fy;
    if (!fy || !byFY[fy]) continue;
    for (const occ of (exp.occupations || [])) {
      const name = occ.nameInLetter || '';
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

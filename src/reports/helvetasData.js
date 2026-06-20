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
  const byOcc = {};
  for (const exp of activeExps) {
    for (const occ of (exp.occupations || [])) {
      const name = occ.nameInLetter || '(unknown)';
      if (!byOcc[name]) byOcc[name] = { trainees: 0, employed: 0, fys: new Set() };
      byOcc[name].trainees += parseInt(occ.trainees) || 0;
      byOcc[name].employed += Math.round((parseInt(occ.trainees) || 0) * (parseFloat(occ.employmentActual) || 0) / 100);
      if (exp.fy) byOcc[name].fys.add(exp.fy);
    }
  }

  const activeFYs = new Set(activeExps.map(e => e.fy).filter(Boolean));
  const nstbByOcc = {};
  for (const n of (fullInst?.nstb || [])) {
    if (!activeFYs.has(n.fy)) continue;
    const key = (n.occupation || '').toLowerCase().trim();
    nstbByOcc[key] = (nstbByOcc[key] || 0) + (parseInt(n.pass) || 0);
  }

  const rows = Object.entries(byOcc).map(([name, d]) => ({
    name,
    trainees:      d.trainees,
    skillTestPass: nstbByOcc[name.toLowerCase().trim()] || 0,
    employed:      d.employed,
    fys:           [...d.fys].sort(),
  }));

  const totals = {
    trainees:      rows.reduce((s, r) => s + r.trainees, 0),
    skillTestPass: rows.reduce((s, r) => s + r.skillTestPass, 0),
    employed:      rows.reduce((s, r) => s + r.employed, 0),
  };

  return { rows, totals };
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

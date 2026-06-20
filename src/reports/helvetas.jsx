// Helvetas report tables
// Table 1: Average Annual Turnover (from tax clearance data, FY range)
// Table 2: General training/skill test/employment experience (all sectors, aggregated by occupation)
// Table 3: Specific occupation experience (year-wise rows, occupation multi-select)

import { esc, fmt } from './helpers.js';
import { buildTurnoverData, buildGeneralExpData, buildSpecificOccData } from './helvetasData.js';
import { downloadHelvetasDOCX } from './helvetasDOCX.js';

export const REPORTS = [
  {
    id: 'h1',
    label: 'Table 1 — Average Annual Turnover',
    aggregate: true,
    hasOccupationFilter: false,
    requiredFields: [],
    columns: [],
  },
  {
    id: 'h2',
    label: 'Table 2 — General Training Experience (All Sectors)',
    aggregate: true,
    hasOccupationFilter: false,
    requiredFields: [],
    columns: [],
  },
  {
    id: 'h3',
    label: 'Table 3 — Specific Occupation Experience (Year-wise)',
    aggregate: true,
    hasOccupationFilter: true,
    requiredFields: [],
    columns: [],
  },
];

// ── Shared table styles ──────────────────────────────────────────────────────

const TH = { background:'#dce6f1', padding:'7px 10px', border:'1px solid #aab8c8', fontWeight:600, fontSize:12, textAlign:'center', verticalAlign:'middle' };
const TD = { padding:'6px 10px', border:'1px solid #c0c8d0', fontSize:12, verticalAlign:'middle' };
const TDN = { ...TD, textAlign:'right' };
const TBL = { width:'100%', borderCollapse:'collapse', marginTop:6 };
const TITLE_STYLE = { fontWeight:600, fontSize:13, marginBottom:6 };
const TOTAL_STYLE = { fontWeight:700, background:'#f0f4f8' };

// ── JSX table components ─────────────────────────────────────────────────────

function Table1({ fullInst, fromFY, toFY }) {
  const { fys, byFY, total } = buildTurnoverData(fullInst, fromFY, toFY);
  if (!fys.length) return (
    <div style={{padding:16, color:'var(--text3)', fontSize:13}}>
      No tax clearance records in selected FY range. Enter tax clearance data under the Firm profile.
    </div>
  );
  const titleFYPart = fys.length > 1 ? ` of FY ${fys[0]} to ${fys[fys.length - 1]}` : ` of FY ${fys[0]}`;
  return (
    <div>
      <div style={TITLE_STYLE}>Table 1: Average Annual Turnover{titleFYPart}</div>
      <table style={TBL}>
        <thead>
          <tr>
            <th style={TH}>Description</th>
            {fys.map(fy => <th key={fy} style={TH}>FY {fy}</th>)}
            <th style={TH}>Total</th>
            <th style={TH}>Remarks</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={TD}>Annual turnover (as per audit report)</td>
            {fys.map(fy => <td key={fy} style={TDN}>{fmt(byFY[fy])}</td>)}
            <td style={TDN}>{fmt(total)}</td>
            <td style={TD}></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Table2({ fullInst, activeExps }) {
  const { rows, totals } = buildGeneralExpData(fullInst, activeExps);
  if (!rows.length) return (
    <div style={{padding:16, color:'var(--text3)', fontSize:13}}>
      No occupation data found in selected assignments.
    </div>
  );
  const fyCount = new Set(activeExps.map(e => e.fy).filter(Boolean)).size;
  return (
    <div>
      <div style={TITLE_STYLE}>
        Table 2: Training, skill test and employment placement experience
        (Level I vocational skill training comprising all the sectors; general experience)
      </div>
      <table style={TBL}>
        <thead>
          <tr>
            <th style={{...TH, width:40}}>S.N.</th>
            <th style={TH}>Occupation</th>
            <th style={TH}>No. of trainees completed the training</th>
            <th style={TH}>No. of skill test passed trainees</th>
            <th style={TH}>No. of employed graduates</th>
            <th style={TH}>Training completed Year</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.name}>
              <td style={{...TD, textAlign:'center'}}>{i + 1}</td>
              <td style={TD}>{row.name}</td>
              <td style={TDN}>{row.trainees || '—'}</td>
              <td style={TDN}>{row.skillTestPass || '—'}</td>
              <td style={TDN}>{row.employed || '—'}</td>
              <td style={TD}>{row.fys.join(', ')}</td>
            </tr>
          ))}
          <tr style={TOTAL_STYLE}>
            <td style={TD} colSpan={2}>Total of {fyCount} year{fyCount !== 1 ? 's' : ''}</td>
            <td style={TDN}>{totals.trainees || '—'}</td>
            <td style={TDN}>{totals.skillTestPass || '—'}</td>
            <td style={TDN}>{totals.employed || '—'}</td>
            <td style={TD}></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Table3({ fullInst, activeExps, selectedOccs }) {
  const { rows, totals } = buildSpecificOccData(fullInst, activeExps, selectedOccs);
  if (!rows.length) return (
    <div style={{padding:16, color:'var(--text3)', fontSize:13}}>
      No data for selected occupations and FY range.
    </div>
  );
  const occLabel = selectedOccs.length ? selectedOccs.join(', ') : 'All Occupations';
  return (
    <div>
      <div style={TITLE_STYLE}>
        Table 3: Training, skill test and employment placement experience
        (at least level I vocational skill training only the proposed occupation)
      </div>
      <div style={{fontWeight:600, marginBottom:6, fontSize:12}}>
        Proposed Occupation and the Training Package: {occLabel}
      </div>
      <table style={TBL}>
        <thead>
          <tr>
            <th style={TH}>Year</th>
            <th style={TH}>No. of trained person</th>
            <th style={TH}>No. of skill test passed trainee</th>
            <th style={TH}>No. of employed graduates</th>
            <th style={TH}>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.fy}>
              <td style={TD}>{row.fy}</td>
              <td style={TDN}>{row.trainees || '—'}</td>
              <td style={TDN}>{row.skillTestPass || '—'}</td>
              <td style={TDN}>{row.employed || '—'}</td>
              <td style={TD}></td>
            </tr>
          ))}
          <tr style={TOTAL_STYLE}>
            <td style={TD}>Total</td>
            <td style={TDN}>{totals.trainees || '—'}</td>
            <td style={TDN}>{totals.skillTestPass || '—'}</td>
            <td style={TDN}>{totals.employed || '—'}</td>
            <td style={TD}></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function renderAggregateTable(fullInst, activeExps, clients, reportId, opts = {}) {
  const { fromFY, toFY, selectedOccs = [] } = opts;
  if (reportId === 'h1') return <Table1 fullInst={fullInst} fromFY={fromFY} toFY={toFY} />;
  if (reportId === 'h2') return <Table2 fullInst={fullInst} activeExps={activeExps} />;
  if (reportId === 'h3') return <Table3 fullInst={fullInst} activeExps={activeExps} selectedOccs={selectedOccs} />;
  return null;
}

// ── Print HTML ────────────────────────────────────────────────────────────────

function buildPrintHTML(fullInst, activeExps, clients, reportId, fyRangeLabel, opts = {}) {
  const { fromFY, toFY, selectedOccs = [] } = opts;
  const firmName = fullInst?.name || '';
  let bodyHTML = '';

  if (reportId === 'h1') {
    const { fys, byFY, total } = buildTurnoverData(fullInst, fromFY, toFY);
    const titleFYPart = fys.length > 1 ? ` of FY ${fys[0]} to ${fys[fys.length-1]}` : fys.length === 1 ? ` of FY ${fys[0]}` : '';
    const title = `Table 1: Average Annual Turnover${titleFYPart}`;
    const headers = ['Description', ...fys.map(fy => `FY ${fy}`), 'Total', 'Remarks'];
    const dataRow = ['Annual turnover (as per audit report)', ...fys.map(fy => fmt(byFY[fy])), fmt(total), ''];
    bodyHTML = `<h3>${esc(title)}</h3><table><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody><tr>${dataRow.map(c => `<td>${esc(String(c ?? ''))}</td>`).join('')}</tr></tbody></table>`;
  } else if (reportId === 'h2') {
    const { rows, totals } = buildGeneralExpData(fullInst, activeExps);
    const fyCount = new Set(activeExps.map(e => e.fy).filter(Boolean)).size;
    const title = 'Table 2: Training, skill test and employment placement experience (Level I vocational skill training comprising all the sectors; general experience)';
    const headers = ['S.N.', 'Occupation', 'No. of trainees completed the training', 'No. of skill test passed trainees', 'No. of employed graduates', 'Training completed Year'];
    const dataRows = rows.map((r, i) => [i+1, r.name, r.trainees || '—', r.skillTestPass || '—', r.employed || '—', r.fys.join(', ')]);
    const foot = ['', `Total of ${fyCount} year${fyCount !== 1 ? 's' : ''}`, totals.trainees || '—', totals.skillTestPass || '—', totals.employed || '—', ''];
    const rowsHTML = dataRows.map(cells => `<tr>${cells.map(c => `<td>${esc(String(c ?? ''))}</td>`).join('')}</tr>`).join('');
    const footHTML = `<tr class="total">${foot.map(c => `<td>${esc(String(c ?? ''))}</td>`).join('')}</tr>`;
    bodyHTML = `<h3>${esc(title)}</h3><table><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rowsHTML}${footHTML}</tbody></table>`;
  } else if (reportId === 'h3') {
    const { rows, totals } = buildSpecificOccData(fullInst, activeExps, selectedOccs);
    const title = 'Table 3: Training, skill test and employment placement experience (at least level I vocational skill training only the proposed occupation)';
    const occLabel = selectedOccs.length ? selectedOccs.join(', ') : 'All Occupations';
    const headers = ['Year', 'No. of trained person', 'No. of skill test passed trainee', 'No. of employed graduates', 'Remarks'];
    const dataRows = rows.map(r => [r.fy, r.trainees || '—', r.skillTestPass || '—', r.employed || '—', '']);
    const foot = ['Total', totals.trainees || '—', totals.skillTestPass || '—', totals.employed || '—', ''];
    const rowsHTML = dataRows.map(cells => `<tr>${cells.map(c => `<td>${esc(String(c ?? ''))}</td>`).join('')}</tr>`).join('');
    const footHTML = `<tr class="total">${foot.map(c => `<td>${esc(String(c ?? ''))}</td>`).join('')}</tr>`;
    bodyHTML = `<h3>${esc(title)}</h3><p><strong>Proposed Occupation and the Training Package:</strong> ${esc(occLabel)}</p><table><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rowsHTML}${footHTML}</tbody></table>`;
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Helvetas Report — ${esc(firmName)}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; margin: 30px; color: #111; }
  h2 { font-size: 15px; margin-bottom: 2px; }
  h3 { font-size: 13px; margin: 20px 0 6px; font-weight: 600; }
  p { margin: 4px 0 8px; font-size: 12px; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 24px; }
  th, td { border: 1px solid #888; padding: 5px 8px; font-size: 11.5px; }
  th { background: #d5dde8; font-weight: 600; text-align: center; vertical-align: middle; }
  td { text-align: left; }
  td:nth-child(n+3) { text-align: right; }
  tr.total td { font-weight: 700; background: #eef2f7; }
  @media print { body { margin: 10mm; } }
</style></head><body>
<h2>${esc(firmName)}</h2>
${fyRangeLabel ? `<p style="color:#555">FY Range: ${esc(fyRangeLabel)}</p>` : ''}
${bodyHTML}
</body></html>`;
}

function buildCSVRow() { return {}; }
function renderRowCells() { return null; }

export default {
  id: 'helvetas',
  label: 'Helvetas Reports',
  reports: REPORTS,
  renderRowCells,
  buildCSVRow,
  buildPrintHTML,
  renderAggregateTable,
  downloadDOCX: downloadHelvetasDOCX,
};

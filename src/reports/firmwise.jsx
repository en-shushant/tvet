import { esc } from './helpers.js';
import { buildFirmWiseData, fmt } from './helvetasData.js';
import {
  Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun,
  WidthType, AlignmentType, VerticalAlign, HeadingLevel,
} from 'docx';
import { saveAs } from 'file-saver';

export const REPORTS = [
  {
    id: 'fw1',
    label: 'Firm-wise Summary (Occupation Details)',
    aggregate: true,
    hasOccupationFilter: true,
    requiredFields: [],
    columns: [],
  },
  {
    id: 'fw2',
    label: 'NSTB Skill Test Report (by Occupation)',
    aggregate: true,
    hasOccupationFilter: true,
    requiredFields: [],
    columns: [],
  },
];

export const MULTI_INSTITUTE = true;

const TH = { background:'#dce6f1', padding:'7px 10px', border:'1px solid #aab8c8', fontWeight:600, fontSize:12, textAlign:'center', verticalAlign:'middle' };
const TD = { padding:'6px 10px', border:'1px solid #c0c8d0', fontSize:12, verticalAlign:'middle' };
const TDN = { ...TD, textAlign:'right' };
const TBL = { width:'100%', borderCollapse:'collapse', marginTop:6 };
const TITLE_STYLE = { fontWeight:600, fontSize:13, marginBottom:6 };

function FirmWiseTable({ fullInst, activeExps, occupations, selectedOccs }) {
  const { occs, grand, allFYs } = buildFirmWiseData(fullInst, activeExps, occupations, { selectedOccs });
  if (!occs.length) return (
    <div style={{padding:16, color:'var(--text3)', fontSize:13}}>
      No occupation data found in selected assignments.
    </div>
  );
  const fyLabel = allFYs.length > 1 ? `FY ${allFYs[0]} to ${allFYs[allFYs.length-1]}` : allFYs.length === 1 ? `FY ${allFYs[0]}` : '';
  return (
    <div>
      <div style={TITLE_STYLE}>
        Firm-wise Summary — Occupation Details
        {fyLabel && <span style={{fontWeight:400, fontSize:12, marginLeft:8}}>({fyLabel})</span>}
      </div>
      <div style={{fontWeight:600, marginBottom:6, fontSize:12}}>
        {fullInst?.name || ''}
      </div>
      <table style={TBL}>
        <thead>
          <tr>
            <th style={{...TH, width:40}}>S.N.</th>
            <th style={TH}>Occupation</th>
            <th style={TH}>Total Trained</th>
            <th style={TH}>Skill Test Appeared</th>
            <th style={TH}>Skill Test Pass</th>
            <th style={TH}>Employed</th>
            <th style={TH}>Employment Rate</th>
          </tr>
        </thead>
        <tbody>
          {occs.map((occ, i) => (
            <tr key={occ.name}>
              <td style={{...TD, textAlign:'center'}}>{i+1}</td>
              <td style={TD}>{occ.name}</td>
              <td style={TDN}>{occ.trained || '—'}</td>
              <td style={TDN}>{occ.stAppeared || '—'}</td>
              <td style={TDN}>{occ.stPass || '—'}</td>
              <td style={TDN}>{occ.employed || '—'}</td>
              <td style={TDN}>{occ.empRate > 0 ? `${occ.empRate}%` : '—'}</td>
            </tr>
          ))}
          <tr style={{background:'#e8f0fe', fontWeight:600}}>
            <td style={TD}></td>
            <td style={{...TD, fontWeight:600}}>General (All Occupations)</td>
            <td style={TDN}>{grand.trained || '—'}</td>
            <td style={TDN}>{grand.stAppeared || '—'}</td>
            <td style={TDN}>{grand.stPass || '—'}</td>
            <td style={TDN}>{grand.employed || '—'}</td>
            <td style={TDN}>{grand.empRate > 0 ? `${grand.empRate}%` : '—'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── NSTB Skill Test Report ────────────────────────────────────────────────────

function buildNSTBData(fullInst, activeExps, selectedOccs = []) {
  const activeFYs = new Set(activeExps.map(e => e.fy).filter(Boolean));
  const records = (fullInst?.nstb || []).filter(n => activeFYs.size === 0 || activeFYs.has(n.fy));

  // Group by occupation
  const byOcc = {};
  for (const n of records) {
    const name = (n.occupation || '').trim();
    if (!name) continue;
    if (selectedOccs.length && !selectedOccs.some(o => o.toLowerCase() === name.toLowerCase())) continue;
    if (!byOcc[name]) byOcc[name] = [];
    byOcc[name].push(n);
  }

  const occs = Object.entries(byOcc).sort((a, b) => a[0].localeCompare(b[0])).map(([name, rows]) => {
    const sorted = [...rows].sort((a, b) => (a.fy || '').localeCompare(b.fy || ''));
    const subtotal = sorted.reduce((s, r) => ({
      applied: s.applied + (parseInt(r.applied) || 0),
      appeared: s.appeared + (parseInt(r.appeared) || 0),
      pass: s.pass + (parseInt(r.pass) || 0),
    }), { applied: 0, appeared: 0, pass: 0 });
    return { name, rows: sorted, subtotal };
  });

  const grand = occs.reduce((s, o) => ({
    applied: s.applied + o.subtotal.applied,
    appeared: s.appeared + o.subtotal.appeared,
    pass: s.pass + o.subtotal.pass,
  }), { applied: 0, appeared: 0, pass: 0 });

  const allFYs = [...activeFYs].sort();
  return { occs, grand, allFYs };
}

const pct = (n, d) => d > 0 ? `${Math.round((n / d) * 100)}%` : '—';

function NSTBTable({ fullInst, activeExps, selectedOccs }) {
  const { occs, grand, allFYs } = buildNSTBData(fullInst, activeExps, selectedOccs);
  if (!occs.length) return (
    <div style={{ padding: 16, color: 'var(--text3)', fontSize: 13 }}>
      No NSTB skill test data found for selected occupations/FY range.
    </div>
  );
  const fyLabel = allFYs.length > 1 ? `FY ${allFYs[0]} to ${allFYs[allFYs.length - 1]}` : allFYs.length === 1 ? `FY ${allFYs[0]}` : '';
  return (
    <div>
      <div style={TITLE_STYLE}>
        NSTB Skill Test Report — by Occupation
        {fyLabel && <span style={{ fontWeight: 400, fontSize: 12, marginLeft: 8 }}>({fyLabel})</span>}
      </div>
      <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 12 }}>{fullInst?.name || ''}</div>
      <table style={TBL}>
        <thead>
          <tr>
            <th style={{ ...TH, width: 40 }}>S.N.</th>
            <th style={TH}>Occupation</th>
            <th style={TH}>Applied</th>
            <th style={TH}>Appeared</th>
            <th style={TH}>Pass</th>
            <th style={TH}>Pass %</th>
          </tr>
        </thead>
        <tbody>
          {occs.map((occ, i) => (
            <tr key={occ.name}>
              <td style={{ ...TD, textAlign: 'center' }}>{i + 1}</td>
              <td style={TD}>{occ.name}</td>
              <td style={TDN}>{occ.subtotal.applied || '—'}</td>
              <td style={TDN}>{occ.subtotal.appeared || '—'}</td>
              <td style={TDN}>{occ.subtotal.pass || '—'}</td>
              <td style={TDN}>{pct(occ.subtotal.pass, occ.subtotal.appeared)}</td>
            </tr>
          ))}
          <tr style={{ background: '#e8f0fe', fontWeight: 600 }}>
            <td style={TD}></td>
            <td style={TD}>Grand Total (All Occupations)</td>
            <td style={TDN}>{grand.applied || '—'}</td>
            <td style={TDN}>{grand.appeared || '—'}</td>
            <td style={TDN}>{grand.pass || '—'}</td>
            <td style={TDN}>{pct(grand.pass, grand.appeared)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function renderAggregateTable(fullInst, activeExps, clients, reportId, opts = {}) {
  const { occupations = [], selectedOccs = [] } = opts;
  if (reportId === 'fw1') return <FirmWiseTable fullInst={fullInst} activeExps={activeExps} occupations={occupations} selectedOccs={selectedOccs} />;
  if (reportId === 'fw2') return <NSTBTable fullInst={fullInst} activeExps={activeExps} selectedOccs={selectedOccs} />;
  return null;
}

// ── Print HTML ────────────────────────────────────────────────────────────────

function buildNSTBPrintHTML(fullInst, activeExps, fyRangeLabel, opts = {}) {
  const { selectedOccs = [] } = opts;
  const firmName = fullInst?.name || '';
  const { occs, grand, allFYs: fys } = buildNSTBData(fullInst, activeExps, selectedOccs);
  const fyPart = fys.length > 1 ? ` (FY ${fys[0]} to ${fys[fys.length - 1]})` : fys.length === 1 ? ` (FY ${fys[0]})` : '';
  const title = `NSTB Skill Test Report — by Occupation${fyPart}`;
  const headers = ['S.N.', 'Occupation', 'Applied', 'Appeared', 'Pass', 'Pass %'];
  const p = (n, d) => d > 0 ? `${Math.round((n / d) * 100)}%` : '—';
  let rowsHTML = '';
  occs.forEach((occ, i) => {
    rowsHTML += `<tr><td style="text-align:center">${i+1}</td><td>${esc(occ.name)}</td><td class="num">${occ.subtotal.applied||'—'}</td><td class="num">${occ.subtotal.appeared||'—'}</td><td class="num">${occ.subtotal.pass||'—'}</td><td class="num">${p(occ.subtotal.pass,occ.subtotal.appeared)}</td></tr>`;
  });
  const grandHTML = `<tr style="background:#e8f0fe;font-weight:600"><td></td><td>Grand Total (All Occupations)</td><td class="num">${grand.applied||'—'}</td><td class="num">${grand.appeared||'—'}</td><td class="num">${grand.pass||'—'}</td><td class="num">${p(grand.pass,grand.appeared)}</td></tr>`;
  const bodyHTML = `<h3>${esc(title)}</h3><p><strong>${esc(firmName)}</strong></p><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rowsHTML}${grandHTML}</tbody></table>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>NSTB Skill Test — ${esc(firmName)}</title>
<style>body{font-family:Arial,sans-serif;font-size:12px;margin:30px;color:#111}h2{font-size:15px;margin-bottom:2px}h3{font-size:13px;margin:20px 0 6px;font-weight:600}p{margin:4px 0 8px;font-size:12px}table{border-collapse:collapse;width:100%;margin-bottom:24px}th,td{border:1px solid #888;padding:5px 8px;font-size:11.5px}th{background:#d5dde8;font-weight:600;text-align:center;vertical-align:middle}td{text-align:left}td.num{text-align:right}@media print{body{margin:10mm}}</style>
</head><body><h2>${esc(firmName)}</h2>${fyRangeLabel?`<p style="color:#555">FY Range: ${esc(fyRangeLabel)}</p>`:''}${bodyHTML}</body></html>`;
}

function buildPrintHTML(fullInst, activeExps, clients, reportId, fyRangeLabel, opts = {}) {
  if (reportId === 'fw2') return buildNSTBPrintHTML(fullInst, activeExps, fyRangeLabel, opts);
  const { occupations = [], selectedOccs = [] } = opts;
  const firmName = fullInst?.name || '';
  const { occs, grand, allFYs: fys } = buildFirmWiseData(fullInst, activeExps, occupations, { selectedOccs });
  const fyPart = fys.length > 1 ? ` (FY ${fys[0]} to ${fys[fys.length-1]})` : fys.length === 1 ? ` (FY ${fys[0]})` : '';
  const title = `Firm-wise Summary — Occupation Details${fyPart}`;
  const headers = ['S.N.', 'Occupation', 'Total Trained', 'Skill Test Appeared', 'Skill Test Pass', 'Employed', 'Employment Rate'];
  let rowsHTML = '';
  occs.forEach((o, i) => {
    rowsHTML += `<tr><td style="text-align:center">${i+1}</td><td>${esc(o.name)}</td><td class="num">${o.trained||'—'}</td><td class="num">${o.stAppeared||'—'}</td><td class="num">${o.stPass||'—'}</td><td class="num">${o.employed||'—'}</td><td class="num">${o.empRate>0?o.empRate+'%':'—'}</td></tr>`;
  });
  const generalHTML = `<tr style="background:#e8f0fe;font-weight:600"><td></td><td>General (All Occupations)</td><td class="num">${grand.trained||'—'}</td><td class="num">${grand.stAppeared||'—'}</td><td class="num">${grand.stPass||'—'}</td><td class="num">${grand.employed||'—'}</td><td class="num">${grand.empRate>0?grand.empRate+'%':'—'}</td></tr>`;
  const bodyHTML = `<h3>${esc(title)}</h3><p><strong>${esc(firmName)}</strong></p><table><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rowsHTML}${generalHTML}</tbody></table>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Firm-wise Summary — ${esc(firmName)}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; margin: 30px; color: #111; }
  h2 { font-size: 15px; margin-bottom: 2px; }
  h3 { font-size: 13px; margin: 20px 0 6px; font-weight: 600; }
  p { margin: 4px 0 8px; font-size: 12px; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 24px; }
  th, td { border: 1px solid #888; padding: 5px 8px; font-size: 11.5px; }
  th { background: #d5dde8; font-weight: 600; text-align: center; vertical-align: middle; }
  td { text-align: left; }
  td.num { text-align: right; }
  @media print { body { margin: 10mm; } }
</style></head><body>
<h2>${esc(firmName)}</h2>
${fyRangeLabel ? `<p style="color:#555">FY Range: ${esc(fyRangeLabel)}</p>` : ''}
${bodyHTML}
</body></html>`;
}

// ── DOCX export ──────────────────────────────────────────────────────────────

const HEADER_FILL = 'DCE6F1';
const BORDER = { style: 'single', size: 6, color: '888888' };
const ALL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
const CELL_MARGIN = { top: 40, bottom: 40, left: 80, right: 80 };

function hdrCell(text, opts = {}) {
  return new TableCell({
    shading: { fill: HEADER_FILL },
    borders: ALL_BORDERS,
    verticalAlign: VerticalAlign.CENTER,
    margins: CELL_MARGIN,
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: String(text ?? ''), bold: true, size: 20 })],
    })],
  });
}

function dataCell(text, opts = {}) {
  return new TableCell({
    shading: opts.shading ? { fill: opts.shading } : undefined,
    borders: ALL_BORDERS,
    verticalAlign: VerticalAlign.CENTER,
    margins: CELL_MARGIN,
    children: [new Paragraph({
      alignment: opts.right ? AlignmentType.RIGHT : opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({ text: String(text ?? ''), bold: !!opts.bold, size: 20 })],
    })],
  });
}

async function downloadNSTBDOCX(fullInst, activeExps, opts = {}) {
  const { selectedOccs = [] } = opts;
  const { occs, grand, allFYs } = buildNSTBData(fullInst, activeExps, selectedOccs);
  if (!occs.length) { alert('No NSTB data to export.'); return; }
  const fyPart = allFYs.length > 1 ? ` (FY ${allFYs[0]} to ${allFYs[allFYs.length - 1]})` : allFYs.length === 1 ? ` (FY ${allFYs[0]})` : '';
  const firmName = fullInst?.name || 'Report';
  const p = (n, d) => d > 0 ? `${Math.round((n / d) * 100)}%` : '—';
  const headerRow = new TableRow({ tableHeader: true, children: [
    hdrCell('S.N.'), hdrCell('Occupation'),
    hdrCell('Applied'), hdrCell('Appeared'), hdrCell('Pass'), hdrCell('Pass %'),
  ]});
  const dataRows = occs.map((occ, i) => new TableRow({ children: [
    dataCell(i + 1, { center: true }),
    dataCell(occ.name),
    dataCell(occ.subtotal.applied || '—', { right: true }),
    dataCell(occ.subtotal.appeared || '—', { right: true }),
    dataCell(occ.subtotal.pass || '—', { right: true }),
    dataCell(p(occ.subtotal.pass, occ.subtotal.appeared), { right: true }),
  ]}));
  const GENERAL_FILL = 'D6E4F0';
  dataRows.push(new TableRow({ children: [
    dataCell('', { shading: GENERAL_FILL }),
    dataCell('Grand Total (All Occupations)', { bold: true, shading: GENERAL_FILL }),
    dataCell(grand.applied || '—', { right: true, bold: true, shading: GENERAL_FILL }),
    dataCell(grand.appeared || '—', { right: true, bold: true, shading: GENERAL_FILL }),
    dataCell(grand.pass || '—', { right: true, bold: true, shading: GENERAL_FILL }),
    dataCell(p(grand.pass, grand.appeared), { right: true, bold: true, shading: GENERAL_FILL }),
  ]}));
  const doc = new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 22 } } } },
    sections: [{ children: [
      new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { after: 100 }, children: [new TextRun({ text: firmName, bold: true, size: 28 })] }),
      new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 240, after: 100 }, children: [new TextRun({ text: `NSTB Skill Test Report — by Occupation${fyPart}`, bold: true, size: 24 })] }),
      new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, ...dataRows] }),
    ]}],
  });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${firmName.replace(/[^\w\s]/g, '').trim().replace(/\s+/g, '_')}_NSTB_SkillTest.docx`);
}

async function downloadDOCX(fullInst, activeExps, reportId, opts = {}) {
  if (reportId === 'fw2') return downloadNSTBDOCX(fullInst, activeExps, opts);
  const { occupations = [], selectedOccs = [] } = opts;
  const { occs, grand, allFYs } = buildFirmWiseData(fullInst, activeExps, occupations, { selectedOccs });
  if (!occs.length) { alert('No data to export.'); return; }

  const fyPart = allFYs.length > 1
    ? ` (FY ${allFYs[0]} to ${allFYs[allFYs.length - 1]})`
    : allFYs.length === 1 ? ` (FY ${allFYs[0]})` : '';

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      hdrCell('S.N.'), hdrCell('Occupation'), hdrCell('Total Trained'),
      hdrCell('Skill Test Appeared'), hdrCell('Skill Test Pass'),
      hdrCell('Employed'), hdrCell('Employment Rate'),
    ],
  });

  const dataRows = occs.map((occ, i) => new TableRow({
    children: [
      dataCell(i + 1, { center: true }),
      dataCell(occ.name),
      dataCell(occ.trained || '—', { right: true }),
      dataCell(occ.stAppeared || '—', { right: true }),
      dataCell(occ.stPass || '—', { right: true }),
      dataCell(occ.employed || '—', { right: true }),
      dataCell(occ.empRate > 0 ? `${occ.empRate}%` : '—', { right: true }),
    ],
  }));

  const GENERAL_FILL = 'D6E4F0';
  const totalRow = new TableRow({
    children: [
      dataCell('', { shading: GENERAL_FILL }),
      dataCell('General (All Occupations)', { bold: true, shading: GENERAL_FILL }),
      dataCell(grand.trained || '—', { right: true, bold: true, shading: GENERAL_FILL }),
      dataCell(grand.stAppeared || '—', { right: true, bold: true, shading: GENERAL_FILL }),
      dataCell(grand.stPass || '—', { right: true, bold: true, shading: GENERAL_FILL }),
      dataCell(grand.employed || '—', { right: true, bold: true, shading: GENERAL_FILL }),
      dataCell(grand.empRate > 0 ? `${grand.empRate}%` : '—', { right: true, bold: true, shading: GENERAL_FILL }),
    ],
  });

  const firmName = fullInst?.name || 'Report';
  const doc = new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 22 } } } },
    sections: [{
      children: [
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { after: 100 },
          children: [new TextRun({ text: firmName, bold: true, size: 28 })],
        }),
        new Paragraph({ spacing: { before: 120, after: 0 }, children: [] }),
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 240, after: 100 },
          children: [new TextRun({ text: `Firm-wise Summary — Occupation Details${fyPart}`, bold: true, size: 24 })],
        }),
        new Paragraph({
          spacing: { before: 60, after: 80 },
          children: [new TextRun({ text: firmName, size: 20 })],
        }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [headerRow, ...dataRows, totalRow],
        }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const fname = `${firmName.replace(/[^\w\s]/g, '').trim().replace(/\s+/g, '_')}_FirmWise_Summary.docx`;
  saveAs(blob, fname);
}

function buildCSVRow() { return {}; }
function renderRowCells() { return null; }

export default {
  id: 'firmwise',
  label: 'Firm-wise Summary',
  multiInstitute: true,
  reports: REPORTS,
  renderRowCells,
  buildCSVRow,
  buildPrintHTML,
  renderAggregateTable,
  downloadDOCX,
};

import { esc, fyYear } from './helpers.js';
import {
  Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun,
  WidthType, AlignmentType, VerticalAlign, HeadingLevel, BorderStyle,
} from 'docx';
import { saveAs } from 'file-saver';

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n) => n != null && n !== '' ? Number(n).toLocaleString('en-IN') : '—';
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';

function getClientName(exp, clients) {
  if (exp.manualClient) return exp.clientName || '—';
  const c = (clients || []).find(c => c.id === exp.clientId);
  return c?.name || exp.clientName || '—';
}
function getClientType(exp, clients) {
  if (exp.manualClient) return '—';
  const c = (clients || []).find(c => c.id === exp.clientId);
  return c?.type || '—';
}
function getOccName(occ, occupations) {
  if (occupations?.length && occ.ctevtOccupationId) {
    const found = occupations.find(o => String(o.id) === String(occ.ctevtOccupationId));
    if (found) return `${found.name}${found.level ? ` (${found.level})` : ''}`;
  }
  return occ.nameInLetter || '—';
}
function locationStr(occ) {
  return (occ.locations || []).map(l => [l.district, l.province].filter(Boolean).join(', ')).filter(Boolean).join('; ') || '—';
}

// Build NSTB lookup: { occNameLower: { fyYear: { applied, appeared, pass } } }
function buildNSTBLookup(fullInst) {
  const lookup = {};
  for (const n of (fullInst?.nstb || [])) {
    const key = (n.occupation || '').toLowerCase().trim();
    const yr = fyYear(n.fy);
    if (!lookup[key]) lookup[key] = {};
    if (!lookup[key][yr]) lookup[key][yr] = { applied: 0, appeared: 0, pass: 0 };
    lookup[key][yr].applied  += parseInt(n.applied)  || 0;
    lookup[key][yr].appeared += parseInt(n.appeared) || 0;
    lookup[key][yr].pass     += parseInt(n.pass)     || 0;
  }
  return lookup;
}

function nstbForOcc(lookup, occName, fy) {
  const key = (occName || '').toLowerCase().trim();
  return (lookup[key] || {})[fyYear(fy)] || null;
}

// ── Screen component ─────────────────────────────────────────────────────────

const TH = { background:'#dce6f1', padding:'6px 10px', border:'1px solid #aab8c8', fontWeight:600, fontSize:11, textAlign:'center', verticalAlign:'middle' };
const TD = { padding:'6px 10px', border:'1px solid #c0c8d0', fontSize:11, verticalAlign:'top' };
const TDN = { ...TD, textAlign:'right' };
const TBL = { width:'100%', borderCollapse:'collapse', marginBottom:0 };
const CARD = { border:'1px solid #c8d4e0', borderRadius:6, marginBottom:16, overflow:'hidden' };
const CARD_HDR = { background:'#eef3fb', padding:'10px 14px', borderBottom:'1px solid #c8d4e0', display:'flex', gap:16, alignItems:'baseline', flexWrap:'wrap' };

function DetailedReport({ fullInst, activeExps, clients, occupations }) {
  if (!activeExps.length) return (
    <div style={{ padding:24, color:'var(--text3)', fontSize:13, textAlign:'center' }}>
      No assignments found for the selected FY range.
    </div>
  );

  const nstbLookup = buildNSTBLookup(fullInst);

  return (
    <div>
      {activeExps.map((exp, idx) => {
        const clientName = getClientName(exp, clients);
        const clientType = getClientType(exp, clients);
        const startLabel = exp.startDate ? fmtDate(exp.startDate) : (exp.startFY ? `FY ${exp.startFY}` : '—');
        const endLabel   = exp.endDate   ? fmtDate(exp.endDate)   : (exp.endFY   ? `FY ${exp.endFY}`   : '—');
        return (
          <div key={exp.id} style={CARD}>
            {/* Assignment header */}
            <div style={CARD_HDR}>
              <span style={{ fontWeight:700, fontSize:13 }}>#{idx + 1} &nbsp;{exp.assignmentName || '(Unnamed Assignment)'}</span>
              {exp.fy && <span style={{ fontSize:11, background:'#d0e4f7', color:'#1a4a7a', borderRadius:3, padding:'1px 7px' }}>FY {exp.fy}</span>}
              {exp.trainingType && <span style={{ fontSize:11, background:'#e8f5e9', color:'#2e7d32', borderRadius:3, padding:'1px 7px' }}>{exp.trainingType}</span>}
              {exp.isGesi && <span style={{ fontSize:10, background:'#fce4ec', color:'#880e4f', borderRadius:3, padding:'1px 6px' }}>GESI</span>}
              {exp.isResidential && <span style={{ fontSize:10, background:'#fff3e0', color:'#e65100', borderRadius:3, padding:'1px 6px' }}>Residential</span>}
              {exp.isJV && <span style={{ fontSize:10, background:'#f3e5f5', color:'#6a1b9a', borderRadius:3, padding:'1px 6px' }}>JV ({exp.jvRole})</span>}
            </div>

            {/* Meta info row */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:0, borderBottom:'1px solid #c8d4e0' }}>
              {[
                ['Client', clientName],
                ['Funding Agency / Type', clientType],
                ['Start Date', startLabel],
                ['End Date', endLabel],
                ['Contract Value (NPR)', exp.contractValue ? fmt(exp.contractValue) : '—'],
                ['Duration (Days)', exp.durationDays || '—'],
                ['Country', exp.country || 'Nepal'],
                ['JV Partners', exp.isJV ? (exp.jvPartnerNames || exp.jvPartners || '—') : '—'],
              ].map(([label, value]) => (
                <div key={label} style={{ padding:'7px 12px', borderRight:'1px solid #e0e8f0', borderBottom:'1px solid #e8eef5' }}>
                  <div style={{ fontSize:10, color:'var(--text3)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.04em' }}>{label}</div>
                  <div style={{ fontSize:12, marginTop:2 }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Occupations table */}
            {exp.occupations?.length > 0 && (
              <div style={{ overflowX:'auto' }}>
                <table style={TBL}>
                  <thead>
                    <tr>
                      <th style={{...TH, width:28}}>#</th>
                      <th style={{...TH, textAlign:'left'}}>Occupation</th>
                      <th style={TH}>Level</th>
                      <th style={TH}>Trainees</th>
                      <th style={TH}>Duration (hrs)</th>
                      <th style={TH}>Skill Test Prov.</th>
                      <th style={TH}>Appeared</th>
                      <th style={TH}>Pass</th>
                      <th style={TH}>Emp. Prov.</th>
                      <th style={TH}>Emp. %</th>
                      <th style={TH}>Employed</th>
                      <th style={{...TH, textAlign:'left'}}>Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exp.occupations.map((occ, j) => {
                      const occName = getOccName(occ, occupations);
                      const nstb = nstbForOcc(nstbLookup, occName, exp.fy);
                      const appeared = occ.skillTestAppeared || nstb?.appeared || null;
                      const pass     = occ.skillTestPass     || nstb?.pass     || null;
                      const trainees = parseInt(occ.trainees) || 0;
                      const empPct   = parseFloat(occ.employmentActual) || 0;
                      const employed = trainees && empPct ? Math.round(trainees * empPct / 100) : null;
                      return (
                      <tr key={occ.id || j} style={{ background: j % 2 === 0 ? '#fff' : '#f8fafc' }}>
                        <td style={{...TD, textAlign:'center', color:'var(--text3)'}}>{j + 1}</td>
                        <td style={TD}>{occName}</td>
                        <td style={{...TD, textAlign:'center'}}>{occ.level || '—'}</td>
                        <td style={TDN}>{occ.trainees || '—'}</td>
                        <td style={TDN}>{occ.duration || '—'}</td>
                        <td style={{...TD, textAlign:'center'}}>
                          <span style={{ fontSize:10, fontWeight:600, padding:'1px 6px', borderRadius:3,
                            background: occ.skillTestProvisioned ? '#d4edda' : '#f8d7da',
                            color: occ.skillTestProvisioned ? '#155724' : '#721c24' }}>
                            {occ.skillTestProvisioned ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td style={TDN}>{appeared ?? '—'}</td>
                        <td style={TDN}>{pass ?? '—'}</td>
                        <td style={{...TD, textAlign:'center'}}>
                          <span style={{ fontSize:10, fontWeight:600, padding:'1px 6px', borderRadius:3,
                            background: occ.employmentProvisioned ? '#d4edda' : '#f8d7da',
                            color: occ.employmentProvisioned ? '#155724' : '#721c24' }}>
                            {occ.employmentProvisioned ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td style={TDN}>{occ.employmentActual ? `${occ.employmentActual}%` : '—'}</td>
                        <td style={TDN}>{employed ?? '—'}</td>
                        <td style={TD}>{locationStr(occ)}</td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Remarks */}
            {exp.remarks && (
              <div style={{ padding:'8px 14px', borderTop:'1px solid #e8eef5', fontSize:11, color:'var(--text2)', background:'#fafbfc' }}>
                <strong>Remarks:</strong> {exp.remarks}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Print HTML ────────────────────────────────────────────────────────────────

function buildDetailedPrintHTML(fullInst, activeExps, clients, reportId, fyRangeLabel, opts = {}) {
  const { occupations = [] } = opts;
  const firmName = fullInst?.name || '';
  let body = '';

  const nstbLookup = buildNSTBLookup(fullInst);

  activeExps.forEach((exp, idx) => {
    const clientName = getClientName(exp, clients);
    const clientType = getClientType(exp, clients);
    const tags = [exp.trainingType, exp.isGesi ? 'GESI' : '', exp.isResidential ? 'Residential' : '', exp.isJV ? `JV (${exp.jvRole})` : ''].filter(Boolean).join(' | ');
    const startLabel = exp.startDate ? fmtDate(exp.startDate) : (exp.startFY ? `FY ${exp.startFY}` : '—');
    const endLabel   = exp.endDate   ? fmtDate(exp.endDate)   : (exp.endFY   ? `FY ${exp.endFY}`   : '—');

    body += `<div class="assignment">
<h3>#${idx+1} ${esc(exp.assignmentName || '(Unnamed Assignment)')} — FY ${esc(exp.fy)}</h3>
${tags ? `<p class="tags">${esc(tags)}</p>` : ''}
<table class="meta">
  <tr><td><b>Client:</b> ${esc(clientName)}</td><td><b>Funding Agency/Type:</b> ${esc(clientType)}</td><td><b>Contract Value (NPR):</b> ${exp.contractValue ? fmt(exp.contractValue) : '—'}</td></tr>
  <tr><td><b>Start Date:</b> ${esc(startLabel)}</td><td><b>End Date:</b> ${esc(endLabel)}</td><td><b>Duration (Days):</b> ${exp.durationDays || '—'}</td></tr>
  ${exp.isJV ? `<tr><td colspan="3"><b>JV Partners:</b> ${esc(exp.jvPartnerNames || exp.jvPartners || '—')}</td></tr>` : ''}
</table>`;

    if (exp.occupations?.length) {
      body += `<table>
<thead><tr>
  <th>#</th><th>Occupation</th><th>Level</th><th>Trainees</th><th>Duration (hrs)</th>
  <th>Skill Test Prov.</th><th>Appeared</th><th>Pass</th>
  <th>Emp. Prov.</th><th>Emp. %</th><th>Employed</th><th>Location</th>
</tr></thead><tbody>`;
      exp.occupations.forEach((occ, j) => {
        const oName = getOccName(occ, occupations);
        const nstb = nstbForOcc(nstbLookup, oName, exp.fy);
        const appeared = occ.skillTestAppeared || nstb?.appeared || '—';
        const pass     = occ.skillTestPass     || nstb?.pass     || '—';
        const trainees = parseInt(occ.trainees) || 0;
        const empPct   = parseFloat(occ.employmentActual) || 0;
        const employed = trainees && empPct ? Math.round(trainees * empPct / 100) : '—';
        body += `<tr>
<td class="c">${j+1}</td>
<td>${esc(oName)}</td>
<td class="c">${esc(occ.level||'—')}</td>
<td class="r">${occ.trainees||'—'}</td>
<td class="r">${occ.duration||'—'}</td>
<td class="c">${occ.skillTestProvisioned?'Yes':'No'}</td>
<td class="r">${appeared}</td>
<td class="r">${pass}</td>
<td class="c">${occ.employmentProvisioned?'Yes':'No'}</td>
<td class="r">${occ.employmentActual?occ.employmentActual+'%':'—'}</td>
<td class="r">${employed}</td>
<td>${esc(locationStr(occ))}</td>
</tr>`;
      });
      body += `</tbody></table>`;
    }

    if (exp.remarks) body += `<p><b>Remarks:</b> ${esc(exp.remarks)}</p>`;
    body += `</div>`;
  });

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Detailed Experience Report — ${esc(firmName)}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:11px;margin:20px;color:#111}
  h2{font-size:14px;margin-bottom:4px}
  h3{font-size:12px;margin:0 0 4px;font-weight:700}
  p{margin:2px 0 6px}
  .tags{color:#555;font-size:10px}
  .assignment{border:1px solid #aaa;border-radius:4px;margin-bottom:14px;padding:10px;page-break-inside:avoid}
  table{border-collapse:collapse;width:100%;margin:6px 0 8px;font-size:10.5px}
  th,td{border:1px solid #999;padding:4px 6px}
  th{background:#d5dde8;font-weight:600;text-align:center}
  .meta{border:none}
  .meta td{border:none;border-bottom:1px solid #eee;padding:3px 8px 3px 0;width:33%}
  td.c{text-align:center} td.r{text-align:right}
  @media print{body{margin:8mm}.assignment{page-break-inside:avoid}}
</style></head><body>
<h2>${esc(firmName)} — Detailed Experience Report</h2>
${fyRangeLabel ? `<p style="color:#555;font-size:10px">FY Range: ${esc(fyRangeLabel)}</p>` : ''}
${body}
</body></html>`;
}

// ── DOCX export ───────────────────────────────────────────────────────────────

const BORDER = { style: BorderStyle.SINGLE, size: 4, color: '999999' };
const ALL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
const NO_BORDERS = { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } };
const CELL_MARGIN = { top: 40, bottom: 40, left: 80, right: 80 };
const HDR_FILL = 'DCE6F1';
const META_FILL = 'EEF3FB';
const TOTAL_FILL = 'E8F0FE';

function dc(text, opts = {}) {
  return new TableCell({
    shading: opts.fill ? { fill: opts.fill } : undefined,
    borders: opts.noBorder ? NO_BORDERS : ALL_BORDERS,
    verticalAlign: VerticalAlign.TOP,
    columnSpan: opts.span || 1,
    margins: CELL_MARGIN,
    children: [new Paragraph({
      alignment: opts.center ? AlignmentType.CENTER : opts.right ? AlignmentType.RIGHT : AlignmentType.LEFT,
      children: [new TextRun({ text: String(text ?? '—'), bold: !!opts.bold, size: 18 })],
    })],
  });
}
function hc(text, opts = {}) {
  return new TableCell({
    shading: { fill: opts.fill || HDR_FILL },
    borders: ALL_BORDERS,
    verticalAlign: VerticalAlign.CENTER,
    columnSpan: opts.span || 1,
    margins: CELL_MARGIN,
    children: [new Paragraph({
      alignment: opts.center !== false ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({ text: String(text ?? ''), bold: true, size: 18 })],
    })],
  });
}

async function downloadDetailedDOCX(fullInst, activeExps, reportId, opts = {}) {
  const { occupations = [], fromFY, toFY } = opts;
  const clients = opts.clients || [];
  const firmName = fullInst?.name || 'Firm';
  const fyLabel = fromFY || toFY ? `FY ${fromFY || '…'} – ${toFY || '…'}` : '';
  const nstbLookup = buildNSTBLookup(fullInst);

  const children = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: `${firmName} — Detailed Experience Report`, bold: true, size: 28 })],
    }),
  ];

  if (fyLabel) {
    children.push(new Paragraph({ children: [new TextRun({ text: `FY Range: ${fyLabel}`, size: 20, color: '555555' })] }));
  }

  activeExps.forEach((exp, idx) => {
    const clientName = getClientName(exp, clients);
    const clientType = getClientType(exp, clients);
    const startLabel = exp.startDate ? fmtDate(exp.startDate) : (exp.startFY ? `FY ${exp.startFY}` : '—');
    const endLabel   = exp.endDate   ? fmtDate(exp.endDate)   : (exp.endFY   ? `FY ${exp.endFY}`   : '—');

    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 240, after: 60 },
      children: [new TextRun({ text: `#${idx+1}  ${exp.assignmentName || '(Unnamed Assignment)'}  —  FY ${exp.fy}`, bold: true, size: 24 })],
    }));

    // Meta table
    const metaRows = [
      ['Client', clientName, 'Funding Agency/Type', clientType],
      ['Start Date', startLabel, 'End Date', endLabel],
      ['Contract Value (NPR)', exp.contractValue ? fmt(exp.contractValue) : '—', 'Duration (Days)', exp.durationDays || '—'],
      ['Training Type', exp.trainingType || '—', 'Flags', [exp.isGesi?'GESI':'', exp.isResidential?'Residential':'', exp.isJV?`JV (${exp.jvRole})`:''].filter(Boolean).join(', ') || 'None'],
    ];
    if (exp.isJV) metaRows.push(['JV Partners', exp.jvPartnerNames || exp.jvPartners || '—', '', '']);

    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: metaRows.map(([l1, v1, l2, v2]) => new TableRow({
        children: [
          dc(l1, { bold: true, fill: META_FILL }),
          dc(v1),
          dc(l2, { bold: true, fill: META_FILL }),
          dc(v2),
        ],
      })),
    }));

    // Occupations table
    if (exp.occupations?.length) {
      children.push(new Paragraph({ spacing: { before: 120, after: 40 }, children: [new TextRun({ text: 'Occupations / Training Details', bold: true, size: 20 })] }));
      children.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            tableHeader: true,
            children: [
              hc('#', { center: true }), hc('Occupation', { center: false }), hc('Level'), hc('Trainees'),
              hc('Duration (hrs)'), hc('Skill Test Prov.'), hc('Appeared'), hc('Pass'),
              hc('Emp. Prov.'), hc('Emp. %'), hc('Employed'), hc('Location', { center: false }),
            ],
          }),
          ...exp.occupations.map((occ, j) => {
            const oName = getOccName(occ, occupations);
            const nstb = nstbForOcc(nstbLookup, oName, exp.fy);
            const appeared = occ.skillTestAppeared || nstb?.appeared || '—';
            const pass     = occ.skillTestPass     || nstb?.pass     || '—';
            const trainees = parseInt(occ.trainees) || 0;
            const empPct   = parseFloat(occ.employmentActual) || 0;
            const employed = trainees && empPct ? Math.round(trainees * empPct / 100) : '—';
            return new TableRow({
              children: [
                dc(j+1, { center: true }),
                dc(oName),
                dc(occ.level || '—', { center: true }),
                dc(occ.trainees || '—', { right: true }),
                dc(occ.duration || '—', { right: true }),
                dc(occ.skillTestProvisioned ? 'Yes' : 'No', { center: true }),
                dc(appeared, { right: true }),
                dc(pass, { right: true }),
                dc(occ.employmentProvisioned ? 'Yes' : 'No', { center: true }),
                dc(occ.employmentActual ? `${occ.employmentActual}%` : '—', { right: true }),
                dc(employed, { right: true }),
                dc(locationStr(occ)),
              ],
            });
          }),
        ],
      }));
    }

    if (exp.remarks) {
      children.push(new Paragraph({
        spacing: { before: 80 },
        children: [new TextRun({ text: 'Remarks: ', bold: true, size: 20 }), new TextRun({ text: exp.remarks, size: 20 })],
      }));
    }
  });

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
    sections: [{ properties: {}, children }],
  });

  const blob = await Packer.toBlob(doc);
  const fname = `DetailedExperience_${(fullInst?.acronym || firmName).replace(/\s+/g,'_')}${fyLabel ? `_${fyLabel.replace(/[^\w]+/g,'_')}` : ''}.docx`;
  saveAs(blob, fname);
}

// ── Report family ─────────────────────────────────────────────────────────────

export const REPORTS = [
  {
    id: 'det1',
    label: 'Detailed Experience Report',
    aggregate: true,
    hasOccupationFilter: false,
    requiredFields: [],
    columns: [],
  },
];

export function renderAggregateTable(fullInst, activeExps, clients, reportId, opts = {}) {
  return <DetailedReport fullInst={fullInst} activeExps={activeExps} clients={clients} occupations={opts.occupations || []} />;
}

export function renderRowCells() { return null; }

export function buildCSVRow() { return {}; }

export function buildPrintHTML(fullInst, activeExps, clients, reportId, fyRangeLabel, opts = {}) {
  return buildDetailedPrintHTML(fullInst, activeExps, clients, reportId, fyRangeLabel, opts);
}

export async function downloadDOCX(fullInst, activeExps, reportId, opts = {}) {
  return downloadDetailedDOCX(fullInst, activeExps, reportId, opts);
}

export default {
  id: 'detailed',
  label: 'Detailed Experience',
  noInstitute: false,
  reports: REPORTS,
  renderRowCells,
  buildCSVRow,
  buildPrintHTML,
  renderAggregateTable,
  downloadDOCX,
};

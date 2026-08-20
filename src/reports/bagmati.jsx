import {
  Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun,
  WidthType, AlignmentType, VerticalAlign, BorderStyle,
} from 'docx';
import { saveAs } from 'file-saver';
import { getClient, esc, fyInRange } from './helpers.js';

// ─── Bagmati Province RFP Format ─────────────────────────────────────────────
// Mirrors the Bagmati Province RFP's "B - Consultant's Experience" annex:
//   B.1  Current Portfolio
//   B.2  General Experience (160 Hours+ Vocational Skills Training)
//   B.3  Specific Experience in Proposed Sector(s)
//   B.4  Financial Experience (tax clearance)
// Every report is `aggregate` — same reasoning as bolpatra.jsx: ReportsView's
// per-row path is never used here.
//
// B.1/B.2/B.3 all read from the FY range already on the sidebar (fromFY/toFY),
// so which years they cover is a plain filter, not baked into the report. B.4
// uses its own turnover FY range (turnoverFromFY/turnoverToFY), the same split
// bolpatra.jsx uses for 4(A) — a bid's tax-clearance years and its training
// years are usually asked for separately.

const REPORTS = [
  { id: 'full', label: 'Complete RFP Format', aggregate: true, hasOccupationFilter: true, hasTurnoverFY: true },
  { id: 'b1', label: 'B.1 Current Portfolio', aggregate: true },
  { id: 'b2', label: 'B.2 General Experience', aggregate: true },
  { id: 'b3', label: 'B.3 Specific Experience', aggregate: true, hasOccupationFilter: true },
  { id: 'b4', label: 'B.4 Financial Experience', aggregate: true, hasTurnoverFY: true },
];

const SECTION_ORDER = ['b1', 'b2', 'b3', 'b4'];
const sectionsFor = (reportId) => reportId === 'full' ? SECTION_ORDER : [reportId];

const SECTION_TITLES = {
  b1: { heading: 'B.1 Current Portfolio',
        note: 'Details about the current portfolio that the consultants are implementing or have implemented, for the selected fiscal years.' },
  b2: { heading: 'B.2 General Experience',
        note: 'General Experience in 160 Hours+ Vocational Skills Training, for the selected fiscal years.' },
  b3: { heading: 'B.3 Specific Experience',
        note: 'Specific Experience in Proposed Sector(s) — Training and Skill Testing.' },
  b4: { heading: 'B.4 Financial Experience',
        note: 'Tax clearance certificate for the selected fiscal years.' },
};

// ─── Value formatting ────────────────────────────────────────────────────────

const dash = (v) => (v === 0 || v) && String(v).trim() !== '' ? String(v) : '';

const fmtNrs = (v) => {
  if (v == null || v === '') return '';
  const n = Number(v);
  return isNaN(n) ? String(v) : n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
};

const clientNameOf = (exp, clients) => {
  const c = getClient(clients, exp.clientId);
  return c.fullName || exp.clientName || '';
};

/** Occupation name + sector, resolved through the master list when possible. */
const occInfo = (occ, occupations) => {
  if (occupations?.length && occ.ctevtOccupationId) {
    const found = occupations.find(o => String(o.id) === String(occ.ctevtOccupationId));
    if (found) return { name: found.name, sector: found.sector || '' };
  }
  return { name: occ.nameInLetter || '', sector: '' };
};

// ─── Section models ──────────────────────────────────────────────────────────
// Each returns { columns, rows, totalRow? } — a shape the JSX, print-HTML and
// DOCX renderers all consume the same way, so the three stay in sync.

/** B.1 — one row per occupation on an assignment, not per assignment. */
function modelB1(exps, clients, occupations) {
  const rows = [];
  for (const exp of exps) {
    const occs = (exp.occupations || []).length ? exp.occupations : [{}];
    for (const occ of occs) {
      rows.push([
        String(rows.length + 1),
        dash(exp.assignmentName),
        occInfo(occ, occupations).name,
        dash(occ.trainees),
        dash(exp.startDate),
        dash(exp.endDate),
        fmtNrs(exp.contractValue),
        clientNameOf(exp, clients),
      ]);
    }
  }
  return {
    columns: ['S.N.', 'Assignment Name', 'Occupation', 'No. Of Trainees', 'Start Date', 'End Date', 'Contract Amount', 'Client'],
    rows,
  };
}

/**
 * B.2 — General Experience, scoped to 160-hour+ occupation rows. The "Total"
 * row's Employment Percentage is the trainee-weighted average across every
 * row with an employment figure, per the form's own note — a simple mean
 * would let a tiny assignment count as much as the firm's largest one.
 */
function modelB2(exps, clients, occupations) {
  const rows = [];
  let totalTrainees = 0, totalAppeared = 0, weightedSum = 0, weightedDenom = 0;
  for (const exp of exps) {
    for (const occ of (exp.occupations || [])) {
      const duration = parseFloat(occ.duration) || 0;
      if (duration < 160) continue;
      const info = occInfo(occ, occupations);
      const trainees = parseInt(occ.trainees) || 0;
      const appeared = parseInt(occ.skillTestAppeared) || 0;
      totalTrainees += trainees;
      totalAppeared += appeared;
      if (occ.employmentActual !== '' && occ.employmentActual != null) {
        weightedSum += (parseFloat(occ.employmentActual) || 0) * trainees;
        weightedDenom += trainees;
      }
      rows.push([
        clientNameOf(exp, clients),
        dash(exp.fy),
        dash(exp.assignmentName),
        info.sector,
        info.name,
        dash(occ.trainees),
        dash(occ.skillTestAppeared),
        occ.employmentActual !== '' && occ.employmentActual != null ? `${occ.employmentActual}%` : '',
      ]);
    }
  }
  const totalEmp = weightedDenom > 0 ? `${(weightedSum / weightedDenom).toFixed(1)}%` : '';
  return {
    columns: ['Funding Agency', 'Fiscal Year', 'Assignment Name', 'Sector', 'Occupation',
      'No of graduate trainees', 'No of trainees appeared in the skill test', 'Employment Percentage (%)'],
    rows,
    totalRow: ['', '', '', '', 'Total', String(totalTrainees), String(totalAppeared), totalEmp],
  };
}

/**
 * B.3 — Specific Experience, scoped to the selected occupation(s) — the
 * "proposed sector(s)" the bid is actually for. Unlike B.2 this has no
 * Employment Percentage column; the form doesn't ask for one here.
 */
function modelB3(exps, clients, occupations, selectedOccs = []) {
  const wanted = selectedOccs.map(s => s.toLowerCase());
  const rows = [];
  let totalTrainees = 0, totalAppeared = 0;
  for (const exp of exps) {
    for (const occ of (exp.occupations || [])) {
      const info = occInfo(occ, occupations);
      if (wanted.length && !wanted.includes((info.name || '').toLowerCase())) continue;
      const trainees = parseInt(occ.trainees) || 0;
      const appeared = parseInt(occ.skillTestAppeared) || 0;
      totalTrainees += trainees;
      totalAppeared += appeared;
      rows.push([
        clientNameOf(exp, clients),
        dash(exp.fy),
        dash(exp.assignmentName),
        info.name,
        dash(occ.trainees),
        dash(occ.skillTestAppeared),
      ]);
    }
  }
  return {
    columns: ['Funding Agency', 'FY', 'Assignment Name', 'Occupation', 'No of graduate trainees', 'No of trainees appeared in the skill test'],
    rows,
    totalRow: ['', '', '', 'Total', String(totalTrainees), String(totalAppeared)],
  };
}

/** B.4 — tax clearance records, using the turnover FY range like bolpatra 4(A). */
function modelB4(inst, opts = {}) {
  const fromFY = opts.turnoverFromFY ?? '';
  const toFY   = opts.turnoverToFY ?? '';
  const records = (inst?.taxClearance || [])
    .filter(t => t.fy && (!fromFY && !toFY ? true : fyInRange(t.fy, fromFY, toFY)))
    .slice()
    .sort((a, b) => String(a.fy).localeCompare(String(b.fy)));

  let totalTurnover = 0, totalTax = 0;
  const rows = records.map(t => {
    totalTurnover += Number(t.turnover) || 0;
    totalTax += Number(t.taxPaid) || 0;
    return [dash(t.fy), fmtNrs(t.turnover), fmtNrs(t.taxPaid), dash(t.remarks)];
  });

  return {
    columns: ['Fiscal Year', 'Total Turnover', 'Total Tax Paid', 'Remarks'],
    rows,
    totalRow: rows.length ? ['Total', fmtNrs(totalTurnover), fmtNrs(totalTax), ''] : null,
  };
}

function modelFor(section, exps, clients, inst, opts) {
  const occupations = opts.occupations || [];
  if (section === 'b1') return modelB1(exps, clients, occupations);
  if (section === 'b2') return modelB2(exps, clients, occupations);
  if (section === 'b3') return modelB3(exps, clients, occupations, opts.selectedOccs);
  if (section === 'b4') return modelB4(inst, opts);
  return { columns: [], rows: [] };
}

// ─── Screen render ───────────────────────────────────────────────────────────

const TH = { background:'#dce6f1', border:'1px solid #8ba3bd', padding:'6px 8px',
             fontSize:11, fontWeight:600, textAlign:'left', color:'#111' };
const TD = { border:'1px solid #8ba3bd', padding:'6px 8px', fontSize:11,
             verticalAlign:'top', color:'var(--text1)' };
const TOTAL_TD = { ...TD, fontWeight:700, background:'#eef3fb' };

function GridTable({ model }) {
  if (!model.rows.length) {
    return <div style={{fontSize:12, color:'var(--text3)', padding:'8px 0'}}>No records in range.</div>;
  }
  return (
    <div style={{overflowX:'auto'}}>
      <table style={{borderCollapse:'collapse', width:'100%'}}>
        <thead><tr>{model.columns.map(c => <th key={c} style={TH}>{c}</th>)}</tr></thead>
        <tbody>
          {model.rows.map((row, i) => (
            <tr key={i}>{row.map((v, j) => <td key={j} style={TD}>{v || '—'}</td>)}</tr>
          ))}
          {model.totalRow && (
            <tr>{model.totalRow.map((v, j) => <td key={j} style={TOTAL_TD}>{v || ''}</td>)}</tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function renderAggregateTable(inst, exps, clients, reportId, opts = {}) {
  const sections = sectionsFor(reportId);
  return (
    <div>
      <div style={{fontWeight:700, fontSize:14, marginBottom:4}}>{inst?.name || 'Firm'}</div>
      {inst?.acronym && <div style={{fontSize:11, color:'var(--text3)', marginBottom:14}}>{inst.acronym}</div>}
      {sections.map(s => (
        <div key={s} style={{marginBottom:26}}>
          <div style={{fontWeight:700, fontSize:13, marginBottom:2}}>{SECTION_TITLES[s].heading}</div>
          <div style={{fontSize:11, color:'var(--text3)', fontStyle:'italic', marginBottom:10}}>{SECTION_TITLES[s].note}</div>
          <GridTable model={modelFor(s, exps, clients, inst, opts)} />
        </div>
      ))}
    </div>
  );
}

// ─── Print / PDF ─────────────────────────────────────────────────────────────

const htmlGrid = (model) => `
  <table>
    <thead><tr>${model.columns.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
    <tbody>
      ${model.rows.length
        ? model.rows.map(r => `<tr>${r.map(v => `<td>${esc(v) || '&mdash;'}</td>`).join('')}</tr>`).join('')
        : `<tr><td colspan="${model.columns.length}">No records in range.</td></tr>`}
      ${model.totalRow ? `<tr class="total-row">${model.totalRow.map(v => `<td>${esc(v) || ''}</td>`).join('')}</tr>` : ''}
    </tbody>
  </table>`;

const printShell = (title, bodyHtml) => `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>${esc(title)}</title>
<style>
  @page { size: A4; margin: 18mm; }
  :root { color-scheme: light; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px;
         color: #000; background: #fff; margin: 0; }
  .firm { font-size: 15px; font-weight: 700; margin-bottom: 2px; }
  .firm-sub { font-size: 11px; color: #555; margin-bottom: 14px; }
  .section { margin-bottom: 24px; page-break-inside: auto; }
  h2 { font-size: 13px; margin: 0 0 2px; }
  .sub { font-size: 11px; font-style: italic; color: #444; margin: 0 0 8px; }
  table { border-collapse: collapse; width: 100%; table-layout: fixed; }
  th, td { border: 1px solid #000; padding: 5px 7px; vertical-align: top;
           font-size: 10.5px; word-wrap: break-word; overflow-wrap: break-word; }
  th { font-weight: bold; text-align: left; background: #eee; }
  .total-row td { font-weight: bold; background: #eee; }
  @media print { body { margin: 0; } }
</style></head><body>
  ${bodyHtml}
</body></html>`;

function buildPrintHTML(inst, exps, clients, reportId, fyRangeLabel, opts = {}) {
  const sections = sectionsFor(reportId);
  const body = `
    <div class="firm">${esc(inst?.name || '')}</div>
    ${inst?.acronym ? `<div class="firm-sub">${esc(inst.acronym)}</div>` : ''}
    ${fyRangeLabel ? `<div class="firm-sub">${esc(fyRangeLabel)}</div>` : ''}
    ${sections.map(s => `
      <div class="section">
        <h2>${esc(SECTION_TITLES[s].heading)}</h2>
        <p class="sub">${esc(SECTION_TITLES[s].note)}</p>
        ${htmlGrid(modelFor(s, exps, clients, inst, opts))}
      </div>`).join('')}`;
  return printShell(`Bagmati Province RFP Format — ${inst?.name || ''}`, body);
}

// ─── Word (.docx) export ─────────────────────────────────────────────────────

const BORDER = { style: BorderStyle.SINGLE, size: 4, color: '999999' };
const ALL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
const CELL_MARGIN = { top: 40, bottom: 40, left: 80, right: 80 };
const HDR_FILL = 'DCE6F1';
const TOTAL_FILL = 'EEF3FB';

function docxCell(text, opts = {}) {
  return new TableCell({
    shading: opts.fill ? { fill: opts.fill } : undefined,
    borders: ALL_BORDERS,
    verticalAlign: VerticalAlign.TOP,
    margins: CELL_MARGIN,
    children: [new Paragraph({
      children: [new TextRun({ text: String(text ?? '—') || '—', bold: !!opts.bold, size: 17 })],
    })],
  });
}

function docxTable(model) {
  const header = new TableRow({
    tableHeader: true,
    children: model.columns.map(c => docxCell(c, { bold: true, fill: HDR_FILL })),
  });
  const body = model.rows.length
    ? model.rows.map(r => new TableRow({ children: r.map(v => docxCell(v)) }))
    : [new TableRow({ children: [docxCell('No records in range.', {})] })];
  const totalRow = model.totalRow
    ? [new TableRow({ children: model.totalRow.map(v => docxCell(v, { bold: true, fill: TOTAL_FILL })) })]
    : [];
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...body, ...totalRow] });
}

async function downloadDOCX(fullInst, activeExps, reportId, opts = {}) {
  const sections = sectionsFor(reportId);
  const children = [
    new Paragraph({ children: [new TextRun({ text: fullInst?.name || 'Firm', bold: true, size: 28 })], spacing: { after: 60 } }),
  ];
  if (fullInst?.acronym) {
    children.push(new Paragraph({ children: [new TextRun({ text: fullInst.acronym, size: 18, color: '555555' })], spacing: { after: 160 } }));
  }
  sections.forEach((s, idx) => {
    children.push(new Paragraph({
      children: [new TextRun({ text: SECTION_TITLES[s].heading, bold: true, size: 24 })],
      spacing: { before: idx === 0 ? 0 : 260, after: 40 },
    }));
    children.push(new Paragraph({
      children: [new TextRun({ text: SECTION_TITLES[s].note, italics: true, size: 17, color: '444444' })],
      spacing: { after: 120 },
    }));
    children.push(docxTable(modelFor(s, activeExps, opts.clients || [], fullInst, opts)));
  });

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
    sections: [{ properties: {}, children }],
  });

  const blob = await Packer.toBlob(doc);
  const safe = (s) => String(s).replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '');
  saveAs(blob, `Bagmati_RFP_${safe(fullInst?.acronym || fullInst?.name || 'firm')}.docx`);
}

const bagmati = {
  id: 'bagmati',
  label: 'Bagmati Province RFP Format',
  reports: REPORTS,
  renderAggregateTable,
  buildPrintHTML,
  downloadDOCX,
};

export default bagmati;

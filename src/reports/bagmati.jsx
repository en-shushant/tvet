import {
  Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun,
  WidthType, AlignmentType, VerticalAlign, BorderStyle, VerticalMergeType,
} from 'docx';
import { saveAs } from 'file-saver';
import { getClient, esc, fyInRange, occMasterName, occLetterName } from './helpers.js';

// ─── Bagmati Province RFP Format ─────────────────────────────────────────────
// Mirrors the Bagmati Province RFP's "B - Consultant's Experience" annex:
//   B.1  Current Portfolio
//   B.2  General Experience (160 Hours+ Vocational Skills Training)
//   B.3  Specific Experience in Proposed Sector(s)
//   B.4  Financial Experience (tax clearance)
// Every report is `aggregate` — same reasoning as bolpatra.jsx: ReportsView's
// per-row path is never used here.
//
// B.2/B.3 read the experience FY range already on the sidebar (fromFY/toFY).
// B.1's own portfolio years are a separate range (portfolioFromFY/portfolioToFY)
// so the "current portfolio" window doesn't have to be the same span as the
// experience tables — B.1 reads the firm's full experience list directly
// (via `inst`) rather than the already fromFY/toFY-narrowed `exps` the other
// sections get, the same way B.4's turnover years are independent too.

const REPORTS = [
  { id: 'full', label: 'Complete RFP Format', aggregate: true, hasOccupationFilter: true, hasTurnoverFY: true, hasPortfolioFY: true },
  { id: 'b1', label: 'B.1 Current Portfolio', aggregate: true, hasPortfolioFY: true },
  { id: 'b2', label: 'B.2 General Experience', aggregate: true },
  { id: 'b3', label: 'B.3 Specific Experience', aggregate: true, hasOccupationFilter: true },
  { id: 'b4', label: 'B.4 Financial Experience', aggregate: true, hasTurnoverFY: true },
];

const SECTION_ORDER = ['b1', 'b2', 'b3', 'b4'];
const sectionsFor = (reportId) => reportId === 'full' ? SECTION_ORDER : [reportId];

/** "FY 2081/82 and 2082/83" — how B.1's own heading names its two portfolio years. */
const fyPairText = (fromFY, toFY) => {
  if (fromFY && toFY && fromFY !== toFY) return `FY ${fromFY} and ${toFY}`;
  if (fromFY || toFY) return `FY ${fromFY || toFY}`;
  return '';
};

/** "FY 2076/077 – 2082/083" — the range form B.2/B.3's headings quote. */
const fyRangeText = (fromFY, toFY, joiner = ' – ') => {
  if (fromFY && toFY) return `FY ${fromFY}${joiner}${toFY}`;
  if (fromFY) return `FY ${fromFY}`;
  if (toFY) return `FY ${toFY}`;
  return '';
};

/**
 * Section headings quote the actual selected FY range in place of the RFP
 * form's own example years, so which years a table covers reads directly off
 * it rather than needing the sidebar filter to confirm.
 */
function sectionTitlesFor(opts = {}) {
  const { fromFY = '', toFY = '', turnoverFromFY = '', turnoverToFY = '',
          portfolioFromFY = '', portfolioToFY = '' } = opts;
  const portfolioFY = fyPairText(portfolioFromFY, portfolioToFY);
  const rangeFY      = fyRangeText(fromFY, toFY);
  const turnoverFY   = fyRangeText(turnoverFromFY, turnoverToFY, ' to ');

  return {
    b1: {
      heading: 'Table 1: Current Portfolio',
      note: 'Details about the current portfolio that the consultants are implementing or have implemented'
        + (portfolioFY ? ` in ${portfolioFY}.` : ', for the selected fiscal years.'),
    },
    b2: {
      heading: `Table 2: General Experience in 160 Hours+ Vocational Skills Training${rangeFY ? ` (${rangeFY})` : ''}`,
      note: 'Only occupation rows of 160 hours or more are included.',
    },
    b3: {
      heading: `Table 3: Specific Experience in Proposed Sector(s) – Training and Skill Testing${rangeFY ? ` (${rangeFY})` : ''}`,
      note: 'Scoped to the selected occupation(s) — the sector(s) proposed for this bid.',
    },
    b4: {
      heading: `Table 4: Tax clearance certificate of last 3 (three) Fiscal Years${turnoverFY ? ` (${turnoverFY})` : ''}`,
      note: 'Tax clearance certificate must be submitted to calculate the turnover of the company.',
    },
  };
}

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

/**
 * Both names for an occupation row, plus its sector.
 *
 *   name  — the master occupation, what the picker filters on
 *   label — what the client's letter called it, what the table prints
 */
const occInfo = (occ, occupations) => {
  const found = occupations?.length && occ.ctevtOccupationId
    ? occupations.find(o => String(o.id) === String(occ.ctevtOccupationId))
    : null;
  return {
    name:  occMasterName(occ, occupations),
    label: occLetterName(occ, occupations),
    sector: found?.sector || '',
  };
};

// ─── Table cells that span rows ──────────────────────────────────────────────
//
// A cell is normally just a string. Where one value covers several rows — an
// assignment's dates repeated down its occupations — it becomes { text, rowSpan }
// and the rows beneath carry SPANNED in that position instead.
//
// The three renderers differ in what they need: HTML and JSX omit the covered
// cell entirely, while Word requires it to be present and marked as a merge
// continuation. Keeping the placeholder in the model rather than letting each
// renderer infer it is what lets all three agree.

/** Marks a cell covered by a rowSpan from a row above it. */
const SPANNED = { spanned: true };
/** A cell covering `n` rows; a span of one is just the value. */
const span = (text, n) => (n > 1 ? { text, rowSpan: n } : text);

const isSpanned = (v) => !!v && typeof v === 'object' && v.spanned === true;
const cellText  = (v) => (!!v && typeof v === 'object' && 'text' in v) ? v.text : v;
const cellSpan  = (v) => ((!!v && typeof v === 'object' && v.rowSpan) || 1);

// ─── Section models ──────────────────────────────────────────────────────────
// Each returns { columns, rows, totalRow? } — a shape the JSX, print-HTML and
// DOCX renderers all consume the same way, so the three stay in sync.

/**
 * B.1 — one row per occupation, with the assignment's own columns merged down.
 *
 * The first version repeated every column per occupation, so one contract run
 * for four trades read as four contracts and totalled to four times the money.
 * Collapsing to one row per assignment fixed that but lost the per-trade
 * trainee counts, which the form asks for.
 *
 * So: Occupation and No. Of Trainees get a row each, and the columns that
 * belong to the assignment — S.N., name, dates, contract amount, client — span
 * those rows and are stated once. The reader sees each trade's numbers without
 * the contract value ever appearing twice.
 *
 * Reads the firm's full experience list (not the `exps` the other sections
 * get, which is already narrowed to the experience FY range) and applies its
 * own portfolioFromFY/portfolioToFY range instead, so the portfolio window
 * can differ from the experience tables' span without one overwriting the
 * other. No range selected shows every assignment, same as the other
 * independent ranges in this file (B.4's turnover years).
 */
function modelB1(inst, clients, occupations, opts = {}) {
  const fromFY = opts.portfolioFromFY ?? '';
  const toFY   = opts.portfolioToFY ?? '';
  const exps = (inst?.experience || [])
    .filter(e => !fromFY && !toFY ? true : fyInRange(e.fy, fromFY, toFY));
  const rows = [];
  // Counts assignments, not rows: an assignment covering four trades is one
  // entry in the portfolio and takes one serial number.
  let sn = 0;
  for (const exp of exps) {
    sn += 1;
    // An assignment with nothing recorded still belongs in the portfolio, so it
    // gets a single row with the occupation columns left blank.
    const occs = (exp.occupations || []).length ? exp.occupations : [{}];
    const n = occs.length;
    occs.forEach((occ, i) => {
      const own = (v) => (i === 0 ? span(v, n) : SPANNED);
      rows.push([
        own(String(sn)),
        own(dash(exp.assignmentName)),
        occInfo(occ, occupations).label || '—',
        dash(occ.trainees),
        own(dash(exp.startDate)),
        own(dash(exp.endDate)),
        own(fmtNrs(exp.contractValue)),
        own(clientNameOf(exp, clients)),
      ]);
    });
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
        info.label,
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
    emptyText: 'NA',
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
        info.label,
        dash(occ.trainees),
        dash(occ.skillTestAppeared),
      ]);
    }
  }
  return {
    columns: ['Funding Agency', 'FY', 'Assignment Name', 'Occupation', 'No of graduate trainees', 'No of trainees appeared in the skill test'],
    rows,
    totalRow: ['', '', '', 'Total', String(totalTrainees), String(totalAppeared)],
    emptyText: 'NA',
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
  if (section === 'b1') return modelB1(inst, clients, occupations, opts);
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
  const empty = model.emptyText || '—';
  if (!model.rows.length) {
    return <div style={{fontSize:12, color:'var(--text3)', padding:'8px 0'}}>No records in range.</div>;
  }
  return (
    <div style={{overflowX:'auto'}}>
      <table style={{borderCollapse:'collapse', width:'100%'}}>
        <thead><tr>{model.columns.map(c => <th key={c} style={TH}>{c}</th>)}</tr></thead>
        <tbody>
          {model.rows.map((row, i) => (
            <tr key={i}>{row.map((v, j) => isSpanned(v) ? null : (
              <td key={j} style={TD} rowSpan={cellSpan(v) > 1 ? cellSpan(v) : undefined}>
                {cellText(v) || empty}
              </td>
            ))}</tr>
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
  const titles = sectionTitlesFor(opts);
  return (
    <div>
      <div style={{fontWeight:700, fontSize:14, marginBottom:4}}>{inst?.name || 'Firm'}</div>
      {inst?.acronym && <div style={{fontSize:11, color:'var(--text3)', marginBottom:14}}>{inst.acronym}</div>}
      {sections.map(s => (
        <div key={s} style={{marginBottom:26}}>
          <div style={{fontWeight:700, fontSize:13, marginBottom:2}}>{titles[s].heading}</div>
          <div style={{fontSize:11, color:'var(--text3)', fontStyle:'italic', marginBottom:10}}>{titles[s].note}</div>
          <GridTable model={modelFor(s, exps, clients, inst, opts)} />
        </div>
      ))}
    </div>
  );
}

// ─── Print / PDF ─────────────────────────────────────────────────────────────

const htmlGrid = (model) => {
  const empty = esc(model.emptyText) || '&mdash;';
  return `
  <table>
    <thead><tr>${model.columns.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
    <tbody>
      ${model.rows.length
        ? model.rows.map(r => `<tr>${r.map(v => isSpanned(v) ? '' :
            `<td${cellSpan(v) > 1 ? ` rowspan="${cellSpan(v)}"` : ''}>${esc(cellText(v)) || empty}</td>`
          ).join('')}</tr>`).join('')
        : `<tr><td colspan="${model.columns.length}">No records in range.</td></tr>`}
      ${model.totalRow ? `<tr class="total-row">${model.totalRow.map(v => `<td>${esc(v) || ''}</td>`).join('')}</tr>` : ''}
    </tbody>
  </table>`;
};

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
  const titles = sectionTitlesFor(opts);
  const body = `
    <div class="firm">${esc(inst?.name || '')}</div>
    ${inst?.acronym ? `<div class="firm-sub">${esc(inst.acronym)}</div>` : ''}
    ${fyRangeLabel ? `<div class="firm-sub">${esc(fyRangeLabel)}</div>` : ''}
    ${sections.map(s => `
      <div class="section">
        <h2>${esc(titles[s].heading)}</h2>
        <p class="sub">${esc(titles[s].note)}</p>
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
  const empty = opts.empty || '—';
  // Word merges vertically by keeping the covered cell and marking it CONTINUE,
  // rather than dropping it the way an HTML rowspan does. A continuation cell
  // must also be empty — text in one shows up beneath the merged value.
  const merge = opts.merge;
  return new TableCell({
    shading: opts.fill ? { fill: opts.fill } : undefined,
    borders: ALL_BORDERS,
    verticalAlign: VerticalAlign.TOP,
    margins: CELL_MARGIN,
    verticalMerge: merge,
    children: [new Paragraph({
      children: merge === VerticalMergeType.CONTINUE
        ? []
        : [new TextRun({ text: String(text ?? '') || empty, bold: !!opts.bold, size: 17 })],
    })],
  });
}

function docxTable(model) {
  const empty = model.emptyText || '—';
  const header = new TableRow({
    tableHeader: true,
    children: model.columns.map(c => docxCell(c, { bold: true, fill: HDR_FILL })),
  });
  const body = model.rows.length
    ? model.rows.map(r => new TableRow({
        children: r.map(v => isSpanned(v)
          ? docxCell('', { empty, merge: VerticalMergeType.CONTINUE })
          : docxCell(cellText(v), { empty, merge: cellSpan(v) > 1 ? VerticalMergeType.RESTART : undefined })),
      }))
    : [new TableRow({ children: [docxCell('No records in range.', {})] })];
  const totalRow = model.totalRow
    ? [new TableRow({ children: model.totalRow.map(v => docxCell(v, { bold: true, fill: TOTAL_FILL })) })]
    : [];
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [header, ...body, ...totalRow] });
}

async function downloadDOCX(fullInst, activeExps, reportId, opts = {}) {
  const sections = sectionsFor(reportId);
  const titles = sectionTitlesFor(opts);
  const children = [
    new Paragraph({ children: [new TextRun({ text: fullInst?.name || 'Firm', bold: true, size: 28 })], spacing: { after: 60 } }),
  ];
  if (fullInst?.acronym) {
    children.push(new Paragraph({ children: [new TextRun({ text: fullInst.acronym, size: 18, color: '555555' })], spacing: { after: 160 } }));
  }
  sections.forEach((s, idx) => {
    children.push(new Paragraph({
      children: [new TextRun({ text: titles[s].heading, bold: true, size: 24 })],
      spacing: { before: idx === 0 ? 0 : 260, after: 40 },
    }));
    children.push(new Paragraph({
      children: [new TextRun({ text: titles[s].note, italics: true, size: 17, color: '444444' })],
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

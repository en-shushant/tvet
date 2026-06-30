import {
  Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun,
  WidthType, AlignmentType, VerticalAlign, HeadingLevel,
} from 'docx';
import { saveAs } from 'file-saver';
import { buildTurnoverData, buildGeneralExpData, buildSpecificOccData, fmt } from './helvetasData.js';

// ── Shared cell builders ──────────────────────────────────────────────────────

const HEADER_FILL = 'DCE6F1';
const TOTAL_FILL  = 'EEF2F7';
const BORDER = { style: 'single', size: 6, color: '888888' };
const ALL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

const CELL_MARGIN = { top: 40, bottom: 40, left: 80, right: 80 };

function hdrCell(text, opts = {}) {
  return new TableCell({
    shading: { fill: HEADER_FILL },
    borders: ALL_BORDERS,
    verticalAlign: VerticalAlign.CENTER,
    margins: CELL_MARGIN,
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
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

function heading(text, level = HeadingLevel.HEADING_3) {
  return new Paragraph({
    heading: level,
    spacing: { before: 240, after: 100 },
    children: [new TextRun({ text, bold: true, size: 24 })],
  });
}

function subPara(text) {
  return new Paragraph({
    spacing: { before: 60, after: 80 },
    children: [new TextRun({ text, size: 20 })],
  });
}

function spacer() {
  return new Paragraph({ spacing: { before: 120, after: 0 }, children: [] });
}

// ── Table 1 ───────────────────────────────────────────────────────────────────

function makeTable1(fullInst, fromFY, toFY) {
  const { fys, byFY, total } = buildTurnoverData(fullInst, fromFY, toFY);
  if (!fys.length) return null;

  const titleFYPart = fys.length > 1
    ? ` of FY ${fys[0]} to ${fys[fys.length - 1]}`
    : fys.length === 1 ? ` of FY ${fys[0]}` : '';

  // Column widths in DXA (1 inch = 1440 DXA; total page width ~8870 for A4 landscape-ish)
  const descW = 2800;
  const fyW   = 1400;
  const remW  = 1400;

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      hdrCell('Description', { width: descW }),
      ...fys.map(fy => hdrCell(`FY ${fy}`, { width: fyW })),
      hdrCell('Total', { width: fyW }),
      hdrCell('Remarks', { width: remW }),
    ],
  });

  const dataRow = new TableRow({
    children: [
      dataCell('Annual turnover (as per audit report)'),
      ...fys.map(fy => dataCell(fmt(byFY[fy]), { right: true })),
      dataCell(fmt(total), { right: true, bold: true }),
      dataCell(''),
    ],
  });

  return [
    heading(`Table 1: Average Annual Turnover${titleFYPart}`),
    new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, dataRow] }),
  ];
}

// ── Table 2 ───────────────────────────────────────────────────────────────────

function makeTable2(fullInst, activeExps, occupations = [], sortBy = 'default') {
  const { occs, grandTotal, allFYs } = buildGeneralExpData(fullInst, activeExps, occupations, sortBy);
  if (!occs.length) return null;

  const SUBTOTAL_FILL = 'F5F7FA';

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      hdrCell('S.N.'),
      hdrCell('Occupation'),
      hdrCell('No. of trainees completed the training'),
      hdrCell('No. of skill test passed trainees'),
      hdrCell('No. of employed graduates'),
      hdrCell('Training completed Year'),
    ],
  });

  const dataRows = [];
  occs.forEach((occ, i) => {
    occ.fyRows.forEach((row, j) => {
      dataRows.push(new TableRow({
        children: [
          dataCell(j === 0 ? i + 1 : '', { center: true }),
          dataCell(j === 0 ? occ.name : ''),
          dataCell(row.trainees || '—', { right: true }),
          dataCell(row.skillTestPass || '—', { right: true }),
          dataCell(row.employed || '—', { right: true }),
          dataCell(row.fy),
        ],
      }));
    });
  });

  const totalRow = new TableRow({
    children: [
      dataCell('', { shading: TOTAL_FILL }),
      dataCell(`Total of ${allFYs.length} year${allFYs.length !== 1 ? 's' : ''}`, { bold: true, shading: TOTAL_FILL }),
      dataCell(grandTotal.trainees || '—', { right: true, bold: true, shading: TOTAL_FILL }),
      dataCell(grandTotal.skillTestPass || '—', { right: true, bold: true, shading: TOTAL_FILL }),
      dataCell(grandTotal.employed || '—', { right: true, bold: true, shading: TOTAL_FILL }),
      dataCell('', { shading: TOTAL_FILL }),
    ],
  });

  return [
    heading('Table 2: Training, skill test and employment placement experience\n(Level I vocational skill training comprising all the sectors; general experience)'),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [headerRow, ...dataRows, totalRow],
    }),
  ];
}

// ── Table 3 ───────────────────────────────────────────────────────────────────

function makeTable3(fullInst, activeExps, selectedOccs, occupations = []) {
  const { rows, totals } = buildSpecificOccData(fullInst, activeExps, selectedOccs, occupations);
  if (!rows.length) return null;

  const occLabel = selectedOccs.length ? selectedOccs.join(', ') : 'All Occupations';

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      hdrCell('Year'),
      hdrCell('No. of trained person'),
      hdrCell('No. of skill test passed trainee'),
      hdrCell('No. of employed graduates'),
      hdrCell('Remarks'),
    ],
  });

  const dataRows = rows.map(row => new TableRow({
    children: [
      dataCell(row.fy),
      dataCell(row.trainees || '—', { right: true }),
      dataCell(row.skillTestPass || '—', { right: true }),
      dataCell(row.employed || '—', { right: true }),
      dataCell(''),
    ],
  }));

  const totalRow = new TableRow({
    children: [
      dataCell('Total', { bold: true, shading: TOTAL_FILL }),
      dataCell(totals.trainees || '—', { right: true, bold: true, shading: TOTAL_FILL }),
      dataCell(totals.skillTestPass || '—', { right: true, bold: true, shading: TOTAL_FILL }),
      dataCell(totals.employed || '—', { right: true, bold: true, shading: TOTAL_FILL }),
      dataCell('', { shading: TOTAL_FILL }),
    ],
  });

  return [
    heading('Table 3: Training, skill test and employment placement experience\n(at least level I vocational skill training only the proposed occupation)'),
    subPara(`Proposed Occupation and the Training Package: ${occLabel}`),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [headerRow, ...dataRows, totalRow],
    }),
  ];
}

// ── Entry point ───────────────────────────────────────────────────────────────

export async function downloadHelvetasDOCX(fullInst, activeExps, reportId, opts = {}) {
  const { fromFY, toFY, selectedOccs = [], occupations = [], sortBy = 'default' } = opts;

  let sections = [];

  if (reportId === 'h1') sections = makeTable1(fullInst, fromFY, toFY) || [];
  else if (reportId === 'h2') sections = makeTable2(fullInst, activeExps, occupations, sortBy) || [];
  else if (reportId === 'h3') sections = makeTable3(fullInst, activeExps, selectedOccs, occupations) || [];
  if (!sections.length) {
    alert('No data to export for the selected filters.');
    return;
  }

  const firmName = fullInst?.name || 'Report';
  const reportLabels = { h1: 'Table1_Turnover', h2: 'Table2_GeneralExp', h3: 'Table3_SpecificOcc' };

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: 'Arial', size: 22 } },
      },
    },
    sections: [{
      properties: {},
      children: [
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { after: 100 },
          children: [new TextRun({ text: firmName, bold: true, size: 28 })],
        }),
        spacer(),
        ...sections,
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const fname = `${firmName.replace(/[^\w\s]/g, '').trim().replace(/\s+/g, '_')}_${reportLabels[reportId] || reportId}.docx`;
  saveAs(blob, fname);
}

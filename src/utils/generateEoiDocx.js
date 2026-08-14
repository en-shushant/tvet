import {
  Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun,
  WidthType, AlignmentType, VerticalAlign, BorderStyle, ShadingType,
} from 'docx';
import { saveAs } from 'file-saver';

// Points per mm at 72dpi (Word uses twips but docx-js uses DXA: 1440/inch = 56.69/mm)
const DXA_PER_MM = 56.692;
const PAGE_W_DXA = Math.round(210 * DXA_PER_MM); // A4 width
const MARGIN_DXA = Math.round(20 * DXA_PER_MM);  // 20mm each side
const CONTENT_W_DXA = PAGE_W_DXA - MARGIN_DXA * 2;
const HALF = Math.round(CONTENT_W_DXA / 2);

const BORDER = { style: BorderStyle.SINGLE, size: 6, color: '000000' };
const BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

function cell(text, opts = {}) {
  const { bold = false, colspan = 1, rowspan = 1, shade = false, width = HALF } = opts;
  return new TableCell({
    columnSpan: colspan,
    rowSpan: rowspan,
    width: { size: colspan > 1 ? CONTENT_W_DXA : width, type: WidthType.DXA },
    borders: BORDERS,
    shading: shade ? { fill: 'EEEEEE', type: ShadingType.CLEAR } : undefined,
    verticalAlign: VerticalAlign.TOP,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [
      new Paragraph({
        children: [new TextRun({ text: String(text ?? ''), bold, size: 20, font: 'Arial' })],
      }),
    ],
  });
}

function labelCell(label, value, width = HALF) {
  // "Label: value" in one cell
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: BORDERS,
    verticalAlign: VerticalAlign.TOP,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [
      new Paragraph({
        children: [
          new TextRun({ text: label + ': ', bold: false, size: 20, font: 'Arial' }),
          new TextRun({ text: String(value ?? ''), size: 20, font: 'Arial' }),
        ],
      }),
    ],
  });
}

function multilineCell(label, lines, opts = {}) {
  const { colspan = 1, width = HALF, bold = false } = opts;
  const paras = [];
  if (label) {
    paras.push(new Paragraph({
      children: [new TextRun({ text: label, bold: true, size: 20, font: 'Arial' })],
    }));
  }
  (lines || []).filter(Boolean).forEach(line => {
    paras.push(new Paragraph({
      children: [new TextRun({ text: String(line), bold, size: 20, font: 'Arial' })],
    }));
  });
  if (paras.length === 0) paras.push(new Paragraph({ children: [new TextRun({ text: '', size: 20, font: 'Arial' })] }));
  return new TableCell({
    columnSpan: colspan,
    width: { size: colspan > 1 ? CONTENT_W_DXA : width, type: WidthType.DXA },
    borders: BORDERS,
    verticalAlign: VerticalAlign.TOP,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: paras,
  });
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  // "YYYY/MM/DD" or "YYYY-MM-DD" → "Month/YYYY"
  const clean = dateStr.replace(/-/g, '/');
  const parts = clean.split('/');
  if (parts.length >= 2) {
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const m = parseInt(parts[1]);
    return `${isNaN(m) ? parts[1] : (months[m-1] || parts[1])}/${parts[0]}`;
  }
  return dateStr;
}

function fmtNrs(val) {
  if (!val && val !== 0) return '—';
  const n = Number(val);
  return isNaN(n) ? String(val) : 'NRs. ' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function buildLocations(exp) {
  const allLocs = (exp.occupations || []).flatMap(o => (o.locations || []));
  const districts = [...new Set(allLocs.map(l => l.district).filter(Boolean))];
  return districts.length > 0 ? districts.join(', ') : (exp.locations || []).map(l => l.district).filter(Boolean).join(', ') || '—';
}

function buildNarrativeLines(exp) {
  if (exp.narrativeDescription && exp.narrativeDescription.trim()) {
    return exp.narrativeDescription.split('\n').filter(Boolean);
  }
  // Auto-build from occupations if narrative not filled
  const lines = [];
  (exp.occupations || []).forEach(occ => {
    const name = occ.nameInLetter || occ.ctevtOccupationId || '';
    const t = occ.trainees ? `${occ.trainees} trainees` : '';
    const d = occ.duration ? `${occ.duration} hours` : '';
    if (name) lines.push([name, t, d].filter(Boolean).join(', '));
  });
  return lines.length > 0 ? lines : ['—'];
}

function buildActualServicesLines(exp) {
  if (exp.actualServicesDescription && exp.actualServicesDescription.trim()) {
    return exp.actualServicesDescription.split('\n').filter(Boolean);
  }
  return [];
}

function buildExpTable(exp, clients, sn) {
  const client = clients.find(c => String(c.id) === String(exp.clientId)) || {};
  const clientName = client.fullName || exp.clientName || '—';
  const clientAddress = client.address || '—';
  const location = buildLocations(exp);
  const narrativeLines = buildNarrativeLines(exp);
  const actualLines = buildActualServicesLines(exp);

  const rows = [
    // Header row: serial number + assignment name spans full width
    new TableRow({
      children: [
        new TableCell({
          columnSpan: 2,
          width: { size: CONTENT_W_DXA, type: WidthType.DXA },
          borders: BORDERS,
          shading: { fill: 'D9D9D9', type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({
            children: [
              new TextRun({ text: `${sn}. `, bold: true, size: 20, font: 'Arial' }),
              new TextRun({ text: exp.assignmentName || '(Assignment name not set)', bold: true, size: 20, font: 'Arial' }),
            ],
          })],
        }),
      ],
    }),

    // Row 1: Assignment name label | Contract value
    new TableRow({
      children: [
        labelCell('Assignment name', exp.assignmentName || '—'),
        labelCell('Approx. value of the contract (in current NRs; US$ or Euro)', fmtNrs(exp.contractValue)),
      ],
    }),

    // Row 2: Country + Location | Duration
    new TableRow({
      children: [
        new TableCell({
          width: { size: HALF, type: WidthType.DXA },
          borders: BORDERS,
          verticalAlign: VerticalAlign.TOP,
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [
            new Paragraph({ children: [new TextRun({ text: `Country: ${exp.country || 'Nepal'}`, size: 20, font: 'Arial' })] }),
            new Paragraph({ children: [new TextRun({ text: '', size: 10 })] }),
            new Paragraph({ children: [new TextRun({ text: `Location within country: ${location}`, size: 20, font: 'Arial' })] }),
          ],
        }),
        labelCell('Duration of assignment (months)', exp.durationMonths || '—'),
      ],
    }),

    // Row 3: Name of Client | Total person-months
    new TableRow({
      children: [
        labelCell('Name of Client', clientName),
        labelCell('Total No. of person-months of the assignment', exp.totalPersonMonths || '—'),
      ],
    }),

    // Row 4: Address | Approx. value of firm's services (falls back to contract value)
    new TableRow({
      children: [
        labelCell('Address', clientAddress),
        labelCell(
          'Approx. value of the services provided by your firm under the contract (in current NRs; US$ or Euro)',
          fmtNrs(exp.ownServiceValue || exp.contractValue)
        ),
      ],
    }),

    // Row 5: Start/Completion date | JV person-months
    new TableRow({
      children: [
        new TableCell({
          width: { size: HALF, type: WidthType.DXA },
          borders: BORDERS,
          verticalAlign: VerticalAlign.TOP,
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [
            new Paragraph({ children: [new TextRun({ text: `Start date (month/year): ${fmtDate(exp.startDate)}`, size: 20, font: 'Arial' })] }),
            new Paragraph({ children: [new TextRun({ text: '', size: 10 })] }),
            new Paragraph({ children: [new TextRun({ text: `Completion date (month/year): ${fmtDate(exp.endDate)}`, size: 20, font: 'Arial' })] }),
          ],
        }),
        labelCell(
          'No. of professional person-months provided by the joint venture partners or the Sub-Consultants',
          exp.jvPartnerPersonMonths || (exp.isJV ? '—' : 'NA')
        ),
      ],
    }),

    // Row 6: JV/sub-consultant names | Narrative description
    new TableRow({
      children: [
        labelCell('Name of joint venture partner or sub-Consultants, if any', exp.isJV ? (exp.jvPartnerNames || '—') : 'NA'),
        multilineCell('Narrative description of Project:', narrativeLines),
      ],
    }),

    // Row 7: Actual services — full width
    new TableRow({
      children: [
        multilineCell(
          'Description of actual services provided in the assignment:',
          actualLines.length > 0 ? actualLines : ['Note: Provide highlight on similar services provided by the consultant as required by the EOI assignment.'],
          { colspan: 2 }
        ),
      ],
    }),
  ];

  return new Table({
    width: { size: CONTENT_W_DXA, type: WidthType.DXA },
    columnWidths: [HALF, HALF],
    rows,
  });
}

export async function generateEoiDocx(institute, experiences, clients) {
  const firmName = institute.name || 'Firm';
  const children = [
    new Paragraph({
      children: [new TextRun({ text: `Consultant's Experience`, bold: true, size: 28, font: 'Arial' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [new TextRun({ text: firmName, size: 22, font: 'Arial', color: '444444' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
  ];

  experiences.forEach((exp, i) => {
    children.push(buildExpTable(exp, clients, i + 1));
    children.push(new Paragraph({ children: [new TextRun({ text: '', size: 20 })], spacing: { after: 300 } }));
  });

  const doc = new Document({
    styles: {
      default: { document: { run: { font: 'Arial', size: 20 } } },
    },
    sections: [{
      properties: {
        page: {
          size: { width: PAGE_W_DXA, height: Math.round(297 * DXA_PER_MM) },
          margin: { top: MARGIN_DXA, bottom: MARGIN_DXA, left: MARGIN_DXA, right: MARGIN_DXA },
        },
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const safeName = firmName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  saveAs(blob, `EOI_Experience_${safeName}.docx`);
}

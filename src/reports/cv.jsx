import {
  Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun,
  WidthType, VerticalAlign, BorderStyle, AlignmentType,
} from 'docx';
import { saveAs } from 'file-saver';
import { esc } from './helpers.js';

/**
 * Standard EOI "Form 5 — Curriculum Vitae", for the people proposed on a bid.
 *
 * Follows the form as firms actually submit it: a personal-details table, then
 * eight numbered sections. The two prose sections — Detailed Tasks Assigned and
 * Key Qualifications — arrive already resolved by the server, which picks
 * between text typed for this bid, the firm's own house wording, and the
 * person's default. Doing that here would let the preview, the print sheet and
 * the Word file each reach a different answer.
 *
 * One CV per page: they are submitted as a pack, and a reviewer reads them one
 * at a time against the staff list.
 */

const LABELS = {
  tasks: 'Detailed Tasks Assigned',
  quals: 'Key Qualifications',
  education: 'Education',
  training: 'Training Received',
  employment: 'Employment Record',
  languages: 'Language Skills',
  certification: 'Certification',
};

const CERTIFY = 'I, the undersigned, certify that to the best of my knowledge and belief, '
  + 'these data correctly describe me, my qualifications, and my experience.';

/** Bullet-per-line, the way the prose is typed and the way the form prints it. */
const lines = (text) => String(text || '').split('\n').map(l => l.trim()).filter(Boolean);

const period = (e) => {
  const from = e.from_date || '';
  const to = e.is_current ? 'till date' : (e.to_date || '');
  return [from, to].filter(Boolean).join(' to ') || '—';
};

/** The personal-details table, in the form's own row order. */
function personalRows(cv, tender) {
  const p = cv.person;
  return [
    ['Proposed Position', cv.proposed_position || '—'],
    ['Name of Consultant', tender.institute_name || '—'],
    ['Name of Staff', p.full_name],
    ...(p.phone ? [['Contact (Mobile Number)', p.phone]] : []),
    ...(p.email ? [['Email', p.email]] : []),
    ['Profession', p.profession || cv.occupation_name || '—'],
    ['Date of Birth', p.date_of_birth || '—'],
    ['Years with Consultant/Entity', p.years_with_entity || '—'],
    ['Nationality', p.nationality || 'Nepali'],
    ['Membership in Professional Societies', p.professional_memberships || 'N/A'],
  ];
}

/* ── Print sheet ────────────────────────────────────────────────────────── */

const htmlTable = (headers, rows) => `
  <table>
    ${headers ? `<thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>` : ''}
    <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>`;

const htmlProse = (text) => {
  const ls = lines(text);
  if (!ls.length) return '<p class="muted">Not recorded.</p>';
  // A line already written as a bullet stays one; a paragraph stays a paragraph.
  const bulleted = ls.filter(l => /^[•\-*]/.test(l));
  if (bulleted.length >= ls.length / 2) {
    return `<ul>${ls.map(l => `<li>${esc(l.replace(/^[•\-*]\s*/, ''))}</li>`).join('')}</ul>`;
  }
  return ls.map(l => `<p>${esc(l)}</p>`).join('');
};

function cvHTML(cv, tender, index) {
  const p = cv.person;
  const section = (n, title, body) =>
    `<h3><span class="num">${n}.</span> ${esc(title)}</h3>${body}`;

  return `
  <section class="cv"${index > 0 ? ' style="page-break-before: always;"' : ''}>
    <h2>Curriculum Vitae (CV)${p.person_type === 'Support Staff'
      ? ' for Proposed Support Staff' : ' for Proposed Professional Staff'}</h2>

    ${htmlTable(null, personalRows(cv, tender).map(([k, v]) =>
      [`<strong>${esc(k)}</strong>`, esc(v)]))}

    ${section('I', LABELS.tasks, htmlProse(cv.detailed_tasks))}
    ${section('II', LABELS.quals, htmlProse(cv.key_qualifications))}

    ${section('III', LABELS.education, cv.education.length
      ? htmlTable(['Degree(s) / Diploma(s) obtained', 'Specialised education',
                   'Educational institution', 'Year of completion'],
          cv.education.map(q => [esc(q.title || '—'), esc(q.specialisation || '—'),
            esc([q.institution, q.board].filter(Boolean).join(', ') || '—'), esc(q.passed_year || '—')]))
      : '<p class="muted">Not recorded.</p>')}

    ${section('IV', LABELS.training, cv.trainings.length
      ? htmlTable(['SN', 'Subject of training', 'Institution / training organisation', 'Duration and date'],
          cv.trainings.map((q, i) => [String(i + 1), esc(q.title || '—'),
            esc([q.institution, q.board].filter(Boolean).join(', ') || '—'),
            esc(q.duration_text || (q.duration_hours ? `${q.duration_hours} hours` : '') || q.passed_year || '—')]))
      : '<p class="muted">Not recorded.</p>')}

    ${section('V', LABELS.employment, cv.experience.length
      ? htmlTable(['Period and position', 'Employing organisation', 'Country / location',
                   'Summary of activities performed relevant to the assignment'],
          cv.experience.map(e => [
            `<strong>${esc(period(e))}</strong>${e.position ? `<br/>${esc(e.position)}` : ''}`,
            [esc(e.organisation || '—'),
             e.project_name ? `<br/><em>Name of the project:</em> ${esc(e.project_name)}` : '',
             e.reference_text ? `<br/><em>Reference:</em> ${esc(e.reference_text)}` : ''].join(''),
            esc(e.country || '—'),
            htmlProse(e.description)]))
      : '<p class="muted">Not recorded.</p>')}

    ${section('VI', LABELS.languages, cv.languages.length
      ? htmlTable(['Language', 'Speaking', 'Reading', 'Writing'],
          cv.languages.map(l => [esc(l.language), esc(l.speaking || '—'),
            esc(l.reading || '—'), esc(l.writing || '—')]))
      : '<p class="muted">Not recorded.</p>')}

    ${section('VII', LABELS.certification, `
      <p>${esc(CERTIFY)}</p>
      <div class="sign">
        <div class="sign-line"></div>
        <div class="sign-line"></div>
        <div class="sign-date">Date: ______________</div>
      </div>
      <p class="sign-note">[Signature of staff member and authorised representative of the consultant]
        &nbsp;&nbsp;[Day/Month/Year]</p>
      <p>Full name of staff member: <strong>${esc(p.full_name)}</strong></p>
      <p>Full name of authorised representative: <strong>${
        esc(tender.authorized_rep || tender.institute_contact || '')}</strong></p>`)}
  </section>`;
}

function buildPrintHTML(pack) {
  const { tender, cvs } = pack;
  const body = cvs.length
    ? cvs.map((cv, i) => cvHTML(cv, tender, i)).join('')
    : '<p class="muted">Nobody has been proposed on this tender yet.</p>';
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>${esc(tender.title || 'Curriculum Vitae')}</title>
<style>
  @page { size: A4; margin: 16mm; }
  :root { color-scheme: light; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #000; background: #fff; margin: 0; }
  h2 { font-size: 13px; text-align: center; margin: 0 0 12px; text-transform: none; }
  h3 { font-size: 11.5px; margin: 14px 0 5px; background: #eee; padding: 3px 6px; }
  h3 .num { display: inline-block; min-width: 22px; }
  table { border-collapse: collapse; width: 100%; table-layout: fixed; margin-bottom: 4px; }
  th, td { border: 1px solid #000; padding: 4px 6px; vertical-align: top; font-size: 10.5px;
           word-wrap: break-word; overflow-wrap: break-word; }
  th { background: #eee; text-align: left; font-weight: bold; }
  ul { margin: 4px 0 4px 16px; padding: 0; }
  li, p { font-size: 10.5px; margin: 3px 0; }
  .muted { color: #555; font-style: italic; }
  .sign { display: flex; gap: 24px; align-items: flex-end; margin: 26px 0 2px; }
  .sign-line { flex: 1; border-bottom: 1px solid #000; height: 28px; }
  .sign-date { white-space: nowrap; }
  .sign-note { font-size: 9.5px; font-style: italic; color: #333; margin-top: 2px; }
  .cv { page-break-inside: auto; }
  @media print { body { margin: 0; } }
</style></head><body>${body}</body></html>`;
}

/* ── Word ───────────────────────────────────────────────────────────────── */

const BORDER = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const ALL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
const CELL_MARGIN = { top: 40, bottom: 40, left: 80, right: 80 };

const cell = (text, opts = {}) => new TableCell({
  borders: ALL_BORDERS, margins: CELL_MARGIN, verticalAlign: VerticalAlign.TOP,
  shading: opts.fill ? { fill: opts.fill } : undefined,
  width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
  children: lines(text).length
    ? lines(text).map(l => new Paragraph({
        children: [new TextRun({ text: l.replace(/^[•\-*]\s*/, ''), bold: !!opts.bold, size: 17 })],
        bullet: /^[•\-*]/.test(l) ? { level: 0 } : undefined,
      }))
    : [new Paragraph({ children: [new TextRun({ text: String(text ?? '') || '—', bold: !!opts.bold, size: 17 })] })],
});

const docxTable = (headers, rows) => new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  rows: [
    ...(headers ? [new TableRow({
      tableHeader: true,
      children: headers.map(h => cell(h, { bold: true, fill: 'EEEEEE' })),
    })] : []),
    ...rows.map(r => new TableRow({ children: r.map(c => cell(c)) })),
  ],
});

const heading = (n, text) => new Paragraph({
  children: [new TextRun({ text: `${n}.  ${text}`, bold: true, size: 20 })],
  spacing: { before: 200, after: 80 }, shading: { fill: 'EEEEEE' },
});
const prose = (text) => lines(text).length
  ? lines(text).map(l => new Paragraph({
      children: [new TextRun({ text: l.replace(/^[•\-*]\s*/, ''), size: 19 })],
      bullet: /^[•\-*]/.test(l) ? { level: 0 } : undefined,
      spacing: { after: 40 },
    }))
  : [new Paragraph({ children: [new TextRun({ text: 'Not recorded.', italics: true, size: 19 })] })];

function cvChildren(cv, tender, index) {
  const p = cv.person;
  const out = [];
  if (index > 0) out.push(new Paragraph({ children: [], pageBreakBefore: true }));
  out.push(new Paragraph({
    children: [new TextRun({
      text: `Curriculum Vitae (CV) for Proposed ${p.person_type === 'Support Staff' ? 'Support' : 'Professional'} Staff`,
      bold: true, size: 24,
    })],
    alignment: AlignmentType.CENTER, spacing: { after: 160 },
  }));
  out.push(docxTable(null, personalRows(cv, tender).map(([k, v]) => [k, v])));

  out.push(heading('I', LABELS.tasks), ...prose(cv.detailed_tasks));
  out.push(heading('II', LABELS.quals), ...prose(cv.key_qualifications));

  out.push(heading('III', LABELS.education));
  out.push(cv.education.length
    ? docxTable(['Degree(s) / Diploma(s) obtained', 'Specialised education', 'Educational institution', 'Year of completion'],
        cv.education.map(q => [q.title || '—', q.specialisation || '—',
          [q.institution, q.board].filter(Boolean).join(', ') || '—', q.passed_year || '—']))
    : prose('')[0]);

  out.push(heading('IV', LABELS.training));
  out.push(cv.trainings.length
    ? docxTable(['SN', 'Subject of training', 'Institution / training organisation', 'Duration and date'],
        cv.trainings.map((q, i) => [String(i + 1), q.title || '—',
          [q.institution, q.board].filter(Boolean).join(', ') || '—',
          q.duration_text || (q.duration_hours ? `${q.duration_hours} hours` : '') || q.passed_year || '—']))
    : prose('')[0]);

  out.push(heading('V', LABELS.employment));
  out.push(cv.experience.length
    ? docxTable(['Period and position', 'Employing organisation', 'Country / location',
                 'Summary of activities performed relevant to the assignment'],
        cv.experience.map(e => [
          `${period(e)}${e.position ? `\n${e.position}` : ''}`,
          [e.organisation || '—',
           e.project_name ? `Name of the project: ${e.project_name}` : '',
           e.reference_text ? `Reference: ${e.reference_text}` : ''].filter(Boolean).join('\n'),
          e.country || '—', e.description || '—']))
    : prose('')[0]);

  out.push(heading('VI', LABELS.languages));
  out.push(cv.languages.length
    ? docxTable(['Language', 'Speaking', 'Reading', 'Writing'],
        cv.languages.map(l => [l.language, l.speaking || '—', l.reading || '—', l.writing || '—']))
    : prose('')[0]);

  out.push(heading('VII', LABELS.certification));
  out.push(new Paragraph({ children: [new TextRun({ text: CERTIFY, size: 19 })], spacing: { after: 400 } }));
  out.push(new Paragraph({
    children: [new TextRun({ text: '_______________________          _______________________          Date: ______________', size: 19 })],
  }));
  out.push(new Paragraph({
    children: [new TextRun({
      text: '[Signature of staff member and authorised representative of the consultant]   [Day/Month/Year]',
      italics: true, size: 16, color: '333333',
    })], spacing: { after: 120 },
  }));
  out.push(new Paragraph({ children: [new TextRun({ text: `Full name of staff member: ${p.full_name}`, size: 19 })] }));
  out.push(new Paragraph({ children: [new TextRun({
    text: `Full name of authorised representative: ${tender.authorized_rep || tender.institute_contact || ''}`, size: 19 })] }));
  return out;
}

async function downloadDOCX(pack) {
  const { tender, cvs } = pack;
  const children = cvs.length
    ? cvs.flatMap((cv, i) => cvChildren(cv, tender, i))
    : [new Paragraph({ children: [new TextRun({ text: 'Nobody has been proposed on this tender yet.', size: 19 })] })];
  const doc = new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
    sections: [{ children }],
  });
  const blob = await Packer.toBlob(doc);
  const name = (tender.title || 'tender').replace(/[^\w\s-]/g, '').trim().slice(0, 50) || 'tender';
  saveAs(blob, `${name} — CVs.docx`);
}

export default { buildPrintHTML, downloadDOCX };
export { buildPrintHTML, downloadDOCX, personalRows, lines, period, CERTIFY };

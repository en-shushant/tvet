import {
  Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun,
  WidthType, VerticalAlign, BorderStyle, AlignmentType, ShadingType,
} from 'docx';
import { saveAs } from 'file-saver';
import { esc } from './helpers.js';
import { letterHTML, letterSection, loadImage, LETTER_CSS, letterDate } from './expLetter.js';

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
            htmlProse(e.summary ?? e.description)]))
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

/** CV 1, its experience letters, CV 2, its letters… — each letter states what its CV does. */
function buildPrintHTML(pack, { letters = true } = {}) {
  const { tender, cvs } = pack;
  const format = formatOf(pack);
  const date = letterDate();
  const body = cvs.length
    ? cvs.map((cv, i) => (format === 'eoi_form5' ? cvHTML(cv, tender, i) : modelHTML(cvModel(format, cv, tender), i))
        + (letters ? (cv.letters || []).map(l => letterHTML(l, cv.person, date)).join('') : '')).join('')
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
  @page letter { size: A4; margin: 0; }
  .xl { page: letter; }
  ${LETTER_CSS}
  .cv-sub { text-align: center; font-size: 10.5px; margin: -8px 0 12px; }
  .lbl { font-weight: bold; margin: 12px 0 2px; }
  .hint { font-size: 9.5px; font-style: italic; color: #333; margin: 0 0 4px; }
  ol.cert { margin: 4px 0 4px 18px; padding: 0; }
  .tail p { margin: 4px 0; }
  @media print { body { margin: 0; } }
</style></head><body>${body}</body></html>`;
}

/* ── Word ───────────────────────────────────────────────────────────────── */

const BORDER = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const ALL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
const CELL_MARGIN = { top: 40, bottom: 40, left: 80, right: 80 };

const cell = (text, opts = {}) => new TableCell({
  borders: ALL_BORDERS, margins: CELL_MARGIN, verticalAlign: VerticalAlign.TOP,
  shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR, color: 'auto' } : undefined,
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
  spacing: { before: 200, after: 80 }, shading: { fill: 'EEEEEE', type: ShadingType.CLEAR, color: 'auto' },
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
          e.country || '—', (e.summary ?? e.description) || '—']))
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

async function downloadDOCX(pack, { letters = true } = {}) {
  const { tender, cvs } = pack;
  const format = formatOf(pack);
  const date = letterDate();
  // Each firm's letterhead, signature and stamp, fetched once.
  const images = new Map();
  if (letters) {
    for (const l of cvs.flatMap(cv => cv.letters || [])) {
      if (images.has(l.firm?.id)) continue;
      const [letterhead, sign, stamp] = await Promise.all([l.firm?.letterhead, l.firm?.sign, l.firm?.stamp].map(loadImage));
      images.set(l.firm?.id, { letterhead, sign, stamp });
    }
  }
  const cvSection = (children) => ({ properties: { page: { size: { width: 11906, height: 16838 } } }, children });
  const sections = cvs.length
    ? cvs.flatMap((cv, i) => [
        cvSection(format === 'eoi_form5' ? cvChildren(cv, tender, 0) : modelChildren(cvModel(format, cv, tender), 0)),
        ...(letters ? (cv.letters || []).map(l => letterSection(l, cv.person, images.get(l.firm?.id), date)) : []),
      ])
    : [cvSection([new Paragraph({ children: [new TextRun({ text: 'Nobody has been proposed on this tender yet.', size: 19 })] })])];
  const doc = new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
    sections,
  });
  const blob = await Packer.toBlob(doc);
  const name = (tender.title || 'tender').replace(/[^\w\s-]/g, '').trim().slice(0, 50) || 'tender';
  saveAs(blob, `${name} — CVs.docx`);
}

/* ── The client formats: PPMO EOI, PPMO RFP, Helvetas ───────────────────── */

/**
 * The CV formats a client may prescribe. The facts are the same in each —
 * who, education, employment and what they did, training — only the layout,
 * the column headings and the certification differ, so each format is a
 * description that one print renderer and one Word renderer both draw.
 */
export const CV_FORMATS = [
  { id: 'ppmo_eoi', label: 'PPMO EOI (Form 3)' },
  { id: 'ppmo_rfp', label: 'PPMO RFP' },
  { id: 'helvetas', label: 'Helvetas' },
  { id: 'eoi_form5', label: 'EOI Form 5 (detailed)' },
];
const formatOf = (pack) => (CV_FORMATS.some(f => f.id === pack.format) ? pack.format : 'eoi_form5');

const dash = (v) => (String(v ?? '').trim() ? String(v).trim() : '—');
const joinLines = (...xs) => xs.filter(x => String(x ?? '').trim()).join('\n');

const educationOf = (cv) => cv.education.map(q => ({
  title: q.title || '—', major: q.specialisation || '',
  institute: [q.institution, q.board].filter(Boolean).join(', '), year: q.passed_year || '',
}));
const trainingDuration = (q) => {
  const len = q.duration_days ? `${q.duration_days} days` : (q.duration_text || (q.duration_hours ? `${q.duration_hours} hours` : ''));
  const dates = (q.start_date_ad || q.end_date_ad) ? `${q.start_date_ad || '?'} to ${q.end_date_ad || '?'}` : (q.passed_year || '');
  return [len, dates].filter(Boolean).join(', ') || '—';
};
const employerCell = (e, style) => {
  const type = e.employment_type ? ` (${e.employment_type})` : '';
  if (style === 'helvetas') {
    return joinLines(`Job title: ${dash(e.position)}${type}`, `Name of Employer: ${dash(e.organisation)}`,
      e.project_name && `Project: ${e.project_name}`, `Contact of Employer: ${dash(e.reference_text)}`);
  }
  return joinLines(`${dash(e.organisation)}`, e.position && `${e.position}${type}`,
    e.project_name && `Project: ${e.project_name}`, e.reference_text && `For references: ${e.reference_text}`);
};
const asProse = (text) => ({ prose: text });

/**
 * PPMO RFP "Adequacy": one row per task, each beside a line of prior work, as
 * the form lays it out. Whichever list is longer runs on with blanks opposite.
 */
function adequacyRows(tasks, prior) {
  const lines = (t) => String(t || '').split('\n').map(l => l.trim()).filter(Boolean);
  const a = lines(tasks), b = lines(prior);
  const n = Math.max(a.length, b.length, 1);
  return Array.from({ length: n }, (_, i) => [asProse(a[i] || ''), asProse(b[i] || '')]);
}

const SIGN_ROW = (left, right = 'Date:') => ({ left, right });

function cvModel(format, cv, tender) {
  const p = cv.person;
  const firm = tender.institute_name || '—';
  const rep = tender.authorized_rep || tender.institute_contact || '';
  const exp = cv.experience;
  if (format === 'ppmo_rfp') {
    return {
      title: 'Curriculum Vitae (CV)',
      kv: [['Position Title and No.', dash(cv.proposed_position)], ['Name of Firm', firm],
        ['Name of Expert', p.full_name], ['Date of Birth', dash(p.date_of_birth)], ['Citizenship', dash(p.nationality || 'Nepali')]],
      blocks: [
        { label: 'Education:', lines: educationOf(cv).map(q => [q.title, q.institute, q.year].filter(Boolean).join(', ')) },
        { label: 'Employment record relevant to the assignment:', table: {
          headers: ['Period', 'Employing organization and your title/position. Contact information for references', 'Country', 'Summary of activities performed relevant to the Assignment'],
          widths: [16, 34, 14, 36],
          rows: exp.map(e => [period(e), employerCell(e), dash(e.country || 'Nepal'), asProse(e.summary ?? e.description)]) } },
        { label: 'Membership in Professional Associations and Publications:', text: p.professional_memberships || 'N/A' },
        { label: 'Language Skills (indicate only languages in which you can work):',
          lines: cv.languages.map(l => [l.language, [l.speaking && `speaking ${l.speaking}`, l.reading && `reading ${l.reading}`, l.writing && `writing ${l.writing}`].filter(Boolean).join(', ')].filter(Boolean).join(' — ')) },
        { label: 'Adequacy for the Assignment:', table: {
          headers: ['Detailed Tasks Assigned on Consultant’s Team of Experts:', 'Reference to Prior Work/Assignments that Best Illustrates Capability to Handle the Assigned Tasks'],
          widths: [50, 50], rows: adequacyRows(cv.detailed_tasks, cv.adequacy) } },
        { label: 'Expert’s contact information:', text: `e-mail: ${dash(p.email)}, phone: ${dash(p.phone)}` },
      ],
      certIntro: 'I, the undersigned, certify to the best of my knowledge and belief that',
      certList: [
        'This CV correctly describes my qualifications and experience',
        'I am not a current employee of the GoN',
        'In the absence of medical incapacity, I will undertake this assignment for the duration and in terms of the inputs specified for me in Form TECH 6 provided team mobilization takes place within the validity of this proposal.',
        'I was not part of the team who wrote the terms of reference for this consulting services assignment',
        'I am not currently debarred by a multilateral development bank (In case of DP funded project)',
        `I certify that I have been informed by the firm that it is including my CV in the Proposal for the ${tender.title || '{name of project and contract}'}. I confirm that I will be available to carry out the assignment for which my CV has been submitted in accordance with the implementation arrangements and schedule set out in the Proposal.`,
        'I declare that Corruption Case is not filed against me.',
      ],
      certOutro: 'I understand that any willful misstatement described herein may lead to my disqualification or dismissal, if engaged.',
      sign: [SIGN_ROW('[Signature of expert]'), SIGN_ROW('[Signature of authorized representative of the firm]')],
      tail: [['Full name of authorized representative', rep]],
    };
  }
  if (format === 'helvetas') {
    return {
      title: 'Curriculum Vitae (CV)',
      kv: [['Position Title', dash(cv.proposed_position)], ['Name of Firm', firm], ['Name of Staff', p.full_name],
        ['Date of Birth', dash(p.date_of_birth)], ['Citizenship Number', dash(p.citizenship_no)], ['Permanent Address', dash(p.permanent_address)]],
      blocks: [
        { label: 'Education:', table: { headers: ['Degree', 'Major Subjects', 'Educational Institutions', 'Passed out year'], widths: [28, 24, 32, 16],
          rows: educationOf(cv).map(q => [q.title, dash(q.major), dash(q.institute), dash(q.year)]) } },
        { label: 'Employment record relevant to the assignment:', table: {
          headers: ['Period', 'Employing organization and your title/position. Contact information for references', 'Location (Province/Palika)', 'Summary of activities performed relevant to the Assignment'],
          widths: [15, 33, 16, 36],
          rows: exp.map(e => [period(e), employerCell(e, 'helvetas'), dash(e.country), asProse(e.summary ?? e.description)]) } },
        { label: 'Staffs contact information:', text: `Phone: ${dash(p.phone)}` },
      ],
      certIntro: 'I, the undersigned, certify that to the best of my knowledge and belief, this CV correctly describes myself, my qualifications, and my experience, and I am available to undertake the assignment in case of an award. I understand that any misstatement or misrepresentation described herein may lead to my disqualification or dismissal by the Client.',
      certOutro: 'I understand that any wilful misstatement described herein may lead to my disqualification or dismissal, if engaged.',
      sign: [SIGN_ROW('[Signature of Staff]'), SIGN_ROW('[Signature of authorized representative of the Consulting Firm]')],
      tail: [['Full name of authorized representative of Consulting Firm', rep]],
    };
  }
  // PPMO EOI — Form 3
  return {
    title: `Curriculum Vitae (CV) for Proposed ${p.person_type === 'Support Staff' ? 'Support' : 'Professional'} Staff`,
    kv: [['Proposed Position', dash(cv.proposed_position)], ['Name of Training Provider', firm], ['Name of Staff', p.full_name],
      ['Phone/Mobile No. of Staff', dash(p.phone)], ['Date of Birth', dash(p.date_of_birth)],
      ['Years with TP', dash(p.years_with_entity)], ['Nationality', dash(p.nationality || 'Nepali')],
      ['Membership in Professional Societies', p.professional_memberships || 'N/A']],
    blocks: [
      { label: 'Education:', table: { headers: ['Qualification', 'Institute/School/College', 'Year of Completion'], widths: [38, 44, 18],
        rows: educationOf(cv).map(q => [q.title, dash(q.institute), dash(q.year)]) } },
      { label: 'Employment Record:', table: { headers: ['Duration and Position', 'Employer', 'Major Tasks Performed'], widths: [24, 30, 46],
        rows: exp.map(e => [joinLines(period(e), e.position && `${e.position}${e.employment_type ? ` (${e.employment_type})` : ''}`),
          joinLines(dash(e.organisation), e.project_name && `Project: ${e.project_name}`, e.country), asProse(e.summary ?? e.description)]) } },
      { label: 'Training:', table: { headers: ['Training', 'Institute', 'Duration and Date'], widths: [40, 34, 26],
        rows: cv.trainings.map(q => [dash(q.title), dash(q.institution), trainingDuration(q)]) } },
    ],
    certIntro: 'I, the undersigned, certify that to the best of my knowledge and belief, these data correctly describe my qualifications, my experience, and me.',
    sign: [SIGN_ROW('[Signature of staff member and authorized representative of the consultant]', 'Date: [Day/Month/Year]')],
    tail: [['Full name of staff member', p.full_name], ['Full name of authorized representative', rep], ['Seal of the Training provider', '']],
  };
}

/* Print */
const cellHTML = (c) => (c && typeof c === 'object' && 'prose' in c ? htmlProse(c.prose)
  : esc(String(c ?? '')).replace(/\n/g, '<br/>'));

function modelHTML(m, index) {
  const block = (b) => {
    const head = `<p class="lbl">${esc(b.label)}</p>`;
    if (b.table) {
      return head + (b.table.rows.length
        ? `<table><colgroup>${b.table.widths.map(w => `<col style="width:${w}%"/>`).join('')}</colgroup>
           <thead><tr>${b.table.headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
           <tbody>${b.table.rows.map(r => `<tr>${r.map(c => `<td>${cellHTML(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
        : '<p class="muted">Not recorded.</p>');
    }
    if (b.lines) return head + (b.lines.length ? b.lines.map(l => `<p>${esc(l)}</p>`).join('') : '<p class="muted">Not recorded.</p>');
    return head + `<p>${esc(b.text)}</p>`;
  };
  return `
  <section class="cv"${index > 0 ? ' style="page-break-before: always;"' : ''}>
    <h2>${esc(m.title)}</h2>
    ${htmlTable(null, m.kv.map(([k, v]) => [`<strong>${esc(k)}</strong>`, esc(v)]))}
    ${m.blocks.map(block).join('')}
    <p class="lbl">Certification:</p>
    <p>${esc(m.certIntro)}</p>
    ${m.certList ? `<ol class="cert" type="i">${m.certList.map(c => `<li>${esc(c)}</li>`).join('')}</ol>` : ''}
    ${m.certOutro ? `<p>${esc(m.certOutro)}</p>` : ''}
    ${m.sign.map(r => `<div class="sign"><div class="sign-line"></div><div class="sign-date">${esc(r.right)} ______________</div></div>
      <p class="sign-note">${esc(r.left)}</p>`).join('')}
    <div class="tail">${m.tail.map(([k, v]) => `<p>${esc(k)}: <strong>${esc(v) || '______________________'}</strong></p>`).join('')}</div>
  </section>`;
}

/* Word */
const proseCell = (c, width) => new TableCell({
  borders: ALL_BORDERS, margins: CELL_MARGIN, verticalAlign: VerticalAlign.TOP,
  width: width ? { size: width, type: WidthType.PERCENTAGE } : undefined,
  children: (lines(c.prose).length ? lines(c.prose) : ['—']).map(l => new Paragraph({
    children: [new TextRun({ text: l.replace(/^[•\-*]\s*/, ''), size: 17 })],
    bullet: /^[•\-*]/.test(l) ? { level: 0 } : undefined,
  })),
});
const anyCell = (c, width, opts = {}) => (c && typeof c === 'object' && 'prose' in c ? proseCell(c, width) : cell(String(c ?? ''), { ...opts, width }));
const run = (text, o = {}) => new TextRun({ text, size: 19, ...o });

function modelChildren(m, index) {
  const out = [];
  if (index > 0) out.push(new Paragraph({ children: [], pageBreakBefore: true }));
  out.push(new Paragraph({ children: [run(m.title, { bold: true, size: 24 })], alignment: AlignmentType.CENTER, spacing: { after: 160 } }));
  out.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE },
    rows: m.kv.map(([k, v]) => new TableRow({ children: [cell(k, { bold: true, width: 35 }), cell(v, { width: 65 })] })) }));
  for (const b of m.blocks) {
    out.push(new Paragraph({ children: [run(b.label, { bold: true })], spacing: { before: 200, after: 60 } }));
    if (b.table) {
      out.push(b.table.rows.length ? new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [
        new TableRow({ tableHeader: true, children: b.table.headers.map((h, i) => cell(h, { bold: true, fill: 'EEEEEE', width: b.table.widths[i] })) }),
        ...b.table.rows.map(r => new TableRow({ children: r.map((c, i) => anyCell(c, b.table.widths[i])) })),
      ] }) : new Paragraph({ children: [run('Not recorded.', { italics: true })] }));
    } else if (b.lines) {
      (b.lines.length ? b.lines : ['Not recorded.']).forEach(l => out.push(new Paragraph({ children: [run(l)], spacing: { after: 40 } })));
    } else {
      out.push(new Paragraph({ children: [run(b.text)] }));
    }
  }
  out.push(new Paragraph({ children: [run('Certification:', { bold: true })], spacing: { before: 240, after: 60 } }));
  out.push(new Paragraph({ children: [run(m.certIntro)], spacing: { after: 80 } }));
  (m.certList || []).forEach((c, i) => out.push(new Paragraph({
    children: [run(`(${['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii'][i]}) ${c}`)], indent: { left: 360 }, spacing: { after: 40 } })));
  if (m.certOutro) out.push(new Paragraph({ children: [run(m.certOutro)], spacing: { before: 80 } }));
  for (const r of m.sign) {
    out.push(new Paragraph({ children: [run(`__________________________________          ${r.right} ______________`)], spacing: { before: 400 } }));
    out.push(new Paragraph({ children: [run(r.left, { italics: true, size: 16, color: '333333' })] }));
  }
  m.tail.forEach(([k, v]) => out.push(new Paragraph({ children: [run(`${k}: ${v || '______________________'}`)], spacing: { before: 120 } })));
  return out;
}

export default { buildPrintHTML, downloadDOCX, CV_FORMATS };
export { buildPrintHTML, downloadDOCX, personalRows, lines, period, CERTIFY, cvModel, modelChildren };

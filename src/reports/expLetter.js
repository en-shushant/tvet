/**
 * The experience letter a firm issues for someone on its CV pack.
 *
 * It states exactly what the CV's employment row states — the same post, the
 * same dates, the same number of training events for the same clients, the
 * same duties — because the server hands both the one record. A reviewer who
 * holds the CV against the letter finds nothing to query.
 *
 * Laid out like the firm's own letters: its letterhead behind the page (with
 * the margins set for it), the date, "To Whom It May Concern", the body, and
 * the signatory with the firm's signature and stamp.
 */
import {
  Paragraph, TextRun, ImageRun, Header, AlignmentType,
  HorizontalPositionRelativeFrom, VerticalPositionRelativeFrom, TextWrappingType,
} from 'docx';
import { esc } from './helpers.js';
import { bsToAD } from '../constants/nepali.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A stored BS date ("2071/08/15", "2071/08", "2071") as the letter writes it: "Dec 2014". */
export function adMonthOf(bs) {
  const m = String(bs || '').trim().match(/^(\d{4})(?:[/-](\d{1,2}))?(?:[/-](\d{1,2}))?/);
  if (!m) return '';
  try {
    const [y, mo] = bsToAD(m[1], m[2] || 1, m[3] || 1).split('-').map(Number);
    return `${MONTHS[mo - 1]} ${y}`;
  } catch { return ''; }
}

export const letterDate = (d = new Date()) =>
  `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()].toUpperCase()} ${d.getFullYear()}`;

/** Pronouns that agree with their verbs; neutral when gender is not recorded. */
function pronouns(gender) {
  const g = String(gender || '').toLowerCase();
  if (g.startsWith('m')) return { He: 'He', he: 'he', his: 'his', His: 'His', him: 'him', has: 'has', is: 'is', was: 'was' };
  if (g.startsWith('f')) return { He: 'She', he: 'she', his: 'her', His: 'Her', him: 'her', has: 'has', is: 'is', was: 'was' };
  return { He: 'They', he: 'they', his: 'their', His: 'Their', him: 'them', has: 'have', is: 'are', was: 'were' };
}

/**
 * The letter as runs: [[text, bold], …] per paragraph, plus the duty list.
 * Shared by print and Word so the two say the same words.
 */
export function letterModel(letter, person) {
  const P = pronouns(person.gender);
  const firm = letter.firm || {};
  const trainer = person.person_type !== 'Support Staff';
  const from = adMonthOf(letter.from_date);
  const to = adMonthOf(letter.to_date);
  const n = parseInt(letter.events_count, 10);
  const clients = String(letter.clients || '').trim();
  const occ = String(letter.occupation || '').trim();

  const p1 = [['This letter is to formally acknowledge that '], [person.full_name, true],
    [letter.is_current ? ' has been employed with ' : ` ${P.was} employed with `], [firm.name || '', true],
    [` as ${/^[aeiou]/i.test(letter.position || '') ? 'an' : 'a'} ${letter.position || 'staff member'}`],
    ...(occ && trainer ? [[' in '], [occ, true], [' Occupation']] : []),
    ...(letter.is_current ? (from ? [[' since '], [from, true]] : [])
      : [[' from '], [from || '—', true], [' to '], [to || '—', true]]),
    ['.']];

  const events = n > 0
    ? [[trainer ? ` ${P.He} ${P.has} conducted ` : ` ${P.He} ${P.has} supported `], [`${n} training event${n === 1 ? '' : 's'}`, true],
       ...(clients ? [[' under '], [clients, true], [' projects']] : []), ['.']]
    : (clients ? [[` ${P.He} ${P.has} worked on training programmes under `], [clients, true], ['.']] : []);
  const p2 = trainer
    ? [[`During ${P.his} tenure with us, ${P.he} ${P.has} demonstrated sound skills in vocational training, effectively imparting knowledge and techniques to our trainees.`], ...events]
    : [[`During ${P.his} tenure with us, ${P.he} ${P.has} carried out ${P.his} responsibilities as ${letter.position || 'a staff member'} diligently.`], ...events];

  const p4 = trainer
    ? [[`${P.He} ${P.is} known for ${P.his} strong communication skills, patience, and dedication to fostering a positive learning environment, and ${P.has} consistently received positive feedback from trainees and colleagues.`]]
    : [[`${P.He} ${P.is} known for ${P.his} diligence, reliability, and close cooperation with colleagues and project partners.`]];
  const p5 = [[letter.is_current
    ? `We appreciate ${P.his} valuable contributions to our institute.`
    : `We appreciate ${P.his} valuable contributions to our institute and wish ${P.him} success in ${P.his} future endeavors.`]];

  return {
    firm, paragraphs: [p1, p2], dutiesIntro: `${P.His} main responsibilities ${letter.is_current ? 'include' : 'included'}:`,
    duties: (letter.duties || []).map(d => d.replace(/^[•\-*]\s*/, '')), closing: [p4, p5],
    signatory: firm.contact_person || '', designation: firm.contact_designation || 'Managing Director',
  };
}

/* ── Print ──────────────────────────────────────────────────────────────── */

const runsHTML = (runs) => runs.map(([t, b]) => (b ? `<strong>${esc(t)}</strong>` : esc(t))).join('');

export const LETTER_CSS = `
  .xl { width: 210mm; min-height: 297mm; position: relative; break-before: page; box-sizing: border-box;
        font-family: 'Times New Roman', Times, serif; font-size: 12pt; color: #000; background-size: 210mm 297mm;
        background-repeat: no-repeat; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .xl-head { text-align: center; border-bottom: 2px solid #333; padding-bottom: 6px; margin-bottom: 4px; }
  .xl-head .xl-ids { display: flex; justify-content: space-between; font-size: 9.5pt; font-weight: bold; }
  .xl-head .xl-name { font-size: 18pt; font-weight: bold; margin: 4px 0; }
  .xl-head .xl-contact { font-size: 9.5pt; }
  .xl-date { text-align: right; margin: 10px 0 22px; }
  .xl-title { text-align: center; font-weight: bold; margin-bottom: 16px; }
  .xl p { text-align: justify; line-height: 1.5; margin: 0 0 12px; font-size: 12pt; }
  .xl ul { margin: -4px 0 12px 22px; padding: 0; } .xl li { font-size: 12pt; line-height: 1.45; margin: 0 0 3px; }
  .xl-sign { margin-top: 26px; display: flex; justify-content: space-between; align-items: flex-end; }
  .xl-sign img.sig { max-height: 16mm; display: block; margin: 4px 0; }
  .xl-sign img.stamp { width: 28mm; height: 28mm; object-fit: contain; }
  .xl-sign .who { line-height: 1.4; }
`;

export function letterHTML(letter, person, dateStr = letterDate()) {
  const m = letterModel(letter, person);
  const f = m.firm;
  const top = f.letterhead ? (Number(f.letter_top_margin) || 45) : 16;
  const lr = Number(f.letter_lr_padding) || 20;
  const bottom = f.letterhead ? (Number(f.letter_bottom_padding) || 30) : 16;
  const head = f.letterhead ? '' : `
    <div class="xl-head">
      <div class="xl-ids"><span>${f.reg_no ? `REGD. NO. ${esc(f.reg_no)}` : ''}</span><span>${f.pan ? `PAN NO. ${esc(f.pan)}` : ''}</span></div>
      <div class="xl-name">${esc((f.name || '').toUpperCase())}</div>
      <div class="xl-contact">${esc([f.address, f.phone || f.mobile, f.email].filter(Boolean).join('  ·  '))}</div>
    </div>`;
  return `
  <section class="xl" style="padding:${top}mm ${lr}mm ${bottom}mm;${f.letterhead ? `background-image:url('${esc(f.letterhead)}');` : ''}">
    ${head}
    <div class="xl-date">Date: ${esc(dateStr)}</div>
    <div class="xl-title">To Whom It May Concern</div>
    ${m.paragraphs.map(p => `<p>${runsHTML(p)}</p>`).join('')}
    ${m.duties.length ? `<p>${esc(m.dutiesIntro)}</p><ul>${m.duties.map(d => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}
    ${m.closing.map(p => `<p>${runsHTML(p)}</p>`).join('')}
    <div class="xl-sign">
      <div class="who">Sincerely,
        ${f.sign ? `<img class="sig" src="${esc(f.sign)}" alt="Signature">` : '<div style="height:16mm"></div>'}
        ${esc(m.signatory)}<br>${esc(m.designation)}<br>${esc(f.name || '')}</div>
      ${f.stamp ? `<img class="stamp" src="${esc(f.stamp)}" alt="Stamp">` : ''}
    </div>
  </section>`;
}

/* ── Word ───────────────────────────────────────────────────────────────── */

const MM = 56.7;   // twips per mm
const run = (t, bold = false) => new TextRun({ text: t, bold, size: 24, font: 'Times New Roman' });
const para = (runs, opts = {}) => new Paragraph({ children: runs.map(([t, b]) => run(t, b)), alignment: AlignmentType.JUSTIFIED, spacing: { after: 200, line: 300 }, ...opts });

/** Fetch an image (data: URL or address) for embedding; null if it cannot be read. */
export async function loadImage(src) {
  if (!src) return null;
  try {
    const res = await fetch(src);
    if (!res.ok) return null;
    const type = /png/i.test(res.headers.get('content-type') || src.slice(0, 30)) ? 'png' : 'jpg';
    return { data: await res.arrayBuffer(), type };
  } catch { return null; }
}

/** One Word section per letter: its own margins, and the letterhead behind the page. */
export function letterSection(letter, person, images = {}, dateStr = letterDate()) {
  const m = letterModel(letter, person);
  const f = m.firm;
  const hasHead = !!images.letterhead;
  const children = [];
  if (!hasHead) {
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [run(
      [f.reg_no && `REGD. NO. ${f.reg_no}`, f.pan && `PAN NO. ${f.pan}`].filter(Boolean).join('      '), true)] }));
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: (f.name || '').toUpperCase(), bold: true, size: 34 })] }));
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
      border: { bottom: { style: 'single', size: 12, color: '333333', space: 4 } },
      children: [new TextRun({ text: [f.address, f.phone || f.mobile, f.email].filter(Boolean).join('  ·  '), size: 19 })] }));
  }
  children.push(new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 360 }, children: [run(`Date: ${dateStr}`)] }));
  children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 280 }, children: [run('To Whom It May Concern', true)] }));
  m.paragraphs.forEach(p => children.push(para(p)));
  if (m.duties.length) {
    children.push(para([[m.dutiesIntro]], { spacing: { after: 80 } }));
    m.duties.forEach(d => children.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 40 }, children: [run(d)] })));
    children.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
  }
  m.closing.forEach(p => children.push(para(p)));
  children.push(new Paragraph({ spacing: { before: 240 }, children: [run('Sincerely,')] }));
  if (images.sign) children.push(new Paragraph({ children: [new ImageRun({ type: images.sign.type, data: images.sign.data, transformation: { width: 130, height: 55 } })] }));
  else children.push(new Paragraph({ spacing: { after: 600 }, children: [] }));
  [m.signatory, m.designation, f.name].filter(Boolean).forEach(t => children.push(new Paragraph({ children: [run(t)] })));
  if (images.stamp) children.push(new Paragraph({ alignment: AlignmentType.RIGHT, children: [new ImageRun({ type: images.stamp.type, data: images.stamp.data, transformation: { width: 100, height: 100 } })] }));

  const top = hasHead ? (Number(f.letter_top_margin) || 45) : 16;
  const lr = Number(f.letter_lr_padding) || 20;
  const bottom = hasHead ? (Number(f.letter_bottom_padding) || 30) : 16;
  return {
    properties: { page: { size: { width: 11906, height: 16838 },
      margin: { top: Math.round(top * MM), bottom: Math.round(bottom * MM), left: Math.round(lr * MM), right: Math.round(lr * MM), header: 0 } } },
    headers: hasHead ? { default: new Header({ children: [new Paragraph({ children: [new ImageRun({
      type: images.letterhead.type, data: images.letterhead.data, transformation: { width: 794, height: 1123 },
      floating: { horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: 0 },
                  verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: 0 },
                  behindDocument: true, wrap: { type: TextWrappingType.NONE } } })] })] }) } : undefined,
    children,
  };
}

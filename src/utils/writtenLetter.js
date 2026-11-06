/**
 * A letter written from scratch: the recipient office on top, a subject, the body,
 * an optional table, and an optional signature and stamp, on the firm's letterhead.
 *
 * It follows the firm's saved letter design (margins, stamp and signature sizes) like
 * every other letter, and is laid out on one page by fitLetter. The pieces are split so
 * the editor can change the writing in place while the images are fetched only once:
 *
 *   loadFirmAssets(row)          – images, fonts and the firm's layout, once
 *   buildLetterHtml(a, content)  – the whole HTML document
 *   bodyHtml(a, content)         – just what goes inside the page, for live updates
 *   composeWritten(a, content)   – the shape renderComposed turns into a PDF
 */
import { urlToDataUrl, detectLetterheadMargins } from './neaLetter.js';
import { loadKalimatiCss } from './kalimatiFont.js';

/** Text written into the HTML is escaped, so what is typed is shown, never run. */
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const lines = (v) => esc(v).replace(/\n/g, '<br>');

export const BLANK_LETTER = {
  date: '', refNo: '',
  addressee: '', office: '', office2: '', address: '',
  subject: '', body: '',
  table: { on: false, cols: ['', '', ''], rows: [['', '', ''], ['', '', '']] },
  signatory: '', designation: '',
  withSign: true, withStamp: true, withLetterhead: true,
};

/** What a firm brings to a letter: its images, the fonts, and its saved layout. */
export async function loadFirmAssets(row) {
  const [[letterhead, sign, stamp], kalimatiCss] = await Promise.all([
    Promise.all([urlToDataUrl(row.institute_letterhead || null), urlToDataUrl(row.institute_sign || null), urlToDataUrl(row.institute_stamp || null)]),
    loadKalimatiCss(),
  ]);
  const num = (v) => (v == null || v === '' ? null : Number(v));
  const cfgTop = num(row.institute_letter_top_margin), cfgBottom = num(row.institute_letter_bottom_padding);
  let top = cfgTop ?? 15, bottom = cfgBottom ?? 15;
  let detected = { top: null, bottom: null };
  if (letterhead) {
    detected = await detectLetterheadMargins(letterhead);
    if (detected.top && detected.top > top) top = detected.top;
    if (detected.bottom && detected.bottom > bottom) bottom = detected.bottom;
  }
  const scale = (v) => (Number(v) > 0 ? Number(v) : 1);
  return {
    letterhead, sign, stamp, kalimatiCss,
    margins: { top, bottom, lr: num(row.institute_letter_lr_padding) ?? 20 },
    stampScale: scale(row.institute_letter_stamp_scale), signScale: scale(row.institute_letter_sign_scale),
    firmName: row.institute_name_np || row.institute_name || '',
    contact: row.institute_contact_np || row.institute_contact || '',
    firmLabel: row.institute_acronym || row.institute_name || 'letter',
  };
}

const cell = (tag, v) => `<${tag}>${esc(v)}</${tag}>`;

/** The table, if it is on and has anything in it; empty trailing rows are left out. */
function tableHtml(t) {
  if (!t?.on) return '';
  const cols = t.cols || [];
  const rows = (t.rows || []).filter(r => r.some(c => String(c).trim()));
  if (!cols.length || (!rows.length && !cols.some(c => String(c).trim()))) return '';
  return `<table class="lt">
    <thead><tr>${cols.map(c => cell('th', c)).join('')}</tr></thead>
    <tbody>${rows.map(r => `<tr>${cols.map((_, i) => cell('td', r[i] ?? '')).join('')}</tr>`).join('')}</tbody>
  </table>`;
}

/** Paragraphs are separated by a blank line; a single line break stays a line break. */
const paragraphs = (body) => String(body || '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
  .map(p => `<div class="body-txt">${lines(p)}</div>`).join('');

/** Everything inside the page's writing area. */
export function bodyHtml(a, c) {
  const addr = [c.office, c.office2, c.address].filter(x => String(x).trim());
  const showSign = c.withSign && a.sign, showStamp = c.withStamp && a.stamp;
  const name = c.signatory || a.contact, desig = c.designation;
  return `
  <div class="ref-row"><span>${c.refNo ? `पत्र संख्या: ${esc(c.refNo)}` : ''}</span><span>${c.date ? `मिति: ${esc(c.date)}` : ''}</span></div>
  ${addr.length || c.addressee ? `<div class="to-block">
    ${c.addressee ? `<div>${esc(c.addressee)}</div>` : ''}
    ${addr.map(x => `<div>${esc(x)}</div>`).join('')}
  </div>` : ''}
  ${c.subject ? `<div class="subject">विषय: ${esc(c.subject)}</div>` : ''}
  ${paragraphs(c.body)}
  ${tableHtml(c.table)}
  <div class="sig-row">
    ${showStamp ? `<div class="sig-stamp"><img src="${a.stamp}" alt="Stamp" style="width:calc(26mm * var(--stamp, 1));height:calc(26mm * var(--stamp, 1));object-fit:contain;display:block;margin:0 auto;"></div>` : ''}
    <div class="sig-block">
      ${showSign ? `<img src="${a.sign}" alt="Signature" style="display:block;margin:0 auto 4px;max-height:calc(14mm * var(--sign, 1));max-width:100%;object-fit:contain;">` : ''}
      ${name || desig || a.firmName ? `<div class="sig-line">${[name, desig, a.firmName].filter(x => String(x || '').trim()).map(esc).join('<br>')}</div>` : ''}
    </div>
  </div>`;
}

/** The whole HTML document: same page structure as the shortlisting letter so fitLetter lays it out the same way. */
export function buildLetterHtml(a, c, { preview = false } = {}) {
  const useLh = !!a.letterhead && c.withLetterhead !== false;
  const { top, bottom, lr } = a.margins;
  return `<!DOCTYPE html><html lang="ne"><head><meta charset="UTF-8"><style>
  ${a.kalimatiCss || ''}
  * { margin:0; padding:0; box-sizing:border-box; }
  html { background:#fff; }
  body { background:#fff; font-family:'Kalimati','Noto Sans Devanagari','Arial Unicode MS',sans-serif; color:#111; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .page { width:794px; height:1123px; position:relative; overflow:hidden; font-size:10.5pt; line-height:1.65;
    background-color:${useLh && !preview ? 'transparent' : '#fff'};
    ${preview && useLh ? `background-image:url("${a.letterhead}"); background-size:100% 100%; background-repeat:no-repeat;` : ''} }
  .page-inner { position:relative; z-index:1; padding:${top}mm ${lr}mm ${bottom}mm ${lr}mm; }
  .ref-row { display:flex; justify-content:space-between; margin-bottom:10px; font-size:11pt; }
  .to-block { margin-bottom:12px; font-size:10.5pt; line-height:1.75; }
  .subject { text-align:center; font-size:11pt; font-weight:700; text-decoration:underline; text-underline-offset:3px; margin-bottom:10px; }
  .body-txt { margin-bottom:8px; font-size:10pt; text-align:justify; line-height:1.7; }
  table.lt { width:100%; border-collapse:collapse; font-size:10pt; margin:6px 0 10px; }
  table.lt th, table.lt td { border:1px solid #666; padding:5px 8px; vertical-align:top; text-align:left; }
  table.lt th { font-weight:700; background:#f1f1f1; }
  .sig-row { display:flex; justify-content:flex-end; gap:24px; align-items:flex-end; margin-top:48px; }
  .sig-stamp { text-align:center; min-width:70px; }
  .sig-block { text-align:center; min-width:130px; }
  .sig-line { border-top:1px solid #333; padding-top:4px; font-size:9pt; }
  :root { --stamp:${a.stampScale}; --sign:${a.signScale}; }
</style></head><body><div class="page"><div class="page-inner"><div class="fit">${bodyHtml(a, c)}</div></div></div></body></html>`;
}

/** The shape renderComposed turns into a PDF (no attachments). */
export function composeWritten(a, c) {
  const useLhBg = !!a.letterhead && c.withLetterhead !== false;
  return {
    html: buildLetterHtml(a, c), useLhBg, firmLetterhead: a.letterhead, firmStamp: a.stamp, firmSign: a.sign,
    includeStamp: !!(c.withStamp && a.stamp), includeSign: !!(c.withSign && a.sign),
    activeDocs: [], parseDocFiles: () => [], kalimatiCss: a.kalimatiCss,
    margins: a.margins, stampScale: a.stampScale, signScale: a.signScale,
  };
}

/**
 * The date a CV pack is signed. Picked once for the pack and printed on every
 * CV's "Date:" line, so nobody writes it in by hand on thirty pages.
 *
 * The picker works in AD (what a calendar widget gives); the CV prints it the
 * way the rest of the CV's dates are written — BS, "2083/07/12" — or as an AD
 * date, "29 October 2026", as the firm prefers.
 */
import { adToBS } from '../constants/nepali.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const pad = (n) => String(n).padStart(2, '0');

/** Today in Kathmandu, as the "YYYY-MM-DD" a date input takes. */
export const todayISO = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kathmandu' });

/** "2026-10-29" → "2083/07/12" (bs) or "29 October 2026" (ad). '' when it is not a date. */
export function formatCvDate(iso, style = 'bs') {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (style === 'ad') return `${d} ${MONTHS[mo - 1]} ${y}`;
  try {
    const bs = adToBS(new Date(Date.UTC(y, mo - 1, d)));
    return `${bs.y}/${pad(bs.m)}/${pad(bs.d)}`;
  } catch { return ''; }
}

/** What follows "Date:" on a signature line: the picked date, else the blank to write in. */
export const signDateText = (dateText) => dateText || '______________';

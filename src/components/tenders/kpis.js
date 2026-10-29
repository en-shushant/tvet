/**
 * The figures at the top of the Tenders page, one per bid (the latest stage of
 * each, as the list shows it). Pure, so the arithmetic can be tested.
 */
import { bsToAD } from '../../constants/nepali.js';

const DAY = 86400000;
const utcDay = (y, m, d) => Date.UTC(y, m - 1, d);

/**
 * A deadline as typed — "17-03-2026", "2026/03/17", "17.3.2026" — as a UTC day,
 * or null. The e-GP notice is in AD; a year of 2070 or more is read as BS.
 */
export function parseDeadline(text) {
  const s = String(text || '').trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  let y, mo, d;
  if (m) [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  else if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/))) [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  else return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 32) return null;
  try {
    if (y >= 2070) {
      const [ay, am, ad] = bsToAD(y, mo, d).split('-').map(Number);
      return utcDay(ay, am, ad);
    }
  } catch { return null; }
  if (y < 1990) return null;
  const t = utcDay(y, mo, d);
  return Number.isNaN(t) ? null : t;
}

/** Whole days from `today` (a UTC day) to the deadline; negative once it has passed. */
export const daysUntil = (deadline, today) => Math.round((deadline - today) / DAY);

export function tenderKpis(rows, todayMs, soonDays = 14) {
  const latest = rows.map(r => r.latest || r.root).filter(Boolean);
  const count = (...statuses) => latest.filter(t => statuses.includes(t.status || 'Preparing')).length;
  const preparing = latest.filter(t => (t.status || 'Preparing') === 'Preparing');
  const dated = preparing
    .map(t => ({ t, at: parseDeadline(t.submission_date) }))
    .filter(x => x.at != null)
    .map(x => ({ ...x, days: daysUntil(x.at, todayMs) }));
  const overdue = dated.filter(x => x.days < 0);
  const soon = dated.filter(x => x.days >= 0 && x.days <= soonDays).sort((a, b) => a.days - b.days);
  const awarded = count('Awarded');
  const decided = awarded + count('Lost');
  return {
    total: latest.length,
    preparing: preparing.length,
    awaiting: count('Submitted', 'Shortlisted'),
    awarded,
    lost: count('Lost'),
    winRate: decided > 0 ? Math.round((awarded / decided) * 100) : null,
    soon: soon.length, overdue: overdue.length,
    next: soon[0] ? { title: soon[0].t.title, days: soon[0].days } : null,
    withoutDeadline: preparing.length - dated.length,
  };
}

export const todayUtcDay = () => {
  const [y, m, d] = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kathmandu' }).split('-').map(Number);
  return utcDay(y, m, d);
};

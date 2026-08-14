// Canonical formatting and lookup helpers.
//
// These were previously copy-pasted into 6-8 components each. Import from here
// rather than redefining locally — a divergent copy is how the number formatter
// `fmt` and the date formatter `fmt` ended up sharing a name.

import { OCCUPATIONS } from '../constants/data.js';

/**
 * Indian-grouped number, em dash when absent.
 *
 * Note: this renders 0 as an em dash. `enssure.jsx` and `detailed.jsx` keep their
 * own variant that renders 0 as "0", because a genuine zero-trainee row must be
 * distinguishable from missing data in those reports. Don't merge them.
 */
export const fmt = (n) => n ? Number(n).toLocaleString('en-IN') : '—';

/** "12 Aug 2026" from an ISO date, em dash when absent. */
export const fmtDate = (d) => d
  ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—';

/** Percentage to one decimal, em dash when the denominator is zero. */
export const pct = (n, d) => d > 0 ? ((n / d) * 100).toFixed(1) + '%' : '—';

/** Nepali fiscal year "2081/82" → Gregorian "2024/25". */
export const fyToAD = (fy) => {
  if (!fy) return '';
  const parts = String(fy).split('/');
  if (parts.length !== 2) return '';
  const y1 = parseInt(parts[0]);
  if (isNaN(y1)) return '';
  return `${y1 - 57}/${String(y1 - 57 + 1).slice(-2)}`;
};

/** Short non-cryptographic id for client-side list keys. */
export const uid = () => Math.random().toString(36).slice(2, 9);

/**
 * Occupation record by id. Custom occupations are namespaced "c:<id>" to keep
 * them from colliding with built-in ids, which also start at 1.
 */
export function getOccupation(id) {
  const rawId = typeof id === 'string' && id.startsWith('c:') ? parseInt(id.slice(2)) : id;
  return OCCUPATIONS.find(o => o.id === rawId) || {};
}

/** Client record by id; always an object so callers can destructure safely. */
export const getClient = (clients, id) => (clients || []).find(c => c.id === id) || {};

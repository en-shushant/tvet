// Re-exported so report families keep their existing import path while there is
// only one implementation of each helper.
export { getClient, fmt } from '../utils/format.js';

export const fyToYear = (fy) => {
  if (!fy) return '';
  const y1 = parseInt((fy.split('/')[0]));
  return isNaN(y1) ? fy : String(y1 - 57);
};

export const monthsBetween = (start, end) => {
  if (!start || !end) return '';
  const s = new Date(start), e = new Date(end);
  if (isNaN(s) || isNaN(e)) return '';
  const m = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
  return m > 0 ? m : '';
};

export const districtsOf = (exp) => {
  const all = (exp.occupations || []).flatMap(o => o.locations || []);
  return [...new Set(all.map(l => l.district).filter(Boolean))];
};

export const esc = (s) =>
  s ? String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])) : '';

// Normalize FY to start year integer: "2077/78", "2077/078", "2077/079" → 2077
export const fyYear = (fy) => {
  if (!fy) return 0;
  return parseInt(fy.split('/')[0]) || 0;
};

// Compare FY strings by start year, supporting mixed formats (2077/78 vs 2077/078)
export const fyInRange = (fy, from, to) => {
  if (!fy) return false;
  const y = fyYear(fy);
  if (from && y < fyYear(from)) return false;
  if (to && y > fyYear(to)) return false;
  return true;
};

/**
 * An occupation row carries two names, and reports need different ones.
 *
 * `ctevt_occupation_id` points at the master occupation — "Electrician" — which
 * is what pickers, filters and grouping match on, since that is the only name
 * shared across firms. `name_in_letter` is what the client's own letter called
 * the same training: "Building Electrician", "House Wiring". A generated
 * document has to quote the client's wording, or it will not agree with the
 * evidence attached to it.
 *
 * So: match on occMasterName, print occLetterName.
 */
export const occMasterName = (occ, occupations) => {
  if (occupations?.length && occ.ctevtOccupationId) {
    const found = occupations.find(o => String(o.id) === String(occ.ctevtOccupationId));
    if (found) return found.name;
  }
  return (occ.nameInLetter || '').trim();
};

/** What the client's letter called it, falling back to the master name. */
export const occLetterName = (occ, occupations) => {
  const inLetter = (occ.nameInLetter || '').trim();
  return inLetter || occMasterName(occ, occupations);
};

/**
 * Assignments that count as experience.
 *
 * An assignment marked "Currently running" is work in progress: it belongs in a
 * portfolio, which lists what a firm is doing, but not in an experience table,
 * which reports what it achieved. Every experience section across every report
 * family asks for finished outcomes — trainees graduated, skill tests sat,
 * employment secured — and a training that has not ended has produced none of
 * them. Counting it would either publish zeroes as results or claim numbers
 * that do not exist yet.
 *
 * Applied once in ReportsView, where the FY range, donor type and duration
 * filters already narrow the set every family receives, rather than per family.
 * The one place that deliberately looks past it is Bagmati's Current Portfolio,
 * which reads the firm's own experience list instead of this narrowed set.
 *
 * An assignment recorded before the flag existed has no value for it and is
 * treated as finished, so nothing already in the registry changes.
 */
export const isOngoingAssignment = (exp) => !!exp?.isOngoing;
export const completedOnly = (exps) => (exps || []).filter(e => !isOngoingAssignment(e));

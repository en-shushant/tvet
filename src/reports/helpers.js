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

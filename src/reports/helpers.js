export const getClient = (clients, id) => (clients || []).find(c => c.id === id) || {};

export const fmt = (n) => n ? Number(n).toLocaleString('en-IN') : '—';

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

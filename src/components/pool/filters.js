/**
 * Narrowing the pool, and the numbers that describe it.
 *
 * Both work off the roster the server returns, which already carries each
 * person's derived trades, qualifications and documents on file. Eligibility
 * itself is still worked out in SQL; these only read the answer, so there is
 * no second implementation of "who can train what" to keep in step.
 */
import { educationRank, levelOfQualification, vocationalMeets } from '../../constants/education.js';
import { experienceYears } from '../../utils/hrFit.js';
import { sectionOf } from './common.js';

export const BLANK_FILTERS = {
  q: '', role: '', trades: [], requireAll: false, minEducation: '', minNstb: '',
  tot: false, minYears: '', availability: 'available', missing: '',
};

const isAvailable = (p) => p.is_active !== false;
const hasTot = (p) => (p.qualifications || []).some(q => q.kind === 'TOT');
const hasNstb = (p) => (p.qualifications || []).some(q => sectionOf(q) === 'vocational');
const hasDoc = (p, type) => (p.doc_types || []).includes(type);
const topGeneralRank = (p) => Math.max(-1, ...(p.qualifications || [])
  .filter(q => sectionOf(q) === 'general').map(q => educationRank(levelOfQualification(q))));

/** The roster, narrowed. Every filter left blank lets everyone through. */
export function applyFilters(people = [], f = BLANK_FILTERS, nowBS) {
  const needle = String(f.q || '').trim().toLowerCase();
  const minEdu = educationRank(f.minEducation);
  const minYears = parseInt(f.minYears, 10);
  return people.filter(p => {
    if (f.availability === 'available' && !isAvailable(p)) return false;
    if (f.availability === 'unavailable' && isAvailable(p)) return false;
    if (f.role && p.person_type !== f.role) return false;
    if (needle) {
      // Trades are searchable too: typing "plumb" is the quickest way to ask
      // "who can teach plumbing".
      const hay = [p.full_name, p.full_name_np, p.designation, p.citizenship_no, p.phone, p.email,
        ...(p.eligible_occupations || []).map(o => o.name)].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    if (f.trades?.length) {
      const mine = new Set((p.eligible_occupations || []).map(o => String(o.id)));
      const hits = f.trades.filter(id => mine.has(String(id))).length;
      if (f.requireAll ? hits < f.trades.length : hits === 0) return false;
    }
    if (minEdu >= 0 && topGeneralRank(p) < minEdu) return false;
    if (f.minNstb && !(p.qualifications || []).some(q => sectionOf(q) === 'vocational' && vocationalMeets(q.level, f.minNstb))) return false;
    if (f.tot && !hasTot(p)) return false;
    if (Number.isInteger(minYears) && minYears > 0) {
      const y = experienceYears(p, '', nowBS);
      if (!Number.isInteger(y) || y < minYears) return false;
    }
    if (f.missing && hasDoc(p, f.missing)) return false;
    return true;
  });
}

/** How many filters are narrowing the list, not counting the default "available only". */
export const activeFilterCount = (f) => [f.q?.trim(), f.role, f.trades?.length, f.minEducation, f.minNstb,
  f.tot, f.minYears, f.availability !== 'available', f.missing].filter(Boolean).length;

/**
 * The pool at a glance.
 *
 * Counted over people who can actually be proposed — someone marked as having
 * left is still in the records but is not capacity. "Thin" trades are the
 * ones resting on a single person: one resignation away from being unable to
 * bid for that trade at all, which is the risk worth seeing first.
 */
export function poolKpis(people = []) {
  const available = people.filter(isAvailable);
  const trainers = available.filter(p => p.person_type === 'Trainer');
  const byTrade = new Map();
  for (const p of available) {
    for (const o of p.eligible_occupations || []) {
      const cur = byTrade.get(o.id) || { id: o.id, name: o.name, count: 0 };
      cur.count += 1; byTrade.set(o.id, cur);
    }
  }
  const trades = [...byTrade.values()];
  const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
  const tot = trainers.filter(hasTot).length;
  const nstb = available.filter(hasNstb).length;
  const missingCv = available.filter(p => !hasDoc(p, 'CV')).length;
  const missingCitizenship = available.filter(p => !hasDoc(p, 'Citizenship')).length;
  return {
    total: people.length,
    available: available.length,
    unavailable: people.length - available.length,
    trainers: trainers.length,
    support: available.length - trainers.length,
    tradesCovered: trades.length,
    thinTrades: trades.filter(t => t.count === 1).sort((a, b) => a.name.localeCompare(b.name)),
    tot, totPct: pct(tot, trainers.length),
    nstb, nstbPct: pct(nstb, available.length),
    missingCv, missingCitizenship,
    readyPct: pct(available.filter(p => hasDoc(p, 'CV') && hasDoc(p, 'Citizenship')).length, available.length),
  };
}

/** Sort orders offered on the roster. */
export const SORTS = {
  name: { label: 'Name', fn: (a, b) => String(a.full_name).localeCompare(String(b.full_name)) },
  years: { label: 'Most experienced', fn: (a, b) => (experienceYears(b) ?? -1) - (experienceYears(a) ?? -1) },
  education: { label: 'Highest education', fn: (a, b) => topGeneralRank(b) - topGeneralRank(a) },
  trades: { label: 'Most trades', fn: (a, b) => (b.eligible_occupations?.length || 0) - (a.eligible_occupations?.length || 0) },
};

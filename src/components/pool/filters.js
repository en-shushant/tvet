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
  tot: false, minYears: '', availability: 'available', missing: '', pending: false, enteredBy: '', verifiedBy: '',
};

const isAvailable = (p) => p.is_active !== false;
// An editor's addition or edit, waiting for an admin/superadmin to confirm it.
// Records saved before this existed default to verified on the server.
export const isPending = (p) => p.is_verified === false;
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
    if (f.enteredBy && String(p.created_by || 'none') !== f.enteredBy) return false;
    if (f.verifiedBy && (isPending(p) || verifierKey(p) !== f.verifiedBy)) return false;
    if (needle) {
      // Trades are searchable too: typing "plumb" is the quickest way to ask
      // "who can teach plumbing".
      const hay = [p.hr_no, p.full_name, p.full_name_np, p.designation, p.citizenship_no, p.phone, p.email,
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
    if (f.pending && !isPending(p)) return false;
    return true;
  });
}

/** How many filters are narrowing the list, not counting the default "available only". */
export const activeFilterCount = (f) => [f.q?.trim(), f.role, f.trades?.length, f.minEducation, f.minNstb,
  f.tot, f.minYears, f.availability !== 'available', f.missing, f.pending, f.enteredBy, f.verifiedBy].filter(Boolean).length;

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
  const pendingReview = people.filter(isPending).length;
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
    missingCv, missingCitizenship, pendingReview,
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

/** Who entered records, for the "Entered by" filter: [{ id, name, count }], most first. */
export function enteredByOptions(people = []) {
  const m = new Map();
  for (const p of people) {
    const id = String(p.created_by || 'none');
    const o = m.get(id) || { id, name: p.created_by ? (p.created_by_name || 'Deleted user') : 'Not recorded', count: 0 };
    o.count++; m.set(id, o);
  }
  return [...m.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/**
 * What a record is reviewed against: each trade + level it holds a vocational
 * certificate in, or — with none — its highest general education level.
 */
export function reviewKeys(p) {
  const quals = p?.qualifications || [];
  const voc = quals.filter(q => sectionOf(q) === 'vocational' && q.level)
    .map(q => `trade:${String(q.occupation_name || '').trim().toLowerCase()}|${q.level}`);
  if (voc.length) return new Set(voc);
  const top = quals.filter(q => sectionOf(q) === 'general')
    .map(q => levelOfQualification(q)).filter(Boolean)
    .sort((a, b) => educationRank(b) - educationRank(a))[0];
  return new Set([`edu:${top || 'none'}`]);
}

/** Whether two records share a trade and level (or, without trades, an education level). */
export function sameReviewGroup(a, b) {
  const ka = reviewKeys(a);
  for (const k of reviewKeys(b)) if (ka.has(k)) return true;
  return false;
}

// Records verified before review existed carry no reviewer.
const verifierKey = (p) => String(p.verified_by || 'none');

/** Review status of the pool: verified, pending, and who verified how many (most first). */
export function verificationStats(people = []) {
  const by = new Map();
  let verified = 0, pending = 0;
  for (const p of people) {
    if (isPending(p)) { pending++; continue; }
    verified++;
    const id = verifierKey(p);
    const o = by.get(id) || { id, name: p.verified_by ? (p.verified_by_name || 'Deleted user') : 'Before review began', count: 0 };
    o.count++; by.set(id, o);
  }
  const byVerifier = [...by.values()].sort((a, b) => (a.id === 'none') - (b.id === 'none') || b.count - a.count);
  return { verified, pending, total: verified + pending, byVerifier,
    pct: verified + pending ? Math.round((verified / (verified + pending)) * 100) : 0 };
}

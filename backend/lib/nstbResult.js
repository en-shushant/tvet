// lib/nstbResult.js — look up an NSTB skill-test result.
//
// There is no official NSTB API. This asks the same third-party service the
// WorldLink site's Payload endpoint uses (dynamicqr.dolmapos.com), which is not
// an nstb.gov.np address: if it moves or goes down, lookups fail with a clear
// message and nothing else in the app is affected. Nothing is stored — the
// result goes back to the person filling in the form and no further.
//
// The service wants the date of birth in BS with slashes ("2064/02/27"); an AD
// date always comes back as "no result" (confirmed on the WorldLink/PHP side).
// Its reply is wrapped twice: JSON whose `Content` field is itself JSON text.

const RESULT_URL = process.env.NSTB_RESULT_URL || 'https://dynamicqr.dolmapos.com/api/result/postasync/';
const TIMEOUT_MS = 30000;   // the service often takes ~15 s to answer

class LookupError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

const clean = (v) => (v == null ? '' : String(v).trim());

/** "Level 2", "2", "LEVEL-2", "Level II" → the app's level value; null when unreadable. */
function levelOf(raw) {
  const s = clean(raw).toLowerCase();
  if (!s) return null;
  if (/technician/.test(s)) return 'Technician';
  const roman = { i: 1, ii: 2, iii: 3, iv: 4 };
  const m = /(\d)/.exec(s) || /\b(iv|iii|ii|i)\b/.exec(s);
  if (!m) return null;
  const n = Number(m[1]) || roman[m[1]];
  return n === 4 ? 'Professional' : n >= 1 && n <= 3 ? `Level ${n}` : null;
}

/**
 * pass / fail / withheld from the service's free-text wording. A real pass reads
 * "Standard Met" (competency wording), so "met" means pass and "not met" fail;
 * the literal keywords are the fallback. null when nothing recognisable.
 */
function outcomeOf(result) {
  for (const text of [result.performance, result.theoryStatus]) {
    const t = clean(text).toLowerCase();
    if (!t) continue;
    if (t.includes('withheld') || t.includes('w/h')) return 'withheld';
    if (t.includes('not met') || t.includes('fail')) return 'fail';
    if (t.includes('standard met') || t.includes('pass') || t.includes('distinction')) return 'pass';
  }
  return null;
}

function normaliseDob(v) {
  const s = clean(v).replace(/-/g, '/');
  const m = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(s);
  if (!m) return null;
  const [, y, mo, d] = m;
  if (+mo < 1 || +mo > 12 || +d < 1 || +d > 32) return null;
  return `${y}/${mo.padStart(2, '0')}/${d.padStart(2, '0')}`;
}

/** Look one candidate up. Throws LookupError with an HTTP status for the caller. */
async function lookupNstbResult({ symbolNo, dateOfBirth }, fetchImpl = fetch) {
  const symbol = clean(symbolNo);
  if (!/^[A-Za-z0-9/-]{1,30}$/.test(symbol)) throw new LookupError('Enter the symbol number as printed on the admit card.', 400);
  const dob = normaliseDob(dateOfBirth);
  if (!dob) throw new LookupError('Enter the date of birth in BS, e.g. 2058/09/11.', 400);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetchImpl(RESULT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ SymbolNo: symbol, DateOfBirth: dob }),
      signal: ctrl.signal,
    });
  } catch {
    throw new LookupError('The NSTB result service is unavailable. Try again later.', 502);
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new LookupError('The NSTB result service is unavailable. Try again later.', 502);

  let data;
  try {
    const envelope = await res.json();
    const inner = typeof envelope?.Content === 'string' ? JSON.parse(envelope.Content) : envelope?.Content;
    data = inner?.Data;
  } catch {
    throw new LookupError('The NSTB result service sent a reply that could not be read.', 502);
  }
  if (!data || data.Status === false || data.Status === 'false') return { found: false };

  const result = {
    name: clean(data.Name),
    fatherName: clean(data.FatherName),
    symbolNo: clean(data.SymbolNo) || symbol,
    registration: clean(data.Registration),
    occupation: clean(data.Occupation),
    levelText: clean(data.Level),
    level: levelOf(data.Level),
    year: clean(data.Year),
    certificateNo: clean(data.CertificateNo),
    testCenter: clean(data.TestCenter),
    isTheory: data.IsTheory ?? null,
    theoryMarks: clean(data.TheoryMarks),
    theoryStatus: clean(data.TheoryStatus),
    performance: clean(data.PERFORMANCE),
  };
  result.outcome = outcomeOf(result);
  return { found: true, result };
}

/**
 * A small in-memory limit on lookups, per user and overall. Results are other
 * people's records, keyed only by symbol number and date of birth, so an
 * unlimited endpoint would let someone guess them in bulk.
 */
function makeLimiter({ perUser = 20, overall = 200, windowMs = 10 * 60 * 1000 } = {}) {
  const hits = new Map();          // key → timestamps
  const take = (key, max, now) => {
    const list = (hits.get(key) || []).filter(t => now - t < windowMs);
    if (list.length >= max) { hits.set(key, list); return false; }
    list.push(now); hits.set(key, list); return true;
  };
  return (userId, now = Date.now()) => take(`u:${userId}`, perUser, now) && take('*', overall, now);
}

module.exports = { lookupNstbResult, LookupError, levelOf, outcomeOf, normaliseDob, makeLimiter };

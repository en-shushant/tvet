// lib/hrDuplicates.js — one person, one record in the HR pool.
//
// A person is the same person when any of these match another record:
// citizenship number, phone, email, name + date of birth, or a vocational
// certificate number. Compared loosely (case, spaces, punctuation, Nepali digits),
// since the same number is typed many ways. Name alone is not enough: names repeat.

const NP_DIGITS = '०१२३४५६७८९';
const toLatinDigits = (s) => String(s || '').replace(/[०-९]/g, d => String(NP_DIGITS.indexOf(d)));
const normId = (s) => toLatinDigits(s).toLowerCase().replace(/[^a-z0-9]/g, '');
const normPhone = (s) => { const d = toLatinDigits(s).replace(/\D/g, ''); return d.length >= 7 ? d.slice(-10) : ''; };
const normEmail = (s) => String(s || '').trim().toLowerCase();
const normName = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

// Same normalisation in SQL.
const SQL_ID = (col) => `regexp_replace(lower(translate(coalesce(${col},''), '${NP_DIGITS}', '0123456789')), '[^a-z0-9]', '', 'g')`;
const SQL_PHONE = (col) => `right(regexp_replace(translate(coalesce(${col},''), '${NP_DIGITS}', '0123456789'), '\\D', '', 'g'), 10)`;

/** The first existing record this one duplicates, or null. */
async function findDuplicate(db, body, excludeId = null) {
  const b = body || {};
  const checks = [];
  const cit = normId(b.citizenship_no);
  if (cit.length >= 3) checks.push({ why: 'the same citizenship number', sql: `${SQL_ID('p.citizenship_no')} = $V`, v: cit });
  const phone = normPhone(b.phone);
  if (phone) checks.push({ why: 'the same phone number', sql: `length(${SQL_PHONE('p.phone')}) >= 7 AND ${SQL_PHONE('p.phone')} = $V`, v: phone });
  const email = normEmail(b.email);
  if (email) checks.push({ why: 'the same email', sql: `lower(btrim(p.email)) = $V`, v: email });
  const name = normName(b.full_name);
  const dob = String(b.date_of_birth || '').trim();
  if (name && dob) checks.push({ why: 'the same name and date of birth',
    sql: `lower(regexp_replace(btrim(p.full_name), '\\s+', ' ', 'g')) = $V AND btrim(p.date_of_birth) = $W`, v: name, w: dob });
  const certs = [...new Set((b.qualifications || [])
    .filter(q => q?.stream === 'Vocational').map(q => normId(q.certificate_no)).filter(c => c.length >= 3))];
  if (certs.length) checks.push({ why: 'a vocational certificate with the same number',
    sql: `EXISTS (SELECT 1 FROM hr_qualifications q WHERE q.person_id = p.id AND q.stream = 'Vocational'
                  AND ${SQL_ID('q.certificate_no')} = ANY($V::text[]))`, v: certs });

  for (const c of checks) {
    const params = [c.v];
    let sql = c.sql.replace('$V', '$1');
    if (c.w !== undefined) { params.push(c.w); sql = sql.replace('$W', `$${params.length}`); }
    let where = sql;
    if (excludeId) { params.push(excludeId); where += ` AND p.id <> $${params.length}`; }
    const { rows: [hit] } = await db.query(
      `SELECT p.id, p.full_name, p.hr_no FROM hr_people p WHERE ${where} ORDER BY p.id LIMIT 1`, params);
    if (hit) return { ...hit, why: c.why };
  }
  return null;
}

const duplicateMessage = (d) =>
  `${d.full_name}${d.hr_no ? ` (${d.hr_no})` : ''} is already in the pool with ${d.why}. Open and update that record instead of adding another.`;


// ── Fuzzy: records with no shared number, but the same-looking person ─────────

function levenshtein(a, b) {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]; prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}
const similar = (a, b, min = 0.85) => {
  if (!a || !b) return false;
  const n = Math.max(a.length, b.length);
  return 1 - levenshtein(a, b) / n >= min;
};
const tokens = (s) => normName(s).replace(/[^a-zऀ-ॿ ]/g, ' ').split(' ').filter(Boolean);

/** "Ram B. Thapa" ~ "Ram Bahadur Thapa" ~ "Thapa Ram" ~ "Raam Thapa". */
function namesMatch(a, b) {
  const x = tokens(a), y = tokens(b);
  if (!x.length || !y.length) return false;
  if (similar(x.join(' '), y.join(' '))) return true;
  if (similar([...x].sort().join(' '), [...y].sort().join(' '))) return true;
  // Same first and last name, middle name missing or shortened.
  return x.length >= 2 && y.length >= 2
    && similar(x[0], y[0], 0.8) && similar(x[x.length - 1], y[y.length - 1], 0.8);
}

const normTitle = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9ऀ-ॿ]+/g, ' ').trim();

/** A degree or trade the two records share: fuzzy title, or same trade and level. */
function sharedQualification(qa, qb) {
  for (const a of qa) for (const b of qb) {
    if (a.occupation_id && b.occupation_id && String(a.occupation_id) === String(b.occupation_id)
      && (a.level || '') === (b.level || '')) return b.title || 'the same trade';
    const ta = normTitle(a.title), tb = normTitle(b.title);
    if (ta.length >= 3 && tb.length >= 3 && (ta === tb || similar(ta, tb))) return b.title;
  }
  return null;
}

/** Records that look like the same person by name and a shared degree/trade (all, or the first). */
async function findLikelyDuplicates(db, body, excludeId = null) {
  const b = body || {};
  const quals = (b.qualifications || []).filter(q => q && (q.title || q.occupation_id));
  if (!normName(b.full_name) || !quals.length) return [];
  const params = excludeId ? [excludeId] : [];
  const { rows } = await db.query(
    `SELECT p.id, p.full_name, p.hr_no, p.citizenship_no, p.date_of_birth,
            COALESCE((SELECT json_agg(json_build_object('title', q.title, 'occupation_id', q.occupation_id, 'level', q.level))
                        FROM hr_qualifications q WHERE q.person_id = p.id), '[]') AS quals
       FROM hr_people p
      ${excludeId ? `WHERE p.id <> $1 AND NOT EXISTS (SELECT 1 FROM hr_not_duplicates d
                       WHERE (d.person_a = $1 AND d.person_b = p.id) OR (d.person_b = $1 AND d.person_a = p.id))` : ''}`, params);
  const cit = normId(b.citizenship_no);
  const dob = String(b.date_of_birth || '').trim();
  const out = [];
  for (const r of rows) {
    // Different citizenship numbers or birth dates: different people.
    const rc = normId(r.citizenship_no);
    if (cit && rc && cit !== rc) continue;
    const rd = String(r.date_of_birth || '').trim();
    if (dob && rd && dob !== rd) continue;
    if (!namesMatch(b.full_name, r.full_name)) continue;
    const shared = sharedQualification(quals, r.quals || []);
    if (shared) out.push({ id: r.id, full_name: r.full_name, hr_no: r.hr_no, shared });
  }
  return out;
}
const findLikelyDuplicate = async (...a) => (await findLikelyDuplicates(...a))[0] || null;

/** Remember that `id` is not the same person as each lookalike found for it. */
async function confirmNotDuplicates(db, id, body, userId) {
  for (const d of await findLikelyDuplicates(db, body, id)) {
    const [a, b] = [Number(id), Number(d.id)].sort((x, y) => x - y);
    await db.query(`INSERT INTO hr_not_duplicates (person_a, person_b, confirmed_by) VALUES ($1, $2, $3)
                    ON CONFLICT DO NOTHING`, [a, b, userId]);
  }
}

const likelyMessage = (d) =>
  `This looks like ${d.full_name}${d.hr_no ? ` (${d.hr_no})` : ''}, already in the pool with a similar name and ${d.shared}. `
  + 'If it is the same person, update that record instead. Save anyway only if they are different people.';

module.exports = { findDuplicate, duplicateMessage, findLikelyDuplicate, findLikelyDuplicates, confirmNotDuplicates, likelyMessage, namesMatch, sharedQualification,
  normId, normPhone, normName };


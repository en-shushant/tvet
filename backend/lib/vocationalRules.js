// lib/vocationalRules.js — a qualification rule for each NSTB trade and level.
//
// A vocational certificate ("Tailoring, Level 2") links to a rule named after
// it — "Tailoring — Level 2 (NSTB)" — so every trade anyone holds shows under
// Qualification rules, where its main- and co-trainer levels can be adjusted.
// A new rule starts with exactly what the NSTB ladder already granted: co-
// trainer at every level up to the certificate's, main trainer one below the
// top (a single level serves for both). Same trade name = same trade, as the
// ladder reads it.

const LADDER = ['Level 1', 'Level 2', 'Level 3', 'Professional'];
const TOP = { 'Level 1': 1, 'Level 2': 2, 'Level 3': 3, Professional: 4, Technician: 2 };
const LABEL = { Professional: 'Level 4', Technician: 'Technician' };

/** { main, co } levels a certificate at `level` teaches. */
function levelsFor(level) {
  const co = LADDER.slice(0, TOP[level] || 0);
  return { co, main: co.length > 1 ? co.slice(0, -1) : co };
}

const ruleName = (trade, level) => `${String(trade).trim()} — ${LABEL[level] || level} (NSTB)`;

/**
 * The rule id for a vocational certificate, created (with its trade and levels)
 * if it does not exist yet. null when the certificate names no trade or level.
 */
async function vocationalRuleFor(client, occupationId, level) {
  if (!occupationId || !TOP[level]) return null;
  const { rows: [occ] } = await client.query('SELECT id, name, level FROM occupations WHERE id = $1', [occupationId]);
  if (!occ) return null;
  const name = ruleName(occ.name, level);
  const { rows: [found] } = await client.query(
    `SELECT id FROM hr_qualification_rules
      WHERE is_active AND kind = 'Skill Test' AND lower(btrim(name)) = lower($1) ORDER BY id LIMIT 1`, [name]);
  if (found) return found.id;
  // A trade listed without a ladder level (blank, "N/A") is granted as itself.
  const { co, main } = TOP[occ.level] && occ.level !== 'Technician' ? levelsFor(level) : { co: [], main: [] };
  const { rows: [rule] } = await client.query(
    `INSERT INTO hr_qualification_rules (name, kind, grant_scope, qual_level, notes, auto_created)
     VALUES ($1, 'Skill Test', 'occupations', $2, $3, TRUE) RETURNING id`,
    [name, level, 'Added from an NSTB certificate in the trainer pool.']);
  await client.query(
    `INSERT INTO hr_rule_occupations (rule_id, occupation_id, levels, main_levels)
     VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
    [rule.id, occ.id, co.length ? co : null, main.length ? main : null]);
  return rule.id;
}

/**
 * The occupation for a certificate's trade at the certificate's own level: a
 * Level 1 Tailor certificate belongs to "Tailor · Level 1", not "Tailor · Level 2".
 * Created (same name and sector) when the trade has no row at that level yet.
 * Trades listed without a ladder level, and Technician certificates, stay as they are.
 */
async function occupationAtLevel(client, occupationId, level) {
  if (!occupationId || !LADDER.includes(level)) return occupationId;
  const { rows: [occ] } = await client.query('SELECT id, name, sector, level FROM occupations WHERE id = $1', [occupationId]);
  if (!occ || !LADDER.includes(occ.level) || occ.level === level) return occupationId;
  const { rows: [same] } = await client.query(
    `SELECT id FROM occupations WHERE is_active AND lower(btrim(name)) = lower(btrim($1)) AND level = $2
      ORDER BY id LIMIT 1`, [occ.name, level]);
  if (same) return same.id;
  const { rows: [made] } = await client.query(
    `INSERT INTO occupations (name, sector, level, is_custom) VALUES ($1, $2, $3, TRUE) RETURNING id`,
    [occ.name, occ.sector, level]);
  return made.id;
}

/** Link every vocational certificate saved before this existed. Idempotent. */
async function backfillVocationalRules(pool) {
  // Certificates on a merged or deleted trade: onto the trade it was merged
  // into, else an active one of the same name (same level first).
  const moved = await pool.query(`
    UPDATE hr_qualifications q SET occupation_id = sub.to_id, rule_id = NULL
      FROM (SELECT q2.id, COALESCE(
                     (SELECT m.id FROM occupations m WHERE m.id = o.merged_into AND m.is_active),
                     (SELECT a.id FROM occupations a WHERE a.is_active AND lower(btrim(a.name)) = lower(btrim(o.name))
                       ORDER BY (a.level IS NOT DISTINCT FROM q2.level) DESC, a.id LIMIT 1)) AS to_id
              FROM hr_qualifications q2 JOIN occupations o ON o.id = q2.occupation_id AND NOT o.is_active) sub
     WHERE q.id = sub.id AND sub.to_id IS NOT NULL`);
  if (moved.rowCount) console.log(`Moved ${moved.rowCount} certificate(s) off merged/deleted trades`);
  const { rows: [left] } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM hr_qualifications q JOIN occupations o ON o.id = q.occupation_id WHERE NOT o.is_active`);
  if (left.n) console.log(`${left.n} certificate(s) still on a deleted trade with no active match`);

  // Certificates whose trade was deleted out from under them (the link is
  // cleared): the title still names it — "Level 1 — Tailor" — so relink by name.
  const { rows: lost } = await pool.query(
    `SELECT id, level, title FROM hr_qualifications
      WHERE stream = 'Vocational' AND occupation_id IS NULL AND coalesce(btrim(title), '') <> ''`);
  const unmatched = new Map();
  let relinked = 0;
  for (const q of lost) {
    const trade = (q.title.includes(' — ') ? q.title.slice(q.title.indexOf(' — ') + 3) : q.title).trim();
    const { rows: [named] } = await pool.query(
      `SELECT id FROM occupations WHERE is_active AND lower(btrim(name)) = lower($1)
        ORDER BY (level IS NOT DISTINCT FROM $2) DESC, id LIMIT 1`, [trade, q.level]);
    if (!named) { unmatched.set(trade, (unmatched.get(trade) || 0) + 1); continue; }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const occ = await occupationAtLevel(client, named.id, q.level);
      await client.query('UPDATE hr_qualifications SET occupation_id = $1, rule_id = NULL WHERE id = $2', [occ, q.id]);
      await client.query('COMMIT');
      relinked++;
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  }
  if (relinked) console.log(`Relinked ${relinked} certificate(s) that had lost their trade`);
  if (unmatched.size) {
    console.log(`Certificates with no trade and no matching occupation: ${
      [...unmatched].map(([t, n]) => `${t} (${n})`).join('; ')}`);
  }

  // Certificates linked to their trade at another level: move them to their own.
  const { rows: offLevel } = await pool.query(
    `SELECT q.id, q.occupation_id, q.level FROM hr_qualifications q JOIN occupations o ON o.id = q.occupation_id
      WHERE q.stream = 'Vocational' AND q.level = ANY($1) AND o.level = ANY($1) AND o.level <> q.level`, [LADDER]);
  for (const q of offLevel) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const occ = await occupationAtLevel(client, q.occupation_id, q.level);
      await client.query('UPDATE hr_qualifications SET occupation_id = $1, rule_id = NULL WHERE id = $2', [occ, q.id]);
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  }
  const { rows } = await pool.query(
    `SELECT id, occupation_id, level FROM hr_qualifications
      WHERE rule_id IS NULL AND stream = 'Vocational' AND occupation_id IS NOT NULL AND level IS NOT NULL`);
  let linked = 0;
  for (const q of rows) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const ruleId = await vocationalRuleFor(client, q.occupation_id, q.level);
      if (ruleId) { await client.query('UPDATE hr_qualifications SET rule_id = $1 WHERE id = $2', [ruleId, q.id]); linked++; }
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  }
  return linked;
}

module.exports = { occupationAtLevel, vocationalRuleFor, backfillVocationalRules, levelsFor, ruleName };

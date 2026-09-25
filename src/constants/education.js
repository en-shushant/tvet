/**
 * The two ladders a qualification can sit on.
 *
 * General education is the school-and-university ladder a tender states its
 * minimum against ("Master's degree", "+2"). Vocational is the National Skill
 * Testing Board's: Level 1 to 3, Level 4 (Professional), and technician
 * certificates. They are separate because they measure different things — a
 * Building Electrician Level 2 says nothing about whether its holder went to
 * college — so a person's record keeps each on its own ladder rather than
 * forcing one onto the other.
 */

/**
 * General education, lowest first.
 *
 * `rank` is what a tender's minimum is compared on. SLC, TSLC and JTA share a
 * rank: notices ask for "SLC/TSLC", and a JTA is the agriculture TSLC. MPhil and
 * PhD are separate rungs now; the old combined value is still read (below).
 */
export const GENERAL_LEVELS = [
  { value: 'SLC/SEE', label: 'SLC / SEE', rank: 0 },
  // CTEVT now calls the TSLC a Pre-Diploma; notices use either name.
  { value: 'TSLC', label: 'TSLC / Pre-Diploma', rank: 0 },
  { value: 'JTA', label: 'JTA', rank: 0 },
  { value: '+2/HSEB', label: '+2 / HSEB', rank: 1 },
  { value: 'Diploma', label: 'Diploma / PCL', rank: 2 },
  { value: 'Bachelor', label: 'Bachelor', rank: 3 },
  { value: 'Master', label: 'Master', rank: 4 },
  { value: 'MPhil', label: 'MPhil', rank: 5 },
  { value: 'PhD', label: 'PhD', rank: 6 },
];
/** Values saved before the ladder was split, still ranked rather than dropped. */
const LEGACY_RANKS = { 'MPhil/PhD': 5 };

/** The general ladder's values, in order — what a tender's minimum picks from. */
export const EDUCATION_LEVELS = GENERAL_LEVELS.map(l => l.value);

/**
 * The NSTB ladder. Stored in the qualification's `level` column, whose values
 * the occupation eligibility rules already rank — so Level 4 keeps its stored
 * name, "Professional", and only its label says Level 4.
 */
export const VOCATIONAL_LEVELS = [
  { value: 'Level 1', label: 'Level 1' },
  { value: 'Level 2', label: 'Level 2' },
  { value: 'Level 3', label: 'Level 3' },
  { value: 'Professional', label: 'Level 4 (Professional)' },
  { value: 'Technician', label: 'Technician certificate' },
];

/**
 * NSTB levels in order, so a higher certificate satisfies a lower requirement
 * ("or equivalent"). A technician certificate is its own thing, not a rung,
 * and satisfies only a requirement for one.
 */
const VOCATIONAL_RANK = { 'Level 1': 1, 'Level 2': 2, 'Level 3': 3, Professional: 4 };
export function vocationalMeets(held, needed) {
  if (!held || !needed) return false;
  if (needed === 'Technician' || held === 'Technician') return held === needed;
  return (VOCATIONAL_RANK[held] || 0) >= (VOCATIONAL_RANK[needed] || 99);
}

export const labelOfGeneral = (v) => GENERAL_LEVELS.find(l => l.value === v)?.label || v || '';
export const labelOfVocational = (v) => VOCATIONAL_LEVELS.find(l => l.value === v)?.label || v || '';

/**
 * Guess the general level from a degree's title.
 *
 * Every row entered before the ladder existed has only free text. Rather than
 * treat all of them as unqualified — which would quietly exclude the existing
 * pool from every requirement — the title is read. A stated level always wins.
 *
 * Highest first: "Master of Science in Civil Engineering" contains "science"
 * and "civil" too, and the highest claim in the string decides. TSLC comes
 * before SLC so the one is never read as the other.
 */
const TITLE_HINTS = [
  ['PhD',      /\b(ph\.?\s?d|doctor(ate|al)?)\b/i],
  ['MPhil',    /\bm\.?\s?phil\b/i],
  ['Master',   /\b(master|m\.?\s?sc|m\.?\s?a\b|m\.?\s?e\b|m\.?\s?tech|m\.?\s?b\.?\s?a|msc|mba)\b/i],
  ['Bachelor', /\b(bachelor|b\.?\s?sc|b\.?\s?a\b|b\.?\s?e\b|b\.?\s?tech|b\.?\s?b\.?\s?a|bsc|bba|be\b)\b/i],
  ['TSLC',     /\bpre[- ]?diploma\b/i],
  ['Diploma',  /\b(diploma|overseer|sub[- ]?engineer|proficiency certificate|p\.?\s?c\.?\s?l)\b/i],
  // No \b before the plus: a word boundary needs a word character on one side,
  // and "+2 Science" starts with the plus, so \b never matched it.
  ['+2/HSEB',  /(\+\s?2\b|\b(hseb|neb|higher secondary|intermediate|i\.?\s?sc|12th|class 12)\b)/i],
  ['TSLC',     /\b(t\.?\s?s\.?\s?l\.?\s?c|technical school leaving|pre[- ]?diploma)\b/i],
  ['JTA',      /\b(j\.?\s?t\.?\s?a|junior technical assistant)\b/i],
  ['SLC/SEE',  /\b(s\.?\s?l\.?\s?c|see|school leaving|10th|class 10)\b/i],
];

/** The rank of a general level, or -1 when it is blank or unrecognised. */
export function educationRank(level) {
  const v = String(level || '').trim();
  const hit = GENERAL_LEVELS.find(l => l.value === v);
  if (hit) return hit.rank;
  return v in LEGACY_RANKS ? LEGACY_RANKS[v] : -1;
}

/**
 * Which ladder a qualification is on.
 *
 * Stated if it has one. Otherwise worked out the way the rows were entered
 * before the toggle existed: a "Skill Test" row, or an academic row carrying
 * an NSTB level and no degree level, was a vocational certificate.
 */
export function streamOf(q) {
  if (!q) return null;
  if (q.stream === 'General' || q.stream === 'Vocational') return q.stream;
  if (q.kind === 'Skill Test') return 'Vocational';
  if (q.kind && q.kind !== 'Academic') return null;
  return q.level && !q.education_level ? 'Vocational' : 'General';
}

/** The general level a qualification stands at — stated, else inferred. Never a vocational one. */
export function levelOfQualification(q) {
  if (!q || streamOf(q) === 'Vocational') return '';
  const stated = String(q.education_level || '').trim();
  if (educationRank(stated) >= 0) return stated;
  const title = String(q.title || '');
  for (const [level, re] of TITLE_HINTS) if (re.test(title)) return level;
  return '';
}

/**
 * Which NSTB levels a qualification lets someone train, as a starting point a
 * rule can then adjust. A skill certificate teaches its own level and below
 * (Level 2 → 1 and 2). For general education the usual CTEVT trainer norms:
 * SLC/SEE → Level 1; TSLC, JTA, +2 → up to 2; Diploma → up to 3;
 * Bachelor and above → up to 4.
 */
const TEACH_UP_TO_GENERAL = { 'SLC/SEE': 1, TSLC: 2, JTA: 2, '+2/HSEB': 2, Diploma: 3,
  Bachelor: 4, Master: 4, MPhil: 4, PhD: 4 };
const TEACH_UP_TO_VOCATIONAL = { 'Level 1': 1, 'Level 2': 2, 'Level 3': 3, Professional: 4, Technician: 2 };
const LADDER = ['Level 1', 'Level 2', 'Level 3', 'Professional'];
export function teachableLevels(kind, level) {
  const n = (kind === 'Skill Test' ? TEACH_UP_TO_VOCATIONAL : kind === 'Academic' ? TEACH_UP_TO_GENERAL : {})[level] || 0;
  return LADDER.slice(0, n);
}

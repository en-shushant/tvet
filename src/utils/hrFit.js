/**
 * Whether someone in the pool meets what a tender asks of a position.
 *
 * Experience is counted from the year the qualifying degree was passed to
 * today, which is how the notices state it ("Bachelor's degree with 7 years'
 * experience") and how the evaluator will read it. It is not read from the
 * person's listed jobs: those record what they did, with gaps, and no notice
 * asks for the sum of employed months.
 */
import { getNepaliDate } from '../constants/nepali.js';
import { educationRank, levelOfQualification, streamOf, vocationalMeets,
         labelOfGeneral, labelOfVocational } from '../constants/education.js';

/** The BS year we are in now, which is what passed years are stated in. */
export function currentBSYear() {
  return getNepaliDate().bs.y;
}

/**
 * Read a passed year as BS.
 *
 * The pool asks for it in BS and labels the field so, but a record typed as AD
 * would otherwise read as a career of minus fifty years. The two calendars are
 * 56–57 apart and no one in the pool passed a degree after the current BS year,
 * so anything far below it is an AD year and is converted rather than believed.
 */
export function passedYearBS(raw, nowBS = currentBSYear()) {
  const y = parseInt(String(raw ?? '').trim(), 10);
  if (!Number.isInteger(y)) return null;
  if (y >= 1900 && y <= 2100 && y < nowBS - 40) return y + 57;
  if (y < 1900 || y > nowBS) return null;
  return y;
}

/** Academic qualifications only, newest ladder rank first. */
function academics(person) {
  return (person?.qualifications || person?.academics || [])
    .filter(q => !q.kind || q.kind === 'Academic')
    .map(q => ({ ...q, level: levelOfQualification(q), rank: educationRank(levelOfQualification(q)) }))
    .filter(q => q.rank >= 0);
}

/** The highest academic level this person holds, blank if none is readable. */
export function highestEducation(person) {
  const best = academics(person).sort((a, b) => b.rank - a.rank)[0];
  return best ? best.level : '';
}

/**
 * Years since qualifying, counted to today.
 *
 * When the position names a minimum level, the clock starts at the *earliest*
 * degree that already meets it — someone who took a Master's on top of a
 * qualifying Bachelor's does not lose the years in between. With no minimum
 * stated, it runs from their earliest academic record.
 */
export function experienceYears(person, minLevel = '', nowBS = currentBSYear()) {
  const need = educationRank(minLevel);
  const years = academics(person)
    .filter(q => need < 0 || q.rank >= need)
    .map(q => passedYearBS(q.passed_year, nowBS))
    .filter(y => Number.isInteger(y));
  if (!years.length) return null;
  return nowBS - Math.min(...years);
}

/**
 * The alternatives a post accepts, in the shape the notice states them.
 *
 * Posts saved before alternatives existed carry one general minimum; that reads
 * as a single alternative, so both kinds of post are checked the same way.
 */
export function acceptedOf(position) {
  const alts = Array.isArray(position?.education_options) ? position.education_options.filter(a => a?.any?.length) : [];
  if (alts.length) return alts;
  return position?.min_education
    ? [{ any: [{ ladder: 'general', level: position.min_education, related: false }], min_years: null }]
    : [];
}

/** One accepted qualification, as a notice would print it. */
export const describeOption = (o) => o.ladder === 'vocational'
  ? `NSTB ${labelOfVocational(o.level)}`
  : `${labelOfGeneral(o.level)}${o.related ? ' in related subject' : ''}`;

/** The whole requirement on one line: "Diploma / PCL … or NSTB Level 3 — OR — …". */
export function describeAccepted(position) {
  return acceptedOf(position).map(a => a.any.map(describeOption).join(' or ')
    + (a.min_years ? ` + ${a.min_years} yrs` : '')).join(' — OR — ');
}

/**
 * The passed years of every qualification this person holds that meets one option.
 *
 * "Or equivalent" is read as "or higher on the same ladder": a Bachelor meets a
 * Diploma, a Level 3 meets a Level 2. "In related subject" is read against the
 * post's trade — an NSTB certificate must name it; a degree must be one the
 * rules count towards it, which is what the person's eligible trades say.
 */
function holdingsFor(person, option, occupationId) {
  const quals = person?.qualifications || person?.academics || [];
  const related = option.related && occupationId;
  if (option.ladder === 'vocational') {
    return quals.filter(q => streamOf(q) === 'Vocational' && vocationalMeets(q.level, option.level)
      && (!related || String(q.occupation_id || '') === String(occupationId)));
  }
  const need = educationRank(option.level);
  if (related && !(person?.eligible_occupations || []).some(o => String(o.id) === String(occupationId))) return [];
  return quals.filter(q => streamOf(q) === 'General' && educationRank(levelOfQualification(q)) >= need);
}

/** How one alternative stands for this person: whether any option is held, and the years since. */
function checkAlternative(person, alt, position, nowBS) {
  const held = alt.any.flatMap(o => holdingsFor(person, o, position.occupation_id));
  const years = held.map(q => passedYearBS(q.passed_year, nowBS)).filter(Number.isInteger);
  const since = years.length ? nowBS - Math.min(...years) : null;
  const want = parseInt(alt.min_years ?? position.min_experience_years, 10);
  const needsYears = Number.isInteger(want) && want > 0;
  return { holds: held.length > 0, since, want: needsYears ? want : null,
           ok: held.length > 0 && (!needsYears || (since !== null && since >= want)) };
}

/**
 * Check a person against one position's stated minimums.
 *
 * Returns every reason they fall short rather than a bare boolean, because the
 * screen has to say why somebody cannot be put in a slot — "no Master's on
 * record" and "6 of 10 years" are different problems with different fixes.
 */
export function checkAgainstPosition(person, position, nowBS = currentBSYear()) {
  const reasons = [];
  if (!position) return { ok: true, reasons, years: experienceYears(person, '', nowBS) };

  // Any one alternative is enough. Only when none is met are reasons given,
  // and they describe the nearest miss: holding the qualification but short
  // on years is a different problem from not holding it at all.
  const alts = acceptedOf(position);
  let years = experienceYears(person, '', nowBS);
  let held = highestEducation(person);
  if (alts.length) {
    const results = alts.map(a => checkAlternative(person, a, position, nowBS));
    const pass = results.find(r => r.ok);
    if (pass) years = pass.since ?? years;
    else {
      const near = results.filter(r => r.holds).sort((a, b) => (b.since ?? -1) - (a.since ?? -1))[0];
      if (near) {
        reasons.push(near.since === null ? `no passed year on record, needs ${near.want} years`
                                         : `${near.since} of ${near.want} years`);
        years = near.since;
      } else if (alts.length === 1 && alts[0].any.length === 1 && alts[0].any[0].ladder === 'general') {
        // The plain single-minimum case keeps its plain message.
        const lvl = alts[0].any[0].level;
        reasons.push(held ? `holds ${held}, needs ${lvl}` : `no ${lvl} on record`);
      } else {
        reasons.push(`needs ${describeAccepted(position)}`);
      }
    }
  } else {
    const wantYears = parseInt(position.min_experience_years, 10);
    if (Number.isInteger(wantYears) && wantYears > 0) {
      if (years === null) reasons.push(`no passed year on record, needs ${wantYears} years`);
      else if (years < wantYears) reasons.push(`${years} of ${wantYears} years`);
    }
  }

  const wantTraining = String(position.required_training || '').trim();
  if (wantTraining) {
    const hay = (person?.qualifications || person?.academics || [])
      .map(q => `${q.title || ''} ${q.kind || ''}`.toLowerCase()).join(' | ');
    // Match on any word of substance so "Computer training" finds "Basic
    // Computer Application", which is how the certificates are actually titled.
    const words = wantTraining.toLowerCase().split(/[^a-z0-9+]+/i)
      .filter(w => w.length > 2 && !['and', 'the', 'training', 'certificate'].includes(w));
    const found = words.length ? words.some(w => hay.includes(w)) : hay.includes(wantTraining.toLowerCase());
    if (!found) reasons.push(`no ${wantTraining} on record`);
  }

  return { ok: reasons.length === 0, reasons, years, held };
}

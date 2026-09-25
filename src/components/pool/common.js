/**
 * The pool's shared vocabulary, and the summaries both the list and a person's
 * profile read off a record.
 */
import { streamOf, levelOfQualification, educationRank, labelOfGeneral,
         labelOfVocational, VOCATIONAL_LEVELS } from '../../constants/education.js';
import { BS_YEARS, bsToAD } from '../../constants/nepali.js';

export const PERSON_TYPES = ['Trainer', 'Support Staff'];
export const TRAINING_KINDS = ['Training', 'TOT'];
export const DOC_TYPES = ['CV', 'Citizenship', 'Academic Certificate', 'Training Certificate',
  'TOT Certificate', 'Skill Test Certificate', 'Experience Letter', 'Other'];
export const FLUENCY = ['Excellent', 'Good', 'Fair', 'Basic'];

export const BLANK_PERSON = {
  person_type: 'Trainer', full_name: '', full_name_np: '', father_name: '', grandfather_name: '',
  citizenship_no: '', citizenship_district: '', date_of_birth: '', gender: '', phone: '', email: '',
  permanent_address: '', temporary_address: '', designation: '', remarks: '', is_active: true,
  profession: '', nationality: 'Nepali', years_with_entity: '', professional_memberships: '',
  key_qualifications: '',
  qualifications: [], experience: [], occupation_overrides: [], languages: [],
};

const baseQual = { rule_id: '', title: '', institution: '', board: '', occupation_id: '', level: '',
  education_level: '', passed_year: '', duration_hours: '', division: '', certificate_no: '',
  remarks: '', specialisation: '', duration_text: '' };
export const emptyGeneral = (education_level = '') =>
  ({ ...baseQual, kind: 'Academic', stream: 'General', education_level });
// The testing board is almost always the NSTB, so it is filled in rather than asked.
export const emptyVocational = (level = '') =>
  ({ ...baseQual, kind: 'Academic', stream: 'Vocational', level, board: 'NSTB' });
// A TOT is almost always titled exactly this, so it starts there.
export const TOT_TITLE = 'Training of Trainers';
export const emptyTraining = (kind = 'Training') =>
  ({ ...baseQual, kind, title: kind === 'TOT' ? TOT_TITLE : '', start_date: '', end_date: '', duration_days: '' });
export const emptyExp = () => ({ organisation: '', position: '', occupation_id: '',
  from_date: '', to_date: '', is_current: false, description: '',
  country: '', project_name: '', reference_text: '' });
export const emptyLang = () => ({ language: '', speaking: '', reading: '', writing: '' });
/** Every CV here lists these two; other languages are added when someone has them. */
export const DEFAULT_LANGUAGES = () => [
  { language: 'Nepali', speaking: 'Excellent', reading: 'Excellent', writing: 'Excellent' },
  { language: 'English', speaking: 'Good', reading: 'Good', writing: 'Good' },
];

/**
 * A BS date as it is typed: digits only, slashes put in for you.
 * "20580911" and "2058/9/11" both become "2058/09/11" once complete.
 */
export function maskBsDate(raw) {
  const v = String(raw || '');
  // A complete date with single-digit parts is padded rather than re-read.
  const parts = v.split('/');
  if (parts.length === 3 && parts[0].length === 4 && parts[1] && parts[2] && parts.every(p => /^\d+$/.test(p))) {
    return `${parts[0]}/${parts[1].padStart(2, '0').slice(-2)}/${parts[2].padStart(2, '0').slice(-2)}`;
  }
  const d = v.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 4) return d;
  if (d.length <= 6) return `${d.slice(0, 4)}/${d.slice(4)}`;
  return `${d.slice(0, 4)}/${d.slice(4, 6)}/${d.slice(6)}`;
}

/** Whether a BS date string is complete and plausible: YYYY/MM/DD, month 1–12, day 1–32. */
export function isBsDate(v) {
  const m = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(String(v || ''));
  if (!m) return false;
  const mo = +m[2], d = +m[3];
  return mo >= 1 && mo <= 12 && d >= 1 && d <= 32;
}

/**
 * Days from start to end, inclusive — or null when it cannot be known.
 *
 * Counting BS days needs each month's length for that year, and the app's
 * calendar table only covers the years it lists. Outside them the converter
 * guesses, so rather than print a count that may be days out, this returns
 * null and the form asks for the number instead.
 */
export function bsDaysBetween(start, end) {
  if (!isBsDate(start) || !isBsDate(end)) return null;
  const [ys, ms, ds] = start.split('/').map(Number);
  const [ye, me, de] = end.split('/').map(Number);
  const lo = Math.min(...BS_YEARS), hi = Math.max(...BS_YEARS);
  if (ys < lo || ye > hi) return null;
  const a = Date.parse(bsToAD(ys, ms, ds)), b = Date.parse(bsToAD(ye, me, de));
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return null;
  return Math.round((b - a) / 86400000) + 1;
}

/** "21 days, 2076/04/01 – 2076/04/21" — what the CV prints for a TOT. */
export function totDuration(q) {
  const days = parseInt(q.duration_days, 10);
  const span = [q.start_date, q.end_date].filter(Boolean).join(' – ');
  return [Number.isInteger(days) && days > 0 ? `${days} day${days === 1 ? '' : 's'}` : '', span].filter(Boolean).join(', ');
}

/** Which list a qualification belongs to on screen: general, vocational or training. */
export const sectionOf = (q) => {
  const s = streamOf(q);
  return s === 'Vocational' ? 'vocational' : s === 'General' ? 'general' : 'training';
};

export const initials = (name = '') => name.trim().split(/\s+/).filter(Boolean)
  .slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';

/** The highest general qualification, e.g. "Master · 2065", or ''. */
export function topGeneral(person) {
  const best = (person?.qualifications || [])
    .filter(q => sectionOf(q) === 'general')
    .map(q => ({ q, level: levelOfQualification(q) }))
    .filter(x => educationRank(x.level) >= 0)
    .sort((a, b) => educationRank(b.level) - educationRank(a.level))[0];
  if (!best) return '';
  return [labelOfGeneral(best.level), best.q.passed_year].filter(Boolean).join(' · ');
}

/** The highest NSTB certificate, e.g. "Level 2 · Plumber", or ''. */
export function topVocational(person) {
  const order = VOCATIONAL_LEVELS.map(l => l.value);
  const best = (person?.qualifications || [])
    .filter(q => sectionOf(q) === 'vocational' && q.level)
    .sort((a, b) => order.indexOf(b.level) - order.indexOf(a.level))[0];
  if (!best) return '';
  return [labelOfVocational(best.level), best.occupation_name].filter(Boolean).join(' · ');
}

/**
 * What a qualification row is saved as.
 *
 * The toggle decides the ladder, so each stream only asks what it needs — and
 * the title a CV prints is filled in from the choices when nobody typed one,
 * rather than printing a blank course line.
 */
export function normaliseQual(q, occupations = []) {
  const out = { ...q, rule_id: q.rule_id || null, occupation_id: q.occupation_id || null,
    duration_hours: q.duration_hours || null };
  const section = sectionOf(q);
  if (section === 'general') {
    out.kind = 'Academic'; out.stream = 'General'; out.level = q.level || null;
    out.education_level = q.education_level || levelOfQualification(q) || null;
    out.title = String(q.title || '').trim() || labelOfGeneral(out.education_level);
  } else if (section === 'vocational') {
    out.kind = 'Academic'; out.stream = 'Vocational'; out.education_level = null;
    const trade = occupations.find(o => String(o.id) === String(q.occupation_id))?.name;
    out.board = String(q.board || '').trim() || 'NSTB';
    out.title = String(q.title || '').trim()
      || [labelOfVocational(q.level), trade].filter(Boolean).join(' — ');
  } else {
    out.stream = null;
    if (q.kind === 'TOT') {
      out.title = String(q.title || '').trim() || TOT_TITLE;
      // The dates decide the rest: the year counted for experience, and the
      // duration the Form 5 CV prints.
      if (isBsDate(q.end_date)) out.passed_year = q.end_date.slice(0, 4);
      const auto = bsDaysBetween(q.start_date, q.end_date);
      out.duration_days = auto ?? (parseInt(q.duration_days, 10) || null);
      out.duration_text = totDuration(out) || q.duration_text || '';
    }
  }
  return out;
}

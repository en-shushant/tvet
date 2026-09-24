/**
 * The pool's shared vocabulary, and the summaries both the list and a person's
 * profile read off a record.
 */
import { streamOf, levelOfQualification, educationRank, labelOfGeneral,
         labelOfVocational, VOCATIONAL_LEVELS } from '../../constants/education.js';

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
export const emptyTraining = (kind = 'Training') => ({ ...baseQual, kind });
export const emptyExp = () => ({ organisation: '', position: '', occupation_id: '',
  from_date: '', to_date: '', is_current: false, description: '',
  country: '', project_name: '', reference_text: '' });
export const emptyLang = () => ({ language: '', speaking: '', reading: '', writing: '' });

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
  }
  return out;
}

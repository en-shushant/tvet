import { describe, it, expect } from 'vitest';
import { fitsTrainerLevel, rankNeededFor } from '../src/utils/hrFit.js';

const occ = [
  { id: 1, name: 'Plumber', level: 'Level 1' }, { id: 2, name: 'Plumber', level: 'Level 2' },
  { id: 3, name: 'Plumber', level: 'Level 3' }, { id: 9, name: 'Shoe Maker', level: 'Level 1' },
];
const holder = (...ids) => ({ eligible_occupations: occ.filter(o => ids.includes(o.id)) });
const plumberL2 = holder(1, 2);            // a Level 2 certificate reaches Levels 1 and 2

describe('trainer level by role', () => {
  it('Level 2 is main trainer for Level 1', () => {
    expect(fitsTrainerLevel(plumberL2, occ[0], occ, 'Main Trainer')).toBe(true);
  });
  it('Level 2 is co-trainer for Level 2 but not main trainer for it', () => {
    expect(fitsTrainerLevel(plumberL2, occ[1], occ, 'Co-Trainer')).toBe(true);
    expect(fitsTrainerLevel(plumberL2, occ[1], occ, 'Main Trainer')).toBe(false);
  });
  it('Level 1 can only co-train Level 1', () => {
    const l1 = holder(1);
    expect(fitsTrainerLevel(l1, occ[0], occ, 'Co-Trainer')).toBe(true);
    expect(fitsTrainerLevel(l1, occ[0], occ, 'Main Trainer')).toBe(false);
  });
  it('a trade with only Level 1 takes Level 1 for main and co', () => {
    expect(rankNeededFor(occ[3], occ, true)).toBe(1);
    expect(fitsTrainerLevel(holder(9), occ[3], occ, 'Main Trainer')).toBe(true);
    expect(fitsTrainerLevel(holder(9), occ[3], occ, 'Instructor')).toBe(true);
  });
  it('the top level of a trade is main-trained at that level', () => {
    expect(rankNeededFor(occ[2], occ, true)).toBe(3);
  });
});

import { criteriaChecks } from '../src/utils/hrFit.js';
describe('picker criteria', () => {
  it('lists each minimum with whether it is met', () => {
    const person = { qualifications: [{ kind: 'Academic', stream: 'General', education_level: 'Bachelor', passed_year: '2070', title: 'BBS' },
      { kind: 'Training', title: 'Basic Computer Application' }] };
    const pos = { title: 'Database Officer', min_education: '+2/HSEB', min_experience_years: 3, required_training: 'Computer training' };
    const c = criteriaChecks(person, pos, [], 2083);
    expect(c.map(x => [x.key, x.ok])).toEqual([['edu', true], ['yrs', true], ['trn-Computer training', true]]);
    const none = criteriaChecks({}, pos, [], 2083);
    expect(none.every(x => !x.ok)).toBe(true);
  });
  it('shows the trade level a main trainer needs', () => {
    const c = criteriaChecks(plumberL2, { title: 'Main Trainer', occupation_id: 1 }, occ);
    expect(c[0]).toMatchObject({ key: 'occ', label: 'Plumber Level 2+', ok: true });
  });
});

import { teachableByRole } from '../src/constants/education.js';
describe('main trainer and co-trainer levels', () => {
  it('fills co-trainer with every level covered and main trainer one below the top', () => {
    expect(teachableByRole('Academic', 'Diploma')).toEqual({ main: ['Level 1', 'Level 2'], co: ['Level 1', 'Level 2', 'Level 3'] });
    expect(teachableByRole('Skill Test', 'Level 2')).toEqual({ main: ['Level 1'], co: ['Level 1', 'Level 2'] });
    expect(teachableByRole('Academic', 'SLC/SEE')).toEqual({ main: ['Level 1'], co: ['Level 1'] });
  });
  it('lets a rule name someone main trainer outright', () => {
    const person = { eligible_occupations: occ.filter(o => o.id === 2), main_occupations: [2] };
    // Holding only Level 2 would not make them main trainer for Level 2; the rule does.
    expect(fitsTrainerLevel(person, occ[1], occ, 'Main Trainer')).toBe(true);
    expect(fitsTrainerLevel({ ...person, main_occupations: [] }, occ[1], occ, 'Main Trainer')).toBe(false);
  });
});

import { checkAgainstPosition, requiredTrainings, requiresTot } from '../src/utils/hrFit.js';
describe('a TOT required by a post', () => {
  const post = { title: 'Main Trainer', required_training: 'TOT' };
  const withTot = { qualifications: [{ kind: 'TOT', title: 'Training of Trainers' }] };
  const lookalike = { qualifications: [{ kind: 'Training', title: 'Total Station Survey' }] };

  it('is a TOT record, not any title that happens to contain "tot"', () => {
    expect(checkAgainstPosition(withTot, post).ok).toBe(true);
    const r = checkAgainstPosition(lookalike, post);
    expect(r.ok).toBe(false);
    expect(r.reasons).toContain('no TOT on record');
    expect(checkAgainstPosition({ qualifications: [] }, post).reasons).toContain('no TOT on record');
  });
  it('sits beside other required trainings, separated by commas', () => {
    const both = { title: 'Database Officer', required_training: 'TOT, Computer training' };
    expect(requiredTrainings(both)).toEqual(['TOT', 'Computer training']);
    expect(requiresTot(both)).toBe(true);
    const person = { qualifications: [{ kind: 'TOT' }, { kind: 'Training', title: 'Basic Computer Application' }] };
    expect(checkAgainstPosition(person, both).ok).toBe(true);
    expect(checkAgainstPosition(withTot, both).reasons).toEqual(['no Computer training on record']);
    expect(requiresTot({ required_training: 'Computer training' })).toBe(false);
  });
});

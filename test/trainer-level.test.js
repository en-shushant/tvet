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
    expect(c.map(x => [x.key, x.ok])).toEqual([['edu', true], ['yrs', true], ['trn', true]]);
    const none = criteriaChecks({}, pos, [], 2083);
    expect(none.every(x => !x.ok)).toBe(true);
  });
  it('shows the trade level a main trainer needs', () => {
    const c = criteriaChecks(plumberL2, { title: 'Main Trainer', occupation_id: 1 }, occ);
    expect(c[0]).toMatchObject({ key: 'occ', label: 'Plumber Level 2+', ok: true });
  });
});

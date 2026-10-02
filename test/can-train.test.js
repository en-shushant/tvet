import { describe, it, expect } from 'vitest';
import { canTrainByTrade } from '../src/utils/hrFit.js';

const occ = (id, name, level) => ({ id, name, level });
const all = [occ(1, 'Beautician', 'Level 1'), occ(2, 'Beautician', 'Level 2'), occ(3, 'Beautician', 'Level 3'), occ(4, 'Tailor', null)];

describe('can train, by trade and role', () => {
  it('a Level 2 holder is co-trainer at 1–2 and main trainer at 1', () => {
    const p = { eligible_occupations: [all[0], all[1], all[3]] };
    expect(canTrainByTrade(p, all)).toEqual([
      { name: 'Beautician', levelled: true, main: ['Level 1'], co: ['Level 1', 'Level 2'] },
      { name: 'Tailor', levelled: false, main: [], co: [] },
    ]);
  });
  it('a rule granting main trainer at a level decides the main levels for that trade', () => {
    const p = { eligible_occupations: [all[0], all[1]], main_occupations: [2] };
    expect(canTrainByTrade(p, all)[0].main).toEqual(['Level 2']);
  });
  it('the top level of a trade can be led by someone holding it', () => {
    const p = { eligible_occupations: [all[0], all[1], all[2]] };
    expect(canTrainByTrade(p, all)[0].main).toEqual(['Level 1', 'Level 2', 'Level 3']);
  });
});

describe('a rule naming main-trainer levels wins over the fallback', () => {
  const tailor = [{ id: 11, name: 'Tailor', level: 'Level 1' }, { id: 12, name: 'Tailor', level: 'Level 2' }];
  it('Tailor Level 2 marked main at Level 1 only is not main at Level 2', () => {
    const p = { eligible_occupations: tailor, main_occupations: [11] };
    expect(canTrainByTrade(p, tailor)[0]).toMatchObject({ main: ['Level 1'], co: ['Level 1', 'Level 2'] });
  });
  it('without a rule, the top level a trade has can still be led by its holder', () => {
    const p = { eligible_occupations: tailor, main_occupations: [] };
    expect(canTrainByTrade(p, tailor)[0].main).toEqual(['Level 1', 'Level 2']);
  });
});

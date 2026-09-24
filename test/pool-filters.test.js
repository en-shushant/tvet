/**
 * Narrowing the pool, and the numbers that describe it.
 */
import { describe, it, expect } from 'vitest';
import { applyFilters, poolKpis, activeFilterCount, BLANK_FILTERS, SORTS } from '../src/components/pool/filters.js';

const NOW = 2082;
const gen = (level, year) => ({ kind: 'Academic', stream: 'General', education_level: level, passed_year: year });
const nstb = (level, occ) => ({ kind: 'Academic', stream: 'Vocational', level, occupation_id: occ, passed_year: '2074' });
const tot = { kind: 'TOT', title: 'Training of Trainers', passed_year: '2076' };

const people = [
  { id: 1, full_name: 'Bikash Thapa', person_type: 'Trainer', citizenship_no: '27-01-72-001', is_active: true,
    qualifications: [gen('Diploma', '2069'), tot], doc_types: ['CV', 'Citizenship'],
    eligible_occupations: [{ id: 11, name: 'Plumber' }, { id: 12, name: 'Mason' }] },
  { id: 2, full_name: 'Gita Tamang', person_type: 'Trainer', is_active: true,
    qualifications: [gen('TSLC', '2068'), nstb('Level 2', 11)], doc_types: ['CV'],
    eligible_occupations: [{ id: 11, name: 'Plumber' }] },
  { id: 3, full_name: 'Sita Karki', person_type: 'Trainer', is_active: true,
    qualifications: [gen('Master', '2079')], doc_types: [],
    eligible_occupations: [{ id: 13, name: 'Assistant Tailor' }] },
  { id: 4, full_name: 'Hari Bahadur', person_type: 'Support Staff', is_active: true,
    qualifications: [], doc_types: ['CV', 'Citizenship'], eligible_occupations: [] },
  { id: 5, full_name: 'Left Already', person_type: 'Trainer', is_active: false,
    qualifications: [gen('PhD', '2060'), tot], doc_types: [], eligible_occupations: [{ id: 14, name: 'Welder' }] },
];
const run = (f) => applyFilters(people, { ...BLANK_FILTERS, ...f }, NOW).map(p => p.full_name);

describe('filtering the pool', () => {
  it('shows only people who can be proposed, unless asked otherwise', () => {
    expect(run({})).not.toContain('Left Already');
    expect(run({ availability: 'unavailable' })).toEqual(['Left Already']);
    expect(run({ availability: 'all' })).toHaveLength(5);
  });

  it('searches trades as well as names and numbers', () => {
    expect(run({ q: 'plumb' })).toEqual(['Bikash Thapa', 'Gita Tamang']);
    expect(run({ q: '27-01-72' })).toEqual(['Bikash Thapa']);
    expect(run({ q: 'tamang' })).toEqual(['Gita Tamang']);
  });

  it('filters by role', () => {
    expect(run({ role: 'Support Staff' })).toEqual(['Hari Bahadur']);
  });

  it('narrows by trade, any or all', () => {
    expect(run({ trades: [11, 13] })).toEqual(['Bikash Thapa', 'Gita Tamang', 'Sita Karki']);
    expect(run({ trades: [11, 12], requireAll: true })).toEqual(['Bikash Thapa']);
  });

  it('reads "education at least" up the general ladder only', () => {
    // Gita's NSTB Level 2 is not a degree; her TSLC is what counts here.
    expect(run({ minEducation: 'Diploma' })).toEqual(['Bikash Thapa', 'Sita Karki']);
    expect(run({ minEducation: 'TSLC' })).toEqual(['Bikash Thapa', 'Gita Tamang', 'Sita Karki']);
  });

  it('reads "NSTB at least" up the skill ladder', () => {
    expect(run({ minNstb: 'Level 2' })).toEqual(['Gita Tamang']);
    expect(run({ minNstb: 'Level 3' })).toEqual([]);
  });

  it('filters for TOT', () => expect(run({ tot: true })).toEqual(['Bikash Thapa']));

  it('counts years from the passed year', () => {
    // Bikash 2069 → 13, Gita 2068 → 14, Sita 2079 → 3.
    expect(run({ minYears: '10' })).toEqual(['Bikash Thapa', 'Gita Tamang']);
  });

  it('finds who is missing a document', () => {
    expect(run({ missing: 'Citizenship' })).toEqual(['Gita Tamang', 'Sita Karki']);
    expect(run({ missing: 'CV' })).toEqual(['Sita Karki']);
  });

  it('combines filters', () => {
    expect(run({ role: 'Trainer', trades: [11], minYears: '14' })).toEqual(['Gita Tamang']);
  });

  it('does not count the default "available only" as a filter', () => {
    expect(activeFilterCount(BLANK_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...BLANK_FILTERS, availability: 'all', tot: true })).toBe(2);
  });

  it('sorts the most experienced first when asked', () => {
    const sorted = applyFilters(people, BLANK_FILTERS, NOW).sort(SORTS.years.fn).map(p => p.full_name);
    expect(sorted.slice(0, 2)).toEqual(['Gita Tamang', 'Bikash Thapa']);
  });
});

describe('the pool at a glance', () => {
  const k = poolKpis(people);

  it('counts only people who can be proposed as capacity', () => {
    expect(k).toMatchObject({ total: 5, available: 4, unavailable: 1, trainers: 3, support: 1 });
  });

  it('counts the trades covered, and flags those resting on one person', () => {
    // Welder is taught only by someone who has left, so it is not covered at all.
    expect(k.tradesCovered).toBe(3);
    expect(k.thinTrades.map(t => t.name)).toEqual(['Assistant Tailor', 'Mason']);
  });

  it('measures TOT against trainers, NSTB against everyone available', () => {
    expect(k).toMatchObject({ tot: 1, totPct: 33, nstb: 1, nstbPct: 25 });
  });

  it('says how many are ready to submit — CV and citizenship both on file', () => {
    expect(k).toMatchObject({ missingCv: 1, missingCitizenship: 2, readyPct: 50 });
  });

  it('does not divide by zero on an empty pool', () => {
    expect(poolKpis([])).toMatchObject({ total: 0, totPct: 0, nstbPct: 0, readyPct: 0 });
  });
});

import { describe, it, expect } from 'vitest';
import { bsToAD, adToBS, BS_DATA } from '../src/constants/nepali.js';

const ad = (y, m, d) => adToBS(new Date(Date.UTC(y, m - 1, d)));

describe('Bikram Sambat calendar', () => {
  it('puts known dates on the right day', () => {
    // Nepali New Years and a festival, from the published calendar.
    expect(bsToAD(2080, 1, 1)).toBe('2023-04-14');
    expect(bsToAD(2081, 1, 1)).toBe('2024-04-13');
    expect(bsToAD(2082, 1, 1)).toBe('2025-04-14');
    expect(bsToAD(2083, 1, 1)).toBe('2026-04-14');
    expect(bsToAD(2081, 7, 15)).toBe('2024-10-31');      // Laxmi Puja 2081
    expect(ad(2019, 2, 13)).toEqual({ y: 2075, m: 11, d: 1 });
  });
  it('round-trips across the whole range', () => {
    for (const y of [2000, 2040, 2065, 2075, 2089]) for (const m of [1, 6, 12]) {
      const [Y, M, D] = bsToAD(y, m, 1).split('-').map(Number);
      expect(ad(Y, M, D)).toEqual({ y, m, d: 1 });
    }
  });
  it('covers old certificates, not just recent years', () => {
    expect(Object.keys(BS_DATA).length).toBeGreaterThanOrEqual(90);
    for (const months of Object.values(BS_DATA)) {
      expect(months).toHaveLength(12);
      for (const n of months) expect(n).toBeGreaterThanOrEqual(29), expect(n).toBeLessThanOrEqual(32);
    }
  });
});

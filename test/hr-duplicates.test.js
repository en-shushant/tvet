import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { namesMatch, sharedQualification, normId, normPhone } = require('../backend/lib/hrDuplicates.js');

describe('HR pool duplicates', () => {
  it('numbers compare however they were typed', () => {
    expect(normId('27-01-75/1234')).toBe(normId('२७०१७५ 1234'));
    expect(normPhone('+977-9841000001')).toBe(normPhone('9841000001'));
    expect(normPhone('12')).toBe('');
  });
  it('names match through typos, a dropped middle name and a swapped order', () => {
    expect(namesMatch('Ram Bahadur Thapa', 'Raam Bahadur Thapa')).toBe(true);
    expect(namesMatch('Ram Bahadur Thapa', 'Ram Thapa')).toBe(true);
    expect(namesMatch('Thapa Ram Bahadur', 'Ram Bahadur Thapa')).toBe(true);
    expect(namesMatch('Ram Thapa', 'Sita Karki')).toBe(false);
    expect(namesMatch('Ram Thapa', 'Hari Thapa')).toBe(false);
  });
  it('a shared degree matches loosely; a shared trade needs the same level', () => {
    expect(sharedQualification([{ title: 'Bachelor of Business Study' }], [{ title: 'Bachelor of Business Studies' }])).toBeTruthy();
    expect(sharedQualification([{ title: 'BBS' }], [{ title: 'Diploma in Civil Engineering' }])).toBeNull();
    expect(sharedQualification([{ occupation_id: 3, level: 'Level 1' }], [{ occupation_id: 3, level: 'Level 1', title: 'Plumber' }])).toBe('Plumber');
    expect(sharedQualification([{ occupation_id: 3, level: 'Level 2' }], [{ occupation_id: 3, level: 'Level 1', title: 'Plumber' }])).toBeNull();
  });
});

import { describe, it, expect } from 'vitest';
import { totProviderOf, totHasDates } from '../src/components/pool/common.js';

describe('who gave a TOT', () => {
  it('recognises TITI and NAVT however they were written', () => {
    expect(totProviderOf('Training Institute for Technical Instruction')).toBe('TITI');
    expect(totProviderOf('TITI, Sanothimi')).toBe('TITI');
    expect(totProviderOf('national academy of vocational training')).toBe('NAVT');
    expect(totProviderOf('CTEVT Sanothimi')).toBe('Other');
    expect(totProviderOf('Petition')).toBe('Other');
    expect(totProviderOf('')).toBe('');
  });
  it('is required only once a date is entered', () => {
    expect(totHasDates({ start_date_ad: '2019-07-17' })).toBe(true);
    expect(totHasDates({ start_date: '', end_date: '' })).toBe(false);
  });
});

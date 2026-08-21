/**
 * Reports print what the client's letter called the training, not the master
 * occupation it was filed under.
 *
 * An occupation row carries both: ctevt_occupation_id points at "Electrician",
 * which every firm shares and which the pickers and filters match on, while
 * name_in_letter is the client's own wording — "Building Electrician", "House
 * Wiring". A generated document quoting "Electrician" would not agree with the
 * experience letter attached to it as evidence.
 *
 * So the two must not be collapsed: match on the master name, print the letter
 * name. That split is what these tests pin.
 */
import { describe, it, expect } from 'vitest';
import bagmati from '../src/reports/bagmati.jsx';
import { occMasterName, occLetterName } from '../src/reports/helpers.js';

const occupations = [{ id: 1, name: 'Electrician', sector: 'Construction', level: 'Level 2' }];
const clients = [{ id: 1, fullName: 'UNDP Nepal', shortName: 'UNDP' }];

const row = (over = {}) => ({
  id: 'o1', ctevtOccupationId: 1, nameInLetter: 'Building Electrician',
  trainees: '20', duration: '390', skillTestAppeared: '18', employmentActual: '70',
  locations: [{ district: 'Kaski', province: 'Gandaki' }], ...over,
});
const asg = (occs) => ({
  id: 1, fy: '2081/82', assignmentName: 'Skills Training', clientId: 1,
  contractValue: '500000', startDate: '2081/03/01', endDate: '2081/06/01', occupations: occs,
});
const inst = (occs) => ({ id: 1, name: 'Test Firm', experience: [asg(occs)], taxClearance: [] });

describe('occupation name helpers', () => {
  it('master name is the CTEVT occupation, for matching', () => {
    expect(occMasterName(row(), occupations)).toBe('Electrician');
  });
  it('letter name is the client wording, for printing', () => {
    expect(occLetterName(row(), occupations)).toBe('Building Electrician');
  });
  it('letter name falls back to the master when the letter field is blank', () => {
    expect(occLetterName(row({ nameInLetter: '' }), occupations)).toBe('Electrician');
    expect(occLetterName(row({ nameInLetter: '   ' }), occupations)).toBe('Electrician');
  });
  it('master name falls back to the letter wording for an unmatched occupation', () => {
    expect(occMasterName(row({ ctevtOccupationId: null }), occupations)).toBe('Building Electrician');
  });
});

const html = (reportId, opts) =>
  bagmati.buildPrintHTML(inst([row()]), [asg([row()])], clients, reportId, null, { clients, occupations, ...opts });

describe('bagmati prints the letter wording', () => {
  it('B.1 Current Portfolio', () => {
    const out = html('b1', { portfolioFromFY: '', portfolioToFY: '' });
    expect(out).toContain('Building Electrician');
    expect(out).not.toMatch(/>Electrician</);
  });

  it('B.2 General Experience', () => {
    const out = html('b2', {});
    expect(out).toContain('Building Electrician');
  });

  it('B.3 still *matches* on the master occupation while printing the letter name', () => {
    // The picker offers "Electrician" — selecting it must keep this row.
    const out = html('b3', { selectedOccs: ['Electrician'] });
    expect(out).toContain('Building Electrician');
    // and a letter-name selection must NOT match, since the picker never offers it
    const miss = html('b3', { selectedOccs: ['Building Electrician'] });
    expect(miss).not.toContain('Building Electrician');
  });

  it('B.2 keeps the sector from the master occupation', () => {
    expect(html('b2', {})).toContain('Construction');
  });
});

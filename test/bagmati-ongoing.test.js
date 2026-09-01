/**
 * Work still running counts as portfolio, not as experience.
 *
 * Table 1's own note is "implementing or have implemented", so an assignment
 * under way belongs there. Tables 2 and 3 are the opposite: they report how
 * many trainees graduated, sat the skill test and found work — outcomes a
 * training that has not finished cannot have produced. Including one would
 * either publish zeroes as results or claim numbers that do not exist yet.
 *
 * Untick "Currently running" and the same assignment joins the experience
 * tables, with nothing else about it changed.
 */
import { describe, it, expect } from 'vitest';
import bagmati from '../src/reports/bagmati.jsx';
import { expToAPI, normExp } from '../src/utils/api.js';

const occupations = [{ id: 1, name: 'Barista', sector: 'Hospitality', level: 'Level 1' }];
const clients = [{ id: 1, fullName: 'Province Youth Council Bagmati', shortName: 'PYC' }];

const occ = () => ({
  id: 'o1', ctevtOccupationId: 1, nameInLetter: '', trainees: '80',
  duration: '390', skillTestAppeared: '70', skillTestPass: '65',
  employmentActual: '60', locations: [],
});

const asg = (over = {}) => ({
  id: 1, fy: '2083/84', assignmentName: 'Ongoing barista training', clientId: 1,
  contractValue: '2612870', startDate: '2083/01/02', endDate: '2083/03/30',
  occupations: [occ()], ...over,
});

const DONE    = asg({ id: 2, assignmentName: 'Finished barista training', isOngoing: false });
const RUNNING = asg({ id: 1, assignmentName: 'Ongoing barista training', isOngoing: true });

const inst = (exps) => ({ id: 1, name: 'Test Firm', experience: exps, taxClearance: [] });
const html = (section, exps, opts = {}) => bagmati.buildPrintHTML(
  inst(exps), exps, clients, section, null,
  { clients, occupations, portfolioFromFY: '', portfolioToFY: '', ...opts });

describe('an assignment marked as currently running', () => {
  it('appears in Table 1: Current Portfolio', () => {
    expect(html('b1', [RUNNING])).toContain('Ongoing barista training');
  });

  it('is left out of Table 2: General Experience', () => {
    const out = html('b2', [RUNNING]);
    expect(out).not.toContain('Ongoing barista training');
  });

  it('is left out of Table 3: Specific Experience', () => {
    const out = html('b3', [RUNNING], { selectedOccs: ['Barista'] });
    expect(out).not.toContain('Ongoing barista training');
  });

  it('does not contribute its trainees to the experience totals', () => {
    // The real damage: an unfinished training inflating the graduate and
    // skill-test counts a bid is judged on.
    const both = html('b2', [DONE, RUNNING]);
    const alone = html('b2', [DONE]);
    const totals = (out) => (out.match(/<td[^>]*>(\d+)<\/td>/g) || []).join('|');
    expect(totals(both)).toBe(totals(alone));
  });
});

describe('unticking the mark', () => {
  it('brings the same assignment into the experience tables', () => {
    const finished = { ...RUNNING, isOngoing: false };
    expect(html('b2', [finished])).toContain('Ongoing barista training');
    expect(html('b3', [finished], { selectedOccs: ['Barista'] })).toContain('Ongoing barista training');
  });

  it('leaves it in the portfolio either way', () => {
    // Completed work is still part of the current portfolio — the note says
    // "implementing or have implemented".
    expect(html('b1', [{ ...RUNNING, isOngoing: false }])).toContain('Ongoing barista training');
  });
});

describe('assignments with no mark at all', () => {
  it('are treated as finished, so nothing already recorded changes', () => {
    const legacy = asg({ assignmentName: 'Recorded before the flag existed' });
    delete legacy.isOngoing;
    expect(html('b2', [legacy])).toContain('Recorded before the flag existed');
    expect(html('b1', [legacy])).toContain('Recorded before the flag existed');
  });
});

describe('the flag survives the round trip to the server', () => {
  it('is sent on save', () => {
    expect(expToAPI({ isOngoing: true, occupations: [] }, 1).is_ongoing).toBe(true);
    expect(expToAPI({ occupations: [] }, 1).is_ongoing).toBe(false);
  });

  it('is read back', () => {
    expect(normExp({ is_ongoing: true }).isOngoing).toBe(true);
    expect(normExp({}).isOngoing).toBe(false);
  });

  it('is not lost when an existing assignment is edited', () => {
    // Opening one for edit runs it through normExp and back out through
    // expToAPI. Dropping it on either leg would quietly mark the work finished.
    const fromServer = normExp({ id: 7, is_ongoing: true, assignment_name: 'X' });
    expect(expToAPI(fromServer, 1).is_ongoing).toBe(true);
  });
});

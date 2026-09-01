/**
 * Where running work shows up in the Bagmati report.
 *
 * The rule that running work is not experience is applied once, in the report
 * builder, for every family — see report-ongoing-experience.test.js. What is
 * specific to Bagmati, and tested here, is the one table that deliberately
 * looks past it: Current Portfolio reads the firm's own experience list rather
 * than the narrowed set the builder hands over, because its own note is
 * "implementing or have implemented".
 *
 * So B.1 shows an assignment the experience tables have already dropped. That
 * asymmetry is the whole feature, and it is invisible unless both halves are
 * driven from the same fixture.
 */
import { describe, it, expect } from 'vitest';
import bagmati from '../src/reports/bagmati.jsx';
import { completedOnly } from '../src/reports/helpers.js';
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

/**
 * What the builder hands the family: experience with running work removed.
 * The firm's own list, on `inst`, still holds everything.
 */
const asBuilder = (all) => [inst(all), completedOnly(all)];

describe('an assignment the builder has dropped as still running', () => {
  it('still appears in Table 1: Current Portfolio', () => {
    const [firm, exps] = asBuilder([DONE, RUNNING]);
    const out = bagmati.buildPrintHTML(firm, exps, clients, 'b1', null,
      { clients, occupations, portfolioFromFY: '', portfolioToFY: '' });
    expect(out).toContain('Ongoing barista training');
    expect(out).toContain('Finished barista training');
  });

  it('is absent from Table 2: General Experience', () => {
    const [firm, exps] = asBuilder([DONE, RUNNING]);
    const out = bagmati.buildPrintHTML(firm, exps, clients, 'b2', null, { clients, occupations });
    expect(out).not.toContain('Ongoing barista training');
    expect(out).toContain('Finished barista training');
  });

  it('is absent from Table 3: Specific Experience', () => {
    const [firm, exps] = asBuilder([DONE, RUNNING]);
    const out = bagmati.buildPrintHTML(firm, exps, clients, 'b3', null,
      { clients, occupations, selectedOccs: ['Barista'] });
    expect(out).not.toContain('Ongoing barista training');
  });

  it('does not contribute its trainees to the experience totals', () => {
    // The real damage: an unfinished training inflating the graduate and
    // skill-test counts a bid is judged on.
    const totals = (all) => {
      const [firm, exps] = asBuilder(all);
      const out = bagmati.buildPrintHTML(firm, exps, clients, 'b2', null, { clients, occupations });
      return (out.match(/<td[^>]*>(\d+)<\/td>/g) || []).join('|');
    };
    expect(totals([DONE, RUNNING])).toBe(totals([DONE]));
  });
});

describe('unticking the mark', () => {
  it('brings the same assignment into the experience tables', () => {
    const finished = { ...RUNNING, isOngoing: false };
    const [firm, exps] = asBuilder([finished]);
    expect(bagmati.buildPrintHTML(firm, exps, clients, 'b2', null, { clients, occupations }))
      .toContain('Ongoing barista training');
    expect(bagmati.buildPrintHTML(firm, exps, clients, 'b3', null,
      { clients, occupations, selectedOccs: ['Barista'] })).toContain('Ongoing barista training');
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
    const [firm, exps] = asBuilder([legacy]);
    expect(exps, 'a legacy row must survive the filter').toHaveLength(1);
    expect(bagmati.buildPrintHTML(firm, exps, clients, 'b2', null, { clients, occupations }))
      .toContain('Recorded before the flag existed');
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

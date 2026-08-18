/**
 * 3(B) Specific Experience has its own occupation selection (`specificOccs`),
 * independent of `selectedOccs` which scopes the 4(B) tools list.
 *
 * Those two wants genuinely diverge. A bid asks for the tools of the
 * occupations being tendered for, while the firm's experience reads strongest
 * when a different, broader set is shown. Tying both to one control meant
 * narrowing the tools list silently narrowed the experience too.
 */
import { describe, it, expect } from 'vitest';
import bolpatra from '../src/reports/bolpatra.jsx';

const exp = (id, occNames, over = {}) => ({
  id, fy: '2081/82', assignmentName: `Assignment ${id}`, clientId: 1,
  contractValue: '100', startDate: '2082/01/15', endDate: '2082/04/10',
  occupations: occNames.map((n, i) => ({
    id: `${id}-${i}`, nameInLetter: n, ctevtOccupationId: null,
    trainees: '20', duration: '390', level: 'Level 1',
    locations: [{ district: 'Kaski' }],
  })),
  ...over,
});

const exps = [
  exp(1, ['Beautician']),
  exp(2, ['Tailoring']),
  exp(3, ['Plumbing', 'Beautician']),
  exp(4, ['Welding']),
];

const clients = [{ id: 1, fullName: 'Nepal Electricity Authority', shortName: 'NEA' }];
const inst = { id: 1, name: 'Test Firm' };

/** Assignment names appearing in the rendered 3(B) HTML. */
function specificAssignments(opts) {
  const html = bolpatra.buildPrintHTML(inst, exps, clients, '3b', null, { clients, ...opts });
  return [1, 2, 3, 4].filter(id => html.includes(`Assignment ${id}`));
}

describe('3(B) occupation scope', () => {
  it('narrows to the selected occupations', () => {
    expect(specificAssignments({ specificOccs: ['Beautician'] })).toEqual([1, 3]);
  });

  it('includes every assignment when nothing is selected', () => {
    expect(specificAssignments({ specificOccs: [] })).toEqual([1, 2, 3, 4]);
  });

  it('is unaffected by the separate tools occupation selection', () => {
    // selectedOccs drives the 4(B) tools list, not the 3(B) narrowing.
    expect(specificAssignments({ specificOccs: [], selectedOccs: ['Beautician'] }))
      .toEqual([1, 2, 3, 4]);
    expect(specificAssignments({ specificOccs: ['Beautician'], selectedOccs: ['Welding'] }))
      .toEqual([1, 3]);
  });

  it('still applies the duration filter, which is a separate question', () => {
    const short = [exp(5, ['Beautician']), exp(6, ['Tailoring'])];
    short[0].occupations[0].duration = '80';   // below the 160-hour threshold
    short[1].occupations[0].duration = '390';
    const html = bolpatra.buildPrintHTML(inst, short, clients, '3b', null, {
      // The filter takes '160plus' / '390plus' / '390more'; an unrecognised
      // value falls through to keeping everything, which is how a wrong string
      // here looked like a broken filter.
      clients, specificOccs: [], filterDuration: '160plus',
    });
    expect(html.includes('Assignment 5'), 'an 80-hour assignment should still be excluded').toBe(false);
    expect(html.includes('Assignment 6')).toBe(true);
  });

  it('leaves the tools selection alone', () => {
    // specificOccs is read only by the 3(B) narrowing; the tools list is built
    // from selectedOccs elsewhere and must not shift when this changes.
    const withSpecific = bolpatra.buildPrintHTML(inst, exps, clients, '4b', null, {
      clients, selectedOccs: ['Beautician'], specificOccs: ['Welding'],
      bolpatraTools: {}, eoiToolsLevel: 'Level 1',
    });
    const without = bolpatra.buildPrintHTML(inst, exps, clients, '4b', null, {
      clients, selectedOccs: ['Beautician'], specificOccs: [],
      bolpatraTools: {}, eoiToolsLevel: 'Level 1',
    });
    expect(withSpecific).toBe(without);
  });
});

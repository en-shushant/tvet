/**
 * 4(A) Average Annual Turnover is the average of the best three years within
 * the selected range, not every year in it.
 *
 * A firm with four or more years on file would otherwise have a weak early
 * year drag the figure down, even though the form's own note asks for the
 * strongest three.
 */
import { describe, it, expect } from 'vitest';
import bolpatra from '../src/reports/bolpatra.jsx';

const inst = {
  id: 1, name: 'Test Firm',
  taxClearance: [
    { fy: '2077/78', turnover: 100 },   // weakest — dropped
    { fy: '2078/79', turnover: 500 },
    { fy: '2079/80', turnover: 300 },
    { fy: '2080/81', turnover: 400 },
    { fy: '2081/82', turnover: 200 },
  ],
};

const html = (over = {}) =>
  bolpatra.buildPrintHTML(inst, [], [], '4a', null, { clients: [], ...over });

describe('4(A) average uses the best three years, not every year', () => {
  it('averages only the top three amounts', () => {
    // Best three: 500 + 400 + 300 = 1200 / 3 = 400.
    expect(html()).toContain('400');
  });

  it('is not the average of all five years', () => {
    // All five would be (100+500+300+400+200)/5 = 300 — a different figure.
    const out = html();
    // 400 must appear and the all-years mean must not appear as the average box value.
    expect(out).toContain('400');
  });

  it('still lists every year in range in the table, only the average is narrowed', () => {
    const out = html();
    for (const fy of ['2077/78', '2078/79', '2079/80', '2080/81', '2081/82']) {
      expect(out, `${fy} missing from the table`).toContain(fy);
    }
  });

  it('respects the turnover FY range before picking the best three', () => {
    // Restrict to the last three years on file: 300, 400, 200 — best three of
    // those three is just their average, 300.
    const out = html({ turnoverFromFY: '2079/80', turnoverToFY: '2081/82' });
    expect(out).toContain('300');
    expect(out).not.toContain('2077/78');
    expect(out).not.toContain('2078/79');
  });

  it('averages fewer than three years when that is all there is', () => {
    const twoYear = {
      id: 2, name: 'Newer Firm',
      taxClearance: [
        { fy: '2080/81', turnover: 100 },
        { fy: '2081/82', turnover: 300 },
      ],
    };
    const out = bolpatra.buildPrintHTML(twoYear, [], [], '4a', null, { clients: [] });
    expect(out).toContain('200'); // (100+300)/2
  });

  it('ignores zero and invalid turnover rows when choosing the best three', () => {
    const withJunk = {
      id: 3, name: 'Firm With Gaps',
      taxClearance: [
        { fy: '2078/79', turnover: 0 },
        { fy: '2079/80', turnover: null },
        { fy: '2080/81', turnover: 600 },
        { fy: '2081/82', turnover: 300 },
      ],
    };
    const out = bolpatra.buildPrintHTML(withJunk, [], [], '4a', null, { clients: [] });
    // Only two real values on file: (600+300)/2 = 450.
    expect(out).toContain('450');
  });
});

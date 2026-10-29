import { describe, it, expect } from 'vitest';
import { parseDeadline, daysUntil, tenderKpis } from '../src/components/tenders/kpis.js';

const day = (y, m, d) => Date.UTC(y, m - 1, d);
const bid = (status, submission_date, title = 'T') => ({ latest: { status, submission_date, title } });

describe('tender deadlines as typed', () => {
  it('reads the forms an e-GP notice and a person write', () => {
    expect(parseDeadline('17-03-2026')).toBe(day(2026, 3, 17));
    expect(parseDeadline('2026/03/17')).toBe(day(2026, 3, 17));
    expect(parseDeadline('17.3.2026 at 3pm')).toBe(day(2026, 3, 17));
    expect(parseDeadline('2026-03-17')).toBe(day(2026, 3, 17));
  });
  it('reads a Bikram Sambat year (2070 or later) as BS', () => {
    expect(parseDeadline('2083/01/01')).toBe(day(2026, 4, 14));
  });
  it('gives nothing for text it cannot read', () => {
    for (const v of ['', null, 'next week', '99-99-2026', '17-03-85']) expect(parseDeadline(v)).toBeNull();
  });
});

describe('the Tenders page figures', () => {
  const today = day(2026, 10, 29);
  const rows = [
    bid('Preparing', '2026-11-05', 'Due in a week'), bid('Preparing', '2026-10-20', 'Late'), bid('Preparing', '2026-12-30', 'Far off'),
    bid('Preparing', ''), bid('Submitted', '2026-10-01'), bid('Shortlisted', ''), bid('Awarded', ''), bid('Awarded', ''), bid('Lost', ''),
    bid('Dropped', ''),
  ];
  const k = tenderKpis(rows, today);
  it('counts bids by where they stand', () => {
    expect(k).toMatchObject({ total: 10, preparing: 4, awaiting: 2, awarded: 2, lost: 1 });
  });
  it('gives a win rate only once something has been decided', () => {
    expect(k.winRate).toBe(67);
    expect(tenderKpis([bid('Preparing', '')], today).winRate).toBeNull();
  });
  it('finds what is due soon and what is overdue, among bids still being prepared', () => {
    expect(k.soon).toBe(1);
    expect(k.overdue).toBe(1);
    expect(k.next).toEqual({ title: 'Due in a week', days: 7 });
    expect(k.withoutDeadline).toBe(1);
    expect(daysUntil(day(2026, 10, 29), today)).toBe(0);
  });
  it('treats a bid with no status as preparing, and copes with no bids', () => {
    expect(tenderKpis([{ latest: { title: 'x' } }], today).preparing).toBe(1);
    expect(tenderKpis([], today)).toMatchObject({ total: 0, preparing: 0, winRate: null, next: null });
  });
});

import { describe, it, expect } from 'vitest';
import { summarise, deadlineState, scoringLine } from '../src/components/tenders/TenderSummary.jsx';

const day = (y, m, d) => Date.UTC(y, m - 1, d);
const today = day(2026, 10, 29);

describe('the deadline on the tender summary', () => {
  it('says how long is left, and when it is close', () => {
    expect(deadlineState({ submission_date: '2026-11-20' }, today)).toMatchObject({ text: '22 days left', tone: 'ok' });
    expect(deadlineState({ submission_date: '2026-11-03', submission_time: '3pm' }, today))
      .toMatchObject({ text: '5 days left', tone: 'warn', sub: '2026-11-03 at 3pm' });
    expect(deadlineState({ submission_date: '2026-10-30' }, today)).toMatchObject({ text: '1 day left' });
  });
  it('says so plainly when it is today or has passed', () => {
    expect(deadlineState({ submission_date: '2026-10-29' }, today)).toMatchObject({ text: 'Today', tone: 'bad' });
    expect(deadlineState({ submission_date: '2026-10-26' }, today)).toMatchObject({ text: '3 days overdue', tone: 'bad' });
  });
  it('does not guess at a deadline it cannot read, or one not yet set', () => {
    expect(deadlineState({ submission_date: 'next Friday' }, today)).toMatchObject({ text: 'next Friday', tone: 'muted' });
    expect(deadlineState({}, today)).toMatchObject({ text: 'Not set', tone: 'muted' });
  });
});

describe('the figures on the tender summary', () => {
  const t = {
    occupations: [{ name: 'Plumber' }, { name: 'Tailor' }],
    positions: [{ id: 1, count: 2 }, { id: 2, count: 1 }],
    bidders: [{ id: 10, display_name: 'COSMO', status: 'Preparing' }, { id: 11, display_name: 'UTTE', status: 'Submitted' }],
    people: [{ bidder_id: 10, position_id: 1 }, { bidder_id: 10, position_id: 1 }, { bidder_id: 10, position_id: 2 }, { bidder_id: 11, position_id: 1 }],
    submission_date: '2026-11-05',
  };
  const s = summarise(t, today);
  it('counts trades, posts and people per bidder', () => {
    expect(s.trades).toEqual(['Plumber', 'Tailor']);
    expect(s.posts).toBe(2);
    expect(s.needed).toBe(3);
  });
  it('totals the team across bidders, counting a surplus person as no extra', () => {
    expect(s.perBidder.map(x => [x.b.display_name, x.filled, x.needed])).toEqual([['COSMO', 3, 3], ['UTTE', 1, 3]]);
    expect(s.filled).toBe(4);
    expect(s.wanted).toBe(6);
  });
  it('says where each bidder stands', () => {
    expect(s.statuses).toEqual({ Preparing: 1, Submitted: 1 });
  });
  it('copes with a tender that has nothing yet', () => {
    const e = summarise({}, today);
    expect(e).toMatchObject({ posts: 0, wanted: 0, filled: 0, bidders: [] });
    expect(e.deadline.text).toBe('Not set');
  });
  it('writes the scoring as one line, only from what the notice states', () => {
    expect(scoringLine({ weight_qualification: 30, weight_experience: 50, weight_capacity: 20, minimum_score: 70 }))
      .toBe('qualification 30% · experience 50% · capacity 20% · pass mark 70');
    expect(scoringLine({})).toBe('');
    expect(scoringLine({ minimum_score: 0 })).toBe('pass mark 0');
  });
});

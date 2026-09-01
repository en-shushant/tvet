/**
 * Which filters reach the Current Portfolio, and which deliberately do not.
 *
 * Table 1 is the one section that reads the firm's own experience list rather
 * than the narrowed set the report builder hands every family. That is what
 * lets it show work the experience tables have dropped — running assignments,
 * and assignments outside the experience fiscal-year range — while still
 * answering to its own portfolio year range.
 *
 * The consequence is that every sidebar filter is absent from it by default,
 * which is right for the ones that narrow a table and wrong for the one that
 * suppresses records outright. So both halves are pinned here: the training
 * duration filter must not touch the portfolio, and the superadmin-only
 * exclusion must.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import bagmati from '../src/reports/bagmati.jsx';

const read = (p) => readFileSync(path.resolve(import.meta.dirname, '..', p), 'utf8');

const occupations = [
  { id: 1, name: 'Barista', sector: 'Hospitality' },
  { id: 2, name: 'Orientation', sector: 'General' },
];
const clients = [{ id: 1, fullName: 'Province Youth Council Bagmati', shortName: 'PYC' }];

const occ = (id, hours) => ({ id: `o${id}`, ctevtOccupationId: id, nameInLetter: '',
  trainees: '40', duration: String(hours), skillTestAppeared: '35', locations: [] });

/** 390 hours — passes every duration filter. */
const LONG = { id: 1, fy: '2083/84', assignmentName: 'Long barista training', clientId: 1,
  contractValue: '2612870', startDate: '2083/01/02', endDate: '2083/03/30',
  occupations: [occ(1, 390)] };
/** 40 hours — dropped by "160 hours or more" and by both 390 filters. */
const SHORT = { id: 2, fy: '2083/84', assignmentName: 'Short orientation course', clientId: 1,
  contractValue: '120000', startDate: '2083/02/01', endDate: '2083/02/10',
  occupations: [occ(2, 40)] };

const firm = (exps) => ({ id: 1, name: 'Test Firm', experience: exps, taxClearance: [] });
const portfolio = (all, exps, opts = {}) => bagmati.buildPrintHTML(
  firm(all), exps, clients, 'b1', null,
  { clients, occupations, portfolioFromFY: '', portfolioToFY: '', ...opts });

describe('the training duration filter', () => {
  it('does not remove a short assignment from the portfolio', () => {
    // The builder has already applied "160 hours or more" to `exps`, dropping
    // the 40-hour course. Table 1 must still list it: the portfolio is what the
    // firm is doing, not what qualifies as experience of a given length.
    const out = portfolio([LONG, SHORT], [LONG]);
    expect(out).toContain('Short orientation course');
    expect(out).toContain('Long barista training');
  });

  it('leaves the portfolio identical however the filter is set', () => {
    // Whatever the builder narrows `exps` to, Table 1 is unchanged.
    const unfiltered = portfolio([LONG, SHORT], [LONG, SHORT]);
    const filtered390 = portfolio([LONG, SHORT], [LONG]);
    const filteredNone = portfolio([LONG, SHORT], []);
    expect(filtered390).toBe(unfiltered);
    expect(filteredNone).toBe(unfiltered);
  });

  it('reads the firm rather than the narrowed list, which is why', () => {
    const source = read('src/reports/bagmati.jsx');
    const b1 = source.slice(source.indexOf('function modelB1'), source.indexOf('function modelB2'));
    expect(b1).toMatch(/inst\?\.experience/);
    expect(b1, 'B.1 must not read exps').not.toMatch(/\bexps\b\s*=\s*exps/);
  });
});

describe('the other narrowing filters', () => {
  it('are equally absent — donor type, training type, the checklist', () => {
    // All of them narrow `exps`, and Table 1 never reads it. Stated as one
    // test because they share a single mechanism: if any of them ever starts
    // reaching the portfolio, it will be because B.1 stopped reading the firm.
    expect(portfolio([LONG, SHORT], [])).toContain('Short orientation course');
  });

  it('but the portfolio year range does apply', () => {
    // Table 1 has its own range, separate from the experience tables'.
    const older = { ...SHORT, id: 3, fy: '2079/80', assignmentName: 'Older assignment' };
    const out = portfolio([LONG, older], [], { portfolioFromFY: '2083/84', portfolioToFY: '2083/84' });
    expect(out).toContain('Long barista training');
    expect(out).not.toContain('Older assignment');
  });
});

describe('the superadmin-only exclusion', () => {
  const RESTRICTED = { ...SHORT, id: 4, assignmentName: 'Confidential survey', isSuperAdminOnly: true };

  it('does reach the portfolio, unlike the narrowing filters', () => {
    // Not a filter someone chose to narrow a table with — a record that must
    // not appear in the document at all. Dropping it from the experience list
    // alone left Table 1 printing it regardless.
    const excluded = firm([LONG, RESTRICTED]).experience.filter(e => !e.isSuperAdminOnly);
    const out = bagmati.buildPrintHTML(firm(excluded), [LONG], clients, 'b1', null,
      { clients, occupations, portfolioFromFY: '', portfolioToFY: '' });
    expect(out).not.toContain('Confidential survey');
    expect(out).toContain('Long barista training');
  });

  it('is applied to the firm the builder hands each family', () => {
    // The fix: sanitise the firm itself, not only the experience list, or a
    // section reading `inst` walks straight around the switch.
    const source = read('src/components/ReportsView.jsx');
    expect(source).toMatch(/const reportInstFor = \(i\) =>/);
    expect(source).toMatch(/reportInstFor\(i\)|dropRestricted\(i\.experience/);
    // Every entry point takes the sanitised firm, not the raw one.
    for (const call of [
      /buildPrintHTML\(reportInst,/,
      /downloadDOCX\(reportInst,/,
      /renderAggregateTable\(reportInst \|\| null,/,
      /\{ inst: reportInstFor\(inst\), exps: fwExpsFor\(inst\) \}/,
    ]) expect(source, String(call)).toMatch(call);
    expect(source, 'a raw fullInst must not reach a family')
      .not.toMatch(/(buildPrintHTML|downloadDOCX|renderAggregateTable)\(fullInst/);
  });
});

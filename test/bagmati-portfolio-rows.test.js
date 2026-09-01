/**
 * Table 1: Current Portfolio lists assignments, not occupations.
 *
 * It used to emit one row per occupation, so a single contract run for four
 * trades appeared as four rows repeating the assignment name, the dates, the
 * client and the contract amount. Anyone reading it — or totalling the money
 * column — saw four contracts worth four times what was signed.
 *
 * The occupations are the one thing that varies inside an assignment, so they
 * collapse into a single cell; everything else belongs to the assignment and is
 * stated once. These tests are written against the rendered print HTML rather
 * than the model, because the screen, the print sheet and the DOCX export all
 * read the same model and the output is what the reader actually holds.
 */
import { describe, it, expect } from 'vitest';
import bagmati from '../src/reports/bagmati.jsx';

const occupations = [
  { id: 1, name: 'Barista', sector: 'Hospitality', level: 'Level 1' },
  { id: 2, name: 'Beautician', sector: 'Personal Care', level: 'Level 1' },
  { id: 3, name: 'Mobile Phone Repair', sector: 'Electronics', level: 'Level 1' },
];
const clients = [{ id: 1, fullName: 'Province Youth Council Bagmati', shortName: 'PYC' }];

const occ = (id, trainees, over = {}) => ({
  id: `o${id}-${trainees}`, ctevtOccupationId: id, nameInLetter: '',
  trainees: String(trainees), duration: '390', locations: [], ...over,
});

/** One contract, three trades — the shape from the reported screenshot. */
const MULTI = {
  id: 1, fy: '2083/84', assignmentName: 'Skill Development Training to youths in Bagmati Province',
  clientId: 1, contractValue: '2612870', startDate: '2083/01/02', endDate: '2083/03/30',
  occupations: [occ(1, 80), occ(3, 60), occ(2, 40)],
};
const SINGLE = {
  id: 2, fy: '2083/84', assignmentName: 'Vocational and Skill Development Training',
  clientId: 1, contractValue: '840580', startDate: '2082/05/01', endDate: '2082/10/23',
  occupations: [occ(1, 15)],
};

const inst = (exps) => ({ id: 1, name: 'Test Firm', experience: exps, taxClearance: [] });
const html = (exps, opts = {}) => bagmati.buildPrintHTML(
  inst(exps), exps, clients, 'b1', null,
  { clients, occupations, portfolioFromFY: '', portfolioToFY: '', ...opts });

/** The <tr> blocks of the rendered table, excluding the header. */
const bodyRows = (out) => (out.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [])
  .filter(r => !/<th[\s>]/.test(r));
const cells = (row) => (row.match(/<td[^>]*>([\s\S]*?)<\/td>/g) || [])
  .map(c => c.replace(/<[^>]+>/g, '').trim());
const count = (out, needle) => out.split(needle).length - 1;

describe('an assignment covering several occupations', () => {
  it('is one row, not one per occupation', () => {
    const rows = bodyRows(html([MULTI]));
    expect(rows).toHaveLength(1);
  });

  it('states the contract amount once', () => {
    // The damaging part of the old layout: three rows each showing 26,12,870
    // read as three contracts, and totalled to three times the money.
    const out = html([MULTI]);
    expect(count(out, '26,12,870')).toBe(1);
  });

  it('does not repeat the assignment name, dates or client', () => {
    const out = html([MULTI]);
    expect(count(out, 'Skill Development Training to youths in Bagmati Province')).toBe(1);
    expect(count(out, '2083/01/02')).toBe(1);
    expect(count(out, 'Province Youth Council Bagmati')).toBe(1);
  });

  it('lists every occupation in one cell, in the order entered', () => {
    const [row] = bodyRows(html([MULTI]));
    expect(cells(row)[2]).toBe('Barista, Mobile Phone Repair, Beautician');
  });

  it('sums the trainees across them', () => {
    const [row] = bodyRows(html([MULTI]));
    expect(cells(row)[3]).toBe('180'); // 80 + 60 + 40
  });
});

describe('numbering and ordinary rows', () => {
  it('numbers assignments, so two contracts are 1 and 2 rather than 1 to 4', () => {
    const rows = bodyRows(html([MULTI, SINGLE]));
    expect(rows).toHaveLength(2);
    expect(cells(rows[0])[0]).toBe('1');
    expect(cells(rows[1])[0]).toBe('2');
  });

  it('leaves a single-occupation assignment reading exactly as before', () => {
    const [row] = bodyRows(html([SINGLE]));
    const c = cells(row);
    expect(c[1]).toBe('Vocational and Skill Development Training');
    expect(c[2]).toBe('Barista');
    expect(c[3]).toBe('15');
  });
});

describe('assignments with gaps in the data', () => {
  it('still lists an assignment that records no occupations', () => {
    // Dropping it would quietly shorten the portfolio.
    const bare = { ...SINGLE, occupations: [] };
    const rows = bodyRows(html([bare]));
    expect(rows).toHaveLength(1);
    expect(cells(rows[0])[1]).toBe('Vocational and Skill Development Training');
  });

  it('shows a dash rather than 0 when no occupation records a trainee count', () => {
    // 0 trainees is a claim about the assignment; an unrecorded figure is not.
    const blank = { ...SINGLE, occupations: [occ(1, '', { trainees: '' })] };
    expect(cells(bodyRows(html([blank]))[0])[3]).toBe('—');
  });

  it('sums only the occupations that do record one', () => {
    const partial = { ...MULTI, occupations: [occ(1, 80), occ(2, '', { trainees: '' })] };
    expect(cells(bodyRows(html([partial]))[0])[3]).toBe('80');
  });

  it('collapses the same trade recorded twice on one assignment', () => {
    const dupe = { ...MULTI, occupations: [occ(1, 20), occ(1, 30)] };
    const c = cells(bodyRows(html([dupe]))[0]);
    expect(c[2]).toBe('Barista');
    expect(c[3]).toBe('50'); // the trainees still both count
  });
});

describe('the portfolio fiscal-year range still applies', () => {
  it('keeps assignments inside the range and drops those outside it', () => {
    const older = { ...SINGLE, id: 3, fy: '2079/80', assignmentName: 'Older assignment' };
    const out = html([MULTI, older], { portfolioFromFY: '2083/84', portfolioToFY: '2083/84' });
    expect(bodyRows(out)).toHaveLength(1);
    expect(out).not.toContain('Older assignment');
  });
});

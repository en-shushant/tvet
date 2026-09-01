/**
 * Table 1: Current Portfolio — a row per occupation, but the assignment's own
 * columns merged down across them.
 *
 * Originally every column repeated per occupation, so one contract run for four
 * trades appeared as four rows each restating the assignment name, the dates,
 * the client and the contract amount. Anyone totalling the money column saw
 * four contracts worth four times what was signed.
 *
 * Occupation and No. Of Trainees still need a row each — the form asks for the
 * per-trade numbers. Everything else belongs to the assignment and spans those
 * rows, so it is stated exactly once.
 *
 * Written against the rendered print HTML rather than the model, because the
 * screen, the print sheet and the Word export all read the same model and the
 * markup is what the reader actually holds. The `rowspan` attributes are the
 * whole point of the fix, so they are asserted directly.
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

/** The <tr> blocks of the rendered table body, excluding the header. */
const bodyRows = (out) => (out.match(/<tr[^>]*>[\s\S]*?<\/tr>/g) || [])
  .filter(r => !/<th[\s>]/.test(r));
/**
 * Cells as { text, span } in document order — a merged row has fewer of them.
 *
 * Entities are decoded because a dash reaches the markup two ways: as the
 * model's own literal em dash, and as the renderer's escaped placeholder for a
 * blank. Both display identically, and the test is about the table, not the
 * escaping.
 */
const decode = (t) => t.replace(/&mdash;/g, '—').replace(/&amp;/g, '&');
const cells = (row) => [...row.matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/g)].map(m => ({
  text: decode(m[2].replace(/<[^>]+>/g, '')).trim(),
  span: Number((m[1].match(/rowspan="(\d+)"/) || [, 1])[1]),
}));
const count = (out, needle) => out.split(needle).length - 1;

describe('an assignment covering several occupations', () => {
  it('keeps a row for each occupation', () => {
    expect(bodyRows(html([MULTI]))).toHaveLength(3);
  });

  it('gives each trade its own name and trainee count', () => {
    const rows = bodyRows(html([MULTI]));
    // The first row also carries the merged assignment columns, so its
    // occupation and trainee cells sit at index 2 and 3; later rows carry
    // only those two.
    expect(cells(rows[0]).map(c => c.text).slice(2, 4)).toEqual(['Barista', '80']);
    expect(cells(rows[1]).map(c => c.text)).toEqual(['Mobile Phone Repair', '60']);
    expect(cells(rows[2]).map(c => c.text)).toEqual(['Beautician', '40']);
  });

  it('states the contract amount once, spanning those rows', () => {
    // The damaging part of the original layout: three rows each showing
    // 26,12,870 read as three contracts and totalled to three times the money.
    const out = html([MULTI]);
    expect(count(out, '26,12,870')).toBe(1);
    const contract = cells(bodyRows(out)[0]).find(c => c.text === '26,12,870');
    expect(contract.span).toBe(3);
  });

  it('states the name, dates, client and serial number once each', () => {
    const out = html([MULTI]);
    for (const value of ['Skill Development Training to youths in Bagmati Province',
                         '2083/01/02', '2083/03/30', 'Province Youth Council Bagmati']) {
      expect(count(out, value), value).toBe(1);
    }
  });

  it('spans every assignment-level column across all its occupation rows', () => {
    const first = cells(bodyRows(html([MULTI]))[0]);
    // Eight columns; the two per-occupation ones do not span.
    expect(first).toHaveLength(8);
    expect(first.map(c => c.span)).toEqual([3, 3, 1, 1, 3, 3, 3, 3]);
  });

  it('emits no cell at all for the covered positions', () => {
    // An HTML rowspan works by omission; leaving an empty <td> would push the
    // row sideways and break the column alignment.
    const rows = bodyRows(html([MULTI]));
    expect(cells(rows[1])).toHaveLength(2);
    expect(cells(rows[2])).toHaveLength(2);
  });
});

describe('numbering', () => {
  it('counts assignments, not rows', () => {
    const rows = bodyRows(html([MULTI, SINGLE]));
    expect(rows).toHaveLength(4); // 3 occupations + 1
    expect(cells(rows[0])[0].text).toBe('1');
    expect(cells(rows[3])[0].text).toBe('2');
  });
});

describe('an assignment with a single occupation', () => {
  it('is one plain row with nothing merged', () => {
    // A span of one would be noise in the markup and in Word.
    const c = cells(bodyRows(html([SINGLE]))[0]);
    expect(c).toHaveLength(8);
    expect(c.every(x => x.span === 1)).toBe(true);
    expect(c[1].text).toBe('Vocational and Skill Development Training');
    expect(c[2].text).toBe('Barista');
    expect(c[3].text).toBe('15');
  });
});

describe('assignments with gaps in the data', () => {
  it('still lists an assignment that records no occupations', () => {
    // Dropping it would quietly shorten the portfolio.
    const bare = { ...SINGLE, occupations: [] };
    const rows = bodyRows(html([bare]));
    expect(rows).toHaveLength(1);
    const c = cells(rows[0]);
    expect(c[1].text).toBe('Vocational and Skill Development Training');
    expect(c[2].text).toBe('—');
  });

  it('shows a dash for an occupation with no trainee count', () => {
    const blank = { ...SINGLE, occupations: [occ(1, '', { trainees: '' })] };
    expect(cells(bodyRows(html([blank]))[0])[3].text).toBe('—');
  });

  it('keeps the same trade listed twice as two rows', () => {
    // Two runs of one trade on one contract are two cohorts with their own
    // counts; collapsing them would lose a number the form asks for.
    const dupe = { ...MULTI, occupations: [occ(1, 20), occ(1, 30)] };
    const rows = bodyRows(html([dupe]));
    expect(rows).toHaveLength(2);
    expect(cells(rows[0])[3].text).toBe('20');
    expect(cells(rows[1])[1].text).toBe('30');
  });
});

describe('the portfolio fiscal-year range still applies', () => {
  it('keeps assignments inside the range and drops those outside it', () => {
    const older = { ...SINGLE, id: 3, fy: '2079/80', assignmentName: 'Older assignment' };
    const out = html([MULTI, older], { portfolioFromFY: '2083/84', portfolioToFY: '2083/84' });
    expect(bodyRows(out)).toHaveLength(3);
    expect(out).not.toContain('Older assignment');
  });
});

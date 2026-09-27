import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { certificateFrom, matchOccupation } from '../src/components/pool/NstbLookup.jsx';

const require = createRequire(import.meta.url);
const { lookupNstbResult, levelOf, outcomeOf, normaliseDob, makeLimiter } = require('../backend/lib/nstbResult.js');

const reply = (data) => async (url, init) => {
  reply.last = { url, body: JSON.parse(init.body) };
  return { ok: true, json: async () => ({ Content: JSON.stringify({ IsSuccess: true, Data: data }) }) };
};
const PASS = { Status: 'true', Name: 'Sita Karki', FatherName: 'Ram Karki', SymbolNo: '81234567', Occupation: 'Plumber',
  Level: 'Level 2', Year: '2079', CertificateNo: 'NSTB-99', TestCenter: 'Balaju', IsTheory: null, TheoryMarks: null,
  TheoryStatus: null, PERFORMANCE: 'Standard Met' };

describe('NSTB result lookup (server)', () => {
  it('sends the BS date with slashes and decodes the double-wrapped reply', async () => {
    const r = await lookupNstbResult({ symbolNo: ' 81234567 ', dateOfBirth: '2058-9-1' }, reply(PASS));
    expect(reply.last.body).toEqual({ SymbolNo: '81234567', DateOfBirth: '2058/09/01' });
    expect(r.found).toBe(true);
    expect(r.result).toMatchObject({ name: 'Sita Karki', level: 'Level 2', year: '2079', certificateNo: 'NSTB-99', outcome: 'pass' });
  });
  it('reports no match', async () => {
    expect(await lookupNstbResult({ symbolNo: '1', dateOfBirth: '2058/09/11' }, reply({ Status: 'false' }))).toEqual({ found: false });
  });
  it('refuses bad input before calling out', async () => {
    await expect(lookupNstbResult({ symbolNo: '<x>', dateOfBirth: '2058/09/11' }, reply(PASS))).rejects.toMatchObject({ status: 400 });
    await expect(lookupNstbResult({ symbolNo: '123', dateOfBirth: '1990-13-01' }, reply(PASS))).rejects.toMatchObject({ status: 400 });
  });
  it('says the service is unavailable when it is', async () => {
    await expect(lookupNstbResult({ symbolNo: '123', dateOfBirth: '2058/09/11' }, async () => ({ ok: false })))
      .rejects.toMatchObject({ status: 502 });
    await expect(lookupNstbResult({ symbolNo: '123', dateOfBirth: '2058/09/11' }, async () => { throw new Error('down'); }))
      .rejects.toMatchObject({ status: 502 });
  });
  it('reads levels and outcomes as NSTB writes them', () => {
    expect(['Level 1', '2', 'LEVEL-3', 'Level IV', 'Technician', 'x'].map(levelOf))
      .toEqual(['Level 1', 'Level 2', 'Level 3', 'Professional', 'Technician', null]);
    expect(outcomeOf({ performance: 'Standard Met' })).toBe('pass');
    expect(outcomeOf({ performance: 'Standard Not Met' })).toBe('fail');
    expect(outcomeOf({ theoryStatus: 'W/H' })).toBe('withheld');
    expect(outcomeOf({ performance: 'DISTINCTION' })).toBe('pass');
    expect(outcomeOf({})).toBeNull();
    expect(normaliseDob('2058/9/1')).toBe('2058/09/01');
  });
  it('limits lookups per user and overall', () => {
    const allow = makeLimiter({ perUser: 2, overall: 3, windowMs: 1000 });
    expect([allow('a', 0), allow('a', 1), allow('a', 2)]).toEqual([true, true, false]);
    expect([allow('b', 3), allow('c', 4)]).toEqual([true, false]);
    expect(allow('a', 2000)).toBe(true);
  });
});

describe('a result becomes a certificate', () => {
  const occupations = [{ id: 7, name: 'Plumber', level: 'Level 2' }, { id: 8, name: 'Plumber', level: 'Level 1' }];
  it('matches the trade and level, and keeps the symbol number and test centre', () => {
    expect(matchOccupation(occupations, 'plumber', 'Level 1').id).toBe(8);
    const row = certificateFrom({ occupation: 'Plumber', level: 'Level 2', year: '2079', certificateNo: 'NSTB-99',
      symbolNo: '81234567', testCenter: 'Balaju', performance: 'Standard Met' }, occupations);
    expect(row).toMatchObject({ stream: 'Vocational', level: 'Level 2', occupation_id: 7, passed_year: '2079',
      certificate_no: 'NSTB-99', board: 'NSTB' });
    expect(row.remarks).toBe('Symbol no. 81234567 · tested at Balaju · Standard Met');
  });
  it('leaves the trade blank when it is not in the list', () => {
    expect(certificateFrom({ occupation: 'Shoe Maker', level: 'Level 1' }, occupations).occupation_id).toBe('');
  });
});

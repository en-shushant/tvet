/**
 * The Detailed Experience report: clients named in full, and a client-by-client arrangement.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { arrangeExps, clientGroupLine, buildPrintHTML, downloadDOCX, renderAggregateTable } from '../src/reports/detailed.jsx';

const clients = [
  { id: 1, shortName: 'FEB', fullName: 'Federation of Employment Board', type: 'Government' },
  { id: 2, shortName: 'CTEVT', fullName: 'Council for Technical Education and Vocational Training', type: 'Government' },
];
const occ = (n) => [{ id: 'o' + n, trainees: String(n), level: 'Level 1', occupationName: 'Plumber' }];
const exps = [
  { id: 'a', assignmentName: 'FEB 2079', clientId: 1, fy: '2079/80', occupations: occ(30) },
  { id: 'b', assignmentName: 'CTEVT 2080', clientId: 2, fy: '2080/81', occupations: occ(20) },
  { id: 'c', assignmentName: 'FEB 2081', clientId: 1, fy: '2081/82', occupations: occ(25) },
  { id: 'd', assignmentName: 'Typed', manualClient: true, clientName: 'Local Ward Office', fy: '2080/81', occupations: [] },
  { id: 'e', assignmentName: 'Typed again', manualClient: true, clientName: 'local ward office', fy: '2081/82', occupations: [] },
];
const inst = { id: 9, name: 'WLTTI Pvt. Ltd.', acronym: 'WLTTI', experience: exps, nstb: [], affiliation: [] };

describe('client names in the report', () => {
  it('are the full name, never the short one', () => {
    const html = buildPrintHTML(inst, exps, clients, 'det1', '', { clients });
    expect(html).toContain('Federation of Employment Board');
    expect(html).toContain('Council for Technical Education and Vocational Training');
    expect(html).not.toMatch(/Client:<\/b> (FEB|CTEVT)</);
  });
  it('fall back to the short name only when a client has no full name', () => {
    const html = buildPrintHTML(inst, [exps[0]], [{ id: 1, shortName: 'FEB', fullName: '', type: 'Government' }], 'det1', '', {});
    expect(html).toContain('Client:</b> FEB');
  });
});

describe('arranging the assignments by client', () => {
  it('leaves them as recorded unless asked', () => {
    expect(arrangeExps(exps, clients, 'fy').list.map(e => e.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(arrangeExps(exps, clients, undefined).headingFor(exps[0])).toBeNull();
  });
  it('puts each client’s assignments together, clients A–Z, years kept in order', () => {
    const { list } = arrangeExps(exps, clients, 'client');
    // Council…, Federation…, Local Ward Office (the typed name matches however it was cased)
    expect(list.map(e => e.id)).toEqual(['b', 'a', 'c', 'd', 'e']);
  });
  it('heads each group once, on its first assignment, with its span and trainees', () => {
    const arranged = arrangeExps(exps, clients, 'client');
    const heads = arranged.list.map(e => arranged.headingFor(e)).filter(Boolean);
    expect(heads.map(h => h.name)).toEqual(['Council for Technical Education and Vocational Training', 'Federation of Employment Board', 'Local Ward Office']);
    const feb = heads[1];
    expect(clientGroupLine(feb)).toBe('Government · 2 assignments · FY 2079/80 – 2081/82 · 55 trainees');
    expect(clientGroupLine(heads[0])).toBe('Government · 1 assignment · FY 2080/81 · 20 trainees');
    expect(arranged.headingFor(arranged.list[2])).toBeNull();
  });
});

describe('the three outputs', () => {
  it('print: a heading per client, then its assignments', () => {
    const html = buildPrintHTML(inst, exps, clients, 'det1', '', { clients, groupBy: 'client' });
    expect(html.match(/class="client-head"/g)).toHaveLength(3);
    const order = [...html.matchAll(/class="ch-name">([^<]+)</g)].map(m => m[1]);
    expect(order).toEqual(['Council for Technical Education and Vocational Training', 'Federation of Employment Board', 'Local Ward Office']);
    // FEB's two assignments follow its heading before the next client starts
    expect(html.indexOf('FEB 2079')).toBeLessThan(html.indexOf('FEB 2081'));
    expect(html.indexOf('FEB 2081')).toBeLessThan(html.indexOf('class="ch-name">Local Ward Office'));
    expect(buildPrintHTML(inst, exps, clients, 'det1', '', { clients })).not.toContain('class="client-head"');
  });
  it('screen: the same banners', () => {
    const grouped = renderToStaticMarkup(renderAggregateTable(inst, exps, clients, 'det1', { groupBy: 'client', occupations: [] }));
    expect(grouped).toContain('Federation of Employment Board');
    expect(grouped).toContain('2 assignments');
    const plain = renderToStaticMarkup(renderAggregateTable(inst, exps, clients, 'det1', { occupations: [] }));
    expect(plain).not.toContain('2 assignments · FY');
  });
  it('Word: builds with the client headings', async () => {
    let built = null;
    await downloadDOCX(inst, exps, 'det1', { clients, groupBy: 'client', capture: (blob, name) => { built = { blob, name }; } });
    expect(built.name).toMatch(/\.docx$/);
    expect(built.blob.size).toBeGreaterThan(2000);
  });
});

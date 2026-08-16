/**
 * 4(B) as one table per occupation, all types together.
 *
 * By default the schedule breaks into lettered sub-tables — A. Personal
 * Protective Equipment, B. Tools and equipment, C. Training Consumables,
 * D. Stationery. That is four tables to read for one trade. This option puts
 * them in one, matching the Combined table layout the tools browser already
 * offers.
 *
 * The thing that must not be lost is *which* row is a consumable and which is
 * safety gear: the sub-table headings were carrying that, so dropping them has
 * to bring the Type column in.
 */
import { describe, it, expect } from 'vitest';
import bolpatra from '../src/reports/bolpatra.jsx';

const inst = { id: 1, name: 'Test Firm', infrastructure: [] };
const clients = [{ id: 1, fullName: 'NEA', shortName: 'NEA' }];
const occupations = [{ id: 10, name: 'Beautician' }, { id: 20, name: 'Tailoring' }];

const tools = {
  10: [
    { name: 'Hair dryer',  description: '', unit: 'pcs', quantity: 5, type: 'Tool' },
    { name: 'Cotton',      description: '', unit: 'kg',  quantity: 3, type: 'Consumable' },
    { name: 'Safety mask', description: '', unit: 'pcs', quantity: 8, type: 'Safety Tool' },
    { name: 'Notebook',    description: '', unit: 'pcs', quantity: 2, type: 'Stationery' },
  ],
  20: [
    { name: 'Sewing machine', description: '', unit: 'pcs', quantity: 4, type: 'Tool' },
    { name: 'Thread',         description: '', unit: 'roll', quantity: 9, type: 'Consumable' },
  ],
};

const render = (over = {}) => bolpatra.buildPrintHTML(inst, [], clients, '4b', null, {
  clients, occupations, bolpatraTools: tools, eoiToolsLevel: 'Level 1',
  selectedOccs: ['Beautician'],
  eoiToolCols: ['sn', 'name', 'unit', 'quantity'],
  ...over,
});

// Checked in heading form. "Stationery" on its own also appears as a Type
// cell value once the single table adds that column, so the bare word proves
// nothing either way.
const GROUP_HEADS = [
  'A. Personal Protective Equipment', 'B. Tools and equipment',
  'C. Training Consumables', 'D. Stationery',
];

/** Number of <table> elements in the tools part of the document. */
const tableCount = (html) => (html.match(/<table/g) || []).length;

describe('4(B) all types in one table', () => {
  it('splits into a sub-table per type by default', () => {
    const html = render();
    for (const h of GROUP_HEADS) expect(html, `missing "${h}"`).toContain(h);
  });

  it('drops the per-type headings when combining into one table', () => {
    const html = render({ eoiSingleTable: true });
    for (const h of GROUP_HEADS) expect(html, `"${h}" should be gone`).not.toContain(h);
    // No lettered heading of any kind. The occupation's own title also uses
    // .grp and must survive, so match the "A. " prefix rather than the class.
    expect(html).not.toMatch(/<div class="grp">[A-Z]\. /);
    expect(html, 'the occupation title should remain')
      .toContain('Tools and Equipment for Beautician Training');
  });

  it('produces fewer tables than there are types', () => {
    const split = tableCount(render());
    const one   = tableCount(render({ eoiSingleTable: true }));
    expect(one).toBeLessThan(split);
    expect(split - one).toBe(3); // four type tables become one
  });

  it('keeps every item, none dropped by the flattening', () => {
    const html = render({ eoiSingleTable: true });
    for (const name of ['Hair dryer', 'Cotton', 'Safety mask', 'Notebook']) {
      expect(html, `${name} vanished`).toContain(name);
    }
  });

  it('adds the Type column so the rows stay distinguishable', () => {
    // Type was deliberately not among the selected columns.
    expect(render()).not.toContain('>Type<');
    const html = render({ eoiSingleTable: true });
    expect(html).toContain('>Type<');
    expect(html).toContain('Consumable');
    expect(html).toContain('Safety Tool');
  });

  it('orders the rows safety → tools → consumables → stationery', () => {
    const html = render({ eoiSingleTable: true });
    const at = (s) => html.indexOf(s);
    expect(at('Safety mask')).toBeLessThan(at('Hair dryer'));
    expect(at('Hair dryer')).toBeLessThan(at('Cotton'));
    expect(at('Cotton')).toBeLessThan(at('Notebook'));
  });

  it('numbers straight through rather than restarting per type', () => {
    const html = render({ eoiSingleTable: true });
    const rows = [...html.matchAll(/<td[^>]*>(\d+)<\/td><td[^>]*>([^<]+)<\/td>/g)]
      .map(m => [m[1], m[2]]);
    const sns = rows.filter(r => ['Safety mask', 'Hair dryer', 'Cotton', 'Notebook'].includes(r[1]))
      .map(r => Number(r[0]));
    expect(sns).toEqual([1, 2, 3, 4]);
  });

  it('works together with combining across occupations', () => {
    const html = render({
      eoiSingleTable: true, eoiCombineTools: true,
      selectedOccs: ['Beautician', 'Tailoring'],
    });
    for (const h of GROUP_HEADS) expect(html).not.toContain(h);
    // Both trades' items land in the one table.
    for (const n of ['Hair dryer', 'Sewing machine', 'Cotton', 'Thread']) {
      expect(html, `${n} missing`).toContain(n);
    }
    expect(html).toContain('combined from Beautician, Tailoring');
  });

  it('still honours the type filter', () => {
    const html = render({ eoiSingleTable: true, eoiToolTypes: ['Consumable'] });
    expect(html).toContain('Cotton');
    expect(html).not.toContain('Hair dryer');
    expect(html).not.toContain('Safety mask');
  });

  it('does not force a duplicate Type column when one was already picked', () => {
    const html = render({
      eoiSingleTable: true,
      eoiToolCols: ['sn', 'name', 'type', 'quantity'],
    });
    expect((html.match(/>Type</g) || []).length).toBe(1);
  });

  it('leaves the default layout untouched', () => {
    expect(render({ eoiSingleTable: false })).toBe(render());
  });
});

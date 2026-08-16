/**
 * Combining the 4(B) tools schedule across occupations.
 *
 * The arithmetic is the whole point and the easiest thing to get quietly wrong:
 * each occupation's quantity is scaled by its own event count *before* merging,
 * because a trade running six events consumes six times as much. A single total
 * applied afterwards would be a different, wrong number.
 */
import { describe, it, expect } from 'vitest';
import bolpatra from '../src/reports/bolpatra.jsx';

const inst = { id: 1, name: 'Test Firm', infrastructure: [] };
const clients = [{ id: 1, fullName: 'NEA', shortName: 'NEA' }];
const exps = [];

const occupations = [
  { id: 10, name: 'Beautician' },
  { id: 20, name: 'Tailoring' },
];

// A drill shared by both trades, plus one item unique to each.
const tools = {
  10: [
    { name: 'Hand drill', description: '', unit: 'pcs', quantity: 2, type: 'Tool' },
    { name: 'Hair dryer', description: '', unit: 'pcs', quantity: 5, type: 'Tool' },
    { name: 'Cotton', description: '', unit: 'kg', quantity: 3, type: 'Consumable' },
  ],
  20: [
    { name: 'Hand drill', description: '', unit: 'pcs', quantity: 1, type: 'Tool' },
    { name: 'Sewing machine', description: '', unit: 'pcs', quantity: 4, type: 'Tool' },
  ],
};

const render = (over = {}) => bolpatra.buildPrintHTML(inst, exps, clients, '4b', null, {
  clients, occupations, bolpatraTools: tools, eoiToolsLevel: 'Level 1',
  selectedOccs: ['Beautician', 'Tailoring'],
  eoiToolCols: ['sn', 'name', 'unit', 'quantity'],
  ...over,
});

/** Quantity printed against a named tool, across the whole document. */
function quantitiesFor(html, name) {
  const out = [];
  // No whitespace between cells in the generated markup, so match them adjacent.
  const re = new RegExp(`<td[^>]*>${name}</td><td[^>]*>[^<]*</td><td[^>]*>([^<]*)</td>`, 'g');
  let m;
  while ((m = re.exec(html))) out.push(m[1].trim());
  return out;
}

describe('4(B) tools — separate vs combined', () => {
  it('lists a table per occupation by default', () => {
    const html = render();
    expect(html).toContain('Tools and Equipment for Beautician Training');
    expect(html).toContain('Tools and Equipment for Tailoring Training');
    expect(html).not.toContain('All selected occupations');
  });

  it('merges into one schedule when combining', () => {
    const html = render({ eoiCombineTools: true });
    expect(html).toContain('All selected occupations');
    expect(html).not.toContain('Tools and Equipment for Beautician Training');
    expect(html).not.toContain('Tools and Equipment for Tailoring Training');
    // and says what it merged, since the event counts are already applied
    expect(html).toContain('combined from Beautician, Tailoring');
  });

  it('sums a shared item and leaves unique ones alone', () => {
    const html = render({ eoiCombineTools: true });
    // Hand drill: 2 (Beautician) + 1 (Tailoring) = 3, appearing once.
    expect(quantitiesFor(html, 'Hand drill')).toEqual(['3']);
    expect(quantitiesFor(html, 'Hair dryer')).toEqual(['5']);
    expect(quantitiesFor(html, 'Sewing machine')).toEqual(['4']);
  });

  it('applies each occupation’s own event count before merging', () => {
    // Beautician runs 6 events, Tailoring 2.
    // Hand drill = 2×6 + 1×2 = 14. A single multiplier could not produce this.
    const html = render({ eoiCombineTools: true, eoiEventsByOcc: { 10: 6, 20: 2 } });
    expect(quantitiesFor(html, 'Hand drill')).toEqual(['14']);
    expect(quantitiesFor(html, 'Hair dryer')).toEqual(['30']);   // 5×6
    expect(quantitiesFor(html, 'Sewing machine')).toEqual(['8']); // 4×2
  });

  it('keeps the type grouping', () => {
    const html = render({ eoiCombineTools: true });
    // Cotton is a Consumable and must not land among the Tools.
    expect(html).toContain('Cotton');
    const toolsIdx = html.indexOf('Hand drill');
    const cottonIdx = html.indexOf('Cotton');
    expect(cottonIdx).toBeGreaterThan(toolsIdx);
  });

  it('does not merge items that only look alike', () => {
    const sized = {
      10: [{ name: 'Spanner', description: '12mm', unit: 'pcs', quantity: 1, type: 'Tool' }],
      20: [{ name: 'Spanner', description: '16mm', unit: 'pcs', quantity: 1, type: 'Tool' }],
    };
    const html = bolpatra.buildPrintHTML(inst, exps, clients, '4b', null, {
      clients, occupations, bolpatraTools: sized, eoiToolsLevel: 'Level 1',
      selectedOccs: ['Beautician', 'Tailoring'], eoiCombineTools: true,
      eoiToolCols: ['sn', 'name', 'description', 'unit', 'quantity'],
    });
    expect(html).toContain('12mm');
    expect(html).toContain('16mm');
  });

  it('still honours the type filter', () => {
    const html = render({ eoiCombineTools: true, eoiToolTypes: ['Consumable'] });
    expect(html).toContain('Cotton');
    expect(html).not.toContain('Hand drill');
  });

  it('names the single occupation rather than "all" when only one is picked', () => {
    const html = render({ eoiCombineTools: true, selectedOccs: ['Beautician'] });
    expect(html).toContain('Beautician');
    expect(html).not.toContain('All selected occupations');
  });
});

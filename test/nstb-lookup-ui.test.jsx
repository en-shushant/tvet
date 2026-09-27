import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
vi.mock('../src/utils/api.js', () => ({
  api: vi.fn(async (_m, _p, body) => body.symbolNo === '111'
    ? { found: true, result: { name: 'Sita Karki', fatherName: 'Ram Karki', symbolNo: '111', occupation: 'Plumber',
        level: 'Level 2', year: '2079', certificateNo: 'NSTB-99', testCenter: 'Balaju', performance: 'Standard Met', outcome: 'pass' } }
    : body.symbolNo === '222'
      ? { found: true, result: { name: 'Sita Karki', symbolNo: '222', occupation: 'Plumber', level: 'Level 3', year: '2081',
          performance: 'Standard Not Met', outcome: 'fail' } }
      : { found: false }),
}));
vi.mock('../src/utils/auth.js', () => ({ getSession: () => ({ token: 't' }) }));
const { default: NstbLookup } = await import('../src/components/pool/NstbLookup.jsx');

const flush = () => act(async () => { await new Promise(r => setTimeout(r, 0)); });
const setVal = async (el, v) => { await act(async () => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true })); }); };

describe('NSTB lookup panel', () => {
  it('looks up several symbol numbers and adds only passed results', async () => {
    const added = [], filled = [];
    const el = document.createElement('div'); document.body.appendChild(el);
    const root = createRoot(el);
    await act(async () => root.render(<NstbLookup dob="2058/09/11" onDob={() => {}} personName=""
      occupations={[{ id: 7, name: 'Plumber', level: 'Level 2' }]} existing={[]}
      onAdd={r => added.push(r)} onFillPerson={p => filled.push(p)}/>));
    const btn = (t) => [...el.querySelectorAll('button')].find(b => b.textContent.includes(t));
    await act(async () => btn('Another level').click());
    const inputs = [...el.querySelectorAll('input[aria-label^="Symbol number"]')];
    await setVal(inputs[0], '111'); await setVal(inputs[1], '222');
    await act(async () => btn('Look up all').click()); await flush();
    const cards = [...el.querySelectorAll('.nstb-card')];
    expect(cards).toHaveLength(2);
    expect(cards[0].textContent).toContain('Passed');
    expect(cards[1].textContent).toContain('Not met');
    expect(cards[1].textContent).toContain('Only a passed test is added');
    await act(async () => btn('Add as certificate').click());
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ level: 'Level 2', occupation_id: 7, certificate_no: 'NSTB-99', passed_year: '2079' });
    expect(filled[0]).toEqual({ full_name: 'Sita Karki', father_name: 'Ram Karki' });
    expect(el.textContent).toContain('Added to vocational certificates');
    await act(async () => root.unmount()); el.remove();
  });
});

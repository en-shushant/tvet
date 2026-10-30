/**
 * The Tenders page: the list with its figures, and opening a tender from it.
 *
 * Opening a tender swaps the list for the workspace inside the same component,
 * so every hook has to run on both renders. A hook placed after that swap
 * crashed the page to a white screen on the first "Open" — and nothing rendered
 * this screen to notice. These tests do.
 */
import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { assertNoConsoleErrors } from './setup.js';
import { installFetchStub, institutes, clients, occupations } from './fixtures.js';
import { SESSION_KEY } from '../src/utils/auth.js';
import TendersView from '../src/components/TendersView.jsx';

let container, root;

const stage = (o) => ({
  id: 1, title: 'Skill training, Budhanilkantha', stage: 'EOI', status: 'Preparing', reference_no: 'BNP-1',
  submission_date: '', parent_tender_id: null, bidders: [{ id: 5, display_name: 'WLTTI', firms: [{ institute_id: 1, name: 'WLTTI', role: 'Lead' }] }],
  proposed_count: 0, ...o,
});
const list = [
  stage({ id: 1 }),
  stage({ id: 2, title: 'Awarded one', status: 'Awarded' }),
  stage({ id: 3, title: 'Lost one', status: 'Lost' }),
  stage({ id: 4, title: 'Submitted one', status: 'Submitted' }),
];
const detail = (id) => ({
  ...list.find(t => t.id === id), occupations: [], positions: [], people: [], led_to: [], came_from: null,
  bidders: list.find(t => t.id === id).bidders.map(b => ({ ...b, status: 'Preparing' })),
});

beforeEach(() => {
  window.scrollTo = () => {};          // jsdom does not implement it; the steps scroll to the top
  globalThis.localStorage = {
    _m: new Map([[SESSION_KEY, JSON.stringify({ role: 'superadmin', token: 't', canAccessTenders: true })]]),
    getItem(k) { return this._m.has(k) ? this._m.get(k) : null; }, setItem(k, v) { this._m.set(k, String(v)); }, removeItem(k) { this._m.delete(k); },
  };
  installFetchStub();
  const inner = globalThis.fetch;
  globalThis.fetch = (url, opts) => {
    const u = String(url);
    const json = (b) => Promise.resolve(new Response(JSON.stringify(b), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const one = u.match(/\/tenders\/(\d+)(?:\?|$)/);
    if (one) return json(detail(Number(one[1])));
    if (u.includes('/tenders/cv-variants')) return json([]);
    if (/\/tenders(\?|$)/.test(u)) return json(list);
    return inner(url, opts);
  };
  container = document.createElement('div');
  document.body.appendChild(container);
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  container.remove();
  delete globalThis.localStorage;
});

const flush = async () => {
  await act(async () => { await new Promise(r => setTimeout(r, 0)); });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
};
async function mount() {
  await act(async () => {
    root = createRoot(container);
    root.render(<TendersView institutes={institutes} clients={clients} occupations={occupations} />);
  });
  await flush(); await flush(); await flush();
}
const click = async (el) => { await act(async () => { el.click(); }); await flush(); await flush(); };
const buttons = (text) => [...container.querySelectorAll('button, [role=button], [data-md]')].filter(b => b.textContent.trim() === text);

describe('the list and its figures', () => {
  it('shows the four figures from every bid', async () => {
    await mount();
    const cards = [...container.querySelectorAll('.tw-kpis .kpi-card')].map(c => c.textContent);
    expect(cards).toHaveLength(4);
    expect(cards.join('|')).toMatch(/Being prepared/);
    expect(cards.join('|')).toMatch(/Awarded/);
    assertNoConsoleErrors();
  });
});

describe('opening a tender', () => {

  it('shows the workspace instead of a white screen, with its step bar', async () => {
    await mount();
    await click(buttons('Open')[0]);
    expect(container.textContent).toContain('Skill training, Budhanilkantha');
    expect(container.querySelector('.tw-rail')).not.toBeNull();
    expect([...container.querySelectorAll('.tw-rail .tw-step-label')].map(e => e.textContent))
      .toEqual(['Overview', 'Notice', 'Requirements', 'Bidders', 'Team', 'Submit']);
    assertNoConsoleErrors();
  });

  it('opens every step without an error, and comes back to the list', async () => {
    await mount();
    await click(buttons('Open')[0]);
    for (const step of [...container.querySelectorAll('.tw-rail .tw-step')]) {
      if (step.disabled) continue;
      await click(step);
      expect(container.textContent.length).toBeGreaterThan(200);
    }
    await click([...container.querySelectorAll('button')].find(b => /All tenders/.test(b.textContent)));
    expect(container.querySelector('.tw-kpis')).not.toBeNull();
    assertNoConsoleErrors();
  });
});

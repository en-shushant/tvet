/**
 * The Shortlisting filter bar has to reach the firms under a standing list.
 *
 * Every shortlist row in this registry carries a standing_list_id, and the
 * `filtered` list deliberately drops those (they render under their own list
 * card). So the filter bar was driving a section that is always empty — the
 * page read "0 entries" permanently, and the section that did have data was
 * built straight off `rows`, ignoring every filter.
 *
 * Organisation is matched by name rather than client_id on purpose: firms are
 * attached by POST /standing-lists/:id/firms, which copies client_name_manual
 * and never sets client_id, so those rows always have client_id NULL.
 */
import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { assertNoConsoleErrors } from './setup.js';
import { institutes, clients } from './fixtures.js';
import Shortlisting from '../src/components/Shortlisting.jsx';

const LISTS = [
  { id: 1, name: 'Standing List A', fy: '2081/82', client_name_manual: 'Helvetas Nepal', status: 'Active', list_date: '2024-01-01' },
  { id: 2, name: 'Standing List B', fy: '2082/83', client_name_manual: 'Never Engaged Trust', status: 'Active', list_date: '2024-02-01' },
];
// institutes[0] and [1] come from the shared fixture
const ROWS = [
  { id: 11, standing_list_id: 1, institute_id: institutes[0].id, institute_name: institutes[0].name,
    institute_acronym: institutes[0].acronym, client_id: null, client_name_manual: 'Helvetas Nepal',
    standing_list_name: 'Standing List A', fy: '2081/82', status: 'Active', shortlist_date: '2024-01-01' },
  { id: 12, standing_list_id: 1, institute_id: institutes[1].id, institute_name: institutes[1].name,
    institute_acronym: institutes[1].acronym, client_id: null, client_name_manual: 'Helvetas Nepal',
    standing_list_name: 'Standing List A', fy: '2081/82', status: 'Active', shortlist_date: '2024-01-01' },
  { id: 21, standing_list_id: 2, institute_id: institutes[0].id, institute_name: institutes[0].name,
    institute_acronym: institutes[0].acronym, client_id: null, client_name_manual: 'Never Engaged Trust',
    standing_list_name: 'Standing List B', fy: '2082/83', status: 'Active', shortlist_date: '2024-02-01' },
];

let container, root;
beforeEach(() => {
  // This jsdom setup provides sessionStorage but not localStorage, and
  // getCurrentFY() reads the active year from it.
  const store = new Map([['tvettrack_current_fy', '2081/82']]);
  globalThis.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
    clear: () => store.clear(),
  };
  globalThis.fetch = (url) => {
    const u = String(url);
    const json = (b) => Promise.resolve(new Response(JSON.stringify(b), {
      status: 200, headers: { 'Content-Type': 'application/json' } }));
    if (u.includes('/standing-lists')) return json(LISTS);
    if (u.includes('/shortlists')) return json(ROWS);
    if (u.includes('/contracts') || u.includes('/quotations')) return json([]);
    return json([]);
  };
  container = document.createElement('div'); document.body.appendChild(container);
});
afterEach(async () => { await act(async () => { root?.unmount(); }); container.remove(); delete globalThis.localStorage; });

const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };
async function mount() {
  await act(async () => {
    root = createRoot(container);
    root.render(<Shortlisting institutes={institutes} clients={clients} isAdmin isEditor={false}
      isShortlistOnly={false} isSuperAdmin={false} token="t"/>);
  });
  await flush(); await flush(); await flush();
}
const setSel = (s, v) => { const f = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set; f.call(s, v); s.dispatchEvent(new Event('change', { bubbles: true })); };
const selByFirstOption = (label) => [...container.querySelectorAll('select')]
  .find(s => s.options[0] && s.options[0].textContent === label);
const entryCount = () => {
  const m = container.textContent.match(/(\d+)\s+(entry|entries)/);
  return m ? parseInt(m[1]) : null;
};

describe('Shortlisting filters reach standing-list firms', () => {
  it('counts the firms under standing lists, not just the empty legacy set', async () => {
    await mount();
    // FY defaults to the current year (2081/82), which matches list A's two firms
    expect(entryCount()).toBe(2);
    assertNoConsoleErrors();
  });

  it('defaults the FY filter to the active fiscal year', async () => {
    await mount();
    expect(selByFirstOption('All FYs').value).toBe('2081/82');
  });

  it('falls back to the newest year on record when no active FY is configured', async () => {
    // Real registries exist where nobody has set one in Master Data; defaulting
    // to nothing there would leave the filter the user asked for switched off.
    globalThis.localStorage.removeItem('tvettrack_current_fy');
    await mount();
    expect(selByFirstOption('All FYs').value).toBe('2082/83');
  });

  it('leaves the filter off when the configured year has no records', async () => {
    // Otherwise the page opens empty behind a filter the user never set.
    globalThis.localStorage.setItem('tvettrack_current_fy', '2099/00');
    await mount();
    expect(selByFirstOption('All FYs').value).toBe('2082/83'); // newest present, not the empty year
  });

  it('changing FY re-filters the standing-list firms', async () => {
    await mount();
    await act(async () => { setSel(selByFirstOption('All FYs'), '2082/83'); });
    await flush();
    expect(entryCount()).toBe(1);                       // only list B's firm
    expect(container.textContent).toContain('Standing List B');
    expect(container.textContent).not.toContain('Standing List A');
  });

  it('clearing FY shows every list again', async () => {
    await mount();
    await act(async () => { setSel(selByFirstOption('All FYs'), ''); });
    await flush();
    expect(entryCount()).toBe(3);
    expect(container.textContent).toContain('Standing List A');
    expect(container.textContent).toContain('Standing List B');
  });

  it('filters by firm across lists', async () => {
    await mount();
    await act(async () => { setSel(selByFirstOption('All FYs'), ''); });               // widen to all years
    await flush();
    await act(async () => { setSel(selByFirstOption('All firms'), String(institutes[1].id)); });
    await flush();
    expect(entryCount()).toBe(1);                       // that firm is only on list A
  });

  it('filters by organisation even though these rows carry no client_id', async () => {
    await mount();
    await act(async () => { setSel(selByFirstOption('All FYs'), ''); });
    await flush();
    const helvetas = clients.find(c => /Helvetas/.test(c.fullName));
    await act(async () => { setSel(selByFirstOption('All organizations'), String(helvetas.id)); });
    await flush();
    expect(entryCount()).toBe(2);                       // both firms on list A
    expect(container.textContent).not.toContain('Standing List B');
    assertNoConsoleErrors();
  });
});

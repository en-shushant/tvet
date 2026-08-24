/**
 * A standing list you have just created has to be visible.
 *
 * Reported as: "I created a new shortlist, it does not show in the list, but
 * when I select All FY it shows."
 *
 * Two causes, and both are here. A brand-new list has no firms assigned yet,
 * and the visible-list rule judged a list purely by whether its *firms* matched
 * the filter bar — a list with none can only ever answer "no", so it vanished
 * the moment any filter was on, including the fiscal year this screen sets for
 * itself on load. "All FYs" clears the last filter and takes the unfiltered
 * path, which is why it reappeared there and nowhere else.
 *
 * And fy is optional on a standing list, so a list created without one could
 * never equal any year being filtered for.
 */
import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { assertNoConsoleErrors } from './setup.js';
import { institutes, clients } from './fixtures.js';
import Shortlisting from '../src/components/Shortlisting.jsx';

const POPULATED = { id: 1, name: 'Standing List A', fy: '2081/82',
  client_name_manual: 'Helvetas Nepal', status: 'Active', list_date: '2024-01-01' };
/** Created just now, in the active year, with nobody assigned to it yet. */
const BRAND_NEW = { id: 2, name: 'Standing List B', fy: '2081/82',
  client_name_manual: 'Sudurpaschim Province Office', status: 'Active', list_date: '2024-03-01' };
/** Created just now and saved without a fiscal year, which the form allows. */
const NO_FY = { id: 3, name: 'Standing List C', fy: null,
  client_name_manual: 'Bagmati Province Office', status: 'Active', list_date: '2024-03-02' };
/** Populated, but for a different year — this one *should* be filtered out. */
const OTHER_YEAR = { id: 4, name: 'Standing List D', fy: '2079/80',
  client_name_manual: 'Karnali Province Office', status: 'Active', list_date: '2022-01-01' };

const ROWS = [
  { id: 11, standing_list_id: 1, institute_id: institutes[0].id, institute_name: institutes[0].name,
    institute_acronym: institutes[0].acronym, client_id: null, client_name_manual: 'Helvetas Nepal',
    standing_list_name: 'Standing List A', fy: '2081/82', status: 'Active', shortlist_date: '2024-01-01' },
  { id: 41, standing_list_id: 4, institute_id: institutes[1].id, institute_name: institutes[1].name,
    institute_acronym: institutes[1].acronym, client_id: null, client_name_manual: 'Karnali Province Office',
    standing_list_name: 'Standing List D', fy: '2079/80', status: 'Active', shortlist_date: '2022-01-01' },
];

let container, root, lists;

beforeEach(() => {
  lists = [POPULATED, BRAND_NEW, NO_FY, OTHER_YEAR];
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
    if (u.includes('/standing-lists')) return json(lists);
    if (u.includes('/shortlists')) return json(ROWS);
    return json([]);
  };
  container = document.createElement('div'); document.body.appendChild(container);
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  container.remove(); delete globalThis.localStorage;
});

const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };
async function mount() {
  await act(async () => {
    root = createRoot(container);
    root.render(<Shortlisting institutes={institutes} clients={clients} isAdmin isEditor={false}
      isShortlistOnly={false} isSuperAdmin={false} token="t"/>);
  });
  await flush(); await flush(); await flush();
}

const shows = (name) => container.textContent.includes(name);
const fySelect = () => [...container.querySelectorAll('select')]
  .find(s => [...s.options].some(o => /All FYs/i.test(o.textContent)));
const setSelect = async (el, v) => {
  const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
  await act(async () => { set.call(el, v); el.dispatchEvent(new Event('change', { bubbles: true })); });
  await flush();
};

describe('the fiscal year this screen sets for itself on load', () => {
  it('defaults to the active year', async () => {
    await mount();
    expect(fySelect()?.value).toBe('2081/82');
  });

  it('still shows a list created in that year with no firms yet', async () => {
    // The reported bug. Nothing about having no members should hide a list
    // that matches the filter perfectly well on its own.
    await mount();
    expect(shows('Sudurpaschim Province Office'), 'new empty list hidden by the default FY').toBe(true);
    assertNoConsoleErrors();
  });

  it('still shows a list saved without a fiscal year', async () => {
    // fy is optional on a standing list, so a record that names no year has
    // nothing to contradict the filter with.
    await mount();
    expect(shows('Bagmati Province Office'), 'FY-less list hidden by the FY filter').toBe(true);
  });

  it('keeps hiding a populated list from another year', async () => {
    // The filter still has to filter — this is what stops the fix from being
    // "show everything".
    await mount();
    expect(shows('Karnali Province Office')).toBe(false);
  });

  it('shows the populated list for that year', async () => {
    await mount();
    expect(shows('Helvetas Nepal')).toBe(true);
  });
});

describe('switching to All FYs', () => {
  it('brings back the list from the other year too', async () => {
    await mount();
    await setSelect(fySelect(), '');
    for (const name of ['Helvetas Nepal', 'Sudurpaschim Province Office',
                        'Bagmati Province Office', 'Karnali Province Office']) {
      expect(shows(name), `${name} missing under All FYs`).toBe(true);
    }
  });

  it('is no longer the only way to see a new list', async () => {
    // The precise shape of the report: visible under All FYs, invisible under
    // the default. Both must now agree for a list in the active year.
    await mount();
    const underDefault = shows('Sudurpaschim Province Office');
    await setSelect(fySelect(), '');
    const underAll = shows('Sudurpaschim Province Office');
    expect(underDefault).toBe(underAll);
  });
});

describe('other filters against an empty list', () => {
  it('hides it when filtering for a specific firm', async () => {
    // A list with no firms holds none of that firm's entries, so it has no
    // business appearing in an answer to "show me this firm".
    await mount();
    const firmSelect = [...container.querySelectorAll('select')]
      .find(s => [...s.options].some(o => /All firms/i.test(o.textContent)));
    expect(firmSelect, 'firm filter not found').toBeTruthy();
    await setSelect(firmSelect, String(institutes[0].id));
    expect(shows('Sudurpaschim Province Office')).toBe(false);
    expect(shows('Helvetas Nepal'), 'the list that does hold that firm').toBe(true);
  });

  it('hides it when the search text matches nothing on it', async () => {
    await mount();
    const box = container.querySelector('input[placeholder*="Search" i]');
    expect(box, 'search box not found').toBeTruthy();
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    await act(async () => { set.call(box, 'Karnali'); box.dispatchEvent(new Event('input', { bubbles: true })); });
    await flush();
    expect(shows('Sudurpaschim Province Office')).toBe(false);
  });

  it('finds it when the search text does match', async () => {
    await mount();
    const box = container.querySelector('input[placeholder*="Search" i]');
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    await act(async () => { set.call(box, 'Sudurpaschim'); box.dispatchEvent(new Event('input', { bubbles: true })); });
    await flush();
    expect(shows('Sudurpaschim Province Office')).toBe(true);
  });
});

/**
 * Choosing whether superadmin-only assignments belong in a report.
 *
 * A superadmin holds these assignments, so the question is not who may fetch
 * them but whether this particular document should carry them — a report copy
 * going outside must not, and the same report generated for internal use
 * usually should. The switch defaults to including them, which is both the
 * behaviour before this existed and the reason the restricted flag was added.
 *
 * What is worth pinning: that unchecking it actually removes the assignment
 * from the set the report is built from (not merely from the checklist), that
 * the control is absent when there is nothing restricted to decide about, and
 * that flipping it marks the rendered preview stale — otherwise the export
 * would still hold what the switch was meant to drop.
 */
import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { act } from 'react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRoot } from 'react-dom/client';
import { assertNoConsoleErrors } from './setup.js';
import { institutes, clients, installFetchStub } from './fixtures.js';
import ReportsView from '../src/components/ReportsView.jsx';

const OPEN = 'Skills for Employment';
const RESTRICTED = 'Confidential canal survey';

/** The detail payload for firm 1, in the snake_case the API actually returns. */
function detail({ withRestricted }) {
  const occ = (name) => ({
    id: `o-${name}`, ctevt_occupation_id: 1, name_in_letter: name, level: 'Level 1',
    duration_hours: '390', trainees: '40', locations: [],
  });
  const base = institutes[0];
  const rows = [
    { id: 1, fiscal_year: '2081/82', assignment_name: OPEN, client_id: 1,
      is_superadmin_only: false, occupations: [occ('Beautician')] },
  ];
  if (withRestricted) {
    rows.push({ id: 2, fiscal_year: '2081/82', assignment_name: RESTRICTED, client_id: 1,
      is_superadmin_only: true, occupations: [occ('Surveyor')] });
  }
  return { ...base, reg_no: base.regNo, experience: rows, nstb: [], tax_clearance: [], affiliations: [] };
}

let container, root;

function mountWith({ withRestricted }) {
  installFetchStub();
  const base = globalThis.fetch;
  globalThis.fetch = (url, ...rest) => {
    const u = String(url);
    if (/\/institutes\/\d+$/.test(u)) {
      return Promise.resolve(new Response(JSON.stringify(detail({ withRestricted })), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      }));
    }
    if (u.includes('/occupation-tools')) {
      return Promise.resolve(new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }
    return base(url, ...rest);
  };
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});
afterEach(async () => { await act(async () => { root?.unmount(); }); container.remove(); });

const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };
const click = async (el) => { await act(async () => { el.click(); }); await flush(); };
const tab = (label) => [...container.querySelectorAll('[role=tab]')]
  .find(b => b.textContent.trim().startsWith(label));
const items = () => [...container.querySelectorAll('.multi-select-item')];
const itemFor = (text) => items().find(l => l.textContent.includes(text));
const restrictedSwitch = () => itemFor('superadmin-only assignment')?.querySelector('input[type=checkbox]');

const setSel = (el, v) => {
  const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
  set.call(el, v); el.dispatchEvent(new Event('change', { bubbles: true }));
};

/** Choose a family and report, then the firm — the checklists only exist after. */
async function open({ withRestricted = true } = {}) {
  mountWith({ withRestricted });
  await act(async () => {
    root = createRoot(container);
    root.render(<ReportsView institutes={institutes} clients={clients}/>);
  });
  await flush(); await flush();
  // helvetas is the default family; the firm list is a radio, one firm at a time.
  await act(async () => { setSel([...container.querySelectorAll('select')][0], 'helvetas'); });
  await flush();
  await click(items()[0].querySelector('input[type=radio]'));
  await flush();
}

describe('when there is nothing restricted to decide about', () => {
  it('does not offer the switch at all', async () => {
    await open({ withRestricted: false });
    await click(tab('Filters'));
    expect(restrictedSwitch(), 'switch shown with no restricted assignments').toBeUndefined();
    assertNoConsoleErrors();
  });
});

describe('when the firm has a restricted assignment', () => {
  it('offers the switch, checked, and says how many', async () => {
    await open();
    await click(tab('Filters'));
    const box = restrictedSwitch();
    expect(box, 'switch missing').toBeTruthy();
    expect(box.checked, 'must default to including them').toBe(true);
    expect(itemFor('superadmin-only assignment').textContent).toMatch(/Include 1 superadmin-only assignment(?!s)/);
  });

  it('lists the restricted assignment among the selectable ones', async () => {
    await open();
    await click(tab('Advanced'));
    expect(itemFor(RESTRICTED), 'restricted assignment missing from the checklist').toBeTruthy();
    // Marked, so ticking it is a considered choice rather than an oversight.
    expect(itemFor(RESTRICTED).querySelector('.material-icons-round')?.textContent).toBe('lock');
    expect(itemFor(OPEN).querySelector('.material-icons-round')).toBeNull();
  });

  it('drops it from the report when unchecked', async () => {
    await open();
    await click(tab('Filters'));
    await click(restrictedSwitch());

    await click(tab('Advanced'));
    expect(itemFor(RESTRICTED), 'restricted assignment still on offer').toBeUndefined();
    expect(itemFor(OPEN), 'the ordinary assignment was dropped too').toBeTruthy();
  });

  it('brings it back when checked again', async () => {
    await open();
    await click(tab('Filters'));
    await click(restrictedSwitch());
    await click(restrictedSwitch());
    await click(tab('Advanced'));
    expect(itemFor(RESTRICTED)).toBeTruthy();
  });

  it('changes what the consequence line says', async () => {
    await open();
    await click(tab('Filters'));
    expect(itemFor('superadmin-only assignment').textContent).toMatch(/before exporting a copy for anyone outside/i);
    await click(restrictedSwitch());
    expect(itemFor('superadmin-only assignment').textContent).toMatch(/Left out of every table, total and export/i);
  });
});

describe('the preview cannot go stale behind the switch', () => {
  it('counts exclusion in the filter signature', () => {
    // Flipping it must invalidate the rendered preview. If the signature
    // ignored it, the export would still carry the assignments the switch
    // was flipped to remove — the one failure that loses the data quietly.
    const source = readFileSync(
      path.resolve(import.meta.dirname, '../src/components/ReportsView.jsx'), 'utf8');
    const sig = source.slice(source.indexOf('const filterSig = JSON.stringify(['),
                          source.indexOf(']);', source.indexOf('const filterSig')));
    expect(sig).toMatch(/includeRestricted/);
  });

  it('counts exclusion as an active filter', () => {
    const source = readFileSync(
      path.resolve(import.meta.dirname, '../src/components/ReportsView.jsx'), 'utf8');
    const count = source.slice(source.indexOf('const filtersActiveCount = ['),
                               source.indexOf('].filter(Boolean).length;', source.indexOf('const filtersActiveCount')));
    expect(count).toMatch(/restrictedCount > 0 && !includeRestricted/);
  });

  it('returns to including them on reset', () => {
    const source = readFileSync(
      path.resolve(import.meta.dirname, '../src/components/ReportsView.jsx'), 'utf8');
    const reset = source.slice(source.indexOf('const handleReset = ()'),
                               source.indexOf('setRenderedSig(null);', source.indexOf('const handleReset')));
    expect(reset).toMatch(/setIncludeRestricted\(true\)/);
  });
});

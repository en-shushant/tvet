/**
 * Master data mutations must reach mounted components.
 *
 * OCCUPATIONS and PROVINCES are module-level arrays mutated in place. React
 * cannot see a mutation, so adding an occupation in Master data left every
 * other mounted consumer — the assignment editor's dropdown, the command
 * palette — showing a stale list until the page was reloaded. Master data's own
 * list appeared to work only because saving also closed a modal, which happened
 * to trigger a re-render.
 *
 * Each test here fails against the previous direct-read implementation, which
 * is the only reason to trust it.
 */
import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { assertNoConsoleErrors } from './setup.js';
import { installFetchStub, occupations, clients, institutes } from './fixtures.js';
import { OCCUPATIONS, notifyMasterData, getMasterDataVersion } from '../src/constants/data.js';
import { useOccupations } from '../src/utils/useMasterData.js';
import CommandPalette from '../src/components/CommandPalette.jsx';

let container;
let root;

beforeEach(() => {
  installFetchStub();
  OCCUPATIONS.splice(0, OCCUPATIONS.length, ...occupations);
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  container.remove();
});

async function mount(element) {
  await act(async () => {
    root = createRoot(container);
    root.render(element);
  });
  await act(async () => { await Promise.resolve(); });
}

/** Renders whatever the hook returns, so a stale read is visible as text. */
function OccupationList() {
  const occs = useOccupations();
  return <ul>{occs.map(o => <li key={o.id}>{o.name}</li>)}</ul>;
}

describe('master data reaches mounted components', () => {
  it('a subscriber re-renders when an occupation is added', async () => {
    await mount(<OccupationList />);
    expect(container.textContent).toContain('Beautician');
    expect(container.textContent).not.toContain('Welding');

    await act(async () => {
      OCCUPATIONS.push({ id: 99, name: 'Welding', sector: 'Construction', level: 'Level 2' });
      notifyMasterData();
    });

    // The assertion the old implementation failed: no state changed here, only
    // the array, so a direct reader would still be showing the stale list.
    expect(container.textContent).toContain('Welding');
    assertNoConsoleErrors();
  });

  it('a subscriber re-renders when an occupation is removed', async () => {
    await mount(<OccupationList />);
    expect(container.textContent).toContain('Tailoring');

    await act(async () => {
      OCCUPATIONS.splice(OCCUPATIONS.findIndex(o => o.name === 'Tailoring'), 1);
      notifyMasterData();
    });

    expect(container.textContent).not.toContain('Tailoring');
    assertNoConsoleErrors();
  });

  it('keeps array identity stable between mutations', async () => {
    // Stability matters: the hook's result is used as a useMemo dependency, and
    // a new array on every render would defeat every memo downstream.
    const seen = [];
    function Probe() {
      const occs = useOccupations();
      seen.push(occs);
      return <span>{occs.length}</span>;
    }
    await mount(<Probe />);
    const before = seen.length;
    // Force re-renders that are not master-data changes.
    await act(async () => { root.render(<Probe />); });
    await act(async () => { root.render(<Probe />); });
    expect(seen.length).toBeGreaterThan(before);
    expect(seen.every(a => a === seen[0]), 'identity changed without a mutation').toBe(true);

    await act(async () => {
      OCCUPATIONS.push({ id: 100, name: 'Plumbing', sector: 'Construction' });
      notifyMasterData();
    });
    expect(seen[seen.length - 1]).not.toBe(seen[0]);
  });

  it('the version advances on every notification', () => {
    const before = getMasterDataVersion();
    notifyMasterData();
    expect(getMasterDataVersion()).toBe(before + 1);
  });

  it('unsubscribes on unmount without leaking', async () => {
    await mount(<OccupationList />);
    await act(async () => { root.unmount(); root = null; });
    // A notification after unmount must not attempt to update a dead root;
    // React logs that as an error, which assertNoConsoleErrors catches.
    await act(async () => { notifyMasterData(); });
    assertNoConsoleErrors();
  });

  it('the command palette sees a newly added occupation', async () => {
    await mount(<CommandPalette open onClose={() => {}} institutes={institutes}
      clients={clients} actions={[]} />);

    // Search first, while the occupation does not exist yet. Typing afterwards
    // would re-render the palette anyway and hide a stale read — the query has
    // to be already in place for this to test subscription rather than input.
    const input = document.querySelector('input[aria-label="Search TVETtrack"]');
    const setValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    await act(async () => {
      setValue.call(input, 'Scaffold');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(document.body.textContent).not.toContain('Scaffolding');

    await act(async () => {
      OCCUPATIONS.push({ id: 101, name: 'Scaffolding', sector: 'Construction' });
      notifyMasterData();
    });

    expect(document.body.textContent).toContain('Scaffolding');
    assertNoConsoleErrors();
  });
});

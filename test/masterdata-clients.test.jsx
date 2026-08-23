/**
 * The Clients tab: reconciling typed-in names, and merging duplicates.
 *
 * Driven through the rendered UI rather than by calling the handlers directly.
 * The distinction this screen has to get right is between a typed name that is
 * genuinely missing from master data and one that already exists and was simply
 * typed instead of picked — offering the same "add" affordance for both would
 * create a second copy of the client, which is precisely the mess the merge
 * button beside it exists to clean up.
 */
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { assertNoConsoleErrors } from './setup.js';
import { installFetchStub, occupations, clients } from './fixtures.js';
import { OCCUPATIONS } from '../src/constants/data.js';
import MasterData from '../src/components/MasterData.jsx';
import FeedbackHost from '../src/components/ui/Feedback.jsx';

const MISSING = { key: 'department of roads', name: 'Department of Roads', uses: 4, assignments: 4,
  tables: ['assignments'], match_id: null, match_short_name: null, match_full_name: null };
const KNOWN = { key: 'ministry of labour', name: 'ministry of labour', uses: 2, assignments: 2,
  tables: ['assignments'], match_id: 1, match_short_name: 'MoLESS', match_full_name: 'Ministry of Labour' };

let container, root, requests, unlinkedRows;

beforeEach(() => {
  installFetchStub();
  const inner = globalThis.fetch;
  requests = [];
  unlinkedRows = [MISSING, KNOWN];
  globalThis.fetch = (url, opts = {}) => {
    const u = String(url);
    const method = (opts.method || 'GET').toUpperCase();
    requests.push({ url: u, method, body: opts.body ? JSON.parse(opts.body) : null });
    const json = (b) => Promise.resolve(new Response(JSON.stringify(b), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }));
    if (u.includes('/clients/unlinked')) return json(unlinkedRows);
    if (u.includes('/clients/usage')) return json(clients.map(c => ({ id: c.id, assignments: 3, records: 5 })));
    if (u.includes('/clients/adopt')) {
      const b = JSON.parse(opts.body);
      return json({ client: { id: 99, short_name: b.short_name || 'MoLESS', full_name: b.full_name || 'Ministry of Labour' },
        linked: 4, created: !b.clientId });
    }
    if (u.includes('/clients/merge')) {
      return json({ target: { id: clients[0].id, short_name: clients[0].shortName },
        merged: [{ id: clients[1].id, short_name: clients[1].shortName }], moved: {}, movedTotal: 7 });
    }
    return inner(url, opts);
  };
  OCCUPATIONS.splice(0, OCCUPATIONS.length, ...occupations.map(o => ({ ...o })));
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  container.remove();
  vi.restoreAllMocks();
});

async function mount(props = {}) {
  await act(async () => {
    root = createRoot(container);
    root.render(<>
      <MasterData clients={clients} onUpdateClients={() => {}} token="t"
        isAdmin isEditor isSuperAdmin initialTab="clients" {...props}/>
      <FeedbackHost/>
    </>);
  });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

// Material buttons render as <div data-md> under the test stub, so match both.
const CLICKABLE = 'button, [data-md]';
const byText = (scope, text) =>
  [...(scope || container).querySelectorAll(CLICKABLE)].find(el => el.textContent.trim().startsWith(text));
const click = async (el) => { await act(async () => { el.click(); }); await act(async () => { await Promise.resolve(); }); };
const rowFor = (name) => [...container.querySelectorAll('tr')].find(tr => tr.textContent.includes(name));
const modal = () => document.querySelector('.modal, [role=dialog]') || document.body;

async function openUnlinked() {
  await mount();
  // The disclosure button leads with its chevron icon, so match on inclusion.
  const toggle = [...container.querySelectorAll('button')]
    .find(b => b.textContent.includes('client name') && b.textContent.includes('not in this list'));
  expect(toggle, 'disclosure button not found').toBeTruthy();
  await click(toggle);
}

describe('names typed in instead of picked', () => {
  it('are summarised without being opened', async () => {
    await mount();
    expect(container.textContent).toMatch(/2 client names not in this list/);
    // Rows stay collapsed: this is a prompt, not a warning to be stepped over.
    expect(rowFor('Department of Roads')).toBeUndefined();
    assertNoConsoleErrors();
  });

  it('says how many of them already exist', async () => {
    await mount();
    expect(container.textContent).toMatch(/1 already exist/);
  });

  it('is not shown at all when there is nothing to reconcile', async () => {
    unlinkedRows = [];
    await mount();
    expect(container.textContent).not.toMatch(/not in this list/);
  });

  it('lists each name with how much is riding on it', async () => {
    await openUnlinked();
    expect(rowFor('Department of Roads').textContent).toMatch(/4 records/);
    expect(rowFor('ministry of labour').textContent).toMatch(/2 records/);
  });

  it('distinguishes a missing client from one already in the list', async () => {
    await openUnlinked();
    expect(rowFor('Department of Roads').textContent).toMatch(/Missing/);
    expect(rowFor('ministry of labour').textContent).toMatch(/Already in list as MoLESS/);
  });

  it('offers to add the missing one and to link the known one', async () => {
    await openUnlinked();
    expect(byText(rowFor('Department of Roads'), 'Add to list')).toBeTruthy();
    expect(byText(rowFor('ministry of labour'), 'Link')).toBeTruthy();
  });
});

describe('adding a missing client', () => {
  it('opens a form seeded with the typed name', async () => {
    await openUnlinked();
    await click(byText(rowFor('Department of Roads'), 'Add to list'));
    expect(modal().textContent).toMatch(/Add client to master data/);
    expect(modal().textContent).toMatch(/was typed into 4 records/);
  });

  it('will not save without a short name', async () => {
    // full_name is seeded; the acronym is the one thing only a person knows.
    await openUnlinked();
    await click(byText(rowFor('Department of Roads'), 'Add to list'));
    const save = byText(modal(), 'Add and link');
    expect(save).toBeTruthy();
    expect(save.hasAttribute('disabled')).toBe(true);
  });
});

describe('linking a name that already exists', () => {
  it('offers no form to fill in', async () => {
    // Any form here would invite a second copy of the very client being matched.
    await openUnlinked();
    await click(byText(rowFor('ministry of labour'), 'Link'));
    expect(modal().textContent).toMatch(/Link to an existing client/);
    expect(modal().textContent).toMatch(/already exists in master data as/);
    expect(byText(modal(), 'Link records')).toBeTruthy();
  });

  it('sends the existing id rather than new client details', async () => {
    await openUnlinked();
    await click(byText(rowFor('ministry of labour'), 'Link'));
    await click(byText(modal(), 'Link records'));
    const adopt = requests.find(r => r.url.includes('/clients/adopt') && r.method === 'POST');
    expect(adopt, 'no adopt request').toBeTruthy();
    expect(adopt.body.clientId).toBe(1);
    expect(adopt.body.short_name).toBeUndefined();
  });
});

describe('merging duplicate clients', () => {
  it('needs two before it will merge', async () => {
    await mount();
    const boxes = [...container.querySelectorAll('input[aria-label^="Select"]')];
    expect(boxes.length).toBeGreaterThan(1);
    await click(boxes[0]);
    expect(container.querySelector('.bulk-bar').textContent).toMatch(/pick at least two/);
    expect(byText(container.querySelector('.bulk-bar'), 'Merge').hasAttribute('disabled')).toBe(true);
  });

  it('asks which one to keep, with what each is carrying', async () => {
    await mount();
    const boxes = [...container.querySelectorAll('input[aria-label^="Select"]')];
    await click(boxes[0]);
    await click(boxes[1]);
    await click(byText(container.querySelector('.bulk-bar'), 'Merge'));
    const options = [...document.querySelectorAll('.merge-option')];
    expect(options).toHaveLength(2);
    // The count is the whole basis for choosing, so it has to be on the option.
    for (const o of options) expect(o.textContent).toMatch(/5 records/);
    expect(options[0].textContent).toMatch(/Keep this one/);
  });

  it('hides the selection checkboxes from a non-admin', async () => {
    await mount({ isAdmin: false });
    expect(container.querySelectorAll('input[aria-label^="Select"]')).toHaveLength(0);
  });
});

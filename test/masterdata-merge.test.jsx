/**
 * The merge flow, driven through the rendered UI rather than by calling the
 * handler directly — the handler was reachable from nothing for a while, and a
 * unit test on it would have passed the whole time.
 *
 * What matters after a merge is that the duplicates leave every consumer's
 * list, not just this table: OCCUPATIONS is a module-level array, so a merge
 * that forgets notifyMasterData() leaves the assignment editor offering an
 * occupation the server has just deactivated.
 */
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { assertNoConsoleErrors } from './setup.js';
import { installFetchStub, occupations, occupationUsage, clients } from './fixtures.js';
import { OCCUPATIONS } from '../src/constants/data.js';
import { useOccupations } from '../src/utils/useMasterData.js';
import MasterData from '../src/components/MasterData.jsx';
import FeedbackHost from '../src/components/ui/Feedback.jsx';

let container, root, requests;

beforeEach(() => {
  installFetchStub();
  const inner = globalThis.fetch;
  requests = [];
  // Record every call, and answer the merge itself.
  globalThis.fetch = (url, opts = {}) => {
    requests.push({ url: String(url), method: opts.method || 'GET', body: opts.body });
    if (String(url).includes('/occupations/merge')) {
      return Promise.resolve(new Response(JSON.stringify({
        target: { id: 1, name: 'Beautician' },
        merged: [{ id: 2, name: 'Tailoring' }],
        movedAssignments: 1, movedTools: 0,
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
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

/** A second consumer of the same array, to catch a missing notification. */
function Elsewhere() {
  return <ul>{useOccupations().map(o => <li key={o.id}>occ:{o.name}</li>)}</ul>;
}

async function mountMasterData(props = {}) {
  await act(async () => {
    root = createRoot(container);
    root.render(
      <>
        <MasterData clients={clients} onUpdateClients={() => {}} token="t"
          isAdmin isEditor isSuperAdmin initialTab="occupations" {...props} />
        <Elsewhere />
        <FeedbackHost />
      </>
    );
  });
  await act(async () => { await Promise.resolve(); });
}

// Material buttons render as <div data-md> under the test stub, so match both.
const CLICKABLE = 'button, [data-md]';
const byText = (scope, text) =>
  [...scope.querySelectorAll(CLICKABLE)].find(el => el.textContent.trim().startsWith(text));

const mergeButton = () => byText(container.querySelector('.bulk-bar') || container, 'Merge');

/** The confirm step is confirmDialog, not window.confirm — answer it in the DOM. */
async function answerConfirm(accept) {
  const dialog = [...document.querySelectorAll('.modal-overlay')]
    .find(el => el.textContent.includes('will be folded into'));
  expect(dialog, 'no confirmation was asked for').toBeTruthy();
  await click(byText(dialog, accept ? 'Merge' : 'Cancel'));
}
const isDisabled = (el) => el.disabled === true || el.hasAttribute('disabled');

const click = async (el) => {
  expect(el, 'element to click not found').toBeTruthy();
  await act(async () => { el.click(); });
  await act(async () => { await Promise.resolve(); });
};

/** Checkbox in the row whose cells contain the given occupation name. */
function rowCheckbox(name) {
  const row = [...container.querySelectorAll('tbody tr')]
    .find(tr => tr.textContent.includes(name));
  return row?.querySelector('input[type="checkbox"]');
}

describe('merging occupations from Master Data', () => {
  it('shows usage counts so the survivor can be chosen', async () => {
    await mountMasterData();
    const row = [...container.querySelectorAll('tbody tr')]
      .find(tr => tr.textContent.includes('Beautician'));
    expect(row.textContent).toContain('7 assignments');
    assertNoConsoleErrors();
  });

  it('offers merging only once two are selected', async () => {
    await mountMasterData();
    expect(container.querySelector('.bulk-bar')).toBeNull();

    await click(rowCheckbox('Beautician'));
    expect(isDisabled(mergeButton()), 'one selection is not a merge').toBe(true);
    expect(container.querySelector('.bulk-bar').textContent).toContain('at least two');
    // and pressing it anyway opens nothing
    await click(mergeButton());
    expect(document.querySelector('.merge-option')).toBeNull();

    await click(rowCheckbox('Tailoring'));
    expect(isDisabled(mergeButton())).toBe(false);
    await click(mergeButton());
    expect(document.querySelectorAll('.merge-option').length).toBe(2);
  });

  it('sends the chosen survivor as the target and the rest as sources', async () => {
    await mountMasterData();
    await click(rowCheckbox('Beautician'));
    await click(rowCheckbox('Tailoring'));
    await click(mergeButton());

    // Pick Beautician, the one with the assignments behind it.
    const option = [...document.querySelectorAll('.merge-option')]
      .find(el => el.textContent.includes('Beautician'));
    expect(option.textContent).toContain('7 assignment');
    expect(option.textContent).toContain('12 tool');

    await click(option);
    await answerConfirm(true);

    const merge = requests.find(r => r.url.includes('/occupations/merge'));
    expect(merge, 'no merge request was sent').toBeTruthy();
    expect(merge.method).toBe('POST');
    expect(JSON.parse(merge.body)).toEqual({ targetId: 1, sourceIds: [2] });
  });

  it('removes the merged occupation from every consumer, not just this table', async () => {
    await mountMasterData();
    expect(container.textContent).toContain('occ:Tailoring');

    await click(rowCheckbox('Beautician'));
    await click(rowCheckbox('Tailoring'));
    await click(mergeButton());
    await click([...document.querySelectorAll('.merge-option')]
      .find(el => el.textContent.includes('Beautician')));
    await answerConfirm(true);

    expect(container.textContent).not.toContain('occ:Tailoring');
    expect(container.textContent).toContain('occ:Beautician');
    // and the dialog closes rather than leaving a stale selection behind
    expect(document.querySelector('.merge-option')).toBeNull();
    expect(container.querySelector('.bulk-bar')).toBeNull();
    assertNoConsoleErrors();
  });

  it('does nothing when the confirmation is declined', async () => {
    await mountMasterData();
    await click(rowCheckbox('Beautician'));
    await click(rowCheckbox('Tailoring'));
    await click(mergeButton());
    await click([...document.querySelectorAll('.merge-option')]
      .find(el => el.textContent.includes('Beautician')));
    await answerConfirm(false);

    expect(requests.some(r => r.url.includes('/occupations/merge'))).toBe(false);
    expect(container.textContent).toContain('occ:Tailoring');
  });

  it('hides selection from users who cannot merge', async () => {
    await mountMasterData({ isAdmin: false, isSuperAdmin: false });
    expect(rowCheckbox('Beautician')).toBeFalsy();
    assertNoConsoleErrors();
  });
});

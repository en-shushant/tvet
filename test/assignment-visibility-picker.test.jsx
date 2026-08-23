/**
 * The visibility selector on the assignment form.
 *
 * Two things matter and neither is visible from the backend tests: that only a
 * superadmin is offered the choice at all, and that picking "Superadmin only"
 * actually takes. A picker that renders beautifully but never sets the field
 * would look like it worked right up until someone read the report it was meant
 * to keep the assignment out of.
 *
 * Not driven here: the Save buttons. They are Material custom elements, which
 * the test stub renders as inert hosts — clicking one asserts against the stub,
 * not the app. The picker itself is a plain button, so its behaviour is real.
 * That the chosen value survives the trip to the server is covered separately,
 * over expToAPI/normExp, in assignment-visibility.test.js.
 */
import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { act } from 'react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRoot } from 'react-dom/client';
import { SESSION_KEY } from '../src/utils/auth.js';
import ExperienceForm from '../src/components/ExperienceForm.jsx';

let container, root;

// jsdom in this project has no localStorage, and getSession reads from it.
function signIn(role) {
  const store = new Map([[SESSION_KEY, JSON.stringify({ role, token: 't' })]]);
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
}

beforeEach(() => {
  globalThis.fetch = () => Promise.resolve(new Response('[]', {
    status: 200, headers: { 'Content-Type': 'application/json' },
  }));
  container = document.createElement('div');
  document.body.appendChild(container);
});
afterEach(async () => { await act(async () => { root?.unmount(); }); container.remove(); });

const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };

async function mount(props = {}) {
  root = createRoot(container);
  await act(async () => {
    root.render(<ExperienceForm institute={{ id: 1, name: 'Himalayan Skills Academy' }}
      clients={[]} onSave={() => {}} onClose={() => {}} {...props}/>);
  });
  await flush();
}

const picker = () => document.querySelector('[role="radiogroup"][aria-label="Assignment visibility"]');
const options = () => [...(picker()?.querySelectorAll('[role="radio"]') || [])];
const labelled = (text) => options().find(b => b.textContent.includes(text));
const chosen = () => options().find(b => b.getAttribute('aria-checked') === 'true')?.textContent;

describe('who is offered the choice', () => {
  it('shows the picker to a superadmin', async () => {
    signIn('superadmin');
    await mount();
    expect(picker()).toBeTruthy();
    expect(options()).toHaveLength(2);
  });

  for (const role of ['admin', 'editor', 'shortlist', 'viewer']) {
    it(`hides it from ${role}`, async () => {
      signIn(role);
      await mount();
      expect(picker()).toBeNull();
    });
  }
});

describe('the choice itself', () => {
  beforeEach(() => signIn('superadmin'));

  it('defaults to visible, not restricted', async () => {
    // The safe default is the one that behaves like every existing assignment.
    await mount();
    expect(chosen()).toContain('Everyone');
  });

  it('switches when the restricted option is picked', async () => {
    await mount();
    await act(async () => { labelled('Superadmin only').click(); });
    expect(chosen()).toContain('Superadmin only');
  });

  it('spells out that the assignment leaves the reports', async () => {
    // The consequence is not obvious from the label alone, and it is the whole
    // reason someone would pick it — or regret picking it.
    await mount();
    await act(async () => { labelled('Superadmin only').click(); });
    expect(picker().parentElement.textContent).toMatch(/excluded from all reports/i);
  });

  it('opens an existing restricted assignment on the restricted option', async () => {
    await mount({ exp: { assignmentName: 'Confidential survey', isSuperAdminOnly: true, occupations: [] } });
    expect(chosen()).toContain('Superadmin only');
  });
});

describe('the form keeps the choice', () => {
  beforeEach(() => signIn('superadmin'));

  it('does not reset it between assignments in a restricted batch', () => {
    // "Save & add another" rebuilds the form from BLANK_ASSIGNMENT, carrying
    // over only the fields listed there. Leaving visibility off that list would
    // put the second assignment of a restricted batch in front of everyone —
    // silently, since the picker would simply read "Everyone" again.
    //
    // Checked in the source: reaching this path needs a click on a Material
    // button, which this environment cannot deliver.
    const source = readFileSync(
      path.resolve(import.meta.dirname, '../src/components/ExperienceForm.jsx'), 'utf8');
    const reset = source.slice(source.indexOf('setForm(f => ({'), source.indexOf('setStep(0);'));
    expect(reset).toMatch(/\.\.\.BLANK_ASSIGNMENT/);
    expect(reset, 'visibility must be carried over').toMatch(/isSuperAdminOnly: f\.isSuperAdminOnly/);
  });

  it('starts a brand new assignment visible to everyone', () => {
    const source = readFileSync(
      path.resolve(import.meta.dirname, '../src/components/ExperienceForm.jsx'), 'utf8');
    const blank = source.slice(source.indexOf('const BLANK_ASSIGNMENT'), source.indexOf('};', source.indexOf('const BLANK_ASSIGNMENT')));
    expect(blank).toMatch(/isSuperAdminOnly:\s*false/);
  });
});

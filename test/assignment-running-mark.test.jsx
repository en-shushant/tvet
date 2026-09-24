/**
 * Anyone who can save an assignment can mark it as currently running.
 *
 * Worth pinning because of what sits beside it. The same form carries a
 * superadmin-only visibility picker, and the same route handler carries a
 * role check for it — `is_superadmin_only` is dropped unless the caller is a
 * superadmin. The running mark is deliberately not like that: it records a
 * fact about the work, not a permission, and the person keeping a firm's
 * assignments up to date is usually not the superadmin.
 *
 * Two neighbouring fields with opposite rules is exactly the shape that drifts,
 * so both halves are held here: the checkbox renders for every role, and the
 * route applies no role check to it.
 */
import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { act } from 'react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRoot } from 'react-dom/client';
import { SESSION_KEY } from '../src/utils/auth.js';
import ExperienceForm from '../src/components/ExperienceForm.jsx';

const read = (p) => readFileSync(path.resolve(import.meta.dirname, '..', p), 'utf8');

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

/** The checkbox beside the "Currently running" label. */
const runningBox = () => [...document.querySelectorAll('label')]
  .find(l => l.textContent.includes('Currently running'))
  ?.querySelector('input[type=checkbox]');
const visibilityPicker = () =>
  document.querySelector('[role="radiogroup"][aria-label="Assignment visibility"]');

// Every role that can save an assignment. `viewer` is excluded on purpose: it
// cannot save one at all, so the question does not arise.
const WRITERS = ['superadmin', 'admin', 'editor', 'shortlist'];

describe('who is offered the running mark', () => {
  for (const role of WRITERS) {
    it(`shows it to ${role}`, async () => {
      signIn(role);
      await mount();
      expect(runningBox(), `${role} was not offered the checkbox`).toBeTruthy();
    });
  }

  it('shows it even to a role that cannot set the visibility flag', async () => {
    // The contrast that makes this worth a test: two checkboxes on one form,
    // one gated and one not.
    signIn('editor');
    await mount();
    expect(runningBox()).toBeTruthy();
    expect(visibilityPicker(), 'the superadmin-only picker must stay gated').toBeNull();
  });

  it('explains what ticking it costs', async () => {
    signIn('editor');
    await mount();
    const label = [...document.querySelectorAll('label')]
      .find(l => l.textContent.includes('Currently running'));
    expect(label.textContent).toMatch(/not yet counted as experience/i);
  });
});

describe('setting and clearing it', () => {
  it('is off for a new assignment', async () => {
    signIn('editor');
    await mount();
    expect(runningBox().checked).toBe(false);
  });

  it('opens ticked for an assignment already marked running', async () => {
    signIn('editor');
    await mount({ exp: { assignmentName: 'Ongoing work', isOngoing: true, occupations: [] } });
    expect(runningBox().checked).toBe(true);
  });

  it('can be turned on and off again', async () => {
    // Unticking is how finished work joins the experience tables, so it has to
    // be as reachable as ticking.
    signIn('editor');
    await mount({ exp: { assignmentName: 'Ongoing work', isOngoing: true, occupations: [] } });
    await act(async () => { runningBox().click(); });
    expect(runningBox().checked).toBe(false);
    await act(async () => { runningBox().click(); });
    expect(runningBox().checked).toBe(true);
  });
});

describe('the route', () => {
  const source = read('backend/routes/assignments.js');

  it('applies no role check to the running mark', () => {
    // `!!is_ongoing` straight from the body on both create and update.
    expect(source).toMatch(/restricted, !!is_ongoing\]/);
    expect(source).toMatch(/is_ongoing=\$34/);
    expect(source).not.toMatch(/canSeeRestrictedAssignments\([^)]*\)[^;]*is_ongoing/);
  });

  it('still gates the flag next to it', () => {
    // If this ever stops being true the two have been conflated.
    expect(source).toMatch(
      /const restricted = canSeeRestrictedAssignments\(request\.user\) && !!is_superadmin_only/);
  });

  it('leaves both behind the ordinary write permission', () => {
    // Not a special case: someone who cannot save an assignment cannot mark one
    // running either, and that is the pre-existing rule rather than a new one.
    expect(source).toMatch(/fastify\.post\('\/', \{ preHandler: requireWriter \}/);
    expect(source).toMatch(/fastify\.put\('\/:id', \{ preHandler: requireWriter \}/);
  });
});

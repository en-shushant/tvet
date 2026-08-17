/**
 * The key-staff roster on the institute form.
 *
 * This is what "Name of Senior Staff ... Functions Performed" on every
 * assignment's 3(B) is auto-written from — set once per firm rather than
 * retyped on every assignment, the same pattern as the three narrative
 * templates already on this form.
 */
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

// getSession() only gates the auto-fill template pickers, which this file
// doesn't touch — stubbed rather than relying on jsdom's localStorage, which
// Node's own competing global shadows in this environment.
vi.mock('../src/utils/auth.js', () => ({ getSession: () => ({ role: 'admin' }) }));
const InstituteForm = (await import('../src/components/InstituteForm.jsx')).default;

let container, root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  container.remove();
});

async function mount(institute) {
  let saved;
  await act(async () => {
    root = createRoot(container);
    root.render(
      <InstituteForm institute={institute} onSave={(f) => { saved = f; }} onClose={() => {}} isSuperAdmin />
    );
  });
  await act(async () => { await Promise.resolve(); });
  return { getSaved: () => saved };
}

const click = async (el) => {
  expect(el, 'element to click not found').toBeTruthy();
  await act(async () => { el.click(); });
  await act(async () => { await Promise.resolve(); });
};

function openEoiSection() {
  const btn = [...document.querySelectorAll('button')]
    .find(b => b.textContent.includes('EOI / Bolpatra profile'));
  return click(btn);
}

describe('institute form — key staff roster', () => {
  it('starts empty for a new institute, with an Add control', async () => {
    await mount(null);
    await openEoiSection();
    expect(document.querySelectorAll('.form-group input.form-input[placeholder="Name"]').length).toBe(0);
    const add = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Add staff member'));
    expect(add).toBeTruthy();
  });

  it('adds a row, and the name/position inputs are independently editable', async () => {
    await mount(null);
    await openEoiSection();
    const add = [...document.querySelectorAll('button')].find(b => b.textContent.includes('Add staff member'));
    await click(add);

    const name = document.querySelector('input[placeholder="Name"]');
    const position = document.querySelector('input[placeholder^="Position"]');
    expect(name && position).toBeTruthy();

    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    await act(async () => {
      setter.call(name, 'Jane Doe');
      name.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      setter.call(position, 'Team Leader');
      position.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(document.querySelector('input[placeholder="Name"]').value).toBe('Jane Doe');
    expect(document.querySelector('input[placeholder^="Position"]').value).toBe('Team Leader');
  });

  it('removes a row without touching the others', async () => {
    const institute = {
      name: 'Test Firm', regNo: '123', keyStaff: [
        { name: 'Jane Doe', position: 'Team Leader' },
        { name: 'Ram Sharma', position: 'Project Director' },
      ],
    };
    await mount(institute);
    await openEoiSection();

    expect(document.querySelectorAll('input[placeholder="Name"]').length).toBe(2);
    const removeFirst = document.querySelector('[aria-label="Remove Jane Doe"]');
    await click(removeFirst);

    const remaining = [...document.querySelectorAll('input[placeholder="Name"]')].map(i => i.value);
    expect(remaining).toEqual(['Ram Sharma']);
  });

  it('carries the roster through to save', async () => {
    const institute = { name: 'Test Firm', regNo: '123', keyStaff: [{ name: 'Jane Doe', position: 'Team Leader' }] };
    const { getSaved } = await mount(institute);
    const saveBtn = [...document.querySelectorAll('button, [data-md]')]
      .find(b => b.textContent.trim() === 'Save changes');
    await click(saveBtn);
    expect(getSaved().keyStaff).toEqual([{ name: 'Jane Doe', position: 'Team Leader' }]);
  });
});

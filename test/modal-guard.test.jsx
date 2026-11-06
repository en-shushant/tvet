/**
 * Dialogs with a form ask before they throw away typing, however they are closed.
 */
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import Modal from '../src/components/ui/Modal.jsx';

let container, root, onClose;
const flush = () => act(async () => { await new Promise(r => setTimeout(r, 320)); });
const q = (sel) => document.body.querySelector(sel);
const text = (t) => [...document.body.querySelectorAll('button, md-text-button, md-outlined-button, md-filled-button, md-filled-tonal-button, [data-md], .btn')].find(b => b.textContent.trim().includes(t));

const mount = (props = {}) => act(async () => {
  root.render(
    <Modal title="Edit thing" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn" onClick={onClose}>Save</button></>} {...props}>
      <input id="f" defaultValue="start" />
      <input id="cb" type="checkbox" />
    </Modal>);
});
const touch = (el) => act(async () => { el.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true })); });
const type = (el, v) => act(async () => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); });
const esc = () => act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
const click = (el) => act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });

beforeEach(() => { onClose = vi.fn(); container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe('closing a dialog with a form', () => {
  it('closes at once when nothing was changed', async () => {
    await mount(); await flush();
    await esc();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('asks first when a value was changed, by Escape, the × and a click outside', async () => {
    await mount(); await flush();
    await touch(q('#f')); await type(q('#f'), 'edited');
    await esc();
    expect(onClose).not.toHaveBeenCalled();
    expect(text('Keep editing')).toBeTruthy();
    await click(text('Keep editing'));                      // back to the form; the typing is still there
    expect(q('#f').value).toBe('edited');
    expect(text('Keep editing')).toBeFalsy();

    await click(q('.modal-close'));
    expect(onClose).not.toHaveBeenCalled();
    expect(text('Keep editing')).toBeTruthy();
    await click(text('Keep editing'));

    await click(q('.modal-overlay'));
    expect(onClose).not.toHaveBeenCalled();
    expect(text('Keep editing')).toBeTruthy();
  });

  it('asks before a Cancel button too, and Save is not asked about', async () => {
    await mount(); await flush();
    await touch(q('#f')); await type(q('#f'), 'edited');
    await click(text('Cancel'));
    expect(onClose).not.toHaveBeenCalled();
    expect(text('Discard changes')).toBeTruthy();
    await click(text('Keep editing'));
    await click(text('Save'));
    expect(onClose).toHaveBeenCalledTimes(1);               // the parent's own close after saving
  });

  it('closes when the person chooses to discard', async () => {
    await mount(); await flush();
    await touch(q('#f')); await type(q('#f'), 'edited');
    await esc();
    await click(text('Discard changes'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('notices a ticked box, and an edit that is then undone is not a change', async () => {
    await mount(); await flush();
    await touch(q('#cb'));
    await act(async () => { q('#cb').checked = true; });
    await esc();
    expect(text('Keep editing')).toBeTruthy();
    await click(text('Keep editing'));
    await act(async () => { q('#cb').checked = false; });
    await esc();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not count values that arrive from the server before the first touch', async () => {
    await mount(); await flush();
    await type(q('#f'), 'loaded later');                    // no touch: a late prefill
    await flush();
    await esc();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('leaves a dialog with its own handling alone', async () => {
    await mount({ guard: false }); await flush();
    await touch(q('#f')); await type(q('#f'), 'edited');
    await esc();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

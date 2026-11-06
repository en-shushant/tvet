/**
 * The guided tour: stepping, what each step runs, how it ends, and who has seen it.
 */
import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import GuidedTour from '../src/components/ui/GuidedTour.jsx';
import { copyTourSteps, tourSeen, markTourSeen } from '../src/components/shortlisting/copyTour.js';

let container, root;
const flush = () => act(async () => { await new Promise(r => setTimeout(r, 30)); });
const press = (key) => act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })); });
const btn = (t) => [...document.querySelectorAll('.gt-note button')].find(b => b.textContent.trim() === t);

beforeEach(() => {
  Element.prototype.scrollIntoView = () => {};
  globalThis.localStorage = {
    _m: new Map(), getItem(k) { return this._m.has(k) ? this._m.get(k) : null; },
    setItem(k, v) { this._m.set(k, String(v)); }, removeItem(k) { this._m.delete(k); },
  };
  container = document.createElement('div');
  container.innerHTML = '<button id="a">A</button><div id="b">B</div>';
  document.body.appendChild(container);
  root = createRoot(document.createElement('div'));
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

const mount = (props) => act(async () => { root.render(<GuidedTour label="t" {...props} />); });

describe('GuidedTour', () => {
  const steps = (log) => [
    { target: '#a', title: 'One', body: 'first', enter: () => log.push('enter1') },
    { target: '#b', title: 'Two', body: 'second', enter: () => log.push('enter2') },
    { target: '#missing', title: 'Three', body: 'third' },
  ];

  it('shows nothing when closed', async () => {
    await mount({ steps: steps([]), open: false, onClose: () => {} });
    expect(document.querySelector('.gt-root')).toBeNull();
  });

  it('steps forward and back, running each step’s set-up, and reports it finished on the last', async () => {
    const log = []; let done = null;
    await mount({ steps: steps(log), open: true, onClose: (f) => { done = f; } });
    await flush();
    expect(document.querySelector('.gt-title').textContent).toBe('One');
    expect(document.querySelector('.gt-count').textContent).toBe('Step 1 of 3');
    expect(document.querySelector('.gt-spot')).not.toBeNull();
    await act(async () => btn('Next').click()); await flush();
    expect(document.querySelector('.gt-title').textContent).toBe('Two');
    expect(log).toEqual(['enter1', 'enter2']);
    await act(async () => btn('Back').click()); await flush();
    expect(document.querySelector('.gt-title').textContent).toBe('One');
    await press('ArrowRight'); await flush(); await press('ArrowRight'); await flush();
    expect(document.querySelector('.gt-title').textContent).toBe('Three');
    expect(btn('Done')).toBeTruthy();
    await act(async () => btn('Done').click());
    expect(done).toBe(true);
  });

  it('shows a step centred, without a spotlight, when its target never appears', async () => {
    await mount({ steps: [{ target: '#nope', title: 'Lost', body: 'x' }], open: true, onClose: () => {} });
    await act(async () => { await new Promise(r => setTimeout(r, 1400)); });
    expect(document.querySelector('.gt-title').textContent).toBe('Lost');
    expect(document.querySelector('.gt-spot')).toBeNull();
    expect(document.querySelector('.gt-dim')).not.toBeNull();
  });

  it('ends unfinished on Escape and on Skip', async () => {
    const got = [];
    await mount({ steps: steps([]), open: true, onClose: (f) => got.push(f) });
    await flush(); await press('Escape'); await act(async () => btn('Skip').click());
    expect(got).toEqual([false, false]);
  });
});

describe('the copy-shortlist tour', () => {
  it('opens the copy dialog for its second step and points at the three things in it', () => {
    const calls = [];
    const s = copyTourSteps({ openCopy: () => calls.push('open'), closeCopy: () => calls.push('close') });
    expect(s).toHaveLength(4);
    s[0].enter(); s[1].enter();
    expect(calls).toEqual(['close', 'open']);
    expect(s.map(x => x.target)).toEqual([
      '[aria-label="Copy shortlist to another organization"]', '[data-tour="copy-org"]', '[data-tour="copy-firms"]', '[data-tour="copy-go"]',
    ]);
  });

  it('is remembered per user, so each person who can copy sees it once', () => {
    const ann = { email: 'ann@x.np' }, bo = { email: 'bo@x.np' };
    expect(tourSeen(ann)).toBe(false);
    markTourSeen(ann);
    expect(tourSeen(ann)).toBe(true);
    expect(tourSeen(bo)).toBe(false);
  });
});

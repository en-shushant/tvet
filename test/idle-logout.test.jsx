/**
 * The page's idle sign-out: a warning in the last minute, one click to stay, a sign-out at 15 minutes,
 * activity (in this tab or another) pushing it back, and a heartbeat while someone is working.
 */
import { describe, it, beforeEach, afterEach, expect, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useIdleLogout } from '../src/utils/useIdleLogout.js';
import { isBlocked } from '../src/utils/maintenance.js';

const apiCalls = [];
vi.mock('../src/utils/api.js', () => ({ api: (...a) => { apiCalls.push(a); return Promise.resolve({ ok: true }); }, getApiBase: () => '', API_BASE_PATH: '/api' }));

let container, root, state, timedOut;
function Probe({ active = true }) {
  state = useIdleLogout({ active, token: 'tok', onTimeout: () => { timedOut += 1; } });
  return null;
}
const mount = (props) => act(async () => { root.render(<Probe {...props} />); });
const run = (ms) => act(async () => { vi.advanceTimersByTime(ms); });
const min = (n) => n * 60000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-06T09:00:00Z'));
  apiCalls.length = 0; timedOut = 0;
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.useRealTimers(); });

describe('idle sign-out', () => {
  it('stays quiet for 14 minutes, warns in the last minute, and signs out at 15', async () => {
    await mount();
    await run(min(13) + 59000);
    expect(state.secondsLeft).toBeNull();
    await run(1000);                                  // 14:00 idle
    expect(state.secondsLeft).toBe(60);
    await run(30000);
    expect(state.secondsLeft).toBe(30);
    expect(timedOut).toBe(0);
    await run(30000);                                 // 15:00
    expect(timedOut).toBe(1);
    await run(min(5));
    expect(timedOut).toBe(1);                         // once only
  });

  it('is pushed back by any activity, including in another tab', async () => {
    await mount();
    await run(min(10));
    await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' })); });
    await run(min(10));                               // 20 minutes since the start, 10 since the key
    expect(timedOut).toBe(0);
    await run(min(5) + 2000);
    expect(timedOut).toBe(1);

    // another tab: its activity arrives as a storage event
    timedOut = 0; state = null;
    await act(async () => { root.unmount(); root = createRoot(container); });
    await mount();
    await run(min(12));
    await act(async () => { window.dispatchEvent(new StorageEvent('storage', { key: 'tvettrack_last_active', newValue: String(Date.now()) })); });
    await run(min(10));
    expect(timedOut).toBe(0);
  });

  it('one click on "Stay signed in" clears the warning and restarts the 15 minutes', async () => {
    await mount();
    await run(min(14) + 20000);
    expect(state.secondsLeft).toBeLessThanOrEqual(40);
    await act(async () => { state.stay(); });
    await run(1000);
    expect(state.secondsLeft).toBeNull();
    await run(min(13));
    expect(timedOut).toBe(0);
    await run(min(2) + 5000);
    expect(timedOut).toBe(1);
  });

  it('sends a heartbeat while someone is working, and not when they are idle or signed out', async () => {
    await mount();
    await run(min(4));                                // active at the start, so the first beat goes
    expect(apiCalls.filter(c => c[1] === '/auth/ping')).toHaveLength(1);
    await run(min(4));                                // idle since: nothing to report
    expect(apiCalls.filter(c => c[1] === '/auth/ping')).toHaveLength(1);
    await act(async () => { window.dispatchEvent(new Event('pointerdown')); });
    await run(min(4));
    expect(apiCalls.filter(c => c[1] === '/auth/ping')).toHaveLength(2);

    apiCalls.length = 0;
    await mount({ active: false });
    await run(min(30));
    expect(apiCalls).toHaveLength(0);
    expect(timedOut).toBe(0);
  });
});

describe('maintenance gate', () => {
  const on = { on: true, since: 'S1' };
  it('lets everyone in when it is off, and holds others when it is on', () => {
    expect(isBlocked({ on: false }, null, null)).toBe(false);
    expect(isBlocked(null, null, null)).toBe(false);
    expect(isBlocked(on, { role: 'viewer' }, null)).toBe(true);
    expect(isBlocked(on, null, null)).toBe(true);
  });
  it('lets a superadmin through always', () => { expect(isBlocked(on, { role: 'superadmin' }, null)).toBe(false); });
  it('lets someone with a pass for this window through, and not one from an earlier window', () => {
    expect(isBlocked(on, { role: 'viewer' }, { pass: 'p', since: 'S1' })).toBe(false);
    expect(isBlocked(on, { role: 'viewer' }, { pass: 'p', since: 'OLD' })).toBe(true);
    expect(isBlocked(on, { role: 'viewer' }, { pass: '', since: 'S1' })).toBe(true);
  });
});

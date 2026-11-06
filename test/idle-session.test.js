/**
 * The server's side of signing out after inactivity: a token that has gone idle is refused,
 * activity keeps it alive, and a fresh sign-in clears the expiry. Time is faked.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
process.env.IDLE_TIMEOUT_MINUTES = '15';
const jwt = require('../backend/node_modules/jsonwebtoken');
const { authenticate, markActive } = require('../backend/middleware/auth.js');
const SECRET = process.env.JWT_SECRET || 'tvettrack_dev_secret_change_in_production';

const call = async (userId) => {
  const token = jwt.sign({ id: userId, role: 'viewer' }, SECRET, { expiresIn: '1h' });
  const reply = { status: 200, body: null, code(n) { this.status = n; return this; }, send(b) { this.body = b; return this; } };
  await authenticate({ headers: { authorization: `Bearer ${token}` } }, reply);
  return reply;
};
const minutes = (n) => vi.advanceTimersByTime(n * 60000);

describe('signing out after inactivity (server)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-06T09:00:00Z')); });
  afterEach(() => vi.useRealTimers());

  it('lets a first request through, and keeps letting an active user through', async () => {
    expect((await call('u1')).status).toBe(200);
    for (let i = 0; i < 6; i++) { minutes(10); expect((await call('u1')).status).toBe(200); }   // an hour of requests every 10 minutes
  });

  it('refuses a token that has been idle past the limit, with a reason the page can act on', async () => {
    await call('u2');
    minutes(14);
    expect((await call('u2')).status).toBe(200);          // still inside the limit: and that request counts as activity
    minutes(18);                                          // 15 minutes plus the 2 of grace, and more
    const r = await call('u2');
    expect(r.status).toBe(401);
    expect(r.body).toMatchObject({ code: 'idle' });
  });

  it('keeps refusing the old token until the user signs in again', async () => {
    await call('u3');
    minutes(30);
    expect((await call('u3')).status).toBe(401);
    expect((await call('u3')).status).toBe(401);          // a retry or a refresh with the old token is refused too
    markActive('u3');                                     // a new sign-in
    expect((await call('u3')).status).toBe(200);
  });

  it('is per user', async () => {
    await call('a'); await call('b');
    minutes(10); await call('b');
    minutes(10);
    expect((await call('a')).status).toBe(401);           // idle 20 minutes
    expect((await call('b')).status).toBe(200);           // idle 10
  });
});

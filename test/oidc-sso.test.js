import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'module';
import { readFileSync } from 'fs';
const require = createRequire(import.meta.url);
const oidc = require('../backend/lib/oidc.js');
import { safeNextPath, sessionFromLogin } from '../src/utils/auth.js';

const S = (o = {}) => ({ adminGroups: ['tvettrack-admins'], roleMap: { 'tvettrack-editors': 'editor' }, autoCreate: false, ...o });

describe('SSO: where to land', () => {
  it('only relative paths on this site', () => {
    for (const f of [oidc.safeNext, safeNextPath]) {
      expect(f('/#hr')).toBe('/#hr');
      expect(f('https://evil.com')).toBe('/');
      expect(f('//evil.com')).toBe('/');
      expect(f('/\\evil.com')).toBe('/');
      expect(f('javascript:alert(1)')).toBe('/');
      expect(f('')).toBe('/');
    }
  });
});

describe('SSO: one-time handoff codes', () => {
  afterEach(() => vi.useRealTimers());
  it('works once', () => {
    const c = oidc.issueHandoff({ userId: 'u' });
    expect(oidc.redeemHandoff(c)?.userId).toBe('u');
    expect(oidc.redeemHandoff(c)).toBeNull();
  });
  it('expires after 60 seconds', () => {
    vi.useFakeTimers();
    const c = oidc.issueHandoff({ userId: 'u' });
    vi.advanceTimersByTime(61_000);
    expect(oidc.redeemHandoff(c)).toBeNull();
  });
});

describe('SSO: roles from groups', () => {
  it('admin group grants admin; mapped groups set their role', () => {
    expect(oidc.nextRole('viewer', ['tvettrack-admins'], S()).role).toBe('admin');
    expect(oidc.nextRole('admin', ['tvettrack-editors'], S()).role).toBe('editor');
  });
  it('an admin in no relevant group keeps admin, with a warning', () => {
    const r = oidc.nextRole('admin', [], S());
    expect(r.role).toBe('admin');
    expect(r.warning).toBeTruthy();
  });
  it('never touches a superadmin, and never grants superadmin', () => {
    expect(oidc.nextRole('superadmin', ['tvettrack-editors'], S()).role).toBe('superadmin');
    expect(oidc.roleFromGroups(['x'], S({ roleMap: { x: 'superadmin' } }))).toBeNull();
  });
});

describe('SSO: account matching', () => {
  const fakePool = (rows) => {
    const calls = [];
    return { calls, query: async (sql, params) => { calls.push(sql); return { rows: rows(sql, params) }; } };
  };
  it('unknown email with auto-create off creates nobody', async () => {
    const pool = fakePool(() => []);
    expect(await oidc.matchUser(pool, { sub: 's', email: 'n@x' }, S())).toEqual({ error: 'no_account' });
    expect(pool.calls.some(q => /INSERT/.test(q))).toBe(false);
  });
  it('auto-create makes a password-less user with the least role', async () => {
    const pool = fakePool((sql, p) => (/INSERT/.test(sql) ? [{ id: 'new', role: p[2], password: '!sso-only' }] : []));
    const r = await oidc.matchUser(pool, { sub: 's', email: 'n@x', name: 'N' }, S({ autoCreate: true }));
    expect(r.created).toBe(true);
    expect(r.user.role).toBe(oidc.DEFAULT_ROLE);
    expect(pool.calls.find(q => /INSERT/.test(q))).toMatch(/'!sso-only'/);
  });
});

describe('SSO: wiring', () => {
  const auth = readFileSync('backend/routes/auth.js', 'utf8');
  it('routes 404 when SSO is off, and are rate-limited', () => {
    for (const r of ["'/oidc/login'", "'/oidc/callback'", "'/oidc/exchange'"]) {
      const at = auth.indexOf(r);
      expect(auth.slice(at, at + 200)).toMatch(/ssoLimit/);
      expect(auth.slice(at, at + 250)).toMatch(/if \(!oidc\.enabled\(\)\) return reply\.code\(404\)/);
    }
  });
  it('password and SSO logins build the session the same way', () => {
    expect(auth.match(/issueSession\(/g).length).toBeGreaterThanOrEqual(3);
    const s = sessionFromLogin({ user: { id: 1, name: 'A', email: 'a@x', role: 'admin', can_access_hr: true }, token: 't' });
    expect(s).toMatchObject({ id: 1, fullName: 'A', role: 'admin', canAccessHr: true, token: 't' });
  });
  it('the login page shows SSO only when the server says it is on', () => {
    const page = readFileSync('src/components/LoginPage.jsx', 'utf8');
    expect(page).toMatch(/api\('GET', '\/auth\/config'\)/);
    expect(page).toMatch(/\{sso && \(/);
  });
});

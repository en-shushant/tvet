// lib/oidc.js — single sign-on through Authentik (OpenID Connect, code flow + PKCE).
//
// Everything here is configuration, policy and small state; the routes live in
// routes/auth.js. openid-client does the protocol work (discovery, PKCE, the
// token exchange and ID-token validation against the IdP's JWKS). It is ESM-only,
// so it is loaded with import() — the backend is CommonJS and runs on Node 20.

const crypto = require('crypto');

let clientLib = null;
const lib = async () => (clientLib ||= await import('openid-client'));

const env = (k) => String(process.env[k] || '').trim();
const enabled = () => env('OIDC_ENABLED').toLowerCase() === 'true';

function settings() {
  let roleMap = {};
  if (env('OIDC_ROLE_MAP')) {
    try { roleMap = JSON.parse(env('OIDC_ROLE_MAP')) || {}; }
    catch { console.warn('OIDC_ROLE_MAP is not valid JSON; ignoring it'); }
  }
  return {
    issuer: env('OIDC_ISSUER'),
    clientId: env('OIDC_CLIENT_ID'),
    clientSecret: env('OIDC_CLIENT_SECRET'),
    redirectUri: env('OIDC_REDIRECT_URI'),
    postLogoutRedirectUri: env('OIDC_POST_LOGOUT_REDIRECT_URI'),
    adminGroups: env('OIDC_ADMIN_GROUPS').split(',').map(s => s.trim()).filter(Boolean),
    roleMap,
    autoCreate: env('OIDC_AUTO_CREATE').toLowerCase() === 'true',
  };
}

// ── Discovery, cached; a failure clears the cache so the next request retries.
let configPromise = null;
let discoveryOptions;          // tests point this at a local http IdP
function _setDiscoveryOptions(o) { discoveryOptions = o; configPromise = null; }

async function getConfig() {
  if (!configPromise) {
    const s = settings();
    // A plain-http IdP only for local testing, and never in production.
    const insecureOk = env('OIDC_ALLOW_INSECURE_FOR_TESTS') === 'true' && process.env.NODE_ENV !== 'production'
      && ['localhost', '127.0.0.1'].includes(new URL(s.issuer).hostname);
    configPromise = lib().then(c => c.discovery(new URL(s.issuer), s.clientId, s.clientSecret, undefined,
      discoveryOptions || (insecureOk ? { execute: [c.allowInsecureRequests] } : undefined)))
      .catch(e => { configPromise = null; throw e; });
  }
  return configPromise;
}

/** Only a relative path on this site: "/", "/#hr" — never "//evil.com" or "https://…". */
function safeNext(next) {
  const n = String(next || '');
  if (!n.startsWith('/') || n.startsWith('//') || n.includes('\\') || /[\r\n\t]/.test(n)) return '/';
  try {
    const u = new URL(n, 'https://placeholder.invalid');
    if (u.origin !== 'https://placeholder.invalid') return '/';
  } catch { return '/'; }
  return n.slice(0, 500);
}

// ── One-time handoff codes: 60 s, single use, in memory (one API instance).
const handoffs = new Map();
const HANDOFF_MS = 60 * 1000;
function issueHandoff(data) {
  const now = Date.now();
  for (const [k, v] of handoffs) if (v.expires < now) handoffs.delete(k);
  const code = crypto.randomBytes(32).toString('base64url');
  handoffs.set(code, { ...data, expires: now + HANDOFF_MS });
  return code;
}
function redeemHandoff(code) {
  const c = String(code || '');
  const h = handoffs.get(c);
  handoffs.delete(c);                          // single use, valid or not
  if (!h || h.expires < Date.now()) return null;
  return h;
}

// ── Roles from groups.
const ROLE_RANK = { viewer: 1, user: 2, shortlist: 3, editor: 4, admin: 5 };
const DEFAULT_ROLE = 'viewer';                  // least privileged

/**
 * The role the IdP's groups call for, or null when they say nothing.
 * Admin groups win; otherwise the strongest mapped role. Superadmin is never
 * granted from groups — it stays a local decision.
 */
function roleFromGroups(groups, s = settings()) {
  const g = new Set((Array.isArray(groups) ? groups : []).map(String));
  if (s.adminGroups.some(a => g.has(a))) return 'admin';
  const mapped = Object.entries(s.roleMap)
    .filter(([group, role]) => g.has(group) && ROLE_RANK[role])
    .map(([, role]) => role)
    .sort((a, b) => ROLE_RANK[b] - ROLE_RANK[a]);
  return mapped[0] || null;
}

/**
 * The role to store after this SSO login, and a warning when we decline to act.
 * - superadmin is left alone (managed locally, and the break-glass account);
 * - groups that name a role set it, up or down;
 * - an admin whose groups name nothing keeps admin, with a warning.
 */
function nextRole(current, groups, s = settings()) {
  if (current === 'superadmin') return { role: current };
  const fromGroups = roleFromGroups(groups, s);
  if (fromGroups) return { role: fromGroups };
  if (current === 'admin') {
    return { role: current, warning: 'SSO user is admin locally but in no admin/mapped group; role left unchanged' };
  }
  return { role: current };
}

/** Find the TVETtrack user for these claims, linking by email on first SSO login. */
async function matchUser(pool, claims, s = settings()) {
  const { rows: [bySub] } = await pool.query('SELECT * FROM users WHERE oidc_sub = $1', [claims.sub]);
  if (bySub) return { user: bySub };
  const email = String(claims.email || '').trim();
  if (email) {
    const { rows: [byEmail] } = await pool.query(
      'SELECT * FROM users WHERE lower(email) = lower($1) AND oidc_sub IS NULL ORDER BY created_at LIMIT 1', [email]);
    if (byEmail) {
      const { rows: [linked] } = await pool.query(
        'UPDATE users SET oidc_sub = $1, updated_at = NOW() WHERE id = $2 RETURNING *', [claims.sub, byEmail.id]);
      return { user: linked, linked: true };
    }
  }
  if (!s.autoCreate || !email) return { error: 'no_account' };
  const name = String(claims.name || claims.preferred_username || email).trim();
  const role = roleFromGroups(claims.groups, s) || DEFAULT_ROLE;
  // '!' is not a bcrypt hash: no password can ever match it.
  const { rows: [created] } = await pool.query(
    `INSERT INTO users (name, email, password, role, oidc_sub, auth_provider)
     VALUES ($1, $2, '!sso-only', $3, $4, 'oidc') RETURNING *`, [name, email, role, claims.sub]);
  return { user: created, created: true };
}

module.exports = {
  lib, enabled, settings, getConfig, _setDiscoveryOptions, safeNext,
  issueHandoff, redeemHandoff, roleFromGroups, nextRole, matchUser, DEFAULT_ROLE,
};

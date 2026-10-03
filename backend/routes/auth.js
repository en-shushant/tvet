// routes/auth.js
const bcrypt = require('bcrypt');
const { pool } = require('../db/pool');
const { signToken, authenticate } = require('../middleware/auth');
const oidc = require('../lib/oidc');

const clientIp = (request) => request.headers['x-forwarded-for']?.split(',')[0].trim() || request.ip;

/**
 * The logged-in result, for a password login and an SSO login alike: the same
 * user object and the same JWT. `extra` rides in the token (the SSO session id,
 * so logout can also end the Authentik session).
 */
function issueSession(user, extra = {}) {
  const { password: _, oidc_sub: __, ...userOut } = user;
  // `hr` rides along so the client knows whether to show the pool in the nav.
  // It never authorises anything: requireHRAccess re-reads the database, so
  // revoking access takes effect at once rather than when this token expires.
  const tokenPayload = { id: user.id, name: user.name, email: user.email, role: user.role,
                         hr: !!user.can_access_hr, tenders: !!user.can_access_tenders, ...extra };
  return { user: userOut, token: signToken(tokenPayload) };
}

async function recordLogin(userId, method, request) {
  await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [userId]);
  await pool.query('INSERT INTO auth_events (user_id, event, ip) VALUES ($1, $2, $3)',
    [userId, method === 'sso' ? 'login via SSO' : 'login via password', clientIp(request)]);
}

async function verifyTurnstileToken(token, remoteip) {
  /*
   * No secret configured means this instance does not do CAPTCHA at all —
   * a local build or a self-hosted copy without a Cloudflare account.
   *
   * The token check used to come first, which made that half-true: the server
   * announced it was skipping verification and then refused the login anyway
   * for want of a token it had just decided not to check. The widget only
   * renders on the domain its site key is registered against, so on any other
   * host there was no token to send and no way in at all.
   *
   * Production sets the secret, so both the token and the verification stay
   * required there.
   */
  if (!process.env.TURNSTILE_SECRET) {
    console.warn('TURNSTILE_SECRET not set — CAPTCHA disabled on this instance');
    return { ok: true };
  }
  if (!token) return { ok: false, reason: 'Please complete the CAPTCHA verification.' };
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: process.env.TURNSTILE_SECRET,
        response: token,
        remoteip: remoteip || '',
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return { ok: false, reason: 'CAPTCHA verification failed' };
    const result = await r.json();
    return result.success ? { ok: true } : { ok: false, reason: 'CAPTCHA verification failed' };
  } catch (e) {
    console.error('Turnstile siteverify unreachable:', e.message);
    return { ok: true };
  }
}

async function plugin(fastify, opts) {
  // Signs the short-lived SSO state cookie. Only /api/auth/oidc ever sees it.
  await fastify.register(require('@fastify/cookie'), {
    secret: process.env.OIDC_COOKIE_SECRET || process.env.JWT_SECRET || 'tvettrack_dev_secret_change_in_production',
  });

  fastify.post('/register', async (request, reply) => {
    const { name, email, password, role = 'user' } = request.body;
    if (!name || !email || !password) return reply.code(400).send({ error: 'name, email and password required' });
    const hash = await bcrypt.hash(password, 10);
    try {
      const { rows } = await pool.query(
        'INSERT INTO users (name, email, password, role) VALUES ($1,$2,$3,$4) RETURNING id, name, email, role',
        [name, email, hash, role]
      );
      return reply.code(201).send({ user: rows[0], token: signToken(rows[0]) });
    } catch(e) {
      if (e.code === '23505') return reply.code(409).send({ error: 'Email already registered' });
      throw e;
    }
  });

  fastify.post('/login', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const { email, password } = request.body;
    if (!email || !password) return reply.code(400).send({ error: 'email and password required' });
    const remoteip = clientIp(request);
    const capResult = await verifyTurnstileToken(request.body['cf-turnstile-response'], remoteip);
    if (!capResult.ok) return reply.code(400).send({ error: capResult.reason });
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (!rows.length) return reply.code(401).send({ error: 'Invalid credentials' });
    const user = rows[0];
    // An SSO-only account has no bcrypt hash; no password can match it.
    const hashed = typeof user.password === 'string' && user.password.startsWith('$2');
    const match = hashed && await bcrypt.compare(password, user.password);
    if (!match) return reply.code(401).send({ error: 'Invalid credentials' });
    if (user.is_active === false) return reply.code(403).send({ error: 'This account is suspended. Ask an admin.' });
    await recordLogin(user.id, 'password', request);
    return issueSession(user);
  });

  fastify.post('/refresh', { preHandler: authenticate }, async (request, reply) => {
    const { rows } = await pool.query(
      'SELECT id, name, email, role, can_access_hr AS hr, can_access_tenders AS tenders FROM users WHERE id = $1', [request.user.id]
    );
    if (!rows.length) return reply.code(401).send({ error: 'User not found' });
    return { token: signToken(request.user.sso_sid ? { ...rows[0], sso_sid: request.user.sso_sid } : rows[0]) };
  });

  fastify.get('/me', { preHandler: authenticate }, async (request, reply) => {
    const { rows } = await pool.query(
      'SELECT id, name, email, role, created_at FROM users WHERE id = $1', [request.user.id]
    );
    if (!rows.length) return reply.code(404).send({ error: 'User not found' });
    return rows[0];
  });

  fastify.put('/password', { preHandler: authenticate }, async (request, reply) => {
    const { current_password, new_password } = request.body;
    if (!current_password || !new_password) return reply.code(400).send({ error: 'current_password and new_password required' });
    if (new_password.length < 6) return reply.code(400).send({ error: 'New password must be at least 6 characters' });
    const { rows } = await pool.query('SELECT password FROM users WHERE id=$1', [request.user.id]);
    if (!rows.length) return reply.code(404).send({ error: 'User not found' });
    const match = await bcrypt.compare(current_password, rows[0].password);
    if (!match) return reply.code(401).send({ error: 'Current password is incorrect' });
    const hash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password=$1 WHERE id=$2', [hash, request.user.id]);
    return { success: true };
  });

  // ── Single sign-on (Authentik, OIDC code flow + PKCE) ─────────────────────
  fastify.get('/config', async () => ({ sso: oidc.enabled() }));

  const SSO_COOKIE = 'tt_oidc';
  const COOKIE_PATH = '/api/auth/oidc';
  const ssoLimit = { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } };
  const fail = (reply, code) => reply
    .clearCookie(SSO_COOKIE, { path: COOKIE_PATH })
    .redirect(`/login?sso_error=${encodeURIComponent(code)}`, 302);

  fastify.get('/oidc/login', ssoLimit, async (request, reply) => {
    if (!oidc.enabled()) return reply.code(404).send({ error: 'Not found' });
    const c = await oidc.lib();
    let config;
    try { config = await oidc.getConfig(); }
    catch (e) { console.error('OIDC discovery failed:', e.name, e.code || ''); return fail(reply, 'unavailable'); }
    const s = oidc.settings();
    const verifier = c.randomPKCECodeVerifier();
    const state = c.randomState();
    const nonce = c.randomNonce();
    const next = oidc.safeNext(request.query.next);
    const url = c.buildAuthorizationUrl(config, {
      // Authentik sends `groups` in the profile scope.
      redirect_uri: s.redirectUri, scope: 'openid email profile',
      code_challenge: await c.calculatePKCECodeChallenge(verifier), code_challenge_method: 'S256',
      state, nonce,
    });
    reply.setCookie(SSO_COOKIE, JSON.stringify({ verifier, state, nonce, next }), {
      path: COOKIE_PATH, httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, signed: true,
    });
    return reply.redirect(url.href, 302);
  });

  fastify.get('/oidc/callback', ssoLimit, async (request, reply) => {
    if (!oidc.enabled()) return reply.code(404).send({ error: 'Not found' });
    const raw = request.cookies[SSO_COOKIE];
    const unsigned = raw ? request.unsignCookie(raw) : { valid: false };
    let saved = null;
    try { saved = unsigned.valid ? JSON.parse(unsigned.value) : null; } catch { saved = null; }
    if (!saved?.state || !saved?.verifier || !saved?.nonce) return fail(reply, 'expired');
    if (request.query.error) return fail(reply, request.query.error === 'access_denied' ? 'cancelled' : 'generic');

    const c = await oidc.lib();
    const s = oidc.settings();
    let tokens, claims;
    try {
      const config = await oidc.getConfig();
      const current = new URL(s.redirectUri);
      current.search = request.url.includes('?') ? request.url.slice(request.url.indexOf('?')) : '';
      tokens = await c.authorizationCodeGrant(config, current, {
        pkceCodeVerifier: saved.verifier, expectedState: saved.state, expectedNonce: saved.nonce, idTokenExpected: true,
      });
      claims = { ...tokens.claims() };
      if (!Array.isArray(claims.groups) || claims.email_verified === undefined) {
        const info = await c.fetchUserInfo(config, tokens.access_token, claims.sub);
        claims = { ...info, ...claims, groups: claims.groups ?? info.groups,
                   email_verified: claims.email_verified ?? info.email_verified };
      }
    } catch (e) {
      // Never the tokens or the code: the error's kind is enough to debug.
      console.warn('SSO callback rejected:', e.name, e.code || '', e.error || '');
      return fail(reply, 'generic');
    }
    if (claims.email_verified !== true) return fail(reply, 'email_unverified');

    const found = await oidc.matchUser(pool, claims, s);
    if (found.error) return fail(reply, found.error);
    let user = found.user;
    if (user.is_active === false) return fail(reply, 'suspended');

    const { role, warning } = oidc.nextRole(user.role, claims.groups, s);
    if (warning) console.warn(`${warning} (user ${user.id})`);
    if (role !== user.role) {
      ({ rows: [user] } = await pool.query('UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING *', [role, user.id]));
      console.log(`SSO set role of user ${user.id} to ${role} from IdP groups`);
    }
    await recordLogin(user.id, 'sso', request);
    // Kept server-side for logout's id_token_hint; never sent to the browser.
    await pool.query("DELETE FROM sso_sessions WHERE created_at < NOW() - INTERVAL '31 days'");
    const { rows: [sess] } = await pool.query(
      'INSERT INTO sso_sessions (user_id, id_token) VALUES ($1, $2) RETURNING id', [user.id, tokens.id_token]);
    const code = oidc.issueHandoff({ userId: user.id, ssoSid: sess.id });
    reply.clearCookie(SSO_COOKIE, { path: COOKIE_PATH });
    return reply.redirect(`/auth/sso-complete?code=${encodeURIComponent(code)}&next=${encodeURIComponent(saved.next || '/')}`, 302);
  });

  fastify.post('/oidc/exchange', ssoLimit, async (request, reply) => {
    if (!oidc.enabled()) return reply.code(404).send({ error: 'Not found' });
    const h = oidc.redeemHandoff(request.body?.code);
    if (!h) return reply.code(400).send({ error: 'This sign-in link has expired. Please sign in again.' });
    const { rows: [user] } = await pool.query('SELECT * FROM users WHERE id = $1', [h.userId]);
    if (!user) return reply.code(401).send({ error: 'User not found' });
    if (user.is_active === false) return reply.code(403).send({ error: 'This account is suspended. Ask an admin.' });
    return issueSession(user, { sso_sid: h.ssoSid });
  });

  // Ends the TVETtrack side (the client drops its token); for an SSO login it
  // also hands back the IdP logout URL so the browser can end that session too.
  fastify.post('/logout', { preHandler: authenticate }, async (request) => {
    const sid = request.user.sso_sid;
    if (!sid) return {};
    const { rows: [sess] } = await pool.query(
      'DELETE FROM sso_sessions WHERE id = $1 AND user_id = $2 RETURNING id_token', [sid, request.user.id]);
    if (!sess || !oidc.enabled()) return {};
    try {
      const c = await oidc.lib();
      const url = c.buildEndSessionUrl(await oidc.getConfig(), {
        id_token_hint: sess.id_token, post_logout_redirect_uri: oidc.settings().postLogoutRedirectUri,
      });
      return { idp_logout_url: url.href };
    } catch (e) {
      console.warn('Could not build the IdP logout URL:', e.name);
      return {};
    }
  });
}

module.exports = plugin;

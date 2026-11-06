// lib/maintenance.js — maintenance mode and its bypass code.
//
// While maintenance is on, every API call is refused with 503 except: the maintenance and
// sign-in routes, a superadmin's calls, and calls that carry a pass. A pass is what someone
// who knows the bypass code is given; it is a signed token tied to this maintenance window
// and this code, so turning maintenance off and on again, or changing the code, ends every
// pass that was handed out. The code itself is stored only as a bcrypt hash.
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { pool } = require('../db/pool');

const JWT_SECRET = process.env.JWT_SECRET || 'tvettrack_dev_secret_change_in_production';
const KEY = 'maintenance';
const PASS_HOURS = 12;
// No 0/O/1/I/L: a code read out or typed from a message is not mistyped.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

let cache = { at: 0, val: null };

async function load(force = false) {
  if (!force && cache.val && Date.now() - cache.at < 4000) return cache.val;
  const { rows } = await pool.query('SELECT value FROM app_settings WHERE key = $1', [KEY]);
  cache = { at: Date.now(), val: rows[0]?.value || { on: false } };
  return cache.val;
}

async function save(patch, userId) {
  const cur = await load(true);
  const next = { ...cur, ...patch };
  await pool.query(
    `INSERT INTO app_settings (key, value, updated_by, updated_at) VALUES ($1,$2,$3,NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_by = $3, updated_at = NOW()`,
    [KEY, JSON.stringify(next), userId || null]);
  cache = { at: 0, val: null };
  return next;
}

/** Identifies this maintenance window and this code; passes carry it and stop working when it changes. */
const versionOf = (m) => crypto.createHash('sha256').update(`${m.since || ''}|${m.code_hash || ''}`).digest('hex').slice(0, 16);

const generateCode = () => Array.from({ length: 10 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('');
const hashCode = (code) => bcrypt.hash(String(code).trim().toUpperCase(), 10);
const checkCode = (code, hash) => bcrypt.compare(String(code || '').trim().toUpperCase(), hash);

function issuePass(m) {
  return jwt.sign({ maint: versionOf(m) }, JWT_SECRET, { expiresIn: `${PASS_HOURS}h` });
}

/**
 * Whether this person may sign in right now. While maintenance is on only a superadmin may: an admin
 * is held like anyone else. The one exception is someone who has entered the bypass code and so holds a
 * pass for this window. Returns the reason to refuse, or null to let them in.
 */
async function loginBlock(user, request) {
  const m = await load(true);
  if (!m.on || user.role === 'superadmin') return null;
  const pass = request.headers['x-maintenance-pass'];
  if (pass) {
    try { if (jwt.verify(String(pass), JWT_SECRET).maint === versionOf(m)) return null; } catch { /* expired or from an earlier window */ }
  }
  return 'Maintenance mode is on. Only superadmins can sign in right now.';
}

/** What the public may know: whether it is on, what to tell people, and whether a code exists. */
const publicView = (m) => ({ on: !!m.on, message: m.message || '', since: m.since || null, has_code: !!m.code_hash });

/** The hook: refuse API calls during maintenance unless the caller is let through. */
function maintenanceHook() {
  return async (request, reply) => {
    const url = request.raw.url || '';
    if (!url.startsWith('/api/')) return undefined;                       // the app itself is always served, so it can say why
    if (url.startsWith('/api/maintenance') || url.startsWith('/api/auth/') || url.startsWith('/api/health')) return undefined;
    const m = await load();
    if (!m.on) return undefined;
    const auth = request.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) {
      try { if (jwt.verify(auth.slice(7), JWT_SECRET).role === 'superadmin') return undefined; } catch { /* not a valid session */ }
    }
    const pass = request.headers['x-maintenance-pass'];
    if (pass) {
      try { if (jwt.verify(String(pass), JWT_SECRET).maint === versionOf(m)) return undefined; } catch { /* expired or from an earlier window */ }
    }
    return reply.code(503).header('Retry-After', '300')
      .send({ error: 'maintenance', message: m.message || 'The system is down for maintenance. Please try again shortly.' });
  };
}

module.exports = { loginBlock, load, save, versionOf, generateCode, hashCode, checkCode, issuePass, publicView, maintenanceHook };

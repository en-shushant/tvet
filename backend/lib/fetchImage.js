// lib/fetchImage.js — download an image from a URL the user typed, safely.
//
// The server makes this request on a user's behalf, so it must not be usable to
// reach the server's own network: only http(s), only addresses on the public
// internet (checked on the resolved IP, and again on every redirect), only
// image content, a size cap, and a timeout.

const dns = require('dns').promises;
const net = require('net');

const MAX_BYTES = 600 * 1024;
const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;
const TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'];

/** True for loopback, private, link-local, CGNAT, multicast and other non-public addresses. */
function isPrivateAddress(ip) {
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === '::1' || v === '::' || v.startsWith('fe8') || v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb')
      || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('ff')) return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateAddress(mapped[1]) : false;
  }
  const [a, b] = ip.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0);
}

async function assertPublic(urlStr) {
  let u;
  try { u = new URL(urlStr); } catch { throw new Error('That is not a valid web address.'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Only http and https addresses are allowed.');
  if (u.username || u.password) throw new Error('Addresses with a login are not allowed.');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  const addrs = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true }).catch(() => []);
  if (!addrs.length) throw new Error('Could not find that website.');
  if (addrs.some(a => isPrivateAddress(a.address))) throw new Error('That address is not on the public internet.');
  return u;
}

/** Fetch an image and return it as a data URL. Throws an Error with a user-readable message. */
async function fetchImageAsDataUrl(urlStr) {
  let current = String(urlStr || '').trim();
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const u = await assertPublic(current);
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    let res;
    try {
      res = await fetch(u, { redirect: 'manual', signal: ctl.signal, headers: { 'User-Agent': 'TVETtrack/1.0 logo fetch', Accept: 'image/*' } });
    } catch { clearTimeout(timer); throw new Error('Could not download that address (no answer or too slow).'); }
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      clearTimeout(timer);
      current = new URL(res.headers.get('location'), u).toString();
      continue;
    }
    try {
      if (!res.ok) throw new Error(`The website answered ${res.status}.`);
      const type = String(res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (!TYPES.includes(type)) throw new Error('That address is not a PNG, JPG, GIF, WebP or SVG image.');
      const declared = Number(res.headers.get('content-length') || 0);
      if (declared > MAX_BYTES) throw new Error('That image is larger than 600 KB.');
      const chunks = []; let total = 0;
      for await (const c of res.body) {
        total += c.length;
        if (total > MAX_BYTES) throw new Error('That image is larger than 600 KB.');
        chunks.push(Buffer.from(c));
      }
      return `data:${type};base64,${Buffer.concat(chunks).toString('base64')}`;
    } finally { clearTimeout(timer); }
  }
  throw new Error('Too many redirects.');
}

module.exports = { fetchImageAsDataUrl, isPrivateAddress };

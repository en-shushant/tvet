// lib/transliterate.js — Roman → Nepali word suggestions from Google Input Tools
// (the service behind Google's Nepali typing tool). Unofficial endpoint: a failure
// returns [] so fields fall back to plain typing.

const URL_BASE = process.env.TRANSLIT_URL || 'https://inputtools.google.com/request';
const cache = new Map();
const CACHE_MAX = 5000;

function cleanWord(w) {
  return String(w || '').trim().slice(0, 40);
}

async function suggest(word, fetchImpl = fetch) {
  const w = cleanWord(word);
  if (!/^[A-Za-z][A-Za-z.'-]*$/.test(w)) return [];
  const key = w.toLowerCase();
  if (cache.has(key)) return cache.get(key);
  const qs = new URLSearchParams({ text: w, itc: 'ne-t-i0-und', num: '5', cp: '0', cs: '1', ie: 'utf-8', oe: 'utf-8', app: 'tvettrack' });
  try {
    const res = await fetchImpl(`${URL_BASE}?${qs}`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return [];
    const body = await res.json();
    const list = body?.[0] === 'SUCCESS' && Array.isArray(body[1]?.[0]?.[1]) ? body[1][0][1] : [];
    const out = list.filter(s => typeof s === 'string' && s).slice(0, 5);
    if (out.length) {
      if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
      cache.set(key, out);
    }
    return out;
  } catch { return []; }
}

module.exports = { suggest, cleanWord };

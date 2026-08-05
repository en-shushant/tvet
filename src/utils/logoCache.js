import { useState, useEffect } from 'react';

const CACHE_NAME = 'tvet-logos-v1';
const _mem = new Map(); // url → objectURL (in-memory for the session)

async function fetchAndCache(url) {
  try {
    const cache = await caches.open(CACHE_NAME);
    let response = await cache.match(url);
    if (!response || !response.ok) {
      response = await fetch(url, { mode: 'cors' });
      if (response.ok) await cache.put(url, response.clone());
    }
    if (response?.ok) {
      const objUrl = URL.createObjectURL(await response.blob());
      _mem.set(url, objUrl);
      return objUrl;
    }
  } catch {
    // Cache API unavailable (e.g. private browsing) — fall through to direct URL
  }
  return url;
}

/**
 * React hook — returns a stable src for a logo URL.
 * Renders immediately with the original URL, then swaps to the cached
 * objectURL once available so there's no blank frame.
 */
export function useCachedLogo(url) {
  const [src, setSrc] = useState(() => _mem.get(url) ?? url ?? null);
  useEffect(() => {
    if (!url) { setSrc(null); return; }
    if (_mem.has(url)) { setSrc(_mem.get(url)); return; }
    let alive = true;
    fetchAndCache(url).then(s => { if (alive) setSrc(s); });
    return () => { alive = false; };
  }, [url]);
  return src;
}

/**
 * Preload a batch of logo URLs into the cache in the background.
 * Call after institutes load so logos are warm before the user scrolls.
 */
export function preloadLogos(urls) {
  if (!('caches' in window)) return;
  const unique = [...new Set(urls.filter(Boolean))];
  unique.forEach((url, i) => {
    setTimeout(() => { if (!_mem.has(url)) fetchAndCache(url); }, i * 60);
  });
}

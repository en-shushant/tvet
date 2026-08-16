/**
 * The SPA fallback must 404 a missing asset, never hand back index.html for it.
 *
 * The app is code-split — Vite lazily imports each route (ReportsView,
 * Shortlisting, ...) as a separately hashed chunk. A tab left open across a
 * deploy, or one that loaded index.html in the instant before the new build
 * replaced the old files underneath it, asks for a chunk that no longer
 * exists. Before this guard, that request fell into the catch-all and got
 * index.html's markup back with a 200 — the browser then tried to execute that
 * HTML as the JS module it requested, which is a SyntaxError, not a load
 * failure, so nothing could catch it and the screen just stayed blank until a
 * manual reload picked up the current index.html.
 *
 * A real 404 lets Vite's own import() wrapper reject cleanly and fire
 * vite:preloadError, which src/main.jsx listens for to reload automatically.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const source = readFileSync(
  path.resolve(import.meta.dirname, '../backend/server.js'), 'utf8');

const handler = (() => {
  const start = source.indexOf('setNotFoundHandler');
  expect(start, 'no not-found handler').toBeGreaterThan(-1);
  const end = source.indexOf('\n});', start) + 4;
  return source.slice(start, end);
})();

describe('SPA fallback', () => {
  it('404s a path that looks like a file, rather than serving index.html', () => {
    expect(handler).toMatch(/ASSET_PATH/);
    expect(handler).toMatch(/reply\.code\(404\)\.send\('Not found'\)/);
  });

  it('still serves index.html for an extensionless route', () => {
    // e.g. "/" or "/#reports" — no file extension, so it's a real navigation.
    expect(handler).toMatch(/sendFile\('index\.html'\)/);
  });

  it('keeps API 404s as JSON, not HTML', () => {
    expect(handler).toMatch(/request\.url\.startsWith\('\/api\/'\)/);
    expect(handler).toMatch(/reply\.code\(404\)\.send\(\{ error: 'Not found' \}\)/);
  });

  it('the asset check runs before the html fallback, not after', () => {
    const assetCheck = handler.indexOf('ASSET_PATH.test');
    const htmlFallback = handler.indexOf("sendFile('index.html')");
    expect(assetCheck).toBeGreaterThan(-1);
    expect(assetCheck).toBeLessThan(htmlFallback);
  });
});

describe('ASSET_PATH pattern', () => {
  // Re-derive the exact regex from the file so the test breaks if it drifts,
  // rather than asserting against a hand-copied duplicate that could go stale.
  const m = source.match(/const ASSET_PATH = (\/.*\/);/);
  expect(m, 'ASSET_PATH not found').toBeTruthy();
  const ASSET_PATH = new Function(`return ${m[1]}`)();

  it('matches hashed chunk and asset paths', () => {
    for (const url of [
      '/assets/vendor-tAaa2TlE.js',
      '/assets/ReportsView-iGP0yCq1.js',
      '/assets/index-abc123.css',
      '/favicon.svg',
      '/robots.txt',
    ]) expect(ASSET_PATH.test(url), url).toBe(true);
  });

  it('does not match hash-routed app paths, which carry no file extension', () => {
    for (const url of ['/', '/#reports', '/#institutes/42', '/#reports/bolpatra'])
      expect(ASSET_PATH.test(url), url).toBe(false);
  });
});

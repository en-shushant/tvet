/**
 * The deploy-recovery policy behind every code-split screen.
 *
 * A deploy replaces the hashed chunk filenames, so a tab opened before it still
 * asks for files that no longer exist. That 404 used to reach React as "Cannot
 * read properties of undefined (reading 'default')" and leave a dead screen —
 * observed in production, and much more likely once thirteen more screens moved
 * behind lazy().
 *
 * The reload that fixes it is exactly the kind of thing that turns into an
 * infinite loop when it is wrong, and it cannot be exercised from the smoke
 * test (that mounts screens directly, never the split boundary). So the policy
 * is kept separate from React and pinned here instead.
 */
import { describe, it, beforeEach, expect, vi } from 'vitest';
import { withChunkReload, CHUNK_RELOAD_KEY } from '../src/utils/lazyChunk.js';

beforeEach(() => sessionStorage.clear());

const ok = { default: () => null };

describe('withChunkReload', () => {
  it('passes the module straight through when the import succeeds', async () => {
    const reload = vi.fn();
    const mod = await withChunkReload(() => Promise.resolve(ok), reload)();
    expect(mod).toBe(ok);
    expect(reload).not.toHaveBeenCalled();
  });

  it('does not latch on a successful import, so a later stale chunk can still heal', async () => {
    const reload = vi.fn();
    await withChunkReload(() => Promise.resolve(ok), reload)();
    expect(sessionStorage.getItem(CHUNK_RELOAD_KEY)).toBeNull();
  });

  it('reloads once on the first failure, and never settles so the reload wins', async () => {
    const reload = vi.fn();
    const load = withChunkReload(() => Promise.reject(new Error('404')), reload);

    const settled = await Promise.race([
      load().then(() => 'resolved', () => 'rejected'),
      new Promise(r => setTimeout(() => r('pending'), 20)),
    ]);

    expect(reload).toHaveBeenCalledTimes(1);
    // Must not resolve or reject — React would otherwise render an error
    // boundary over a page that is already navigating away.
    expect(settled).toBe('pending');
    expect(sessionStorage.getItem(CHUNK_RELOAD_KEY)).toBe('1');
  });

  it('rethrows on the second failure instead of reloading again', async () => {
    const reload = vi.fn();
    sessionStorage.setItem(CHUNK_RELOAD_KEY, '1'); // as if we already reloaded

    await expect(withChunkReload(() => Promise.reject(new Error('404')), reload)())
      .rejects.toThrow('404');
    expect(reload).not.toHaveBeenCalled();
  });

  it('cannot loop: a permanently missing chunk reloads at most once per tab', async () => {
    const reload = vi.fn();
    const load = withChunkReload(() => Promise.reject(new Error('404')), reload);

    load(); // first attempt reloads
    await new Promise(r => setTimeout(r, 5));
    // Every later attempt in the same tab must throw, including after an
    // unrelated screen loaded fine in between.
    await withChunkReload(() => Promise.resolve(ok), reload)();
    await expect(load()).rejects.toThrow('404');
    await expect(load()).rejects.toThrow('404');

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('fails closed when sessionStorage throws, rather than reloading unlatched', async () => {
    const reload = vi.fn();
    // Safari private mode throws on access. Stub the global itself — spying on
    // Storage.prototype does not reach jsdom's sessionStorage instance.
    vi.stubGlobal('sessionStorage', {
      getItem() { throw new Error('SecurityError'); },
      setItem() { throw new Error('SecurityError'); },
    });
    try {
      await expect(withChunkReload(() => Promise.reject(new Error('404')), reload)())
        .rejects.toThrow('404');
      expect(reload).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

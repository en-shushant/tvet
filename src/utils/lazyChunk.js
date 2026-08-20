/**
 * lazy(), but self-healing across deploys.
 *
 * Every build emits content-hashed chunk names, and a deploy deletes the old
 * ones. A tab that was already open still holds the previous entry module, so
 * the moment it navigates to a split screen it requests a filename that no
 * longer exists: the import 404s and React throws "Cannot read properties of
 * undefined (reading 'default')" — a dead screen for anyone who happened to
 * have the app open while we shipped. Splitting the screens out made that far
 * more likely to hit someone mid-session, which is why this exists.
 *
 * Reloading picks up the new HTML and the new chunk names.
 *
 * The sessionStorage latch fires at most once per tab and is never cleared. A
 * stale-deploy tab only needs the one reload — it comes back with the whole new
 * build — so clearing the latch on a later success would buy nothing and would
 * let a chunk that is genuinely, permanently missing bounce the tab again on
 * every navigation. Left set, a broken chunk surfaces as a real error the
 * second time, which is what we want to see.
 *
 * If sessionStorage throws (Safari private mode), we fail closed and rethrow
 * rather than risk reloading with no latch to stop us.
 */
import { lazy } from 'react';

export const CHUNK_RELOAD_KEY = 'tvettrack_chunk_reload';

/**
 * The retry policy on its own, with the reload injectable, so it can be tested
 * without a real navigation. Returns an import factory for React.lazy.
 */
export function withChunkReload(factory, reload = () => window.location.reload()) {
  return () => factory().catch(err => {
    let alreadyTried = true;
    try {
      alreadyTried = !!sessionStorage.getItem(CHUNK_RELOAD_KEY);
      if (!alreadyTried) sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
    } catch {}
    if (alreadyTried) throw err;
    reload();
    return new Promise(() => {}); // never settles; the reload takes over
  });
}

export const lazyChunk = (factory) => lazy(withChunkReload(factory));

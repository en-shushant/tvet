/**
 * Addresses without a "#": /tenders, /detail/10, /tenders/open-3-5.
 *
 * The app used to keep its place in the URL's hash. It now uses real paths, with the history API. The
 * path is read as before, as the screen and an optional second part ("tenders/open-3-5"), so everything
 * that understood the old addresses still does. The server answers every non-API path with the app,
 * so a path can be opened or reloaded directly.
 *
 * Old links and bookmarks (https://…/#tenders) are turned into the new address when the page loads, and
 * if someone edits the hash by hand later.
 */
export const NAVIGATE = 'tvettrack:navigate';

/** The current place without slashes: "tenders/open-3-5", or "" for the home page. */
export const currentPath = () => {
  let p = window.location.pathname;
  try { p = decodeURIComponent(p); } catch { /* keep as is */ }
  return p.replace(/^\/+|\/+$/g, '');
};

/**
 * Go to a place. A push adds a history entry and tells the app (like the old hashchange); a replace
 * changes the address quietly, to tidy up the current entry.
 */
export function go(path, { replace = false } = {}) {
  const clean = String(path ?? '').replace(/^[#/]+/, '');
  const url = '/' + clean;
  if (url === window.location.pathname) return;
  window.history[replace ? 'replaceState' : 'pushState'](null, '', url);
  if (!replace) window.dispatchEvent(new Event(NAVIGATE));
}

/** Run `fn` on browser back/forward and on go(). Returns the way to stop. */
export function onRoute(fn) {
  window.addEventListener('popstate', fn);
  window.addEventListener(NAVIGATE, fn);
  return () => { window.removeEventListener('popstate', fn); window.removeEventListener(NAVIGATE, fn); };
}

/** A click handler for an in-app link: go there without reloading the page. */
export const linkTo = (path) => (e) => {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;   // let "open in a new tab" work
  e.preventDefault();
  go(path);
};

/** "#tenders/open-3-5" on the home page becomes "/tenders/open-3-5". Returns whether it changed anything. */
export function adoptLegacyHash() {
  const h = window.location.hash.replace(/^#\/?/, '');
  if (!h || h === 'main') return false;
  window.history.replaceState(null, '', '/' + h);
  return true;
}

/** Call once at start: converts an old hash address now, and any later hand-edited one. */
export function installLegacyRedirect() {
  adoptLegacyHash();
  window.addEventListener('hashchange', () => { if (adoptLegacyHash()) window.dispatchEvent(new Event(NAVIGATE)); });
}

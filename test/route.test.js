/**
 * Addresses without a "#": reading the place from the path, going somewhere, and turning old #links into paths.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { currentPath, go, onRoute, linkTo, adoptLegacyHash, installLegacyRedirect, NAVIGATE } from '../src/utils/route.js';

const at = (url) => window.history.replaceState(null, '', url);

beforeEach(() => { at('/'); });

describe('reading the place', () => {
  it('is empty at the home page', () => { expect(currentPath()).toBe(''); });
  it('reads a screen, and a screen with a second part', () => {
    at('/tenders');
    expect(currentPath()).toBe('tenders');
    at('/detail/10');
    expect(currentPath()).toBe('detail/10');
    at('/tenders/open-3-5/');
    expect(currentPath()).toBe('tenders/open-3-5');        // a trailing slash does not matter
  });
  it('ignores the query string', () => {
    at('/tenders?x=1');
    expect(currentPath()).toBe('tenders');
  });
});

describe('going somewhere', () => {
  it('changes the path with no hash, and tells the app', () => {
    const seen = vi.fn();
    const stop = onRoute(seen);
    go('tenders');
    expect(window.location.pathname).toBe('/tenders');
    expect(window.location.hash).toBe('');
    expect(seen).toHaveBeenCalledTimes(1);
    go('#detail/10');                                        // a leading # or / is tolerated
    expect(window.location.pathname).toBe('/detail/10');
    go('');
    expect(window.location.pathname).toBe('/');
    expect(seen).toHaveBeenCalledTimes(3);
    stop();
    go('hr');
    expect(seen).toHaveBeenCalledTimes(3);                   // stopped
  });
  it('does nothing when already there', () => {
    at('/hr');
    const seen = vi.fn();
    const stop = onRoute(seen);
    go('hr');
    expect(seen).not.toHaveBeenCalled();
    stop();
  });
  it('can tidy the address quietly, without telling the app', () => {
    at('/hr/new');
    const seen = vi.fn();
    const stop = onRoute(seen);
    go('hr', { replace: true });
    expect(window.location.pathname).toBe('/hr');
    expect(seen).not.toHaveBeenCalled();
    stop();
  });
  it('lets back and forward work', () => {
    const seen = vi.fn();
    const stop = onRoute(seen);
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(seen).toHaveBeenCalledTimes(1);
    stop();
  });
});

describe('links inside the app', () => {
  const click = (init = {}) => ({ preventDefault: vi.fn(), metaKey: false, ctrlKey: false, shiftKey: false, button: 0, ...init });
  it('go there without reloading the page', () => {
    const e = click();
    linkTo('institutes')(e);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(window.location.pathname).toBe('/institutes');
  });
  it('leave "open in a new tab" alone', () => {
    for (const init of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { button: 1 }]) {
      at('/');
      const e = click(init);
      linkTo('institutes')(e);
      expect(e.preventDefault).not.toHaveBeenCalled();
      expect(window.location.pathname).toBe('/');
    }
  });
});

describe('old #links', () => {
  it('become paths', () => {
    at('/#tenders');
    expect(adoptLegacyHash()).toBe(true);
    expect(window.location.pathname).toBe('/tenders');
    expect(window.location.hash).toBe('');
    at('/#detail/10');
    adoptLegacyHash();
    expect(window.location.pathname).toBe('/detail/10');
    at('/#/hr/review');
    adoptLegacyHash();
    expect(window.location.pathname).toBe('/hr/review');
  });
  it('leave the skip link and an empty hash alone', () => {
    at('/#main');
    expect(adoptLegacyHash()).toBe(false);
    expect(window.location.pathname).toBe('/');
    at('/');
    expect(adoptLegacyHash()).toBe(false);
  });
  it('are converted at start, and when the hash is edited by hand later', () => {
    at('/#shortlisting');
    installLegacyRedirect();
    expect(window.location.pathname).toBe('/shortlisting');
    const seen = vi.fn();
    window.addEventListener(NAVIGATE, seen);
    window.location.hash = '#reports';
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    expect(window.location.pathname).toBe('/reports');
    expect(seen).toHaveBeenCalled();
    window.removeEventListener(NAVIGATE, seen);
  });
});

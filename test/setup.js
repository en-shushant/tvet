/**
 * Shared test environment.
 *
 * jsdom is missing a few browser APIs these screens touch on mount. Each stub
 * below exists because something actually reached for it — none are speculative.
 */
import { beforeEach, afterEach, expect } from 'vitest';

// Tells React this is a test environment so act() actually flushes effects
// instead of warning. Without it every render logs a warning and, since
// console.error is treated as failure here, every test fails.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Charts and layout code measure elements; jsdom reports zeroes rather than throwing,
// but ResizeObserver does not exist at all.
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {} unobserve() {} disconnect() {}
  };
}
if (!globalThis.matchMedia) {
  globalThis.matchMedia = (query) => ({
    matches: false, media: query, onchange: null,
    addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {},
    dispatchEvent() { return false; },
  });
}
// useCachedLogo calls caches.open; absent in jsdom. It already catches failures,
// so a rejecting stub exercises that path rather than papering over it.
if (!globalThis.caches) {
  globalThis.caches = { open: () => Promise.reject(new Error('no CacheStorage in jsdom')) };
}
if (!globalThis.URL.createObjectURL) {
  globalThis.URL.createObjectURL = () => 'blob:stub';
  globalThis.URL.revokeObjectURL = () => {};
}
if (!globalThis.scrollTo) globalThis.scrollTo = () => {};
if (!Element.prototype.scrollTo) Element.prototype.scrollTo = function () {};
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = function () {};

/**
 * console.error is a failure.
 *
 * React reports bad props, key warnings and — critically — errors thrown during
 * render through console.error rather than by throwing where the test can catch
 * them. Without this the suite would pass on a screen that rendered nothing but
 * an error boundary's fallback.
 */
let consoleErrors = [];
const realError = console.error;
const realWarn = console.warn;

beforeEach(() => {
  consoleErrors = [];
  console.error = (...args) => { consoleErrors.push(args.map(String).join(' ')); };
  console.warn = () => {};
});

afterEach(() => {
  console.error = realError;
  console.warn = realWarn;
});

export function assertNoConsoleErrors() {
  // Vite/React noise that says nothing about the screen under test.
  const IGNORE = [
    /React DevTools/i,
    /not wrapped in act\(/i,
  ];
  const real = consoleErrors.filter(e => !IGNORE.some(re => re.test(e)));
  expect(real, `console.error during render:\n${real.join('\n---\n')}`).toEqual([]);
}

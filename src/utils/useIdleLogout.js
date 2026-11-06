import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';

export const IDLE_MINUTES = 15;
const WARN_SECONDS = 60;
const HEARTBEAT_MS = 4 * 60 * 1000;
const LAST_KEY = 'tvettrack_last_active';
const EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll', 'mousemove'];

/**
 * Sign out after 15 minutes without use.
 *
 * Activity is a click, a key, a scroll or a mouse move anywhere in the app. It is shared between tabs, so
 * working in one keeps the others in. A minute before the end a warning counts down and one click keeps
 * you in. While you are active a small heartbeat tells the server so, because writing something long
 * does not otherwise touch it, and the server also signs out a token that has gone idle.
 *
 * `secondsLeft` is null until the warning starts. `onTimeout` is called once when the time is up.
 */
export function useIdleLogout({ active, token, onTimeout, minutes = IDLE_MINUTES }) {
  const [secondsLeft, setSecondsLeft] = useState(null);
  const last = useRef(Date.now());
  const sentFor = useRef(0);
  const timedOut = useRef(false);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;           // the latest callback, without restarting the timer when it changes
  const limit = minutes * 60000;

  const touch = useCallback(() => {
    const now = Date.now();
    if (now - last.current < 1000) return;
    last.current = now;
    try { localStorage.setItem(LAST_KEY, String(now)); } catch { /* private mode */ }
  }, []);

  const stay = useCallback(() => { last.current = Date.now() - 1001; touch(); setSecondsLeft(null); }, [touch]);

  useEffect(() => {
    if (!active) { timedOut.current = false; setSecondsLeft(null); return undefined; }
    last.current = Date.now();
    timedOut.current = false;
    touch();
    EVENTS.forEach(e => window.addEventListener(e, touch, { passive: true, capture: true }));
    // Another tab being used counts.
    const onStorage = (e) => { if (e.key === LAST_KEY && e.newValue) last.current = Math.max(last.current, Number(e.newValue) || 0); };
    window.addEventListener('storage', onStorage);

    const tick = setInterval(() => {
      let stored = 0; try { stored = Number(localStorage.getItem(LAST_KEY)) || 0; } catch { /* ignore */ }
      const idle = Date.now() - Math.max(last.current, stored);
      if (idle >= limit) {
        if (!timedOut.current) { timedOut.current = true; setSecondsLeft(null); onTimeoutRef.current?.(); }
      } else if (idle >= limit - WARN_SECONDS * 1000) {
        setSecondsLeft(Math.ceil((limit - idle) / 1000));
      } else {
        setSecondsLeft(s => (s === null ? s : null));
      }
    }, 1000);

    // Heartbeat: only if there was activity since the last one.
    const beat = setInterval(() => {
      if (last.current > sentFor.current && token) { sentFor.current = Date.now(); api('POST', '/auth/ping', null, token).catch(() => {}); }
    }, HEARTBEAT_MS);

    return () => {
      EVENTS.forEach(e => window.removeEventListener(e, touch, { capture: true }));
      window.removeEventListener('storage', onStorage);
      clearInterval(tick); clearInterval(beat);
    };
  }, [active, token, limit, touch]);

  return { secondsLeft, stay };
}

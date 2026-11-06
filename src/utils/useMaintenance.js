import { useCallback, useEffect, useRef, useState } from 'react';
import { getApiBase, API_BASE_PATH } from './api.js';
import { getPass, setPass as savePass, clearPass } from './maintenance.js';

/**
 * Whether maintenance mode is on, kept fresh: asked at start, every 30 seconds, and whenever the server
 * refuses a call because of it. If it cannot be asked, the app carries on as if it is off.
 */
export function useMaintenance() {
  const [status, setStatus] = useState(null);
  const [pass, setPassState] = useState(() => getPass());

  const lastAsk = useRef(0);
  const refresh = useCallback(async () => {
    if (Date.now() - lastAsk.current < 1500) return;           // a burst of refused calls asks once
    lastAsk.current = Date.now();
    try {
      const r = await fetch((getApiBase() || '') + API_BASE_PATH + '/maintenance/status', { cache: 'no-store' });
      if (!r.ok) return;
      const s = await r.json();
      setStatus(s);
      const p = getPass();
      if (p && (!s.on || p.since !== s.since)) { clearPass(); setPassState(null); }   // a pass belongs to one window
    } catch { /* offline: leave as is */ }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(() => { if (!document.hidden) refresh(); }, 30000);
    const onHeld = () => { setPassState(null); refresh(); };
    window.addEventListener('tvettrack:maintenance', onHeld);
    window.addEventListener('tvettrack:maintenance-changed', refresh);       // the superadmin just switched it
    return () => { clearInterval(t); window.removeEventListener('tvettrack:maintenance', onHeld); window.removeEventListener('tvettrack:maintenance-changed', refresh); };
  }, [refresh]);

  const givePass = (p) => { savePass(p); setPassState(p); };
  return { status, pass, refresh, givePass };
}

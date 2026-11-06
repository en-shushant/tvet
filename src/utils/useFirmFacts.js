import { useEffect, useState, useCallback } from 'react';
import { api } from './api.js';

/**
 * What each firm has filled in, from GET /institutes/data-check: a Map of
 * institute id to its facts. Empty until it arrives, and empty if it cannot be
 * had, in which case the checks simply show nothing rather than a false alarm.
 */
export function useFirmFacts(token) {
  const [facts, setFacts] = useState(null);
  const load = useCallback(async () => {
    try {
      const rows = await api('GET', '/institutes/data-check', null, token);
      setFacts(new Map((rows || []).map(r => [String(r.id), r])));
    } catch { setFacts(new Map()); }
  }, [token]);
  useEffect(() => { if (token) load(); }, [token, load]);
  return { facts, reload: load };
}

/**
 * Maintenance mode, as the page sees it.
 *
 * The page asks the server (GET /api/maintenance/status) whether maintenance is on. If it is, everyone but a
 * superadmin sees the maintenance page, unless they have entered the bypass code and hold a pass for this
 * maintenance window. The pass is kept for the tab's session only.
 */
const PASS_KEY = 'tvettrack_maint_pass';

export const getPass = () => { try { return JSON.parse(sessionStorage.getItem(PASS_KEY) || 'null'); } catch { return null; } };
export const setPass = (p) => { try { sessionStorage.setItem(PASS_KEY, JSON.stringify(p)); } catch { /* private mode */ } };
export const clearPass = () => { try { sessionStorage.removeItem(PASS_KEY); } catch { /* ignore */ } };

/** Whether this person is held at the maintenance page. A pass counts only for the window it was given in. */
export function isBlocked(status, session, pass) {
  if (!status?.on) return false;
  if (session?.role === 'superadmin') return false;
  return !(pass && pass.pass && pass.since === status.since);
}

export const USERS_KEY = 'tvettrack_users';
export const SESSION_KEY = 'tvettrack_session';

export const DEFAULT_USERS = [
  { id: 1, username: 'admin', password: 'admin123', fullName: 'Administrator', role: 'admin', active: true, createdAt: '2025-01-01' },
  { id: 2, username: 'viewer', password: 'viewer123', fullName: 'Viewer User', role: 'viewer', active: true, createdAt: '2025-01-01' },
];

export function loadUsers() {
  try { const r = localStorage.getItem(USERS_KEY); return r ? JSON.parse(r) : DEFAULT_USERS; } catch { return DEFAULT_USERS; }
}
export function saveUsers(users) {
  try { localStorage.setItem(USERS_KEY, JSON.stringify(users)); } catch(e) {}
}
export function getSession() {
  try { const r = localStorage.getItem(SESSION_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}
export function setSession(user) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(user)); } catch(e) {}
}
export function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch(e) {}
}

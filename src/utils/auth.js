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

/** The stored session for a login response — the same for a password and an SSO login. */
export function sessionFromLogin(data) {
  return {
    id: data.user.id,
    fullName: data.user.name,
    email: data.user.email,
    role: data.user.role,
    // Access to the human resource pool is a per-user grant, not a role.
    canAccessHr: !!data.user.can_access_hr,
    canAccessTenders: !!data.user.can_access_tenders,
    photo: data.user.photo || null,
    token: data.token,
  };
}

/** Where to go after signing in: a path on this site only. */
export function safeNextPath(next) {
  const n = String(next || '');
  if (!n.startsWith('/') || n.startsWith('//') || n.includes('\\') || /[\r\n\t]/.test(n)) return '/';
  try { if (new URL(n, 'https://x.invalid').origin !== 'https://x.invalid') return '/'; } catch { return '/'; }
  return n;
}

export const SSO_ERRORS = {
  no_account: 'No TVETtrack account for this email. Ask an admin.',
  email_unverified: 'Your email is not verified with the sign-in service. Verify it there, then try again.',
  suspended: 'This TVETtrack account is suspended. Ask an admin.',
  expired: 'The sign-in took too long or was interrupted. Please try again.',
  cancelled: 'Sign-in was cancelled.',
  unavailable: 'The sign-in service could not be reached. Try again, or sign in with your password.',
  generic: 'Single sign-on failed. Try again, or sign in with your password.',
};

/**
 * /auth/sso-complete — the last step of single sign-on. The server hands over a
 * one-time code (never a token); it is swapped for the same session a password
 * login gives, stored the same way, and the user lands where they were going.
 */
import { useEffect, useState } from 'react';
import { api } from '../utils/api.js';
import { setSession, sessionFromLogin, safeNextPath } from '../utils/auth.js';

export default function SsoComplete({ onLogin }) {
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const next = safeNextPath(params.get('next'));
    // Out of the address bar and history before anything else.
    window.history.replaceState(null, '', '/auth/sso-complete');
    if (!code) { setError('This sign-in link is incomplete. Please sign in again.'); return; }
    api('POST', '/auth/oidc/exchange', { code })
      .then(data => {
        const session = sessionFromLogin(data);
        setSession(session);
        window.history.replaceState(null, '', next);
        onLogin(session);
      })
      .catch(e => setError(e.message || 'Single sign-on failed.'));
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14, background: 'var(--bg)', padding: 24 }}>
      {error ? (<>
        <span className="material-icons-round" style={{ fontSize: 32, color: 'var(--error)' }}>error_outline</span>
        <div role="alert" style={{ fontSize: 14, color: 'var(--text)', maxWidth: 380, textAlign: 'center' }}>{error}</div>
        <a className="btn btn-secondary" href="/login">Back to login</a>
      </>) : (<>
        <span className="material-icons-round spin" style={{ fontSize: 28, color: 'var(--primary)' }}>sync</span>
        <div style={{ fontSize: 14, color: 'var(--text2)' }}>Signing you in…</div>
      </>)}
    </div>
  );
}

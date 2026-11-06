import { useState } from 'react';
import { getApiBase, API_BASE_PATH } from '../utils/api.js';

/**
 * Shown to everyone but a superadmin while maintenance mode is on. Someone who has been given the
 * bypass code can enter it to carry on; an administrator can sign in instead.
 */
export default function MaintenancePage({ status, signedIn, onPass, onAdminSignIn, onSignOut }) {
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true); setErr('');
    try {
      const r = await fetch((getApiBase() || '') + API_BASE_PATH + '/maintenance/bypass', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }), cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) setErr(r.status === 429 ? 'Too many tries. Wait a minute and try again.' : j.error || 'That code is not right.');
      else if (j.pass) onPass({ pass: j.pass, since: j.since });
      else setErr('Maintenance has just ended. Reload the page.');
    } catch { setErr('Could not reach the server.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="mt-page" role="main">
      <div className="mt-card">
        <div className="mt-icon" aria-hidden="true"><span className="material-icons-round">construction</span></div>
        <h1 className="mt-title">Down for maintenance</h1>
        <p className="mt-msg">{status?.message || 'We are making improvements and will be back shortly.'}</p>

        {status?.has_code && (
          <form className="mt-form" onSubmit={submit}>
            <label htmlFor="mt-code">Have a bypass code?</label>
            <div className="mt-row">
              <input id="mt-code" className="tw-in" value={code} autoComplete="off" spellCheck={false} placeholder="Enter the code"
                onChange={e => setCode(e.target.value)} />
              <button type="submit" className="btn btn-primary" disabled={busy || !code.trim()}>{busy ? 'Checking…' : 'Continue'}</button>
            </div>
            {err && <div className="mt-err" role="alert">{err}</div>}
          </form>
        )}

        <div className="mt-foot">
          {signedIn
            ? <button type="button" className="tw-link" onClick={onSignOut}>Sign out</button>
            : <button type="button" className="tw-link" onClick={onAdminSignIn}>Superadmin sign in</button>}
        </div>
      </div>
    </div>
  );
}

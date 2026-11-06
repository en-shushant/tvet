import { useEffect, useState } from 'react';
import { api } from '../utils/api.js';
import { confirmDialog, toast } from './ui/Feedback.jsx';

/**
 * Maintenance mode, for the superadmin: switch it on and off, say what people are told, and set the
 * bypass code. A generated code is shown once, here; only its hash is kept.
 */
export default function MaintenanceCard({ token }) {
  const [s, setS] = useState(null);
  const [message, setMessage] = useState('');
  const [custom, setCustom] = useState('');
  const [shown, setShown] = useState(null);       // a code just generated: shown once
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = async () => {
    try { const r = await api('GET', '/maintenance/settings', null, token); setS(r); setMessage(r.message || ''); }
    catch (e) { setErr(e.message); }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const put = async (body, okMsg) => {
    setBusy(true); setErr('');
    try { const r = await api('PUT', '/maintenance/settings', body, token); setS(r); if (r.code) setShown(r.code); if (okMsg) toast(okMsg); window.dispatchEvent(new Event('tvettrack:maintenance-changed')); return r; }
    catch (e) { setErr(e.message); return null; }
    finally { setBusy(false); }
  };

  const toggle = async () => {
    if (!s.on) {
      const ok = await confirmDialog({
        title: 'Turn maintenance mode on?',
        message: 'Everyone except superadmins is held at a maintenance page, and signed-in users lose access at once, until they enter the bypass code or you turn it off.',
        confirmLabel: 'Turn on',
      });
      if (!ok) return;
    }
    await put({ on: !s.on, message }, s.on ? 'Maintenance mode is off.' : 'Maintenance mode is on.');
  };

  if (!s) return err ? <div className="mt-admin"><div className="mt-err">{err}</div></div> : null;
  return (
    <section className="mt-admin" aria-label="Maintenance mode">
      <div className="mt-admin-head">
        <div>
          <div className="mt-admin-title">Maintenance mode</div>
          <div className="mt-admin-sub">{s.on ? 'On: only superadmins and people with the bypass code can use the app.' : 'Off: everyone can use the app.'}</div>
        </div>
        <button type="button" role="switch" aria-checked={s.on} className={`mt-switch${s.on ? ' is-on' : ''}`} onClick={toggle} disabled={busy}>
          <span className="mt-knob" /><span className="sr-only">{s.on ? 'Turn off' : 'Turn on'}</span>
        </button>
      </div>

      <div className="mt-admin-body">
        <label htmlFor="mt-msg">What people are told</label>
        <textarea id="mt-msg" className="tw-in" rows={2} maxLength={300} value={message} placeholder="e.g. Back at 6 pm."
          onChange={e => setMessage(e.target.value)} />
        <div><button type="button" className="btn btn-secondary btn-sm" disabled={busy || message === (s.message || '')}
          onClick={() => put({ message }, 'Message saved.')}>Save message</button></div>

        <div className="mt-admin-rule" />
        <div className="mt-code-line">
          <span><strong>Bypass code:</strong> {s.has_code ? 'set (stored hashed, cannot be shown again)' : 'not set'}</span>
          <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => put({ generate: true }, 'New code generated.')}>
            {s.has_code ? 'Generate a new code' : 'Generate a code'}</button>
          {s.has_code && <button type="button" className="tw-link tw-link-danger" disabled={busy} onClick={() => put({ clear_code: true }, 'Code removed.')}>Remove</button>}
        </div>
        {shown && (
          <div className="mt-shown" role="status">
            <span className="mt-shown-code">{shown}</span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => { navigator.clipboard?.writeText(shown); toast('Copied.'); }}>Copy</button>
            <span className="mt-shown-note">Shown once. Give it only to people who should get in. A new code ends every pass given out before.</span>
          </div>
        )}
        <div className="mt-code-line">
          <input className="tw-in" style={{ maxWidth: 220 }} value={custom} placeholder="Or choose your own (6+ characters)" aria-label="Your own bypass code"
            onChange={e => setCustom(e.target.value)} />
          <button type="button" className="btn btn-secondary btn-sm" disabled={busy || custom.trim().length < 6}
            onClick={async () => { if (await put({ code: custom }, 'Code set.')) setCustom(''); }}>Set</button>
        </div>
        {err && <div className="mt-err" role="alert">{err}</div>}
      </div>
    </section>
  );
}

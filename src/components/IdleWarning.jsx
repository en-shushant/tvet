import { useEffect, useRef } from 'react';

/** The minute before an idle sign-out: says so, counts down, and one click keeps you in. */
export default function IdleWarning({ secondsLeft, onStay, onSignOut }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const mm = String(Math.floor(secondsLeft / 60)).padStart(1, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');
  return (
    <div className="idle-overlay" role="alertdialog" aria-modal="true" aria-labelledby="idle-title" aria-describedby="idle-desc">
      <div className="idle-card">
        <div className="idle-title" id="idle-title">Still there?</div>
        <p id="idle-desc">You will be signed out in <strong>{mm}:{ss}</strong> because there has been no activity. Your unsaved changes would be lost.</p>
        <div className="idle-actions">
          <button type="button" className="btn btn-secondary" onClick={onSignOut}>Sign out now</button>
          <button type="button" className="btn btn-primary" ref={ref} onClick={onStay}>Stay signed in</button>
        </div>
      </div>
    </div>
  );
}

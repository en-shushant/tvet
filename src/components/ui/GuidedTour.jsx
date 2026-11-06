import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';

/**
 * A short guided tour: one highlighted spot at a time, with a note beside it.
 *
 * Each step names the element to point at by CSS selector. A step may carry an
 * `enter` function, run when the step is reached, for a step that needs
 * something opened first (a dialog); the target is then waited for briefly, and
 * if it never appears the note is shown centred rather than the tour stalling.
 * Esc, Skip and the close button end it; the arrow keys move between steps.
 * `onClose(finished)` says whether the last step was reached.
 */
const PAD = 6;
const WAIT_MS = 1200;

const find = (sel) => { try { return sel ? document.querySelector(sel) : null; } catch { return null; } };

export default function GuidedTour({ steps, open, onClose, label = 'Guided tour' }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const nextRef = useRef(null);
  const noteRef = useRef(null);
  const [noteH, setNoteH] = useState(190);
  const step = steps[i];
  const last = i === steps.length - 1;

  useEffect(() => { if (open) setI(0); }, [open]);

  // Reach a step: run its set-up, then wait for its target and measure it.
  useEffect(() => {
    if (!open || !step) return undefined;
    let alive = true, timer;
    step.enter?.();
    const started = Date.now();
    const look = () => {
      if (!alive) return;
      const el = find(step.target);
      if (el) {
        el.scrollIntoView?.({ block: 'center', behavior: 'auto' });
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      } else if (Date.now() - started < WAIT_MS) {
        timer = setTimeout(look, 80);
      } else {
        setRect(null);
      }
    };
    setRect(null);
    look();
    return () => { alive = false; clearTimeout(timer); };
  }, [open, i, step]);

  // Keep the spotlight on its target through scrolling and resizing.
  useLayoutEffect(() => {
    if (!open || !rect || !step) return undefined;
    const upd = () => {
      const el = find(step.target);
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    window.addEventListener('resize', upd);
    window.addEventListener('scroll', upd, true);
    return () => { window.removeEventListener('resize', upd); window.removeEventListener('scroll', upd, true); };
  }, [open, !!rect, step]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = useCallback((finished) => onClose?.(!!finished), [onClose]);
  const next = useCallback(() => { if (last) close(true); else setI(n => n + 1); }, [last, close]);
  const back = useCallback(() => setI(n => Math.max(0, n - 1)), []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(false); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); back(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, next, back, close]);

  useEffect(() => { if (open) nextRef.current?.focus(); }, [open, i]);
  // The note's real height, so it can sit flush above or below the spot instead of on a guess.
  useLayoutEffect(() => { const h = noteRef.current?.getBoundingClientRect().height; if (h && Math.abs(h - noteH) > 1) setNoteH(h); });

  if (!open || !step) return null;

  // The note sits below the spot, or above it when there is no room below.
  const W = 320;
  const vw = window.innerWidth, vh = window.innerHeight;
  let style;
  if (rect) {
    const below = rect.top + rect.height + PAD + 12 + noteH < vh;
    const left = Math.min(Math.max(12, rect.left + rect.width / 2 - W / 2), vw - W - 12);
    style = below
      ? { top: rect.top + rect.height + PAD + 12, left }
      : { top: Math.max(12, rect.top - PAD - 12 - noteH), left };
  } else {
    style = { top: Math.max(12, vh / 2 - noteH / 2), left: Math.max(12, vw / 2 - W / 2) };
  }

  return createPortal(
    <div className="gt-root" role="dialog" aria-modal="true" aria-label={label}>
      {rect
        ? <div className="gt-spot" style={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }} />
        : <div className="gt-dim" />}
      <div className="gt-note" ref={noteRef} style={{ ...style, width: W }}>
        <div className="gt-count">Step {i + 1} of {steps.length}</div>
        <div className="gt-title">{step.title}</div>
        <div className="gt-body">{step.body}</div>
        <div className="gt-actions">
          <button type="button" className="gt-skip" onClick={() => close(false)}>Skip</button>
          <span style={{ flex: 1 }} />
          {i > 0 && <button type="button" className="gt-btn" onClick={back}>Back</button>}
          <button type="button" className="gt-btn gt-primary" ref={nextRef} onClick={next}>{last ? 'Done' : 'Next'}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

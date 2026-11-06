import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { composeLetter, fitLetter, openShortlistLetter } from '../../utils/neaLetter.js';
import { api } from '../../utils/api.js';
import { toast } from '../ui/Feedback.jsx';

/**
 * The shortlisting letter, large, with its spacing and its stamp and signature
 * sizes adjustable and shown as they change.
 *
 * What is drawn is the same HTML the PDF is made from, laid out by the same
 * fitLetter, so a letter that fits here prints on one page. The top and bottom
 * margins are fixed; only the writing between them shrinks to fit. Dashed guides
 * show where the margins are. Margins and sizes can be saved as the firm's
 * defaults, or used just for this PDF.
 */
const A4_W = 794, A4_H = 1123;
const MM_PX = 96 / 25.4;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(+v) ? +v : lo));

function Field({ label, hint, value, min, max, step = 1, unit, onChange }) {
  return (
    <div className="lp-field">
      <div className="lp-field-head">
        <label>{label}</label>
        <span className="lp-num">
          <input type="number" min={min} max={max} step={step} value={value}
            onChange={e => onChange(clamp(e.target.value, min, max))} aria-label={`${label} (${unit})`} />
          <span>{unit}</span>
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} aria-label={label}
        onChange={e => onChange(Number(e.target.value))} />
      {hint && <div className="lp-hint">{hint}</div>}
    </div>
  );
}

const LETTER_TYPES = [
  { value: 'basic', label: 'Basic shortlisting' },
  { value: 'nea_ssemd', label: 'NEA SSEMD' },
  { value: 'nea_essd', label: 'NEA ESSD' },
];

/**
 * `sample` shows the firm's letter with a stand-in recipient, from the firm's page, so the
 * design can be set before any shortlist exists; a letter format can then be picked to try it on.
 * `onSaved` is told the layout that was saved.
 */
export default function LetterPreview({ row, opts, token, canSave, onClose, onPdf, onSaved, sample = false, title = 'Letter preview' }) {
  const [letterType, setLetterType] = useState(row.list_letter_type || row.letter_type || 'basic');
  const [composed, setComposed] = useState(null);
  const [err, setErr] = useState('');
  const [m, setM] = useState({ top: 15, bottom: 15, lr: 20 });
  const [stamp, setStamp] = useState(100);   // percent of the standard size
  const [sign, setSign] = useState(100);
  const [fit, setFit] = useState(null);
  const [guides, setGuides] = useState(true);
  const [zoom, setZoom] = useState('fit');
  const [box, setBox] = useState({ w: 600, h: 700 });
  const [saving, setSaving] = useState(false);
  const [making, setMaking] = useState(false);
  const frameRef = useRef(null);
  const areaRef = useRef(null);
  const initial = useRef(null);

  // Lay the letter out once, with the firm's saved values, then let the controls take over.
  useEffect(() => {
    let alive = true;
    // Margins and sizes are taken from the firm once; changing the letter format afterwards keeps what was set.
    const first = !initial.current;
    composeLetter({ ...row, list_letter_type: letterType }, { ...opts, preview: true, ...(first ? {} : { margins: m, stampScale: stamp / 100, signScale: sign / 100 }) })
      .then(c => {
        if (!alive) return;
        if (first) {
          initial.current = { m: c.margins, stamp: Math.round(c.stampScale * 100), sign: Math.round(c.signScale * 100) };
          setM(c.margins); setStamp(Math.round(c.stampScale * 100)); setSign(Math.round(c.signScale * 100));
        }
        setComposed(c);
      })
      .catch(e => alive && setErr(e?.message || 'Could not prepare the preview.'));
    return () => { alive = false; };
  }, [letterType]); // eslint-disable-line react-hooks/exhaustive-deps

  // The room the page has, so it can be drawn as large as it fits.
  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return undefined;
    const read = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [composed]);

  const apply = useCallback(() => {
    const doc = frameRef.current?.contentDocument;
    if (!doc || !doc.querySelector('.fit')) return;
    doc.documentElement.style.setProperty('--stamp', String(stamp / 100));
    doc.documentElement.style.setProperty('--sign', String(sign / 100));
    setFit(fitLetter(doc, { topMm: m.top, bottomMm: m.bottom, lrMm: m.lr }));
  }, [m, stamp, sign]);

  useEffect(() => { apply(); }, [apply, composed]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const pad = 32;
  const fitScale = Math.max(0.2, Math.min((box.w - pad) / A4_W, (box.h - pad) / A4_H));
  const scale = zoom === 'fit' ? fitScale : 1;
  const px = (mm) => mm * MM_PX * scale;

  const settings = () => ({ margins: m, stampScale: stamp / 100, signScale: sign / 100 });

  const makePdf = async () => {
    setMaking(true);
    try { onPdf(await openShortlistLetter({ ...row, list_letter_type: letterType }, { ...opts, ...settings() })); }
    catch (e) { setErr(e?.message || 'Letter generation failed.'); }
    finally { setMaking(false); }
  };

  const saveDefaults = async () => {
    setSaving(true);
    try {
      await api('PUT', `/institutes/${row.institute_id}/letter-layout`, {
        letter_top_margin: m.top, letter_bottom_padding: m.bottom, letter_lr_padding: m.lr,
        letter_stamp_scale: stamp / 100, letter_sign_scale: sign / 100,
      }, token);
      toast('Saved as this firm’s letter design.');
      initial.current = { m: { ...m }, stamp, sign };
      onSaved?.({ top: m.top, bottom: m.bottom, lr: m.lr, stamp: stamp / 100, sign: sign / 100 });
    } catch (e) { setErr(e.message || 'Could not save.'); }
    finally { setSaving(false); }
  };

  const autoDetect = () => {
    const d = composed?.detected || {};
    if (d.top == null && d.bottom == null) { toast('No letterhead artwork was found to measure.'); return; }
    setM(x => ({ ...x, top: d.top ?? x.top, bottom: d.bottom ?? x.bottom }));
  };
  const reset = () => { const i = initial.current; if (i) { setM(i.m); setStamp(i.stamp); setSign(i.sign); } };

  const status = !fit ? null
    : !fit.fits ? { tone: 'bad', text: 'Too long to fit one page even at 40%. Reduce the margins.' }
    : fit.scale < 0.995 ? { tone: 'warn', text: `Writing scaled to ${Math.round(fit.scale * 100)}% to fit one page` }
    : { tone: 'ok', text: 'Fits on one page at full size' };

  return createPortal(
    <div className="lp-root" role="dialog" aria-modal="true" aria-label="Letter preview and spacing">
      <div className="lp-bar">
        <strong>{title}</strong>
        <span className="lp-sub">{row.institute_acronym || row.institute_name}</span>
        <span style={{ flex: 1 }} />
        {canSave && (
          <button type="button" className="lp-btn lp-bar-save" onClick={saveDefaults} disabled={saving || !composed}>
            {saving ? 'Saving…' : 'Save'}</button>
        )}
        <button type="button" className="lp-btn" onClick={onClose}>Close</button>
        <button type="button" className="lp-btn lp-primary" onClick={makePdf} disabled={!composed || making}>
          {making ? 'Making PDF…' : sample ? 'Sample PDF' : 'Make PDF'}</button>
      </div>
      <div className="lp-body">
        <aside className="lp-side">
          {status && <div className={`lp-status is-${status.tone}`} role="status">{status.text}</div>}
          {sample && (
            <div className="lp-field">
              <div className="lp-field-head"><label htmlFor="lp-type">Try it on</label></div>
              <select id="lp-type" className="tw-in" value={letterType} onChange={e => setLetterType(e.target.value)}>
                {LETTER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <div className="lp-hint">A sample recipient stands in for the organization.</div>
            </div>
          )}
          <Field label="Top margin" unit="mm" min={0} max={120} value={Math.round(m.top * 10) / 10}
            hint="Space above the writing: clears the letterhead’s header." onChange={v => setM(x => ({ ...x, top: v }))} />
          <Field label="Bottom margin" unit="mm" min={0} max={120} value={Math.round(m.bottom * 10) / 10}
            hint="Space below the writing: clears the letterhead’s footer." onChange={v => setM(x => ({ ...x, bottom: v }))} />
          <Field label="Left and right" unit="mm" min={0} max={50} value={Math.round(m.lr * 10) / 10}
            onChange={v => setM(x => ({ ...x, lr: v }))} />
          <hr className="lp-rule" />
          <Field label="Stamp size" unit="%" min={40} max={250} step={5} value={stamp}
            hint={opts.includeStamp ? 'Applies to the letter and to the attached pages.' : 'The stamp is switched off for this letter.'} onChange={setStamp} />
          <Field label="Signature size" unit="%" min={40} max={250} step={5} value={sign}
            hint={opts.includeSign ? 'Applies to the letter and to the attached pages.' : 'The signature is switched off for this letter.'} onChange={setSign} />
          <div className="lp-actions">
            <button type="button" className="lp-btn" onClick={autoDetect} disabled={!composed}>Measure from letterhead</button>
            <button type="button" className="lp-btn" onClick={reset} disabled={!composed}>Reset</button>
          </div>
          {canSave && (
            <button type="button" className="lp-btn lp-wide" onClick={saveDefaults} disabled={saving || !composed}>
              {saving ? 'Saving…' : 'Save letter design'}</button>
          )}
          <div className="lp-hint">{sample ? 'Saved values are used for every letter this firm sends.' : '“Make PDF” uses these values whether or not you save them.'}</div>
        </aside>
        <main className="lp-stage">
          <div className="lp-tools">
            <label><input type="checkbox" checked={guides} onChange={e => setGuides(e.target.checked)} /> Margin guides</label>
            <button type="button" className="lp-btn" onClick={() => setZoom(z => z === 'fit' ? 'full' : 'fit')}>
              {zoom === 'fit' ? 'Actual size' : 'Fit to screen'}</button>
          </div>
          <div className="lp-area" ref={areaRef}>
            {err && <div className="lp-err" role="alert">{err}</div>}
            {!composed && !err && <div className="lp-wait">Preparing the letter…</div>}
            {composed && (
              <div className="lp-page" style={{ width: A4_W * scale, height: A4_H * scale }}>
                <iframe ref={frameRef} title="Letter" srcDoc={composed.html} sandbox="allow-same-origin"
                  onLoad={apply}
                  style={{ width: A4_W, height: A4_H, transform: `scale(${scale})`, transformOrigin: 'top left' }} />
                {guides && (
                  <>
                    <div className="lp-guide lp-g-h" style={{ top: px(m.top) }}><span>Top {Math.round(m.top)} mm</span></div>
                    <div className="lp-guide lp-g-h" style={{ top: A4_H * scale - px(m.bottom) }}><span>Bottom {Math.round(m.bottom)} mm</span></div>
                    <div className="lp-guide lp-g-v" style={{ left: px(m.lr) }} />
                    <div className="lp-guide lp-g-v" style={{ left: A4_W * scale - px(m.lr) }} />
                  </>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>,
    document.body,
  );
}

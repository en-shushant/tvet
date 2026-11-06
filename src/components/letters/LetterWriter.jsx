import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../utils/api.js';
import { getSession } from '../../utils/auth.js';
import NepaliInput from '../ui/NepaliInput.jsx';
import { fitLetter, renderComposed, bsDateLabel } from '../../utils/neaLetter.js';
import { BLANK_LETTER, loadFirmAssets, buildLetterHtml, bodyHtml, composeWritten } from '../../utils/writtenLetter.js';
import { LetterPreviewModal } from '../shortlisting/modals.jsx';
import { useCloseGuard } from '../ui/Modal.jsx';

/**
 * Write a letter on a firm's letterhead: the office it goes to, a subject, the body,
 * an optional table, and an optional signature and stamp. The page on the right is the
 * letter as it will print; it updates as you type. Margins and the size of the stamp and
 * signature come from the firm's saved letter design, so every letter looks alike.
 */
const A4_W = 794, A4_H = 1123;
const MM_PX = 96 / 25.4;
const todayBS = () => bsDateLabel(new Date().toISOString().slice(0, 10));

/** The firm, in the shape the letter code reads (the same institute_* names the shortlisting letter uses). */
const rowOf = (i) => ({
  institute_id: i.id, institute_name: i.name, institute_acronym: i.acronym, institute_name_np: i.name_np,
  institute_contact: i.contact_person, institute_contact_np: i.contact_person_np,
  institute_letterhead: i.letterhead, institute_sign: i.sign, institute_stamp: i.stamp,
  institute_letter_top_margin: i.letter_top_margin, institute_letter_lr_padding: i.letter_lr_padding,
  institute_letter_bottom_padding: i.letter_bottom_padding,
  institute_letter_stamp_scale: i.letter_stamp_scale, institute_letter_sign_scale: i.letter_sign_scale,
});

export default function LetterWriter({ institutes = [], firmId = '', onClose }) {
  const token = getSession()?.token;
  const [firm, setFirm] = useState(String(firmId || ''));
  const [assets, setAssets] = useState(null);
  const [c, setC] = useState(() => ({ ...BLANK_LETTER, date: todayBS() }));
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [fit, setFit] = useState(null);
  const [guides, setGuides] = useState(false);
  const [making, setMaking] = useState(false);
  const [pdf, setPdf] = useState(null);
  const [box, setBox] = useState({ w: 600, h: 700 });
  const frameRef = useRef(null);
  const areaRef = useRef(null);
  const set = (k, v) => setC(x => ({ ...x, [k]: v }));
  // Typing is not thrown away by a stray Close or Esc.
  const guard = useCloseGuard(onClose);

  // The firm's images, fonts and layout, once per firm.
  useEffect(() => {
    if (!firm) { setAssets(null); return undefined; }
    let alive = true;
    setLoading(true); setErr('');
    api('GET', `/institutes/${firm}`, null, token)
      .then(i => loadFirmAssets(rowOf(i)).then(a => {
        if (!alive) return;
        setAssets(a);
        setC(x => ({ ...x, designation: x.designation || i.contact_designation || '' }));
      }))
      .catch(e => alive && setErr(e?.message || 'Could not load that firm.'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [firm, token]);

  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return undefined;
    const read = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [assets]);

  // Change the writing in place, so the page does not flash as you type.
  const apply = () => {
    const doc = frameRef.current?.contentDocument;
    const fitEl = doc?.querySelector('.fit');
    if (!fitEl || !assets) return;
    fitEl.innerHTML = bodyHtml(assets, c);
    const page = doc.querySelector('.page');
    page.style.backgroundImage = assets.letterhead && c.withLetterhead ? `url("${assets.letterhead}")` : 'none';
    const r = fitLetter(doc, { topMm: assets.margins.top, bottomMm: assets.margins.bottom, lrMm: assets.margins.lr });
    setFit(prev => (prev && prev.scale === r.scale && prev.fits === r.fits ? prev : r));
  };
  useEffect(() => { apply(); }); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !pdf) guard.requestClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [guard, pdf]);

  const makePdf = async () => {
    setMaking(true); setErr('');
    try { const r = await renderComposed(composeWritten(assets, c)); setPdf({ url: r.url, name: `${assets.firmLabel}-letter.pdf` }); }
    catch (e) { setErr(e?.message || 'Could not make the PDF.'); }
    finally { setMaking(false); }
  };

  const pad = 32;
  const scale = Math.max(0.2, Math.min((box.w - pad) / A4_W, (box.h - pad) / A4_H));
  const px = (mm) => mm * MM_PX * scale;

  // Table editing
  const T = c.table;
  const setT = (t) => set('table', t);
  const setCol = (i, v) => setT({ ...T, cols: T.cols.map((x, k) => k === i ? v : x) });
  const setCell = (r, i, v) => setT({ ...T, rows: T.rows.map((row, k) => k === r ? row.map((x, j) => j === i ? v : x) : row) });
  const addRow = () => setT({ ...T, rows: [...T.rows, T.cols.map(() => '')] });
  const addCol = () => setT({ ...T, cols: [...T.cols, ''], rows: T.rows.map(r => [...r, '']) });
  const delRow = (r) => setT({ ...T, rows: T.rows.filter((_, k) => k !== r) });
  const delCol = (i) => T.cols.length > 1 && setT({ ...T, cols: T.cols.filter((_, k) => k !== i), rows: T.rows.map(r => r.filter((_, j) => j !== i)) });

  const status = !fit ? null
    : !fit.fits ? { tone: 'bad', text: 'Too long for one page. Shorten the body or the table.' }
    : fit.scale < 0.995 ? { tone: 'warn', text: `Writing scaled to ${Math.round(fit.scale * 100)}% to fit one page` }
    : { tone: 'ok', text: 'Fits on one page at full size' };

  return createPortal(
    <div className="lp-root" role="dialog" aria-modal="true" aria-label="Write a letter" ref={guard.ref} onClickCapture={guard.onClickCapture}>
      <div className="lp-bar">
        <strong>Write a letter</strong>
        <span style={{ flex: 1 }} />
        <button type="button" className="lp-btn" onClick={guard.requestClose}>Close</button>
        <button type="button" className="lp-btn lp-primary" onClick={makePdf} disabled={!assets || making}>
          {making ? 'Making PDF…' : 'Make PDF'}</button>
      </div>
      <div className="lp-body">
        <aside className="lp-side lw-side">
          {institutes.length > 1 || !firm ? (
            <div className="lp-field">
              <div className="lp-field-head"><label htmlFor="lw-firm">Firm (its letterhead is used)</label></div>
              <select id="lw-firm" className="tw-in" value={firm} onChange={e => setFirm(e.target.value)}>
                <option value="">Choose a firm…</option>
                {institutes.map(i => <option key={i.id} value={i.id}>{i.acronym ? `[${i.acronym}] ` : ''}{i.name}</option>)}
              </select>
            </div>
          ) : null}
          {status && <div className={`lp-status is-${status.tone}`} role="status">{status.text}</div>}

          <div className="lw-group">
            <div className="lw-row">
              <div className="lw-f"><label>Ref. no. (optional)</label>
                <input className="tw-in" value={c.refNo} onChange={e => set('refNo', e.target.value)} /></div>
              <div className="lw-f"><label>Date</label>
                <NepaliInput className="tw-in" value={c.date} onChange={e => set('date', e.target.value)} /></div>
            </div>
          </div>

          <div className="lw-group">
            <div className="lw-title">To</div>
            <div className="lw-f"><label>Addressee</label>
              <NepaliInput className="tw-in" value={c.addressee} placeholder="e.g. श्री कार्यालय प्रमुख ज्यू," onChange={e => set('addressee', e.target.value)} /></div>
            <div className="lw-f"><label>Office name</label>
              <NepaliInput className="tw-in" value={c.office} onChange={e => set('office', e.target.value)} /></div>
            <div className="lw-f"><label>Department / second line (optional)</label>
              <NepaliInput className="tw-in" value={c.office2} onChange={e => set('office2', e.target.value)} /></div>
            <div className="lw-f"><label>Address</label>
              <NepaliInput className="tw-in" value={c.address} onChange={e => set('address', e.target.value)} /></div>
          </div>

          <div className="lw-group">
            <div className="lw-f"><label>Subject</label>
              <NepaliInput className="tw-in" value={c.subject} onChange={e => set('subject', e.target.value)} /></div>
            <div className="lw-f"><label>Body</label>
              <NepaliInput multiline className="tw-in" rows={9} value={c.body} onChange={e => set('body', e.target.value)} />
              <div className="lp-hint">A blank line starts a new paragraph.</div></div>
          </div>

          <div className="lw-group">
            <label className="lw-check"><input type="checkbox" checked={T.on} onChange={e => setT({ ...T, on: e.target.checked })} /> Add a table</label>
            {T.on && (
              <div className="lw-table">
                <div className="lw-trow">
                  {T.cols.map((h, i) => (
                    <span key={i} className="lw-tcell">
                      <input className="tw-in lw-th" value={h} placeholder={`Heading ${i + 1}`} aria-label={`Heading ${i + 1}`} onChange={e => setCol(i, e.target.value)} />
                      {T.cols.length > 1 && <button type="button" className="lw-x" aria-label={`Remove column ${i + 1}`} onClick={() => delCol(i)}>×</button>}
                    </span>
                  ))}
                </div>
                {T.rows.map((r, ri) => (
                  <div key={ri} className="lw-trow">
                    {T.cols.map((_, i) => (
                      <span key={i} className="lw-tcell">
                        <input className="tw-in" value={r[i] ?? ''} aria-label={`Row ${ri + 1}, ${T.cols[i] || `column ${i + 1}`}`} onChange={e => setCell(ri, i, e.target.value)} />
                      </span>
                    ))}
                    <button type="button" className="lw-x" aria-label={`Remove row ${ri + 1}`} onClick={() => delRow(ri)}>×</button>
                  </div>
                ))}
                <div className="lw-tbtns">
                  <button type="button" className="lp-btn" onClick={addRow}>Add row</button>
                  <button type="button" className="lp-btn" onClick={addCol}>Add column</button>
                </div>
              </div>
            )}
          </div>

          <div className="lw-group">
            <div className="lw-title">Signed by</div>
            <div className="lw-f"><label>Name</label>
              <NepaliInput className="tw-in" value={c.signatory} placeholder={assets?.contact || ''} onChange={e => set('signatory', e.target.value)} /></div>
            <div className="lw-f"><label>Designation</label>
              <NepaliInput className="tw-in" value={c.designation} onChange={e => set('designation', e.target.value)} /></div>
            <label className="lw-check"><input type="checkbox" checked={c.withSign} onChange={e => set('withSign', e.target.checked)} disabled={!assets?.sign} /> Signature{assets && !assets.sign ? ' (none uploaded)' : ''}</label>
            <label className="lw-check"><input type="checkbox" checked={c.withStamp} onChange={e => set('withStamp', e.target.checked)} disabled={!assets?.stamp} /> Stamp{assets && !assets.stamp ? ' (none uploaded)' : ''}</label>
            <label className="lw-check"><input type="checkbox" checked={c.withLetterhead} onChange={e => set('withLetterhead', e.target.checked)} disabled={!assets?.letterhead} /> Letterhead{assets && !assets.letterhead ? ' (none uploaded)' : ''}</label>
            <div className="lp-hint">Margins and the size of the stamp and signature come from the firm’s letter design (Institutes › Documents).</div>
          </div>
        </aside>

        <main className="lp-stage">
          <div className="lp-tools">
            <label><input type="checkbox" checked={guides} onChange={e => setGuides(e.target.checked)} /> Margin guides</label>
          </div>
          <div className="lp-area" ref={areaRef}>
            {err && <div className="lp-err" role="alert">{err}</div>}
            {!firm && !err && <div className="lp-wait">Choose a firm to start.</div>}
            {firm && loading && <div className="lp-wait">Loading the firm’s letterhead…</div>}
            {assets && (
              <div className="lp-page" style={{ width: A4_W * scale, height: A4_H * scale }}>
                <iframe ref={frameRef} title="Letter" srcDoc={buildLetterHtml(assets, BLANK_LETTER, { preview: true })} sandbox="allow-same-origin"
                  onLoad={apply} style={{ width: A4_W, height: A4_H, transform: `scale(${scale})`, transformOrigin: 'top left' }} />
                {guides && (
                  <>
                    <div className="lp-guide lp-g-h" style={{ top: px(assets.margins.top) }}><span>Top {Math.round(assets.margins.top)} mm</span></div>
                    <div className="lp-guide lp-g-h" style={{ top: A4_H * scale - px(assets.margins.bottom) }}><span>Bottom {Math.round(assets.margins.bottom)} mm</span></div>
                  </>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
      {guard.prompt}
      {pdf && <LetterPreviewModal url={pdf.url} filename={pdf.name} onClose={() => setPdf(null)} />}
    </div>,
    document.body,
  );
}

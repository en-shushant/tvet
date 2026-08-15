/**
 * Every dialog the shortlisting screen opens.
 *
 * Grouped rather than split one-per-file: they share the document labels,
 * service types and letter types below, and are only ever reached from the
 * results table.
 */
import { useState, useEffect, useMemo } from 'react';
import Modal from '../ui/Modal.jsx';
import { Btn, MdTextField, MdSelect, MdOption, MdToggle } from '../../md.jsx';
import { api } from '../../utils/api.js';
import { getCurrentFY } from '../../constants/data.js';
import { openShortlistLetter } from '../../utils/neaLetter.js';
import { parseDocUrls, FYS, ACCEPT } from './common.jsx';

function LetterPreviewModal({ url, filename, onClose }) {
  const frameRef = useRef(null);

  const handlePrint = () => {
    // Chrome's built-in PDF viewer exposes print() on the frame; if the browser
    // blocks it, fall back to opening the PDF in its own tab.
    try {
      const w = frameRef.current?.contentWindow;
      if (w) { w.focus(); w.print(); return; }
    } catch {}
    window.open(url, '_blank', 'noopener');
  };

  return (
    <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:1300, display:'flex', flexDirection:'column'}}>
      <div style={{display:'flex', alignItems:'center', gap:10, padding:'10px 20px', background:'var(--surface)', borderBottom:'1px solid var(--border)', flexShrink:0}}>
        <div style={{fontWeight:700, fontSize:16, color:'var(--text)'}}>Letter Preview</div>
        <div style={{marginLeft:'auto', display:'flex', gap:8, alignItems:'center'}}>
          <Btn className="btn btn-secondary" onClick={handlePrint}>
            <span className="material-icons-round" style={{fontSize:16}}>print</span> Print
          </Btn>
          <a href={url} download={filename}
            className="btn btn-primary"
            style={{textDecoration:'none', display:'inline-flex', alignItems:'center', gap:6}}>
            <span className="material-icons-round" style={{fontSize:16}}>download</span> Download
          </a>
          <button onClick={onClose} style={{background:'none', border:'none', cursor:'pointer', fontSize:22, lineHeight:1, color:'var(--text3)', padding:'0 4px'}}>×</button>
        </div>
      </div>
      <iframe ref={frameRef} src={url} title="Letter preview"
        style={{flex:1, border:'none', background:'#666', width:'100%'}}/>
    </div>
  );
}

const DOC_LABELS = {
  ocrReg:   'OCR दर्ता प्रमाणपत्र',
  ocrRen:   'OCR नवीकरण प्रमाणपत्र',
  llReg:    'स्थानीय तह दर्ता प्रमाणपत्र',
  llRen:    'स्थानीय तह नवीकरण प्रमाणपत्र',
  vat:      'भ्याट दर्ता प्रमाणपत्र',
  taxClear: 'कर चुक्ता प्रमाणपत्र',
  vatExt:   'भ्याट म्याद थप प्रमाणपत्र',
  ctevtAff: 'CTEVT सम्बन्धन पत्र',
  ctevtRen: 'CTEVT नवीकरण पत्र',
};

const SERVICE_TYPES = [
  'सीपमूलक तथा व्यावसायिक तालिम कार्यक्रमहरु सञ्चालन',
  'परामर्श सेवा',
  'अन्य सेवा',
];

// Create / edit a standing list. Firms are assigned separately, so a list can
// exist before any firm is on it.
const LETTER_TYPES = [
  { value: 'basic',     label: 'Basic Shortlisting' },
  { value: 'nea_ssemd', label: 'NEA SSEMD' },
  { value: 'nea_essd',  label: 'NEA ESSD' },
];

export function StandingListModal({ list, onSave, onClose, saving }) {
  const [f, setF] = useState(() => ({
    letter_type:          list?.letter_type          || 'basic',
    addressee:            list?.addressee            || '',
    client_name_manual:   list?.client_name_manual   || '',
    client_name2_manual:  list?.client_name2_manual  || '',
    client_address_manual: list?.client_address_manual || '',
    name:        list?.name || '',
    fy:          list?.fy || getCurrentFY(),
    list_date:   list?.list_date ? String(list.list_date).slice(0, 10) : new Date().toISOString().slice(0, 10),
    valid_until: list?.valid_until ? String(list.valid_until).slice(0, 10) : '',
    status:      list?.status || 'Active',
    remarks:     list?.remarks || '',
  }));
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const valid = !!f.client_name_manual.trim();

  // Build the live letter-address preview
  const addrLine1 = `श्री ${f.addressee.trim() || 'कार्यालय प्रमुख'} ज्यू,`;
  const addrLines = [
    addrLine1,
    f.client_name_manual.trim() || '…',
    f.client_name2_manual.trim() || null,
    f.client_address_manual.trim() || '…',
  ].filter(Boolean);

  return (
    <Modal title={list ? 'Edit shortlist' : 'New shortlist'} onClose={onClose} footer={<>
      <Btn className="btn btn-secondary" onClick={onClose}>Cancel</Btn>
      <Btn className="btn btn-primary" disabled={!valid || saving}
        onClick={() => onSave({
          ...f,
          letter_type:           f.letter_type || 'basic',
          addressee:             f.addressee.trim() || null,
          client_name_manual:    f.client_name_manual.trim(),
          client_name2_manual:   f.client_name2_manual.trim() || null,
          client_address_manual: f.client_address_manual.trim() || null,
        })}>
        {saving ? 'Saving…' : list ? 'Save changes' : 'Create shortlist'}
      </Btn>
    </>}>
      <div style={{display:'flex', flexDirection:'column', gap:12}}>
        {/* Letter format */}
        <div className="form-group">
          <MdSelect label="Letter format" value={f.letter_type} onChange={e=>set('letter_type', e.target.value)}>
            {LETTER_TYPES.map(t => <MdOption key={t.value} value={t.value}>{t.label}</MdOption>)}
          </MdSelect>
        </div>
        {/* Address block — printed verbatim at the top of the generated letter */}
        <div className="form-group">
          <MdTextField label="Addressee title" value={f.addressee}
            onChange={e=>set('addressee', e.target.value)} placeholder="e.g. कार्यालय प्रमुख"/>
          <div style={{fontSize:11, color:'var(--text3)', marginTop:4}}>
            Printed as: <b>श्री {f.addressee.trim() || 'कार्यालय प्रमुख'} ज्यू,</b>
          </div>
        </div>
        <div className="form-group">
          <MdTextField label="Organization name *" value={f.client_name_manual}
            onChange={e=>set('client_name_manual', e.target.value)} placeholder="e.g. नेपाल विद्युत प्राधिकरण"/>
        </div>
        <div className="form-group">
          <MdTextField label="Department / Level 2 (optional)" value={f.client_name2_manual}
            onChange={e=>set('client_name2_manual', e.target.value)} placeholder="e.g. वातावरण तथा सामाजिक अध्ययन विभाग"/>
        </div>
        <div className="form-group">
          <MdTextField label="Organization address" value={f.client_address_manual}
            onChange={e=>set('client_address_manual', e.target.value)} placeholder="e.g. लाजिम्पाट, काठमाडौं"/>
        </div>
        <div style={{
          fontSize:12, color:'var(--text2)', background:'var(--bg)', border:'1px solid var(--border)',
          borderRadius:8, padding:'8px 12px', lineHeight:1.7, marginTop:-4,
        }}>
          <div style={{fontSize:11, color:'var(--text3)', marginBottom:4}}>Printed in the letter as:</div>
          {addrLines.map((l, i) => <div key={i}>{l}</div>)}
        </div>
        <div className="form-group">
          <MdTextField label="Shortlist name" value={f.name} onChange={e=>set('name', e.target.value)}
            placeholder="e.g. Standing List 2081/82"/>
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <MdSelect label="Fiscal year" value={f.fy} onChange={e=>set('fy', e.target.value)}>
              {FYS.map(y => <MdOption key={y} value={y}>{y}</MdOption>)}
            </MdSelect>
          </div>
          <div className="form-group">
            <MdSelect label="Status" value={f.status} onChange={e=>set('status', e.target.value)}>
              {['Active','Expired','Pending'].map(s => <MdOption key={s} value={s}>{s}</MdOption>)}
            </MdSelect>
          </div>
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <MdTextField type="date" label="Shortlist date" value={f.list_date} onChange={e=>set('list_date', e.target.value)}/>
          </div>
          <div className="form-group">
            <MdTextField type="date" label="Valid until (optional)" value={f.valid_until} onChange={e=>set('valid_until', e.target.value)}/>
          </div>
        </div>
        <div className="form-group">
          <MdTextField label="Remarks" value={f.remarks} onChange={e=>set('remarks', e.target.value)}/>
        </div>
      </div>
    </Modal>
  );
}

// Bulk-assign firms to an existing standing list.
export function AssignFirmsModal({ list, institutes, assignedIds, onSave, onClose, saving }) {
  const [picked, setPicked] = useState(() => new Set(assignedIds));
  const [q, setQ] = useState('');

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return institutes;
    return institutes.filter(i =>
      `${i.name} ${i.acronym || ''}`.toLowerCase().includes(needle)
    );
  }, [institutes, q]);

  const toggle = id => setPicked(s => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const toAdd    = [...picked].filter(id => !assignedIds.has(id));
  const toRemove = [...assignedIds].filter(id => !picked.has(id));
  const changed  = toAdd.length + toRemove.length;

  return (
    <Modal title={`Manage firms${list?.name ? ` — ${list.name}` : ''}`} onClose={onClose} footer={<>
      <Btn className="btn btn-secondary" onClick={onClose}>Cancel</Btn>
      <Btn className="btn btn-primary" disabled={!changed || saving}
        onClick={() => onSave(toAdd, toRemove)}>
        {saving ? 'Saving…' : changed ? `Save (${toAdd.length > 0 ? `+${toAdd.length}` : ''}${toAdd.length > 0 && toRemove.length > 0 ? ' ' : ''}${toRemove.length > 0 ? `−${toRemove.length}` : ''})` : 'No changes'}
      </Btn>
    </>}>
      <div style={{display:'flex', flexDirection:'column', gap:10}}>
        <MdTextField label="Search firms" value={q} onChange={e=>setQ(e.target.value)} placeholder="Name or acronym"/>
        <div style={{fontSize:12, color:'var(--text3)'}}>
          {picked.size} of {institutes.length} firm{institutes.length !== 1 ? 's' : ''} selected
        </div>
        <div style={{maxHeight:340, overflowY:'auto', border:'1px solid var(--border)', borderRadius:10}}>
          {visible.length === 0 ? (
            <div style={{padding:20, textAlign:'center', color:'var(--text3)', fontSize:13}}>
              No firms match your search.
            </div>
          ) : visible.map(i => {
            const on = picked.has(i.id);
            return (
              <label key={i.id} style={{
                display:'flex', alignItems:'center', gap:10, padding:'9px 12px', cursor:'pointer',
                borderBottom:'1px solid var(--border)',
                background: on ? 'color-mix(in srgb, var(--primary) 10%, transparent)' : 'transparent',
              }}>
                <input type="checkbox" checked={on} onChange={()=>toggle(i.id)} style={{accentColor:'var(--primary)'}}/>
                <span style={{fontSize:13, color:'var(--text)'}}>
                  {i.acronym ? <b>[{i.acronym}] </b> : ''}{i.name}
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}

export function ViewDocumentsModal({ instituteId, token, onClose }) {
  const [inst, setInst] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    api('GET', `/institutes/${instituteId}`, null, token)
      .then(r => { if (!cancelled) setInst(r); })
      .catch(e => { if (!cancelled) setErr(e.message || 'Could not load documents.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [instituteId, token]);

  const Thumb = ({ src }) => {
    const isPdf = src && (src.toLowerCase().includes('.pdf') || src.toLowerCase().includes('application/pdf'));
    return (
      <a href={src} target="_blank" rel="noreferrer" style={{
        display:'flex', alignItems:'center', justifyContent:'center',
        width:64, height:64, borderRadius:8, overflow:'hidden',
        border:'1.5px solid var(--border)', background:'#fff', flexShrink:0,
        textDecoration:'none', gap:4, flexDirection:'column',
      }}>
        {isPdf
          ? <>
              <span className="material-icons-round" style={{fontSize:28, color:'var(--error)'}}>picture_as_pdf</span>
              <span style={{fontSize:9, color:'var(--text2)', fontWeight:600}}>PDF</span>
            </>
          : <img src={src} alt="" style={{width:'100%', height:'100%', objectFit:'contain', display:'block'}}/>
        }
      </a>
    );
  };

  const Row = ({ label, urls }) => (
    <div style={{display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderBottom:'1px solid var(--border)'}}>
      <div style={{flex:'0 0 220px', fontSize:13, color: urls.length ? 'var(--text)' : 'var(--text3)', fontWeight: urls.length ? 600 : 400}}>
        {label}
      </div>
      <div style={{flex:1, display:'flex', gap:8, flexWrap:'wrap'}}>
        {urls.length
          ? urls.map((u, i) => <Thumb key={i} src={u}/>)
          : <span style={{fontSize:12, color:'var(--text3)', fontStyle:'italic'}}>Not uploaded</span>}
      </div>
    </div>
  );

  const docRows = inst ? [
    { label: 'Letterhead',            urls: parseDocUrls(inst.letterhead) },
    { label: 'Logo',                  urls: parseDocUrls(inst.logo) },
    { label: 'Authorized Signature',  urls: parseDocUrls(inst.sign) },
    { label: 'Stamp / Seal',          urls: parseDocUrls(inst.stamp) },
    ...Object.entries({
      ocrReg:   inst.ocr_registration,
      ocrRen:   inst.ocr_renewal,
      llReg:    inst.local_level_registration,
      llRen:    inst.local_level_renewal,
      vat:      inst.vat_registration,
      taxClear: inst.tax_clearance_doc,
      vatExt:   inst.vat_extension,
      ctevtAff: inst.ctevt_affiliation,
      ctevtRen: inst.ctevt_renewal,
    }).map(([k, src]) => ({ label: DOC_LABELS[k], urls: parseDocUrls(src) })),
  ] : [];

  return (
    <Modal title={inst ? `Documents — ${inst.acronym || inst.name}` : 'Documents'} onClose={onClose} footer={
      <Btn className="btn btn-secondary" onClick={onClose}>Close</Btn>
    }>
      {loading ? (
        <div style={{textAlign:'center', padding:30, color:'var(--text3)'}}>
          <span className="spin material-icons-round" style={{fontSize:24}}>sync</span>
        </div>
      ) : err ? (
        <div style={{color:'#c0391e', fontSize:13, padding:'8px 4px'}}>{err}</div>
      ) : (
        <div style={{border:'1px solid var(--border)', borderRadius:10, overflow:'hidden'}}>
          {docRows.map((r, i) => <Row key={i} label={r.label} urls={r.urls}/>)}
        </div>
      )}
    </Modal>
  );
}

export function LetterOptsModal({ row, token, onClose, onOpenBuilder }) {
  const [inclSign, setInclSign]   = useState(false);
  const [inclStamp, setInclStamp] = useState(false);
  const [inclLh, setInclLh]       = useState(true);
  const [inclDocs, setInclDocs]   = useState({});
  const [freshRow, setFreshRow]   = useState(row);
  const [instLoading, setInstLoading] = useState(true);
  const [instFetchErr, setInstFetchErr] = useState(false);

  // The shortlist list query omits the institute's images and document URLs —
  // they're only needed here, and carrying them on every row made #shortlisting
  // slow to load. Fetch the full institute on demand instead.
  useEffect(() => {
    const instId = row.institute_id;
    if (!instId) { setInstLoading(false); return; }
    let cancelled = false;
    setInstLoading(true);
    api('GET', `/institutes/${instId}`, null, token)
      .then(inst => {
        if (cancelled) return;
        // NOTE: this endpoint returns raw snake_case columns. It previously read
        // inst.letterTopMargin etc., which were always undefined — so the
        // configured page margins were silently discarded.
        // api() returns raw snake_case JSON — no normalization layer here.
        // Use ?? r.* for margins so a null DB value falls back to whatever
        // the shortlist list JOIN already provided (same column, same table).
        setFreshRow(r => ({
          ...r,
          institute_letter_top_margin:     inst.letter_top_margin     ?? r.institute_letter_top_margin,
          institute_letter_lr_padding:     inst.letter_lr_padding     ?? r.institute_letter_lr_padding,
          institute_letter_bottom_padding: inst.letter_bottom_padding ?? r.institute_letter_bottom_padding,
          institute_service_type:          inst.service_type          || r.institute_service_type,
          institute_logo:       inst.logo,
          institute_letterhead: inst.letterhead,
          institute_sign:       inst.sign,
          institute_stamp:      inst.stamp,
          institute_ocr_registration:         inst.ocr_registration,
          institute_ocr_renewal:              inst.ocr_renewal,
          institute_local_level_registration: inst.local_level_registration,
          institute_local_level_renewal:      inst.local_level_renewal,
          institute_vat_registration:         inst.vat_registration,
          institute_vat_extension:            inst.vat_extension,
          institute_ctevt_affiliation:        inst.ctevt_affiliation,
          institute_ctevt_renewal:            inst.ctevt_renewal,
          institute_tax_clearance_doc:        inst.tax_clearance_doc,
        }));
      })
      .catch(() => { if (!cancelled) setInstFetchErr(true); })
      .finally(() => { if (!cancelled) setInstLoading(false); });
    return () => { cancelled = true; };
  }, [row.institute_id, token]);

  const hasDocs = useMemo(() => ({
    ocrReg:   !!freshRow.institute_ocr_registration,
    ocrRen:   !!freshRow.institute_ocr_renewal,
    llReg:    !!freshRow.institute_local_level_registration,
    llRen:    !!freshRow.institute_local_level_renewal,
    vat:      !!freshRow.institute_vat_registration,
    taxClear: !!freshRow.institute_tax_clearance_doc,
    vatExt:   !!freshRow.institute_vat_extension,
    ctevtAff: !!freshRow.institute_ctevt_affiliation,
    ctevtRen: !!freshRow.institute_ctevt_renewal,
  }), [freshRow]);

  // Default every available document / image to checked once they arrive
  useEffect(() => { setInclDocs({ ...hasDocs }); }, [hasDocs]);
  useEffect(() => {
    setInclSign(!!freshRow.institute_sign);
    setInclStamp(!!freshRow.institute_stamp);
    setInclLh(!!freshRow.institute_letterhead);
  }, [freshRow.institute_sign, freshRow.institute_stamp, freshRow.institute_letterhead]);

  const anyDocs = Object.values(hasDocs).some(Boolean);
  const toggle = k => setInclDocs(d => ({...d, [k]: !d[k]}));

  const [pdfUrl, setPdfUrl] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState(null);

  // Release the blob URL when this modal goes away
  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

  const [skipWarning, setSkipWarning] = useState([]);

  const handleGenerate = async () => {
    setGenerating(true);
    setGenError(null);
    try {
      const { url, skipped } = await openShortlistLetter(freshRow, {
        includeSign: inclSign, includeStamp: inclStamp, includeLh: inclLh,
        docs: inclDocs, serviceType: freshRow.institute_service_type,
      });
      if (skipped.length) setSkipWarning(skipped);
      setPdfUrl(url);
    } catch (e) {
      console.error('[letter] generation failed:', e);
      setGenError(e?.message || 'Letter generation failed. Check the browser console for details.');
    } finally { setGenerating(false); }
  };

  if (pdfUrl) {
    const name = `${freshRow.institute_acronym || freshRow.institute_name || 'shortlist'}-letter.pdf`;
    return (
      <>
        {skipWarning.length > 0 && (
          <div style={{position:'fixed', inset:0, zIndex:1400, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,.4)'}}>
            <div style={{background:'var(--surface)', borderRadius:12, padding:'24px 28px', maxWidth:420, width:'90%', boxShadow:'0 8px 32px rgba(0,0,0,.25)'}}>
              <div style={{fontWeight:700, fontSize:15, color:'var(--error)', marginBottom:10}}>Some documents could not be attached</div>
              <div style={{fontSize:13, color:'var(--text2)', marginBottom:12, lineHeight:1.6}}>
                The following selected documents were skipped because the file could not be fetched, is password-protected, or is in an unsupported format:
              </div>
              <ul style={{paddingLeft:18, margin:'0 0 16px', fontSize:13, color:'var(--text)'}}>
                {skipWarning.map(l => <li key={l}>{l}</li>)}
              </ul>
              <div style={{fontSize:12, color:'var(--text3)', marginBottom:16}}>
                Re-upload the file in the firm's profile page (Documents tab) to fix this.
              </div>
              <button className="btn btn-primary" style={{width:'100%'}} onClick={() => setSkipWarning([])}>View Letter Anyway</button>
            </div>
          </div>
        )}
        <LetterPreviewModal url={pdfUrl} filename={name} onClose={onClose}/>
      </>
    );
  }

  return (
    <Modal title="Generate Letter" onClose={onClose} footer={<>
      <Btn className="btn btn-secondary" onClick={onClose}>Cancel</Btn>
      {onOpenBuilder && <Btn className="btn btn-secondary" onClick={() => { onClose(); onOpenBuilder(); }}>✏ Builder</Btn>}
      <Btn className="btn btn-primary" onClick={handleGenerate} disabled={instLoading || generating}>
        {generating ? 'Generating…' : instLoading ? 'Loading…' : 'Generate Preview'}
      </Btn>
    </>}>
      <div style={{display:'flex', flexDirection:'column', gap:12}}>

        {genError && (
          <div style={{padding:'10px 14px', borderRadius:8, background:'rgba(220,38,38,.08)', border:'1px solid rgba(220,38,38,.25)', color:'var(--error,#dc2626)', fontSize:13, lineHeight:1.5}}>
            <strong>Generation failed:</strong> {genError}
          </div>
        )}

        {/* Signature toggle */}
        <label style={{display:'flex', alignItems:'center', gap:14, padding:'12px 14px', borderRadius:10, border:'1px solid var(--border)', background:'var(--bg)', cursor:'pointer'}}>
          <MdToggle selected={inclSign} onChange={e=>setInclSign(e.target.selected)} style={{flexShrink:0}}/>
          <div style={{flex:1}}>
            <div style={{fontWeight:600, fontSize:13, color:'var(--text)'}}>Include signature</div>
            <div style={{fontSize:12, color:'var(--text3)', marginTop:2, lineHeight:1.4}}>
              {freshRow.institute_sign ? 'Signature appears in the letter and on each attached document.' : 'No signature uploaded yet — add it in the firm profile.'}
            </div>
          </div>
        </label>

        {/* Stamp toggle */}
        <label style={{display:'flex', alignItems:'center', gap:14, padding:'12px 14px', borderRadius:10, border:'1px solid var(--border)', background:'var(--bg)', cursor:'pointer'}}>
          <MdToggle selected={inclStamp} onChange={e=>setInclStamp(e.target.selected)} style={{flexShrink:0}}/>
          <div style={{flex:1}}>
            <div style={{fontWeight:600, fontSize:13, color:'var(--text)'}}>Include stamp</div>
            <div style={{fontSize:12, color:'var(--text3)', marginTop:2, lineHeight:1.4}}>
              {freshRow.institute_stamp ? 'Stamp appears in the letter and on each attached document.' : 'No stamp uploaded yet — add it in the firm profile.'}
            </div>
          </div>
        </label>

        {/* Letterhead toggle */}
        <label style={{display:'flex', alignItems:'center', gap:14, padding:'12px 14px', borderRadius:10, border:'1px solid var(--border)', background:'var(--bg)', cursor:'pointer'}}>
          <MdToggle selected={inclLh} onChange={e=>setInclLh(e.target.selected)} style={{flexShrink:0}}/>
          <div style={{flex:1}}>
            <div style={{fontWeight:600, fontSize:13, color:'var(--text)'}}>Include letterhead</div>
            <div style={{fontSize:12, color:'var(--text3)', marginTop:2, lineHeight:1.4}}>
              {freshRow.institute_letterhead ? 'Letterhead background image appears behind the letter.' : 'No letterhead uploaded yet — add it in the firm profile.'}
            </div>
          </div>
        </label>

        {/* Document attachments */}
        {anyDocs ? (
          <div style={{borderRadius:10, border:'1px solid var(--border)', overflow:'hidden'}}>
            <div style={{padding:'10px 14px', borderBottom:'1px solid var(--border)', background:'var(--bg)'}}>
              <span style={{fontWeight:600, fontSize:12.5, color:'var(--text2)'}}>Attach supporting documents</span>
            </div>
            <div style={{display:'flex', flexDirection:'column'}}>
              {Object.entries(hasDocs).filter(([,v])=>v).map(([k], i, arr) => (
                <label key={k} style={{
                  display:'flex', alignItems:'center', gap:10, cursor:'pointer', fontSize:13,
                  padding:'9px 14px', background:'var(--surface)', color:'var(--text)',
                  borderBottom: i < arr.length-1 ? '1px solid var(--border)' : 'none',
                  transition:'background .1s',
                }}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--bg)'}
                  onMouseLeave={e=>e.currentTarget.style.background='var(--surface)'}
                >
                  <input type="checkbox" checked={inclDocs[k]||false} onChange={()=>toggle(k)}
                    style={{accentColor:'var(--primary)', flexShrink:0, width:15, height:15}}/>
                  <span>{DOC_LABELS[k]}</span>
                </label>
              ))}
            </div>
          </div>
        ) : (
          <div style={{display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderRadius:10, border:`1px solid ${instFetchErr ? 'var(--error)' : 'var(--border)'}`, background: instFetchErr ? 'var(--error-light)' : 'var(--bg)'}}>
            <span className="material-icons-round" style={{fontSize:18, color: instFetchErr ? 'var(--error)' : 'var(--text3)', opacity: instFetchErr ? 1 : .5}}>
              {instFetchErr ? 'cloud_off' : 'description'}
            </span>
            <div style={{fontSize:12, color: instFetchErr ? 'var(--error)' : 'var(--text3)', lineHeight:1.5}}>
              {instFetchErr
                ? 'Could not load institute details — documents may be unavailable. Check your connection and try again.'
                : 'No documents uploaded for this institute. Upload OCR, VAT, and CTEVT certificates in the institute profile to attach them here.'}
            </div>
          </div>
        )}

      </div>
    </Modal>
  );
}

// ── Contracts & Quotations ────────────────────────────────────────────────────

const QUOTE_STATUS = ['Quoted', 'Awarded', 'Rejected'];
const statusColor2 = s => s === 'Awarded' ? {bg:'var(--success-light)',color:'var(--success)'} : s === 'Rejected' ? {bg:'var(--error-light)',color:'var(--error)'} : {bg:'var(--primary-light)',color:'var(--primary-dark)'};

// Upload button for agreement PDFs or images
export function BillModal({ row, token, onSave, onClose, saving }) {
  const [doc, setDoc] = useState(row.shortlist_doc ?? null);
  const [amount, setAmount] = useState(row.contract_amount != null ? String(row.contract_amount) : '');
  const [isFree, setIsFree] = useState(row.contract_amount === 0);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');

  const isPdf = doc && (doc.toLowerCase().endsWith('.pdf') || doc.startsWith('data:application/pdf'));

  const handleFile = async e => {
    const file = e.target.files[0]; if (!file) return;
    e.target.value = ''; setErr(''); setUploading(true);
    try { setDoc(await uploadToR2(file, token)); }
    catch (ex) { setErr(ex.message); }
    finally { setUploading(false); }
  };

  const handleSave = () => {
    onSave({
      shortlist_doc: doc,
      contract_amount: isFree ? 0 : (amount !== '' ? Number(amount) : null),
    });
  };

  return (
    <Modal
      title="Bill / Certificate & Cost"
      onClose={onClose}
      compact
      footer={<>
        <Btn className="btn btn-secondary" onClick={onClose}>Cancel</Btn>
        <Btn className="btn btn-primary" onClick={handleSave} disabled={saving || uploading}>
          {saving ? 'Saving…' : 'Save'}
        </Btn>
      </>}
    >
      <div style={{display:'flex', flexDirection:'column', gap:18}}>

        {/* Doc upload */}
        <div>
          <div style={{fontSize:13, fontWeight:600, color:'var(--text2)', marginBottom:8}}>
            Shortlist Certificate / Bill
            <span style={{fontWeight:400, color:'var(--text3)', marginLeft:6}}>(optional)</span>
          </div>
          <div style={{display:'flex', alignItems:'center', gap:12, flexWrap:'wrap'}}>
            {doc ? (
              <div style={{position:'relative', display:'inline-flex', flexDirection:'column', alignItems:'center'}}>
                {isPdf ? (
                  <a href={doc} target="_blank" rel="noreferrer" style={{height:64, width:64, border:'1px solid var(--border)', borderRadius:8, background:'#fff8f0', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2, textDecoration:'none'}}>
                    <span style={{fontSize:24}}>📄</span>
                    <span style={{fontSize:9, color:'var(--text3)', fontWeight:600}}>PDF</span>
                  </a>
                ) : (
                  <a href={doc} target="_blank" rel="noreferrer">
                    <img src={doc} alt="" style={{height:64, maxWidth:90, objectFit:'contain', border:'1px solid var(--border)', borderRadius:8, background:'#fff', padding:3}}/>
                  </a>
                )}
                <button onClick={() => setDoc(null)} style={{position:'absolute', top:-6, right:-6, width:18, height:18, borderRadius:'50%', background:'#e53935', color:'#fff', border:'none', cursor:'pointer', fontSize:11, display:'flex', alignItems:'center', justifyContent:'center', padding:0}}>✕</button>
              </div>
            ) : (
              <div style={{height:64, width:64, border:'1px dashed var(--border)', borderRadius:8, background:'var(--bg2)', display:'flex', alignItems:'center', justifyContent:'center'}}>
                <span style={{fontSize:11, color:'var(--text3)'}}>None</span>
              </div>
            )}
            <label style={{cursor: uploading ? 'wait' : 'pointer'}}>
              <input type="file" accept={ACCEPT} style={{display:'none'}} onChange={handleFile} disabled={uploading}/>
              <span className="btn btn-secondary btn-sm">{uploading ? 'Uploading…' : doc ? 'Replace' : 'Upload'}</span>
            </label>
            {doc && <span className="btn btn-ghost btn-sm" style={{cursor:'pointer'}} onClick={() => setDoc(null)}>✕ Remove</span>}
          </div>
          {err && <div style={{fontSize:11, color:'#c0391e', marginTop:4}}>{err}</div>}
        </div>

        {/* Cost section */}
        <div style={{borderTop:'1px solid var(--border)', paddingTop:16}}>
          <div style={{fontSize:13, fontWeight:600, color:'var(--text2)', marginBottom:10}}>Shortlisting Charge</div>

          {/* Free toggle */}
          <label style={{display:'flex', alignItems:'center', gap:10, cursor:'pointer', marginBottom:12}}>
            <input type="checkbox" checked={isFree} onChange={e => { setIsFree(e.target.checked); if (e.target.checked) setAmount(''); }}
              style={{accentColor:'var(--primary)', width:16, height:16}}/>
            <span style={{fontSize:13.5, color:'var(--text)'}}>Free / No charge</span>
          </label>

          {!isFree && (
            <MdTextField
              type="number"
              label="Shortlisting Charge (NPR)"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="e.g. 150000"
            />
          )}

          {isFree && (
            <div style={{fontSize:12, color:'var(--success)', background:'var(--success-light)', borderRadius:8, padding:'8px 12px'}}>
              This entry is marked as free / no cost.
            </div>
          )}
        </div>

      </div>
    </Modal>
  );
}

// ── Row ────────────────────────────────────────────────────────────────────────

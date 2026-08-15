/**
 * The institute's statutory documents, and the upload widgets they use.
 *
 * The uploads live here rather than in ui/ because nothing else uses them: they
 * are shaped around this tab's storage format, where a field holds either a
 * single image or a JSON array of them.
 */
import { useState, useEffect } from 'react';
import { Btn, MdTextField } from '../../md.jsx';
import { api, instToAPI } from '../../utils/api.js';

const ACCEPT = 'image/*';

function parseFiles(val) {
  if (!val) return [];
  try { const p = JSON.parse(val); return Array.isArray(p) ? p : [val]; }
  catch { return [val]; }
}
function filesToStore(arr) {
  if (!arr.length) return null;
  return arr.length === 1 ? arr[0] : JSON.stringify(arr);
}

// Remove white/near-white background from an image file, returns a new PNG File.
// Skips processing if the image already has transparency or has a dark background.
async function removeImageBackground(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = data.data;
      const w = canvas.width, h = canvas.height;
      // Sample corner pixel indices
      const cornerIdxs = [0, (w - 1) * 4, (h - 1) * w * 4, ((h - 1) * w + w - 1) * 4];
      // If any corner is already transparent, image already has no background — skip
      const anyTransparent = cornerIdxs.some(i => d[i + 3] < 128);
      if (anyTransparent) { URL.revokeObjectURL(url); return resolve(file); }
      const corners = cornerIdxs.map(i => [d[i], d[i + 1], d[i + 2]]);
      const bgR = Math.round(corners.reduce((s, c) => s + c[0], 0) / 4);
      const bgG = Math.round(corners.reduce((s, c) => s + c[1], 0) / 4);
      const bgB = Math.round(corners.reduce((s, c) => s + c[2], 0) / 4);
      const bgLuma = 0.299 * bgR + 0.587 * bgG + 0.114 * bgB;
      const threshold = 40;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] === 0) continue;
        const dr = Math.abs(d[i] - bgR);
        const dg = Math.abs(d[i + 1] - bgG);
        const db = Math.abs(d[i + 2] - bgB);
        if (dr < threshold && dg < threshold && db < threshold) d[i + 3] = 0;
      }
      ctx.putImageData(data, 0, 0);
      canvas.toBlob(blob => {
        if (!blob) return reject(new Error('Canvas conversion failed'));
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, '') + '.png', { type: 'image/png' }));
      }, 'image/png');
    };
    img.onerror = reject;
    img.src = url;
  });
}

// `kind` tells the server how to normalise: 'letterhead' (full-bleed A4),
// 'asset' (signature/stamp — keeps transparency), or 'document' (scanned page).
async function uploadToR2(file, token, kind = 'document') {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`/api/upload?kind=${encodeURIComponent(kind)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (err.error === 'blank_page') throw new Error('Blank page detected — skipped.');
    throw new Error(err.message || err.error || 'Upload failed');
  }
  const { url } = await res.json();
  return url;
}

const THUMB_SIZE = 80;

function FileThumb({ src, onRemove }) {
  const [hover, setHover] = useState(false);
  const [confirming, setConfirming] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setConfirming(false); }}
      style={{position:'relative', flexShrink:0, width:THUMB_SIZE, height:THUMB_SIZE, borderRadius:10,
        // white (not var(--bg)) so transparent signatures/stamps stay legible in dark mode
        overflow:'hidden', border:'1.5px solid var(--border)', background:'#fff', cursor: onRemove ? 'pointer' : 'default',
        boxShadow: hover ? '0 2px 8px rgba(0,0,0,.14)' : '0 1px 3px rgba(0,0,0,.07)',
        transition:'box-shadow .15s',
      }}
    >
      {/\.pdf($|\?)/i.test(src)
        ? <a href={src} target="_blank" rel="noreferrer" style={{display:'flex', width:'100%', height:'100%', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:2, textDecoration:'none'}}>
            <span className="material-icons-round" style={{fontSize:32, color:'var(--error)'}}>picture_as_pdf</span>
            <span style={{fontSize:9, fontWeight:700, color:'var(--text2)'}}>PDF</span>
          </a>
        : <a href={src} target="_blank" rel="noreferrer" style={{display:'block', width:'100%', height:'100%'}}>
            <img src={src} alt="" style={{width:'100%', height:'100%', objectFit:'contain', display:'block'}}/>
          </a>
      }
      {onRemove && hover && (
        confirming ? (
          <div style={{position:'absolute', inset:0, background:'rgba(229,57,53,.88)', display:'flex',
            flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4, backdropFilter:'blur(2px)'}}>
            <span style={{color:'#fff', fontSize:10.5, fontWeight:600, textAlign:'center', padding:'0 4px'}}>Remove?</span>
            <div style={{display:'flex', gap:6}}>
              <button onClick={e=>{e.preventDefault(); e.stopPropagation(); onRemove(); setConfirming(false);}}
                style={{background:'#fff', color:'#c0392b', border:'none', borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:700, cursor:'pointer'}}>
                Yes
              </button>
              <button onClick={e=>{e.preventDefault(); e.stopPropagation(); setConfirming(false);}}
                style={{background:'rgba(255,255,255,.25)', color:'#fff', border:'1px solid #fff', borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:600, cursor:'pointer'}}>
                No
              </button>
            </div>
          </div>
        ) : (
          <button onClick={e=>{e.preventDefault(); setConfirming(true);}}
            style={{position:'absolute', inset:0, width:'100%', height:'100%', background:'rgba(229,57,53,.72)',
              color:'#fff', border:'none', cursor:'pointer', fontSize:18, display:'flex', alignItems:'center',
              justifyContent:'center', backdropFilter:'blur(2px)'}}>✕</button>
        )
      )}
    </div>
  );
}

function DocMultiUpload({ label, hint, value, onChange, disabled, token, processFile, kind }) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const files = parseFiles(value);

  const addFiles = async e => {
    const picked = Array.from(e.target.files); e.target.value = '';
    if (!picked.length) return;
    setErr(''); setUploading(true);
    try {
      const processed = processFile ? await Promise.all(picked.map(f => processFile(f))) : picked;
      const urls = await Promise.all(processed.map(f => uploadToR2(f, token, kind)));
      onChange(filesToStore([...files, ...urls]));
    } catch (ex) { setErr(ex.message); }
    finally { setUploading(false); }
  };
  const remove = idx => onChange(filesToStore(files.filter((_, i) => i !== idx)));

  return (
    <div>
      {label && <label style={{fontSize:13, fontWeight:600, color:'var(--text2)', display:'block', marginBottom:8}}>{label}</label>}
      <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
        {files.map((src, i) => (
          <FileThumb key={i} src={src} onRemove={!disabled ? () => remove(i) : null}/>
        ))}
        {!disabled && (
          <label style={{cursor: uploading ? 'wait' : 'pointer', flexShrink:0}}>
            <input type="file" accept={ACCEPT} multiple style={{display:'none'}} onChange={addFiles} disabled={uploading}/>
            <div style={{
              width: THUMB_SIZE, height: THUMB_SIZE,
              border:'2px dashed var(--primary)', borderRadius:10,
              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4,
              color:'var(--primary)', background:'color-mix(in srgb,var(--primary) 5%,transparent)',
              transition:'background .15s',
            }}
              onMouseEnter={e=>e.currentTarget.style.background='color-mix(in srgb,var(--primary) 12%,transparent)'}
              onMouseLeave={e=>e.currentTarget.style.background='color-mix(in srgb,var(--primary) 5%,transparent)'}
            >
              {uploading
                ? <span style={{fontSize:11, fontWeight:600}}>Uploading…</span>
                : <>
                    <span className="material-icons-round" style={{fontSize:22}}>add_photo_alternate</span>
                    <span style={{fontSize:10, fontWeight:600, lineHeight:1}}>Add</span>
                  </>
              }
            </div>
          </label>
        )}
        {!files.length && disabled && (
          <div style={{width:THUMB_SIZE, height:THUMB_SIZE, border:'1px dashed var(--border)', borderRadius:10,
            background:'var(--bg)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:3}}>
            <span className="material-icons-round" style={{fontSize:20, color:'var(--text3)', opacity:.4}}>image_not_supported</span>
            <span style={{fontSize:10, color:'var(--text3)'}}>None</span>
          </div>
        )}
      </div>
      {err && <div style={{fontSize:11, color:'#c0391e', marginTop:4}}>{err}</div>}
      {hint && <div style={{fontSize:11, color:'var(--text3)', marginTop:4}}>{hint}</div>}
    </div>
  );
}

function DocImgUpload({ label, hint, value, onChange, disabled, token, processFile, kind }) {
  return (
    <DocMultiUpload
      label={label} hint={hint} token={token} disabled={disabled}
      processFile={processFile} kind={kind}
      value={value ? JSON.stringify([value]) : null}
      onChange={v => {
        const arr = parseFiles(v);
        onChange(arr.length ? arr[arr.length - 1] : null);
      }}
    />
  );
}

export function DocumentsTab({ institute, token, canEdit, onUpdate, isShortlistOnly }) {
  const fromInst = (inst) => ({
    nameNp: inst.nameNp || '',
    addressNp: inst.addressNp || '',
    contactPersonNp: inst.contactPersonNp || '',
    letterhead: inst.letterhead || null,
    sign: inst.sign || null,
    stamp: inst.stamp || null,
    serviceType: inst.serviceType || 'सीपमूलक तथा व्यावसायिक तालिम कार्यक्रमहरु सञ्चालन',
    letterTopMargin: inst.letterTopMargin ?? 15,
    letterBottomPadding: inst.letterBottomPadding ?? 15,
    letterLrPadding: inst.letterLrPadding ?? 5,
    ocrRegistration: inst.ocrRegistration || null,
    ocrRenewal: inst.ocrRenewal || null,
    localLevelRegistration: inst.localLevelRegistration || null,
    localLevelRenewal: inst.localLevelRenewal || null,
    vatRegistration: inst.vatRegistration || null,
    taxClearanceDoc: inst.taxClearanceDoc || null,
    vatExtension: inst.vatExtension || null,
    ctevtAffiliation: inst.ctevtAffiliation || null,
    ctevtRenewal: inst.ctevtRenewal || null,
  });

  const [fields, setFields] = useState(() => fromInst(institute));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Re-sync from server when institute doc fields arrive (e.g. after initial load),
  // but only if the user hasn't started editing — otherwise uploads would be lost
  // when another tab's save triggers a parent re-render with a refreshed institute prop.
  useEffect(() => {
    if (!dirty) { setFields(fromInst(institute)); setSaved(false); }
  }, [institute.id, institute.ctevtAffiliation, institute.ocrRegistration]);

  // Always reset when switching to a different institute
  useEffect(() => { setFields(fromInst(institute)); setSaved(false); setDirty(false); }, [institute.id]);

  const set = (k, v) => { setSaved(false); setDirty(true); setFields(f => ({...f, [k]: v})); };

  const handleSave = async () => {
    setSaving(true); setErr('');
    try {
      await api('PUT', `/institutes/${institute.id}`, instToAPI({ ...institute, ...fields }), token);
      if (onUpdate) onUpdate({ ...institute, ...fields });
      setSaved(true); setDirty(false);
    } catch(e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const SectionTitle = ({children}) => (
    <div style={{fontWeight:700, fontSize:13, color:'var(--text2)', marginBottom:12, marginTop:20, paddingTop:16, borderTop:'1px solid var(--border)'}}>{children}</div>
  );

  const DOC_ROWS = [
    { label: 'OCR दर्ता', sub: 'Registration', key: 'ocrRegistration' },
    { label: 'OCR नवीकरण', sub: 'Renewal', key: 'ocrRenewal' },
    { label: 'स्थानीय तह दर्ता', sub: 'Local Level Reg.', key: 'localLevelRegistration' },
    { label: 'स्थानीय तह नवीकरण', sub: 'Local Level Renewal', key: 'localLevelRenewal' },
    { label: 'भ्याट दर्ता', sub: 'VAT Registration', key: 'vatRegistration' },
    { label: 'कर चुक्ता', sub: 'Tax Clearance', key: 'taxClearanceDoc' },
    { label: 'भ्याट म्याद थप', sub: 'VAT Date Extension', key: 'vatExtension' },
    { label: 'CTEVT सम्बन्धन', sub: 'Affiliation', key: 'ctevtAffiliation' },
    { label: 'CTEVT नवीकरण', sub: 'Renewal', key: 'ctevtRenewal' },
  ];

  return (
    <div style={{display:'flex', flexDirection:'column', gap:16}}>

      {/* ── Nepali Fields + Letter Images + Settings ── */}
      {!isShortlistOnly && <>
        <div className="card">
          <div className="section-title" style={{marginBottom:4}}>नेपाली विवरण</div>
          <div style={{fontSize:12, color:'var(--text3)', marginBottom:16}}>Used in the generated letter. Leave blank to fall back to English fields.</div>
          <div className="form-group">
            <MdTextField label="संस्थाको नाम (नेपालीमा)" value={fields.nameNp} disabled={!canEdit}
              onChange={e=>set('nameNp',e.target.value)} placeholder="e.g. वर्ल्ड लिङ्क टेक्निकल ट्रेनिङ् इन्स्टिच्च्यूट प्रा.लि." style={{width:'100%'}}/>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 20px'}}>
            <div className="form-group">
              <MdTextField label="ठेगाना (नेपालीमा)" value={fields.addressNp} disabled={!canEdit}
                onChange={e=>set('addressNp',e.target.value)} placeholder="e.g. टोखा-१०, काठमाडौं" style={{width:'100%'}}/>
            </div>
            <div className="form-group">
              <MdTextField label="मुख्य व्यक्तिको नाम (नेपालीमा)" value={fields.contactPersonNp} disabled={!canEdit}
                onChange={e=>set('contactPersonNp',e.target.value)} placeholder="e.g. ठाकुर सुवेदी" style={{width:'100%'}}/>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="section-title" style={{marginBottom:4}}>Letter Images</div>
          <div style={{fontSize:12, color:'var(--text3)', marginBottom:16}}>Signature and stamp are shown individually — toggle each in the Generate Letter dialog.</div>
          <DocImgUpload label="Letterhead" hint="Stretched full-bleed to A4 behind generated letters." value={fields.letterhead} onChange={v=>set('letterhead',v)} disabled={!canEdit} token={token} kind="letterhead"/>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 20px'}}>
            <DocImgUpload label="Authorized Signature" value={fields.sign} onChange={v=>set('sign',v)} disabled={!canEdit} token={token} processFile={removeImageBackground} kind="asset"/>
            <DocImgUpload label="Stamp / Seal" value={fields.stamp} onChange={v=>set('stamp',v)} disabled={!canEdit} token={token} processFile={removeImageBackground} kind="asset"/>
          </div>
        </div>

        <div className="card">
          <div className="section-title" style={{marginBottom:4}}>Letter Settings</div>
          <div style={{fontSize:12, color:'var(--text3)', marginBottom:16}}>Controls the layout of the generated letter.</div>
          <div className="form-group">
            <label style={{fontSize:12, fontWeight:600, color:'var(--text3)', display:'block', marginBottom:6}}>सेवाको प्रकार (Service Type)</label>
            <input list="service-type-list" value={fields.serviceType} onChange={e=>set('serviceType',e.target.value)} disabled={!canEdit}
              style={{width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)', fontSize:14}}/>
            <datalist id="service-type-list">
              <option value="सीपमूलक तथा व्यावसायिक तालिम कार्यक्रमहरु सञ्चालन"/>
              <option value="परामर्श सेवा"/>
              <option value="अन्य सेवा"/>
            </datalist>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'0 20px'}}>
            {[
              ['Top', 'letterTopMargin', 'Push text below the letterhead'],
              ['Bottom', 'letterBottomPadding', 'Space at the bottom of the page'],
              ['Left / Right', 'letterLrPadding', 'Horizontal margin inside the page'],
            ].map(([label, key, hint]) => (
              <div key={key} className="form-group">
                <MdTextField type="number" label={`${label} padding (mm)`} value={fields[key]} disabled={!canEdit}
                  onChange={e=>set(key, Number(e.target.value))} supporting-text={hint} style={{width:'100%'}}/>
              </div>
            ))}
          </div>
        </div>
      </>}

      {/* ── Supporting Documents ── */}
      <div className="card" style={{padding:0, overflow:'hidden'}}>
        {/* Header */}
        <div style={{padding:'18px 24px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12}}>
          <div>
            <div style={{fontWeight:700, fontSize:15, color:'var(--text)'}}>Supporting Documents</div>
            <div style={{fontSize:12, color:'var(--text3)', marginTop:2}}>
              Upload scanned images of certificates{!isShortlistOnly && ' — attach to generated letters'}.
            </div>
          </div>
          <div style={{display:'flex', gap:6, alignItems:'center'}}>
            {(() => {
              const filled = DOC_ROWS.filter(d => {
                const v = fields[d.key];
                if (!v) return false;
                try { const p = JSON.parse(v); return Array.isArray(p) ? p.length > 0 : !!v; } catch { return !!v; }
              }).length;
              return (
                <span style={{fontSize:12, fontWeight:600, padding:'4px 12px', borderRadius:100,
                  background: filled === DOC_ROWS.length ? 'var(--success-light)' : 'var(--primary-light)',
                  color: filled === DOC_ROWS.length ? '#0b9b85' : 'var(--primary-dark)'}}>
                  {filled} / {DOC_ROWS.length} uploaded
                </span>
              );
            })()}
          </div>
        </div>

        {/* Doc rows */}
        {DOC_ROWS.map((doc, i) => {
          const v = fields[doc.key];
          const hasFile = (() => { if (!v) return false; try { const p = JSON.parse(v); return Array.isArray(p) ? p.length > 0 : !!v; } catch { return !!v; } })();
          return (
            <div key={doc.key} style={{
              display:'flex', alignItems:'center', gap:16, padding:'14px 24px',
              borderBottom: i < DOC_ROWS.length - 1 ? '1px solid var(--border)' : 'none',
              background: i % 2 === 1 ? 'var(--bg)' : 'var(--surface)',
            }}>
              {/* Status dot */}
              <div style={{
                width:8, height:8, borderRadius:'50%', flexShrink:0,
                background: hasFile ? 'var(--success)' : 'var(--border2)',
              }}/>
              {/* Label */}
              <div style={{flex:'0 0 260px', minWidth:0}}>
                <div style={{fontWeight:600, fontSize:13.5, color:'var(--text)'}}>{doc.label}</div>
                <div style={{fontSize:11.5, color:'var(--text3)', marginTop:1}}>{doc.sub}</div>
              </div>
              {/* Upload widget */}
              <div style={{flex:1, minWidth:0}}>
                <DocMultiUpload label="" value={fields[doc.key]} onChange={v=>set(doc.key,v)} disabled={!canEdit} token={token}/>
              </div>
            </div>
          );
        })}

        {/* Save footer */}
        {canEdit && (
          <div style={{padding:'16px 24px', borderTop:'1px solid var(--border)', background:'var(--bg)', display:'flex', alignItems:'center', gap:12}}>
            <Btn className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save documents'}
            </Btn>
            {saved && <span style={{fontSize:12, color:'var(--success)', fontWeight:500}}>✓ Saved</span>}
            {err  && <span style={{fontSize:12, color:'var(--error)'}}>{err}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

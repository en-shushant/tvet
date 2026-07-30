import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Modal from './ui/Modal.jsx';
import { Btn, MdTextField, MdSelect, MdOption, MdToggle } from '../md.jsx';
import { api } from '../utils/api.js';
import { getSession } from '../utils/auth.js';
import { FISCAL_YEARS, getCurrentFY } from '../constants/data.js';
import { adToBS, bsToAD, BS_MONTHS, BS_DATA, toNpNum } from '../constants/nepali.js';

const FYS = [...FISCAL_YEARS].reverse(); // newest first

const ACCEPT = 'image/*';
async function uploadToR2(file, token) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/api/upload', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (err.error === 'blank_page') throw new Error('Blank page detected — skipped.');
    throw new Error(err.message || err.error || 'Upload failed');
  }
  return (await res.json()).url;
}
function ShortlistDocUpload({ value, onChange, token }) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const isPdf = value && (value.toLowerCase().endsWith('.pdf') || value.startsWith('data:application/pdf'));
  const handleFile = async e => {
    const file = e.target.files[0]; if (!file) return;
    e.target.value = ''; setErr(''); setUploading(true);
    try { onChange(await uploadToR2(file, token)); }
    catch (ex) { setErr(ex.message); }
    finally { setUploading(false); }
  };
  return (
    <div className="form-group">
      <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>
        Shortlist Certificate / Bill <span style={{ fontWeight: 400, color: 'var(--text3)' }}>(optional)</span>
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {value ? (
          <div style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
            {isPdf ? (
              <a href={value} target="_blank" rel="noreferrer" style={{ height: 56, width: 56, border: '1px solid var(--border)', borderRadius: 6, background: '#fff8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, textDecoration: 'none' }}>
                <span style={{ fontSize: 20 }}>📄</span>
                <span style={{ fontSize: 9, color: 'var(--text3)', fontWeight: 600 }}>PDF</span>
              </a>
            ) : (
              <a href={value} target="_blank" rel="noreferrer">
                <img src={value} alt="" style={{ height: 56, maxWidth: 80, objectFit: 'contain', border: '1px solid var(--border)', borderRadius: 6, background: '#fff', padding: 2 }}/>
              </a>
            )}
            <button onClick={() => onChange(null)} style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: '#e53935', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>✕</button>
          </div>
        ) : (
          <div style={{ height: 56, width: 56, border: '1px dashed var(--border)', borderRadius: 6, background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>None</span>
          </div>
        )}
        <label style={{ cursor: uploading ? 'wait' : 'pointer' }}>
          <input type="file" accept={ACCEPT} style={{ display: 'none' }} onChange={handleFile} disabled={uploading}/>
          <span className="btn btn-secondary btn-sm">{uploading ? 'Uploading…' : value ? 'Change' : 'Upload'}</span>
        </label>
        {value && <span className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }} onClick={() => onChange(null)}>✕ Remove</span>}
      </div>
      {err && <div style={{ fontSize: 11, color: '#c0391e', marginTop: 4 }}>{err}</div>}
    </div>
  );
}

const fmt = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : '—';

function adDateToBS(adStr) {
  if (!adStr) return '';
  const [y, m, d] = adStr.slice(0, 10).split('-').map(Number);
  const bs = adToBS(new Date(Date.UTC(y, m - 1, d)));
  return `${toNpNum(bs.y)}-${toNpNum(bs.m).padStart ? toNpNum(String(bs.m).padStart(2,'0')) : toNpNum(bs.m)}-${toNpNum(String(bs.d).padStart(2,'0'))}`;
}

function bsDateLabel(adStr) {
  if (!adStr) return '';
  const [y, m, d] = adStr.slice(0, 10).split('-').map(Number);
  const bs = adToBS(new Date(Date.UTC(y, m - 1, d)));
  return `${toNpNum(bs.d)} ${BS_MONTHS[bs.m - 1]} ${toNpNum(bs.y)}`;
}

function todayBS() {
  const now = new Date();
  const ktmStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kathmandu' });
  const [y, m, d] = ktmStr.split('-').map(Number);
  const bs = adToBS(new Date(Date.UTC(y, m - 1, d)));
  return `${toNpNum(String(bs.y))}/${toNpNum(String(bs.m).padStart(2,'0'))}/${toNpNum(String(bs.d).padStart(2,'0'))}`;
}

// ── Letter generator — opens print-ready A4 in new window ─────────────────────
// Scan letterhead image for header/footer boundaries
async function detectLetterheadMargins(dataUrl) {
  if (!dataUrl) return { top: null, bottom: null };
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const w = canvas.width, h = canvas.height;
        const step = Math.max(1, Math.floor(w / 30));

        const isDark = (x, y) => {
          const d = ctx.getImageData(x, y, 1, 1).data;
          return d[3] > 50 && (d[0] < 220 || d[1] < 220 || d[2] < 220);
        };
        const rowDark = (y) => {
          let n = 0;
          for (let x = 0; x < w; x += step) if (isDark(x, y)) n++;
          return n;
        };

        // Header: last dark row in top 60%
        let topMm = null;
        for (let y = Math.floor(h * 0.6); y >= 0; y--) {
          if (rowDark(y) >= 3) { topMm = Math.ceil((y / h) * 297) + 8; break; }
        }

        // Footer: first dark row in bottom 40% (scanning from bottom up)
        let bottomMm = null;
        for (let y = h - 1; y >= Math.floor(h * 0.6); y--) {
          if (rowDark(y) >= 3) { bottomMm = Math.ceil(((h - y) / h) * 297) + 8; break; }
        }

        resolve({ top: topMm, bottom: bottomMm });
      } catch { resolve({ top: null, bottom: null }); }
    };
    img.onerror = () => resolve({ top: null, bottom: null });
    img.src = dataUrl;
  });
}

async function urlToDataUrl(url) {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return url;
    const blob = await resp.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(url);
      reader.readAsDataURL(blob);
    });
  } catch { return url; }
}

async function openShortlistLetter(row, opts = {}) {
  const { includeSign = false, includeStamp = false, docs = {}, serviceType: svcType } = opts;
  const lrPadding        = row.institute_letter_lr_padding    ?? 10;
  const pageBottomPadding = row.institute_letter_bottom_padding ?? 15;
  // Firm (institute) — letterhead owner
  const firmName        = row.institute_name || '';
  const firmAcronym     = row.institute_acronym || '';
  const firmAddress     = row.institute_address || '';
  const firmPhone       = row.institute_phone || '';
  const firmMobile      = row.institute_mobile || '';
  const firmEmail       = row.institute_email || '';
  const firmWebsite     = row.institute_website || '';
  const firmRegNo       = row.institute_reg_no || '';
  const firmPan         = row.institute_pan || '';
  // Pre-fetch all images as data URLs so the popup never needs cross-origin requests
  const [firmLogo, firmLetterhead, firmSign, firmStamp] = await Promise.all([
    urlToDataUrl(row.institute_logo || null),
    urlToDataUrl(row.institute_letterhead || null),
    urlToDataUrl(row.institute_sign || null),
    urlToDataUrl(row.institute_stamp || null),
  ]);

  // Auto-detect header/footer heights from letterhead image
  let pageTopMargin    = row.institute_letter_top_margin    ?? 15;
  let pageBottomPadding = row.institute_letter_bottom_padding ?? 15;
  if (firmLetterhead) {
    const { top, bottom } = await detectLetterheadMargins(firmLetterhead);
    if (top    && top    > pageTopMargin)    pageTopMargin    = top;
    if (bottom && bottom > pageBottomPadding) pageBottomPadding = bottom;
  }
  const firmContact     = row.institute_contact || '';
  const firmNameNp      = row.institute_name_np || firmName;
  const firmAddressNp   = row.institute_address_np || firmAddress;
  const firmContactNp   = row.institute_contact_np || firmContact;
  const firmPhoneNp     = firmPhone ? toNpNum(firmPhone) : '';
  const firmMobileNp    = firmMobile ? toNpNum(firmMobile) : '';
  // To — procuring entity (client)
  const toName          = row.client_name || row.client_name_manual || '';
  const toShort         = row.client_short || '';
  const toAddress       = row.client_address || '';
  const toContact       = row.client_signatory_position || '';
  // Shortlisting details
  const listName  = row.standing_list_name || 'Standing List';
  const fy        = row.fy || '';
  const dateBS    = bsDateLabel(row.shortlist_date);
  const dateAD    = fmt(row.shortlist_date);
  const status    = row.status || 'Active';
  const remarks   = row.remarks || '';
  const todayBSStr = todayBS();

  const statusNp = status === 'Active' ? 'सक्रिय' : status === 'Expired' ? 'म्याद सकिएको' : 'प्रक्रियामा';
  const todayAD = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' });
  const firmMeta = [firmAddress, firmPhone ? `फोन: ${firmPhone}` : '', firmEmail, firmWebsite].filter(Boolean).join('  |  ');

  // Document pages
  const docDefs = [
    { key: 'ocrReg',    src: row.institute_ocr_registration,         label: 'OCR दर्ता प्रमाणपत्र' },
    { key: 'ocrRen',   src: row.institute_ocr_renewal,              label: 'OCR नवीकरण प्रमाणपत्र' },
    { key: 'llReg',    src: row.institute_local_level_registration,  label: 'स्थानीय तह दर्ता प्रमाणपत्र' },
    { key: 'llRen',    src: row.institute_local_level_renewal,       label: 'स्थानीय तह नवीकरण प्रमाणपत्र' },
    { key: 'vat',       src: row.institute_vat_registration,   label: 'भ्याट दर्ता प्रमाणपत्र' },
    { key: 'taxClear',  src: row.institute_tax_clearance_doc,  label: 'कर चुक्ता प्रमाणपत्र' },
    { key: 'vatExt',    src: row.institute_vat_extension,      label: 'भ्याट म्याद थप प्रमाणपत्र' },
    { key: 'ctevtAff',  src: row.institute_ctevt_affiliation,  label: 'CTEVT सम्बन्धन पत्र' },
    { key: 'ctevtRen',  src: row.institute_ctevt_renewal,      label: 'CTEVT नवीकरण पत्र' },
  ];
  const sigstampOverlay = (includeSign && firmSign) || (includeStamp && firmStamp) ? `
    <div style="position:absolute;bottom:12mm;right:12mm;display:flex;align-items:flex-end;gap:16px;z-index:2;">
      ${includeStamp && firmStamp ? `<img src="${firmStamp}" style="width:38mm;height:38mm;object-fit:contain;mix-blend-mode:multiply;">` : ''}
      ${includeSign  && firmSign  ? `<img src="${firmSign}"  style="height:32mm;width:auto;mix-blend-mode:multiply;">` : ''}
    </div>` : '';

  const parseDocFiles = (src) => {
    if (!src) return [];
    try { const p = JSON.parse(src); return Array.isArray(p) ? p : [src]; }
    catch { return [src]; }
  };

  // Pre-fetch all doc attachment images (skip PDFs — can't embed as data URL)
  const activeDocs = docDefs.filter(d => docs[d.key] && d.src);
  const docSrcMap = new Map();
  await Promise.all(activeDocs.flatMap(d => parseDocFiles(d.src).map(async (src) => {
    if (!src.toLowerCase().endsWith('.pdf') && !src.startsWith('data:application/pdf')) {
      docSrcMap.set(src, await urlToDataUrl(src));
    }
  })));

  const docPages = activeDocs.flatMap(d => {
    const files = parseDocFiles(d.src);
    return files.map((src) => {
      const isPdf = !src.startsWith('data:') ? src.toLowerCase().endsWith('.pdf') : src.startsWith('data:application/pdf');
      const resolvedSrc = docSrcMap.get(src) || src;
      const content = isPdf
        ? `<embed src="${src}" style="display:block;width:210mm;height:297mm;" type="application/pdf">`
        : `<img src="${resolvedSrc}" style="display:block;width:210mm;height:297mm;object-fit:fill;">`;
      return `
<div data-doc="1" style="page-break-before:always;page-break-after:always;break-before:page;break-after:page;position:relative;width:210mm;height:297mm;box-sizing:border-box;padding:0;background:#fff;box-shadow:0 2px 12px rgba(0,0,0,.18);overflow:hidden;">
  ${content}
  ${sigstampOverlay}
</div>`;
    });
  }).join('');

  const useLhBg = !!firmLetterhead;
  const fyNp = fy ? toNpNum(fy) : '';
  const serviceType = svcType || 'सीपमूलक तथा व्यावसायिक तालिम कार्यक्रमहरु सञ्चालन';

  const html = `<!DOCTYPE html>
<html lang="ne">
<head>
<meta charset="UTF-8">
<title>मौजुदा सूची — ${firmAcronym || firmName}</title>
<style>
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { background: #888; }
  body {
    font-family: 'Kalimati', 'Noto Sans Devanagari', 'Mangal', 'Arial Unicode MS', sans-serif;
    font-size: 10.5pt; color: #111; line-height: 1.65;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
    display: flex; flex-direction: column; align-items: center; padding: 20px; gap: 20px;
  }
  @media print {
    html { background: none; }
    body { display: block; padding: 0; gap: 0; }
    /* Force every doc page to be exactly one A4 sheet */
    body > div[data-doc] {
      page-break-before: always;
      page-break-after: always;
      page-break-inside: avoid;
    }
  }
  .page {
    width: 794px;
    height: 1123px;
    flex-shrink: 0;
    background: #fff;
    position: relative;
    padding: 0;
    overflow: hidden;
  }
  .lh-img { display:block;position:absolute;top:0;left:0;width:100%;height:100%;object-fit:fill;z-index:0; }
  .page-inner {
    position: relative;
    z-index: 1;
    padding: ${pageTopMargin}mm ${lrPadding}mm ${pageBottomPadding}mm ${lrPadding}mm;
  }
  .lh-regpan { display:flex;justify-content:space-between;font-size:9pt;font-style:italic;color:#7b1a1a;margin-bottom:5px; }
  .lh-center { text-align:center; }
  .lh-logo   { max-height:75px;max-width:75px;object-fit:contain;margin-bottom:3px; }
  .lh-name   { font-size:15pt;font-weight:700;color:#7b1a1a;line-height:1.3; }
  .lh-meta   { font-size:9pt;color:#444;margin-top:4px;line-height:1.6; }
  .lh-border { border-bottom:3px double #7b1a1a;margin:7px 0 5mm; }

  .ref-row  { display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;font-size:11pt; }
  .ref-bold { font-weight:700;font-size:13pt; }
  .to-block { margin-bottom:12px;font-size:10.5pt;line-height:1.75; }
  .subject  { text-align:center;font-size:11pt;font-weight:700;text-decoration:underline;text-underline-offset:3px;margin-bottom:10px; }
  .body-txt { margin-bottom:8px;font-size:10pt;text-align:justify;line-height:1.7; }
  .tapasil  { font-weight:700;font-size:10.5pt;margin-bottom:3px; }

  table { width:100%;border-collapse:collapse;font-size:10pt; }
  td    { border:1px solid #666;padding:5px 8px;vertical-align:top; }
  .hdr  { font-weight:600;padding:5px 8px; }
  .chk  { line-height:1.95;padding:5px 10px; }
  .half { width:50%; }
  .w22  { width:22%; }
  .tall { min-height:36px; }

  .stamp-ring { width:80px;height:80px;border-radius:50%;border:1.5px dashed #aaa;
                display:inline-flex;align-items:center;justify-content:center;
                color:#aaa;font-size:9pt;text-align:center;line-height:1.4; }
  .sign-line  { border-top:1px solid #555;margin-top:4px;padding-top:3px; }
</style>
</head>
<body>
<div class="page">
  ${useLhBg ? `<img src="${firmLetterhead}" class="lh-img" alt="">` : ''}
  <div class="page-inner">

  ${!useLhBg ? `
  ${firmRegNo || firmPan ? `<div class="lh-regpan"><span>${firmRegNo ? 'Govt. Regd.No. ' + firmRegNo : ''}</span><span>${firmPan ? 'PAN No. ' + firmPan : ''}</span></div>` : ''}
  <div class="lh-center">
    ${firmLogo ? `<img src="${firmLogo}" class="lh-logo" alt="${firmName}">` : ''}
    <div class="lh-name">${firmName}${firmAcronym && firmAcronym !== firmName ? ` (${firmAcronym})` : ''}</div>
    ${firmMeta ? `<div class="lh-meta">${firmMeta}</div>` : ''}
  </div>
  <div class="lh-border"></div>` : ''}

  <div class="ref-row">
    <span class="ref-bold">Ref.</span>
    <span>मिति: ${todayBSStr}</span>
  </div>

  <div class="to-block">
    <div>श्री ${toContact || 'कार्यालय प्रमुख'} ज्यू,</div>
    <div>${toName}${toShort && toShort !== toName ? `, (${toShort})` : ','}</div>
    ${toAddress ? `<div>${toAddress}</div>` : ''}
  </div>

  <div class="subject">विषय: मौजुदा सूचीमा दर्ता गरी पाऊँ।</div>

  <div class="body-txt">
    सार्वजनिक खरिद नियमावली, २०६४ को नियम १८ को उपनियम (१) बमोजिम तपशिलमा उल्लेखित विवरण अनुसारको पृष्ठाई गर्ने कागजात संलग्न गरी मौजुदा सूचीमा दर्ता हुन यो निवेदन पेश गरेको छु।
  </div>
  <div class="tapasil">तपशिल:</div>

  <table>
    <!-- §1 firm details -->
    <tr><td colspan="2" class="hdr">१. मौजुदा सूचीको लागि निवेदन दिने व्यक्ति, संस्था, आपूर्तिकर्ता, निर्माण व्यवसायी, परामर्शदाता वा सेवा प्रदायकको विवरण:</td></tr>
    <tr>
      <td class="half">(क) नाम: ${firmNameNp}${firmAcronym ? ' (' + firmAcronym + ')' : ''}</td>
      <td class="half">(ख) ठेगाना: ${firmAddressNp}</td>
    </tr>
    <tr>
      <td class="half">(ग) पत्राचार गर्ने ठेगाना: ${firmAddressNp}</td>
      <td class="half">(घ) मुख्य व्यक्तिको नाम: ${firmContactNp}</td>
    </tr>
    <tr>
      <td class="half">(ड) टेलिफोन नं: ${firmPhoneNp}</td>
      <td class="half">(च) मोबाईल नं: ${firmMobileNp}</td>
    </tr>

    <!-- §2 document checklist -->
    <tr><td colspan="2" class="hdr">२. मौजुदा सूचीमा दर्ता हुनको लागि निम्न बमोजिमको प्रमाणपत्र संलग्न गर्नुहोला।</td></tr>
    <tr><td colspan="2" class="chk">
      (क) संस्था वा फर्म दर्ताको प्रमाणपत्र &nbsp;छ ☑&nbsp; छैन □<br>
      (ख) नविकरण गरिएको &nbsp;छ ☑&nbsp; छैन □<br>
      (ग) मूल्य अभिवृद्धि कर वा स्थायी लेखा नम्बर दर्ताको प्रमाणपत्र &nbsp;छ ☑&nbsp; छैन □<br>
      (घ) कर चुक्ताको प्रमाणपत्र &nbsp;छ ☑&nbsp; छैन □<br>
      (ड) कुन खरिदको लागि मौजुदार सूचीमा दर्ता हुन निवेदन दिने हो, सो कामको लागि इजाजत पत्र आवश्यक पत्ने भएमा सो को प्रतिलिपि &nbsp;छ ☑&nbsp; छैन □
    </td></tr>

    <!-- §3 procurement type -->
    <tr><td colspan="2" class="hdr">३. सार्वजनिक निकायबाट हुने खरिदको लागि दर्ता हुन चाहेको खरिदको प्रकृतिको विवरण:</td></tr>
    <tr><td colspan="2" style="padding:0;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td class="w22" style="border:none;border-right:1px solid #666;border-bottom:1px solid #666;padding:5px 8px;">(क) मालसामान<br>आपूर्ति:</td>
          <td class="tall" style="border:none;border-right:1px solid #666;border-bottom:1px solid #666;"></td>
          <td class="w22" style="border:none;border-right:1px solid #666;border-bottom:1px solid #666;padding:5px 8px;">(ख) निर्माण कार्य</td>
          <td class="tall" style="border:none;border-bottom:1px solid #666;"></td>
        </tr>
        <tr>
          <td class="w22" style="border:none;border-right:1px solid #666;padding:5px 8px;">(ग) परामर्श सेवा:</td>
          <td style="border:none;border-right:1px solid #666;padding:5px 8px;">${serviceType}</td>
          <td class="w22" style="border:none;border-right:1px solid #666;padding:5px 8px;">(घ) अन्य सेवा:</td>
          <td class="tall" style="border:none;"></td>
        </tr>
      </table>
    </td></tr>

    <!-- bottom: date | stamp | name+sign -->
    <tr><td colspan="2" style="padding:0;">
      <div style="display:flex;min-height:100px;">
        <div style="flex:0 0 34%;padding:8px 10px;border-right:1px solid #666;line-height:2;font-size:10pt;">
          <div>निवेदन दिएको मिति: ${todayBSStr}</div>
          ${fyNp ? `<div>आ.व.: ${fyNp}</div>` : ''}
        </div>
        <div style="flex:0 0 32%;border-right:1px solid #666;text-align:center;padding:6px 4px;">
          ${includeStamp && firmStamp
            ? `<div style="font-size:9pt;margin-bottom:3px;">फर्मको छाप:</div><img src="${firmStamp}" style="display:block;margin:0 auto;width:30mm;height:30mm;object-fit:contain;background:#fff;">`
            : ''
          }
        </div>
        <div style="flex:1;padding:8px 10px;font-size:10pt;line-height:2;">
          <div>निवेदकको नाम: ${firmContactNp || '_______________'}</div>
          ${includeSign && firmSign
            ? `<div style="margin-top:4px;">हस्ताक्षर: <img src="${firmSign}" style="display:inline-block;vertical-align:middle;margin-left:4px;height:28mm;width:auto;background:#fff;"></div>`
            : ''
          }
        </div>
      </div>
    </td></tr>
  </table>

  </div></div>
${docPages}
</body>
</html>`;

  // Render into a hidden iframe on the same page so fonts + images resolve correctly
  const iframe = document.createElement('iframe');
  iframe.style.cssText = `position:fixed;left:-9999px;top:0;width:${A4_W}px;height:${A4_H}px;border:none;visibility:hidden;`;
  document.body.appendChild(iframe);

  await new Promise(resolve => {
    iframe.onload = resolve;
    iframe.srcdoc = html;
  });

  // Wait for images inside the iframe to finish loading
  const iframeDoc = iframe.contentDocument;
  await Promise.all([...iframeDoc.querySelectorAll('img')].map(img =>
    img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })
  ));

  const { default: html2canvas } = await import('html2canvas');
  const { jsPDF } = await import('jspdf');

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pages = iframeDoc.querySelectorAll('.page, [data-doc="1"]');

  // A4 at 96dpi = 794 × 1123px
  const A4_W = 794, A4_H = 1123;
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const canvas = await html2canvas(page, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: A4_W,
      height: A4_H,
      windowWidth: A4_W,
      windowHeight: A4_H,
    });
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    if (i > 0) pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
  }

  document.body.removeChild(iframe);
  pdf.save('shortlist-letter.pdf');
}

function statusColor(s) {
  if (s === 'Active')  return { bg: 'var(--success-light)', color: '#0b9b85' };
  if (s === 'Expired') return { bg: 'var(--error-light)',   color: '#c0391e' };
  return { bg: 'var(--bg2)', color: 'var(--text3)' };
}

// ── Searchable client combobox ──────────────────────────────────────────────
function ClientCombobox({ clients, value, onChange }) {
  const selected = clients.find(c => String(c.id) === String(value));
  const [query, setQuery] = useState(selected ? (selected.fullName || selected.full_name) : '');
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const ref = useRef(null);
  const inputRef = useRef(null);

  const filtered = useMemo(() => {
    if (!query) return clients;
    const q = query.toLowerCase();
    return clients.filter(c => {
      const name = (c.fullName || c.full_name || '').toLowerCase();
      const short = (c.shortName || c.short_name || '').toLowerCase();
      return name.includes(q) || short.includes(q);
    });
  }, [clients, query]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setFocused(false); } };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (c) => {
    onChange(String(c.id));
    setQuery(c.fullName || c.full_name);
    setOpen(false);
    setFocused(false);
  };

  const hasValue = query.length > 0;
  const borderColor = focused ? 'var(--primary)' : 'var(--md-sys-color-outline, #79747e)';
  const borderWidth = focused ? 2 : 1;
  const labelColor = focused ? 'var(--primary)' : 'var(--md-sys-color-outline, #79747e)';
  const labelUp = hasValue || focused;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* MD outlined-style container */}
      <div
        onClick={() => { inputRef.current?.focus(); setOpen(true); }}
        style={{
          position: 'relative', border: `${borderWidth}px solid ${borderColor}`,
          borderRadius: 4, padding: '0 12px', minHeight: 56, boxSizing: 'border-box',
          cursor: 'text', transition: 'border-color .15s, border-width .15s',
        }}
      >
        {/* Floating label */}
        <span style={{
          position: 'absolute', left: 12, top: labelUp ? -10 : '50%',
          transform: labelUp ? 'translateY(0) scale(0.75)' : 'translateY(-50%) scale(1)',
          transformOrigin: 'left center',
          fontSize: 16, color: labelColor, pointerEvents: 'none',
          background: 'var(--surface, #fff)', padding: '0 4px',
          transition: 'top .12s, transform .12s, color .12s, font-size .12s',
          lineHeight: 1,
        }}>
          Organization (Client)
        </span>
        <div style={{ display: 'flex', alignItems: 'center', paddingTop: 18, paddingBottom: 6 }}>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); onChange(''); setOpen(true); }}
            onFocus={() => { setFocused(true); setOpen(true); }}
            style={{
              flex: 1, border: 'none', outline: 'none', background: 'transparent',
              fontSize: 16, color: 'var(--text)', fontFamily: 'inherit', minWidth: 0,
            }}
          />
          {query ? (
            <button onMouseDown={e => { e.preventDefault(); onChange(''); setQuery(''); setOpen(true); inputRef.current?.focus(); }} style={{
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)',
              fontSize: 18, lineHeight: 1, padding: '2px 0 2px 4px', flexShrink: 0,
            }}>×</button>
          ) : (
            <span style={{ color: 'var(--text3)', fontSize: 18, lineHeight: 1, userSelect: 'none' }}>▾</span>
          )}
        </div>
      </div>
      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0, zIndex: 9999,
          background: 'var(--surface, #fff)', border: '1px solid var(--border)',
          borderRadius: 8, boxShadow: '0 4px 24px rgba(0,0,0,.18)',
          maxHeight: 220, overflowY: 'auto',
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '12px 16px', color: 'var(--text3)', fontSize: 13 }}>No matches</div>
          ) : filtered.map(c => {
            const name = c.fullName || c.full_name;
            const short = c.shortName || c.short_name;
            const isSelected = String(c.id) === String(value);
            return (
              <div key={c.id} onMouseDown={() => select(c)} style={{
                padding: '10px 16px', cursor: 'pointer', fontSize: 14,
                borderBottom: '1px solid var(--border)',
                background: isSelected ? 'color-mix(in srgb, var(--primary) 12%, transparent)' : 'transparent',
                color: isSelected ? 'var(--primary)' : 'var(--text)',
                fontWeight: isSelected ? 600 : 400,
              }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg)'; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
              >
                {name}{short && short !== name ? <span style={{ color: 'var(--text3)', marginLeft: 6, fontWeight: 400 }}>({short})</span> : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Nepali Date Picker ─────────────────────────────────────────────────────────
const BS_YEARS = Object.keys(BS_DATA).map(Number).sort((a,b)=>a-b);

function NepaliDatePicker({ label, value, onChange, required }) {
  // value is AD ISO string (YYYY-MM-DD) or ''
  const toBS = (adStr) => {
    if (!adStr) return { y: '', m: '', d: '' };
    const [y, m, d] = adStr.slice(0, 10).split('-').map(Number);
    const bs = adToBS(new Date(Date.UTC(y, m - 1, d)));
    return { y: bs.y, m: bs.m, d: bs.d };
  };

  const [bs, setBs] = useState(() => toBS(value));
  useEffect(() => { setBs(toBS(value)); }, [value]);

  const maxDays = (bs.y && bs.m && BS_DATA[bs.y]) ? BS_DATA[bs.y][bs.m - 1] : 32;

  const handleChange = (field, val) => {
    const next = { ...bs, [field]: val ? Number(val) : '' };
    setBs(next);
    if (next.y && next.m && next.d) {
      const clampedD = Math.min(next.d, BS_DATA[next.y]?.[next.m - 1] || next.d);
      onChange(bsToAD(next.y, next.m, clampedD));
    } else {
      onChange('');
    }
  };

  const sel = (val, opts, placeholder) => (
    <select value={val || ''} onChange={e => handleChange(opts === 'year' ? 'y' : opts === 'month' ? 'm' : 'd', e.target.value)}
      style={{ flex: 1, padding: '14px 8px 14px 12px', border: '1px solid var(--md-sys-color-outline,#79747e)', borderRadius: 4, background: 'var(--surface)', color: val ? 'var(--text)' : 'var(--text3)', fontSize: 15, fontFamily: 'inherit', appearance: 'none', cursor: 'pointer' }}>
      <option value="">{placeholder}</option>
      {opts === 'year'  && BS_YEARS.map(y => <option key={y} value={y}>{toNpNum(y)}</option>)}
      {opts === 'month' && BS_MONTHS.map((mn, i) => <option key={i+1} value={i+1}>{mn}</option>)}
      {opts === 'day'   && Array.from({length: maxDays}, (_,i) => i+1).map(d => <option key={d} value={d}>{toNpNum(d)}</option>)}
    </select>
  );

  return (
    <div className="form-group">
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 6 }}>
        {label}{required && <span style={{ color: 'var(--error)' }}> *</span>}
      </label>
      <div style={{ display: 'flex', gap: 6 }}>
        {sel(bs.y, 'year',  'वर्ष')}
        {sel(bs.m, 'month', 'महिना')}
        {sel(bs.d, 'day',   'गते')}
      </div>
      {bs.y && bs.m && bs.d && (
        <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 4 }}>
          {toNpNum(bs.d)} {BS_MONTHS[bs.m - 1]} {toNpNum(bs.y)}
        </div>
      )}
    </div>
  );
}

// ── Add/Edit Modal ─────────────────────────────────────────────────────────────
function ShortlistForm({ initial, institutes, clients, onSave, onClose, saving, token }) {
  const isEdit = !!initial?.id;
  const [multi, setMulti] = useState(false); // multi-firm mode (add only)
  const [selectedFirms, setSelectedFirms] = useState([]); // for multi mode
  const [firmSearch, setFirmSearch] = useState('');
  // manual org = not in client list
  const [manualOrg, setManualOrg] = useState(!!(initial?.client_name_manual && !initial?.client_id));

  const empty = {
    client_id: '', client_name_manual: '', institute_id: '', standing_list_name: '', fy: '',
    shortlist_date: '', status: 'Active', remarks: '', contract_amount: '', shortlist_doc: null,
  };
  const [form, setForm] = useState(initial ? {
    client_id:          initial.client_id    ?? '',
    client_name_manual: initial.client_name_manual ?? '',
    institute_id:       initial.institute_id ?? '',
    standing_list_name: initial.standing_list_name ?? '',
    fy:                 initial.fy           ?? '',
    shortlist_date:     initial.shortlist_date ? initial.shortlist_date.slice(0,10) : '',

    status:             initial.status        ?? 'Active',
    remarks:            initial.remarks       ?? '',
    contract_amount:    initial.contract_amount != null ? String(initial.contract_amount) : '',
    shortlist_doc:      initial.shortlist_doc ?? null,
  } : empty);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const [err, setErr] = useState('');

  const toggleFirm = (id) => setSelectedFirms(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  const filteredInstitutes = useMemo(() => {
    if (!firmSearch) return institutes;
    const q = firmSearch.toLowerCase();
    return institutes.filter(i => (i.name + ' ' + (i.acronym||'')).toLowerCase().includes(q));
  }, [institutes, firmSearch]);

  const handleSave = async () => {
    if (!form.fy) return setErr('Fiscal year is required.');
    if (!form.shortlist_date) return setErr('Shortlisting date is required.');
    if (multi && !isEdit) {
      if (selectedFirms.length === 0) return setErr('Select at least one firm.');
      setErr('');
      // Pass array — parent saves all in parallel then reloads once
      await onSave(selectedFirms.map(instId => ({ ...form, institute_id: instId })));
    } else {
      if (!form.institute_id) return setErr('Please select a firm.');
      setErr('');
      await onSave(form);
    }
  };

  return (
    <Modal
      title={isEdit ? 'Edit Shortlist Entry' : 'Add Shortlist Entry'}
      onClose={onClose}
      compact
      footer={<>
        <Btn className="btn btn-secondary" onClick={onClose}>Cancel</Btn>
        <Btn className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Update' : multi ? `Add ${selectedFirms.length || ''} Firms` : 'Add'}
        </Btn>
      </>}
    >
      {err && <div style={{ background:'var(--error-light)', color:'#c0391e', borderRadius:10, padding:'10px 14px', marginBottom:14, fontSize:13 }}>{err}</div>}

      {/* Common fields */}
      <div className="form-row form-row-2">
        <div className="form-group">
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4}}>
            <span style={{fontSize:13, fontWeight:500}}>Organization (Client)</span>
            <button type="button"
              onClick={() => { setManualOrg(v => !v); set('client_id', ''); set('client_name_manual', ''); }}
              style={{fontSize:11.5, color:'var(--primary)', background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:'inherit', fontWeight:500}}>
              {manualOrg ? '← Select from list' : 'Enter manually →'}
            </button>
          </div>
          {manualOrg ? (
            <MdTextField label="Organization name" value={form.client_name_manual} onChange={e => set('client_name_manual', e.target.value)}
              placeholder="Organization name…" />
          ) : (
            <ClientCombobox clients={clients} value={form.client_id} onChange={v => set('client_id', v)} />
          )}
        </div>
        <div className="form-group">
          <MdSelect label="Fiscal Year *" value={form.fy} onChange={e => set('fy', e.target.value)}>
            <MdOption value="">— Select FY —</MdOption>
            {FYS.map(fy => <MdOption key={fy} value={fy}>{fy}</MdOption>)}
          </MdSelect>
        </div>
      </div>

      <div className="form-row form-row-2">
        <div className="form-group">
          <MdSelect label="Standing List Name" value={form.standing_list_name} onChange={e => set('standing_list_name', e.target.value)}>
            <MdOption value="">— Select or leave blank —</MdOption>
            <MdOption value="Standing List">Standing List</MdOption>
            <MdOption value="Roster of Firms">Roster of Firms</MdOption>
            <MdOption value="ADB Consultants List">ADB Consultants List</MdOption>
          </MdSelect>
        </div>
        <NepaliDatePicker label="Shortlisting Date" value={form.shortlist_date} onChange={v => set('shortlist_date', v)} required />
      </div>

      <div className="form-row form-row-2">
        <div className="form-group">
          <MdSelect label="Status" value={form.status} onChange={e => set('status', e.target.value)}>
            <MdOption value="Active">Active</MdOption>
            <MdOption value="Expired">Expired</MdOption>
            <MdOption value="Pending">Pending</MdOption>
          </MdSelect>
        </div>
      </div>

      <div className="form-group">
        <MdTextField type="number" label="Contract Amount (NPR)" value={form.contract_amount} onChange={e => set('contract_amount', e.target.value)} placeholder="Optional" />
      </div>

      <div className="form-group">
        <MdTextField label="Remarks" value={form.remarks} onChange={e => set('remarks', e.target.value)} placeholder="Optional notes" />
      </div>

      <ShortlistDocUpload value={form.shortlist_doc} onChange={v => set('shortlist_doc', v)} token={token}/>

      {/* Firm selection */}
      {!isEdit && (
        <div style={{display:'flex', gap:8, marginBottom:10}}>
          {[['single','Single firm'],['multi','Multiple firms']].map(([v,lbl]) => (
            <button key={v} type="button" onClick={() => { setMulti(v==='multi'); setSelectedFirms([]); set('institute_id',''); }}
              style={{
                padding:'6px 16px', borderRadius:100, border:'none', cursor:'pointer',
                fontFamily:'inherit', fontSize:12.5, fontWeight:500, transition:'all .15s',
                background: (multi ? v==='multi' : v==='single') ? 'var(--primary)' : 'var(--bg)',
                color:      (multi ? v==='multi' : v==='single') ? '#fff'            : 'var(--text3)',
              }}>{lbl}</button>
          ))}
        </div>
      )}

      {/* Single firm dropdown */}
      {(!isEdit && !multi) && (
        <div className="form-group">
          <MdSelect label="Firm (Institute) *" value={form.institute_id} onChange={e => set('institute_id', e.target.value)}>
            <MdOption value="">— Select firm —</MdOption>
            {institutes.map(i => <MdOption key={i.id} value={String(i.id)}>{i.acronym ? `[${i.acronym}] ` : ''}{i.name}</MdOption>)}
          </MdSelect>
        </div>
      )}

      {/* Edit: show firm as read-only dropdown */}
      {isEdit && (
        <div className="form-group">
          <MdSelect label="Firm (Institute)" value={form.institute_id} onChange={e => set('institute_id', e.target.value)}>
            <MdOption value="">— Select firm —</MdOption>
            {institutes.map(i => <MdOption key={i.id} value={String(i.id)}>{i.acronym ? `[${i.acronym}] ` : ''}{i.name}</MdOption>)}
          </MdSelect>
        </div>
      )}

      {/* Multi-firm checklist */}
      {(!isEdit && multi) && (
        <div className="form-group">
          <div style={{fontSize:13, fontWeight:500, color:'var(--text2)', marginBottom:6}}>
            Select Firms * <span style={{color:'var(--text3)', fontWeight:400}}>({selectedFirms.length} selected)</span>
          </div>
          <div style={{border:'1.5px solid var(--border)', borderRadius:10, overflow:'hidden'}}>
            {/* Search bar */}
            <div style={{display:'flex', alignItems:'center', gap:8, padding:'10px 14px', borderBottom:'1px solid var(--border)', background:'var(--bg)'}}>
              <span style={{color:'var(--text3)', fontSize:15, flexShrink:0}}>🔍</span>
              <input
                placeholder="Search firms…"
                value={firmSearch}
                onChange={e => setFirmSearch(e.target.value)}
                style={{border:'none', background:'transparent', outline:'none', width:'100%', fontSize:13, color:'var(--text)', fontFamily:'inherit'}}
              />
              {firmSearch && (
                <button type="button" onClick={() => setFirmSearch('')}
                  style={{background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:16, padding:0, lineHeight:1}}>×</button>
              )}
            </div>
            {/* List */}
            <div style={{maxHeight:240, overflowY:'auto', overflowX:'hidden'}}>
              {filteredInstitutes.length === 0 ? (
                <div style={{padding:'16px 14px', color:'var(--text3)', fontSize:13, textAlign:'center'}}>No matches</div>
              ) : filteredInstitutes.map(i => {
                const checked = selectedFirms.includes(i.id);
                return (
                  <label key={i.id} onClick={() => toggleFirm(i.id)} style={{
                    display:'flex', alignItems:'center', gap:12, padding:'10px 14px',
                    cursor:'pointer', borderBottom:'1px solid var(--border)',
                    background: checked ? 'color-mix(in srgb, var(--primary) 10%, transparent)' : 'transparent',
                    transition:'background .1s', boxSizing:'border-box', width:'100%',
                  }}
                    onMouseEnter={e=>{ if(!checked) e.currentTarget.style.background='var(--bg)'; }}
                    onMouseLeave={e=>{ if(!checked) e.currentTarget.style.background='transparent'; }}
                  >
                    <input type="checkbox" checked={checked} onChange={() => {}} onClick={e => e.stopPropagation()}
                      style={{accentColor:'var(--primary)', flexShrink:0, width:16, height:16}} />
                    <span style={{flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                      fontSize:13, color: checked ? 'var(--primary)' : 'var(--text)', fontWeight: checked ? 600 : 400}}>
                      {i.acronym ? <span style={{color:'var(--text3)', marginRight:5}}>[{i.acronym}]</span> : null}
                      {i.name}
                    </span>
                  </label>
                );
              })}
            </div>
            {/* Footer */}
            {selectedFirms.length > 0 && (
              <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 14px', borderTop:'1px solid var(--border)', background:'var(--bg)'}}>
                <span style={{fontSize:12, color:'var(--text3)'}}>{selectedFirms.length} firm{selectedFirms.length>1?'s':''} selected</span>
                <button type="button" onClick={() => setSelectedFirms([])}
                  style={{background:'none', border:'none', color:'var(--primary)', cursor:'pointer', fontSize:12, padding:0, fontFamily:'inherit'}}>
                  Clear all
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── Letter Options Modal ───────────────────────────────────────────────────────
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

function LetterOptsModal({ row, token, onClose }) {
  const [inclSign, setInclSign] = useState(!!row.institute_sign);
  const [inclStamp, setInclStamp] = useState(!!row.institute_stamp);
  // Always fetch fresh institute data so latest margin settings are used
  const [freshRow, setFreshRow] = useState(row);
  useEffect(() => {
    if (!row.institute_id && !row.id) return;
    const instId = row.institute_id;
    api('GET', `/institutes/${instId}`, null, token)
      .then(inst => {
        setFreshRow(r => ({
          ...r,
          institute_letter_top_margin: inst.letterTopMargin,
          institute_letter_lr_padding: inst.letterLrPadding,
          institute_letter_bottom_padding: inst.letterBottomPadding,
        }));
      })
      .catch(() => {}); // silently fall back to row values
  }, [row.institute_id, token]);
  const hasDocs = {
    ocrReg:   !!row.institute_ocr_registration,
    ocrRen:   !!row.institute_ocr_renewal,
    llReg:    !!row.institute_local_level_registration,
    llRen:    !!row.institute_local_level_renewal,
    vat:      !!row.institute_vat_registration,
    taxClear: !!row.institute_tax_clearance_doc,
    vatExt:   !!row.institute_vat_extension,
    ctevtAff: !!row.institute_ctevt_affiliation,
    ctevtRen: !!row.institute_ctevt_renewal,
  };
  const [inclDocs, setInclDocs] = useState({ ...hasDocs });
  const anyDocs = Object.values(hasDocs).some(Boolean);
  const toggle = k => setInclDocs(d => ({...d, [k]: !d[k]}));

  return (
    <Modal title="Generate Letter" onClose={onClose} footer={<>
      <Btn className="btn btn-secondary" onClick={onClose}>Cancel</Btn>
      <Btn className="btn btn-primary" onClick={async () => {
        onClose();
        await openShortlistLetter(freshRow, { includeSign: inclSign, includeStamp: inclStamp, docs: inclDocs, serviceType: freshRow.institute_service_type });
      }}>Generate &amp; Print</Btn>
    </>}>
      <div style={{display:'flex', flexDirection:'column', gap:12}}>

        {/* Signature toggle */}
        <label style={{display:'flex', alignItems:'center', gap:14, padding:'12px 14px', borderRadius:10, border:'1px solid var(--border)', background:'var(--bg)', cursor:'pointer'}}>
          <MdToggle selected={inclSign} onChange={e=>setInclSign(e.target.selected)} style={{flexShrink:0}}/>
          <div style={{flex:1}}>
            <div style={{fontWeight:600, fontSize:13, color:'var(--text)'}}>Include signature</div>
            <div style={{fontSize:12, color:'var(--text3)', marginTop:2, lineHeight:1.4}}>
              {row.institute_sign ? 'Signature appears in the letter and on each attached document.' : 'No signature uploaded yet — add it in the firm profile.'}
            </div>
          </div>
        </label>

        {/* Stamp toggle */}
        <label style={{display:'flex', alignItems:'center', gap:14, padding:'12px 14px', borderRadius:10, border:'1px solid var(--border)', background:'var(--bg)', cursor:'pointer'}}>
          <MdToggle selected={inclStamp} onChange={e=>setInclStamp(e.target.selected)} style={{flexShrink:0}}/>
          <div style={{flex:1}}>
            <div style={{fontWeight:600, fontSize:13, color:'var(--text)'}}>Include stamp</div>
            <div style={{fontSize:12, color:'var(--text3)', marginTop:2, lineHeight:1.4}}>
              {row.institute_stamp ? 'Stamp appears in the letter and on each attached document.' : 'No stamp uploaded yet — add it in the firm profile.'}
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
          <div style={{display:'flex', alignItems:'center', gap:10, padding:'12px 14px', borderRadius:10, border:'1px solid var(--border)', background:'var(--bg)'}}>
            <span style={{fontSize:18, opacity:.5}}>📄</span>
            <div style={{fontSize:12, color:'var(--text3)', lineHeight:1.5}}>
              No documents uploaded for this firm. Upload OCR, VAT, and CTEVT certificates in the firm profile to attach them here.
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
function AgreementUpload({ value, onChange, token }) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const handleFile = async e => {
    const file = e.target.files[0]; if (!file) return;
    e.target.value = ''; setErr(''); setUploading(true);
    try { onChange(await uploadToR2(file, token)); }
    catch (ex) { setErr(ex.message); }
    finally { setUploading(false); }
  };
  return (
    <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
      {value && (
        <a href={value} target="_blank" rel="noreferrer"
          style={{fontSize:12, color:'var(--primary)', display:'flex', alignItems:'center', gap:4}}>
          <span className="material-icons-round" style={{fontSize:14}}>description</span>Agreement
        </a>
      )}
      <label style={{cursor: uploading ? 'wait' : 'pointer'}}>
        <input type="file" accept="image/*,application/pdf" style={{display:'none'}} onChange={handleFile} disabled={uploading}/>
        <span className="btn btn-ghost btn-sm" style={{fontSize:11}}>{uploading ? 'Uploading…' : value ? 'Replace' : 'Upload Agreement'}</span>
      </label>
      {err && <span style={{fontSize:11, color:'#c0391e'}}>{err}</span>}
    </div>
  );
}

// Modal to add or edit a contract
function ContractModal({ initial, clientId, clientNameManual, onSave, onClose, saving }) {
  const [form, setForm] = useState({ fy: initial?.fy || '', title: initial?.title || '', description: initial?.description || '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <Modal
      title={initial?.id ? 'Edit Contract' : 'New Contract'}
      onClose={onClose}
      compact
      footer={<>
        <Btn className="btn btn-secondary" onClick={onClose}>Cancel</Btn>
        <Btn className="btn btn-primary" onClick={() => onSave(form)} disabled={saving || !form.fy || !form.title}>
          {saving ? 'Saving…' : 'Save'}
        </Btn>
      </>}
    >
      <div style={{display:'flex', flexDirection:'column', gap:14}}>
        <MdSelect label="Fiscal Year *" value={form.fy} onChange={e => set('fy', e.target.value)}>
          <MdOption value="">— Select FY —</MdOption>
          {FYS.map(fy => <MdOption key={fy} value={fy}>{fy}</MdOption>)}
        </MdSelect>
        <MdTextField label="Contract Title *" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Barista Training" />
        <MdTextField label="Description" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optional details" />
      </div>
    </Modal>
  );
}

// Modal to add/edit a quotation for a contract
function QuotationModal({ initial, contract, shortlistOptions, onSave, onClose, saving, token }) {
  const today = new Date().toISOString().slice(0,10);
  const [form, setForm] = useState({
    shortlist_id: initial?.shortlist_id ? String(initial.shortlist_id) : '',
    quotation_date: initial?.quotation_date ? initial.quotation_date.slice(0,10) : today,
    quoted_amount: initial?.quoted_amount != null ? String(initial.quoted_amount) : '',
    status: initial?.status || 'Quoted',
    contract_amount: initial?.contract_amount != null ? String(initial.contract_amount) : '',
    agreement_doc: initial?.agreement_doc || null,
    remarks: initial?.remarks || '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const isAwarded = form.status === 'Awarded';
  return (
    <Modal
      title={initial?.id ? 'Edit Quotation' : `Add Quotation — ${contract.title}`}
      onClose={onClose}
      compact
      footer={<>
        <Btn className="btn btn-secondary" onClick={onClose}>Cancel</Btn>
        <Btn className="btn btn-primary"
          onClick={() => onSave({ ...form, shortlist_id: Number(form.shortlist_id), quoted_amount: form.quoted_amount !== '' ? Number(form.quoted_amount) : null, contract_amount: isAwarded && form.contract_amount !== '' ? Number(form.contract_amount) : null })}
          disabled={saving || !form.shortlist_id}>
          {saving ? 'Saving…' : 'Save'}
        </Btn>
      </>}
    >
      <div style={{display:'flex', flexDirection:'column', gap:14}}>
        {!initial?.id && (
          <MdSelect label="Firm *" value={form.shortlist_id} onChange={e => set('shortlist_id', e.target.value)}>
            <MdOption value="">— Select shortlisted firm —</MdOption>
            {shortlistOptions.map(sl => (
              <MdOption key={sl.id} value={String(sl.id)}>
                {sl.institute_acronym ? `[${sl.institute_acronym}] ` : ''}{sl.institute_name} · {sl.fy}
              </MdOption>
            ))}
          </MdSelect>
        )}
        <NepaliDatePicker label="Quotation Date *" value={form.quotation_date} onChange={v => set('quotation_date', v)} />
        <MdTextField type="number" label="Quoted Amount (NPR)" value={form.quoted_amount} onChange={e => set('quoted_amount', e.target.value)} placeholder="Optional" />
        <MdSelect label="Status" value={form.status} onChange={e => set('status', e.target.value)}>
          {QUOTE_STATUS.map(s => <MdOption key={s} value={s}>{s}</MdOption>)}
        </MdSelect>
        {isAwarded && <>
          <MdTextField type="number" label="Contract Amount ex-VAT (NPR) *" value={form.contract_amount} onChange={e => set('contract_amount', e.target.value)} placeholder="e.g. 498328" />
          <div>
            <div style={{fontSize:13, fontWeight:600, color:'var(--text2)', marginBottom:6}}>Agreement Document</div>
            <AgreementUpload value={form.agreement_doc} onChange={v => set('agreement_doc', v)} token={token} />
          </div>
        </>}
        <MdTextField label="Remarks" value={form.remarks} onChange={e => set('remarks', e.target.value)} placeholder="Optional" />
      </div>
    </Modal>
  );
}

// Contracts panel shown below firm rows when org grouping is active
function ContractsPanel({ clientId, clientNameManual, groupRows, canEdit, isAdmin, token }) {
  const [contracts, setContracts] = useState([]);
  const [quotations, setQuotations] = useState({}); // keyed by contract_id
  const [expanded, setExpanded] = useState({});      // contract_id → bool
  const [loading, setLoading] = useState(true);
  const [cModal, setCModal] = useState(null); // {type:'add'|'edit'|'delete', data?}
  const [qModal, setQModal] = useState(null); // {type:'add'|'edit'|'delete', contractId, data?}
  const [saving, setSaving] = useState(false);

  const loadContracts = useCallback(async () => {
    if (!clientId && !clientNameManual) { setLoading(false); return; }
    setLoading(true);
    try {
      const params = clientId ? `client_id=${clientId}` : `client_name_manual=${encodeURIComponent(clientNameManual)}`;
      const rows = await api('GET', `/contracts?${params}`, null, token);
      setContracts(rows);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [clientId, clientNameManual, token]);

  const loadQuotations = useCallback(async (contractId) => {
    try {
      const rows = await api('GET', `/quotations?contract_id=${contractId}`, null, token);
      setQuotations(q => ({ ...q, [contractId]: rows }));
    } catch(e) { console.error(e); }
  }, [token]);

  useEffect(() => { loadContracts(); }, [loadContracts]);

  const toggleContract = async (id) => {
    const isOpen = expanded[id];
    setExpanded(e => ({ ...e, [id]: !isOpen }));
    if (!isOpen && !quotations[id]) await loadQuotations(id);
  };

  const handleContractSave = async (form) => {
    setSaving(true);
    try {
      const payload = { ...form, client_id: clientId || null, client_name_manual: clientNameManual || null };
      if (cModal?.data?.id) await api('PUT', `/contracts/${cModal.data.id}`, payload, token);
      else await api('POST', '/contracts', payload, token);
      await loadContracts();
      setCModal(null);
    } catch(e) { alert(e.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleContractDelete = async () => {
    setSaving(true);
    try {
      await api('DELETE', `/contracts/${cModal.data.id}`, null, token);
      await loadContracts();
      setCModal(null);
    } catch(e) { alert(e.message || 'Delete failed'); }
    finally { setSaving(false); }
  };

  const handleQuotationSave = async (form) => {
    setSaving(true);
    try {
      const payload = { ...form, contract_id: qModal.contractId };
      if (qModal?.data?.id) await api('PUT', `/quotations/${qModal.data.id}`, payload, token);
      else await api('POST', '/quotations', payload, token);
      await loadQuotations(qModal.contractId);
      setQModal(null);
    } catch(e) { alert(e.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleQuotationDelete = async () => {
    setSaving(true);
    try {
      await api('DELETE', `/quotations/${qModal.data.id}`, null, token);
      await loadQuotations(qModal.contractId);
      setQModal(null);
    } catch(e) { alert(e.message || 'Delete failed'); }
    finally { setSaving(false); }
  };

  // Firms shortlisted for this org (all FYs) — usable as quotation options
  const shortlistOptions = groupRows;

  return (
    <div style={{borderTop:'2px solid var(--primary-light)', background:'var(--bg)'}}>
      {/* Panel header */}
      <div style={{display:'flex', alignItems:'center', gap:10, padding:'12px 20px', borderBottom:'1px solid var(--border)'}}>
        <span className="material-icons-round" style={{fontSize:16, color:'var(--primary)'}}>gavel</span>
        <span style={{fontSize:13, fontWeight:700, color:'var(--primary-dark)', flex:1}}>Contracts & Quotations</span>
        {canEdit && (
          <button onClick={() => setCModal({type:'add'})}
            style={{display:'flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:8, border:'1px solid var(--primary)', background:'var(--primary-light)', color:'var(--primary-dark)', cursor:'pointer', fontSize:12, fontWeight:600}}>
            <span className="material-icons-round" style={{fontSize:14}}>add</span> New Contract
          </button>
        )}
      </div>

      {loading ? (
        <div style={{padding:'20px', textAlign:'center', color:'var(--text3)', fontSize:13}}>
          <span className="spin material-icons-round" style={{fontSize:18}}>sync</span>
        </div>
      ) : contracts.length === 0 ? (
        <div style={{padding:'18px 20px', fontSize:13, color:'var(--text3)', fontStyle:'italic'}}>
          No contracts yet.{canEdit ? ' Click "New Contract" to create one.' : ''}
        </div>
      ) : (
        <div>
          {contracts.map(c => {
            const isOpen = !!expanded[c.id];
            const quotes = quotations[c.id] || [];
            const awarded = quotes.find(q => q.status === 'Awarded');
            return (
              <div key={c.id} style={{borderBottom:'1px solid var(--border)'}}>
                {/* Contract row */}
                <div style={{display:'flex', alignItems:'center', gap:10, padding:'11px 20px', cursor:'pointer', background: isOpen ? 'var(--surface)' : 'transparent'}}
                  onClick={() => toggleContract(c.id)}>
                  <span className="material-icons-round" style={{fontSize:14, color:'var(--text3)', flexShrink:0}}>
                    {isOpen ? 'expand_more' : 'chevron_right'}
                  </span>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontWeight:600, fontSize:13, color:'var(--text)'}}>{c.title}</div>
                    {c.description && <div style={{fontSize:11.5, color:'var(--text3)', marginTop:1}}>{c.description}</div>}
                  </div>
                  <span style={{fontSize:11, fontWeight:600, padding:'2px 9px', borderRadius:100, background:'var(--primary-light)', color:'var(--primary-dark)', flexShrink:0}}>
                    FY {c.fy}
                  </span>
                  {awarded && (
                    <span style={{fontSize:11, fontWeight:600, padding:'2px 9px', borderRadius:100, background:'var(--success-light)', color:'var(--success)', flexShrink:0}}>
                      Awarded · NPR {Number(awarded.contract_amount || 0).toLocaleString()}
                    </span>
                  )}
                  <span style={{fontSize:11, color:'var(--text3)', flexShrink:0}}>{c.quotation_count} quote{c.quotation_count !== 1 ? 's' : ''}</span>
                  {canEdit && (
                    <div style={{display:'flex', gap:2, flexShrink:0}} onClick={e => e.stopPropagation()}>
                      <button title="Edit contract" onClick={() => setCModal({type:'edit', data:c})}
                        style={{width:28, height:28, borderRadius:50, border:'none', background:'transparent', color:'var(--text3)', cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center'}}
                        onMouseEnter={e=>{e.currentTarget.style.background='var(--bg2)'; e.currentTarget.style.color='var(--text)';}}
                        onMouseLeave={e=>{e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--text3)';}}>
                        <span className="material-icons-round" style={{fontSize:14}}>edit</span>
                      </button>
                      {isAdmin && (
                        <button title="Delete contract" onClick={() => setCModal({type:'delete', data:c})}
                          style={{width:28, height:28, borderRadius:50, border:'none', background:'transparent', color:'var(--text3)', cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center'}}
                          onMouseEnter={e=>{e.currentTarget.style.background='var(--error-light)'; e.currentTarget.style.color='var(--error)';}}
                          onMouseLeave={e=>{e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--text3)';}}>
                          <span className="material-icons-round" style={{fontSize:14}}>delete</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Quotations table */}
                {isOpen && (
                  <div style={{background:'var(--surface)', borderTop:'1px solid var(--border)'}}>
                    {/* Quotation header */}
                    <div style={{display:'flex', alignItems:'center', gap:8, padding:'7px 32px', background:'var(--bg)', borderBottom:'1px solid var(--border)'}}>
                      <div style={{flex:2, fontSize:10.5, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.5px'}}>Firm</div>
                      <div style={{width:110, fontSize:10.5, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.5px', flexShrink:0}}>Quote Date</div>
                      <div style={{width:130, fontSize:10.5, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.5px', flexShrink:0}}>Quoted (NPR)</div>
                      <div style={{width:80, fontSize:10.5, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.5px', flexShrink:0}}>Status</div>
                      <div style={{flex:1, fontSize:10.5, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.5px'}}>Contract Amt (ex-VAT)</div>
                      <div style={{width:90, flexShrink:0}}></div>
                    </div>

                    {quotes.length === 0 ? (
                      <div style={{padding:'14px 32px', fontSize:12.5, color:'var(--text3)', fontStyle:'italic'}}>
                        No quotations yet.
                      </div>
                    ) : quotes.map((q, qi) => {
                      const sc = statusColor2(q.status);
                      const altBg = qi % 2 === 1 ? 'var(--bg)' : 'var(--surface)';
                      return (
                        <div key={q.id} style={{display:'flex', alignItems:'center', gap:8, padding:'10px 32px', borderBottom:'1px solid var(--border)', background:altBg}}>
                          <div style={{flex:2, minWidth:0}}>
                            <span style={{fontWeight:600, fontSize:13}}>
                              {q.institute_acronym ? <span style={{color:'var(--text3)', fontWeight:500}}>[{q.institute_acronym}] </span> : null}
                              {q.institute_name}
                            </span>
                            <span style={{fontSize:11, color:'var(--text3)', marginLeft:6}}>FY {q.shortlist_fy}</span>
                          </div>
                          <div style={{width:110, fontSize:12.5, color:'var(--text2)', flexShrink:0}}>
                            {fmt(q.quotation_date)}
                          </div>
                          <div style={{width:130, fontSize:13, fontWeight:600, color:'var(--text)', flexShrink:0}}>
                            {q.quoted_amount != null ? Number(q.quoted_amount).toLocaleString() : '—'}
                          </div>
                          <div style={{width:80, flexShrink:0}}>
                            <span style={{fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:100, background:sc.bg, color:sc.color}}>
                              {q.status}
                            </span>
                          </div>
                          <div style={{flex:1, minWidth:0}}>
                            {q.status === 'Awarded' ? (
                              <div>
                                <span style={{fontSize:13, fontWeight:700, color:'var(--success)'}}>
                                  {q.contract_amount != null ? `NPR ${Number(q.contract_amount).toLocaleString()}` : '—'}
                                </span>
                                {q.agreement_doc && (
                                  <a href={q.agreement_doc} target="_blank" rel="noreferrer"
                                    style={{display:'block', fontSize:11, color:'var(--primary)', marginTop:2}}>
                                    <span className="material-icons-round" style={{fontSize:12, verticalAlign:'middle'}}>description</span> Agreement
                                  </a>
                                )}
                              </div>
                            ) : <span style={{color:'var(--text3)'}}>—</span>}
                          </div>
                          <div style={{width:90, display:'flex', gap:2, flexShrink:0, justifyContent:'flex-end'}}>
                            {canEdit && (
                              <button title="Edit" onClick={() => setQModal({type:'edit', contractId:c.id, data:q})}
                                style={{width:28, height:28, borderRadius:50, border:'none', background:'transparent', color:'var(--text3)', cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center'}}
                                onMouseEnter={e=>{e.currentTarget.style.background='var(--bg2)'; e.currentTarget.style.color='var(--text)';}}
                                onMouseLeave={e=>{e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--text3)';}}>
                                <span className="material-icons-round" style={{fontSize:14}}>edit</span>
                              </button>
                            )}
                            {isAdmin && (
                              <button title="Delete" onClick={() => setQModal({type:'delete', contractId:c.id, data:q})}
                                style={{width:28, height:28, borderRadius:50, border:'none', background:'transparent', color:'var(--text3)', cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center'}}
                                onMouseEnter={e=>{e.currentTarget.style.background='var(--error-light)'; e.currentTarget.style.color='var(--error)';}}
                                onMouseLeave={e=>{e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--text3)';}}>
                                <span className="material-icons-round" style={{fontSize:14}}>delete</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Add quotation row */}
                    {canEdit && (
                      <div style={{padding:'10px 32px'}}>
                        <button onClick={() => setQModal({type:'add', contractId:c.id})}
                          style={{display:'flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:8, border:'1px dashed var(--border)', background:'transparent', color:'var(--text3)', cursor:'pointer', fontSize:12}}>
                          <span className="material-icons-round" style={{fontSize:14}}>add</span> Add Quotation
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Contract modals */}
      {(cModal?.type === 'add' || cModal?.type === 'edit') && (
        <ContractModal
          initial={cModal.data}
          clientId={clientId}
          clientNameManual={clientNameManual}
          onSave={handleContractSave}
          onClose={() => setCModal(null)}
          saving={saving}
        />
      )}
      {cModal?.type === 'delete' && (
        <ConfirmModal
          message={`Delete contract "${cModal.data.title}"? All quotations under it will also be deleted.`}
          onConfirm={handleContractDelete}
          onClose={() => setCModal(null)}
          saving={saving}
        />
      )}

      {/* Quotation modals */}
      {(qModal?.type === 'add' || qModal?.type === 'edit') && (
        <QuotationModal
          initial={qModal.data}
          contract={contracts.find(c => c.id === qModal.contractId) || {}}
          shortlistOptions={shortlistOptions}
          onSave={handleQuotationSave}
          onClose={() => setQModal(null)}
          saving={saving}
          token={token}
        />
      )}
      {qModal?.type === 'delete' && (
        <ConfirmModal
          message={`Delete this quotation from "${qModal.data.institute_name}"?`}
          onConfirm={handleQuotationDelete}
          onClose={() => setQModal(null)}
          saving={saving}
        />
      )}
    </div>
  );
}

// ── Delete Confirm Modal ───────────────────────────────────────────────────────
function ConfirmModal({ message, onConfirm, onClose, saving }) {
  return (
    <Modal title="Confirm Delete" onClose={onClose} footer={<>
      <Btn className="btn btn-secondary" onClick={onClose}>Cancel</Btn>
      <Btn className="btn btn-danger" onClick={onConfirm} disabled={saving}>{saving ? 'Deleting…' : 'Delete'}</Btn>
    </>}>
      <p style={{ margin:0, color:'var(--text2)' }}>{message}</p>
    </Modal>
  );
}

// ── Bill Upload Modal ──────────────────────────────────────────────────────────
function BillModal({ row, token, onSave, onClose, saving }) {
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
function ShortlistRow({ row, idx, canEdit, isAdmin, onEdit, onDelete, onBillSave, saving, token, showFY=true }) {
  const sc = statusColor(row.status);
  const altBg = idx % 2 === 1 ? 'var(--bg)' : 'var(--surface)';
  const hoverBg = idx % 2 === 1 ? 'var(--bg2)' : 'var(--bg)';
  const [showLetterOpts, setShowLetterOpts] = useState(false);
  const [showBill, setShowBill] = useState(false);
  const hasBill = !!(row.shortlist_doc);
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:12, padding:'13px 20px',
      borderBottom:'1px solid var(--border)', background:altBg, transition:'background .12s',
    }}
      onMouseEnter={e => e.currentTarget.style.background = hoverBg}
      onMouseLeave={e => e.currentTarget.style.background = altBg}
    >
      {/* Firm name */}
      <div style={{flex:2, minWidth:0}}>
        <div style={{fontWeight:600, fontSize:13.5, color:'var(--text)'}}>
          {row.institute_acronym ? <span style={{color:'var(--text3)', fontWeight:500}}>[{row.institute_acronym}] </span> : null}
          {row.institute_name}
        </div>
        {row.standing_list_name && <div style={{fontSize:11.5, color:'var(--text3)', marginTop:2}}>{row.standing_list_name}</div>}
      </div>

      {/* Organization */}
      <div style={{flex:2, minWidth:0, fontSize:13, color:'var(--text2)'}}>
        {(row.client_name || row.client_name_manual)
          ? <>{row.client_short ? <span style={{fontWeight:600}}>{row.client_short}</span> : null}
            {row.client_short && <span style={{color:'var(--text3)'}}> · </span>}
            <span style={row.client_short ? {color:'var(--text3)'} : {}}>
              {row.client_name || row.client_name_manual}
            </span>
            {row.client_name_manual && !row.client_name && (
              <span style={{fontSize:10, marginLeft:5, color:'var(--text3)', fontStyle:'italic'}}>manual</span>
            )}
          </>
          : <span style={{color:'var(--text3)', fontStyle:'italic'}}>No organization</span>
        }
      </div>

      {/* FY — hidden when already grouped by FY */}
      {showFY && (
        <div style={{width:80, fontSize:12, fontWeight:600, color:'var(--primary-dark)', background:'var(--primary-light)', borderRadius:100, padding:'3px 10px', flexShrink:0, textAlign:'center'}}>
          {row.fy || '—'}
        </div>
      )}

      {/* Contract / Bill */}
      <div style={{flex:1, minWidth:0}}>
        {row.contract_amount === 0
          ? <span style={{fontSize:12, color:'var(--success)', fontWeight:600}}>Free</span>
          : row.contract_amount != null
            ? <span style={{fontSize:13, fontWeight:700, color:'var(--text)'}}>NPR {Number(row.contract_amount).toLocaleString()}</span>
            : <span style={{fontSize:12, color:'var(--text3)', fontStyle:'italic'}}>—</span>
        }
        {hasBill && row.shortlist_doc && (
          <a href={typeof row.shortlist_doc === 'string' ? row.shortlist_doc : JSON.parse(row.shortlist_doc)[0]} target="_blank" rel="noreferrer"
            style={{display:'block', fontSize:11, color:'var(--primary)', marginTop:2}}>
            <span className="material-icons-round" style={{fontSize:12, verticalAlign:'middle'}}>receipt</span> View Receipt
          </a>
        )}
      </div>

      {/* Actions */}
      <div style={{display:'flex', gap:2, flexShrink:0}}>
        {showLetterOpts && <LetterOptsModal row={row} token={token} onClose={()=>setShowLetterOpts(false)}/>}
        {showBill && <BillModal row={row} token={token} saving={saving} onClose={()=>setShowBill(false)} onSave={async (patch) => { await onBillSave(row.id, patch); setShowBill(false); }}/>}
        {canEdit && (
          <button title={hasBill ? 'Bill uploaded — click to update' : 'Upload bill / certificate'} onClick={() => setShowBill(true)}
            style={{width:30,height:30,borderRadius:50,border:'none',background: hasBill ? 'var(--success-light)' : 'transparent',color: hasBill ? 'var(--success)' : 'var(--text3)',cursor:'pointer',display:'inline-flex',alignItems:'center',justifyContent:'center'}}
            onMouseEnter={e=>{e.currentTarget.style.background='var(--success-light)';e.currentTarget.style.color='#0b9b85';}}
            onMouseLeave={e=>{e.currentTarget.style.background= hasBill ? 'var(--success-light)' : '';e.currentTarget.style.color= hasBill ? 'var(--success)' : 'var(--text3)';}}
          ><span className="material-icons-round" style={{fontSize:15}}>receipt</span></button>
        )}
        <button title="Generate Letter" onClick={() => setShowLetterOpts(true)}
          style={{width:30,height:30,borderRadius:50,border:'none',background:'transparent',color:'var(--text3)',cursor:'pointer',display:'inline-flex',alignItems:'center',justifyContent:'center'}}
          onMouseEnter={e=>{e.currentTarget.style.background='var(--primary-light)';e.currentTarget.style.color='var(--primary-dark)';}}
          onMouseLeave={e=>{e.currentTarget.style.background='';e.currentTarget.style.color='var(--text3)';}}
        ><span className="material-icons-round" style={{fontSize:15}}>description</span></button>
        {canEdit && (
          <button title="Edit" onClick={() => onEdit(row)}
            style={{width:30,height:30,borderRadius:50,border:'none',background:'transparent',color:'var(--text3)',cursor:'pointer',display:'inline-flex',alignItems:'center',justifyContent:'center'}}
            onMouseEnter={e=>{e.currentTarget.style.background='var(--bg2)';e.currentTarget.style.color='var(--text)';}}
            onMouseLeave={e=>{e.currentTarget.style.background='';e.currentTarget.style.color='var(--text3)';}}
          ><span className="material-icons-round" style={{fontSize:15}}>edit</span></button>
        )}
        {isAdmin && (
          <button title="Delete" onClick={() => onDelete(row)}
            style={{width:30,height:30,borderRadius:50,border:'none',background:'transparent',color:'var(--text3)',cursor:'pointer',display:'inline-flex',alignItems:'center',justifyContent:'center'}}
            onMouseEnter={e=>{e.currentTarget.style.background='var(--error-light)';e.currentTarget.style.color='var(--error)';}}
            onMouseLeave={e=>{e.currentTarget.style.background='';e.currentTarget.style.color='var(--text3)';}}
          ><span className="material-icons-round" style={{fontSize:15}}>delete</span></button>
        )}
      </div>
    </div>
  );
}

// ── Group header ───────────────────────────────────────────────────────────────
function GroupHeader({ label, sub, count, expanded, onToggle, isCurrent }) {
  return (
    <button onClick={onToggle} style={{
      width:'100%', display:'flex', alignItems:'center', gap:12,
      padding:'14px 20px', background:'var(--surface)', border:'none',
      cursor:'pointer', textAlign:'left', fontFamily:'inherit',
      borderBottom: expanded ? '1px solid var(--border)' : 'none',
      transition:'background .12s',
    }}
      onMouseEnter={e=>e.currentTarget.style.background='var(--bg)'}
      onMouseLeave={e=>e.currentTarget.style.background='var(--surface)'}
    >
      <span className="material-icons-round" style={{fontSize:16, color:'var(--text3)', flexShrink:0}}>
        {expanded ? 'expand_more' : 'chevron_right'}
      </span>
      <div style={{flex:1, display:'flex', alignItems:'center', gap:8}}>
        <div style={{fontWeight:600, fontSize:13.5, color:'var(--text)'}}>{label}</div>
        {isCurrent && (
          <span style={{fontSize:10, fontWeight:700, padding:'2px 9px', borderRadius:100, background:'var(--success)', color:'#fff', flexShrink:0}}>
            Current
          </span>
        )}
        {sub && <div style={{fontSize:11.5, color:'var(--text3)'}}>{sub}</div>}
      </div>
      <span style={{fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:100, background:'var(--primary-light)', color:'var(--primary-dark)', flexShrink:0}}>
        {count} {count === 1 ? 'entry' : 'entries'}
      </span>
    </button>
  );
}

// ── Table header row ───────────────────────────────────────────────────────────
function TableHead({ groupBy }) {
  const col = {fontSize:11, fontWeight:600, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.6px'};
  return (
    <div style={{display:'flex', alignItems:'center', gap:12, padding:'9px 20px', background:'var(--bg)', borderBottom:'1px solid var(--border)'}}>
      <div style={{flex:2, ...col}}>Firm</div>
      <div style={{flex:2, ...col}}>Organization</div>
      {groupBy !== 'fy' && <div style={{width:80, ...col, flexShrink:0}}>FY</div>}
      <div style={{flex:1, ...col}}>Contract</div>
      <div style={{width:90, flexShrink:0}}></div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Shortlisting({ institutes, clients, isAdmin, isEditor, isShortlistOnly }) {
  const session = getSession();
  const token = session?.token;
  const canEdit = !!(isAdmin || isEditor || isShortlistOnly);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(null); // {type:'add'|'edit'|'delete', data?}
  const [expanded, setExpanded] = useState({});
  const [groupBy, setGroupBy] = useState('org'); // 'fy' | 'org' | 'firm'
  const [filterOrg, setFilterOrg] = useState('');
  const [filterFirm, setFilterFirm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterFY, setFilterFY] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api('GET', '/shortlists', null, token);
      setRows(data);
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => rows.filter(r => {
    if (filterOrg    && String(r.client_id)    !== filterOrg)    return false;
    if (filterFirm   && String(r.institute_id) !== filterFirm)   return false;
    if (filterStatus && r.status !== filterStatus)               return false;
    if (filterFY     && r.fy !== filterFY)                       return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = [r.institute_name, r.institute_acronym, r.client_name, r.client_short, r.standing_list_name, r.fy, r.remarks].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }), [rows, filterOrg, filterFirm, filterStatus, filterFY, search]);

  // Group the filtered rows
  const grouped = useMemo(() => {
    const map = new Map();
    for (const row of filtered) {
      let key, label, sub;
      if (groupBy === 'fy') {
        key = row.fy || '__none__';
        label = row.fy ? `FY ${row.fy}` : 'No Fiscal Year';
        sub = '';
      } else if (groupBy === 'org') {
        key = row.client_id ? String(row.client_id) : (row.client_name_manual ? `m:${row.client_name_manual}` : '__none__');
        label = row.client_name || row.client_name_manual || 'No Organization';
        sub = row.client_short || '';
      } else {
        key = String(row.institute_id);
        label = row.institute_name || '—';
        sub = row.institute_acronym || '';
      }
      if (!map.has(key)) map.set(key, { label, sub, rows: [] });
      map.get(key).rows.push(row);
    }
    // Sort: FY descending (newest first), others alphabetical
    return [...map.entries()].sort((a, b) =>
      groupBy === 'fy'
        ? b[0].localeCompare(a[0])
        : a[1].label.localeCompare(b[1].label)
    );
  }, [filtered, groupBy]);

  const toggle = (key) => setExpanded(e => ({ ...e, [key]: !e[key] }));

  const handleSave = async (formOrArray) => {
    setSaving(true);
    try {
      if (Array.isArray(formOrArray)) {
        // Bulk: save all in parallel
        await Promise.all(formOrArray.map(f => api('POST', '/shortlists', f, token)));
      } else if (modal?.data?.id) {
        await api('PUT', `/shortlists/${modal.data.id}`, formOrArray, token);
      } else {
        await api('POST', '/shortlists', formOrArray, token);
      }
      await load();
      setModal(null);
    } catch(e) { alert(e.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleBillSave = async (id, patch) => {
    setSaving(true);
    try {
      const existing = rows.find(r => r.id === id);
      await api('PUT', `/shortlists/${id}`, { ...existing, ...patch }, token);
      await load();
    } catch(e) { alert(e.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await api('DELETE', `/shortlists/${modal.data.id}`, null, token);
      await load();
      setModal(null);
    } catch(e) { alert(e.message || 'Delete failed'); }
    finally { setSaving(false); }
  };

  // Sort institutes alphabetically for the dropdown
  const sortedInstitutes = useMemo(() =>
    [...institutes].sort((a,b) => a.name.localeCompare(b.name)), [institutes]);

  const currentFY = getCurrentFY();

  return (
    <div className="fade-in" style={{display:'flex', flexDirection:'column', gap:20}}>

      {/* ── Header ── */}
      <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:16, flexWrap:'wrap'}}>
        <div>
          <div style={{fontSize:22, fontWeight:600, color:'var(--text)', letterSpacing:-0.3}}>Shortlisting</div>
          <div style={{fontSize:13, color:'var(--text3)', marginTop:3}}>
            Track firms shortlisted for standing lists across organizations
          </div>
        </div>
        {canEdit && (
          <Btn className="btn btn-primary" onClick={() => setModal({ type:'add' })}>
            <span className="material-icons-round" style={{fontSize:16}}>add</span>
            Add Entry
          </Btn>
        )}
      </div>

      {/* ── Controls bar ── */}
      <div style={{
        background:'var(--surface)', borderRadius:16, padding:'14px 18px',
        boxShadow:'var(--shadow)', display:'flex', alignItems:'center', gap:12, flexWrap:'wrap',
      }}>
        {/* Search */}
        <div className="search-wrap" style={{flex:1, minWidth:180}}>
          <span className="material-icons-round search-icon" style={{fontSize:18}}>search</span>
          <input
            placeholder="Search firm, organization, list name…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{paddingLeft:36}}
          />
        </div>

        {/* Filter: Org */}
        <select value={filterOrg} onChange={e => setFilterOrg(e.target.value)} style={{minWidth:160}}>
          <option value="">All organizations</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.shortName || c.short_name || c.fullName || c.full_name}</option>)}
        </select>

        {/* Filter: Firm */}
        <select value={filterFirm} onChange={e => setFilterFirm(e.target.value)} style={{minWidth:160}}>
          <option value="">All firms</option>
          {sortedInstitutes.map(i => <option key={i.id} value={i.id}>{i.acronym ? `[${i.acronym}] ` : ''}{i.name}</option>)}
        </select>

        {/* Filter: FY */}
        <select value={filterFY} onChange={e => setFilterFY(e.target.value)} style={{minWidth:120}}>
          <option value="">All FYs</option>
          {FYS.map(fy => <option key={fy} value={fy}>{fy}</option>)}
        </select>

        {/* Filter: Status */}
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{minWidth:120}}>
          <option value="">All statuses</option>
          <option value="Active">Active</option>
          <option value="Expired">Expired</option>
          <option value="Pending">Pending</option>
        </select>

        <div style={{height:28, width:1, background:'var(--border)', flexShrink:0}}/>

        {/* Group by toggle */}
        <div style={{display:'flex', background:'var(--bg)', borderRadius:100, padding:3, gap:2, flexShrink:0}}>
          {[['fy','By FY'],['org','By Organization'],['firm','By Firm']].map(([v,lbl]) => (
            <button key={v} onClick={() => setGroupBy(v)} style={{
              padding:'5px 14px', borderRadius:100, border:'none', cursor:'pointer',
              fontFamily:'inherit', fontSize:12.5, fontWeight:500, transition:'all .15s',
              background: groupBy===v ? 'var(--surface)' : 'transparent',
              color: groupBy===v ? 'var(--primary)' : 'var(--text3)',
              boxShadow: groupBy===v ? 'var(--shadow)' : 'none',
            }}>{lbl}</button>
          ))}
        </div>

        <div style={{fontSize:12, color:'var(--text3)', whiteSpace:'nowrap', flexShrink:0}}>
          {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
        </div>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div style={{textAlign:'center', padding:60, color:'var(--text3)'}}>
          <span className="spin material-icons-round" style={{fontSize:28}}>sync</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><span className="material-icons-round" style={{fontSize:44, opacity:.3}}>playlist_add_check</span></div>
          <div className="empty-state-title">No shortlist entries yet</div>
          <div className="empty-state-sub">{canEdit ? 'Click "Add Entry" to record a shortlisting.' : 'No records found.'}</div>
        </div>
      ) : (
        <div style={{display:'flex', flexDirection:'column', gap:10}}>
          {grouped.map(([key, group]) => {
            const isOpen = expanded[key] !== false; // default open
            // For org grouping, extract client_id / client_name_manual from first row
            const firstRow = group.rows[0];
            const orgClientId   = groupBy === 'org' ? (firstRow?.client_id || null) : null;
            const orgClientManual = groupBy === 'org' && !orgClientId ? (firstRow?.client_name_manual || null) : null;
            const showContracts = groupBy === 'org' && (orgClientId || orgClientManual);
            return (
              <div key={key} style={{background:'var(--surface)', borderRadius:16, boxShadow:'var(--shadow)', overflow:'hidden'}}>
                <GroupHeader
                  label={group.label}
                  sub={group.sub || null}
                  count={group.rows.length}
                  expanded={isOpen}
                  onToggle={() => toggle(key)}
                  isCurrent={groupBy === 'fy' && currentFY && key === currentFY}
                />
                {isOpen && (
                  <>
                    <TableHead groupBy={groupBy} />
                    {group.rows.map((row, i) => (
                      <ShortlistRow
                        key={row.id} row={row} idx={i}
                        canEdit={canEdit} isAdmin={isAdmin}
                        showFY={groupBy !== 'fy'}
                        onEdit={(r) => setModal({ type:'edit', data:r })}
                        onDelete={(r) => setModal({ type:'delete', data:r })}
                        onBillSave={handleBillSave}
                        saving={saving}
                        token={token}
                      />
                    ))}
                    {showContracts && (
                      <ContractsPanel
                        clientId={orgClientId}
                        clientNameManual={orgClientManual}
                        groupRows={group.rows}
                        canEdit={canEdit}
                        isAdmin={isAdmin}
                        token={token}
                      />
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modals ── */}
      {(modal?.type === 'add' || modal?.type === 'edit') && (
        <ShortlistForm
          initial={modal.data}
          institutes={sortedInstitutes}
          clients={clients}
          onSave={handleSave}
          onClose={() => setModal(null)}
          saving={saving}
          token={token}
        />
      )}
      {modal?.type === 'delete' && (
        <ConfirmModal
          message={`Delete this shortlist entry for "${modal.data.institute_name}"? This cannot be undone.`}
          onConfirm={handleDelete}
          onClose={() => setModal(null)}
          saving={saving}
        />
      )}
    </div>
  );
}

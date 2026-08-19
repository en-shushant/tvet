/**
 * Nepal Electricity Authority standing-list letters.
 *
 * Lifted out of Shortlisting.jsx, which was 3,127 lines. This is ~765 of them
 * and none of it is React: Bikram Sambat date formatting, the Devanagari letter
 * templates, the HTML the letter is rendered from, and the PDF assembly that
 * merges it with the firm's attachments.
 *
 * Kept as one module because the pieces are only meaningful together — the
 * templates exist to be fed to buildNeaLetterHtml, which exists to be fed to
 * openShortlistLetter.
 */
import { adToBS, BS_MONTHS, toNpNum } from '../constants/nepali.js';
import { loadKalimatiCss } from './kalimatiFont.js';
import { fmtDate } from './format.js';

function adDateToBS(adStr) {
  if (!adStr) return '';
  const [y, m, d] = adStr.slice(0, 10).split('-').map(Number);
  const bs = adToBS(new Date(Date.UTC(y, m - 1, d)));
  return `${toNpNum(bs.y)}-${toNpNum(bs.m).padStart ? toNpNum(String(bs.m).padStart(2,'0')) : toNpNum(bs.m)}-${toNpNum(String(bs.d).padStart(2,'0'))}`;
}

export function bsDateLabel(adStr) {
  if (!adStr) return '';
  const [y, m, d] = adStr.slice(0, 10).split('-').map(Number);
  const bs = adToBS(new Date(Date.UTC(y, m - 1, d)));
  return `${toNpNum(bs.d)} ${BS_MONTHS[bs.m - 1]} ${toNpNum(bs.y)}`;
}

// ── Letter generator — opens print-ready A4 in new window ─────────────────────
// Scan letterhead image for header/footer boundaries
async function detectLetterheadMargins(dataUrl) {
  if (!dataUrl) return { top: null, bottom: null };
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        // Cap canvas to 794×1123 — high-res scans (300dpi+) can exceed the
        // browser's MAX_TEXTURE_SIZE, causing drawImage to silently fail and
        // getImageData to return empty data (all zeros), breaking detection.
        const MAX_W = 794, MAX_H = 1123;
        const scale = Math.min(1, MAX_W / img.naturalWidth, MAX_H / img.naturalHeight);
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.naturalWidth  * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
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

        // Footer: TOP edge of the footer artwork — scan downward from 60%.
        // Scanning up from the last row matches the footer band's own bottom
        // edge (it runs to the page edge), reserving almost no margin, so body
        // content ends up printed on top of the footer.
        let bottomMm = null;
        for (let y = Math.floor(h * 0.6); y < h; y++) {
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

// A4 at 96dpi. Declared at the top of the function scope: the letter body, the
// attachment pages and the html2canvas capture all size off these, and `const`
// does not hoist — referencing them before this line throws a ReferenceError
// and silently kills letter generation.
const A4_W = 794, A4_H = 1123;

const NEA_TEMPLATES = {
  nea_ssemd: {
    sectionHeader: '(ख) परामर्श सेवा :',
    bullets: [
      'समूह (१) : वातावरणीय अध्ययन तर्फ : वातावरणीय अध्ययन कार्यको लागि आवश्यक कार्यसूची (ToR) तथा क्षेत्र निर्धारण (Scoping) सम्बन्धी कार्य, संक्षिप्त वातावरणीय अध्ययन (BES), प्रारम्भिक वातावरणीय परीक्षण (IEE) तथा वातावरणीय प्रभाव मूल्याङ्कन (EIA) वन्यजन्तु, चराचुरुङ्गी एवं जैविक विविधता सम्बन्धि विषयगत अध्ययन कार्य ।',
      'समूह (२) : वातावरणीय तथा सामाजिक अनुगमन सम्बन्धि कार्य : सामाजिक तथा वातावरणीय पक्षको अनुगमन कार्य, वातावरणीय व्यवस्थापन योजना (EMP) सम्बन्धि कार्य, पुर्नवास तथा पुर्नस्थापना कार्य योजना (RRAP) सम्बन्धी कार्य एवं आयोजनाको बाह्य (तेस्रो पक्ष) अनुगमन तथा मूल्यांकन सम्बन्धी कार्य ।',
      'समूह (३) : आयोजना स्थलमा संचालन हुने वातावरणीय तथा सामाजिक अनुगमन इकाई (ESMU) का लागि वातावरण, समाजिक, लैङ्गिक विज्ञ तथा अन्य जनशक्ति आपूर्ति सम्बन्धी सेवा । आयोजना स्थलमा सञ्चालन गर्नुपर्ने जनचेतनामूलक तथा अन्य कार्य: सामाजिक, वन संरक्षण तथा वन्यजन्तु संरक्षण सम्बन्धी सचेतनामूलक कार्यक्रम, आय आर्जन सम्बन्धी कार्यक्रम, लैङ्गिक समानता तथा सामाजिक समावेशीकरण सम्बन्धी कार्य ।',
      'समूह (४) : सिपमुलक तालिम : छोटो अवधिको ड्राइभिङ, हाउस वायरिङ, प्लम्बिङ्ग, वेल्डिङ्ग, मर्मत सम्भार, सिलाई, बुनाई, व्युटिपार्लर आदी सम्बन्धि कार्य ।',
      'समूह (५) : आयोजना स्थलमा सञ्चालन गर्नुपर्ने वातावरणीय सुचकाङ्क बमोजिमको Air, Noise, Water Quality मापन सम्बन्धी कार्य ।',
    ],
  },
  nea_essd: {
    sectionHeader: '१) परामर्श सेवा आपूर्ति तर्फ:',
    bullets: [
      'समूह-क:- वातावरणीय तथा सामाजिक अध्ययन कार्य: प्रारम्भिक वातावरणीय परीक्षणको कार्यसूची (ToR), प्रारम्भिक वातावरणीय परीक्षण कार्य (IEE) वातावरणीय प्रभाव मूल्यांकनको लागि क्षेत्र निर्धारण (Scoping) तथा कार्यसुची (ToR)\' तयार गर्ने कार्य, वातावरणीय प्रभाव मूल्यांकन कार्य (EIA), विषयगत अध्ययन कार्य (माछा, वन्यजन्तु, वन तथा वनस्पति, भौतिक वातावरण, सामाजिक, आर्थिक आदि) तथा दातृ संस्थाहरुको लागि गरिने सामाजिक प्रभाव मूल्याङ्कन (SIA), पुनर्वास कार्य योजना (RAP) उत्पीडित समुदाय विकास योजना (VCDP) तथा वातावरणीय व्यवस्थापन कार्य योजना (EMAP) आयोजनाको अध्ययन अनुगमनको लागि विज्ञहरुको सेवा खरिद आदि ।',
      'समूह ख :- आयोजना स्थलमा संचालन गर्नुपर्ने जनचेतना तथा अन्य कार्य: सामाजिक सचेतना कार्यक्रम, वन संरक्षण सचेतना कार्यहरु, वन्यजन्तु संरक्षण सचेतना कार्यक्रम, आय आर्जन सम्बन्धी आदि ।',
      'समूह ग: सीपमुलक तालिम: छोटो अवधिको ड्राइभिङ्ग, हाउस वायरिङ्ग, प्लम्बिङ्ग, वेल्डिङ्ग, सिलाई, बुनाई मर्मत संभार आदि ।',
      'समूह घ: आयोजना स्थलमा संचालन गर्नुपर्ने: Air, Noise, Water Quality मापन सम्बन्धी कार्य ।',
    ],
  },
};

function buildNeaLetterHtml({ letterType, dateBS, toTitle, toName, toName2, toAddr,
  fy, firmNameNp, firmContactNp, firmLetterhead, firmSign, firmStamp,
  topMm, bottomMm, lrMm, inclSign, inclStamp, inclLh = true, kalimatiCss = '' }) {
  const tpl = NEA_TEMPLATES[letterType] || NEA_TEMPLATES.nea_ssemd;
  const useLhBg = !!firmLetterhead && inclLh;
  const fyStr = fy || '';
  const body = `उपरोक्त सम्बन्धमा तहाँ विभागको सूचना अनुसार आ.व. ${fyStr} को लागि यस कम्पनीलाई तपसिल अनुसारको सेवा प्रदान गर्ने प्रयोजनका लागि मौजुदा सूचीमा सूचीकृत गरिदिनुहुन अनुरोध गर्दछु।`;

  return `<!DOCTYPE html><html lang="ne"><head><meta charset="UTF-8">
<style>
  ${kalimatiCss}
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#fff; font-family:'Kalimati','Noto Sans Devanagari','Arial Unicode MS',sans-serif; }
  .page {
    width:794px; height:1123px; position:relative; overflow:hidden;
    font-family:'Kalimati','Noto Sans Devanagari','Arial Unicode MS',sans-serif; font-size:13px;
    background-color:${useLhBg ? 'transparent' : '#fff'};
  }
  .page-inner { position:relative;z-index:1;padding:${topMm}mm ${lrMm}mm ${bottomMm}mm ${lrMm}mm; }
  .ref-row { display:flex;justify-content:flex-end;margin-bottom:10px;font-size:11pt; }
  .to-block { margin-bottom:12px;font-size:10.5pt;line-height:1.75; }
  .subject { text-align:center;font-size:11pt;font-weight:700;text-decoration:underline;text-underline-offset:3px;margin-bottom:10px; }
  .body-txt { margin-bottom:8px;font-size:10pt;text-align:justify;line-height:1.7; }
  .tapasil { font-weight:700;font-size:10.5pt;margin-bottom:6px; }
  .sec-hdr { font-weight:600;font-size:10pt;margin-bottom:6px; }
  .bullets { font-size:10pt;line-height:1.7;padding-left:0;list-style:none; }
  .bullets li { display:flex;gap:8px;margin-bottom:6px;text-align:justify; }
  .bullets li::before { content:"•";flex-shrink:0;margin-top:1px; }
  .sig-row { display:flex;justify-content:flex-end;gap:24px;align-items:flex-end;margin-top:72px; }
  .sig-stamp { text-align:center;min-width:70px; }
  .sig-block { text-align:center;min-width:130px; }
  .sig-line { border-top:1px solid #333;padding-top:4px;font-size:8pt; }
</style></head><body>
<div class="page"><div class="page-inner">

  <div class="ref-row"><span>मिति: ${dateBS}</span></div>

  <div class="to-block">
    <div>श्री ${toTitle || 'कार्यालय प्रमुख'} ज्यू,</div>
    ${toName  ? `<div>${toName}</div>` : ''}
    ${toName2 ? `<div>${toName2}</div>` : ''}
    ${toAddr  ? `<div>${toAddr}</div>` : ''}
  </div>

  <div class="subject">विषय: सूचीदर्ता गरिदिने बारे</div>
  <div class="body-txt">महोदय,</div>
  <div class="body-txt">${body}</div>
  <div class="tapasil">तपसिल:</div>
  <div class="sec-hdr">${tpl.sectionHeader}</div>
  <ul class="bullets">
    ${tpl.bullets.map(b => `<li>${b}</li>`).join('\n    ')}
  </ul>

  <div class="sig-row">
    <div class="sig-stamp">
      ${inclStamp && firmStamp
        ? `<img src="${firmStamp}" style="width:26mm;height:26mm;object-fit:contain;display:block;margin:0 auto;">`
        : ''}
    </div>
    <div class="sig-block">
      ${inclSign && firmSign
        ? `<img src="${firmSign}" style="display:block;margin:0 auto;max-height:14mm;max-width:100%;object-fit:contain;margin-bottom:4px;">`
        : ''}
      <div class="sig-line">${firmContactNp}<br>${firmNameNp}</div>
    </div>
  </div>

</div></div>
</body></html>`;
}

export async function openShortlistLetter(row, opts = {}) {
  const { includeSign = false, includeStamp = false, includeLh = true, docs = {}, serviceType: svcType } = opts;
  const lrPadding = row.institute_letter_lr_padding ?? 20;
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
  // Pre-fetch all images as data URLs so the popup never needs cross-origin requests.
  // Also load Kalimati font inline — Google Fonts <link> is unreliable inside srcdoc iframes.
  const [[firmLogo, firmLetterhead, firmSign, firmStamp], kalimatiCss] = await Promise.all([
    Promise.all([
      urlToDataUrl(row.institute_logo || null),
      urlToDataUrl(row.institute_letterhead || null),
      urlToDataUrl(row.institute_sign || null),
      urlToDataUrl(row.institute_stamp || null),
    ]),
    loadKalimatiCss(),
  ]);

  // Configured margins are a floor — auto-detection can raise them if the
  // letterhead's artwork extends further than the configured value. This matches
  // LetterBuilder's max(detected, configured) behaviour.
  const cfgTop    = row.institute_letter_top_margin     != null ? Number(row.institute_letter_top_margin)     : null;
  const cfgBottom = row.institute_letter_bottom_padding != null ? Number(row.institute_letter_bottom_padding) : null;
  let pageTopMargin     = cfgTop    ?? 15;
  let pageBottomPadding = cfgBottom ?? 15;
  if (firmLetterhead && includeLh) {
    const { top, bottom } = await detectLetterheadMargins(firmLetterhead);
    if (top    && top    > pageTopMargin)     pageTopMargin     = top;
    if (bottom && bottom > pageBottomPadding) pageBottomPadding = bottom;
  }
  const useLhBg = !!firmLetterhead && includeLh;
  const firmContact     = row.institute_contact || '';
  const firmNameNp      = row.institute_name_np || firmName;
  const firmAddressNp   = row.institute_address_np || firmAddress;
  const firmContactNp   = row.institute_contact_np || firmContact;
  const firmPhoneNp     = firmPhone ? toNpNum(firmPhone) : '';
  const firmMobileNp    = firmMobile ? toNpNum(firmMobile) : '';
  // To — procuring entity (client)
  // श्री block: the manually entered name/address win, then Nepali, then English
  const toName          = row.client_name_manual    || row.client_name_np    || row.client_name    || '';
  const toName2         = row.list_client_name2 || row.client_name2_manual || '';
  const toAddress       = row.client_address_manual || row.client_address_np || row.client_address || '';
  const toAddresseeTitle = row.list_addressee || row.addressee || row.client_signatory_position || '';
  // Shortlisting details
  const listName  = row.standing_list_name || 'Standing List';
  const fy        = row.fy || '';
  // A firm's own shortlist_date is a one-time snapshot taken when it was
  // assigned to the standing list; the list's own date (list_date) is what's
  // actually shown and edited on screen, so correcting it there needs to
  // still reach the letter. Only a legacy row with no standing list at all
  // falls back to its own shortlist_date.
  const effectiveDate = row.list_date || row.shortlist_date;
  const dateBS    = bsDateLabel(effectiveDate);
  const dateAD    = fmtDate(effectiveDate);
  const status    = row.status || 'Active';
  const remarks   = row.remarks || '';

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
  const parseDocFiles = (src) => {
    if (!src) return [];
    try { const p = JSON.parse(src); return Array.isArray(p) ? p : [src]; }
    catch { return [src]; }
  };

  // Attachments are assembled directly with pdf-lib after the letter page is
  // captured (see below) rather than rendered as HTML and screenshotted:
  // real institute documents are very often actual PDF files (server accepts
  // application/pdf — the client's accept="image/*" is only an upload-picker
  // hint, not an enforced restriction), and html2canvas has no way to
  // rasterise an <embed>/<object> at all, at any wait/timing. Merging real
  // PDF pages in also preserves vector text quality and multi-page documents,
  // neither of which screenshotting could ever have supported.
  const activeDocs = docDefs.filter(d => docs[d.key] && d.src);

  const fyNp = fy ? toNpNum(fy) : '';
  const serviceType = svcType || 'सीपमूलक तथा व्यावसायिक तालिम कार्यक्रमहरु सञ्चालन';

  let html = `<!DOCTYPE html>
<html lang="ne">
<head>
<meta charset="UTF-8">
<title>मौजुदा सूची — ${firmAcronym || firmName}</title>
<style>
  ${kalimatiCss}
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
    /* When a letterhead is used, the page itself is transparent — the
       letterhead is embedded directly in pdf-lib at native resolution so
       it never passes through html2canvas (which would upscale/blur it). */
    background-color: ${useLhBg ? 'transparent' : '#fff'};
    position: relative;
    padding: 0;
    overflow: hidden;
  }
  .page-inner {
    position: relative;
    z-index: 1;
    padding: ${pageTopMargin}mm ${lrPadding}mm ${pageBottomPadding}mm ${lrPadding}mm;
  }
  .lh-regpan { display:flex;justify-content:space-between;font-size:9pt;font-style:italic;color:#7b1a1a;margin-bottom:5px; }
  .lh-center { text-align:center; }
  .lh-logo   { max-height:75px;max-width:75px;object-fit:contain;margin-bottom:3px;mix-blend-mode:multiply; }
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
  ${useLhBg ? `<img src="${firmLetterhead}" alt="" style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;">` : ''}
  <div class="page-inner">

  <div class="ref-row">
    <span class="ref-bold"></span>
    <span>मिति: ${dateBS}</span>
  </div>

  <div class="to-block">
    <div>श्री ${toAddresseeTitle || 'कार्यालय प्रमुख'} ज्यू,</div>
    <div>${toName}</div>
    ${toName2 ? `<div>${toName2}</div>` : ''}
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
          <div>निवेदन दिएको मिति: ${dateBS}</div>
          ${fyNp ? `<div>आ.व.: ${fyNp}</div>` : ''}
        </div>
        <div style="flex:0 0 32%;border-right:1px solid #666;text-align:center;padding:6px 4px;">
          <div style="font-size:9pt;margin-bottom:3px;">फर्मको छाप:</div>
          ${includeStamp && firmStamp
            ? `<img src="${firmStamp}" style="display:block;margin:0 auto;width:30mm;height:30mm;object-fit:contain;background:#fff;">`
            : ''
          }
        </div>
        <div style="flex:1;padding:8px 10px;font-size:10pt;line-height:2;">
          <div>निवेदकको नाम: ${firmContactNp || '_______________'}</div>
          <div style="margin-top:4px;">हस्ताक्षर: ${includeSign && firmSign
            ? `<img src="${firmSign}" style="display:inline-block;vertical-align:middle;margin-left:4px;max-height:20mm;max-width:100%;width:auto;height:auto;object-fit:contain;">`
            : ''
          }</div>
        </div>
      </div>
    </td></tr>
  </table>

  </div></div>
</body>
</html>`;

  // Override HTML for NEA letter types — generate directly without Builder
  const effectiveLt = row.list_letter_type || row.letter_type || 'basic';
  if (effectiveLt !== 'basic') {
    html = buildNeaLetterHtml({
      letterType: effectiveLt,
      dateBS,
      toTitle: toAddresseeTitle,
      toName,
      toName2,
      toAddr: toAddress,
      fy,
      firmNameNp,
      firmContactNp,
      firmLetterhead,
      firmSign,
      firmStamp,
      topMm: pageTopMargin,
      bottomMm: pageBottomPadding,
      lrMm: lrPadding,
      inclSign: includeSign,
      inclStamp: includeStamp,
      inclLh: includeLh,
      kalimatiCss,
    });
  }

  // Render only the letter body into a hidden iframe — attachments are no
  // longer part of this HTML at all (see above).
  const iframe = document.createElement('iframe');
  iframe.style.cssText = `position:fixed;left:-9999px;top:0;width:${A4_W}px;height:${A4_H}px;border:none;visibility:hidden;`;
  document.body.appendChild(iframe);

  await new Promise(resolve => {
    iframe.onload = resolve;
    iframe.srcdoc = html;
  });

  const iframeDoc = iframe.contentDocument;

  // html2canvas uses the element's ownerDocument (the iframe) to resolve fonts.
  // Injecting @font-face via srcdoc CSS is unreliable for large data URIs.
  // Instead, explicitly construct a FontFace in the iframe's window context
  // and add it to iframeDoc.fonts — this is the most reliable path.
  if (kalimatiCss) {
    const dataUrlMatch = kalimatiCss.match(/url\('(data:[^']+)'\)/);
    if (dataUrlMatch) {
      try {
        const IframeFontFace = iframe.contentWindow.FontFace;
        const ff = new IframeFontFace('Kalimati', `url('${dataUrlMatch[1]}')`);
        await ff.load();
        iframeDoc.fonts.add(ff);
      } catch (e) {
        console.warn('[letter] Kalimati FontFace inject to iframe failed', e);
      }
    }
    // Also register in the main document as a fallback for some html2canvas builds.
    let kStyle = document.getElementById('__kalimati_font__');
    if (!kStyle) {
      kStyle = document.createElement('style');
      kStyle.id = '__kalimati_font__';
      document.head.appendChild(kStyle);
    }
    kStyle.textContent = kalimatiCss;
    await document.fonts.load('1em Kalimati').catch(() => {});
  }

  await Promise.all([
    ...[...iframeDoc.querySelectorAll('img')].map(img =>
      (img.decode ? img.decode() : Promise.resolve()).catch(() => {})
    ),
    iframeDoc.fonts?.ready ?? Promise.resolve(),
  ]);

  // If content overflows: first shrink the sig-row gap (saves ~1-2 lines without
  // distorting the rest of the layout), then fall back to whole-page scaling.
  const pageInnerEl = iframeDoc.querySelector('.page-inner');
  if (pageInnerEl) {
    const sigRowEl = iframeDoc.querySelector('.sig-row');
    if (sigRowEl && pageInnerEl.scrollHeight > A4_H - 10) {
      let margin = 72;
      while (pageInnerEl.scrollHeight > A4_H - 10 && margin > 8) {
        margin = Math.max(8, margin - 8);
        sigRowEl.style.marginTop = `${margin}px`;
      }
    }
    if (pageInnerEl.scrollHeight > A4_H - 10) {
      const scale = Math.max(0.5, (A4_H - 10) / pageInnerEl.scrollHeight);
      pageInnerEl.style.transformOrigin = 'top left';
      pageInnerEl.style.transform = `scale(${scale})`;
      pageInnerEl.style.width = `${Math.round(100 / scale)}%`;
    }
  }

  const { default: html2canvas } = await import('html2canvas');
  const { PDFDocument } = await import('pdf-lib');

  // When a letterhead is in use, capture with transparent background (PNG) so
  // pdf-lib can embed the letterhead at its native resolution underneath — no
  // upscaling through html2canvas, so it stays sharp. Without a letterhead,
  // JPEG with white background is smaller and sufficient.
  const letterCanvas = await html2canvas(iframeDoc.querySelector('.page'), {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: useLhBg ? null : '#ffffff',
    width: A4_W,
    height: A4_H,
    windowWidth: A4_W,
    windowHeight: A4_H,
  });
  const letterContentDataUrl = useLhBg
    ? letterCanvas.toDataURL('image/png')
    : letterCanvas.toDataURL('image/jpeg', 0.95);
  document.body.removeChild(iframe);

  // ── Assemble the final PDF with pdf-lib: letter page + real attachments ──
  const MM = 2.834645669; // points per mm
  const PAGE_W = 210 * MM, PAGE_H = 297 * MM; // exact A4 in points

  const dataUrlToBytes = (dataUrl) => {
    const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  };

  const sniff = (bytes) => {
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'pdf';
    if (bytes[0] === 0xFF && bytes[1] === 0xD8) return 'jpeg';
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return 'png';
    return 'unknown';
  };

  const fetchBytes = async (url) => {
    if (url.startsWith('data:')) return dataUrlToBytes(url);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`fetch failed: ${resp.status}`);
    return new Uint8Array(await resp.arrayBuffer());
  };

  const outDoc = await PDFDocument.create();

  // Letter page — letterhead (if any) is embedded at native resolution first,
  // then the captured letter content is layered on top as a transparent PNG.
  // This keeps the letterhead sharp regardless of html2canvas scale.
  // Reserve page slot first so the letter is always page 1, even though
  // the actual image drawing happens below after embedImageBytes is defined.
  const letterPage = outDoc.addPage([PAGE_W, PAGE_H]);

  const bytesToDataUrl = (bytes, mime) => {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return `data:${mime};base64,${btoa(bin)}`;
  };

  // pdf-lib's embedPng/embedJpg reject some otherwise-valid variants (16-bit
  // depth, interlacing, certain colour profiles, CMYK JPEGs). Re-encoding
  // through a plain <canvas> always yields a standard 8-bit RGBA PNG it
  // accepts, so a source image that fails direct embedding gets one retry
  // before being skipped — instead of silently vanishing with no way to tell
  // why (this is what previously made a stamp or signature disappear with no
  // visible cause, independent of any other toggle).
  const normalizeForPdfLib = (bytes, mime) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.getContext('2d').drawImage(img, 0, 0);
        resolve(c.toDataURL('image/png'));
      } catch (e) { reject(e); }
    };
    img.onerror = reject;
    img.src = bytesToDataUrl(bytes, mime);
  });

  const embedImageBytes = async (bytes, label) => {
    const kind = sniff(bytes);
    const mime = kind === 'png' ? 'image/png' : 'image/jpeg';
    try {
      return kind === 'png' ? await outDoc.embedPng(bytes) : await outDoc.embedJpg(bytes);
    } catch (e) {
      console.warn(`[letter] ${label}: direct embed failed, retrying via canvas re-encode`, e);
      try {
        return await outDoc.embedPng(dataUrlToBytes(await normalizeForPdfLib(bytes, mime)));
      } catch (e2) {
        console.warn(`[letter] ${label}: could not be embedded even after re-encode — omitting it`, e2);
        return null;
      }
    }
  };

  // Draw the letter content onto the reserved first page. Letterhead (if any)
  // is embedded at native resolution first; the transparent PNG from html2canvas
  // is layered on top so the letterhead stays sharp without going through html2canvas.
  if (useLhBg) {
    // firmLetterhead was already fetched by urlToDataUrl; if it couldn't be
    // converted to a data URL (CORS / network failure) it will still be a plain
    // https:// string — fetchBytes would fail again with "Load failed". Only
    // embed the letterhead if it was successfully loaded as a data URL.
    if (firmLetterhead.startsWith('data:')) {
      const lhBytes = dataUrlToBytes(firmLetterhead);
      const lhImg = await embedImageBytes(lhBytes, 'letterhead');
      if (lhImg) letterPage.drawImage(lhImg, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });
    }
    const contentPng = await outDoc.embedPng(dataUrlToBytes(letterContentDataUrl));
    letterPage.drawImage(contentPng, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });
  } else {
    const letterJpg = await outDoc.embedJpg(dataUrlToBytes(letterContentDataUrl));
    letterPage.drawImage(letterJpg, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });
  }

  // Sign/stamp overlay, embedded once and drawn on every attachment page —
  // matches the overlay that used to be baked into each doc page's HTML.
  // These are independent: turning signature off never affects the stamp.
  let stampImg = null, signImg = null;
  if (includeStamp && firmStamp) stampImg = await embedImageBytes(dataUrlToBytes(firmStamp), 'stamp');
  if (includeSign  && firmSign)  signImg  = await embedImageBytes(dataUrlToBytes(firmSign),  'signature');
  // These pages are real, already-printed certificates — the overlay only
  // needs to read as a small corner stamp, not compete with the page's own
  // content. Previous sizes (stamp 38mm, sign 32mm/18mm) were tuned against a
  // blank page and were far too dominant once real document content was
  // actually visible underneath.
  const STAMP_H_MM = 20;
  const SIGN_H_MM  = 14;
  const drawOverlay = (page) => {
    if (!stampImg && !signImg) return;
    const stampW = stampImg ? STAMP_H_MM * MM : 0;
    const signW  = signImg ? (SIGN_H_MM * MM) * (signImg.width / signImg.height) : 0;
    const gap = stampImg && signImg ? 3 * MM : 0;
    let x = PAGE_W - 10 * MM - stampW - gap - signW;
    const y = 10 * MM;
    if (stampImg) { page.drawImage(stampImg, { x, y, width: stampW, height: STAMP_H_MM * MM }); x += stampW + gap; }
    if (signImg)  { page.drawImage(signImg,  { x, y, width: signW,  height: SIGN_H_MM * MM }); }
  };

  // Attachments — merged as real pages, not screenshotted. A PDF source keeps
  // every page (not just the first) and stays vector/text-sharp; an image
  // source is embedded directly, full-bleed, onto its own A4 page.
  const letterPageCount = outDoc.getPageCount();
  let mergedCount = 0;
  const skippedLabels = [];
  for (const d of activeDocs) {
    const files = parseDocFiles(d.src);
    let docMerged = 0;
    for (const src of files) {
      let bytes;
      try { bytes = await fetchBytes(src); }
      catch (e) {
        console.warn(`[letter] ${d.label}: could not fetch attachment, skipping`, src, e);
        continue;
      }

      const kind = sniff(bytes);
      if (kind === 'pdf') {
        try {
          const srcDoc = await PDFDocument.load(bytes, { ignoreEncryption: true, throwOnInvalidObject: false });
          bytes = null;
          // Round-trip validate: copy pages into a temp doc and try saving.
          // PDFs with Nepali/Unicode metadata store bytes >0x7F in PDFString
          // objects which pdf-lib can't serialize. If the temp save throws, we
          // skip this attachment rather than poisoning outDoc.save() later.
          const validateDoc = await PDFDocument.create();
          const validatePages = await validateDoc.copyPages(srcDoc, srcDoc.getPageIndices());
          validatePages.forEach(p => validateDoc.addPage(p));
          const cleanBytes = await validateDoc.save();
          const cleanDoc = await PDFDocument.load(cleanBytes);
          const copied = await outDoc.copyPages(cleanDoc, cleanDoc.getPageIndices());
          copied.forEach(p => { outDoc.addPage(p); drawOverlay(p); });
          docMerged += copied.length;
        } catch (e) {
          console.warn(`[letter] ${d.label}: PDF skipped (contains characters pdf-lib cannot serialize)`, src, e);
        }
      } else if (kind === 'jpeg' || kind === 'png') {
        const embedded = await embedImageBytes(bytes, d.label || 'attachment');
        bytes = null;
        if (embedded) {
          const page = outDoc.addPage([PAGE_W, PAGE_H]);
          page.drawImage(embedded, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });
          drawOverlay(page);
          docMerged++;
        } else {
          console.warn(`[letter] ${d.label}: image could not be embedded`, src);
        }
      } else {
        console.warn(`[letter] ${d.label}: unrecognised file format (first bytes: ${[...bytes.slice(0,4)]}), skipping`, src);
        bytes = null;
      }
    }
    mergedCount += docMerged;
    if (docMerged === 0 && files.length > 0) skippedLabels.push(d.label);
  }

  let outBytes;
  try {
    outBytes = await outDoc.save();
  } catch (e) {
    // Last-resort fallback: rebuild with only the letter pages (no attachments).
    console.warn('[letter] outDoc.save() failed — rebuilding letter-only PDF', e);
    const fallbackDoc = await PDFDocument.create();
    const letterPages = await fallbackDoc.copyPages(outDoc, outDoc.getPageIndices().slice(0, letterPageCount));
    letterPages.forEach(p => fallbackDoc.addPage(p));
    outBytes = await fallbackDoc.save();
    skippedLabels.push('(attachments — serialization error)');
  }
  const blob = new Blob([outBytes], { type: 'application/pdf' });
  return { url: URL.createObjectURL(blob), skipped: skippedLabels };
}

import { useState, useEffect, useRef, useCallback } from 'react';
import { Btn } from '../md.jsx';
import { toNpNum, BS_DATA } from '../constants/nepali.js';
import { api } from '../utils/api.js';

// ─── helpers ──────────────────────────────────────────────────────────────────
function todayBS() {
  const d = new Date();
  let bsYear = 2000, rem = 0;
  let adRef = new Date(1943, 3, 14);
  for (let yr = 2000; yr <= 2090; yr++) {
    const months = BS_DATA[yr] || [];
    const total = months.reduce((s, v) => s + v, 0);
    const next = new Date(adRef.getTime() + total * 86400000);
    if (next > d) { bsYear = yr; rem = Math.floor((d - adRef) / 86400000); break; }
    adRef = next;
  }
  const months = BS_DATA[bsYear] || [];
  let bsMonth = 1, bsDay = rem + 1;
  for (let i = 0; i < months.length; i++) {
    if (bsDay <= months[i]) { bsMonth = i + 1; break; }
    bsDay -= months[i];
  }
  return `${toNpNum(bsYear)}/${toNpNum(String(bsMonth).padStart(2,'0'))}/${toNpNum(String(bsDay).padStart(2,'0'))}`;
}

async function urlToDataUrl(url) {
  if (!url) return null;
  if (url.startsWith('data:')) return url;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return url;
    const blob = await resp.blob();
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(url);
      reader.readAsDataURL(blob);
    });
  } catch { return url; }
}

async function detectLetterheadMargins(dataUrl) {
  if (!dataUrl) return { top: null, bottom: null };
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const w = canvas.width, h = canvas.height;
        const step = Math.max(1, Math.floor(w / 30));
        const rowDark = y => {
          let n = 0;
          for (let x = 0; x < w; x += step) {
            const d = ctx.getImageData(x, y, 1, 1).data;
            if (d[3] > 50 && (d[0] < 220 || d[1] < 220 || d[2] < 220)) n++;
          }
          return n;
        };
        let top = null;
        for (let y = Math.floor(h * 0.6); y >= 0; y--)
          if (rowDark(y) >= 3) { top = Math.ceil((y / h) * 297) + 8; break; }
        // Scan DOWNWARD to find the top edge of the footer artwork. Scanning up
        // from the last row matches the footer band's own bottom edge (it runs
        // to the page edge) and reserves almost no margin, so body content ends
        // up printed on top of the footer.
        let bottom = null;
        for (let y = Math.floor(h * 0.6); y < h; y++)
          if (rowDark(y) >= 3) { bottom = Math.ceil(((h - y) / h) * 297) + 8; break; }
        resolve({ top, bottom });
      } catch { resolve({ top: null, bottom: null }); }
    };
    img.onerror = () => resolve({ top: null, bottom: null });
    img.src = dataUrl;
  });
}

// ─── Shared NEA letter builder ────────────────────────────────────────────────
function buildNeaHtml({ fields, imgs, topMm, bottomMm, lrMm, inclSign, inclStamp, todayBSStr }) {
  const { firmLetterhead, firmSign, firmStamp, firmName } = imgs;
  const useLhBg = !!firmLetterhead;
  const date    = fields.date    || todayBSStr;
  const toTitle = fields.toTitle || 'कार्यालय प्रमुख';
  const toName  = fields.toName  || '';
  const toName2 = fields.toName2 || '';
  const toAddr  = fields.toAddress || '';
  const fy      = fields.fy || '';
  const body    = (fields.body || '').replace(/\{fy\}/g, fy);
  const bullets = (fields.bullets || '').split('\n').filter(Boolean);
  const sectionHeader = fields.sectionHeader || '';
  const sigName = fields.signatoryName || imgs.firmContactNp || '';
  const firmNp  = fields.firmNameNp || imgs.firmNameNp || firmName || '';

  return `<!DOCTYPE html><html lang="ne"><head><meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#fff; }
  .page {
    width:794px; height:1123px; position:relative; overflow:hidden;
    font-family:'Kalimati','Noto Sans Devanagari','Arial Unicode MS',sans-serif; font-size:13px;
    background-color:#fff;
    ${useLhBg ? `background-image:url("${firmLetterhead}");background-repeat:no-repeat;background-position:0 0;background-size:794px 1123px;` : ''}
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
  .sig-row { display:flex;justify-content:flex-end;gap:24px;align-items:flex-end;margin-top:32px; }
  .sig-stamp { text-align:center;min-width:70px; }
  .sig-block { text-align:center;min-width:130px; }
  .sig-line { border-top:1px solid #333;padding-top:4px;font-size:8pt; }
</style></head><body>
<div class="page"><div class="page-inner">

  <div class="ref-row"><span>मिति: ${date}</span></div>

  <div class="to-block">
    <div>श्री ${toTitle} ज्यू,</div>
    ${toName  ? `<div>${toName}</div>` : ''}
    ${toName2 ? `<div>${toName2}</div>` : ''}
    ${toAddr  ? `<div>${toAddr}</div>` : ''}
  </div>

  <div class="subject">विषय: ${fields.subject || ''}</div>
  <div class="body-txt">महोदय,</div>
  <div class="body-txt">${body}</div>
  <div class="tapasil">तपसिल:</div>
  ${sectionHeader ? `<div class="sec-hdr">${sectionHeader}</div>` : ''}
  <ul class="bullets">
    ${bullets.map(b => `<li>${b}</li>`).join('\n    ')}
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
      <div class="sig-line">…………………<br>${sigName}<br>${firmNp}</div>
    </div>
  </div>

</div></div>
</body></html>`;
}

// ─── Letter template: मौजुदा सूची दर्ता पत्र ───────────────────────────────────
// `date` is filled at runtime; firm/client fields are patched from the row.
const TEMPLATE = {
  fields: {
    date:          { label: 'मिति (BS Date)', value: '' },
    ref:           { label: 'संख्या / Ref. No.', value: '' },
    lrPadding:     { label: 'Left / Right Margin (mm)', value: '20' },
    toName:        { label: 'To: Name (प्रापक नाम)', value: '' },
    toAddress:     { label: 'To: Address (ठेगाना)', value: '' },
    toTitle:       { label: 'To Title (पद)', value: 'कार्यालय प्रमुख' },
    subject:       { label: 'Subject (विषय)', value: 'मौजुदा सूचीमा दर्ता गरी पाऊँ।', multiline: true },
    body:          { label: 'Body Paragraph', multiline: true,
      value: 'सार्वजनिक खरिद नियमावली, २०६४ को नियम १८ को उपनियम (१) बमोजिम तपशिलमा उल्लेखित विवरण अनुसारको पृष्ठाई गर्ने कागजात संलग्न गरी मौजुदा सूचीमा दर्ता हुन यो निवेदन पेश गरेको छु।' },
    tapasil:       { label: 'तपशिल Label', value: 'तपशिल:' },
    serviceType:   { label: 'Service Type (सेवा प्रकार)', value: 'सीपमूलक तथा व्यावसायिक तालिम कार्यक्रमहरु सञ्चालन', multiline: true },
    firmNameNp:    { label: 'Firm Name (Nepali)', value: '' },
    firmAcronym:   { label: 'Firm Acronym', value: '' },
    firmAddressNp: { label: 'Firm Address (Nepali)', value: '' },
    firmContact:   { label: 'Contact Person (Nepali)', value: '' },
    firmPhone:     { label: 'Phone / टेलिफोन', value: '' },
    mobileNo:      { label: 'Mobile No. (मोबाईल)', value: '' },
    fy:            { label: 'आ.व. (Fiscal Year)', value: '' },
    applicantName: { label: 'Applicant Name (निवेदकको नाम)', value: '' },
    // Table section headers
    sec1Header:    { label: 'Section १ Header', multiline: true,
      value: 'मौजुदा सूचीको लागि निवेदन दिने व्यक्ति, संस्था, आपूर्तिकर्ता, निर्माण व्यवसायी, परामर्शदाता वा सेवा प्रदायकको विवरण:' },
    sec2Header:    { label: 'Section २ Header', multiline: true,
      value: 'मौजुदा सूचीमा दर्ता हुनको लागि निम्न बमोजिमको प्रमाणपत्र संलग्न गर्नुहोला।' },
    sec2Items:     { label: 'Section २ Checklist (one per line)', multiline: true,
      value: '(क) संस्था वा फर्म दर्ताको प्रमाणपत्र  छ ☑  छैन □\n(ख) नविकरण गरिएको  छ ☑  छैन □\n(ग) मूल्य अभिवृद्धि कर वा स्थायी लेखा नम्बर दर्ताको प्रमाणपत्र  छ ☑  छैन □\n(घ) कर चुक्ताको प्रमाणपत्र  छ ☑  छैन □\n(ड) कुन खरिदको लागि मौजुदार सूचीमा दर्ता हुन निवेदन दिने हो, सो कामको लागि इजाजत पत्र आवश्यक पत्ने भएमा सो को प्रतिलिपि  छ ☑  छैन □' },
    sec3Header:    { label: 'Section ३ Header', multiline: true,
      value: 'सार्वजनिक निकायबाट हुने खरिदको लागि दर्ता हुन चाहेको खरिदको प्रकृतिको विवरण:' },
    // Section 3 sub-labels and values
    supplyLabel:       { label: '(क) Supply Label', value: '(क) मालसामान आपूर्ति:' },
    supplyValue:       { label: '(क) Supply Value', value: '', multiline: true },
    constructionLabel: { label: '(ख) Construction Label', value: '(ख) निर्माण कार्य' },
    constructionValue: { label: '(ख) Construction Value', value: '', multiline: true },
    consultingLabel:   { label: '(ग) Consulting Label', value: '(ग) परामर्श सेवा:' },
    otherServiceLabel: { label: '(घ) Other Service Label', value: '(घ) अन्य सेवा:' },
    otherServiceValue: { label: '(घ) Other Service Value', value: '', multiline: true },
    // Bottom row labels
    dateLabel:      { label: 'Date Label (bottom)', value: 'निवेदन दिएको मिति:' },
    fyLabel:        { label: 'FY Label (bottom)', value: 'आ.व.:' },
    stampLabel:     { label: 'Stamp Label', value: 'फर्मको छाप:' },
    applicantLabel: { label: 'Applicant Label', value: 'निवेदकको नाम:' },
    signLabel:      { label: 'Signature Label', value: 'हस्ताक्षर:' },
  },
};

// Order the fields appear in the editor panel
const FIELD_ORDER = [
  'date','ref','lrPadding','toTitle','toName','toAddress','subject','body','tapasil',
  'firmNameNp','firmAcronym','firmAddressNp','firmContact','firmPhone','mobileNo','fy','applicantName',
  'sec1Header','sec2Header','sec2Items','sec3Header',
  'supplyLabel','supplyValue','constructionLabel','constructionValue',
  'consultingLabel','serviceType','otherServiceLabel','otherServiceValue',
  'dateLabel','fyLabel','stampLabel','applicantLabel','signLabel',
];

// ─── NEA letter template fields (shared base) ─────────────────────────────────
const NEA_FIELDS_BASE = {
  date:          { label: 'मिति (BS Date)', value: '' },
  lrPadding:     { label: 'Left / Right Margin (mm)', value: '20' },
  toTitle:       { label: 'Addressee Title (पद)', value: 'कार्यालय प्रमुख' },
  toName:        { label: 'Organization Name', value: '' },
  toName2:       { label: 'Department / Level 2 (optional)', value: '' },
  toAddress:     { label: 'Address', value: '' },
  subject:       { label: 'Subject (विषय)', value: 'सूचीदर्ता गरिदिने बारे' },
  body:          { label: 'Body Paragraph', multiline: true,
    value: 'उपरोक्त सम्बन्धमा तहाँ विभागको सूचना अनुसार आ.व. {fy} को लागि यस कम्पनीलाई तपसिल अनुसारको सेवा प्रदान गर्ने प्रयोजनका लागि मौजुदा सूचीमा सूचीकृत गरिदिनुहुन अनुरोध गर्दछु।' },
  fy:            { label: 'आ.व. (Fiscal Year)', value: '' },
  sectionHeader: { label: 'Section Header', value: '' },
  bullets:       { label: 'Bullet Points (one per line)', multiline: true, value: '' },
  signatoryName: { label: 'Signatory Name', value: '' },
  firmNameNp:    { label: 'Firm Name (Nepali)', value: '' },
};
const NEA_FIELD_ORDER = ['date','lrPadding','toTitle','toName','toName2','toAddress','subject','body','fy','sectionHeader','bullets','signatoryName','firmNameNp'];

// ─── All templates ─────────────────────────────────────────────────────────────
const TEMPLATES = {
  basic: {
    name: 'Basic Shortlisting',
    fields: TEMPLATE.fields,
    fieldOrder: FIELD_ORDER,
    buildHtml: buildLetterHtml,
  },
  nea_ssemd: {
    name: 'NEA SSEMD',
    fields: {
      ...NEA_FIELDS_BASE,
      sectionHeader: { label: 'Section Header', value: '(ख) परामर्श सेवा :' },
      bullets: { label: 'Bullet Points (one per line)', multiline: true, value:
        'समूह (१) : वातावरणीय अध्ययन तर्फ : वातावरणीय अध्ययन कार्यको लागि आवश्यक कार्यसूची (ToR) तथा क्षेत्र निर्धारण (Scoping) सम्बन्धी कार्य, संक्षिप्त वातावरणीय अध्ययन (BES), प्रारम्भिक वातावरणीय परीक्षण (IEE) तथा वातावरणीय प्रभाव मूल्याङ्कन (EIA) वन्यजन्तु, चराचुरुङ्गी एवं जैविक विविधता सम्बन्धि विषयगत अध्ययन कार्य ।\n' +
        'समूह (२) : वातावरणीय तथा सामाजिक अनुगमन सम्बन्धि कार्य : सामाजिक तथा वातावरणीय पक्षको अनुगमन कार्य, वातावरणीय व्यवस्थापन योजना (EMP) सम्बन्धि कार्य, पुर्नवास तथा पुर्नस्थापना कार्य योजना (RRAP) सम्बन्धी कार्य एवं आयोजनाको बाह्य (तेस्रो पक्ष) अनुगमन तथा मूल्यांकन सम्बन्धी कार्य ।\n' +
        'समूह (३) : आयोजना स्थलमा संचालन हुने वातावरणीय तथा सामाजिक अनुगमन इकाई (ESMU) का लागि वातावरण, समाजिक, लैङ्गिक विज्ञ तथा अन्य जनशक्ति आपूर्ति सम्बन्धी सेवा । आयोजना स्थलमा सञ्चालन गर्नुपर्ने जनचेतनामूलक तथा अन्य कार्य: सामाजिक, वन संरक्षण तथा वन्यजन्तु संरक्षण सम्बन्धी सचेतनामूलक कार्यक्रम, आय आर्जन सम्बन्धी कार्यक्रम, लैङ्गिक समानता तथा सामाजिक समावेशीकरण सम्बन्धी कार्य ।\n' +
        'समूह (४) : सिपमुलक तालिम : छोटो अवधिको ड्राइभिङ, हाउस वायरिङ, प्लम्बिङ्ग, वेल्डिङ्ग, मर्मत सम्भार, सिलाई, बुनाई, व्युटिपार्लर आदी सम्बन्धि कार्य ।\n' +
        'समूह (५) : आयोजना स्थलमा सञ्चालन गर्नुपर्ने वातावरणीय सुचकाङ्क बमोजिमको Air, Noise, Water Quality मापन सम्बन्धी कार्य ।' },
    },
    fieldOrder: NEA_FIELD_ORDER,
    buildHtml: buildNeaHtml,
  },
  nea_essd: {
    name: 'NEA ESSD',
    fields: {
      ...NEA_FIELDS_BASE,
      sectionHeader: { label: 'Section Header', value: '१) परामर्श सेवा आपूर्ति तर्फ:' },
      bullets: { label: 'Bullet Points (one per line)', multiline: true, value:
        'समूह-क:- वातावरणीय तथा सामाजिक अध्ययन कार्य: प्रारम्भिक वातावरणीय परीक्षणको कार्यसूची (ToR), प्रारम्भिक वातावरणीय परीक्षण कार्य (IEE) वातावरणीय प्रभाव मूल्यांकनको लागि क्षेत्र निर्धारण (Scoping) तथा कार्यसुची (ToR)\' तयार गर्ने कार्य, वातावरणीय प्रभाव मूल्यांकन कार्य (EIA), विषयगत अध्ययन कार्य (माछा, वन्यजन्तु, वन तथा वनस्पति, भौतिक वातावरण, सामाजिक, आर्थिक आदि) तथा दातृ संस्थाहरुको लागि गरिने सामाजिक प्रभाव मूल्याङ्कन (SIA), पुनर्वास कार्य योजना (RAP) उत्पीडित समुदाय विकास योजना (VCDP) तथा वातावरणीय व्यवस्थापन कार्य योजना (EMAP) आयोजनाको अध्ययन अनुगमनको लागि विज्ञहरुको सेवा खरिद आदि ।\n' +
        'समूह ख :- आयोजना स्थलमा संचालन गर्नुपर्ने जनचेतना तथा अन्य कार्य: सामाजिक सचेतना कार्यक्रम, वन संरक्षण सचेतना कार्यहरु, वन्यजन्तु संरक्षण सचेतना कार्यक्रम, आय आर्जन सम्बन्धी आदि ।\n' +
        'समूह ग: सीपमुलक तालिम: छोटो अवधिको ड्राइभिङ्ग, हाउस वायरिङ्ग, प्लम्बिङ्ग, वेल्डिङ्ग, सिलाई, बुनाई मर्मत संभार आदि ।\n' +
        'समूह घ: आयोजना स्थलमा संचालन गर्नुपर्ने: Air, Noise, Water Quality मापन सम्बन्धी कार्य ।' },
    },
    fieldOrder: NEA_FIELD_ORDER,
    buildHtml: buildNeaHtml,
  },
};

// ─── HTML builder ─────────────────────────────────────────────────────────────
function buildLetterHtml({ fields, row, imgs, topMm, bottomMm, lrMm, inclSign, inclStamp, todayBSStr }) {
  const { firmLogo, firmLetterhead, firmSign, firmStamp,
          firmRegNo, firmPan, firmMeta, firmName } = imgs;
  const useLhBg = !!firmLetterhead;

  const date          = fields.date          || todayBSStr;
  const ref           = fields.ref           || '';
  const toName        = fields.toName        || row.toName        || '';
  const toAddress     = fields.toAddress     || row.toAddress     || '';
  const firmNameNp    = fields.firmNameNp    || imgs.firmNameNp    || firmName || '';
  const firmAcronym   = fields.firmAcronym   || imgs.firmAcronym   || '';
  const firmAddressNp = fields.firmAddressNp || imgs.firmAddressNp || '';
  const firmContact   = fields.firmContact   || imgs.firmContactNp || '';
  const firmPhone     = fields.firmPhone     || row.firmPhone     || '';
  const mobileNo      = fields.mobileNo      || '';
  const fy            = fields.fy            || row.fyNp          || '';
  const applicantName = fields.applicantName || firmContact       || '';
  // table texts
  const sec1Header = fields.sec1Header || '';
  const sec2Header = fields.sec2Header || '';
  const sec2Items  = (fields.sec2Items || '').split('\n').filter(Boolean);
  const sec3Header = fields.sec3Header || '';
  const supplyLabel       = fields.supplyLabel       || '';
  const supplyValue       = fields.supplyValue       || '';
  const constructionLabel = fields.constructionLabel || '';
  const constructionValue = fields.constructionValue || '';
  const consultingLabel   = fields.consultingLabel   || '';
  const otherServiceLabel = fields.otherServiceLabel || '';
  const otherServiceValue = fields.otherServiceValue || '';
  const dateLabel      = fields.dateLabel      || '';
  const fyLabel        = fields.fyLabel        || '';
  const stampLabel     = fields.stampLabel     || '';
  const applicantLabel = fields.applicantLabel || '';
  const signLabel      = fields.signLabel      || '';

  return `<!DOCTYPE html><html lang="ne"><head><meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#fff; }
  .page {
    width:794px; height:1123px; position:relative; padding:0; overflow:hidden;
    font-family:'Kalimati','Noto Sans Devanagari','Arial Unicode MS',sans-serif; font-size:13px;
    background-color:#fff;
    ${useLhBg ? `/* longhand: html2canvas drops background-size from the shorthand */
    background-image:url("${firmLetterhead}");
    background-repeat:no-repeat;
    background-position:0 0;
    background-size:794px 1123px;` : ''}
  }
  .page-inner { position:relative;z-index:1;padding:${topMm}mm ${lrMm}mm ${bottomMm}mm ${lrMm}mm; }
  .lh-regpan { display:flex;justify-content:space-between;font-size:9pt;font-style:italic;color:#7b1a1a;margin-bottom:5px; }
  .lh-center { text-align:center; }
  .lh-logo { max-height:75px;max-width:75px;object-fit:contain;margin-bottom:3px;mix-blend-mode:multiply; }
  .lh-name { font-size:15pt;font-weight:700;color:#7b1a1a;line-height:1.3; }
  .lh-meta { font-size:9pt;color:#444;margin-top:4px;line-height:1.6; }
  .lh-border { border-bottom:3px double #7b1a1a;margin:7px 0 5mm; }
  .ref-row { display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px;font-size:11pt; }
  .to-block { margin-bottom:12px;font-size:10.5pt;line-height:1.75; }
  .subject { text-align:center;font-size:11pt;font-weight:700;text-decoration:underline;text-underline-offset:3px;margin-bottom:10px; }
  .body-txt { margin-bottom:8px;font-size:10pt;text-align:justify;line-height:1.7; }
  .tapasil { font-weight:700;font-size:10.5pt;margin-bottom:3px; }
  table { width:100%;border-collapse:collapse;font-size:10pt; }
  td { border:1px solid #666;padding:5px 8px;vertical-align:top; }
  .hdr { font-weight:600;padding:5px 8px; }
  .half { width:50%; }
  .w22 { width:22%; }
  .tall { min-height:36px; }
</style></head><body>
<div class="page">
  <div class="page-inner">
  ${!useLhBg ? `
  ${firmRegNo || firmPan ? `<div class="lh-regpan"><span>${firmRegNo ? 'Govt. Regd.No. '+firmRegNo : ''}</span><span>${firmPan ? 'PAN No. '+firmPan : ''}</span></div>` : ''}
  <div class="lh-center">
    ${firmLogo ? `<img src="${firmLogo}" class="lh-logo" alt="">` : ''}
    <div class="lh-name">${firmNameNp}${firmAcronym && firmAcronym !== firmNameNp ? ` (${firmAcronym})` : ''}</div>
    ${firmMeta ? `<div class="lh-meta">${firmMeta}</div>` : ''}
  </div>
  <div class="lh-border"></div>` : ''}

  <div class="ref-row">
    ${ref ? `<span>संख्या: ${ref}</span>` : '<span></span>'}
    <span>मिति: ${date}</span>
  </div>
  <div class="to-block">
    <div>श्री ${fields.toTitle} ज्यू,</div>
    <div>${toName}</div>
    ${toAddress ? `<div>${toAddress}</div>` : ''}
  </div>
  <div class="subject">विषय: ${fields.subject}</div>
  <div class="body-txt">${fields.body}</div>
  <div class="tapasil">${fields.tapasil}</div>

  <table>
    <tr><td colspan="2" class="hdr">१. ${sec1Header}</td></tr>
    <tr>
      <td class="half">(क) नाम: ${firmNameNp}${firmAcronym ? ' ('+firmAcronym+')' : ''}</td>
      <td class="half">(ख) ठेगाना: ${firmAddressNp}</td>
    </tr>
    <tr>
      <td class="half">(ग) पत्राचार गर्ने ठेगाना: ${firmAddressNp}</td>
      <td class="half">(घ) मुख्य व्यक्तिको नाम: ${firmContact}</td>
    </tr>
    <tr>
      <td class="half">(ड) टेलिफोन नं: ${firmPhone ? toNpNum(firmPhone) : ''}</td>
      <td class="half">(च) मोबाईल नं: ${mobileNo}</td>
    </tr>
    <tr><td colspan="2" class="hdr">२. ${sec2Header}</td></tr>
    <tr><td colspan="2" style="padding:6px 10px;line-height:1.95;">
      ${sec2Items.join('<br>')}
    </td></tr>
    <tr><td colspan="2" class="hdr">३. ${sec3Header}</td></tr>
    <tr><td colspan="2" style="padding:0;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td class="w22" style="border:none;border-right:1px solid #666;border-bottom:1px solid #666;padding:5px 8px;">${supplyLabel}</td>
          <td class="tall" style="border:none;border-right:1px solid #666;border-bottom:1px solid #666;padding:5px 8px;">${supplyValue}</td>
          <td class="w22" style="border:none;border-right:1px solid #666;border-bottom:1px solid #666;padding:5px 8px;">${constructionLabel}</td>
          <td class="tall" style="border:none;border-bottom:1px solid #666;padding:5px 8px;">${constructionValue}</td>
        </tr>
        <tr>
          <td class="w22" style="border:none;border-right:1px solid #666;padding:5px 8px;">${consultingLabel}</td>
          <td style="border:none;border-right:1px solid #666;padding:5px 8px;">${fields.serviceType}</td>
          <td class="w22" style="border:none;border-right:1px solid #666;padding:5px 8px;">${otherServiceLabel}</td>
          <td class="tall" style="border:none;padding:5px 8px;">${otherServiceValue}</td>
        </tr>
      </table>
    </td></tr>
    <tr><td colspan="2" style="padding:0;">
      <div style="display:flex;min-height:100px;">
        <div style="flex:0 0 34%;padding:8px 10px;border-right:1px solid #666;line-height:2;font-size:10pt;">
          <div>${dateLabel} ${date}</div>
          ${fy ? `<div>${fyLabel} ${fy}</div>` : ''}
        </div>
        <div style="flex:0 0 32%;border-right:1px solid #666;text-align:center;padding:6px 4px;">
          ${inclStamp && firmStamp
            ? `<div style="font-size:9pt;margin-bottom:3px;">${stampLabel}</div><img src="${firmStamp}" style="display:block;margin:0 auto;width:30mm;height:30mm;object-fit:contain;background:#fff;">`
            : ''}
        </div>
        <div style="flex:1;padding:8px 10px;font-size:10pt;line-height:2;">
          <div>${applicantLabel} ${applicantName}</div>
          ${inclSign && firmSign
            ? `<div style="margin-top:4px;">${signLabel} <img src="${firmSign}" style="display:inline-block;vertical-align:middle;margin-left:4px;max-height:20mm;max-width:100%;width:auto;height:auto;object-fit:contain;"></div>`
            : ''}
        </div>
      </div>
    </td></tr>
  </table>
  </div>
</div>
</body></html>`;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function LetterBuilder({ row: initialRow, token, onClose, allRows }) {
  const [selectedRowId, setSelectedRowId] = useState(initialRow?.id ?? null);
  const row = (allRows && selectedRowId)
    ? (allRows.find(r => r.id === selectedRowId) || initialRow)
    : initialRow;

  const letterType = row?.list_letter_type || row?.letter_type || 'basic';
  const tpl = TEMPLATES[letterType] || TEMPLATES.basic;

  const [fields, setFields] = useState(() => {
    const f = Object.fromEntries(Object.entries(tpl.fields).map(([k, v]) => [k, v.value]));
    f.date = todayBS();
    return f;
  });
  const [inclSign, setInclSign] = useState(!!row?.institute_sign);
  const [inclStamp, setInclStamp] = useState(!!row?.institute_stamp);
  const [previewHtml, setPreviewHtml] = useState('');
  const [imgs, setImgs] = useState(null);
  const [margins, setMargins] = useState({ top: null, bottom: null });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const iframeRef = useRef(null);
  const pdfFrameRef = useRef(null);

  // Release the blob URL when the builder closes
  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

  // Patch editable fields from row/firm data when row changes
  useEffect(() => {
    setFields(f => ({
      // start fresh from template defaults for the (possibly new) template
      ...Object.fromEntries(Object.entries(tpl.fields).map(([k, v]) => [k, v.value])),
      date:          f.date || todayBS(),
      lrPadding:     String(row?.institute_letter_lr_padding ?? 20),
      toTitle:       row?.list_addressee || row?.client_signatory_position || tpl.fields.toTitle?.value || 'कार्यालय प्रमुख',
      toName:        row?.client_name_manual    || row?.client_name_np    || row?.client_name    || '',
      toName2:       row?.list_client_name2     || '',
      toAddress:     row?.client_address_manual || row?.client_address_np || row?.client_address || '',
      serviceType:   row?.institute_service_type || tpl.fields.serviceType?.value || '',
      firmNameNp:    row?.institute_name_np    || row?.institute_name    || '',
      firmAcronym:   row?.institute_acronym    || '',
      firmAddressNp: row?.institute_address_np || row?.institute_address || '',
      firmContact:   row?.institute_contact_np || row?.institute_contact || '',
      firmPhone:     row?.institute_phone      || '',
      fy:            row?.fy ? toNpNum(row.fy) : '',
      applicantName: row?.institute_contact_np || row?.institute_contact || '',
      signatoryName: row?.institute_contact_np || row?.institute_contact || '',
    }));
  }, [row?.id, letterType]);

  // Pre-fetch images when row changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      // The shortlist list query omits the institute's images to keep the page
      // fast, so fetch the full record for whichever firm is selected.
      let inst = {};
      if (row?.institute_id && token) {
        try { inst = (await api('GET', `/institutes/${row.institute_id}`, null, token)) || {}; } catch {}
      }
      if (cancelled) return;
      setInclSign(!!inst.sign);
      setInclStamp(!!inst.stamp);
      const [logo, lh, sign, stamp] = await Promise.all([
        urlToDataUrl(inst.logo        || row?.institute_logo       || null),
        urlToDataUrl(inst.letterhead  || row?.institute_letterhead || null),
        urlToDataUrl(inst.sign        || row?.institute_sign       || null),
        urlToDataUrl(inst.stamp       || row?.institute_stamp      || null),
      ]);
      if (cancelled) return;
      const firmName    = row?.institute_name    || '';
      const firmAddress = row?.institute_address || '';
      const firmPhone   = row?.institute_phone   || '';
      const firmEmail   = row?.institute_email   || '';
      const firmWebsite = row?.institute_website || '';
      setImgs({
        firmName,
        firmAcronym:   row?.institute_acronym    || '',
        firmNameNp:    row?.institute_name_np    || firmName,
        firmAddressNp: row?.institute_address_np || firmAddress,
        firmContactNp: row?.institute_contact_np || row?.institute_contact || '',
        firmMeta: [firmAddress, firmPhone ? `फोन: ${firmPhone}` : '', firmEmail, firmWebsite].filter(Boolean).join('  |  '),
        firmRegNo: row?.institute_reg_no || '',
        firmPan:   row?.institute_pan   || '',
        firmPhone,
        firmLogo: logo, firmLetterhead: lh, firmSign: sign, firmStamp: stamp,
      });
      const m = await detectLetterheadMargins(lh);
      if (!cancelled) { setMargins(m); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [row?.id, row?.institute_id, token]);

  const buildHtml = useCallback(() => {
    if (!imgs) return '';
    const lrMm     = parseFloat(fields.lrPadding) || row?.institute_letter_lr_padding || 20;
    const cfgTop   = row?.institute_letter_top_margin     ?? 15;
    const cfgBot   = row?.institute_letter_bottom_padding ?? 15;
    const topMm    = margins.top    && margins.top    > cfgTop ? margins.top    : cfgTop;
    const bottomMm = margins.bottom && margins.bottom > cfgBot ? margins.bottom : cfgBot;
    const rowData = {
      toName:    row?.client_name_manual    || row?.client_name_np    || row?.client_name    || '',
      toAddress: row?.client_address_manual || row?.client_address_np || row?.client_address || '',
      firmPhone: row?.institute_phone || '',
      fyNp:      row?.fy ? toNpNum(row.fy) : '',
    };
    return tpl.buildHtml({
      fields, row: rowData, imgs, topMm, bottomMm, lrMm,
      inclSign, inclStamp, todayBSStr: todayBS(),
    });
  }, [fields, imgs, margins, inclSign, inclStamp, row, tpl]);

  // Rebuild preview whenever inputs change
  useEffect(() => {
    if (!loading) setPreviewHtml(buildHtml());
  }, [loading, buildHtml]);

  const generatePdf = async () => {
    setGenerating(true);
    try {
      const A4_W = 794, A4_H = 1123;
      const iframe = document.createElement('iframe');
      iframe.style.cssText = `position:fixed;left:-9999px;top:0;width:${A4_W}px;height:${A4_H}px;border:none;visibility:hidden;`;
      document.body.appendChild(iframe);
      await new Promise(r => { iframe.onload = r; iframe.srcdoc = buildHtml(); });
      const iDoc = iframe.contentDocument;
      await Promise.all([...iDoc.querySelectorAll('img')].map(img =>
        img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })
      ));
      const { default: html2canvas } = await import('html2canvas');
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      const pages = iDoc.querySelectorAll('.page');
      for (let i = 0; i < pages.length; i++) {
        const canvas = await html2canvas(pages[i], {
          scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#fff',
          width: A4_W, height: A4_H, windowWidth: A4_W, windowHeight: A4_H,
        });
        if (i > 0) pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 210, 297);
      }
      document.body.removeChild(iframe);
      setPdfUrl(prev => { if (prev) URL.revokeObjectURL(prev); return pdf.output('bloburl'); });
    } finally { setGenerating(false); }
  };

  const printPdf = () => {
    try {
      const w = pdfFrameRef.current?.contentWindow;
      if (w) { w.focus(); w.print(); return; }
    } catch {}
    if (pdfUrl) window.open(pdfUrl, '_blank', 'noopener');
  };

  const orderedFields = tpl.fieldOrder.filter(k => tpl.fields[k]);

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.55)', zIndex:1200, display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 20px', background:'var(--surface)', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
        <div style={{ fontWeight:700, fontSize:16, color:'var(--text)' }}>Letter Builder</div>
        <div style={{ fontSize:12, color:'var(--text3)', padding:'3px 10px', borderRadius:100, background:'var(--bg)', border:'1px solid var(--border)' }}>{tpl.name}</div>

        {/* Firm picker */}
        {allRows && allRows.length > 0 && (
          <select value={selectedRowId ?? ''} onChange={e => setSelectedRowId(Number(e.target.value))}
            style={{ padding:'6px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--surface)',
              color:'var(--text)', fontSize:13, fontFamily:'inherit', flex:1, maxWidth:280, cursor:'pointer' }}>
            <option value="">— Select firm —</option>
            {allRows.map(r => (
              <option key={r.id} value={r.id}>
                {r.institute_name}{r.client_short ? ` → ${r.client_short}` : ''}
              </option>
            ))}
          </select>
        )}

        <div style={{ display:'flex', gap:8, marginLeft:'auto' }}>
          <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, cursor:'pointer', color:'var(--text2)' }}>
            <input type="checkbox" checked={inclStamp} onChange={e=>setInclStamp(e.target.checked)} style={{ accentColor:'var(--primary)' }}/> छाप
          </label>
          <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, cursor:'pointer', color:'var(--text2)' }}>
            <input type="checkbox" checked={inclSign} onChange={e=>setInclSign(e.target.checked)} style={{ accentColor:'var(--primary)' }}/> हस्ताक्षर
          </label>
        </div>

        <Btn className="btn btn-primary" onClick={generatePdf} disabled={loading||generating}
          style={{ minWidth:130, fontSize:13 }}>
          {generating ? 'Generating…' : 'Generate PDF'}
        </Btn>
        <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', fontSize:22, lineHeight:1, color:'var(--text3)', padding:'0 4px' }}>×</button>
      </div>

      {/* Body: editor + preview */}
      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>

        {/* Left: editor */}
        <div style={{ width:340, flexShrink:0, overflowY:'auto', padding:20, borderRight:'1px solid var(--border)', background:'var(--bg)', display:'flex', flexDirection:'column', gap:14 }}>
          {loading && <div style={{ color:'var(--text3)', fontSize:13 }}>Loading images…</div>}
          {!loading && orderedFields.map(key => {
            const def = tpl.fields[key];
            return (
              <div key={key}>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--text3)', marginBottom:4, textTransform:'uppercase', letterSpacing:.5 }}>{def.label}</div>
                {def.multiline
                  ? <textarea value={fields[key] ?? ''} onChange={e => setFields(f => ({...f, [key]: e.target.value}))}
                      rows={3}
                      style={{ width:'100%', padding:'8px 10px', border:'1px solid var(--border)', borderRadius:6, fontSize:13,
                        fontFamily:'Kalimati,Noto Sans Devanagari,Arial Unicode MS,sans-serif', resize:'vertical',
                        background:'var(--surface)', color:'var(--text)', outline:'none', lineHeight:1.7 }}/>
                  : <input value={fields[key] ?? ''} onChange={e => setFields(f => ({...f, [key]: e.target.value}))}
                      style={{ width:'100%', padding:'8px 10px', border:'1px solid var(--border)', borderRadius:6, fontSize:13,
                        fontFamily:'Kalimati,Noto Sans Devanagari,Arial Unicode MS,sans-serif',
                        background:'var(--surface)', color:'var(--text)', outline:'none' }}/>
                }
              </div>
            );
          })}
        </div>

        {/* Right: live preview */}
        <div style={{ flex:1, overflow:'auto', background:'#666', display:'flex', alignItems:'flex-start', justifyContent:'center', padding:24 }}>
          {loading
            ? <div style={{ color:'#fff', fontSize:14, marginTop:60 }}>Loading…</div>
            : <iframe
                ref={iframeRef}
                srcDoc={previewHtml}
                style={{ width:794, height:1123, border:'none', boxShadow:'0 4px 24px rgba(0,0,0,.4)', background:'#fff', flexShrink:0 }}
                title="Letter Preview"
              />
          }
        </div>
      </div>

      {/* Generated PDF preview — print or download from here */}
      {pdfUrl && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.65)', zIndex:1400, display:'flex', flexDirection:'column' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 20px', background:'var(--surface)', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
            <div style={{ fontWeight:700, fontSize:16, color:'var(--text)' }}>Letter Preview</div>
            <div style={{ marginLeft:'auto', display:'flex', gap:8, alignItems:'center' }}>
              <Btn className="btn btn-secondary" onClick={printPdf}>
                <span className="material-icons-round" style={{fontSize:16}}>print</span> Print
              </Btn>
              <a href={pdfUrl} download="shortlist-letter.pdf" className="btn btn-primary"
                style={{ textDecoration:'none', display:'inline-flex', alignItems:'center', gap:6 }}>
                <span className="material-icons-round" style={{fontSize:16}}>download</span> Download
              </a>
              <button onClick={() => { URL.revokeObjectURL(pdfUrl); setPdfUrl(null); }}
                style={{ background:'none', border:'none', cursor:'pointer', fontSize:22, lineHeight:1, color:'var(--text3)', padding:'0 4px' }}>×</button>
            </div>
          </div>
          <iframe ref={pdfFrameRef} src={pdfUrl} title="Letter PDF preview"
            style={{ flex:1, border:'none', background:'#666', width:'100%' }}/>
        </div>
      )}
    </div>
  );
}

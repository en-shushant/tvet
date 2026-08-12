const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/jspdf.es.min-BV2Qwvrj.js","assets/index-9vKvnrcD.js","assets/vendor-tAaa2TlE.js","assets/index-PJ3SVLFX.css"])))=>i.map(i=>d[i]);
import{t as F,a as se,j as i,B as Z,_ as w,l as ee}from"./index-9vKvnrcD.js";import{r as b}from"./vendor-tAaa2TlE.js";import{l as oe}from"./Shortlisting-BT2y_aX3.js";function J(){const t=new Date;let s=2e3,o=0,f=new Date(1943,3,14);for(let d=2e3;d<=2090;d++){const c=(ee[d]||[]).reduce((v,N)=>v+N,0),S=new Date(f.getTime()+c*864e5);if(S>t){s=d,o=Math.floor((t-f)/864e5);break}f=S}const p=ee[s]||[];let _=1,e=o+1;for(let d=0;d<p.length;d++){if(e<=p[d]){_=d+1;break}e-=p[d]}return`${F(s)}/${F(String(_).padStart(2,"0"))}/${F(String(e).padStart(2,"0"))}`}async function Y(t){if(!t)return null;if(t.startsWith("data:"))return t;try{const s=await fetch(t);if(!s.ok)return t;const o=await s.blob();return new Promise(f=>{const p=new FileReader;p.onload=()=>f(p.result),p.onerror=()=>f(t),p.readAsDataURL(o)})}catch{return t}}async function re(t){return t?new Promise(s=>{const o=new Image;o.onload=()=>{try{const _=Math.min(1,794/o.naturalWidth,1123/o.naturalHeight),e=document.createElement("canvas");e.width=Math.round(o.naturalWidth*_),e.height=Math.round(o.naturalHeight*_);const d=e.getContext("2d");d.drawImage(o,0,0,e.width,e.height);const m=e.width,c=e.height,S=Math.max(1,Math.floor(m/30)),v=g=>{let z=0;for(let k=0;k<m;k+=S){const y=d.getImageData(k,g,1,1).data;y[3]>50&&(y[0]<220||y[1]<220||y[2]<220)&&z++}return z};let N=null;for(let g=Math.floor(c*.6);g>=0;g--)if(v(g)>=3){N=Math.ceil(g/c*297)+8;break}let L=null;for(let g=Math.floor(c*.6);g<c;g++)if(v(g)>=3){L=Math.ceil((c-g)/c*297)+8;break}s({top:N,bottom:L})}catch{s({top:null,bottom:null})}},o.onerror=()=>s({top:null,bottom:null}),o.src=t}):{top:null,bottom:null}}function te({fields:t,imgs:s,topMm:o,bottomMm:f,lrMm:p,inclSign:_,inclStamp:e,todayBSStr:d,kalimatiCss:m=""}){const{firmLetterhead:c,firmSign:S,firmStamp:v,firmName:N}=s,L=!!c,g=t.date||d,z=t.toTitle||"कार्यालय प्रमुख",k=t.toName||"",y=t.toName2||"",I=t.toAddress||"",E=t.fy||"",R=(t.body||"").replace(/\{fy\}/g,E),A=(t.bullets||"").split(`
`).filter(Boolean),D=t.sectionHeader||"",j=t.signatoryName||s.firmContactNp||"",T=t.firmNameNp||s.firmNameNp||N||"";return`<!DOCTYPE html><html lang="ne"><head><meta charset="UTF-8">
<style>${m}</style>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#fff; font-family:'Kalimati','Noto Sans Devanagari','Arial Unicode MS',sans-serif; }
  .page {
    width:794px; height:1123px; position:relative; overflow:hidden;
    font-family:'Kalimati','Noto Sans Devanagari','Arial Unicode MS',sans-serif; font-size:13px;
    background-color:#fff;
    ${L?`background-image:url("${c}");background-repeat:no-repeat;background-position:0 0;background-size:794px 1123px;`:""}
  }
  .page-inner { position:relative;z-index:1;padding:${o}mm ${p}mm ${f}mm ${p}mm; }
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

  <div class="ref-row"><span>मिति: ${g}</span></div>

  <div class="to-block">
    <div>श्री ${z} ज्यू,</div>
    ${k?`<div>${k}</div>`:""}
    ${y?`<div>${y}</div>`:""}
    ${I?`<div>${I}</div>`:""}
  </div>

  <div class="subject">विषय: ${t.subject||""}</div>
  <div class="body-txt">महोदय,</div>
  <div class="body-txt">${R}</div>
  <div class="tapasil">तपसिल:</div>
  ${D?`<div class="sec-hdr">${D}</div>`:""}
  <ul class="bullets">
    ${A.map(C=>`<li>${C}</li>`).join(`
    `)}
  </ul>

  <div class="sig-row">
    <div class="sig-stamp">
      ${e&&v?`<img src="${v}" style="width:26mm;height:26mm;object-fit:contain;display:block;margin:0 auto;">`:""}
    </div>
    <div class="sig-block">
      ${_&&S?`<img src="${S}" style="display:block;margin:0 auto;max-height:14mm;max-width:100%;object-fit:contain;margin-bottom:4px;">`:""}
      <div class="sig-line">${j}<br>${T}</div>
    </div>
  </div>

</div></div>
</body></html>`}const de={fields:{date:{label:"मिति (BS Date)",value:""},ref:{label:"संख्या / Ref. No.",value:""},lrPadding:{label:"Left / Right Margin (mm)",value:"20"},toName:{label:"To: Name (प्रापक नाम)",value:""},toAddress:{label:"To: Address (ठेगाना)",value:""},toTitle:{label:"To Title (पद)",value:"कार्यालय प्रमुख"},subject:{label:"Subject (विषय)",value:"मौजुदा सूचीमा दर्ता गरी पाऊँ।",multiline:!0},body:{label:"Body Paragraph",multiline:!0,value:"सार्वजनिक खरिद नियमावली, २०६४ को नियम १८ को उपनियम (१) बमोजिम तपशिलमा उल्लेखित विवरण अनुसारको पृष्ठाई गर्ने कागजात संलग्न गरी मौजुदा सूचीमा दर्ता हुन यो निवेदन पेश गरेको छु।"},tapasil:{label:"तपशिल Label",value:"तपशिल:"},serviceType:{label:"Service Type (सेवा प्रकार)",value:"सीपमूलक तथा व्यावसायिक तालिम कार्यक्रमहरु सञ्चालन",multiline:!0},firmNameNp:{label:"Firm Name (Nepali)",value:""},firmAcronym:{label:"Firm Acronym",value:""},firmAddressNp:{label:"Firm Address (Nepali)",value:""},firmContact:{label:"Contact Person (Nepali)",value:""},firmPhone:{label:"Phone / टेलिफोन",value:""},mobileNo:{label:"Mobile No. (मोबाईल)",value:""},fy:{label:"आ.व. (Fiscal Year)",value:""},applicantName:{label:"Applicant Name (निवेदकको नाम)",value:""},sec1Header:{label:"Section १ Header",multiline:!0,value:"मौजुदा सूचीको लागि निवेदन दिने व्यक्ति, संस्था, आपूर्तिकर्ता, निर्माण व्यवसायी, परामर्शदाता वा सेवा प्रदायकको विवरण:"},sec2Header:{label:"Section २ Header",multiline:!0,value:"मौजुदा सूचीमा दर्ता हुनको लागि निम्न बमोजिमको प्रमाणपत्र संलग्न गर्नुहोला।"},sec2Items:{label:"Section २ Checklist (one per line)",multiline:!0,value:`(क) संस्था वा फर्म दर्ताको प्रमाणपत्र  छ ☑  छैन □
(ख) नविकरण गरिएको  छ ☑  छैन □
(ग) मूल्य अभिवृद्धि कर वा स्थायी लेखा नम्बर दर्ताको प्रमाणपत्र  छ ☑  छैन □
(घ) कर चुक्ताको प्रमाणपत्र  छ ☑  छैन □
(ड) कुन खरिदको लागि मौजुदार सूचीमा दर्ता हुन निवेदन दिने हो, सो कामको लागि इजाजत पत्र आवश्यक पत्ने भएमा सो को प्रतिलिपि  छ ☑  छैन □`},sec3Header:{label:"Section ३ Header",multiline:!0,value:"सार्वजनिक निकायबाट हुने खरिदको लागि दर्ता हुन चाहेको खरिदको प्रकृतिको विवरण:"},supplyLabel:{label:"(क) Supply Label",value:"(क) मालसामान आपूर्ति:"},supplyValue:{label:"(क) Supply Value",value:"",multiline:!0},constructionLabel:{label:"(ख) Construction Label",value:"(ख) निर्माण कार्य"},constructionValue:{label:"(ख) Construction Value",value:"",multiline:!0},consultingLabel:{label:"(ग) Consulting Label",value:"(ग) परामर्श सेवा:"},otherServiceLabel:{label:"(घ) Other Service Label",value:"(घ) अन्य सेवा:"},otherServiceValue:{label:"(घ) Other Service Value",value:"",multiline:!0},dateLabel:{label:"Date Label (bottom)",value:"निवेदन दिएको मिति:"},fyLabel:{label:"FY Label (bottom)",value:"आ.व.:"},stampLabel:{label:"Stamp Label",value:"फर्मको छाप:"},applicantLabel:{label:"Applicant Label",value:"निवेदकको नाम:"},signLabel:{label:"Signature Label",value:"हस्ताक्षर:"}}},ce=["date","ref","lrPadding","toTitle","toName","toAddress","subject","body","tapasil","firmNameNp","firmAcronym","firmAddressNp","firmContact","firmPhone","mobileNo","fy","applicantName","sec1Header","sec2Header","sec2Items","sec3Header","supplyLabel","supplyValue","constructionLabel","constructionValue","consultingLabel","serviceType","otherServiceLabel","otherServiceValue","dateLabel","fyLabel","stampLabel","applicantLabel","signLabel"],ae={date:{label:"मिति (BS Date)",value:""},lrPadding:{label:"Left / Right Margin (mm)",value:"20"},toTitle:{label:"Addressee Title (पद)",value:"कार्यालय प्रमुख"},toName:{label:"Organization Name",value:""},toName2:{label:"Department / Level 2 (optional)",value:""},toAddress:{label:"Address",value:""},subject:{label:"Subject (विषय)",value:"सूचीदर्ता गरिदिने बारे"},body:{label:"Body Paragraph",multiline:!0,value:"उपरोक्त सम्बन्धमा तहाँ विभागको सूचना अनुसार आ.व. {fy} को लागि यस कम्पनीलाई तपसिल अनुसारको सेवा प्रदान गर्ने प्रयोजनका लागि मौजुदा सूचीमा सूचीकृत गरिदिनुहुन अनुरोध गर्दछु।"},fy:{label:"आ.व. (Fiscal Year)",value:""},sectionHeader:{label:"Section Header",value:""},bullets:{label:"Bullet Points (one per line)",multiline:!0,value:""},signatoryName:{label:"Signatory Name",value:""},firmNameNp:{label:"Firm Name (Nepali)",value:""}},ie=["date","lrPadding","toTitle","toName","toName2","toAddress","subject","body","fy","sectionHeader","bullets","signatoryName","firmNameNp"],ne={basic:{name:"Basic Shortlisting",fields:de.fields,fieldOrder:ce,buildHtml:pe},nea_ssemd:{name:"NEA SSEMD",fields:{...ae,sectionHeader:{label:"Section Header",value:"(ख) परामर्श सेवा :"},bullets:{label:"Bullet Points (one per line)",multiline:!0,value:`समूह (१) : वातावरणीय अध्ययन तर्फ : वातावरणीय अध्ययन कार्यको लागि आवश्यक कार्यसूची (ToR) तथा क्षेत्र निर्धारण (Scoping) सम्बन्धी कार्य, संक्षिप्त वातावरणीय अध्ययन (BES), प्रारम्भिक वातावरणीय परीक्षण (IEE) तथा वातावरणीय प्रभाव मूल्याङ्कन (EIA) वन्यजन्तु, चराचुरुङ्गी एवं जैविक विविधता सम्बन्धि विषयगत अध्ययन कार्य ।
समूह (२) : वातावरणीय तथा सामाजिक अनुगमन सम्बन्धि कार्य : सामाजिक तथा वातावरणीय पक्षको अनुगमन कार्य, वातावरणीय व्यवस्थापन योजना (EMP) सम्बन्धि कार्य, पुर्नवास तथा पुर्नस्थापना कार्य योजना (RRAP) सम्बन्धी कार्य एवं आयोजनाको बाह्य (तेस्रो पक्ष) अनुगमन तथा मूल्यांकन सम्बन्धी कार्य ।
समूह (३) : आयोजना स्थलमा संचालन हुने वातावरणीय तथा सामाजिक अनुगमन इकाई (ESMU) का लागि वातावरण, समाजिक, लैङ्गिक विज्ञ तथा अन्य जनशक्ति आपूर्ति सम्बन्धी सेवा । आयोजना स्थलमा सञ्चालन गर्नुपर्ने जनचेतनामूलक तथा अन्य कार्य: सामाजिक, वन संरक्षण तथा वन्यजन्तु संरक्षण सम्बन्धी सचेतनामूलक कार्यक्रम, आय आर्जन सम्बन्धी कार्यक्रम, लैङ्गिक समानता तथा सामाजिक समावेशीकरण सम्बन्धी कार्य ।
समूह (४) : सिपमुलक तालिम : छोटो अवधिको ड्राइभिङ, हाउस वायरिङ, प्लम्बिङ्ग, वेल्डिङ्ग, मर्मत सम्भार, सिलाई, बुनाई, व्युटिपार्लर आदी सम्बन्धि कार्य ।
समूह (५) : आयोजना स्थलमा सञ्चालन गर्नुपर्ने वातावरणीय सुचकाङ्क बमोजिमको Air, Noise, Water Quality मापन सम्बन्धी कार्य ।`}},fieldOrder:ie,buildHtml:te},nea_essd:{name:"NEA ESSD",fields:{...ae,sectionHeader:{label:"Section Header",value:"१) परामर्श सेवा आपूर्ति तर्फ:"},bullets:{label:"Bullet Points (one per line)",multiline:!0,value:`समूह-क:- वातावरणीय तथा सामाजिक अध्ययन कार्य: प्रारम्भिक वातावरणीय परीक्षणको कार्यसूची (ToR), प्रारम्भिक वातावरणीय परीक्षण कार्य (IEE) वातावरणीय प्रभाव मूल्यांकनको लागि क्षेत्र निर्धारण (Scoping) तथा कार्यसुची (ToR)' तयार गर्ने कार्य, वातावरणीय प्रभाव मूल्यांकन कार्य (EIA), विषयगत अध्ययन कार्य (माछा, वन्यजन्तु, वन तथा वनस्पति, भौतिक वातावरण, सामाजिक, आर्थिक आदि) तथा दातृ संस्थाहरुको लागि गरिने सामाजिक प्रभाव मूल्याङ्कन (SIA), पुनर्वास कार्य योजना (RAP) उत्पीडित समुदाय विकास योजना (VCDP) तथा वातावरणीय व्यवस्थापन कार्य योजना (EMAP) आयोजनाको अध्ययन अनुगमनको लागि विज्ञहरुको सेवा खरिद आदि ।
समूह ख :- आयोजना स्थलमा संचालन गर्नुपर्ने जनचेतना तथा अन्य कार्य: सामाजिक सचेतना कार्यक्रम, वन संरक्षण सचेतना कार्यहरु, वन्यजन्तु संरक्षण सचेतना कार्यक्रम, आय आर्जन सम्बन्धी आदि ।
समूह ग: सीपमुलक तालिम: छोटो अवधिको ड्राइभिङ्ग, हाउस वायरिङ्ग, प्लम्बिङ्ग, वेल्डिङ्ग, सिलाई, बुनाई मर्मत संभार आदि ।
समूह घ: आयोजना स्थलमा संचालन गर्नुपर्ने: Air, Noise, Water Quality मापन सम्बन्धी कार्य ।`}},fieldOrder:ie,buildHtml:te}};function pe({fields:t,row:s,imgs:o,topMm:f,bottomMm:p,lrMm:_,inclSign:e,inclStamp:d,todayBSStr:m,kalimatiCss:c=""}){const{firmLogo:S,firmLetterhead:v,firmSign:N,firmStamp:L,firmRegNo:g,firmPan:z,firmMeta:k,firmName:y}=o,I=!!v,E=t.date||m,R=t.ref||"",A=t.toName||s.toName||"",D=t.toAddress||s.toAddress||"",j=t.firmNameNp||o.firmNameNp||y||"",T=t.firmAcronym||o.firmAcronym||"",C=t.firmAddressNp||o.firmAddressNp||"",O=t.firmContact||o.firmContactNp||"",$=t.firmPhone||s.firmPhone||"",U=t.mobileNo||"",V=t.fy||s.fyNp||"",K=t.applicantName||O||"",W=t.sec1Header||"",G=t.sec2Header||"",q=(t.sec2Items||"").split(`
`).filter(Boolean),X=t.sec3Header||"",a=t.supplyLabel||"",n=t.supplyValue||"",r=t.constructionLabel||"",h=t.constructionValue||"",x=t.consultingLabel||"",M=t.otherServiceLabel||"",B=t.otherServiceValue||"",P=t.dateLabel||"",H=t.fyLabel||"",l=t.stampLabel||"",u=t.applicantLabel||"",Q=t.signLabel||"";return`<!DOCTYPE html><html lang="ne"><head><meta charset="UTF-8">
<style>${c}</style>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#fff; }
  .page {
    width:794px; height:1123px; position:relative; padding:0; overflow:hidden;
    font-family:'Kalimati','Noto Sans Devanagari','Arial Unicode MS',sans-serif; font-size:13px;
    background-color:#fff;
    ${I?`/* longhand: html2canvas drops background-size from the shorthand */
    background-image:url("${v}");
    background-repeat:no-repeat;
    background-position:0 0;
    background-size:794px 1123px;`:""}
  }
  .page-inner { position:relative;z-index:1;padding:${f}mm ${_}mm ${p}mm ${_}mm; }
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

  <div class="ref-row">
    ${R?`<span>संख्या: ${R}</span>`:"<span></span>"}
    <span>मिति: ${E}</span>
  </div>
  <div class="to-block">
    <div>श्री ${t.toTitle} ज्यू,</div>
    <div>${A}</div>
    ${D?`<div>${D}</div>`:""}
  </div>
  <div class="subject">विषय: ${t.subject}</div>
  <div class="body-txt">${t.body}</div>
  <div class="tapasil">${t.tapasil}</div>

  <table>
    <tr><td colspan="2" class="hdr">१. ${W}</td></tr>
    <tr>
      <td class="half">(क) नाम: ${j}${T?" ("+T+")":""}</td>
      <td class="half">(ख) ठेगाना: ${C}</td>
    </tr>
    <tr>
      <td class="half">(ग) पत्राचार गर्ने ठेगाना: ${C}</td>
      <td class="half">(घ) मुख्य व्यक्तिको नाम: ${O}</td>
    </tr>
    <tr>
      <td class="half">(ड) टेलिफोन नं: ${$?F($):""}</td>
      <td class="half">(च) मोबाईल नं: ${U}</td>
    </tr>
    <tr><td colspan="2" class="hdr">२. ${G}</td></tr>
    <tr><td colspan="2" style="padding:6px 10px;line-height:1.95;">
      ${q.join("<br>")}
    </td></tr>
    <tr><td colspan="2" class="hdr">३. ${X}</td></tr>
    <tr><td colspan="2" style="padding:0;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td class="w22" style="border:none;border-right:1px solid #666;border-bottom:1px solid #666;padding:5px 8px;">${a}</td>
          <td class="tall" style="border:none;border-right:1px solid #666;border-bottom:1px solid #666;padding:5px 8px;">${n}</td>
          <td class="w22" style="border:none;border-right:1px solid #666;border-bottom:1px solid #666;padding:5px 8px;">${r}</td>
          <td class="tall" style="border:none;border-bottom:1px solid #666;padding:5px 8px;">${h}</td>
        </tr>
        <tr>
          <td class="w22" style="border:none;border-right:1px solid #666;padding:5px 8px;">${x}</td>
          <td style="border:none;border-right:1px solid #666;padding:5px 8px;">${t.serviceType}</td>
          <td class="w22" style="border:none;border-right:1px solid #666;padding:5px 8px;">${M}</td>
          <td class="tall" style="border:none;padding:5px 8px;">${B}</td>
        </tr>
      </table>
    </td></tr>
    <tr><td colspan="2" style="padding:0;">
      <div style="display:flex;min-height:100px;">
        <div style="flex:0 0 34%;padding:8px 10px;border-right:1px solid #666;line-height:2;font-size:10pt;">
          <div>${P} ${E}</div>
          ${V?`<div>${H} ${V}</div>`:""}
        </div>
        <div style="flex:0 0 32%;border-right:1px solid #666;text-align:center;padding:6px 4px;">
          ${d&&L?`<div style="font-size:9pt;margin-bottom:3px;">${l}</div><img src="${L}" style="display:block;margin:0 auto;width:30mm;height:30mm;object-fit:contain;background:#fff;">`:""}
        </div>
        <div style="flex:1;padding:8px 10px;font-size:10pt;line-height:2;">
          <div>${u} ${K}</div>
          ${e&&N?`<div style="margin-top:4px;">${Q} <img src="${N}" style="display:inline-block;vertical-align:middle;margin-left:4px;max-height:20mm;max-width:100%;width:auto;height:auto;object-fit:contain;"></div>`:""}
        </div>
      </div>
    </td></tr>
  </table>
  </div>
</div>
</body></html>`}function fe({row:t,token:s,onClose:o,allRows:f}){const[p,_]=b.useState((t==null?void 0:t.id)??null),e=f&&p&&f.find(a=>a.id===p)||t,d=(e==null?void 0:e.list_letter_type)||(e==null?void 0:e.letter_type)||"basic",m=ne[d]||ne.basic,[c,S]=b.useState(()=>{const a=Object.fromEntries(Object.entries(m.fields).map(([n,r])=>[n,r.value]));return a.date=J(),a}),[v,N]=b.useState(!!(e!=null&&e.institute_sign)),[L,g]=b.useState(!!(e!=null&&e.institute_stamp)),[z,k]=b.useState(""),[y,I]=b.useState(null),[E,R]=b.useState(""),[A,D]=b.useState({top:null,bottom:null}),[j,T]=b.useState(!0),[C,O]=b.useState(!1),[$,U]=b.useState(null),V=b.useRef(null),K=b.useRef(null);b.useEffect(()=>()=>{$&&URL.revokeObjectURL($)},[$]),b.useEffect(()=>{S(a=>{var n,r;return{...Object.fromEntries(Object.entries(m.fields).map(([h,x])=>[h,x.value])),date:a.date||J(),lrPadding:String((e==null?void 0:e.institute_letter_lr_padding)??20),toTitle:(e==null?void 0:e.list_addressee)||(e==null?void 0:e.client_signatory_position)||((n=m.fields.toTitle)==null?void 0:n.value)||"कार्यालय प्रमुख",toName:(e==null?void 0:e.client_name_manual)||(e==null?void 0:e.client_name_np)||(e==null?void 0:e.client_name)||"",toName2:(e==null?void 0:e.list_client_name2)||"",toAddress:(e==null?void 0:e.client_address_manual)||(e==null?void 0:e.client_address_np)||(e==null?void 0:e.client_address)||"",serviceType:(e==null?void 0:e.institute_service_type)||((r=m.fields.serviceType)==null?void 0:r.value)||"",firmNameNp:(e==null?void 0:e.institute_name_np)||(e==null?void 0:e.institute_name)||"",firmAcronym:(e==null?void 0:e.institute_acronym)||"",firmAddressNp:(e==null?void 0:e.institute_address_np)||(e==null?void 0:e.institute_address)||"",firmContact:(e==null?void 0:e.institute_contact_np)||(e==null?void 0:e.institute_contact)||"",firmPhone:(e==null?void 0:e.institute_phone)||"",fy:e!=null&&e.fy?F(e.fy):"",applicantName:(e==null?void 0:e.institute_contact_np)||(e==null?void 0:e.institute_contact)||"",signatoryName:(e==null?void 0:e.institute_contact_np)||(e==null?void 0:e.institute_contact)||""}})},[e==null?void 0:e.id,d]),b.useEffect(()=>{let a=!1;return(async()=>{T(!0);let n={};if(e!=null&&e.institute_id&&s)try{n=await se("GET",`/institutes/${e.institute_id}`,null,s)||{}}catch{}if(a)return;N(!!n.sign),g(!!n.stamp);const[r,h,x,M]=await Promise.all([Y(n.logo||(e==null?void 0:e.institute_logo)||null),Y(n.letterhead||(e==null?void 0:e.institute_letterhead)||null),Y(n.sign||(e==null?void 0:e.institute_sign)||null),Y(n.stamp||(e==null?void 0:e.institute_stamp)||null)]);if(a)return;const B=(e==null?void 0:e.institute_name)||"",P=(e==null?void 0:e.institute_address)||"",H=(e==null?void 0:e.institute_phone)||"",l=(e==null?void 0:e.institute_email)||"",u=(e==null?void 0:e.institute_website)||"";I({firmName:B,firmAcronym:(e==null?void 0:e.institute_acronym)||"",firmNameNp:(e==null?void 0:e.institute_name_np)||B,firmAddressNp:(e==null?void 0:e.institute_address_np)||P,firmContactNp:(e==null?void 0:e.institute_contact_np)||(e==null?void 0:e.institute_contact)||"",firmMeta:[P,H?`फोन: ${H}`:"",l,u].filter(Boolean).join("  |  "),firmRegNo:(e==null?void 0:e.institute_reg_no)||"",firmPan:(e==null?void 0:e.institute_pan)||"",firmPhone:H,firmLogo:r,firmLetterhead:h,firmSign:x,firmStamp:M}),oe().then(le=>{a||R(le)});const Q=await re(h);a||(D(Q),T(!1))})(),()=>{a=!0}},[e==null?void 0:e.id,e==null?void 0:e.institute_id,s]);const W=b.useCallback(()=>{if(!y)return"";const a=parseFloat(c.lrPadding)||(e==null?void 0:e.institute_letter_lr_padding)||20,n=(e==null?void 0:e.institute_letter_top_margin)??15,r=(e==null?void 0:e.institute_letter_bottom_padding)??15,h=A.top&&A.top>n?A.top:n,x=A.bottom&&A.bottom>r?A.bottom:r,M={toName:(e==null?void 0:e.client_name_manual)||(e==null?void 0:e.client_name_np)||(e==null?void 0:e.client_name)||"",toAddress:(e==null?void 0:e.client_address_manual)||(e==null?void 0:e.client_address_np)||(e==null?void 0:e.client_address)||"",firmPhone:(e==null?void 0:e.institute_phone)||"",fyNp:e!=null&&e.fy?F(e.fy):""};return m.buildHtml({fields:c,row:M,imgs:y,topMm:h,bottomMm:x,lrMm:a,inclSign:v,inclStamp:L,todayBSStr:J(),kalimatiCss:E})},[c,y,A,v,L,e,m,E]);b.useEffect(()=>{j||k(W())},[j,W]);const G=async()=>{O(!0);try{const r=document.createElement("iframe");r.style.cssText="position:fixed;left:-9999px;top:0;width:794px;height:1123px;border:none;visibility:hidden;",document.body.appendChild(r),await new Promise(l=>{r.onload=l,r.srcdoc=W()});const h=r.contentDocument;await Promise.all([...h.querySelectorAll("img")].map(l=>l.complete?Promise.resolve():new Promise(u=>{l.onload=u,l.onerror=u})));const x=h.querySelector(".page-inner");if(x){const l=h.querySelector(".sig-row");if(l&&x.scrollHeight>1113){let u=72;for(;x.scrollHeight>1113&&u>8;)u=Math.max(8,u-8),l.style.marginTop=`${u}px`}if(x.scrollHeight>1113){const u=Math.max(.5,1113/x.scrollHeight);x.style.transformOrigin="top left",x.style.transform=`scale(${u})`,x.style.width=`${Math.round(100/u)}%`}}const{default:M}=await w(async()=>{const{default:l}=await import("./html2canvas.esm-CBrSDip1.js");return{default:l}},[]),{jsPDF:B}=await w(async()=>{const{jsPDF:l}=await import("./jspdf.es.min-BV2Qwvrj.js").then(u=>u.j);return{jsPDF:l}},__vite__mapDeps([0,1,2,3])),P=new B({unit:"mm",format:"a4",orientation:"portrait"}),H=h.querySelectorAll(".page");for(let l=0;l<H.length;l++){const u=await M(H[l],{scale:2,useCORS:!0,allowTaint:!0,backgroundColor:"#fff",width:794,height:1123,windowWidth:794,windowHeight:1123});l>0&&P.addPage(),P.addImage(u.toDataURL("image/jpeg",.95),"JPEG",0,0,210,297)}document.body.removeChild(r),U(l=>(l&&URL.revokeObjectURL(l),P.output("bloburl")))}finally{O(!1)}},q=()=>{var a;try{const n=(a=K.current)==null?void 0:a.contentWindow;if(n){n.focus(),n.print();return}}catch{}$&&window.open($,"_blank","noopener")},X=m.fieldOrder.filter(a=>m.fields[a]);return i.jsxs("div",{style:{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",zIndex:1200,display:"flex",flexDirection:"column"},children:[i.jsxs("div",{style:{display:"flex",alignItems:"center",gap:12,padding:"10px 20px",background:"var(--surface)",borderBottom:"1px solid var(--border)",flexShrink:0},children:[i.jsx("div",{style:{fontWeight:700,fontSize:16,color:"var(--text)"},children:"Letter Builder"}),i.jsx("div",{style:{fontSize:12,color:"var(--text3)",padding:"3px 10px",borderRadius:100,background:"var(--bg)",border:"1px solid var(--border)"},children:m.name}),f&&f.length>0&&i.jsxs("select",{value:p??"",onChange:a=>_(Number(a.target.value)),style:{padding:"6px 10px",borderRadius:8,border:"1px solid var(--border)",background:"var(--surface)",color:"var(--text)",fontSize:13,fontFamily:"inherit",flex:1,maxWidth:280,cursor:"pointer"},children:[i.jsx("option",{value:"",children:"— Select firm —"}),f.map(a=>i.jsxs("option",{value:a.id,children:[a.institute_name,a.client_short?` → ${a.client_short}`:""]},a.id))]}),i.jsxs("div",{style:{display:"flex",gap:8,marginLeft:"auto"},children:[i.jsxs("label",{style:{display:"flex",alignItems:"center",gap:6,fontSize:12,cursor:"pointer",color:"var(--text2)"},children:[i.jsx("input",{type:"checkbox",checked:L,onChange:a=>g(a.target.checked),style:{accentColor:"var(--primary)"}})," छाप"]}),i.jsxs("label",{style:{display:"flex",alignItems:"center",gap:6,fontSize:12,cursor:"pointer",color:"var(--text2)"},children:[i.jsx("input",{type:"checkbox",checked:v,onChange:a=>N(a.target.checked),style:{accentColor:"var(--primary)"}})," हस्ताक्षर"]})]}),i.jsx(Z,{className:"btn btn-primary",onClick:G,disabled:j||C,style:{minWidth:130,fontSize:13},children:C?"Generating…":"Generate PDF"}),i.jsx("button",{onClick:o,style:{background:"none",border:"none",cursor:"pointer",fontSize:22,lineHeight:1,color:"var(--text3)",padding:"0 4px"},children:"×"})]}),i.jsxs("div",{style:{display:"flex",flex:1,overflow:"hidden"},children:[i.jsxs("div",{style:{width:340,flexShrink:0,overflowY:"auto",padding:20,borderRight:"1px solid var(--border)",background:"var(--bg)",display:"flex",flexDirection:"column",gap:14},children:[j&&i.jsx("div",{style:{color:"var(--text3)",fontSize:13},children:"Loading images…"}),!j&&X.map(a=>{const n=m.fields[a];return i.jsxs("div",{children:[i.jsx("div",{style:{fontSize:11,fontWeight:600,color:"var(--text3)",marginBottom:4,textTransform:"uppercase",letterSpacing:.5},children:n.label}),n.multiline?i.jsx("textarea",{value:c[a]??"",onChange:r=>S(h=>({...h,[a]:r.target.value})),rows:3,style:{width:"100%",padding:"8px 10px",border:"1px solid var(--border)",borderRadius:6,fontSize:13,fontFamily:"Kalimati,Noto Sans Devanagari,Arial Unicode MS,sans-serif",resize:"vertical",background:"var(--surface)",color:"var(--text)",outline:"none",lineHeight:1.7}}):i.jsx("input",{value:c[a]??"",onChange:r=>S(h=>({...h,[a]:r.target.value})),style:{width:"100%",padding:"8px 10px",border:"1px solid var(--border)",borderRadius:6,fontSize:13,fontFamily:"Kalimati,Noto Sans Devanagari,Arial Unicode MS,sans-serif",background:"var(--surface)",color:"var(--text)",outline:"none"}})]},a)})]}),i.jsx("div",{style:{flex:1,overflow:"auto",background:"#666",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:24},children:j?i.jsx("div",{style:{color:"#fff",fontSize:14,marginTop:60},children:"Loading…"}):i.jsx("iframe",{ref:V,srcDoc:z,style:{width:794,height:1123,border:"none",boxShadow:"0 4px 24px rgba(0,0,0,.4)",background:"#fff",flexShrink:0},title:"Letter Preview"})})]}),$&&i.jsxs("div",{style:{position:"fixed",inset:0,background:"rgba(0,0,0,.65)",zIndex:1400,display:"flex",flexDirection:"column"},children:[i.jsxs("div",{style:{display:"flex",alignItems:"center",gap:10,padding:"10px 20px",background:"var(--surface)",borderBottom:"1px solid var(--border)",flexShrink:0},children:[i.jsx("div",{style:{fontWeight:700,fontSize:16,color:"var(--text)"},children:"Letter Preview"}),i.jsxs("div",{style:{marginLeft:"auto",display:"flex",gap:8,alignItems:"center"},children:[i.jsxs(Z,{className:"btn btn-secondary",onClick:q,children:[i.jsx("span",{className:"material-icons-round",style:{fontSize:16},children:"print"})," Print"]}),i.jsxs("a",{href:$,download:"shortlist-letter.pdf",className:"btn btn-primary",style:{textDecoration:"none",display:"inline-flex",alignItems:"center",gap:6},children:[i.jsx("span",{className:"material-icons-round",style:{fontSize:16},children:"download"})," Download"]}),i.jsx("button",{onClick:()=>{URL.revokeObjectURL($),U(null)},style:{background:"none",border:"none",cursor:"pointer",fontSize:22,lineHeight:1,color:"var(--text3)",padding:"0 4px"},children:"×"})]})]}),i.jsx("iframe",{ref:K,src:$,title:"Letter PDF preview",style:{flex:1,border:"none",background:"#666",width:"100%"}})]})]})}export{fe as default};

const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/jspdf.es.min-CuPPTn_D.js","assets/index-C-q_437l.js","assets/vendor-tAaa2TlE.js","assets/index-CTfNwfHc.css"])))=>i.map(i=>d[i]);
import{t as R,a as ne,j as i,B as J,_ as X,l as Z}from"./index-C-q_437l.js";import{r as b}from"./vendor-tAaa2TlE.js";function Q(){const t=new Date;let l=2e3,c=0,o=new Date(1943,3,14);for(let m=2e3;m<=2090;m++){const f=(Z[m]||[]).reduce((r,_)=>r+_,0),g=new Date(o.getTime()+f*864e5);if(g>t){l=m,c=Math.floor((t-o)/864e5);break}o=g}const p=Z[l]||[];let y=1,e=c+1;for(let m=0;m<p.length;m++){if(e<=p[m]){y=m+1;break}e-=p[m]}return`${R(l)}/${R(String(y).padStart(2,"0"))}/${R(String(e).padStart(2,"0"))}`}async function U(t){if(!t)return null;if(t.startsWith("data:"))return t;try{const l=await fetch(t);if(!l.ok)return t;const c=await l.blob();return new Promise(o=>{const p=new FileReader;p.onload=()=>o(p.result),p.onerror=()=>o(t),p.readAsDataURL(c)})}catch{return t}}async function le(t){return t?new Promise(l=>{const c=new Image;c.onload=()=>{try{const o=document.createElement("canvas");o.width=c.naturalWidth,o.height=c.naturalHeight;const p=o.getContext("2d");p.drawImage(c,0,0);const y=o.width,e=o.height,m=Math.max(1,Math.floor(y/30)),u=r=>{let _=0;for(let x=0;x<y;x+=m){const v=p.getImageData(x,r,1,1).data;v[3]>50&&(v[0]<220||v[1]<220||v[2]<220)&&_++}return _};let f=null;for(let r=Math.floor(e*.6);r>=0;r--)if(u(r)>=3){f=Math.ceil(r/e*297)+8;break}let g=null;for(let r=Math.floor(e*.6);r<e;r++)if(u(r)>=3){g=Math.ceil((e-r)/e*297)+8;break}l({top:f,bottom:g})}catch{l({top:null,bottom:null})}},c.onerror=()=>l({top:null,bottom:null}),c.src=t}):{top:null,bottom:null}}function w({fields:t,imgs:l,topMm:c,bottomMm:o,lrMm:p,inclSign:y,inclStamp:e,todayBSStr:m}){const{firmLetterhead:u,firmSign:f,firmStamp:g,firmName:r}=l,_=!!u,x=t.date||m,v=t.toTitle||"कार्यालय प्रमुख",E=t.toName||"",C=t.toName2||"",A=t.toAddress||"",I=t.fy||"",S=(t.body||"").replace(/\{fy\}/g,I),M=(t.bullets||"").split(`
`).filter(Boolean),N=t.sectionHeader||"",P=t.signatoryName||l.firmContactNp||"",L=t.firmNameNp||l.firmNameNp||r||"";return`<!DOCTYPE html><html lang="ne"><head><meta charset="UTF-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Kalimati&display=swap">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#fff; font-family:'Kalimati','Noto Sans Devanagari','Arial Unicode MS',sans-serif; }
  .page {
    width:794px; height:1123px; position:relative; overflow:hidden;
    font-family:'Kalimati','Noto Sans Devanagari','Arial Unicode MS',sans-serif; font-size:13px;
    background-color:#fff;
    ${_?`background-image:url("${u}");background-repeat:no-repeat;background-position:0 0;background-size:794px 1123px;`:""}
  }
  .page-inner { position:relative;z-index:1;padding:${c}mm ${p}mm ${o}mm ${p}mm; }
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

  <div class="ref-row"><span>मिति: ${x}</span></div>

  <div class="to-block">
    <div>श्री ${v} ज्यू,</div>
    ${E?`<div>${E}</div>`:""}
    ${C?`<div>${C}</div>`:""}
    ${A?`<div>${A}</div>`:""}
  </div>

  <div class="subject">विषय: ${t.subject||""}</div>
  <div class="body-txt">महोदय,</div>
  <div class="body-txt">${S}</div>
  <div class="tapasil">तपसिल:</div>
  ${N?`<div class="sec-hdr">${N}</div>`:""}
  <ul class="bullets">
    ${M.map(D=>`<li>${D}</li>`).join(`
    `)}
  </ul>

  <div class="sig-row">
    <div class="sig-stamp">
      ${e&&g?`<img src="${g}" style="width:26mm;height:26mm;object-fit:contain;display:block;margin:0 auto;">`:""}
    </div>
    <div class="sig-block">
      ${y&&f?`<img src="${f}" style="display:block;margin:0 auto;max-height:14mm;max-width:100%;object-fit:contain;margin-bottom:4px;">`:""}
      <div class="sig-line">${P}<br>${L}</div>
    </div>
  </div>

</div></div>
</body></html>`}const se={fields:{date:{label:"मिति (BS Date)",value:""},ref:{label:"संख्या / Ref. No.",value:""},lrPadding:{label:"Left / Right Margin (mm)",value:"20"},toName:{label:"To: Name (प्रापक नाम)",value:""},toAddress:{label:"To: Address (ठेगाना)",value:""},toTitle:{label:"To Title (पद)",value:"कार्यालय प्रमुख"},subject:{label:"Subject (विषय)",value:"मौजुदा सूचीमा दर्ता गरी पाऊँ।",multiline:!0},body:{label:"Body Paragraph",multiline:!0,value:"सार्वजनिक खरिद नियमावली, २०६४ को नियम १८ को उपनियम (१) बमोजिम तपशिलमा उल्लेखित विवरण अनुसारको पृष्ठाई गर्ने कागजात संलग्न गरी मौजुदा सूचीमा दर्ता हुन यो निवेदन पेश गरेको छु।"},tapasil:{label:"तपशिल Label",value:"तपशिल:"},serviceType:{label:"Service Type (सेवा प्रकार)",value:"सीपमूलक तथा व्यावसायिक तालिम कार्यक्रमहरु सञ्चालन",multiline:!0},firmNameNp:{label:"Firm Name (Nepali)",value:""},firmAcronym:{label:"Firm Acronym",value:""},firmAddressNp:{label:"Firm Address (Nepali)",value:""},firmContact:{label:"Contact Person (Nepali)",value:""},firmPhone:{label:"Phone / टेलिफोन",value:""},mobileNo:{label:"Mobile No. (मोबाईल)",value:""},fy:{label:"आ.व. (Fiscal Year)",value:""},applicantName:{label:"Applicant Name (निवेदकको नाम)",value:""},sec1Header:{label:"Section १ Header",multiline:!0,value:"मौजुदा सूचीको लागि निवेदन दिने व्यक्ति, संस्था, आपूर्तिकर्ता, निर्माण व्यवसायी, परामर्शदाता वा सेवा प्रदायकको विवरण:"},sec2Header:{label:"Section २ Header",multiline:!0,value:"मौजुदा सूचीमा दर्ता हुनको लागि निम्न बमोजिमको प्रमाणपत्र संलग्न गर्नुहोला।"},sec2Items:{label:"Section २ Checklist (one per line)",multiline:!0,value:`(क) संस्था वा फर्म दर्ताको प्रमाणपत्र  छ ☑  छैन □
(ख) नविकरण गरिएको  छ ☑  छैन □
(ग) मूल्य अभिवृद्धि कर वा स्थायी लेखा नम्बर दर्ताको प्रमाणपत्र  छ ☑  छैन □
(घ) कर चुक्ताको प्रमाणपत्र  छ ☑  छैन □
(ड) कुन खरिदको लागि मौजुदार सूचीमा दर्ता हुन निवेदन दिने हो, सो कामको लागि इजाजत पत्र आवश्यक पत्ने भएमा सो को प्रतिलिपि  छ ☑  छैन □`},sec3Header:{label:"Section ३ Header",multiline:!0,value:"सार्वजनिक निकायबाट हुने खरिदको लागि दर्ता हुन चाहेको खरिदको प्रकृतिको विवरण:"},supplyLabel:{label:"(क) Supply Label",value:"(क) मालसामान आपूर्ति:"},supplyValue:{label:"(क) Supply Value",value:"",multiline:!0},constructionLabel:{label:"(ख) Construction Label",value:"(ख) निर्माण कार्य"},constructionValue:{label:"(ख) Construction Value",value:"",multiline:!0},consultingLabel:{label:"(ग) Consulting Label",value:"(ग) परामर्श सेवा:"},otherServiceLabel:{label:"(घ) Other Service Label",value:"(घ) अन्य सेवा:"},otherServiceValue:{label:"(घ) Other Service Value",value:"",multiline:!0},dateLabel:{label:"Date Label (bottom)",value:"निवेदन दिएको मिति:"},fyLabel:{label:"FY Label (bottom)",value:"आ.व.:"},stampLabel:{label:"Stamp Label",value:"फर्मको छाप:"},applicantLabel:{label:"Applicant Label",value:"निवेदकको नाम:"},signLabel:{label:"Signature Label",value:"हस्ताक्षर:"}}},oe=["date","ref","lrPadding","toTitle","toName","toAddress","subject","body","tapasil","firmNameNp","firmAcronym","firmAddressNp","firmContact","firmPhone","mobileNo","fy","applicantName","sec1Header","sec2Header","sec2Items","sec3Header","supplyLabel","supplyValue","constructionLabel","constructionValue","consultingLabel","serviceType","otherServiceLabel","otherServiceValue","dateLabel","fyLabel","stampLabel","applicantLabel","signLabel"],ee={date:{label:"मिति (BS Date)",value:""},lrPadding:{label:"Left / Right Margin (mm)",value:"20"},toTitle:{label:"Addressee Title (पद)",value:"कार्यालय प्रमुख"},toName:{label:"Organization Name",value:""},toName2:{label:"Department / Level 2 (optional)",value:""},toAddress:{label:"Address",value:""},subject:{label:"Subject (विषय)",value:"सूचीदर्ता गरिदिने बारे"},body:{label:"Body Paragraph",multiline:!0,value:"उपरोक्त सम्बन्धमा तहाँ विभागको सूचना अनुसार आ.व. {fy} को लागि यस कम्पनीलाई तपसिल अनुसारको सेवा प्रदान गर्ने प्रयोजनका लागि मौजुदा सूचीमा सूचीकृत गरिदिनुहुन अनुरोध गर्दछु।"},fy:{label:"आ.व. (Fiscal Year)",value:""},sectionHeader:{label:"Section Header",value:""},bullets:{label:"Bullet Points (one per line)",multiline:!0,value:""},signatoryName:{label:"Signatory Name",value:""},firmNameNp:{label:"Firm Name (Nepali)",value:""}},te=["date","lrPadding","toTitle","toName","toName2","toAddress","subject","body","fy","sectionHeader","bullets","signatoryName","firmNameNp"],ae={basic:{name:"Basic Shortlisting",fields:se.fields,fieldOrder:oe,buildHtml:re},nea_ssemd:{name:"NEA SSEMD",fields:{...ee,sectionHeader:{label:"Section Header",value:"(ख) परामर्श सेवा :"},bullets:{label:"Bullet Points (one per line)",multiline:!0,value:`समूह (१) : वातावरणीय अध्ययन तर्फ : वातावरणीय अध्ययन कार्यको लागि आवश्यक कार्यसूची (ToR) तथा क्षेत्र निर्धारण (Scoping) सम्बन्धी कार्य, संक्षिप्त वातावरणीय अध्ययन (BES), प्रारम्भिक वातावरणीय परीक्षण (IEE) तथा वातावरणीय प्रभाव मूल्याङ्कन (EIA) वन्यजन्तु, चराचुरुङ्गी एवं जैविक विविधता सम्बन्धि विषयगत अध्ययन कार्य ।
समूह (२) : वातावरणीय तथा सामाजिक अनुगमन सम्बन्धि कार्य : सामाजिक तथा वातावरणीय पक्षको अनुगमन कार्य, वातावरणीय व्यवस्थापन योजना (EMP) सम्बन्धि कार्य, पुर्नवास तथा पुर्नस्थापना कार्य योजना (RRAP) सम्बन्धी कार्य एवं आयोजनाको बाह्य (तेस्रो पक्ष) अनुगमन तथा मूल्यांकन सम्बन्धी कार्य ।
समूह (३) : आयोजना स्थलमा संचालन हुने वातावरणीय तथा सामाजिक अनुगमन इकाई (ESMU) का लागि वातावरण, समाजिक, लैङ्गिक विज्ञ तथा अन्य जनशक्ति आपूर्ति सम्बन्धी सेवा । आयोजना स्थलमा सञ्चालन गर्नुपर्ने जनचेतनामूलक तथा अन्य कार्य: सामाजिक, वन संरक्षण तथा वन्यजन्तु संरक्षण सम्बन्धी सचेतनामूलक कार्यक्रम, आय आर्जन सम्बन्धी कार्यक्रम, लैङ्गिक समानता तथा सामाजिक समावेशीकरण सम्बन्धी कार्य ।
समूह (४) : सिपमुलक तालिम : छोटो अवधिको ड्राइभिङ, हाउस वायरिङ, प्लम्बिङ्ग, वेल्डिङ्ग, मर्मत सम्भार, सिलाई, बुनाई, व्युटिपार्लर आदी सम्बन्धि कार्य ।
समूह (५) : आयोजना स्थलमा सञ्चालन गर्नुपर्ने वातावरणीय सुचकाङ्क बमोजिमको Air, Noise, Water Quality मापन सम्बन्धी कार्य ।`}},fieldOrder:te,buildHtml:w},nea_essd:{name:"NEA ESSD",fields:{...ee,sectionHeader:{label:"Section Header",value:"१) परामर्श सेवा आपूर्ति तर्फ:"},bullets:{label:"Bullet Points (one per line)",multiline:!0,value:`समूह-क:- वातावरणीय तथा सामाजिक अध्ययन कार्य: प्रारम्भिक वातावरणीय परीक्षणको कार्यसूची (ToR), प्रारम्भिक वातावरणीय परीक्षण कार्य (IEE) वातावरणीय प्रभाव मूल्यांकनको लागि क्षेत्र निर्धारण (Scoping) तथा कार्यसुची (ToR)' तयार गर्ने कार्य, वातावरणीय प्रभाव मूल्यांकन कार्य (EIA), विषयगत अध्ययन कार्य (माछा, वन्यजन्तु, वन तथा वनस्पति, भौतिक वातावरण, सामाजिक, आर्थिक आदि) तथा दातृ संस्थाहरुको लागि गरिने सामाजिक प्रभाव मूल्याङ्कन (SIA), पुनर्वास कार्य योजना (RAP) उत्पीडित समुदाय विकास योजना (VCDP) तथा वातावरणीय व्यवस्थापन कार्य योजना (EMAP) आयोजनाको अध्ययन अनुगमनको लागि विज्ञहरुको सेवा खरिद आदि ।
समूह ख :- आयोजना स्थलमा संचालन गर्नुपर्ने जनचेतना तथा अन्य कार्य: सामाजिक सचेतना कार्यक्रम, वन संरक्षण सचेतना कार्यहरु, वन्यजन्तु संरक्षण सचेतना कार्यक्रम, आय आर्जन सम्बन्धी आदि ।
समूह ग: सीपमुलक तालिम: छोटो अवधिको ड्राइभिङ्ग, हाउस वायरिङ्ग, प्लम्बिङ्ग, वेल्डिङ्ग, सिलाई, बुनाई मर्मत संभार आदि ।
समूह घ: आयोजना स्थलमा संचालन गर्नुपर्ने: Air, Noise, Water Quality मापन सम्बन्धी कार्य ।`}},fieldOrder:te,buildHtml:w}};function re({fields:t,row:l,imgs:c,topMm:o,bottomMm:p,lrMm:y,inclSign:e,inclStamp:m,todayBSStr:u}){const{firmLogo:f,firmLetterhead:g,firmSign:r,firmStamp:_,firmRegNo:x,firmPan:v,firmMeta:E,firmName:C}=c,A=!!g,I=t.date||u,S=t.ref||"",M=t.toName||l.toName||"",N=t.toAddress||l.toAddress||"",P=t.firmNameNp||c.firmNameNp||C||"",L=t.firmAcronym||c.firmAcronym||"",D=t.firmAddressNp||c.firmAddressNp||"",$=t.firmContact||c.firmContactNp||"",B=t.firmPhone||l.firmPhone||"",V=t.mobileNo||"",F=t.fy||l.fyNp||"",O=t.applicantName||$||"",W=t.sec1Header||"",Y=t.sec2Header||"",G=(t.sec2Items||"").split(`
`).filter(Boolean),a=t.sec3Header||"",n=t.supplyLabel||"",d=t.supplyValue||"",h=t.constructionLabel||"",k=t.constructionValue||"",T=t.consultingLabel||"",z=t.otherServiceLabel||"",H=t.otherServiceValue||"",s=t.dateLabel||"",j=t.fyLabel||"",K=t.stampLabel||"",q=t.applicantLabel||"",ie=t.signLabel||"";return`<!DOCTYPE html><html lang="ne"><head><meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#fff; }
  .page {
    width:794px; height:1123px; position:relative; padding:0; overflow:hidden;
    font-family:'Kalimati','Noto Sans Devanagari','Arial Unicode MS',sans-serif; font-size:13px;
    background-color:#fff;
    ${A?`/* longhand: html2canvas drops background-size from the shorthand */
    background-image:url("${g}");
    background-repeat:no-repeat;
    background-position:0 0;
    background-size:794px 1123px;`:""}
  }
  .page-inner { position:relative;z-index:1;padding:${o}mm ${y}mm ${p}mm ${y}mm; }
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
  ${A?"":`
  ${x||v?`<div class="lh-regpan"><span>${x?"Govt. Regd.No. "+x:""}</span><span>${v?"PAN No. "+v:""}</span></div>`:""}
  <div class="lh-center">
    ${f?`<img src="${f}" class="lh-logo" alt="">`:""}
    <div class="lh-name">${P}${L&&L!==P?` (${L})`:""}</div>
    ${E?`<div class="lh-meta">${E}</div>`:""}
  </div>
  <div class="lh-border"></div>`}

  <div class="ref-row">
    ${S?`<span>संख्या: ${S}</span>`:"<span></span>"}
    <span>मिति: ${I}</span>
  </div>
  <div class="to-block">
    <div>श्री ${t.toTitle} ज्यू,</div>
    <div>${M}</div>
    ${N?`<div>${N}</div>`:""}
  </div>
  <div class="subject">विषय: ${t.subject}</div>
  <div class="body-txt">${t.body}</div>
  <div class="tapasil">${t.tapasil}</div>

  <table>
    <tr><td colspan="2" class="hdr">१. ${W}</td></tr>
    <tr>
      <td class="half">(क) नाम: ${P}${L?" ("+L+")":""}</td>
      <td class="half">(ख) ठेगाना: ${D}</td>
    </tr>
    <tr>
      <td class="half">(ग) पत्राचार गर्ने ठेगाना: ${D}</td>
      <td class="half">(घ) मुख्य व्यक्तिको नाम: ${$}</td>
    </tr>
    <tr>
      <td class="half">(ड) टेलिफोन नं: ${B?R(B):""}</td>
      <td class="half">(च) मोबाईल नं: ${V}</td>
    </tr>
    <tr><td colspan="2" class="hdr">२. ${Y}</td></tr>
    <tr><td colspan="2" style="padding:6px 10px;line-height:1.95;">
      ${G.join("<br>")}
    </td></tr>
    <tr><td colspan="2" class="hdr">३. ${a}</td></tr>
    <tr><td colspan="2" style="padding:0;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td class="w22" style="border:none;border-right:1px solid #666;border-bottom:1px solid #666;padding:5px 8px;">${n}</td>
          <td class="tall" style="border:none;border-right:1px solid #666;border-bottom:1px solid #666;padding:5px 8px;">${d}</td>
          <td class="w22" style="border:none;border-right:1px solid #666;border-bottom:1px solid #666;padding:5px 8px;">${h}</td>
          <td class="tall" style="border:none;border-bottom:1px solid #666;padding:5px 8px;">${k}</td>
        </tr>
        <tr>
          <td class="w22" style="border:none;border-right:1px solid #666;padding:5px 8px;">${T}</td>
          <td style="border:none;border-right:1px solid #666;padding:5px 8px;">${t.serviceType}</td>
          <td class="w22" style="border:none;border-right:1px solid #666;padding:5px 8px;">${z}</td>
          <td class="tall" style="border:none;padding:5px 8px;">${H}</td>
        </tr>
      </table>
    </td></tr>
    <tr><td colspan="2" style="padding:0;">
      <div style="display:flex;min-height:100px;">
        <div style="flex:0 0 34%;padding:8px 10px;border-right:1px solid #666;line-height:2;font-size:10pt;">
          <div>${s} ${I}</div>
          ${F?`<div>${j} ${F}</div>`:""}
        </div>
        <div style="flex:0 0 32%;border-right:1px solid #666;text-align:center;padding:6px 4px;">
          ${m&&_?`<div style="font-size:9pt;margin-bottom:3px;">${K}</div><img src="${_}" style="display:block;margin:0 auto;width:30mm;height:30mm;object-fit:contain;background:#fff;">`:""}
        </div>
        <div style="flex:1;padding:8px 10px;font-size:10pt;line-height:2;">
          <div>${q} ${O}</div>
          ${e&&r?`<div style="margin-top:4px;">${ie} <img src="${r}" style="display:inline-block;vertical-align:middle;margin-left:4px;max-height:20mm;max-width:100%;width:auto;height:auto;object-fit:contain;"></div>`:""}
        </div>
      </div>
    </td></tr>
  </table>
  </div>
</div>
</body></html>`}function pe({row:t,token:l,onClose:c,allRows:o}){const[p,y]=b.useState((t==null?void 0:t.id)??null),e=o&&p&&o.find(a=>a.id===p)||t,m=(e==null?void 0:e.list_letter_type)||(e==null?void 0:e.letter_type)||"basic",u=ae[m]||ae.basic,[f,g]=b.useState(()=>{const a=Object.fromEntries(Object.entries(u.fields).map(([n,d])=>[n,d.value]));return a.date=Q(),a}),[r,_]=b.useState(!!(e!=null&&e.institute_sign)),[x,v]=b.useState(!!(e!=null&&e.institute_stamp)),[E,C]=b.useState(""),[A,I]=b.useState(null),[S,M]=b.useState({top:null,bottom:null}),[N,P]=b.useState(!0),[L,D]=b.useState(!1),[$,B]=b.useState(null),V=b.useRef(null),F=b.useRef(null);b.useEffect(()=>()=>{$&&URL.revokeObjectURL($)},[$]),b.useEffect(()=>{g(a=>{var n,d;return{...Object.fromEntries(Object.entries(u.fields).map(([h,k])=>[h,k.value])),date:a.date||Q(),lrPadding:String((e==null?void 0:e.institute_letter_lr_padding)??20),toTitle:(e==null?void 0:e.list_addressee)||(e==null?void 0:e.client_signatory_position)||((n=u.fields.toTitle)==null?void 0:n.value)||"कार्यालय प्रमुख",toName:(e==null?void 0:e.client_name_manual)||(e==null?void 0:e.client_name_np)||(e==null?void 0:e.client_name)||"",toName2:(e==null?void 0:e.list_client_name2)||"",toAddress:(e==null?void 0:e.client_address_manual)||(e==null?void 0:e.client_address_np)||(e==null?void 0:e.client_address)||"",serviceType:(e==null?void 0:e.institute_service_type)||((d=u.fields.serviceType)==null?void 0:d.value)||"",firmNameNp:(e==null?void 0:e.institute_name_np)||(e==null?void 0:e.institute_name)||"",firmAcronym:(e==null?void 0:e.institute_acronym)||"",firmAddressNp:(e==null?void 0:e.institute_address_np)||(e==null?void 0:e.institute_address)||"",firmContact:(e==null?void 0:e.institute_contact_np)||(e==null?void 0:e.institute_contact)||"",firmPhone:(e==null?void 0:e.institute_phone)||"",fy:e!=null&&e.fy?R(e.fy):"",applicantName:(e==null?void 0:e.institute_contact_np)||(e==null?void 0:e.institute_contact)||"",signatoryName:(e==null?void 0:e.institute_contact_np)||(e==null?void 0:e.institute_contact)||""}})},[e==null?void 0:e.id,m]),b.useEffect(()=>{let a=!1;return(async()=>{P(!0);let n={};if(e!=null&&e.institute_id&&l)try{n=await ne("GET",`/institutes/${e.institute_id}`,null,l)||{}}catch{}if(a)return;_(!!n.sign),v(!!n.stamp);const[d,h,k,T]=await Promise.all([U(n.logo||(e==null?void 0:e.institute_logo)||null),U(n.letterhead||(e==null?void 0:e.institute_letterhead)||null),U(n.sign||(e==null?void 0:e.institute_sign)||null),U(n.stamp||(e==null?void 0:e.institute_stamp)||null)]);if(a)return;const z=(e==null?void 0:e.institute_name)||"",H=(e==null?void 0:e.institute_address)||"",s=(e==null?void 0:e.institute_phone)||"",j=(e==null?void 0:e.institute_email)||"",K=(e==null?void 0:e.institute_website)||"";I({firmName:z,firmAcronym:(e==null?void 0:e.institute_acronym)||"",firmNameNp:(e==null?void 0:e.institute_name_np)||z,firmAddressNp:(e==null?void 0:e.institute_address_np)||H,firmContactNp:(e==null?void 0:e.institute_contact_np)||(e==null?void 0:e.institute_contact)||"",firmMeta:[H,s?`फोन: ${s}`:"",j,K].filter(Boolean).join("  |  "),firmRegNo:(e==null?void 0:e.institute_reg_no)||"",firmPan:(e==null?void 0:e.institute_pan)||"",firmPhone:s,firmLogo:d,firmLetterhead:h,firmSign:k,firmStamp:T});const q=await le(h);a||(M(q),P(!1))})(),()=>{a=!0}},[e==null?void 0:e.id,e==null?void 0:e.institute_id,l]);const O=b.useCallback(()=>{if(!A)return"";const a=parseFloat(f.lrPadding)||(e==null?void 0:e.institute_letter_lr_padding)||20,n=(e==null?void 0:e.institute_letter_top_margin)??15,d=(e==null?void 0:e.institute_letter_bottom_padding)??15,h=S.top&&S.top>n?S.top:n,k=S.bottom&&S.bottom>d?S.bottom:d,T={toName:(e==null?void 0:e.client_name_manual)||(e==null?void 0:e.client_name_np)||(e==null?void 0:e.client_name)||"",toAddress:(e==null?void 0:e.client_address_manual)||(e==null?void 0:e.client_address_np)||(e==null?void 0:e.client_address)||"",firmPhone:(e==null?void 0:e.institute_phone)||"",fyNp:e!=null&&e.fy?R(e.fy):""};return u.buildHtml({fields:f,row:T,imgs:A,topMm:h,bottomMm:k,lrMm:a,inclSign:r,inclStamp:x,todayBSStr:Q()})},[f,A,S,r,x,e,u]);b.useEffect(()=>{N||C(O())},[N,O]);const W=async()=>{D(!0);try{const d=document.createElement("iframe");d.style.cssText="position:fixed;left:-9999px;top:0;width:794px;height:1123px;border:none;visibility:hidden;",document.body.appendChild(d),await new Promise(s=>{d.onload=s,d.srcdoc=O()});const h=d.contentDocument;await Promise.all([...h.querySelectorAll("img")].map(s=>s.complete?Promise.resolve():new Promise(j=>{s.onload=j,s.onerror=j})));const{default:k}=await X(async()=>{const{default:s}=await import("./html2canvas.esm-CBrSDip1.js");return{default:s}},[]),{jsPDF:T}=await X(async()=>{const{jsPDF:s}=await import("./jspdf.es.min-CuPPTn_D.js").then(j=>j.j);return{jsPDF:s}},__vite__mapDeps([0,1,2,3])),z=new T({unit:"mm",format:"a4",orientation:"portrait"}),H=h.querySelectorAll(".page");for(let s=0;s<H.length;s++){const j=await k(H[s],{scale:2,useCORS:!0,allowTaint:!0,backgroundColor:"#fff",width:794,height:1123,windowWidth:794,windowHeight:1123});s>0&&z.addPage(),z.addImage(j.toDataURL("image/jpeg",.95),"JPEG",0,0,210,297)}document.body.removeChild(d),B(s=>(s&&URL.revokeObjectURL(s),z.output("bloburl")))}finally{D(!1)}},Y=()=>{var a;try{const n=(a=F.current)==null?void 0:a.contentWindow;if(n){n.focus(),n.print();return}}catch{}$&&window.open($,"_blank","noopener")},G=u.fieldOrder.filter(a=>u.fields[a]);return i.jsxs("div",{style:{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",zIndex:1200,display:"flex",flexDirection:"column"},children:[i.jsxs("div",{style:{display:"flex",alignItems:"center",gap:12,padding:"10px 20px",background:"var(--surface)",borderBottom:"1px solid var(--border)",flexShrink:0},children:[i.jsx("div",{style:{fontWeight:700,fontSize:16,color:"var(--text)"},children:"Letter Builder"}),i.jsx("div",{style:{fontSize:12,color:"var(--text3)",padding:"3px 10px",borderRadius:100,background:"var(--bg)",border:"1px solid var(--border)"},children:u.name}),o&&o.length>0&&i.jsxs("select",{value:p??"",onChange:a=>y(Number(a.target.value)),style:{padding:"6px 10px",borderRadius:8,border:"1px solid var(--border)",background:"var(--surface)",color:"var(--text)",fontSize:13,fontFamily:"inherit",flex:1,maxWidth:280,cursor:"pointer"},children:[i.jsx("option",{value:"",children:"— Select firm —"}),o.map(a=>i.jsxs("option",{value:a.id,children:[a.institute_name,a.client_short?` → ${a.client_short}`:""]},a.id))]}),i.jsxs("div",{style:{display:"flex",gap:8,marginLeft:"auto"},children:[i.jsxs("label",{style:{display:"flex",alignItems:"center",gap:6,fontSize:12,cursor:"pointer",color:"var(--text2)"},children:[i.jsx("input",{type:"checkbox",checked:x,onChange:a=>v(a.target.checked),style:{accentColor:"var(--primary)"}})," छाप"]}),i.jsxs("label",{style:{display:"flex",alignItems:"center",gap:6,fontSize:12,cursor:"pointer",color:"var(--text2)"},children:[i.jsx("input",{type:"checkbox",checked:r,onChange:a=>_(a.target.checked),style:{accentColor:"var(--primary)"}})," हस्ताक्षर"]})]}),i.jsx(J,{className:"btn btn-primary",onClick:W,disabled:N||L,style:{minWidth:130,fontSize:13},children:L?"Generating…":"Generate PDF"}),i.jsx("button",{onClick:c,style:{background:"none",border:"none",cursor:"pointer",fontSize:22,lineHeight:1,color:"var(--text3)",padding:"0 4px"},children:"×"})]}),i.jsxs("div",{style:{display:"flex",flex:1,overflow:"hidden"},children:[i.jsxs("div",{style:{width:340,flexShrink:0,overflowY:"auto",padding:20,borderRight:"1px solid var(--border)",background:"var(--bg)",display:"flex",flexDirection:"column",gap:14},children:[N&&i.jsx("div",{style:{color:"var(--text3)",fontSize:13},children:"Loading images…"}),!N&&G.map(a=>{const n=u.fields[a];return i.jsxs("div",{children:[i.jsx("div",{style:{fontSize:11,fontWeight:600,color:"var(--text3)",marginBottom:4,textTransform:"uppercase",letterSpacing:.5},children:n.label}),n.multiline?i.jsx("textarea",{value:f[a]??"",onChange:d=>g(h=>({...h,[a]:d.target.value})),rows:3,style:{width:"100%",padding:"8px 10px",border:"1px solid var(--border)",borderRadius:6,fontSize:13,fontFamily:"Kalimati,Noto Sans Devanagari,Arial Unicode MS,sans-serif",resize:"vertical",background:"var(--surface)",color:"var(--text)",outline:"none",lineHeight:1.7}}):i.jsx("input",{value:f[a]??"",onChange:d=>g(h=>({...h,[a]:d.target.value})),style:{width:"100%",padding:"8px 10px",border:"1px solid var(--border)",borderRadius:6,fontSize:13,fontFamily:"Kalimati,Noto Sans Devanagari,Arial Unicode MS,sans-serif",background:"var(--surface)",color:"var(--text)",outline:"none"}})]},a)})]}),i.jsx("div",{style:{flex:1,overflow:"auto",background:"#666",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:24},children:N?i.jsx("div",{style:{color:"#fff",fontSize:14,marginTop:60},children:"Loading…"}):i.jsx("iframe",{ref:V,srcDoc:E,style:{width:794,height:1123,border:"none",boxShadow:"0 4px 24px rgba(0,0,0,.4)",background:"#fff",flexShrink:0},title:"Letter Preview"})})]}),$&&i.jsxs("div",{style:{position:"fixed",inset:0,background:"rgba(0,0,0,.65)",zIndex:1400,display:"flex",flexDirection:"column"},children:[i.jsxs("div",{style:{display:"flex",alignItems:"center",gap:10,padding:"10px 20px",background:"var(--surface)",borderBottom:"1px solid var(--border)",flexShrink:0},children:[i.jsx("div",{style:{fontWeight:700,fontSize:16,color:"var(--text)"},children:"Letter Preview"}),i.jsxs("div",{style:{marginLeft:"auto",display:"flex",gap:8,alignItems:"center"},children:[i.jsxs(J,{className:"btn btn-secondary",onClick:Y,children:[i.jsx("span",{className:"material-icons-round",style:{fontSize:16},children:"print"})," Print"]}),i.jsxs("a",{href:$,download:"shortlist-letter.pdf",className:"btn btn-primary",style:{textDecoration:"none",display:"inline-flex",alignItems:"center",gap:6},children:[i.jsx("span",{className:"material-icons-round",style:{fontSize:16},children:"download"})," Download"]}),i.jsx("button",{onClick:()=>{URL.revokeObjectURL($),B(null)},style:{background:"none",border:"none",cursor:"pointer",fontSize:22,lineHeight:1,color:"var(--text3)",padding:"0 4px"},children:"×"})]})]}),i.jsx("iframe",{ref:F,src:$,title:"Letter PDF preview",style:{flex:1,border:"none",background:"#666",width:"100%"}})]})]})}export{pe as default};

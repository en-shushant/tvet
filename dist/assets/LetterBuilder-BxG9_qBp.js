const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/jspdf.es.min-DseJnLL9.js","assets/index-DM6OU_Op.js","assets/vendor-tAaa2TlE.js","assets/index-CTfNwfHc.css"])))=>i.map(i=>d[i]);
import{t as C,a as te,j as n,B as J,_ as Q,l as X}from"./index-DM6OU_Op.js";import{r as u}from"./vendor-tAaa2TlE.js";function q(){const t=new Date;let c=2e3,p=0,r=new Date(1943,3,14);for(let o=2e3;o<=2090;o++){const g=(X[o]||[]).reduce((d,v)=>d+v,0),h=new Date(r.getTime()+g*864e5);if(h>t){c=o,p=Math.floor((t-r)/864e5);break}r=h}const m=X[c]||[];let x=1,e=p+1;for(let o=0;o<m.length;o++){if(e<=m[o]){x=o+1;break}e-=m[o]}return`${C(c)}/${C(String(x).padStart(2,"0"))}/${C(String(e).padStart(2,"0"))}`}async function B(t){if(!t)return null;if(t.startsWith("data:"))return t;try{const c=await fetch(t);if(!c.ok)return t;const p=await c.blob();return new Promise(r=>{const m=new FileReader;m.onload=()=>r(m.result),m.onerror=()=>r(t),m.readAsDataURL(p)})}catch{return t}}async function ae(t){return t?new Promise(c=>{const p=new Image;p.onload=()=>{try{const r=document.createElement("canvas");r.width=p.naturalWidth,r.height=p.naturalHeight;const m=r.getContext("2d");m.drawImage(p,0,0);const x=r.width,e=r.height,o=Math.max(1,Math.floor(x/30)),L=d=>{let v=0;for(let N=0;N<x;N+=o){const y=m.getImageData(N,d,1,1).data;y[3]>50&&(y[0]<220||y[1]<220||y[2]<220)&&v++}return v};let g=null;for(let d=Math.floor(e*.6);d>=0;d--)if(L(d)>=3){g=Math.ceil(d/e*297)+8;break}let h=null;for(let d=Math.floor(e*.6);d<e;d++)if(L(d)>=3){h=Math.ceil((e-d)/e*297)+8;break}c({top:g,bottom:h})}catch{c({top:null,bottom:null})}},p.onerror=()=>c({top:null,bottom:null}),p.src=t}):{top:null,bottom:null}}const O={fields:{date:{label:"मिति (BS Date)",value:""},ref:{label:"संख्या / Ref. No.",value:""},lrPadding:{label:"Left / Right Margin (mm)",value:"20"},toName:{label:"To: Name (प्रापक नाम)",value:""},toAddress:{label:"To: Address (ठेगाना)",value:""},toTitle:{label:"To Title (पद)",value:"कार्यालय प्रमुख"},subject:{label:"Subject (विषय)",value:"मौजुदा सूचीमा दर्ता गरी पाऊँ।",multiline:!0},body:{label:"Body Paragraph",multiline:!0,value:"सार्वजनिक खरिद नियमावली, २०६४ को नियम १८ को उपनियम (१) बमोजिम तपशिलमा उल्लेखित विवरण अनुसारको पृष्ठाई गर्ने कागजात संलग्न गरी मौजुदा सूचीमा दर्ता हुन यो निवेदन पेश गरेको छु।"},tapasil:{label:"तपशिल Label",value:"तपशिल:"},serviceType:{label:"Service Type (सेवा प्रकार)",value:"सीपमूलक तथा व्यावसायिक तालिम कार्यक्रमहरु सञ्चालन",multiline:!0},firmNameNp:{label:"Firm Name (Nepali)",value:""},firmAcronym:{label:"Firm Acronym",value:""},firmAddressNp:{label:"Firm Address (Nepali)",value:""},firmContact:{label:"Contact Person (Nepali)",value:""},firmPhone:{label:"Phone / टेलिफोन",value:""},mobileNo:{label:"Mobile No. (मोबाईल)",value:""},fy:{label:"आ.व. (Fiscal Year)",value:""},applicantName:{label:"Applicant Name (निवेदकको नाम)",value:""},sec1Header:{label:"Section १ Header",multiline:!0,value:"मौजुदा सूचीको लागि निवेदन दिने व्यक्ति, संस्था, आपूर्तिकर्ता, निर्माण व्यवसायी, परामर्शदाता वा सेवा प्रदायकको विवरण:"},sec2Header:{label:"Section २ Header",multiline:!0,value:"मौजुदा सूचीमा दर्ता हुनको लागि निम्न बमोजिमको प्रमाणपत्र संलग्न गर्नुहोला।"},sec2Items:{label:"Section २ Checklist (one per line)",multiline:!0,value:`(क) संस्था वा फर्म दर्ताको प्रमाणपत्र  छ ☑  छैन □
(ख) नविकरण गरिएको  छ ☑  छैन □
(ग) मूल्य अभिवृद्धि कर वा स्थायी लेखा नम्बर दर्ताको प्रमाणपत्र  छ ☑  छैन □
(घ) कर चुक्ताको प्रमाणपत्र  छ ☑  छैन □
(ड) कुन खरिदको लागि मौजुदार सूचीमा दर्ता हुन निवेदन दिने हो, सो कामको लागि इजाजत पत्र आवश्यक पत्ने भएमा सो को प्रतिलिपि  छ ☑  छैन □`},sec3Header:{label:"Section ३ Header",multiline:!0,value:"सार्वजनिक निकायबाट हुने खरिदको लागि दर्ता हुन चाहेको खरिदको प्रकृतिको विवरण:"},supplyLabel:{label:"(क) Supply Label",value:"(क) मालसामान आपूर्ति:"},supplyValue:{label:"(क) Supply Value",value:"",multiline:!0},constructionLabel:{label:"(ख) Construction Label",value:"(ख) निर्माण कार्य"},constructionValue:{label:"(ख) Construction Value",value:"",multiline:!0},consultingLabel:{label:"(ग) Consulting Label",value:"(ग) परामर्श सेवा:"},otherServiceLabel:{label:"(घ) Other Service Label",value:"(घ) अन्य सेवा:"},otherServiceValue:{label:"(घ) Other Service Value",value:"",multiline:!0},dateLabel:{label:"Date Label (bottom)",value:"निवेदन दिएको मिति:"},fyLabel:{label:"FY Label (bottom)",value:"आ.व.:"},stampLabel:{label:"Stamp Label",value:"फर्मको छाप:"},applicantLabel:{label:"Applicant Label",value:"निवेदकको नाम:"},signLabel:{label:"Signature Label",value:"हस्ताक्षर:"}}},ne=["date","ref","lrPadding","toTitle","toName","toAddress","subject","body","tapasil","firmNameNp","firmAcronym","firmAddressNp","firmContact","firmPhone","mobileNo","fy","applicantName","sec1Header","sec2Header","sec2Items","sec3Header","supplyLabel","supplyValue","constructionLabel","constructionValue","consultingLabel","serviceType","otherServiceLabel","otherServiceValue","dateLabel","fyLabel","stampLabel","applicantLabel","signLabel"];function ie({fields:t,row:c,imgs:p,topMm:r,bottomMm:m,lrMm:x,inclSign:e,inclStamp:o,todayBSStr:L}){const{firmLogo:g,firmLetterhead:h,firmSign:d,firmStamp:v,firmRegNo:N,firmPan:y,firmMeta:z,firmName:U}=p,_=!!h,R=t.date||L,$=t.ref||"",M=t.toName||c.toName||"",T=t.toAddress||c.toAddress||"",D=t.firmNameNp||p.firmNameNp||U||"",b=t.firmAcronym||p.firmAcronym||"",H=t.firmAddressNp||p.firmAddressNp||"",F=t.firmContact||p.firmContactNp||"",I=t.firmPhone||c.firmPhone||"",E=t.mobileNo||"",V=t.fy||c.fyNp||"",W=t.applicantName||F||"",G=t.sec1Header||"",a=t.sec2Header||"",i=(t.sec2Items||"").split(`
`).filter(Boolean),l=t.sec3Header||"",f=t.supplyLabel||"",A=t.supplyValue||"",k=t.constructionLabel||"",j=t.constructionValue||"",P=t.consultingLabel||"",s=t.otherServiceLabel||"",S=t.otherServiceValue||"",Y=t.dateLabel||"",K=t.fyLabel||"",Z=t.stampLabel||"",w=t.applicantLabel||"",ee=t.signLabel||"";return`<!DOCTYPE html><html lang="ne"><head><meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#fff; }
  .page {
    width:794px; height:1123px; position:relative; padding:0; overflow:hidden;
    font-family:'Kalimati','Noto Sans Devanagari','Arial Unicode MS',sans-serif; font-size:13px;
    background-color:#fff;
    ${_?`/* longhand: html2canvas drops background-size from the shorthand */
    background-image:url("${h}");
    background-repeat:no-repeat;
    background-position:0 0;
    background-size:794px 1123px;`:""}
  }
  .page-inner { position:relative;z-index:1;padding:${r}mm ${x}mm ${m}mm ${x}mm; }
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
  ${_?"":`
  ${N||y?`<div class="lh-regpan"><span>${N?"Govt. Regd.No. "+N:""}</span><span>${y?"PAN No. "+y:""}</span></div>`:""}
  <div class="lh-center">
    ${g?`<img src="${g}" class="lh-logo" alt="">`:""}
    <div class="lh-name">${D}${b&&b!==D?` (${b})`:""}</div>
    ${z?`<div class="lh-meta">${z}</div>`:""}
  </div>
  <div class="lh-border"></div>`}

  <div class="ref-row">
    ${$?`<span>संख्या: ${$}</span>`:"<span></span>"}
    <span>मिति: ${R}</span>
  </div>
  <div class="to-block">
    <div>श्री ${t.toTitle} ज्यू,</div>
    <div>${M}</div>
    ${T?`<div>${T}</div>`:""}
  </div>
  <div class="subject">विषय: ${t.subject}</div>
  <div class="body-txt">${t.body}</div>
  <div class="tapasil">${t.tapasil}</div>

  <table>
    <tr><td colspan="2" class="hdr">१. ${G}</td></tr>
    <tr>
      <td class="half">(क) नाम: ${D}${b?" ("+b+")":""}</td>
      <td class="half">(ख) ठेगाना: ${H}</td>
    </tr>
    <tr>
      <td class="half">(ग) पत्राचार गर्ने ठेगाना: ${H}</td>
      <td class="half">(घ) मुख्य व्यक्तिको नाम: ${F}</td>
    </tr>
    <tr>
      <td class="half">(ड) टेलिफोन नं: ${I?C(I):""}</td>
      <td class="half">(च) मोबाईल नं: ${E}</td>
    </tr>
    <tr><td colspan="2" class="hdr">२. ${a}</td></tr>
    <tr><td colspan="2" style="padding:6px 10px;line-height:1.95;">
      ${i.join("<br>")}
    </td></tr>
    <tr><td colspan="2" class="hdr">३. ${l}</td></tr>
    <tr><td colspan="2" style="padding:0;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td class="w22" style="border:none;border-right:1px solid #666;border-bottom:1px solid #666;padding:5px 8px;">${f}</td>
          <td class="tall" style="border:none;border-right:1px solid #666;border-bottom:1px solid #666;padding:5px 8px;">${A}</td>
          <td class="w22" style="border:none;border-right:1px solid #666;border-bottom:1px solid #666;padding:5px 8px;">${k}</td>
          <td class="tall" style="border:none;border-bottom:1px solid #666;padding:5px 8px;">${j}</td>
        </tr>
        <tr>
          <td class="w22" style="border:none;border-right:1px solid #666;padding:5px 8px;">${P}</td>
          <td style="border:none;border-right:1px solid #666;padding:5px 8px;">${t.serviceType}</td>
          <td class="w22" style="border:none;border-right:1px solid #666;padding:5px 8px;">${s}</td>
          <td class="tall" style="border:none;padding:5px 8px;">${S}</td>
        </tr>
      </table>
    </td></tr>
    <tr><td colspan="2" style="padding:0;">
      <div style="display:flex;min-height:100px;">
        <div style="flex:0 0 34%;padding:8px 10px;border-right:1px solid #666;line-height:2;font-size:10pt;">
          <div>${Y} ${R}</div>
          ${V?`<div>${K} ${V}</div>`:""}
        </div>
        <div style="flex:0 0 32%;border-right:1px solid #666;text-align:center;padding:6px 4px;">
          ${o&&v?`<div style="font-size:9pt;margin-bottom:3px;">${Z}</div><img src="${v}" style="display:block;margin:0 auto;width:30mm;height:30mm;object-fit:contain;background:#fff;">`:""}
        </div>
        <div style="flex:1;padding:8px 10px;font-size:10pt;line-height:2;">
          <div>${w} ${W}</div>
          ${e&&d?`<div style="margin-top:4px;">${ee} <img src="${d}" style="display:inline-block;vertical-align:middle;margin-left:4px;max-height:20mm;max-width:100%;width:auto;height:auto;object-fit:contain;"></div>`:""}
        </div>
      </div>
    </td></tr>
  </table>
  </div>
</div>
</body></html>`}function re({row:t,token:c,onClose:p,allRows:r}){const[m,x]=u.useState((t==null?void 0:t.id)??null),e=r&&m&&r.find(a=>a.id===m)||t,[o,L]=u.useState(()=>{const a=Object.fromEntries(Object.entries(O.fields).map(([i,l])=>[i,l.value]));return a.date=q(),a}),[g,h]=u.useState(!!(e!=null&&e.institute_sign)),[d,v]=u.useState(!!(e!=null&&e.institute_stamp)),[N,y]=u.useState(""),[z,U]=u.useState(null),[_,R]=u.useState({top:null,bottom:null}),[$,M]=u.useState(!0),[T,D]=u.useState(!1),[b,H]=u.useState(null),F=u.useRef(null),I=u.useRef(null);u.useEffect(()=>()=>{b&&URL.revokeObjectURL(b)},[b]),u.useEffect(()=>{L(a=>({...a,date:a.date||q(),lrPadding:String((e==null?void 0:e.institute_letter_lr_padding)??20),toName:(e==null?void 0:e.client_name_manual)||(e==null?void 0:e.client_name_np)||(e==null?void 0:e.client_name)||a.toName||"",toAddress:(e==null?void 0:e.client_address_manual)||(e==null?void 0:e.client_address_np)||(e==null?void 0:e.client_address)||a.toAddress||"",toTitle:(e==null?void 0:e.client_signatory_position)||a.toTitle||"कार्यालय प्रमुख",serviceType:(e==null?void 0:e.institute_service_type)||a.serviceType||"",firmNameNp:(e==null?void 0:e.institute_name_np)||(e==null?void 0:e.institute_name)||a.firmNameNp||"",firmAcronym:(e==null?void 0:e.institute_acronym)||a.firmAcronym||"",firmAddressNp:(e==null?void 0:e.institute_address_np)||(e==null?void 0:e.institute_address)||a.firmAddressNp||"",firmContact:(e==null?void 0:e.institute_contact_np)||(e==null?void 0:e.institute_contact)||a.firmContact||"",firmPhone:(e==null?void 0:e.institute_phone)||a.firmPhone||"",fy:e!=null&&e.fy?C(e.fy):a.fy||"",applicantName:(e==null?void 0:e.institute_contact_np)||(e==null?void 0:e.institute_contact)||a.applicantName||"",...Object.fromEntries(Object.entries(O.fields).filter(([i,l])=>l.value&&!a[i]).map(([i,l])=>[i,l.value]))}))},[e==null?void 0:e.id]),u.useEffect(()=>{let a=!1;return(async()=>{M(!0);let i={};if(e!=null&&e.institute_id&&c)try{i=await te("GET",`/institutes/${e.institute_id}`,null,c)||{}}catch{}if(a)return;h(!!i.sign),v(!!i.stamp);const[l,f,A,k]=await Promise.all([B(i.logo||(e==null?void 0:e.institute_logo)||null),B(i.letterhead||(e==null?void 0:e.institute_letterhead)||null),B(i.sign||(e==null?void 0:e.institute_sign)||null),B(i.stamp||(e==null?void 0:e.institute_stamp)||null)]);if(a)return;const j=(e==null?void 0:e.institute_name)||"",P=(e==null?void 0:e.institute_address)||"",s=(e==null?void 0:e.institute_phone)||"",S=(e==null?void 0:e.institute_email)||"",Y=(e==null?void 0:e.institute_website)||"";U({firmName:j,firmAcronym:(e==null?void 0:e.institute_acronym)||"",firmNameNp:(e==null?void 0:e.institute_name_np)||j,firmAddressNp:(e==null?void 0:e.institute_address_np)||P,firmContactNp:(e==null?void 0:e.institute_contact_np)||(e==null?void 0:e.institute_contact)||"",firmMeta:[P,s?`फोन: ${s}`:"",S,Y].filter(Boolean).join("  |  "),firmRegNo:(e==null?void 0:e.institute_reg_no)||"",firmPan:(e==null?void 0:e.institute_pan)||"",firmPhone:s,firmLogo:l,firmLetterhead:f,firmSign:A,firmStamp:k});const K=await ae(f);a||(R(K),M(!1))})(),()=>{a=!0}},[e==null?void 0:e.id,e==null?void 0:e.institute_id,c]);const E=u.useCallback(()=>{if(!z)return"";const a=parseFloat(o.lrPadding)||(e==null?void 0:e.institute_letter_lr_padding)||20,i=(e==null?void 0:e.institute_letter_top_margin)??15,l=(e==null?void 0:e.institute_letter_bottom_padding)??15,f=_.top&&_.top>i?_.top:i,A=_.bottom&&_.bottom>l?_.bottom:l,k={toName:(e==null?void 0:e.client_name_manual)||(e==null?void 0:e.client_name_np)||(e==null?void 0:e.client_name)||"",toAddress:(e==null?void 0:e.client_address_manual)||(e==null?void 0:e.client_address_np)||(e==null?void 0:e.client_address)||"",firmPhone:(e==null?void 0:e.institute_phone)||"",fyNp:e!=null&&e.fy?C(e.fy):""};return ie({fields:o,row:k,imgs:z,topMm:f,bottomMm:A,lrMm:a,inclSign:g,inclStamp:d,todayBSStr:q()})},[o,z,_,g,d,e]);u.useEffect(()=>{$||y(E())},[$,E]);const V=async()=>{D(!0);try{const l=document.createElement("iframe");l.style.cssText="position:fixed;left:-9999px;top:0;width:794px;height:1123px;border:none;visibility:hidden;",document.body.appendChild(l),await new Promise(s=>{l.onload=s,l.srcdoc=E()});const f=l.contentDocument;await Promise.all([...f.querySelectorAll("img")].map(s=>s.complete?Promise.resolve():new Promise(S=>{s.onload=S,s.onerror=S})));const{default:A}=await Q(async()=>{const{default:s}=await import("./html2canvas.esm-CBrSDip1.js");return{default:s}},[]),{jsPDF:k}=await Q(async()=>{const{jsPDF:s}=await import("./jspdf.es.min-DseJnLL9.js").then(S=>S.j);return{jsPDF:s}},__vite__mapDeps([0,1,2,3])),j=new k({unit:"mm",format:"a4",orientation:"portrait"}),P=f.querySelectorAll(".page");for(let s=0;s<P.length;s++){const S=await A(P[s],{scale:2,useCORS:!0,allowTaint:!0,backgroundColor:"#fff",width:794,height:1123,windowWidth:794,windowHeight:1123});s>0&&j.addPage(),j.addImage(S.toDataURL("image/jpeg",.95),"JPEG",0,0,210,297)}document.body.removeChild(l),H(s=>(s&&URL.revokeObjectURL(s),j.output("bloburl")))}finally{D(!1)}},W=()=>{var a;try{const i=(a=I.current)==null?void 0:a.contentWindow;if(i){i.focus(),i.print();return}}catch{}b&&window.open(b,"_blank","noopener")},G=ne.filter(a=>O.fields[a]);return n.jsxs("div",{style:{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",zIndex:1200,display:"flex",flexDirection:"column"},children:[n.jsxs("div",{style:{display:"flex",alignItems:"center",gap:12,padding:"10px 20px",background:"var(--surface)",borderBottom:"1px solid var(--border)",flexShrink:0},children:[n.jsx("div",{style:{fontWeight:700,fontSize:16,color:"var(--text)"},children:"Letter Builder"}),r&&r.length>0&&n.jsxs("select",{value:m??"",onChange:a=>x(Number(a.target.value)),style:{padding:"6px 10px",borderRadius:8,border:"1px solid var(--border)",background:"var(--surface)",color:"var(--text)",fontSize:13,fontFamily:"inherit",flex:1,maxWidth:280,cursor:"pointer"},children:[n.jsx("option",{value:"",children:"— Select firm —"}),r.map(a=>n.jsxs("option",{value:a.id,children:[a.institute_name,a.client_short?` → ${a.client_short}`:""]},a.id))]}),n.jsxs("div",{style:{display:"flex",gap:8,marginLeft:"auto"},children:[n.jsxs("label",{style:{display:"flex",alignItems:"center",gap:6,fontSize:12,cursor:"pointer",color:"var(--text2)"},children:[n.jsx("input",{type:"checkbox",checked:d,onChange:a=>v(a.target.checked),style:{accentColor:"var(--primary)"}})," छाप"]}),n.jsxs("label",{style:{display:"flex",alignItems:"center",gap:6,fontSize:12,cursor:"pointer",color:"var(--text2)"},children:[n.jsx("input",{type:"checkbox",checked:g,onChange:a=>h(a.target.checked),style:{accentColor:"var(--primary)"}})," हस्ताक्षर"]})]}),n.jsx(J,{className:"btn btn-primary",onClick:V,disabled:$||T,style:{minWidth:130,fontSize:13},children:T?"Generating…":"Generate PDF"}),n.jsx("button",{onClick:p,style:{background:"none",border:"none",cursor:"pointer",fontSize:22,lineHeight:1,color:"var(--text3)",padding:"0 4px"},children:"×"})]}),n.jsxs("div",{style:{display:"flex",flex:1,overflow:"hidden"},children:[n.jsxs("div",{style:{width:340,flexShrink:0,overflowY:"auto",padding:20,borderRight:"1px solid var(--border)",background:"var(--bg)",display:"flex",flexDirection:"column",gap:14},children:[$&&n.jsx("div",{style:{color:"var(--text3)",fontSize:13},children:"Loading images…"}),!$&&G.map(a=>{const i=O.fields[a];return n.jsxs("div",{children:[n.jsx("div",{style:{fontSize:11,fontWeight:600,color:"var(--text3)",marginBottom:4,textTransform:"uppercase",letterSpacing:.5},children:i.label}),i.multiline?n.jsx("textarea",{value:o[a]??"",onChange:l=>L(f=>({...f,[a]:l.target.value})),rows:3,style:{width:"100%",padding:"8px 10px",border:"1px solid var(--border)",borderRadius:6,fontSize:13,fontFamily:"Kalimati,Noto Sans Devanagari,Arial Unicode MS,sans-serif",resize:"vertical",background:"var(--surface)",color:"var(--text)",outline:"none",lineHeight:1.7}}):n.jsx("input",{value:o[a]??"",onChange:l=>L(f=>({...f,[a]:l.target.value})),style:{width:"100%",padding:"8px 10px",border:"1px solid var(--border)",borderRadius:6,fontSize:13,fontFamily:"Kalimati,Noto Sans Devanagari,Arial Unicode MS,sans-serif",background:"var(--surface)",color:"var(--text)",outline:"none"}})]},a)})]}),n.jsx("div",{style:{flex:1,overflow:"auto",background:"#666",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:24},children:$?n.jsx("div",{style:{color:"#fff",fontSize:14,marginTop:60},children:"Loading…"}):n.jsx("iframe",{ref:F,srcDoc:N,style:{width:794,height:1123,border:"none",boxShadow:"0 4px 24px rgba(0,0,0,.4)",background:"#fff",flexShrink:0},title:"Letter Preview"})})]}),b&&n.jsxs("div",{style:{position:"fixed",inset:0,background:"rgba(0,0,0,.65)",zIndex:1400,display:"flex",flexDirection:"column"},children:[n.jsxs("div",{style:{display:"flex",alignItems:"center",gap:10,padding:"10px 20px",background:"var(--surface)",borderBottom:"1px solid var(--border)",flexShrink:0},children:[n.jsx("div",{style:{fontWeight:700,fontSize:16,color:"var(--text)"},children:"Letter Preview"}),n.jsxs("div",{style:{marginLeft:"auto",display:"flex",gap:8,alignItems:"center"},children:[n.jsxs(J,{className:"btn btn-secondary",onClick:W,children:[n.jsx("span",{className:"material-icons-round",style:{fontSize:16},children:"print"})," Print"]}),n.jsxs("a",{href:b,download:"shortlist-letter.pdf",className:"btn btn-primary",style:{textDecoration:"none",display:"inline-flex",alignItems:"center",gap:6},children:[n.jsx("span",{className:"material-icons-round",style:{fontSize:16},children:"download"})," Download"]}),n.jsx("button",{onClick:()=>{URL.revokeObjectURL(b),H(null)},style:{background:"none",border:"none",cursor:"pointer",fontSize:22,lineHeight:1,color:"var(--text3)",padding:"0 4px"},children:"×"})]})]}),n.jsx("iframe",{ref:I,src:b,title:"Letter PDF preview",style:{flex:1,border:"none",background:"#666",width:"100%"}})]})]})}export{re as default};

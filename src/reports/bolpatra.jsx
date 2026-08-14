import React from 'react';
import { getClient, monthsBetween, districtsOf, esc, fyInRange } from './helpers.js';
import { loadDocx, loadFileSaver } from './docxLazy.js';
import { BS_MONTHS_EN } from '../constants/nepali.js';

// ─── Standard EOI Document (Bolpatra) ────────────────────────────────────────
// Mirrors the PPMO/e-GP "Standard EOI Document" form:
//   2.    Applicant's Information Form
//   3(A)  General Work Experience
//   3(B)  Specific Experience
//   3(C)  Geographic Experience
//   4(A)  Financial Capacity
// Every report is `aggregate` because ReportsView's multi-institute branch renders
// solely through renderAggregateTable — there is no per-row path in that mode.

// 3(A) is "General Work Experience" — everything the firm has done — so the
// occupation and duration filters deliberately do not narrow it. They apply to
// 3(B) "Specific Experience", which is by definition the subset of similar
// assignments relevant to the EOI being bid for.
const REPORTS = [
  { id: 'full', label: 'Complete EOI Document', aggregate: true, hasOccupationFilter: true, hasTurnoverFY: true },
  { id: '2',    label: "2. Applicant's Information Form", aggregate: true },
  { id: '3a',   label: '3(A) General Work Experience', aggregate: true },
  { id: '3b',   label: '3(B) Specific Experience', aggregate: true, hasOccupationFilter: true },
  { id: '3c',   label: '3(C) Geographic Experience', aggregate: true },
  { id: '4a',   label: '4(A) Financial Capacity', aggregate: true, hasTurnoverFY: true },
];

const SECTION_ORDER = ['2', '3a', '3b', '3c', '4a'];
const sectionsFor = (reportId) => reportId === 'full' ? SECTION_ORDER : [reportId];

const SECTION_TITLES = {
  '2':  { heading: "2.  Applicant's Information Form",
          note: '(In case of joint venture of two or more firms to be filled separately for each constituent member)' },
  '3a': { heading: '3(A). General Work Experience',
          note: '(Details of assignments undertaken. Each consultant or member of a JV must fill in this form.)' },
  '3b': { heading: '3(B). Specific Experience',
          note: 'Details of similar assignments undertaken in the previous seven years' },
  '3c': { heading: '3(C). Geographic Experience',
          note: 'Experience of working in similar geographic region or country' },
  '4a': { heading: '4(A). Financial Capacity',
          note: '(In case of joint venture of two or more firms to be filled separately for each constituent member)' },
};

// ─── Value formatting ────────────────────────────────────────────────────────

const dash = (v) => (v === 0 || v) && String(v).trim() !== '' ? String(v) : '';

const fmtNrs = (v) => {
  if (v == null || v === '') return '';
  const n = Number(v);
  return isNaN(n) ? String(v) : `NRs. ${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

// "2081/04/27" or "2081-04-27" → "Shrawan/2081".
//
// Contract dates are entered in Bikram Sambat (the form's YYYY/MM/DD is a BS
// date), so month 1 is Baishakh — not January. Mapping these through Gregorian
// month names mislabels every date by roughly nine months. Names are romanised
// because the EOI paperwork itself is in English. An unparseable month segment is
// kept verbatim so nothing is silently lost.
const fmtMonthYear = (d) => {
  if (!d) return '';
  const parts = String(d).replace(/-/g, '/').split('/');
  if (parts.length < 2) return String(d);
  const m = parseInt(parts[1], 10);
  return `${BS_MONTHS_EN[m - 1] || parts[1]}/${parts[0]}`;
};

const locationOf = (exp) => {
  const d = districtsOf(exp);
  if (d.length) return d.join(', ');
  return (exp.locations || []).map(l => l.district).filter(Boolean).join(', ');
};

const clientNameOf = (exp, clients) => {
  const c = getClient(clients, exp.clientId);
  return c.fullName || exp.clientName || '';
};

const captionOf = (exp) => {
  const name = exp.assignmentName || '(unnamed assignment)';
  return exp.fy ? `Assignment Name: ${name} (FY ${exp.fy})` : `Assignment Name: ${name}`;
};

// ─── 3(B) narrowing ──────────────────────────────────────────────────────────
// ReportsView hands this family unfiltered assignments (family.selfFilters) so
// occupation and duration can be scoped to 3(B) rather than every section.

/** Display name of an occupation row, resolved through the master list. */
const occNameOf = (occ, occupations) => {
  if (occupations?.length && occ.ctevtOccupationId) {
    const found = occupations.find(o => String(o.id) === String(occ.ctevtOccupationId));
    if (found) return found.name;
  }
  return occ.nameInLetter || '';
};

const meetsDuration = (occ, filterDuration) => {
  if (!filterDuration) return true;
  const d = parseFloat(occ.duration) || 0;
  if (filterDuration === '160plus') return d >= 160;
  if (filterDuration === '390plus') return d >= 390;
  if (filterDuration === '390more') return d > 390;
  return true;
};

/**
 * Assignments qualifying as "similar" for 3(B). An assignment is kept when at
 * least one of its occupation rows satisfies *both* the occupation and duration
 * criteria — a 400-hour Electrician row must not qualify the assignment when the
 * user asked for 400-hour Plumbing.
 */
function specificExps(exps, opts = {}) {
  const { selectedOccs = [], filterDuration = '', occupations = [] } = opts;
  if (!selectedOccs.length && !filterDuration) return exps;
  const wanted = selectedOccs.map(s => s.toLowerCase());
  return exps.filter(exp => (exp.occupations || []).some(occ => {
    if (!meetsDuration(occ, filterDuration)) return false;
    if (!wanted.length) return true;
    return wanted.includes(occNameOf(occ, occupations).toLowerCase());
  }));
}

// ─── Section models ──────────────────────────────────────────────────────────
// Each builder returns a renderer-neutral shape so the JSX, print-HTML and DOCX
// renderers stay in sync rather than each re-deriving the same values.

// Section 2 → [{ no, label, value }]
function model2(inst) {
  const i = inst || {};
  const contact = [i.contactPerson, i.contactDesignation, i.address, i.phone]
    .map(dash).filter(Boolean).join(' / ');
  const comms = [
    i.phone ? `Tel: ${i.phone}` : '',
    i.mobile ? `Mobile: ${i.mobile}` : '',
    i.fax ? `Fax: ${i.fax}` : '',
    i.email ? `Email: ${i.email}` : '',
  ].filter(Boolean).join('; ');

  return [
    { no: 1,  label: 'Name of Firm/Company',                                  value: dash(i.name) },
    { no: 2,  label: 'Type of Constitution',                                  value: dash(i.constitutionType) },
    { no: 3,  label: 'Date of Registration / Commencement of Business',       value: dash(i.regDate) },
    { no: 4,  label: 'Country of Registration',                               value: 'Nepal' },
    { no: 5,  label: 'Registered Office/Place of Business',                   value: dash(i.address) },
    { no: 6,  label: 'Telephone No; Fax No; E-Mail Address',                  value: comms },
    { no: 7,  label: 'Name of Authorized Contact Person / Designation / Address / Telephone', value: contact },
    { no: 8,  label: 'Name of Authorized Local Agent / Address / Telephone',  value: dash(i.localAgent) },
    { no: 9,  label: "Consultant's Organization",                             value: dash(i.orgProfile) },
    { no: 10, label: 'Total number of staff',                                 value: dash(i.totalStaff) },
    { no: 11, label: 'Number of regular professional staff',                  value: dash(i.professionalStaff) },
  ];
}

// Section 3A → { columns, widths, rows }
function model3a(exps, clients) {
  return {
    columns: ['S. N.', 'Name of assignment', 'Location', 'Value of Contract', 'Year Completed', 'Client', 'Description of work carried out'],
    widths:  [600, 2200, 1400, 1200, 900, 1400, 1938],
    rows: exps.map((exp, i) => [
      String(i + 1),
      dash(exp.assignmentName),
      locationOf(exp),
      fmtNrs(exp.contractValue),
      dash(exp.endFY || exp.fy),
      clientNameOf(exp, clients),
      dash(exp.descriptionOfWork),
    ]),
  };
}

// Section 3B → [{ caption, rows: [[leftCell, rightCell]], footer }]
// A "cell" is an array of { label, value } pairs so the stacked cells in the
// original form (Country + Location, Start + Completion) render correctly.
function model3b(exps, clients) {
  return exps.map(exp => {
    const client = getClient(clients, exp.clientId);
    const jv = !!exp.isJV;
    return {
      caption: captionOf(exp),
      rows: [
        [
          [{ label: 'Assignment name', value: dash(exp.assignmentName) }],
          [{ label: 'Approx. value of the contract (in current NRs; US$ or Euro)', value: fmtNrs(exp.contractValue) }],
        ],
        [
          [{ label: 'Country', value: dash(exp.country) || 'Nepal' },
           { label: 'Location within country', value: locationOf(exp) }],
          [{ label: 'Duration of assignment (months)',
             value: dash(exp.durationMonths) || dash(monthsBetween(exp.startDate, exp.endDate)) }],
        ],
        [
          [{ label: 'Name of Client', value: clientNameOf(exp, clients) }],
          [{ label: 'Total No. of person-months of the assignment', value: dash(exp.totalPersonMonths) }],
        ],
        [
          [{ label: 'Address', value: dash(client.address) }],
          [{ label: 'Approx. value of the services provided by your firm under the contract (in current NRs; US$ or Euro)',
             value: fmtNrs(exp.ownServiceValue || exp.contractValue) }],
        ],
        [
          [{ label: 'Start date (month/year)', value: fmtMonthYear(exp.startDate) },
           { label: 'Completion date (month/year)', value: fmtMonthYear(exp.endDate) }],
          [{ label: 'No. of professional person-months provided by the joint venture partners or the Sub-Consultants',
             value: jv ? dash(exp.jvPartnerPersonMonths) : 'NA' }],
        ],
        [
          [{ label: 'Name of joint venture partner or sub-Consultants, if any',
             value: jv ? dash(exp.jvPartnerNames) : 'NA' }],
          [{ label: 'Narrative description of Project', value: dash(exp.narrativeDescription), block: true }],
        ],
      ],
      footer: {
        label: 'Description of actual services provided in the assignment',
        value: dash(exp.actualServicesDescription),
        note: 'Note: Provide highlight on similar services provided by the consultant as required by the EOI assignment.',
      },
    };
  });
}

// Section 3C → { columns, widths, rows }
function model3c(exps) {
  return {
    columns: ['No', 'Name of the Project', 'Location (Country/ Region)', 'Execution Year and Duration'],
    widths:  [700, 4500, 2400, 2038],
    rows: exps.map((exp, i) => {
      const loc = locationOf(exp);
      const country = dash(exp.country) || 'Nepal';
      const span = `${dash(exp.fy)}${exp.endFY && exp.endFY !== exp.fy ? `–${exp.endFY}` : ''}`;
      const dur = exp.durationMonths ? ` (${exp.durationMonths} months)` : '';
      return [
        String(i + 1),
        dash(exp.assignmentName),
        loc ? `${country} — ${loc}` : country,
        `${span}${dur}`,
      ];
    }),
  };
}

// Section 4A → { rows: [[year, amount]], average }
// Uses its own FY range: a bid commonly asks for turnover over a different span
// than the experience it wants shown (e.g. 3 years of accounts, 7 years of work),
// so tying both to one selector would make one of them wrong.
function model4a(inst, opts = {}) {
  const fromFY = opts.turnoverFromFY ?? '';
  const toFY   = opts.turnoverToFY ?? '';
  const records = (inst?.taxClearance || [])
    .filter(t => t.fy && (!fromFY && !toFY ? true : fyInRange(t.fy, fromFY, toFY)))
    .slice()
    .sort((a, b) => String(a.fy).localeCompare(String(b.fy)));

  const amounts = records.map(t => Number(t.turnover)).filter(n => !isNaN(n) && n > 0);
  const average = amounts.length
    ? amounts.reduce((s, n) => s + n, 0) / amounts.length
    : null;

  return {
    rows: records.map(t => [t.fy, fmtNrs(t.turnover)]),
    average: average != null ? fmtNrs(Math.round(average)) : '',
  };
}

// ─── On-screen rendering ─────────────────────────────────────────────────────

const TH = { background:'#dce6f1', border:'1px solid #8ba3bd', padding:'6px 8px',
             fontSize:11, fontWeight:600, textAlign:'left', color:'#111' };
const TD = { border:'1px solid #8ba3bd', padding:'6px 8px', fontSize:11,
             verticalAlign:'top', color:'var(--text1)' };

function GridTable({ model }) {
  if (!model.rows.length) {
    return <div style={{fontSize:12, color:'var(--text3)', padding:'8px 0'}}>No assignments in range.</div>;
  }
  return (
    <div style={{overflowX:'auto'}}>
      <table style={{borderCollapse:'collapse', width:'100%'}}>
        <thead><tr>{model.columns.map(c => <th key={c} style={TH}>{c}</th>)}</tr></thead>
        <tbody>
          {model.rows.map((row, i) => (
            <tr key={i}>{row.map((v, j) => <td key={j} style={TD}>{v || '—'}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Cell({ pairs }) {
  return (
    <td style={TD}>
      {pairs.map((p, i) => (
        <div key={i} style={{marginBottom: i < pairs.length - 1 ? 8 : 0}}>
          <span style={{color:'var(--text2)'}}>{p.label}:</span>{' '}
          {p.block
            ? <div style={{whiteSpace:'pre-wrap', marginTop:2}}>{p.value || '—'}</div>
            : <span style={{fontWeight:500}}>{p.value || '—'}</span>}
        </div>
      ))}
    </td>
  );
}

function SectionBody({ section, inst, exps, clients, opts }) {
  if (section === '2') {
    return (
      <table style={{borderCollapse:'collapse', width:'100%'}}>
        <tbody>
          {model2(inst).map(item => (
            <tr key={item.no}>
              <td style={{...TD, width:36, textAlign:'right'}}>{item.no}.</td>
              <td style={{...TD, width:'42%', color:'var(--text2)'}}>{item.label}:</td>
              <td style={{...TD, whiteSpace:'pre-wrap'}}>{item.value || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (section === '3a') return <GridTable model={model3a(exps, clients)} />;
  if (section === '3c') return <GridTable model={model3c(exps)} />;

  if (section === '3b') {
    const items = model3b(specificExps(exps, opts), clients);
    if (!items.length) return <div style={{fontSize:12, color:'var(--text3)'}}>No assignments in range.</div>;
    return (
      <div style={{display:'flex', flexDirection:'column', gap:22}}>
        {items.map((item, i) => (
          <div key={i}>
            <div style={{fontSize:12.5, marginBottom:6}}>{item.caption}</div>
            <table style={{borderCollapse:'collapse', width:'100%'}}>
              <tbody>
                {item.rows.map((row, r) => (
                  <tr key={r}>{row.map((cell, c) => <Cell key={c} pairs={cell} />)}</tr>
                ))}
                <tr>
                  <td style={TD} colSpan={2}>
                    <div style={{color:'var(--text2)'}}>{item.footer.label}:</div>
                    <div style={{fontWeight:600, margin:'4px 0'}}>{item.footer.note}</div>
                    <div style={{whiteSpace:'pre-wrap'}}>{item.footer.value || '—'}</div>
                  </td>
                </tr>
                {/* Borderless row: renders as a line beneath the box, exactly as
                    printed, but being part of the table it cannot be orphaned onto
                    the next page when a tall box runs to the bottom of one. */}
                <tr>
                  <td colSpan={2} style={{border:'none', padding:'8px 0 0', fontSize:12}}>
                    Firm&rsquo;s Name: <u>&nbsp;{inst?.name || ''}&nbsp;</u>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ))}
      </div>
    );
  }

  // 4a
  const m = model4a(inst, opts);
  return (
    <div>
      <table style={{borderCollapse:'collapse', width:'100%', maxWidth:520}}>
        <thead>
          <tr><th style={{...TH, textAlign:'center'}} colSpan={2}>Annual Turnover</th></tr>
          <tr><th style={{...TH, textAlign:'center'}}>Year</th><th style={{...TH, textAlign:'center'}}>Amount Currency</th></tr>
        </thead>
        <tbody>
          {m.rows.length
            ? m.rows.map(([y, a], i) => (
                <tr key={i}><td style={TD}>{y}</td><td style={{...TD, textAlign:'right'}}>{a || '—'}</td></tr>
              ))
            : <tr><td style={TD} colSpan={2}>No turnover records in range.</td></tr>}
        </tbody>
      </table>
      {/* Dashed bullet + bold label on the left, tall bordered box on the right,
          its edges aligned to the turnover table above — as printed on the form. */}
      <div style={{display:'flex', alignItems:'stretch', marginTop:16, maxWidth:520}}>
        <div style={{flex:1, display:'flex', alignItems:'center', gap:10, paddingLeft:14}}>
          <span style={{color:'var(--text2)'}}>-</span>
          <span style={{fontWeight:700, fontSize:12.5}}>Average Annual Turnover</span>
        </div>
        <div style={{flex:1, border:'1px solid #8ba3bd', minHeight:62, display:'flex',
          alignItems:'center', justifyContent:'flex-end', padding:'8px 12px',
          fontSize:12.5, fontWeight:600}}>
          {m.average || ''}
        </div>
      </div>
      <div style={{fontSize:11.5, color:'var(--text2)', marginTop:12, fontStyle:'italic'}}>
        (Note: Supporting documents for Average Turnover should be submitted for the above.)
      </div>
    </div>
  );
}

function renderAggregateTable(inst, exps, clients, reportId, opts = {}) {
  const sections = sectionsFor(reportId);
  return (
    <div>
      <div style={{fontWeight:700, fontSize:14, marginBottom:4}}>{inst?.name || 'Firm'}</div>
      {inst?.acronym && <div style={{fontSize:11, color:'var(--text3)', marginBottom:14}}>{inst.acronym}</div>}
      {sections.map(s => (
        <div key={s} style={{marginBottom:26}}>
          <div style={{fontWeight:600, fontSize:13, marginBottom:2}}>{SECTION_TITLES[s].heading}</div>
          <div style={{fontSize:11, color:'var(--text3)', fontStyle:'italic', marginBottom:10}}>{SECTION_TITLES[s].note}</div>
          <SectionBody section={s} inst={inst} exps={exps} clients={clients} opts={opts} />
        </div>
      ))}
    </div>
  );
}

// ─── Print / PDF ─────────────────────────────────────────────────────────────

const htmlGrid = (model) => `
  <table>
    <thead><tr>${model.columns.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
    <tbody>${model.rows.length
      ? model.rows.map(r => `<tr>${r.map(v => `<td>${esc(v) || '&mdash;'}</td>`).join('')}</tr>`).join('')
      : `<tr><td colspan="${model.columns.length}">No assignments in range.</td></tr>`}</tbody>
  </table>`;

const htmlCell = (pairs) => `<td>${pairs.map(p =>
  `<div class="pair"><span class="lbl">${esc(p.label)}:</span> ${
    p.block ? `<div class="block">${esc(p.value) || '&mdash;'}</div>` : `<b>${esc(p.value) || '&mdash;'}</b>`
  }</div>`).join('')}</td>`;

function htmlSection(section, inst, exps, clients, opts) {
  if (section === '2') {
    return `<table class="info">${model2(inst).map(it => `
      <tr><td class="no">${it.no}.</td><td class="lbl">${esc(it.label)}:</td>
      <td class="val">${esc(it.value) || '&mdash;'}</td></tr>`).join('')}</table>`;
  }
  if (section === '3a') return htmlGrid(model3a(exps, clients));
  if (section === '3c') return htmlGrid(model3c(exps));

  if (section === '3b') {
    const items = model3b(specificExps(exps, opts), clients);
    if (!items.length) return `<p class="muted">No assignments in range.</p>`;
    return items.map(item => `
      <div class="spec">
        <div class="caption">${esc(item.caption)}</div>
        <table>
          ${item.rows.map(row => `<tr>${row.map(htmlCell).join('')}</tr>`).join('')}
          <tr><td colspan="2">
            <div class="lbl">${esc(item.footer.label)}:</div>
            <div class="note">${esc(item.footer.note)}</div>
            <div class="block">${esc(item.footer.value) || '&mdash;'}</div>
          </td></tr>
          <tr><td colspan="2" class="firm-cell">Firm&rsquo;s Name: <u>&nbsp;${esc(inst?.name || '')}&nbsp;</u></td></tr>
        </table>
      </div>`).join('');
  }

  const m = model4a(inst, opts);
  return `
    <table class="turnover">
      <thead>
        <tr><th colspan="2" class="ctr">Annual Turnover</th></tr>
        <tr><th class="ctr">Year</th><th class="ctr">Amount Currency</th></tr>
      </thead>
      <tbody>${m.rows.length
        ? m.rows.map(([y, a]) => `<tr><td>${esc(y)}</td><td class="rt">${esc(a) || '&mdash;'}</td></tr>`).join('')
        : `<tr><td colspan="2">No turnover records in range.</td></tr>`}</tbody>
    </table>
    <div class="avg">
      <div class="avg-label"><span class="dash">-</span><b>Average Annual Turnover</b></div>
      <div class="avg-box">${esc(m.average)}</div>
    </div>
    <p class="note-i">(Note: Supporting documents for Average Turnover should be submitted for the above.)</p>`;
}

function buildPrintHTML(inst, exps, clients, reportId, fyRange, opts = {}) {
  const sections = sectionsFor(reportId);
  const body = sections.map(s => `
    <div class="section">
      <h2>${esc(SECTION_TITLES[s].heading)}</h2>
      <p class="sub">${esc(SECTION_TITLES[s].note)}</p>
      ${htmlSection(s, inst, exps, clients, opts)}
    </div>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Standard EOI Document — ${esc(inst?.name || '')}</title>
<style>
  @page { size: A4; margin: 18mm; }
  /* The print window is a bare document: without an explicit light scheme a
     dark-mode browser renders this black-on-black before it ever reaches paper. */
  :root { color-scheme: light; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px;
         color: #000; background: #fff; margin: 0; }
  .doc-head { text-align: center; font-style: italic; font-weight: bold; font-size: 12px; margin-bottom: 14px; }
  .firm { font-size: 14px; font-weight: 700; margin-bottom: 2px; }
  .firm-sub { font-size: 11px; color: #555; margin-bottom: 14px; }
  .section { margin-bottom: 22px; page-break-inside: auto; }
  h2 { font-size: 13px; margin: 0 0 2px; }
  .sub { font-size: 11px; font-style: italic; color: #444; margin: 0 0 8px; }
  table { border-collapse: collapse; width: 100%; table-layout: fixed; }
  th, td { border: 1px solid #000; padding: 5px 7px; vertical-align: top;
           font-size: 11px; word-wrap: break-word; overflow-wrap: break-word; }
  th { font-weight: bold; text-align: left; }
  .ctr { text-align: center; } .rt { text-align: right; }
  .info .no { width: 26px; text-align: right; border: none; }
  .info .lbl { width: 42%; border: none; }
  .info .val { border: none; border-bottom: 1px solid #000; white-space: pre-wrap; }
  .spec { margin-bottom: 18px; page-break-inside: avoid; }
  .caption { font-size: 12px; margin-bottom: 5px; }
  /* Sits inside the table so it cannot be split from its box across a page,
     but is borderless so it reads as a line printed beneath the box. */
  .firm-cell { border: none !important; padding: 8px 0 0 !important; font-size: 12px; }
  .pair { margin-bottom: 6px; }
  .pair:last-child { margin-bottom: 0; }
  .lbl { color: #222; }
  .block { white-space: pre-wrap; margin-top: 2px; }
  .note { font-weight: bold; margin: 3px 0; }
  .note-i { font-style: italic; font-size: 10.5px; color: #444; }
  .turnover { max-width: 380px; }
  /* Label left, tall bordered box right, aligned to the turnover table's edges. */
  .avg { display: flex; align-items: stretch; margin-top: 14px; max-width: 380px; }
  .avg-label { flex: 1; display: flex; align-items: center; gap: 10px; padding-left: 14px; }
  .dash { font-weight: normal; }
  .avg-box { flex: 1; border: 1px solid #000; min-height: 52px; padding: 6px 10px;
             display: flex; align-items: center; justify-content: flex-end; font-weight: bold; }
  .muted { color: #666; }
  @media print { body { margin: 0; } }
</style></head><body>
  <div class="doc-head">Standard EOI Document</div>
  <div class="firm">${esc(inst?.name || '')}</div>
  <div class="firm-sub">${esc(inst?.acronym || '')}${fyRange ? ` · ${esc(fyRange)}` : ''}</div>
  ${body}
</body></html>`;
}

// ─── CSV (only reachable if a report is ever made non-aggregate) ─────────────

function buildCSVRow(exp, clients, reportId, i) {
  const clientName = clientNameOf(exp, clients);
  const location = locationOf(exp);

  if (reportId === '3c') return {
    'No': i + 1,
    'Name of the Project': exp.assignmentName || '',
    'Location (Country/Region)': `${exp.country || 'Nepal'}${location ? ` — ${location}` : ''}`,
    'Execution Year and Duration': `${exp.fy || ''}${exp.durationMonths ? ` (${exp.durationMonths} months)` : ''}`,
  };

  return {
    'S.N.': i + 1,
    'Name of assignment': exp.assignmentName || '',
    'Location': location,
    'Value of Contract': exp.contractValue || '',
    'Year Completed': exp.endFY || exp.fy || '',
    'Client': clientName,
    'Description of work carried out': exp.descriptionOfWork || '',
  };
}

// ─── Word (.docx) ────────────────────────────────────────────────────────────

const DXA_MM = 56.6929;
const PAGE_W = Math.round(210 * DXA_MM);   // A4
const PAGE_H = Math.round(297 * DXA_MM);
const MARGIN = Math.round(18 * DXA_MM);
const CONTENT_W = PAGE_W - MARGIN * 2;     // ≈ 9866
const HALF = Math.round(CONTENT_W / 2);

// Section 3A/3C widths are authored against a 9638 grid; rescale to the real
// content width so the columns always fill the page exactly.
const scaleWidths = (widths) => {
  const total = widths.reduce((s, w) => s + w, 0);
  const out = widths.map(w => Math.round((w / total) * CONTENT_W));
  out[out.length - 1] += CONTENT_W - out.reduce((s, w) => s + w, 0);
  return out;
};

function docxKit(D) {
  const { Paragraph, TextRun, TableCell, WidthType, VerticalAlign, BorderStyle, ShadingType } = D;
  const B = { style: BorderStyle.SINGLE, size: 6, color: '000000' };
  const BORDERS = { top: B, bottom: B, left: B, right: B };

  const p = (text, o = {}) => new Paragraph({
    alignment: o.align,
    spacing: o.spacing,
    children: [new TextRun({
      text: String(text ?? ''), bold: !!o.bold, italics: !!o.italic,
      size: o.size || 19, font: 'Arial', underline: o.underline ? {} : undefined,
    })],
  });

  // Multi-line strings must become one Paragraph per line — "\n" inside a TextRun
  // is dropped by Word.
  const lines = (text, o = {}) => {
    const arr = String(text ?? '').split('\n');
    return arr.length && arr.some(Boolean) ? arr.map(l => p(l, o)) : [p('', o)];
  };

  const cell = (children, o = {}) => new TableCell({
    columnSpan: o.colspan,
    width: { size: o.width || HALF, type: WidthType.DXA },
    borders: o.noBorder ? undefined : BORDERS,
    shading: o.shade ? { fill: o.shade, type: ShadingType.CLEAR } : undefined,
    verticalAlign: VerticalAlign.TOP,
    margins: { top: 60, bottom: 60, left: 110, right: 110 },
    children: Array.isArray(children) ? children : [children],
  });

  return { p, lines, cell, BORDERS };
}

function docxSection(D, kit, section, inst, exps, clients, opts) {
  const { Table, TableRow, WidthType, AlignmentType, HeightRule } = D;
  const { p, lines, cell } = kit;
  const out = [];

  if (section === '2') {
    model2(inst).forEach(it => {
      out.push(new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [500, Math.round(CONTENT_W * 0.42), CONTENT_W - 500 - Math.round(CONTENT_W * 0.42)],
        rows: [new TableRow({ children: [
          cell(p(`${it.no}.`), { width: 500, noBorder: true }),
          cell(p(`${it.label}:`), { width: Math.round(CONTENT_W * 0.42), noBorder: true }),
          cell(lines(it.value || '—'), { width: CONTENT_W - 500 - Math.round(CONTENT_W * 0.42), noBorder: true }),
        ]})],
      }));
    });
    return out;
  }

  if (section === '3a' || section === '3c') {
    const m = section === '3a' ? model3a(exps, clients) : model3c(exps);
    const w = scaleWidths(m.widths);
    const header = new TableRow({
      tableHeader: true,
      children: m.columns.map((c, i) => cell(p(c, { bold: true }), { width: w[i] })),
    });
    const body = m.rows.length
      ? m.rows.map(r => new TableRow({ children: r.map((v, i) => cell(lines(v || '—'), { width: w[i] })) }))
      : [new TableRow({ children: [cell(p('No assignments in range.'), { colspan: m.columns.length, width: CONTENT_W })] })];
    out.push(new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: w, rows: [header, ...body] }));
    return out;
  }

  if (section === '3b') {
    const items = model3b(specificExps(exps, opts), clients);
    if (!items.length) { out.push(p('No assignments in range.')); return out; }
    items.forEach((item, idx) => {
      // Caption sits above and outside the bordered table.
      out.push(p(item.caption, { spacing: { before: idx === 0 ? 0 : 240, after: 80 }, size: 20 }));

      const rows = item.rows.map(row => new TableRow({
        children: row.map(pairs => cell(
          pairs.flatMap(pr => [p(`${pr.label}:`), ...lines(pr.value || '—', { bold: !pr.block })]),
          { width: HALF }
        )),
      }));

      rows.push(new TableRow({ children: [cell([
        p(`${item.footer.label}:`),
        p(item.footer.note, { bold: true }),
        ...lines(item.footer.value || '—'),
      ], { colspan: 2, width: CONTENT_W })] }));

      // Firm name as a borderless final row rather than a paragraph after the
      // table: Word pushes a trailing paragraph onto the next page whenever a
      // tall box runs to the bottom of one, stranding it away from its box.
      rows.push(new TableRow({ children: [cell(
        p(`Firm's Name: ${inst?.name || ''}`),
        { colspan: 2, width: CONTENT_W, noBorder: true }
      )] }));

      out.push(new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: [HALF, HALF], rows }));
    });
    return out;
  }

  // 4a
  const m = model4a(inst, opts);
  const half = Math.round(CONTENT_W * 0.28);
  const w4 = [half, half];
  const t4w = half * 2;
  const rows = [
    new TableRow({ children: [cell(p('Annual Turnover', { bold: true, align: AlignmentType.CENTER }),
      { colspan: 2, width: t4w, shade: 'D9D9D9' })] }),
    new TableRow({ children: [
      cell(p('Year', { bold: true, align: AlignmentType.CENTER }), { width: half }),
      cell(p('Amount Currency', { bold: true, align: AlignmentType.CENTER }), { width: half }),
    ]}),
  ];
  if (m.rows.length) {
    m.rows.forEach(([y, a]) => rows.push(new TableRow({ children: [
      cell(p(y), { width: half }),
      cell(p(a || '—', { align: AlignmentType.RIGHT }), { width: half }),
    ]})));
  } else {
    rows.push(new TableRow({ children: [cell(p('No turnover records in range.'), { colspan: 2, width: t4w })] }));
  }
  out.push(new Table({ width: { size: t4w, type: WidthType.DXA }, columnWidths: w4, rows }));
  out.push(p(''));
  // Dashed bullet + bold label on the left with no border, tall bordered box on
  // the right, both aligned to the turnover table above — as printed on the form.
  out.push(new Table({
    width: { size: t4w, type: WidthType.DXA }, columnWidths: w4,
    rows: [new TableRow({
      height: { value: 900, rule: HeightRule.ATLEAST },
      children: [
        cell(p('-\tAverage Annual Turnover', { bold: true }), { width: half, noBorder: true }),
        cell(p(m.average || '', { align: AlignmentType.RIGHT }), { width: half }),
      ],
    })],
  }));
  out.push(p('(Note: Supporting documents for Average Turnover should be submitted for the above.)',
    { italic: true, size: 17, spacing: { before: 100 } }));
  return out;
}

/**
 * Word export for one or more firms.
 * @param firms [{ inst, exps }] — one entry per selected institute
 */
async function downloadMultiDOCX(firms, clients, reportId, opts = {}) {
  const D = await loadDocx();
  const { Document, Packer, Paragraph, TextRun, AlignmentType, PageOrientation } = D;
  const { saveAs } = await loadFileSaver();
  const kit = docxKit(D);
  const { p } = kit;

  const sections = sectionsFor(reportId);
  const children = [];

  firms.forEach(({ inst, exps }, fi) => {
    if (fi > 0) {
      children.push(new Paragraph({ pageBreakBefore: true, children: [new TextRun({ text: '', size: 19 })] }));
    }
    children.push(p('Standard EOI Document', { bold: true, italic: true, align: AlignmentType.CENTER, size: 22 }));
    children.push(p(inst?.name || '', { bold: true, size: 26, spacing: { before: 160 } }));
    if (inst?.acronym) children.push(p(inst.acronym, { size: 18 }));
    children.push(p(''));

    sections.forEach(s => {
      children.push(p(SECTION_TITLES[s].heading, { bold: true, size: 22, spacing: { before: 240, after: 40 } }));
      children.push(p(SECTION_TITLES[s].note, { italic: true, size: 17, spacing: { after: 120 } }));
      children.push(...docxSection(D, kit, s, inst, exps, clients, opts));
      children.push(p(''));
    });

  });

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 19 } } } },
    sections: [{
      properties: {
        page: {
          size: { width: PAGE_W, height: PAGE_H, orientation: PageOrientation.PORTRAIT },
          margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
        },
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const label = (REPORTS.find(r => r.id === reportId) || {}).label || 'EOI';
  const who = firms.length === 1
    ? (firms[0].inst?.acronym || firms[0].inst?.name || 'firm')
    : `${firms.length}_firms`;
  const safe = (s) => String(s).replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '');
  saveAs(blob, `Bolpatra_${safe(label)}_${safe(who)}.docx`);
}

// Single-institute entry point, kept so the family also works if a report is
// ever switched to non-aggregate (ReportsView calls this signature).
async function downloadDOCX(fullInst, activeExps, reportId, opts = {}) {
  return downloadMultiDOCX([{ inst: fullInst, exps: activeExps }], opts.clients || [], reportId, opts);
}

const bolpatra = {
  id: 'bolpatra',
  label: 'Bolpatra (Standard EOI)',
  multiInstitute: true,
  // Receive assignments filtered only by FY. Occupation and duration are applied
  // here instead, so they narrow 3(B) Specific Experience without also stripping
  // rows out of 3(A) General Work Experience.
  selfFilters: true,
  reports: REPORTS,
  renderAggregateTable,
  buildPrintHTML,
  buildCSVRow,
  downloadDOCX,
  downloadMultiDOCX,
};

export default bolpatra;
export { model3b, captionOf };

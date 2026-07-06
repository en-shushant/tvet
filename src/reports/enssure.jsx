import React, { useState, useEffect } from 'react';
import {
  Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun,
  WidthType, AlignmentType, VerticalAlign, HeadingLevel, BorderStyle, ShadingType,
} from 'docx';
import { saveAs } from 'file-saver';
import { fyInRange } from './helpers.js';
import { api } from '../utils/api.js';
import { getSession } from '../utils/auth.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n) => n != null && n !== '' ? Number(n).toLocaleString('en-IN') : '—';

function getOccName(occ, occupations) {
  if (occupations?.length && occ.ctevtOccupationId) {
    const found = occupations.find(o => String(o.id) === String(occ.ctevtOccupationId));
    if (found) return found.name;
  }
  return occ.nameInLetter || '—';
}

function getOccLevel(occ, occupations) {
  if (occupations?.length && occ.ctevtOccupationId) {
    const found = occupations.find(o => String(o.id) === String(occ.ctevtOccupationId));
    if (found && found.level) return found.level;
  }
  return occ.level || '—';
}

function occLocationStr(occ) {
  return (occ.locations || [])
    .map(l => [l.palika, l.district, l.province].filter(Boolean).join(', '))
    .filter(Boolean).join('; ') || '—';
}

function buildC1Rows(activeExps, occupations) {
  const rows = [];
  for (const exp of activeExps) {
    for (const occ of (exp.occupations || [])) {
      rows.push({
        occupation: getOccName(occ, occupations),
        program: getOccLevel(occ, occupations),
        trained: occ.trainees || '—',
        passed: occ.skillTestPass || '—',
        empRate: occ.employmentActual ? `${occ.employmentActual}%` : 'NA',
        location: occLocationStr(occ),
        fy: exp.fy || '—',
      });
    }
  }
  return rows;
}

function buildC2Rows(activeExps, occupations, proposedOcc) {
  if (!proposedOcc) return [];
  return buildC1Rows(activeExps, occupations).filter(r =>
    r.occupation.toLowerCase().trim() === proposedOcc.toLowerCase().trim()
  );
}

// ── Screen component ──────────────────────────────────────────────────────────

const TH = { background:'#dce6f1', padding:'6px 8px', border:'1px solid #aab8c8', fontWeight:600, fontSize:11, textAlign:'center', verticalAlign:'middle' };
const TD = { padding:'5px 8px', border:'1px solid #c0c8d0', fontSize:11, verticalAlign:'top' };
const TDN = { ...TD, textAlign:'right' };
const TDC = { ...TD, textAlign:'center' };
const TBL = { width:'100%', borderCollapse:'collapse', marginBottom:12 };
const SEC = { marginBottom:20 };
const SECH = { fontSize:12, fontWeight:700, color:'#1a4a7a', marginBottom:6, borderBottom:'2px solid #1a4a7a', paddingBottom:4 };

function SectionTitle({ children }) {
  return <div style={SECH}>{children}</div>;
}

function ENSSUREReport({ fullInst, activeExps, occupations, opts = {} }) {
  const { fromFY, toFY, enssureOcc, enssureOccId } = opts;
  const [toolsData, setToolsData] = useState([]);

  const taxRows = (fullInst?.taxClearance || [])
    .filter(t => fyInRange(t.fy, fromFY || null, toFY || null))
    .sort((a, b) => (a.fy || '').localeCompare(b.fy || ''));

  const totalTurnover    = taxRows.reduce((s, t) => s + (parseFloat(t.turnover) || 0), 0);
  const totalTaxable     = taxRows.reduce((s, t) => s + (parseFloat(t.taxableIncome) || 0), 0);

  const c1 = buildC1Rows(activeExps, occupations);
  const c2 = buildC2Rows(activeExps, occupations, enssureOcc);

  useEffect(() => {
    if (!enssureOccId) { setToolsData([]); return; }
    const token = getSession()?.token;
    // find the level from affiliated programs or occupations list
    const occ = (occupations || []).find(o => String(o.id) === String(enssureOccId));
    const level = occ?.level || 'Level 1';
    api('GET', `/occupation-tools/${enssureOccId}/${encodeURIComponent(level)}`, null, token)
      .then(d => setToolsData(Array.isArray(d) ? d : []))
      .catch(() => setToolsData([]));
  }, [enssureOccId]);

  const safetyTools = toolsData.filter(t => (t.type || '').toLowerCase().includes('safety'));
  const equipTools  = toolsData.filter(t => !(t.type || '').toLowerCase().includes('safety') && !(t.type || '').toLowerCase().includes('stationery'));

  const C1_COLS = ['SN','Occupation','Program (Level/Hrs)','Trainees Trained','Passed Skill Test','Employment Rate (%)','Training Location (Palika, District, Province)','Fiscal Year'];
  const C2_COLS = C1_COLS;
  const D3_COLS = ['SN','Description','Quantity'];

  return (
    <div style={{ fontFamily:'Arial, sans-serif', fontSize:12 }}>

      {/* B1.4 */}
      <div style={SEC}>
        <SectionTitle>Table B1.4. Financial Information of Bidder</SectionTitle>
        <table style={TBL}>
          <thead>
            <tr>
              <th style={{...TH, textAlign:'left', width:'30%'}}>Description</th>
              {taxRows.map(t => <th key={t.fy} style={TH}>FY {t.fy}</th>)}
              <th style={TH}>Total</th>
              <th style={TH}>Remark</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={TD}>Annual turnover (NRs.)<br/><span style={{fontSize:10,color:'#666'}}>(As per the audited financial statement)</span></td>
              {taxRows.map(t => <td key={t.fy} style={TDN}>{fmt(t.turnover)}</td>)}
              <td style={{...TDN, fontWeight:600}}>{fmt(totalTurnover)}</td>
              <td style={TD}/>
            </tr>
            <tr>
              <td style={TD}>Net profit / Taxable income (Kar Yogya Aay) (NRs.)<br/><span style={{fontSize:10,color:'#666'}}>(As per the audited financial statement)</span></td>
              {taxRows.map(t => <td key={t.fy} style={TDN}>{fmt(t.taxableIncome)}</td>)}
              <td style={{...TDN, fontWeight:600}}>{fmt(totalTaxable)}</td>
              <td style={TD}/>
            </tr>
          </tbody>
        </table>
        {taxRows.length === 0 && <div style={{color:'#888', fontSize:11}}>No tax clearance data for the selected FY range.</div>}
      </div>

      {/* C1 */}
      <div style={SEC}>
        <SectionTitle>C1. General Working Experience in Training Program (last 3 FYs)</SectionTitle>
        <table style={TBL}>
          <thead><tr>{C1_COLS.map(h => <th key={h} style={{...TH, textAlign: h==='Occupation'||h.includes('Location')||h==='Program'?'left':'center'}}>{h}</th>)}</tr></thead>
          <tbody>
            {c1.length === 0 && <tr><td colSpan={8} style={{...TDC, color:'#888'}}>No data</td></tr>}
            {c1.map((r, i) => (
              <tr key={i} style={{ background: i%2===0?'#fff':'#f8fafc' }}>
                <td style={TDC}>{i+1}</td>
                <td style={TD}>{r.occupation}</td>
                <td style={TD}>{r.program}</td>
                <td style={TDN}>{r.trained}</td>
                <td style={TDN}>{r.passed}</td>
                <td style={TDC}>{r.empRate}</td>
                <td style={TD}>{r.location}</td>
                <td style={TDC}>{r.fy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* C2 */}
      <div style={SEC}>
        <SectionTitle>C2. Specific Experience in Related Occupation {enssureOcc ? `— ${enssureOcc}` : '(select proposed occupation)'}</SectionTitle>
        {!enssureOcc && <div style={{color:'#e65100', fontSize:11, marginBottom:6}}>Select the proposed occupation from the filter panel to populate C2.</div>}
        <table style={TBL}>
          <thead><tr>{C2_COLS.map(h => <th key={h} style={{...TH, textAlign: h==='Occupation'||h.includes('Location')||h==='Program'?'left':'center'}}>{h}</th>)}</tr></thead>
          <tbody>
            {c2.length === 0 && <tr><td colSpan={8} style={{...TDC, color:'#888'}}>{enssureOcc ? 'No experience found for this occupation.' : '—'}</td></tr>}
            {c2.map((r, i) => (
              <tr key={i} style={{ background: i%2===0?'#fff':'#f8fafc' }}>
                <td style={TDC}>{i+1}</td>
                <td style={TD}>{r.occupation}</td>
                <td style={TD}>{r.program}</td>
                <td style={TDN}>{r.trained}</td>
                <td style={TDN}>{r.passed}</td>
                <td style={TDC}>{r.empRate}</td>
                <td style={TD}>{r.location}</td>
                <td style={TDC}>{r.fy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* D1 */}
      <div style={SEC}>
        <SectionTitle>TECH D — Available Infrastructure and Equipment</SectionTitle>
        <div style={{ fontWeight:600, marginBottom:4, fontSize:11 }}>D1. Office Space and Training Facilities</div>
        <table style={TBL}>
          <thead><tr>
            {['S.N.','Particular','Description','Unit (Number)','Size','Remark'].map(h => <th key={h} style={TH}>{h}</th>)}
          </tr></thead>
          <tbody>
            {[1,2,3].map(i => (
              <tr key={i}><td style={TDC}>{i}</td><td style={TD}/><td style={TD}/><td style={TDC}/><td style={TD}/><td style={TD}/></tr>
            ))}
          </tbody>
        </table>
        <div style={{fontSize:10, color:'#888'}}>Fill in office space details in the exported Word document.</div>
      </div>

      {/* D2 */}
      <div style={SEC}>
        <div style={{ fontWeight:600, marginBottom:4, fontSize:11 }}>D2. Safety Equipments</div>
        <table style={TBL}>
          <thead><tr>
            {['S.N.','Particular','Description','Unit (Number)','Size','Remark'].map(h => <th key={h} style={TH}>{h}</th>)}
          </tr></thead>
          <tbody>
            {safetyTools.length === 0 && <tr><td colSpan={6} style={{...TDC, color:'#888'}}>{enssureOccId ? 'No safety tools found.' : 'Select proposed occupation to load safety equipment.'}</td></tr>}
            {safetyTools.map((t, i) => (
              <tr key={t.id} style={{ background: i%2===0?'#fff':'#f8fafc' }}>
                <td style={TDC}>{i+1}</td>
                <td style={TD}>{t.name}</td>
                <td style={TD}>{t.description || '—'}</td>
                <td style={TDC}>{t.quantity ?? '—'}</td>
                <td style={TD}>—</td>
                <td style={TD}>{t.remarks || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* D3 */}
      <div style={SEC}>
        <div style={{ fontWeight:600, marginBottom:4, fontSize:11 }}>D3. List of Tools, Equipment and Training Materials Available</div>
        <table style={TBL}>
          <thead><tr>
            {['SN','Description','Quantity (Pieces, Rolls, Bottles etc.)'].map(h => <th key={h} style={TH}>{h}</th>)}
          </tr></thead>
          <tbody>
            {equipTools.length === 0 && <tr><td colSpan={3} style={{...TDC, color:'#888'}}>{enssureOccId ? 'No tools found.' : 'Select proposed occupation to load tools.'}</td></tr>}
            {equipTools.map((t, i) => (
              <tr key={t.id} style={{ background: i%2===0?'#fff':'#f8fafc' }}>
                <td style={TDC}>{i+1}</td>
                <td style={TD}>{t.name}{t.description ? ` — ${t.description}` : ''}</td>
                <td style={TDN}>{t.quantity != null ? `${t.quantity} ${t.unit || ''}`.trim() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}

// ── Print HTML ────────────────────────────────────────────────────────────────

function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function buildENSSUREPrintHTML(fullInst, activeExps, clients, reportId, fyRangeLabel, opts = {}) {
  const { fromFY, toFY, enssureOcc, enssureOccId, occupations = [], enssureToolsData = [] } = opts;

  const taxRows = (fullInst?.taxClearance || [])
    .filter(t => fyInRange(t.fy, fromFY || null, toFY || null))
    .sort((a, b) => (a.fy || '').localeCompare(b.fy || ''));
  const totalTurnover = taxRows.reduce((s, t) => s + (parseFloat(t.turnover) || 0), 0);
  const totalTaxable  = taxRows.reduce((s, t) => s + (parseFloat(t.taxableIncome) || 0), 0);

  const c1 = buildC1Rows(activeExps, occupations);
  const c2 = buildC2Rows(activeExps, occupations, enssureOcc);
  const safetyTools = enssureToolsData.filter(t => (t.type||'').toLowerCase().includes('safety'));
  const equipTools  = enssureToolsData.filter(t => !(t.type||'').toLowerCase().includes('safety') && !(t.type||'').toLowerCase().includes('stationery'));

  const fyHdrs = taxRows.map(t => `<th>FY ${esc(t.fy)}</th>`).join('');
  const expCols = (row) => taxRows.map(t => `<td class="r">${t.id === row.id ? '' : ''}</td>`).join('');

  const css = `
    body{font-family:Arial,sans-serif;font-size:10.5px;margin:16px;color:#111}
    h2{font-size:13px;margin-bottom:2px}
    h3{font-size:11.5px;margin:14px 0 4px;font-weight:700;border-bottom:2px solid #1a4a7a;padding-bottom:3px;color:#1a4a7a}
    h4{font-size:11px;font-weight:700;margin:10px 0 3px}
    table{border-collapse:collapse;width:100%;margin:4px 0 10px;font-size:10px}
    th,td{border:1px solid #999;padding:3px 6px}
    th{background:#d5dde8;font-weight:600;text-align:center}
    td.r{text-align:right} td.c{text-align:center}
    .note{font-size:9px;color:#666}
    @media print{body{margin:8mm}h3{page-break-before:avoid}}
  `;

  const expColsHeader = `<th>#</th><th>Occupation</th><th>Program (Level/Hrs)</th><th>Trainees Trained</th><th>Passed Skill Test</th><th>Employment Rate (%)</th><th>Training Location</th><th>Fiscal Year</th>`;
  const expRow = (r, i) => `<tr><td class="c">${i+1}</td><td>${esc(r.occupation)}</td><td>${esc(r.program)}</td><td class="r">${esc(r.trained)}</td><td class="r">${esc(r.passed)}</td><td class="c">${esc(r.empRate)}</td><td>${esc(r.location)}</td><td class="c">${esc(r.fy)}</td></tr>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>ENSSURE Report — ${esc(fullInst?.name||'')}</title><style>${css}</style></head><body>
<h2>${esc(fullInst?.name||'')} — ENSSURE Report</h2>
${fyRangeLabel ? `<p class="note">FY Range: ${esc(fyRangeLabel)}</p>` : ''}

<h3>Table B1.4. Financial Information of Bidder</h3>
<table><thead><tr><th>Description</th>${fyHdrs}<th>Total</th><th>Remark</th></tr></thead><tbody>
<tr><td>Annual turnover (NRs.)<br/><span class="note">(As per the audited financial statement)</span></td>${taxRows.map(t=>`<td class="r">${esc(fmt(t.turnover))}</td>`).join('')}<td class="r"><b>${esc(fmt(totalTurnover))}</b></td><td></td></tr>
<tr><td>Net profit / Taxable income (Kar Yogya Aay) (NRs.)<br/><span class="note">(As per the audited financial statement)</span></td>${taxRows.map(t=>`<td class="r">${esc(fmt(t.taxableIncome))}</td>`).join('')}<td class="r"><b>${esc(fmt(totalTaxable))}</b></td><td></td></tr>
</tbody></table>

<h3>C1. General Working Experience in Training Program (last 3 FYs)</h3>
<table><thead><tr>${expColsHeader}</tr></thead><tbody>
${c1.length ? c1.map(expRow).join('') : `<tr><td colspan="8" class="c" style="color:#888">No data</td></tr>`}
</tbody></table>

<h3>C2. Specific Experience in Related Occupation${enssureOcc ? ` — ${esc(enssureOcc)}` : ''}</h3>
<table><thead><tr>${expColsHeader}</tr></thead><tbody>
${c2.length ? c2.map(expRow).join('') : `<tr><td colspan="8" class="c" style="color:#888">${enssureOcc ? 'No experience found.' : '—'}</td></tr>`}
</tbody></table>

<h3>TECH D — Available Infrastructure and Equipment</h3>
<h4>D1. Office Space and Training Facilities</h4>
<table><thead><tr><th>S.N.</th><th>Particular</th><th>Description</th><th>Unit (Number)</th><th>Size</th><th>Remark</th></tr></thead><tbody>
${[1,2,3].map(i=>`<tr><td class="c">${i}</td><td></td><td></td><td class="c"></td><td></td><td></td></tr>`).join('')}
</tbody></table>

<h4>D2. Safety Equipments</h4>
<table><thead><tr><th>S.N.</th><th>Particular</th><th>Description</th><th>Unit (Number)</th><th>Size</th><th>Remark</th></tr></thead><tbody>
${safetyTools.length ? safetyTools.map((t,i)=>`<tr><td class="c">${i+1}</td><td>${esc(t.name)}</td><td>${esc(t.description||'—')}</td><td class="c">${t.quantity??'—'}</td><td>—</td><td>${esc(t.remarks||'')}</td></tr>`).join('') : `<tr><td colspan="6" class="c" style="color:#888">No safety tools found.</td></tr>`}
</tbody></table>

<h4>D3. List of Tools, Equipment and Training Materials Available</h4>
<table><thead><tr><th>SN</th><th>Description</th><th>Quantity (Pieces, Rolls, Bottles etc.)</th></tr></thead><tbody>
${equipTools.length ? equipTools.map((t,i)=>`<tr><td class="c">${i+1}</td><td>${esc(t.name)}${t.description?` — ${esc(t.description)}`:''}</td><td class="r">${t.quantity!=null?`${t.quantity} ${t.unit||''}`.trim():'—'}</td></tr>`).join('') : `<tr><td colspan="3" class="c" style="color:#888">No tools found.</td></tr>`}
</tbody></table>

</body></html>`;
}

// ── DOCX ──────────────────────────────────────────────────────────────────────

const BORD = { style: BorderStyle.SINGLE, size: 4, color: '999999' };
const ALL_B = { top: BORD, bottom: BORD, left: BORD, right: BORD };
const CM = { top: 40, bottom: 40, left: 100, right: 100 };
const HDR_FILL = 'D5DDE8';

function dCell(text, opts = {}) {
  return new TableCell({
    shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR } : undefined,
    borders: ALL_B, verticalAlign: VerticalAlign.CENTER,
    columnSpan: opts.span || 1, margins: CM,
    children: [new Paragraph({
      alignment: opts.right ? AlignmentType.RIGHT : opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({ text: String(text ?? ''), bold: !!opts.bold, size: 18, italics: !!opts.italic })],
    })],
  });
}
function hCell(text, opts = {}) {
  return new TableCell({
    shading: { fill: HDR_FILL, type: ShadingType.CLEAR },
    borders: ALL_B, verticalAlign: VerticalAlign.CENTER,
    columnSpan: opts.span || 1, margins: CM,
    children: [new Paragraph({
      alignment: opts.left ? AlignmentType.LEFT : AlignmentType.CENTER,
      children: [new TextRun({ text: String(text ?? ''), bold: true, size: 18 })],
    })],
  });
}
function secHead(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 80 },
    children: [new TextRun({ text, bold: true, size: 24 })],
  });
}
function subHead(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 160, after: 60 },
    children: [new TextRun({ text, bold: true, size: 20 })],
  });
}
function spacer() { return new Paragraph({ spacing: { before: 80 }, children: [] }); }

async function downloadENSSUREDOCX(fullInst, activeExps, reportId, opts = {}) {
  const { fromFY, toFY, enssureOcc, occupations = [], enssureToolsData = [] } = opts;
  const firmName = fullInst?.name || 'Firm';
  const fyLabel = fromFY || toFY ? `FY ${fromFY || '…'} – ${toFY || '…'}` : '';

  const taxRows = (fullInst?.taxClearance || [])
    .filter(t => fyInRange(t.fy, fromFY || null, toFY || null))
    .sort((a, b) => (a.fy || '').localeCompare(b.fy || ''));
  const totalTurnover = taxRows.reduce((s, t) => s + (parseFloat(t.turnover) || 0), 0);
  const totalTaxable  = taxRows.reduce((s, t) => s + (parseFloat(t.taxableIncome) || 0), 0);

  const c1 = buildC1Rows(activeExps, occupations);
  const c2 = buildC2Rows(activeExps, occupations, enssureOcc);
  const safetyTools = enssureToolsData.filter(t => (t.type||'').toLowerCase().includes('safety'));
  const equipTools  = enssureToolsData.filter(t => !(t.type||'').toLowerCase().includes('safety') && !(t.type||'').toLowerCase().includes('stationery'));

  // Page width A4 portrait with 1" margins: 11906 - 2880 = 9026 DXA
  const PW = 9026;

  const children = [
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: `${firmName} — ENSSURE Report`, bold: true, size: 28 })] }),
    ...(fyLabel ? [new Paragraph({ children: [new TextRun({ text: `FY Range: ${fyLabel}`, size: 20, color: '555555' })] })] : []),
    spacer(),

    // ── B1.4 ──
    secHead('Table B1.4. Financial Information of Bidder'),
  ];

  if (taxRows.length === 0) {
    children.push(new Paragraph({ children: [new TextRun({ text: 'No tax clearance data for selected FY range.', size: 18, italics: true, color: '888888' })] }));
  } else {
    const fyColW = Math.min(1400, Math.floor((PW - 2800 - 800) / (taxRows.length + 1)));
    const descW = PW - (taxRows.length + 1) * fyColW - 800;
    children.push(new Table({
      width: { size: PW, type: WidthType.DXA },
      columnWidths: [descW, ...taxRows.map(() => fyColW), fyColW, 800],
      rows: [
        new TableRow({ tableHeader: true, children: [
          hCell('Description', { left: true }),
          ...taxRows.map(t => hCell(`FY ${t.fy}`)),
          hCell('Total'), hCell('Remark'),
        ]}),
        new TableRow({ children: [
          new TableCell({ borders: ALL_B, margins: CM, width: { size: descW, type: WidthType.DXA }, children: [
            new Paragraph({ children: [new TextRun({ text: 'Annual turnover (NRs.)', size: 18 })] }),
            new Paragraph({ children: [new TextRun({ text: '(As per the audited financial statement)', size: 16, italics: true, color: '666666' })] }),
          ]}),
          ...taxRows.map(t => dCell(fmt(t.turnover), { right: true })),
          dCell(fmt(totalTurnover), { right: true, bold: true }),
          dCell(''),
        ]}),
        new TableRow({ children: [
          new TableCell({ borders: ALL_B, margins: CM, width: { size: descW, type: WidthType.DXA }, children: [
            new Paragraph({ children: [new TextRun({ text: 'Net profit / Taxable income (Kar Yogya Aay) (NRs.)', size: 18 })] }),
            new Paragraph({ children: [new TextRun({ text: '(As per the audited financial statement)', size: 16, italics: true, color: '666666' })] }),
          ]}),
          ...taxRows.map(t => dCell(fmt(t.taxableIncome), { right: true })),
          dCell(fmt(totalTaxable), { right: true, bold: true }),
          dCell(''),
        ]}),
      ],
    }));
  }

  // ── C1 ──
  const expColW = [320, 1600, 1200, 900, 900, 900, 2100, 900];
  const expHdrs = ['SN','Occupation','Program (Level/Hrs)','Trainees Trained','Passed Skill Test','Employment Rate (%)','Training Location','Fiscal Year'];

  children.push(spacer(), secHead('C1. General Working Experience in Training Program (last 3 FYs)'));
  children.push(new Table({
    width: { size: PW, type: WidthType.DXA },
    columnWidths: expColW,
    rows: [
      new TableRow({ tableHeader: true, children: expHdrs.map((h, i) => hCell(h, { left: i === 1 || i === 6 })) }),
      ...(c1.length === 0 ? [new TableRow({ children: [new TableCell({ borders: ALL_B, margins: CM, columnSpan: 8, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'No data', size: 18, italics: true, color: '888888' })] })] })] })] :
        c1.map((r, i) => new TableRow({ children: [
          dCell(i+1, { center: true }), dCell(r.occupation), dCell(r.program),
          dCell(r.trained, { right: true }), dCell(r.passed, { right: true }),
          dCell(r.empRate, { center: true }), dCell(r.location), dCell(r.fy, { center: true }),
        ]}))),
    ],
  }));

  // ── C2 ──
  children.push(spacer(), secHead(`C2. Specific Experience in Related Occupation${enssureOcc ? ` — ${enssureOcc}` : ''}`));
  children.push(new Table({
    width: { size: PW, type: WidthType.DXA },
    columnWidths: expColW,
    rows: [
      new TableRow({ tableHeader: true, children: expHdrs.map((h, i) => hCell(h, { left: i === 1 || i === 6 })) }),
      ...(c2.length === 0 ? [new TableRow({ children: [new TableCell({ borders: ALL_B, margins: CM, columnSpan: 8, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: enssureOcc ? 'No experience found.' : '—', size: 18, italics: true, color: '888888' })] })] })] })] :
        c2.map((r, i) => new TableRow({ children: [
          dCell(i+1, { center: true }), dCell(r.occupation), dCell(r.program),
          dCell(r.trained, { right: true }), dCell(r.passed, { right: true }),
          dCell(r.empRate, { center: true }), dCell(r.location), dCell(r.fy, { center: true }),
        ]}))),
    ],
  }));

  // ── Tech D ──
  children.push(spacer(), secHead('TECH D — Available Infrastructure and Equipment'));

  // D1
  children.push(subHead('D1. Office Space and Training Facilities'));
  const d1ColW = [600, 1800, 2500, 1200, 1300, 1626];
  children.push(new Table({
    width: { size: PW, type: WidthType.DXA }, columnWidths: d1ColW,
    rows: [
      new TableRow({ tableHeader: true, children: ['S.N.','Particular','Description','Unit (Number)','Size','Remark'].map(h => hCell(h)) }),
      ...[1,2,3].map(i => new TableRow({ children: [dCell(i,{center:true}), dCell(''), dCell(''), dCell('',{center:true}), dCell(''), dCell('')] })),
    ],
  }));
  children.push(new Paragraph({ children: [new TextRun({ text: '(Fill in office space details manually)', size: 16, italics: true, color: '888888' })] }));

  // D2
  children.push(subHead('D2. Safety Equipments'));
  children.push(new Table({
    width: { size: PW, type: WidthType.DXA }, columnWidths: d1ColW,
    rows: [
      new TableRow({ tableHeader: true, children: ['S.N.','Particular','Description','Unit (Number)','Size','Remark'].map(h => hCell(h)) }),
      ...(safetyTools.length === 0 ? [new TableRow({ children: [new TableCell({ borders: ALL_B, margins: CM, columnSpan: 6, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'No safety tools found.', size: 18, italics: true, color: '888888' })] })] })] })] :
        safetyTools.map((t, i) => new TableRow({ children: [
          dCell(i+1,{center:true}), dCell(t.name), dCell(t.description||'—'),
          dCell(t.quantity??'—',{center:true}), dCell('—'), dCell(t.remarks||''),
        ]}))),
    ],
  }));

  // D3
  children.push(subHead('D3. List of Tools, Equipment and Training Materials Available'));
  const d3ColW = [400, 6426, 2200];
  children.push(new Table({
    width: { size: PW, type: WidthType.DXA }, columnWidths: d3ColW,
    rows: [
      new TableRow({ tableHeader: true, children: ['SN','Description','Quantity (Pieces, Rolls, Bottles etc.)'].map((h,i) => hCell(h, { left: i===1 })) }),
      ...(equipTools.length === 0 ? [new TableRow({ children: [new TableCell({ borders: ALL_B, margins: CM, columnSpan: 3, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'No tools found.', size: 18, italics: true, color: '888888' })] })] })] })] :
        equipTools.map((t, i) => new TableRow({ children: [
          dCell(i+1,{center:true}),
          dCell(`${t.name}${t.description ? ` — ${t.description}` : ''}`),
          dCell(t.quantity != null ? `${t.quantity} ${t.unit||''}`.trim() : '—', { right: true }),
        ]}))),
    ],
  }));

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 20 } } } },
    sections: [{ properties: {}, children }],
  });

  const blob = await Packer.toBlob(doc);
  const fname = `ENSSURE_${(fullInst?.acronym || firmName).replace(/\s+/g,'_')}${fyLabel ? `_${fyLabel.replace(/[^\w]+/g,'_')}` : ''}.docx`;
  saveAs(blob, fname);
}

// ── Report family ─────────────────────────────────────────────────────────────

export const REPORTS = [
  {
    id: 'enssure1',
    label: 'ENSSURE Full Report',
    aggregate: true,
    hasOccupationFilter: false,
    requiredFields: [],
    columns: [],
  },
];

export function renderAggregateTable(fullInst, activeExps, clients, reportId, opts = {}) {
  return <ENSSUREReport fullInst={fullInst} activeExps={activeExps} occupations={opts.occupations || []} opts={opts} />;
}

export function renderRowCells() { return null; }
export function buildCSVRow() { return {}; }

export function buildPrintHTML(fullInst, activeExps, clients, reportId, fyRangeLabel, opts = {}) {
  return buildENSSUREPrintHTML(fullInst, activeExps, clients, reportId, fyRangeLabel, opts);
}

export async function downloadDOCX(fullInst, activeExps, reportId, opts = {}) {
  return downloadENSSUREDOCX(fullInst, activeExps, reportId, opts);
}

export default {
  id: 'enssure',
  label: 'ENSSURE',
  noInstitute: false,
  reports: REPORTS,
  renderRowCells,
  buildCSVRow,
  buildPrintHTML,
  renderAggregateTable,
  downloadDOCX,
};

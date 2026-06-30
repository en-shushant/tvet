import { useState, useEffect, useCallback } from 'react';
import {
  Document, Packer, Table, TableRow, TableCell, Paragraph, TextRun,
  WidthType, AlignmentType, VerticalAlign, HeadingLevel,
} from 'docx';
import { saveAs } from 'file-saver';
import { esc } from './helpers.js';
import { api } from '../utils/api.js';
import { getSession } from '../utils/auth.js';

const ALL_COLUMNS = [
  { key: 'sn',          label: 'S.N.' },
  { key: 'name',        label: 'Name' },
  { key: 'description', label: 'Description' },
  { key: 'unit',        label: 'Unit' },
  { key: 'quantity',    label: 'Quantity' },
  { key: 'ownership',   label: 'Ownership' },
  { key: 'type',        label: 'Type' },
  { key: 'remarks',     label: 'Remarks' },
];

const DEFAULT_COLS = ['sn', 'name', 'description', 'unit', 'quantity', 'ownership', 'type', 'remarks'];

// ── Aggregate table component ───────────────────────────────────────────────

const TYPE_SECTIONS = [
  { key: 'tools',       type: 'Tool',         label: 'Tools',         bg: '#d1ecf1', fg: '#0c5460', sectionBg: '#e8f0fe' },
  { key: 'consumables', type: 'Consumable',    label: 'Consumables',   bg: '#fef3cd', fg: '#856404', sectionBg: '#fff8e1' },
  { key: 'safety',      type: 'Safety Tool',   label: 'Safety Tools',  bg: '#d4edda', fg: '#155724', sectionBg: '#eaf6ec' },
  { key: 'stationery',  type: 'Stationery',    label: 'Stationery',    bg: '#e2d9f3', fg: '#4a1d96', sectionBg: '#f3eeff' },
];

function ToolsReport({ opts }) {
  const { toolsOccIds = [], toolsLevel = '', occupations = [], toolsTypeFilter = 'all',
          toolsColumns = DEFAULT_COLS, toolsLayout = 'combined', numGroups = 1 } = opts;
  const groups = Math.max(1, parseInt(numGroups) || 1);

  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!toolsOccIds.length || !toolsLevel) { setData({}); return; }
    setLoading(true);
    const result = {};
    const token = getSession()?.token;
    for (const occId of toolsOccIds) {
      try {
        const items = await api('GET', `/occupation-tools/${occId}/${encodeURIComponent(toolsLevel)}`, null, token);
        result[occId] = items || [];
      } catch { result[occId] = []; }
    }
    setData(result);
    setLoading(false);
  }, [toolsOccIds.join(','), toolsLevel]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (!toolsOccIds.length || !toolsLevel) return (
    <div style={{padding:24, color:'var(--text3)', fontSize:13, textAlign:'center'}}>
      Select at least one occupation and a level from the filter panel.
    </div>
  );

  if (loading) return (
    <div style={{padding:24, color:'var(--text3)', fontSize:13, textAlign:'center'}}>Loading tools data...</div>
  );

  const cols = ALL_COLUMNS.filter(c => toolsColumns.includes(c.key));
  const TH = { background:'#dce6f1', padding:'7px 10px', border:'1px solid #aab8c8', fontWeight:600, fontSize:12, textAlign:'center', verticalAlign:'middle' };
  const TD = { padding:'6px 10px', border:'1px solid #c0c8d0', fontSize:12, verticalAlign:'middle' };
  const TDN = { ...TD, textAlign:'right' };
  const TBL = { width:'100%', borderCollapse:'collapse', marginTop:6 };
  const SECTION_STYLE = { fontWeight:600, fontSize:13, marginTop:16, marginBottom:6 };

  const filterByType = (items) => {
    if (toolsTypeFilter === 'all') return items;
    const typeMap = {tools:'Tool', consumables:'Consumable', safety:'Safety Tool', stationery:'Stationery'};
    return items.filter(t => t.type === typeMap[toolsTypeFilter]);
  };

  const scaledQty = (t) => t.quantity != null ? t.quantity * groups : null;

  const renderTable = (items, startSN = 1) => (
    <table style={TBL}>
      <thead>
        <tr>{cols.map(c => <th key={c.key} style={TH}>{c.key === 'quantity' && groups > 1 ? `Quantity (×${groups})` : c.label}</th>)}</tr>
      </thead>
      <tbody>
        {items.length === 0 ? (
          <tr><td colSpan={cols.length} style={{...TD, textAlign:'center', color:'var(--text3)'}}>No items found.</td></tr>
        ) : items.map((t, i) => (
          <tr key={t.id}>
            {cols.map(c => {
              if (c.key === 'sn') return <td key={c.key} style={{...TD, textAlign:'center'}}>{startSN + i}</td>;
              if (c.key === 'quantity') return <td key={c.key} style={TDN}>{scaledQty(t) ?? '—'}</td>;
              if (c.key === 'type') {
                const sec = TYPE_SECTIONS.find(s => s.type === t.type) || {};
                return <td key={c.key} style={TD}><span style={{padding:'1px 6px',borderRadius:3,fontSize:10,fontWeight:600,background:sec.bg||'#eee',color:sec.fg||'#333'}}>{t.type}</span></td>;
              }
              return <td key={c.key} style={TD}>{t[c.key] || '—'}</td>;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );

  const occName = (id) => {
    const o = occupations.find(o => String(o.id) === String(id));
    return o ? `${o.name}${o.level ? ` (${o.level})` : ''}` : `Occupation #${id}`;
  };

  if (toolsLayout === 'separate_tables') {
    return (
      <div>
        {toolsOccIds.map(occId => {
          const items = filterByType(data[occId] || []);
          const activeSections = TYPE_SECTIONS.filter(s =>
            (toolsTypeFilter === 'all' || toolsTypeFilter === s.key) && items.filter(t => t.type === s.type).length > 0
          );
          return (
            <div key={occId} style={{marginBottom:24}}>
              <div style={{...SECTION_STYLE, fontSize:14}}>{occName(occId)} — {toolsLevel}</div>
              {activeSections.length === 0 && <div style={{padding:12, color:'var(--text3)', fontSize:12}}>No items.</div>}
              {activeSections.map((sec, si) => {
                const sectionItems = items.filter(t => t.type === sec.type);
                const startSN = activeSections.slice(0, si).reduce((s, ps) => s + items.filter(t => t.type === ps.type).length, 1);
                return (
                  <div key={sec.key}>
                    <div style={{...SECTION_STYLE, fontSize:12, color:'var(--text2)'}}>{sec.label}</div>
                    {renderTable(sectionItems, startSN)}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  }

  if (toolsLayout === 'separate_sections') {
    return (
      <div>
        {toolsOccIds.map(occId => {
          const allItems = filterByType(data[occId] || []);
          let sn = 1;
          return (
            <div key={occId} style={{marginBottom:24}}>
              <div style={{...SECTION_STYLE, fontSize:14}}>{occName(occId)} — {toolsLevel}</div>
              <table style={TBL}>
                <thead>
                  <tr>{cols.map(c => <th key={c.key} style={TH}>{c.key === 'quantity' && groups > 1 ? `Quantity (×${groups})` : c.label}</th>)}</tr>
                </thead>
                <tbody>
                  {TYPE_SECTIONS.filter(s => toolsTypeFilter === 'all' || toolsTypeFilter === s.key).map(sec => {
                    const secItems = allItems.filter(t => t.type === sec.type);
                    if (!secItems.length) return null;
                    const snStart = sn;
                    sn += secItems.length;
                    return (
                      <>
                        <tr key={`hdr-${sec.key}`}><td colSpan={cols.length} style={{...TD, background:sec.sectionBg, fontWeight:600, fontSize:11}}>{sec.label}</td></tr>
                        {secItems.map((t, i) => (
                          <tr key={t.id}>
                            {cols.map(c => {
                              if (c.key === 'sn') return <td key={c.key} style={{...TD, textAlign:'center'}}>{snStart + i}</td>;
                              if (c.key === 'quantity') return <td key={c.key} style={TDN}>{scaledQty(t) ?? '—'}</td>;
                              if (c.key === 'type') return <td key={c.key} style={TD}><span style={{padding:'1px 6px',borderRadius:3,fontSize:10,fontWeight:600,background:sec.bg,color:sec.fg}}>{t.type}</span></td>;
                              return <td key={c.key} style={TD}>{t[c.key] || '—'}</td>;
                            })}
                          </tr>
                        ))}
                      </>
                    );
                  })}
                  {allItems.length === 0 && (
                    <tr><td colSpan={cols.length} style={{...TD, textAlign:'center', color:'var(--text3)'}}>No items.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    );
  }

  // combined (default)
  let globalSN = 1;
  return (
    <div>
      {toolsOccIds.map(occId => {
        const items = filterByType(data[occId] || []);
        const startSN = globalSN;
        globalSN += items.length;
        return (
          <div key={occId} style={{marginBottom:24}}>
            <div style={SECTION_STYLE}>{occName(occId)} — {toolsLevel}</div>
            {renderTable(items, startSN)}
          </div>
        );
      })}
    </div>
  );
}

// ── DOCX export ─────────────────────────────────────────────────────────────

const BORDER = { style: 'single', size: 6, color: '888888' };
const ALL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };
const HEADER_FILL = 'DCE6F1';
const CELL_MARGIN = { top: 40, bottom: 40, left: 80, right: 80 };

function hdrCell(text) {
  return new TableCell({
    shading: { fill: HEADER_FILL }, borders: ALL_BORDERS, verticalAlign: VerticalAlign.CENTER, margins: CELL_MARGIN,
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(text ?? ''), bold: true, size: 20 })] })],
  });
}
function dataCell(text, opts = {}) {
  return new TableCell({
    shading: opts.shading ? { fill: opts.shading } : undefined, borders: ALL_BORDERS, verticalAlign: VerticalAlign.CENTER, margins: CELL_MARGIN,
    children: [new Paragraph({
      alignment: opts.right ? AlignmentType.RIGHT : opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({ text: String(text ?? ''), bold: !!opts.bold, size: 20 })],
    })],
  });
}

function buildDocxTable(items, cols, startSN = 1, sectionLabel = null, scaleQtyFn = null) {
  const rows = [];
  if (sectionLabel) {
    rows.push(new TableRow({
      children: [new TableCell({
        columnSpan: cols.length, borders: ALL_BORDERS,
        shading: { fill: sectionLabel === 'Tools' ? 'D1ECF1' : 'FEF3CD' },
        children: [new Paragraph({ children: [new TextRun({ text: sectionLabel, bold: true, size: 18 })] })],
      })],
    }));
  }
  rows.push(new TableRow({ tableHeader: true, children: cols.map(c => hdrCell(c.label)) }));
  items.forEach((t, i) => {
    rows.push(new TableRow({
      children: cols.map(c => {
        if (c.key === 'sn') return dataCell(startSN + i, { center: true });
        if (c.key === 'quantity') return dataCell(scaleQtyFn ? scaleQtyFn(t) ?? '—' : t.quantity ?? '—', { right: true });
        return dataCell(t[c.key] || '—');
      }),
    }));
  });
  return rows;
}

async function downloadToolsDOCX(fullInst, activeExps, reportId, opts = {}) {
  const { toolsOccIds = [], toolsLevel = '', occupations = [], toolsTypeFilter = 'all',
          toolsColumns = DEFAULT_COLS, toolsLayout = 'combined', numGroups = 1 } = opts;
  const groups = Math.max(1, parseInt(numGroups) || 1);
  const scaledQty = (t) => t.quantity != null ? t.quantity * groups : null;

  if (!toolsOccIds.length || !toolsLevel) { alert('Select occupation and level first.'); return; }

  const cols = ALL_COLUMNS.filter(c => toolsColumns.includes(c.key));
  const token = getSession()?.token;

  const allData = {};
  for (const occId of toolsOccIds) {
    try {
      allData[occId] = await api('GET', `/occupation-tools/${occId}/${encodeURIComponent(toolsLevel)}`, null, token);
    } catch { allData[occId] = []; }
  }

  const occNameFn = (id) => {
    const o = occupations.find(o => String(o.id) === String(id));
    return o ? `${o.name}${o.level ? ` (${o.level})` : ''}` : `Occupation #${id}`;
  };

  const filterByType = (items) => {
    if (toolsTypeFilter === 'all') return items;
    const typeMap = {tools:'Tool', consumables:'Consumable', safety:'Safety Tool', stationery:'Stationery'};
    return items.filter(t => t.type === typeMap[toolsTypeFilter]);
  };

  const children = [
    new Paragraph({
      heading: HeadingLevel.HEADING_2, spacing: { after: 100 },
      children: [new TextRun({ text: `Tools & Consumables List — ${toolsLevel}`, bold: true, size: 28 })],
    }),
  ];

  let globalSN = 1;
  for (const occId of toolsOccIds) {
    const items = filterByType(allData[occId] || []);
    const name = occNameFn(occId);

    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_3, spacing: { before: 240, after: 100 },
      children: [new TextRun({ text: name, bold: true, size: 24 })],
    }));

    let tableRows = [];

    if (toolsLayout === 'separate_tables') {
      for (const sec of TYPE_SECTIONS) {
        if (toolsTypeFilter !== 'all' && toolsTypeFilter !== sec.key) continue;
        const secItems = items.filter(t => t.type === sec.type);
        if (!secItems.length) continue;
        children.push(new Paragraph({ spacing: { before: 160 }, children: [new TextRun({ text: sec.label, bold: true, size: 20 })] }));
        tableRows = buildDocxTable(secItems, cols, globalSN, null, scaledQty);
        children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: tableRows }));
        globalSN += secItems.length;
      }
      continue;
    }

    if (toolsLayout === 'separate_sections') {
      tableRows = [];
      for (const sec of TYPE_SECTIONS) {
        if (toolsTypeFilter !== 'all' && toolsTypeFilter !== sec.key) continue;
        const secItems = items.filter(t => t.type === sec.type);
        if (!secItems.length) continue;
        tableRows.push(...buildDocxTable(secItems, cols, globalSN, sec.label, scaledQty));
        globalSN += secItems.length;
      }
      if (tableRows.length) children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: tableRows }));
    } else {
      tableRows = buildDocxTable(items, cols, globalSN, null, scaledQty);
      if (tableRows.length) children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: tableRows }));
      globalSN += items.length;
    }
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 22 } } } },
    sections: [{ properties: {}, children }],
  });

  const blob = await Packer.toBlob(doc);
  const fname = `Tools_Consumables_${toolsLevel.replace(/\s+/g,'_')}.docx`;
  saveAs(blob, fname);
}

// ── Print HTML ──────────────────────────────────────────────────────────────

function buildToolsPrintHTML(fullInst, activeExps, clients, reportId, fyRangeLabel, opts = {}) {
  const { toolsOccIds = [], toolsLevel = '', occupations = [], toolsTypeFilter = 'all',
          toolsColumns = DEFAULT_COLS, toolsLayout = 'combined', numGroups = 1 } = opts;
  const groups = Math.max(1, parseInt(numGroups) || 1);
  const scaledQty = (t) => t.quantity != null ? t.quantity * groups : null;

  const cols = ALL_COLUMNS.filter(c => toolsColumns.includes(c.key));
  const occNameFn = (id) => {
    const o = occupations.find(o => String(o.id) === String(id));
    return o ? `${o.name}${o.level ? ` (${o.level})` : ''}` : `Occupation #${id}`;
  };

  const filterByType = (items) => {
    if (toolsTypeFilter === 'all') return items;
    const typeMap = {tools:'Tool', consumables:'Consumable', safety:'Safety Tool', stationery:'Stationery'};
    return items.filter(t => t.type === typeMap[toolsTypeFilter]);
  };

  const headerHTML = cols.map(c => `<th>${esc(qtyHeader(c))}</th>`).join('');

  const renderRows = (items, startSN) => items.map((t, i) =>
    `<tr>${cols.map(c => {
      if (c.key === 'sn') return `<td style="text-align:center">${startSN + i}</td>`;
      if (c.key === 'quantity') return `<td class="num">${scaledQty(t) ?? '—'}</td>`;
      return `<td>${esc(t[c.key] || '—')}</td>`;
    }).join('')}</tr>`
  ).join('');
  const qtyHeader = (c) => c.key === 'quantity' && groups > 1 ? `Quantity (×${groups})` : c.label;

  let bodyHTML = '';
  let globalSN = 1;

  // We'll embed the fetched data via the opts.toolsData that the caller passes
  const allData = opts.toolsData || {};

  for (const occId of toolsOccIds) {
    const items = filterByType(allData[occId] || []);
    const name = esc(occNameFn(occId));

    bodyHTML += `<h3>${name} — ${esc(toolsLevel)}</h3>`;

    if (toolsLayout === 'separate_tables') {
      for (const sec of TYPE_SECTIONS) {
        if (toolsTypeFilter !== 'all' && toolsTypeFilter !== sec.key) continue;
        const secItems = items.filter(t => t.type === sec.type);
        if (!secItems.length) continue;
        bodyHTML += `<p><strong>${esc(sec.label)}</strong></p><table><thead><tr>${headerHTML}</tr></thead><tbody>${renderRows(secItems, globalSN)}</tbody></table>`;
        globalSN += secItems.length;
      }
    } else if (toolsLayout === 'separate_sections') {
      bodyHTML += `<table><thead><tr>${headerHTML}</tr></thead><tbody>`;
      for (const sec of TYPE_SECTIONS) {
        if (toolsTypeFilter !== 'all' && toolsTypeFilter !== sec.key) continue;
        const secItems = items.filter(t => t.type === sec.type);
        if (!secItems.length) continue;
        bodyHTML += `<tr><td colspan="${cols.length}" style="background:${sec.sectionBg};font-weight:600;font-size:11px">${esc(sec.label)}</td></tr>${renderRows(secItems, globalSN)}`;
        globalSN += secItems.length;
      }
      bodyHTML += `</tbody></table>`;
    } else {
      bodyHTML += `<table><thead><tr>${headerHTML}</tr></thead><tbody>${renderRows(items, globalSN)}</tbody></table>`;
      globalSN += items.length;
    }
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Tools & Consumables — ${esc(toolsLevel)}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; margin: 30px; color: #111; }
  h2 { font-size: 15px; margin-bottom: 2px; }
  h3 { font-size: 13px; margin: 20px 0 6px; font-weight: 600; }
  p { margin: 4px 0 8px; font-size: 12px; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
  th, td { border: 1px solid #888; padding: 5px 8px; font-size: 11.5px; }
  th { background: #d5dde8; font-weight: 600; text-align: center; }
  td { text-align: left; }
  td.num { text-align: right; }
  @media print { body { margin: 10mm; } }
</style></head><body>
<h2>Tools &amp; Consumables List — ${esc(toolsLevel)}</h2>
${bodyHTML}
</body></html>`;
}

// ── Report family definition ────────────────────────────────────────────────

export const REPORTS = [
  {
    id: 'tools1',
    label: 'Tools & Consumables List',
    aggregate: true,
    hasOccupationFilter: false,
    requiredFields: [],
    columns: [],
  },
];

export function renderAggregateTable(fullInst, activeExps, clients, reportId, opts = {}) {
  return <ToolsReport opts={opts} />;
}

function buildCSVRow() { return {}; }
function renderRowCells() { return null; }

export default {
  id: 'tools',
  label: 'Tools & Consumables',
  noInstitute: true,
  reports: REPORTS,
  renderRowCells,
  buildCSVRow,
  buildPrintHTML: buildToolsPrintHTML,
  renderAggregateTable,
  downloadDOCX: downloadToolsDOCX,
};

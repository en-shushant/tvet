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

function ToolsReport({ opts }) {
  const { toolsOccIds = [], toolsLevel = '', occupations = [], toolsTypeFilter = 'all',
          toolsColumns = DEFAULT_COLS, toolsLayout = 'combined' } = opts;

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

  const renderTable = (items, startSN = 1) => (
    <table style={TBL}>
      <thead>
        <tr>{cols.map(c => <th key={c.key} style={TH}>{c.label}</th>)}</tr>
      </thead>
      <tbody>
        {items.length === 0 ? (
          <tr><td colSpan={cols.length} style={{...TD, textAlign:'center', color:'var(--text3)'}}>No items found.</td></tr>
        ) : items.map((t, i) => (
          <tr key={t.id}>
            {cols.map(c => {
              if (c.key === 'sn') return <td key={c.key} style={{...TD, textAlign:'center'}}>{startSN + i}</td>;
              if (c.key === 'quantity') return <td key={c.key} style={TDN}>{t.quantity ?? '—'}</td>;
              if (c.key === 'type') {
                const bg = {Tool:'#d1ecf1',Consumable:'#fef3cd','Safety Tool':'#d4edda',Stationery:'#e2d9f3'}[t.type]||'#eee';
                const fg = {Tool:'#0c5460',Consumable:'#856404','Safety Tool':'#155724',Stationery:'#4a1d96'}[t.type]||'#333';
                return <td key={c.key} style={TD}><span style={{padding:'1px 6px',borderRadius:3,fontSize:10,fontWeight:600,background:bg,color:fg}}>{t.type}</span></td>;
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
          const tools = items.filter(t => t.type === 'Tool');
          const consumables = items.filter(t => t.type === 'Consumable');
          return (
            <div key={occId} style={{marginBottom:24}}>
              <div style={{...SECTION_STYLE, fontSize:14}}>{occName(occId)} — {toolsLevel}</div>
              {(toolsTypeFilter === 'all' || toolsTypeFilter === 'tools') && tools.length > 0 && (
                <>
                  <div style={{...SECTION_STYLE, fontSize:12, color:'var(--text2)'}}>Tools</div>
                  {renderTable(tools)}
                </>
              )}
              {(toolsTypeFilter === 'all' || toolsTypeFilter === 'consumables') && consumables.length > 0 && (
                <>
                  <div style={{...SECTION_STYLE, fontSize:12, color:'var(--text2)'}}>Consumables</div>
                  {renderTable(consumables)}
                </>
              )}
              {tools.length === 0 && consumables.length === 0 && (
                <div style={{padding:12, color:'var(--text3)', fontSize:12}}>No items.</div>
              )}
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
          const tools = allItems.filter(t => t.type === 'Tool');
          const consumables = allItems.filter(t => t.type === 'Consumable');
          let sn = 1;
          return (
            <div key={occId} style={{marginBottom:24}}>
              <div style={{...SECTION_STYLE, fontSize:14}}>{occName(occId)} — {toolsLevel}</div>
              <table style={TBL}>
                <thead>
                  <tr>{cols.map(c => <th key={c.key} style={TH}>{c.label}</th>)}</tr>
                </thead>
                <tbody>
                  {(toolsTypeFilter === 'all' || toolsTypeFilter === 'tools') && tools.length > 0 && (
                    <>
                      <tr><td colSpan={cols.length} style={{...TD, background:'#e8f0fe', fontWeight:600, fontSize:11}}>Tools</td></tr>
                      {tools.map((t, i) => (
                        <tr key={t.id}>
                          {cols.map(c => {
                            if (c.key === 'sn') return <td key={c.key} style={{...TD, textAlign:'center'}}>{sn + i}</td>;
                            if (c.key === 'quantity') return <td key={c.key} style={TDN}>{t.quantity ?? '—'}</td>;
                            if (c.key === 'type') return <td key={c.key} style={TD}><span style={{padding:'1px 6px',borderRadius:3,fontSize:10,fontWeight:600,background:'#d1ecf1',color:'#0c5460'}}>Tool</span></td>;
                            return <td key={c.key} style={TD}>{t[c.key] || '—'}</td>;
                          })}
                        </tr>
                      ))}
                      {(() => { sn += tools.length; return null; })()}
                    </>
                  )}
                  {(toolsTypeFilter === 'all' || toolsTypeFilter === 'consumables') && consumables.length > 0 && (
                    <>
                      <tr><td colSpan={cols.length} style={{...TD, background:'#fff8e1', fontWeight:600, fontSize:11}}>Consumables</td></tr>
                      {consumables.map((t, i) => (
                        <tr key={t.id}>
                          {cols.map(c => {
                            if (c.key === 'sn') return <td key={c.key} style={{...TD, textAlign:'center'}}>{sn + i}</td>;
                            if (c.key === 'quantity') return <td key={c.key} style={TDN}>{t.quantity ?? '—'}</td>;
                            if (c.key === 'type') return <td key={c.key} style={TD}><span style={{padding:'1px 6px',borderRadius:3,fontSize:10,fontWeight:600,background:'#fef3cd',color:'#856404'}}>Consumable</span></td>;
                            return <td key={c.key} style={TD}>{t[c.key] || '—'}</td>;
                          })}
                        </tr>
                      ))}
                    </>
                  )}
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

function buildDocxTable(items, cols, startSN = 1, sectionLabel = null) {
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
        if (c.key === 'quantity') return dataCell(t.quantity ?? '—', { right: true });
        return dataCell(t[c.key] || '—');
      }),
    }));
  });
  return rows;
}

async function downloadToolsDOCX(fullInst, activeExps, reportId, opts = {}) {
  const { toolsOccIds = [], toolsLevel = '', occupations = [], toolsTypeFilter = 'all',
          toolsColumns = DEFAULT_COLS, toolsLayout = 'combined' } = opts;

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
      const tools = items.filter(t => t.type === 'Tool');
      const consumables = items.filter(t => t.type === 'Consumable');
      if ((toolsTypeFilter === 'all' || toolsTypeFilter === 'tools') && tools.length) {
        children.push(new Paragraph({ spacing: { before: 100 }, children: [new TextRun({ text: 'Tools', bold: true, size: 20 })] }));
        tableRows = buildDocxTable(tools, cols, globalSN);
        children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: tableRows }));
        globalSN += tools.length;
      }
      if ((toolsTypeFilter === 'all' || toolsTypeFilter === 'consumables') && consumables.length) {
        children.push(new Paragraph({ spacing: { before: 160 }, children: [new TextRun({ text: 'Consumables', bold: true, size: 20 })] }));
        tableRows = buildDocxTable(consumables, cols, globalSN);
        children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: tableRows }));
        globalSN += consumables.length;
      }
      continue;
    }

    if (toolsLayout === 'separate_sections') {
      const tools = items.filter(t => t.type === 'Tool');
      const consumables = items.filter(t => t.type === 'Consumable');
      tableRows = [];
      if ((toolsTypeFilter === 'all' || toolsTypeFilter === 'tools') && tools.length) {
        tableRows.push(...buildDocxTable(tools, cols, globalSN, 'Tools'));
        globalSN += tools.length;
      }
      if ((toolsTypeFilter === 'all' || toolsTypeFilter === 'consumables') && consumables.length) {
        tableRows.push(...buildDocxTable(consumables, cols, globalSN, 'Consumables'));
        globalSN += consumables.length;
      }
      if (tableRows.length) children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: tableRows }));
    } else {
      tableRows = buildDocxTable(items, cols, globalSN);
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
          toolsColumns = DEFAULT_COLS, toolsLayout = 'combined' } = opts;

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

  const headerHTML = cols.map(c => `<th>${esc(c.label)}</th>`).join('');

  const renderRows = (items, startSN) => items.map((t, i) =>
    `<tr>${cols.map(c => {
      if (c.key === 'sn') return `<td style="text-align:center">${startSN + i}</td>`;
      if (c.key === 'quantity') return `<td class="num">${t.quantity ?? '—'}</td>`;
      return `<td>${esc(t[c.key] || '—')}</td>`;
    }).join('')}</tr>`
  ).join('');

  let bodyHTML = '';
  let globalSN = 1;

  // We'll embed the fetched data via the opts.toolsData that the caller passes
  const allData = opts.toolsData || {};

  for (const occId of toolsOccIds) {
    const items = filterByType(allData[occId] || []);
    const name = esc(occNameFn(occId));

    bodyHTML += `<h3>${name} — ${esc(toolsLevel)}</h3>`;

    if (toolsLayout === 'separate_tables') {
      const tools = items.filter(t => t.type === 'Tool');
      const consumables = items.filter(t => t.type === 'Consumable');
      if ((toolsTypeFilter === 'all' || toolsTypeFilter === 'tools') && tools.length) {
        bodyHTML += `<p><strong>Tools</strong></p><table><thead><tr>${headerHTML}</tr></thead><tbody>${renderRows(tools, globalSN)}</tbody></table>`;
        globalSN += tools.length;
      }
      if ((toolsTypeFilter === 'all' || toolsTypeFilter === 'consumables') && consumables.length) {
        bodyHTML += `<p><strong>Consumables</strong></p><table><thead><tr>${headerHTML}</tr></thead><tbody>${renderRows(consumables, globalSN)}</tbody></table>`;
        globalSN += consumables.length;
      }
    } else if (toolsLayout === 'separate_sections') {
      const tools = items.filter(t => t.type === 'Tool');
      const consumables = items.filter(t => t.type === 'Consumable');
      bodyHTML += `<table><thead><tr>${headerHTML}</tr></thead><tbody>`;
      if ((toolsTypeFilter === 'all' || toolsTypeFilter === 'tools') && tools.length) {
        bodyHTML += `<tr><td colspan="${cols.length}" style="background:#e8f0fe;font-weight:600;font-size:11px">Tools</td></tr>${renderRows(tools, globalSN)}`;
        globalSN += tools.length;
      }
      if ((toolsTypeFilter === 'all' || toolsTypeFilter === 'consumables') && consumables.length) {
        bodyHTML += `<tr><td colspan="${cols.length}" style="background:#fff8e1;font-weight:600;font-size:11px">Consumables</td></tr>${renderRows(consumables, globalSN)}`;
        globalSN += consumables.length;
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

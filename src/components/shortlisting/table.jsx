/**
 * The shortlist results table: one row, the group header above it, the column
 * headings, and the print view.
 *
 * printShortlistReport is plain string building rather than React, but it lives
 * here because it renders the same columns as TableHead and the two have to
 * agree.
 */
import { useState } from 'react';
import { fmtDate } from '../../utils/format.js';
import { statusColor, LetterBuilderWrapper } from './common.jsx';
import { BillModal, LetterOptsModal, ViewDocumentsModal } from './modals.jsx';

export function ShortlistRow({ row, idx, canEdit, isAdmin, isSuperAdmin, onEdit, onDelete, onBillSave, saving, token, showFY=true }) {
  const sc = statusColor(row.status);
  const altBg = idx % 2 === 1 ? 'var(--bg)' : 'var(--surface)';
  const hoverBg = idx % 2 === 1 ? 'var(--bg2)' : 'var(--bg)';
  const [showLetterOpts, setShowLetterOpts] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [showBill, setShowBill] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
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
        {showLetterOpts && <LetterOptsModal row={row} token={token} onClose={()=>setShowLetterOpts(false)} onOpenBuilder={isSuperAdmin ? ()=>setShowBuilder(true) : null}/>}
        {showBuilder && <LetterBuilderWrapper row={row} onClose={()=>setShowBuilder(false)}/>}
        {showBill && <BillModal row={row} token={token} saving={saving} onClose={()=>setShowBill(false)} onSave={async (patch) => { await onBillSave(row.id, patch); setShowBill(false); }}/>}
        {showDocs && <ViewDocumentsModal instituteId={row.institute_id} token={token} onClose={()=>setShowDocs(false)}/>}
        <button title="View Documents" onClick={() => setShowDocs(true)}
          style={{width:30,height:30,borderRadius:50,border:'none',background:'transparent',color:'var(--text3)',cursor:'pointer',display:'inline-flex',alignItems:'center',justifyContent:'center'}}
          onMouseEnter={e=>{e.currentTarget.style.background='var(--bg2)';e.currentTarget.style.color='var(--text)';}}
          onMouseLeave={e=>{e.currentTarget.style.background='';e.currentTarget.style.color='var(--text3)';}}
        ><span className="material-icons-round" style={{fontSize:15}}>folder_open</span></button>
        {canEdit && (
          <button title={hasBill ? 'Bill uploaded — click to update' : 'Upload bill / certificate'} onClick={() => setShowBill(true)}
            style={{width:30,height:30,borderRadius:50,border:'none',background: hasBill ? 'var(--success-light)' : 'transparent',color: hasBill ? 'var(--success)' : 'var(--text3)',cursor:'pointer',display:'inline-flex',alignItems:'center',justifyContent:'center'}}
            onMouseEnter={e=>{e.currentTarget.style.background='var(--success-light)';e.currentTarget.style.color='#0b9b85';}}
            onMouseLeave={e=>{e.currentTarget.style.background= hasBill ? 'var(--success-light)' : '';e.currentTarget.style.color= hasBill ? 'var(--success)' : 'var(--text3)';}}
          ><span className="material-icons-round" style={{fontSize:15}}>receipt</span></button>
        )}
        <button title="Generate Letter"
          onClick={() => setShowLetterOpts(true)}
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
export function GroupHeader({ label, sub, count, expanded, onToggle, isCurrent }) {
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
export function TableHead({ groupBy }) {
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
export function printShortlistReport(rows, groupBy, filters = {}) {
  // Group rows
  const map = new Map();
  for (const r of rows) {
    let key, label;
    if (groupBy === 'firm') {
      key = String(r.institute_id);
      label = [r.institute_acronym ? `[${r.institute_acronym}]` : '', r.institute_name].filter(Boolean).join(' ');
    } else {
      key = r.client_id ? String(r.client_id) : (r.client_name_manual || '__none__');
      label = r.client_name || r.client_name_manual || 'Unknown Organization';
    }
    if (!map.has(key)) map.set(key, { label, rows: [] });
    map.get(key).rows.push(r);
  }
  const groups = [...map.entries()].sort((a, b) => a[1].label.localeCompare(b[1].label));

  const statusColor = (s) =>
    s === 'Active'  ? '#166534' :
    s === 'Expired' ? '#991b1b' : '#92400e';
  const statusBg = (s) =>
    s === 'Active'  ? '#dcfce7' :
    s === 'Expired' ? '#fee2e2' : '#fef3c7';

  const filterDesc = [
    filters.org    && `Organization: ${filters.org}`,
    filters.firm   && `Firm: ${filters.firm}`,
    filters.fy     && `FY: ${filters.fy}`,
    filters.status && `Status: ${filters.status}`,
    filters.search && `Search: "${filters.search}"`,
  ].filter(Boolean).join('  ·  ');

  const totalRows = rows.length;

  const sectionsHtml = groups.map(([, g]) => {
    const isOrgView = groupBy === 'org';
    const rowsHtml = g.rows.map((r, i) => {
      const name  = isOrgView
        ? [r.institute_acronym ? `[${r.institute_acronym}]` : '', r.institute_name].filter(Boolean).join(' ')
        : (r.client_name || r.client_name_manual || '—');
      const list  = r.standing_list_name || r.client_short || '—';
      const date  = fmtDate(r.shortlist_date);
      const valid = fmtDate(r.valid_until);
      const fy    = r.fy || '—';
      const amt   = r.contract_amount ? `NPR ${Number(r.contract_amount).toLocaleString()}` : '—';
      const st    = r.status || 'Active';
      return `<tr style="background:${i % 2 === 0 ? '#fff' : '#f9fafb'}">
        <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;font-weight:500">${i + 1}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:12px">${name}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#6b7280">${list}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:12px">${date}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#6b7280">${valid}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#6b7280">${fy}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#4b5563">${amt}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #e5e7eb;font-size:12px">
          <span style="padding:2px 8px;border-radius:100px;font-size:11px;font-weight:600;background:${statusBg(st)};color:${statusColor(st)}">${st}</span>
        </td>
      </tr>`;
    }).join('');

    const colHeader = isOrgView ? 'Firm' : 'Organization';
    return `
      <div style="margin-bottom:32px;page-break-inside:avoid">
        <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:8px;padding-bottom:6px;border-bottom:2px solid #1e3a5f">
          <div style="font-size:14px;font-weight:700;color:#1e3a5f">${g.label}</div>
          <div style="font-size:11px;color:#6b7280;font-weight:500">${g.rows.length} entr${g.rows.length === 1 ? 'y' : 'ies'}</div>
        </div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden">
          <thead>
            <tr style="background:#1e3a5f;color:#fff">
              <th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600;width:32px">#</th>
              <th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600">${colHeader}</th>
              <th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600">List / Short Name</th>
              <th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600">Shortlist Date</th>
              <th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600">Valid Until</th>
              <th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600">FY</th>
              <th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600">Amount</th>
              <th style="padding:8px 10px;text-align:left;font-size:11px;font-weight:600">Status</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>`;
  }).join('');

  const reportTitle = groupBy === 'firm' ? 'Shortlisting Report — By Firm' : 'Shortlisting Report — By Organization';
  const now = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' });

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>${reportTitle}</title>
<style>
  @page { size: A4 landscape; margin: 15mm 18mm; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #111; margin: 0; }
  .no-print { margin-bottom: 20px; }
  @media print { .no-print { display: none; } }
</style>
</head><body>
<div class="no-print">
  <button onclick="window.print()" style="padding:10px 24px;background:#1e3a5f;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;margin-right:10px">
    🖨 Print / Save as PDF
  </button>
  <button onclick="window.close()" style="padding:10px 20px;background:#f3f4f6;color:#374151;border:none;border-radius:8px;font-size:14px;cursor:pointer">
    Close
  </button>
</div>

<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
  <div>
    <div style="font-size:20px;font-weight:700;color:#1e3a5f;letter-spacing:-0.3px">${reportTitle}</div>
    ${filterDesc ? `<div style="font-size:11px;color:#6b7280;margin-top:3px">${filterDesc}</div>` : ''}
  </div>
  <div style="text-align:right;font-size:11px;color:#6b7280">
    <div>Generated: ${now}</div>
    <div style="margin-top:2px;font-weight:600;color:#374151">${totalRows} total entr${totalRows === 1 ? 'y' : 'ies'} · ${groups.length} ${groupBy === 'firm' ? 'firm' : 'organization'}${groups.length === 1 ? '' : 's'}</div>
  </div>
</div>
<hr style="border:none;border-top:3px solid #1e3a5f;margin:0 0 20px">

${sectionsHtml}

<div style="margin-top:24px;padding-top:10px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af;display:flex;justify-content:space-between">
  <span>TVETtrack — Shortlisting Report</span>
  <span>Total: ${totalRows} ${totalRows === 1 ? 'entry' : 'entries'}</span>
</div>
</body></html>`;

  const w = window.open('', '_blank', 'width=1100,height=800');
  if (w) { w.document.write(html); w.document.close(); }
}

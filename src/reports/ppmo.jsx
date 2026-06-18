import { getClient, fmt, monthsBetween, districtsOf, esc } from './helpers.js';

const REPORTS = [
  {
    id: '3a',
    label: '3(A) General Work Experience',
    requiredFields: [
      ['assignmentName', 'Name of assignment'],
      ['contractValue', 'Value of contract'],
      ['descriptionOfWork', 'Description of work'],
    ],
    columns: ['S.N.', 'Name of assignment', 'Location', 'Value of contract', 'Year completed', 'Client', 'Description of work carried out'],
  },
  {
    id: '3b',
    label: '3(B) Specific Experience',
    requiredFields: [
      ['durationMonths', 'Duration (months)'],
      ['totalPersonMonths', 'Total person-months'],
      ['narrativeDescription', 'Narrative description'],
      ['actualServicesDescription', 'Description of actual services'],
    ],
    columns: ['Assignment / Client', 'Country & location', 'Contract value', 'Start – completion', 'Duration (months)', 'Person-months (total / JV)', 'JV partners', 'Narrative & services'],
  },
  {
    id: '3c',
    label: '3(C) Geographic Experience',
    requiredFields: [
      ['country', 'Country/Region'],
    ],
    columns: ['No.', 'Name of project', 'Location (country/region)', 'Execution year & duration'],
  },
];

function renderRowCells(exp, clients, reportId, i) {
  const client = getClient(clients, exp.clientId);
  const clientName = client.fullName || exp.clientName || '—';
  const districts = districtsOf(exp);
  const location = districts.length ? districts.join(', ') : '—';

  if (reportId === '3a') return <>
    <td>{i + 1}</td>
    <td style={{fontWeight:600}}>{exp.assignmentName || '—'}</td>
    <td style={{fontSize:12}}>{location}</td>
    <td className="mono">{exp.contractValue ? `NPR ${fmt(exp.contractValue)}` : '—'}</td>
    <td>{exp.endFY || exp.fy || '—'}</td>
    <td>{clientName}</td>
    <td style={{fontSize:12, maxWidth:260}}>{exp.descriptionOfWork || '—'}</td>
  </>;

  if (reportId === '3b') return <>
    <td><div style={{fontWeight:600}}>{exp.assignmentName || '—'}</div><div style={{fontSize:11,color:'var(--text3)'}}>{clientName}</div></td>
    <td style={{fontSize:12}}>{exp.country || 'Nepal'}<div style={{color:'var(--text3)'}}>{location}</div></td>
    <td className="mono">{exp.contractValue ? `NPR ${fmt(exp.contractValue)}` : '—'}{exp.ownServiceValue ? <div style={{fontSize:10,color:'var(--text3)'}}>own: NPR {fmt(exp.ownServiceValue)}</div> : null}</td>
    <td style={{fontSize:12}}>{exp.startDate || '—'} – {exp.endDate || '—'}</td>
    <td>{exp.durationMonths || monthsBetween(exp.startDate, exp.endDate) || '—'}</td>
    <td style={{fontSize:12}}>{exp.totalPersonMonths || '—'} / {exp.jvPartnerPersonMonths || '—'}</td>
    <td style={{fontSize:12}}>{exp.isJV ? (exp.jvPartnerNames || exp.jvRole) : '—'}</td>
    <td style={{fontSize:11, maxWidth:220}}>{exp.narrativeDescription || exp.actualServicesDescription || '—'}</td>
  </>;

  return <>
    <td>{i + 1}</td>
    <td style={{fontWeight:600}}>{exp.assignmentName || '—'}</td>
    <td style={{fontSize:12}}>{exp.country || 'Nepal'}{location !== '—' ? ` — ${location}` : ''}</td>
    <td style={{fontSize:12}}>{exp.fy}{exp.endFY && exp.endFY !== exp.fy ? `–${exp.endFY}` : ''}{exp.durationMonths ? ` (${exp.durationMonths} mo)` : ''}</td>
  </>;
}

function buildCSVRow(exp, clients, reportId, i) {
  const client = getClient(clients, exp.clientId);
  const clientName = client.fullName || exp.clientName || '';
  const districts = districtsOf(exp).join(', ');

  if (reportId === '3a') return {
    'S.N.': i + 1,
    'Name of assignment': exp.assignmentName || '',
    'Location': districts,
    'Value of contract': exp.contractValue || '',
    'Year completed': exp.endFY || exp.fy || '',
    'Client': clientName,
    'Description of work carried out': exp.descriptionOfWork || '',
  };

  if (reportId === '3b') return {
    'Assignment name': exp.assignmentName || '',
    'Approx contract value': exp.contractValue || '',
    'Country': exp.country || 'Nepal',
    'Location within country': districts,
    'Name of client': clientName,
    'Address': client.address || '',
    'Start date': exp.startDate || '',
    'Completion date': exp.endDate || '',
    'Duration (months)': exp.durationMonths || monthsBetween(exp.startDate, exp.endDate) || '',
    'Total person-months': exp.totalPersonMonths || '',
    'Approx value of services by firm': exp.ownServiceValue || '',
    'JV partner / sub-consultant names': exp.jvPartnerNames || '',
    'Person-months by JV partners': exp.jvPartnerPersonMonths || '',
    'Narrative description of project': exp.narrativeDescription || '',
    'Description of actual services provided': exp.actualServicesDescription || '',
  };

  return {
    'No.': i + 1,
    'Name of project': exp.assignmentName || '',
    'Location (country/region)': `${exp.country || 'Nepal'}${districts ? ` — ${districts}` : ''}`,
    'Execution year and duration': `${exp.fy}${exp.endFY && exp.endFY !== exp.fy ? `–${exp.endFY}` : ''}${exp.durationMonths ? ` (${exp.durationMonths} months)` : ''}`,
  };
}

function cellsToHTML(exp, clients, reportId, i) {
  const client = getClient(clients, exp.clientId);
  const clientName = client.fullName || exp.clientName || '—';
  const districts = districtsOf(exp).join(', ') || '—';

  if (reportId === '3a') return `
    <td>${i + 1}</td>
    <td><strong>${esc(exp.assignmentName) || '—'}</strong></td>
    <td>${esc(districts)}</td>
    <td>${exp.contractValue ? `NPR ${fmt(exp.contractValue)}` : '—'}</td>
    <td>${esc(exp.endFY || exp.fy) || '—'}</td>
    <td>${esc(clientName)}</td>
    <td>${esc(exp.descriptionOfWork) || '—'}</td>`;

  if (reportId === '3b') return `
    <td><strong>${esc(exp.assignmentName) || '—'}</strong><br><small>${esc(clientName)}</small></td>
    <td>${esc(exp.country || 'Nepal')}<br><small>${esc(districts)}</small></td>
    <td>${exp.contractValue ? `NPR ${fmt(exp.contractValue)}` : '—'}</td>
    <td>${esc(exp.startDate) || '—'} – ${esc(exp.endDate) || '—'}</td>
    <td>${exp.durationMonths || monthsBetween(exp.startDate, exp.endDate) || '—'}</td>
    <td>${exp.totalPersonMonths || '—'} / ${exp.jvPartnerPersonMonths || '—'}</td>
    <td>${exp.isJV ? esc(exp.jvPartnerNames || exp.jvRole) : '—'}</td>
    <td>${esc(exp.narrativeDescription) || esc(exp.actualServicesDescription) || '—'}</td>`;

  return `
    <td>${i + 1}</td>
    <td><strong>${esc(exp.assignmentName) || '—'}</strong></td>
    <td>${esc(exp.country || 'Nepal')}${districts !== '—' ? ` — ${esc(districts)}` : ''}</td>
    <td>${esc(exp.fy)}${exp.endFY && exp.endFY !== exp.fy ? `–${esc(exp.endFY)}` : ''}${exp.durationMonths ? ` (${exp.durationMonths} months)` : ''}</td>`;
}

function buildPrintHTML(inst, exps, clients, reportId, fyRange) {
  const report = REPORTS.find(r => r.id === reportId);
  const rowsHtml = exps.map((exp, i) => `<tr>${cellsToHTML(exp, clients, reportId, i)}</tr>`).join('');
  const fyLabel = fyRange ? ` · FY ${fyRange}` : '';
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${report.label} — ${inst?.name || ''}</title>
  <style>
    body{font-family:Arial,sans-serif;font-size:11px;color:#111;margin:24px}
    h1{font-size:16px;margin-bottom:2px}
    h2{font-size:13px;margin-top:0;color:#444}
    .meta{color:#555;font-size:11px;margin-bottom:14px}
    table{border-collapse:collapse;width:100%}
    th{background:#1e293b;color:#fff;padding:6px 8px;text-align:left;font-size:10.5px}
    td{padding:6px 8px;border-bottom:1px solid #e2e8f0;vertical-align:top}
    tr:nth-child(even) td{background:#f8fafc}
    @media print{body{margin:0}}
  </style></head><body>
  <h1>PPMO EOI Report — ${report.label}</h1>
  <h2>${inst?.name || ''}${inst?.acronym ? ` (${inst.acronym})` : ''}</h2>
  <div class="meta">Generated: ${new Date().toLocaleDateString('en-NP')}${fyLabel} · ${exps.length} assignment(s)</div>
  <table>
    <thead><tr>${report.columns.map(c => `<th>${c}</th>`).join('')}</tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <div style="margin-top:18px;color:#888;font-size:10px">Generated by TVETtrack — Nepal TVET Registry</div>
  </body></html>`;
}

const ppmo = {
  id: 'ppmo',
  label: 'PPMO Reports',
  reports: REPORTS,
  renderRowCells,
  buildCSVRow,
  buildPrintHTML,
};

export default ppmo;

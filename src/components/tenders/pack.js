/**
 * The forms a notice asks for and the lines it requires, as the Documents
 * section and the summary read them. Pure, so the figures are tested.
 */
export const FORM_LABELS = {
  letter: { name: 'Form 1 · Letter of Application', hint: 'On letterhead, signed by the authorised person' },
  applicant: { name: 'Form 2 · Applicant’s Information', hint: 'Firm details and joint-venture partners' },
  experience: { name: 'Form 3 · Experience (3A, 3B)', hint: 'Assignments of the last seven years' },
  capacity: { name: 'Form 4 · Capacity', hint: 'Staff, equipment and financial standing' },
  experts: { name: 'Form 5 · Key Experts’ CVs', hint: 'Each CV signed by its expert, with email and mobile number' },
  evidence: { name: 'Supporting evidence', hint: 'Certified copies behind each CV' },
};
export const FORM_STATUSES = ['Not started', 'Draft', 'Approved'];

/** The standard lines a consultant EOI asks for; added on request, then edited. */
export const STANDARD_REQUIREMENTS = [
  'Company registration certificate',
  'PAN / VAT registration',
  'Tax clearance or tax return submission',
  'Audited financial statements',
  'Letter of Application (Form 1)',
  'Applicant’s Information (Form 2)',
  'Experience (Form 3)',
  'Capacity (Form 4)',
  'Key experts’ CVs (Form 5)',
];
export const ANSWERED_BY = ['Form 1', 'Form 2', 'Form 3', 'Form 4', 'Form 5', 'CV', 'Attachment'];

export function packFigures(forms = [], reqs = []) {
  const on = forms.filter(f => f.enabled !== false);
  const approved = on.filter(f => f.status === 'Approved').length;
  const mandatory = reqs.filter(r => r.mandatory);
  const open = mandatory.filter(r => !r.met).length;
  return { formsOn: on.length, formsApproved: approved, reqTotal: reqs.length, mandatoryOpen: open, mandatoryMet: mandatory.length - open };
}

/**
 * What is still open that a bid should not be marked submitted over: mandatory
 * checklist lines not met, and switched-on forms not yet approved.
 */
export function submitProblems(forms = [], reqs = []) {
  const out = [];
  const open = reqs.filter(r => r.mandatory && !r.met);
  if (open.length) out.push(`${open.length} mandatory checklist item${open.length === 1 ? '' : 's'} not met: ${open.slice(0, 4).map(r => r.label).join(', ')}${open.length > 4 ? '…' : ''}`);
  const unapproved = forms.filter(f => f.enabled !== false && f.status !== 'Approved');
  if (unapproved.length) out.push(`${unapproved.length} form${unapproved.length === 1 ? '' : 's'} not approved: ${unapproved.map(f => (FORM_LABELS[f.form_key]?.name || f.form_key).split(' · ')[0]).join(', ')}`);
  return out;
}

/** A plain-text cover note for the downloaded pack: where each form and checklist line stands. */
export function packNote(tender, forms = [], reqs = [], files = []) {
  const lines = [`${tender.title || 'Tender'}${tender.reference_no ? ` — ${tender.reference_no}` : ''}`, `${tender.stage || ''} pack`, '', 'Files', ...files.map(f => `  - ${f}`), '', 'Forms'];
  for (const f of forms) lines.push(`  ${(FORM_LABELS[f.form_key]?.name || f.form_key)}: ${f.enabled === false ? 'not asked for' : f.status}`);
  lines.push('', 'Checklist');
  if (!reqs.length) lines.push('  (none listed)');
  for (const r of reqs) lines.push(`  [${r.met ? 'x' : ' '}] ${r.label}${r.mandatory ? '' : ' (optional)'}${r.answered_by ? ` — ${r.answered_by}` : ''}`);
  return lines.join('\n');
}

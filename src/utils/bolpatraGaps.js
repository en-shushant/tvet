/**
 * Which fields an assignment is missing for the Bolpatra (EOI) report.
 *
 * The report never fails — it prints an em dash and carries on — so a gap is
 * only discovered when someone reads the finished document, usually while
 * assembling a submission. This finds them first.
 *
 * Every check mirrors what bolpatra.jsx actually does, including its fallbacks,
 * so nothing is reported as missing that the report would have filled anyway:
 *
 *   country            defaults to Nepal, so blank is fine
 *   ownServiceValue    falls back to contractValue
 *   durationMonths     falls back to the span between the contract dates
 *   descriptionOfWork, narrativeDescription, actualServicesDescription
 *                      fall back to the firm's assigned template
 *   seniorStaffDescription  falls back to the firm's key-staff roster
 *   JV partner fields  print "NA" unless the assignment is a joint venture
 *
 * Flagging any of those would train people to ignore the warning, which is
 * worse than not having it.
 */

/** Blank, whitespace and null all count as absent; 0 does not. */
const absent = (v) => !((v === 0 || v) && String(v).trim() !== '');

const districtsOf = (exp) =>
  (exp.occupations || []).flatMap(o => (o.locations || []).map(l => l.district)).filter(Boolean);

const hasLocation = (exp) =>
  districtsOf(exp).length > 0 || (exp.locations || []).some(l => l.district);

/**
 * `field` is the key the quick-fill form edits. Checks with no field are
 * structural — a missing client or district is fixed elsewhere in the editor —
 * and are reported but not offered as a text input.
 */
const CHECKS = [
  { key: 'assignmentName', field: 'assignmentName', label: 'Assignment name',
    hint: 'Printed as the project name in sections 3(A), 3(B) and 3(C).',
    missing: (e) => absent(e.assignmentName) },

  { key: 'client', label: 'Client',
    hint: 'Set on the Basic information step.',
    missing: (e) => absent(e.clientId) && absent(e.clientName) },

  { key: 'contractValue', field: 'contractValue', label: 'Contract value (NPR)',
    hint: 'Value of the contract in 3(A) and 3(B). Also stands in for the value of your own services when that is blank.',
    missing: (e) => absent(e.contractValue) },

  { key: 'dates', field: 'startDate', label: 'Contract start date (BS)',
    hint: 'Start date in 3(B), written as month/year.',
    missing: (e) => absent(e.startDate) },

  { key: 'endDate', field: 'endDate', label: 'Contract end date (BS)',
    hint: 'Completion date in 3(B).',
    missing: (e) => absent(e.endDate) },

  { key: 'durationMonths', field: 'durationMonths', label: 'Duration (months)',
    hint: 'Only needed when the contract dates are absent — otherwise it is derived from them.',
    missing: (e) => absent(e.durationMonths) && (absent(e.startDate) || absent(e.endDate)) },

  { key: 'totalPersonMonths', field: 'totalPersonMonths', label: 'Total person-months',
    hint: 'Has no fallback; 3(B) prints a dash without it.',
    missing: (e) => absent(e.totalPersonMonths) },

  { key: 'staffCount', field: 'staffCount', label: 'No. of Staff',
    hint: 'Has no fallback; 3(B) prints a dash without it.',
    missing: (e) => absent(e.staffCount) },

  { key: 'location', label: 'District',
    hint: 'Taken from the occupations. Add a district on the Occupations step.',
    missing: (e) => !hasLocation(e) },

  { key: 'jvPartnerNames', field: 'jvPartnerNames', label: 'JV partner names',
    hint: 'Only for joint-venture assignments.',
    missing: (e) => !!e.isJV && absent(e.jvPartnerNames) },

  { key: 'jvPartnerPersonMonths', field: 'jvPartnerPersonMonths', label: 'JV partner person-months',
    hint: 'Only for joint-venture assignments.',
    missing: (e) => !!e.isJV && absent(e.jvPartnerPersonMonths) },
];

/**
 * The three narrative fields, which are written from the firm's template unless
 * overridden. They are only a gap when the firm has no template assigned for
 * that slot, so they depend on the institute rather than the assignment alone.
 */
const NARRATIVES = [
  { key: 'descriptionOfWork', field: 'descriptionOfWork', templateKey: 'descTemplateId',
    label: 'Description of work carried out',
    hint: 'Section 3(A). Written from the firm’s template when one is assigned.' },
  { key: 'narrativeDescription', field: 'narrativeDescription', templateKey: 'narrativeTemplateId',
    label: 'Narrative description of project',
    hint: 'Section 3(B). Written from the firm’s template when one is assigned.' },
  { key: 'actualServicesDescription', field: 'actualServicesDescription', templateKey: 'servicesTemplateId',
    label: 'Description of actual services provided',
    hint: 'Section 3(B) footer. Written from the firm’s template when one is assigned.' },
  // Same shape, different source: written from the firm's key-staff roster
  // rather than a chosen template variation, so it checks a list length
  // instead of a templateKey being set.
  { key: 'seniorStaffDescription', field: 'seniorStaffDescription', hasSource: (inst) => !!inst?.keyStaff?.length,
    label: 'Senior staff involved and functions performed',
    hint: 'Section 3(B). Written from the firm’s key-staff roster when one is set.' },
];

/**
 * Returns [{ key, field, label, hint }] for everything this assignment would
 * leave blank in the report. Empty means the assignment is complete.
 */
export function missingBolpatraFields(exp, institute) {
  if (!exp) return [];
  const out = CHECKS.filter(c => c.missing(exp)).map(({ missing, ...rest }) => rest);

  for (const n of NARRATIVES) {
    const stored = (exp[n.field] || '').trim();
    const hasSource = n.hasSource ? n.hasSource(institute) : !!institute?.[n.templateKey];
    if (!stored && !hasSource) {
      out.push({ key: n.key, field: n.field, label: n.label, hint: n.hint, long: true });
    }
  }
  return out;
}

/** True when the assignment would print without a single gap. */
export function isBolpatraComplete(exp, institute) {
  return missingBolpatraFields(exp, institute).length === 0;
}

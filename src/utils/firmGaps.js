/**
 * What a firm has not filled in that the tender forms read, grouped by the form
 * that would print a blank.
 *
 * It reads the "facts" GET /institutes/data-check returns — yes/no for each
 * field and counts for each list — rather than the institute list, which
 * strips the signature, stamp and certificates and carries no assignments, so
 * a check on it would call every firm empty.
 *
 *   letter      Form 1 · Letter of Application
 *   applicant   Form 2 · Applicant's Information
 *   experience  Form 3 · Experience
 *   capacity    Form 4 · Capacity
 *   evidence    Supporting documents
 */
const CHECKS = [
  { form: 'letter', key: 'name', label: 'Firm name', missing: f => !f.name_ok },
  { form: 'letter', key: 'address', label: 'Address', missing: f => !f.address },
  { form: 'letter', key: 'contact_person', label: 'Authorised person', missing: f => !f.contact_person },
  { form: 'letter', key: 'contact_designation', label: 'Designation of the authorised person', missing: f => !f.contact_designation },
  { form: 'letter', key: 'sign', label: 'Signature image', missing: f => !f.sign },
  { form: 'letter', key: 'stamp', label: 'Stamp image', missing: f => !f.stamp },

  { form: 'applicant', key: 'reg_no', label: 'Registration number', missing: f => !f.reg_no },
  { form: 'applicant', key: 'reg_date', label: 'Registration date', missing: f => !f.reg_date },
  { form: 'applicant', key: 'pan', label: 'PAN / VAT number', missing: f => !f.pan },
  { form: 'applicant', key: 'constitution_type', label: 'Type of constitution', missing: f => !f.constitution_type },
  { form: 'applicant', key: 'email', label: 'Email', missing: f => !f.email },
  { form: 'applicant', key: 'phone', label: 'Phone or mobile', missing: f => !f.phone },
  { form: 'applicant', key: 'org_profile', label: 'Organisation profile', missing: f => !f.org_profile },

  { form: 'capacity', key: 'total_staff', label: 'Total number of staff', missing: f => !f.total_staff },
  { form: 'capacity', key: 'professional_staff', label: 'Professional staff', missing: f => !f.professional_staff },
  { form: 'capacity', key: 'key_staff', label: 'Key staff listed', missing: f => !(f.key_staff > 0) },
  { form: 'capacity', key: 'turnover', label: 'Annual turnover (from tax clearance)', missing: f => !(f.turnover > 0) },
  { form: 'capacity', key: 'infrastructure', label: 'Infrastructure / equipment', missing: f => !(f.infrastructure > 0) },

  { form: 'evidence', key: 'tax_clearance', label: 'Tax clearance record', missing: f => !(f.tax_clearance > 0) },
  { form: 'evidence', key: 'ocr_registration', label: 'Company registration certificate', missing: f => !f.ocr_registration },
  { form: 'evidence', key: 'vat_registration', label: 'PAN / VAT registration certificate', missing: f => !f.vat_registration },
];

/** [{ form, key, label }] for everything this firm leaves blank. */
export function firmGaps(facts) {
  if (!facts) return [];
  const out = CHECKS.filter(c => c.missing(facts)).map(({ missing, ...c }) => c);
  const n = facts.assignments || 0;
  const bad = facts.assignments_incomplete || 0;
  if (n === 0) out.push({ form: 'experience', key: 'assignments', label: 'No assignments recorded' });
  else if (bad > 0) {
    out.push({ form: 'experience', key: 'incomplete', count: bad,
      label: `${bad} of ${n} assignment${n === 1 ? '' : 's'} missing details` });
  }
  return out;
}

export const FORM_ORDER = ['letter', 'applicant', 'experience', 'capacity', 'evidence'];
export const FORM_TITLES = {
  letter: 'Form 1 · Letter', applicant: 'Form 2 · Applicant', experience: 'Form 3 · Experience',
  capacity: 'Form 4 · Capacity', evidence: 'Supporting documents',
};

/** Gaps grouped by form, in form order, forms with no gaps left out. */
export function gapsByForm(facts) {
  const gaps = firmGaps(facts);
  return FORM_ORDER.map(f => ({ form: f, title: FORM_TITLES[f], items: gaps.filter(g => g.form === f) }))
    .filter(g => g.items.length);
}

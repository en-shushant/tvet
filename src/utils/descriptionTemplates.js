// Description-of-work templates for PPMO 3(A) General Work Experience
// Each variation uses {placeholders} substituted from assignment form data.
// Add new variations by appending to the VARIATIONS array.

export const DESCRIPTION_VARIATIONS = [
  {
    id: 'v1',
    label: 'V1 — Simple curriculum-based',
    preview: '{firm} provided training on {occupations} to {totalTrainees} trainees following the curricula of {client}.',
  },
  {
    id: 'v2',
    label: 'V2 — Hours + level + location',
    preview: 'Following the {durationHours}-hour curricula for {level} training provided by {client}, {firm} provided training to {totalTrainees} trainees in trades like {occupations} in {locations}.',
  },
  {
    id: 'v3',
    label: 'V3 — Implemented + district count',
    preview: '{firm} implemented {assignmentName} for {client}. Total {totalTrainees} trainees participated from {numDistricts} districts.',
  },
  {
    id: 'v4',
    label: 'V4 — Group-based with locations',
    preview: '{firm} implemented {durationDays}-day {occupations} training to {numGroups} groups ({totalTrainees} trainees) from {locations} based on the training curricula prepared by {client}.',
  },
  {
    id: 'v5',
    label: 'V5 — On-the-job',
    preview: 'Under this assignment, {firm} carried out on-the-job {occupations} training to {totalTrainees} participants of {locations} districts under {client}.',
  },
  {
    id: 'v6',
    label: 'V6 — TOT (Training of Trainers)',
    preview: '{firm} implemented {durationDays}-day TOT on {occupations} to {numGroups} groups ({totalTrainees} trainees) from {locations} based on the training curricula prepared by {client}.',
  },
  {
    id: 'v7',
    label: 'V7 — Short-course multi-district',
    preview: '{firm} provided {occupations} training to {totalTrainees} trainees across {numDistricts} districts under the {assignmentName} project of {client}.',
  },
  {
    id: 'v8',
    label: 'V8 — GESI / inclusive',
    preview: '{firm} provided inclusive {occupations} training to {totalTrainees} trainees (gender-sensitive approach) from {locations} following the curricula of {client}.',
  },
  {
    id: 'v9',
    label: 'V9 — Residential',
    preview: '{firm} conducted {durationDays}-day residential {occupations} training to {totalTrainees} trainees from {locations} under {client}.',
  },
  {
    id: 'v10',
    label: 'V10 — Multi-trade vocational',
    preview: '{firm} conducted short-term vocational training on various trades including {occupations} to {totalTrainees} trainees from {locations} under the project of {client}.',
  },
  {
    id: 'v11',
    label: 'V11 — Event-based with groups',
    preview: '{firm} implemented {assignmentName} and trained {totalTrainees} trainees in {numGroups} training events across {numDistricts} districts under {client}.',
  },
  {
    id: 'v12',
    label: 'V12 — JV / consortium',
    preview: '{firm} in joint venture implemented {assignmentName} for {client}, providing {occupations} training to {totalTrainees} trainees from {locations}.',
  },
];

/**
 * Fill a template variation with real values from the assignment form.
 * @param {string} variationId  — e.g. 'v1'
 * @param {object} form         — ExperienceForm state
 * @param {object} institute    — normInst() result (has .acronym, .name)
 * @param {Array}  clients      — array of normClient() results
 */
export function fillDescriptionTemplate(variationId, form, institute, clients) {
  const variation = DESCRIPTION_VARIATIONS.find(v => v.id === variationId);
  if (!variation) return '';

  // Resolve client
  const client = (clients || []).find(c => c.id === form.clientId) || {};
  const clientName = client.shortName || client.fullName || form.clientName || '';

  // Resolve firm
  const firm = institute?.acronym || institute?.name || '';

  // Occupations
  const occs = (form.occupations || []).filter(o => o.nameInLetter);
  const occupationNames = occs.map(o => o.nameInLetter).join(', ') || '';

  // Trainees
  const totalTrainees = occs.reduce((sum, o) => sum + (parseInt(o.trainees) || 0), 0) || '';

  // Locations (districts from all occupations)
  const allDistricts = [...new Set(
    occs.flatMap(o => (o.locations || []).map(l => l.district).filter(Boolean))
  )];
  const locations = allDistricts.join(', ') || '';
  const numDistricts = allDistricts.length || '';

  // Duration / level from first occupation
  const firstOcc = occs[0] || {};
  const durationHours = firstOcc.duration || form.durationMonths * 30 * 8 || '';
  const level = firstOcc.level || '';

  const values = {
    firm,
    client: clientName,
    occupations: occupationNames,
    totalTrainees: totalTrainees || '—',
    locations: locations || '—',
    numDistricts: numDistricts || '—',
    durationHours: durationHours || '—',
    durationDays: form.durationDays || '—',
    numGroups: form.numGroups || '—',
    level: level || '—',
    assignmentName: form.assignmentName || '—',
  };

  return variation.preview.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? `{${key}}`);
}

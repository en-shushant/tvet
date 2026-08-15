import { buildTemplateValues, applyTemplate } from './templateValues.js';

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
  // ── Firm-assignable, paired 1:1 with the 3(B) service narratives S13–S17 ────
  // Same seven-step sequence — social marketing → awareness → selection →
  // training delivery → OJT → skill test → placement — and the same voice as its
  // S-counterpart, but condensed: 3(A) is a cell in a seven-column table, not a
  // section of its own. Assign V13 to the firm using S13, V14 with S14, and so on.
  {
    id: 'v13',
    label: 'V13 — Sequence, direct (pairs with S13)',
    preview:
      'Conducted social marketing, awareness and participant selection in {districtsPhrase}, and provided {occupationsWithCounts} with soft skills, employability skills, health and safety, entrepreneurship and gender sensitivity orientation{ojtTerse}{outcomeTerse}.',
  },
  {
    id: 'v14',
    label: 'V14 — Sequence, formal (pairs with S14)',
    preview:
      'Social marketing, awareness and participant selection were carried out across {districtsPhrase}, and {firm} delivered {occupationsWithCounts} with soft skills, employability skills, occupational health and safety, entrepreneurship and gender sensitivity orientation{ojtTerse}{outcomeTerse}.',
  },
  {
    id: 'v15',
    label: 'V15 — Sequence, explicit stages (pairs with S15)',
    preview:
      'Beginning with social marketing and awareness across {districtsPhrase} and the selection of motivated participants, {firm} then delivered {occupationsWithCounts} alongside soft skills, employability skills, health and safety, entrepreneurship and gender sensitivity orientation{ojtTerse}{outcomeTerse}.',
  },
  {
    id: 'v16',
    label: 'V16 — Sequence, bulleted (pairs with S16)',
    preview:
      '• Social marketing, awareness and participant selection in {districtsPhrase}.\n• {occupationsWithCounts}.\n• Soft skills, employability skills, health and safety, entrepreneurship and gender sensitivity orientation for all {totalTrainees} participants.{ojtBullet}{outcomeBullets}',
  },
  {
    id: 'v17',
    label: 'V17 — Sequence, concise (pairs with S17)',
    preview:
      'Following social marketing and awareness in {districtsPhrase}, {firm} selected participants and delivered {occupationsWithCounts}, with soft skills, employability skills, health and safety, entrepreneurship and gender sensitivity orientation{ojtTerse}{outcomeTerse}.',
  }

];

/**
 * Fill a 3(A) description variation. Values come from templateValues.js, shared
 * with the 3(B) templates; only the durationHours fallback differs — 3(A) will
 * estimate hours from the assignment's month count when no per-occupation
 * duration was recorded.
 */
export function fillDescriptionTemplate(variationId, form, institute, clients) {
  const variation = DESCRIPTION_VARIATIONS.find(v => v.id === variationId);
  if (!variation) return '';
  const vals = buildTemplateValues(form, institute, clients);
  if (vals.durationHours === '—' && form.durationMonths) {
    vals.durationHours = form.durationMonths * 30 * 8;
  }
  return applyTemplate(variation.preview, vals);
}

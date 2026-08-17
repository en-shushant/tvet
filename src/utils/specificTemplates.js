import { buildTemplateValues, applyTemplate, listAnd } from './templateValues.js';

// Templates for PPMO 3(B) Specific Experience — two slots per assignment:
//   narrativeDescription  (Narrative description of Project)
//   actualServicesDescription (Description of Actual Services Provided)
//
// Use \n• for bullet-point lists; single paragraph for prose variants.
// Placeholders: {firm} {client} {occupations} {totalTrainees} {locations}
//   {numDistricts} {durationHours} {durationDays} {numGroups} {level} {assignmentName}

// ── Narrative description of Project ─────────────────────────────────────────

export const NARRATIVE_VARIATIONS = [
  {
    id: 'n1',
    label: 'N1 — Standard skill-test curriculum (PCTEVT style)',
    preview:
      '• Provide skill development training on {occupations} to {totalTrainees} participants as per approved curriculum.\n{skillTestLine}\n• Implement the training program within the districts selected by {client} namely, {locations}.\n• Organize each training event following the standards.\n• Update required information in the skills database system within the given timeline.\n• Conduct regular monitoring to ensure adequate tools, equipment, and quality training delivery by instructors, ensure regularity of instructors, etc.',
  },
  {
    id: 'n2',
    label: 'N2 — FEB returnee migrant with entrepreneurship',
    preview:
      '• Provide skill development training on {occupations} to {totalTrainees} participants as per approved {client} curriculum of {durationHours} hours training with additional entrepreneurship training to returnee migrant and family member of the migrant worker between 18-40 years age.\n• Provide additional 15 hours of Financial Literacy or Entrepreneurship Development training to all trainees.\n• Implement the training program within the districts selected.\n• Organize each training event following the standards and curricula of {client}.\n• Update required information in the skills database system within the given timeline by {client}.\n• Conduct regular monitoring to ensure adequate tools, equipment, and quality training delivery by instructors, ensure regularity of instructors, etc.',
  },
  {
    id: 'n3',
    label: 'N3 — Women\'s window event-based (short sentence)',
    preview:
      'Conducted {numGroups} events {durationHours} hrs skill training and employment services to {totalTrainees} special Women under {occupations} Occupations.',
  },
  {
    id: 'n4',
    label: 'N4 — Women\'s window training and employment services',
    preview:
      'Training and employment services to {totalTrainees} special Women under {occupations} Occupations.',
  },
  {
    id: 'n5',
    label: 'N5 — GESI / youth-targeted 18–40 years',
    preview:
      'This assignment has targeted Youth aged 18–40 years who are permanent residents of the project districts. Trainee selection will focus on factors such as economic status, educational background, relevant experience, and expressed interest in skill development. Main objective of the assignment is to enhance quality of life of the trainee\'s family through increased income level. {firm} aims to equip the targeted participant through different marketable skills so that they can create self-employment opportunities or wage employment opportunities and enhance their incomes.',
  },
  {
    id: 'n6',
    label: 'N6 — World Bank / EVENT project description (paragraph)',
    preview:
      'The project has been established to expand the supply of skilled and employable labor by increasing access to quality training programs, and by strengthening the technical and vocational education and training system. The project emphasizes in increasing access to TEVT programs for disadvantaged youth especially poor, living in lagging regions, female, Dalit, marginalized Janajatis and people with disability through targeting and other inclusive processes. The project aims to help raise the capability of the TEVT sector to produce skilled, employable and productive labor for both domestic and international markets.',
  },
  {
    id: 'n7',
    label: 'N7 — Group-based curricula paragraph',
    preview:
      '{firm} implemented {durationDays}-day {occupations} training to {numGroups} groups ({totalTrainees} trainees) from {locations} based on the training curricula prepared by {client}. The training was targeted to working participants from these districts.',
  },
  {
    id: 'n8',
    label: 'N8 — Voucher-based training (bullet points)',
    preview:
      '• Provide skill development training on {occupations} to {totalTrainees} participants under voucher-based training scheme as per approved {client} curriculum.\n• Conduct skills assessment and issue certificates to successful trainees.\n• Implement the training program within the districts selected by {client} namely, {locations}.\n• Maintain records and update skills database within the given timeline.\n• Conduct regular monitoring to ensure quality training delivery by instructors.',
  },
  {
    id: 'n9',
    label: 'N9 — Multi-round result-based implementation',
    preview:
      '{firm} implemented result-based skill training program under {assignmentName}. {firm} provided skill training and employment services to trainees as per the contract including Special Women and regular batch trainees in {occupations} in {locations}.',
  },
  {
    id: 'n10',
    label: 'N10 — TOT / capacity building (bullet points)',
    preview:
      '• Conduct Training of Trainers on {occupations} to build local training capacity.\n• Develop and deliver training curricula based on competency standards.\n• Provide practical on-the-job training to {totalTrainees} participants from {locations}.\n• Conduct assessment and certification in coordination with {client}.\n• Submit progress reports and maintain documentation as per requirements.',
  },
  {
    id: 'n11',
    label: 'N11 — Skill test + employment linkage (bullet points)',
    preview:
      '• Provide {durationHours} hours\' {level} skill training on {occupations} to {totalTrainees} trainees.\n{skillTestLine}\n{employmentLine}\n• Implement the training program within {numDistricts} districts: {locations}.\n• Organize training events following the standards and curricula of {client}.\n• Maintain database records and submit reports within the given timeline.',
  },
  {
    id: 'n12',
    label: 'N12 — Short-term multi-trade paragraph',
    preview:
      '{firm} provided short-term vocational training on various trades including {occupations} to {totalTrainees} trainees from {locations} under the {assignmentName} project of {client}. The training followed the approved curricula and included skill testing and employment support for graduates.',
  },
  // ── Firm-assignable, paired 1:1 with V13–V17 and S13–S17 ───────────────────
  // Same seven-step sequence and the same five voices, but in scope framing:
  // this field describes what the assignment called for, where the services
  // field describes what was delivered. Assign N13 to the firm using V13/S13.
  {
    id: 'n13',
    label: 'N13 — Sequence, direct (pairs with V13/S13)',
    preview:
      'The assignment covered social marketing and awareness programs in {districtsPhrase} and the selection of motivated participants, followed by {occupationsWithCounts} together with soft skills, employability skills, health and safety, entrepreneurship and gender sensitivity orientation.{scopeTail}',
  },
  {
    id: 'n14',
    label: 'N14 — Sequence, formal (pairs with V14/S14)',
    preview:
      'Social marketing and awareness campaigns were to be carried out across {districtsPhrase}, from which motivated participants were to be selected. The project comprised {occupationsWithCounts}, each supplemented with soft skills, employability skills, occupational health and safety, entrepreneurship and gender sensitivity orientation.{scopeTail}',
  },
  {
    id: 'n15',
    label: 'N15 — Sequence, explicit stages (pairs with V15/S15)',
    preview:
      'The project was structured in stages: social marketing and awareness across {districtsPhrase}, selection of motivated participants, and delivery of {occupationsWithCounts}, with soft skills, employability skills, health and safety, entrepreneurship and gender sensitivity orientation provided alongside.{scopeTail}',
  },
  {
    id: 'n16',
    label: 'N16 — Sequence, bulleted (pairs with V16/S16)',
    preview:
      '• Carry out social marketing and awareness programs in {districtsPhrase}.\n• Select motivated participants from the communities reached.\n• Deliver {occupationsWithCounts}.\n• Provide soft skills, employability skills, health and safety, entrepreneurship and gender sensitivity orientation to all {totalTrainees} participants.{scopeBullets}',
  },
  {
    id: 'n17',
    label: 'N17 — Sequence, concise (pairs with V17/S17)',
    preview:
      'Following social marketing and awareness across {districtsPhrase}, the project provided for the selection of motivated participants and the delivery of {occupationsWithCounts}, with soft skills, employability skills, health and safety, entrepreneurship and gender sensitivity orientation.{scopeTail}',
  }

];

// ── Description of Actual Services Provided ───────────────────────────────────

export const SERVICES_VARIATIONS = [
  {
    id: 's1',
    label: 'S1 — Standard CTEVT curriculum with skill test',
    preview:
      '• Provided {durationHours} hours\' {level} training to {totalTrainees} targeted beneficiaries based on CTEVT curriculum.\n{skillTestLine}\n• Implemented the training program within the districts selected by {client} namely, {locations}.\n• Organized each training event following the standards.\n• Updated required information in the skills database system within the given timeline.\n• Conducted regular monitoring to ensure adequate tools, equipment, and quality training delivery by instructors.',
  },
  {
    id: 's2',
    label: 'S2 — EVENT / Women\'s window with RMA and placement',
    preview:
      '• Conducted RMA in {numDistricts} project districts to understand most demanded occupational trades and scope of employment after completion of the training.\n• Conducted social marketing and public awareness activities to ensure participation of 40% of female into training activities.\n• Provided {durationHours} hours\' {level} training to {totalTrainees} targeted beneficiaries based on CTEVT curriculum.\n• Conducted 15hrs Business and Life skill training.\n{skillTestNSTBLine}\n{employmentLine}',
  },
  {
    id: 's3',
    label: 'S3 — FEB returnee migrant with entrepreneurship',
    preview:
      '• Provided skill development training on {occupations} as per approved {client} curriculum of {durationHours} hours training with additional 15 hours entrepreneurship training to returnee migrant and family member of the migrant worker between 18-40 years age.\n• Provided additional 15 hours of Financial Literacy or Entrepreneurship Development training to all trainees.\n• Implemented the training program within the districts selected.\n• Organized each training event following the standards and curricula of {client}.\n• Updated required information in the skills database system within the given timeline by {client}.\n• Conducted regular monitoring to ensure adequate tools, equipment, and quality training delivery by instructors, ensure regularity of instructors, etc.',
  },
  {
    id: 's4',
    label: 'S4 — Multi-round result-based (EVENT/TCN style)',
    preview:
      '{firm} has implemented result-based skill training program under {assignmentName}. {firm} provided skill training and employment services to {totalTrainees} trainees in {occupations} across {locations}.',
  },
  {
    id: 's5',
    label: 'S5 — Skill test + employment focused (bullet points)',
    preview:
      '• Provided {durationHours} hours\' {level} training to {totalTrainees} trainees on {occupations} based on approved curriculum.\n{skillTestLine}\n• Arranged certification for successful trainees.\n{employmentLine}\n• Submitted progress reports and maintained records within the given timeline.\n• Conducted regular monitoring and quality assurance of training delivery.',
  },
  {
    id: 's6',
    label: 'S6 — On-the-job / construction training',
    preview:
      '• Carried out on-the-job {occupations} training to {totalTrainees} unskilled participants of {locations} districts.\n• Provided practical training on construction and technical skills at actual work sites.\n{skillTestLine}\n• Maintained training records and submitted reports to {client} as required.\n• Conducted monitoring visits to ensure quality of training delivery.',
  },
  {
    id: 's7',
    label: 'S7 — GESI / social marketing focused',
    preview:
      '• Conducted social mobilization and awareness activities targeting women and marginalized groups.\n• Provided {durationHours} hours {level} training to {totalTrainees} trainees on {occupations}.\n• Conducted GESI-responsive training ensuring 40% female participation.\n{skillTestNSTBLine}\n{employmentLine}\n• Submitted progress reports and updated skills database within the given timeline.',
  },
  {
    id: 's8',
    label: 'S8 — Voucher-based training services',
    preview:
      '• Conducted skills need assessment and identification of eligible trainees for voucher-based training.\n• Provided {durationHours} hours\' {occupations} training to {totalTrainees} voucher holders.\n{skillTestLine}\n• Maintained voucher records and submitted reimbursement claims as per {client} procedures.\n{employmentLine}\n• Submitted reports and updated database within the given timeline.',
  },
  {
    id: 's9',
    label: 'S9 — TOT / capacity building services',
    preview:
      '• Conducted Training of Trainers sessions to build local training capacity on {occupations}.\n• Developed training materials and curricula based on competency standards.\n• Provided practical training to {totalTrainees} participants from {locations}.\n• Assessed and certified participants in coordination with {client}.\n• Monitored implementation and provided technical support to trained trainers.\n• Submitted reports and documentation as per contractual requirements.',
  },
  {
    id: 's10',
    label: 'S10 — Short-term multi-district (bullet points)',
    preview:
      '• Provided short-term {occupations} training to {totalTrainees} trainees across {numDistricts} districts.\n• Organized training events following the standards and curricula of {client}.\n{skillTestLine}\n• Maintained database records and submitted progress reports as required.\n• Conducted monitoring to ensure quality training delivery.\n{employmentLine}',
  },
  {
    id: 's11',
    label: 'S11 — Standard comprehensive paragraph',
    preview:
      '{firm} provided skill training and employment services to {totalTrainees} trainees in {occupations} in {locations}. The training followed the approved curricula of {client} and included skill testing, employment support and regular monitoring to ensure quality delivery.',
  },
  {
    id: 's12',
    label: 'S12 — Skill test with detailed occupation breakdown',
    preview:
      '{firm} Provided {durationHours} Hours Training to {totalTrainees} Trainees in {occupations}.\n{skillTestNSTBLine}\n• Implemented training across {numDistricts} districts: {locations}.\n• Submitted all required reports and database updates to {client} within the given timeline.',
  },
  // ── Firm-assignable service narratives ────────────────────────────────────
  // Five wordings of the same seven-step sequence:
  //   social marketing → awareness → selection → training delivery → OJT →
  //   skill test → placement
  // Assign one per firm so two firms bidding the same tender do not submit
  // visibly identical prose. The OJT step appears only for clients flagged as
  // running one; the skill-test and placement steps only when recorded.
  {
    id: 's13',
    label: 'S13 — Sequence, direct (first person)',
    preview:
      'We carried out social marketing and awareness programs in {districtsPhrase}, and selected motivated participants from the communities reached. We provided {occupationsWithCounts}, along with soft skills, employability skills, health and safety, and entrepreneurship, and gender sensitivity orientation was provided at every event.{ojtClauseWe}{outcomeSentence}',
  },
  {
    id: 's14',
    label: 'S14 — Sequence, formal (third person, passive)',
    preview:
      'Social marketing and awareness campaigns were carried out across {districtsPhrase}, from which motivated participants were selected. {firm} delivered {occupationsWithCounts}, each supplemented with soft skills, employability skills, occupational health and safety, and entrepreneurship modules, together with gender sensitivity orientation.{ojtClausePassive}{outcomeSentence}',
  },
  {
    id: 's15',
    label: 'S15 — Sequence, explicit stages',
    preview:
      'The assignment began with social marketing and awareness programs across {districtsPhrase}, followed by the selection of motivated participants. {firm} then delivered {occupationsWithCounts}, with soft skills, employability skills, health and safety, entrepreneurship and gender sensitivity orientation provided alongside.{ojtClauseStage}{outcomeSentence}',
  },
  {
    id: 's16',
    label: 'S16 — Sequence, bulleted',
    preview:
      '• Carried out social marketing and awareness programs in {districtsPhrase}.\n• Selected motivated participants from the communities reached.\n• Delivered {occupationsWithCounts}.\n• Provided soft skills, employability skills, health and safety, entrepreneurship and gender sensitivity orientation to all {totalTrainees} participants.{ojtBullet}{outcomeBullets}',
  },
  {
    id: 's17',
    label: 'S17 — Sequence, concise',
    preview:
      'Following social marketing and awareness programs across {districtsPhrase}, {firm} selected motivated participants and delivered {occupationsWithCounts}. All {totalTrainees} participants also received soft skills, employability skills, health and safety, entrepreneurship and gender sensitivity orientation{ojtClauseTrailing}.{outcomeSentence}',
  },
];

// ── Fill functions ───────────────────────────────────────────────────────────
// Values and substitution live in templateValues.js, shared with the 3(A)
// description templates so the two cannot drift apart.

export function fillNarrativeTemplate(variationId, form, institute, clients) {
  const v = NARRATIVE_VARIATIONS.find(x => x.id === variationId);
  return v ? applyTemplate(v.preview, buildTemplateValues(form, institute, clients)) : '';
}

export function fillServicesTemplate(variationId, form, institute, clients) {
  const v = SERVICES_VARIATIONS.find(x => x.id === variationId);
  return v ? applyTemplate(v.preview, buildTemplateValues(form, institute, clients)) : '';
}

/**
 * "Name of Senior Staff and Designation ... Involved and Functions Performed",
 * written from the firm's key-staff roster rather than a chosen variation.
 *
 * The other three 3(B)/3(A) fields pick from a library of wordings because the
 * *substance* varies by project type. This one doesn't — the substance is just
 * who was on it — so there is nothing to choose between, and no variation
 * picker to wire up. Empty roster means nothing to write, same as an
 * unassigned template on the other three.
 */
export function fillSeniorStaffText(form, institute, clients) {
  const staff = (institute?.keyStaff || []).filter(s => (s.name || '').trim());
  if (!staff.length) return '';
  const roster = staff.map(s => s.position ? `${s.name} — ${s.position}` : s.name).join('\n');
  const { client } = buildTemplateValues(form, institute, clients);
  const named = listAnd(staff.map(s => s.name));
  return `${roster}\n\n${named} were responsible for overall project management, coordination with ${client || 'the client'}, and quality assurance of the training delivered under this assignment.`;
}

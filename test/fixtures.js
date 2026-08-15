/**
 * One realistic registry, shared by every smoke test.
 *
 * Shaped to exercise the paths that have actually broken: an institute with
 * assignments and one without, a client referenced by id and another named only
 * as free text, an occupation missing level and duration, a renewal date in
 * Bikram Sambat, and blank strings where the API returns blanks rather than
 * nulls. Fixtures that are too tidy are the reason smoke tests pass while the
 * app is broken.
 */

export const clients = [
  { id: 1, fullName: 'Federation of Nepalese Chambers', shortName: 'FNCCI', type: 'Private sector', address: 'Kathmandu' },
  { id: 2, fullName: 'Helvetas Nepal', shortName: 'Helvetas', type: 'INGO', address: 'Lalitpur' },
  { id: 3, fullName: 'Never Engaged Trust', shortName: 'NET', type: 'NGO', address: 'Pokhara' },
];

export const occupations = [
  { id: 1, name: 'Beautician', sector: 'Personal Services', level: 'Level 1', duration: 390 },
  { id: 2, name: 'Tailoring', sector: 'Textile', level: 'Level 2', duration: 280 },
];

const occ = (over = {}) => ({
  id: 'o1', nameInLetter: 'Beautician', ctevtOccupationId: 1, level: 'Level 1',
  duration: '390', trainees: '40', skillTestProvisioned: true, skillTestAppeared: '38',
  skillTestPass: '35', employmentProvisioned: true, employmentActual: '72',
  locations: [{ id: 'l1', province: 'Bagmati', district: 'Kathmandu', localLevels: [] }],
  ...over,
});

const assignment = (over = {}) => ({
  id: 1, fy: '2081/82', assignmentName: 'Skills for Employment', clientId: 1, clientName: '',
  trainingType: 'Short Term', contractValue: '2500000', startDate: '2082/01/15', endDate: '2082/04/10',
  isGesi: false, isResidential: false, isJV: false, occupations: [occ()], locations: [],
  ...over,
});

const institute = (over = {}) => ({
  id: 1, name: 'CEMECA Human Resource Academy Private Limited', acronym: 'CEMECA',
  regNo: '33976/061/62', pan: '300584923', type: 'Private', status: 'Active',
  address: 'Kathmandu', contactPerson: 'Ram Bahadur', phone: '9800000000', mobile: '',
  email: 'info@example.np', renewalDue: '2083/05/01', remarks: '', logo: null,
  website: '', latitude: '', longitude: '',
  experience: [assignment()],
  nstb: [{ fy: '2081/82' }],
  taxClearance: [{ fy: '2081/82', turnover: '12000000' }],
  affiliation: [{ status: 'Active', expiryDate: '2084/03/30', affiliationDate: '2078/01/01', programs: [{ id: 1 }, { id: 2 }] }],
  infrastructure: [],
  totalTrainees: 40, totalStAppeared: 38, totalClients: 1, totalAffPrograms: 2,
  isShortlistingOnly: false,
  ...over,
});

export const institutes = [
  institute(),
  // Second firm: a manual client, and an occupation missing level and duration —
  // the exact shape Data Quality is meant to surface.
  institute({
    id: 2, name: 'Nabaratna Technical Training Institute Pvt. Ltd.', acronym: 'NTTI',
    regNo: '112355/69/070', pan: '', renewalDue: '2082/04/15',
    experience: [assignment({
      id: 2, clientId: null, clientName: 'Ad-hoc Municipality', assignmentName: 'Local skills drive',
      occupations: [occ({ id: 'o2', ctevtOccupationId: 2, nameInLetter: 'Tailoring', level: '', duration: '', trainees: '20', locations: [] })],
    })],
    taxClearance: [], affiliation: [{ status: 'Expired', programs: [] }],
    totalTrainees: 20, totalStAppeared: 0, totalClients: 0, totalAffPrograms: 0,
  }),
  // Third firm: nothing loaded and nothing recorded. Blank strings, not nulls,
  // because that is what the API returns.
  institute({
    id: 3, name: 'Empty Registry Institute Pvt. Ltd.', acronym: '',
    regNo: '', pan: '', address: '', renewalDue: '',
    experience: [], nstb: [], taxClearance: [], affiliation: [],
    totalTrainees: 0, totalStAppeared: 0, totalClients: 0, totalAffPrograms: 0,
  }),
];

/** The shape GET /institutes/compliance returns — snake_case, not normalised. */
export const complianceRows = institutes.map(i => ({
  id: i.id, name: i.name, acronym: i.acronym, type: i.type, status: i.status,
  experience: i.experience.map(e => ({
    id: e.id, institute_id: i.id, client_id: e.clientId,
    client_name_manual: e.clientName || null, fiscal_year: e.fy,
    assignment_name: e.assignmentName, contract_value: e.contractValue,
    occupations: e.occupations.map(o => ({
      id: o.id, ctevt_occupation_id: o.ctevtOccupationId, name_in_letter: o.nameInLetter,
      trainees: o.trainees, duration: o.duration, level: o.level, locations: o.locations,
    })),
  })),
  taxClearance: i.taxClearance.map(t => ({ institute_id: i.id, fiscal_year: t.fy, turnover: t.turnover })),
}));

/** The shape GET /institutes/documents returns — booleans per column. */
export const documentRows = [
  { id: 1, ocr_registration: true, ocr_renewal: true, local_level_registration: true,
    local_level_renewal: true, vat_registration: true, vat_extension: true,
    tax_clearance_doc: true, ctevt_affiliation: true, ctevt_renewal: true },
  { id: 2, ocr_registration: true, ocr_renewal: false, local_level_registration: false,
    local_level_renewal: false, vat_registration: true, vat_extension: false,
    tax_clearance_doc: false, ctevt_affiliation: false, ctevt_renewal: false },
  { id: 3 },
];

/**
 * Answers the endpoints screens call on mount. Anything unrecognised rejects
 * loudly rather than resolving empty — a screen quietly rendering "no data"
 * because a URL was never stubbed is exactly the false pass to avoid.
 */
export function installFetchStub() {
  globalThis.fetch = (url) => {
    const u = String(url);
    const json = (body) => Promise.resolve(new Response(JSON.stringify(body), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }));
    if (u.includes('/institutes/compliance')) return json(complianceRows);
    if (u.includes('/institutes/documents'))  return json(documentRows);
    if (u.includes('/institutes/logos'))      return json([]);
    if (u.includes('/dashboard/totals'))      return json({ assignments: 2, clients: 2, districts: 1, byFy: [] });
    if (u.includes('/dashboard/activity'))    return json({ assignments: 1, tax: 0, nstb: 0, affiliations: 0, institutes: 0 });
    if (u.includes('/institutes'))            return json(institutes);
    if (u.includes('/clients'))               return json(clients);
    if (u.includes('/occupations'))           return json(occupations);
    if (u.includes('/locations'))             return json([]);
    if (u.includes('/shortlists') || u.includes('/standing-lists') || u.includes('/quotations')) return json([]);
    return Promise.reject(new Error(`Unstubbed request: ${u}`));
  };
}

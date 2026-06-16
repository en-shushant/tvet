import { OCCUPATIONS } from '../constants/data.js';

// API base URL — reads from localStorage so self-hosted users can point at their own backend.
export const API_URL_KEY = 'tvettrack_api_url';
export function getApiBase() {
  try {
    const custom = localStorage.getItem(API_URL_KEY);
    if (custom && custom.trim()) return custom.replace(/\/+$/, '');
  } catch {}
  return ''; // empty = use relative '/api'
}
export const API_BASE_PATH = '/api';

export async function api(method, path, body, token, _retry = 0) {
  const base = getApiBase();
  const url = (base || '') + API_BASE_PATH + path;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
  } catch(fetchErr) {
    if (_retry < 2) {
      await new Promise(r => setTimeout(r, 300 * (_retry + 1)));
      return api(method, path, body, token, _retry + 1);
    }
    throw new Error('Network error — could not reach server. Check your internet connection.');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const msg = err.error || res.statusText;
    const e = new Error(msg);
    e.status = res.status;
    if (res.status === 401) {
      try { localStorage.removeItem('tvettrack_session'); } catch {}
      window.dispatchEvent(new CustomEvent('tvettrack:session-expired'));
    }
    throw e;
  }
  return res.json();
}

// helper used by expToAPI
function getOccupation(id) {
  const rawId = typeof id === 'string' && id.startsWith('c:') ? parseInt(id.slice(2)) : id;
  return OCCUPATIONS.find(o => o.id === rawId) || {};
}

// helper uid for normExp locations
function uid() { return Math.random().toString(36).slice(2,9); }

// ── Normalize API snake_case → frontend camelCase ────────────────────────────

export function normInst(r) {
  return {
    id: r.id,
    name: r.name || '',
    acronym: r.acronym || '',
    regNo: r.reg_no || '',
    regDate: r.reg_date || '',
    pan: r.pan || '',
    permanentAccountNo: r.permanent_account_no || '',
    contactPerson: r.contact_person || '',
    phone: r.phone || '',
    email: r.email || '',
    address: r.address || '',
    type: r.type || 'Private',
    status: r.status || 'Active',
    renewalDue: r.renewal_due || '',
    remarks: r.remarks || '',
    logo: r.logo || null,
    website: r.website || '',
    googleMapLink: r.google_map_link || '',
    latitude: r.latitude != null ? String(r.latitude) : '',
    longitude: r.longitude != null ? String(r.longitude) : '',
    experience: (r.experience || []).map(normExp),
    nstb: (r.nstb || []).map(n => n.fiscal_year !== undefined ? normNSTBR(n) : n),
    taxClearance: (r.taxClearance || r.tax_clearance || []).map(t => t.fiscal_year !== undefined ? normTaxR(t) : t),
    affiliation: (r.affiliation || []).map(a => a.affiliation_date !== undefined ? normAffR(a) : a),
    totalTrainees: parseInt(r.total_trainees) || 0,
    totalStAppeared: parseInt(r.total_st_appeared) || 0,
    totalClients: parseInt(r.total_clients) || 0,
    totalAffPrograms: parseInt(r.total_aff_programs) || 0,
  };
}

export function normExp(r) {
  return {
    id: r.id,
    clientId: r.client_id,
    clientName: r.client_name_manual || '',
    manualClient: !!r.client_name_manual && !r.client_id,
    assignmentName: r.assignment_name || '',
    trainingType: r.training_type || '',
    fy: r.fiscal_year || '',
    startDate: r.start_date || '',
    endDate: r.end_date || '',
    contractValue: r.contract_value != null ? String(r.contract_value) : '',
    startFY: r.start_fy || '',
    endFY: r.end_fy || '',
    remarks: r.remarks || '',
    referenceFile: r.reference_file || r.letter_file || null,
    referenceFileName: r.reference_file_name || r.letter_file_name || '',
    isGesi: !!r.is_gesi,
    isResidential: !!r.is_residential,
    isJV: !!r.is_jv,
    jvRole: r.jv_role || 'Lead',
    jvPartners: r.jv_partners != null ? String(r.jv_partners) : '',
    country: r.country || 'Nepal',
    descriptionOfWork: r.description_of_work || '',
    durationMonths: r.duration_months != null ? String(r.duration_months) : '',
    totalPersonMonths: r.total_person_months != null ? String(r.total_person_months) : '',
    ownServiceValue: r.own_service_value != null ? String(r.own_service_value) : '',
    jvPartnerNames: r.jv_partner_names || '',
    jvPartnerPersonMonths: r.jv_partner_person_months != null ? String(r.jv_partner_person_months) : '',
    narrativeDescription: r.narrative_description || '',
    actualServicesDescription: r.actual_services_description || '',
    occupations: (r.occupations || []).map(o => ({
      id: o.id,
      nameInLetter: o.name_in_letter || '',
      ctevtOccupationId: o.ctevt_occupation_id || '',
      trainees: o.trainees ?? '',
      duration: o.duration_hours ?? '',
      level: o.level || '',
      skillTestProvisioned: !!o.skill_test_provisioned,
      skillTestAppeared: o.skill_test_appeared ?? '',
      skillTestPass: o.skill_test_pass ?? '',
      employmentProvisioned: !!o.employment_provisioned,
      employmentActual: o.employment_actual_pct ?? '',
      locations: (o.locations || []).map(l => ({
        id: uid(),
        province: l.province || '',
        district: l.district || '',
        localLevels: l.local_levels || (l.local_level ? [{name: l.local_level, type: l.local_level_type || ''}] : []),
      })),
    })),
    locations: [],
  };
}

export function normNSTBR(r) {
  return {
    id: r.id,
    fy: r.fiscal_year || '',
    letterNo: r.letter_no || '',
    letterDate: r.letter_date || '',
    letterType: r.letter_type || '',
    occupation: r.occupation || '',
    ctevtOccupationId: r.ctevt_occupation_id || '',
    level: r.level || '',
    applied: r.applied ?? '',
    appeared: r.appeared ?? '',
    pass: r.pass ?? '',
    remarks: r.remarks || '',
  };
}

export function normTaxR(r) {
  return {
    id: r.id,
    fy: r.fiscal_year || '',
    turnover: r.turnover || '',
    taxableIncome: r.taxable_income || '',
    taxPaid: r.tax_paid || '',
    certDate: r.cert_date || '',
    karChutaNo: r.kar_chuta_no || '',
    patraNo: r.patra_no || '',
    incomeStatementDate: r.income_statement_date || '',
    remarks: r.remarks || '',
  };
}

export function normAffR(r) {
  return {
    id: r.id,
    patraNo: r.patra_no || '',
    chalaniNo: r.chalani_no || '',
    affiliationDate: r.affiliation_date || '',
    validityYears: r.validity_years || '',
    expiryDate: r.expiry_date || '',
    status: r.status || 'Active',
    remarks: r.remarks || '',
    programs: (r.programs || []).map(p => ({
      id: p.id,
      name: p.name || '',
      level: p.level || '',
      duration: p.duration_hours || '',
      seats: p.seats_per_batch || '',
    })),
  };
}

export function normClient(r) {
  return {
    id: r.id,
    fullName: r.full_name || '',
    shortName: r.short_name || '',
    type: r.type || 'Government',
    address: r.address || '',
    remarks: r.remarks || '',
  };
}

// ── Reverse maps: frontend camelCase → API snake_case ────────────────────────

export function instToAPI(f) {
  return {
    name: f.name, acronym: f.acronym,
    reg_no: f.regNo, reg_date: f.regDate || null,
    pan: f.pan, permanent_account_no: f.permanentAccountNo,
    contact_person: f.contactPerson, phone: f.phone,
    email: f.email, address: f.address,
    type: f.type, status: f.status,
    renewal_due: f.renewalDue || null, remarks: f.remarks,
    logo: f.logo || null,
    website: f.website || null,
    google_map_link: f.googleMapLink || null,
    latitude: f.latitude ? parseFloat(f.latitude) : null,
    longitude: f.longitude ? parseFloat(f.longitude) : null,
  };
}

export function expToAPI(f, instituteId) {
  return {
    institute_id: instituteId,
    client_id: f.manualClient ? null : (f.clientId || null),
    client_name_manual: f.manualClient ? (f.clientName || '') : null,
    assignment_name: f.assignmentName,
    training_type: f.trainingType || '',
    fiscal_year: f.fy,
    start_date: f.startDate || null,
    end_date: f.endDate || null,
    contract_value: f.contractValue || null,
    start_fy: f.startFY || null,
    end_fy: f.endFY || null,
    remarks: f.remarks || '',
    reference_file: f.referenceFile || null,
    reference_file_name: f.referenceFileName || '',
    is_gesi: !!f.isGesi,
    is_residential: !!f.isResidential,
    is_jv: !!f.isJV,
    jv_role: f.isJV ? (f.jvRole || 'Lead') : null,
    jv_partners: f.isJV ? (f.jvPartners || null) : null,
    country: f.country || 'Nepal',
    description_of_work: f.descriptionOfWork || null,
    duration_months: f.durationMonths || null,
    total_person_months: f.totalPersonMonths || null,
    own_service_value: f.ownServiceValue || null,
    jv_partner_names: f.isJV ? (f.jvPartnerNames || null) : null,
    jv_partner_person_months: f.isJV ? (f.jvPartnerPersonMonths || null) : null,
    narrative_description: f.narrativeDescription || null,
    actual_services_description: f.actualServicesDescription || null,
    occupations: (f.occupations || []).filter(o => o.nameInLetter || o.ctevtOccupationId).map(o => ({
      name_in_letter: o.nameInLetter || getOccupation(o.ctevtOccupationId).name || '',
      ctevt_occupation_id: (() => { const v = o.ctevtOccupationId; return v ? (typeof v === 'string' && v.startsWith('c:') ? parseInt(v.slice(2)) : v) : null; })(),
      trainees: (o.trainees === '' || o.trainees == null) ? null : o.trainees,
      duration: (o.duration === '' || o.duration == null) ? null : o.duration,
      level: o.level || null,
      skill_test_provisioned: !!o.skillTestProvisioned,
      skill_test_appeared: (o.skillTestAppeared === '' || o.skillTestAppeared == null) ? null : o.skillTestAppeared,
      skill_test_pass: (o.skillTestPass === '' || o.skillTestPass == null) ? null : o.skillTestPass,
      employment_provisioned: !!o.employmentProvisioned,
      employment_actual_pct: (o.employmentActual === '' || o.employmentActual == null) ? null : o.employmentActual,
      locations: (o.locations || []).filter(l => l.district).map(l => ({
        province: l.province, district: l.district,
        local_levels: (l.localLevels || []),
      })),
    })),
    locations: [],
  };
}

export function nstbToAPI(f, instituteId) {
  return {
    institute_id: instituteId,
    fiscal_year: f.fy,
    letter_no: f.letterNo || '',
    letter_date: f.letterDate || null,
    letter_type: f.letterType || '',
    occupation: f.occupation || '',
    level: f.level || '',
    applied: (f.applied === '' || f.applied == null) ? null : f.applied,
    appeared: (f.appeared === '' || f.appeared == null) ? null : f.appeared,
    pass: (f.pass === '' || f.pass == null) ? null : f.pass,
    remarks: f.remarks || '',
  };
}

export function taxToAPI(f, instituteId) {
  return {
    institute_id: instituteId,
    fiscal_year: f.fy,
    turnover: f.turnover || null,
    taxable_income: f.taxableIncome || null,
    tax_paid: f.taxPaid || null,
    cert_date: f.certDate || null,
    kar_chuta_no: f.karChutaNo || '',
    patra_no: f.patraNo || '',
    income_statement_date: f.incomeStatementDate || null,
    remarks: f.remarks || '',
  };
}

export function affToAPI(f, instituteId) {
  return {
    institute_id: instituteId,
    patra_no: f.patraNo || '',
    chalani_no: f.chalaniNo || '',
    affiliation_date: f.affiliationDate || null,
    validity_years: f.validityYears || null,
    expiry_date: f.expiryDate || null,
    remarks: f.remarks || '',
    programs: (f.programs || []).filter(p => p.name).map(p => ({
      name: p.name,
      level: p.level || '',
      duration_hours: p.duration || null,
      seats_per_batch: p.seats || null,
    })),
  };
}

export function clientToAPI(f) {
  return {
    full_name: f.fullName,
    short_name: f.shortName,
    type: f.type,
    address: f.address || '',
    remarks: f.remarks || '',
  };
}

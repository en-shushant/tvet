import React from 'react';
import { getClient, monthsBetween, districtsOf, esc, fyInRange } from './helpers.js';
import { loadDocx, loadFileSaver } from './docxLazy.js';
import { BS_MONTHS_EN } from '../constants/nepali.js';
import { fillDescriptionTemplate } from '../utils/descriptionTemplates.js';
import { fillNarrativeTemplate, fillServicesTemplate, fillSeniorStaffText } from '../utils/specificTemplates.js';

// ─── Standard EOI Document (Bolpatra) ────────────────────────────────────────
// Mirrors the PPMO/e-GP "Standard EOI Document" form:
//   2.    Applicant's Information Form
//   3(A)  General Work Experience
//   3(B)  Specific Experience
//   3(C)  Geographic Experience
//   4(A)  Financial Capacity
// Every report is `aggregate` because ReportsView's multi-institute branch renders
// solely through renderAggregateTable — there is no per-row path in that mode.

// 3(A) is "General Work Experience" — everything the firm has done — so the
// occupation and duration filters deliberately do not narrow it. They apply to
// 3(B) "Specific Experience", which is by definition the subset of similar
// assignments relevant to the EOI being bid for.
const REPORTS = [
  { id: 'full', label: 'Complete EOI Document', aggregate: true, hasOccupationFilter: true, hasTurnoverFY: true, hasToolsPicker: true },
  { id: '2',    label: "2. Applicant's Information Form", aggregate: true },
  { id: '3a',   label: '3(A) General Work Experience', aggregate: true },
  { id: '3b',   label: '3(B) Specific Experience', aggregate: true, hasOccupationFilter: true },
  { id: '3c',   label: '3(C) Geographic Experience', aggregate: true },
  { id: '4a',   label: '4(A) Financial Capacity', aggregate: true, hasTurnoverFY: true },
  { id: '4b',   label: '4(B) Infrastructure / Equipment', aggregate: true, hasOccupationFilter: true, hasToolsPicker: true },
];

const SECTION_ORDER = ['2', '3a', '3b', '3c', '4a', '4b'];
// 4(B) covers the whole applicant: every firm's office setup, then one tools
// list. Tools are master data per occupation and level — identical for every
// firm — so repeating them per member would pad the document with duplicates.
const FIRM_SPANNING = new Set(['4b']);
const sectionsFor = (reportId) => reportId === 'full' ? SECTION_ORDER : [reportId];

const SECTION_TITLES = {
  '2':  { heading: "2.  Applicant's Information Form", centered: true,
          note: '(In case of joint venture of two or more firms to be filled separately for each constituent member)' },
  '3a': { heading: '3(A). General Work Experience',
          note: '(Details of assignments undertaken. Each consultant or member of a JV must fill in this form.)' },
  '3b': { heading: '3(B). Specific Experience',
          note: 'Details of similar assignments undertaken in the previous seven years' },
  '3c': { heading: '3(C). Geographic Experience',
          note: 'Experience of working in similar geographic region or country' },
  // "4.  Capacity" is the parent heading that 4(A) sits under on the printed
  // form, so it prints above the sub-heading and its note — not buried inside
  // the section body after them.
  '4a': { preHeading: '4.  Capacity',
          heading: '4(A). Financial Capacity',
          note: '(In case of joint venture of two or more firms to be filled separately for each constituent member)' },
  '4b': { heading: '4(B). Infrastructure/equipment related to the proposed assignment',
          note: 'Service delivery space, and the tools and equipment available for the proposed occupations.' },
};

// ─── Value formatting ────────────────────────────────────────────────────────

const dash = (v) => (v === 0 || v) && String(v).trim() !== '' ? String(v) : '';

const fmtNrs = (v) => {
  if (v == null || v === '') return '';
  const n = Number(v);
  return isNaN(n) ? String(v) : `NRs. ${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

// "2081/04/27" or "2081-04-27" → "Shrawan/2081".
//
// Contract dates are entered in Bikram Sambat (the form's YYYY/MM/DD is a BS
// date), so month 1 is Baishakh — not January. Mapping these through Gregorian
// month names mislabels every date by roughly nine months. Names are romanised
// because the EOI paperwork itself is in English. An unparseable month segment is
// kept verbatim so nothing is silently lost.
const fmtMonthYear = (d) => {
  if (!d) return '';
  const parts = String(d).replace(/-/g, '/').split('/');
  if (parts.length < 2) return String(d);
  const m = parseInt(parts[1], 10);
  return `${BS_MONTHS_EN[m - 1] || parts[1]}/${parts[0]}`;
};

const locationOf = (exp) => {
  const d = districtsOf(exp);
  if (d.length) return d.join(', ');
  return (exp.locations || []).map(l => l.district).filter(Boolean).join(', ');
};

const clientNameOf = (exp, clients) => {
  const c = getClient(clients, exp.clientId);
  return c.fullName || exp.clientName || '';
};

/**
 * Narrative text for one of the three auto-filled fields.
 *
 * Anything typed on the assignment wins; otherwise the text is generated from
 * the firm's assigned template. Generating at render time rather than storing
 * means the prose always reflects the current trainee counts and districts —
 * a value written once and saved goes stale the moment those are corrected.
 */
function narrativeFor(exp, inst, clients, slot) {
  const stored = (exp[slot.field] || '').trim();
  if (stored) return stored;
  // Senior staff has one source — the firm's key-staff roster — rather than a
  // library of variations to pick from, so it has no templateKey to gate on.
  if (slot.always) {
    try { return slot.fill(exp, inst, clients) || ''; }
    catch { return ''; }
  }
  const variationId = inst?.[slot.templateKey];
  if (!variationId) return '';
  try { return slot.fill(variationId, exp, inst, clients) || ''; }
  catch { return ''; }
}

const DESCRIPTION_SLOT  = { field: 'descriptionOfWork',          templateKey: 'descTemplateId',      fill: fillDescriptionTemplate };
const NARRATIVE_SLOT    = { field: 'narrativeDescription',       templateKey: 'narrativeTemplateId', fill: fillNarrativeTemplate };
const SERVICES_SLOT     = { field: 'actualServicesDescription',  templateKey: 'servicesTemplateId',  fill: fillServicesTemplate };
const SENIOR_STAFF_SLOT = { field: 'seniorStaffDescription', always: true, fill: fillSeniorStaffText };

const captionOf = (exp) => {
  const name = exp.assignmentName || '(unnamed assignment)';
  return exp.fy ? `Assignment Name: ${name} (FY ${exp.fy})` : `Assignment Name: ${name}`;
};

/**
 * Heading identifying whose copy of a section a page holds. Callers pass firms
 * already ordered lead-first (see fwSelectedFirms in ReportsView), so position 0
 * is the lead applicant. A single firm gets no role prefix.
 */
const firmLabel = (inst, idx, total) => {
  const name = inst?.name || '';
  if (total < 2) return name;
  return idx === 0 ? `Lead firm: ${name}` : `JV partner: ${name}`;
};

// ─── 3(B) narrowing ──────────────────────────────────────────────────────────
// ReportsView hands this family unfiltered assignments (family.selfFilters) so
// occupation and duration can be scoped to 3(B) rather than every section.

/** Display name of an occupation row, resolved through the master list. */
const occNameOf = (occ, occupations) => {
  if (occupations?.length && occ.ctevtOccupationId) {
    const found = occupations.find(o => String(o.id) === String(occ.ctevtOccupationId));
    if (found) return found.name;
  }
  return occ.nameInLetter || '';
};

const meetsDuration = (occ, filterDuration) => {
  if (!filterDuration) return true;
  const d = parseFloat(occ.duration) || 0;
  if (filterDuration === '160plus') return d >= 160;
  if (filterDuration === '390plus') return d >= 390;
  if (filterDuration === '390more') return d > 390;
  return true;
};

/**
 * Assignments qualifying as "similar" for 3(B). An assignment is kept when at
 * least one of its occupation rows satisfies *both* the occupation and duration
 * criteria — a 400-hour Electrician row must not qualify the assignment when the
 * user asked for 400-hour Plumbing.
 */
function specificExps(exps, opts = {}) {
  const { selectedOccs = [], filterDuration = '', occupations = [],
          eoiAllOccsInSpecific = false } = opts;
  // The occupation picker scopes the 4(B) tools list. When this is set it stops
  // scoping 3(B) as well, so the firm's experience can be shown in full while
  // the tools stay limited to the occupations being tendered for. Duration is
  // still applied — that is a separate filter and means the same thing here.
  const wanted = eoiAllOccsInSpecific ? [] : selectedOccs.map(s => s.toLowerCase());
  if (!wanted.length && !filterDuration) return exps;
  return exps.filter(exp => (exp.occupations || []).some(occ => {
    if (!meetsDuration(occ, filterDuration)) return false;
    if (!wanted.length) return true;
    return wanted.includes(occNameOf(occ, occupations).toLowerCase());
  }));
}

// ─── Section models ──────────────────────────────────────────────────────────
// Each builder returns a renderer-neutral shape so the JSX, print-HTML and DOCX
// renderers stay in sync rather than each re-deriving the same values.

// Section 2 → [{ no, label, value }]
function model2(inst) {
  const i = inst || {};
  const contact = [i.contactPerson, i.contactDesignation, i.address, i.phone]
    .map(dash).filter(Boolean).join(' / ');
  const comms = [
    i.phone ? `Tel: ${i.phone}` : '',
    i.mobile ? `Mobile: ${i.mobile}` : '',
    i.fax ? `Fax: ${i.fax}` : '',
    i.email ? `Email: ${i.email}` : '',
  ].filter(Boolean).join('; ');

  return [
    { no: 1,  label: 'Name of Firm/Company',                                  value: dash(i.name) },
    { no: 2,  label: 'Type of Constitution (Partnership/ Pvt. Ltd/Public Ltd/ Public Sector/ NGO)',
                                                                              value: dash(i.constitutionType) },
    { no: 3,  label: 'Date of Registration / Commencement of Business (Please specify)',
                                                                              value: dash(i.regDate) },
    { no: 4,  label: 'Country of Registration',                               value: 'Nepal' },
    { no: 5,  label: 'Registered Office/Place of Business',                   value: dash(i.address) },
    { no: 6,  label: 'Telephone No; Fax No; E-Mail Address',                  value: comms },
    { no: 7,  label: 'Name of Authorized Contact Person / Designation/ Address/Telephone', value: contact },
    { no: 8,  label: 'Name of Authorized Local Agent /Address/Telephone',     value: dash(i.localAgent) },
    { no: 9,  label: "Consultant's Organization",                             value: dash(i.orgProfile) },
    { no: 10, label: 'Total number of staff',                                 value: dash(i.totalStaff) },
    { no: 11, label: 'Number of regular professional staff',                  value: dash(i.professionalStaff) },
  ];
}

/** Closing instruction printed under section 2 on the form. */
const SECTION2_NOTE = '(Provide Company Profile with description of the background and '
  + 'organization of the Consultant and, if applicable, for each joint venture partner for '
  + 'this assignment.)';

// Section 3A → { columns, widths, rows }
function model3a(exps, clients, inst) {
  return {
    columns: ['S. N.', 'Name of assignment', 'Location', 'Value of Contract', 'Year Completed', 'Client', 'Description of work carried out'],
    widths:  [600, 2200, 1400, 1200, 900, 1400, 1938],
    rows: exps.map((exp, i) => [
      String(i + 1),
      dash(exp.assignmentName),
      locationOf(exp),
      fmtNrs(exp.contractValue),
      dash(exp.endFY || exp.fy),
      clientNameOf(exp, clients),
      narrativeFor(exp, inst, clients, DESCRIPTION_SLOT),
    ]),
  };
}

// Section 3B → [{ caption, rows: [[leftCell, rightCell]], footer }]
// A "cell" is an array of { label, value } pairs so the stacked cells in the
// original form (Country + Location, Start + Completion) render correctly.
function model3b(exps, clients, inst) {
  return exps.map(exp => {
    const client = getClient(clients, exp.clientId);
    const jv = !!exp.isJV;
    return {
      caption: captionOf(exp),
      rows: [
        [
          [{ label: 'Assignment name', value: dash(exp.assignmentName) }],
          [{ label: 'Approx. value of the contract (in current NRs; US$ or Euro)', value: fmtNrs(exp.contractValue) }],
        ],
        [
          [{ label: 'Country', value: dash(exp.country) || 'Nepal' },
           { label: 'Location within country', value: locationOf(exp) }],
          [{ label: 'Duration of assignment (months)',
             value: dash(exp.durationMonths) || dash(monthsBetween(exp.startDate, exp.endDate)) }],
        ],
        [
          [{ label: 'Name of Client', value: clientNameOf(exp, clients) }],
          [{ label: 'Total No. of person-months of the assignment', value: dash(exp.totalPersonMonths) }],
        ],
        [
          [{ label: 'Address', value: dash(client.address) }],
          [{ label: 'Approx. value of the services provided by your firm under the contract (in current NRs; US$ or Euro)',
             value: fmtNrs(exp.ownServiceValue || exp.contractValue) }],
        ],
        [
          [{ label: 'Start date (month/year)', value: fmtMonthYear(exp.startDate) },
           { label: 'Completion date (month/year)', value: fmtMonthYear(exp.endDate) }],
          [{ label: 'No. of professional person-months provided by the joint venture partners or the Sub-Consultants',
             value: jv ? dash(exp.jvPartnerPersonMonths) : 'NA' }],
        ],
        [
          [{ label: 'Name of joint venture partner or sub-Consultants, if any',
             value: jv ? dash(exp.jvPartnerNames) : 'NA' }],
          [{ label: 'Narrative description of Project', value: narrativeFor(exp, inst, clients, NARRATIVE_SLOT), block: true }],
        ],
        [
          [{ label: 'Name of Senior Staff and Designation (Project Director/Coordinator, Team Leader etc.) Involved and Functions Performed',
             value: narrativeFor(exp, inst, clients, SENIOR_STAFF_SLOT), block: true }],
          [{ label: 'No. of Staff', value: dash(exp.staffCount) }],
        ],
      ],
      footer: {
        label: 'Description of actual services provided in the assignment',
        value: narrativeFor(exp, inst, clients, SERVICES_SLOT),
        note: 'Note: Provide highlight on similar services provided by the consultant as required by the EOI assignment.',
      },
    };
  });
}

// Section 3C → { columns, widths, rows }
function model3c(exps) {
  return {
    columns: ['No', 'Name of the Project', 'Location (Country/ Region)', 'Execution Year and Duration'],
    widths:  [700, 4500, 2400, 2038],
    rows: exps.map((exp, i) => {
      const loc = locationOf(exp);
      const country = dash(exp.country) || 'Nepal';
      const span = `${dash(exp.fy)}${exp.endFY && exp.endFY !== exp.fy ? `–${exp.endFY}` : ''}`;
      const dur = exp.durationMonths ? ` (${exp.durationMonths} months)` : '';
      return [
        String(i + 1),
        dash(exp.assignmentName),
        loc ? `${country} — ${loc}` : country,
        `${span}${dur}`,
      ];
    }),
  };
}

// Section 4A → { rows: [[year, amount]], average }
// Uses its own FY range: a bid commonly asks for turnover over a different span
// than the experience it wants shown (e.g. 3 years of accounts, 7 years of work),
// so tying both to one selector would make one of them wrong.
function model4a(inst, opts = {}) {
  const fromFY = opts.turnoverFromFY ?? '';
  const toFY   = opts.turnoverToFY ?? '';
  const records = (inst?.taxClearance || [])
    .filter(t => t.fy && (!fromFY && !toFY ? true : fyInRange(t.fy, fromFY, toFY)))
    .slice()
    .sort((a, b) => String(a.fy).localeCompare(String(b.fy)));

  // "Average Annual Turnover" is the average of the best three years within the
  // selected range, not every year in it — a firm with a weak early year
  // shouldn't have that year drag down a figure the form asks to be the best
  // three. Fewer than three years just averages what's there.
  const amounts = records.map(t => Number(t.turnover)).filter(n => !isNaN(n) && n > 0);
  const bestThree = amounts.slice().sort((a, b) => b - a).slice(0, 3);
  const average = bestThree.length
    ? bestThree.reduce((s, n) => s + n, 0) / bestThree.length
    : null;

  return {
    rows: records.map(t => [t.fy, fmtNrs(t.turnover)]),
    average: average != null ? fmtNrs(Math.round(average)) : '',
  };
}

// Section 4B → { premises, infra: {columns, rows}, occupations: [{ name, groups }] }
//
// Two independent sources: the firm's own service-delivery space, and the
// tools/equipment master list for each occupation being proposed. Tools are
// fetched by the caller (they need occupation id + level and this builder is
// synchronous) and handed over in opts.bolpatraTools, keyed by occupation id.
const TOOL_GROUPS = [
  { type: 'Safety Tool', label: 'Personal Protective Equipment' },
  { type: 'Tool',        label: 'Tools and equipment' },
  { type: 'Consumable',  label: 'Training Consumables' },
  { type: 'Stationery',  label: 'Stationery' },
];
const GROUP_LETTERS = ['A', 'B', 'C', 'D'];

/** One firm's service delivery space. */
function model4bInfra(inst) {
  return {
    premises: inst?.address
      ? `Office building with training halls at office premise, ${inst.address}`
      : '',
    columns: ['SN', 'Particular', 'Description', 'Size', 'Unit (Number)', 'Ownership', 'Remarks'],
    widths:  [600, 1900, 2400, 1300, 1200, 1100, 1466],
    rows: (inst?.infrastructure || [])
      .slice()
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((r, i) => [
        String(i + 1), dash(r.particular), dash(r.description),
        dash(r.size), dash(r.unit), dash(r.ownership), dash(r.remark),
      ]),
  };
}

/**
 * Tools and equipment for the selected occupations — shared across all firms,
 * since occupation_tools is master data keyed by occupation and level.
 *
 * Quantities are multiplied by the number of training events: the stored figure
 * is what one event consumes, so a bid running six events needs six times the
 * consumables.
 */
// Selectable columns, mirroring the Tools & Consumables report so the same
// choices are available in both places.
const TOOL_COLUMNS = [
  { key: 'sn',          label: 'S. No',                 width: 800  },
  { key: 'name',        label: 'Description',           width: 4000 },
  { key: 'description', label: 'Detail',                width: 2600 },
  { key: 'unit',        label: 'Unit',                  width: 1400 },
  { key: 'quantity',    label: 'Quantity',              width: 1400 },
  { key: 'ownership',   label: 'Ownership',             width: 1400 },
  { key: 'type',        label: 'Type',                  width: 1600 },
  { key: 'remarks',     label: 'Specification/Remarks', width: 2366 },
];
export const TOOL_COLUMN_OPTIONS = TOOL_COLUMNS.map(({ key, label }) => ({ key, label }));
/** The occupation_tools.type values, in the order 4(B) groups them. */
export const TOOL_TYPE_OPTIONS = TOOL_GROUPS.map(g => g.type);
export const DEFAULT_TOOL_COLS = ['sn', 'name', 'unit', 'quantity', 'remarks'];

function model4bTools(opts = {}) {
  const { selectedOccs = [], occupations = [], bolpatraTools = {},
          eoiEventsByOcc = {}, eoiToolCols = DEFAULT_TOOL_COLS, eoiToolTypes = [] } = opts;
  // One table holding every type, rather than a lettered sub-table per type.
  const singleTable = !!opts.eoiSingleTable;
  // Each occupation runs its own number of events, so quantities scale per
  // occupation rather than by one figure across the whole bid.
  const eventsFor = (occId) => Math.max(1, parseInt(eoiEventsByOcc[occId]) || 1);

  // Without the sub-table headings there is nothing left saying which rows are
  // consumables and which are safety gear, so the Type column carries it.
  const wantCol = (key) => eoiToolCols.includes(key) || (singleTable && key === 'type');
  const picked = TOOL_COLUMNS.filter(c => wantCol(c.key));
  const active = picked.length ? picked : TOOL_COLUMNS.filter(c => DEFAULT_TOOL_COLS.includes(c.key));

  // An empty type selection means every type — matching an "All types" default.
  const wantType = (t) => !eoiToolTypes.length || eoiToolTypes.includes(t);

  const wanted = selectedOccs.map(s => s.toLowerCase());
  const chosen = occupations.filter(o => wanted.includes(String(o.name).toLowerCase()));

  const cellFor = (t, key, i, events) => {
    if (key === 'sn') return String(i + 1);
    // Stored quantities are what one event consumes, so scale by that
    // occupation's event count.
    if (key === 'quantity') return t.quantity != null ? String(t.quantity * events) : '';
    if (key === 'name') return dash(t.name) || dash(t.description);
    return dash(t[key]);
  };

  // The combined path carries each item wrapped with its summed quantity, the
  // per-occupation path passes the tool straight through.
  const typeOf = (x) => (x && x.tool ? x.tool.type : x?.type);

  /**
   * Split into lettered sub-tables by type, or keep everything in one.
   *
   * @param items  in TOOL_GROUPS order when flattened, so a single table still
   *               reads safety → tools → consumables → stationery rather than
   *               whatever order the master list happens to be in.
   * @param rowFor (item, indexWithinTable) => cells
   */
  const groupsFor = (items, rowFor) => {
    const inGroup = (g) => items.filter(t => typeOf(t) === g.type);
    if (singleTable) {
      const ordered = TOOL_GROUPS.flatMap(inGroup);
      // Anything with an unrecognised type would vanish otherwise.
      const known = new Set(TOOL_GROUPS.map(g => g.type));
      ordered.push(...items.filter(t => !known.has(typeOf(t))));
      return ordered.length ? [{ letter: '', label: '', rows: ordered.map(rowFor) }] : [];
    }
    return TOOL_GROUPS
      .map(g => ({ label: g.label, rows: inGroup(g) }))
      .filter(g => g.rows.length)
      .map((g, gi) => ({
        letter: GROUP_LETTERS[gi] || String(gi + 1),
        label: g.label,
        rows: g.rows.map(rowFor),
      }));
  };

  const perOccupation = () => chosen.map(o => {
    const events = eventsFor(o.id);
    const items = (bolpatraTools[o.id] || []).filter(t => wantType(t.type));
    const groups = groupsFor(items, (t, i) => active.map(c => cellFor(t, c.key, i, events)));
    return { name: o.name, events, groups };
  });

  /**
   * One schedule for every selected occupation instead of a table each.
   *
   * The same drill appears under three trades, and a bid wants to know how many
   * drills in total — not to have the reader add up three tables. Identical
   * items merge and their quantities sum; each occupation's figure is scaled by
   * its own event count first, so a trade running six events contributes six
   * times, which a single total across the bid could not express.
   *
   * Two items count as the same only when name, description, unit and type all
   * match. A 12mm and a 16mm spanner are not one line.
   */
  const combined = () => {
    const merged = new Map();
    for (const o of chosen) {
      const events = eventsFor(o.id);
      for (const t of (bolpatraTools[o.id] || []).filter(t => wantType(t.type))) {
        const key = [t.name, t.description, t.unit, t.type]
          .map(v => String(v ?? '').trim().toLowerCase()).join('|');
        const qty = t.quantity != null ? Number(t.quantity) * events : null;
        const seen = merged.get(key);
        if (!seen) {
          merged.set(key, { tool: t, quantity: qty, occupations: [o.name] });
        } else {
          // A null quantity on either side means "not recorded"; adding a
          // number to it would invent one.
          seen.quantity = seen.quantity == null || qty == null
            ? (seen.quantity ?? qty)
            : seen.quantity + qty;
          if (!seen.occupations.includes(o.name)) seen.occupations.push(o.name);
        }
      }
    }

    // Quantities are already multiplied through, so events is 1 here.
    const groups = groupsFor([...merged.values()], (x, i) => active.map(c => c.key === 'quantity'
      ? (x.quantity != null ? String(x.quantity) : '')
      : cellFor(x.tool, c.key, i, 1)));

    return [{
      name: chosen.length === 1 ? chosen[0].name : 'All selected occupations',
      // Event counts differ per occupation and are already applied, so showing
      // one number here would be a lie.
      events: null,
      combinedFrom: chosen.map(o => o.name),
      groups,
    }];
  };

  return {
    level: opts.eoiToolsLevel || '',
    columns: active.map(c => c.label),
    widths:  active.map(c => c.width),
    combined: !!opts.eoiCombineTools,
    singleTable,
    occupations: opts.eoiCombineTools ? combined() : perOccupation(),
  };
}

// ─── On-screen rendering ─────────────────────────────────────────────────────

const TH = { background:'#dce6f1', border:'1px solid #8ba3bd', padding:'6px 8px',
             fontSize:11, fontWeight:600, textAlign:'left', color:'#111' };
const TD = { border:'1px solid #8ba3bd', padding:'6px 8px', fontSize:11,
             verticalAlign:'top', color:'var(--text1)' };

function GridTable({ model }) {
  if (!model.rows.length) {
    return <div style={{fontSize:12, color:'var(--text3)', padding:'8px 0'}}>No assignments in range.</div>;
  }
  return (
    <div style={{overflowX:'auto'}}>
      <table style={{borderCollapse:'collapse', width:'100%'}}>
        <thead><tr>{model.columns.map(c => <th key={c} style={TH}>{c}</th>)}</tr></thead>
        <tbody>
          {model.rows.map((row, i) => (
            <tr key={i}>{row.map((v, j) => <td key={j} style={TD}>{v || '—'}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Cell({ pairs }) {
  return (
    <td style={TD}>
      {pairs.map((p, i) => (
        <div key={i} style={{marginBottom: i < pairs.length - 1 ? 8 : 0}}>
          <span style={{color:'var(--text2)'}}>{p.label}:</span>{' '}
          {p.block
            ? <div style={{whiteSpace:'pre-wrap', marginTop:2}}>{p.value || '—'}</div>
            : <span style={{fontWeight:500}}>{p.value || '—'}</span>}
        </div>
      ))}
    </td>
  );
}

/**
 * 4(B) for the whole applicant: each firm's office setup in turn — lead first —
 * followed by a single occupation-wise tools list, since tools are master data
 * shared by every member of a joint venture.
 */
function Section4B({ firms, opts = {} }) {
  const tools = model4bTools(opts);
  const Plain = ({ columns, rows, empty }) => rows.length ? (
    <div style={{overflowX:'auto'}}>
      <table style={{borderCollapse:'collapse', width:'100%'}}>
        <thead><tr>{columns.map(c => <th key={c} style={TH}>{c}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => (
          <tr key={i}>{r.map((v, j) => <td key={j} style={TD}>{v || '—'}</td>)}</tr>
        ))}</tbody>
      </table>
    </div>
  ) : <div style={{fontSize:12, color:'var(--text3)', padding:'6px 0'}}>{empty}</div>;

  return (
    <div>
      {firms.map(({ inst }, fi) => {
        const infra = model4bInfra(inst);
        return (
          <div key={inst?.id ?? fi} style={{marginBottom:22}}>
            <div style={{fontWeight:700, fontSize:12.5, marginBottom:4}}>
              {firms.length > 1
                ? `${fi === 0 ? 'Lead firm' : 'JV partner'} — ${inst?.name || ''}: office setup`
                : 'Service Delivery Space'}
            </div>
            {infra.premises && <div style={{fontSize:12, marginBottom:8}}>{infra.premises}</div>}
            <Plain columns={infra.columns} rows={infra.rows}
              empty="No infrastructure recorded for this firm." />
          </div>
        );
      })}

      {/* No summary heading here: the level and event count are working
          parameters, not something a submitted bid should announce. Each
          occupation carries its own heading below. */}
      {tools.occupations.length === 0
        ? <div style={{fontSize:12, color:'var(--text3)'}}>
            Select one or more occupations to list their tools and equipment.
          </div>
        : tools.occupations.map(o => (
            <div key={o.name} style={{marginTop:16}}>
              <div style={{fontWeight:600, fontSize:12.5, marginBottom:6}}>
                Tools and Equipment for {o.name} Training
                {o.events > 1 && <span style={{fontWeight:400, color:'var(--text3)'}}> ({o.events} events)</span>}
                {/* Combined mode applies each occupation's own event count before
                    merging, so naming the sources is the only honest summary. */}
                {o.combinedFrom?.length > 1 && (
                  <span style={{fontWeight:400, color:'var(--text3)'}}> — combined from {o.combinedFrom.join(', ')}</span>
                )}
              </div>
              {o.groups.length === 0
                ? <div style={{fontSize:12, color:'var(--text3)'}}>
                    No tools recorded for this occupation at the selected level.
                  </div>
                : o.groups.map(g => (
                    <div key={g.letter || 'all'} style={{marginBottom:12}}>
                      {g.label && (
                        <div style={{fontSize:12, fontWeight:600, margin:'8px 0 4px'}}>
                          {g.letter}. {g.label}
                        </div>
                      )}
                      <Plain columns={tools.columns} rows={g.rows} empty="" />
                    </div>
                  ))}
            </div>
          ))}
    </div>
  );
}

function SectionBody({ section, inst, exps, clients, opts }) {
  if (section === '2') {
    return (
      <div>
        <ol style={{margin:'0 0 14px 22px', padding:0, fontSize:12}}>
          {model2(inst).map(item => (
            <li key={item.no} style={{marginBottom:10, paddingLeft:4, lineHeight:1.5}}>
              <span style={{color:'var(--text2)'}}>{item.label}:</span>{' '}
              <span style={{fontWeight:700, whiteSpace:'pre-wrap'}}>{item.value}</span>
            </li>
          ))}
        </ol>
        <div style={{fontSize:11.5, fontStyle:'italic', color:'var(--text3)'}}>{SECTION2_NOTE}</div>
      </div>
    );
  }

  if (section === '3a') return <GridTable model={model3a(exps, clients, inst)} />;
  if (section === '3c') return <GridTable model={model3c(exps)} />;

  if (section === '3b') {
    const items = model3b(specificExps(exps, opts), clients, inst);
    if (!items.length) return <div style={{fontSize:12, color:'var(--text3)'}}>No assignments in range.</div>;
    return (
      <div style={{display:'flex', flexDirection:'column', gap:22}}>
        {items.map((item, i) => (
          <div key={i}>
            <div style={{fontSize:12.5, marginBottom:6}}>{item.caption}</div>
            <table style={{borderCollapse:'collapse', width:'100%'}}>
              <tbody>
                {item.rows.map((row, r) => (
                  <tr key={r}>{row.map((cell, c) => <Cell key={c} pairs={cell} />)}</tr>
                ))}
                <tr>
                  <td style={TD} colSpan={2}>
                    <div style={{color:'var(--text2)'}}>{item.footer.label}:</div>
                    <div style={{fontWeight:600, margin:'4px 0'}}>{item.footer.note}</div>
                    <div style={{whiteSpace:'pre-wrap'}}>{item.footer.value || '—'}</div>
                  </td>
                </tr>
              </tbody>
            </table>
            {/* Outside the border, as printed on the form. The wrapper carries
                page-break-inside: avoid so it still cannot be stranded from its
                box across a page. */}
            <div style={{fontSize:12, marginTop:8}}>
              Firm&rsquo;s Name: <u>&nbsp;{inst?.name || ''}&nbsp;</u>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // 4(B) is rendered by Section4B, which spans every firm; SectionBody is only
  // reached for a single-firm document.
  if (section === '4b') return <Section4B firms={[{ inst }]} opts={opts} />;

  // 4a
  const m = model4a(inst, opts);
  return (
    <div>
      <table style={{borderCollapse:'collapse', width:'100%'}}>
        <thead>
          <tr><th style={{...TH, textAlign:'center'}} colSpan={2}>Annual Turnover</th></tr>
          <tr><th style={{...TH, textAlign:'center'}}>Year</th><th style={{...TH, textAlign:'center'}}>Amount Currency</th></tr>
        </thead>
        <tbody>
          {m.rows.length
            ? m.rows.map(([y, a], i) => (
                <tr key={i}><td style={TD}>{y}</td><td style={{...TD, textAlign:'right'}}>{a || '—'}</td></tr>
              ))
            : <tr><td style={TD} colSpan={2}>No turnover records in range.</td></tr>}
        </tbody>
      </table>
      {/* Dashed bullet + bold label on the left, tall bordered box on the right,
          its edges aligned to the turnover table above — as printed on the form. */}
      <div style={{display:'flex', alignItems:'stretch', marginTop:16}}>
        <div style={{flex:1, display:'flex', alignItems:'center', gap:10, paddingLeft:14}}>
          <span style={{color:'var(--text2)'}}>-</span>
          <span style={{fontWeight:700, fontSize:12.5}}>Average Annual Turnover</span>
        </div>
        <div style={{flex:1, border:'1px solid #8ba3bd', minHeight:62, display:'flex',
          alignItems:'center', justifyContent:'flex-end', padding:'8px 12px',
          fontSize:12.5, fontWeight:600}}>
          {m.average || ''}
        </div>
      </div>
      <div style={{fontSize:11.5, color:'var(--text2)', marginTop:12, fontStyle:'italic'}}>
        (Note: Supporting documents for Average Turnover should be submitted for the above.)
      </div>
    </div>
  );
}

function renderAggregateTable(inst, exps, clients, reportId, opts = {}) {
  const sections = sectionsFor(reportId);
  return (
    <div>
      <div style={{fontWeight:700, fontSize:14, marginBottom:4}}>{inst?.name || 'Firm'}</div>
      {inst?.acronym && <div style={{fontSize:11, color:'var(--text3)', marginBottom:14}}>{inst.acronym}</div>}
      {sections.map(s => (
        <div key={s} style={{marginBottom:26}}>
          {SECTION_TITLES[s].preHeading && (
            <div style={{fontWeight:700, fontSize:15, textAlign:'center', marginBottom:8}}>
              {SECTION_TITLES[s].preHeading}
            </div>
          )}
          <div style={{fontWeight:700, marginBottom:2,
            fontSize: SECTION_TITLES[s].centered ? 15 : 13,
            textAlign: SECTION_TITLES[s].centered ? 'center' : 'left'}}>{SECTION_TITLES[s].heading}</div>
          <div style={{fontSize:11, color:'var(--text3)', fontStyle:'italic', marginBottom:10}}>{SECTION_TITLES[s].note}</div>
          <SectionBody section={s} inst={inst} exps={exps} clients={clients} opts={opts} />
        </div>
      ))}
    </div>
  );
}

/**
 * On-screen multi-firm view, section-major: every firm's copy of a section is
 * grouped under that section before the next one begins. Mirrors the printed and
 * Word ordering so what is reviewed matches what is submitted.
 */
function renderMultiAggregate(firms, clients, reportId, opts = {}) {
  const sections = sectionsFor(reportId);
  return (
    <div>
      {sections.map(s => (
        <div key={s} style={{marginBottom:34}}>
          {SECTION_TITLES[s].preHeading && (
            <div style={{fontWeight:700, fontSize:16, textAlign:'center', marginBottom:8}}>
              {SECTION_TITLES[s].preHeading}
            </div>
          )}
          <div style={{fontWeight:700, marginBottom:2,
            fontSize: SECTION_TITLES[s].centered ? 16 : 14,
            textAlign: SECTION_TITLES[s].centered ? 'center' : 'left'}}>{SECTION_TITLES[s].heading}</div>
          <div style={{fontSize:11, color:'var(--text3)', fontStyle:'italic', marginBottom:14}}>{SECTION_TITLES[s].note}</div>
          {FIRM_SPANNING.has(s)
            ? <Section4B firms={firms} opts={opts} />
            : firms.map(({ inst, exps }, fi) => (
                <div key={inst?.id ?? fi} style={{
                  marginBottom:18, paddingLeft:14,
                  borderLeft:'3px solid var(--border)',
                }}>
                  <div style={{fontWeight:700, fontSize:12.5, marginBottom:10}}>
                    {firmLabel(inst, fi, firms.length)}
                  </div>
                  <SectionBody section={s} inst={inst} exps={exps} clients={clients} opts={opts} />
                </div>
              ))}
        </div>
      ))}
    </div>
  );
}

// ─── Print / PDF ─────────────────────────────────────────────────────────────

const htmlGrid = (model) => `
  <table>
    <thead><tr>${model.columns.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
    <tbody>${model.rows.length
      ? model.rows.map(r => `<tr>${r.map(v => `<td>${esc(v) || '&mdash;'}</td>`).join('')}</tr>`).join('')
      : `<tr><td colspan="${model.columns.length}">No assignments in range.</td></tr>`}</tbody>
  </table>`;

const htmlCell = (pairs) => `<td>${pairs.map(p =>
  `<div class="pair"><span class="lbl">${esc(p.label)}:</span> ${
    p.block ? `<div class="block">${esc(p.value) || '&mdash;'}</div>` : `<b>${esc(p.value) || '&mdash;'}</b>`
  }</div>`).join('')}</td>`;

const htmlGridPlain = (columns, rows, empty) => rows.length ? `
  <table>
    <thead><tr>${columns.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r => `<tr>${r.map(v => `<td>${esc(v) || '&mdash;'}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>` : (empty ? `<p class="muted">${esc(empty)}</p>` : '');

/** 4(B): every firm's office setup, then one shared tools list. */
function html4B(firms, opts = {}) {
  const tools = model4bTools(opts);
  const offices = firms.map(({ inst }, fi) => {
    const infra = model4bInfra(inst);
    const heading = firms.length > 1
      ? `${fi === 0 ? 'Lead firm' : 'JV partner'} — ${inst?.name || ''}: office setup`
      : 'Service Delivery Space';
    return `
      <div class="office-block">
        <div class="sub-h">${esc(heading)}</div>
        ${infra.premises ? `<p class="premises">${esc(infra.premises)}</p>` : ''}
        ${htmlGridPlain(infra.columns, infra.rows, 'No infrastructure recorded for this firm.')}
      </div>`;
  }).join('');

  const occHtml = tools.occupations.length === 0
    ? `<p class="muted">Select one or more occupations to list their tools and equipment.</p>`
    : tools.occupations.map(o => `
        <div class="tool-block">
          <div class="grp">Tools and Equipment for ${esc(o.name)} Training${o.events > 1 ? ` (${o.events} events)` : ''}${
            o.combinedFrom && o.combinedFrom.length > 1 ? ` — combined from ${esc(o.combinedFrom.join(', '))}` : ''}</div>
          ${o.groups.length === 0
            ? `<p class="muted">No tools recorded for this occupation at the selected level.</p>`
            : o.groups.map(g => `
                ${g.label ? `<div class="grp">${esc(g.letter)}. ${esc(g.label)}</div>` : ''}
                ${htmlGridPlain(tools.columns, g.rows, '')}`).join('')}
        </div>`).join('');

  return `${offices}${occHtml}`;
}

function htmlSection(section, inst, exps, clients, opts) {
  if (section === '2') {
    // The form prints this as a plain numbered list — no table, no rules.
    return `<ol class="info">${model2(inst).map(it => `
      <li><span class="lbl">${esc(it.label)}:</span> <span class="val">${esc(it.value)}</span></li>`).join('')}
      </ol><p class="note-i">${esc(SECTION2_NOTE)}</p>`;
  }
  if (section === '3a') return htmlGrid(model3a(exps, clients, inst));
  if (section === '3c') return htmlGrid(model3c(exps));

  if (section === '3b') {
    const items = model3b(specificExps(exps, opts), clients, inst);
    if (!items.length) return `<p class="muted">No assignments in range.</p>`;
    return items.map(item => `
      <div class="spec">
        <div class="caption">${esc(item.caption)}</div>
        <table>
          ${item.rows.map(row => `<tr>${row.map(htmlCell).join('')}</tr>`).join('')}
          <tr><td colspan="2">
            <div class="lbl">${esc(item.footer.label)}:</div>
            <div class="note">${esc(item.footer.note)}</div>
            <div class="block">${esc(item.footer.value) || '&mdash;'}</div>
          </td></tr>
        </table>
        <div class="firm-line">Firm&rsquo;s Name: <u>&nbsp;${esc(inst?.name || '')}&nbsp;</u></div>
      </div>`).join('');
  }

  // 4(B) spans every firm — see html4B; this path is the single-firm case.
  if (section === '4b') return html4B([{ inst }], opts);

  const m = model4a(inst, opts);
  return `
    <table class="turnover">
      <thead>
        <tr><th colspan="2" class="ctr">Annual Turnover</th></tr>
        <tr><th class="ctr">Year</th><th class="ctr">Amount Currency</th></tr>
      </thead>
      <tbody>${m.rows.length
        ? m.rows.map(([y, a]) => `<tr><td>${esc(y)}</td><td class="rt">${esc(a) || '&mdash;'}</td></tr>`).join('')
        : `<tr><td colspan="2">No turnover records in range.</td></tr>`}</tbody>
    </table>
    <div class="avg">
      <div class="avg-label"><span class="dash">-</span><b>Average Annual Turnover</b></div>
      <div class="avg-box">${esc(m.average)}</div>
    </div>
    <p class="note-i">(Note: Supporting documents for Average Turnover should be submitted for the above.)</p>`;
}

const printShell = (title, bodyHtml) => `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>${esc(title)}</title>
<style>
  @page { size: A4; margin: 18mm; }
  /* The print window is a bare document: without an explicit light scheme a
     dark-mode browser renders this black-on-black before it ever reaches paper. */
  :root { color-scheme: light; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px;
         color: #000; background: #fff; margin: 0; }
  .doc-head { text-align: center; font-style: italic; font-weight: bold; font-size: 12px; margin-bottom: 14px; }
  .firm { font-size: 13px; font-weight: 700; margin: 10px 0 12px; }
  .firm-sub { font-size: 11px; color: #555; margin-bottom: 14px; }
  .section { margin-bottom: 22px; page-break-inside: auto; }
  h2 { font-size: 13px; margin: 0 0 2px; }
  h2.h2-center { text-align: center; font-size: 15px; margin-bottom: 6px; }
  .sub { font-size: 11px; font-style: italic; color: #444; margin: 0 0 8px; }
  table { border-collapse: collapse; width: 100%; table-layout: fixed; }
  th, td { border: 1px solid #000; padding: 5px 7px; vertical-align: top;
           font-size: 11px; word-wrap: break-word; overflow-wrap: break-word; }
  th { font-weight: bold; text-align: left; }
  .ctr { text-align: center; } .rt { text-align: right; }
  .info { margin: 0 0 14px 22px; padding: 0; }
  .info li { margin-bottom: 12px; padding-left: 4px; line-height: 1.5; }
  .info .val { white-space: pre-wrap; font-weight: bold; }
  .cap-head { text-align: center; font-weight: bold; font-size: 14px; margin-bottom: 12px; }
  .spec { margin-bottom: 18px; page-break-inside: avoid; }
  .caption { font-size: 12px; margin-bottom: 5px; }
  /* Sits inside the table so it cannot be split from its box across a page,
     but is borderless so it reads as a line printed beneath the box. */
  .firm-line { font-size: 12px; margin-top: 8px; }
  .pair { margin-bottom: 6px; }
  .pair:last-child { margin-bottom: 0; }
  .lbl { color: #222; }
  .block { white-space: pre-wrap; margin-top: 2px; }
  .note { font-weight: bold; margin: 3px 0; }
  .note-i { font-style: italic; font-size: 10.5px; color: #444; }
  .turnover { width: 100%; }
  /* Label left, tall bordered box right, aligned to the turnover table's edges. */
  .avg { display: flex; align-items: stretch; margin-top: 14px; width: 100%; }
  .avg-label { flex: 1; display: flex; align-items: center; gap: 10px; padding-left: 14px; }
  .dash { font-weight: normal; }
  .avg-box { flex: 1; border: 1px solid #000; min-height: 52px; padding: 6px 10px;
             display: flex; align-items: center; justify-content: flex-end; font-weight: bold; }
  .muted { color: #666; }
  .premises { font-size: 12px; margin: 0 0 10px; }
  .sub-h { font-weight: bold; font-size: 12px; margin: 12px 0 6px; }
  .grp { font-weight: bold; font-size: 11.5px; margin: 10px 0 4px; }
  .tool-block { margin-top: 16px; page-break-inside: auto; }
  .office-block { margin-bottom: 18px; }
  .page-break { page-break-before: always; }
  @media print { body { margin: 0; } }
</style></head><body>
  ${bodyHtml}
</body></html>`;

/** One section for one firm, as a print block. */
const printBlock = (s, inst, exps, clients, opts, heading) => `
    <div class="section">
      <div class="doc-head">Standard EOI Document</div>
      ${SECTION_TITLES[s].preHeading ? `<div class="cap-head">${esc(SECTION_TITLES[s].preHeading)}</div>` : ''}
      <h2 class="${SECTION_TITLES[s].centered ? 'h2-center' : ''}">${esc(SECTION_TITLES[s].heading)}</h2>
      <p class="sub">${esc(SECTION_TITLES[s].note)}</p>
      ${heading ? `<div class="firm">${esc(heading)}</div>` : ''}
      ${htmlSection(s, inst, exps, clients, opts)}
    </div>`;

function buildPrintHTML(inst, exps, clients, reportId, fyRange, opts = {}) {
  const body = sectionsFor(reportId)
    .map(s => printBlock(s, inst, exps, clients, opts, inst?.name || ''))
    .join('');
  return printShell(`Standard EOI Document — ${inst?.name || ''}`, body);
}

/**
 * Multi-firm print, section-major: all firms' copies of a section are grouped
 * before the next section starts, each firm's copy on its own page. Matches the
 * Word export, so the review view and the submitted document agree.
 */
function buildMultiPrintHTML(firms, clients, reportId, fyRange, opts = {}) {
  const blocks = [];
  sectionsFor(reportId).forEach(s => {
    if (FIRM_SPANNING.has(s)) {
      // One block covering every firm, rather than one page per member.
      blocks.push(`
    <div class="section">
      <div class="doc-head">Standard EOI Document</div>
      ${SECTION_TITLES[s].preHeading ? `<div class="cap-head">${esc(SECTION_TITLES[s].preHeading)}</div>` : ''}
      <h2 class="${SECTION_TITLES[s].centered ? 'h2-center' : ''}">${esc(SECTION_TITLES[s].heading)}</h2>
      <p class="sub">${esc(SECTION_TITLES[s].note)}</p>
      ${html4B(firms, opts)}
    </div>`);
      return;
    }
    firms.forEach(({ inst, exps }, fi) => {
      blocks.push(printBlock(s, inst, exps, clients, opts, firmLabel(inst, fi, firms.length)));
    });
  });
  const body = blocks.join('<div class="page-break"></div>');
  const who = firms.length === 1 ? (firms[0].inst?.name || '') : `${firms.length} firms`;
  return printShell(`Standard EOI Document — ${who}`, body);
}

// ─── CSV (only reachable if a report is ever made non-aggregate) ─────────────

function buildCSVRow(exp, clients, reportId, i) {
  const clientName = clientNameOf(exp, clients);
  const location = locationOf(exp);

  if (reportId === '3c') return {
    'No': i + 1,
    'Name of the Project': exp.assignmentName || '',
    'Location (Country/Region)': `${exp.country || 'Nepal'}${location ? ` — ${location}` : ''}`,
    'Execution Year and Duration': `${exp.fy || ''}${exp.durationMonths ? ` (${exp.durationMonths} months)` : ''}`,
  };

  return {
    'S.N.': i + 1,
    'Name of assignment': exp.assignmentName || '',
    'Location': location,
    'Value of Contract': exp.contractValue || '',
    'Year Completed': exp.endFY || exp.fy || '',
    'Client': clientName,
    'Description of work carried out': exp.descriptionOfWork || '',
  };
}

// ─── Word (.docx) ────────────────────────────────────────────────────────────

const DXA_MM = 56.6929;
const PAGE_W = Math.round(210 * DXA_MM);   // A4
const PAGE_H = Math.round(297 * DXA_MM);
const MARGIN = Math.round(18 * DXA_MM);
const CONTENT_W = PAGE_W - MARGIN * 2;     // ≈ 9866
const HALF = Math.round(CONTENT_W / 2);

// Section 3A/3C widths are authored against a 9638 grid; rescale to the real
// content width so the columns always fill the page exactly.
const scaleWidths = (widths) => {
  const total = widths.reduce((s, w) => s + w, 0);
  const out = widths.map(w => Math.round((w / total) * CONTENT_W));
  out[out.length - 1] += CONTENT_W - out.reduce((s, w) => s + w, 0);
  return out;
};

function docxKit(D) {
  const { Paragraph, TextRun, TableCell, WidthType, VerticalAlign, BorderStyle, ShadingType } = D;
  const B = { style: BorderStyle.SINGLE, size: 6, color: '000000' };
  const BORDERS = { top: B, bottom: B, left: B, right: B };
  // `borders: undefined` tells docx to use its default, which is a full single
  // border — the opposite of what's wanted. Suppressing one needs saying so.
  const N = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const NO_BORDERS = { top: N, bottom: N, left: N, right: N };

  const p = (text, o = {}) => new Paragraph({
    alignment: o.align,
    spacing: o.spacing,
    keepNext: o.keepNext,
    children: [new TextRun({
      text: String(text ?? ''), bold: !!o.bold, italics: !!o.italic,
      size: o.size || 19, font: 'Arial', underline: o.underline ? {} : undefined,
    })],
  });

  // Multi-line strings must become one Paragraph per line — "\n" inside a TextRun
  // is dropped by Word.
  const lines = (text, o = {}) => {
    const arr = String(text ?? '').split('\n');
    return arr.length && arr.some(Boolean) ? arr.map(l => p(l, o)) : [p('', o)];
  };

  const cell = (children, o = {}) => new TableCell({
    columnSpan: o.colspan,
    width: { size: o.width || HALF, type: WidthType.DXA },
    borders: o.noBorder ? NO_BORDERS : BORDERS,
    shading: o.shade ? { fill: o.shade, type: ShadingType.CLEAR } : undefined,
    verticalAlign: VerticalAlign.TOP,
    margins: { top: 60, bottom: 60, left: 110, right: 110 },
    children: Array.isArray(children) ? children : [children],
  });

  return { p, lines, cell, BORDERS };
}

/** 4(B) for Word: every firm's office setup, then one shared tools list. */
function docx4B(D, kit, firms, opts = {}) {
  const { Table, TableRow, WidthType } = D;
  const { p, lines, cell } = kit;
  const out = [];

  const grid = (columns, widths, dataRows) => {
    const w = scaleWidths(widths);
    const head = new TableRow({
      tableHeader: true,
      children: columns.map((c, i) => cell(p(c, { bold: true }), { width: w[i] })),
    });
    const body = dataRows.map(r => new TableRow({
      children: r.map((v, i) => cell(lines(v || '—'), { width: w[i] })),
    }));
    return new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: w, rows: [head, ...body] });
  };

  firms.forEach(({ inst }, fi) => {
    const infra = model4bInfra(inst);
    const heading = firms.length > 1
      ? `${fi === 0 ? 'Lead firm' : 'JV partner'} — ${inst?.name || ''}: office setup`
      : 'Service Delivery Space';
    out.push(p(heading, { bold: true, spacing: { before: fi === 0 ? 60 : 240, after: 80 } }));
    if (infra.premises) out.push(p(infra.premises, { spacing: { after: 100 } }));
    if (infra.rows.length) out.push(grid(infra.columns, infra.widths, infra.rows));
    else out.push(p('No infrastructure recorded for this firm.', { italic: true }));
  });

  const tools = model4bTools(opts);
  if (!tools.occupations.length) {
    out.push(p('Select one or more occupations to list their tools and equipment.', { italic: true }));
    return out;
  }

  tools.occupations.forEach(o => {
    out.push(p(`Tools and Equipment for ${o.name} Training`
      + (o.events > 1 ? ` (${o.events} events)` : '')
      + (o.combinedFrom && o.combinedFrom.length > 1
          ? ` — combined from ${o.combinedFrom.join(', ')}` : ''),
      { bold: true, spacing: { before: 260, after: 80 } }));
    if (!o.groups.length) {
      out.push(p('No tools recorded for this occupation at the selected level.', { italic: true }));
      return;
    }
    o.groups.forEach(g => {
      if (g.label) out.push(p(`${g.letter}. ${g.label}`, { bold: true, spacing: { before: 140, after: 60 } }));
      out.push(grid(tools.columns, tools.widths, g.rows));
    });
  });
  return out;
}

function docxSection(D, kit, section, inst, exps, clients, opts) {
  const { Table, TableRow, WidthType, AlignmentType, HeightRule } = D;
  const { p, lines, cell } = kit;
  const out = [];

  if (section === '2') {
    // Numbered list, matching the form — not a table.
    model2(inst).forEach(it => {
      out.push(new D.Paragraph({
        numbering: { reference: 'eoi-info', level: 0 },
        spacing: { after: 140 },
        children: [
          new D.TextRun({ text: `${it.label}: `, size: 19, font: 'Arial' }),
          new D.TextRun({ text: String(it.value ?? ''), size: 19, font: 'Arial', bold: true }),
        ],
      }));
    });
    out.push(p(SECTION2_NOTE, { italic: true, size: 18, spacing: { before: 160 } }));
    return out;
  }

  if (section === '3a' || section === '3c') {
    const m = section === '3a' ? model3a(exps, clients, inst) : model3c(exps);
    const w = scaleWidths(m.widths);
    const header = new TableRow({
      tableHeader: true,
      children: m.columns.map((c, i) => cell(p(c, { bold: true }), { width: w[i] })),
    });
    const body = m.rows.length
      ? m.rows.map(r => new TableRow({ children: r.map((v, i) => cell(lines(v || '—'), { width: w[i] })) }))
      : [new TableRow({ children: [cell(p('No assignments in range.'), { colspan: m.columns.length, width: CONTENT_W })] })];
    out.push(new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: w, rows: [header, ...body] }));
    return out;
  }

  if (section === '3b') {
    const items = model3b(specificExps(exps, opts), clients, inst);
    if (!items.length) { out.push(p('No assignments in range.')); return out; }
    items.forEach((item, idx) => {
      // Caption sits above and outside the bordered table.
      out.push(p(item.caption, { spacing: { before: idx === 0 ? 0 : 240, after: 80 }, size: 20 }));

      const rows = item.rows.map(row => new TableRow({
        children: row.map(pairs => cell(
          pairs.flatMap(pr => [p(`${pr.label}:`), ...lines(pr.value || '—', { bold: !pr.block })]),
          { width: HALF }
        )),
      }));

      rows.push(new TableRow({ children: [cell([
        p(`${item.footer.label}:`, { keepNext: true }),
        p(item.footer.note, { bold: true, keepNext: true }),
        ...lines(item.footer.value || '—').map(par => par),
      ], { colspan: 2, width: CONTENT_W })] }));

      out.push(new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: [HALF, HALF], rows }));
      // Outside the table, as printed on the form. keepNext on the preceding
      // paragraphs binds the table's last row to this line, so a tall box
      // running to the foot of a page takes the firm name with it rather than
      // stranding it at the top of the next.
      out.push(p(`Firm's Name: ${inst?.name || ''}`, { spacing: { before: 80 }, size: 20 }));
    });
    return out;
  }

  // 4(B) spans every firm — see docx4B; this path is the single-firm case.
  if (section === '4b') return docx4B(D, kit, [{ inst }], opts);

  // 4a
  const m = model4a(inst, opts);
  const half = Math.round(CONTENT_W / 2);
  const w4 = [half, half];
  const t4w = half * 2;
  const rows = [
    new TableRow({ children: [cell(p('Annual Turnover', { bold: true, align: AlignmentType.CENTER }),
      { colspan: 2, width: t4w, shade: 'D9D9D9' })] }),
    new TableRow({ children: [
      cell(p('Year', { bold: true, align: AlignmentType.CENTER }), { width: half }),
      cell(p('Amount Currency', { bold: true, align: AlignmentType.CENTER }), { width: half }),
    ]}),
  ];
  if (m.rows.length) {
    m.rows.forEach(([y, a]) => rows.push(new TableRow({ children: [
      cell(p(y), { width: half }),
      cell(p(a || '—', { align: AlignmentType.RIGHT }), { width: half }),
    ]})));
  } else {
    rows.push(new TableRow({ children: [cell(p('No turnover records in range.'), { colspan: 2, width: t4w })] }));
  }
  out.push(new Table({ width: { size: t4w, type: WidthType.DXA }, columnWidths: w4, rows }));
  out.push(p(''));
  // Dashed bullet + bold label on the left with no border, tall bordered box on
  // the right, both aligned to the turnover table above — as printed on the form.
  out.push(new Table({
    width: { size: t4w, type: WidthType.DXA }, columnWidths: w4,
    rows: [new TableRow({
      height: { value: 900, rule: HeightRule.ATLEAST },
      children: [
        cell(p('-\tAverage Annual Turnover', { bold: true }), { width: half, noBorder: true }),
        cell(p(m.average || '', { align: AlignmentType.RIGHT }), { width: half }),
      ],
    })],
  }));
  out.push(p('(Note: Supporting documents for Average Turnover should be submitted for the above.)',
    { italic: true, size: 17, spacing: { before: 100 } }));
  return out;
}

/**
 * Word export for one or more firms.
 * @param firms [{ inst, exps }] — one entry per selected institute
 */
async function downloadMultiDOCX(firms, clients, reportId, opts = {}) {
  const D = await loadDocx();
  const { Document, Packer, Paragraph, TextRun, AlignmentType, PageOrientation } = D;
  const { saveAs } = await loadFileSaver();
  const kit = docxKit(D);
  const { p } = kit;

  const sections = sectionsFor(reportId);
  const children = [];
  let first = true;

  // Section-major: every firm's copy of a section is grouped together before the
  // next section starts, each on its own page. The form is filled separately per
  // constituent member, so an evaluator reads all the firms' section 2, then all
  // their 3(A), and so on — not one firm's whole document followed by the next's.
  sections.forEach(s => {
    if (FIRM_SPANNING.has(s)) {
      if (!first) children.push(new Paragraph({ pageBreakBefore: true, children: [new TextRun({ text: '', size: 19 })] }));
      first = false;
      children.push(p('Standard EOI Document', { bold: true, italic: true, align: AlignmentType.CENTER, size: 22 }));
      if (SECTION_TITLES[s].preHeading) {
        children.push(p(SECTION_TITLES[s].preHeading, { bold: true, size: 24,
          align: AlignmentType.CENTER, spacing: { before: 200, after: 120 } }));
      }
      children.push(p(SECTION_TITLES[s].heading, { bold: true,
        size: SECTION_TITLES[s].centered ? 26 : 22,
        align: SECTION_TITLES[s].centered ? AlignmentType.CENTER : undefined,
        spacing: { before: 200, after: 40 } }));
      children.push(p(SECTION_TITLES[s].note, { italic: true, size: 17, spacing: { after: 140 } }));
      children.push(...docx4B(D, kit, firms, opts));
      return;
    }
    firms.forEach(({ inst, exps }, fi) => {
      if (!first) children.push(new Paragraph({ pageBreakBefore: true, children: [new TextRun({ text: '', size: 19 })] }));
      first = false;

      children.push(p('Standard EOI Document', { bold: true, italic: true, align: AlignmentType.CENTER, size: 22 }));
      if (SECTION_TITLES[s].preHeading) {
        children.push(p(SECTION_TITLES[s].preHeading, { bold: true, size: 24,
          align: AlignmentType.CENTER, spacing: { before: 200, after: 120 } }));
      }
      children.push(p(SECTION_TITLES[s].heading, { bold: true,
        size: SECTION_TITLES[s].centered ? 26 : 22,
        align: SECTION_TITLES[s].centered ? AlignmentType.CENTER : undefined,
        spacing: { before: 200, after: 40 } }));
      children.push(p(SECTION_TITLES[s].note, { italic: true, size: 17, spacing: { after: 140 } }));
      children.push(p(firmLabel(inst, fi, firms.length), { bold: true, size: 22, spacing: { after: 140 } }));
      children.push(...docxSection(D, kit, s, inst, exps, clients, opts));
    });
  });

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 19 } } } },
    // Word needs an explicit numbering definition; a bare `numbering` reference
    // on a paragraph renders unnumbered without one.
    numbering: {
      config: [{
        reference: 'eoi-info',
        levels: [{
          level: 0,
          format: D.LevelFormat.DECIMAL,
          text: '%1.',
          alignment: D.AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 460, hanging: 320 } } },
        }],
      }],
    },
    sections: [{
      properties: {
        page: {
          size: { width: PAGE_W, height: PAGE_H, orientation: PageOrientation.PORTRAIT },
          margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
        },
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const label = (REPORTS.find(r => r.id === reportId) || {}).label || 'EOI';
  const who = firms.length === 1
    ? (firms[0].inst?.acronym || firms[0].inst?.name || 'firm')
    : `${firms.length}_firms`;
  const safe = (s) => String(s).replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '');
  saveAs(blob, `Bolpatra_${safe(label)}_${safe(who)}.docx`);
}

// Single-institute entry point, kept so the family also works if a report is
// ever switched to non-aggregate (ReportsView calls this signature).
async function downloadDOCX(fullInst, activeExps, reportId, opts = {}) {
  return downloadMultiDOCX([{ inst: fullInst, exps: activeExps }], opts.clients || [], reportId, opts);
}

const bolpatra = {
  id: 'bolpatra',
  label: 'Bolpatra (Standard EOI)',
  multiInstitute: true,
  // The EOI is configured before it is built, so the controls read as a setup
  // step across the top rather than a sidebar beside a document that is not
  // there yet — and the assembled A4 pages get the full page width.
  filtersOnTop: true,
  // Receive assignments filtered only by FY. Occupation and duration are applied
  // here instead, so they narrow 3(B) Specific Experience without also stripping
  // rows out of 3(A) General Work Experience.
  selfFilters: true,
  reports: REPORTS,
  renderAggregateTable,
  buildPrintHTML,
  buildCSVRow,
  downloadDOCX,
  downloadMultiDOCX,
  // Section-major multi-firm variants. ReportsView prefers these when several
  // firms are selected; without them it would concatenate one whole document per
  // firm, which is the wrong order for a joint-venture submission.
  renderMultiAggregate,
  buildMultiPrintHTML,
};

export default bolpatra;
export { model3b, captionOf };

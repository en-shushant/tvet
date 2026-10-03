import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { buildPrintHTML, cvModel } from '../src/reports/cv.jsx';
import { withLeadTemplates } from '../src/reports/bolpatra.jsx';
const require = createRequire(import.meta.url);
const { pickFirmVariant, priorWorkOf } = require('../backend/routes/tenders.js');

const person = { id: 1, full_name: 'Sita Karki', person_type: 'Trainer', phone: '9841000001', email: 's@x.np',
  date_of_birth: '2045/03/12', citizenship_no: '27-01-75/1234', permanent_address: 'Tokha-10, Kathmandu', nationality: 'Nepali' };
const cv = {
  person, proposed_position: 'Main Trainer', detailed_tasks: '• Deliver the tailoring course', adequacy: '• Trained 120 youths for CTEVT',
  education: [{ title: 'Level 2 — Tailor', institution: 'Sanothimi Centre', board: 'NSTB', passed_year: '2072', specialisation: 'Garment' }],
  trainings: [{ title: 'Training of Trainers', institution: 'Training Institute for Technical Instruction', duration_days: 21, start_date_ad: '2019-07-17', end_date_ad: '2019-08-06' }],
  experience: [{ organisation: 'KGTC', position: 'Instructor', from_date: '2073', is_current: true, employment_type: 'Full time',
    country: 'Bagmati, Kathmandu', reference_text: 'Ram, 9851000000', description: '• Taught Level 1 batches' }],
  languages: [{ language: 'Nepali', speaking: 'Excellent' }],
};
const tender = { title: 'Skill training for youths', institute_name: 'WLTTI + IC (JV)', institute_contact: 'Thakur Subedi' };
const html = (format) => buildPrintHTML({ tender, format, cvs: [cv] });

describe('CV formats', () => {
  it('PPMO EOI (Form 3) uses the form’s own rows and columns', () => {
    const h = html('ppmo_eoi');
    for (const t of ['Name of Training Provider', 'Phone/Mobile No. of Staff', 'Years with TP', 'Membership in Professional Societies',
      'Institute/School/College', 'Year of Completion', 'Duration and Position', 'Major Tasks Performed', 'Duration and Date', 'Seal of the Training provider'])
      expect(h).toContain(t);
    expect(h).toContain('21 days, 2019-07-17 to 2019-08-06');
  });
  it('PPMO RFP carries Adequacy for the Assignment: tasks beside prior work', () => {
    const h = html('ppmo_rfp');
    expect(h).toContain('Adequacy for the Assignment');
    expect(h).toContain('Reference to Prior Work/Assignments that Best Illustrates Capability');
    expect(h).toContain('Deliver the tailoring course');
    expect(h).toContain('Trained 120 youths for CTEVT');
    expect(h).toContain('Skill training for youths');       // certification (vi) names the project
    expect(cvModel('ppmo_rfp', cv, tender).certList).toHaveLength(7);
  });
  it('Helvetas asks for citizenship, permanent address and a Province/Palika location', () => {
    const h = html('helvetas');
    for (const t of ['Citizenship Number', '27-01-75/1234', 'Permanent Address', 'Location (Province/Palika)',
      'Major Subjects', 'Passed out year', 'Job title: Instructor (Full time)', 'Contact of Employer: Ram, 9851000000'])
      expect(h).toContain(t);
  });
  it('names the bidding entity — the JV — as the firm', () => {
    expect(html('helvetas')).toContain('WLTTI + IC (JV)');
  });
  it('keeps the old Form 5 when no format is given', () => {
    expect(buildPrintHTML({ tender, cvs: [cv] })).toContain('Detailed Tasks Assigned');
  });
});

describe('firm-wise CV wording', () => {
  const v = (id, institute_id, field, position, person_type) => ({ id, institute_id, field, position, person_type, body: '' });
  const lib = [v(1, 10, 'adequacy', 'Main Trainer'), v(2, 10, 'adequacy', null, 'Trainer'), v(3, 10, 'adequacy'),
    v(4, 20, 'adequacy', 'Main Trainer'), v(5, null, 'adequacy', 'Main Trainer')];
  it('takes the firm’s wording for the post, then for the kind of person, then its general one', () => {
    expect(pickFirmVariant(lib, 'adequacy', 10, 'main trainer', 'Trainer').id).toBe(1);
    expect(pickFirmVariant(lib, 'adequacy', 10, 'Co-Trainer', 'Trainer').id).toBe(2);
    expect(pickFirmVariant(lib, 'adequacy', 10, 'Co-Trainer', 'Support Staff').id).toBe(3);
  });
  it('never another firm’s wording; a firm with none gets a shared variation', () => {
    expect(pickFirmVariant(lib, 'adequacy', 30, 'Main Trainer', 'Trainer').id).toBe(5);
    expect(pickFirmVariant(lib, 'adequacy', 30, 'Accountant', 'Support Staff')).toBeNull();
  });
  it('spreads shared variations across firms and jobs', () => {
    const shared = [1, 2, 3].map(id => ({ id, institute_id: null, field: 'activities', position: 'Main Trainer', body: '' }));
    const pick = (inst, turn) => pickFirmVariant(shared, 'activities', inst, 'Main Trainer', 'Trainer', turn).id;
    expect(new Set([pick(10, 0), pick(11, 0), pick(12, 0)]).size).toBe(3);
    expect(pick(10, 0)).not.toBe(pick(10, 1));
  });
  it('falls back to the person’s own jobs as prior work', () => {
    expect(priorWorkOf(cv.experience)).toBe('• Instructor, KGTC (2073 – present)');
  });
});

describe('a joint venture uses its lead’s experience templates', () => {
  const lead = { id: 1, descTemplateId: 'd-lead', narrativeTemplateId: 'n-lead', servicesTemplateId: '' };
  const partner = { id: 2, descTemplateId: 'd-own', narrativeTemplateId: 'n-own', servicesTemplateId: 's-own' };
  it('swaps in the lead’s choice, keeping the partner’s own where the lead set none', () => {
    const firms = [{ inst: lead }, { inst: partner }];
    expect(withLeadTemplates(partner, firms)).toMatchObject({ id: 2, descTemplateId: 'd-lead', narrativeTemplateId: 'n-lead', servicesTemplateId: 's-own' });
    expect(withLeadTemplates(lead, firms)).toBe(lead);
    expect(withLeadTemplates(partner, [{ inst: partner }])).toBe(partner);
  });
});

describe('events a job can claim', async () => {
  const { maxEvents, eventsFor, eventsLine } = require('../backend/lib/cvWording.js');
  const fe = await import('../src/components/pool/common.js');
  const { dropUnfilled } = require('../backend/routes/tenders.js');
  it('is at most four a year: Mar 2019 to Mar 2026 (BS 2075/12 → 2082/12) is 28', () => {
    expect(maxEvents({ from_date: '2075/12/01', to_date: '2082/12/01' })).toBe(28);
    expect(fe.maxEvents({ from_date: '2075/12/01', to_date: '2082/12/01' })).toBe(28);
    expect(maxEvents({ from_date: '2075', to_date: '2076' })).toBe(4);
  });
  it('caps what is saved and leaves a blank blank', () => {
    expect(eventsFor({ from_date: '2075', to_date: '2076', events_count: '9' })).toBe(4);
    expect(eventsFor({ from_date: '2075', to_date: '2076', events_count: '3' })).toBe(3);
    expect(eventsFor({ from_date: '2075', events_count: '' })).toBeNull();
  });
  it('opens the job’s activities with the count and the clients', () => {
    expect(eventsLine({ events_count: 28, clients: 'CTEVT, HELVETAS' })).toBe('• Conducted 28 training events for CTEVT, HELVETAS.');
    expect(eventsLine({})).toBe('');
    expect(eventsLine({ events_count: 15, clients: 'HELVETAS' }, 'Supported')).toBe('• Supported 15 training events for HELVETAS.');
  });
  it('drops a line whose placeholder had nothing to fill', () => {
    expect(dropUnfilled('• Conducted {events} events for {clients}\n• Holds TOT')).toBe('• Holds TOT');
  });
});

describe('starter wording for every post', () => {
  const { POSTS, POST_SEED, toDuty } = require('../backend/lib/cvWordingPosts.js');
  const { SEED } = require('../backend/lib/cvWording.js');
  it('covers the eleven posts, with unique labels', () => {
    expect(new Set(SEED.map(v => v.label)).size).toBe(SEED.length);
    expect(POSTS.length).toBe(10);
  });
  it('never puts a post’s whole list in one variation, and the variations differ', () => {
    for (const p of POSTS) {
      const acts = POST_SEED.filter(v => v.label.startsWith(`${p.post} — activities`));
      expect(acts).toHaveLength(4);
      for (const a of acts) expect(a.body.split('\n').length).toBeLessThan(p.items.length);
      expect(new Set(acts.map(a => a.body)).size).toBe(4);
    }
  });
  it('turns a record of work into duties for the tasks section', () => {
    expect(toDuty('Developed, standardized, and distributed M&E data collection instruments.'))
      .toBe('Develop, standardize, and distribute M&E data collection instruments.');
    expect(toDuty('Assessed and selected training venues, verifying the setup.')).toBe('Assess and select training venues, verifying the setup.');
  });
  it('matches a post by any of its names', () => {
    const v = POST_SEED.find(x => x.label === 'Monitoring Officer — activities A');
    expect(pickFirmVariant([{ ...v, id: 1, institute_id: null }], 'activities', 7, 'm&e officer', 'Support Staff').id).toBe(1);
  });
});

describe('a required post picks its CV wording', async () => {
  const { guessRole, CV_ROLES } = await import('../src/components/tenders/common.js');
  const { readFileSync } = await import('node:fs');
  it('guesses the role from a title the notice uses', () => {
    expect(guessRole('M&E Officer')).toBe('Monitoring Officer');
    expect(guessRole('accountant')).toBe('Finance Officer');
    expect(guessRole('Senior Instructor – Tailoring')).toBe('');
    expect(guessRole('Graphic Designer', ['Graphic Designer'])).toBe('Graphic Designer');
  });
  it('offers the same posts the starter wording is written for', () => {
    const { POSTS } = require('../backend/lib/cvWordingPosts.js');
    for (const p of POSTS) expect(CV_ROLES.some(r => r[0] === p.post)).toBe(true);
  });
  it('is stored on the post, carried to the next stage, and matched before the title', () => {
    const t = readFileSync('backend/routes/tenders.js', 'utf8');
    expect(t).toMatch(/education_options=\$10, task_role=\$11/);
    expect(t.match(/pos\.task_role \|\| null/g)).toHaveLength(2);
    expect(t).toMatch(/tp\.task_role \|\| vars\.position/);
  });
});

describe('a team member’s time with the firm and with other firms', async () => {
  const { readFileSync } = await import('node:fs');
  const t = readFileSync('backend/routes/tenders.js', 'utf8');
  it('is saved with the proposal and carried to the next stage and to copies', () => {
    expect(t).toMatch(/joining_date, joined_institute_id, firm_experience, joining_clients, joining_events\)\n\s+VALUES/);
    expect(t.match(/joining_date, joined_institute_id, firm_experience, joining_clients, joining_events\n/g)).toHaveLength(2);
  });
  it('caps another firm’s events like any job and drops a row with no firm', () => {
    expect(t).toMatch(/filter\(r => r && \(parseInt\(r\.institute_id, 10\) \|\| String\(r\.org_name \|\| ''\)\.trim\(\)\)\)/);
    expect(t).toMatch(/events_count: eventsFor\(/);
  });
  it('lists the bidding firm, other firms and pool jobs together, newest first', () => {
    expect(t).toMatch(/\[\.\.\.withFirm, \.\.\.otherFirms\]\.map\(countFromAssignments\)\.concat\(forPerson\(exp\.rows, tp\.person_id\)\)/);
    expect(t).toMatch(/years \(since \$\{tp\.joining_date\}\)/);
  });
});

describe('which firms get a generated experience letter', async () => {
  const { readFileSync } = await import('node:fs');
  const t = readFileSync('backend/routes/tenders.js', 'utf8');
  it('the bidding firm and companies typed by hand — not firms already in the list', () => {
    expect(t).toMatch(/experience\.filter\(e => \(e\.biddingFirm && firmById\.has\(e\.institute_id\)\) \|\| e\.manualFirm\)/);
  });
});

describe('one event per assignment', () => {
  const { assignmentSpan } = require('../backend/routes/tenders.js');
  it('takes an assignment’s contract dates, else its fiscal years (Shrawan to Asar)', () => {
    expect(assignmentSpan({ start_date: '2079/05/01', end_date: '2079/09/30' }, 0)).toEqual([2079 * 12 + 4, 2079 * 12 + 8]);
    expect(assignmentSpan({ fiscal_year: '2079/80' }, 0)).toEqual([2079 * 12 + 3, 2080 * 12 + 2]);
    expect(assignmentSpan({ start_fy: '2078/79', end_fy: '2080/81' }, 0)).toEqual([2078 * 12 + 3, 2081 * 12 + 2]);
    expect(assignmentSpan({ fiscal_year: '2082/83', is_ongoing: true }, 99999)[1]).toBe(99999);
  });
});

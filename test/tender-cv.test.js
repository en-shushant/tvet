/**
 * Tenders, and the CV pack they produce.
 *
 * Two things here are easy to get wrong and expensive to get wrong.
 *
 * The CV is a prescribed form — the EOI's Form 5 — and a submission is judged
 * against it section by section. Dropping "Membership in Professional Societies"
 * or renaming "Employment Record" is not a cosmetic slip; it is a document that
 * does not match what was asked for.
 *
 * And the two prose sections are per firm. The pool is organisation-wide, so the
 * same trainer is put forward by more than one firm, and each words the tasks
 * its own way. Resolution runs server-side precisely so the preview, the print
 * sheet and the Word file cannot disagree about which wording won.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { buildPrintHTML, personalRows, lines, period } from '../src/reports/cv.jsx';

const require = createRequire(import.meta.url);
const { applyVars } = require('../backend/routes/tenders.js');
const read = (p) => readFileSync(path.resolve(import.meta.dirname, '..', p), 'utf8');

/**
 * The tender screen, as one text.
 *
 * It is a list plus five step files under components/tenders; these checks
 * are about what the screen does, not which file a line happens to live in.
 */
const readTenderUI = () => ['src/components/TendersView.jsx',
  ...readdirSync(path.resolve(import.meta.dirname, '..', 'src/components/tenders'))
    .filter(f => /\.jsx?$/.test(f)).map(f => `src/components/tenders/${f}`)]
  .map(read).join('\n');


const person = {
  id: 1, full_name: 'Amruta Devi Bishwokarma', person_type: 'Trainer',
  phone: '9841283699', email: 'amrutabk226@gmail.com', profession: 'Beautician',
  date_of_birth: '1982/12/20', nationality: 'Nepali', years_with_entity: '8 Years',
  professional_memberships: '', key_qualifications: 'Her own default write-up.',
};
const pack = {
  tender: {
    title: 'Short-term skill training', institute_name: 'Gulf International Technical Training Institute Pvt. Ltd.',
    institute_contact: 'Dipesh Pyakurel', authorized_rep: '',
  },
  cvs: [{
    person, proposed_position: 'Main Trainer', occupation_name: 'Beautician',
    detailed_tasks: '• Prepare lesson plan.\n• Deliver training.',
    key_qualifications: 'Conducted more than 22 events of Beautician training.',
    education: [{ title: 'Level-II', specialisation: 'Beautician', institution: 'CTEVT', passed_year: '2021' }],
    trainings: [{ title: 'TOT', institution: 'TITI', duration_text: '10 Days, 2015' }],
    experience: [{ organisation: 'Gulf International', position: 'Trainer', from_date: '2016',
      is_current: true, country: 'Nepal/Kathmandu', project_name: 'EVENT', reference_text: 'Dipesh, 985…',
      description: '• Develop lesson plan.' }],
    languages: [{ language: 'English', speaking: 'Good', reading: 'Good', writing: 'Good' }],
  }],
};

const html = buildPrintHTML(pack);
const strip = (s) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

describe('the CV follows Form 5', () => {
  it('carries all seven numbered sections in order', () => {
    const found = [...html.matchAll(/<span class="num">([IVX]+)\.<\/span>\s*([^<]+)</g)]
      .map(m => `${m[1]}. ${m[2].trim()}`);
    expect(found).toEqual([
      'I. Detailed Tasks Assigned', 'II. Key Qualifications', 'III. Education',
      'IV. Training Received', 'V. Employment Record', 'VI. Language Skills', 'VII. Certification',
    ]);
  });

  it('asks the personal table for every row the form prints', () => {
    const labels = personalRows(pack.cvs[0], pack.tender).map(([k]) => k);
    for (const row of ['Proposed Position', 'Name of Consultant', 'Name of Staff', 'Profession',
                       'Date of Birth', 'Years with Consultant/Entity', 'Nationality',
                       'Membership in Professional Societies']) {
      expect(labels, row).toContain(row);
    }
  });

  it('omits contact rows the form only shows when they exist', () => {
    // The support-staff variant of the form has no contact rows at all, so an
    // empty one must not print as a blank line.
    const without = personalRows({ ...pack.cvs[0], person: { ...person, phone: '', email: '' } }, pack.tender)
      .map(([k]) => k);
    expect(without).not.toContain('Contact (Mobile Number)');
    expect(without).not.toContain('Email');
  });

  it('shows N/A for an unrecorded society membership, as the form does', () => {
    const rows = Object.fromEntries(personalRows(pack.cvs[0], pack.tender));
    expect(rows['Membership in Professional Societies']).toBe('N/A');
  });

  it('names the bidding firm as Name of Consultant', () => {
    const rows = Object.fromEntries(personalRows(pack.cvs[0], pack.tender));
    expect(rows['Name of Consultant']).toBe(pack.tender.institute_name);
  });

  it('prints the certification wording and both signature names', () => {
    expect(strip(html)).toContain('I, the undersigned, certify that to the best of my knowledge');
    expect(strip(html)).toContain('Full name of staff member: Amruta Devi Bishwokarma');
    // Falls back to the firm's contact when the tender names no representative.
    expect(strip(html)).toContain('Full name of authorised representative: Dipesh Pyakurel');
  });

  it('keeps the form’s own column headings', () => {
    const text = strip(html);
    for (const h of ['Degree(s) / Diploma(s) obtained', 'Specialised education',
                     'Subject of training', 'Duration and date', 'Period and position',
                     'Summary of activities performed relevant to the assignment',
                     'Language', 'Speaking', 'Reading', 'Writing']) {
      expect(text, h).toContain(h);
    }
  });

  it('starts each CV on its own page', () => {
    const two = buildPrintHTML({ ...pack, cvs: [pack.cvs[0], pack.cvs[0]] });
    expect((two.match(/page-break-before/g) || []).length).toBe(1);
  });

  it('titles a support staff CV differently from a professional one', () => {
    const support = buildPrintHTML({ ...pack,
      cvs: [{ ...pack.cvs[0], person: { ...person, person_type: 'Support Staff' } }] });
    expect(support).toContain('for Proposed Support Staff');
    expect(html).toContain('for Proposed Professional Staff');
  });

  it('says so rather than printing an empty table when a section has nothing', () => {
    const bare = buildPrintHTML({ ...pack,
      cvs: [{ ...pack.cvs[0], education: [], trainings: [], experience: [], languages: [] }] });
    expect((bare.match(/Not recorded\./g) || []).length).toBeGreaterThanOrEqual(4);
  });
});

describe('formatting helpers', () => {
  it('turns one-task-per-line into bullets', () => {
    expect(lines('• A\n\n• B')).toEqual(['• A', '• B']);
    expect(html).toContain('<li>Prepare lesson plan.</li>');
  });

  it('reads an ongoing post as running to date', () => {
    expect(period({ from_date: '2016', is_current: true })).toBe('2016 to till date');
    expect(period({ from_date: '2016', to_date: '2020' })).toBe('2016 to 2020');
    expect(period({})).toBe('—');
  });
});

describe('per-firm wording', () => {
  it('fills the firm and occupation into a variant', () => {
    expect(applyVars('Training for {occupation} at {firm}.',
      { occupation: 'Beautician', firm: 'GITTI' })).toBe('Training for Beautician at GITTI.');
  });

  it('leaves an unknown placeholder visible rather than blanking it', () => {
    // A typo should show up in the draft, not silently eat the sentence.
    expect(applyVars('Led by {postion}.', { position: 'Main Trainer' })).toBe('Led by {postion}.');
  });

  it('leaves a placeholder alone when its value is empty', () => {
    expect(applyVars('At {firm}.', { firm: '' })).toBe('At {firm}.');
  });

  it('resolves bid text, then the firm variant, then the person', () => {
    const route = read('backend/routes/tenders.js');
    const resolve = route.slice(route.indexOf('const resolve ='), route.indexOf('return {', route.indexOf('const resolve =')));
    expect(resolve).toMatch(/if \(\(own \|\| ''\)\.trim\(\)\) return own/);
    expect(resolve).toMatch(/applyVars\(v\.body, vars\)/);
    expect(resolve).toMatch(/return fallback/);
  });

  it('is resolved on the server so the three outputs cannot disagree', () => {
    const cvSource = read('src/reports/cv.jsx');
    // The renderer must not re-derive it.
    expect(cvSource).not.toMatch(/tasks_variant_id|quals_variant_id/);
    expect(cvSource).toMatch(/cv\.detailed_tasks/);
  });

  it('only ever offers a firm its own wording plus the shared library', () => {
    const route = read('backend/routes/tenders.js');
    const list = route.slice(route.indexOf("fastify.get('/cv-variants'"), route.indexOf("fastify.post('/cv-variants'"));
    expect(list).toMatch(/institute_id IS NULL OR institute_id = \$/);
  });
});

describe('access', () => {
  it('is the same grant as the pool, since a tender names the people on it', () => {
    const route = read('backend/routes/tenders.js');
    expect(route).toMatch(/fastify\.addHook\('preHandler', requireHRAccess\)/);
  });

  it('hides the screen from anyone without the grant', () => {
    const app = read('src/App.jsx');
    expect(app).toMatch(/\{id:'tenders'[^}]*hrOnly: true\}/);
    expect(app).toMatch(/screen === 'tenders' && canAccessHr/);
  });
});

describe('the handoff to the report builder', () => {
  const reports = read('src/components/ReportsView.jsx');

  it('waits for the firm list before consuming the context', () => {
    // takeTenderContext clears as it reads, so running against an empty list
    // would swallow the handoff with nothing left to retry from.
    const block = reports.slice(reports.indexOf('const ctx = takeTenderContext') - 400,
                               reports.indexOf('setFromTender(ctx)'));
    expect(block).toMatch(/if \(!institutes\?\.length\) return;/);
  });

  it('puts the firm where the chosen family actually looks for it', () => {
    // A Bolpatra EOI can be a joint venture, so its picker reads fwInstIds;
    // Bagmati takes one firm in selectedInst. Setting only the latter left the
    // EOI builder looking ready with no firm ticked.
    const block = reports.slice(reports.indexOf('const targetFamily'), reports.indexOf('setFromTender(ctx)'));
    expect(block).toMatch(/multiInstitute/);
    expect(block).toMatch(/setFwInstIds\(all\)/);
    expect(block).toMatch(/setSelectedInst\(lead\)/);
  });

  it('takes the id from the firm list so the comparison matches', () => {
    // fwInstIds.includes(i.id) is strict; a stringified id counts towards the
    // tab badge and still leaves every checkbox unticked.
    const block = reports.slice(reports.indexOf('const targetFamily'), reports.indexOf('setFromTender(ctx)'));
    expect(block).toMatch(/institutes\.find\(i => String\(i\.id\) === String\(v\)\)/);
    expect(block).toMatch(/const lead = resolve\(ctx\.instituteId\)/);
  });
});

describe('several bids per firm per fiscal year', () => {
  const route = read('backend/routes/tenders.js');
  const server = read('backend/server.js');
  const view = readTenderUI();

  it('is not constrained anywhere', () => {
    // A firm bids repeatedly within one year. Nothing may make (firm, FY) a key.
    const table = server.slice(server.indexOf('CREATE TABLE IF NOT EXISTS tenders'),
                               server.indexOf('CREATE TABLE IF NOT EXISTS tender_occupations'));
    expect(table).not.toMatch(/UNIQUE[^)]*institute_id/);
    expect(table).not.toMatch(/UNIQUE[^)]*\bfy\b/);
  });

  it('can be narrowed to one firm, one year, one stage', () => {
    // Without these the list is the whole history, every time. The firm filter
    // reaches through the bidders, since a firm is on a notice only by bidding
    // — alone or in a joint venture.
    const list = route.slice(route.indexOf("fastify.get('/', async"), route.indexOf("fastify.get('/:id'"));
    expect(list).toMatch(/bf\.institute_id = \$/);
    expect(list).toMatch(/t\.fy = \$/);
    expect(list).toMatch(/t\.stage = \$/);
  });

  it('offers those filters on the screen, not just in the API', () => {
    expect(view).toMatch(/p\.set\('institute_id', firmFilter\)/);
    expect(view).toMatch(/p\.set\('fy', fyFilter\)/);
    expect(view).toMatch(/Every firm/);
    expect(view).toMatch(/Every FY/);
  });

  it('shows the year in the list, since a firm has several', () => {
    expect(view).toMatch(/root\.fy && `FY \$\{root\.fy\}`/);
  });

  it('is indexed on what the list is read by', () => {
    // The firm moved to its own table, so the pair index went with it.
    expect(server).toMatch(/idx_tenders_fy ON tenders\(fy\)/);
    expect(server).toMatch(/idx_tender_firms_inst ON tender_firms\(institute_id\)/);
  });
});

describe('proposing the same person twice', () => {
  const route = read('backend/routes/tenders.js');
  const server = read('backend/server.js');

  it('cannot slip past the unique constraint through a NULL occupation', () => {
    // Postgres treats NULLs as distinct, so UNIQUE (tender, person, occupation)
    // let the same person in twice with no occupation named — and their CV was
    // printed twice in the pack. COALESCE gives the absent value something to
    // collide on.
    expect(server).toMatch(/idx_tender_people_unique[\s\S]*COALESCE\(occupation_id, 0\)/);
  });

  it('is also collapsed before the insert, so sort order stays sane', () => {
    const save = route.slice(route.indexOf('const saveChildren'), route.indexOf("fastify.post('/'"));
    expect(save).toMatch(/\$\{p\.person_id\}:\$\{p\.occupation_id \|\| 0\}/);
  });

  it('lets the insert defer to any unique constraint, not one named it knows', () => {
    // Targeting the named constraint skipped the expression index entirely.
    const save = route.slice(route.indexOf('const saveChildren'), route.indexOf("fastify.post('/'"));
    expect(save).toMatch(/ON CONFLICT DO NOTHING/);
    expect(save).not.toMatch(/ON CONFLICT \(tender_id, person_id, occupation_id\)/);
  });
});

describe('a bid moves through stages', () => {
  const route = read('backend/routes/tenders.js');
  const server = read('backend/server.js');
  const view = readTenderUI();
  const advance = route.slice(route.indexOf("fastify.post('/:id/advance'"), route.length);

  it('records each stage as its own submission', () => {
    // WLTTI + Client 1 + EOI 1 becomes RFP 1. Flipping a `stage` column in
    // place would overwrite the EOI's reference and deadline the day it
    // progressed, and the pack actually submitted could not be rebuilt.
    expect(server).toMatch(/ALTER TABLE tenders ADD COLUMN IF NOT EXISTS parent_tender_id/);
    expect(advance).toMatch(/INSERT INTO tenders/);
    expect(advance).not.toMatch(/UPDATE tenders SET stage/);
  });

  it('keeps EOI 1 → RFP 1 apart from EOI 2 → RFP 2', () => {
    // The link is per stage, so two bids by the same firm for the same client
    // do not merge into one chain: the new row points at the stage it came
    // from, not at the firm or the client.
    const columns = advance.slice(advance.indexOf('INSERT INTO tenders'), advance.indexOf('RETURNING *'));
    expect(columns).toMatch(/parent_tender_id/);
    // The value bound to it is the stage being advanced from — the values array
    // sits after RETURNING, so this reads the whole handler.
    expect(advance).toMatch(/from\.id,/);
    // and the chain is read back by that same link
    expect(route).toMatch(/parent_tender_id = \$1/);
  });

  it('carries the work forward but not the new notice’s own details', () => {
    // The team and the trades are the starting point at RFP stage. A reference
    // number or deadline copied from the EOI would be wrong and look right.
    expect(advance).toMatch(/INSERT INTO tender_occupations[\s\S]*SELECT \$1, occupation_id/);
    expect(advance).toMatch(/INSERT INTO tender_people[\s\S]*proposed_position/);
    const insert = advance.slice(advance.indexOf('INSERT INTO tenders'), advance.indexOf('RETURNING *'));
    expect(insert).not.toMatch(/reference_no/);
    expect(insert).not.toMatch(/submission_date/);
  });

  it('starts the new stage as Preparing rather than inheriting a status', () => {
    expect(advance).toMatch(/'Preparing'/);
  });

  it('carries the per-firm wording with each proposal', () => {
    // Otherwise the RFP CVs silently revert to the person's own default.
    expect(advance).toMatch(/tasks_variant_id, quals_variant_id/);
  });

  it('runs as one transaction', () => {
    // A new stage with none of its team is worse than no new stage.
    expect(advance).toMatch(/BEGIN/);
    expect(advance).toMatch(/ROLLBACK/);
    expect(advance).toMatch(/COMMIT/);
  });

  it('reads the chain both ways', () => {
    const detail = route.slice(route.indexOf("fastify.get('/:id'"), route.indexOf('const saveChildren'));
    expect(detail).toMatch(/came_from/);
    expect(detail).toMatch(/led_to/);
  });

  it('drops the meaningless combined stage', () => {
    // With stages as separate rows, a single record being "Both" cannot be true.
    expect(view).toMatch(/const STAGES = \['EOI', 'RFP'\]/);
  });

  it('offers the progression only from an EOI', () => {
    expect(view).toMatch(/const isEOI = tender\.stage === 'EOI'/);
    const after = view.slice(view.indexOf('After the shortlist') - 300, view.indexOf('After the shortlist'));
    expect(after).toMatch(/\{isEOI && \(/);
  });

  it('is taken only once somebody is actually shortlisted', () => {
    // Offering it with nobody marked sends an unrecorded shortlist to RFP.
    expect(view).toMatch(/disabled=\{busy \|\| !shortlisted\.length\} onClick=\{onAdvance\}/);
    expect(view).toMatch(/Mark a bidder Shortlisted above first/);
  });

  it('says what the progression will and will not copy', () => {
    const confirmText = view.slice(view.indexOf('Take this EOI to RFP?'), view.indexOf("confirmLabel: 'Create the RFP stage'"));
    expect(confirmText).toMatch(/carrying over.*the client, the trades, the posts and each team/s);
    expect(confirmText).toMatch(/reference number, dates and weights are not copied/s);
  });

  it('shows a bid as one row, with its stages, rather than two look-alike rows', () => {
    // An EOI and the RFP that followed are the same bid at two moments.
    const list = view.slice(view.indexOf('const rows = useMemo'), view.indexOf('}, [tenders]);'));
    expect(list).toMatch(/!t\.parent_tender_id \|\| !here\.has\(t\.parent_tender_id\)/);
    expect(list).toMatch(/childrenOf/);
    expect(view).toMatch(/chain\.map\(\(s, i\) =>/);
  });

  it('shows the lineage inside a bid too', () => {
    expect(view).toMatch(/const stageChain = \[/);
    expect(view).toMatch(/tender\.came_from/);
    expect(view).toMatch(/tender\.led_to/);
  });
});

describe('what a tender notice actually states', () => {
  const route = read('backend/routes/tenders.js');
  const server = read('backend/server.js');
  const view = readTenderUI();

  it('records the cover-page details', () => {
    // Title of consulting service, project name, method, office address and
    // funding agency all sit on page 1 of a Request for EOI.
    for (const col of ['project_name', 'method', 'office_address', 'funding_agency']) {
      expect(server, col).toMatch(new RegExp(`ADD COLUMN IF NOT EXISTS ${col}`));
      expect(route, col).toMatch(new RegExp(`'${col}'`));
    }
  });

  it('records how the bid will be scored', () => {
    // "Qualification 40%, Experience 50%, Capacity 10%" with a pass mark — the
    // notice saying where the effort belongs is worth more than a notes field.
    for (const col of ['weight_qualification', 'weight_experience', 'weight_capacity', 'minimum_score']) {
      expect(server, col).toMatch(new RegExp(`ADD COLUMN IF NOT EXISTS ${col} NUMERIC`));
    }
  });

  it('keeps an unstated weight unknown rather than zero', () => {
    // A notice that says nothing about capacity has not scored it at 0.
    expect(route).toMatch(/const numOrNull = \(v\) =>/);
    expect(route).toMatch(/\? null : Number\(v\)/);
  });

  it('records the deadline’s time, not only its date', () => {
    // "on or before 17-03-2026 12:00" — the half that gets missed.
    expect(server).toMatch(/ADD COLUMN IF NOT EXISTS submission_time/);
    expect(view).toMatch(/Deadline time/);
  });

  it('stores dates as the notice prints them, without converting', () => {
    // e-GP notices are AD while the firm's fiscal year is BS. Guessing which
    // calendar a typed date meant is worse than keeping the notice's own form.
    expect(server).toMatch(/Dates are free text and stored as the notice prints them/);
    expect(view).toMatch(/nothing here is converted/);
    expect(view).toMatch(/26-02-2026/);
  });

  it('records whether consultants may associate', () => {
    expect(server).toMatch(/ADD COLUMN IF NOT EXISTS association_allowed BOOLEAN DEFAULT TRUE/);
    expect(route).toMatch(/b\.association_allowed !== false/);
  });

  it('flags weights that do not come to 100', () => {
    expect(view).toMatch(/come to \{weightTotal\}%, not 100%/);
  });

  it('checks that total only once a weight is entered', () => {
    // An untouched notice section is not a notice scoring everything at zero.
    const block = view.slice(view.indexOf('const weightTotal'), view.indexOf('const save = async'));
    expect(block).toMatch(/if \(!vals\.length\) return null/);
  });

  it('keeps the scoring in view on every step, not only in the notice form', () => {
    // The weights say where the effort belongs — the question every later step
    // is answering — so they sit in the header rather than behind a disclosure.
    expect(view).toMatch(/Scored on \{scoring\(tender\)\}/);
    expect(view).toMatch(/pass mark \$\{t\.minimum_score\}/);
    expect(view).toMatch(/no joint ventures/);
  });

  it('carries the opportunity to the RFP but not that notice’s own terms', () => {
    // The RFP is scored separately and has its own reference and deadline. A
    // weight or date copied from the EOI would be wrong and look right.
    const advance = route.slice(route.indexOf("fastify.post('/:id/advance'"));
    const insert = advance.slice(advance.indexOf('INSERT INTO tenders'), advance.indexOf('RETURNING *'));
    for (const carried of ['project_name', 'method', 'office_address', 'funding_agency',
                           'submission_portal', 'client_website', 'association_allowed']) {
      expect(insert, carried).toMatch(new RegExp(carried));
    }
    for (const reset of ['weight_experience', 'minimum_score', 'submission_time', 'document_deadline']) {
      expect(insert, reset).not.toMatch(new RegExp(reset));
    }
  });
});

describe('an employer that is not in the client list yet', () => {
  const clientsRoute = read('backend/routes/clients.js');
  const view = readTenderUI();

  it('can simply be typed, and the bid keeps the name', () => {
    // A notice often comes from an office nobody has bid to before. Demanding
    // a master record first would block creating the tender at all.
    expect(view).toMatch(/Employer \/ office \(typed\)/);
    expect(view).toMatch(/Typing it is fine/);
  });

  it('can be added to the client list without leaving the tender', () => {
    // The second typing is where the spelling drifts, so the common case must
    // not need a trip to Master Data.
    expect(view).toMatch(/\+ Add to client list/);
    expect(view).toMatch(/function NewClientModal/);
    expect(view).toMatch(/api\('POST', '\/clients'/);
  });

  it('is selected straight away, with the typed copy dropped', () => {
    // Keeping both would leave the bid reading as unlinked even though the
    // client now exists.
    expect(view).toMatch(/client_id: created\.id, client_name_manual: ''/);
  });

  it('becomes selectable at once rather than after a reload', () => {
    expect(view).toMatch(/setClientList\(list => \[\.\.\.list, norm\]/);
  });

  it('shows up in the unlinked-names reconciliation if left typed', () => {
    // Tenders were missing from this list, so a typed employer there would
    // never have surfaced for tidying.
    const refs = clientsRoute.slice(clientsRoute.indexOf('const CLIENT_REFS = ['),
                                    clientsRoute.indexOf('];', clientsRoute.indexOf('const CLIENT_REFS')));
    expect(refs).toMatch(/\{ table: 'tenders',\s+manual: 'client_name_manual' \}/);
  });

  it('is repointed when two clients are merged', () => {
    // Same omission, other half: a merge would have left tenders pointing at
    // the deactivated copy.
    const merge = clientsRoute.slice(clientsRoute.indexOf("fastify.post('/merge'"));
    expect(merge).toMatch(/for \(const r of await existingRefs\(\)\)/);
  });
});

describe('a tender is answered by bidders, not by firms', () => {
  const route = read('backend/routes/tenders.js');
  const server = read('backend/server.js');
  const view = readTenderUI();

  it('holds no firm of its own', () => {
    // The notice is published before anyone decides who answers it.
    expect(server).toMatch(/ALTER TABLE tenders DROP COLUMN IF EXISTS institute_id/);
    const fields = route.slice(route.indexOf('const TENDER_FIELDS'), route.indexOf('];', route.indexOf('const TENDER_FIELDS')));
    expect(fields).not.toMatch(/'institute_id'/);
  });

  it('separates a joint venture from two rivals', () => {
    // WLTTI alone, UTTE alone, and CHRA + IC together are three bidders and
    // four firms. A flat firm list could not say which were bidding together.
    expect(server).toMatch(/CREATE TABLE IF NOT EXISTS tender_bidders/);
    expect(server).toMatch(/CREATE TABLE IF NOT EXISTS tender_bidder_firms/);
    expect(server).toMatch(/DROP TABLE IF EXISTS tender_firms/);
  });

  it('names a bidder after its firms unless one is given', () => {
    expect(route).toMatch(/names\.length === 1 \? names\[0\] : `\$\{names\.join\(' \+ '\)\} \(JV\)`/);
  });

  it('gives each bidder its own outcome', () => {
    // They are judged separately: one shortlisted, the others not.
    expect(server).toMatch(/CREATE TABLE IF NOT EXISTS tender_bidders[\s\S]*status\s+TEXT DEFAULT 'Preparing'/);
    expect(view).toMatch(/const BIDDER_STATUSES = \[[^\]]*'Shortlisted'/);
  });

  it('asks for the bidding entity up front, not firm by firm', () => {
    // Whether two firms are rivals or partners is easier to state than to fix.
    expect(view).toMatch(/function AddBidder/);
    expect(view).toMatch(/Add as a joint venture/);
  });
});

describe('each bidder proposes its own team', () => {
  const route = read('backend/routes/tenders.js');
  const server = read('backend/server.js');

  it('keys proposed staff to a bidder', () => {
    expect(server).toMatch(/ALTER TABLE tender_people ADD COLUMN IF NOT EXISTS bidder_id/);
    expect(server).toMatch(/idx_tender_people_unique[\s\S]*COALESCE\(bidder_id, 0\)/);
  });

  it('replaces one bidder’s team without touching the others', () => {
    const save = route.slice(route.indexOf('const saveTenderPeople'), route.indexOf("fastify.post('/'"));
    expect(save).toMatch(/const scope = body\.people_bidder_id/);
    expect(save).toMatch(/DELETE FROM tender_people WHERE tender_id = \$1 AND bidder_id = \$2/);
  });

  it('updates bidders in place so editing one keeps the others’ staff', () => {
    // Replacing the whole list would cascade every bidder's people away.
    const save = route.slice(route.indexOf('if (body.bidders)'), route.indexOf('const saveTenderPeople'));
    expect(save).toMatch(/UPDATE tender_bidders SET/);
    expect(save).toMatch(/id <> ALL\(\$2::int\[\]\)/);
  });
});

describe('documents are one bidder’s submission', () => {
  const route = read('backend/routes/tenders.js');
  const view = readTenderUI();
  const cvRoute = route.slice(route.indexOf("fastify.get('/:id/cv'"));

  it('refuses to build a CV pack without naming the bidder', () => {
    expect(cvRoute).toMatch(/bidder_id required/);
    expect(cvRoute).toMatch(/That bidder is not on this tender/);
  });

  it('names the joint venture as Name of Consultant, not just the lead', () => {
    // Naming only the lead would misdescribe who is being proposed to.
    expect(cvRoute).toMatch(/institute_name: shaped\.display_name/);
    // but a JV signs through its lead
    expect(cvRoute).toMatch(/institute_contact: leadInst\?\.contact_person/);
  });

  it('draws the team from that bidder alone', () => {
    expect(cvRoute).toMatch(/tp\.tender_id = \$1 AND tp\.bidder_id = \$2/);
  });

  it('opens the RFP on an EOI only for a shortlisted bidder', () => {
    // A proposal is invited from a bidder that got through the EOI.
    expect(view).toMatch(/const rfpOpen = \(b\) => !isEOI \|\| b\.status === 'Shortlisted'/);
    expect(view).toMatch(/disabled=\{!rfpOpen\(b\)\}/);
    expect(view).toMatch(/Opens once this bidder is marked Shortlisted/);
  });

  it('keeps the RFP open on the RFP stage itself', () => {
    // Carried bidders start there as Preparing. Demanding the Shortlisted mark
    // again locked the very document the stage exists for.
    const rule = view.slice(view.indexOf('const rfpOpen'), view.indexOf('const rfpOpen') + 80);
    expect(rule).toMatch(/!isEOI \|\|/);
  });

  it('carries only shortlisted bidders into the RFP stage', () => {
    const advance = route.slice(route.indexOf("fastify.post('/:id/advance'"));
    expect(advance).toMatch(/status = 'Shortlisted'/);
    // ...but does not produce an empty stage when nothing was marked
    expect(advance).toMatch(/short\.length[\s\S]*\? \{ rows: short \}/);
  });

  it('hands a joint venture’s whole membership to the report builder', () => {
    const reports = read('src/components/ReportsView.jsx');
    expect(view).toMatch(/instituteIds: firms\.map\(f => f\.institute_id\)/);
    expect(reports).toMatch(/setFwInstIds\(all\)/);
    expect(reports).toMatch(/setFwLeadId\(lead\)/);
  });
});

describe('the steps run in the order the work does', () => {
  const view = readTenderUI();
  const tender = (over = {}) => ({ id: 1, stage: 'EOI', occupations: [], positions: [],
    bidders: [], people: [], ...over });
  const bidder = (id, status = 'Preparing') => ({ id, status, display_name: `B${id}`, firms: [] });

  it('is five steps, each with one job', async () => {
    const { railSteps } = await import('../src/components/tenders/TenderWorkspace.jsx');
    expect(railSteps(tender()).map(s => s.label))
      .toEqual(['Notice', 'Requirements', 'Bidders', 'Team', 'Submit']);
  });

  it('locks only what has nothing to act on', async () => {
    const { railSteps } = await import('../src/components/tenders/TenderWorkspace.jsx');
    // An unsaved tender: everything after the notice waits for it.
    expect(railSteps(tender({ id: undefined })).slice(1).every(s => s.locked)).toBe(true);
    // Saved, no bidder: requirements and bidders open, team and submit not.
    expect(railSteps(tender()).map(s => !!s.locked)).toEqual([false, false, false, true, true]);
    // A notice with no posts listed can still take bidders and a team.
    expect(railSteps(tender({ bidders: [bidder(1)] })).every(s => !s.locked)).toBe(true);
  });

  it('opens a tender where its work stands', async () => {
    const { firstOpenStep } = await import('../src/components/tenders/TenderWorkspace.jsx');
    expect(firstOpenStep(tender())).toBe(2);
    const pos = { id: 9, title: 'Team Leader', count: 1 };
    const half = tender({ occupations: [{ id: 1 }], positions: [pos], bidders: [bidder(1)] });
    expect(firstOpenStep(half)).toBe(4);
    const staffed = { ...half, people: [{ bidder_id: 1, position_id: 9 }] };
    expect(firstOpenStep(staffed)).toBe(5);
    expect(firstOpenStep({ ...staffed, bidders: [bidder(1, 'Submitted')] })).toBe(5);
  });

  it('counts a post as filled only up to its own number', async () => {
    // Three people in a one-person post is one filled post and two reserves.
    const { teamProgress } = await import('../src/components/tenders/common.js');
    const posts = [{ id: 1, count: 1 }, { id: 2, count: 2 }];
    const people = [1, 1, 1, 2].map(position_id => ({ bidder_id: 7, position_id }));
    expect(teamProgress(posts, people, 7)).toEqual({ filled: 2, needed: 3, people: 4 });
  });

  it('gives every step in the rail a name a screen reader can say', () => {
    // The buttons hold only spans; without a label they were announced as "button".
    expect(view).toMatch(/aria-label=\{`Step \$\{i \+ 1\}, \$\{s\.label\}/);
  });

  it('never folds the notice\u2019s details away silently', () => {
    // Reopening a bid, a closed "More from the notice" gave no sign it held anything.
    expect(view).toMatch(/More from the notice\{moreFilled \? ` · \$\{moreFilled\} filled` : ''\}/);
  });

  it('does not tell an RFP carried from an EOI that it had no EOI', () => {
    expect(view).toMatch(/tender\?\.parent_tender_id\s*\?\s*'Taken on from the EOI/);
  });

  it('keeps a row being ticked from moving under the pointer', () => {
    // Chips above the trade list pushed every checkbox down on each tick, so
    // the next tick landed on the wrong trade.
    const req = read('src/components/tenders/RequirementsStep.jsx');
    expect(req.indexOf('<OccupationPicker')).toBeLessThan(req.indexOf('selectedOccupations.map(o => (\n              <span'));
  });

  it('never sends the whole tender back in a save', async () => {
    // The detail response carries the bidders, posts and every proposed person,
    // and the server rewrites whichever of those it is sent. Spreading it into
    // a save re-submitted the entire team each time a date changed.
    const { noticeOf } = await import('../src/components/tenders/common.js');
    const base = noticeOf({ id: 3, title: 'T', people: [{}], bidders: [{}], positions: [{}], occupations: [{}] });
    expect(base.title).toBe('T');
    for (const k of ['people', 'bidders', 'positions', 'occupations']) expect(base).not.toHaveProperty(k);
    expect(view).not.toMatch(/\.\.\.tender, client_id/);
    expect(view).toMatch(/\{ \.\.\.noticeOf\(tender\), \.\.\.body \}/);
  });
});

describe('the migrations', () => {
  const server = read('backend/server.js');

  it('defer parsing when a column may already be gone', () => {
    // A plain guard cannot work: Postgres parses the whole statement before any
    // WHERE runs, so these warned on every boot forever.
    const block = server.slice(server.indexOf('Move anything recorded under the old single-firm shape'),
                               server.indexOf('ALTER TABLE tenders DROP COLUMN IF EXISTS institute_id'));
    expect(block).toMatch(/DO \$do\$/);
    expect(block).toMatch(/EXECUTE '/);
  });

  it('run the shape changes forwards, oldest first', () => {
    // tenders.institute_id -> tender_firms -> tender_bidders. Out of order, a
    // later step uses a table an earlier one already dropped.
    expect(server.indexOf('ALTER TABLE tenders DROP COLUMN IF EXISTS institute_id'))
      .toBeLessThan(server.indexOf('CREATE TABLE IF NOT EXISTS tender_bidders'));
    expect(server.indexOf('CREATE TABLE IF NOT EXISTS tender_bidders'))
      .toBeLessThan(server.indexOf('DROP TABLE IF EXISTS tender_firms'));
  });
});

describe('the format the bidder submits in', () => {
  const view = readTenderUI();
  const reports = read('src/components/ReportsView.jsx');

  it('lists the same formats the Reports menu does', async () => {
    // The catalog exists so the tender screen can name the formats without
    // pulling docx and jsPDF into its chunk. Drift would offer a format that
    // cannot be built, or hide one that can.
    const { default: catalog } = await import('../src/reports/catalog.js');
    const { default: families } = await import('../src/reports/index.js');
    expect(catalog.map(c => [c.id, c.label]))
      .toEqual(families.map(f => [f.id, f.label]));
  });

  it('keeps the report builders out of the tender chunk', () => {
    // Importing REPORT_FAMILIES here would bundle every report with the tender
    // screen, which is the reason the catalog is a separate file.
    expect(view).not.toMatch(/reports\/index\.js'/);
    expect(view).toMatch(/from '\.\.\/reports\/catalog\.js'/);
  });

  it('is chosen on the screen, not fixed by the stage', () => {
    // A client can ask for any format at either stage.
    expect(view).toMatch(/REPORT_CATALOG\.map\(fam =>/);
    expect(view).toMatch(/onPrepareReport\(tender, 'EOI', b, docFamily\)/);
    expect(view).toMatch(/onPrepareReport\(tender, 'RFP', b, docFamily\)/);
  });

  it('opens on the format that stage usually asks for', async () => {
    const { defaultFamilyFor } = await import('../src/reports/catalog.js');
    expect(defaultFamilyFor('EOI')).toBe('bolpatra');
    expect(defaultFamilyFor('RFP')).toBe('bagmati');
    expect(defaultFamilyFor('anything else')).toBeTruthy();
  });

  it('carries the choice to the builder', () => {
    expect(view).toMatch(/familyId: familyId \|\| defaultFamilyFor\(kind\)/);
    expect(reports).toMatch(/REPORT_FAMILIES\.find\(f => f\.id === ctx\.familyId\)/);
  });

  it('falls back rather than opening an empty builder', () => {
    // A stored handoff naming a format this build dropped must not select a
    // family that does not exist.
    const block = reports.slice(reports.indexOf('const known = REPORT_FAMILIES'),
                                reports.indexOf('setFwInstIds'));
    expect(block).toMatch(/known \? known\.id : \(ctx\.kind === 'RFP'/);
    expect(block).toMatch(/r\.id === 'full'.*\? 'full' : fam\?\.reports\?\.\[0\]\?\.id/s);
  });
});

describe('copying a tender for a similar notice', () => {
  const route = read('backend/routes/tenders.js');
  const copy = route.slice(route.indexOf("fastify.post('/:id/copy'"), route.indexOf("fastify.post('/:id/advance'"));
  const view = readTenderUI();

  it('makes an independent bid, not the next stage', () => {
    // A stage is the same bid later; a copy is a different notice.
    expect(copy).toMatch(/'parent_tender_id'/);
    expect(copy).toMatch(/const NOT_COPIED = \[/);
  });

  it('leaves what identifies the old notice blank', () => {
    // Copied, a reference number or deadline would be wrong and look right.
    for (const f of ['reference_no', 'published_date', 'submission_date', 'submission_time', 'document_deadline']) {
      expect(copy, f).toContain(`'${f}'`);
    }
  });

  it('starts over at Preparing, the tender and every bidder', () => {
    expect(copy).toMatch(/'Preparing', \$\$\{cols\.length \+ 1\}/);
    expect(copy).toMatch(/VALUES \(\$1,\$2,'Preparing',\$3,\$4\)/);
  });

  it('carries the trades and every post with its requirements', () => {
    expect(copy).toMatch(/INSERT INTO tender_occupations/);
    expect(copy).toMatch(/INSERT INTO tender_positions/);
  });

  it('brings bidders and teams only when asked, and teams only with bidders', () => {
    expect(copy).toMatch(/include_bidders = true, include_teams = false/);
    expect(copy).toMatch(/if \(include_bidders\)[\s\S]*if \(include_teams\)/);
    expect(view).toMatch(/include_teams: bidders && teams/);
  });

  it('keeps each copied person in the copied post', () => {
    expect(copy).toMatch(/positionMap\.keys\(\)/);
  });

  it('opens a fresh copy on its notice, where the blanks are', () => {
    expect(view).toMatch(/openAt\(id, 1\)/);
    expect(view).toMatch(/onOpen\(id, 1\)/);
    expect(view).toMatch(/load\(tenderId, \{ chooseStep: !startAt \}\)/);
  });

  it('copies a bid from its first stage when started from the list', () => {
    // A similar notice starts at the beginning with the whole line-up, not as
    // an RFP holding only the bidders the old one shortlisted.
    expect(view).not.toMatch(/setCopyOf\(latest\)/);
  });

  it('is offered from the list and from inside a tender', () => {
    expect(view).toMatch(/onClick=\{\(\) => setCopyOf\(root\)\}/);
    expect(view).toMatch(/onClick=\{\(\) => setCopying\(true\)\}/);
  });
});

describe('a save never cuts a stage off from the one it came from', () => {
  const route = read('backend/routes/tenders.js');
  const put = route.slice(route.indexOf("fastify.put('/:id'"), route.indexOf("fastify.delete('/:id'"));

  it('keeps the link when a save does not mention it', () => {
    // Writing the column on every save meant a status change or a team
    // assignment on an RFP set its parent to NULL, and the bid split in two.
    expect(put).toMatch(/const keepLineage = !Object\.prototype\.hasOwnProperty\.call\(request\.body, 'parent_tender_id'\)/);
    expect(put).toMatch(/TENDER_FIELDS\.filter\(f => f !== 'parent_tender_id'\)/);
  });

  it('still sends it from the screen', async () => {
    const { noticeOf } = await import('../src/components/tenders/common.js');
    expect(noticeOf({ id: 4, title: 'RFP', parent_tender_id: 3 }).parent_tender_id).toBe(3);
    expect(noticeOf({ id: 3, title: 'EOI' })).not.toHaveProperty('parent_tender_id');
  });
});

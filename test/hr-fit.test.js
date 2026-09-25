import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import path from 'path';
import { EDUCATION_LEVELS, educationRank, levelOfQualification } from '../src/constants/education.js';
import { checkAgainstPosition, experienceYears, highestEducation, passedYearBS } from '../src/utils/hrFit.js';

const ROOT = path.join(import.meta.dirname, '..');
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8');

/**
 * The tender screen, as one text.
 *
 * It is a list plus five step files under components/tenders; these checks
 * are about what the screen does, not which file a line happens to live in.
 */
const readTenderUI = () => ['src/components/TendersView.jsx',
  ...readdirSync(path.join(ROOT, 'src/components/tenders'))
    .filter(f => /\.jsx?$/.test(f)).map(f => `src/components/tenders/${f}`)]
  .map(read).join('\n');


// Fixed so the suite does not change answer once a year.
const NOW = 2082;
const academic = (title, passed_year, education_level) =>
  ({ kind: 'Academic', title, passed_year, education_level });

describe('the academic ladder', () => {
  it('ranks a Master above a Bachelor above a Diploma', () => {
    expect(educationRank('Master')).toBeGreaterThan(educationRank('Bachelor'));
    expect(educationRank('Bachelor')).toBeGreaterThan(educationRank('Diploma'));
    expect(educationRank('Diploma')).toBeGreaterThan(educationRank('+2/HSEB'));
  });

  it('does not rank what it cannot read', () => {
    // Blank must not sort as the lowest rung — it means unknown, and treating
    // it as SLC would silently pass people no one has checked.
    expect(educationRank('')).toBe(-1);
    expect(educationRank('Postgrad-ish')).toBe(-1);
  });

  it('is a different ladder from the NSTB trade level', () => {
    // hr_qualifications.level already means Level 1/2/3 of a trade certificate.
    // Reusing it would rank a Master against a Building Electrician Level 2.
    expect(EDUCATION_LEVELS).not.toContain('Level 2');
    expect(read('backend/server.js'))
      .toMatch(/ALTER TABLE hr_qualifications ADD COLUMN IF NOT EXISTS education_level/);
  });
});

describe('reading a degree that was entered before the ladder existed', () => {
  it('reads the level out of the title', () => {
    // Every record already in the pool has only free text. Treating them as
    // unqualified would exclude the entire existing pool from every notice.
    expect(levelOfQualification(academic('Master of Science in Civil Engineering'))).toBe('Master');
    expect(levelOfQualification(academic('B.E. Civil'))).toBe('Bachelor');
    expect(levelOfQualification(academic('Diploma in Civil Engineering'))).toBe('Diploma');
    expect(levelOfQualification(academic('+2 Science'))).toBe('+2/HSEB');
  });

  it('takes the highest claim in the string', () => {
    // "Master of Science" contains "science"; the degree is still a Master's.
    expect(levelOfQualification(academic('Master of Science'))).toBe('Master');
    expect(levelOfQualification(academic('PhD in Education'))).toBe('PhD');
    expect(levelOfQualification(academic('MPhil in Sociology'))).toBe('MPhil');
  });

  it('lets a stated level win over the title', () => {
    expect(levelOfQualification(academic('Overseer course', '2070', 'Bachelor'))).toBe('Bachelor');
  });

  it('says nothing rather than guessing', () => {
    expect(levelOfQualification(academic('Short course in welding'))).toBe('');
  });
});

describe('a passed year', () => {
  it('is read as BS, which is what the pool asks for', () => {
    expect(passedYearBS('2072', NOW)).toBe(2072);
  });

  it('converts a year that was plainly typed as AD', () => {
    // 2015 as BS would be a 67-year career. The calendars are 56–57 apart.
    expect(passedYearBS('2015', NOW)).toBe(2072);
  });

  it('refuses a year that cannot be either', () => {
    expect(passedYearBS('', NOW)).toBeNull();
    expect(passedYearBS('not a year', NOW)).toBeNull();
    expect(passedYearBS('2099', NOW)).toBeNull();   // after today
  });
});

describe('experience counted from the passed year', () => {
  const person = { qualifications: [
    academic('Bachelor of Education', '2068'),
    academic('Master of Education', '2075'),
  ] };

  it('runs from passing to today', () => {
    expect(experienceYears(person, '', NOW)).toBe(2082 - 2068);
  });

  it('keeps the years earned before a higher degree was added', () => {
    // A Master's on top of a qualifying Bachelor's must not reset the clock:
    // the notice asks for a Bachelor's and 7 years, and this person has 14.
    expect(experienceYears(person, 'Bachelor', NOW)).toBe(14);
  });

  it('starts at the degree that actually meets the bar', () => {
    // Against a Master's requirement only the Master's year counts.
    expect(experienceYears(person, 'Master', NOW)).toBe(2082 - 2075);
  });

  it('is unknown, not zero, when no year was recorded', () => {
    // Zero would read as "brand new"; unknown has to be distinguishable so the
    // screen can say the record is incomplete.
    expect(experienceYears({ qualifications: [academic('B.E.', '')] }, '', NOW)).toBeNull();
  });
});

describe('checking somebody against a post', () => {
  const teamLeader = { title: 'Team Leader', min_education: 'Master', min_experience_years: 10 };
  const dbOfficer = { title: 'Database Officer', min_education: '+2/HSEB',
    min_experience_years: 3, required_training: 'Computer training' };

  it('passes someone who clears every bar', () => {
    const p = { qualifications: [academic('Master in Management', '2065')] };
    expect(checkAgainstPosition(p, teamLeader, NOW).ok).toBe(true);
  });

  it('fails on the degree and says which one is held', () => {
    const p = { qualifications: [academic('Bachelor of Arts', '2060')] };
    const r = checkAgainstPosition(p, teamLeader, NOW);
    expect(r.ok).toBe(false);
    expect(r.reasons.join()).toMatch(/holds Bachelor, needs Master/);
  });

  it('fails on the years and shows the shortfall', () => {
    // The screen has to say why somebody cannot fill a slot — "6 of 10 years"
    // is a different problem from a missing degree and has a different fix.
    const p = { qualifications: [academic('Master of Education', '2076')] };
    const r = checkAgainstPosition(p, teamLeader, NOW);
    expect(r.ok).toBe(false);
    expect(r.reasons.join()).toMatch(/6 of 10 years/);
  });

  it('reports every independent failure at once, not just the first', () => {
    // Short on years and missing the training: two separate things to fix.
    const p = { qualifications: [academic('+2 Science', '2081')] };
    const r = checkAgainstPosition(p, dbOfficer, NOW);
    expect(r.reasons).toEqual(['1 of 3 years', 'no Computer training on record']);
  });

  it('does not complain twice about one missing certificate', () => {
    // Years run from the qualifying degree. Someone without that degree has no
    // clock to read, so "no passed year on record" alongside "needs Master" is
    // the same missing certificate reported twice.
    const p = { qualifications: [academic('SLC', '2078')] };
    const r = checkAgainstPosition(p, teamLeader, NOW);
    expect(r.reasons).toEqual(['holds SLC/SEE, needs Master']);
  });

  it('matches a required training on the words that matter', () => {
    // Certificates are titled "Basic Computer Application", never "Computer
    // training", so an exact match would reject everyone who holds one.
    const p = { qualifications: [
      academic('+2 Commerce', '2074'),
      { kind: 'Training', title: 'Basic Computer Application' },
    ] };
    expect(checkAgainstPosition(p, dbOfficer, NOW).ok).toBe(true);
  });

  it('fails when the training is genuinely absent', () => {
    const p = { qualifications: [academic('+2 Commerce', '2074')] };
    const r = checkAgainstPosition(p, dbOfficer, NOW);
    expect(r.ok).toBe(false);
    expect(r.reasons.join()).toMatch(/no Computer training on record/);
  });

  it('passes everyone when the post states no minimum', () => {
    const p = { qualifications: [] };
    expect(checkAgainstPosition(p, { title: 'Instructor' }, NOW).ok).toBe(true);
  });
});

describe('the posts a notice demands', () => {
  const server = read('backend/server.js');
  const route = read('backend/routes/tenders.js');
  const view = readTenderUI();

  it('are rows on the notice, not prose', () => {
    expect(server).toMatch(/CREATE TABLE IF NOT EXISTS tender_positions/);
    expect(server).toMatch(/min_education\s+TEXT/);
    expect(server).toMatch(/min_experience_years INTEGER/);
    expect(server).toMatch(/required_training\s+TEXT/);
  });

  it('carry the trainer numbers in the same shape', () => {
    // "Main Trainer, 4" is the same statement as "Team Leader, 1".
    expect(view).toMatch(/Trainers &amp; instructors/);
    expect(view).toMatch(/'Main Trainer', 'Co-Trainer', 'Instructor'/);
  });

  it('record who was put in them', () => {
    expect(server).toMatch(/ALTER TABLE tender_people ADD COLUMN IF NOT EXISTS position_id/);
  });

  it('survive an edit to the notice', () => {
    // Replacing the list wholesale would null every slot assignment on the bid,
    // the same trap the bidders had.
    const block = route.slice(route.indexOf('if (body.positions)'), route.indexOf('if (!body.occupation_ids)'));
    expect(block).toMatch(/UPDATE tender_positions SET/);
    expect(block).toMatch(/id <> ALL\(\$2::int\[\]\)/);
  });

  it('carry forward to the RFP with their people still in them', () => {
    const advance = route.slice(route.indexOf("fastify.post('/:id/advance'"));
    expect(advance).toMatch(/INSERT INTO tender_positions/);
    expect(advance).toMatch(/positionMap/);
  });
});

describe('not proposing one person twice', () => {
  const route = read('backend/routes/tenders.js');
  const view = readTenderUI();

  it('hides anyone already promised on this notice', () => {
    // Two bidders competing for one notice cannot both offer the same trainer.
    expect(view).toMatch(/const takenOnThisTender/);
    expect(view).toMatch(/pool\.filter\(p => !takenOnThisTender\.has\(p\.id\)\)/);
  });

  it('will not let them be proposed even when the list is forced open', () => {
    expect(view).toMatch(/disabled=\{!!taken \|\| busy\} onClick=\{\(\) => assign\(p\)\}/);
  });

  it('actually asks the server who is elsewhere', () => {
    // api() takes (method, path, body, token). Called with the path alone it
    // sent the path as the method and no token, the catch swallowed the
    // failure, and the "other live bid" warning silently never appeared.
    expect(view).toMatch(/api\('GET', `\/tenders\/proposed-elsewhere\?exclude_tender_id=\$\{tender\.id\}`, null, token\)/);
    expect(view).not.toMatch(/\bapi\(`/);
  });

  it('flags a live bid elsewhere without blocking it', () => {
    // Being on another client's bid is not forbidden, just worth seeing.
    expect(route).toMatch(/fastify\.get\('\/proposed-elsewhere'/);
    expect(route).toMatch(/t\.status NOT IN \('Awarded', 'Lost', 'Dropped'\)/);
    expect(view).toMatch(/other live bid/);
  });

  it('never blocks the screen on that advisory lookup', () => {
    const block = view.slice(view.indexOf('proposed-elsewhere') - 200,
                             view.indexOf('proposed-elsewhere') + 500);
    expect(block).toMatch(/catch\(\(\) => \{\}\)/);
  });
});

describe('a notice covering more than one trade', () => {
  const view = readTenderUI();
  const route = read('backend/routes/tenders.js');
  const server = read('backend/server.js');

  it('has always allowed several occupations', () => {
    // tender_occupations is the join; nothing about it is one-per-tender.
    expect(server).toMatch(/CREATE TABLE IF NOT EXISTS tender_occupations[\s\S]*?PRIMARY KEY \(tender_id, occupation_id\)/);
  });

  it('asks for trainers per trade, not once for the whole notice', () => {
    // "4 main trainers" across Assistant Tailor and Plumber says nothing about
    // who teaches what, and cannot be checked against the pool.
    expect(view).toMatch(/const trainerGroups = \[/);
    expect(view).toMatch(/selectedOccupations\.map\(o => \(\{ key: String\(o\.id\)/);
  });

  it('keeps key experts off that split', () => {
    // A Team Leader leads the whole bid, whatever trades it covers.
    expect(view).toMatch(/const experts = indexed\.filter\(\(\{ p \}\) => !isTrainer\(p\)\)/);
    expect(view).toMatch(/Named once for the whole bid, whatever trades it covers/);
  });

  it('can state the same post for every trade at once', () => {
    expect(view).toMatch(/const addToEveryTrade = \(title\) =>/);
    expect(view).toMatch(/selectedOccupations\.map\(o => \(\{ \.\.\.emptyPosition\('Trainer'\), occupation_id: o\.id, title \}\)\)/);
  });

  it('does not delete a requirement whose trade was unticked', () => {
    // The notice is edited after the team is set; dropping the row would take
    // whoever was assigned to it along with it.
    expect(view).toMatch(/key: 'orphan', label: 'No longer on this notice'/);
    expect(view).toMatch(/Kept so nobody already/);
  });

  it('narrows the pool to that trade when the slot is filled', () => {
    const block = view.slice(view.indexOf('if (targetPosition) {'), view.indexOf('if (!wanted.length) return available;'));
    expect(block).toMatch(/targetPosition\.occupation_id/);
    // By trade and level for the role (main trainer one level up); see trainer-level.test.js.
    expect(block).toMatch(/fitsTrainerLevel\(p, occ, allOccupations, targetPosition\.title\)/);
  });

  it('groups the team step by trade', async () => {
    const { groupPositions } = await import('../src/components/tenders/common.js');
    const g = groupPositions([
      { id: 1, title: 'Team Leader', category: 'Key expert' },
      { id: 2, title: 'Main Trainer', category: 'Trainer', occupation_id: 1, occupation_name: 'Assistant Tailor' },
      { id: 3, title: 'Main Trainer', category: 'Trainer', occupation_id: 2, occupation_name: 'Plumber' },
      { id: 4, title: 'Instructor', category: 'Trainer', occupation_id: 2, occupation_name: 'Plumber' },
    ]);
    expect(g.map(x => [x.label, x.rows.map(r => r.id)]))
      .toEqual([['Key experts', [1]], ['Assistant Tailor', [2]], ['Plumber', [3, 4]]]);
    expect(view).toMatch(/const groups = useMemo\(\(\) => groupPositions\(positions\)/);
  });

  it('groups by the posts, not by the notice, so an unticked trade still shows', async () => {
    // The trade comes from the post itself; the notice's own list is not read,
    // so a post whose trade was unticked keeps its group and its people.
    const { groupPositions } = await import('../src/components/tenders/common.js');
    const g = groupPositions([{ id: 5, category: 'Trainer', occupation_id: 9, occupation_name: 'Mason' }]);
    expect(g[0].label).toBe('Mason');
    const common = read('src/components/tenders/common.js');
    const fn = common.slice(common.indexOf('export function groupPositions'), common.indexOf('export const need'));
    expect(fn).not.toMatch(/occupations/);
  });

  it('keeps the picker open while a post still has room', () => {
    // Every Assign reloads the tender. Closing the picker on reload made
    // filling "3 Main Trainers" three trips back to the button.
    expect(view).toMatch(/useEffect\(\(\) => \{ setRows\(rowsFor\(activeBidder\)\); \}, \[tender, activeBidder\]\)/);
    expect(view).toMatch(/useEffect\(\(\) => \{ setOpenSlot\(null\); setEditing\(null\); \}, \[activeBidder\]\)/);
    expect(view).toMatch(/if \(!pos \|\| filledNow >= need\(pos\)\) setOpenSlot\(null\)/);
  });

  it('puts people into a post rather than labelling them afterwards', () => {
    // One way in: the post's own Assign. The old free "+ Propose someone" plus
    // a post dropdown plus a typed position were three routes to one answer.
    expect(view).not.toMatch(/\+ Propose someone/);
    expect(view).not.toMatch(/No stated post/);
    expect(view).toMatch(/position_id: pos\?\.id \|\| null/);
    expect(view).toMatch(/proposed_position: pos\?\.title/);
  });

  it('saves one row per trade', () => {
    // Each group's rows carry their own occupation_id into tender_positions.
    const block = route.slice(route.indexOf('if (body.positions)'), route.indexOf('if (!body.occupation_ids)'));
    expect(block).toMatch(/p\.occupation_id \|\| null/);
  });
});


describe('general and vocational education', () => {
  it('puts SLC, TSLC and JTA on one rung, as notices ask for "SLC/TSLC"', async () => {
    const { educationRank } = await import('../src/constants/education.js');
    expect(educationRank('TSLC')).toBe(educationRank('SLC/SEE'));
    expect(educationRank('JTA')).toBe(educationRank('SLC/SEE'));
    expect(educationRank('+2/HSEB')).toBeGreaterThan(educationRank('TSLC'));
  });

  it('ranks PhD above MPhil, and still reads the old combined value', async () => {
    const { educationRank } = await import('../src/constants/education.js');
    expect(educationRank('PhD')).toBeGreaterThan(educationRank('MPhil'));
    // Saved before the split; dropping it would unrank those records.
    expect(educationRank('MPhil/PhD')).toBe(educationRank('MPhil'));
  });

  it('never reads a TSLC as an SLC', () => {
    expect(levelOfQualification(academic('TSLC in Plumbing'))).toBe('TSLC');
    expect(levelOfQualification(academic('JTA (Agriculture)'))).toBe('JTA');
  });

  it('knows which ladder an old row was on', async () => {
    const { streamOf } = await import('../src/constants/education.js');
    expect(streamOf({ kind: 'Skill Test', level: 'Level 2' })).toBe('Vocational');
    expect(streamOf({ kind: 'Academic', level: 'Level 1' })).toBe('Vocational');
    expect(streamOf({ kind: 'Academic', title: 'B.Ed.' })).toBe('General');
    expect(streamOf({ kind: 'Academic', stream: 'General', level: 'Level 1' })).toBe('General');
    expect(streamOf({ kind: 'Training', title: 'Computer' })).toBeNull();
  });

  it('does not let a skill certificate count as a degree', () => {
    // An NSTB Level 3 says nothing about school; a +2 requirement must not pass on it.
    const p = { qualifications: [{ kind: 'Academic', stream: 'Vocational', level: 'Level 3',
      title: 'Level 3 — Plumber (Diploma course)', passed_year: '2070' }] };
    const r = checkAgainstPosition(p, { title: 'Database Officer', min_education: '+2/HSEB' }, NOW);
    expect(r.ok).toBe(false);
  });

  it('keeps level 4 under the name eligibility already ranks', async () => {
    // The rule cap compares the stored level; renaming it would unrank every certificate.
    const { VOCATIONAL_LEVELS } = await import('../src/constants/education.js');
    expect(VOCATIONAL_LEVELS.find(l => l.label.startsWith('Level 4')).value).toBe('Professional');
    expect(read('backend/routes/hr.js')).toMatch(/WHEN 'professional' THEN 4/);
  });
});

describe('saving a qualification from the toggle', () => {
  it('fills in the title a CV prints when nobody typed one', async () => {
    const { normaliseQual, emptyVocational, emptyGeneral } = await import('../src/components/pool/common.js');
    const occ = [{ id: 7, name: 'Plumber' }];
    const v = normaliseQual({ ...emptyVocational('Level 2'), occupation_id: 7 }, occ);
    expect(v).toMatchObject({ kind: 'Academic', stream: 'Vocational', board: 'NSTB', title: 'Level 2 — Plumber' });
    const g = normaliseQual({ ...emptyGeneral(''), title: 'Bachelor of Education' }, occ);
    expect(g).toMatchObject({ kind: 'Academic', stream: 'General', education_level: 'Bachelor' });
  });

  it('files both streams under Education on the Form 5 CV', () => {
    // The CV splits on kind; vocational must be Academic, not Training.
    expect(read('backend/routes/tenders.js')).toMatch(/education: forPerson\(quals\.rows, tp\.person_id\)\.filter\(q => q\.kind === 'Academic'\)/);
  });

  it('folds the old Skill Test kind into vocational education', () => {
    const server = read('backend/server.js');
    expect(server).toMatch(/ADD COLUMN IF NOT EXISTS stream TEXT/);
    expect(server).toMatch(/SET kind = 'Academic', stream = 'Vocational' WHERE kind = 'Skill Test'/);
    expect(read('backend/routes/hr.js')).toMatch(/education_level, stream, start_date, end_date, duration_days\)/);
  });

  it('keeps a button group out of a label', () => {
    // A label forwards clicks on its empty space to its first control, so the
    // role toggle inside one flipped back to Trainer.
    const editor = read('src/components/pool/PersonEditor.jsx');
    expect(editor).toMatch(/const Tag = group \? 'div' : 'label'/);
    expect(editor).toMatch(/<Field label="Role in the pool" group>/);
  });
});

describe('a post that accepts alternatives, as notices write them', () => {
  // "(1.) Plumber (Required Number - 2)
  //  Diploma or PCL in related subject or NSTB Level-3 Skill Test Passed or Equivalent Degree
  //  OR
  //  Pre-Diploma in related subject or NSTB Level-2 Skill Test Passed or Equivalent Degree"
  const PLUMBER = 11, ELECTRICIAN = 12;
  const post = { title: 'Plumber', count: 2, occupation_id: PLUMBER, education_options: [
    { any: [{ ladder: 'general', level: 'Diploma', related: true },
            { ladder: 'vocational', level: 'Level 3', related: true }] },
    { any: [{ ladder: 'general', level: 'TSLC', related: true },
            { ladder: 'vocational', level: 'Level 2', related: true }] },
  ] };
  const gen = (level, year = '2070') => ({ kind: 'Academic', stream: 'General', education_level: level, passed_year: year });
  const nstb = (level, occ, year = '2070') => ({ kind: 'Academic', stream: 'Vocational', level, occupation_id: occ, passed_year: year });
  const person = (quals, trades = []) => ({ qualifications: quals, eligible_occupations: trades.map(id => ({ id })) });
  const ok = (p, pos = post) => checkAgainstPosition(p, pos, NOW).ok;

  it('accepts a related Diploma', () => expect(ok(person([gen('Diploma')], [PLUMBER]))).toBe(true));
  it('accepts NSTB Level 3 in the trade', () => expect(ok(person([nstb('Level 3', PLUMBER)]))).toBe(true));
  it('accepts the second alternative: NSTB Level 2', () => expect(ok(person([nstb('Level 2', PLUMBER)]))).toBe(true));
  it('accepts the second alternative: a related Pre-Diploma', () => expect(ok(person([gen('TSLC')], [PLUMBER]))).toBe(true));

  it('reads "or equivalent" as higher on the same ladder', () => {
    expect(ok(person([gen('Bachelor')], [PLUMBER]))).toBe(true);
    expect(ok(person([nstb('Professional', PLUMBER)]))).toBe(true);
  });

  it('holds "related subject" to the post’s trade', () => {
    // A Level 3 electrician is not a plumbing trainer, however high the level.
    expect(ok(person([nstb('Level 3', ELECTRICIAN)]))).toBe(false);
    // Nor is a Diploma the rules do not count towards plumbing.
    expect(ok(person([gen('Diploma')], [ELECTRICIAN]))).toBe(false);
  });

  it('says what is needed when nothing is held, in the notice’s own terms', () => {
    const r = checkAgainstPosition(person([nstb('Level 1', PLUMBER)]), post, NOW);
    expect(r.ok).toBe(false);
    expect(r.reasons[0]).toBe('needs Diploma / PCL in related subject or NSTB Level 3 — OR — '
      + 'TSLC / Pre-Diploma in related subject or NSTB Level 2');
  });

  it('keeps each alternative’s own years', () => {
    // "Diploma + 1 year OR Pre-Diploma + 3 years": the lower level needs longer.
    const timed = { ...post, education_options: [
      { any: [{ ladder: 'general', level: 'Diploma', related: false }], min_years: 1 },
      { any: [{ ladder: 'general', level: 'TSLC', related: false }], min_years: 3 },
    ] };
    expect(ok(person([gen('TSLC', '2081')]), timed)).toBe(false);   // 1 year, needs 3
    expect(ok(person([gen('TSLC', '2078')]), timed)).toBe(true);    // 4 years
    expect(ok(person([gen('Diploma', '2081')]), timed)).toBe(true); // 1 year is enough here
    expect(checkAgainstPosition(person([gen('TSLC', '2081')]), timed, NOW).reasons[0]).toBe('1 of 3 years');
  });

  it('checks a post saved with one minimum the same way as before', () => {
    const legacy = { title: 'Team Leader', min_education: 'Master', min_experience_years: 10 };
    expect(checkAgainstPosition(person([gen('Bachelor')]), legacy, NOW).reasons).toEqual(['holds Bachelor, needs Master']);
  });

  it('reads Pre-Diploma in a title as TSLC, not as a Diploma', () => {
    expect(levelOfQualification(academic('Pre-Diploma in Plumbing'))).toBe('TSLC');
    expect(levelOfQualification(academic('Diploma in Civil Engineering'))).toBe('Diploma');
  });
});

describe('storing what a post accepts', () => {
  const route = read('backend/routes/tenders.js');
  it('has a column for it', () => {
    expect(read('backend/server.js')).toMatch(/ADD COLUMN IF NOT EXISTS education_options JSONB DEFAULT '\[\]'/);
  });
  it('saves it, and carries it into a copy and the RFP stage', () => {
    expect(route).toMatch(/JSON\.stringify\(cleanOptions\(p\.education_options\)\)/);
    expect((route.match(/JSON\.stringify\(pos\.education_options \|\| \[\]\)/g) || []).length).toBe(2);
  });
  it('drops an option with no level rather than reading it as "anything goes"', () => {
    const fn = route.slice(route.indexOf('const cleanOptions'), route.indexOf('const derivedLabel'));
    expect(fn).toMatch(/String\(o\.level \|\| ''\)\.trim\(\)/);
    expect(fn).toMatch(/\.filter\(a => a\.any\.length\)/);
  });
});

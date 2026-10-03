// lib/cvWording.js — the CV's prose about a trainer's work, and the event count.
//
// A training provider runs at most one event a quarter for a trainer, so a job
// supports at most four events a year: March 2019 to March 2026 is 84 months,
// so 28 at most. The count is what the experience letter states, so it is
// stored once on the job and both documents print the same number.

// "2076/04/01" or "2076" → months since year 0; a bare year counts from its first month.
function monthIndex(d) {
  const m = String(d || '').trim().match(/^(\d{4})(?:[/-](\d{1,2}))?/);
  if (!m) return null;
  return parseInt(m[1], 10) * 12 + ((parseInt(m[2], 10) || 1) - 1);
}

// Bikram Sambat runs about 56 years 8½ months ahead; close enough for a cap.
function bsMonthNow(now = new Date()) {
  return (now.getFullYear() + 56) * 12 + now.getMonth() + 8;
}

/** Most events a job can claim: one per full quarter worked. null when the dates do not say. */
function maxEvents(e, now) {
  const from = monthIndex(e.from_date);
  const to = e.is_current ? bsMonthNow(now) : monthIndex(e.to_date);
  if (from == null || to == null || to < from) return null;
  return Math.floor((to - from) / 3);
}

/** The stored count: a whole number, never above what the dates allow. */
function eventsFor(e, now) {
  const n = parseInt(e.events_count, 10);
  if (!Number.isInteger(n) || n < 0) return null;
  const cap = maxEvents(e, now);
  return cap == null ? n : Math.min(n, cap);
}

/** "Conducted 28 training events for CTEVT, HELVETAS." — or '' when not recorded. Support staff "supported" them. */
function eventsLine(e, verb = 'Conducted') {
  const n = parseInt(e.events_count, 10);
  const clients = String(e.clients || '').trim();
  if (!(n > 0) && !clients) return '';
  if (n > 0) return `• ${verb} ${n} training event${n === 1 ? '' : 's'}${clients ? ` for ${clients}` : ''}.`;
  return verb === 'Conducted' ? `• Delivered training for ${clients}.` : `• Supported training for ${clients}.`;
}

/*
 * Starter wording for a Main Trainer, shared by every firm. A firm without its
 * own wording is given one of these by its id, so two firms bidding on the
 * same notice do not submit identical CVs; a person's jobs rotate through them
 * too. Each mixes the core of the work — planning, teaching, practicals,
 * safety, assessment — with a few routine duties, never the whole list.
 */
// Notices and job records also call the post these; any of them matches.
const MT = 'Main Trainer | Lead Trainer | Senior Trainer | Instructor';
const SEED = [
  { field: 'activities', label: 'Main Trainer — activities A', body: [
    '• Prepared monthly, weekly and daily lesson plans and session schedules in line with CTEVT curricula and project standards.',
    '• Conducted structured theory and practical classes using learner-centred teaching methods.',
    '• Supervised practical workshops and demonstrated {occupation} skills, including safe tool operation.',
    '• Enforced OSH and ESHS guidelines and the use of PPE during practical sessions.',
    '• Assessed trainee competency through routine tests, practical evaluations and feedback.',
    '• Maintained daily logbooks, attendance sheets and trainee records.'] },
  { field: 'activities', label: 'Main Trainer — activities B', body: [
    '• Delivered theory and hands-on practical sessions as per the CTEVT curriculum.',
    '• Demonstrated {occupation} skills in the workshop and supervised trainees’ practice.',
    '• Carried out workshop risk assessments, enforced PPE use and applied emergency procedures.',
    '• Identified learning gaps and ran remedial coaching for trainees needing extra support.',
    '• Oriented trainees on NSTB skill-test criteria and certification procedures.',
    '• Prepared weekly and monthly training progress reports for the project.',
    '• Arranged training manuals, handouts and instructional materials.'] },
  { field: 'activities', label: 'Main Trainer — activities C', body: [
    '• Planned lessons and session schedules aligned with the CTEVT curriculum.',
    '• Taught theory and supervised practical work using learner-centred methods.',
    '• Ensured trainees followed OSH guidelines and wore PPE in the workshop.',
    '• Evaluated trainees continuously through tests and practical performance.',
    '• Organised site visits, industrial exposure and OJT placements.'] },
  { field: 'activities', label: 'Main Trainer — activities D', body: [
    '• Conducted classroom and workshop sessions on {occupation} following the prescribed curriculum.',
    '• Demonstrated technical skills and supervised trainees during practicals.',
    '• Applied OSH and ESHS standards and monitored the use of PPE.',
    '• Assessed competency through practical evaluations and gave constructive feedback.',
    '• Coordinated with training managers, monitoring officers and district coordinators as per the ToR.',
    '• Managed workshop tools, inventory and material requisitions.'] },
  { field: 'activities', label: 'Main Trainer — activities E', body: [
    '• Prepared session plans and delivered theory and practical classes as per CTEVT standards.',
    '• Supervised practical workshops and safe operation of tools and equipment.',
    '• Conducted risk assessments and enforced PPE and emergency procedures.',
    '• Ran remedial coaching sessions to close trainees’ learning gaps.',
    '• Prepared trainees for NSTB skill testing and certification.',
    '• Linked graduates with potential employers, gave career guidance and tracked placements.',
    '• Kept attendance sheets, logbooks and project documentation up to date.'] },

  { field: 'detailed_tasks', label: 'Main Trainer — tasks A', body: [
    '• Prepare lesson plans and session schedules in line with the CTEVT curriculum and the ToR.',
    '• Deliver theory and practical sessions on {occupation} using learner-centred methods.',
    '• Supervise practicals and ensure OSH, ESHS and PPE compliance.',
    '• Assess trainees continuously and prepare them for NSTB skill testing.',
    '• Report training progress weekly and monthly to the project management.'] },
  { field: 'detailed_tasks', label: 'Main Trainer — tasks B', body: [
    '• Conduct classroom and workshop training on {occupation} as per the prescribed curriculum.',
    '• Demonstrate skills and supervise trainees’ practical work safely.',
    '• Evaluate trainee performance and provide remedial coaching where needed.',
    '• Maintain attendance, logbooks and trainee records.',
    '• Coordinate with the training manager and monitoring officers.'] },
  { field: 'detailed_tasks', label: 'Main Trainer — tasks C', body: [
    '• Plan and deliver the {occupation} training as the main trainer.',
    '• Enforce workplace safety and the use of PPE during practicals.',
    '• Assess competency and orient trainees on NSTB certification.',
    '• Support OJT placement and employment linkage of graduates.'] },

  { field: 'adequacy', label: 'Main Trainer — prior work A', body: [
    '• Main trainer for {occupation} with {years} years of training delivery.',
    '• Conducted {events} training events for {clients}.',
    '• Holds the qualifications and TOT required to deliver the assigned tasks.'] },
  { field: 'adequacy', label: 'Main Trainer — prior work B', body: [
    '• Delivered {events} training events in {occupation} for {clients} over {years} years.',
    '• Experienced in curriculum-based delivery, practical supervision, OSH and NSTB preparation.'] },
].map(v => ({ ...v, position: MT, body: v.body.join('\n') }))
  .concat(require('./cvWordingPosts').POST_SEED);

/** Add the starter wording once; edits and deletions made afterwards are left alone. */
async function seedCvWording(pool) {
  let added = 0;
  for (const v of SEED) {
    const { rowCount } = await pool.query(
      `INSERT INTO cv_text_variants (institute_id, field, label, position, body)
       SELECT NULL, $1, $2, $3, $4
        WHERE NOT EXISTS (SELECT 1 FROM cv_text_variants WHERE institute_id IS NULL AND label = $2)`,
      [v.field, v.label, v.position, v.body]);
    added += rowCount;
  }
  return added;
}

module.exports = { monthIndex, maxEvents, eventsFor, eventsLine, seedCvWording, SEED };

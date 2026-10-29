/**
 * PPMO RFP "Adequacy for the Assignment": each task beside the prior work that
 * shows the expert can do it.
 *
 * The form has a task column and a reference column, one row to a task, and a
 * blank reference reads as "no evidence". So every task is given one, written
 * only from facts already on the CV — their jobs and events, TOT, NSTB
 * certificate, degree — and chosen to fit the task: a safety task points at
 * workshop experience, an assessment task at the NSTB certificate, a delivery
 * task at the job itself. Where nothing fits a task, the next unused fact is
 * used, and failing even that a plain pointer to the CV, so no row is empty.
 */

const clean = (l) => String(l || '').replace(/^[•\-*]\s*/, '').trim();
const lines = (t) => String(t || '').split('\n').map(clean).filter(Boolean);
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** "2078/05/11" → "2078" is enough for a reference; the CV's own row carries the full dates. */
const year = (d) => String(d || '').match(/^\d{4}/)?.[0] || '';

function period(e) {
  const from = year(e.from_date);
  const to = e.is_current ? 'present' : year(e.to_date);
  return from || to ? ` (${[from, to].filter(Boolean).join(' – ')})` : '';
}

const clientsOf = (xs) => [...new Set(xs.flatMap(e => String(e.clients || '').split(',')).map(c => c.trim()).filter(Boolean))];
const listAnd = (xs) => xs.length <= 1 ? (xs[0] || '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;

/** The facts a reference can be built from. */
function factsOf(cv) {
  const staff = cv.person?.person_type === 'Support Staff';
  const jobs = (cv.experience || []).filter(e => e.organisation || e.position);
  const main = jobs[0] || null;
  const events = jobs.reduce((n, e) => n + (parseInt(e.events_count, 10) || 0), 0);
  const clients = clientsOf(jobs);
  const tot = (cv.trainings || []).find(t => t.kind === 'TOT');
  const nstb = (cv.education || []).find(q => q.stream === 'Vocational');
  const degree = (cv.education || []).find(q => q.stream !== 'Vocational' && q.title);
  const forClients = clients.length ? ` for ${listAnd(clients)}` : '';
  return {
    staff, jobs, main, events, clients, forClients,
    jobLine: (e) => {
      const n = parseInt(e.events_count, 10) || 0;
      const ev = n > 0 ? `: ${staff ? 'supported' : 'conducted'} ${n} training event${n === 1 ? '' : 's'}${e.clients ? ` for ${e.clients}` : ''}` : '';
      return `${e.position || (staff ? 'Staff member' : 'Trainer')}, ${e.organisation || 'the employer'}${period(e)}${ev}`;
    },
    totLine: tot ? `Holds a Training of Trainers (TOT)${tot.institution ? ` from ${tot.institution}` : ''}${year(tot.end_date_ad || tot.end_date || tot.passed_year) ? `, ${year(tot.end_date_ad || tot.end_date || tot.passed_year)}` : ''}` : null,
    nstbLine: nstb ? `Holds the NSTB skill certificate ${nstb.title || [nstb.level, nstb.occupation_name].filter(Boolean).join(' ')}${nstb.passed_year ? ` (${nstb.passed_year})` : ''}` : null,
    degreeLine: degree ? `${degree.title}${degree.institution ? `, ${degree.institution}` : ''}${degree.passed_year ? ` (${degree.passed_year})` : ''}` : null,
  };
}

/** What each kind of task is best evidenced by. First match wins. */
const KINDS = [
  { re: /safety|\bppe\b|\bosh\b|eshs|risk|emergency|hazard/i,
    ref: (f) => f.events > 0 ? `Applied OSH/ESHS and PPE practice in the workshop across ${f.events} training event${f.events === 1 ? '' : 's'}${f.forClients}`
      : f.main ? `Applied workshop safety and PPE practice as ${f.main.position || 'trainer'} at ${f.main.organisation}` : null },
  { re: /assess|evaluat|nstb|skill test|certif|competenc|feedback|remedial|coaching/i,
    ref: (f) => f.nstbLine ? `${f.nstbLine}, and prepares trainees for NSTB skill testing`
      : f.events > 0 ? `Assessed trainee competency through practical tests across ${f.events} training event${f.events === 1 ? '' : 's'}${f.forClients}` : null },
  { re: /\bojt\b|on.the.job|placement|employment|linkage|career|graduate|job/i,
    ref: (f) => f.main ? `Supported OJT, job placement and employment linkage of graduates${f.forClients || ` as ${f.main.position || 'staff'} at ${f.main.organisation}`}` : null },
  { re: /report|record|logbook|attendance|document|database|data\b|progress/i,
    ref: (f) => f.main ? `Maintained attendance sheets, logbooks and progress records at ${f.main.organisation}${f.events > 0 ? `, across ${f.events} training event${f.events === 1 ? '' : 's'}` : ''}` : null },
  { re: /coordinat|liais|monitor|stakeholder|manager|communicat|orient|support/i,
    ref: (f) => f.main ? `Worked with training managers and monitoring officers as ${f.main.position || 'staff'} at ${f.main.organisation}${f.forClients}` : null },
  { re: /\btot\b|trainer.s training|training of trainers/i, ref: (f) => f.totLine },
  { re: /plan|prepar|lesson|deliver|conduct|teach|train|demonstrat|supervis|practical|class|session|curricul|material|resource/i,
    ref: (f) => f.main ? f.jobLine(f.main) : f.degreeLine },
];

/**
 * [{ task, ref }] — one pair per task, every ref filled.
 * the lines written for this bid (or the firm's own wording) go to the first rows as written.
 */
export function adequacyPairs(cv) {
  const tasks = lines(cv.detailed_tasks);
  const f = factsOf(cv);
  // Text written for this bid, else the firm's own prior-work wording, leads in the order written;
  // the facts then fill whatever rows are left. (A pack that does not say which it is, is typed.)
  const typed = cv.adequacy_typed === false ? lines(cv.adequacy_wording) : lines(cv.adequacy);

  // Facts to fall back on, most telling first; each is used once before any repeats.
  const pool = [...f.jobs.map(f.jobLine), f.totLine, f.nstbLine, f.degreeLine].filter(Boolean);
  const used = new Set();
  const take = (text) => { used.add(norm(text)); return text; };
  const nextUnused = () => pool.find(t => !used.has(norm(t)));

  const n = Math.max(tasks.length, typed.length, 1);
  return Array.from({ length: n }, (_, i) => {
    const task = tasks[i] || '';
    if (typed[i]) return { task, ref: take(typed[i]) };
    const kind = KINDS.find(k => k.re.test(task));
    const fit = kind?.ref(f);
    if (fit && !used.has(norm(fit))) return { task, ref: take(fit) };
    const alt = nextUnused();
    if (alt) return { task, ref: take(alt) };
    if (fit) return { task, ref: fit };            // nothing new to say, but never blank
    return { task, ref: pool[0] || 'Prior work and qualifications as set out in this CV.' };
  });
}

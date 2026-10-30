/**
 * PPMO RFP "Adequacy for the Assignment", in the compact form firms usually submit it.
 *
 * One row. The left cell is the tasks, under "As a Main Trainer, she will". The
 * right cell is a short paragraph on why the person can do them — what they hold,
 * their ToT, the work they have done and for whom — followed by a few lines on what
 * they are capable of. Written only from facts on the CV (qualifications, ToT, jobs,
 * events, clients), so it reads the same way for anyone and says nothing untrue.
 *
 * Text written for this bid, or the firm's own prior-work wording, is used as
 * written; the paragraph is what is generated when there is neither. Either way the
 * cell is never empty.
 */

const clean = (l) => String(l || '').replace(/^[•\-*]\s*/, '').trim();
const lines = (t) => String(t || '').split('\n').map(clean).filter(Boolean);

/** "2078/05/11" → "2078": the CV's own employment table carries the full dates. */
const year = (d) => String(d || '').match(/^\d{4}/)?.[0] || '';
const listAnd = (xs) => xs.length <= 1 ? (xs[0] || '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
const aOrAn = (w) => (/^[aeiou]/i.test(String(w).trim()) ? 'an' : 'a');
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Pronouns that agree with their verbs; neutral (they) when gender is not recorded. */
function pronouns(gender) {
  const g = String(gender || '').toLowerCase();
  if (g.startsWith('m')) return { title: 'Mr', He: 'He', he: 'he', has: 'has', is: 'is', s: 's' };
  if (g.startsWith('f')) return { title: 'Ms', He: 'She', he: 'she', has: 'has', is: 'is', s: 's' };
  return { title: '', He: 'They', he: 'they', has: 'have', is: 'are', s: '' };
}

/** What the CV records, ready to put in a sentence. */
function factsOf(cv) {
  const jobs = (cv.experience || []).filter(e => e.organisation || e.position);
  const events = jobs.reduce((n, e) => n + (parseInt(e.events_count, 10) || 0), 0);
  const clients = [...new Set(jobs.flatMap(e => String(e.clients || '').split(',')).map(c => c.trim()).filter(Boolean))];
  const tot = (cv.trainings || []).find(t => t.kind === 'TOT');
  const nstb = (cv.education || []).find(q => q.stream === 'Vocational');
  const degree = (cv.education || []).find(q => q.stream !== 'Vocational' && q.title);
  return { jobs, main: jobs[0] || null, earlier: jobs.slice(1, 3), events, clients, tot, nstb, degree };
}

const withYear = (text, y) => (y ? `${text} (${y})` : text);

/** The paragraph that says why this person can do the tasks. */
function paragraph(cv, P) {
  const f = factsOf(cv);
  const staff = cv.person?.person_type === 'Support Staff';
  const position = String(cv.proposed_position || '').trim() || (staff ? 'staff member' : 'trainer');
  const who = [P.title, cv.person?.full_name].filter(Boolean).join(' ');
  const showEvents = cv.show_events !== false;
  const out = [];

  // What they hold.
  const held = [
    f.degree && withYear(f.degree.title, f.degree.passed_year),
    f.nstb && withYear(`the NSTB skill certificate ${f.nstb.title || [f.nstb.level, f.nstb.occupation_name].filter(Boolean).join(' ')}`.trim(), f.nstb.passed_year),
  ].filter(Boolean);
  if (held.length) out.push(`${who} holds ${listAnd(held)}.`);

  if (f.tot) {
    const when = year(f.tot.end_date_ad || f.tot.end_date || f.tot.passed_year);
    const lead = held.length ? `Also, ${P.he} ${P.has}` : `${who} has`;
    out.push(`${lead} received Training of Trainers (ToT)${f.tot.institution ? ` from ${f.tot.institution}` : ''}${when ? ` in ${when}` : ''}.`);
  }

  // What they have done.
  if (f.main) {
    const since = f.main.is_current ? (year(f.main.from_date) ? ` since ${year(f.main.from_date)}` : '')
      : (year(f.main.from_date) || year(f.main.to_date) ? ` from ${[year(f.main.from_date), year(f.main.to_date)].filter(Boolean).join(' to ')}` : '');
    const n = f.events;
    const did = showEvents && n > 0
      ? `, ${staff ? 'supporting' : 'conducting'} ${plural(n, 'training event')}${f.clients.length ? ` for ${listAnd(f.clients.slice(0, 6))}${f.clients.length > 6 ? ' and others' : ''}` : ''}`
      : (f.clients.length ? `, on programmes of ${listAnd(f.clients.slice(0, 6))}${f.clients.length > 6 ? ' and others' : ''}` : '');
    out.push(`${P.He} ${P.has} worked as ${aOrAn(f.main.position || position)} ${f.main.position || position}${f.main.organisation ? ` with ${f.main.organisation}` : ''}${since}${did}.`);
  }
  if (f.earlier.length) {
    out.push(`Earlier, ${P.he} worked as ${listAnd(f.earlier.map(e => `${e.position || 'staff'}${e.organisation ? ` at ${e.organisation}` : ''}${year(e.from_date) ? ` (${[year(e.from_date), e.is_current ? 'present' : year(e.to_date)].filter(Boolean).join(' – ')})` : ''}`))}.`);
  }

  if (!out.length) return `${who} is proposed as ${aOrAn(position)} ${position} for this assignment; qualifications and experience are set out in this CV.`;
  out.push(`${who} is a qualified and experienced ${position}.`);
  return out.join(' ');
}

/** The general "capable of" lines, when the firm has not written its own. */
function capabilities(cv) {
  const staff = cv.person?.person_type === 'Support Staff';
  return staff
    ? ['Capable of carrying out the assigned tasks in line with the requirements of the ToR.',
       'Able to coordinate with the project team, trainers and other staff for successful completion of the assignment.',
       'Able to prepare and submit reports in the prescribed formats to the client.']
    : ['Capable of delivering quality skill development training in line with the requirements of the ToR.',
       'Able to coordinate with training managers, trainers and support staff for successful completion of the training.',
       'Able to prepare reports in the prescribed formats and submit them to the client.'];
}

/**
 * { left, right } — the two cells of the Adequacy row, as bulleted text.
 * `cv.adequacy_typed === false` marks wording the firm chose (`cv.adequacy_wording`);
 * anything else in `cv.adequacy` was written for this bid.
 */
export function adequacyBlock(cv) {
  const P = pronouns(cv.person?.gender);
  const position = String(cv.proposed_position || '').trim() || 'expert';
  const tasks = lines(cv.detailed_tasks);

  const left = [
    `As ${aOrAn(position)} ${position}, ${P.he} will${tasks.length ? '' : ' carry out the duties set out in the Terms of Reference for the post.'}`,
    ...tasks.map(t => `• ${t}`),
  ].join('\n');

  const written = cv.adequacy_typed === false ? [] : lines(cv.adequacy);
  if (written.length) return { left, right: written.map(l => `• ${l}`).join('\n') };

  const wording = cv.adequacy_typed === false ? lines(cv.adequacy_wording) : [];
  const caps = wording.length ? wording : capabilities(cv);
  const right = [paragraph(cv, P), `As ${aOrAn(position)} ${position}, ${P.he} ${P.is}:`, ...caps.map(l => `• ${l}`)].join('\n');
  return { left, right };
}

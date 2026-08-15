// Shared placeholder values for the 3(A) and 3(B) auto-fill templates.
//
// Both template files derived the same figures independently — firm, client,
// occupations, trainees, districts — so the two copies could drift. This is the
// single source; descriptionTemplates.js and specificTemplates.js both build on it.
//
// Everything here is derived from data already entered on the assignment, which
// is the point of the templates: the prose is written once per firm, never
// retyped per assignment.

/** "A", "A and B", "A, B and C" */
export const listAnd = (items) => items.length <= 1
  ? (items[0] || '')
  : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

export function buildTemplateValues(form, institute, clients) {
  const client = (clients || []).find(c => c.id === form.clientId) || {};
  const firm = institute?.acronym || institute?.name || '';
  const occs = (form.occupations || []).filter(o => o.nameInLetter);
  const totalTrainees = occs.reduce((s, o) => s + (parseInt(o.trainees) || 0), 0) || '';
  const allDistricts = [...new Set(
    occs.flatMap(o => (o.locations || []).map(l => l.district).filter(Boolean))
  )];
  const firstOcc = occs[0] || {};
  const t = totalTrainees || '—';

  const hasSkillTest  = occs.some(o => o.skillTestProvisioned);
  const hasEmployment = occs.some(o => o.employmentProvisioned);

  // How many actually sat the skill test. Falls back to the trainee count when
  // only the provision is recorded and no attendance figure was entered.
  const appeared = occs.reduce((s, o) => s + (parseInt(o.skillTestAppeared) || 0), 0);
  const skillTestCount = appeared || (hasSkillTest ? (totalTrainees || 0) : 0);

  // employmentActual is employment_actual_pct — a percentage per occupation, so
  // aggregating means weighting by cohort size. Averaging the percentages of a
  // 200-trainee and a 20-trainee occupation would overstate the small one.
  let weighted = 0, covered = 0;
  const plainPcts = [];
  for (const o of occs) {
    const pct = parseFloat(o.employmentActual);
    if (isNaN(pct)) continue;
    plainPcts.push(pct);
    const tr = parseInt(o.trainees) || 0;
    if (tr > 0) { weighted += pct * tr; covered += tr; }
  }
  const placementPct = covered > 0
    ? Math.round(weighted / covered)
    : plainPcts.length
      ? Math.round(plainPcts.reduce((s, n) => s + n, 0) / plainPcts.length)
      : null;

  // Steps 6 and 7 of the service sequence, in four shapes because the variations
  // differ in structure. Assembled rather than substituted so the sentence stays
  // grammatical when either figure is absent — a bare "{x}" would leave a
  // dangling ", and" on assignments that recorded neither.
  const inline = [], sentence = [], bullets = [], terse = [];
  if (skillTestCount) {
    inline.push(`skill test was conducted for ${skillTestCount}`);
    sentence.push(`Skill test was conducted for ${skillTestCount} trainees`);
    bullets.push(`• Skill test was conducted for ${skillTestCount} trainees.`);
    terse.push(`skill test for ${skillTestCount}`);
  }
  if (placementPct != null) {
    inline.push(`achieved (${placementPct}%) of verified employment placement`);
    sentence.push(`${placementPct}% verified employment placement was achieved`);
    bullets.push(`• ${placementPct}% verified employment placement was achieved.`);
    terse.push(`${placementPct}% verified employment placement`);
  }

  // Step 5. Only some programmes run an on-the-job phase — EVENT, RERP/SAMRIDDHI
  // and ENSSURE — so it is driven by a flag on the client rather than assumed.
  const hasOjt = !!client.includesOjt;

  const districtsPhrase = allDistricts.length ? allDistricts.join(', ') : 'targeted areas';
  const occupationsWithCounts = occs.length
    ? listAnd(occs.map(o => {
        const n = parseInt(o.trainees) || 0;
        return n ? `${o.nameInLetter} training to ${n} participants` : `${o.nameInLetter} training`;
      }))
    : 'the proposed occupations';

  return {
    firm,
    client: client.shortName || client.fullName || form.clientName || '',
    occupations: occs.map(o => o.nameInLetter).join(', ') || '',
    totalTrainees: t,
    locations: allDistricts.join(', ') || '—',
    numDistricts: allDistricts.length || '—',
    durationHours: firstOcc.duration || '—',
    durationDays: form.durationDays || '—',
    numGroups: form.numGroups || '—',
    level: firstOcc.level || '—',
    assignmentName: form.assignmentName || '—',

    // Conditional bullet lines used by the older bullet-style variations
    skillTestLine:     hasSkillTest  ? `• Conducted Skill Test for all ${t} trainees.` : '',
    skillTestNSTBLine: hasSkillTest  ? '• Arranged and managed skills testing together with NSTB.' : '',
    employmentLine:    hasEmployment ? '• Provided Job placement and business start-up support to the training graduates.' : '',

    // Sequence-style values (S13–S17 and V13–V17)
    districtsPhrase,
    occupationsWithCounts,
    outcomeClause:   inline.length   ? `, and ${inline.join(' and ')}` : '',
    outcomeSentence: sentence.length ? ` ${sentence.join(' and ')}.` : '',
    outcomeBullets:  bullets.length  ? `\n${bullets.join('\n')}` : '',
    outcomeTerse:    terse.length    ? `, with ${listAnd(terse)}` : '',
    ojtClauseWe:       hasOjt ? ' Trainees then completed on-the-job training with relevant enterprises.' : '',
    ojtClausePassive:  hasOjt ? ' On-the-job training was subsequently arranged with relevant enterprises.' : '',
    ojtClauseStage:    hasOjt ? ' On-the-job training with relevant enterprises followed the classroom phase.' : '',
    ojtClauseTrailing: hasOjt ? ', followed by on-the-job training with relevant enterprises' : '',
    ojtBullet:         hasOjt ? '\n• Arranged on-the-job training with relevant enterprises.' : '',
    ojtTerse:          hasOjt ? ', followed by on-the-job training' : '',
  };
}

/** Substitute {placeholders}, drop lines emptied by conditionals, tidy whitespace. */
export function applyTemplate(preview, vals) {
  return preview
    .replace(/\{(\w+)\}/g, (_, k) => vals[k] ?? `{${k}}`)
    .split('\n').filter(line => line.trim() !== '').join('\n')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

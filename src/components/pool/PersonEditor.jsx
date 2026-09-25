import { useState, useMemo, useRef } from 'react';
import { ErrorBanner } from '../ui/Modal.jsx';
import { Btn } from '../../md.jsx';
import { GENERAL_LEVELS, VOCATIONAL_LEVELS, levelOfQualification,
         labelOfGeneral } from '../../constants/education.js';
import { PERSON_TYPES, TRAINING_KINDS, FLUENCY, BLANK_PERSON, emptyGeneral, emptyVocational,
         emptyTraining, emptyExp, emptyLang, sectionOf, DEFAULT_LANGUAGES, TOT_TITLE,
         maskBsDate, isBsDate, bsDaysBetween } from './common.js';
import Select from '../ui/Select.jsx';

/**
 * Adding or editing someone in the pool, as one page.
 *
 * Everything is on one scroll rather than behind five tabs: a record is typed
 * from a stack of certificates in one sitting, and tabs hid whether a section
 * had been done at all. The rail jumps between sections and says what each
 * holds. Each certificate is one compact row, and the education toggle means a
 * degree asks only what a degree needs and an NSTB certificate only what that
 * needs.
 */
export default function PersonEditor({ person, rules, occupations, onSave, onCancel }) {
  const isNew = !person?.id;
  const [form, setForm] = useState(() => ({
    ...BLANK_PERSON, ...(person || {}),
    // A person loaded from the server may predate these, and every section maps
    // over them unconditionally.
    // Nepali and English are on every CV here; anything else is added.
    languages: person?.languages?.length ? person.languages : DEFAULT_LANGUAGES(),
    qualifications: person?.qualifications || [],
    experience: person?.experience || [],
    occupation_overrides: person?.occupation_overrides || [],
  }));
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  // Opens on whichever stream the person already has more of.
  const [stream, setStream] = useState(() => {
    const qs = person?.qualifications || [];
    const v = qs.filter(q => sectionOf(q) === 'vocational').length;
    const g = qs.filter(q => sectionOf(q) === 'general').length;
    return v > g ? 'vocational' : 'general';
  });
  const [occQuery, setOccQuery] = useState('');
  // Usually the same as permanent; ticked only when it is not.
  const [tempDifferent, setTempDifferent] = useState(() => !!person?.temporary_address
    && String(person.temporary_address).trim() !== String(person.permanent_address || '').trim());
  const refs = { personal: useRef(null), education: useRef(null), training: useRef(null),
                 experience: useRef(null), cv: useRef(null), trades: useRef(null) };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setRow = (key, i, k, v) =>
    setForm(f => ({ ...f, [key]: f[key].map((r, idx) => idx === i ? { ...r, [k]: v } : r) }));
  const addRow = (key, row) => setForm(f => ({ ...f, [key]: [...f[key], row] }));
  const delRow = (key, i) => setForm(f => ({ ...f, [key]: f[key].filter((_, idx) => idx !== i) }));

  // Indices kept alongside, so a row in one list still writes to its real place
  // in the single array the server saves.
  const quals = form.qualifications.map((q, i) => ({ q, i }));
  const general = quals.filter(({ q }) => sectionOf(q) === 'general');
  const vocational = quals.filter(({ q }) => sectionOf(q) === 'vocational');
  const trainings = quals.filter(({ q }) => sectionOf(q) === 'training');

  const overrideFor = (id) => form.occupation_overrides.find(o => String(o.occupation_id) === String(id));
  const setOverride = (id, mode) => setForm(f => {
    const rest = f.occupation_overrides.filter(o => String(o.occupation_id) !== String(id));
    return { ...f, occupation_overrides: mode ? [...rest, { occupation_id: id, mode }] : rest };
  });
  const shownOccupations = useMemo(() => {
    const needle = occQuery.trim().toLowerCase();
    // The ones already set float to the top, so an exception is never lost in a list of hundreds.
    const list = needle
      ? occupations.filter(o => o.name.toLowerCase().includes(needle) || (o.sector || '').toLowerCase().includes(needle))
      : occupations;
    return [...list].sort((a, b) => (overrideFor(b.id) ? 1 : 0) - (overrideFor(a.id) ? 1 : 0));
  }, [occupations, occQuery, form.occupation_overrides]);

  /** Anything that would print wrong on a CV, said before saving rather than after. */
  const problems = () => {
    const out = [];
    if (!form.full_name.trim()) out.push({ at: 'personal', msg: 'A full name is required.' });
    const badYear = form.qualifications.find(q => q.passed_year && !/^\d{4}$/.test(String(q.passed_year).trim()));
    if (badYear) out.push({ at: sectionOf(badYear) === 'training' ? 'training' : 'education',
      msg: `“${badYear.passed_year}” is not a year — write it as four digits, e.g. 2072.` });
    if (form.date_of_birth && !isBsDate(form.date_of_birth)) {
      out.push({ at: 'personal', msg: `Date of birth “${form.date_of_birth}” is not complete — write it as 2058/09/11.` });
    }
    const badTot = form.qualifications.find(q => q.kind === 'TOT'
      && ((q.start_date && !isBsDate(q.start_date)) || (q.end_date && !isBsDate(q.end_date))
        || (isBsDate(q.start_date) && isBsDate(q.end_date) && q.end_date < q.start_date)));
    if (badTot) out.push({ at: 'training', msg: 'A TOT’s dates need to be complete (2076/04/01), and it cannot end before it starts.' });
    const noLevel = form.qualifications.find(q => sectionOf(q) === 'vocational' && !q.level);
    if (noLevel) out.push({ at: 'education', msg: 'A vocational certificate needs its level.' });
    return out;
  };

  const save = async (andAnother = false) => {
    const found = problems();
    if (found.length) {
      setErr(found[0].msg);
      refs[found[0].at]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    setErr(''); setSaving(true);
    try {
      await onSave({ ...form,
        temporary_address: tempDifferent ? form.temporary_address : form.permanent_address }, { andAnother });
      if (andAnother) {
        // Keep the role, since a batch is usually one kind of person.
        setForm({ ...BLANK_PERSON, person_type: form.person_type, languages: DEFAULT_LANGUAGES() });
        setTempDifferent(false);
        refs.personal.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch (e) { setErr(e.message || 'Could not save.'); }
    finally { setSaving(false); }
  };

  const jump = (key) => refs[key]?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const rail = [
    { key: 'personal', label: 'Personal', sum: form.full_name.trim() || 'Name and identity' },
    { key: 'education', label: 'Education',
      sum: general.length || vocational.length
        ? [general.length && `${general.length} general`, vocational.length && `${vocational.length} vocational`].filter(Boolean).join(' · ')
        : 'Degrees and NSTB certificates' },
    { key: 'training', label: 'Training & TOT',
      sum: trainings.length ? `${trainings.length} recorded` : 'Short courses and TOT' },
    { key: 'experience', label: 'Experience',
      sum: form.experience.length ? `${form.experience.length} position${form.experience.length === 1 ? '' : 's'}` : 'Where they have worked' },
    { key: 'cv', label: 'For the CV', sum: 'Profession, languages' },
    { key: 'trades', label: 'Exceptions',
      sum: form.occupation_overrides.length ? `${form.occupation_overrides.length} set` : 'Only when the rules are wrong' },
  ];

  return (
    <div className="fade-in">
      <div className="tw-head">
        <div style={{ minWidth: 0, flex: 1 }}>
          <button type="button" className="tw-back" onClick={onCancel}>← {isNew ? 'Trainer pool' : person.full_name}</button>
          <h1 className="tw-title">{isNew ? 'Add to the pool' : `Edit ${person.full_name}`}</h1>
          <div className="tw-meta">Type it off the certificates. Only the name is required — the rest can follow.</div>
        </div>
      </div>

      <div className="tw">
        <ol className="tw-rail" aria-label="Sections">
          {rail.map((s, i) => (
            <li key={s.key}>
              <button type="button" className="tw-step" onClick={() => jump(s.key)}
                aria-label={`${s.label}: ${s.sum}`}>
                <span className="tw-step-n">{i + 1}</span>
                <span className="tw-step-label">{s.label}</span>
                <span className="tw-step-sum">{s.sum}</span>
              </button>
            </li>
          ))}
        </ol>

        <div className="tw-panel">
          <ErrorBanner msg={err} onDismiss={() => setErr('')} />

          {/* ── Personal ── */}
          <section ref={refs.personal} className="pf-section">
            <h2 className="tw-panel-title">Personal details</h2>
            <div className="pf-grid pf-grid-3">
              <Field label="Role in the pool" group>
                <div className="tw-seg" role="group" aria-label="Role in the pool">
                  {PERSON_TYPES.map(t => (
                    <button key={t} type="button" aria-pressed={form.person_type === t}
                      onClick={() => set('person_type', t)}>{t}</button>
                  ))}
                </div>
              </Field>
              <Field label="Full name *">
                <input className="tw-in" value={form.full_name} autoFocus={isNew}
                  onChange={e => set('full_name', e.target.value)} placeholder="As on the citizenship" />
              </Field>
              <Field label="Name in Nepali">
                <input className="tw-in" value={form.full_name_np || ''} onChange={e => set('full_name_np', e.target.value)} />
              </Field>
              <Field label="Phone">
                <input className="tw-in" type="tel" value={form.phone || ''} onChange={e => set('phone', e.target.value)} />
              </Field>
              <Field label="Email">
                <input className="tw-in" type="email" value={form.email || ''} onChange={e => set('email', e.target.value)} />
              </Field>
              <Field label="Father's name">
                <input className="tw-in" value={form.father_name || ''} onChange={e => set('father_name', e.target.value)} />
              </Field>
              <Field label="Grandfather's name">
                <input className="tw-in" value={form.grandfather_name || ''} onChange={e => set('grandfather_name', e.target.value)} />
              </Field>
              <Field label="Gender">
                <Select className="tw-in" value={form.gender || ''} onChange={e => set('gender', e.target.value)}>
                  <option value="">Not recorded</option>
                  <option>Female</option><option>Male</option><option>Other</option>
                </Select>
              </Field>
              <Field label="Citizenship number">
                <input className="tw-in" value={form.citizenship_no || ''} onChange={e => set('citizenship_no', e.target.value)} />
              </Field>
              <Field label="Issued in district">
                <input className="tw-in" value={form.citizenship_district || ''} onChange={e => set('citizenship_district', e.target.value)} />
              </Field>
              <Field label="Date of birth (BS)">
                <input className="tw-in" value={form.date_of_birth || ''} placeholder="2058/09/11" inputMode="numeric"
                  maxLength={10} onChange={e => set('date_of_birth', maskBsDate(e.target.value))} />
              </Field>
            </div>
            <div className="pf-grid pf-grid-2">
              <Field label="Permanent address">
                <input className="tw-in" value={form.permanent_address || ''} onChange={e => set('permanent_address', e.target.value)} />
              </Field>
              {tempDifferent ? (
                <Field label="Temporary address">
                  <input className="tw-in" value={form.temporary_address || ''} autoFocus
                    onChange={e => set('temporary_address', e.target.value)} />
                </Field>
              ) : (
                <Field label="Temporary address" group>
                  <div className="tw-in pf-mirror" aria-live="polite">
                    {form.permanent_address?.trim() || <span className="pf-hint">Same as permanent</span>}
                  </div>
                </Field>
              )}
            </div>
            <label className="pf-check" style={{ marginBottom: 8 }}>
              <input type="checkbox" checked={tempDifferent}
                onChange={e => { setTempDifferent(e.target.checked);
                  // Start from the permanent address, since a temporary one is often a variation of it.
                  if (e.target.checked && !form.temporary_address) set('temporary_address', form.permanent_address || ''); }} />
              Temporary address is different from permanent
            </label>
            <Field label="Remarks">
              <input className="tw-in" value={form.remarks || ''} onChange={e => set('remarks', e.target.value)} />
            </Field>
            <label className="pf-check">
              <input type="checkbox" checked={form.is_active !== false} onChange={e => set('is_active', e.target.checked)} />
              Available to propose — untick for someone who has left, without deleting their record
            </label>
          </section>

          {/* ── Education ── */}
          <section ref={refs.education} className="pf-section">
            <div className="tw-section-head">
              <h2 className="tw-panel-title" style={{ margin: 0 }}>Education</h2>
              <span style={{ flex: 1 }} />
              <div className="tw-seg" role="group" aria-label="Which kind of education">
                <button type="button" aria-pressed={stream === 'general'} onClick={() => setStream('general')}>
                  General<span className="tw-seg-n">{general.length}</span></button>
                <button type="button" aria-pressed={stream === 'vocational'} onClick={() => setStream('vocational')}>
                  Vocational<span className="tw-seg-n">{vocational.length}</span></button>
              </div>
            </div>
            <p className="tw-hint" style={{ margin: '0 0 12px' }}>
              {stream === 'general'
                ? 'School and university: SLC, TSLC, JTA, +2, Diploma, Bachelor, Master, MPhil, PhD. A tender’s minimum education is checked against these.'
                : 'National Skill Testing Board certificates, Level 1 to 4, and technician certificates. The trade on the certificate is what they can train.'}
            </p>

            {stream === 'general' ? (<>
              {general.length === 0 && <div className="tw-empty">No general education yet — pick the level below.</div>}
              {general.map(({ q, i }) => {
                const guessed = !q.education_level && levelOfQualification(q);
                return (
                  <div key={i} className="pf-row">
                    <div className="pf-line pf-line-gen1">
                      <Field label="Level">
                        <Select className="tw-in" value={q.education_level || ''}
                          onChange={e => setRow('qualifications', i, 'education_level', e.target.value)}>
                          <option value="">{guessed ? `${labelOfGeneral(guessed)} (from title)` : 'Choose…'}</option>
                          {GENERAL_LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                        </Select>
                      </Field>
                      <Field label="Course / faculty">
                        <input className="tw-in" value={q.title || ''} placeholder="e.g. Diploma in Civil Engineering"
                          onChange={e => setRow('qualifications', i, 'title', e.target.value)} />
                      </Field>
                      <Field label="Passed (BS)">
                        <input className="tw-in num" value={q.passed_year || ''} placeholder="2072" inputMode="numeric"
                          onChange={e => setRow('qualifications', i, 'passed_year', e.target.value)} />
                      </Field>
                      <Field label="Division / %">
                        <input className="tw-in" value={q.division || ''} placeholder="First"
                          onChange={e => setRow('qualifications', i, 'division', e.target.value)} />
                      </Field>
                      <RemoveBtn label="this qualification" onClick={() => delRow('qualifications', i)} />
                    </div>
                    <div className="pf-line pf-line-gen2">
                      <Field label="College / institute">
                        <input className="tw-in" value={q.institution || ''}
                          onChange={e => setRow('qualifications', i, 'institution', e.target.value)} />
                      </Field>
                      <Field label="Board / university">
                        <input className="tw-in" value={q.board || ''} placeholder="e.g. TU, CTEVT, NEB"
                          onChange={e => setRow('qualifications', i, 'board', e.target.value)} />
                      </Field>
                      <Field label="Qualifies them to train" hint="Pick the rule that turns this degree into trades.">
                        <Select className="tw-in" value={q.rule_id || ''}
                          onChange={e => setRow('qualifications', i, 'rule_id', e.target.value)}>
                          <option value="">Nothing on its own</option>
                          {rules.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </Select>
                      </Field>
                    </div>
                  </div>
                );
              })}
              <div className="tw-chips" style={{ marginTop: 8 }}>
                <span className="tw-hint">Add:</span>
                {GENERAL_LEVELS.map(l => (
                  <button key={l.value} type="button" className="tw-chip"
                    onClick={() => addRow('qualifications', emptyGeneral(l.value))}>+ {l.label}</button>
                ))}
              </div>
            </>) : (<>
              {vocational.length === 0 && <div className="tw-empty">No NSTB certificates yet — pick the level below.</div>}
              {vocational.map(({ q, i }) => (
                <div key={i} className="pf-row">
                  <div className="pf-line pf-line-voc">
                    <Field label="Level">
                      <Select className="tw-in" value={q.level || ''}
                        onChange={e => setRow('qualifications', i, 'level', e.target.value)}>
                        <option value="">Choose…</option>
                        {VOCATIONAL_LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                      </Select>
                    </Field>
                    <Field label="Trade on the certificate">
                      <Select className="tw-in" value={q.occupation_id || ''}
                        onChange={e => setRow('qualifications', i, 'occupation_id', e.target.value)}>
                        <option value="">Choose the occupation…</option>
                        {occupations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </Select>
                    </Field>
                    <Field label="Passed (BS)">
                      <input className="tw-in num" value={q.passed_year || ''} placeholder="2074" inputMode="numeric"
                        onChange={e => setRow('qualifications', i, 'passed_year', e.target.value)} />
                    </Field>
                    <RemoveBtn label="this certificate" onClick={() => delRow('qualifications', i)} />
                  </div>
                  <div className="pf-line pf-line-voc2">
                    <Field label="Certificate number">
                      <input className="tw-in" value={q.certificate_no || ''}
                        onChange={e => setRow('qualifications', i, 'certificate_no', e.target.value)} />
                    </Field>
                    <Field label="Tested by">
                      <input className="tw-in" value={q.board || ''} placeholder="NSTB"
                        onChange={e => setRow('qualifications', i, 'board', e.target.value)} />
                    </Field>
                    <Field label="Training institute">
                      <input className="tw-in" value={q.institution || ''} placeholder="Where they trained, if known"
                        onChange={e => setRow('qualifications', i, 'institution', e.target.value)} />
                    </Field>
                  </div>
                </div>
              ))}
              <div className="tw-chips" style={{ marginTop: 8 }}>
                <span className="tw-hint">Add:</span>
                {VOCATIONAL_LEVELS.map(l => (
                  <button key={l.value} type="button" className="tw-chip"
                    onClick={() => addRow('qualifications', emptyVocational(l.value))}>+ {l.label}</button>
                ))}
              </div>
            </>)}
          </section>

          {/* ── Training & TOT ── */}
          <section ref={refs.training} className="pf-section">
            <h2 className="tw-panel-title">Training &amp; TOT</h2>
            <p className="tw-hint" style={{ margin: '0 0 12px' }}>
              Short courses and Training of Trainers. A tender asking for “computer training” is matched against these titles.
            </p>
            {trainings.length === 0 && <div className="tw-empty">None yet.</div>}
            {trainings.map(({ q, i }) => (
              <div key={i} className="pf-row">
                <div className={`pf-line pf-line-trn${q.kind === 'TOT' ? ' is-tot' : ''}`}>
                  <Field label="Kind">
                    <Select className="tw-in" value={q.kind}
                      onChange={e => { const k = e.target.value;
                        setRow('qualifications', i, 'kind', k);
                        if (k === 'TOT' && !String(q.title || '').trim()) setRow('qualifications', i, 'title', TOT_TITLE); }}>
                      {TRAINING_KINDS.map(k => <option key={k}>{k}</option>)}
                    </Select>
                  </Field>
                  <Field label="Title">
                    <input className="tw-in" value={q.title || ''} placeholder={q.kind === 'TOT' ? TOT_TITLE : 'e.g. Basic Computer Application'}
                      onChange={e => setRow('qualifications', i, 'title', e.target.value)} />
                  </Field>
                  {q.kind === 'TOT' ? (() => {
                    const auto = bsDaysBetween(q.start_date, q.end_date);
                    return (<>
                      <Field label="Start (BS)">
                        <input className="tw-in" value={q.start_date || ''} placeholder="2076/04/01" inputMode="numeric" maxLength={10}
                          onChange={e => setRow('qualifications', i, 'start_date', maskBsDate(e.target.value))} />
                      </Field>
                      <Field label="End (BS)">
                        <input className="tw-in" value={q.end_date || ''} placeholder="2076/04/21" inputMode="numeric" maxLength={10}
                          onChange={e => setRow('qualifications', i, 'end_date', maskBsDate(e.target.value))} />
                      </Field>
                      <Field label="Days" hint={auto ? 'Counted from the dates' : undefined}>
                        <input className="tw-in num" value={auto ?? (q.duration_days || '')} readOnly={auto != null}
                          inputMode="numeric" placeholder="21"
                          onChange={e => setRow('qualifications', i, 'duration_days', e.target.value.replace(/\D/g, ''))} />
                      </Field>
                    </>);
                  })() : (<>
                  <Field label="Duration">
                    <input className="tw-in" value={q.duration_text || ''} placeholder="e.g. 10 days"
                      onChange={e => setRow('qualifications', i, 'duration_text', e.target.value)} />
                  </Field>
                  <Field label="Year (BS)">
                    <input className="tw-in num" value={q.passed_year || ''} placeholder="2076" inputMode="numeric"
                      onChange={e => setRow('qualifications', i, 'passed_year', e.target.value)} />
                  </Field>
                  </>)}
                  <RemoveBtn label="this training" onClick={() => delRow('qualifications', i)} />
                </div>
                <div className="pf-line pf-line-gen2">
                  <Field label="Given by">
                    <input className="tw-in" value={q.institution || ''}
                      onChange={e => setRow('qualifications', i, 'institution', e.target.value)} />
                  </Field>
                  <Field label="Certificate number">
                    <input className="tw-in" value={q.certificate_no || ''}
                      onChange={e => setRow('qualifications', i, 'certificate_no', e.target.value)} />
                  </Field>
                  <Field label="Qualifies them to train">
                    <Select className="tw-in" value={q.rule_id || ''}
                      onChange={e => setRow('qualifications', i, 'rule_id', e.target.value)}>
                      <option value="">Nothing on its own</option>
                      {rules.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </Select>
                  </Field>
                </div>
              </div>
            ))}
            <div className="tw-chips" style={{ marginTop: 8 }}>
              <button type="button" className="tw-chip" onClick={() => addRow('qualifications', emptyTraining('Training'))}>+ Training</button>
              <button type="button" className="tw-chip" onClick={() => addRow('qualifications', emptyTraining('TOT'))}>+ TOT certificate</button>
            </div>
          </section>

          {/* ── Experience ── */}
          <section ref={refs.experience} className="pf-section">
            <h2 className="tw-panel-title">Work experience</h2>
            <p className="tw-hint" style={{ margin: '0 0 12px' }}>
              Most recent first. Experience letters are attached from their profile once saved.
            </p>
            {form.experience.length === 0 && <div className="tw-empty">None yet.</div>}
            {form.experience.map((e, i) => (
              <div key={i} className="pf-row">
                <div className="pf-line pf-line-exp">
                  <Field label="Position">
                    <input className="tw-in" value={e.position || ''} placeholder="e.g. Main Trainer"
                      onChange={ev => setRow('experience', i, 'position', ev.target.value)} />
                  </Field>
                  <Field label="Organisation">
                    <input className="tw-in" value={e.organisation || ''}
                      onChange={ev => setRow('experience', i, 'organisation', ev.target.value)} />
                  </Field>
                  <Field label="From (BS)">
                    <input className="tw-in" value={e.from_date || ''} placeholder="2073/01/01"
                      onChange={ev => setRow('experience', i, 'from_date', maskBsDate(ev.target.value))} />
                  </Field>
                  <Field label="To (BS)">
                    <input className="tw-in" value={e.is_current ? '' : (e.to_date || '')} disabled={!!e.is_current}
                      placeholder={e.is_current ? 'Present' : '2078/12/30'}
                      onChange={ev => setRow('experience', i, 'to_date', maskBsDate(ev.target.value))} />
                  </Field>
                  <RemoveBtn label="this position" onClick={() => delRow('experience', i)} />
                </div>
                <div className="pf-line pf-line-gen2">
                  <Field label="Location">
                    <input className="tw-in" value={e.country || ''} placeholder="e.g. Kathmandu, Nepal"
                      onChange={ev => setRow('experience', i, 'country', ev.target.value)} />
                  </Field>
                  <Field label="Project">
                    <input className="tw-in" value={e.project_name || ''}
                      onChange={ev => setRow('experience', i, 'project_name', ev.target.value)} />
                  </Field>
                  <label className="pf-check" style={{ alignSelf: 'end', marginBottom: 8 }}>
                    <input type="checkbox" checked={!!e.is_current}
                      onChange={ev => setRow('experience', i, 'is_current', ev.target.checked)} />
                    Still working here
                  </label>
                </div>
                <Field label="What they did" hint="One task per line — each becomes a bullet on the CV.">
                  <textarea className="tw-in pf-area" rows={2} value={e.description || ''}
                    onChange={ev => setRow('experience', i, 'description', ev.target.value)} />
                </Field>
                <Field label="Reference">
                  <input className="tw-in" value={e.reference_text || ''} placeholder="Name, position and contact of someone who can vouch for this"
                    onChange={ev => setRow('experience', i, 'reference_text', ev.target.value)} />
                </Field>
              </div>
            ))}
            <div className="tw-chips" style={{ marginTop: 8 }}>
              <button type="button" className="tw-chip" onClick={() => addRow('experience', emptyExp())}>+ Position</button>
            </div>
          </section>

          {/* ── For the CV ── */}
          <section ref={refs.cv} className="pf-section">
            <details className="tw-more" style={{ borderTop: 'none', paddingTop: 0 }}>
              <summary>For the CV — profession and languages</summary>
              <div className="pf-grid pf-grid-2">
                <Field label="Profession">
                  <input className="tw-in" value={form.profession || ''} placeholder="e.g. Beautician"
                    onChange={e => set('profession', e.target.value)} />
                </Field>
              </div>
              <div className="tw-section-head" style={{ marginTop: 10 }}>
                <h3 className="tw-section-title">Languages</h3>
              </div>
              {form.languages.map((l, i) => (
                <div key={i} className="pf-line pf-line-lang">
                  <Field label="Language">
                    <input className="tw-in" value={l.language || ''} onChange={e => setRow('languages', i, 'language', e.target.value)} />
                  </Field>
                  {['speaking', 'reading', 'writing'].map(k => (
                    <Field key={k} label={k[0].toUpperCase() + k.slice(1)}>
                      <Select className="tw-in" value={l[k] || ''} onChange={e => setRow('languages', i, k, e.target.value)}>
                        <option value="">—</option>
                        {FLUENCY.map(f => <option key={f}>{f}</option>)}
                      </Select>
                    </Field>
                  ))}
                  <RemoveBtn label="this language" onClick={() => delRow('languages', i)} />
                </div>
              ))}
              <div className="tw-chips" style={{ marginTop: 6 }}>
                {DEFAULT_LANGUAGES().filter(d => !form.languages.some(l => l.language === d.language)).map(d => (
                  <button key={d.language} type="button" className="tw-chip"
                    onClick={() => addRow('languages', d)}>+ {d.language}</button>
                ))}
                <button type="button" className="tw-chip" onClick={() => addRow('languages', emptyLang())}>+ Add language</button>
              </div>
            </details>
          </section>

          {/* ── Exceptions ── */}
          <section ref={refs.trades} className="pf-section">
            <details className="tw-more" style={{ borderTop: 'none', paddingTop: 0 }}
              open={form.occupation_overrides.length > 0 || undefined}>
              <summary>Exceptions to what they can train{form.occupation_overrides.length ? ` · ${form.occupation_overrides.length} set` : ''}</summary>
              <p className="tw-hint" style={{ marginTop: 0 }}>
                What they can train is worked out from their certificates and the qualification rules.
                Use these only for the exceptions — field experience that earns a trade the rules do not
                grant, or a trade they must not be put forward for.
              </p>
              <input className="tw-in" style={{ marginBottom: 8 }} value={occQuery} aria-label="Search occupations"
                placeholder="Search occupations…" onChange={e => setOccQuery(e.target.value)} />
              <div className="tw-picker-list" style={{ maxHeight: 280 }}>
                {shownOccupations.map(o => {
                  const ov = overrideFor(o.id);
                  return (
                    <div key={o.id} className="tw-cand" style={{ background: 'var(--bg)' }}>
                      <span className="tw-cand-main">{o.name}<span className="tw-cand-sub"> · {o.sector}</span></span>
                      <div className="tw-seg" role="group" aria-label={`Exception for ${o.name}`}>
                        {[['add', 'Always'], ['remove', 'Never']].map(([mode, label]) => (
                          <button key={mode} type="button" aria-pressed={ov?.mode === mode}
                            onClick={() => setOverride(o.id, ov?.mode === mode ? null : mode)}>{label}</button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>
          </section>

          <div className="tw-foot">
            <Btn className="btn btn-ghost" onClick={onCancel}>Cancel</Btn>
            <span className="tw-foot-note" />
            {isNew && (
              <Btn className="btn btn-secondary" disabled={saving} onClick={() => save(true)}>
                Save and add another</Btn>
            )}
            <Btn className="btn btn-primary" disabled={saving} onClick={() => save(false)}>
              {saving ? 'Saving…' : isNew ? 'Save to the pool' : 'Save changes'}</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * A labelled input. A button group gets a plain container instead: a <label>
 * forwards clicks on its empty space to the first control inside it, so the
 * role toggle wrapped in one would flip back to its first choice.
 */
function Field({ label, hint, group, children }) {
  const Tag = group ? 'div' : 'label';
  return (
    <Tag className="pf-field">
      <span className="pf-label">{label}</span>
      {children}
      {hint && <span className="pf-hint">{hint}</span>}
    </Tag>
  );
}

function RemoveBtn({ label, onClick }) {
  return (
    <button type="button" className="tw-x pf-x" aria-label={`Remove ${label}`} onClick={onClick}>
      <span className="material-icons-round" style={{ fontSize: 17 }}>close</span>
    </button>
  );
}

import { useState, Fragment } from 'react';
import { ErrorBanner } from '../ui/Modal.jsx';
import { Btn } from '../../md.jsx';
import { OccupationPicker } from '../TrainerPool.jsx';
import { GENERAL_LEVELS, VOCATIONAL_LEVELS, labelOfGeneral, labelOfVocational } from '../../constants/education.js';
import { acceptedOf, describeAccepted } from '../../utils/hrFit.js';
import { COMMON_POSITIONS, emptyPosition, isTrainer, totalNeeded } from './common.js';
import Select from '../ui/Select.jsx';

/**
 * Step 2 — what the notice asks for.
 *
 * The trades first, because the trainer numbers hang off them; then the posts.
 * Each post is one line — title, how many, and the bar — so a notice with a
 * dozen posts still fits on a screen and reads the way the notice lists them.
 */
export default function RequirementsStep({ tender, occupations, onSave, footer }) {
  const [occIds, setOccIds] = useState(() => (tender.occupations || []).map(o => o.id));
  const [positions, setPositions] = useState(() => (tender.positions || []).map(p => ({ ...p,
    // A post saved with one general minimum opens as one alternative, so it is
    // edited the same way as any other and saved in the one shape.
    education_options: acceptedOf(p) })));
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedOccupations = occupations.filter(o => occIds.some(id => String(id) === String(o.id)));
  const toggleOcc = (id) => setOccIds(ids => ids.some(x => String(x) === String(id))
    ? ids.filter(x => String(x) !== String(id)) : [...ids, id]);

  const setRow = (i, k, v) => setPositions(ps => ps.map((p, n) => n === i ? { ...p, [k]: v } : p));
  const drop = (i) => setPositions(ps => ps.filter((_, n) => n !== i));
  const add = (category, extra) => setPositions(ps => [...ps, emptyPosition(category, extra)]);
  /** Give every trade on the notice the same post, in one go. */
  const addToEveryTrade = (title) => setPositions(ps => [...ps,
    ...selectedOccupations.map(o => ({ ...emptyPosition('Trainer'), occupation_id: o.id, title }))]);

  const indexed = positions.map((p, i) => ({ p, i }));
  const experts = indexed.filter(({ p }) => !isTrainer(p));
  const trainers = indexed.filter(({ p }) => isTrainer(p));
  const sameOcc = (a, b) => String(a || '') === String(b || '');

  /*
   * A group per trade on the notice, then any leftovers.
   *
   * Rows for a trade that has since been unticked are not dropped — the notice
   * can be edited after the team is set, and silently deleting a requirement
   * somebody is already assigned to would lose the assignment with it.
   */
  const trainerGroups = [
    ...selectedOccupations.map(o => ({ key: String(o.id), label: o.name, occupation_id: o.id,
      rows: trainers.filter(({ p }) => sameOcc(p.occupation_id, o.id)) })),
    { key: 'any', label: 'Not tied to a trade', occupation_id: '',
      rows: trainers.filter(({ p }) => !p.occupation_id) },
    { key: 'orphan', label: 'No longer on this notice', occupation_id: null, orphan: true,
      rows: trainers.filter(({ p }) => p.occupation_id
        && !selectedOccupations.some(o => sameOcc(p.occupation_id, o.id))) },
  ].filter(g => g.rows.length > 0 || (g.key !== 'any' && !g.orphan));

  const save = async () => {
    const unnamed = positions.filter(p => !String(p.title || '').trim()).length;
    if (unnamed) return setErr(`${unnamed} post${unnamed === 1 ? ' has' : 's have'} no title — name ${unnamed === 1 ? 'it' : 'them'} or remove ${unnamed === 1 ? 'it' : 'them'}.`);
    setErr(''); setSaving(true);
    try { await onSave({ occupation_ids: occIds,
      positions: positions.map(p => ({ ...p, min_education: null })) }); }
    catch (e) { setErr(e.message || 'Could not save the requirements.'); }
    finally { setSaving(false); }
  };

  return (
    <>
      <h2 className="tw-panel-title">What the notice asks for</h2>
      <p className="tw-panel-lede">
        The trades it covers and the team it wants. Every bidder answers this same list, and the
        Team step checks the pool against it.
      </p>
      <ErrorBanner msg={err} onDismiss={() => setErr('')} />

      <section className="tw-section">
        <div className="tw-section-head">
          <h3 className="tw-section-title">Trades</h3>
          {selectedOccupations.length > 0 && <span className="tw-count">{selectedOccupations.length}</span>}
        </div>
        <OccupationPicker occupations={occupations} selected={occIds} height={160} onToggle={toggleOcc} />
        {/* Below the list, never above it: a row inserted above shifts every
            checkbox down, and the next tick lands on the wrong trade. */}
        {selectedOccupations.length > 0 && (
          <div className="tw-people">
            {selectedOccupations.map(o => (
              <span key={o.id} className="tw-person">
                {o.name}
                <button type="button" aria-label={`Remove ${o.name}`} onClick={() => toggleOcc(o.id)}>
                  <span className="material-icons-round" style={{ fontSize: 15 }}>close</span>
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="tw-section">
        <div className="tw-section-head">
          <h3 className="tw-section-title">Key experts</h3>
          {experts.length > 0 && <span className="tw-count">{totalNeeded(experts.map(x => x.p))} needed</span>}
          <span className="tw-hint">Named once for the whole bid, whatever trades it covers.</span>
        </div>
        <PostTable rows={experts} setRow={setRow} drop={drop} listId="pos-experts"
          titles={COMMON_POSITIONS['Key expert']} />
        <div className="tw-chips" style={{ marginTop: 8 }}>
          {COMMON_POSITIONS['Key expert']
            .filter(t => !experts.some(({ p }) => p.title === t))
            .map(t => (
              <button key={t} type="button" className="tw-chip" onClick={() => add('Key expert', { title: t })}>
                + {t}</button>
            ))}
          <button type="button" className="tw-chip" onClick={() => add('Key expert')}>+ Other post</button>
        </div>
      </section>

      <section className="tw-section">
        <div className="tw-section-head">
          <h3 className="tw-section-title">Trainers &amp; instructors</h3>
          {trainers.length > 0 && <span className="tw-count">{totalNeeded(trainers.map(x => x.p))} needed</span>}
          <span className="tw-hint">
            {selectedOccupations.length > 1
              ? `Asked for per trade — this notice covers ${selectedOccupations.length}.`
              : 'How many of each the notice asks for.'}
          </span>
        </div>

        {selectedOccupations.length === 0 ? (
          <div className="tw-empty">
            Add the trades above first — each one gets its own trainer numbers here.
          </div>
        ) : selectedOccupations.length > 1 && (
          // Most notices want the same roles in every trade; typing them out per
          // trade is the same statement made N times.
          <div className="tw-chips" style={{ marginBottom: 12 }}>
            <span className="tw-hint">Same for every trade:</span>
            {COMMON_POSITIONS.Trainer.map(t => (
              <button key={t} type="button" className="tw-chip" onClick={() => addToEveryTrade(t)}>+ {t}</button>
            ))}
          </div>
        )}

        {trainerGroups.map(g => (
          <div key={g.key} className={`tw-trade${g.orphan ? ' is-orphan' : ''}`}>
            <div className="tw-section-head" style={{ marginBottom: 4 }}>
              <strong style={{ fontSize: 13, color: g.orphan ? 'var(--amber)' : 'var(--text)' }}>{g.label}</strong>
              {g.rows.length > 0 && <span className="tw-count">{totalNeeded(g.rows.map(x => x.p))}</span>}
            </div>
            {g.orphan && (
              <div className="tw-hint" style={{ marginBottom: 6 }}>
                These ask for a trade the notice no longer lists. Kept so nobody already assigned to them
                is lost — remove them, or add the trade back.
              </div>
            )}
            <PostTable rows={g.rows} setRow={setRow} drop={drop} listId={`pos-trade-${g.key}`}
              titles={COMMON_POSITIONS.Trainer} />
            {!g.orphan && g.occupation_id !== '' && (
              <div className="tw-chips" style={{ marginTop: 6 }}>
                {COMMON_POSITIONS.Trainer.slice(0, 3)
                  .filter(t => !g.rows.some(({ p }) => p.title === t))
                  .map(t => (
                    <button key={t} type="button" className="tw-chip"
                      onClick={() => add('Trainer', { occupation_id: g.occupation_id, title: t })}>+ {t}</button>
                  ))}
                <button type="button" className="tw-chip"
                  onClick={() => add('Trainer', { occupation_id: g.occupation_id })}>+ Other</button>
              </div>
            )}
          </div>
        ))}
      </section>

      {footer({
        primary: (
          <Btn className="btn btn-primary" disabled={saving} onClick={save}>
            {saving ? 'Saving…' : 'Save and continue →'}</Btn>
        ),
        note: 'Experience is counted from the year the qualifying degree was passed.',
      })}
    </>
  );
}

/** Posts as one line each. Empty when there are none, so the chips below speak. */
function PostTable({ rows, setRow, drop, listId, titles }) {
  // Which post's accepted-qualifications editor is open, by its row index.
  const [open, setOpen] = useState(null);
  if (!rows.length) return null;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="tw-table">
        <thead><tr>
          <th style={{ minWidth: 120 }}>Post</th>
          <th style={{ width: 62 }}>How many</th>
          <th style={{ minWidth: 180 }}>Accepted qualifications</th>
          <th style={{ width: 70 }}>Min. years</th>
          <th style={{ minWidth: 110 }}>Training required</th>
          <th style={{ width: 32 }} />
        </tr></thead>
        <tbody>
          {rows.map(({ p, i }) => (
            <Fragment key={p.id || `new-${i}`}>
              <tr>
                <td>
                  <input className="tw-in" value={p.title || ''} list={listId} aria-label="Post"
                    placeholder="e.g. Plumber" onChange={e => setRow(i, 'title', e.target.value)} />
                </td>
                <td>
                  <input className="tw-in num" type="number" min="1" aria-label="How many"
                    value={String(p.count ?? 1)} onChange={e => setRow(i, 'count', e.target.value)} />
                </td>
                <td>
                  <button type="button" className={`rq-summary${open === i ? ' is-open' : ''}`}
                    aria-expanded={open === i} onClick={() => setOpen(o => o === i ? null : i)}>
                    {describeAccepted(p) || <span className="tw-hint">Not stated — set it</span>}
                  </button>
                </td>
                <td>
                  <input className="tw-in num" type="number" min="0" aria-label="Minimum years of experience"
                    value={String(p.min_experience_years ?? '')} placeholder="—"
                    title="Applies to every alternative that does not state its own"
                    onChange={e => setRow(i, 'min_experience_years', e.target.value)} />
                </td>
                <td>
                  <input className="tw-in" aria-label="Training required" value={p.required_training || ''}
                    placeholder="e.g. Computer training"
                    onChange={e => setRow(i, 'required_training', e.target.value)} />
                </td>
                <td>
                  <button type="button" className="tw-x" aria-label={`Remove ${p.title || 'post'}`} onClick={() => drop(i)}>
                    <span className="material-icons-round" style={{ fontSize: 17 }}>close</span>
                  </button>
                </td>
              </tr>
              {open === i && (
                <tr><td colSpan={6} style={{ paddingBottom: 10 }}>
                  <AcceptedEditor post={p} onChange={alts => setRow(i, 'education_options', alts)} />
                </td></tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
      <datalist id={listId}>{titles.map(t => <option key={t} value={t} />)}</datalist>
    </div>
  );
}

/**
 * What a post accepts, built the way the notice writes it.
 *
 * "Diploma or PCL in related subject or NSTB Level-3 … OR Pre-Diploma in
 * related subject or NSTB Level-2" is two alternatives of two options each.
 * Any one alternative qualifies; within one, any option does. "Or equivalent"
 * needs no entry — a higher level on the same ladder always counts.
 */
function AcceptedEditor({ post, onChange }) {
  const alts = acceptedOf(post);
  const hasTrade = !!post.occupation_id;
  const put = (next) => onChange(next.filter(a => a.any.length || a.min_years != null));
  const setAlt = (ai, patch) => put(alts.map((a, n) => n === ai ? { ...a, ...patch } : a));
  const addOption = (ai, value) => {
    if (!value) return;
    const [ladder, level] = value.split('|');
    // "In related subject" is the norm for a trade post and meaningless for a key expert.
    const opt = { ladder, level, related: hasTrade };
    if (ai === alts.length) put([...alts, { any: [opt], min_years: null }]);
    else setAlt(ai, { any: [...alts[ai].any, opt] });
  };
  const dropOption = (ai, oi) => setAlt(ai, { any: alts[ai].any.filter((_, n) => n !== oi) });
  const toggleRelated = (ai, oi) => setAlt(ai, { any: alts[ai].any.map((o, n) => n === oi ? { ...o, related: !o.related } : o) });

  const picker = (ai) => (
    <Select className="tw-in rq-add" value="" aria-label="Add an accepted qualification"
      onChange={e => addOption(ai, e.target.value)}>
      <option value="">{ai === alts.length ? (alts.length ? '+ OR another alternative…' : '+ Add a qualification…') : '+ or…'}</option>
      <optgroup label="General">
        {GENERAL_LEVELS.map(l => <option key={l.value} value={`general|${l.value}`}>{l.label}</option>)}
      </optgroup>
      <optgroup label="NSTB skill test">
        {VOCATIONAL_LEVELS.map(l => <option key={l.value} value={`vocational|${l.value}`}>NSTB {l.label}</option>)}
      </optgroup>
    </Select>
  );

  return (
    <div className="rq-editor">
      {alts.map((a, ai) => (
        <div key={ai}>
          {ai > 0 && <div className="rq-or">OR</div>}
          <div className="rq-alt">
            <div className="rq-opts">
              {a.any.map((o, oi) => (
                <Fragment key={oi}>
                  {oi > 0 && <span className="rq-join">or</span>}
                  <span className={`rq-opt rq-${o.ladder}`}>
                    {o.ladder === 'vocational' ? `NSTB ${labelOfVocational(o.level)}` : labelOfGeneral(o.level)}
                    {o.ladder === 'general' && hasTrade && (
                      <button type="button" className={`rq-rel${o.related ? ' is-on' : ''}`} aria-pressed={!!o.related}
                        title="Must be in a subject related to this trade" onClick={() => toggleRelated(ai, oi)}>
                        related subject</button>
                    )}
                    <button type="button" className="rq-x" aria-label="Remove" onClick={() => dropOption(ai, oi)}>
                      <span className="material-icons-round" style={{ fontSize: 14 }}>close</span></button>
                  </span>
                </Fragment>
              ))}
              {picker(ai)}
            </div>
            <label className="rq-years">with
              <input className="tw-in num" type="number" min="0" value={a.min_years ?? ''} placeholder={post.min_experience_years || '—'}
                aria-label="Minimum years for this alternative"
                onChange={e => setAlt(ai, { min_years: e.target.value === '' ? null : parseInt(e.target.value, 10) })} />
              years</label>
          </div>
        </div>
      ))}
      <div style={{ marginTop: alts.length ? 8 : 0 }}>{picker(alts.length)}</div>
      <p className="tw-hint" style={{ margin: '8px 0 0' }}>
        Any one alternative qualifies. A higher level on the same ladder always counts, so
        “or equivalent” needs nothing extra.{hasTrade ? ' “Related subject” means a degree the rules count towards this trade, or an NSTB certificate in it.' : ''}
      </p>
    </div>
  );
}

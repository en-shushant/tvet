import { useState, useEffect, useMemo } from 'react';
import { Btn } from '../../md.jsx';
import { api } from '../../utils/api.js';
import { checkAgainstPosition, experienceYears, highestEducation, fitsTrainerLevel, criteriaChecks } from '../../utils/hrFit.js';
import { useOccupations } from '../../utils/useMasterData.js';
import { groupPositions, positionBar, need, teamProgress } from './common.js';
import Select from '../ui/Select.jsx';

/**
 * Step 4 — each bidder's team, filled post by post.
 *
 * People are put *into* a post rather than onto a list and then labelled: the
 * post already says the title, the trade and the bar, so the pool can be
 * narrowed to who meets them, and nothing about the post is typed twice.
 * Anyone not filling a stated post goes under "Other staff".
 */
export default function TeamStep({ tender, pool, variants, token, busy,
                                   activeBidder, setActiveBidder, onSaveTeam, footer }) {
  const bidders = tender.bidders || [];
  const active = bidders.find(b => b.id === activeBidder);
  const positions = tender.positions || [];
  const groups = useMemo(() => groupPositions(positions), [positions]);
  const wanted = (tender.occupations || []).map(o => o.id);

  const rowsFor = (id) => (tender.people || []).filter(p => p.bidder_id === id);
  const [rows, setRows] = useState(() => rowsFor(activeBidder));
  // The rows follow every reload; the open picker only closes on a change of
  // bidder. Every Assign reloads the tender, so tying both to the reload would
  // shut the picker after each person — filling "3 Main Trainers" would take
  // three trips back to the button.
  useEffect(() => { setRows(rowsFor(activeBidder)); }, [tender, activeBidder]);
  useEffect(() => { setOpenSlot(null); setEditing(null); }, [activeBidder]);

  // Which post's picker is open — a position id, 'other', or nothing.
  const [openSlot, setOpenSlot] = useState(null);
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  // Whose CV wording is being set, by row index.
  const [editing, setEditing] = useState(null);

  const save = (next) => { setRows(next); return onSaveTeam(activeBidder, next); };

  /**
   * Everyone this notice has already been promised, whichever bidder promised
   * them.
   *
   * One person cannot appear on two bids for the same notice: the bidders are
   * competing, and an evaluator who finds the same citizenship number on both
   * reads the teams as invented. So this is a rule, not a hint — the pool hides
   * them, and only the deliberate "show everyone" reveals them, marked.
   */
  const takenOnThisTender = useMemo(() => {
    const m = new Map();
    const everyone = [...(tender.people || []).filter(r => r.bidder_id !== activeBidder), ...rows];
    for (const r of everyone) {
      const b = bidders.find(x => x.id === (r.bidder_id ?? activeBidder));
      if (!m.has(r.person_id)) m.set(r.person_id, b?.display_name || 'another bidder');
    }
    return m;
  }, [tender, bidders, rows, activeBidder]);

  // Live bids elsewhere. Not forbidden the way a repeat on this notice is, but
  // promising the same person to two clients at once is worth seeing first.
  const [elsewhere, setElsewhere] = useState({});
  useEffect(() => {
    let alive = true;
    api('GET', `/tenders/proposed-elsewhere?exclude_tender_id=${tender.id}`, null, token)
      .then(list => {
        if (!alive) return;
        const m = {};
        for (const r of list || []) (m[r.person_id] ||= []).push(r);
        setElsewhere(m);
      })
      .catch(() => {});   // advisory only; never block assigning on it
    return () => { alive = false; };
  }, [tender.id, token]);

  const targetPosition = positions.find(p => p.id === openSlot) || null;
  const allOccupations = useOccupations();
  const available = useMemo(() =>
    pool.filter(p => !takenOnThisTender.has(p.id)), [pool, takenOnThisTender]);
  /**
   * Who fits the post being filled.
   *
   * A named post is a stricter question than the notice's trades: its own
   * minimums and its own trade decide. With no post — "Other staff" — anyone
   * who can cover a trade the notice asks for.
   */
  const matching = useMemo(() => {
    if (targetPosition) {
      const occ = allOccupations.find(o => o.id === targetPosition.occupation_id)
        || (targetPosition.occupation_id ? { id: targetPosition.occupation_id } : null);
      return available.filter(p => checkAgainstPosition(p, targetPosition).ok
        && fitsTrainerLevel(p, occ, allOccupations, targetPosition.title));
    }
    if (!wanted.length) return available;
    return available.filter(p => (p.eligible_occupations || []).some(o => wanted.includes(o.id)));
  }, [available, tender, targetPosition, allOccupations]);
  const q = query.trim().toLowerCase();
  const candidates = (showAll ? pool : matching)
    .filter(p => !q || String(p.full_name || '').toLowerCase().includes(q));

  const open = (slot) => { setOpenSlot(s => s === slot ? null : slot); setQuery(''); setShowAll(false); setEditing(null); };

  const assign = (p) => {
    const pos = targetPosition;
    const next = [...rows, { person_id: p.id, full_name: p.full_name, person_type: p.person_type,
      bidder_id: activeBidder, position_id: pos?.id || null,
      occupation_id: pos?.occupation_id
        || (p.eligible_occupations || []).find(o => wanted.includes(o.id))?.id || null,
      proposed_position: pos?.title || '' }];
    // Stay open while the post still has room.
    const filledNow = next.filter(r => r.position_id === pos?.id).length;
    if (!pos || filledNow >= need(pos)) setOpenSlot(null);
    save(next);
  };
  const unassign = (idx) => { setEditing(null); save(rows.filter((_, i) => i !== idx)); };

  // A JV can draw on either member firm's wording, plus the shared library.
  const firmIds = (active?.firms || []).map(f => f.institute_id);
  const variantsFor = (field, personType) => variants.filter(v =>
    v.field === field && (!v.person_type || v.person_type === personType)
    && (!v.institute_id || firmIds.includes(v.institute_id)));

  const progress = (b) => teamProgress(positions, b.id === activeBidder
    ? [...(tender.people || []).filter(r => r.bidder_id !== b.id), ...rows] : tender.people || [], b.id);

  const renderPeople = (list) => list.length > 0 && (
    <div className="tw-people">
      {list.map(({ r, idx }) => {
        const pos = positions.find(x => x.id === r.position_id);
        const person = pool.find(x => x.id === r.person_id);
        // Checked against the post after the fact too: the notice can be edited
        // once the team is set, and a slot filled by someone who no longer meets
        // its bar is exactly what this list exists to catch.
        const fit = pos && person ? checkAgainstPosition(person, pos) : null;
        return (
          <span key={r.id || `${r.person_id}-${idx}`} className={`tw-person${fit && !fit.ok ? ' is-short' : ''}`}
            title={fit && !fit.ok ? `Short of what the notice asks: ${fit.reasons.join('; ')}` : undefined}>
            {r.full_name}
            {fit && !fit.ok && <span className="tw-tag amber" style={{ margin: 0 }}>{fit.reasons[0]}</span>}
            <button type="button" aria-label={`CV wording for ${r.full_name}`}
              onClick={() => setEditing(e => e === idx ? null : idx)}>
              <span className="material-icons-round" style={{ fontSize: 15 }}>edit_note</span>
            </button>
            <button type="button" aria-label={`Remove ${r.full_name}`} disabled={busy} onClick={() => unassign(idx)}>
              <span className="material-icons-round" style={{ fontSize: 15 }}>close</span>
            </button>
          </span>
        );
      })}
    </div>
  );

  const renderEditor = (list) => {
    const hit = list.find(({ idx }) => idx === editing);
    if (!hit) return null;
    const { r, idx } = hit;
    const setField = (k, v) => setRows(rs => rs.map((x, i) => i === idx ? { ...x, [k]: v } : x));
    return (
      <div className="tw-picker">
        <div className="tw-section-head" style={{ marginBottom: 6 }}>
          <strong style={{ fontSize: 13 }}>{r.full_name} — how the CV reads</strong>
        </div>
        <div className="tw-grid-3">
          <label className="tw-hint">Proposed as
            <input className="tw-in" value={r.proposed_position || ''}
              onChange={e => setField('proposed_position', e.target.value)} />
          </label>
          {[['tasks_variant_id', 'detailed_tasks', 'Tasks assigned'],
            ['quals_variant_id', 'key_qualifications', 'Key qualifications']].map(([key, field, label]) => (
            <label key={key} className="tw-hint">{label}
              <Select className="tw-in" value={r[key] || ''} onChange={e => setField(key, e.target.value)}>
                <option value="">The person&apos;s own text</option>
                {variantsFor(field, r.person_type).map(v => (
                  <option key={v.id} value={v.id}>{v.institute_id ? v.label : `${v.label} (shared)`}</option>
                ))}
              </Select>
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <Btn className="btn btn-primary btn-sm" disabled={busy}
            onClick={async () => { await save(rows); setEditing(null); }}>Save</Btn>
          <Btn className="btn btn-ghost btn-sm" onClick={() => { setRows(rowsFor(activeBidder)); setEditing(null); }}>Cancel</Btn>
        </div>
      </div>
    );
  };

  const renderPicker = (slot) => openSlot === slot && (
    <div className="tw-picker">
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input className="tw-in" style={{ flex: 1, minWidth: 180 }} autoFocus value={query}
          placeholder="Search the pool by name…" aria-label="Search the pool"
          onChange={e => setQuery(e.target.value)} />
        {pool.length > matching.length && (
          <Btn className="btn btn-ghost btn-sm" onClick={() => setShowAll(v => !v)}>
            {showAll ? 'Only those who fit' : `Show everyone (${pool.length})`}</Btn>
        )}
      </div>
      <div className="tw-hint" style={{ marginTop: 6 }}>
        {targetPosition
          ? `Showing who meets every minimum the notice sets for ${targetPosition.title}`
            + `${targetPosition.occupation_name ? ` (${targetPosition.occupation_name})` : ''}`
            + `${criteriaChecks({}, targetPosition, allOccupations).length
              ? `: ${criteriaChecks({}, targetPosition, allOccupations).map(c => c.label).join(' · ')}.` : '.'}`
          : 'Anyone in the pool who can cover a trade this notice asks for.'}
        {takenOnThisTender.size > 0 && !showAll
          && ` ${takenOnThisTender.size} already promised on this notice ${takenOnThisTender.size === 1 ? 'is' : 'are'} hidden.`}
      </div>
      {candidates.length === 0 ? (
        <div className="tw-empty">
          {/* Different dead ends, different ways forward. Saying "already
              proposed for this firm" when the truth is "promised to a rival
              bidder on this notice" sends somebody looking in the wrong place. */}
          {q ? `Nobody in the pool matches “${query.trim()}”.`
            : available.length === 0
              ? 'Everyone in the pool is already promised on this notice, to this bidder or one competing '
                + 'with it. Nobody can be on two bids for the same notice.'
              : targetPosition
                ? `Nobody left in the pool meets what the notice asks of ${targetPosition.title}`
                  + `${positionBar(targetPosition) ? ` (${positionBar(targetPosition)})` : ''}. `
                  + 'Add them in the Trainer Pool, or show everyone to pick someone anyway.'
                : 'Nobody in the pool covers the trades this notice asks for. Add them in the Trainer Pool.'}
        </div>
      ) : (
        <div className="tw-picker-list">
          {candidates.map(p => {
            const fit = checkAgainstPosition(p, targetPosition);
            const taken = takenOnThisTender.get(p.id);
            const alsoOn = elsewhere[p.id] || [];
            const yrs = experienceYears(p);
            return (
              <div key={p.id} className="tw-cand">
                <div className="tw-cand-main">
                  {p.full_name}
                  <div className="tw-cand-sub">
                    {[p.person_type, highestEducation(p), Number.isInteger(yrs) ? `${yrs} yrs` : '',
                      (p.eligible_occupations || []).slice(0, 3).map(o => o.name).join(', ')]
                      .filter(Boolean).join(' · ')}
                  </div>
                  {taken && (
                    <span className="tw-tag red"
                      title="One person cannot be proposed by two bidders competing for the same notice">
                      already on {taken}</span>
                  )}
                  {!taken && alsoOn.length > 0 && (
                    <span className="tw-tag amber" title={alsoOn.map(a => `${a.title} — ${a.bidder_name}`).join('\n')}>
                      on {alsoOn.length} other live bid{alsoOn.length > 1 ? 's' : ''}</span>
                  )}
                  {targetPosition && (
                    <div className="tw-crit">
                      {criteriaChecks(p, targetPosition, allOccupations).map(c => (
                        <span key={c.key} className={`tw-crit-item ${c.ok ? 'ok' : 'miss'}`}
                          title={c.detail ? `${c.label} — has ${c.detail}` : c.label}>
                          <span className="material-icons-round" aria-hidden="true">{c.ok ? 'check' : 'close'}</span>
                          {c.label}{c.detail && c.key !== 'edu' ? ` (${c.detail})` : ''}
                          <span className="sr-only">{c.ok ? ' met' : ' not met'}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <Btn className="btn btn-secondary btn-sm" disabled={!!taken || busy} onClick={() => assign(p)}>
                  Assign</Btn>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const indexedRows = rows.map((r, idx) => ({ r, idx }));
  const unslotted = indexedRows.filter(({ r }) => !r.position_id || !positions.some(p => p.id === r.position_id));
  const mine = progress(active || { id: activeBidder });

  return (
    <>
      <h2 className="tw-panel-title">Team</h2>
      <p className="tw-panel-lede">
        Fill each post the notice lists. Assign shows only the people who meet that post&apos;s bar and
        are not already promised to another bidder on this notice.
      </p>

      {bidders.length > 1 && (
        <div className="tw-seg" role="group" aria-label="Whose team" style={{ marginBottom: 16 }}>
          {bidders.map(b => {
            const pr = progress(b);
            return (
              <button key={b.id} type="button" aria-pressed={b.id === activeBidder}
                onClick={() => setActiveBidder(b.id)}>
                {b.display_name}
                <span className="tw-seg-n">{pr.needed ? `${pr.filled}/${pr.needed}` : pr.people}</span>
              </button>
            );
          })}
        </div>
      )}

      {positions.length === 0 && (
        <div className="tw-empty" style={{ marginBottom: 12 }}>
          The notice lists no posts yet. Add them on the Requirements step to fill them one by one —
          or add people freely under Other staff.
        </div>
      )}

      {groups.map(g => (
        <section key={g.key} className="tw-section">
          <div className="tw-section-head" style={{ marginBottom: 2 }}>
            <h3 className="tw-section-title">{g.label}</h3>
          </div>
          {g.rows.map(pos => {
            const inPost = indexedRows.filter(({ r }) => r.position_id === pos.id);
            const full = inPost.length >= need(pos);
            return (
              <div key={pos.id} className="tw-slot">
                <div className="tw-slot-row">
                  <span className="tw-slot-name">{pos.title}</span>
                  <span className="tw-slot-bar">{[positionBar(pos, { omitOccupation: g.key !== 'experts' }),
                    criteriaChecks({}, pos, allOccupations).find(c => c.key === 'occ' && /Level/.test(c.label))?.label]
                    .filter(Boolean).join(' · ') || 'no stated minimum'}</span>
                  <span style={{ flex: 1 }} />
                  <span className={`tw-fill${full ? ' is-full' : ''}`}>{inPost.length} of {need(pos)}</span>
                  <Btn className={`btn btn-sm ${full ? 'btn-ghost' : 'btn-secondary'}`} disabled={busy || !activeBidder}
                    aria-expanded={openSlot === pos.id} onClick={() => open(pos.id)}>
                    {openSlot === pos.id ? 'Close' : full ? 'Add a reserve' : 'Assign'}</Btn>
                </div>
                {renderPeople(inPost)}
                {renderEditor(inPost)}
                {renderPicker(pos.id)}
              </div>
            );
          })}
        </section>
      ))}

      <section className="tw-section">
        <div className="tw-section-head" style={{ marginBottom: 2 }}>
          <h3 className="tw-section-title">Other staff</h3>
          <span className="tw-hint">People on the bid who do not fill a post the notice names.</span>
          <span style={{ flex: 1 }} />
          <Btn className="btn btn-ghost btn-sm" disabled={busy || !activeBidder}
            aria-expanded={openSlot === 'other'} onClick={() => open('other')}>
            {openSlot === 'other' ? 'Close' : '+ Add someone'}</Btn>
        </div>
        {unslotted.length === 0 && openSlot !== 'other' && <div className="tw-empty">None.</div>}
        {renderPeople(unslotted)}
        {renderEditor(unslotted)}
        {renderPicker('other')}
      </section>

      {footer({
        note: mine.needed
          ? `${active?.display_name || 'This bidder'}: ${mine.filled} of ${mine.needed} posts filled.`
          : null,
      })}
    </>
  );
}

/**
 * What this tender is, and how far along it is — on top of every step.
 *
 * A tender opens straight into a form, which says nothing about the bid
 * around it. This panel holds the details of the notice (who is asking, the
 * reference, the deadline and how close it is) and a tile for each of the
 * five jobs, with its state, so the bid can be read at a glance whichever step
 * is open. Each tile goes to its own step. It folds to one line.
 */
import { useState } from 'react';
import { totalNeeded, teamProgress } from './common.js';
import { parseDeadline, daysUntil, todayUtcDay } from './kpis.js';

const FOLD_KEY = 'tvettrack_tender_summary';

/** The notice's weights and pass mark as one line, or nothing if it states none. */
export function scoringLine(t) {
  const parts = [
    t.weight_qualification != null && t.weight_qualification !== '' && `qualification ${t.weight_qualification}%`,
    t.weight_experience != null && t.weight_experience !== '' && `experience ${t.weight_experience}%`,
    t.weight_capacity != null && t.weight_capacity !== '' && `capacity ${t.weight_capacity}%`,
  ].filter(Boolean);
  if (t.minimum_score != null && t.minimum_score !== '') parts.push(`pass mark ${t.minimum_score}`);
  return parts.join(' · ');
}

/** "in 5 days", "today", "3 days overdue" — and a tone for it. */
export function deadlineState(t, todayMs = todayUtcDay()) {
  const at = parseDeadline(t.submission_date);
  if (!t.submission_date) return { text: 'Not set', sub: 'Add it on the Notice step', tone: 'muted' };
  if (at == null) return { text: t.submission_date, sub: 'Could not read the date', tone: 'muted' };
  const d = daysUntil(at, todayMs);
  const when = `${t.submission_date}${t.submission_time ? ` at ${t.submission_time}` : ''}`;
  if (d < 0) return { text: `${-d} day${d === -1 ? '' : 's'} overdue`, sub: when, tone: 'bad' };
  if (d === 0) return { text: 'Today', sub: when, tone: 'bad' };
  return { text: `${d} day${d === 1 ? '' : 's'} left`, sub: when, tone: d <= 7 ? 'warn' : 'ok' };
}

/** The figures for each tile, from the tender as the workspace holds it. */
export function summarise(t, todayMs) {
  const bidders = t.bidders || [];
  const positions = t.positions || [];
  const people = t.people || [];
  const trades = (t.occupations || []).map(o => o.name).filter(Boolean);
  const perBidder = bidders.map(b => ({ b, ...teamProgress(positions, people, b.id) }));
  const filled = perBidder.reduce((n, x) => n + x.filled, 0);
  const wanted = totalNeeded(positions) * Math.max(bidders.length, 0);
  const statuses = bidders.reduce((m, b) => { const s = b.status || 'Preparing'; m[s] = (m[s] || 0) + 1; return m; }, {});
  return {
    deadline: deadlineState(t, todayMs),
    trades, posts: positions.length, needed: totalNeeded(positions),
    bidders, perBidder, filled, wanted,
    statuses,
    scoring: scoringLine(t),
  };
}

const TONE = { ok: 'is-ok', warn: 'is-warn', bad: 'is-bad', muted: '' };

function Tile({ label, icon, value, sub, tone = '', bar, onClick, title }) {
  return (
    <button type="button" className={`tw-tile ${TONE[tone] || ''}`} onClick={onClick} title={title}>
      <span className="tw-tile-label"><span className="material-icons-round" aria-hidden="true">{icon}</span>{label}</span>
      <span className="tw-tile-value">{value}</span>
      {bar != null && <span className="tw-tile-bar" aria-hidden="true"><span style={{ width: `${Math.round(bar * 100)}%` }} /></span>}
      <span className="tw-tile-sub">{sub}</span>
    </button>
  );
}

export default function TenderSummary({ tender, docs = [], onGo }) {
  const [open, setOpen] = useState(() => { try { return localStorage.getItem(FOLD_KEY) !== 'closed'; } catch { return true; } });
  const [more, setMore] = useState(false);
  const toggle = () => setOpen(o => { try { localStorage.setItem(FOLD_KEY, o ? 'closed' : 'open'); } catch { /* private mode */ } return !o; });

  const s = summarise(tender);
  const client = tender.client_full_name || tender.client_name_manual;
  const facts = [
    ['Employer', client], ['Reference', tender.reference_no], ['Fiscal year', tender.fy && `FY ${tender.fy}`],
    ['Notice', tender.stage], ['Method', tender.method], ['Funding', tender.funding_agency],
    ['Published', tender.published_date], ['Documents due', tender.document_deadline],
    ['Portal', tender.submission_portal], ['Project', tender.project_name], ['Office', tender.office_address],
    ['Scored on', s.scoring],
    ['Joint ventures', tender.association_allowed === false ? 'Not allowed by this notice' : ''],
  ].filter(([, v]) => v && String(v).trim());

  const statusLine = Object.entries(s.statuses).map(([k, n]) => `${n} ${k.toLowerCase()}`).join(' · ');
  const teamPct = s.wanted > 0 ? s.filled / s.wanted : null;
  // How many bidders have this stage's document saved, and when the newest was.
  const mineDocs = docs.filter(d => d.kind === tender.stage);
  const savedBidders = new Set(mineDocs.map(d => d.bidder_id)).size;
  const lastSaved = mineDocs[0] ? new Date(mineDocs[0].created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

  return (
    <section className="tw-summary" aria-label="Tender summary">
      <div className="tw-summary-head">
        <span className="tw-summary-title">Summary</span>
        {!open && (
          <span className="tw-summary-line">
            {s.deadline.text !== 'Not set' && <>{s.deadline.text} · </>}
            {s.bidders.length} bidder{s.bidders.length === 1 ? '' : 's'}
            {s.wanted > 0 && <> · team {s.filled}/{s.wanted}</>}
          </span>
        )}
        <button type="button" className="tw-link" onClick={toggle} aria-expanded={open}>{open ? 'Hide' : 'Show'}</button>
      </div>

      {open && (
        <>
          <div className="tw-tiles">
            <Tile label="Deadline" icon="event" value={s.deadline.text} sub={s.deadline.sub} tone={s.deadline.tone}
              onClick={() => onGo(1)} title="Open the Notice step" />
            <Tile label="What it asks for" icon="checklist"
              value={`${s.trades.length} trade${s.trades.length === 1 ? '' : 's'} · ${s.posts} post${s.posts === 1 ? '' : 's'}`}
              sub={s.posts ? `${s.needed} ${s.needed === 1 ? 'person' : 'people'} per bidder` : 'Not listed yet'}
              tone={s.posts ? 'ok' : 'muted'} onClick={() => onGo(2)} title={s.trades.join(', ') || 'Open the Requirements step'} />
            <Tile label="Bidders" icon="groups"
              value={s.bidders.length ? s.bidders.map(b => b.display_name).join(' · ') : 'None yet'}
              sub={statusLine || 'Choose who is bidding'} tone={s.bidders.length ? 'ok' : 'muted'} onClick={() => onGo(3)} />
            <Tile label="Team" icon="diversity_3"
              value={s.wanted > 0 ? `${s.filled} of ${s.wanted} filled` : '—'}
              sub={s.perBidder.length > 1
                ? s.perBidder.map(x => `${x.b.display_name} ${x.filled}/${x.needed}`).join(' · ')
                : s.wanted > 0 ? `${s.wanted - s.filled} post${s.wanted - s.filled === 1 ? '' : 's'} still to fill` : 'Needs bidders and posts first'}
              bar={teamPct} tone={teamPct == null ? 'muted' : teamPct >= 1 ? 'ok' : teamPct > 0 ? 'warn' : 'muted'}
              onClick={() => onGo(4)} />
            <Tile label={`${tender.stage} document`} icon="description"
              value={s.bidders.length ? `${savedBidders} of ${s.bidders.length} saved` : '—'}
              sub={lastSaved ? `Last saved ${lastSaved}` : s.bidders.length ? `Build the ${tender.stage} on the Submit step` : 'Needs bidders first'}
              tone={!s.bidders.length ? 'muted' : savedBidders >= s.bidders.length ? 'ok' : savedBidders > 0 ? 'warn' : 'muted'}
              onClick={() => onGo(5)} />
          </div>

          {facts.length > 0 && (
            <div className="tw-facts">
              <dl className={`tw-facts-list${more ? ' is-all' : ''}`}>
                {(more ? facts : facts.slice(0, 4)).map(([k, v]) => (
                  <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
                ))}
              </dl>
              {facts.length > 4 && (
                <button type="button" className="tw-link" onClick={() => setMore(m => !m)}>
                  {more ? 'Fewer details' : `All details (${facts.length})`}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

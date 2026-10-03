/**
 * Where a tender stands, in plain words: each of the five jobs, whether it is
 * done, and what is left to do in it. Opening a tender lands here instead of
 * on one long step, and every line goes straight to its own step.
 */
import { Btn } from '../../md.jsx';
import { need } from './common.js';

/** What is still missing in each step, as short sentences. */
export function todosFor(t, railSteps) {
  const bidders = t.bidders || [];
  const positions = t.positions || [];
  const people = t.people || [];
  const left = [[], [], [], [], []];
  if (!t.id) { left[0].push('Give the tender a title and save it.'); return left; }
  if (!t.submission_date) left[0].push('Add the submission deadline.');
  if (!t.reference_no) left[0].push('Add the notice’s reference number.');
  if (!(t.occupations || []).length && !positions.length) left[1].push('List the trades and posts the notice asks for.');
  if (!bidders.length) left[2].push('Choose who is bidding — one firm, or a joint venture.');
  for (const b of bidders) {
    for (const pos of positions) {
      const have = people.filter(p => p.bidder_id === b.id && p.position_id === pos.id).length;
      const more = need(pos) - have;
      if (more > 0) left[3].push(`${bidders.length > 1 ? `${b.display_name}: ` : ''}${pos.title}${pos.occupation_name ? ` · ${pos.occupation_name}` : ''} — ${more} more to pick`);
    }
    if (!positions.length && !people.some(p => p.bidder_id === b.id)) left[3].push(`${b.display_name}: add the people you are proposing.`);
  }
  for (const b of bidders) if (!b.status || b.status === 'Preparing') { left[4].push(`${b.display_name}: build the documents, then record the result.`); break; }
  return left;
}

const PLAIN = { Notice: 'The notice', Requirements: 'What it asks for', Bidders: 'Who is bidding', Team: 'Pick the people', Submit: 'Get the documents' };

export default function ChecklistHome({ tender, steps, onOpen, advanced, onAdvanced }) {
  const todos = todosFor(tender, steps);
  const nextIdx = steps.findIndex((s, i) => !s.locked && (!s.done || todos[i].length));
  return (
    <>
      <h2 className="tw-panel-title">Where this tender stands</h2>
      <p className="tw-panel-lede">
        Five jobs, in any order you like. Everything you type is saved as you go, so you can leave and come back.
      </p>
      <ol className="tw-check">
        {steps.map((s, i) => {
          const open = !s.locked && todos[i].length > 0;
          const state = s.locked ? 'locked' : open ? 'todo' : s.done ? 'done' : 'todo';
          return (
            <li key={s.label} className={`tw-check-row is-${state}`}>
              <span className="tw-check-mark" aria-hidden="true">
                <span className="material-icons-round">{state === 'done' ? 'check_circle' : state === 'locked' ? 'lock' : 'radio_button_unchecked'}</span>
              </span>
              <div className="tw-check-main">
                <div className="tw-check-title">{PLAIN[s.label] || s.label}<span className="tw-check-sum"> — {s.locked ? s.lockedWhy : s.summary}</span></div>
                {!s.locked && todos[i].length > 0 && (
                  <ul className="tw-check-todos">{todos[i].slice(0, 4).map(x => <li key={x}>{x}</li>)}
                    {todos[i].length > 4 && <li>…and {todos[i].length - 4} more</li>}</ul>
                )}
              </div>
              <Btn className={`btn btn-sm ${i === nextIdx ? 'btn-primary' : 'btn-secondary'}`} disabled={s.locked}
                onClick={() => onOpen(i + 1)}>{state === 'done' ? 'Review' : i === nextIdx ? 'Continue' : 'Open'}</Btn>
            </li>
          );
        })}
      </ol>
      <label className="tw-hint" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 14 }}>
        <input type="checkbox" checked={!!advanced} onChange={e => onAdvanced(e.target.checked)} />
        Show all options (qualification rules, CV wording, per-person settings)
      </label>
    </>
  );
}

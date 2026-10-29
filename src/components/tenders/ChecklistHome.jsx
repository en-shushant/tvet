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
  // The first step that is open to work on and still has something to do.
  const nextIdx = steps.findIndex((s, i) => !s.locked && (!s.done || todos[i].length));
  const left = steps.map((s, i) => ({ s, i, items: s.locked ? [] : todos[i] })).filter(x => x.items.length);
  const next = nextIdx >= 0 ? steps[nextIdx] : null;
  return (
    <>
      <h2 className="tw-panel-title">{next ? `Next: ${PLAIN[next.label] || next.label}` : 'Everything is in place'}</h2>
      <p className="tw-panel-lede">
        {next
          ? 'Pick up where you left off. Everything you type is saved as you go.'
          : 'Every step is done. Review any of them from the bar above, or go to Submit for the documents.'}
      </p>

      {left.length > 0 && (
        <div className="tw-todo">
          {left.map(({ s, i, items }) => (
            <div key={s.label} className="tw-todo-group">
              <button type="button" className="tw-link tw-todo-step" onClick={() => onOpen(i + 1)}>{PLAIN[s.label] || s.label}</button>
              <ul className="tw-check-todos">
                {items.slice(0, 3).map(x => <li key={x}>{x}</li>)}
                {items.length > 3 && <li>…and {items.length - 3} more</li>}
              </ul>
            </div>
          ))}
        </div>
      )}

      <div className="tw-home-actions">
        {next
          ? <Btn className="btn btn-primary" onClick={() => onOpen(nextIdx + 1)}>Continue — {(PLAIN[next.label] || next.label).toLowerCase()} →</Btn>
          : <Btn className="btn btn-primary" onClick={() => onOpen(steps.length)}>Go to Submit →</Btn>}
        <label className="tw-hint tw-adv">
          <input type="checkbox" checked={!!advanced} onChange={e => onAdvanced(e.target.checked)} />
          Show all options
          <span className="tw-hint"> — qualification rules, CV wording, per-person settings</span>
        </label>
      </div>
    </>
  );
}

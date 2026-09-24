import { describeAccepted } from '../../utils/hrFit.js';

/**
 * What every step of a tender shares: the vocabulary, and the helpers that
 * turn a tender into the summaries the step rail shows.
 *
 * Kept free of JSX so the list screen and each step can import it without
 * pulling each other in.
 */

// Separate rows, not a mode: a bid that reaches RFP has two of them.
export const STAGES = ['EOI', 'RFP'];
export const STATUSES = ['Preparing', 'Submitted', 'Shortlisted', 'Awarded', 'Lost', 'Dropped'];
export const STATUS_TONE = {
  Preparing: 'neutral', Submitted: 'info', Shortlisted: 'success',
  Awarded: 'success', Lost: 'warning', Dropped: 'neutral',
};
/** How a single bidder fared. Separate from the tender's own status. */
export const BIDDER_STATUSES = ['Preparing', 'Submitted', 'Shortlisted', 'Not shortlisted', 'Awarded', 'Lost'];
export const BIDDER_TONE = {
  Preparing: 'neutral', Submitted: 'info', Shortlisted: 'success',
  'Not shortlisted': 'warning', Awarded: 'success', Lost: 'warning',
};
export const METHODS = ['National', 'International'];

export const BLANK_TENDER = {
  title: '', project_name: '', reference_no: '', client_name_manual: '', client_id: '',
  fy: '', stage: 'EOI', status: 'Preparing',
  method: 'National', office_address: '', funding_agency: '',
  published_date: '', submission_date: '', submission_time: '', document_deadline: '',
  submission_portal: 'www.bolpatra.gov.np/egp', client_website: '', association_allowed: true,
  weight_qualification: '', weight_experience: '', weight_capacity: '', minimum_score: '',
  authorized_rep: '', notes: '',
};

/**
 * The notice's own fields, and nothing else.
 *
 * A save sends these as the base, never the whole tender object. The detail
 * response also carries the bidders, the posts and every proposed person, and
 * the server rewrites whichever of those it is sent — so spreading the tender
 * into a save quietly re-submitted the entire team each time a date changed.
 */
export const NOTICE_FIELDS = Object.keys(BLANK_TENDER);
export const noticeOf = (t) => {
  const out = { id: t?.id };
  for (const k of NOTICE_FIELDS) out[k] = t?.[k] ?? BLANK_TENDER[k];
  out.client_id = out.client_id || null;
  // Which stage this one came from travels with every save too. The server now
  // keeps it when it is absent, but a save should still say it rather than
  // rely on that — without it an RFP was cut off from its EOI.
  if (t?.parent_tender_id) out.parent_tender_id = t.parent_tender_id;
  return out;
};

/** The three weights a Request for EOI states, and what they must come to. */
export const WEIGHTS = [
  ['weight_qualification', 'Qualification %'],
  ['weight_experience', 'Experience %'],
  ['weight_capacity', 'Capacity %'],
];

/**
 * The posts a notice names.
 *
 * Key experts are named once for the whole bid; trainers are asked for per
 * trade. Both are a title, a count and a bar, so both are the same row — only
 * where it is listed differs.
 */
export const COMMON_POSITIONS = {
  'Key expert': ['Team Leader', 'Monitoring Officer', 'Database Officer', 'Training Coordinator',
    'Account Officer', 'Social Mobilizer'],
  Trainer: ['Main Trainer', 'Co-Trainer', 'Instructor', 'Assistant Instructor'],
};
export const emptyPosition = (category, extra = {}) => ({ title: '', category, count: 1,
  min_education: '', min_experience_years: '', required_training: '', occupation_id: '', notes: '',
  ...extra });
export const isTrainer = (p) => (p.category || 'Key expert') === 'Trainer';

/**
 * A post's stated minimums, as one readable line — worded as the notice words
 * them, so the Team step and the Requirements step describe a post the same way.
 */
export const positionBar = (p, { omitOccupation = false } = {}) => [describeAccepted(p),
  p.min_experience_years ? `${p.min_experience_years} yrs` : '',
  p.required_training, omitOccupation ? '' : p.occupation_name].filter(Boolean).join(' · ');

/**
 * The posts in the order they are worked through: key experts first, then one
 * block per trade. Trades come from the posts themselves rather than from the
 * notice's occupation list, so a post whose trade was later unticked is still
 * shown instead of vanishing with whoever was assigned to it.
 */
export function groupPositions(positions = []) {
  const experts = positions.filter(p => !isTrainer(p));
  const byTrade = [];
  for (const p of positions.filter(isTrainer)) {
    const k = String(p.occupation_id || 'any');
    let g = byTrade.find(x => x.key === k);
    if (!g) byTrade.push(g = { key: k, label: p.occupation_name || 'Any trade', rows: [] });
    g.rows.push(p);
  }
  return [
    ...(experts.length ? [{ key: 'experts', label: 'Key experts', rows: experts }] : []),
    ...byTrade,
  ];
}

export const need = (p) => Math.max(1, parseInt(p.count, 10) || 1);
export const totalNeeded = (positions = []) => positions.reduce((n, p) => n + need(p), 0);

/**
 * How far one bidder's team has got against the notice.
 *
 * A post counts as filled up to its own number: three people in a one-person
 * post is one filled post and two surplus, not three of the total.
 */
export function teamProgress(positions = [], people = [], bidderId) {
  const mine = people.filter(p => p.bidder_id === bidderId);
  const filled = positions.reduce((n, pos) =>
    n + Math.min(need(pos), mine.filter(r => r.position_id === pos.id).length), 0);
  return { filled, needed: totalNeeded(positions), people: mine.length };
}

/** The bidder's lead firm — the one that signs, and whose name leads a JV. */
export const leadOf = (bidder) =>
  (bidder?.firms || []).find(f => f.role === 'Lead') || bidder?.firms?.[0] || null;

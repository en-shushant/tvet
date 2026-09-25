import { useState, useEffect, useCallback } from 'react';
import { ErrorBanner } from '../ui/Modal.jsx';
import { Btn } from '../../md.jsx';
import { confirmDialog, toast } from '../ui/Feedback.jsx';
import { api } from '../../utils/api.js';
import cv from '../../reports/cv.jsx';
import { defaultFamilyFor } from '../../reports/catalog.js';
import { STATUSES, BLANK_TENDER, noticeOf, teamProgress } from './common.js';
import NoticeStep from './NoticeStep.jsx';
import RequirementsStep from './RequirementsStep.jsx';
import BiddersStep from './BiddersStep.jsx';
import TeamStep from './TeamStep.jsx';
import SubmitStep from './SubmitStep.jsx';
import CopyTender from './CopyTender.jsx';
import Select from '../ui/Select.jsx';

/**
 * One tender, worked through in the order the work happens.
 *
 * A page rather than a modal: a bid is worked on for days, across five kinds
 * of question, and a dialog stacked on a list made every one of them feel like
 * a detour. The rail says which step is in hand and what each still needs; the
 * panel shows only that step.
 */
export default function TenderWorkspace({ tenderId, startAt, clients, institutes, occupations, pool, token,
                                          onBack, onOpen, onListChanged, onAddClient, onPrepareReport }) {
  const [tender, setTender] = useState(tenderId ? null : { ...BLANK_TENDER });
  const [variants, setVariants] = useState([]);
  const [step, setStep] = useState(1);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [activeBidder, setActiveBidder] = useState(null);
  // One format per notice: every bidder answers it in the format the client set.
  const [docFamily, setDocFamily] = useState(null);
  const [copying, setCopying] = useState(false);

  const load = useCallback(async (id, { chooseStep = false } = {}) => {
    const t = await api('GET', `/tenders/${id}`, null, token);
    // Every bidding firm's wording plus the shared library, fetched once.
    const ids = [...new Set((t.bidders || []).flatMap(b => (b.firms || []).map(f => f.institute_id)))];
    const packs = await Promise.all(ids.length
      ? ids.map(i => api('GET', `/tenders/cv-variants?institute_id=${i}`, null, token))
      : [api('GET', '/tenders/cv-variants', null, token)]);
    const seen = new Map();
    for (const list of packs) for (const v of (list || [])) seen.set(v.id, v);
    setVariants([...seen.values()]);
    setTender(t);
    setActiveBidder(a => (t.bidders || []).some(b => b.id === a) ? a : (t.bidders?.[0]?.id ?? null));
    setDocFamily(f => f || defaultFamilyFor(t.stage));
    if (chooseStep) setStep(firstOpenStep(t));
    return t;
  }, [token]);

  useEffect(() => {
    if (!tenderId) { setTender({ ...BLANK_TENDER }); setStep(1); return; }
    setTender(null); setErr('');
    // Normally where the work stands; a fresh copy opens on its notice instead,
    // since its reference number and deadline are the first thing it lacks.
    load(tenderId, { chooseStep: !startAt })
      .then(() => { if (startAt) setStep(startAt); })
      .catch(e => setErr(e.message || 'Could not open the tender.'));
  }, [tenderId, startAt, load]);

  if (!tender) {
    return (
      <div className="fade-in">
        <button type="button" className="tw-back" onClick={onBack}>← All tenders</button>
        {err ? <ErrorBanner msg={err} onDismiss={() => setErr('')} /> : <div className="tw-empty">Opening…</div>}
      </div>
    );
  }

  const saved = !!tender.id;
  const bidders = tender.bidders || [];
  const reload = () => load(tender.id);

  /**
   * Save a slice of the tender.
   *
   * The base is the notice's own fields, never the whole object: the server
   * rewrites whichever child lists it is sent, and the detail response carries
   * all of them.
   */
  const patch = async (body, message) => {
    setBusy(true); setErr('');
    try {
      await api('PUT', `/tenders/${tender.id}`, { ...noticeOf(tender), ...body }, token);
      await reload();
      onListChanged();
      if (message) toast(message);
      return true;
    } catch (e) { setErr(e.message || 'Could not save.'); return false; }
    finally { setBusy(false); }
  };

  const saveNotice = async (form) => {
    if (!saved) {
      const created = await api('POST', '/tenders', { ...form, id: undefined }, token);
      await load(created.id);
      onListChanged(created.id);
      toast('Tender created. Next: what it asks for.');
    } else {
      await api('PUT', `/tenders/${tender.id}`, form, token);
      await reload();
      onListChanged();
      toast('Notice saved.');
    }
    setStep(2);
  };

  const saveRequirements = async (body) => {
    await api('PUT', `/tenders/${tender.id}`, { ...noticeOf(tender), ...body }, token);
    await reload();
    onListChanged();
    toast('Requirements saved.');
    setStep(3);
  };

  /** Sends the whole bidder list; the server updates in place and keeps ids. */
  const putBidders = (next, msg) => patch({ bidders: next.map(b => ({
    id: b.id, label: b.label || null, status: b.status || 'Preparing',
    firms: (b.firms || []).map(f => ({ institute_id: f.institute_id, role: f.role })),
  })) }, msg);

  const addBidder = (instIds) => putBidders(
    [...bidders, { firms: instIds.map((id, i) => ({ institute_id: id, role: i ? 'JV Member' : 'Lead' })) }],
    instIds.length > 1 ? 'Joint venture added.' : 'Bidder added.');

  const removeBidder = async (b) => {
    const team = (tender.people || []).filter(p => p.bidder_id === b.id).length;
    const ok = await confirmDialog({
      title: `Remove ${b.display_name}?`,
      message: team
        ? `Its team of ${team} is removed from this tender with it. The people stay in the pool.`
        : 'It has no team yet, so nothing else is lost.',
      confirmLabel: 'Remove', danger: true,
    });
    if (ok) putBidders(bidders.filter(x => x.id !== b.id), `${b.display_name} removed.`);
  };

  const setBidderStatus = (b, status) =>
    putBidders(bidders.map(x => x.id === b.id ? { ...x, status } : x), `${b.display_name}: ${status}.`);

  const saveTeam = (bidderId, rows) =>
    patch({ people_bidder_id: bidderId, people: rows });

  const makeCVs = async (bidder, mode) => {
    setBusy(true); setErr('');
    try {
      const pack = await api('GET', `/tenders/${tender.id}/cv?bidder_id=${bidder.id}`, null, token);
      if (!pack.cvs.length) { setErr(`Nobody is on ${bidder.display_name}’s team yet.`); return; }
      if (mode === 'word') { await cv.downloadDOCX(pack); return; }
      const w = window.open('', '_blank');
      w.document.write(cv.buildPrintHTML(pack));
      w.document.close();
      setTimeout(() => w.print(), 300);
    } catch (e) { setErr(e.message || 'Could not build the CVs.'); }
    finally { setBusy(false); }
  };

  const advance = async () => {
    const short = bidders.filter(b => b.status === 'Shortlisted');
    const ok = await confirmDialog({
      title: 'Take this EOI to RFP?',
      message: `A new RFP stage is created with ${short.map(b => b.display_name).join(', ')}, carrying over `
        + 'the client, the trades, the posts and each team with its wording. The EOI is left exactly as '
        + 'submitted. Its reference number, dates and weights are not copied — those belong to the RFP notice.',
      confirmLabel: 'Create the RFP stage',
    });
    if (!ok) return;
    setBusy(true);
    try {
      const next = await api('POST', `/tenders/${tender.id}/advance`, { stage: 'RFP' }, token);
      onListChanged(next.id);
      await openStage(next.id);
      setStep(1);
      toast('RFP stage created. Add its reference number and deadline.');
    } catch (e) { setErr(e.message || 'Could not create the RFP stage.'); }
    finally { setBusy(false); }
  };

  const openStage = async (id) => {
    setDocFamily(null);
    await load(id, { chooseStep: true });
    onListChanged(id);
  };

  const saveVariant = async (form, existing) => {
    const body = { ...form, institute_id: form.institute_id || null };
    if (existing?.id) await api('PUT', `/tenders/cv-variants/${existing.id}`, body, token);
    else await api('POST', '/tenders/cv-variants', body, token);
    await reload();
  };

  const remove = async () => {
    const ok = await confirmDialog({
      title: `Delete “${tender.title}”?`,
      message: 'The tender and everyone proposed on it go with it. The people themselves stay in the pool.',
      confirmLabel: 'Delete', danger: true,
    });
    if (!ok) return;
    try { await api('DELETE', `/tenders/${tender.id}`, null, token); onListChanged(); onBack(); }
    catch (e) { setErr(e.message); }
  };

  const steps = railSteps(tender);
  const go = (n) => { if (steps[n - 1] && !steps[n - 1].locked) { setStep(n); window.scrollTo?.({ top: 0 }); } };

  /** The bar at the foot of every step: back, a note, and the way on. */
  const footer = ({ primary, primaryDisabled, note } = {}) => (
    <div className="tw-foot">
      {step > 1 && <Btn className="btn btn-ghost" onClick={() => go(step - 1)}>← Back</Btn>}
      <span className="tw-foot-note">{note}</span>
      {primary || (step < steps.length
        ? <Btn className="btn btn-primary" disabled={primaryDisabled} onClick={() => go(step + 1)}>
            Continue to {steps[step].label.toLowerCase()} →</Btn>
        : <Btn className="btn btn-primary" onClick={onBack}>Done</Btn>)}
    </div>
  );

  const client = tender.client_full_name || tender.client_name_manual;
  const stageChain = [
    ...(tender.came_from ? [{ ...tender.came_from, here: false }] : []),
    { id: tender.id, stage: tender.stage, here: true },
    ...(tender.led_to || []).map(c => ({ ...c, here: false })),
  ];

  return (
    <div className="fade-in">
      <div className="tw-head">
        <div style={{ minWidth: 0, flex: 1 }}>
          <button type="button" className="tw-back" onClick={onBack}>← All tenders</button>
          <h1 className="tw-title">{saved ? tender.title : 'New tender'}</h1>
          {saved && (
            <div className="tw-meta">
              {[client, tender.reference_no,
                tender.submission_date && `due ${tender.submission_date}${tender.submission_time ? ` at ${tender.submission_time}` : ''}`,
                tender.fy && `FY ${tender.fy}`].filter(Boolean).join(' · ') || 'No details yet'}
            </div>
          )}
          {/* The scoring stays in view on every step: it says where the effort
              belongs, which is the question every later step is answering. */}
          {saved && scoring(tender) && (
            <div className="tw-meta">
              Scored on {scoring(tender)}
              {tender.association_allowed === false && <span className="tw-warn"> · no joint ventures</span>}
            </div>
          )}
          {saved && stageChain.length > 1 && (
            <div className="tw-chain" aria-label="Stages of this bid">
              {stageChain.map((s, i) => (
                <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {i > 0 && <span style={{ color: 'var(--text3)' }}>→</span>}
                  <button type="button" className={`tw-stage${s.here ? ' is-here' : ''}`} disabled={s.here}
                    aria-current={s.here ? 'page' : undefined} onClick={() => openStage(s.id)}>
                    {s.stage}{s.here ? '' : s.reference_no ? ` · ${s.reference_no}` : ''}
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
        {saved && (
          <div className="tw-head-actions">
            <Select className="tw-in" style={{ width: 'auto' }} aria-label="Status of this tender"
              value={tender.status || 'Preparing'} disabled={busy}
              onChange={e => patch({ status: e.target.value }, `Marked ${e.target.value}.`)}>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
            <Btn className="btn btn-secondary btn-sm" onClick={() => setCopying(true)}>
              <span className="material-icons-round" style={{ fontSize: 15, verticalAlign: 'middle', marginRight: 4 }}>
                content_copy</span>Copy</Btn>
            <button type="button" className="tw-x" aria-label="Delete this tender" title="Delete this tender"
              onClick={remove}>
              <span className="material-icons-round" style={{ fontSize: 19 }}>delete_outline</span>
            </button>
          </div>
        )}
      </div>

      {copying && (
        <CopyTender tender={tender} token={token} onClose={() => setCopying(false)}
          onCopied={(id) => { setCopying(false); onListChanged(); toast('Copied. Add the new notice’s reference number and deadline.'); onOpen(id, 1); }} />
      )}

      <div className="tw">
        <ol className="tw-rail" aria-label="Steps">
          {steps.map((s, i) => (
            <li key={s.label}>
              <button type="button" disabled={s.locked} onClick={() => go(i + 1)}
                className={`tw-step${step === i + 1 ? ' is-current' : ''}${s.done && step !== i + 1 ? ' is-done' : ''}`}
                aria-current={step === i + 1 ? 'step' : undefined}
                aria-label={`Step ${i + 1}, ${s.label}${s.done ? ', done' : ''}: ${s.locked ? s.lockedWhy : s.summary}`}
                title={s.locked ? s.lockedWhy : undefined}>
                <span className="tw-step-n">
                  {s.done && step !== i + 1
                    ? <span className="material-icons-round" style={{ fontSize: 15 }}>check</span>
                    : i + 1}
                </span>
                <span className="tw-step-label">{s.label}</span>
                <span className="tw-step-sum">{s.locked ? s.lockedWhy : s.summary}</span>
              </button>
            </li>
          ))}
        </ol>

        <div className="tw-panel">
          <ErrorBanner msg={err} onDismiss={() => setErr('')} />
          {step === 1 && (
            <NoticeStep key={tender.id || 'new'} tender={tender} clients={clients}
              onSave={saveNotice} onAddClient={onAddClient} footer={footer} />
          )}
          {step === 2 && saved && (
            <RequirementsStep key={tender.id} tender={tender} occupations={occupations}
              onSave={saveRequirements} footer={footer} />
          )}
          {step === 3 && saved && (
            <BiddersStep tender={tender} institutes={institutes} busy={busy}
              onAddBidder={addBidder} onRemoveBidder={removeBidder} footer={footer} />
          )}
          {step === 4 && saved && (
            <TeamStep tender={tender} pool={pool} variants={variants} token={token} busy={busy}
              activeBidder={activeBidder} setActiveBidder={setActiveBidder}
              onSaveTeam={saveTeam} footer={footer} />
          )}
          {step === 5 && saved && (
            <SubmitStep tender={tender} busy={busy} variants={variants}
              docFamily={docFamily || defaultFamilyFor(tender.stage)} setDocFamily={setDocFamily}
              onPrepareReport={onPrepareReport} onMakeCVs={makeCVs} onSetBidderStatus={setBidderStatus}
              onAdvance={advance} onOpenStage={openStage} onSaveVariant={saveVariant} footer={footer} />
          )}
        </div>
      </div>
    </div>
  );
}

/** The notice's weights and pass mark as one line, or nothing if it states none. */
function scoring(t) {
  const parts = [
    t.weight_qualification != null && `qualification ${t.weight_qualification}%`,
    t.weight_experience != null && `experience ${t.weight_experience}%`,
    t.weight_capacity != null && `capacity ${t.weight_capacity}%`,
  ].filter(Boolean);
  if (t.minimum_score != null) parts.push(`pass mark ${t.minimum_score}`);
  return parts.join(' · ');
}

/**
 * What the rail says about each step.
 *
 * A step is locked only when it has nothing to act on — requirements for a
 * tender that is not saved, a team for no bidder — never merely because an
 * earlier step looks incomplete: a notice with no posts listed can still take
 * bidders and staff.
 */
export function railSteps(t) {
  const saved = !!t.id;
  const bidders = t.bidders || [];
  const positions = t.positions || [];
  const occs = t.occupations || [];
  const people = t.people || [];
  const needSaved = 'Create the tender first';
  const needBidder = 'Add a bidder first';

  const team = bidders.map(b => ({ b, ...teamProgress(positions, people, b.id) }));
  const teamDone = bidders.length > 0 && team.every(x => x.needed ? x.filled >= x.needed : x.people > 0);
  const results = bidders.filter(b => b.status && b.status !== 'Preparing');

  return [
    { label: 'Notice', done: saved,
      summary: saved ? (t.submission_date ? `Due ${t.submission_date}` : 'No deadline yet') : 'Title, client and deadline' },
    { label: 'Requirements', done: occs.length > 0 || positions.length > 0, locked: !saved, lockedWhy: needSaved,
      summary: occs.length || positions.length
        ? [occs.length && `${occs.length} trade${occs.length === 1 ? '' : 's'}`,
           positions.length && `${positions.length} post${positions.length === 1 ? '' : 's'}`].filter(Boolean).join(' · ')
        : 'Trades and the team it wants' },
    { label: 'Bidders', done: bidders.length > 0, locked: !saved, lockedWhy: needSaved,
      summary: bidders.length ? bidders.map(b => b.display_name).join(' · ') : 'Firms and joint ventures' },
    { label: 'Team', done: teamDone, locked: !saved || !bidders.length, lockedWhy: saved ? needBidder : needSaved,
      summary: !bidders.length ? 'Who fills each post'
        : team.map(x => x.needed ? `${x.b.display_name} ${x.filled}/${x.needed}` : `${x.b.display_name} ${x.people}`).join(' · ') },
    { label: 'Submit', done: bidders.length > 0 && results.length === bidders.length,
      locked: !saved || !bidders.length, lockedWhy: saved ? needBidder : needSaved,
      summary: !bidders.length ? 'Documents and results'
        : results.length ? `${results.length} of ${bidders.length} results in` : `${t.stage} and CV packs` },
  ];
}

/** Open a tender where its work actually stands, not always at the top. */
export function firstOpenStep(t) {
  const steps = railSteps(t);
  const i = steps.findIndex(s => !s.done && !s.locked);
  return i === -1 ? steps.length : i + 1;
}

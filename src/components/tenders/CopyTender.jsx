import { useState } from 'react';
import Modal, { ErrorBanner } from '../ui/Modal.jsx';
import { Btn, MdTextField } from '../../md.jsx';
import { api } from '../../utils/api.js';

/**
 * Start a new tender from an old one.
 *
 * For the client that advertises the same training again. What describes the
 * work comes across; what identifies the old notice — reference number and
 * dates — is left blank, because copied it would be wrong and look right.
 */
export default function CopyTender({ tender, token, onClose, onCopied }) {
  const [title, setTitle] = useState(`${tender.title} (copy)`);
  const [bidders, setBidders] = useState(true);
  const [teams, setTeams] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const nBidders = (tender.bidders || []).length;

  const go = async () => {
    if (!title.trim()) return setErr('Give the copy a title.');
    setBusy(true); setErr('');
    try {
      const next = await api('POST', `/tenders/${tender.id}/copy`,
        { title: title.trim(), include_bidders: bidders, include_teams: bidders && teams }, token);
      onCopied(next.id);
    } catch (e) { setErr(e.message || 'Could not copy the tender.'); }
    finally { setBusy(false); }
  };

  return (
    <Modal title="Copy this tender" onClose={onClose}
      footer={<>
        <Btn className="btn btn-secondary" onClick={onClose}>Cancel</Btn>
        <Btn className="btn btn-primary" disabled={busy} onClick={go}>
          {busy ? 'Copying…' : 'Copy and open'}</Btn>
      </>}>
      <ErrorBanner msg={err} onDismiss={() => setErr('')} />
      <div className="form-group">
        <MdTextField label="Title of the new tender" value={title} onChange={e => setTitle(e.target.value)} />
      </div>
      <p className="tw-hint" style={{ margin: '0 0 12px' }}>
        Comes across: the client, the trades, every post with its requirements, and the scoring.
        Left blank for the new notice: its reference number and dates.
      </p>
      <label className="tw-cand" style={{ cursor: 'pointer', background: 'var(--bg)' }}>
        <input type="checkbox" checked={bidders} onChange={e => setBidders(e.target.checked)} />
        <span className="tw-cand-main">Bring the bidders
          <span className="tw-cand-sub"> · {nBidders ? `${nBidders}, each starting again at Preparing` : 'none on this tender'}</span>
        </span>
      </label>
      <label className="tw-cand" style={{ cursor: bidders ? 'pointer' : 'not-allowed', background: 'var(--bg)',
        marginTop: 4, opacity: bidders ? 1 : .5 }}>
        <input type="checkbox" checked={bidders && teams} disabled={!bidders}
          onChange={e => setTeams(e.target.checked)} />
        <span className="tw-cand-main">…and their teams
          <span className="tw-cand-sub"> · the same people in the same posts, flagged if they are on other live bids</span>
        </span>
      </label>
    </Modal>
  );
}

import { useState } from 'react';
import { Btn } from '../../md.jsx';

/**
 * Step 3 — who is bidding.
 *
 * A bidder is one firm, or several bidding together as a joint venture:
 * WLTTI alone and CHRA + IC together are two bidders, not three. Nothing else
 * happens on this step; how each bidder fared is recorded on Submit, next to
 * the documents it was judged on.
 */
export default function BiddersStep({ tender, institutes, busy, onAddBidder, onRemoveBidder, footer }) {
  const bidders = tender.bidders || [];
  const [adding, setAdding] = useState(bidders.length === 0);

  return (
    <>
      <h2 className="tw-panel-title">Who is bidding</h2>
      <p className="tw-panel-lede">
        Each bidder puts forward its own team and its own documents. Tick one firm to bid alone, or
        several to bid together as a joint venture.
        {tender.association_allowed === false && (
          <strong style={{ color: 'var(--amber)' }}> This notice does not allow consultants to associate.</strong>
        )}
      </p>

      {bidders.length > 0 && (
        <section className="tw-section">
          {bidders.map(b => (
            <div key={b.id} className="tw-bidder" style={{ marginBottom: 8 }}>
              <div className="tw-bidder-head" style={{ background: 'var(--surface)' }}>
                <span className="material-icons-round" style={{ fontSize: 18, color: 'var(--text3)' }}>
                  {b.firms.length > 1 ? 'groups' : 'business'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="tw-bidder-name">{b.display_name}</div>
                  <div className="tw-bidder-firms">
                    {b.firms.length > 1
                      ? b.firms.map(f => `${f.name} (${f.role === 'Lead' ? 'lead' : 'partner'})`).join(' · ')
                      : b.firms[0]?.name}
                  </div>
                </div>
                <button type="button" className="tw-x" disabled={busy}
                  aria-label={`Remove ${b.display_name}`} onClick={() => onRemoveBidder(b)}>
                  <span className="material-icons-round" style={{ fontSize: 17 }}>close</span>
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {adding
        ? <AddBidder institutes={institutes} busy={busy} taken={bidders}
            onCancel={bidders.length ? () => setAdding(false) : null}
            onAdd={async (ids) => { await onAddBidder(ids); setAdding(false); }} />
        : <Btn className="btn btn-secondary btn-sm" disabled={busy} onClick={() => setAdding(true)}>
            + Add another bidder</Btn>}

      {footer({
        primaryDisabled: !bidders.length,
        note: bidders.length ? null : 'Add at least one bidder — every team and document belongs to one.',
      })}
    </>
  );
}

/**
 * Tick one firm for a solo bid, or several for a joint venture.
 *
 * Deliberately one control rather than "add firm" then "group them" — whether
 * two firms are rivals or partners is the thing that has to be stated, and it
 * is easier to say up front than to fix afterwards.
 */
function AddBidder({ institutes, busy, taken, onAdd, onCancel }) {
  const [picked, setPicked] = useState([]);
  const toggle = (id) => setPicked(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const names = picked.map(id => institutes.find(i => i.id === id)).map(i => i?.acronym || i?.name);
  // A firm already bidding alone can still join a JV, so nothing is hidden —
  // only marked, so the overlap is a decision rather than an accident.
  const bidsAs = (id) => taken.filter(b => b.firms.some(f => f.institute_id === id)).map(b => b.display_name);

  return (
    <div className="tw-picker" style={{ marginTop: 0 }}>
      <div className="tw-hint">Tick one firm to bid alone, or two or more for a joint venture. The first one ticked leads.</div>
      <div className="tw-picker-list">
        {institutes.map(i => {
          const already = bidsAs(i.id);
          return (
            <label key={i.id} className="tw-cand" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={picked.includes(i.id)} onChange={() => toggle(i.id)} />
              <span className="tw-cand-main">
                {i.name}{i.acronym && <span className="tw-cand-sub"> · {i.acronym}</span>}
                {picked[0] === i.id && picked.length > 1 && <span className="tw-tag gray" style={{ marginLeft: 6 }}>lead</span>}
              </span>
              {already.length > 0 && <span className="tw-cand-sub">already in {already.join(', ')}</span>}
            </label>
          );
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
        <span className="tw-hint" style={{ flex: 1 }}>
          {picked.length === 0 ? 'Nothing picked yet.'
            : picked.length === 1 ? `Bidding alone: ${names[0]}`
            : `Joint venture: ${names.join(' + ')} — ${names[0]} leads`}
        </span>
        {onCancel && <Btn className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</Btn>}
        <Btn className="btn btn-primary btn-sm" disabled={busy || !picked.length}
          onClick={() => { onAdd(picked); setPicked([]); }}>
          {picked.length > 1 ? 'Add as a joint venture' : 'Add bidder'}
        </Btn>
      </div>
    </div>
  );
}

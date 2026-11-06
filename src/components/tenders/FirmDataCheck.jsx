import { gapsByForm, firmGaps } from '../../utils/firmGaps.js';

/** The firms bidding on this tender that the check knows about. */
export function bidderFirms(tender, facts) {
  const ids = [...new Set((tender.bidders || []).flatMap(b => (b.firms || []).map(f => String(f.institute_id))))];
  return ids.map(id => facts?.get(id)).filter(Boolean);
}

/** Total missing items across this tender's firms. */
export function tenderGapCount(tender, facts) {
  return bidderFirms(tender, facts).reduce((n, f) => n + firmGaps(f).length, 0);
}

/**
 * For each firm bidding on this tender, what is still blank that the forms
 * will print as a dash — grouped by the form it belongs to.
 */
export default function FirmDataCheck({ tender, facts }) {
  const firms = bidderFirms(tender, facts);
  if (!firms.length) return null;
  const total = firms.reduce((n, f) => n + firmGaps(f).length, 0);
  return (
    <section className="tw-pack" aria-label="Firm data check">
      <div className="tw-section-head" style={{ marginBottom: 8 }}>
        <h3 className="tw-section-title" style={{ fontWeight: 600 }}>Firm data check</h3>
        <span className="tw-hint">{total ? `${total} item${total === 1 ? '' : 's'} missing across ${firms.length} firm${firms.length === 1 ? '' : 's'}` : 'Nothing missing'}</span>
      </div>
      <ul className="tw-pack-list">
        {firms.map(f => {
          const groups = gapsByForm(f);
          const n = groups.reduce((m, g) => m + g.items.length, 0);
          return (
            <li key={f.id} className={`tw-firmgap${groups.length ? '' : ' is-done'}`}>
              <div className="tw-firmgap-head">
                <strong>{f.acronym || f.name}</strong>
                <span className="tw-hint">{n ? `${n} missing` : 'Complete'}</span>
                {n > 0 && <a className="tw-link" href="#institutes">Open Institutes</a>}
              </div>
              {groups.map(g => (
                <div key={g.form} className="tw-firmgap-group">
                  <span className="tw-firmgap-form">{g.title}</span>
                  <span className="tw-firmgap-items">{g.items.map(x => x.label).join(' · ')}</span>
                </div>
              ))}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

import { useMemo, useState } from 'react';
import { getSession } from '../utils/auth.js';
import { useFirmFacts } from '../utils/useFirmFacts.js';
import { firmGaps, gapsByForm } from '../utils/firmGaps.js';
import { EmptyState } from './ui/primitives.jsx';

/**
 * Every firm and what it still has blank for the tender forms, most gaps first.
 * Same check as on a tender, so a firm can be completed before it is bid with.
 */
export default function FirmGapsPanel({ institutes = [], onOpen }) {
  const { facts } = useFirmFacts(getSession()?.token);
  const [openId, setOpenId] = useState(null);
  const [all, setAll] = useState(false);

  const rows = useMemo(() => {
    if (!facts) return null;
    return institutes.map(i => ({ inst: i, f: facts.get(String(i.id)) })).filter(r => r.f)
      .map(r => ({ ...r, n: firmGaps(r.f).length })).sort((a, b) => b.n - a.n || a.inst.name.localeCompare(b.inst.name));
  }, [facts, institutes]);

  if (rows == null) return null;
  const incomplete = rows.filter(r => r.n > 0);
  const shown = all ? incomplete : incomplete.slice(0, 6);

  return (
    <section className="frame" aria-label="Firm data check">
      <div className="frame-head">
        <span className="material-icons-round" aria-hidden="true">domain_verification</span>
        Firm data for tenders
        <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 400 }}>
          {incomplete.length ? `${incomplete.length} of ${rows.length} firms have gaps` : `${rows.length} firms`}
        </span>
      </div>
      <div className="frame-body" style={{ padding: 6 }}>
        {incomplete.length === 0 ? (
          <EmptyState icon="task_alt" title="Every firm is complete" body="Nothing is blank that the EOI forms read." />
        ) : (
          <>
            {shown.map(({ inst, f, n }) => (
              <div key={inst.id} className="tw-firmgap" style={{ marginBottom: 6 }}>
                <div className="tw-firmgap-head">
                  <button type="button" className="tw-link" aria-expanded={openId === inst.id}
                    onClick={() => setOpenId(openId === inst.id ? null : inst.id)}>
                    <strong>{inst.acronym || inst.name}</strong>
                  </button>
                  <span className="tw-hint">{n} missing</span>
                  <button type="button" className="tw-link" onClick={() => onOpen(inst)}>Open firm</button>
                </div>
                {openId === inst.id && gapsByForm(f).map(g => (
                  <div key={g.form} className="tw-firmgap-group">
                    <span className="tw-firmgap-form">{g.title}</span>
                    <span className="tw-firmgap-items">{g.items.map(x => x.label).join(' · ')}</span>
                  </div>
                ))}
              </div>
            ))}
            {incomplete.length > 6 && (
              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <button type="button" className="tw-link" onClick={() => setAll(a => !a)}>
                  {all ? 'Show fewer' : `Show all ${incomplete.length}`}</button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

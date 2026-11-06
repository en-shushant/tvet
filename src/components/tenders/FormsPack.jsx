import { FORM_LABELS, FORM_STATUSES, packFigures } from './pack.js';
import Select from '../ui/Select.jsx';

/**
 * The forms this notice asks for, one row each: switched on or off, how far it
 * is, and who approved it. Building a form is still done per bidder below.
 */
export default function FormsPack({ forms, canWrite, onChange }) {
  if (!forms.length) return null;
  const f = packFigures(forms, []);
  const when = (t) => t ? new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  return (
    <section className="tw-pack" aria-label="Forms for this notice">
      <div className="tw-section-head" style={{ marginBottom: 8 }}>
        <h3 className="tw-section-title" style={{ fontWeight: 600 }}>Forms for this notice</h3>
        <span className="tw-hint">{f.formsApproved} of {f.formsOn} approved</span>
      </div>
      <ul className="tw-pack-list">
        {forms.map(x => {
          const meta = FORM_LABELS[x.form_key] || { name: x.form_key, hint: '' };
          const off = x.enabled === false;
          return (
            <li key={x.form_key} className={`tw-pack-row${off ? ' is-off' : ''}${x.status === 'Approved' ? ' is-done' : ''}`}>
              <label className="tw-pack-on">
                <input type="checkbox" checked={!off} disabled={!canWrite}
                  onChange={e => onChange(x.form_key, { enabled: e.target.checked })}
                  aria-label={`Include ${meta.name}`} />
              </label>
              <div className="tw-pack-name">
                <span>{meta.name}</span>
                <span className="tw-hint">
                  {off ? 'Not asked for in this notice'
                    : x.status === 'Approved' ? `Approved${x.approved_by_name ? ` by ${x.approved_by_name}` : ''} · ${when(x.approved_at)}`
                    : meta.hint}
                </span>
              </div>
              <Select className="tw-in" style={{ width: 'auto', minWidth: 130 }} aria-label={`Status of ${meta.name}`}
                value={x.status} disabled={!canWrite || off}
                onChange={e => onChange(x.form_key, { status: e.target.value })}>
                {FORM_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

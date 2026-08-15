/**
 * Fill the Bolpatra gaps on one assignment, without the full editor.
 *
 * The five-step assignment editor is the right place to change an assignment.
 * It is the wrong place to close ten small gaps across ten assignments before a
 * submission, which means opening each one, finding the EOI step, and hunting
 * for the blank field among the filled ones.
 *
 * This shows only what is actually missing, in the order the report prints it,
 * and disappears field by field as it is filled.
 */
import { useState } from 'react';
import Modal from '../ui/Modal.jsx';
import { Btn } from '../../md.jsx';
import { missingBolpatraFields } from '../../utils/bolpatraGaps.js';

export default function BolpatraGapsModal({ exp, institute, onSave, onClose }) {
  const [form, setForm] = useState(() => ({ ...exp }));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  // Recomputed from the working copy, so a field vanishes as soon as it is
  // filled and the count is honest while typing.
  const gaps = missingBolpatraFields(form, institute);
  const editable = gaps.filter(g => g.field);
  const structural = gaps.filter(g => !g.field);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    setErr(''); setSaving(true);
    try {
      await onSave(form);
    } catch (e) {
      setErr(e.message || 'Failed to save');
      setSaving(false);
    }
  };

  return (
    <Modal title="Complete EOI details" onClose={onClose} size="lg"
      footer={<>
        <Btn className="btn btn-secondary" onClick={onClose}>Cancel</Btn>
        <Btn className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Btn>
      </>}>

      {err && <div className="gap-error">{err}</div>}

      <p className="gap-intro">
        <strong>{exp.assignmentName || 'This assignment'}</strong> — only the fields the
        EOI report would leave blank are shown.
      </p>

      {gaps.length === 0 ? (
        <div className="gap-clear">Nothing missing. This assignment prints in full.</div>
      ) : (
        <>
          {editable.map(g => (
            <div key={g.key} className="gap-field">
              <label htmlFor={`gap-${g.key}`}>{g.label}</label>
              <p className="gap-hint">{g.hint}</p>
              {g.long ? (
                <textarea id={`gap-${g.key}`} rows={4}
                  value={form[g.field] || ''}
                  onChange={e => set(g.field, e.target.value)}/>
              ) : (
                <input id={`gap-${g.key}`}
                  value={form[g.field] || ''}
                  onChange={e => set(g.field, e.target.value)}/>
              )}
            </div>
          ))}

          {structural.length > 0 && (
            // Client and districts are not free text — they are chosen in the
            // full editor, so pointing at them beats faking an input here.
            <div className="gap-structural">
              <div className="gap-structural-title">
                Fixed in the full editor, not here
              </div>
              {structural.map(g => (
                <div key={g.key} className="gap-structural-row">
                  <strong>{g.label}</strong> — {g.hint}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

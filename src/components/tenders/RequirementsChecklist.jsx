import { useState } from 'react';
import { ANSWERED_BY, STANDARD_REQUIREMENTS, packFigures } from './pack.js';
import Select from '../ui/Select.jsx';

/**
 * What the notice requires, one line each, and what answers it. A mandatory
 * line that is not met shows on the tender's summary.
 */
export default function RequirementsChecklist({ reqs, canWrite, onAdd, onUpdate, onRemove, templates = [], onSaveTemplate, onApplyTemplate }) {
  const [label, setLabel] = useState('');
  const [naming, setNaming] = useState(false);
  const [tplName, setTplName] = useState('');
  const f = packFigures([], reqs);
  const add = async () => { const v = label.trim(); if (!v) return; await onAdd([{ label: v }]); setLabel(''); };
  return (
    <section className="tw-pack" aria-label="Notice requirements checklist">
      <div className="tw-section-head" style={{ marginBottom: 8 }}>
        <h3 className="tw-section-title" style={{ fontWeight: 600 }}>Requirements checklist</h3>
        <span className="tw-hint">{reqs.length ? `${f.mandatoryMet} of ${f.mandatoryMet + f.mandatoryOpen} mandatory met` : 'Nothing listed yet'}</span>
      </div>
      {canWrite && (templates.length > 0 || reqs.length > 0) && (
        <div className="tw-tpl">
          {templates.length > 0 && (
            <Select className="tw-in" style={{ width: 'auto', minWidth: 200 }} aria-label="Start from a template" value=""
              onChange={e => { if (e.target.value) onApplyTemplate(e.target.value); }}>
              <option value="">Start from a template…</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          )}
          {reqs.length > 0 && !naming && <button type="button" className="tw-link" onClick={() => setNaming(true)}>Save this checklist as a template</button>}
          {naming && (
            <>
              <input className="tw-in" style={{ width: 220 }} placeholder="Template name" aria-label="Template name" value={tplName}
                onChange={e => setTplName(e.target.value)} />
              <button type="button" className="tw-link" disabled={!tplName.trim()}
                onClick={async () => { await onSaveTemplate(tplName.trim()); setNaming(false); setTplName(''); }}>Save</button>
              <button type="button" className="tw-link" onClick={() => { setNaming(false); setTplName(''); }}>Cancel</button>
            </>
          )}
        </div>
      )}
      {reqs.length === 0 && canWrite && (
        <p className="tw-hint" style={{ margin: '0 0 8px' }}>
          List what the notice asks for so nothing is missed at submission.{' '}
          <button type="button" className="tw-link" onClick={() => onAdd(STANDARD_REQUIREMENTS.map(l => ({ label: l })))}>
            Add the standard Bolpatra items</button>
        </p>
      )}
      <ul className="tw-pack-list">
        {reqs.map(r => (
          <li key={r.id} className={`tw-pack-row${r.met ? ' is-done' : ''}`}>
            <label className="tw-pack-on">
              <input type="checkbox" checked={!!r.met} disabled={!canWrite}
                onChange={e => onUpdate(r.id, { met: e.target.checked })} aria-label={`${r.label} is met`} />
            </label>
            <div className="tw-pack-name">
              <span>{r.label}</span>
              <span className="tw-hint">
                <label><input type="checkbox" checked={!!r.mandatory} disabled={!canWrite}
                  onChange={e => onUpdate(r.id, { mandatory: e.target.checked })} /> Mandatory</label>
              </span>
            </div>
            <Select className="tw-in" style={{ width: 'auto', minWidth: 120 }} aria-label={`Answered by for ${r.label}`}
              value={r.answered_by || ''} disabled={!canWrite}
              onChange={e => onUpdate(r.id, { answered_by: e.target.value || null })}>
              <option value="">Answered by…</option>
              {ANSWERED_BY.map(a => <option key={a} value={a}>{a}</option>)}
            </Select>
            {canWrite && <button type="button" className="tw-link tw-link-danger" onClick={() => onRemove(r.id)}>Remove</button>}
          </li>
        ))}
      </ul>
      {canWrite && (
        <div className="tw-pack-add">
          <input className="tw-in" placeholder="Add a requirement from the notice" value={label} aria-label="New requirement"
            onChange={e => setLabel(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
          <button type="button" className="tw-link" onClick={add} disabled={!label.trim()}>Add</button>
        </div>
      )}
    </section>
  );
}

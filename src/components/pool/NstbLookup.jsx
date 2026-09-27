/**
 * Fill vocational certificates from NSTB's published skill-test results.
 *
 * One date of birth, one symbol number per level they sat — a Level 1 and a
 * Level 2 are separate tests with separate symbol numbers. Each result found is
 * shown, and one click adds it as a certificate in the Education section below.
 *
 * The lookup goes through our own server (/api/hr/nstb-result), which asks a
 * third-party results service; see backend/lib/nstbResult.js. Nothing is saved
 * until the person record itself is saved.
 */
import { useState } from 'react';
import { api } from '../../utils/api.js';
import { getSession } from '../../utils/auth.js';
import { labelOfVocational } from '../../constants/education.js';
import { maskBsDate, isBsDate } from './common.js';
import NewTradeForm from './NewTradeForm.jsx';

const OUTCOME = {
  pass:     { label: 'Passed',   tone: 'ok' },
  fail:     { label: 'Not met',  tone: 'bad' },
  withheld: { label: 'Withheld', tone: 'warn' },
};

const blankRow = () => ({ symbol: '', state: 'idle', result: null, error: '', added: false });
const norm = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

/** The occupation in the master list whose name matches the certificate's trade. */
export function matchOccupation(occupations, name, level) {
  const n = norm(name);
  if (!n) return null;
  const same = occupations.filter(o => norm(o.name) === n);
  return same.find(o => o.level === level) || same[0]
    || occupations.find(o => norm(o.name).includes(n) || n.includes(norm(o.name))) || null;
}

/** The vocational qualification row a result becomes. */
export function certificateFrom(result, occupations) {
  const occ = matchOccupation(occupations, result.occupation, result.level);
  return {
    rule_id: '', kind: 'Academic', stream: 'Vocational', education_level: '',
    level: result.level || '', occupation_id: occ ? occ.id : '',
    title: [labelOfVocational(result.level), result.occupation].filter(Boolean).join(' — '),
    passed_year: result.yearBs || (/^\d{4}$/.test(result.year) ? result.year : ''),
    certificate_no: result.certificateNo || '',
    // The test centre is also where they trained (NSTB tests at training centres).
    board: 'NSTB', institution: result.testCenter || '', division: '', duration_hours: '', specialisation: '', duration_text: '',
    remarks: [result.symbolNo && `Symbol no. ${result.symbolNo}`, result.registration && `Reg. no. ${result.registration}`,
      result.year && `tested ${result.year}`, result.testCenter && `at ${result.testCenter}`,
      result.performance].filter(Boolean).join(' · '),
  };
}

export default function NstbLookup({ dob, onDob, occupations = [], personName, onAdd, onFillPerson, existing = [] }) {
  const [rows, setRows] = useState([blankRow()]);
  const [addingTrade, setAddingTrade] = useState(null);   // row index
  const setRow = (i, patch) => setRows(rs => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const dobOk = isBsDate(dob);

  const already = (res) => existing.some(q =>
    (res.certificateNo && q.certificate_no === res.certificateNo)
    || (q.remarks || '').includes(`Symbol no. ${res.symbolNo}`));

  const look = async (i) => {
    const symbol = rows[i].symbol.trim();
    if (!symbol || !dobOk) return;
    setRow(i, { state: 'loading', error: '', result: null, added: false });
    try {
      const { token } = getSession() || {};
      const r = await api('POST', '/hr/nstb-result', { symbolNo: symbol, dateOfBirth: dob }, token);
      if (!r?.found) setRow(i, { state: 'none' });
      else setRow(i, { state: 'found', result: r.result, added: already(r.result) });
    } catch (e) {
      setRow(i, { state: 'error', error: e.message || 'The lookup failed.' });
    }
  };
  const lookAll = () => rows.forEach((r, i) => { if (r.symbol.trim() && r.state !== 'loading') look(i); });

  const add = (i) => {
    const res = rows[i].result;
    onAdd(certificateFrom(res, occupations));
    setRow(i, { added: true });
    // A new record takes the name as NSTB has it, if nobody has typed one.
    if (!String(personName || '').trim()) onFillPerson?.({ full_name: res.name, father_name: res.fatherName });
  };

  const busy = rows.some(r => r.state === 'loading');
  const matched = (res) => !!matchOccupation(occupations, res.occupation, res.level);

  return (
    <div className="nstb">
      <div className="nstb-head">
        <div>
          <div className="nstb-title">Look up NSTB skill-test results</div>
          <div className="tw-hint">
            One symbol number per level they passed. Results come from NSTB&apos;s published list and
            usually take 10–20 seconds each.
          </div>
        </div>
      </div>

      <div className="nstb-grid">
        <label className="nstb-dob">
          <span className="nstb-label">Date of birth (BS)</span>
          <input className="tw-in" value={dob || ''} placeholder="2058/09/11" inputMode="numeric" maxLength={10}
            onChange={e => onDob(maskBsDate(e.target.value))} aria-invalid={!!dob && !dobOk} />
          {!!dob && !dobOk && <span className="nstb-err">Write it in full, e.g. 2058/09/11.</span>}
        </label>

        <div className="nstb-symbols">
          <span className="nstb-label">Symbol numbers</span>
          {rows.map((r, i) => (
            <div key={i} className="nstb-row">
              <div className="nstb-row-in">
                <input className="tw-in" value={r.symbol} placeholder={i === 0 ? 'e.g. 12345678' : 'Another level'}
                  aria-label={`Symbol number ${i + 1}`}
                  onChange={e => setRow(i, { symbol: e.target.value, state: 'idle', result: null, error: '', added: false })}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); look(i); } }} />
                <button type="button" className="btn btn-secondary btn-sm nstb-go" disabled={!r.symbol.trim() || !dobOk || r.state === 'loading'}
                  onClick={() => look(i)}>
                  {r.state === 'loading' ? <span className="spin material-icons-round">sync</span>
                    : <span className="material-icons-round">search</span>}
                  {r.state === 'loading' ? 'Looking up…' : 'Look up'}
                </button>
                {rows.length > 1 && (
                  <button type="button" className="nstb-x" aria-label={`Remove symbol number ${i + 1}`}
                    onClick={() => setRows(rs => rs.filter((_, k) => k !== i))}>
                    <span className="material-icons-round">close</span>
                  </button>
                )}
              </div>

              {r.state === 'none' && <div className="nstb-msg">No result found for this symbol number and date of birth.</div>}
              {r.state === 'error' && <div className="nstb-msg is-bad" role="alert">{r.error}</div>}
              {r.state === 'found' && (() => {
                const res = r.result;
                const o = OUTCOME[res.outcome] || { label: res.performance || 'Result', tone: 'warn' };
                const nameDiffers = personName && res.name && norm(personName) !== norm(res.name);
                return (
                  <div className="nstb-card">
                    <div className="nstb-card-top">
                      <div>
                        <div className="nstb-name">{res.name || '—'}</div>
                        <div className="nstb-sub">{[res.fatherName && `Father: ${res.fatherName}`, res.testCenter].filter(Boolean).join(' · ')}</div>
                      </div>
                      <span className={`nstb-badge is-${o.tone}`}>{o.label}</span>
                    </div>
                    <dl className="nstb-facts">
                      <div><dt>Trade</dt><dd>{res.occupation || '—'}</dd></div>
                      <div><dt>Level</dt><dd>{res.level ? labelOfVocational(res.level) : (res.levelText || '—')}</dd></div>
                      <div><dt>Tested</dt><dd>{res.year || '—'}{res.yearBs && res.yearBs !== res.year ? ` (BS ${res.yearBs})` : ''}</dd></div>
                      <div><dt>Certificate</dt><dd>{res.certificateNo || '—'}</dd></div>
                      <div><dt>Registration</dt><dd>{res.registration || '—'}</dd></div>
                      {(res.theoryMarks || res.theoryStatus) && (
                        <div><dt>Theory</dt><dd>{[res.theoryMarks, res.theoryStatus].filter(Boolean).join(' · ')}</dd></div>
                      )}
                    </dl>
                    {nameDiffers && <div className="nstb-msg is-warn">The name on this result differs from the name entered above — check it is the same person.</div>}
                    {!matched(res) && res.occupation && addingTrade !== i && (
                      <div className="nstb-msg is-warn">
                        “{res.occupation}” is not in the occupation list yet.{' '}
                        <button type="button" className="nstb-link" onClick={() => setAddingTrade(i)}>Add it as a trade</button>
                      </div>
                    )}
                    {addingTrade === i && (
                      <NewTradeForm initialName={res.occupation} level={res.level}
                        onCancel={() => setAddingTrade(null)} onDone={() => setAddingTrade(null)}/>
                    )}
                    {!res.level && <div className="nstb-msg is-warn">The level could not be read; it will need choosing on the certificate.</div>}
                    <div className="nstb-actions">
                      {r.added
                        ? <span className="nstb-added"><span className="material-icons-round">check_circle</span>Added to vocational certificates</span>
                        : res.outcome === 'pass'
                          ? <button type="button" className="btn btn-primary btn-sm" onClick={() => add(i)}>
                              <span className="material-icons-round">add</span>Add as certificate</button>
                          : <span className="tw-hint">Only a passed test is added as a certificate.</span>}
                    </div>
                  </div>
                );
              })()}
            </div>
          ))}
          <div className="nstb-more">
            <button type="button" className="tw-chip" onClick={() => setRows(rs => [...rs, blankRow()])}>+ Another level’s symbol number</button>
            {rows.filter(r => r.symbol.trim()).length > 1 && (
              <button type="button" className="tw-chip" disabled={busy || !dobOk} onClick={lookAll}>Look up all</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

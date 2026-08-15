/**
 * Renewals & Compliance — one place to answer "which firms can we actually bid
 * with right now?"
 *
 * Renewal dates, tax clearances, NSTB records and CTEVT affiliations each lived
 * only inside an individual institute's Compliance tab, so finding the firms
 * with an expired registration meant opening all 25 in turn. This is the same
 * data across every institute at once.
 *
 * Everything is derived from the institutes already in memory — the list
 * response carries renewalDue, taxClearance, nstb and affiliation — so this
 * screen costs no request. Nothing here is invented: a field the registry does
 * not hold reads as "Not recorded" rather than being guessed at or shown as 0,
 * because "no tax clearance on file" and "tax clearance for FY 0" are very
 * different answers to a bid officer.
 */
import { useState, useMemo } from 'react';
import { PageHeader, PillTabs, EmptyState, InstituteAvatar } from './ui/primitives.jsx';
import { daysUntilRenewal } from '../utils/format.js';
import { COMPLIANCE_FY } from '../constants/data.js';

/** Sorts FY strings like "2081/82" newest-first without parsing them as dates. */
const latestFy = (rows) => (rows || [])
  .map(r => r?.fy || r?.fiscalYear || '')
  .filter(Boolean)
  .sort()
  .pop() || '';

/**
 * Renewal state, bucketed rather than raw so the filters and the row badge
 * always agree. `null` days means no date on file, which is its own problem —
 * it is not the same as "not due yet".
 */
function renewalState(inst) {
  const days = daysUntilRenewal(inst.renewalDue);
  if (days == null) return { key: 'unknown', days: null, label: 'Renewal date not recorded', tone: 'muted' };
  if (days < 0) return { key: 'expired', days, label: `Overdue by ${Math.abs(days)} days`, tone: 'bad' };
  if (days <= 90) return { key: 'soon', days, label: `Due in ${days} days`, tone: 'warn' };
  return { key: 'ok', days, label: `Due in ${days} days`, tone: 'ok' };
}

/** The active affiliation, preferring one that has not expired. */
function affiliationState(inst) {
  const rows = inst.affiliation || [];
  if (rows.length === 0) return { label: 'None recorded', tone: 'muted' };
  const expired = rows.every(a => (a.status || '').toLowerCase() === 'expired');
  if (expired) return { label: 'Expired', tone: 'bad' };
  const active = rows.find(a => (a.status || '').toLowerCase() !== 'expired') || rows[0];
  return { label: active.status || 'Recorded', tone: 'ok' };
}

const TONE_COLOR = { bad: 'var(--red)', warn: 'var(--warning)', ok: 'var(--text2)', muted: 'var(--text3)' };

export default function ComplianceCentre({ institutes = [], onOpenInstitute }) {
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');

  const rows = useMemo(() => institutes.map(inst => {
    const renewal = renewalState(inst);
    const taxFy = latestFy(inst.taxClearance);
    const nstbFy = latestFy(inst.nstb);
    const affiliation = affiliationState(inst);
    // "Needs attention" is deliberately narrow: things that would actually stop
    // a bid, not every blank field in the registry.
    const issues = [];
    if (renewal.key === 'expired') issues.push('Registration renewal overdue');
    if (renewal.key === 'unknown') issues.push('No renewal date recorded');
    if (!taxFy) issues.push('No tax clearance recorded');
    else if (taxFy < COMPLIANCE_FY) issues.push(`Latest tax clearance is ${taxFy}, not ${COMPLIANCE_FY}`);
    if (affiliation.tone === 'bad') issues.push('Affiliation expired');
    return { inst, renewal, taxFy, nstbFy, affiliation, issues };
  }), [institutes]);

  const counts = useMemo(() => ({
    all: rows.length,
    attention: rows.filter(r => r.issues.length > 0).length,
    expired: rows.filter(r => r.renewal.key === 'expired').length,
    soon: rows.filter(r => r.renewal.key === 'soon').length,
  }), [rows]);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows
      .filter(r => tab === 'all'
        || (tab === 'attention' && r.issues.length > 0)
        || (tab === 'expired' && r.renewal.key === 'expired')
        || (tab === 'soon' && r.renewal.key === 'soon'))
      .filter(r => !term || [r.inst.name, r.inst.acronym].some(v => v && v.toLowerCase().includes(term)))
      // Most urgent first: overdue, then soonest due, then everything else.
      // Missing dates sort last — they need chasing, but not before an expiry.
      .sort((a, b) => {
        const rank = s => s.key === 'expired' ? 0 : s.key === 'soon' ? 1 : s.key === 'ok' ? 2 : 3;
        const d = rank(a.renewal) - rank(b.renewal);
        if (d !== 0) return d;
        if (a.renewal.days != null && b.renewal.days != null) return a.renewal.days - b.renewal.days;
        return a.inst.name.localeCompare(b.inst.name);
      });
  }, [rows, tab, q]);

  return (
    <>
      <PageHeader title="Renewals & Compliance"
        sub={`${counts.attention} of ${counts.all} institutes need attention`}/>

      <div style={{display:'flex', gap:12, alignItems:'center', flexWrap:'wrap', marginBottom:4}}>
        <PillTabs
          tabs={[
            { id:'all',       label:'All',            badge:counts.all },
            { id:'attention', label:'Needs attention', badge:counts.attention },
            { id:'expired',   label:'Renewal overdue', badge:counts.expired },
            { id:'soon',      label:'Due in 90 days',  badge:counts.soon },
          ]}
          value={tab} onChange={setTab} ariaLabel="Compliance filters"/>
        <input value={q} onChange={e => setQ(e.target.value)}
          placeholder="Search institute…" aria-label="Search institutes"
          style={{marginBottom:18, minWidth:200, flex:'0 1 260px'}}/>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon="fact_check"
          title={q ? `Nothing matches “${q}”` : 'Nothing outstanding'}
          body={q ? 'Try a different name or acronym.' : 'No institute in this group needs attention.'}/>
      ) : (
        <div className="compliance-table-wrap">
          <table className="compliance-table">
            <thead>
              <tr>
                <th>Institute</th>
                <th>Registration renewal</th>
                <th>Tax clearance</th>
                <th>NSTB</th>
                <th>Affiliation</th>
                <th>Needs attention</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ inst, renewal, taxFy, nstbFy, affiliation, issues }) => (
                <tr key={inst.id} onClick={() => onOpenInstitute?.(inst)}
                    tabIndex={0} role="link"
                    onKeyDown={e => { if (e.key === 'Enter') onOpenInstitute?.(inst); }}>
                  <td>
                    <div style={{display:'flex', alignItems:'center', gap:10}}>
                      <InstituteAvatar src={inst.logo} fallbackSrc={inst.logo}
                        name={inst.name} acronym={inst.acronym} size={30} radius={9}/>
                      <div style={{minWidth:0}}>
                        <div className="compliance-name">{inst.name}</div>
                        {inst.acronym && <div className="compliance-sub">{inst.acronym}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{color:TONE_COLOR[renewal.tone]}}>{renewal.label}</td>
                  <td style={{color: taxFy ? 'var(--text2)' : 'var(--text3)'}}>{taxFy || 'Not recorded'}</td>
                  <td style={{color: nstbFy ? 'var(--text2)' : 'var(--text3)'}}>{nstbFy || 'Not recorded'}</td>
                  <td style={{color:TONE_COLOR[affiliation.tone]}}>{affiliation.label}</td>
                  <td>
                    {issues.length === 0
                      ? <span className="compliance-clear">Clear</span>
                      : <span className="compliance-issues">{issues.join(' · ')}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

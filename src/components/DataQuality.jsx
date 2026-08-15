/**
 * Data Quality — the gaps that stop a bid going out.
 *
 * The EOI report reads level, duration, trainees, districts and contract dates
 * off each assignment. When one is blank the document still generates, just with
 * a hole in it, and that is usually discovered while assembling a submission.
 * This finds them beforehand.
 *
 * Scope is deliberately narrow. Every check here corresponds to something that
 * either breaks a report or misrepresents the firm — not to every empty column
 * in the registry. A screen that flags 400 harmless blanks gets ignored, and
 * then so do the twelve that matter.
 *
 * Everything is derived from institutes already in memory. Assignments only
 * exist on institutes whose detail page has been loaded, so the assignment
 * checks state plainly how many they cover rather than implying registry-wide
 * coverage they do not have.
 */
import { useState, useMemo } from 'react';
import { PageHeader, PillTabs, EmptyState } from './ui/primitives.jsx';
import { getOccupation } from '../utils/format.js';

/**
 * One row per problem, not per record: an assignment missing three fields is
 * three things to fix, and collapsing them would hide two.
 */
function findIssues(institutes) {
  const out = [];
  const add = (severity, group, inst, what, where, tab) =>
    out.push({ id: `${inst.id}-${group}-${what}-${where}`, severity, group, inst, what, where, tab });

  for (const inst of institutes) {
    // ── Registry identity. These print on the EOI cover and bid letters.
    if (!inst.regNo)   add('high', 'Institute', inst, 'No registration number', 'Profile', 'profile');
    if (!inst.pan)     add('high', 'Institute', inst, 'No PAN', 'Profile', 'profile');
    if (!inst.address) add('med',  'Institute', inst, 'No address', 'Profile', 'profile');
    if (!inst.acronym) add('low',  'Institute', inst, 'No acronym', 'Profile', 'profile');

    // ── Assignments. Only present once the institute's detail has been loaded.
    for (const exp of inst.experience || []) {
      const label = exp.assignmentName || `FY ${exp.fy || '—'}`;
      if (!exp.assignmentName) add('high', 'Assignment', inst, 'No assignment name', `FY ${exp.fy || '—'}`, 'experience');
      if (!exp.clientId && !exp.clientName) add('high', 'Assignment', inst, 'No client', label, 'experience');
      if (!exp.fy) add('high', 'Assignment', inst, 'No fiscal year', label, 'experience');

      const occs = exp.occupations || [];
      if (occs.length === 0) {
        add('high', 'Assignment', inst, 'No occupations recorded', label, 'experience');
        continue;
      }
      for (const occ of occs) {
        const occName = getOccupation(occ.ctevtOccupationId).name || occ.nameInLetter || 'Unnamed occupation';
        const at = `${label} · ${occName}`;
        if (!occ.ctevtOccupationId) add('high', 'Occupation', inst, 'Not linked to master data', at, 'experience');
        if (!occ.level)    add('med', 'Occupation', inst, 'No level', at, 'experience');
        if (!occ.duration) add('med', 'Occupation', inst, 'No duration', at, 'experience');
        if (!occ.trainees) add('med', 'Occupation', inst, 'No trainee count', at, 'experience');
        if (!(occ.locations || []).some(l => l.district))
          add('low', 'Occupation', inst, 'No district', at, 'experience');
      }
    }
  }
  return out;
}

const SEVERITY = {
  high: { label: 'Blocks a report', color: 'var(--red)',     rank: 0 },
  med:  { label: 'Leaves a gap',    color: 'var(--warning)', rank: 1 },
  low:  { label: 'Worth filling',   color: 'var(--text3)',   rank: 2 },
};

export default function DataQuality({ institutes = [], onOpenInstitute }) {
  const [tab, setTab] = useState('high');
  const [q, setQ] = useState('');

  const issues = useMemo(() => findIssues(institutes), [institutes]);
  const loaded = useMemo(() => institutes.filter(i => (i.experience || []).length > 0).length, [institutes]);

  const counts = useMemo(() => ({
    all:  issues.length,
    high: issues.filter(i => i.severity === 'high').length,
    med:  issues.filter(i => i.severity === 'med').length,
    low:  issues.filter(i => i.severity === 'low').length,
  }), [issues]);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return issues
      .filter(i => tab === 'all' || i.severity === tab)
      .filter(i => !term || [i.inst.name, i.inst.acronym, i.what, i.where]
        .some(v => v && v.toLowerCase().includes(term)))
      .sort((a, b) =>
        SEVERITY[a.severity].rank - SEVERITY[b.severity].rank ||
        a.inst.name.localeCompare(b.inst.name) ||
        a.what.localeCompare(b.what))
      // A registry-wide scan can produce thousands of rows; the list is a work
      // queue, not a report, so it is capped and says so.
      .slice(0, 300);
  }, [issues, tab, q]);

  const total = tab === 'all' ? counts.all : counts[tab];

  return (
    <>
      <PageHeader title="Data Quality"
        sub={counts.high > 0
          ? `${counts.high} ${counts.high === 1 ? 'problem' : 'problems'} would leave a hole in a generated report`
          : 'Nothing outstanding blocks a report'}/>

      <div style={{display:'flex', gap:12, alignItems:'center', flexWrap:'wrap'}}>
        <PillTabs
          tabs={[
            { id:'high', label:'Blocks a report', badge:counts.high },
            { id:'med',  label:'Leaves a gap',    badge:counts.med },
            { id:'low',  label:'Worth filling',   badge:counts.low },
            { id:'all',  label:'Everything',      badge:counts.all },
          ]}
          value={tab} onChange={setTab} ariaLabel="Issue severity"/>
        <input value={q} onChange={e => setQ(e.target.value)}
          placeholder="Search institute or problem…" aria-label="Search issues"
          style={{marginBottom:18, minWidth:220, flex:'0 1 280px'}}/>
      </div>

      {/* Said plainly rather than implied: assignments are only in memory for
          institutes whose detail page has been opened this session. */}
      <p className="dq-scope">
        Checked {institutes.length} {institutes.length === 1 ? 'institute' : 'institutes'};
        assignment-level checks cover the {loaded} whose assignments are loaded.
        Open an institute to include its assignments here.
      </p>

      {visible.length === 0 ? (
        <EmptyState icon="task_alt"
          title={q ? `Nothing matches “${q}”` : 'Nothing to fix here'}
          body={q ? 'Try a different institute or problem.' : 'No records in this group are missing anything.'}/>
      ) : (
        <>
          <div className="dq-list">
            {visible.map(issue => (
              <button key={issue.id} type="button" className="dq-row"
                onClick={() => onOpenInstitute?.(issue.inst, issue.tab)}>
                <span className="dq-dot" style={{background:SEVERITY[issue.severity].color}} aria-hidden="true"/>
                <span className="dq-what">{issue.what}</span>
                <span className="dq-where">{issue.where}</span>
                <span className="dq-inst">{issue.inst.acronym || issue.inst.name}</span>
                <span className="dq-go" aria-hidden="true">›</span>
              </button>
            ))}
          </div>
          {total > visible.length && (
            <p className="dq-scope">Showing the first {visible.length} of {total}. Fix these and the rest will surface.</p>
          )}
        </>
      )}
    </>
  );
}

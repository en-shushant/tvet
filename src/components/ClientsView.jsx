/**
 * Clients — who the registry actually works for.
 *
 * Clients existed only as rows in Master Data: a name, a type, and no sense of
 * whether anyone had ever been engaged by them. The useful questions are about
 * engagement — how many assignments, which institutes, how many trainees, when
 * last — and none of those could be asked.
 *
 * Assignments are read from GET /institutes/compliance, which already returns
 * every assignment across the registry for Project Compliance. Deriving from
 * `institutes` instead would silently limit this to institutes whose detail page
 * happened to have been opened, which for a "who do we work for" screen would
 * be worse than useless — it would be quietly wrong.
 *
 * Editing stays in Master Data. This screen is the view that was missing, not a
 * second place to change the same records.
 */
import { useState, useEffect, useMemo } from 'react';
import { PageHeader, PillTabs, EmptyState, SkeletonTable, StatusBadge } from './ui/primitives.jsx';
import { api } from '../utils/api.js';
import { fmt } from '../utils/format.js';

export default function ClientsView({ clients = [], token, onGoToMasterData }) {
  const [assignments, setAssignments] = useState(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState('engaged');
  const [q, setQ] = useState('');

  useEffect(() => {
    let alive = true;
    api('GET', '/institutes/compliance', null, token)
      .then(insts => {
        if (!alive) return;
        const flat = [];
        for (const inst of insts || []) {
          for (const a of inst.experience || []) {
            flat.push({
              instituteId: inst.id,
              instituteName: inst.name,
              clientId: a.client_id,
              clientManual: a.client_name_manual || '',
              fy: a.fiscal_year || '',
              trainees: (a.occupations || []).reduce((n, o) => n + (parseInt(o.trainees) || 0), 0),
            });
          }
        }
        setAssignments(flat);
      })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [token]);

  const rows = useMemo(() => {
    if (!assignments) return [];
    // Master-data clients keyed by id, plus any manual client name that appears
    // on an assignment but was never added to Master Data — those are real
    // engagements and hiding them would understate the work done.
    const byKey = new Map();
    for (const c of clients) {
      byKey.set(`id:${c.id}`, {
        key: `id:${c.id}`, id: c.id, name: c.fullName || c.shortName || '—',
        shortName: c.shortName || '', type: c.type || '—', address: c.address || '',
        managed: true, assignments: 0, institutes: new Set(), trainees: 0, fys: new Set(),
      });
    }
    for (const a of assignments) {
      const key = a.clientId ? `id:${a.clientId}` : (a.clientManual ? `m:${a.clientManual}` : null);
      if (!key) continue;
      if (!byKey.has(key)) {
        byKey.set(key, {
          key, id: null, name: a.clientManual, shortName: '', type: 'Not in Master data',
          address: '', managed: false, assignments: 0, institutes: new Set(), trainees: 0, fys: new Set(),
        });
      }
      const row = byKey.get(key);
      row.assignments += 1;
      row.institutes.add(a.instituteId);
      row.trainees += a.trainees;
      if (a.fy) row.fys.add(a.fy);
    }
    return [...byKey.values()].map(r => ({
      ...r,
      institutes: r.institutes.size,
      latestFy: [...r.fys].sort().pop() || '',
    }));
  }, [clients, assignments]);

  const counts = useMemo(() => ({
    all: rows.length,
    engaged: rows.filter(r => r.assignments > 0).length,
    unused: rows.filter(r => r.assignments === 0).length,
    unmanaged: rows.filter(r => !r.managed).length,
  }), [rows]);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows
      .filter(r => tab === 'all'
        || (tab === 'engaged' && r.assignments > 0)
        || (tab === 'unused' && r.assignments === 0)
        || (tab === 'unmanaged' && !r.managed))
      .filter(r => !term || [r.name, r.shortName, r.type].some(v => v && v.toLowerCase().includes(term)))
      .sort((a, b) => b.assignments - a.assignments || a.name.localeCompare(b.name));
  }, [rows, tab, q]);

  if (failed) {
    return (
      <>
        <PageHeader title="Clients"/>
        <EmptyState icon="error_outline" title="Could not load engagement history"
          body="Client records are still editable in Master data."/>
      </>
    );
  }
  if (!assignments) {
    return (<><PageHeader title="Clients"/><SkeletonTable rows={6} cols={5}/></>);
  }

  return (
    <>
      <PageHeader title="Clients"
        sub={`${counts.engaged} of ${counts.all} have assignments on record`}
        actions={onGoToMasterData && (
          <button className="btn btn-secondary btn-sm" onClick={onGoToMasterData}>
            Manage in Master data
          </button>
        )}/>

      <div style={{display:'flex', gap:12, alignItems:'center', flexWrap:'wrap'}}>
        <PillTabs
          tabs={[
            { id:'engaged',   label:'Engaged',            badge:counts.engaged },
            { id:'unused',    label:'No assignments',     badge:counts.unused },
            { id:'unmanaged', label:'Not in Master data', badge:counts.unmanaged },
            { id:'all',       label:'All',                badge:counts.all },
          ]}
          value={tab} onChange={setTab} ariaLabel="Client filters"/>
        <input value={q} onChange={e => setQ(e.target.value)}
          placeholder="Search client…" aria-label="Search clients"
          style={{marginBottom:18, minWidth:200, flex:'0 1 260px'}}/>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon="apartment"
          title={q ? `Nothing matches “${q}”` : 'No clients in this group'}
          body={q ? 'Try a different name or type.' : 'Add clients from Master data.'}/>
      ) : (
        <div className="compliance-table-wrap">
          <table className="compliance-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>Type</th>
                <th style={{textAlign:'right'}}>Assignments</th>
                <th style={{textAlign:'right'}}>Institutes</th>
                <th style={{textAlign:'right'}}>Trainees</th>
                <th>Latest FY</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(r => (
                <tr key={r.key} style={{cursor:'default'}}>
                  <td>
                    <div className="compliance-name">{r.name}</div>
                    {(r.shortName || r.address) && (
                      <div className="compliance-sub">{[r.shortName, r.address].filter(Boolean).join(' · ')}</div>
                    )}
                  </td>
                  <td>
                    {r.managed
                      ? <span style={{color:'var(--text2)'}}>{r.type}</span>
                      : <StatusBadge tone="warning">Not in Master data</StatusBadge>}
                  </td>
                  <td style={{textAlign:'right', fontVariantNumeric:'tabular-nums'}}>{r.assignments || '—'}</td>
                  <td style={{textAlign:'right', fontVariantNumeric:'tabular-nums'}}>{r.institutes || '—'}</td>
                  <td style={{textAlign:'right', fontVariantNumeric:'tabular-nums'}}>{fmt(r.trainees)}</td>
                  <td style={{color: r.latestFy ? 'var(--text2)' : 'var(--text3)'}}>{r.latestFy || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

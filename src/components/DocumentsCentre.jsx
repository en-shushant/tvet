/**
 * Documents — which institutes hold which statutory paperwork.
 *
 * The files themselves live on each institute's Documents tab. What was missing
 * was the overview: answering "who still owes us a VAT registration?" meant
 * opening every institute and checking nine slots by eye.
 *
 * Presence is fetched as booleans from GET /institutes/documents rather than
 * pulling the files — these columns hold base64 uploads, so asking for all of
 * them across the registry would move megabytes to answer a yes/no question.
 */
import { useState, useEffect, useMemo } from 'react';
import { PageHeader, PillTabs, EmptyState, SkeletonTable, InstituteAvatar } from './ui/primitives.jsx';
import { DOC_KEYS } from '../constants/data.js';
import { api } from '../utils/api.js';

export default function DocumentsCentre({ institutes = [], token, onOpenInstitute }) {
  const [presence, setPresence] = useState(null); // id -> { key: bool }
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');

  useEffect(() => {
    let alive = true;
    api('GET', '/institutes/documents', null, token)
      .then(rows => {
        if (!alive) return;
        const byId = new Map();
        for (const r of rows) {
          byId.set(r.id, Object.fromEntries(DOC_KEYS.map(d => [d.key, !!r[d.column]])));
        }
        setPresence(byId);
      })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [token]);

  const rows = useMemo(() => {
    if (!presence) return [];
    return institutes.map(inst => {
      const held = presence.get(inst.id) || {};
      const missing = DOC_KEYS.filter(d => !held[d.key]);
      return { inst, held, missing, complete: missing.length === 0 };
    });
  }, [institutes, presence]);

  const counts = useMemo(() => ({
    all: rows.length,
    incomplete: rows.filter(r => !r.complete).length,
    none: rows.filter(r => r.missing.length === DOC_KEYS.length).length,
  }), [rows]);

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows
      .filter(r => tab === 'all'
        || (tab === 'incomplete' && !r.complete)
        || (tab === 'none' && r.missing.length === DOC_KEYS.length))
      .filter(r => !term || [r.inst.name, r.inst.acronym].some(v => v && v.toLowerCase().includes(term)))
      // Most gaps first — that is the work queue.
      .sort((a, b) => b.missing.length - a.missing.length || a.inst.name.localeCompare(b.inst.name));
  }, [rows, tab, q]);

  if (failed) {
    return (
      <>
        <PageHeader title="Documents"/>
        <EmptyState icon="error_outline" title="Could not load document status"
          body="The registry is still reachable — open an institute to see its documents directly."/>
      </>
    );
  }

  if (!presence) {
    return (
      <>
        <PageHeader title="Documents"/>
        <SkeletonTable rows={6} cols={5}/>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Documents"
        sub={`${counts.incomplete} of ${counts.all} institutes have paperwork outstanding`}/>

      <div style={{display:'flex', gap:12, alignItems:'center', flexWrap:'wrap'}}>
        <PillTabs
          tabs={[
            { id:'all',        label:'All',            badge:counts.all },
            { id:'incomplete', label:'Incomplete',     badge:counts.incomplete },
            { id:'none',       label:'Nothing on file', badge:counts.none },
          ]}
          value={tab} onChange={setTab} ariaLabel="Document filters"/>
        <input value={q} onChange={e => setQ(e.target.value)}
          placeholder="Search institute…" aria-label="Search institutes"
          style={{marginBottom:18, minWidth:200, flex:'0 1 260px'}}/>
      </div>

      {visible.length === 0 ? (
        <EmptyState icon="folder_open"
          title={q ? `Nothing matches “${q}”` : 'Nothing outstanding'}
          body={q ? 'Try a different name or acronym.' : 'Every institute in this group has all nine documents on file.'}/>
      ) : (
        <div className="docs-table-wrap">
          <table className="docs-table">
            <thead>
              <tr>
                <th className="docs-name-col">Institute</th>
                {DOC_KEYS.map(d => (
                  // Nepali label is what the documents themselves are called;
                  // the English name is the tooltip rather than the heading.
                  <th key={d.key} className="docs-doc-col" title={d.en}>{d.label}</th>
                ))}
                <th className="docs-count-col">On file</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ inst, held, missing }) => (
                <tr key={inst.id} onClick={() => onOpenInstitute?.(inst, 'documents')}
                    tabIndex={0} role="link"
                    onKeyDown={e => { if (e.key === 'Enter') onOpenInstitute?.(inst, 'documents'); }}>
                  <td className="docs-name-col">
                    <div style={{display:'flex', alignItems:'center', gap:10}}>
                      <InstituteAvatar src={inst.logo} fallbackSrc={inst.logo}
                        name={inst.name} acronym={inst.acronym} size={28} radius={8}/>
                      <div style={{minWidth:0}}>
                        <div className="compliance-name">{inst.name}</div>
                        {inst.acronym && <div className="compliance-sub">{inst.acronym}</div>}
                      </div>
                    </div>
                  </td>
                  {DOC_KEYS.map(d => (
                    <td key={d.key} className="docs-cell">
                      <span className={held[d.key] ? 'docs-yes' : 'docs-no'}
                        title={`${d.en} — ${held[d.key] ? 'on file' : 'missing'}`}>
                        {held[d.key] ? '●' : '—'}
                      </span>
                    </td>
                  ))}
                  <td className="docs-count-col">
                    <span className={missing.length === 0 ? 'docs-complete' : 'docs-partial'}>
                      {DOC_KEYS.length - missing.length}/{DOC_KEYS.length}
                    </span>
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

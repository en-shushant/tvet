import React, { useState, useEffect, useMemo } from 'react';
import { FISCAL_YEARS, CLIENT_TYPES, OCCUPATIONS } from '../constants/data.js';
import { exportToCSV } from '../utils/export.js';
import { getSession } from '../utils/auth.js';
import { api, normInst } from '../utils/api.js';
import JVGroupPanel, { computeInstStats } from './JVGroupPanel.jsx';

const fmt = (n) => n ? Number(n).toLocaleString('en-IN') : '—';
const pct = (n, d) => d > 0 ? ((n/d)*100).toFixed(1) + '%' : '—';

function getOccupation(id) {
  const rawId = typeof id === 'string' && id.startsWith('c:') ? parseInt(id.slice(2)) : id;
  return OCCUPATIONS.find(o => o.id === rawId) || {};
}

function ProjectCompliance({institutes, clients}) {
  const token = getSession()?.token;
  const [fullInsts, setFullInsts] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedFYs, setSelectedFYs] = useState([]);
  const [selectedClientTypes, setSelectedClientTypes] = useState([]);
  const [selectedOccs, setSelectedOccs] = useState([]);
  const [minDuration, setMinDuration] = useState('');
  const [occSearch, setOccSearch] = useState('');
  const [jvGroups, setJvGroups] = useState([]);

  // Load all institute details once
  useEffect(() => {
    if (!institutes.length) return;
    setLoading(true);
    Promise.all(
      institutes.map(inst =>
        api('GET', `/institutes/${inst.id}`, null, token)
          .then(data => [inst.id, normInst(data)])
          .catch(() => [inst.id, null])
      )
    ).then(results => {
      const map = {};
      results.forEach(([id, data]) => { if (data) map[id] = data; });
      setFullInsts(map);
      setLoading(false);
    });
  }, [institutes.length]);

  const toggleFY = fy => setSelectedFYs(s => s.includes(fy) ? s.filter(x=>x!==fy) : [...s, fy]);
  const toggleCT = ct => setSelectedClientTypes(s => s.includes(ct) ? s.filter(x=>x!==ct) : [...s, ct]);
  const toggleOcc = o => setSelectedOccs(s => s.includes(o) ? s.filter(x=>x!==o) : [...s, o]);

  const filteredOccList = useMemo(() => {
    if (!occSearch.trim()) return OCCUPATIONS;
    const q = occSearch.toLowerCase();
    return OCCUPATIONS.filter(o => o.name.toLowerCase().includes(q) || o.sector.toLowerCase().includes(q));
  }, [occSearch]);

  const filters = {selectedFYs, selectedClientTypes, selectedOccs, minDuration, clients};
  const activeFilterCount = selectedFYs.length + selectedClientTypes.length + selectedOccs.length + (minDuration?1:0);

  // Individual firm results
  const results = useMemo(() => {
    if (!activeFilterCount) return null;
    return Object.values(fullInsts).map(inst => {
      const r = computeInstStats(inst, filters);
      if (!r.assignments && selectedOccs.length > 0) return null;
      return r;
    }).filter(Boolean);
  }, [fullInsts, selectedFYs, selectedClientTypes, selectedOccs, minDuration, clients, activeFilterCount]);

  // JV group results
  const jvResults = useMemo(() => {
    if (!activeFilterCount) return [];
    return jvGroups.map(g => {
      const partnerInsts = g.partnerIds.map(id => fullInsts[id]).filter(Boolean);
      if (!partnerInsts.length) return null;
      return computeJVStats(g, partnerInsts, filters);
    }).filter(Boolean);
  }, [jvGroups, fullInsts, selectedFYs, selectedClientTypes, selectedOccs, minDuration, clients, activeFilterCount]);

  const resetFilters = () => { setSelectedFYs([]); setSelectedClientTypes([]); setSelectedOccs([]); setMinDuration(''); setOccSearch(''); };

  const renderOccCells = (r) => selectedOccs.length > 0
    ? r.occBreakdown.map(o => {
        const affColor = o.affStatus==='Active' ? 'var(--green,#22c55e)' : o.affStatus ? 'var(--text3)' : null;
        return (
          <React.Fragment key={o.name}>
            <td className="mono" style={{textAlign:'center', borderLeft:'1px solid var(--border)'}}>
              {o.trainees>0 ? <span style={{fontWeight:600}}>{o.trainees.toLocaleString()}</span> : <span style={{color:'var(--text3)'}}>—</span>}
              {o.assignments>0 && <div style={{fontSize:10, color:'var(--text3)'}}>{o.assignments} asgn</div>}
            </td>
            <td style={{textAlign:'center', fontSize:11}}>
              {o.affStatus ? <span style={{color:affColor, fontWeight:600}}>{o.affStatus}</span> : <span style={{color:'var(--text3)'}}>—</span>}
            </td>
          </React.Fragment>
        );
      })
    : <>
        <td className="mono" style={{textAlign:'center'}}>{r.assignments||'—'}</td>
        <td className="mono" style={{textAlign:'center'}}>{r.totalTrainees>0 ? r.totalTrainees.toLocaleString() : '—'}</td>
      </>;

  const hasAny = results !== null && (results.length > 0 || jvResults.length > 0);

  return (
    <div className="fade-in" style={{display:'flex', gap:20, alignItems:'flex-start'}}>
      {/* Filter panel */}
      <div className="filter-panel">
        <div className="filter-panel-header">
          <span style={{fontSize:14}}>✅</span>
          <span className="filter-panel-header-title">Project criteria</span>
          {activeFilterCount > 0 && (
            <span style={{marginLeft:'auto', background:'var(--accent)', color:'#fff', borderRadius:10, fontSize:10, fontWeight:700, padding:'1px 7px'}}>{activeFilterCount}</span>
          )}
        </div>
        <div className="filter-panel-body">
          <div className="filter-section">
            <div className="filter-label">Fiscal year</div>
            <div className="multi-select-list">
              {FISCAL_YEARS.slice().reverse().slice(0,10).map(fy => (
                <label key={fy} className="multi-select-item">
                  <input type="checkbox" checked={selectedFYs.includes(fy)} onChange={()=>toggleFY(fy)}/>
                  {fy}
                </label>
              ))}
            </div>
          </div>
          <div className="filter-section">
            <div className="filter-label">Client type</div>
            {['Government','NGO','INGO','Association','Private Limited','Public Limited','Other'].map(ct => (
              <label key={ct} className="multi-select-item">
                <input type="checkbox" checked={selectedClientTypes.includes(ct)} onChange={()=>toggleCT(ct)}/>
                {ct}
              </label>
            ))}
          </div>
          <div className="filter-section">
            <div className="filter-label">Occupation</div>
            {selectedOccs.length > 0 && (
              <div style={{marginBottom:6, display:'flex', flexWrap:'wrap', gap:4}}>
                {selectedOccs.map(o => (
                  <span key={o} style={{fontSize:10, background:'color-mix(in srgb, var(--accent) 15%, transparent)', color:'var(--accent)', borderRadius:4, padding:'2px 6px', cursor:'pointer'}} onClick={()=>toggleOcc(o)}>
                    {o.split(',')[0]} ✕
                  </span>
                ))}
              </div>
            )}
            <input className="form-input" style={{marginBottom:6, fontSize:12, padding:'5px 8px'}}
              placeholder="Search occupations…" value={occSearch} onChange={e=>setOccSearch(e.target.value)}/>
            <div className="multi-select-list" style={{maxHeight:180, overflowY:'auto'}}>
              {filteredOccList.length === 0
                ? <div style={{fontSize:12, color:'var(--text3)', padding:'4px 0'}}>No results</div>
                : filteredOccList.map(o => (
                  <label key={o.id} className="multi-select-item">
                    <input type="checkbox" checked={selectedOccs.includes(o.name)} onChange={()=>toggleOcc(o.name)}/>
                    <span style={{fontSize:11, lineHeight:1.3}}>{o.name}</span>
                  </label>
                ))
              }
            </div>
          </div>
          <div className="filter-section">
            <div className="filter-label">Min. training duration</div>
            {[['','All durations'],['160','160+ hrs'],['390','390+ hrs']].map(([val,label]) => (
              <label key={val} className="multi-select-item">
                <input type="radio" name="comp-duration" checked={minDuration===val} onChange={()=>setMinDuration(val)}/>
                {label}
              </label>
            ))}
          </div>
          <JVGroupPanel institutes={institutes} jvGroups={jvGroups} onChange={setJvGroups}/>
        </div>
        <button className="filter-reset-btn" onClick={resetFilters}>↺ Reset filters</button>
      </div>

      {/* Results */}
      <div style={{flex:1, minWidth:0}}>
        {loading ? (
          <div className="empty-state" style={{background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)'}}>
            <div className="empty-state-icon">⏳</div>
            <div className="empty-state-title">Loading institute data…</div>
          </div>
        ) : results === null ? (
          <div className="empty-state" style={{background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)'}}>
            <div className="empty-state-icon">✅</div>
            <div className="empty-state-title">Set project criteria</div>
            <div className="empty-state-sub">Select fiscal years, client types, occupations and duration to find matching firms — then group them into JVs using the panel on the left</div>
          </div>
        ) : !hasAny ? (
          <div className="empty-state" style={{background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)'}}>
            <div className="empty-state-icon">🔍</div>
            <div className="empty-state-title">No firms match these criteria</div>
            <div className="empty-state-sub">Try relaxing the filters</div>
          </div>
        ) : (
          <div className="card" style={{padding:0, overflow:'hidden'}}>
            <div style={{padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10}}>
              <span style={{fontWeight:600, fontSize:14}}>Results</span>
              {jvResults.length > 0 && (
                <span style={{fontSize:11, background:'color-mix(in srgb, var(--accent) 12%, transparent)', color:'var(--accent)', borderRadius:10, padding:'2px 8px', fontWeight:600}}>
                  {jvResults.length} JV{jvResults.length>1?'s':''}
                </span>
              )}
              <span style={{fontSize:12, color:'var(--text3)'}}>{results.length} individual firm{results.length!==1?'s':''}</span>
            </div>
            <div className="table-wrap">
              <table className="summary-table">
                <thead>
                  <tr>
                    <th>Firm / JV</th>
                    <th>Turnover</th>
                    {selectedOccs.length > 0
                      ? selectedOccs.map(o => (
                          <th key={o} colSpan={2} style={{textAlign:'center', borderLeft:'1px solid var(--border)'}}>
                            <div style={{fontSize:11, fontWeight:600}}>{o.split(',')[0]}</div>
                            <div style={{fontSize:10, color:'var(--text3)', fontWeight:400, display:'flex', gap:12, justifyContent:'center', marginTop:2}}>
                              <span>Trainees</span><span>Affil.</span>
                            </div>
                          </th>
                        ))
                      : <><th style={{textAlign:'center'}}>Assignments</th><th style={{textAlign:'center'}}>Trainees</th></>
                    }
                    <th>Districts</th>
                  </tr>
                </thead>
                <tbody>
                  {/* JV rows first */}
                  {jvResults.map(r => (
                    <React.Fragment key={r.group.id}>
                      <tr style={{background:'color-mix(in srgb, var(--accent) 6%, var(--surface))'}}>
                        <td>
                          <div style={{display:'flex', alignItems:'center', gap:6}}>
                            <span style={{fontSize:13}}>🤝</span>
                            <div>
                              <div style={{fontWeight:700, fontSize:13}}>{r.group.name}</div>
                              <div style={{fontSize:10, color:'var(--text3)', marginTop:1}}>
                                {r.partnerStats.map(p => p.inst.acronym || p.inst.name.split(' ').slice(0,2).join(' ')).join(' · ')}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="mono" style={{fontSize:12}}>
                          {r.combinedTurnover > 0
                            ? <span style={{fontWeight:600}}>NPR {fmt(r.combinedTurnover)}<div style={{fontSize:10, color:'var(--text3)', fontWeight:400}}>combined</div></span>
                            : <span style={{color:'var(--text3)'}}>—</span>}
                        </td>
                        {renderOccCells(r)}
                        <td style={{fontSize:11, color:'var(--text3)', maxWidth:200}}>
                          {r.allDistricts.length > 0
                            ? <><span style={{fontWeight:600, color:'var(--accent)'}}>{r.allDistricts.length}</span> — {r.allDistricts.join(', ')}</>
                            : '—'}
                        </td>
                      </tr>
                      {/* Per-partner sub-rows */}
                      {r.partnerStats.map(p => (
                        <tr key={p.inst.id} style={{background:'color-mix(in srgb, var(--accent) 2%, var(--surface))'}}>
                          <td style={{paddingLeft:32}}>
                            <div style={{fontSize:11, color:'var(--text2)'}}>↳ {p.inst.name}</div>
                            {p.inst.acronym && <span className="badge badge-purple" style={{fontSize:9}}>{p.inst.acronym}</span>}
                          </td>
                          <td className="mono" style={{fontSize:11, color:'var(--text3)'}}>
                            {p.avgTurnover > 0 ? `NPR ${fmt(p.avgTurnover)}` : '—'}
                          </td>
                          {renderOccCells(p)}
                          <td style={{fontSize:10, color:'var(--text3)'}}>
                            {p.allDistricts.length > 0
                              ? <><span style={{fontWeight:600}}>{p.allDistricts.length}</span> — {p.allDistricts.join(', ')}</>
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}

                  {/* Divider between JVs and individual firms */}
                  {jvResults.length > 0 && results.length > 0 && (
                    <tr>
                      <td colSpan={99} style={{padding:'4px 16px', background:'var(--bg2)', fontSize:10, color:'var(--text3)', fontWeight:600, letterSpacing:'0.5px', textTransform:'uppercase'}}>
                        Individual firms
                      </td>
                    </tr>
                  )}

                  {/* Individual firm rows */}
                  {results.map(r => (
                    <tr key={r.inst.id}>
                      <td>
                        <div style={{fontWeight:600, fontSize:13}}>{r.inst.name}</div>
                        {r.inst.acronym && <span className="badge badge-purple" style={{fontSize:10, fontFamily:'var(--font-mono)'}}>{r.inst.acronym}</span>}
                      </td>
                      <td className="mono" style={{fontSize:12}}>
                        {r.avgTurnover > 0
                          ? <span>NPR {fmt(r.avgTurnover)}{selectedFYs.length > 0 && <span style={{fontSize:10, color:'var(--text3)', display:'block'}}>{selectedFYs.length} FY avg</span>}</span>
                          : <span style={{color:'var(--text3)'}}>—</span>}
                      </td>
                      {renderOccCells(r)}
                      <td style={{fontSize:11, color:'var(--text3)', maxWidth:200}}>
                        {r.allDistricts.length > 0
                          ? <><span style={{fontWeight:600, color:'var(--accent)'}}>{r.allDistricts.length}</span> — {r.allDistricts.join(', ')}</>
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProjectCompliance;

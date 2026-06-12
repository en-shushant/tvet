import { useState, useMemo } from 'react';
import { FISCAL_YEARS, OCCUPATIONS } from '../constants/data.js';
import { exportComparisonToCSV } from '../utils/export.js';

const fmt = (n) => n ? Number(n).toLocaleString('en-IN') : '—';
const pct = (n, d) => d > 0 ? ((n/d)*100).toFixed(1) + '%' : '—';

function getOccupation(id) {
  const rawId = typeof id === 'string' && id.startsWith('c:') ? parseInt(id.slice(2)) : id;
  return OCCUPATIONS.find(o => o.id === rawId) || {};
}

function ComparisonView({institutes, clients}) {
  const [selectedInsts, setSelectedInsts] = useState([]);
  const [jvGroups, setJvGroups] = useState([]);
  const [selectedFYs, setSelectedFYs] = useState([]);
  const [selectedOccs, setSelectedOccs] = useState([]);
  const [fullInsts, setFullInsts] = useState({});
  const [occSearch, setOccSearch] = useState('');
  const [minDuration, setMinDuration] = useState('');

  const toggleInst = (id) => setSelectedInsts(s => s.includes(id) ? s.filter(x=>x!==id) : [...s, id]);
  const toggleFY = (fy) => setSelectedFYs(s => s.includes(fy) ? s.filter(f=>f!==fy) : [...s, fy]);
  const toggleOcc = (o) => setSelectedOccs(s => s.includes(o) ? s.filter(x=>x!==o) : [...s, o]);

  // Load full data for all needed institute IDs (selected + JV partners)
  useEffect(() => {
    const needed = [...new Set([...selectedInsts, ...jvGroups.flatMap(g => g.partnerIds)])];
    needed.forEach(id => {
      if (fullInsts[id]) return;
      api('GET', `/institutes/${id}`, null, getSession()?.token)
        .then(data => setFullInsts(prev => ({...prev, [id]: normInst(data)})))
        .catch(() => {});
    });
  }, [selectedInsts, jvGroups]);

  const selectedInstObjects = selectedInsts.map(id => fullInsts[id] || institutes.find(i=>i.id===id)).filter(Boolean);

  // Collect all unique occupations across selected institutes + JV partners
  const allInstIds = [...new Set([...selectedInsts, ...jvGroups.flatMap(g => g.partnerIds)])];
  const allOccs = useMemo(() => {
    const occs = new Set();
    allInstIds.forEach(id => {
      const inst = fullInsts[id] || institutes.find(i => i.id===id);
      if (!inst) return;
      (inst.nstb||[]).forEach(n => occs.add(n.occupation));
      (inst.experience||[]).forEach(exp => exp.occupations.forEach(o => {
        const ctevt = getOccupation(o.ctevtOccupationId);
        occs.add(ctevt.name || o.nameInLetter);
      }));
    });
    return [...occs].filter(Boolean).sort();
  }, [selectedInstObjects, jvGroups, fullInsts]);

  const activeFilterCount = selectedInsts.length + selectedFYs.length + selectedOccs.length + (minDuration?1:0) + jvGroups.length;

  // Aggregate NSTB rows for a list of institute objects
  const aggregateNSTB = (instList, selFYs, selOccs) => {
    const all = instList.flatMap(inst => (inst.nstb||[]).filter(n => {
      const fyMatch = selFYs.length === 0 || selFYs.includes(n.fy);
      const occMatch = selOccs.length === 0 || selOccs.some(o =>
        o.toLowerCase().includes(n.occupation.toLowerCase()) || n.occupation.toLowerCase().includes(o.split(',')[0].toLowerCase())
      );
      return fyMatch && occMatch;
    }));
    // Group by occupation+level, sum the numbers
    const groups = {};
    all.forEach(n => {
      const key = `${n.occupation}||${n.level}||${n.fy}`;
      if (!groups[key]) groups[key] = {...n, applied:0, appeared:0, pass:0, _insts:new Set()};
      groups[key].applied += (n.applied||0);
      groups[key].appeared += (n.appeared||0);
      groups[key].pass += (n.pass||0);
      groups[key]._insts.add(n.id);
    });
    return Object.values(groups);
  };

  const aggregateExpStats = (instList, selFYs, selOccs, minDur) => {
    let totalTrainees=0, totalStAppeared=0, totalStPass=0;
    instList.forEach(inst => {
      const expRows = (inst.experience||[]).filter(e => selFYs.length===0 || selFYs.includes(e.fy));
      expRows.flatMap(e => e.occupations).filter(o => {
        if (minDur && (parseInt(o.duration)||0) < parseInt(minDur)) return false;
        const ctevt = getOccupation(o.ctevtOccupationId);
        const occName = ctevt.name || o.nameInLetter;
        return selOccs.length===0 || selOccs.includes(occName);
      }).forEach(o => {
        totalTrainees += parseInt(o.trainees)||0;
        totalStAppeared += parseInt(o.skillTestAppeared)||0;
        totalStPass += parseInt(o.skillTestPass)||0;
      });
    });
    return {totalTrainees, totalStAppeared, totalStPass};
  };

  const avgTurnoverForInsts = (instList, selFYs) => {
    const allTax = instList.flatMap(inst => (inst.taxClearance||[]).filter(t => selFYs.length===0 || selFYs.includes(t.fy)));
    if (!allTax.length) return 0;
    return Math.round(allTax.reduce((s,t) => s+(parseInt(t.turnover)||0), 0) / allTax.length);
  };

  const renderComparisonCard = (label, instList, isJV=false, jvGroup=null) => {
    if (!instList.length) return null;
    const nstbRows = aggregateNSTB(instList, selectedFYs, selectedOccs);
    const {totalTrainees, totalStAppeared, totalStPass} = aggregateExpStats(instList, selectedFYs, selectedOccs, minDuration);
    const totalApplied = nstbRows.reduce((s,n) => s+(n.applied||0), 0);
    const totalPass = nstbRows.reduce((s,n) => s+(n.pass||0), 0);
    const totalAppeared = nstbRows.reduce((s,n) => s+(n.appeared||0), 0);
    const avgTurnover = isJV
      ? instList.reduce((s,inst) => {
          const rows = (inst.taxClearance||[]).filter(t => selectedFYs.length===0||selectedFYs.includes(t.fy));
          return s + (rows.length ? Math.round(rows.reduce((a,t)=>a+(parseInt(t.turnover)||0),0)/rows.length) : 0);
        }, 0)
      : avgTurnoverForInsts(instList, selectedFYs);

    const headerBg = isJV ? 'color-mix(in srgb, var(--accent) 85%, #000)' : 'var(--text)';
    const inst = !isJV ? instList[0] : null;

    return (
      <div className="card" style={{marginBottom:16, padding:0, overflow:'hidden'}}>
        {/* Header */}
        <div style={{padding:'14px 20px', background:headerBg, display:'flex', alignItems:'center', gap:10}}>
          {isJV && <span style={{fontSize:16}}>🤝</span>}
          {inst?.acronym && (
            <span style={{background:'rgba(109,191,138,0.2)', color:'#6DBF8A', fontFamily:'var(--font-mono)', fontSize:12, fontWeight:600, padding:'2px 8px', borderRadius:4}}>
              {inst.acronym}
            </span>
          )}
          <span style={{fontWeight:700, color:'#fff', fontSize:14}}>{label}</span>
          {!isJV && inst && <StatusBadge status={inst.status}/>}
          {isJV && (
            <span style={{fontSize:11, color:'rgba(255,255,255,0.6)', marginLeft:4}}>
              {instList.map(i => i.acronym || i.name.split(' ')[0]).join(' · ')}
            </span>
          )}
          {!isJV && inst && <span style={{color:'rgba(255,255,255,0.4)', fontSize:12, marginLeft:'auto'}}>{inst.address}</span>}
        </div>

        {/* Stats bar */}
        <div style={{display:'flex', gap:0, borderBottom:'1px solid var(--border)'}}>
          {[
            ['Total trainees', totalTrainees, 'var(--accent)'],
            ...(totalStAppeared>0 ? [['ST appeared', totalStAppeared, 'var(--accent)']] : []),
            ...(totalStPass>0 ? [['ST pass', totalStPass, 'var(--accent)']] : []),
            ['NSTB applied', totalApplied, 'var(--blue)'],
            ['NSTB appeared', totalAppeared, 'var(--text2)'],
            ['NSTB pass', totalPass, 'var(--accent)'],
            ['Pass rate', totalAppeared>0?(totalPass/totalAppeared*100).toFixed(1)+'%':'—', 'var(--amber)'],
            ['Appear rate', totalApplied>0?(totalAppeared/totalApplied*100).toFixed(1)+'%':'—', 'var(--blue)'],
            ...(avgTurnover>0 ? [[isJV?'Combined turnover':'Avg turnover/yr', `NPR ${fmt(avgTurnover)}`, 'var(--amber)']] : []),
          ].map(([lbl,val,color],i) => (
            <div key={i} style={{flex:1, padding:'12px 14px', borderRight:'1px solid var(--border)', textAlign:'center'}}>
              <div style={{fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:4}}>{lbl}</div>
              <div style={{fontSize:18, fontWeight:700, fontFamily:'var(--font-serif)', color}}>{val||'—'}</div>
            </div>
          ))}
        </div>

        {/* NSTB detail table */}
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>Occupation</th><th>Level</th><th>FY</th>
              <th>Applied</th><th>Appeared</th><th>Pass</th>
              <th>Appear rate</th><th>Pass rate</th><th>Affiliation</th>
            </tr></thead>
            <tbody>
              {nstbRows.length === 0
                ? <tr><td colSpan="9" style={{textAlign:'center', color:'var(--text3)', padding:'20px'}}>No NSTB data for selected filters</td></tr>
                : nstbRows.map((r,ri) => {
                    const hasAffil = instList.some(inst =>
                      (inst.affiliation||[]).some(a => a.status==='Active' &&
                        (a.programs||[]).some(p => p.name && p.name.toLowerCase().includes(r.occupation.toLowerCase())))
                    );
                    return (
                      <tr key={ri}>
                        <td><strong>{r.occupation}</strong></td>
                        <td><span className="badge badge-purple">{r.level}</span></td>
                        <td className="mono text-sm">{r.fy}</td>
                        <td className="mono">{r.applied}</td>
                        <td className="mono">{r.appeared}</td>
                        <td className="mono">{r.pass}</td>
                        <td><span className="badge badge-info">{pct(r.appeared, r.applied)}</span></td>
                        <td><span className={`badge ${parseFloat(pct(r.pass,r.appeared))>=70?'badge-active':'badge-pending'}`}>{pct(r.pass,r.appeared)}</span></td>
                        <td>{hasAffil ? <span className="badge badge-active">Active</span> : <span className="badge badge-gray">—</span>}</td>
                      </tr>
                    );
                  })
              }
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const hasAnything = selectedInstObjects.length > 0 || jvGroups.some(g => g.partnerIds.some(id => fullInsts[id]));

  return (
    <div className="fade-in" style={{display:'flex', gap:20, alignItems:'flex-start'}}>
      <div className="filter-panel">
        <div className="filter-panel-header">
          <span style={{fontSize:14}}>⚖</span>
          <span className="filter-panel-header-title">Compare</span>
          {activeFilterCount > 0 && (
            <span style={{marginLeft:'auto', background:'var(--accent)', color:'#fff', borderRadius:10, fontSize:10, fontWeight:700, padding:'1px 7px'}}>
              {activeFilterCount}
            </span>
          )}
        </div>
        <div className="filter-panel-body">

          <div className="filter-section">
            <div className="filter-label">Individual firms</div>
            {institutes.map(i=>(
              <label key={i.id} className="multi-select-item">
                <input type="checkbox" checked={selectedInsts.includes(i.id)} onChange={()=>toggleInst(i.id)}/>
                <span style={{fontSize:12, lineHeight:1.3}}>
                  {i.acronym ? <span className="mono" style={{color:'var(--accent)'}}>{i.acronym}</span> : i.name.split(' ').slice(0,4).join(' ')}
                </span>
              </label>
            ))}
          </div>

          <JVGroupPanel institutes={institutes} jvGroups={jvGroups} onChange={setJvGroups}/>

          <div className="filter-section">
            <div className="filter-label">Fiscal year</div>
            <div className="multi-select-list">
              {FISCAL_YEARS.slice().reverse().slice(0,10).map(fy=>(
                <label key={fy} className="multi-select-item">
                  <input type="checkbox" checked={selectedFYs.includes(fy)} onChange={()=>toggleFY(fy)}/>
                  {fy}
                </label>
              ))}
            </div>
          </div>

          <div className="filter-section">
            <div className="filter-label">Occupation</div>
            {allOccs.length === 0
              ? <div style={{fontSize:11, color:'var(--text3)', padding:'4px 0'}}>Select institutes first</div>
              : <>
                  <input value={occSearch} onChange={e=>setOccSearch(e.target.value)} placeholder="Search…"
                    style={{width:'100%', fontSize:12, padding:'5px 8px', marginBottom:6, boxSizing:'border-box'}}/>
                  <div className="multi-select-list">
                    {allOccs.filter(o=>!occSearch||o.toLowerCase().includes(occSearch.toLowerCase())).map(o=>(
                      <label key={o} className="multi-select-item">
                        <input type="checkbox" checked={selectedOccs.includes(o)} onChange={()=>toggleOcc(o)}/>
                        <span style={{fontSize:11, lineHeight:1.3}}>{o}</span>
                      </label>
                    ))}
                  </div>
                </>
            }
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

        </div>
        <button className="filter-reset-btn" onClick={()=>{setSelectedInsts([]);setJvGroups([]);setSelectedFYs([]);setSelectedOccs([]);setMinDuration('');}}>
          ↺ Reset
        </button>
      </div>

      <div style={{flex:1, minWidth:0}}>
        {!hasAnything ? (
          <div className="empty-state" style={{background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)'}}>
            <div className="empty-state-icon">⚖</div>
            <div className="empty-state-title">Select firms or create a JV to compare</div>
            <div className="empty-state-sub">Pick individual firms from the list, or group 2–6 firms into a JV using the "JV Groups" panel</div>
          </div>
        ) : (
          <>
            <div style={{display:'flex', justifyContent:'flex-end', gap:8, marginBottom:12}}>
              <button className="btn btn-secondary btn-sm" onClick={()=>exportComparisonToCSV(selectedInstObjects, selectedFYs)}>↓ Export (CSV)</button>
            </div>
            {/* JV group cards */}
            {jvGroups.map(g => {
              const partnerInsts = g.partnerIds.map(id => fullInsts[id]).filter(Boolean);
              if (!partnerInsts.length) return null;
              return renderComparisonCard(g.name, partnerInsts, true, g);
            })}
            {/* Individual firm cards */}
            {selectedInstObjects.map(inst =>
              renderComparisonCard(inst.name, [inst], false)
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default ComparisonView;

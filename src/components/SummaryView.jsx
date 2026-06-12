import { useState, useMemo } from 'react';
import { FISCAL_YEARS, OCCUPATIONS, SECTORS, CLIENT_TYPES } from '../constants/data.js';
import { exportSummaryToMD, exportSummaryToPDF, exportSummaryToCSV } from '../utils/export.js';
import { getSession } from '../utils/auth.js';
import { api, normInst } from '../utils/api.js';

const fmt = (n) => n ? Number(n).toLocaleString('en-IN') : '—';
const pct = (n, d) => d > 0 ? ((n/d)*100).toFixed(1) + '%' : '—';
const fyToAD = (fy) => {
  if (!fy) return '';
  const parts = fy.split('/');
  if (parts.length !== 2) return '';
  const y1 = parseInt(parts[0]);
  if (isNaN(y1)) return '';
  return `${y1-57}/${String(y1-57+1).slice(-2)}`;
};

function getOccupation(id) {
  const rawId = typeof id === 'string' && id.startsWith('c:') ? parseInt(id.slice(2)) : id;
  return OCCUPATIONS.find(o => o.id === rawId) || {};
}

function SummaryView({institutes, clients}) {
  const [selectedInst, setSelectedInst] = useState('');
  const [selectedFYs, setSelectedFYs] = useState([]);
  const [selectedOccs, setSelectedOccs] = useState([]);
  const [selectedClientTypes, setSelectedClientTypes] = useState([]);
  const [fullInst, setFullInst] = useState(null);
  const [loadingInst, setLoadingInst] = useState(false);

  const institute = fullInst || institutes.find(i=>i.id===parseInt(selectedInst));

  useEffect(() => {
    if (!selectedInst) { setFullInst(null); return; }
    setLoadingInst(true);
    api('GET', `/institutes/${selectedInst}`, null, getSession()?.token)
      .then(data => { setFullInst(normInst(data)); setLoadingInst(false); })
      .catch(() => setLoadingInst(false));
  }, [selectedInst]);

  const [occSearch, setOccSearch] = useState('');
  const [minDuration, setMinDuration] = useState('');

  const toggleFY = (fy) => setSelectedFYs(s => s.includes(fy) ? s.filter(f=>f!==fy) : [...s, fy]);
  const toggleOcc = (o) => setSelectedOccs(s => s.includes(o) ? s.filter(x=>x!==o) : [...s, o]);
  const toggleCT = (t) => setSelectedClientTypes(s => s.includes(t) ? s.filter(x=>x!==t) : [...s, t]);

  // Build summary rows
  const summaryRows = useMemo(() => {
    if(!institute) return [];
    const rows = {};

    // Experience
    institute.experience.filter(exp => {
      const fyMatch = selectedFYs.length === 0 || selectedFYs.includes(exp.fy);
      const client = getClient(clients, exp.clientId);
      const ctMatch = selectedClientTypes.length === 0 || selectedClientTypes.includes(client.type);
      return fyMatch && ctMatch;
    }).forEach(exp => {
      const client = getClient(clients, exp.clientId);
      exp.occupations.forEach(occ => {
        if(minDuration && (parseInt(occ.duration)||0) < parseInt(minDuration)) return;
        const ctevtOcc = getOccupation(occ.ctevtOccupationId);
        const occName = ctevtOcc.name || occ.nameInLetter;
        if(selectedOccs.length > 0 && !selectedOccs.includes(occName)) return;

        const occLevel = occ.level || ctevtOcc.level || '';
        const key = `${occName}__${occLevel}`;
        if(!rows[key]) {
          rows[key] = {
            occupation: occName,
            sector: ctevtOcc.sector || '—',
            level: occLevel || '—',
            clientIds: new Set(), clientNames: new Set(), clientTypes: new Set(),
            trainees: 0, stAppeared: 0, stPass: 0, hasOptional: false,
            districts: new Set(),
            nstbApplied: 0, nstbAppeared: 0, nstbPass: 0,
            nstbLevel: '—', affiliationStatus: '—', affiliationFrom: '—', affiliationTo: '—'
          };
        }
        const r = rows[key];
        r.clientIds.add(exp.clientId);
        r.clientNames.add(client.shortName || client.fullName);
        r.clientTypes.add(client.type);
        r.trainees += parseInt(occ.trainees)||0;
        if(occ.skillTestAppeared) { r.stAppeared += parseInt(occ.skillTestAppeared)||0; r.hasOptional = true; }
        if(occ.skillTestPass) { r.stPass += parseInt(occ.skillTestPass)||0; }
        (occ.locations||[]).forEach(l => { if(l.district) r.districts.add(l.district); });
      });
    });

    // NSTB
    institute.nstb.filter(n => selectedFYs.length === 0 || selectedFYs.includes(n.fy)).forEach(n => {
      const occName = n.occupation;
      if(!occName) return;
      if(selectedOccs.length > 0 && !selectedOccs.some(o => o.includes(occName) || occName.includes(o.split(',')[0]))) return;
      const matchKey = Object.keys(rows).find(k => k.toLowerCase().includes(occName.toLowerCase()) || occName.toLowerCase().includes(k.split(',')[0].toLowerCase()));
      const key = matchKey || occName;
      if(!rows[key]) {
        rows[key] = {
          occupation: occName, sector: '—',
          clientIds: new Set(), clientNames: new Set(), clientTypes: new Set(),
          trainees: 0, stAppeared: 0, stPass: 0, hasOptional: false,
          districts: new Set(),
          nstbApplied: 0, nstbAppeared: 0, nstbPass: 0,
          nstbLevel: '—', affiliationStatus: '—', affiliationFrom: '—', affiliationTo: '—'
        };
      }
      rows[key].nstbApplied += n.applied||0;
      rows[key].nstbAppeared += n.appeared||0;
      rows[key].nstbPass += n.pass||0;
      rows[key].nstbLevel = n.level;
    });

    // Affiliation
    Object.keys(rows).forEach(key => {
      const aff = institute.affiliation.find(a => (a.programs||[]).some(p => p.name && p.name.toLowerCase().includes(key.split(',')[0].toLowerCase())));
      if(aff) {
        rows[key].affiliationStatus = aff.status;
        rows[key].affiliationFrom = aff.affiliationDate;
        rows[key].affiliationTo = aff.expiryDate;
      }
    });

    return Object.values(rows);
  }, [institute, selectedFYs, selectedOccs, selectedClientTypes, minDuration, clients]);

  // Available occupations from selected institute
  const availableOccs = useMemo(() => {
    if(!institute) return [];
    const occs = new Set();
    institute.experience.forEach(exp => exp.occupations.forEach(occ => {
      const ctevtOcc = getOccupation(occ.ctevtOccupationId);
      occs.add(ctevtOcc.name || occ.nameInLetter);
    }));
    return [...occs];
  }, [institute]);

  return (
    <div className="fade-in" style={{display:'flex', gap:20, alignItems:'flex-start'}}>
      {/* Filter panel */}
      <div className="filter-panel">
        <div className="filter-panel-header">
          <span style={{fontSize:14}}>⚙</span>
          <span className="filter-panel-header-title">Filters</span>
          {(selectedFYs.length > 0 || selectedOccs.length > 0 || selectedClientTypes.length > 0 || minDuration) && (
            <span style={{marginLeft:'auto', background:'var(--accent)', color:'#fff', borderRadius:10, fontSize:10, fontWeight:700, padding:'1px 7px'}}>
              {selectedFYs.length + selectedOccs.length + selectedClientTypes.length + (minDuration?1:0)}
            </span>
          )}
        </div>
        <div className="filter-panel-body">

          <div className="filter-section">
            <div className="filter-label">Institute</div>
            <select value={selectedInst} onChange={e=>setSelectedInst(e.target.value)} style={{width:'100%'}}>
              <option value="">— Select —</option>
              {institutes.map(i=><option key={i.id} value={i.id}>{i.acronym || i.name}</option>)}
            </select>
          </div>

          <div className="filter-section">
            <div className="filter-label">Fiscal year</div>
            <div className="multi-select-list">
              {FISCAL_YEARS.slice().reverse().slice(0,15).map(fy=>(
                <label key={fy} className="multi-select-item">
                  <input type="checkbox" checked={selectedFYs.includes(fy)} onChange={()=>toggleFY(fy)}/>
                  {fy}
                </label>
              ))}
            </div>
          </div>

          <div className="filter-section">
            <div className="filter-label">Occupation</div>
            <input value={occSearch} onChange={e=>setOccSearch(e.target.value)} placeholder="Search…"
              style={{width:'100%', fontSize:12, padding:'5px 8px', marginBottom:6, boxSizing:'border-box'}}/>
            <div className="multi-select-list">
              {availableOccs.filter(o=>!occSearch||o.toLowerCase().includes(occSearch.toLowerCase())).map(o=>(
                <label key={o} className="multi-select-item">
                  <input type="checkbox" checked={selectedOccs.includes(o)} onChange={()=>toggleOcc(o)}/>
                  <span style={{fontSize:11, lineHeight:1.3}}>{o}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="filter-section">
            <div className="filter-label">Client type</div>
            {CLIENT_TYPES.map(t=>(
              <label key={t} className="multi-select-item">
                <input type="checkbox" checked={selectedClientTypes.includes(t)} onChange={()=>toggleCT(t)}/>
                {t}
              </label>
            ))}
          </div>

          <div className="filter-section">
            <div className="filter-label">Min. training duration</div>
            {[['', 'All durations'], ['160', '160+ hrs'], ['390', '390+ hrs']].map(([val, label]) => (
              <label key={val} className="multi-select-item">
                <input type="radio" name="summ-duration" checked={minDuration === val} onChange={()=>setMinDuration(val)}/>
                {label}
              </label>
            ))}
          </div>

        </div>
        <button className="filter-reset-btn" onClick={()=>{setSelectedFYs([]);setSelectedOccs([]);setSelectedClientTypes([]);setMinDuration('');}}>
          ↺ Reset filters
        </button>
      </div>

      {/* Results */}
      <div style={{flex:1, minWidth:0}}>
        {loadingInst ? (
          <div className="empty-state" style={{background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)'}}>
            <div className="empty-state-icon">⏳</div>
            <div className="empty-state-title">Loading institute data…</div>
          </div>
        ) : !institute ? (
          <div className="empty-state" style={{background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)'}}>
            <div className="empty-state-icon">📊</div>
            <div className="empty-state-title">Select an institute to view summary</div>
            <div className="empty-state-sub">Choose an institute from the filter panel, then select fiscal years and occupations</div>
          </div>
        ) : (
          <>
            {/* Firm details card */}
            <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,padding:'14px 18px',marginBottom:12,boxShadow:'var(--shadow)'}}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                    {institute.logo && <img src={institute.logo} alt="" style={{width:36,height:36,objectFit:'contain',borderRadius:6,border:'1px solid var(--border)',background:'#fff',padding:2,flexShrink:0}}/>}
                    <div>
                      <div style={{fontWeight:700,fontSize:15,color:'var(--text)'}}>{institute.name}</div>
                      <div style={{fontSize:11,color:'var(--text3)'}}>{institute.address}{institute.district?` · ${institute.district}`:''}{institute.province?`, ${institute.province}`:''}</div>
                    </div>
                    {institute.acronym && <span className="badge badge-purple" style={{fontFamily:'var(--font-mono)',fontSize:10,flexShrink:0}}>{institute.acronym}</span>}
                    <span className={`badge ${institute.status==='Active'?'badge-active':institute.status==='Expired'?'badge-expired':'badge-pending'}`} style={{fontSize:10,flexShrink:0}}>{institute.status}</span>
                  </div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:'4px 20px',fontSize:11,color:'var(--text2)'}}>
                    {institute.phone && <span>📞 {institute.phone}</span>}
                    {institute.email && <span>✉ {institute.email}</span>}
                    {institute.registrationNo && <span>📋 Reg: {institute.registrationNo}</span>}
                    {institute.renewalDue && <span>🗓 Renewal: {institute.renewalDue}</span>}
                    {institute.website && <a href={institute.website} target="_blank" rel="noreferrer" style={{color:'var(--primary)'}}>🌐 Website</a>}
                  </div>
                </div>
                <div style={{display:'flex',gap:8,flexShrink:0,alignItems:'center'}}>
                  <button className="btn btn-secondary btn-sm" onClick={()=>exportSummaryToMD(institute, summaryRows, selectedFYs)}>↓ MD</button>
                  <button className="btn btn-secondary btn-sm" onClick={()=>exportSummaryToPDF(institute, summaryRows, selectedFYs)}>↓ PDF</button>
                </div>
              </div>
              {/* Quick stats strip */}
              {(() => {
                const taxRows = institute.taxClearance.filter(t => selectedFYs.length===0 || selectedFYs.includes(t.fy));
                const tot = summaryRows.reduce((a,r)=>({t:a.t+r.trainees,d:new Set([...a.d,...r.districts])}),{t:0,d:new Set()});
                const allClients = new Set(summaryRows.flatMap(r=>[...r.clientNames]));
                // Count unique provinces, local levels by type — respects all active filters
                const provinces = new Set();
                const metro = new Set(), submetro = new Set(), muni = new Set(), rural = new Set();
                institute.experience.filter(exp => {
                  const fyMatch = selectedFYs.length === 0 || selectedFYs.includes(exp.fy);
                  const client = getClient(clients, exp.clientId);
                  const ctMatch = selectedClientTypes.length === 0 || selectedClientTypes.includes(client.type);
                  return fyMatch && ctMatch;
                }).forEach(exp => exp.occupations.forEach(occ => {
                  if (minDuration && (parseInt(occ.duration)||0) < parseInt(minDuration)) return;
                  const ctevtOcc = getOccupation(occ.ctevtOccupationId);
                  const occName = ctevtOcc.name || occ.nameInLetter;
                  if (selectedOccs.length > 0 && !selectedOccs.includes(occName)) return;
                  (occ.locations||[]).forEach(loc => {
                    if (loc.province) provinces.add(loc.province);
                    (loc.localLevels||[]).forEach(ll => {
                      if (!ll.name) return;
                      const key = `${loc.district}__${ll.name}`;
                      if (ll.type === 'Metropolitan City') metro.add(key);
                      else if (ll.type === 'Sub-Metropolitan City') submetro.add(key);
                      else if (ll.type === 'Municipality') muni.add(key);
                      else if (ll.type === 'Rural Municipality') rural.add(key);
                    });
                  });
                }));
                const muniStats = [
                  metro.size > 0 && ['Metropolitan', metro.size],
                  submetro.size > 0 && ['Sub-Metro', submetro.size],
                  muni.size > 0 && ['Municipality', muni.size],
                  rural.size > 0 && ['Rural Municipality', rural.size],
                ].filter(Boolean);
                const provinceList = [...provinces].sort();
                // Client breakdown by type — respects all active filters
                const clientTypeMap = {};
                institute.experience.filter(exp => {
                  const fyMatch = selectedFYs.length === 0 || selectedFYs.includes(exp.fy);
                  const client = getClient(clients, exp.clientId);
                  const ctMatch = selectedClientTypes.length === 0 || selectedClientTypes.includes(client.type);
                  return fyMatch && ctMatch;
                }).forEach(exp => {
                  const hasMatchingOcc = exp.occupations.some(occ => {
                    if (minDuration && (parseInt(occ.duration)||0) < parseInt(minDuration)) return false;
                    const ctevtOcc = getOccupation(occ.ctevtOccupationId);
                    const occName = ctevtOcc.name || occ.nameInLetter;
                    return selectedOccs.length === 0 || selectedOccs.includes(occName);
                  });
                  if (!hasMatchingOcc) return;
                  const client = getClient(clients, exp.clientId);
                  const type = client.type || 'Unknown';
                  if (!clientTypeMap[type]) clientTypeMap[type] = new Set();
                  clientTypeMap[type].add(exp.clientId || ('m:' + exp.clientName));
                });
                const clientTypeBreakdown = Object.entries(clientTypeMap).map(([type, ids]) => [type, ids.size]).sort((a,b)=>b[1]-a[1]);
                // Unique occupations trained and skill-tested
                const uniqueOccs = new Set(summaryRows.map(r => r.occupation));
                const stOccs = new Set(summaryRows.filter(r => r.stAppeared > 0).map(r => r.occupation));
                return (
                  <div style={{marginTop:10,paddingTop:10,borderTop:'1px solid var(--border)'}}>
                    <div style={{display:'flex',flexWrap:'wrap',gap:'6px 0'}}>
                      {[
                        ['groups','Trainees',tot.t.toLocaleString(),'var(--primary)'],
                        ['location_on','Districts',tot.d.size,'var(--accent)'],
                        ['business','Clients',allClients.size,'var(--blue)'],
                        ['school','Occupations Trained',uniqueOccs.size,'var(--accent)'],
                        ...(stOccs.size > 0 ? [['verified','Occupations ST',stOccs.size,'var(--success,#16a34a)']] : []),
                        ...(taxRows.length ? [['payments','Avg Turnover',`NPR ${fmt(Math.round(taxRows.reduce((s,t)=>s+(parseInt(t.turnover)||0),0)/taxRows.length))}`, 'var(--success)']] : []),
                      ].map(([icon,label,val,color])=>(
                        <div key={label} style={{display:'flex',alignItems:'center',gap:5,paddingRight:16,marginRight:16,borderRight:'1px solid var(--border)'}}>
                          <span className="material-icons-round" style={{fontSize:14,color}}>{icon}</span>
                          <span style={{fontSize:11,color:'var(--text3)'}}>{label}</span>
                          <span style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>{val}</span>
                        </div>
                      ))}
                      {provinceList.length > 0 && (
                        <div style={{display:'flex',alignItems:'center',gap:5,paddingRight:16,marginRight:16,borderRight:'1px solid var(--border)'}}>
                          <span className="material-icons-round" style={{fontSize:14,color:'var(--success,#16a34a)'}}>map</span>
                          <span style={{fontSize:11,color:'var(--text3)'}}>Provinces</span>
                          <span style={{fontSize:13,fontWeight:700,color:'var(--text)'}}>{provinceList.length}</span>
                        </div>
                      )}
                      {muniStats.length > 0 && (
                        <div style={{display:'flex',alignItems:'center',gap:5,flexWrap:'wrap'}}>
                          <span className="material-icons-round" style={{fontSize:14,color:'var(--warning,#f59e0b)'}}>account_balance</span>
                          <span style={{fontSize:11,color:'var(--text3)'}}>Local Govts</span>
                          {muniStats.map(([label, count]) => (
                            <span key={label} style={{fontSize:11,background:'var(--primary-light)',borderRadius:4,padding:'1px 6px',color:'var(--text2)'}}>
                              <strong style={{color:'var(--text)'}}>{count}</strong> {label}
                            </span>
                          ))}
                        </div>
                      )}
                      {selectedFYs.length > 0 && <div style={{fontSize:11,color:'var(--text3)',alignSelf:'center',marginLeft:'auto'}}>FY: {selectedFYs.join(', ')}</div>}
                    </div>
                    {clientTypeBreakdown.length > 0 && (
                      <div style={{marginTop:6,display:'flex',flexWrap:'wrap',gap:'3px 6px',alignItems:'center'}}>
                        <span style={{fontSize:10,color:'var(--text3)',marginRight:2}}>Clients by type:</span>
                        {clientTypeBreakdown.map(([type, count]) => (
                          <span key={type} style={{fontSize:10,background:'color-mix(in srgb,var(--blue,#3b82f6) 12%,transparent)',color:'var(--blue,#3b82f6)',borderRadius:4,padding:'1px 7px',fontWeight:500}}>
                            <strong>{count}</strong> {type}
                          </span>
                        ))}
                      </div>
                    )}
                    {provinceList.length > 0 && (
                      <div style={{marginTop:6,display:'flex',flexWrap:'wrap',gap:'3px 6px',alignItems:'center'}}>
                        <span style={{fontSize:10,color:'var(--text3)',marginRight:2}}>Provinces:</span>
                        {provinceList.map(p => (
                          <span key={p} style={{fontSize:10,background:'color-mix(in srgb,var(--success,#16a34a) 12%,transparent)',color:'var(--success,#16a34a)',borderRadius:4,padding:'1px 7px',fontWeight:500}}>{p}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {summaryRows.length === 0 ? (
              <div className="empty-state" style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--radius-lg)'}}>
                <div className="empty-state-title">No data matches current filters</div>
              </div>
            ) : (
              <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:12,overflow:'hidden'}}>
                <div className="table-wrap">
                  <table style={{fontSize:12,borderCollapse:'collapse',width:'100%'}}>
                    <thead>
                      <tr style={{background:'var(--bg2)'}}>
                        <th rowSpan="2" style={{padding:'6px 10px',textAlign:'left',borderBottom:'2px solid var(--border)',fontSize:11,fontWeight:700,color:'var(--text2)',whiteSpace:'nowrap'}}>Occupation</th>
                        <th rowSpan="2" style={{padding:'6px 8px',textAlign:'center',borderBottom:'2px solid var(--border)',fontSize:11,fontWeight:700,color:'var(--text2)'}}>Lvl</th>
                        <th colSpan="4" style={{padding:'4px 8px',textAlign:'center',borderBottom:'1px solid var(--border)',fontSize:10,fontWeight:700,color:'var(--accent)',background:'rgba(45,90,61,0.07)'}}>EXPERIENCE</th>
                        <th colSpan="4" style={{padding:'4px 8px',textAlign:'center',borderBottom:'1px solid var(--border)',fontSize:10,fontWeight:700,color:'var(--blue)',background:'rgba(26,74,122,0.07)'}}>NSTB</th>
                        <th colSpan="2" style={{padding:'4px 8px',textAlign:'center',borderBottom:'1px solid var(--border)',fontSize:10,fontWeight:700,color:'var(--purple)',background:'rgba(91,45,142,0.07)'}}>AFFILIATION</th>
                      </tr>
                      <tr style={{background:'var(--bg2)'}}>
                        <th style={{padding:'4px 8px',textAlign:'center',borderBottom:'2px solid var(--border)',fontSize:10,color:'var(--text3)',fontWeight:600,background:'rgba(45,90,61,0.07)'}}>Firms</th>
                        <th style={{padding:'4px 8px',textAlign:'center',borderBottom:'2px solid var(--border)',fontSize:10,color:'var(--text3)',fontWeight:600,background:'rgba(45,90,61,0.07)'}}>Trainees</th>
                        <th style={{padding:'4px 8px',textAlign:'center',borderBottom:'2px solid var(--border)',fontSize:10,color:'var(--text3)',fontWeight:600,background:'rgba(45,90,61,0.07)'}}>Districts</th>
                        <th style={{padding:'4px 8px',textAlign:'center',borderBottom:'2px solid var(--border)',fontSize:10,color:'var(--text3)',fontWeight:600,background:'rgba(45,90,61,0.07)'}}>ST App/Pass</th>
                        <th style={{padding:'4px 8px',textAlign:'center',borderBottom:'2px solid var(--border)',fontSize:10,color:'var(--text3)',fontWeight:600,background:'rgba(26,74,122,0.07)'}}>App/Apd/Pass</th>
                        <th style={{padding:'4px 8px',textAlign:'center',borderBottom:'2px solid var(--border)',fontSize:10,color:'var(--text3)',fontWeight:600,background:'rgba(26,74,122,0.07)'}}>Pass%</th>
                        <th style={{padding:'4px 8px',textAlign:'center',borderBottom:'2px solid var(--border)',fontSize:10,color:'var(--text3)',fontWeight:600,background:'rgba(26,74,122,0.07)'}}>Apd%</th>
                        <th style={{padding:'4px 8px',textAlign:'center',borderBottom:'2px solid var(--border)',fontSize:10,color:'var(--text3)',fontWeight:600,background:'rgba(91,45,142,0.07)'}}>Status</th>
                        <th style={{padding:'4px 8px',textAlign:'center',borderBottom:'2px solid var(--border)',fontSize:10,color:'var(--text3)',fontWeight:600,background:'rgba(91,45,142,0.07)'}}>Valid</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaryRows.map((row, i) => (
                        <tr key={i} style={{borderBottom:'1px solid var(--border)',background:i%2===0?'transparent':'var(--bg)'}}>
                          <td style={{padding:'6px 10px',maxWidth:220}}>
                            <div style={{fontWeight:600,fontSize:12,color:'var(--text)',lineHeight:1.3}}>{row.occupation}</div>
                            {row.sector !== '—' && <div style={{fontSize:10,color:'var(--text3)'}}>{row.sector}</div>}
                            {[...row.clientNames].length > 0 && <div style={{fontSize:10,marginTop:2,display:'flex',flexWrap:'wrap',gap:'2px 4px'}}>{[...row.clientNames].map((n,i)=><span key={i} style={{background:'color-mix(in srgb,var(--accent,#6366f1) 12%,transparent)',color:'var(--accent,#6366f1)',borderRadius:3,padding:'0 5px',fontWeight:500,fontSize:10}}>{n}</span>)}</div>}
                          </td>
                          <td style={{padding:'6px 8px',textAlign:'center'}}>
                            {row.level && row.level !== '—' ? <span className="badge badge-purple" style={{fontSize:10,padding:'1px 5px'}}>{row.level}</span> : <span style={{color:'var(--text3)'}}>—</span>}
                          </td>
                          <td style={{padding:'6px 8px',textAlign:'center',fontWeight:600}}>{row.clientIds.size || '—'}</td>
                          <td style={{padding:'6px 8px',textAlign:'center',fontFamily:'var(--font-mono)',fontWeight:700,color:'var(--primary)'}}>{row.trainees || '—'}</td>
                          <td style={{padding:'6px 8px',textAlign:'center',fontSize:11}}>
                            {row.districts.size > 0 ? <span title={[...row.districts].join(', ')}>{row.districts.size}</span> : '—'}
                          </td>
                          <td style={{padding:'6px 8px',textAlign:'center',fontFamily:'var(--font-mono)',fontSize:11}}>
                            {row.stAppeared||row.stPass ? `${row.stAppeared||0}/${row.stPass||0}` : '—'}
                          </td>
                          <td style={{padding:'6px 8px',textAlign:'center',fontFamily:'var(--font-mono)',fontSize:11}}>
                            {row.nstbApplied||row.nstbAppeared||row.nstbPass ? `${row.nstbApplied||0}/${row.nstbAppeared||0}/${row.nstbPass||0}` : '—'}
                          </td>
                          <td style={{padding:'6px 8px',textAlign:'center'}}>
                            {row.nstbPass && row.nstbAppeared ? <span className={`badge ${parseFloat(pct(row.nstbPass,row.nstbAppeared))>=70?'badge-active':'badge-pending'}`} style={{fontSize:10}}>{pct(row.nstbPass,row.nstbAppeared)}</span> : '—'}
                          </td>
                          <td style={{padding:'6px 8px',textAlign:'center'}}>
                            {row.nstbApplied && row.nstbAppeared ? <span className="badge badge-info" style={{fontSize:10}}>{pct(row.nstbAppeared,row.nstbApplied)}</span> : '—'}
                          </td>
                          <td style={{padding:'6px 8px',textAlign:'center'}}>
                            {row.affiliationStatus !== '—' ? <span className={`badge ${row.affiliationStatus==='Active'?'badge-active':row.affiliationStatus==='Expired'?'badge-expired':'badge-pending'}`} style={{fontSize:10}}>{row.affiliationStatus}</span> : '—'}
                          </td>
                          <td style={{padding:'6px 8px',textAlign:'center',fontSize:10,color:'var(--text3)',whiteSpace:'nowrap'}}>
                            {row.affiliationFrom !== '—' ? `${row.affiliationFrom}${row.affiliationTo !== '—' ? ` – ${row.affiliationTo}` : ''}` : '—'}
                          </td>
                        </tr>
                      ))}
                      {(() => {
                        const tot = summaryRows.reduce((acc,r)=>({
                          trainees:acc.trainees+r.trainees, stAppeared:acc.stAppeared+r.stAppeared, stPass:acc.stPass+r.stPass,
                          nstbApplied:acc.nstbApplied+r.nstbApplied, nstbAppeared:acc.nstbAppeared+r.nstbAppeared, nstbPass:acc.nstbPass+r.nstbPass,
                          allDistricts:new Set([...acc.allDistricts,...r.districts]),
                        }),{trainees:0,stAppeared:0,stPass:0,nstbApplied:0,nstbAppeared:0,nstbPass:0,allDistricts:new Set()});
                        return (
                          <tr style={{background:'color-mix(in srgb, var(--accent) 8%, transparent)',fontWeight:700,borderTop:'2px solid var(--border)'}}>
                            <td style={{padding:'6px 10px',fontSize:11,color:'var(--text2)'}}>TOTAL ({summaryRows.length} occupations)</td>
                            <td/><td style={{textAlign:'center'}}>{new Set(summaryRows.flatMap(r=>[...r.clientIds])).size||'—'}</td>
                            <td style={{textAlign:'center',fontFamily:'var(--font-mono)',color:'var(--primary)'}}>{tot.trainees||'—'}</td>
                            <td style={{textAlign:'center'}}>{tot.allDistricts.size||'—'}</td>
                            <td style={{textAlign:'center',fontFamily:'var(--font-mono)',fontSize:11}}>{tot.stAppeared||tot.stPass?`${tot.stAppeared}/${tot.stPass}`:'—'}</td>
                            <td style={{textAlign:'center',fontFamily:'var(--font-mono)',fontSize:11}}>{tot.nstbApplied||tot.nstbAppeared||tot.nstbPass?`${tot.nstbApplied}/${tot.nstbAppeared}/${tot.nstbPass}`:'—'}</td>
                            <td style={{textAlign:'center'}}>{tot.nstbPass&&tot.nstbAppeared?<span className={`badge ${parseFloat(pct(tot.nstbPass,tot.nstbAppeared))>=70?'badge-active':'badge-pending'}`} style={{fontSize:10}}>{pct(tot.nstbPass,tot.nstbAppeared)}</span>:'—'}</td>
                            <td style={{textAlign:'center'}}>{tot.nstbApplied&&tot.nstbAppeared?<span className="badge badge-info" style={{fontSize:10}}>{pct(tot.nstbAppeared,tot.nstbApplied)}</span>:'—'}</td>
                            <td/><td/>
                          </tr>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default SummaryView;

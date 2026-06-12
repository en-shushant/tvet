import { useState, useMemo } from 'react';
import { FISCAL_YEARS, CLIENT_TYPES, OCCUPATIONS } from '../constants/data.js';

const pct = (n, d) => d > 0 ? ((n/d)*100).toFixed(1) + '%' : '—';
const fmt = (n) => n ? Number(n).toLocaleString('en-IN') : '—';

function getOccupation(id) {
  const rawId = typeof id === 'string' && id.startsWith('c:') ? parseInt(id.slice(2)) : id;
  return OCCUPATIONS.find(o => o.id === rawId) || {};
}

function computeInstStats(inst, {selectedFYs, selectedClientTypes, selectedOccs, minDuration, clients}) {
  const occMatch = (occ, soLow) => {
    const cn = (getOccupation(occ.ctevtOccupationId).name || '').toLowerCase();
    const en = (occ.nameInLetter || '').toLowerCase();
    return (cn && (cn === soLow || cn.includes(soLow))) || (en && en.includes(soLow));
  };
  const relevantExps = inst.experience.filter(exp => {
    if (selectedFYs.length > 0 && !selectedFYs.includes(exp.fy)) return false;
    if (selectedClientTypes && selectedClientTypes.length > 0) {
      const client = getClient(clients, exp.clientId);
      if (!selectedClientTypes.includes(client.type)) return false;
    }
    if (selectedOccs.length > 0 && !exp.occupations.some(occ => selectedOccs.some(so => occMatch(occ, so.toLowerCase())))) return false;
    return true;
  });
  const taxRows = inst.taxClearance.filter(t => !selectedFYs.length || selectedFYs.includes(t.fy));
  const avgTurnover = taxRows.length ? Math.round(taxRows.reduce((s,t) => s+(parseInt(t.turnover)||0), 0) / taxRows.length) : 0;
  const occBreakdown = selectedOccs.length > 0
    ? selectedOccs.map(so => {
        const soLow = so.toLowerCase();
        let trainees=0, assignments=0; const districts=new Set();
        relevantExps.forEach(exp => {
          let hit=false;
          exp.occupations.forEach(occ => {
            if (!occMatch(occ, soLow)) return;
            if (minDuration && (parseInt(occ.duration)||0) < parseInt(minDuration)) return;
            hit=true; trainees+=parseInt(occ.trainees)||0;
            (occ.locations||[]).forEach(l => { if (l.district) districts.add(l.district); });
          });
          if (hit) assignments++;
        });
        const affRec = inst.affiliation.find(a => (a.programs||[]).some(p => p.name && p.name.toLowerCase().includes(soLow.split(',')[0])));
        return {name:so, trainees, assignments, districts:[...districts].sort(), affStatus: affRec?.status||null};
      })
    : [(() => {
        let trainees=0; const districts=new Set();
        relevantExps.forEach(exp => exp.occupations.forEach(occ => {
          if (minDuration && (parseInt(occ.duration)||0) < parseInt(minDuration)) return;
          trainees+=parseInt(occ.trainees)||0;
          (occ.locations||[]).forEach(l => { if (l.district) districts.add(l.district); });
        }));
        return {name:null, trainees, assignments:relevantExps.length, districts:[...districts].sort(), affStatus:null};
      })()];
  return {
    inst, avgTurnover, occBreakdown,
    totalTrainees: occBreakdown.reduce((s,o) => s+o.trainees, 0),
    assignments: relevantExps.length,
    allDistricts: [...new Set(occBreakdown.flatMap(o => o.districts))].sort(),
  };
}

// Aggregate stats for a JV group
function computeJVStats(group, partnerInsts, filters) {
  const ps = partnerInsts.map(inst => computeInstStats(inst, filters));
  const combinedTurnover = ps.reduce((s,p) => s+p.avgTurnover, 0);
  const occBreakdown = filters.selectedOccs.length > 0
    ? filters.selectedOccs.map((so,si) => ({
        name: so,
        trainees: ps.reduce((s,p) => s+(p.occBreakdown[si]?.trainees||0), 0),
        assignments: ps.reduce((s,p) => s+(p.occBreakdown[si]?.assignments||0), 0),
        districts: [...new Set(ps.flatMap(p => p.occBreakdown[si]?.districts||[]))].sort(),
        affStatus: ps.some(p => p.occBreakdown[si]?.affStatus==='Active') ? 'Active' : null,
      }))
    : [{
        name: null,
        trainees: ps.reduce((s,p) => s+(p.occBreakdown[0]?.trainees||0), 0),
        assignments: ps.reduce((s,p) => s+p.assignments, 0),
        districts: [...new Set(ps.flatMap(p => p.occBreakdown[0]?.districts||[]))].sort(),
        affStatus: null,
      }];
  return {
    isJV: true, group, partnerStats: ps, combinedTurnover, occBreakdown,
    totalTrainees: occBreakdown.reduce((s,o) => s+o.trainees, 0),
    assignments: ps.reduce((s,p) => s+p.assignments, 0),
    allDistricts: [...new Set(occBreakdown.flatMap(o => o.districts))].sort(),
  };
}

// Inline JV group builder — used in both compliance and comparison filter panels
function JVGroupPanel({institutes, jvGroups, onChange}) {
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const [draft, setDraft] = useState({name:'', partnerIds:[]});
  const [search, setSearch] = useState('');

  const openAdd = () => { setDraft({name:'', partnerIds:[]}); setSearch(''); setEditId(null); setAdding(true); };
  const openEdit = (g) => { setDraft({name:g.name, partnerIds:[...g.partnerIds]}); setSearch(''); setEditId(g.id); setAdding(true); };
  const cancel = () => { setAdding(false); setEditId(null); setDraft({name:'', partnerIds:[]}); setSearch(''); };

  const togglePartner = (id) => setDraft(d => ({...d, partnerIds:
    d.partnerIds.includes(id) ? d.partnerIds.filter(x=>x!==id)
    : d.partnerIds.length < 6 ? [...d.partnerIds, id] : d.partnerIds
  }));

  const save = () => {
    if (draft.partnerIds.length < 2) return;
    const name = draft.name.trim() || `JV ${jvGroups.length + (editId ? 0 : 1)}`;
    if (editId) {
      onChange(jvGroups.map(g => g.id===editId ? {...g, name, partnerIds:draft.partnerIds} : g));
    } else {
      onChange([...jvGroups, {id:`jv-${Date.now()}`, name, partnerIds:draft.partnerIds}]);
    }
    cancel();
  };

  const removeGroup = (id) => onChange(jvGroups.filter(g => g.id!==id));

  const filtered = search ? institutes.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) || (i.acronym||'').toLowerCase().includes(search.toLowerCase())
  ) : institutes;

  return (
    <div className="filter-section">
      <div className="filter-label" style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
        <span>JV Groups</span>
        {!adding && (
          <button onClick={openAdd} style={{fontSize:10, color:'var(--accent)', background:'none', border:'none', cursor:'pointer', padding:0, fontWeight:600}}>
            + Add JV
          </button>
        )}
      </div>

      {jvGroups.length === 0 && !adding && (
        <div style={{fontSize:11, color:'var(--text3)', padding:'4px 0', lineHeight:1.5}}>
          Group 2–6 firms into a JV to see their combined competence
        </div>
      )}

      {jvGroups.map(g => (
        <div key={g.id} style={{display:'flex', alignItems:'flex-start', gap:6, padding:'6px 0', borderBottom:'1px solid var(--border)'}}>
          <span style={{fontSize:12, marginTop:1, flexShrink:0}}>🤝</span>
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontSize:12, fontWeight:600, color:'var(--text)'}}>{g.name}</div>
            <div style={{fontSize:10, color:'var(--text3)', lineHeight:1.5, marginTop:1}}>
              {g.partnerIds.map(id => {
                const inst = institutes.find(i => i.id===id);
                return inst ? (inst.acronym || inst.name.split(' ').slice(0,3).join(' ')) : '?';
              }).join(' · ')}
            </div>
          </div>
          <div style={{display:'flex', gap:4, flexShrink:0}}>
            <button onClick={()=>openEdit(g)} style={{fontSize:10, color:'var(--accent)', background:'none', border:'none', cursor:'pointer', padding:0}}>✏</button>
            <button onClick={()=>removeGroup(g.id)} style={{fontSize:12, color:'var(--text3)', background:'none', border:'none', cursor:'pointer', padding:0}}>✕</button>
          </div>
        </div>
      ))}

      {adding && (
        <div style={{marginTop:8, padding:'10px', background:'var(--bg2)', borderRadius:'var(--radius)', border:'1px solid var(--border)'}}>
          <div style={{fontSize:11, fontWeight:600, color:'var(--text2)', marginBottom:6}}>
            {editId ? 'Edit JV group' : 'New JV group'}
          </div>
          <input className="form-input" style={{fontSize:12, padding:'5px 8px', marginBottom:8, width:'100%', boxSizing:'border-box'}}
            placeholder="JV name (optional)" value={draft.name} onChange={e=>setDraft(d=>({...d,name:e.target.value}))}/>
          <div style={{fontSize:11, color:'var(--text3)', marginBottom:4}}>Select 2–6 partner firms:</div>
          <input className="form-input" style={{fontSize:11, padding:'4px 7px', marginBottom:6, width:'100%', boxSizing:'border-box'}}
            placeholder="Search firms…" value={search} onChange={e=>setSearch(e.target.value)}/>
          <div style={{maxHeight:150, overflowY:'auto', marginBottom:6}}>
            {filtered.map(inst => {
              const checked = draft.partnerIds.includes(inst.id);
              const disabled = !checked && draft.partnerIds.length >= 6;
              return (
                <label key={inst.id} style={{display:'flex', alignItems:'center', gap:6, padding:'3px 0', opacity:disabled?0.4:1, cursor:disabled?'not-allowed':'pointer'}}>
                  <input type="checkbox" checked={checked} disabled={disabled} onChange={()=>togglePartner(inst.id)}/>
                  <span style={{fontSize:11, lineHeight:1.3}}>
                    {inst.acronym && <span style={{color:'var(--accent)', fontFamily:'var(--font-mono)', marginRight:4}}>{inst.acronym}</span>}
                    {inst.name.split(' ').slice(0,4).join(' ')}
                  </span>
                </label>
              );
            })}
          </div>
          <div style={{fontSize:10, color: draft.partnerIds.length>=2 ? 'var(--accent)' : 'var(--text3)', marginBottom:8}}>
            {draft.partnerIds.length} firm{draft.partnerIds.length!==1?'s':''} selected {draft.partnerIds.length>=2&&'✓'}
          </div>
          <div style={{display:'flex', gap:6}}>
            <button className="btn btn-primary btn-sm" style={{fontSize:11}} onClick={save} disabled={draft.partnerIds.length<2}>
              {editId ? 'Save changes' : 'Create JV'}
            </button>
            <button className="btn btn-secondary btn-sm" style={{fontSize:11}} onClick={cancel}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export { computeInstStats, computeJVStats };
export default JVGroupPanel;

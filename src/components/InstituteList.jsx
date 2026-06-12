import { useState, useEffect, useMemo } from 'react';
import StatusBadge from './ui/StatusBadge.jsx';
import Pagination from './ui/Pagination.jsx';
import { usePagination } from '../utils/hooks.js';
import { INSTITUTE_TYPES, INSTITUTE_STATUSES } from '../constants/data.js';

function InstituteList({institutes, onSelect, onAdd, initialSearch=''}) {
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState('All');

  // Sync if initialSearch changes (from sidebar)
  useEffect(() => { if(initialSearch) setSearch(initialSearch); }, [initialSearch]);

  const filtered = institutes.filter(i => {
    const matchSearch = !search ||
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.regNo.toLowerCase().includes(search.toLowerCase()) ||
      (i.acronym && i.acronym.toLowerCase().includes(search.toLowerCase())) ||
      (i.pan && i.pan.includes(search));
    const matchStatus = statusFilter === 'All' || i.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const { paged, page, setPage, totalPages, total, start, end } = usePagination(filtered, 12);

  return (
    <div className="fade-in">
      {/* Page header */}
      <div className="page-header mb-6">
        <div>
          <div className="page-header-title">Institutes</div>
          <div className="page-header-sub">{filtered.length} of {institutes.length} institutes</div>
        </div>
        {onAdd && (
          <button className="btn btn-primary" onClick={onAdd}>
            <span className="material-icons-round" style={{fontSize:16}}>add</span>
            Add Institute
          </button>
        )}
      </div>

      {/* Search + filter bar */}
      <div className="card" style={{padding:'16px 20px', marginBottom:24}}>
        <div style={{display:'flex', gap:12, flexWrap:'wrap', alignItems:'center'}}>
          <div className="search-wrap" style={{flex:1, minWidth:240}}>
            <span className="material-icons-round search-icon" style={{fontSize:18}}>search</span>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name, acronym or registration number…"/>
          </div>
          <div style={{display:'flex', gap:6, alignItems:'center', flexWrap:'wrap'}}>
            {['All','Active','Pending Renewal','Expired'].map(s=>(
              <button key={s} className={`chip ${statusFilter===s?'active':''}`} onClick={()=>setStatusFilter(s)}>{s}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid-2">
        {paged.map(inst => (
          <div key={inst.id} className="institute-card" onClick={()=>onSelect(inst)}>
            <div className="card-accent" style={{
              background: inst.status==='Active'?'var(--success)':inst.status==='Pending Renewal'?'var(--warning)':'var(--error)'
            }}/>
            {/* Header row: logo + name + status */}
            <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:6}}>
              {inst.logo
                ? <img src={inst.logo} alt="" style={{width:44,height:44,objectFit:'contain',borderRadius:8,border:'1px solid var(--border)',background:'#fff',padding:3,flexShrink:0}}/>
                : <div style={{width:44,height:44,borderRadius:8,background:'var(--primary-light)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <span className="material-icons-round" style={{fontSize:22,color:'var(--primary)'}}>account_balance</span>
                  </div>
              }
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontWeight:700, fontSize:13.5, lineHeight:1.35, color:'var(--text)'}}>{inst.name}</div>
                <div style={{display:'flex', alignItems:'center', gap:6, marginTop:3, flexWrap:'wrap'}}>
                  {inst.acronym && <span className="badge badge-info" style={{fontSize:10.5}}>{inst.acronym}</span>}
                  <StatusBadge status={inst.status}/>
                </div>
              </div>
            </div>
            {/* Meta row */}
            <div style={{fontSize:12, color:'var(--text2)', marginBottom:3, display:'flex', alignItems:'center', gap:4}}>
              <span className="material-icons-round" style={{fontSize:12}}>badge</span>
              <span className="mono">{inst.regNo}</span>
              <span style={{color:'var(--border2)'}}>·</span>
              <span>{inst.type}</span>
            </div>
            <div style={{fontSize:12, color:'var(--text2)', marginBottom:10, display:'flex', alignItems:'center', gap:4}}>
              <span className="material-icons-round" style={{fontSize:12}}>location_on</span>
              <span style={{overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{inst.address}</span>
            </div>
            {/* Stats row */}
            <div style={{display:'flex', gap:0, borderTop:'1px solid var(--border)', paddingTop:8}}>
              {[
                {label:'Trainees', value:inst.totalTrainees.toLocaleString(), color:'var(--primary)'},
                {label:'ST Appeared', value:inst.totalStAppeared.toLocaleString(), color:'var(--success)'},
                {label:'Clients', value:inst.totalClients, color:'var(--secondary)'},
                {label:'Affiliations', value:inst.totalAffPrograms, color:'var(--purple)'},
              ].map((m,i,arr)=>(
                <div key={m.label} style={{flex:1, textAlign:'center', borderRight: i<arr.length-1 ? '1px solid var(--border)' : 'none', padding:'0 4px'}}>
                  <div style={{fontWeight:700, fontSize:14, color:m.color}}>{m.value}</div>
                  <div style={{fontSize:10, color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.4px', marginTop:1, fontWeight:600}}>{m.label}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0
        ? <div className="empty-state">
            <div className="empty-state-icon"><span className="material-icons-round" style={{fontSize:48}}>account_balance</span></div>
            <div className="empty-state-title">No institutes found</div>
            <div className="empty-state-sub">{search ? 'Try a different search term' : 'Add your first institute to get started'}</div>
          </div>
        : <Pagination page={page} setPage={setPage} totalPages={totalPages} total={total} start={start} end={end} label="institutes"/>
      }
    </div>
  );
}

export default InstituteList;

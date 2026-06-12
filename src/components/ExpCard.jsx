import { OCCUPATIONS } from '../constants/data.js';

const fmt = (n) => n ? Number(n).toLocaleString('en-IN') : '—';
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

function getClient(clients, id) {
  return clients.find(c => c.id === id) || {};
}

function ExpCard({exp, clients, showFY, setModal, deleteExperience, canEdit, isAdmin}) {
  const client = getClient(clients, exp.clientId);
  const allLocs = exp.occupations.flatMap(o=>(o.locations||[]));
  const districts = [...new Set(allLocs.map(l=>l.district).filter(Boolean))];
  const localLevels = [...new Set(allLocs.flatMap(l=>(l.localLevels||[]).map(x=>x.name)).filter(Boolean))];
  return (
    <div style={{padding:'14px 16px', borderBottom:'1px solid var(--border)'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8}}>
        <div>
          <div style={{fontWeight:600, fontSize:14}}>{exp.assignmentName}</div>
          <div style={{fontSize:12, color:'var(--text3)', marginTop:2}}>
            {showFY && <><span className="badge badge-gray" style={{fontSize:10, marginRight:6}}>FY {exp.fy}{fyToAD(exp.fy)?` (${fyToAD(exp.fy)})`:''}</span></>}
            {client.fullName
              ? <>{client.fullName}{client.shortName ? <span style={{color:'var(--text3)'}}> ({client.shortName})</span> : ''}</>
              : exp.clientName || '—'
            } &nbsp;·&nbsp; {exp.trainingType}
            {exp.contractValue && <> &nbsp;·&nbsp; NPR {fmt(exp.contractValue)}</>}
            {(exp.startFY || exp.endFY) && <> &nbsp;·&nbsp; <span style={{color:'var(--blue)'}}>FY {exp.startFY||exp.fy}–{exp.endFY||exp.fy}</span></>}
          </div>
          {(exp.isGesi || exp.isResidential) && (
            <div style={{display:'flex', gap:6, marginTop:5}}>
              {exp.isGesi && <span style={{fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:10, background:'color-mix(in srgb,#a855f7 15%,transparent)', color:'#a855f7', letterSpacing:'0.3px'}}>GESI</span>}
              {exp.isResidential && <span style={{fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:10, background:'color-mix(in srgb,var(--blue,#3b82f6) 15%,transparent)', color:'var(--blue,#3b82f6)', letterSpacing:'0.3px'}}>Residential</span>}
            </div>
          )}
        </div>
        <div style={{display:'flex', gap:6, flexShrink:0}}>
          <button className="btn btn-secondary btn-sm" style={{gap:5}} onClick={()=>setModal({type:'viewExp', data:exp})}>
            <span className="material-icons-round" style={{fontSize:14}}>visibility</span> View
          </button>
          {canEdit && <button className="btn btn-ghost btn-sm" style={{gap:5}} onClick={()=>setModal({type:'editExp', data:exp})}>
            <span className="material-icons-round" style={{fontSize:14}}>edit</span> Edit
          </button>}
          {isAdmin && <button className="btn btn-danger btn-sm" onClick={()=>deleteExperience(exp.id)}>
            <span className="material-icons-round" style={{fontSize:14}}>delete</span>
          </button>}
        </div>
      </div>
      <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
        {exp.occupations.map((occ,i)=>(
          <span key={i} className="badge badge-gray">{getOccupation(occ.ctevtOccupationId).name || occ.nameInLetter}: {occ.trainees} trainees</span>
        ))}
      </div>
      {(districts.length > 0 || localLevels.length > 0) && (
        <div style={{fontSize:12, color:'var(--text3)', marginTop:6}}>
          📍 {districts.join(', ')}{localLevels.length > 0 && <span style={{color:'var(--text3)', opacity:0.8}}> — {localLevels.join(', ')}</span>}
        </div>
      )}
      {exp.referenceFile && (
        <div style={{marginTop:8, display:'flex', alignItems:'center', gap:8}}>
          {exp.referenceFileName?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
            <img src={exp.referenceFile} alt={exp.referenceFileName || 'letter'}
              style={{width:56, height:56, objectFit:'cover', borderRadius:6, border:'1px solid var(--border)', cursor:'pointer', flexShrink:0}}
              onClick={e=>{e.stopPropagation(); window.open(exp.referenceFile);}}/>
          ) : (
            <div style={{width:56, height:56, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg2)', cursor:'pointer', flexShrink:0}}
              onClick={e=>{e.stopPropagation(); const w=window.open(); w.document.write(`<iframe src="${exp.referenceFile}" width="100%" height="100%" style="border:none"/>`)}}>
              <span style={{fontSize:22}}>📄</span>
              <span style={{fontSize:9, color:'var(--text3)', marginTop:1}}>PDF</span>
            </div>
          )}
          <span style={{fontSize:11, color:'var(--accent)', cursor:'pointer', textDecoration:'underline'}}
            onClick={e=>{e.stopPropagation();
              if(exp.referenceFileName?.match(/\.pdf$/i)) {
                const w=window.open(); w.document.write(`<iframe src="${exp.referenceFile}" width="100%" height="100%" style="border:none"/>`);
              } else { window.open(exp.referenceFile); }
            }}>
            {exp.referenceFileName || 'View letter'}
          </span>
        </div>
      )}
    </div>
  );
}
export default ExpCard;

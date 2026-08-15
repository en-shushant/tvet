import { fmt, fyToAD, getClient, getOccupation } from '../utils/format.js';




function ExpCard({exp, clients, showFY, setModal, deleteExperience, canEdit, isAdmin, idx=0}) {
  const client = getClient(clients, exp.clientId);
  const allLocs = exp.occupations.flatMap(o=>(o.locations||[]));
  const districts = [...new Set(allLocs.map(l=>l.district).filter(Boolean))];
  const localLevels = [...new Set(allLocs.flatMap(l=>(l.localLevels||[]).map(x=>x.name)).filter(Boolean))];
  const missingOccs = (exp.occupations||[]).filter(o => !o.level || !o.duration);
  const totalTrainees = exp.occupations.reduce((s,o)=>s+(parseInt(o.trainees)||0),0);

  // Striping and hover both live in CSS. Driving them from mouseenter/mouseleave
  // meant a missed mouseleave — and clicking any of the row's buttons opens a
  // modal over it, so that happens routinely — left the row wearing its hover
  // colour. Since the stripe alternates, a stuck even row then looked exactly
  // like an odd one, which is why the list appeared to shade rows at random.
  return (
    <div className={`exp-card${idx % 2 === 1 ? ' exp-card-alt' : ''}`}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:16}}>
        {/* Left: content */}
        <div style={{flex:1, minWidth:0}}>
          {/* Title row */}
          <div style={{display:'flex', alignItems:'flex-start', gap:8, flexWrap:'wrap', marginBottom:4}}>
            {showFY && (
              <span style={{
                fontSize:10, fontWeight:600, padding:'2px 8px', borderRadius:100,
                background:'var(--bg2)', color:'var(--text3)', whiteSpace:'nowrap', alignSelf:'center',
              }}>FY {exp.fy}{fyToAD(exp.fy)?` · ${fyToAD(exp.fy)}`:''}</span>
            )}
            <span style={{fontWeight:600, fontSize:14, color:'var(--text)', lineHeight:1.4}}>{exp.assignmentName}</span>
            {missingOccs.length > 0 && (
              <span title={missingOccs.map(o=>getOccupation(o.ctevtOccupationId).name||o.nameInLetter).join(', ') + ' — missing level or duration'}
                style={{fontSize:10, fontWeight:600, color:'var(--warning)', background:'var(--warning-light)',
                  border:'1px solid rgba(255,174,31,.3)', borderRadius:100, padding:'2px 8px', whiteSpace:'nowrap', alignSelf:'center',
                }}><span className="material-icons-round" style={{fontSize:10,verticalAlign:'middle'}}>warning</span> Missing ({missingOccs.length})</span>
            )}
          </div>

          {/* Meta line */}
          <div style={{fontSize:12, color:'var(--text3)', marginBottom:8, display:'flex', flexWrap:'wrap', alignItems:'center', gap:'2px 6px'}}>
            <span style={{fontWeight:500, color:'var(--text2)'}}>
              {client.fullName
                ? <>{client.fullName}{client.shortName ? <span style={{color:'var(--text3)'}}> ({client.shortName})</span> : ''}</>
                : exp.clientName || '—'}
            </span>
            {exp.trainingType && <><span style={{opacity:.4}}>·</span><span>{exp.trainingType}</span></>}
            {exp.contractValue && <><span style={{opacity:.4}}>·</span><span>NPR {fmt(exp.contractValue)}</span></>}
            {(exp.startFY || exp.endFY) && <><span style={{opacity:.4}}>·</span><span style={{color:'var(--primary)'}}>FY {exp.startFY||exp.fy}–{exp.endFY||exp.fy}</span></>}
          </div>

          {/* Tag row: GESI, Residential */}
          {(exp.isGesi || exp.isResidential) && (
            <div style={{display:'flex', gap:6, marginBottom:8}}>
              {exp.isGesi && <span style={{fontSize:10, fontWeight:600, padding:'2px 9px', borderRadius:100, background:'var(--purple-light)', color:'var(--purple)'}}>GESI</span>}
              {exp.isResidential && <span style={{fontSize:10, fontWeight:600, padding:'2px 9px', borderRadius:100, background:'var(--secondary-light)', color:'var(--secondary)'}}>Residential</span>}
            </div>
          )}

          {/* Occupation chips */}
          {exp.occupations.length > 0 && (
            <div style={{display:'flex', gap:6, flexWrap:'wrap', marginBottom: districts.length > 0 ? 8 : 0}}>
              {exp.occupations.map((occ,i)=>(
                <span key={i} style={{
                  display:'inline-flex', alignItems:'center', gap:5,
                  fontSize:12, fontWeight:500,
                  padding:'4px 12px', borderRadius:100,
                  background:'var(--primary-light)', color:'var(--primary-dark)',
                }}>
                  {getOccupation(occ.ctevtOccupationId).name || occ.nameInLetter}
                  <span style={{fontWeight:700, color:'var(--primary)'}}>{occ.trainees ? `: ${Number(occ.trainees).toLocaleString()}` : ''}</span>
                  {occ.skillTestProvisioned && <span title="Skill test provisioned" style={{fontSize:9, fontWeight:700, color:'var(--teal)'}}>ST</span>}
                  {occ.employmentProvisioned && <span title="Employment provisioned" style={{fontSize:9, fontWeight:700, color:'var(--success)'}}>EP</span>}
                </span>
              ))}
            </div>
          )}

          {/* Locations */}
          {(districts.length > 0 || localLevels.length > 0) && (
            <div style={{fontSize:11.5, color:'var(--text3)', display:'flex', gap:4, alignItems:'flex-start'}}>
              <span className="material-icons-round" style={{fontSize:13, marginTop:1, color:'var(--error)', flexShrink:0}}>location_on</span>
              <span>
                {districts.join(', ')}
                {localLevels.length > 0 && <span style={{opacity:.7}}> — {localLevels.join(', ')}</span>}
              </span>
            </div>
          )}

          {/* Reference file */}
          {exp.referenceFile && (
            <div style={{marginTop:8, display:'flex', alignItems:'center', gap:8}}>
              {exp.referenceFileName?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                <img src={exp.referenceFile} alt={exp.referenceFileName || 'letter'}
                  style={{width:44, height:44, objectFit:'cover', borderRadius:8, border:'1px solid var(--border)', cursor:'pointer', flexShrink:0}}
                  onClick={e=>{e.stopPropagation(); window.open(exp.referenceFile);}}/>
              ) : (
                <div style={{width:44, height:44, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg)', cursor:'pointer', flexShrink:0}}
                  onClick={e=>{e.stopPropagation(); const w=window.open(); w.document.write(`<iframe src="${exp.referenceFile}" width="100%" height="100%" style="border:none"/>`)}}>
                  <span style={{fontSize:18}}>📄</span>
                </div>
              )}
              <span style={{fontSize:11, color:'var(--primary)', cursor:'pointer'}}
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

        {/* Right: action buttons.
            Hover lives in CSS. These previously set inline styles from
            onMouseEnter/onMouseLeave, and a missed mouseleave — a modal opening
            over the button, or the row re-rendering mid-hover — left the grey
            circle stuck on, so some rows looked highlighted and others did not. */}
        <div style={{display:'flex', gap:4, flexShrink:0, alignItems:'flex-start'}}>
          <button type="button" className="icon-btn icon-btn-primary"
            title="View details" aria-label="View assignment details"
            onClick={()=>setModal({type:'viewExp', data:exp})}>
            <span className="material-icons-round" aria-hidden="true">visibility</span>
          </button>
          {canEdit && (
            <button type="button" className="icon-btn"
              title="Edit" aria-label="Edit assignment"
              onClick={()=>setModal({type:'editExp', data:exp})}>
              <span className="material-icons-round" aria-hidden="true">edit</span>
            </button>
          )}
          {isAdmin && (
            <button type="button" className="icon-btn icon-btn-danger"
              title="Delete" aria-label="Delete assignment"
              onClick={()=>deleteExperience(exp.id)}>
              <span className="material-icons-round" aria-hidden="true">delete</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
export default ExpCard;

import { useState, useEffect, useMemo } from 'react';
import { FISCAL_YEARS } from '../constants/data.js';
import { getSession } from '../utils/auth.js';
import { getNepaliDate } from '../constants/nepali.js';
import { api } from '../utils/api.js';

const fmt = (n) => n ? Number(n).toLocaleString('en-IN') : '—';

function Dashboard({institutes, isEditor, onNavigate}) {
  const session = getSession();
  const nd = useMemo(()=>getNepaliDate(),[]);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const active  = institutes.filter(i=>i.status==='Active').length;
  const pending = institutes.filter(i=>i.status==='Pending Renewal').length;
  const expired = institutes.filter(i=>i.status==='Expired').length;
  const totalTrainees    = institutes.reduce((s,i)=>s+(i.totalTrainees||0),0);
  const totalStAppeared  = institutes.reduce((s,i)=>s+(i.totalStAppeared||0),0);
  const totalAffPrograms = institutes.reduce((s,i)=>s+(i.totalAffPrograms||0),0);
  const missingTax  = institutes.filter(i=>!i.taxClearance.find(t=>t.fy==='2081/82')).length;
  const expiredAff  = institutes.filter(i=>i.affiliation.some(a=>a.status==='Expired')).length;
  const missingNSTB = institutes.filter(i=>!i.nstb.find(n=>n.fy==='2081/82')).length;

  const [activity, setActivity] = useState(null);
  useEffect(() => {
    const token = session?.token;
    api('GET', '/dashboard/activity', null, token).then(setActivity).catch(()=>{});
  }, []);

  const alerts = [
    ...institutes.filter(i=>i.status==='Pending Renewal').map(i=>({type:'warning', msg:`${i.acronym?'['+i.acronym+'] ':''}${i.name} — Renewal due: ${i.renewalDue}`, inst:i, tab:'profile'})),
    ...institutes.filter(i=>!i.taxClearance.find(t=>t.fy==='2081/82')).map(i=>({type:'danger', msg:`${i.acronym?'['+i.acronym+'] ':''}${i.name} — Tax clearance missing for FY 2081/82`, inst:i, tab:'tax'})),
    ...institutes.filter(i=>i.affiliation.some(a=>a.status==='Expired')).map(i=>({type:'info', msg:`${i.acronym?'['+i.acronym+'] ':''}${i.name} — Has expired CTEVT affiliation(s)`, inst:i, tab:'affiliation'})),
    ...institutes.filter(i=>!i.nstb.find(n=>n.fy==='2081/82')).map(i=>({type:'info', msg:`${i.acronym?'['+i.acronym+'] ':''}${i.name} — NSTB data missing for FY 2081/82`, inst:i, tab:'nstb'})),
  ];

  // ── KPI Card ────────────────────────────────────────────────────────────────
  const KpiCard = ({ icon, iconColor, iconBg, label, value, valueColor, sub, badge, onClick }) => (
    <div
      onClick={onClick}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '16px 18px 14px',
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        boxShadow: 'var(--shadow)',
        transition: 'box-shadow .15s',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={e=>{ if(onClick) e.currentTarget.style.boxShadow='0 4px 16px rgba(0,0,0,.10)'; }}
      onMouseLeave={e=>{ e.currentTarget.style.boxShadow='var(--shadow)'; }}
    >
      {/* top row: small icon + label */}
      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between'}}>
        <span style={{fontSize:11, fontWeight:700, letterSpacing:.6, color:'var(--text3)', textTransform:'uppercase'}}>{label}</span>
        <span style={{
          display:'flex', alignItems:'center', justifyContent:'center',
          width:28, height:28, borderRadius:8,
          background: iconBg, flexShrink:0,
        }}>
          <span className="material-icons-round" style={{fontSize:15, color: iconColor}}>{icon}</span>
        </span>
      </div>

      {/* value */}
      <div style={{fontSize:28, fontWeight:800, lineHeight:1, color: valueColor || 'var(--text)', letterSpacing:-.5}}>
        {value}
      </div>

      {/* sub */}
      <div style={{fontSize:11, color:'var(--text3)', lineHeight:1.3}}>{sub}</div>

      {/* last-30d badge */}
      {badge != null && (
        <div style={{
          marginTop:4,
          display:'inline-flex', alignItems:'center', gap:4,
          fontSize:10, fontWeight:600,
          color: badge > 0 ? 'var(--success)' : 'var(--text3)',
          background: badge > 0 ? 'var(--success-light)' : 'var(--bg2)',
          borderRadius:20, padding:'2px 7px', alignSelf:'flex-start',
        }}>
          <span className="material-icons-round" style={{fontSize:10}}>{badge > 0 ? 'trending_up' : 'remove'}</span>
          {badge > 0 ? `+${badge} this month` : 'None this month'}
        </div>
      )}

      {/* subtle accent stripe on left edge */}
      <div style={{position:'absolute', left:0, top:12, bottom:12, width:3, borderRadius:2, background: iconColor, opacity:.6}}/>
    </div>
  );

  // ── Activity chips ───────────────────────────────────────────────────────────
  const activityItems = activity ? [
    { icon:'business', label:'New institutes', count: activity.institutes, color:'var(--primary)' },
    { icon:'assignment', label:'Assignments added', count: activity.assignments, color:'var(--success)' },
    { icon:'receipt_long', label:'Tax records added', count: activity.tax, color:'var(--error)' },
    { icon:'assignment_turned_in', label:'NSTB records added', count: activity.nstb, color:'var(--secondary)' },
    { icon:'verified', label:'Affiliations added', count: activity.affiliations, color:'var(--warning)' },
  ] : [];

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',flexWrap:'wrap',gap:12,marginBottom:20,
        background:'var(--surface)',borderRadius:16,padding:'20px 24px',border:'1px solid var(--border)',boxShadow:'var(--shadow)'}}>
        <div>
          <div style={{fontSize:22,fontWeight:800,color:'var(--text)',marginBottom:4}}>
            {greeting}, {session?.fullName?.split(' ')[0] || 'there'} 👋
          </div>
          <div style={{fontSize:13,color:'var(--text3)'}}>Here's your TVET registry overview</div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontSize:17,fontWeight:700,color:'var(--primary)',letterSpacing:0.2}}>{nd.npDay}, {nd.npDate}</div>
          <div style={{fontSize:12,color:'var(--text3)',marginTop:2}}>{nd.enDay}, {nd.enDate} · Kathmandu, Nepal</div>
        </div>
      </div>

      {/* Last-30-day activity bar */}
      {activity && (
        <div style={{
          display:'flex', alignItems:'center', flexWrap:'wrap', gap:8,
          background:'var(--surface)', border:'1px solid var(--border)',
          borderRadius:10, padding:'10px 16px', marginBottom:16,
          boxShadow:'var(--shadow)',
        }}>
          <span style={{fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:.5, marginRight:4}}>
            Last 30 days
          </span>
          {activityItems.map(({icon,label,count,color}) => (
            <div key={label} style={{
              display:'flex', alignItems:'center', gap:5,
              background: count > 0 ? 'var(--bg2)' : 'transparent',
              border: '1px solid var(--border)', borderRadius:20,
              padding:'3px 10px 3px 7px', fontSize:11,
            }}>
              <span className="material-icons-round" style={{fontSize:13, color}}>{icon}</span>
              <span style={{fontWeight:700, color: count > 0 ? color : 'var(--text3)'}}>{count}</span>
              <span style={{color:'var(--text3)'}}>{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Registry health KPIs */}
      <div style={{fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:.6, marginBottom:8, paddingLeft:2}}>
        Registry Health
      </div>
      <div className="grid-4 mb-6">
        <KpiCard
          icon="account_balance" iconBg="var(--primary-light)" iconColor="var(--primary)"
          label="Total Institutes" value={institutes.length}
          sub={<><span style={{color:'var(--success)',fontWeight:600}}>{active} active</span>{' · '}<span style={{color:'var(--warning)',fontWeight:600}}>{pending} pending</span>{' · '}<span style={{color:'var(--error)',fontWeight:600}}>{expired} expired</span></>}
          badge={activity?.institutes}
        />
        <KpiCard
          icon="receipt_long" iconBg="var(--error-light)" iconColor="var(--error)"
          label="Missing Tax Clearance" value={missingTax}
          valueColor={missingTax > 0 ? 'var(--error)' : 'var(--success)'}
          sub="Institutes without FY 2081/82 record"
          badge={activity?.tax}
        />
        <KpiCard
          icon="verified" iconBg="var(--warning-light)" iconColor="var(--warning)"
          label="Expired CTEVT Affiliation" value={expiredAff}
          valueColor={expiredAff > 0 ? 'var(--warning)' : 'var(--success)'}
          sub="Institutes with expired programs"
          badge={activity?.affiliations}
        />
        <KpiCard
          icon="assignment" iconBg="var(--secondary-light)" iconColor="var(--secondary)"
          label="NSTB Data Missing" value={missingNSTB}
          valueColor={missingNSTB > 0 ? 'var(--secondary)' : 'var(--success)'}
          sub="Institutes without FY 2081/82 record"
          badge={activity?.nstb}
        />
      </div>

      {/* Training totals */}
      <div style={{fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:.6, marginBottom:8, paddingLeft:2}}>
        Training Totals
      </div>
      <div className="grid-4 mb-6">
        <KpiCard
          icon="groups" iconBg="var(--primary-light)" iconColor="var(--primary)"
          label="Total Trainees Trained" value={fmt(totalTrainees)}
          sub="Across all institutes & fiscal years"
          badge={activity?.assignments}
        />
        <KpiCard
          icon="school" iconBg="var(--success-light)" iconColor="var(--success)"
          label="Skill Test Appeared" value={fmt(totalStAppeared)}
          sub="Total candidates appeared"
        />
        <KpiCard
          icon="workspace_premium" iconBg="var(--purple-light,#ede9fe)" iconColor="var(--purple,#7c3aed)"
          label="Affiliated Programs" value={fmt(totalAffPrograms)}
          sub="CTEVT affiliation program slots"
        />
        <KpiCard
          icon="rule" iconBg="var(--primary-light)" iconColor="var(--primary-dark,var(--primary))"
          label="Project Compliance" value="→" sub="Match firms to project criteria"
          onClick={() => onNavigate('compliance')}
        />
      </div>

      {/* Map — hidden for now */}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="card">
          <div className="section-title" style={{marginBottom:12}}>Alerts & flags</div>
          {alerts.map((a, i) => (
            <div key={i} className={`alert-row ${a.type}`} style={{cursor:'pointer'}} onClick={()=>onNavigate('detail', a.inst, a.tab)}>
              <span>{a.type==='warning'?'⚠':a.type==='danger'?'🔴':'ℹ'}</span>
              <span style={{flex:1}}>{a.msg}</span>
              <span style={{fontSize:11, opacity:0.7}}>→ Go to {a.tab} tab</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
export default Dashboard;

import { useState, useEffect, useMemo } from 'react';
import StatusBadge from './ui/StatusBadge.jsx';
import { FISCAL_YEARS } from '../constants/data.js';

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

function Dashboard({institutes, isEditor, onNavigate}) {
  const session = getSession();
  const nd = useMemo(()=>getNepaliDate(),[]);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const active = institutes.filter(i=>i.status==='Active').length;
  const pending = institutes.filter(i=>i.status==='Pending Renewal').length;
  const expired = institutes.filter(i=>i.status==='Expired').length;
  const totalTrainees = institutes.reduce((s,i)=>s+(i.totalTrainees||0),0);
  const totalStAppeared = institutes.reduce((s,i)=>s+(i.totalStAppeared||0),0);
  const totalAffPrograms = institutes.reduce((s,i)=>s+(i.totalAffPrograms||0),0);
  const missingTax = institutes.filter(i=>i.taxClearance.length===0 || !i.taxClearance.find(t=>t.fy==='2081/82')).length;
  const expiredAff = institutes.filter(i=>i.affiliation.some(a=>a.status==='Expired')).length;
  const missingNSTB = institutes.filter(i=>!i.nstb.find(n=>n.fy==='2081/82')).length;

  const alerts = [
    ...institutes.filter(i=>i.status==='Pending Renewal').map(i=>({type:'warning', msg:`${i.acronym?'['+i.acronym+'] ':''}${i.name} — Renewal due: ${i.renewalDue}`, inst:i, tab:'profile'})),
    ...institutes.filter(i=>!i.taxClearance.find(t=>t.fy==='2081/82')).map(i=>({type:'danger', msg:`${i.acronym?'['+i.acronym+'] ':''}${i.name} — Tax clearance missing for FY 2081/82`, inst:i, tab:'tax'})),
    ...institutes.filter(i=>i.affiliation.some(a=>a.status==='Expired')).map(i=>({type:'info', msg:`${i.acronym?'['+i.acronym+'] ':''}${i.name} — Has expired CTEVT affiliation(s)`, inst:i, tab:'affiliation'})),
    ...institutes.filter(i=>!i.nstb.find(n=>n.fy==='2081/82')).map(i=>({type:'info', msg:`${i.acronym?'['+i.acronym+'] ':''}${i.name} — NSTB data missing for FY 2081/82`, inst:i, tab:'nstb'})),
  ];

  const KpiCard = ({icon, iconBg, iconColor, label, value, sub, valueColor, onClick}) => (
    <div className="stat-card" style={{cursor: onClick ? 'pointer' : 'default'}} onClick={onClick}>
      <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:16}}>
        <div className="stat-card-icon" style={{background: iconBg, color: iconColor}}>
          <span className="material-icons-round" style={{fontSize:22, color: iconColor}}>{icon}</span>
        </div>
      </div>
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={valueColor ? {color: valueColor} : {}}>{value}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );

  return (
    <div className="fade-in">
      <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',flexWrap:'wrap',gap:12,marginBottom:28,
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

      <div className="grid-4 mb-6">
        <KpiCard
          icon="account_balance" iconBg="var(--primary-light)" iconColor="var(--primary)"
          label="Total Institutes" value={institutes.length}
          sub={<><span style={{color:'var(--success)',fontWeight:600}}>{active} active</span>{' · '}<span style={{color:'var(--warning)',fontWeight:600}}>{pending} pending</span>{' · '}<span style={{color:'var(--error)',fontWeight:600}}>{expired} expired</span></>}
        />
        <KpiCard
          icon="receipt_long" iconBg="var(--error-light)" iconColor="var(--error)"
          label="Missing Tax Clearance" value={missingTax}
          valueColor={missingTax > 0 ? 'var(--error)' : 'var(--success)'}
          sub="Institutes without FY 2081/82 record"
        />
        <KpiCard
          icon="verified" iconBg="var(--warning-light)" iconColor="var(--warning)"
          label="Expired CTEVT Affiliation" value={expiredAff}
          valueColor={expiredAff > 0 ? 'var(--warning)' : 'var(--success)'}
          sub="Institutes with expired programs"
        />
        <KpiCard
          icon="assignment" iconBg="var(--secondary-light)" iconColor="var(--secondary)"
          label="NSTB Data Missing" value={missingNSTB}
          valueColor={missingNSTB > 0 ? 'var(--secondary)' : 'var(--success)'}
          sub="Institutes without FY 2081/82 record"
        />
      </div>

      {/* Overall totals */}
      <div className="grid-4 mb-6">
        <KpiCard
          icon="groups" iconBg="var(--primary-light)" iconColor="var(--primary)"
          label="Total Trainees Trained" value={totalTrainees.toLocaleString()}
          sub="Across all institutes & fiscal years"
        />
        <KpiCard
          icon="school" iconBg="var(--success-light)" iconColor="var(--success)"
          label="Skill Test Appeared" value={totalStAppeared.toLocaleString()}
          sub="Total candidates appeared"
        />
        <KpiCard
          icon="workspace_premium" iconBg="var(--purple-light)" iconColor="var(--purple)"
          label="Affiliated Programs" value={totalAffPrograms.toLocaleString()}
          sub="CTEVT affiliation program slots"
        />
        <KpiCard
          icon="rule" iconBg="var(--primary-light)" iconColor="var(--primary-dark)"
          label="Project Compliance" value="→" sub="Match firms to project criteria"
          onClick={() => onNavigate('compliance')}
        />
      </div>

      {/* Map */}
      <div className="card mb-6" style={{padding:0, overflow:'hidden'}}>
        <div style={{padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
          <span style={{fontWeight:600, fontSize:14}}>Institute locations — Nepal</span>
          <div style={{display:'flex', gap:8}}>
            <span style={{display:'flex', alignItems:'center', gap:4, fontSize:12}}><span style={{width:10, height:10, borderRadius:'50%', background:'var(--accent)', display:'inline-block'}}/>Active</span>
            <span style={{display:'flex', alignItems:'center', gap:4, fontSize:12}}><span style={{width:10, height:10, borderRadius:'50%', background:'var(--amber)', display:'inline-block'}}/>Pending</span>
            <span style={{display:'flex', alignItems:'center', gap:4, fontSize:12}}><span style={{width:10, height:10, borderRadius:'50%', background:'var(--red)', display:'inline-block'}}/>Expired</span>
          </div>
        </div>
        <NepalMap institutes={institutes} onSelect={(inst)=>onNavigate('detail', inst)}/>
      </div>

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

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { getSession } from '../utils/auth.js';
import { getNepaliDate } from '../constants/nepali.js';
import { COMPLIANCE_FY } from '../constants/data.js';
import { api } from '../utils/api.js';
import { fmt } from '../utils/format.js';
import { Btn } from '../md.jsx';
import {
  PageHeader, KpiCard, InkCard, StatusBadge, EmptyState, Skeleton,
} from './ui/primitives.jsx';

/**
 * Registry overview.
 *
 * Every figure here is derived from live data — the institute list for status
 * and trainee totals, /dashboard/totals for registry-wide counts the list
 * payload omits, /dashboard/activity for the last 30 days. Nothing is
 * hardcoded; a metric that cannot be derived is not shown.
 */

/* The fiscal year the compliance checks are measured against. Was repeated as a
   literal in four places; still a constant rather than derived, because "the
   year records are expected for" is a policy decision, not today's date. */

/* ── Trainees by fiscal year ─────────────────────────────────────────────── */

/** Rounded-top bars, no gridlines, value shown on hover. */
function FyChart({ rows }) {
  const [hover, setHover] = useState(null);
  if (!rows?.length) return null;
  const max = Math.max(...rows.map(r => r.trainees), 1);

  return (
    <div style={{display:'flex', alignItems:'flex-end', gap:10, height:180, paddingTop:26}}>
      {rows.map((r, i) => {
        const pct = Math.max((r.trainees / max) * 100, 2);
        const on = hover === i;
        return (
          <div key={r.fy} style={{flex:1, minWidth:0, display:'flex', flexDirection:'column',
            alignItems:'center', gap:8, height:'100%'}}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <div style={{flex:1, width:'100%', display:'flex', alignItems:'flex-end', position:'relative'}}>
              {on && (
                <div style={{position:'absolute', top:-26, left:'50%', transform:'translateX(-50%)',
                  background:'var(--ink)', color:'var(--on-ink)', borderRadius:'var(--radius-pill)',
                  padding:'3px 10px', fontSize:11, fontWeight:600, whiteSpace:'nowrap', zIndex:1}}>
                  {fmt(r.trainees)}
                </div>
              )}
              <div title={`FY ${r.fy}: ${fmt(r.trainees)} trainees, ${r.assignments} assignments`}
                style={{width:'100%', height:`${pct}%`, borderRadius:'10px 10px 4px 4px',
                  background: on ? 'var(--primary)' : 'var(--pastel-periwinkle)',
                  transition:'background .16s'}}/>
            </div>
            <div style={{fontSize:11, color:'var(--text3)', whiteSpace:'nowrap',
              overflow:'hidden', textOverflow:'ellipsis', maxWidth:'100%'}}>{r.fy}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Attention row ───────────────────────────────────────────────────────── */

function AttentionRow({ count, label, tone, onClick, active }) {
  if (!count) return null;
  return (
    <button onClick={onClick}
      style={{display:'flex', alignItems:'center', gap:12, width:'100%', textAlign:'left',
        padding:'10px 12px', borderRadius:12, cursor:'pointer', fontFamily:'var(--font)',
        border:'1px solid ' + (active ? 'var(--primary)' : 'transparent'),
        background: active ? 'var(--bg2)' : 'transparent', transition:'background .14s'}}>
      <span style={{fontSize:20, fontWeight:800, minWidth:34, color:'var(--text)'}}>{count}</span>
      <span style={{flex:1, fontSize:13, color:'var(--text2)'}}>{label}</span>
      <StatusBadge tone={tone}>Review</StatusBadge>
    </button>
  );
}

/* ── Alert list row ──────────────────────────────────────────────────────── */

const ALERT_TONE = { warning:'warning', danger:'error', info:'info' };

function AlertRow({ type, msg, onClick }) {
  return (
    <button onClick={onClick}
      style={{display:'flex', alignItems:'center', gap:10, width:'100%', textAlign:'left',
        padding:'9px 12px', border:'none', borderRadius:10, cursor:'pointer',
        background:'transparent', fontFamily:'var(--font)', fontSize:13, color:'var(--text2)'}}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      <StatusBadge tone={ALERT_TONE[type] || 'neutral'}>{type === 'danger' ? 'Missing' : type === 'warning' ? 'Due' : 'Check'}</StatusBadge>
      <span style={{flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{msg}</span>
      <span className="material-icons-round" style={{fontSize:16, color:'var(--text3)'}}>chevron_right</span>
    </button>
  );
}

/* ── Dashboard ───────────────────────────────────────────────────────────── */

function Dashboard({ institutes, isEditor, onNavigate }) {
  const session = getSession();
  const nd = useMemo(() => getNepaliDate(), []);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  // Shortlisting-only firms are excluded from registry figures and alerts, as before.
  const alertable = useMemo(() => institutes.filter(i => !i.isShortlistingOnly), [institutes]);

  const s = useMemo(() => ({
    active:  alertable.filter(i => i.status === 'Active').length,
    pending: alertable.filter(i => i.status === 'Pending Renewal').length,
    expired: alertable.filter(i => i.status === 'Expired').length,
    trainees:    alertable.reduce((n, i) => n + (i.totalTrainees || 0), 0),
    stAppeared:  alertable.reduce((n, i) => n + (i.totalStAppeared || 0), 0),
    affPrograms: alertable.reduce((n, i) => n + (i.totalAffPrograms || 0), 0),
    missingTax:  alertable.filter(i => !i.taxClearance.find(t => t.fy === COMPLIANCE_FY)).length,
    expiredAff:  alertable.filter(i => i.affiliation.some(a => a.status === 'Expired')).length,
    missingNSTB: alertable.filter(i => !i.nstb.find(n => n.fy === COMPLIANCE_FY)).length,
  }), [alertable]);

  const [activity, setActivity] = useState(null);
  const [totals, setTotals] = useState(null);
  const [totalsFailed, setTotalsFailed] = useState(false);
  const [alertFilter, setAlertFilter] = useState(null);
  const [alertsExpanded, setAlertsExpanded] = useState(false);
  const alertsRef = useRef(null);

  useEffect(() => {
    const token = session?.token;
    api('GET', '/dashboard/activity', null, token).then(setActivity).catch(() => {});
    api('GET', '/dashboard/totals', null, token).then(setTotals).catch(() => setTotalsFailed(true));
  }, []);

  const focusAlerts = useCallback((filter) => {
    setAlertFilter(prev => prev === filter ? null : filter);
    setAlertsExpanded(true);
    setTimeout(() => alertsRef.current?.scrollIntoView({ behavior:'smooth', block:'start' }), 50);
  }, []);

  const tag = (i) => `${i.acronym ? `[${i.acronym}] ` : ''}${i.name}`;
  const allAlerts = useMemo(() => [
    ...alertable.filter(i => i.status === 'Pending Renewal')
      .map(i => ({ type:'warning', group:'renewal', msg:`${tag(i)} — Renewal due: ${i.renewalDue}`, inst:i, tab:'profile' })),
    ...alertable.filter(i => !i.taxClearance.find(t => t.fy === COMPLIANCE_FY))
      .map(i => ({ type:'danger', group:'tax', msg:`${tag(i)} — Tax clearance missing for FY ${COMPLIANCE_FY}`, inst:i, tab:'tax' })),
    ...alertable.filter(i => i.affiliation.some(a => a.status === 'Expired'))
      .map(i => ({ type:'info', group:'affiliation', msg:`${tag(i)} — Has expired CTEVT affiliation(s)`, inst:i, tab:'affiliation' })),
    ...alertable.filter(i => !i.nstb.find(n => n.fy === COMPLIANCE_FY))
      .map(i => ({ type:'info', group:'nstb', msg:`${tag(i)} — NSTB data missing for FY ${COMPLIANCE_FY}`, inst:i, tab:'nstb' })),
  ], [alertable]);

  const alerts = alertFilter ? allAlerts.filter(a => a.group === alertFilter) : allAlerts;
  const visibleAlerts = alertsExpanded ? alerts : alerts.slice(0, 6);
  const attentionTotal = s.pending + s.missingTax + s.expiredAff + s.missingNSTB;

  return (
    <div className="fade-in">
      <PageHeader
        title={`${greeting},`}
        emphasis={(session?.fullName || session?.email || '').split(' ')[0] || 'there'}
        sub={`Registry overview · ${nd.npDate} (${nd.enDate})`}
      />

      {/* ── Registry figures ── */}
      <div style={{display:'grid', gap:14, marginBottom:14,
        gridTemplateColumns:'repeat(auto-fit, minmax(210px, 1fr))'}}>
        <KpiCard label="Institutes" value={alertable.length} icon="account_balance" tone="periwinkle"
          footer={`${s.active} active · ${s.pending} pending · ${s.expired} expired`}
          onClick={() => onNavigate('institutes')}/>
        <KpiCard label="Trainees" value={fmt(s.trainees)} icon="groups" tone="mint"
          footer="Across all institutes and fiscal years"/>
        <KpiCard label="Skill test appeared" value={fmt(s.stAppeared)} icon="school" tone="blue"
          footer="Total candidates appeared"/>
        {/* Only rendered once real totals arrive — never a placeholder zero. */}
        {totals ? (
          <>
            <KpiCard label="Assignments" value={fmt(totals.assignments)} icon="assignment" tone="lilac"
              footer={`${totals.clients} clients engaged`}/>
            <KpiCard label="Districts" value={fmt(totals.districts)} icon="place" tone="cream"
              footer="Distinct districts reached"/>
          </>
        ) : totalsFailed ? null : (
          <>
            <div style={{background:'var(--pastel-lilac)', borderRadius:'var(--radius-card)', padding:'18px 20px'}}>
              <Skeleton w="45%" h={12}/><Skeleton w="60%" h={30} style={{marginTop:16}}/>
            </div>
            <div style={{background:'var(--pastel-cream)', borderRadius:'var(--radius-card)', padding:'18px 20px'}}>
              <Skeleton w="45%" h={12}/><Skeleton w="60%" h={30} style={{marginTop:16}}/>
            </div>
          </>
        )}
      </div>

      {/* ── Attention + trend ── */}
      <div style={{display:'grid', gap:14, marginBottom:14,
        gridTemplateColumns:'minmax(280px, 1fr) minmax(320px, 1.6fr)'}}>

        {attentionTotal > 0 ? (
          <div style={{background:'var(--canvas-card)', borderRadius:'var(--radius-card)', padding:'18px 16px'}}>
            <div style={{display:'flex', alignItems:'baseline', gap:8, padding:'0 6px', marginBottom:10}}>
              <span style={{fontSize:'var(--fs-card)', fontWeight:700}}>Needs attention</span>
              <span style={{fontSize:'var(--fs-meta)', color:'var(--text3)'}}>{attentionTotal} items</span>
            </div>
            <AttentionRow count={s.pending} label="Renewal due soon" tone="warning"
              onClick={() => focusAlerts('renewal')} active={alertFilter === 'renewal'}/>
            <AttentionRow count={s.missingTax} label={`Tax clearance missing for FY ${COMPLIANCE_FY}`} tone="error"
              onClick={() => focusAlerts('tax')} active={alertFilter === 'tax'}/>
            <AttentionRow count={s.expiredAff} label="Expired CTEVT affiliation" tone="warning"
              onClick={() => focusAlerts('affiliation')} active={alertFilter === 'affiliation'}/>
            <AttentionRow count={s.missingNSTB} label={`NSTB data missing for FY ${COMPLIANCE_FY}`} tone="info"
              onClick={() => focusAlerts('nstb')} active={alertFilter === 'nstb'}/>
          </div>
        ) : (
          <InkCard title="Everything is current" sub={`No renewals due and no records missing for FY ${COMPLIANCE_FY}.`}>
            <Btn className="btn btn-sm on-ink" onClick={() => onNavigate('institutes')}>Browse institutes</Btn>
          </InkCard>
        )}

        <div style={{background:'var(--canvas-card)', borderRadius:'var(--radius-card)', padding:'18px 20px'}}>
          <div style={{display:'flex', alignItems:'baseline', gap:8, marginBottom:2}}>
            <span style={{fontSize:'var(--fs-card)', fontWeight:700}}>Trainees by fiscal year</span>
            {activity && (
              <span style={{fontSize:'var(--fs-meta)', color:'var(--text3)', marginLeft:'auto'}}>
                {activity.assignments} assignments added in 30 days
              </span>
            )}
          </div>
          {totals?.byFy?.length ? <FyChart rows={totals.byFy}/>
            : totalsFailed ? (
              <div style={{fontSize:13, color:'var(--text3)', padding:'32px 0', textAlign:'center'}}>
                Unable to load fiscal-year totals.
              </div>
            ) : <Skeleton w="100%" h={168} r={12} style={{marginTop:20}}/>}
        </div>
      </div>

      {/* ── Alerts ── */}
      <div ref={alertsRef} style={{background:'var(--canvas-card)', borderRadius:'var(--radius-card)', padding:'18px 16px'}}>
        <div style={{display:'flex', alignItems:'center', gap:10, padding:'0 6px', marginBottom:8, flexWrap:'wrap'}}>
          <span style={{fontSize:'var(--fs-card)', fontWeight:700}}>
            {alertFilter ? 'Filtered items' : 'All items needing attention'}
          </span>
          <span style={{fontSize:'var(--fs-meta)', color:'var(--text3)'}}>{alerts.length}</span>
          {alertFilter && (
            <Btn className="btn btn-ghost btn-sm" onClick={() => setAlertFilter(null)}>Clear filter</Btn>
          )}
        </div>
        {alerts.length === 0 ? (
          <EmptyState icon="task_alt" title="Nothing outstanding"
            body={`Every institute has a current renewal, tax clearance and NSTB record for FY ${COMPLIANCE_FY}.`}/>
        ) : (
          <>
            {visibleAlerts.map((a, i) => (
              <AlertRow key={`${a.group}-${i}`} type={a.type} msg={a.msg}
                onClick={() => onNavigate('detail', a.inst, a.tab)}/>
            ))}
            {alerts.length > 6 && (
              <div style={{textAlign:'center', marginTop:8}}>
                <Btn className="btn btn-ghost btn-sm" onClick={() => setAlertsExpanded(e => !e)}>
                  {alertsExpanded ? 'Show less' : `Show all ${alerts.length}`}
                </Btn>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Dashboard;

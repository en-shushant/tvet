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

/**
 * Soft grey bars with one in the dark gradient — the latest year, or whichever
 * is hovered — and its value in a small flag above it, as in the reference.
 */
function FyChart({ rows }) {
  const [hover, setHover] = useState(null);
  const scroller = useRef(null);
  // Newest year in view: with many years the chart scrolls sideways, and the
  // recent ones are what people look for.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [rows?.length]);
  if (!rows?.length) return null;
  const max = Math.max(...rows.map(r => r.trainees), 1);
  const focus = hover ?? rows.length - 1;
  const last = rows.length - 1;

  return (
    <div ref={scroller} className="fy-chart-scroll">
      <div className="fy-chart" style={{minWidth: rows.length * 54}}>
        {rows.map((r, i) => {
          const pct = Math.max((r.trainees / max) * 100, 2);
          const on = focus === i;
          // Keep the label inside the card at either end.
          const edge = i === 0 ? { left: 0 } : i === last ? { right: 0 }
            : { left: '50%', transform: 'translateX(-50%)' };
          return (
            <div key={r.fy} className="fy-col"
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <div className="fy-bar-wrap">
                {on && (
                  <div className="fy-tip" style={{bottom:`calc(${pct}% + 8px)`, ...edge}}>
                    {r.fy} · {fmt(r.trainees)}
                  </div>
                )}
                <div title={`FY ${r.fy}: ${fmt(r.trainees)} trainees, ${r.assignments} assignments`}
                  className={`fy-bar${on ? ' is-on' : ''}`} style={{height:`${pct}%`}}/>
              </div>
              <div className={`fy-label${on ? ' is-on' : ''}`} title={r.fy}>
                {String(r.fy).replace(/^20(\d\d)\//, '$1/')}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Attention row ───────────────────────────────────────────────────────── */

function AttentionRow({ count, label, tone, onClick, active }) {
  if (!count) return null;
  return (
    <button onClick={onClick} className="row-hover"
      style={{display:'flex', alignItems:'center', gap:12, width:'100%', textAlign:'left',
        padding:'9px 10px', borderRadius:8, cursor:'pointer', fontFamily:'var(--font)',
        border:'.5px solid ' + (active ? 'var(--border2)' : 'transparent'),
        background: active ? 'var(--bg2)' : 'transparent', transition:'background .14s'}}>
      <span style={{fontSize:20, fontWeight:500, minWidth:30, color:'var(--text)', fontVariantNumeric:'tabular-nums'}}>{count}</span>
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
        padding:'8px 10px', border:'none', borderRadius:8, cursor:'pointer',
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
        gridTemplateColumns:'repeat(auto-fit, minmax(170px, 1fr))'}}>
        <KpiCard label="Institutes" value={alertable.length} icon="account_balance" tone="periwinkle"
          footer={`${s.active} active · ${s.pending} pending · ${s.expired} expired`}
          onClick={() => onNavigate('institutes')}/>
        <KpiCard label="Trainees" value={fmt(s.trainees)} icon="groups" tone="mint"
          footer="Across all institutes and fiscal years"/>
        <KpiCard label="Skill test appeared" value={fmt(s.stAppeared)} icon="workspace_premium" tone="blue"
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
            {[0, 1].map(k => (
              <div key={k} className="frame">
                <div className="frame-head"><Skeleton w="45%" h={12}/></div>
                <div className="frame-body"><Skeleton w="60%" h={26}/></div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* ── Attention + trend ── */}
      <div className="dash-split">

        {attentionTotal > 0 ? (
          <section className="frame">
            <div className="frame-head">
              <span className="material-icons-round" aria-hidden="true">notification_important</span>
              Needs attention
              <span className="frame-head-action" style={{fontSize:12, color:'var(--text3)', fontWeight:400}}>{attentionTotal} items</span>
            </div>
            <div className="frame-body" style={{padding:6}}>
            <AttentionRow count={s.pending} label="Renewal due soon" tone="warning"
              onClick={() => focusAlerts('renewal')} active={alertFilter === 'renewal'}/>
            <AttentionRow count={s.missingTax} label={`Tax clearance missing for FY ${COMPLIANCE_FY}`} tone="error"
              onClick={() => focusAlerts('tax')} active={alertFilter === 'tax'}/>
            <AttentionRow count={s.expiredAff} label="Expired CTEVT affiliation" tone="warning"
              onClick={() => focusAlerts('affiliation')} active={alertFilter === 'affiliation'}/>
            <AttentionRow count={s.missingNSTB} label={`NSTB data missing for FY ${COMPLIANCE_FY}`} tone="info"
              onClick={() => focusAlerts('nstb')} active={alertFilter === 'nstb'}/>
            </div>
          </section>
        ) : (
          <InkCard title="Everything is current" sub={`No renewals due and no records missing for FY ${COMPLIANCE_FY}.`}>
            <Btn className="btn btn-sm on-ink" onClick={() => onNavigate('institutes')}>Browse institutes</Btn>
          </InkCard>
        )}

        <section className="frame">
          <div className="frame-head">
            <span className="material-icons-round" aria-hidden="true">bar_chart</span>
            Trainees by fiscal year
            {activity && (
              <span className="frame-head-action" style={{fontSize:12, color:'var(--text3)', fontWeight:400}}>
                {activity.assignments} assignments added in 30 days
              </span>
            )}
          </div>
          <div className="frame-body">
          {totals?.byFy?.length ? <FyChart rows={totals.byFy}/>
            : totals ? (
              // Loaded, and there is simply nothing to chart yet — not a spinner forever.
              <EmptyState icon="bar_chart" title="No trainees recorded yet"
                body="Bars appear here per fiscal year once assignments with trainee numbers are added."/>
            ) : totalsFailed ? (
              <div style={{fontSize:13, color:'var(--text3)', padding:'32px 0', textAlign:'center'}}>
                Unable to load fiscal-year totals.
              </div>
            ) : <Skeleton w="100%" h={168} r={8} style={{marginTop:12}}/>}
          </div>
        </section>
      </div>

      {/* ── Alerts ── */}
      <section ref={alertsRef} className="frame">
        <div className="frame-head">
          <span className="material-icons-round" aria-hidden="true">list_alt</span>
          {alertFilter ? 'Filtered items' : 'All items needing attention'}
          <span style={{fontSize:12, color:'var(--text3)', fontWeight:400}}>{alerts.length}</span>
          {alertFilter && (
            <span className="frame-head-action">
              <Btn className="btn btn-ghost btn-sm" onClick={() => setAlertFilter(null)}>Clear filter</Btn>
            </span>
          )}
        </div>
        <div className="frame-body" style={{padding:6}}>
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
      </section>
    </div>
  );
}

export default Dashboard;

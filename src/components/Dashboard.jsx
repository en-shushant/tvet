import { useState, useEffect, useMemo } from 'react';
import { getSession } from '../utils/auth.js';
import { getNepaliDate } from '../constants/nepali.js';
import { api } from '../utils/api.js';

const fmt = (n) => n ? Number(n).toLocaleString('en-IN') : '—';

// ── M3 KPI Card ──────────────────────────────────────────────────────────────
function KpiCard({ icon, iconColor, iconBg, label, value, valueColor, sub, badge, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov && onClick ? 'var(--bg)' : 'var(--surface)',
        borderRadius: 20,
        padding: '20px 20px 18px',
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex', flexDirection: 'column',
        boxShadow: hov
          ? '0 3px 10px rgba(18,38,63,.12), 0 1px 4px rgba(18,38,63,.07)'
          : '0 1px 3px rgba(18,38,63,.07)',
        transition: 'box-shadow .2s ease, background .15s ease',
        position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Tonal icon container */}
      <div style={{
        width: 44, height: 44, borderRadius: 14,
        background: iconBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 16, flexShrink: 0,
      }}>
        <span className="material-icons-round" style={{ fontSize: 22, color: iconColor }}>{icon}</span>
      </div>

      {/* Label — M3 label-medium */}
      <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: 0.3, color: 'var(--text3)', marginBottom: 4 }}>
        {label}
      </div>

      {/* Value — M3 display-small */}
      <div style={{
        fontSize: 36, fontWeight: 400, lineHeight: 1.1,
        color: valueColor || 'var(--text)', letterSpacing: -0.5,
        fontVariantNumeric: 'tabular-nums', marginBottom: 6,
      }}>
        {value}
      </div>

      {/* Supporting text */}
      <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.45, flex: 1 }}>{sub}</div>

      {/* Tonal badge — M3 assist chip style */}
      {badge != null && (
        <div style={{
          marginTop: 14,
          display: 'inline-flex', alignItems: 'center', gap: 4,
          fontSize: 11, fontWeight: 500,
          color: badge > 0 ? '#0c6e4e' : 'var(--text3)',
          background: badge > 0 ? 'var(--success-light)' : 'var(--bg)',
          borderRadius: 100, padding: '4px 10px 4px 7px',
          alignSelf: 'flex-start',
        }}>
          <span className="material-icons-round" style={{ fontSize: 13 }}>
            {badge > 0 ? 'arrow_upward' : 'remove'}
          </span>
          {badge > 0 ? `+${badge} this month` : 'None this month'}
        </div>
      )}
    </div>
  );
}

// ── Alert row ─────────────────────────────────────────────────────────────────
function AlertRow({ type, msg, onClick }) {
  const [hov, setHov] = useState(false);
  const colors = {
    danger:  { dot: 'var(--error)',   bg: 'var(--error-light)',   text: '#8B1A12' },
    warning: { dot: 'var(--warning)', bg: 'var(--warning-light)', text: '#7A4D00' },
    info:    { dot: 'var(--secondary)', bg: 'var(--secondary-light)', text: '#005B8E' },
  };
  const c = colors[type] || colors.info;
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
        background: hov ? c.bg : 'transparent',
        transition: 'background .15s',
        marginBottom: 2,
      }}
    >
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: c.dot, flexShrink: 0 }}/>
      <span style={{ flex: 1, fontSize: 13, color: 'var(--text2)' }}>{msg}</span>
      <span style={{ fontSize: 11, color: c.dot, fontWeight: 500, whiteSpace: 'nowrap' }}>
        Go to {type === 'danger' ? 'tax' : type === 'warning' ? 'profile' : 'record'} →
      </span>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ institutes, isEditor, onNavigate }) {
  const session = getSession();
  const nd = useMemo(() => getNepaliDate(), []);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const alertable = institutes.filter(i => !i.isShortlistingOnly);

  const active  = alertable.filter(i => i.status === 'Active').length;
  const pending = alertable.filter(i => i.status === 'Pending Renewal').length;
  const expired = alertable.filter(i => i.status === 'Expired').length;
  const totalTrainees    = alertable.reduce((s, i) => s + (i.totalTrainees || 0), 0);
  const totalStAppeared  = alertable.reduce((s, i) => s + (i.totalStAppeared || 0), 0);
  const totalAffPrograms = alertable.reduce((s, i) => s + (i.totalAffPrograms || 0), 0);
  const missingTax  = alertable.filter(i => !i.taxClearance.find(t => t.fy === '2081/82')).length;
  const expiredAff  = alertable.filter(i => i.affiliation.some(a => a.status === 'Expired')).length;
  const missingNSTB = alertable.filter(i => !i.nstb.find(n => n.fy === '2081/82')).length;

  const [activity, setActivity] = useState(null);
  useEffect(() => {
    api('GET', '/dashboard/activity', null, session?.token).then(setActivity).catch(() => {});
  }, []);
  const alerts = [
    ...alertable.filter(i => i.status === 'Pending Renewal').map(i => ({ type: 'warning', msg: `${i.acronym ? '[' + i.acronym + '] ' : ''}${i.name} — Renewal due: ${i.renewalDue}`, inst: i, tab: 'profile' })),
    ...alertable.filter(i => !i.taxClearance.find(t => t.fy === '2081/82')).map(i => ({ type: 'danger',  msg: `${i.acronym ? '[' + i.acronym + '] ' : ''}${i.name} — Tax clearance missing for FY 2081/82`, inst: i, tab: 'tax' })),
    ...alertable.filter(i => i.affiliation.some(a => a.status === 'Expired')).map(i => ({ type: 'info',    msg: `${i.acronym ? '[' + i.acronym + '] ' : ''}${i.name} — Has expired CTEVT affiliation(s)`, inst: i, tab: 'affiliation' })),
    ...alertable.filter(i => !i.nstb.find(n => n.fy === '2081/82')).map(i => ({ type: 'info',    msg: `${i.acronym ? '[' + i.acronym + '] ' : ''}${i.name} — NSTB data missing for FY 2081/82`, inst: i, tab: 'nstb' })),
  ];

  const activityChips = activity ? [
    { icon: 'business',          label: 'New institutes',    count: activity.institutes,  color: 'var(--primary)',   bg: 'var(--primary-light)' },
    { icon: 'assignment',        label: 'Assignments',       count: activity.assignments, color: 'var(--teal)',      bg: 'var(--teal-light)' },
    { icon: 'receipt_long',      label: 'Tax records',       count: activity.tax,         color: 'var(--error)',     bg: 'var(--error-light)' },
    { icon: 'fact_check',        label: 'NSTB records',      count: activity.nstb,        color: 'var(--purple)',    bg: 'var(--purple-light)' },
    { icon: 'verified',          label: 'Affiliations',      count: activity.affiliations,color: 'var(--warning)',   bg: 'var(--warning-light)' },
  ] : [];

  // M3 section heading style
  const SectionHead = ({ children }) => (
    <div style={{
      fontSize: 13, fontWeight: 600, color: 'var(--text2)',
      letterSpacing: 0.1, margin: '4px 0 10px 2px',
    }}>{children}</div>
  );

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Greeting banner ── */}
      <div style={{
        background: 'var(--surface)', borderRadius: 24,
        padding: '24px 28px',
        boxShadow: '0 1px 3px rgba(18,38,63,.07)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--text)', letterSpacing: -0.3, marginBottom: 4 }}>
            {greeting}, {session?.fullName?.split(' ')[0] || 'there'} 👋
          </div>
          <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 400 }}>Here's your TVET registry overview</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--primary)', letterSpacing: 0.1 }}>{nd.npDay}, {nd.npDate}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{nd.enDay}, {nd.enDate} · Kathmandu, Nepal</div>
        </div>
      </div>

      {/* ── Last 30 days activity chips ── */}
      {activity && (
        <div style={{
          background: 'var(--surface)', borderRadius: 16,
          padding: '14px 18px',
          boxShadow: '0 1px 3px rgba(18,38,63,.07)',
          display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8,
        }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text3)', marginRight: 4, whiteSpace: 'nowrap' }}>
            Last 30 days
          </span>
          {activityChips.map(({ icon, label, count, color, bg }) => (
            <div key={label} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: count > 0 ? bg : 'var(--bg)',
              borderRadius: 8,
              padding: '5px 12px 5px 8px',
              fontSize: 12, fontWeight: count > 0 ? 600 : 400,
              color: count > 0 ? color : 'var(--text3)',
              transition: 'background .15s',
            }}>
              <span className="material-icons-round" style={{ fontSize: 14, color: count > 0 ? color : 'var(--text3)' }}>{icon}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{count}</span>
              <span style={{ fontWeight: 400, color: 'var(--text3)', fontSize: 11 }}>{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Registry Health ── */}
      <div>
        <SectionHead>Registry Health</SectionHead>
        <div className="grid-4">
          <KpiCard
            icon="account_balance" iconBg="var(--primary-light)" iconColor="var(--primary)"
            label="Total Institutes" value={institutes.length}
            sub={<><span style={{ color: 'var(--teal)', fontWeight: 600 }}>{active} active</span>{' · '}<span style={{ color: 'var(--warning)', fontWeight: 600 }}>{pending} pending</span>{' · '}<span style={{ color: 'var(--error)', fontWeight: 600 }}>{expired} expired</span></>}
            badge={activity?.institutes}
          />
          <KpiCard
            icon="receipt_long" iconBg="var(--error-light)" iconColor="var(--error)"
            label="Missing Tax Clearance" value={missingTax}
            valueColor={missingTax > 0 ? 'var(--error)' : 'var(--teal)'}
            sub="Institutes without FY 2081/82 record"
            badge={activity?.tax}
          />
          <KpiCard
            icon="verified" iconBg="var(--warning-light)" iconColor="var(--warning)"
            label="Expired CTEVT Affiliation" value={expiredAff}
            valueColor={expiredAff > 0 ? 'var(--warning)' : 'var(--teal)'}
            sub="Institutes with expired programs"
            badge={activity?.affiliations}
          />
          <KpiCard
            icon="fact_check" iconBg="var(--purple-light)" iconColor="var(--purple)"
            label="NSTB Data Missing" value={missingNSTB}
            valueColor={missingNSTB > 0 ? 'var(--purple)' : 'var(--teal)'}
            sub="Institutes without FY 2081/82 record"
            badge={activity?.nstb}
          />
        </div>
      </div>

      {/* ── Training Totals ── */}
      <div>
        <SectionHead>Training Totals</SectionHead>
        <div className="grid-4">
          <KpiCard
            icon="groups" iconBg="var(--primary-light)" iconColor="var(--primary)"
            label="Total Trainees Trained" value={fmt(totalTrainees)}
            sub="Across all institutes & fiscal years"
            badge={activity?.assignments}
          />
          <KpiCard
            icon="school" iconBg="var(--teal-light)" iconColor="var(--teal)"
            label="Skill Test Appeared" value={fmt(totalStAppeared)}
            sub="Total candidates appeared"
          />
          <KpiCard
            icon="workspace_premium" iconBg="var(--purple-light)" iconColor="var(--purple)"
            label="Affiliated Programs" value={fmt(totalAffPrograms)}
            sub="CTEVT affiliation program slots"
          />
          <KpiCard
            icon="rule" iconBg="var(--secondary-light)" iconColor="var(--secondary)"
            label="Project Compliance" value="→" sub="Match firms to project criteria"
            onClick={() => onNavigate('compliance')}
          />
        </div>
      </div>

      {/* ── Alerts & Flags ── */}
      {alerts.length > 0 && (
        <div>
          <SectionHead>Alerts & Flags</SectionHead>
          <div style={{
            background: 'var(--surface)', borderRadius: 20,
            padding: '8px 8px',
            boxShadow: '0 1px 3px rgba(18,38,63,.07)',
          }}>
            {alerts.map((a, i) => (
              <AlertRow key={i} type={a.type} msg={a.msg} onClick={() => onNavigate('detail', a.inst, a.tab)} />
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

export default Dashboard;

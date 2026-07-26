import { useState, useEffect, useMemo } from 'react';
import { getSession } from '../utils/auth.js';
import { getNepaliDate } from '../constants/nepali.js';
import { api } from '../utils/api.js';
import { getCurrentFY } from '../constants/data.js';

const DOC_KEYS = [
  { key: 'ocrRegistration',        label: 'OCR दर्ता' },
  { key: 'ocrRenewal',             label: 'OCR नवीकरण' },
  { key: 'vatRegistration',        label: 'VAT दर्ता' },
  { key: 'vatExtension',           label: 'VAT नवीकरण' },
  { key: 'ctevtAffiliation',       label: 'CTEVT सम्बन्धन' },
  { key: 'ctevtRenewal',           label: 'CTEVT नवीकरण' },
  { key: 'localLevelRegistration', label: 'स्थानीय तह दर्ता' },
  { key: 'localLevelRenewal',      label: 'स्थानीय तह नवीकरण' },
  { key: 'taxClearanceDoc',        label: 'कर चुक्ता' },
];

function docStatus(inst) {
  const uploaded = DOC_KEYS.filter(d => !!inst[d.key]);
  const missing  = DOC_KEYS.filter(d => !inst[d.key]);
  return { uploaded: uploaded.length, missing: missing.length, total: DOC_KEYS.length, missingLabels: missing.map(d => d.label) };
}

const fmtNPR = (n) => {
  if (!n) return '—';
  const num = Number(n);
  if (num >= 10_000_000) return `रू ${(num / 10_000_000).toFixed(2)} Cr`;
  if (num >= 100_000)    return `रू ${(num / 100_000).toFixed(2)} L`;
  return `रू ${num.toLocaleString('en-IN')}`;
};

function KpiCard({ icon, iconBg, iconColor, label, value, valueColor, sub, small }) {
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 20,
      padding: '20px 20px 18px',
      boxShadow: '0 1px 3px rgba(18,38,63,.07)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 14,
        background: iconBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 16, flexShrink: 0,
      }}>
        <span className="material-icons-round" style={{ fontSize: 22, color: iconColor }}>{icon}</span>
      </div>
      <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: 0.3, color: 'var(--text3)', marginBottom: 4 }}>{label}</div>
      <div style={{
        fontSize: small ? 24 : 36, fontWeight: 400, lineHeight: 1.1,
        color: valueColor || 'var(--text)', letterSpacing: -0.5,
        fontVariantNumeric: 'tabular-nums', marginBottom: 6,
      }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.45 }}>{sub}</div>
    </div>
  );
}

function DocBar({ uploaded, total }) {
  const pct = total === 0 ? 0 : Math.round((uploaded / total) * 100);
  const color = pct === 100 ? 'var(--teal)' : pct >= 50 ? 'var(--warning)' : 'var(--error)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3, transition: 'width .4s ease' }}/>
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color, minWidth: 36, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {uploaded}/{total}
      </span>
    </div>
  );
}

export default function ShortlistDashboard({ institutes, onNavigate }) {
  const session = getSession();
  const nd = useMemo(() => getNepaliDate(), []);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const currentFY = useMemo(() => getCurrentFY() || '', []);

  const [shortlists, setShortlists] = useState([]);
  useEffect(() => {
    api('GET', '/shortlists', null, session?.token).then(setShortlists).catch(() => {});
  }, []);

  const fyShortlists = useMemo(() =>
    currentFY ? shortlists.filter(s => s.fy === currentFY) : shortlists,
  [shortlists, currentFY]);

  const fyTotalShortlists = fyShortlists.length;
  const fyTotalCost = fyShortlists.reduce((sum, s) => sum + (Number(s.contract_amount) || 0), 0);
  const fyClients = useMemo(() => {
    const names = new Set();
    fyShortlists.forEach(s => {
      const name = s.client_name || s.client_name_manual;
      if (name) names.add(name);
    });
    return names.size;
  }, [fyShortlists]);
  const fyFirms = useMemo(() => new Set(fyShortlists.map(s => s.institute_id)).size, [fyShortlists]);

  // cost per institute_id for the current FY
  const costByFirm = useMemo(() => {
    const map = {};
    fyShortlists.forEach(s => {
      if (s.contract_amount) map[s.institute_id] = (map[s.institute_id] || 0) + Number(s.contract_amount);
    });
    return map;
  }, [fyShortlists]);

  const SectionHead = ({ children }) => (
    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', letterSpacing: 0.1, margin: '4px 0 10px 2px' }}>{children}</div>
  );

  const statuses = useMemo(() => institutes.map(i => ({ inst: i, ...docStatus(i) })), [institutes]);
  const complete   = statuses.filter(s => s.missing === 0).length;
  const incomplete = statuses.filter(s => s.missing > 0).length;
  const totalDocs  = statuses.reduce((sum, s) => sum + s.uploaded, 0);

  const sorted = [...statuses].sort((a, b) =>
    b.missing - a.missing || a.inst.name.localeCompare(b.inst.name)
  );

  const fyLabel = currentFY ? `FY ${currentFY}` : 'All time';

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Greeting */}
      <div style={{
        background: 'var(--surface)', borderRadius: 24, padding: '24px 28px',
        boxShadow: '0 1px 3px rgba(18,38,63,.07)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--text)', letterSpacing: -0.3, marginBottom: 4 }}>
            {greeting}, {session?.fullName?.split(' ')[0] || 'there'} 👋
          </div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>Here's your shortlisting overview</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--primary)', letterSpacing: 0.1 }}>{nd.npDay}, {nd.npDate}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{nd.enDay}, {nd.enDate} · Kathmandu, Nepal</div>
        </div>
      </div>

      {/* Shortlisting KPIs */}
      <div>
        <SectionHead>{fyLabel} — Shortlisting Activity</SectionHead>
        <div className="grid-4">
          <KpiCard
            icon="playlist_add_check" iconBg="var(--primary-light)" iconColor="var(--primary)"
            label={`Total Shortlists (${fyLabel})`} value={fyTotalShortlists}
            sub="Shortlist entries recorded this FY"
          />
          <KpiCard
            icon="payments" iconBg="var(--teal-light)" iconColor="var(--teal)"
            label={`Shortlist Cost (${fyLabel})`}
            value={fyTotalCost > 0 ? fmtNPR(fyTotalCost) : '—'}
            small={fyTotalCost > 0}
            sub="Total contract amount across entries"
          />
          <KpiCard
            icon="corporate_fare" iconBg="var(--purple-light)" iconColor="var(--purple)"
            label={`Clients (${fyLabel})`} value={fyClients}
            sub="Distinct clients in shortlist entries"
          />
          <KpiCard
            icon="business" iconBg="var(--warning-light)" iconColor="var(--warning)"
            label={`Firms Shortlisted (${fyLabel})`} value={fyFirms}
            sub="Distinct firms in shortlist entries"
          />
        </div>
      </div>

      {/* Document status KPIs */}
      <div>
        <SectionHead>Document Status</SectionHead>
        <div className="grid-4">
          <KpiCard
            icon="domain" iconBg="var(--secondary-light)" iconColor="var(--secondary)"
            label="Total Firms" value={institutes.length}
            sub="Firms visible to you"
          />
          <KpiCard
            icon="task_alt" iconBg="var(--teal-light)" iconColor="var(--teal)"
            label="Fully Documented" value={complete}
            valueColor={complete === institutes.length && institutes.length > 0 ? 'var(--teal)' : 'var(--text)'}
            sub="All 9 documents uploaded"
          />
          <KpiCard
            icon="pending_actions" iconBg="var(--warning-light)" iconColor="var(--warning)"
            label="Incomplete Docs" value={incomplete}
            valueColor={incomplete > 0 ? 'var(--warning)' : 'var(--text)'}
            sub="Firms with missing documents"
          />
          <KpiCard
            icon="upload_file" iconBg="var(--primary-light)" iconColor="var(--primary)"
            label="Documents Uploaded" value={totalDocs}
            sub={`Out of ${institutes.length * DOC_KEYS.length} total slots`}
          />
        </div>
      </div>

      {/* Per-firm document list */}
      {institutes.length > 0 && (
        <div>
          <SectionHead>Document Status by Firm</SectionHead>
          <div style={{
            background: 'var(--surface)', borderRadius: 20,
            boxShadow: '0 1px 3px rgba(18,38,63,.07)',
            overflow: 'hidden',
          }}>
            {sorted.map(({ inst, uploaded, missing, total, missingLabels }, idx) => (
              <div
                key={inst.id}
                onClick={() => onNavigate(inst)}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 120px 180px', alignItems: 'center',
                  gap: 16, padding: '14px 20px',
                  borderBottom: idx < sorted.length - 1 ? '1px solid var(--border)' : 'none',
                  cursor: 'pointer', transition: 'background .15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    {missing === 0
                      ? <span className="material-icons-round" style={{ fontSize: 15, color: 'var(--teal)' }}>check_circle</span>
                      : <span className="material-icons-round" style={{ fontSize: 15, color: 'var(--warning)' }}>pending</span>
                    }
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                      {inst.acronym ? `[${inst.acronym}] ` : ''}{inst.name}
                    </span>
                  </div>
                  {missing > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--text3)', paddingLeft: 23, lineHeight: 1.5 }}>
                      Missing: {missingLabels.slice(0, 4).join(', ')}{missingLabels.length > 4 ? ` +${missingLabels.length - 4} more` : ''}
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                  {costByFirm[inst.id]
                    ? <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--teal)' }}>{fmtNPR(costByFirm[inst.id])}</span>
                    : <span style={{ fontSize: 11, color: 'var(--text3)' }}>—</span>
                  }
                  {currentFY && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>FY {currentFY}</div>}
                </div>
                <DocBar uploaded={uploaded} total={total} />
              </div>
            ))}
          </div>
        </div>
      )}

      {institutes.length === 0 && (
        <div style={{
          background: 'var(--surface)', borderRadius: 20, padding: '48px 24px',
          boxShadow: '0 1px 3px rgba(18,38,63,.07)',
          textAlign: 'center', color: 'var(--text3)',
        }}>
          <span className="material-icons-round" style={{ fontSize: 48, marginBottom: 12, display: 'block' }}>domain_add</span>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>No firms yet</div>
          <div style={{ fontSize: 13 }}>Add your first firm using the "Add Institute" button above.</div>
        </div>
      )}

    </div>
  );
}

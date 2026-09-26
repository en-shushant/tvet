/**
 * Compliance & Analytics — one page for the questions that used to be spread
 * over four sidebar entries:
 *
 *   Renewals       which firms are overdue or due soon (registration, tax, NSTB,
 *                  affiliation)
 *   Data quality   what is missing and would leave a gap in a generated report
 *   Summary        how one institute has done, by year, trade and client
 *   Comparison     how institutes compare side by side
 *   Project match  which firms, alone or as a JV, meet a project's criteria
 *                  (was "Project Compliance")
 *
 * The tab *is* the route, as Analytics already did for Summary and Comparison:
 * every tab keeps its existing screen id and hash, so bookmarks, the command
 * palette and the back button keep working. Role rules are unchanged — the
 * analytics tabs are not shown to editors, exactly as their pages were not.
 */
import { PageHeader } from './ui/primitives.jsx';
import ComplianceCentre from './ComplianceCentre.jsx';
import DataQuality from './DataQuality.jsx';
import SummaryView from './SummaryView.jsx';
import ComparisonView from './ComparisonView.jsx';
import ProjectCompliance from './ProjectCompliance.jsx';

export const HUB_TABS = [
  { id: 'renewals', icon: 'event_repeat',   label: 'Renewals',      analytics: false,
    sub: 'Registration renewals, tax clearance, NSTB and affiliation, firm by firm.' },
  { id: 'quality', icon: 'rule',    label: 'Data quality',  analytics: false,
    sub: 'Records that are missing something a report or bid would need.' },
  { id: 'summary', icon: 'insights',    label: 'Summary',       analytics: true,
    sub: 'Select an institute and filters to see how it has performed.' },
  { id: 'comparison', icon: 'compare_arrows', label: 'Comparison',    analytics: true,
    sub: 'Compare institutes side by side.' },
  { id: 'compliance', icon: 'fact_check', label: 'Project match', analytics: true,
    sub: 'Find the firms, alone or as a JV, that meet a project’s criteria.' },
];
export const HUB_IDS = HUB_TABS.map(t => t.id);

export default function InsightsHub({
  tab = 'renewals', onTab, institutes = [], checkInstitutes = institutes, clients = [],
  showAnalytics = true, onOpenInstitute, onOpenInstituteAt,
}) {
  const tabs = HUB_TABS.filter(t => showAnalytics || !t.analytics);
  const current = tabs.find(t => t.id === tab) || tabs[0];

  return (
    <>
      <PageHeader title="Compliance & Analytics" sub={current.sub}/>
      {/* Underlined, so the page's sections read above each tab's own filter pills. */}
      <div role="tablist" aria-label="Compliance and analytics views" className="hub-tabs">
        {tabs.map(t => (
          <button key={t.id} type="button" role="tab" aria-selected={t.id === current.id}
            className={`hub-tab${t.id === current.id ? ' is-active' : ''}`} onClick={() => onTab?.(t.id)}>
            <span className="material-icons-round" aria-hidden="true">{t.icon}</span>{t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-label={current.label}>
        {current.id === 'renewals' && (
          <ComplianceCentre embedded institutes={checkInstitutes} onOpenInstitute={onOpenInstitute}/>
        )}
        {current.id === 'quality' && (
          <DataQuality embedded institutes={checkInstitutes} onOpenInstitute={onOpenInstituteAt || onOpenInstitute}/>
        )}
        {current.id === 'summary' && <SummaryView institutes={institutes} clients={clients}/>}
        {current.id === 'comparison' && <ComparisonView institutes={institutes} clients={clients}/>}
        {current.id === 'compliance' && <ProjectCompliance institutes={institutes} clients={clients}/>}
      </div>
    </>
  );
}

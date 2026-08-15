/**
 * Analytics — Summary and Comparison under one roof.
 *
 * They were two top-level nav items answering adjacent questions ("how did this
 * institute do?" and "how do these institutes compare?"), so you had to know
 * which screen held which before you could look. One entry point now, with the
 * choice made after arriving rather than before.
 *
 * The tab *is* the route: both screens keep their existing ids and hashes, so
 * bookmarks, the command palette and the browser's back button keep working and
 * no aliasing was needed. This component only decides which of the two to show.
 */
import { PillTabs } from './ui/primitives.jsx';
import SummaryView from './SummaryView.jsx';
import ComparisonView from './ComparisonView.jsx';

const TABS = [
  { id: 'summary', label: 'Summary' },
  { id: 'comparison', label: 'Comparison' },
];

export default function AnalyticsView({ tab, onTab, institutes, clients }) {
  return (
    <>
      <PillTabs tabs={TABS} value={tab} onChange={onTab} ariaLabel="Analytics views" />
      {tab === 'comparison'
        ? <ComparisonView institutes={institutes} clients={clients} />
        : <SummaryView institutes={institutes} clients={clients} />}
    </>
  );
}

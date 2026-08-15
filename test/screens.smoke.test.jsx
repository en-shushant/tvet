/**
 * Smoke test: every screen must mount without throwing.
 *
 * This exists because `npm run build` cannot see the faults this codebase
 * actually produces. Recent examples, all of which compiled cleanly and all of
 * which this test catches:
 *
 *   - a useMemo reading `filtered` above its declaration, which crashed the
 *     whole Institutes list at runtime
 *   - a SELECT naming a column that does not exist, 500ing an endpoint
 *   - a component referencing ALL_DISTRICTS, which is defined nowhere
 *   - props passed under the wrong name (`label` for `children`, `height`
 *     for `h`), which silently render nothing
 *
 * It is deliberately shallow. It asserts that a screen renders with realistic
 * data and produces no console.error — not that it renders the right thing.
 * Depth belongs in per-screen tests; this is the net that catches the class of
 * bug that keeps reaching production.
 */
import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { assertNoConsoleErrors } from './setup.js';
import { institutes, clients, occupations, installFetchStub } from './fixtures.js';

import { OCCUPATIONS, PROVINCES } from '../src/constants/data.js';

import Dashboard from '../src/components/Dashboard.jsx';
import InstituteList from '../src/components/InstituteList.jsx';
import InstituteDetail from '../src/components/InstituteDetail.jsx';
import ExperienceForm from '../src/components/ExperienceForm.jsx';
import SummaryView from '../src/components/SummaryView.jsx';
import ComparisonView from '../src/components/ComparisonView.jsx';
import AnalyticsView from '../src/components/AnalyticsView.jsx';
import ComplianceCentre from '../src/components/ComplianceCentre.jsx';
import DocumentsCentre from '../src/components/DocumentsCentre.jsx';
import DataQuality from '../src/components/DataQuality.jsx';
import ClientsView from '../src/components/ClientsView.jsx';
import ProjectCompliance from '../src/components/ProjectCompliance.jsx';
import MasterData from '../src/components/MasterData.jsx';
import QuotationsView from '../src/components/QuotationsView.jsx';
import ReportsView from '../src/components/ReportsView.jsx';
import CommandPalette from '../src/components/CommandPalette.jsx';
import StyleGuide from '../src/components/StyleGuide.jsx';
import Shortlisting from '../src/components/Shortlisting.jsx';
import BolpatraGapsModal from '../src/components/institute/BolpatraGapsModal.jsx';
import { ContractsPanel } from '../src/components/shortlisting/ContractsPanel.jsx';
import { NepaliDatePicker, ConfirmModal } from '../src/components/shortlisting/common.jsx';
import { ShortlistRow, GroupHeader, TableHead, printShortlistReport } from '../src/components/shortlisting/table.jsx';
import { StandingListModal, AssignFirmsModal, ViewDocumentsModal, BillModal, LetterOptsModal } from '../src/components/shortlisting/modals.jsx';

const noop = () => {};
const token = 'test-token';

let container;
let root;

beforeEach(() => {
  installFetchStub();
  // Module-level registries the app fills at login; screens read them directly.
  OCCUPATIONS.splice(0, OCCUPATIONS.length, ...occupations);
  PROVINCES.splice(0, PROVINCES.length, {
    id: 1, name: 'Bagmati',
    districts: [{ id: 1, name: 'Kathmandu', local_levels: [{ name: 'Kathmandu Metropolitan City', type: 'Metropolitan' }] }],
  });
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  container.remove();
});

/** Mounts, flushes effects (including the fetches screens fire on mount). */
async function mount(element) {
  await act(async () => {
    root = createRoot(container);
    root.render(element);
  });
  // A second tick lets promise-based effects resolve and re-render.
  await act(async () => { await Promise.resolve(); });
}

/**
 * Every screen, with the props App.jsx actually passes it. Where a prop is a
 * callback the app supplies, a noop stands in — the point is the render path.
 */
const SCREENS = {
  'Dashboard':          <Dashboard institutes={institutes} isEditor={false} onNavigate={noop} />,
  'Institutes list':    <InstituteList institutes={institutes} onSelect={noop} onAdd={noop} />,
  'Institute detail':   <InstituteDetail institute={institutes[0]} clients={clients} onUpdateClients={noop}
                          onBack={noop} onUpdate={noop} onRefresh={noop} onDelete={noop} token={token}
                          isAdmin isEditor={false} isSuperAdmin={false} isShortlistOnly={false}
                          onBulkAdd={noop} onAddNSTB={noop} />,
  'Assignment editor':  <ExperienceForm exp={institutes[0].experience[0]} clients={clients}
                          institute={institutes[0]} onSave={noop} onClose={noop} onDuplicate={noop}
                          onSaveClient={noop} />,
  'Summary':            <SummaryView institutes={institutes} clients={clients} />,
  'Comparison':         <ComparisonView institutes={institutes} clients={clients} />,
  'Analytics':          <AnalyticsView tab="summary" onTab={noop} institutes={institutes} clients={clients} />,
  'Renewals & Compliance': <ComplianceCentre institutes={institutes} onOpenInstitute={noop} />,
  'Documents':          <DocumentsCentre institutes={institutes} token={token} onOpenInstitute={noop} />,
  'Data Quality':       <DataQuality institutes={institutes} onOpenInstitute={noop} />,
  'Clients':            <ClientsView clients={clients} token={token} onGoToMasterData={noop} />,
  'Project Compliance': <ProjectCompliance institutes={institutes} clients={clients} />,
  'Master data':        <MasterData clients={clients} onUpdateClients={noop} token={token}
                          isAdmin isEditor={false} isSuperAdmin={false} />,
  'Quotations':         <QuotationsView institutes={institutes} clients={clients} isAdmin
                          isEditor={false} isShortlistOnly={false} />,
  'Reports':            <ReportsView institutes={institutes} clients={clients} />,
  'Command palette':    <CommandPalette open onClose={noop} institutes={institutes} clients={clients} actions={[]} />,
  'Style guide':        <StyleGuide />,
  // Lazy-loaded behind Suspense in App.jsx, which is why it was missing here.
  'Shortlisting':       <Shortlisting institutes={institutes} clients={clients} isAdmin
                          isEditor={false} isShortlistOnly={false} isSuperAdmin token={token} />,
  // Extracted out of Shortlisting.jsx, and only rendered there once a group is
  // expanded — mounted directly so the split is actually covered.
  'Contracts panel':    <ContractsPanel clientId={1} clientNameManual="" groupRows={[]}
                          canEdit isAdmin token={token} />,
  // Opened from a flagged assignment row, so the parent screen never renders it.
  'Bolpatra gaps':      <BolpatraGapsModal exp={institutes[1].experience[0]}
                          institute={institutes[1]} clients={clients} onSave={noop} onClose={noop} />,
  'Nepali date picker': <NepaliDatePicker label="Date" value="" onChange={noop} />,
  'Confirm dialog':     <ConfirmModal message="Delete this?" onConfirm={noop} onClose={noop} saving={false} />,
};

describe('every screen mounts', () => {
  for (const [name, element] of Object.entries(SCREENS)) {
    it(`${name} renders without error`, async () => {
      await mount(element);
      // Something must actually be on the page. A screen that swallows its own
      // failure and renders nothing would otherwise pass. Measured on body, not
      // the container: modals and the palette render through createPortal.
      expect(document.body.textContent.trim().length, `${name} rendered nothing`).toBeGreaterThan(0);
      assertNoConsoleErrors();
    });
  }
});

describe('screens survive empty data', () => {
  // The registry is empty on a fresh install, and several screens index into
  // the first element of something.
  const EMPTY = {
    'Dashboard':          <Dashboard institutes={[]} isEditor={false} onNavigate={noop} />,
    'Institutes list':    <InstituteList institutes={[]} onSelect={noop} onAdd={noop} />,
    'Renewals & Compliance': <ComplianceCentre institutes={[]} onOpenInstitute={noop} />,
    'Documents':          <DocumentsCentre institutes={[]} token={token} onOpenInstitute={noop} />,
    'Data Quality':       <DataQuality institutes={[]} onOpenInstitute={noop} />,
    'Clients':            <ClientsView clients={[]} token={token} onGoToMasterData={noop} />,
    'Summary':            <SummaryView institutes={[]} clients={[]} />,
    'Comparison':         <ComparisonView institutes={[]} clients={[]} />,
    'Reports':            <ReportsView institutes={[]} clients={[]} />,
    'Shortlisting':       <Shortlisting institutes={[]} clients={[]} isAdmin
                            isEditor={false} isShortlistOnly={false} isSuperAdmin token={token} />,
  };
  for (const [name, element] of Object.entries(EMPTY)) {
    it(`${name} renders with no records`, async () => {
      await mount(element);
      assertNoConsoleErrors();
    });
  }
});

/**
 * Tabs, steps and disclosures.
 *
 * The blocks above only render each screen's default state. That is a real
 * limit: the ALL_DISTRICTS fault lived in DistrictSearch, which sits behind the
 * occupation row's collapsed locations panel, so a mount-only test walked
 * straight past it. Anything reachable in one click is worth opening.
 */
async function clickAll(selector) {
  // Re-queried each iteration because clicking re-renders the list.
  const count = document.querySelectorAll(selector).length;
  for (let i = 0; i < count; i++) {
    const el = document.querySelectorAll(selector)[i];
    if (!el) continue;
    await act(async () => { el.click(); });
    await act(async () => { await Promise.resolve(); });
  }
}

describe('interactive surfaces open without error', () => {
  it('assignment editor: every step renders', async () => {
    await mount(SCREENS['Assignment editor']);
    await clickAll('.step-pill');
    assertNoConsoleErrors();
  });

  it('assignment editor: occupation locations panel opens', async () => {
    await mount(SCREENS['Assignment editor']);
    // Step 2 holds the occupation table.
    await act(async () => { document.querySelectorAll('.step-pill')[1]?.click(); });
    await act(async () => { await Promise.resolve(); });
    // Opening this mounts DistrictSearch and the local-level search with it.
    await clickAll('.occ-loc-btn');
    expect(document.body.textContent).toContain('LOCATIONS');

    // Focus each search input so its dropdown actually renders. The panel alone
    // is not enough: DistrictSearch only evaluates its selected-value
    // expression inside the open dropdown, which is exactly why the
    // ALL_DISTRICTS fault survived a mount-only test.
    const inputs = [...document.querySelectorAll('input[placeholder*="district" i], input[placeholder*="local level" i]')];
    expect(inputs.length, 'expected the district search to be mounted').toBeGreaterThan(0);
    for (const input of inputs) {
      await act(async () => { input.focus(); input.dispatchEvent(new FocusEvent('focusin', { bubbles: true })); });
      await act(async () => { await Promise.resolve(); });
    }
    assertNoConsoleErrors();
  });

  it('institute detail: every tab renders', async () => {
    await mount(SCREENS['Institute detail']);
    await clickAll('.pill-tab, [role="tab"]');
    assertNoConsoleErrors();
  });

  it('master data: every section renders', async () => {
    // Six sections behind tabs, including two that are superadmin-only. The
    // mount-only test above sees just the first.
    await mount(<MasterData clients={clients} onUpdateClients={noop} token={token}
      isAdmin isEditor={false} isSuperAdmin onGoToClients={noop} />);
    const tabs = document.querySelectorAll('[role="tab"]');
    expect(tabs.length, 'expected the master data tabs').toBeGreaterThanOrEqual(6);
    await clickAll('[role="tab"]');
    assertNoConsoleErrors();
  });

  it('compliance and documents filters switch', async () => {
    await mount(SCREENS['Renewals & Compliance']);
    await clickAll('[role="tab"]');
    assertNoConsoleErrors();
  });
});

/**
 * The modules split out of Shortlisting.jsx.
 *
 * Mounted directly rather than through the parent screen. The modals only open
 * on a click deep in the results table and the row only renders once data has
 * loaded, so the shallow mount above touches almost none of this — which is how
 * an extraction that references a name left behind in the parent ships quietly.
 * Two such faults were caught this way on the previous split.
 */
describe('extracted shortlisting modules mount', () => {
  const row = {
    id: 1, institute_id: 1, institute_name: 'CEMECA Human Resource Academy Private Limited',
    institute_acronym: 'CEMECA', client_name: 'Nepal Electricity Authority',
    client_name_manual: null, client_short: 'NEA', standing_list_name: 'NEA SSEMD 2081/82',
    fy: '2081/82', status: 'Active', contract_amount: '2500000', shortlist_doc: null,
  };

  const CASES = {
    // Despite the names, these render divs and buttons — the results "table" is
    // a flex layout, so wrapping them in <table> is what produces a DOM-nesting
    // warning, not the components.
    'ShortlistRow':        <ShortlistRow row={row} idx={0} canEdit isAdmin
                             isSuperAdmin onEdit={noop} onDelete={noop} onBillSave={noop}
                             saving={false} token={token} />,
    'GroupHeader':         <GroupHeader label="NEA" sub="2081/82" count={3}
                             expanded onToggle={noop} isCurrent />,
    'TableHead':           <TableHead groupBy="org" />,
    'StandingListModal':   <StandingListModal list={null} onSave={noop} onClose={noop} saving={false} />,
    'AssignFirmsModal':    <AssignFirmsModal list={{ id: 1, name: 'NEA SSEMD' }} institutes={institutes}
                             assignedIds={[]} onSave={noop} onClose={noop} saving={false} />,
    'ViewDocumentsModal':  <ViewDocumentsModal instituteId={1} token={token} onClose={noop} />,
    'BillModal':           <BillModal row={row} token={token} onSave={noop} onClose={noop} saving={false} />,
    'LetterOptsModal':     <LetterOptsModal row={row} token={token} onClose={noop} onOpenBuilder={noop} />,
  };

  for (const [name, element] of Object.entries(CASES)) {
    it(`${name} renders`, async () => {
      await mount(element);
      expect(document.body.textContent.trim().length, `${name} rendered nothing`).toBeGreaterThan(0);
      assertNoConsoleErrors();
    });
  }

  it('printShortlistReport writes a report containing the rows', () => {
    // It opens a window and writes into it rather than returning a string, so
    // the window is stubbed and the written HTML captured. jsdom has no real
    // window.open, which is why calling this straight logs "Not implemented".
    let written = '';
    const realOpen = window.open;
    window.open = () => ({
      document: { write: (html) => { written += html; }, close: () => {} },
    });
    try {
      // groupBy is 'fy' | 'org' | 'firm'. 'org' groups by client and lists the
      // firms under it, so the institute name is what appears in the rows.
      printShortlistReport([row], 'org', {});
    } finally {
      window.open = realOpen;
    }
    expect(written).toContain('CEMECA');
    expect(written).toContain('Nepal Electricity Authority');
    assertNoConsoleErrors();
  });
});

/**
 * The EOI gap panel must not hide a field the moment it is filled.
 *
 * It used to recompute its visible list on every keystroke, so typing into the
 * last remaining gap replaced the whole form with "nothing outstanding" — the
 * value just typed disappeared, the panel claimed the assignment was complete
 * when nothing had been written, and closing from there discarded the work
 * without a word.
 */
describe('EOI gap panel keeps unsaved work visible', () => {
  const institute = { id: 9, name: 'Test Firm',
    descTemplateId: 'V13', narrativeTemplateId: 'N13', servicesTemplateId: 'S13' };
  // Complete except one field.
  const oneGap = () => ({
    id: 1, fy: '2081/82', assignmentName: 'One Gap', clientId: 1,
    contractValue: '100', startDate: '2082/01/15', endDate: '2082/04/10',
    durationMonths: '3', totalPersonMonths: '', isJV: false,
    occupations: [{ id: 'a', ctevtOccupationId: 1, trainees: '20', locations: [{ id: 'l', district: 'Kaski' }] }],
  });

  const typeInto = async (input, value) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    await act(async () => {
      setter.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };

  it('a filled gap stays on screen with its value', async () => {
    await mount(<BolpatraGapsModal exp={oneGap()} institute={institute}
      clients={clients} onSave={noop} onClose={noop} />);

    const input = document.querySelector('.gap-field input');
    expect(input, 'expected the missing field to be rendered').toBeTruthy();
    await typeInto(input, '12');

    const after = document.querySelector('.gap-field input');
    expect(after, 'the field vanished after being filled').toBeTruthy();
    expect(after.value).toBe('12');
    // And the panel must not claim a saved state.
    expect(document.body.textContent).toContain('Save to apply');
    expect(document.body.textContent).not.toContain('prints in full, nothing missing');
    assertNoConsoleErrors();
  });

  it('says nothing is outstanding only when it opened that way', async () => {
    const complete = { ...oneGap(), totalPersonMonths: '12' };
    await mount(<BolpatraGapsModal exp={complete} institute={institute}
      clients={clients} onSave={noop} onClose={noop} />);
    expect(document.body.textContent).toContain('prints in full, nothing missing');
    assertNoConsoleErrors();
  });
});

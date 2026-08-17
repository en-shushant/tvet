/**
 * The Assignments tab's "missing level/duration" filter.
 *
 * It used to be one toggle covering both fields at once, so finding
 * assignments that specifically need a level picked (as opposed to an hours
 * figure) meant scanning past every duration-only gap too. Split into a
 * select with level, duration and either as separate options.
 */
import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { assertNoConsoleErrors } from './setup.js';
import { clients } from './fixtures.js';
import InstituteDetail from '../src/components/InstituteDetail.jsx';

const occ = (over = {}) => ({
  id: 'o1', nameInLetter: 'Beautician', ctevtOccupationId: 1, level: 'Level 1',
  duration: '390', trainees: '40', locations: [{ id: 'l1', district: 'Kathmandu' }],
  ...over,
});

const assignment = (id, over = {}) => ({
  id, fy: '2081/82', assignmentName: `Assignment ${id}`, clientId: 1,
  contractValue: '100', startDate: '2082/01/15', endDate: '2082/04/10',
  occupations: [occ()], locations: [],
  ...over,
});

const institute = {
  id: 1, name: 'Test Firm', acronym: 'TF', regNo: '1', type: 'Private', status: 'Active',
  address: '', contactPerson: '', phone: '', mobile: '', email: '', renewalDue: '',
  remarks: '', logo: null, website: '', latitude: '', longitude: '',
  nstb: [], taxClearance: [], affiliation: [], infrastructure: [],
  totalTrainees: 0, totalStAppeared: 0, totalClients: 0, totalAffPrograms: 0,
  isShortlistingOnly: false,
  experience: [
    assignment(1), // complete
    assignment(2, { occupations: [occ({ level: '' })] }),                // missing level only
    assignment(3, { occupations: [occ({ duration: '' })] }),             // missing duration only
    assignment(4, { occupations: [occ({ level: '', duration: '' })] }),  // missing both
  ],
};

let container, root;

beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); });
afterEach(async () => { await act(async () => { root?.unmount(); }); container.remove(); });

async function mount() {
  await act(async () => {
    root = createRoot(container);
    root.render(
      <InstituteDetail institute={institute} clients={clients} onUpdateClients={() => {}}
        onBack={() => {}} onUpdate={() => {}} onRefresh={() => {}} onDelete={() => {}} token="t"
        isAdmin isEditor={false} isSuperAdmin={false} isShortlistOnly={false}
        onBulkAdd={() => {}} onAddNSTB={() => {}} jumpToTab="experience" />
    );
  });
  await act(async () => { await Promise.resolve(); });
}

function selectFilter(value) {
  const select = [...document.querySelectorAll('select')]
    .find(s => [...s.options].some(o => o.value === 'either'));
  expect(select, 'missing level/duration filter not found').toBeTruthy();
  const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
  return act(async () => {
    setter.call(select, value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

const visibleAssignments = () =>
  [1, 2, 3, 4].filter(id => container.textContent.includes(`Assignment ${id}`));

describe('Assignments tab — missing level/duration filter', () => {
  it('shows every assignment with no filter applied', async () => {
    await mount();
    expect(visibleAssignments()).toEqual([1, 2, 3, 4]);
    assertNoConsoleErrors();
  });

  it('"Missing level" shows only assignments actually missing a level', async () => {
    await mount();
    await selectFilter('level');
    expect(visibleAssignments()).toEqual([2, 4]);
  });

  it('"Missing duration" shows only assignments actually missing duration', async () => {
    await mount();
    await selectFilter('duration');
    expect(visibleAssignments()).toEqual([3, 4]);
  });

  it('"Missing level or duration" is the union of both', async () => {
    await mount();
    await selectFilter('either');
    expect(visibleAssignments()).toEqual([2, 3, 4]);
  });

  it('level and duration are independent — the level filter excludes a duration-only gap', async () => {
    await mount();
    await selectFilter('level');
    expect(visibleAssignments()).not.toContain(3);
  });

  it('clearing the filter restores every assignment', async () => {
    await mount();
    await selectFilter('level');
    expect(visibleAssignments()).toEqual([2, 4]);
    await selectFilter('');
    expect(visibleAssignments()).toEqual([1, 2, 3, 4]);
    assertNoConsoleErrors();
  });
});

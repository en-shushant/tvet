/**
 * The training summary at the top of the EOI-gaps modal.
 *
 * Every field the modal asks about belongs to one assignment, but nothing on
 * screen said which one, or which occupation a district chip was being added
 * to, until this summary was added. It has to track live edits — client and
 * districts are themselves editable a few lines below it — or it would show
 * the assignment's state from before the fix, which is worse than no summary.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import BolpatraGapsModal from '../src/components/institute/BolpatraGapsModal.jsx';

const exp = {
  id: 42, fy: '2081/82', assignmentName: 'Skills for Employment',
  clientId: 1, contractValue: '2500000', trainingType: 'Short Term', isJV: false,
  startDate: '2082/01/15', endDate: '2082/04/10',
  durationMonths: '3', totalPersonMonths: '12',
  descriptionOfWork: 'x', narrativeDescription: 'x', actualServicesDescription: 'x',
  occupations: [
    { id: 'o1', ctevtOccupationId: null, nameInLetter: 'Barista', level: 'N/A',
      trainees: '20', duration: '160', locations: [{ district: 'Kathmandu' }] },
  ],
};

const clients = [{ id: 1, fullName: 'Tokha Municipality, Office of the Municipal Executive', shortName: 'TMC' }];
const institute = { id: 5, name: 'Test Institute' };

let container, root;

beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); });
afterEach(async () => { await act(async () => { root?.unmount(); }); container.remove(); });

async function mount(over = {}) {
  await act(async () => {
    root = createRoot(container);
    root.render(
      <BolpatraGapsModal exp={{ ...exp, ...over }} institute={institute} clients={clients}
        onSave={() => {}} onClose={() => {}} />
    );
  });
  await act(async () => { await Promise.resolve(); });
}

describe('BolpatraGapsModal training summary', () => {
  it('shows the FY, type, value and client', async () => {
    await mount();
    const text = document.body.textContent;
    expect(text).toContain('FY 2081/82');
    expect(text).toContain('Short Term');
    expect(text).toContain('NPR 2,500,000');
    expect(text).toContain('TMC');
  });

  it('shows each occupation with its trainees and duration', async () => {
    await mount();
    const summary = document.querySelector('.gap-summary');
    expect(summary.textContent).toContain('Barista');
    expect(summary.textContent).toContain('20 trainees');
    expect(summary.textContent).toContain('160h');
  });

  it('shows the districts already on the assignment', async () => {
    await mount();
    expect(document.querySelector('.gap-summary').textContent).toContain('Kathmandu');
  });

  it('is read-only — no inputs inside the summary block', async () => {
    await mount();
    const summary = document.querySelector('.gap-summary');
    expect(summary.querySelectorAll('input, textarea, select, button').length).toBe(0);
  });

  it('falls back to the institute name when there is no client on record', async () => {
    await mount({ clientId: null, clientName: '' });
    expect(document.querySelector('.gap-summary').textContent).toContain('Test Institute');
  });

  it('omits the district row entirely when nothing is set yet', async () => {
    await mount({ occupations: [{ id: 'o1', trainees: '20', duration: '160', locations: [] }] });
    expect(document.querySelector('.gap-summary-districts')).toBeNull();
  });
});

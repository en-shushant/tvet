/**
 * The column picker is drawn as the table it configures.
 *
 * It was a vertical checklist plus a sentence explaining the layout, which left
 * the reader to imagine the result. The columns are the thing being chosen, so
 * they are shown as columns, with a sample row underneath.
 *
 * The behaviour that matters: clicking a heading toggles that column, and the
 * two the report cannot render without stay fixed however they are clicked.
 */
import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { assertNoConsoleErrors } from './setup.js';
import { institutes, clients, installFetchStub } from './fixtures.js';
import ReportsView from '../src/components/ReportsView.jsx';

let container, root;
beforeEach(() => { installFetchStub(); container = document.createElement('div'); document.body.appendChild(container); });
afterEach(async () => { await act(async () => { root?.unmount(); }); container.remove(); });

const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };
const setSel = (s, v) => { const f = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set; f.call(s, v); s.dispatchEvent(new Event('change', { bubbles: true })); };
const tab = l => [...container.querySelectorAll('[role=tab]')].find(b => b.textContent.trim().startsWith(l));
const click = async el => { await act(async () => { el.click(); }); await flush(); };
const heads = () => [...container.querySelectorAll('th')];
const head = label => heads().find(h => h.textContent.includes(label));

async function openToolTable() {
  await act(async () => {
    root = createRoot(container);
    root.render(<ReportsView institutes={institutes} clients={clients}/>);
  });
  await flush(); await flush();
  await act(async () => { setSel([...container.querySelectorAll('select')][0], 'bolpatra'); }); await flush();
  await act(async () => { setSel([...container.querySelectorAll('select')][1], '4b'); }); await flush();
  await click(tab('Tool Table'));
}

describe('column picker renders as a table', () => {
  it('shows every column as a heading with a sample row', async () => {
    await openToolTable();
    for (const label of ['S. No', 'Description', 'Detail', 'Unit', 'Quantity', 'Ownership', 'Type', 'Specification/Remarks']) {
      expect(head(label), `${label} heading`).toBeTruthy();
    }
    // a sample row makes it read as a table rather than a header strip
    expect(container.textContent).toContain('Drill machine');
    assertNoConsoleErrors();
  });

  it('clicking a heading drops that column, clicking again restores it', async () => {
    await openToolTable();
    const before = container.textContent.includes('Piece');
    expect(before).toBe(true);

    await click(head('Unit'));                      // Unit is on by default
    const unitCell = heads().indexOf(head('Unit'));
    expect(unitCell).toBeGreaterThan(-1);           // heading stays, styled off
    const offRow = [...container.querySelectorAll('td')][unitCell];
    expect(offRow.style.textDecoration).toBe('line-through');

    await click(head('Unit'));
    const onRow = [...container.querySelectorAll('td')][unitCell];
    expect(onRow.style.textDecoration).toBe('none');
    assertNoConsoleErrors();
  });

  it('the two columns the report needs cannot be switched off', async () => {
    await openToolTable();
    const snIdx = heads().indexOf(head('S. No'));
    const nameIdx = heads().indexOf(head('Description'));
    await click(head('S. No'));
    await click(head('Description'));
    const cells = [...container.querySelectorAll('td')];
    expect(cells[snIdx].style.textDecoration).toBe('none');
    expect(cells[nameIdx].style.textDecoration).toBe('none');
  });
});

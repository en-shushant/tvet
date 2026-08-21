/**
 * Bulk tool entry saves every filled row.
 *
 * Written while chasing a report that the first of four items was not being
 * saved. It pins the bulk path end to end — four filled rows produce four
 * POSTs, in order, first one included — so that path is ruled out for good.
 *
 * Not covered here: the single Add/Edit modal. Its fields are Material custom
 * elements that the test stub renders as inert hosts, so driving them would
 * assert against the stub rather than the app.
 */
import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { clients, occupations } from './fixtures.js';
import { OCCUPATIONS } from '../src/constants/data.js';
import MasterData from '../src/components/MasterData.jsx';

let container, root, posts;
beforeEach(() => {
  posts = [];
  OCCUPATIONS.splice(0, OCCUPATIONS.length, ...occupations);
  globalThis.fetch = (url, opts = {}) => {
    const u = String(url); const m = (opts.method || 'GET').toUpperCase();
    const json = b => Promise.resolve(new Response(JSON.stringify(b), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    if (u.includes('/occupation-tools/counts')) return json([{ occupation_id: occupations[0].id, level: 'Level 1', count: 2 }]);
    if (m === 'POST' && u.includes('/occupation-tools')) { const b = JSON.parse(opts.body); posts.push(b); return json({ id: 900 + posts.length, ...b }); }
    if (u.includes('/occupation-tools/')) return json([]);
    if (u.includes('/occupations')) return json(occupations);
    return json([]);
  };
  container = document.createElement('div'); document.body.appendChild(container);
});
afterEach(async () => { await act(async () => { root?.unmount(); }); container.remove(); });

const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };
const setInput = (el, v) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true }));
};
const btn = t => [...container.querySelectorAll('button,[data-md]')].find(b => b.textContent.trim().startsWith(t));

async function openToolsFor(level = '—') {
  await act(async () => {
    root = createRoot(container);
    root.render(<MasterData clients={clients} onUpdateClients={() => {}} token="t" isAdmin isEditor={false} isSuperAdmin={false}/>);
  });
  await flush(); await flush();
  const toolsTab = [...container.querySelectorAll('button')].find(b => /Tools|consumable/i.test(b.textContent));
  await act(async () => { toolsTab.click(); }); await flush(); await flush();
  const cell = [...container.querySelectorAll('td span')].find(s => s.textContent.trim() === level);
  await act(async () => { cell.click(); }); await flush(); await flush();
}

describe('MasterData bulk tool entry', () => {
  it('every filled bulk row is posted, including the first', async () => {
    await openToolsFor();
    const bulk = [...container.querySelectorAll('button,[data-md]')].find(b => /\+ Add Tools/i.test(b.textContent));
    await act(async () => { bulk.click(); }); await flush();

    const names = [...container.querySelectorAll('input[placeholder="Name"]')];
    expect(names.length).toBeGreaterThanOrEqual(4);
    for (let i = 0; i < 4; i++) await act(async () => { setInput(names[i], `Tool ${i + 1}`); });
    await flush();

    await act(async () => { btn('Save').click(); });
    await flush(); await flush(); await flush();

    expect(posts.map(p => p.name)).toEqual(['Tool 1', 'Tool 2', 'Tool 3', 'Tool 4']);
  });
});

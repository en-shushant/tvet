/**
 * 4(B) tools are fetched per occupation, each at its own level.
 *
 * occupation_tools is keyed by occupation *and* level, and a bid often proposes
 * trades at different levels. One level across the whole schedule quietly
 * pulled the wrong tool list for every occupation that did not run at it.
 *
 * The fetch key is a derived signature over (occupation, level) pairs, which is
 * exactly the kind of thing that regresses without anyone noticing — the screen
 * still renders, it just lists the wrong tools. Hence the stubbed fetch and the
 * assertions on the URLs actually requested.
 */
import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { assertNoConsoleErrors } from './setup.js';
import { institutes, clients, occupations, installFetchStub } from './fixtures.js';
import ReportsView from '../src/components/ReportsView.jsx';

let container, root, toolCalls;
beforeEach(()=>{
  installFetchStub();
  toolCalls=[];
  const base=globalThis.fetch;
  globalThis.fetch=(url,...r)=>{ const u=String(url);
    if(u.includes('/occupation-tools/')) { toolCalls.push(u.split('/occupation-tools/')[1]);
      return Promise.resolve(new Response('[]',{status:200,headers:{'Content-Type':'application/json'}})); }
    return base(url,...r); };
  container=document.createElement('div'); document.body.appendChild(container);
});
afterEach(async()=>{ await act(async()=>{root?.unmount();}); container.remove(); });
const flush=async()=>{ await act(async()=>{await Promise.resolve();await Promise.resolve();}); };
async function mount(){ await act(async()=>{root=createRoot(container);root.render(<ReportsView institutes={institutes} clients={clients}/>);}); await flush(); await flush(); }
const setSel=(s,v)=>{const f=Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value').set;f.call(s,v);s.dispatchEvent(new Event('change',{bubbles:true}));};
const tab=l=>[...container.querySelectorAll('[role=tab]')].find(b=>b.textContent.trim().startsWith(l));
const click=async el=>{await act(async()=>{el.click();}); await flush();};

async function setupTwoOccs(){
  await mount();
  await act(async()=>{ setSel([...container.querySelectorAll('select')][0],'bolpatra'); }); await flush();
  // '4b' has the tools picker and only ONE occupation list (the 4(B) one),
  // so there is no ambiguity about which selection drives the tools fetch.
  await act(async()=>{ setSel([...container.querySelectorAll('select')][1],'4b'); }); await flush();
  const firm=[...container.querySelectorAll('.multi-select-item input[type=checkbox]')];
  await act(async()=>{ firm[0].click(); }); await flush();
  await click(tab('Occupations'));
  const occ=[...container.querySelectorAll('.multi-select-item input[type=checkbox]')];
  await act(async()=>{ occ[0].click(); }); await flush();
  await act(async()=>{ occ[1].click(); }); await flush();
  await click(tab('Training Tools'));
}

describe('per-occupation level', () => {
  it('defaults every occupation to Level 1', async () => {
    await setupTwoOccs();
    const lvls=[...container.querySelectorAll('select')].filter(s=>[...s.options].some(o=>o.value==='Technician'));
    // one "default level" + one per occupation
    expect(lvls.length).toBeGreaterThanOrEqual(3);
    for (const s of lvls) expect(s.value).toBe('Level 1');
    // Each occupation is asked for its own level *and* for the level-agnostic
    // "N/A" list, which is where two occupations keep their entire schedule.
    const lv=toolCalls.map(c=>decodeURIComponent(c.split('/')[1]));
    expect(new Set(lv)).toEqual(new Set(['Level 1','N/A']));
    assertNoConsoleErrors();
  });

  it('fetches each occupation at its own level once changed', async () => {
    await setupTwoOccs();
    const lvls=[...container.querySelectorAll('select')].filter(s=>[...s.options].some(o=>o.value==='Technician'));
    const perOcc=lvls.slice(1); // first is the default-level control
    toolCalls.length=0;
    await act(async()=>{ setSel(perOcc[0],'Level 3'); }); await flush(); await flush();
    const levels=toolCalls.map(c=>decodeURIComponent(c.split('/')[1]));
    expect(levels).toContain('Level 3');
    expect(levels).toContain('Level 1');   // the other occupation is untouched
    expect(levels).toContain('N/A');       // level-agnostic tools come along too
    assertNoConsoleErrors();
  });

  it('changing the default level resets per-occupation overrides', async () => {
    await setupTwoOccs();
    let lvls=[...container.querySelectorAll('select')].filter(s=>[...s.options].some(o=>o.value==='Technician'));
    await act(async()=>{ setSel(lvls[1],'Level 3'); }); await flush();
    lvls=[...container.querySelectorAll('select')].filter(s=>[...s.options].some(o=>o.value==='Technician'));
    expect(lvls[1].value).toBe('Level 3');
    await act(async()=>{ setSel(lvls[0],'Level 2'); }); await flush();
    lvls=[...container.querySelectorAll('select')].filter(s=>[...s.options].some(o=>o.value==='Technician'));
    for (const s of lvls) expect(s.value).toBe('Level 2');
    assertNoConsoleErrors();
  });
});

/**
 * Tools filed under "N/A" belong to every level.
 *
 * "N/A" means the list is not level-specific. Two occupations in this registry
 * keep their entire schedule that way — 187 items between them — so fetching
 * only the chosen level returned nothing and produced an empty document while
 * the tools plainly existed.
 *
 * Five call sites share this helper (the 4(B) picker, the ENSSURE D2/D3 lookup
 * and three paths in the Tools report). If they disagreed, a generated document
 * would not match the screen that configured it, so the rule is pinned here.
 */
import { describe, it, beforeEach, expect, vi } from 'vitest';
import { fetchToolsFor, countToolsFor } from '../src/utils/occupationTools.js';

let seen;
beforeEach(() => {
  seen = [];
  globalThis.fetch = (url) => {
    const u = String(url);
    const level = decodeURIComponent(u.split('/occupation-tools/')[1].split('/')[1]);
    seen.push(level);
    const body = level === 'N/A'
      ? [{ id: 90, name: 'Shared kit' }, { id: 91, name: 'Safety boots' }]
      : [{ id: 1, name: 'Drill' }];
    return Promise.resolve(new Response(JSON.stringify(body), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }));
  };
});

describe('fetchToolsFor', () => {
  it('merges the chosen level with the level-agnostic list', async () => {
    const out = await fetchToolsFor(7, 'Level 1', 't');
    expect(seen.sort()).toEqual(['Level 1', 'N/A']);
    expect(out.map(t => t.id)).toEqual([1, 90, 91]);
  });

  it('asks only once when the chosen level is itself N/A', async () => {
    const out = await fetchToolsFor(7, 'N/A', 't');
    expect(seen).toEqual(['N/A']);
    expect(out.map(t => t.id)).toEqual([90, 91]);
  });

  it('does not duplicate a tool filed under both', async () => {
    globalThis.fetch = (url) => {
      const level = decodeURIComponent(String(url).split('/occupation-tools/')[1].split('/')[1]);
      return Promise.resolve(new Response(
        JSON.stringify(level === 'N/A' ? [{ id: 1, name: 'Drill' }, { id: 2, name: 'Kit' }]
                                       : [{ id: 1, name: 'Drill' }]),
        { status: 200, headers: { 'Content-Type': 'application/json' } }));
    };
    const out = await fetchToolsFor(7, 'Level 1', 't');
    expect(out.map(t => t.id)).toEqual([1, 2]);
  });

  it('survives a failing request rather than rejecting the whole schedule', async () => {
    globalThis.fetch = () => Promise.reject(new Error('offline'));
    await expect(fetchToolsFor(7, 'Level 1', 't')).resolves.toEqual([]);
  });
});

describe('countToolsFor', () => {
  const rows = [
    { occupation_id: 1, level: 'Level 1', count: 5 },
    { occupation_id: 1, level: 'N/A', count: 3 },
    { occupation_id: 2, level: 'N/A', count: 92 },
  ];
  it('counts the level plus its level-agnostic tools', () => {
    expect(countToolsFor(rows, 1, 'Level 1')).toBe(8);
  });
  it('reports an occupation whose whole list is N/A as present at any level', () => {
    // this is the case that used to read as "no tools" and produce an empty doc
    expect(countToolsFor(rows, 2, 'Level 1')).toBe(92);
  });
  it('counts N/A alone when N/A is what was asked for', () => {
    expect(countToolsFor(rows, 1, 'N/A')).toBe(3);
  });
  it('returns 0 for a level with genuinely nothing', () => {
    expect(countToolsFor(rows, 3, 'Level 2')).toBe(0);
  });
  it('returns null while the counts are still unknown', () => {
    expect(countToolsFor(null, 1, 'Level 1')).toBeNull();
  });
});

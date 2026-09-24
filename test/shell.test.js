/**
 * The app shell: navigation, breadcrumb, and the global dialogs around it.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const read = (p) => readFileSync(path.resolve(import.meta.dirname, '..', p), 'utf8');
const app = read('src/App.jsx');

describe('the global dialogs', () => {
  it('give the lazily loaded institute form its own loading boundary', () => {
    // It sits outside the page's <Suspense>. Opened before its code had loaded
    // — Add institute on the Dashboard, first thing after signing in — it
    // suspended with nothing to catch it, and React blanked the whole app.
    expect(app).toMatch(/const InstituteForm\s+= lazyChunk/);
    expect(app).toMatch(/<Suspense fallback=\{null\}>\s*<InstituteForm/);
  });
});

describe('the shell', () => {
  it('titles every screen in the breadcrumb, including the two that had none', () => {
    const titles = app.slice(app.indexOf('const pageTitles = {'), app.indexOf('};', app.indexOf('const pageTitles = {')));
    for (const id of ['tenders', 'hr', 'compliance', 'users', 'reports', 'dashboard']) {
      expect(titles, id).toMatch(new RegExp(`\\b${id}:`));
    }
  });

  it('prints a page title only for screens that do not carry their own', () => {
    // Everything else prints its own; the shell doing it too showed it twice.
    const shell = app.slice(app.indexOf('const SHELL_TITLED = {'), app.indexOf('};', app.indexOf('const SHELL_TITLED = {')));
    expect(Object.keys(Object.fromEntries([...shell.matchAll(/^\s+(\w+):/gm)].map(m => [m[1], 1]))))
      .toEqual(['summary', 'comparison', 'compliance', 'users']);
  });

  it('offers Add institute in the top bar only where the page has none', () => {
    // Institutes carries its own in its header; offering it here too showed two.
    const cond = app.slice(app.indexOf("{((screen === 'dashboard'"), app.indexOf('Add institute\n'));
    expect(cond).not.toMatch(/screen === 'institutes'/);
  });
});

describe('icons', () => {
  const nav = [...app.matchAll(/\{id:'(\w+)', icon:'(\w+)', label:'([^']+)'/g)].map(m => ({ id: m[1], icon: m[2], label: m[3] }));

  it('are not shared between two sidebar entries', () => {
    // Quotations and Tenders both showed a gavel.
    const seen = new Map();
    for (const n of nav) {
      expect(seen.get(n.icon), `${n.label} and ${seen.get(n.icon)} both use ${n.icon}`).toBeUndefined();
      seen.set(n.icon, n.label);
    }
    expect(nav.length).toBeGreaterThan(10);
  });

  it('match between the sidebar and search for the same destination', () => {
    const palette = [...app.matchAll(/label:'([^']+)', icon:'(\w+)', group:'Go to'[\s\S]*?handleNavigate\('(\w+)'\)/g)]
      .map(m => ({ label: m[1], icon: m[2], to: m[3] }));
    for (const p of palette) {
      const n = nav.find(x => x.id === p.to);
      if (n) expect(p.icon, `${p.label}`).toBe(n.icon);
    }
  });

  it('make every sidebar screen reachable from search', () => {
    // Tenders and the Trainer pool were missing, which mattered once search moved to the top.
    const targets = new Set([...app.matchAll(/handleNavigate\('(\w+)/g)].map(m => m[1]));
    for (const n of nav) expect(targets.has(n.id) || n.id === 'renewals', n.label).toBe(true);
  });
});

describe('the institute card', () => {
  it('keeps its frame, with hover in a class rather than a second inline shadow', () => {
    // An inline hover boxShadow overwrote the frame's boxShadow on every render.
    const list = read('src/components/InstituteList.jsx');
    expect(list).toMatch(/className="card hover-lift"/);
    expect(list).not.toMatch(/boxShadow: hover \?/);
  });
});

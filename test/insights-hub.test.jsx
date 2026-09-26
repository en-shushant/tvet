import { describe, it, expect } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import InsightsHub, { HUB_TABS } from '../src/components/InsightsHub.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const app = readFileSync(resolve(process.cwd(), 'src/App.jsx'), 'utf8');

async function tabsFor(props) {
  const el = document.createElement('div'); document.body.appendChild(el);
  const root = createRoot(el);
  await act(async () => { root.render(<InsightsHub onTab={() => {}} {...props}/>); });
  const labels = [...el.querySelectorAll('[aria-label="Compliance and analytics views"] [role=tab]')].map(t => t.lastChild.textContent.trim());
  const selected = el.querySelector('[aria-label="Compliance and analytics views"] [role=tab][aria-selected="true"]')?.lastChild.textContent;
  await act(async () => root.unmount()); el.remove();
  return { labels, selected };
}

describe('Compliance & Analytics', () => {
  it('keeps every old page as a tab at its old address', () => {
    expect(HUB_TABS.map(t => t.id)).toEqual(['renewals', 'quality', 'summary', 'comparison', 'compliance']);
    expect(app).toMatch(/const HUB_SCREENS = \['renewals', 'quality', 'summary', 'comparison', 'compliance'\]/);
  });

  it('is one sidebar entry instead of four', () => {
    expect(app).toMatch(/\{id:'renewals', icon:'insights', label:'Compliance & Analytics'/);
    expect(app).not.toMatch(/label:'Renewals & Compliance', group/);
    expect(app).not.toMatch(/label:'Data Quality', group/);
    expect(app).not.toMatch(/label:'Project Compliance', group/);
    expect(app).not.toMatch(/\{id:'summary', icon/);
  });

  it('shows editors only the checks, as before', async () => {
    const all = await tabsFor({ tab: 'renewals' });
    expect(all.labels).toEqual(['Renewals', 'Data quality', 'Summary', 'Comparison', 'Project match']);
    const editor = await tabsFor({ tab: 'summary', showAnalytics: false });
    expect(editor.labels).toEqual(['Renewals', 'Data quality']);
    // An analytics address falls back to the first tab they can see.
    expect(editor.selected).toMatch(/^Renewals/);
    expect(app).toMatch(/showAnalytics=\{!isEditor\}/);
  });
});

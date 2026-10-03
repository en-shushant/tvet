import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { todosFor } from '../src/components/tenders/ChecklistHome.jsx';

const read = (p) => readFileSync(p, 'utf8');

describe('tender checklist', () => {
  const pos = [{ id: 1, title: 'Main Trainer', count: 2, occupation_name: 'Tailor' }, { id: 2, title: 'M&E Officer', count: 1 }];
  it('names what is left in plain sentences', () => {
    const t = { id: 5, bidders: [{ id: 9, display_name: 'ZZA', status: 'Preparing' }], positions: pos,
      people: [{ bidder_id: 9, position_id: 1 }], occupations: [] };
    const todo = todosFor(t, []);
    expect(todo[0]).toEqual(['Add the submission deadline.', 'Add the notice’s reference number.']);
    expect(todo[3]).toEqual(['Main Trainer · Tailor — 1 more to pick', 'M&E Officer — 1 more to pick']);
    expect(todo[2]).toEqual([]);
  });
  it('asks for a title before anything else on an unsaved tender', () => {
    expect(todosFor({ bidders: [], positions: [], people: [] }, [])[0]).toEqual(['Give the tender a title and save it.']);
  });
});

describe('working as one firm, in Tenders only', () => {
  const view = read('src/components/TendersView.jsx');
  it('a person with one firm simply is that firm; others pick, with All firms', () => {
    expect(view).toMatch(/firms\.length === 1 \? String\(firms\[0\]\.id\)/);
    expect(view).toMatch(/<option value="">All firms<\/option>/);
  });
  it('a new tender starts with that firm bidding; nothing else in the app is scoped', () => {
    expect(view).toMatch(/defaultFirmId=\{firmFilter\}/);
    expect(read('src/components/tenders/TenderWorkspace.jsx')).toMatch(/role: 'Lead' \}\] \}\] \}/);
    expect(read('src/App.jsx')).not.toMatch(/firmScoped|sb-firm/);
  });
});

describe('nothing typed is lost', () => {
  const hook = read('src/components/tenders/useProgress.jsx');
  it('keeps a copy on the device, saves quietly, and warns before leaving unsaved', () => {
    expect(hook).toMatch(/localStorage\.setItem/);
    expect(hook).toMatch(/setTimeout\(sendNow, delay\)/);
    expect(hook).toMatch(/beforeunload/);
  });
  it('every editing step uses it', () => {
    for (const f of ['NoticeStep', 'RequirementsStep', 'TeamStep']) expect(read(`src/components/tenders/${f}.jsx`)).toMatch(/useProgress\(/);
  });
});

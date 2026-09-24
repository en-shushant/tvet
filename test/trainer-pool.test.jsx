/**
 * The trainer pool: who may open it, and how eligibility is expressed.
 *
 * Two things carry the weight of this module.
 *
 * The first is access. The pool holds citizenship numbers, home addresses and
 * CVs, so it is opened to named people rather than to a role tier — and the
 * server re-reads that grant on every request instead of trusting the token,
 * because a JWT here lasts thirty days and "revoked, but works until they next
 * sign in" is not a thing you can say about personal data.
 *
 * The second is the eligibility rule. A Diploma in Civil Engineering covers
 * plumber, mason, shuttering carpenter and building painter alike; a Building
 * Electrician Level 2 certificate covers Building Electrician and nothing else.
 * The first is a sector, the second is whatever trade the certificate names, and
 * conflating them is how someone ends up proposed for work they cannot teach.
 */
import { describe, it, beforeEach, afterEach, expect } from 'vitest';
import { act } from 'react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRoot } from 'react-dom/client';
import { assertNoConsoleErrors } from './setup.js';
import { installFetchStub, hrPeople, hrRules } from './fixtures.js';
import { SESSION_KEY } from '../src/utils/auth.js';
import TrainerPool from '../src/components/TrainerPool.jsx';

const read = (p) => readFileSync(path.resolve(import.meta.dirname, '..', p), 'utf8');

let container, root, requests;

function signIn(role) {
  const store = new Map([[SESSION_KEY, JSON.stringify({ role, token: 't' })]]);
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
}

beforeEach(() => {
  signIn('admin');
  installFetchStub();
  const inner = globalThis.fetch;
  requests = [];
  globalThis.fetch = (url, opts = {}) => {
    requests.push({ url: String(url), method: (opts.method || 'GET').toUpperCase() });
    return inner(url, opts);
  };
  container = document.createElement('div');
  document.body.appendChild(container);
});
afterEach(async () => {
  await act(async () => { root?.unmount(); });
  container.remove();
  delete globalThis.localStorage;
});

// The roster load is debounced through setTimeout, so awaiting microtasks
// alone never lets it run — this has to yield a macrotask too.
const flush = async () => {
  await act(async () => { await new Promise(r => setTimeout(r, 0)); });
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
};
async function mount(props = {}) {
  await act(async () => {
    root = createRoot(container);
    root.render(<TrainerPool isAdmin {...props} />);
  });
  await flush(); await flush();
}
const tab = (label) => [...container.querySelectorAll('[role=tab]')]
  .find(b => b.textContent.trim().startsWith(label));
const click = async (el) => { await act(async () => { el.click(); }); await flush(); };

describe('the roster', () => {
  it('lists trainers and support staff together', async () => {
    await mount();
    expect(container.textContent).toContain('Ramesh Adhikari');
    expect(container.textContent).toContain('Hari Bahadur');
    assertNoConsoleErrors();
  });

  it('shows what each person can train', async () => {
    await mount();
    const row = [...container.querySelectorAll('tr')].find(r => r.textContent.includes('Ramesh'));
    expect(row.textContent).toContain('Plumber');
    expect(row.textContent).toContain('Mason');
  });

  it('marks someone with no occupations rather than leaving the cell ambiguous', async () => {
    await mount();
    const row = [...container.querySelectorAll('tr')].find(r => r.textContent.includes('Hari'));
    expect(row.textContent).toMatch(/—/);
  });

  it('asks the server to filter rather than filtering in the browser', async () => {
    // The roster is the answer to "who could we put forward", and the
    // eligibility it is filtered on is derived in SQL. Re-deriving it here
    // would be a second implementation to keep in step.
    await mount();
    expect(requests.some(r => r.url.includes('/hr/people'))).toBe(true);
  });
});

describe('matching a tender', () => {
  it('is offered as a control, not buried in the search box', async () => {
    await mount();
    const btn = [...container.querySelectorAll('button, [data-md]')]
      .find(b => b.textContent.includes('Match to a tender'));
    expect(btn).toBeTruthy();
  });

  it('opens a picker of every occupation, not only ones already covered', async () => {
    // A tender can ask for a trade nobody in the pool holds yet — that answer
    // ("nobody") is exactly what you need to see.
    await mount();
    const btn = [...container.querySelectorAll('button, [data-md]')]
      .find(b => b.textContent.includes('Match to a tender'));
    await click(btn);
    expect(container.textContent).toMatch(/Pick the occupations a tender asks for/i);
    expect(container.textContent).toMatch(/One person must cover every occupation/i);
  });
});

describe('qualification rules', () => {
  it('are a tab of their own', async () => {
    await mount();
    expect(tab('Qualification rules')).toBeTruthy();
  });

  it('spell out what each one qualifies somebody to train', async () => {
    await mount();
    await click(tab('Qualification rules'));
    const rows = [...container.querySelectorAll('tr')];
    const sector = rows.find(r => r.textContent.includes('Diploma in Civil Engineering'));
    const cert = rows.find(r => r.textContent.includes('NSTB Skill Certificate'));
    // The two shapes read differently on purpose.
    expect(sector.textContent).toMatch(/Every occupation in Civil\/Construction up to Level 1/);
    expect(cert.textContent).toMatch(/The occupation named on the certificate/);
  });

  it('says a rule change reaches everyone holding it', async () => {
    await mount();
    await click(tab('Qualification rules'));
    expect(container.textContent).toMatch(/correcting a rule corrects every person at once/i);
  });

  it('hides editing from a non-admin', async () => {
    await mount({ isAdmin: false });
    await click(tab('Qualification rules'));
    const add = [...container.querySelectorAll('button, [data-md]')]
      .find(b => b.textContent.trim().startsWith('+ Add rule'));
    expect(add).toBeUndefined();
  });
});

describe('access to the pool', () => {
  const route = read('backend/routes/hr.js');
  const auth = read('backend/middleware/auth.js');
  const app = read('src/App.jsx');

  it('guards every endpoint, not individual ones', async () => {
    // A preHandler on the plugin covers routes added later too; per-route
    // guards are one forgotten line away from an open endpoint.
    expect(route).toMatch(/fastify\.addHook\('preHandler', requireHRAccess\)/);
  });

  it('re-reads the grant from the database instead of trusting the token', () => {
    const guard = auth.slice(auth.indexOf('async function requireHRAccess'),
                             auth.indexOf('function signToken'));
    expect(guard).toMatch(/SELECT can_access_hr FROM users/);
    // Reading request.user.can_access_hr would be the bug: that comes off a
    // 30-day JWT minted before the grant was revoked.
    expect(guard).not.toMatch(/request\.user\.can_access_hr/);
  });

  it('refuses a deactivated account even if the grant is still set', () => {
    const guard = auth.slice(auth.indexOf('async function requireHRAccess'),
                             auth.indexOf('function signToken'));
    expect(guard).toMatch(/is_active IS NOT FALSE/);
  });

  it('hides the nav item from anyone without the grant', () => {
    expect(app).toMatch(/hrOnly: true/);
    expect(app).toMatch(/!item\.hrOnly \|\| canAccessHr/);
  });

  it('shows a locked screen rather than a blank one if the hash is guessed', () => {
    expect(app).toMatch(/screen === 'hr' && !canAccessHr/);
  });

  it('admits a superadmin without a grant, since they issue the grants', () => {
    const guard = auth.slice(auth.indexOf('async function requireHRAccess'),
                             auth.indexOf('function signToken'));
    expect(guard).toMatch(/role === 'superadmin'/);
  });
});

describe('granting access', () => {
  const login = read('src/components/LoginPage.jsx');

  it('is a checkbox separate from the role', () => {
    expect(login).toMatch(/can_access_hr: !!user\?\.can_access_hr/);
    expect(login).toMatch(/Trainer pool access/);
  });

  it('is not silently revoked by the deactivate shortcut', () => {
    // That row action writes every column, so omitting the grant would strip
    // pool access as a side effect of toggling the account off and on again.
    const toggle = login.slice(login.indexOf('is_active: !u.is_active'));
    expect(toggle.slice(0, 260)).toMatch(/can_access_hr: !!u\.can_access_hr/);
  });
});

describe('the eligibility rule in SQL', () => {
  const route = read('backend/routes/hr.js');
  const cte = route.slice(route.indexOf('const ELIGIBILITY_CTE'), route.indexOf('/** Columns a person row'));

  it('grants a whole sector for a sector-scoped qualification', () => {
    expect(cte).toMatch(/o\.sector = r\.sector/);
    expect(cte).toMatch(/r\.grant_scope = 'sector'/);
  });

  it('grants only the trade named on a certificate', () => {
    expect(cte).toMatch(/r\.grant_scope = 'certificate_occupation' AND q\.occupation_id IS NOT NULL/);
  });

  it('still honours a trade certificate recorded before any rule existed', () => {
    // Otherwise a record entered on day one silently grants nothing.
    expect(cte).toMatch(/q\.rule_id IS NULL AND q\.occupation_id IS NOT NULL/);
  });

  it('lets a removal beat every grant, including an explicit add', () => {
    // "Do not propose this person for this trade" is the safer reading when the
    // two overrides contradict each other.
    const tail = cte.slice(cte.indexOf('eligible AS'));
    expect(tail).toMatch(/NOT EXISTS/);
    expect(tail).toMatch(/mode = 'remove'/);
  });

  it('treats an unlevelled occupation as under any cap', () => {
    // Rank 0 for a blank level, so a capped rule does not quietly hide every
    // occupation that records no level.
    expect(route).toMatch(/ELSE 0 END/);
  });

  it('is written once and shared by the list and the detail query', () => {
    expect((route.match(/WITH \$\{ELIGIBILITY_CTE\}/g) || []).length).toBeGreaterThanOrEqual(2);
  });
});

describe('entering someone', () => {
  const findBtn = (text) => [...container.querySelectorAll('button, [data-md]')]
    .find(b => b.textContent.trim().startsWith(text));

  it('opens as a page, not a dialog over the roster', async () => {
    await mount();
    await click(findBtn('+ Add person'));
    expect(container.textContent).toContain('Add to the pool');
    expect(container.querySelector('[role=dialog]')).toBeNull();
    // The roster is gone while the record is typed.
    expect(container.textContent).not.toContain('Ramesh Adhikari');
  });

  it('offers general education by default, with the school-and-university ladder', async () => {
    await mount();
    await click(findBtn('+ Add person'));
    const text = container.textContent;
    for (const l of ['+ SLC / SEE', '+ TSLC', '+ JTA', '+ Diploma / PCL', '+ Bachelor', '+ Master', '+ MPhil', '+ PhD']) {
      expect(text, l).toContain(l);
    }
    expect(text).not.toContain('+ Level 2');
  });

  it('switches to NSTB levels when the toggle says vocational', async () => {
    await mount();
    await click(findBtn('+ Add person'));
    const toggle = [...container.querySelectorAll('[aria-label="Which kind of education"] button')]
      .find(b => b.textContent.startsWith('Vocational'));
    await click(toggle);
    const text = container.textContent;
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(text).toMatch(/National Skill Testing Board/);
    for (const l of ['+ Level 1', '+ Level 2', '+ Level 3', '+ Level 4 (Professional)', '+ Technician certificate']) {
      expect(text, l).toContain(l);
    }
    expect(text).not.toContain('+ Bachelor');
  });

  it('asks a vocational row for its trade, not a degree’s course', async () => {
    await mount();
    await click(findBtn('+ Add person'));
    await click([...container.querySelectorAll('[aria-label="Which kind of education"] button')]
      .find(b => b.textContent.startsWith('Vocational')));
    await click(findBtn('+ Level 2'));
    expect(container.textContent).toContain('Trade on the certificate');
    expect(container.textContent).not.toContain('Course / faculty');
  });

  it('refuses to save without a name, and says so', async () => {
    await mount();
    await click(findBtn('+ Add person'));
    await click(findBtn('Save to the pool'));
    expect(container.textContent).toContain('A full name is required.');
    expect(requests.some(r => r.method === 'POST' && r.url.includes('/hr/people'))).toBe(false);
  });
});

describe('the pool at a glance and its filters', () => {
  const findBtn = (text) => [...container.querySelectorAll('button, [data-md]')]
    .find(b => b.textContent.trim().startsWith(text));
  const search = () => container.querySelector('input[aria-label="Search the pool"]');
  const type = async (el, v) => {
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
  };

  it('shows the KPIs above the roster', async () => {
    await mount();
    const tiles = [...container.querySelectorAll('.kp-tile .kp-label')].map(e => e.textContent);
    expect(tiles).toEqual(['Available to propose', 'Trades covered', 'TOT certified', 'NSTB certified', 'Ready to submit']);
  });

  it('loads the whole pool once, including people who have left', async () => {
    // The KPIs describe everyone; filtering then happens without another request.
    await mount();
    expect(requests.some(r => r.url.includes('/hr/people?include_inactive=1'))).toBe(true);
  });

  it('narrows as you type, by trade too, and clears', async () => {
    await mount();
    await type(search(), 'mason');
    expect(container.textContent).toContain('Ramesh Adhikari');
    expect(container.textContent).not.toContain('Hari Bahadur');
    await click(findBtn('Clear all'));
    expect(container.textContent).toContain('Hari Bahadur');
  });

  it('says so when nothing matches, and offers the way back', async () => {
    await mount();
    await type(search(), 'nobody-by-this-name');
    expect(container.textContent).toContain('Nobody matches');
    expect(findBtn('Clear all filters')).toBeTruthy();
  });

  it('keeps the detailed filters out of the way until asked for', async () => {
    await mount();
    expect(container.textContent).not.toContain('Education at least');
    // The button's text begins with its icon name, so match the label itself.
    await click([...container.querySelectorAll('button, [data-md]')].find(b => b.textContent.trim().endsWith('Filters')));
    for (const l of ['Can train', 'Education at least', 'NSTB at least', 'Years since qualifying', 'Missing', 'TOT certified']) {
      expect(container.textContent, l).toContain(l);
    }
  });
});

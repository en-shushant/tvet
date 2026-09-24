import { useState, useEffect, useMemo, useCallback } from 'react';
import Modal, { ErrorBanner } from './ui/Modal.jsx';
import Pagination from './ui/Pagination.jsx';
import { usePagination } from '../utils/hooks.js';
import { Btn, MdTextField, MdSelect, MdOption } from '../md.jsx';
import { PageHeader, PillTabs, EmptyState } from './ui/primitives.jsx';
import { confirmDialog, toast } from './ui/Feedback.jsx';
import { SECTORS, NSTB_LEVELS } from '../constants/data.js';
import { PERSON_TYPES, BLANK_PERSON, initials, normaliseQual, topGeneral, topVocational } from './pool/common.js';
import PersonEditor from './pool/PersonEditor.jsx';
import PersonProfile from './pool/PersonProfile.jsx';
import { experienceYears } from '../utils/hrFit.js';
import { BLANK_FILTERS, applyFilters, activeFilterCount, poolKpis, SORTS } from './pool/filters.js';
import { GENERAL_LEVELS, VOCATIONAL_LEVELS } from '../constants/education.js';
import { useOccupations } from '../utils/useMasterData.js';
import { api } from '../utils/api.js';
import { getSession } from '../utils/auth.js';

/**
 * The human resource pool — trainers and support staff the organisation can
 * put forward against a tender.
 *
 * One pool for the whole system rather than a roster per institute: the same
 * trainer is proposed by whichever firm is bidding, and a copy per firm would
 * let their certificates drift apart.
 *
 * Unlike the older screens this one reads the API's snake_case straight through
 * rather than going via an adapter in utils/api.js. Those adapters exist to
 * reconcile field names that diverged over time; nothing here has diverged yet,
 * and six new entities' worth of translation would be a layer earning nothing.
 */

// The kind a qualification rule is filed under. A rule is a label on a group of
// certificates, so it keeps the old four names even though a person's record
// now files NSTB certificates as vocational education.
const QUAL_KINDS = ['Academic', 'Training', 'TOT', 'Skill Test'];
const GRANT_SCOPES = [
  { id: 'sector', label: 'A whole sector',
    hint: 'A Diploma in Civil Engineering covers plumber, mason, shuttering carpenter and building painter alike.' },
  { id: 'occupations', label: 'These occupations',
    hint: 'Name the trades explicitly, for a qualification where a whole sector is too wide.' },
  { id: 'certificate_occupation', label: 'Whatever the certificate says',
    hint: 'A Building Electrician Level 2 certificate qualifies for Building Electrician and nothing else. One rule covers every trade.' },
];

/* ── Occupation multi-select ────────────────────────────────────────────── */

function OccupationPicker({ occupations, selected, onToggle, height = 240 }) {
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return occupations;
    return occupations.filter(o =>
      o.name.toLowerCase().includes(needle) || (o.sector || '').toLowerCase().includes(needle));
  }, [occupations, q]);
  return (
    <div>
      <div className="search-wrap" style={{ marginBottom: 8 }}>
        <span className="search-icon material-icons-round" style={{ fontSize: 16 }}>search</span>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search occupations or sector…" />
      </div>
      <div className="multi-select-list" style={{ maxHeight: height, overflowY: 'auto' }}>
        {shown.length === 0 && (
          <div style={{ fontSize: 12.5, color: 'var(--text3)', padding: '8px 2px' }}>No occupations match.</div>
        )}
        {shown.map(o => (
          <label key={o.id} className="multi-select-item">
            <input type="checkbox" checked={selected.includes(o.id)} onChange={() => onToggle(o.id)} />
            <span>{o.name}
              <span style={{ color: 'var(--text3)', fontSize: 10.5 }}> · {o.sector}{o.level ? ` · ${o.level}` : ''}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

/* ── Qualification rules ────────────────────────────────────────────────── */

function RuleForm({ rule, occupations, onSave, onClose }) {
  const [form, setForm] = useState(() => ({
    name: '', kind: 'Academic', grant_scope: 'occupations', sector: '', max_level: '', notes: '',
    ...(rule || {}),
    // Flattened from the rule's joined occupation rows, which come back as
    // objects; the form and the API both want plain ids.
    occupation_ids: rule ? (rule.occupations || []).map(o => o.id) : [],
  }));
  const [err, setErr] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const scope = GRANT_SCOPES.find(s => s.id === form.grant_scope);

  const save = async () => {
    if (!form.name.trim()) return setErr('Give the qualification a name.');
    if (form.grant_scope === 'sector' && !form.sector) return setErr('Choose the sector this qualification covers.');
    if (form.grant_scope === 'occupations' && !form.occupation_ids.length) {
      return setErr('Choose at least one occupation, or switch to a whole sector.');
    }
    try { await onSave(form); } catch (e) { setErr(e.message || 'Could not save'); }
  };

  return (
    <Modal title={rule ? 'Edit qualification rule' : 'Add qualification rule'} onClose={onClose} size="lg"
      footer={<>
        <Btn className="btn btn-secondary" onClick={onClose}>Cancel</Btn>
        <Btn className="btn btn-primary" onClick={save}>Save rule</Btn>
      </>}>
      <ErrorBanner msg={err} onDismiss={() => setErr('')} />
      <div className="form-row form-row-2">
        <div className="form-group">
          <MdTextField label="Qualification name *" value={form.name}
            onChange={e => set('name', e.target.value)} placeholder="e.g. Diploma in Civil Engineering" />
        </div>
        <div className="form-group">
          <MdSelect label="Kind" value={form.kind} onChange={e => set('kind', e.target.value)}>
            {QUAL_KINDS.map(k => <MdOption key={k} value={k}>{k}</MdOption>)}
          </MdSelect>
        </div>
      </div>

      <div className="form-group">
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', marginBottom: 8 }}>
          HOLDING THIS QUALIFICATION QUALIFIES SOMEONE TO TRAIN
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {GRANT_SCOPES.map(s => (
            <button key={s.id} type="button" onClick={() => set('grant_scope', s.id)}
              style={{
                background: form.grant_scope === s.id ? 'var(--ink)' : 'transparent',
                color: form.grant_scope === s.id ? 'var(--on-ink)' : 'var(--text2)',
                border: form.grant_scope === s.id ? 'none' : '1px solid var(--border)',
                borderRadius: 'var(--radius-pill, 999px)', padding: '6px 14px', fontSize: 12.5,
                fontWeight: form.grant_scope === s.id ? 700 : 500, cursor: 'pointer', fontFamily: 'var(--font)',
              }}>{s.label}</button>
          ))}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 8 }}>{scope?.hint}</div>
      </div>

      {form.grant_scope === 'sector' && (
        <div className="form-row form-row-2">
          <div className="form-group">
            <MdSelect label="Sector *" value={form.sector} onChange={e => set('sector', e.target.value)}>
              <MdOption value="">— Choose —</MdOption>
              {SECTORS.map(s => <MdOption key={s} value={s}>{s}</MdOption>)}
            </MdSelect>
          </div>
          <div className="form-group">
            <MdSelect label="Up to level (optional)" value={form.max_level}
              onChange={e => set('max_level', e.target.value)}>
              <MdOption value="">No cap — every level in the sector</MdOption>
              {NSTB_LEVELS.map(l => <MdOption key={l} value={l}>{l} and below</MdOption>)}
            </MdSelect>
          </div>
        </div>
      )}

      {form.grant_scope === 'occupations' && (
        <div className="form-group">
          <label>Occupations ({form.occupation_ids.length} selected)</label>
          <OccupationPicker occupations={occupations} selected={form.occupation_ids}
            onToggle={id => set('occupation_ids', form.occupation_ids.includes(id)
              ? form.occupation_ids.filter(x => x !== id) : [...form.occupation_ids, id])} />
        </div>
      )}

      <div className="form-group">
        <MdTextField label="Notes" value={form.notes || ''} onChange={e => set('notes', e.target.value)} />
      </div>
    </Modal>
  );
}

function RulesTab({ rules, occupations, isAdmin, onReload, token, setErr }) {
  const [modal, setModal] = useState(null);

  const save = async (form) => {
    const body = {
      name: form.name, kind: form.kind, grant_scope: form.grant_scope,
      sector: form.grant_scope === 'sector' ? form.sector : null,
      max_level: form.grant_scope === 'sector' ? form.max_level : null,
      notes: form.notes, occupation_ids: form.grant_scope === 'occupations' ? form.occupation_ids : [],
    };
    if (modal?.data?.id) await api('PUT', `/hr/rules/${modal.data.id}`, body, token);
    else await api('POST', '/hr/rules', body, token);
    setModal(null);
    await onReload();
    toast('Rule saved. Everyone holding this qualification is updated.');
  };

  const remove = async (rule) => {
    const ok = await confirmDialog({
      title: `Deactivate “${rule.name}”?`,
      message: 'People who hold it keep the qualification on their record, but it stops granting '
        + 'them occupations. It is deactivated rather than deleted, so this can be undone.',
      confirmLabel: 'Deactivate', danger: true,
    });
    if (!ok) return;
    try { await api('DELETE', `/hr/rules/${rule.id}`, null, token); await onReload(); }
    catch (e) { setErr(e.message); }
  };

  const describe = (r) => {
    if (r.grant_scope === 'sector') {
      return `Every occupation in ${r.sector}${r.max_level ? ` up to ${r.max_level}` : ''}`;
    }
    if (r.grant_scope === 'certificate_occupation') return 'The occupation named on the certificate';
    const names = (r.occupations || []).map(o => o.name);
    return names.length ? names.join(', ') : 'No occupations chosen yet';
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{ flex: 1, fontSize: 12.5, color: 'var(--text3)' }}>
          What each qualification qualifies someone to train. Written once here, then applied to
          everyone who holds it — correcting a rule corrects every person at once.
        </div>
        {isAdmin && <Btn className="btn btn-primary btn-sm" onClick={() => setModal({ type: 'add' })}>+ Add rule</Btn>}
      </div>

      {rules.length === 0 ? (
        <EmptyState icon="rule" title="No qualification rules yet"
          body="Add one for each qualification your trainers hold — a diploma that covers a whole sector, or a skill certificate that covers only the trade named on it." />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table>
            <thead><tr><th>Qualification</th><th>Kind</th><th>Qualifies to train</th><th></th></tr></thead>
            <tbody>
              {rules.map(r => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 500, fontSize: 13 }}>{r.name}</td>
                  <td><span className="badge badge-gray" style={{ fontSize: 10 }}>{r.kind}</span></td>
                  <td style={{ fontSize: 12, color: 'var(--text2)' }}>{describe(r)}</td>
                  <td style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    {isAdmin && <>
                      <Btn className="btn btn-ghost btn-sm" onClick={() => setModal({ type: 'edit', data: r })}>
                        <span className="material-icons-round" style={{ fontSize: 14 }}>edit</span></Btn>
                      <Btn className="btn btn-danger btn-sm" onClick={() => remove(r)}>
                        <span className="material-icons-round" style={{ fontSize: 14 }}>delete</span></Btn>
                    </>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && <RuleForm rule={modal.data} occupations={occupations}
        onSave={save} onClose={() => setModal(null)} />}
    </>
  );
}


/* ── Screen ─────────────────────────────────────────────────────────────── */

/** One number about the pool. Clickable when there is a list of people behind it. */
function Kpi({ label, value, note, tone, title, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} className={`kp-tile${tone ? ` is-${tone}` : ''}${onClick ? ' is-link' : ''}`}
      onClick={onClick} title={title}>
      <span className="kp-label">{label}</span>
      <span className="kp-value">{value}</span>
      {note && <span className="kp-note">{note}</span>}
    </Tag>
  );
}

/**
 * The pool: a roster, one person's profile, or the editor — each as a page.
 *
 * Pages rather than modals for the same reason as tenders: a record is read
 * and typed at length, and a dialog over the roster made both feel like a
 * detour you were meant to leave quickly.
 */
function TrainerPool({ isAdmin }) {
  const token = getSession()?.token;
  const occupations = useOccupations();

  const [tab, setTab] = useState('people');
  const [people, setPeople] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // Every filter in one object, so "clear all" and the KPI shortcuts are one assignment.
  const [filters, setFilters] = useState(BLANK_FILTERS);
  const setF = (patch) => setFilters(f => ({ ...f, ...patch }));
  const [sort, setSort] = useState('name');
  const [showMatch, setShowMatch] = useState(false);
  const [showMore, setShowMore] = useState(false);

  // What is on screen: the roster, a profile, or the editor.
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(null);

  /*
   * The whole pool, once — including anyone marked unavailable, since the KPIs
   * describe the pool as a whole. Filtering happens on this copy, so every
   * filter answers instantly; the trades each person can train still come
   * derived from the server, so nothing about eligibility is worked out here.
   */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ps, rs] = await Promise.all([
        api('GET', '/hr/people?include_inactive=1', null, token),
        api('GET', '/hr/rules', null, token),
      ]);
      setPeople(ps || []); setRules(rs || []); setErr('');
    } catch (e) { setErr(e.message || 'Could not load the pool'); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const openPerson = async (id) => {
    try { setProfile(await api('GET', `/hr/people/${id}`, null, token)); window.scrollTo?.({ top: 0 }); }
    catch (e) { setErr(e.message); }
  };

  const savePerson = async (form, { andAnother = false } = {}) => {
    const body = {
      ...form,
      qualifications: (form.qualifications || []).map(q => normaliseQual(q, occupations)),
      experience: form.experience || [],
      occupation_overrides: form.occupation_overrides || [],
    };
    const saved = form.id
      ? await api('PUT', `/hr/people/${form.id}`, body, token)
      : await api('POST', '/hr/people', body, token);
    toast(form.id ? 'Saved.' : `${form.full_name} added to the pool.`);
    await load();
    // "Save and add another" stays in the editor with a blank form; otherwise
    // the record just saved is shown, which is how the entry gets checked.
    if (andAnother) return;
    setEditing(null);
    await openPerson(form.id || saved?.id);
  };

  const deletePerson = async (p) => {
    const ok = await confirmDialog({
      title: `Delete ${p.full_name}?`,
      message: 'Their qualifications, experience and attached documents go with them. This cannot be undone. '
        + 'To stop proposing someone who has left, untick “Available to propose” instead.',
      confirmLabel: 'Delete', danger: true,
    });
    if (!ok) return;
    try {
      await api('DELETE', `/hr/people/${p.id}`, null, token);
      setProfile(null); await load();
    } catch (e) { setErr(e.message); }
  };

  const kpi = useMemo(() => poolKpis(people), [people]);
  const shown = useMemo(() => applyFilters(people, filters).sort(SORTS[sort].fn), [people, filters, sort]);
  const pagination = usePagination(shown, 20);
  const wanted = filters.trades;
  const wantedNames = occupations.filter(o => wanted.includes(o.id)).map(o => o.name);
  const narrowed = activeFilterCount(filters);
  // Only trades somebody in the pool can teach are worth offering as a filter.
  const coveredTrades = useMemo(() => {
    const m = new Map();
    for (const p of people) for (const o of p.eligible_occupations || []) m.set(o.id, o.name);
    return [...m].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [people]);
  /** A KPI tile doubles as a shortcut to the people behind its number. */
  const only = (patch) => { setFilters({ ...BLANK_FILTERS, ...patch }); setShowMore(true); };

  if (editing) {
    return (
      <PersonEditor key={editing.id || 'new'} person={editing.id ? editing : null} rules={rules}
        occupations={occupations} onSave={savePerson}
        onCancel={() => setEditing(null)} />
    );
  }
  if (profile) {
    return (
      <PersonProfile person={profile} token={token} canDelete={isAdmin}
        onBack={() => setProfile(null)} onEdit={(p) => setEditing(p)} onDelete={deletePerson}
        onReload={() => openPerson(profile.id)} />
    );
  }

  return (
    <div className="fade-in">
      {err && <ErrorBanner msg={err} onDismiss={() => setErr('')} />}
      <PageHeader title="Trainer pool"
        sub="Trainers and support staff you can put forward against a tender"
        actions={tab === 'people'
          ? <Btn className="btn btn-primary btn-sm" onClick={() => setEditing({ ...BLANK_PERSON })}>
              + Add person</Btn>
          : null} />

      <PillTabs
        tabs={[
          { id: 'people', label: 'People', badge: people.length || undefined },
          { id: 'rules', label: 'Qualification rules', badge: rules.length || undefined },
        ]}
        value={tab} onChange={setTab} ariaLabel="Trainer pool sections" />

      {tab === 'rules' && (
        <RulesTab rules={rules} occupations={occupations} isAdmin={isAdmin}
          onReload={load} token={token} setErr={setErr} />
      )}

      {tab === 'people' && (<>
        {!loading && people.length > 0 && (
          <div className="kp-grid" aria-label="The pool at a glance">
            <Kpi label="Available to propose" value={kpi.available}
              note={`${kpi.trainers} trainer${kpi.trainers === 1 ? '' : 's'} · ${kpi.support} support${kpi.unavailable ? ` · ${kpi.unavailable} left` : ''}`}
              onClick={() => only({})} />
            <Kpi label="Trades covered" value={kpi.tradesCovered}
              note={kpi.thinTrades.length
                ? `${kpi.thinTrades.length} ${kpi.thinTrades.length === 1 ? 'rests' : 'rest'} on one person`
                : kpi.tradesCovered ? 'every trade has cover' : 'none yet'}
              tone={kpi.thinTrades.length ? 'warn' : undefined}
              title={kpi.thinTrades.length ? `Only one person can train: ${kpi.thinTrades.map(t => t.name).join(', ')}` : undefined}
              onClick={kpi.thinTrades.length ? () => only({ trades: kpi.thinTrades.map(t => t.id) }) : undefined} />
            <Kpi label="TOT certified" value={`${kpi.totPct}%`} note={`${kpi.tot} of ${kpi.trainers} trainers`}
              onClick={() => only({ tot: true, role: 'Trainer' })} />
            <Kpi label="NSTB certified" value={`${kpi.nstbPct}%`} note={`${kpi.nstb} of ${kpi.available} people`}
              onClick={() => only({ minNstb: 'Level 1' })} />
            <Kpi label="Ready to submit" value={`${kpi.readyPct}%`}
              note={kpi.missingCv || kpi.missingCitizenship
                ? `${kpi.missingCv} no CV · ${kpi.missingCitizenship} no citizenship` : 'CV and citizenship on file'}
              tone={kpi.readyPct < 100 ? 'warn' : 'good'}
              onClick={kpi.missingCv ? () => only({ missing: 'CV' }) : undefined} />
          </div>
        )}

        <div className="kp-filters">
          <div className="search-wrap" style={{ flex: 1, minWidth: 220 }}>
            <span className="search-icon material-icons-round" style={{ fontSize: 16 }}>search</span>
            <input value={filters.q} onChange={e => setF({ q: e.target.value })} aria-label="Search the pool"
              placeholder="Search name, trade, citizenship no., phone…" />
          </div>
          <div className="tw-seg" role="group" aria-label="Role">
            {[['', 'Everyone'], ['Trainer', 'Trainers'], ['Support Staff', 'Support']].map(([v, l]) => (
              <button key={l} type="button" aria-pressed={filters.role === v} onClick={() => setF({ role: v })}>{l}</button>
            ))}
          </div>
          <Btn className={wanted.length ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
            onClick={() => setShowMatch(v => !v)}>
            <span className="material-icons-round" style={{ fontSize: 15, verticalAlign: 'middle', marginRight: 4 }}>
              checklist</span>
            {wanted.length ? `Tender needs ${wanted.length}` : 'Match to a tender'}
          </Btn>
          <Btn className={`btn btn-sm ${showMore || narrowed > (filters.q ? 1 : 0) + (filters.role ? 1 : 0) + (wanted.length ? 1 : 0) ? 'btn-primary' : 'btn-secondary'}`}
            aria-expanded={showMore} onClick={() => setShowMore(v => !v)}>
            <span className="material-icons-round" style={{ fontSize: 15, verticalAlign: 'middle', marginRight: 4 }}>tune</span>
            Filters</Btn>
        </div>

        {showMore && (
          <div className="kp-more">
            <label className="pf-field"><span className="pf-label">Can train</span>
              <select className="tw-in" value={wanted.length === 1 ? String(wanted[0]) : ''}
                onChange={e => setF({ trades: e.target.value ? [Number(e.target.value)] : [] })}>
                <option value="">{wanted.length > 1 ? `${wanted.length} trades` : 'Any trade'}</option>
                {coveredTrades.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select></label>
            <label className="pf-field"><span className="pf-label">Education at least</span>
              <select className="tw-in" value={filters.minEducation} onChange={e => setF({ minEducation: e.target.value })}>
                <option value="">Any</option>
                {GENERAL_LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select></label>
            <label className="pf-field"><span className="pf-label">NSTB at least</span>
              <select className="tw-in" value={filters.minNstb} onChange={e => setF({ minNstb: e.target.value })}>
                <option value="">Any</option>
                {VOCATIONAL_LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select></label>
            <label className="pf-field"><span className="pf-label">Years since qualifying</span>
              <input className="tw-in num" type="number" min="0" placeholder="Any" value={filters.minYears}
                onChange={e => setF({ minYears: e.target.value })} /></label>
            <label className="pf-field"><span className="pf-label">Missing</span>
              <select className="tw-in" value={filters.missing} onChange={e => setF({ missing: e.target.value })}>
                <option value="">Nothing in particular</option>
                <option value="CV">No CV on file</option>
                <option value="Citizenship">No citizenship on file</option>
                <option value="Experience Letter">No experience letter</option>
              </select></label>
            <label className="pf-field"><span className="pf-label">Show</span>
              <select className="tw-in" value={filters.availability} onChange={e => setF({ availability: e.target.value })}>
                <option value="available">Available to propose</option>
                <option value="unavailable">No longer available</option>
                <option value="all">Everyone</option>
              </select></label>
            <label className="pf-check" style={{ alignSelf: 'end', marginBottom: 14 }}>
              <input type="checkbox" checked={filters.tot} onChange={e => setF({ tot: e.target.checked })} />
              TOT certified</label>
          </div>
        )}

        {showMatch && (
          <div className="card" style={{ padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 10 }}>
              Pick the occupations a tender asks for. The list below narrows to people who can cover them.
            </div>
            <OccupationPicker occupations={occupations} selected={wanted} height={200}
              onToggle={id => setF({ trades: wanted.includes(id) ? wanted.filter(x => x !== id) : [...wanted, id] })} />
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12.5 }}>
                <input type="checkbox" checked={filters.requireAll} style={{ width: 15, height: 15, cursor: 'pointer' }}
                  onChange={e => setF({ requireAll: e.target.checked })} />
                One person must cover every occupation
              </label>
              {wanted.length > 0 && (
                <Btn className="btn btn-ghost btn-sm" onClick={() => setF({ trades: [] })}>Clear</Btn>
              )}
            </div>
          </div>
        )}

        {!loading && people.length > 0 && (
          <div className="kp-count">
            <span>
              {narrowed
                ? <><strong>{shown.length}</strong> of {filters.availability === 'all' ? people.length : filters.availability === 'available' ? kpi.available : kpi.unavailable} match</>
                : <><strong>{shown.length}</strong> {shown.length === 1 ? 'person' : 'people'}</>}
              {wanted.length > 0 && <> · can cover {filters.requireAll ? 'all of' : 'at least one of'} <strong>{wantedNames.join(', ')}</strong></>}
            </span>
            {narrowed > 0 && <Btn className="btn btn-ghost btn-sm" onClick={() => setFilters(BLANK_FILTERS)}>Clear all</Btn>}
            <span style={{ flex: 1 }} />
            <label className="tw-hint" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Sort
              <select className="tw-in" style={{ width: 'auto', height: 30 }} value={sort} onChange={e => setSort(e.target.value)}>
                {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select></label>
          </div>
        )}

        {loading ? (
          <div className="tw-empty">Loading…</div>
        ) : shown.length === 0 ? (
          <EmptyState icon="groups"
            title={people.length ? 'Nobody matches' : 'Nobody in the pool yet'}
            body={people.length
              ? (wanted.length
                  ? 'Nobody available covers that. Try fewer occupations, loosen a filter, or add the qualification rule that would grant them.'
                  : 'Nobody available fits every filter. Loosen one, or clear them all.')
              : 'Add your trainers and support staff, with their academic records, certificates and experience letters.'}
            action={people.length
              ? (narrowed > 0 && <Btn className="btn btn-secondary btn-sm" onClick={() => setFilters(BLANK_FILTERS)}>Clear all filters</Btn>)
              : (
              <Btn className="btn btn-primary btn-sm" onClick={() => setEditing({ ...BLANK_PERSON })}>
                + Add the first person</Btn>
            )} />
        ) : (
          <>
            <div className="card tw-table-card">
              <table className="pp-roster">
                <thead><tr>
                  <th>Name</th><th>Education</th><th>Can train</th><th className="num">Since qualifying</th><th></th>
                </tr></thead>
                <tbody>
                  {pagination.paged.map(p => {
                    const yrs = experienceYears(p);
                    const gen = topGeneral(p);
                    const voc = topVocational(p);
                    return (
                      <tr key={p.id} className={p.is_active === false ? 'pp-inactive' : undefined}>
                        <td>
                          <button type="button" className="pp-person" onClick={() => openPerson(p.id)}>
                            <span className="pp-avatar pp-avatar-sm" aria-hidden="true">{initials(p.full_name)}</span>
                            <span>
                              <span className="pp-person-name">{p.full_name}</span>
                              <span className="pp-person-sub">
                                {[p.person_type, p.designation].filter(Boolean).join(' · ')}
                                {p.is_active === false && ' · no longer available'}
                              </span>
                            </span>
                          </button>
                        </td>
                        <td style={{ fontSize: 12.5 }}>
                          {gen || voc ? (<>
                            {gen && <div>{gen}</div>}
                            {voc && <div className="pp-person-sub">{voc}</div>}
                          </>) : <span className="tw-hint">—</span>}
                        </td>
                        <td style={{ fontSize: 12.5, color: 'var(--text2)' }}>
                          {p.eligible_occupations?.length
                            ? p.eligible_occupations.slice(0, 3).map(o => o.name).join(', ')
                              + (p.eligible_occupations.length > 3 ? ` +${p.eligible_occupations.length - 3}` : '')
                            : <span style={{ color: 'var(--text3)' }}>—</span>}
                        </td>
                        <td className="num" style={{ fontSize: 12.5 }}>
                          {Number.isInteger(yrs) ? `${yrs} yrs` : <span className="tw-hint">—</span>}
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <Btn className="btn btn-ghost btn-sm" onClick={() => openPerson(p.id)}>Open</Btn>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination {...pagination} label="people" />
          </>
        )}
      </>)}
    </div>
  );
}

export default TrainerPool;
export { OccupationPicker };

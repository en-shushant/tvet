import { useState, useEffect, useCallback, useMemo } from 'react';
import { ErrorBanner } from './ui/Modal.jsx';
import { Btn } from '../md.jsx';
import { PageHeader, EmptyState, StatusBadge } from './ui/primitives.jsx';
import { toast } from './ui/Feedback.jsx';
import { FISCAL_YEARS } from '../constants/data.js';
import { useOccupations } from '../utils/useMasterData.js';
import { api, clientToAPI, normClient } from '../utils/api.js';
import { getSession } from '../utils/auth.js';
import { defaultFamilyFor } from '../reports/catalog.js';
import { putTenderContext } from '../utils/tenderContext.js';
import { STATUSES, STAGES, STATUS_TONE } from './tenders/common.js';
import TenderWorkspace from './tenders/TenderWorkspace.jsx';
import CopyTender from './tenders/CopyTender.jsx';
import Select from './ui/Select.jsx';

/**
 * Tenders — bids being put together.
 *
 * The list, and one tender at a time opened as a page of five steps: the
 * notice, what it asks for, who is bidding, each bidder's team, and the
 * documents. The EOI and RFP themselves are built in Reports from the firm's
 * own record; a tender carries the choices that drive them — the bidder, the
 * fiscal year, the trades — so the report builder opens on the right answer.
 * The CV pack is the one document a tender produces itself, because it is the
 * only one written about people rather than about the firm.
 */
function TendersView({ institutes = [], clients = [], onGoToReports, canAccessPool = true }) {
  const token = getSession()?.token;
  const occupations = useOccupations();
  // Local copy so a client added mid-tender is selectable at once, without
  // waiting for the whole app's list to come round again.
  const [clientList, setClientList] = useState(clients);
  useEffect(() => { setClientList(clients); }, [clients]);

  const [tenders, setTenders] = useState([]);
  const [pool, setPool] = useState([]);
  // The tender open as a page: its id, 'new', or nothing (the list).
  const [open, setOpen] = useState(null);
  // Which step to open on, when not wherever the work stands.
  const [startAt, setStartAt] = useState(null);
  const openAt = (id, step = null) => { setStartAt(step); setOpen(id); };
  // The tender being copied from the list, if any.
  const [copyOf, setCopyOf] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  // A firm bids several times in a year, so the list is almost always read one
  // firm and one year at a time rather than whole.
  const [firmFilter, setFirmFilter] = useState('');
  const [fyFilter, setFyFilter] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      const p = new URLSearchParams();
      if (statusFilter) p.set('status', statusFilter);
      if (firmFilter) p.set('institute_id', firmFilter);
      if (fyFilter) p.set('fy', fyFilter);
      if (search.trim()) p.set('q', search.trim());
      const [ts, ps] = await Promise.all([
        api('GET', `/tenders?${p}`, null, token),
        // The pool is a separate grant; without it the team step says so
        // rather than the whole screen failing.
        canAccessPool ? api('GET', '/hr/people', null, token).catch(() => []) : Promise.resolve([]),
      ]);
      setTenders(ts || []); setPool(ps || []); setErr('');
    } catch (e) { setErr(e.message || 'Could not load tenders'); }
    finally { setLoading(false); }
  }, [token, statusFilter, firmFilter, fyFilter, search, canAccessPool]);

  useEffect(() => { const t = setTimeout(load, search ? 250 : 0); return () => clearTimeout(t); }, [load]);

  /**
   * One row per bid, not per stage.
   *
   * An EOI and the RFP that followed it are the same bid at two moments, and
   * listing them as two rows with one title read as a duplicate. A later stage
   * is folded under the one it came from whenever both are on screen; if a
   * filter shows only the later stage, it stands on its own.
   */
  const rows = useMemo(() => {
    const here = new Set(tenders.map(t => t.id));
    const childrenOf = (id) => tenders.filter(c => c.parent_tender_id === id);
    return tenders
      .filter(t => !t.parent_tender_id || !here.has(t.parent_tender_id))
      .map(t => {
        const chain = [t];
        for (let i = 0; i < chain.length; i++) chain.push(...childrenOf(chain[i].id));
        return { root: t, chain, latest: chain[chain.length - 1] };
      });
  }, [tenders]);

  /**
   * Create the employer in master data and hand it back for selection.
   *
   * Added to the local list too, or the select it was just chosen in would not
   * have the option until the whole screen reloaded.
   */
  const addClient = async (c) => {
    const created = await api('POST', '/clients', clientToAPI(c), token);
    const norm = normClient(created);
    setClientList(list => [...list, norm].sort((a, b) =>
      String(a.shortName || '').localeCompare(String(b.shortName || ''))));
    toast(`${norm.shortName || norm.fullName} added to the client list.`);
    return norm;
  };

  /**
   * Hand the tender's choices to the report builder.
   *
   * Written where ReportsView reads it on mount rather than passed as props:
   * the two screens are separate lazy chunks and one is replacing the other, so
   * there is no shared render to pass through.
   */
  const prepareReport = (t, kind, bidder, familyId) => {
    const firms = (bidder?.firms || []);
    const lead = firms.find(f => f.role === 'Lead') || firms[0];
    putTenderContext({
      kind, tenderId: t.id, title: t.title,
      // The format picked on the Submit step. Without it the builder had to
      // guess from the stage, which was wrong for any client asking for one of
      // the other formats.
      familyId: familyId || defaultFamilyFor(kind),
      // The whole bidding entity, not one firm: a joint venture's EOI is built
      // from every member's experience with the lead named first, which is
      // exactly what the multi-firm report families already do.
      instituteId: lead?.institute_id || null,
      instituteIds: firms.map(f => f.institute_id),
      bidderName: bidder?.display_name || '',
      fy: t.fy || '',
      occupationNames: (t.occupations || []).map(o => o.name),
    });
    setOpen(null);
    onGoToReports?.();
  };

  if (open) {
    return (
      <TenderWorkspace key={open} tenderId={open === 'new' ? null : open} startAt={startAt}
        clients={clientList} institutes={institutes} occupations={occupations} pool={pool} canAccessPool={canAccessPool} token={token}
        onBack={() => { setOpen(null); load(); }} onOpen={openAt} onListChanged={load}
        onAddClient={addClient} onPrepareReport={prepareReport} />
    );
  }

  const filtered = !!(search || statusFilter || firmFilter || fyFilter);

  return (
    <div className="fade-in">
      {err && <ErrorBanner msg={err} onDismiss={() => setErr('')} />}
      <PageHeader title="Tenders" sub="Bids you are putting together — notice, team and documents, step by step"
        actions={<Btn className="btn btn-primary btn-sm" onClick={() => openAt('new')}><span className="material-icons-round">add</span>New tender</Btn>} />

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div className="search-wrap" style={{ flex: 1, minWidth: 220 }}>
          <span className="search-icon material-icons-round" style={{ fontSize: 16 }}>search</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by title or reference number…" />
        </div>
        <Select className="form-input" style={{ width: 'auto', minWidth: 170 }}
          value={firmFilter} onChange={e => setFirmFilter(e.target.value)}>
          <option value="">Every firm</option>
          {institutes.map(i => <option key={i.id} value={i.id}>{i.acronym || i.name}</option>)}
        </Select>
        <Select className="form-input" style={{ width: 'auto', minWidth: 130 }}
          value={fyFilter} onChange={e => setFyFilter(e.target.value)}>
          <option value="">Every FY</option>
          {FISCAL_YEARS.map(f => <option key={f} value={f}>{f}</option>)}
        </Select>
        <Select className="form-input" style={{ width: 'auto', minWidth: 150 }}
          value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">Every status</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </Select>
        {(firmFilter || fyFilter || statusFilter) && (
          <Btn className="btn btn-ghost btn-sm"
            onClick={() => { setFirmFilter(''); setFyFilter(''); setStatusFilter(''); }}>Clear</Btn>
        )}
      </div>

      {!loading && rows.length > 0 && (firmFilter || fyFilter) && (
        <div style={{ fontSize:13, color: 'var(--text2)', marginBottom: 10 }}>
          {rows.length} bid{rows.length === 1 ? '' : 's'}
          {firmFilter ? ` by ${institutes.find(i => String(i.id) === String(firmFilter))?.acronym
            || institutes.find(i => String(i.id) === String(firmFilter))?.name}` : ''}
          {fyFilter ? ` in FY ${fyFilter}` : ''}.
        </div>
      )}

      {loading ? (
        <div className="tw-empty">Loading…</div>
      ) : rows.length === 0 ? (
        <EmptyState icon="gavel" title={filtered ? 'No bids match' : 'No tenders yet'}
          body="Start from the notice: record who is asking and by when, what team they want, which of your firms are bidding — then fill each bidder's team and build its documents."
          action={!filtered && (
            <Btn className="btn btn-primary btn-sm" onClick={() => openAt('new')}><span className="material-icons-round">add</span>Create the first tender</Btn>
          )} />
      ) : (
        <div className="card tw-table-card">
          <table className="tw-list-table">
            <thead><tr>
              <th>Tender</th><th>Bidders</th><th>Stage</th><th>Due</th><th>Status</th><th></th>
            </tr></thead>
            <tbody>
              {rows.map(({ root, chain, latest }) => (
                <tr key={root.id}>
                  <td>
                    <button type="button" onClick={() => openAt(latest.id)}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                        font: 'inherit', fontWeight: 600, fontSize: 13, color: 'var(--primary)', textAlign: 'left' }}>
                      {root.title}
                    </button>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                      {[root.client_full_name || root.client_name_manual, latest.reference_no || root.reference_no,
                        root.fy && `FY ${root.fy}`].filter(Boolean).join(' · ')}
                    </div>
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {latest.bidders?.length
                      ? latest.bidders.map(b => b.display_name || b.label).join(' · ')
                      : <span style={{ color: 'var(--text3)' }}>None yet</span>}
                    <div style={{ fontSize:11, color: 'var(--text3)' }}>
                      {latest.proposed_count || 0} proposed
                    </div>
                  </td>
                  <td>
                    <div className="tw-chain" style={{ marginTop: 0, flexWrap: 'nowrap' }}>
                      {chain.map((s, i) => (
                        <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {i > 0 && <span style={{ color: 'var(--text3)', fontSize: 11 }}>→</span>}
                          <button type="button" className={`tw-stage${s.id === latest.id ? ' is-here' : ''}`}
                            style={{ cursor: 'pointer' }} onClick={() => openAt(s.id)}>{s.stage}</button>
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="mono" style={{ fontSize:12 }}>
                    {latest.submission_date || '—'}
                    {latest.submission_time && (
                      <div style={{ fontSize:11, color: 'var(--text3)' }}>{latest.submission_time}</div>
                    )}
                  </td>
                  <td><StatusBadge tone={STATUS_TONE[latest.status] || 'neutral'}>{latest.status}</StatusBadge></td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {/* The first stage, not the latest: a similar notice starts from
                        the beginning, with the whole line-up, not as an RFP carrying
                        only the bidders this one shortlisted. */}
                    <Btn className="btn btn-ghost btn-sm" title="Start a new tender from this one"
                      onClick={() => setCopyOf(root)}>Copy</Btn>
                    <Btn className="btn btn-ghost btn-sm" onClick={() => openAt(latest.id)}>Open</Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {copyOf && (
        <CopyTender tender={copyOf} token={token} onClose={() => setCopyOf(null)}
          onCopied={(id) => { setCopyOf(null); load(); toast('Copied. Add the new notice’s reference number and deadline.'); openAt(id, 1); }} />
      )}
    </div>
  );
}

export default TendersView;
export { STATUSES, STAGES };

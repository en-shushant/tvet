/**
 * Contracts and quotations for a client's shortlisting group.
 *
 * A self-contained sub-feature of the shortlisting screen: the agreement
 * upload, the contract and quotation editors, and the panel that lists them.
 * Split out of Shortlisting.jsx, where it sat in the middle of the letter
 * generation and the results table without touching either.
 */
import { useState, useEffect, useCallback } from 'react';
import Modal from '../ui/Modal.jsx';
import { Btn, MdTextField, MdSelect, MdOption } from '../../md.jsx';
import { api } from '../../utils/api.js';

import { fmtDate } from '../../utils/format.js';

import { toast } from '../ui/Feedback.jsx';
import { NepaliDatePicker, ConfirmModal, FYS, uploadToR2 } from './common.jsx';
import { QUOTE_STATUS, statusColor2 } from './modals.jsx';

function AgreementUpload({ value, onChange, token }) {
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const handleFile = async e => {
    const file = e.target.files[0]; if (!file) return;
    e.target.value = ''; setErr(''); setUploading(true);
    try { onChange(await uploadToR2(file, token)); }
    catch (ex) { setErr(ex.message); }
    finally { setUploading(false); }
  };
  return (
    <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
      {value && (
        <a href={value} target="_blank" rel="noreferrer"
          style={{fontSize:12, color:'var(--primary)', display:'flex', alignItems:'center', gap:4}}>
          <span className="material-icons-round" style={{fontSize:14}}>description</span>Agreement
        </a>
      )}
      <label style={{cursor: uploading ? 'wait' : 'pointer'}}>
        <input type="file" accept="image/*,application/pdf" style={{display:'none'}} onChange={handleFile} disabled={uploading}/>
        <span className="btn btn-ghost btn-sm" style={{fontSize:11}}>{uploading ? 'Uploading…' : value ? 'Replace' : 'Upload Agreement'}</span>
      </label>
      {err && <span style={{fontSize:11, color:'#c0391e'}}>{err}</span>}
    </div>
  );
}

// Modal to add or edit a contract
function ContractModal({ initial, clientId, clientNameManual, onSave, onClose, saving }) {
  const [form, setForm] = useState({ fy: initial?.fy || '', title: initial?.title || '', description: initial?.description || '' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  return (
    <Modal
      title={initial?.id ? 'Edit Contract' : 'New Contract'}
      onClose={onClose}
      compact
      footer={<>
        <Btn className="btn btn-secondary" onClick={onClose}>Cancel</Btn>
        <Btn className="btn btn-primary" onClick={() => onSave(form)} disabled={saving || !form.fy || !form.title}>
          {saving ? 'Saving…' : 'Save'}
        </Btn>
      </>}
    >
      <div style={{display:'flex', flexDirection:'column', gap:14}}>
        <MdSelect label="Fiscal Year *" value={form.fy} onChange={e => set('fy', e.target.value)}>
          <MdOption value="">— Select FY —</MdOption>
          {FYS.map(fy => <MdOption key={fy} value={fy}>{fy}</MdOption>)}
        </MdSelect>
        <MdTextField label="Contract Title *" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Barista Training" />
        <MdTextField label="Description" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Optional details" />
      </div>
    </Modal>
  );
}

// Modal to add/edit a quotation for a contract
function QuotationModal({ initial, contract, shortlistOptions, onSave, onClose, saving, token }) {
  const today = new Date().toISOString().slice(0,10);
  const [form, setForm] = useState({
    shortlist_id: initial?.shortlist_id ? String(initial.shortlist_id) : '',
    quotation_date: initial?.quotation_date ? initial.quotation_date.slice(0,10) : today,
    quoted_amount: initial?.quoted_amount != null ? String(initial.quoted_amount) : '',
    status: initial?.status || 'Quoted',
    contract_amount: initial?.contract_amount != null ? String(initial.contract_amount) : '',
    agreement_doc: initial?.agreement_doc || null,
    remarks: initial?.remarks || '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const isAwarded = form.status === 'Awarded';
  return (
    <Modal
      title={initial?.id ? 'Edit Quotation' : `Add Quotation — ${contract.title}`}
      onClose={onClose}
      compact
      footer={<>
        <Btn className="btn btn-secondary" onClick={onClose}>Cancel</Btn>
        <Btn className="btn btn-primary"
          onClick={() => onSave({ ...form, shortlist_id: Number(form.shortlist_id), quoted_amount: form.quoted_amount !== '' ? Number(form.quoted_amount) : null, contract_amount: isAwarded && form.contract_amount !== '' ? Number(form.contract_amount) : null })}
          disabled={saving || !form.shortlist_id}>
          {saving ? 'Saving…' : 'Save'}
        </Btn>
      </>}
    >
      <div style={{display:'flex', flexDirection:'column', gap:14}}>
        {!initial?.id && (
          <MdSelect label="Firm *" value={form.shortlist_id} onChange={e => set('shortlist_id', e.target.value)}>
            <MdOption value="">— Select shortlisted firm —</MdOption>
            {shortlistOptions.map(sl => (
              <MdOption key={sl.id} value={String(sl.id)}>
                {sl.institute_acronym ? `[${sl.institute_acronym}] ` : ''}{sl.institute_name} · {sl.fy}
              </MdOption>
            ))}
          </MdSelect>
        )}
        <NepaliDatePicker label="Quotation Date *" value={form.quotation_date} onChange={v => set('quotation_date', v)} />
        <MdTextField type="number" label="Quoted Amount (NPR)" value={form.quoted_amount} onChange={e => set('quoted_amount', e.target.value)} placeholder="Optional" />
        <MdSelect label="Status" value={form.status} onChange={e => set('status', e.target.value)}>
          {QUOTE_STATUS.map(s => <MdOption key={s} value={s}>{s}</MdOption>)}
        </MdSelect>
        {isAwarded && <>
          <MdTextField type="number" label="Contract Amount ex-VAT (NPR) *" value={form.contract_amount} onChange={e => set('contract_amount', e.target.value)} placeholder="e.g. 498328" />
          <div>
            <div style={{fontSize:13, fontWeight:600, color:'var(--text2)', marginBottom:6}}>Agreement Document</div>
            <AgreementUpload value={form.agreement_doc} onChange={v => set('agreement_doc', v)} token={token} />
          </div>
        </>}
        <MdTextField label="Remarks" value={form.remarks} onChange={e => set('remarks', e.target.value)} placeholder="Optional" />
      </div>
    </Modal>
  );
}

// Contracts panel shown below firm rows when org grouping is active
export function ContractsPanel({ clientId, clientNameManual, groupRows, canEdit, isAdmin, token }) {
  const [contracts, setContracts] = useState([]);
  const [quotations, setQuotations] = useState({}); // keyed by contract_id
  const [expanded, setExpanded] = useState({});      // contract_id → bool
  const [loading, setLoading] = useState(true);
  const [cModal, setCModal] = useState(null); // {type:'add'|'edit'|'delete', data?}
  const [qModal, setQModal] = useState(null); // {type:'add'|'edit'|'delete', contractId, data?}
  const [saving, setSaving] = useState(false);

  const loadContracts = useCallback(async () => {
    if (!clientId && !clientNameManual) { setLoading(false); return; }
    setLoading(true);
    try {
      const params = clientId ? `client_id=${clientId}` : `client_name_manual=${encodeURIComponent(clientNameManual)}`;
      const rows = await api('GET', `/contracts?${params}`, null, token);
      setContracts(rows);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [clientId, clientNameManual, token]);

  const loadQuotations = useCallback(async (contractId) => {
    try {
      const rows = await api('GET', `/quotations?contract_id=${contractId}`, null, token);
      setQuotations(q => ({ ...q, [contractId]: rows }));
    } catch(e) { console.error(e); }
  }, [token]);

  useEffect(() => { loadContracts(); }, [loadContracts]);

  const toggleContract = async (id) => {
    const isOpen = expanded[id];
    setExpanded(e => ({ ...e, [id]: !isOpen }));
    if (!isOpen && !quotations[id]) await loadQuotations(id);
  };

  const handleContractSave = async (form) => {
    setSaving(true);
    try {
      const payload = { ...form, client_id: clientId || null, client_name_manual: clientNameManual || null };
      if (cModal?.data?.id) await api('PUT', `/contracts/${cModal.data.id}`, payload, token);
      else await api('POST', '/contracts', payload, token);
      await loadContracts();
      setCModal(null);
    } catch(e) { toast.error(e.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleContractDelete = async () => {
    setSaving(true);
    try {
      await api('DELETE', `/contracts/${cModal.data.id}`, null, token);
      await loadContracts();
      setCModal(null);
    } catch(e) { toast.error(e.message || 'Delete failed'); }
    finally { setSaving(false); }
  };

  const handleQuotationSave = async (form) => {
    setSaving(true);
    try {
      const payload = { ...form, contract_id: qModal.contractId };
      if (qModal?.data?.id) await api('PUT', `/quotations/${qModal.data.id}`, payload, token);
      else await api('POST', '/quotations', payload, token);
      await loadQuotations(qModal.contractId);
      setQModal(null);
    } catch(e) { toast.error(e.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleQuotationDelete = async () => {
    setSaving(true);
    try {
      await api('DELETE', `/quotations/${qModal.data.id}`, null, token);
      await loadQuotations(qModal.contractId);
      setQModal(null);
    } catch(e) { toast.error(e.message || 'Delete failed'); }
    finally { setSaving(false); }
  };

  // Firms shortlisted for this org (all FYs) — usable as quotation options
  const shortlistOptions = groupRows;

  return (
    <div style={{borderTop:'2px solid var(--primary-light)', background:'var(--bg)'}}>
      {/* Panel header */}
      <div style={{display:'flex', alignItems:'center', gap:10, padding:'12px 20px', borderBottom:'1px solid var(--border)'}}>
        <span className="material-icons-round" style={{fontSize:16, color:'var(--primary)'}}>gavel</span>
        <span style={{fontSize:13, fontWeight:700, color:'var(--primary-dark)', flex:1}}>Contracts & Quotations</span>
        {canEdit && (
          <button onClick={() => setCModal({type:'add'})}
            style={{display:'flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:8, border:'1px solid var(--primary)', background:'var(--primary-light)', color:'var(--primary-dark)', cursor:'pointer', fontSize:12, fontWeight:600}}>
            <span className="material-icons-round" style={{fontSize:14}}>add</span> New Contract
          </button>
        )}
      </div>

      {loading ? (
        <div style={{padding:'20px', textAlign:'center', color:'var(--text3)', fontSize:13}}>
          <span className="spin material-icons-round" style={{fontSize:18}}>sync</span>
        </div>
      ) : contracts.length === 0 ? (
        <div style={{padding:'18px 20px', fontSize:13, color:'var(--text3)', fontStyle:'italic'}}>
          No contracts yet.{canEdit ? ' Click "New Contract" to create one.' : ''}
        </div>
      ) : (
        <div>
          {contracts.map(c => {
            const isOpen = !!expanded[c.id];
            const quotes = quotations[c.id] || [];
            const awarded = quotes.find(q => q.status === 'Awarded');
            return (
              <div key={c.id} style={{borderBottom:'1px solid var(--border)'}}>
                {/* Contract row */}
                <div style={{display:'flex', alignItems:'center', gap:10, padding:'11px 20px', cursor:'pointer', background: isOpen ? 'var(--surface)' : 'transparent'}}
                  onClick={() => toggleContract(c.id)}>
                  <span className="material-icons-round" style={{fontSize:14, color:'var(--text3)', flexShrink:0}}>
                    {isOpen ? 'expand_more' : 'chevron_right'}
                  </span>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontWeight:600, fontSize:13, color:'var(--text)'}}>{c.title}</div>
                    {c.description && <div style={{fontSize:11.5, color:'var(--text3)', marginTop:1}}>{c.description}</div>}
                  </div>
                  <span style={{fontSize:11, fontWeight:600, padding:'2px 9px', borderRadius:100, background:'var(--primary-light)', color:'var(--primary-dark)', flexShrink:0}}>
                    FY {c.fy}
                  </span>
                  {awarded && (
                    <span style={{fontSize:11, fontWeight:600, padding:'2px 9px', borderRadius:100, background:'var(--success-light)', color:'var(--success)', flexShrink:0}}>
                      Awarded · NPR {Number(awarded.contract_amount || 0).toLocaleString()}
                    </span>
                  )}
                  <span style={{fontSize:11, color:'var(--text3)', flexShrink:0}}>{c.quotation_count} quote{c.quotation_count !== 1 ? 's' : ''}</span>
                  {canEdit && (
                    <div style={{display:'flex', gap:2, flexShrink:0}} onClick={e => e.stopPropagation()}>
                      <button title="Edit contract" onClick={() => setCModal({type:'edit', data:c})}
                        style={{width:28, height:28, borderRadius:50, border:'none', background:'transparent', color:'var(--text3)', cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center'}}
                        onMouseEnter={e=>{e.currentTarget.style.background='var(--bg2)'; e.currentTarget.style.color='var(--text)';}}
                        onMouseLeave={e=>{e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--text3)';}}>
                        <span className="material-icons-round" style={{fontSize:14}}>edit</span>
                      </button>
                      {isAdmin && (
                        <button title="Delete contract" onClick={() => setCModal({type:'delete', data:c})}
                          style={{width:28, height:28, borderRadius:50, border:'none', background:'transparent', color:'var(--text3)', cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center'}}
                          onMouseEnter={e=>{e.currentTarget.style.background='var(--error-light)'; e.currentTarget.style.color='var(--error)';}}
                          onMouseLeave={e=>{e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--text3)';}}>
                          <span className="material-icons-round" style={{fontSize:14}}>delete</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Quotations table */}
                {isOpen && (
                  <div style={{background:'var(--surface)', borderTop:'1px solid var(--border)'}}>
                    {/* Quotation header */}
                    <div style={{display:'flex', alignItems:'center', gap:8, padding:'7px 32px', background:'var(--bg)', borderBottom:'1px solid var(--border)'}}>
                      <div style={{flex:2, fontSize:10.5, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.5px'}}>Firm</div>
                      <div style={{width:110, fontSize:10.5, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.5px', flexShrink:0}}>Quote Date</div>
                      <div style={{width:130, fontSize:10.5, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.5px', flexShrink:0}}>Quoted (NPR)</div>
                      <div style={{width:80, fontSize:10.5, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.5px', flexShrink:0}}>Status</div>
                      <div style={{flex:1, fontSize:10.5, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.5px'}}>Contract Amt (ex-VAT)</div>
                      <div style={{width:90, flexShrink:0}}></div>
                    </div>

                    {quotes.length === 0 ? (
                      <div style={{padding:'14px 32px', fontSize:12.5, color:'var(--text3)', fontStyle:'italic'}}>
                        No quotations yet.
                      </div>
                    ) : quotes.map((q, qi) => {
                      const sc = statusColor2(q.status);
                      const altBg = qi % 2 === 1 ? 'var(--bg)' : 'var(--surface)';
                      return (
                        <div key={q.id} style={{display:'flex', alignItems:'center', gap:8, padding:'10px 32px', borderBottom:'1px solid var(--border)', background:altBg}}>
                          <div style={{flex:2, minWidth:0}}>
                            <span style={{fontWeight:600, fontSize:13}}>
                              {q.institute_acronym ? <span style={{color:'var(--text3)', fontWeight:500}}>[{q.institute_acronym}] </span> : null}
                              {q.institute_name}
                            </span>
                            <span style={{fontSize:11, color:'var(--text3)', marginLeft:6}}>FY {q.shortlist_fy}</span>
                          </div>
                          <div style={{width:110, fontSize:12.5, color:'var(--text2)', flexShrink:0}}>
                            {fmtDate(q.quotation_date)}
                          </div>
                          <div style={{width:130, fontSize:13, fontWeight:600, color:'var(--text)', flexShrink:0}}>
                            {q.quoted_amount != null ? Number(q.quoted_amount).toLocaleString() : '—'}
                          </div>
                          <div style={{width:80, flexShrink:0}}>
                            <span style={{fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:100, background:sc.bg, color:sc.color}}>
                              {q.status}
                            </span>
                          </div>
                          <div style={{flex:1, minWidth:0}}>
                            {q.status === 'Awarded' ? (
                              <div>
                                <span style={{fontSize:13, fontWeight:700, color:'var(--success)'}}>
                                  {q.contract_amount != null ? `NPR ${Number(q.contract_amount).toLocaleString()}` : '—'}
                                </span>
                                {q.agreement_doc && (
                                  <a href={q.agreement_doc} target="_blank" rel="noreferrer"
                                    style={{display:'block', fontSize:11, color:'var(--primary)', marginTop:2}}>
                                    <span className="material-icons-round" style={{fontSize:12, verticalAlign:'middle'}}>description</span> Agreement
                                  </a>
                                )}
                              </div>
                            ) : <span style={{color:'var(--text3)'}}>—</span>}
                          </div>
                          <div style={{width:90, display:'flex', gap:2, flexShrink:0, justifyContent:'flex-end'}}>
                            {canEdit && (
                              <button title="Edit" onClick={() => setQModal({type:'edit', contractId:c.id, data:q})}
                                style={{width:28, height:28, borderRadius:50, border:'none', background:'transparent', color:'var(--text3)', cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center'}}
                                onMouseEnter={e=>{e.currentTarget.style.background='var(--bg2)'; e.currentTarget.style.color='var(--text)';}}
                                onMouseLeave={e=>{e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--text3)';}}>
                                <span className="material-icons-round" style={{fontSize:14}}>edit</span>
                              </button>
                            )}
                            {isAdmin && (
                              <button title="Delete" onClick={() => setQModal({type:'delete', contractId:c.id, data:q})}
                                style={{width:28, height:28, borderRadius:50, border:'none', background:'transparent', color:'var(--text3)', cursor:'pointer', display:'inline-flex', alignItems:'center', justifyContent:'center'}}
                                onMouseEnter={e=>{e.currentTarget.style.background='var(--error-light)'; e.currentTarget.style.color='var(--error)';}}
                                onMouseLeave={e=>{e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--text3)';}}>
                                <span className="material-icons-round" style={{fontSize:14}}>delete</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Add quotation row */}
                    {canEdit && (
                      <div style={{padding:'10px 32px'}}>
                        <button onClick={() => setQModal({type:'add', contractId:c.id})}
                          style={{display:'flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:8, border:'1px dashed var(--border)', background:'transparent', color:'var(--text3)', cursor:'pointer', fontSize:12}}>
                          <span className="material-icons-round" style={{fontSize:14}}>add</span> Add Quotation
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Contract modals */}
      {(cModal?.type === 'add' || cModal?.type === 'edit') && (
        <ContractModal
          initial={cModal.data}
          clientId={clientId}
          clientNameManual={clientNameManual}
          onSave={handleContractSave}
          onClose={() => setCModal(null)}
          saving={saving}
        />
      )}
      {cModal?.type === 'delete' && (
        <ConfirmModal
          message={`Delete contract "${cModal.data.title}"? All quotations under it will also be deleted.`}
          onConfirm={handleContractDelete}
          onClose={() => setCModal(null)}
          saving={saving}
        />
      )}

      {/* Quotation modals */}
      {(qModal?.type === 'add' || qModal?.type === 'edit') && (
        <QuotationModal
          initial={qModal.data}
          contract={contracts.find(c => c.id === qModal.contractId) || {}}
          shortlistOptions={shortlistOptions}
          onSave={handleQuotationSave}
          onClose={() => setQModal(null)}
          saving={saving}
          token={token}
        />
      )}
      {qModal?.type === 'delete' && (
        <ConfirmModal
          message={`Delete this quotation from "${qModal.data.institute_name}"?`}
          onConfirm={handleQuotationDelete}
          onClose={() => setQModal(null)}
          saving={saving}
        />
      )}
    </div>
  );
}

// ── Delete Confirm Modal ───────────────────────────────────────────────────────

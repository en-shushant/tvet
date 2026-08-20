/**
 * Infrastructure held by an institute — the premises, equipment and facilities
 * that Section 4(B) of the EOI report enumerates.
 *
 * Self-contained: it loads and saves its own rows and reads nothing from the
 * detail page beyond the institute id.
 */
import { useState, useEffect } from 'react';
import Modal from '../ui/Modal.jsx';
import { Btn } from '../../md.jsx';
import { api } from '../../utils/api.js';

const INFRA_COLS = ['S.N.', 'Particular', 'Description', 'Unit (Number)', 'Size', 'Ownership', 'Remark'];
const INFRA_BLANK = { particular:'', description:'', unit:'', size:'', ownership:'Own', remark:'' };
const OWNERSHIP_OPTS = ['Own', 'Rented', 'Leased', 'Borrowed', 'Government'];

export function InfrastructureTab({ instituteId, token, canEdit }) {
  const [rows, setRows] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [bulkRows, setBulkRows] = useState([{...INFRA_BLANK}]);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [confirmModal, setConfirmModal] = useState(null);

  useEffect(() => {
    api('GET', `/infrastructure/${instituteId}`, null, token).then(setRows).catch(() => setRows([]));
  }, [instituteId, token]);

  const reload = () => api('GET', `/infrastructure/${instituteId}`, null, token).then(setRows);

  const startEdit = (row) => { setEditingId(row.id); setEditForm({ particular: row.particular, description: row.description||'', unit: row.unit||'', size: row.size||'', ownership: row.ownership||'Own', remark: row.remark||'' }); };
  const cancelEdit = () => setEditingId(null);

  const saveEdit = async () => {
    if (!editForm.particular.trim()) return setErr('Particular is required.');
    setErr('');
    await api('PUT', `/infrastructure/${editingId}`, editForm, token);
    setEditingId(null);
    reload();
  };

  const deleteRow = (id) => {
    setConfirmModal({
      message: 'Delete this infrastructure row?',
      onConfirm: async () => {
        await api('DELETE', `/infrastructure/${id}`, null, token);
        reload();
      },
    });
  };

  const updateBulk = (i, field, value) => setBulkRows(prev => prev.map((r, idx) => idx === i ? {...r, [field]: value} : r));
  const addBulkRow = () => setBulkRows(prev => [...prev, {...INFRA_BLANK}]);
  const removeBulkRow = (i) => setBulkRows(prev => prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i));

  const cancelAdd = () => { setAdding(false); setBulkRows([{...INFRA_BLANK}]); setErr(''); };

  const moveRow = async (id, direction) => {
    const idx = rows.findIndex(r => r.id === id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= rows.length) return;
    const a = rows[idx], b = rows[swapIdx];
    await Promise.all([
      api('PUT', `/infrastructure/${a.id}`, { ...a, sort_order: b.sort_order ?? swapIdx }, token),
      api('PUT', `/infrastructure/${b.id}`, { ...b, sort_order: a.sort_order ?? idx }, token),
    ]);
    reload();
  };

  const saveBulk = async () => {
    const valid = bulkRows.filter(r => r.particular.trim());
    if (!valid.length) return setErr('At least one row must have a Particular.');
    setErr(''); setSaving(true);
    try {
      await Promise.all(valid.map((r, i) => api('POST', '/infrastructure', { institute_id: instituteId, ...r, sort_order: (rows?.length || 0) + i }, token)));
      setBulkRows([{...INFRA_BLANK}]);
      setAdding(false);
      reload();
    } finally { setSaving(false); }
  };

  if (!rows) return <div style={{padding:24, color:'var(--text3)'}}>Loading…</div>;

  const tdS = { padding:'6px 10px', border:'1px solid var(--border)', fontSize:13, verticalAlign:'middle' };
  const thS = { ...tdS, background:'var(--bg2)', fontWeight:600 };
  const inp = { width:'100%', padding:'4px 6px', border:'1px solid var(--border)', borderRadius:4, fontSize:13, background:'var(--bg)', color:'var(--text1)' };

  return (
    <div>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
        <div style={{fontSize:13, color:'var(--text2)'}}>D1 — Office Space and Training Facilities (for ENSSURE report)</div>
        {canEdit && !adding && <Btn className="btn btn-primary btn-sm" onClick={()=>setAdding(true)}>+ Add rows</Btn>}
      </div>
      {err && <div style={{color:'#c00', marginBottom:8, fontSize:13}}>{err}</div>}
      <div className="table-wrap">
        <table style={{width:'100%', borderCollapse:'collapse'}}>
          <thead>
            <tr>{INFRA_COLS.map(h=><th key={h} style={thS}>{h}</th>)}{canEdit && <th style={thS}>Actions</th>}</tr>
          </thead>
          <tbody>
            {rows.map((row, i) => editingId === row.id ? (
              <tr key={row.id}>
                <td style={tdS}>{i+1}</td>
                {['particular','description','unit','size'].map(f=>(
                  <td key={f} style={tdS}><input style={inp} value={editForm[f]} onChange={e=>setEditForm(p=>({...p,[f]:e.target.value}))} /></td>
                ))}
                <td style={tdS}>
                  <select style={inp} value={editForm.ownership} onChange={e=>setEditForm(p=>({...p,ownership:e.target.value}))}>
                    {OWNERSHIP_OPTS.map(o=><option key={o}>{o}</option>)}
                  </select>
                </td>
                <td style={tdS}><input style={inp} value={editForm.remark} onChange={e=>setEditForm(p=>({...p,remark:e.target.value}))} /></td>
                <td style={tdS}>
                  <Btn className="btn btn-primary btn-sm" style={{marginRight:4}} onClick={saveEdit}>Save</Btn>
                  <Btn className="btn btn-ghost btn-sm" onClick={cancelEdit}>Cancel</Btn>
                </td>
              </tr>
            ) : (
              <tr key={row.id}>
                <td style={{...tdS, textAlign:'center'}}>{i+1}</td>
                <td style={tdS}>{row.particular}</td>
                <td style={tdS}>{row.description}</td>
                <td style={{...tdS, textAlign:'center'}}>{row.unit}</td>
                <td style={tdS}>{row.size}</td>
                <td style={{...tdS, textAlign:'center'}}>{row.ownership||'Own'}</td>
                <td style={tdS}>{row.remark}</td>
                {canEdit && <td style={tdS}>
                  <Btn className="btn btn-ghost btn-sm" style={{marginRight:2}} title="Move up" disabled={i===0} onClick={()=>moveRow(row.id,-1)}>↑</Btn>
                  <Btn className="btn btn-ghost btn-sm" style={{marginRight:4}} title="Move down" disabled={i===rows.length-1} onClick={()=>moveRow(row.id,1)}>↓</Btn>
                  <Btn className="btn btn-ghost btn-sm" style={{marginRight:4}} onClick={()=>startEdit(row)}><span className="material-icons-round" style={{fontSize:14}}>edit</span></Btn>
                  <Btn className="btn btn-danger btn-sm" onClick={()=>deleteRow(row.id)}><span className="material-icons-round" style={{fontSize:15}}>delete</span></Btn>
                </td>}
              </tr>
            ))}
            {rows.length === 0 && !adding && (
              <tr><td colSpan={canEdit?8:7} style={{...tdS, textAlign:'center', color:'var(--text3)', padding:24}}>No infrastructure rows yet. Click "+ Add rows" to begin.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Bulk add panel */}
      {adding && (
        <div style={{marginTop:16, border:'1px solid var(--border)', borderRadius:6, padding:12, background:'var(--bg2)'}}>
          <div style={{fontWeight:600, fontSize:13, marginBottom:8}}>Add rows</div>
          <div className="table-wrap">
            <table style={{width:'100%', borderCollapse:'collapse'}}>
              <thead>
                <tr>
                  <th style={thS}>#</th>
                  <th style={thS}>Particular *</th>
                  <th style={thS}>Description</th>
                  <th style={thS}>Unit (Number)</th>
                  <th style={thS}>Size</th>
                  <th style={thS}>Ownership</th>
                  <th style={thS}>Remark</th>
                  <th style={thS}></th>
                </tr>
              </thead>
              <tbody>
                {bulkRows.map((r, i) => (
                  <tr key={i}>
                    <td style={{...tdS, textAlign:'center', color:'var(--text3)', width:36}}>{rows.length + i + 1}</td>
                    <td style={tdS}><input style={inp} placeholder="e.g. Classroom" value={r.particular} onChange={e=>updateBulk(i,'particular',e.target.value)} /></td>
                    <td style={tdS}><input style={inp} value={r.description} onChange={e=>updateBulk(i,'description',e.target.value)} /></td>
                    <td style={tdS}><input style={inp} value={r.unit} onChange={e=>updateBulk(i,'unit',e.target.value)} /></td>
                    <td style={tdS}><input style={inp} value={r.size} onChange={e=>updateBulk(i,'size',e.target.value)} /></td>
                    <td style={tdS}>
                      <select style={inp} value={r.ownership} onChange={e=>updateBulk(i,'ownership',e.target.value)}>
                        {OWNERSHIP_OPTS.map(o=><option key={o}>{o}</option>)}
                      </select>
                    </td>
                    <td style={tdS}><input style={inp} value={r.remark} onChange={e=>updateBulk(i,'remark',e.target.value)} /></td>
                    <td style={{...tdS, textAlign:'center'}}>
                      <Btn className="btn btn-danger btn-sm" onClick={()=>removeBulkRow(i)} disabled={bulkRows.length===1}><span className="material-icons-round" style={{fontSize:16}}>close</span></Btn>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{display:'flex', gap:8, marginTop:10, alignItems:'center'}}>
            <Btn className="btn btn-ghost btn-sm" onClick={addBulkRow}>+ Add another row</Btn>
            <div style={{flex:1}}/>
            <Btn className="btn btn-ghost btn-sm" onClick={cancelAdd}>Cancel</Btn>
            <Btn className="btn btn-primary btn-sm" onClick={saveBulk} disabled={saving}>{saving ? 'Saving…' : `Save ${bulkRows.filter(r=>r.particular.trim()).length || ''} row(s)`}</Btn>
          </div>
        </div>
      )}

      {/* ── Themed delete confirmation modal ── */}
      {confirmModal && (
        <Modal
          title="Confirm Delete"
          onClose={() => setConfirmModal(null)}
          footer={<>
            <Btn className="btn btn-secondary" onClick={() => setConfirmModal(null)}>Cancel</Btn>
            <Btn className="btn btn-danger" disabled={saving} onClick={async () => {
              await confirmModal.onConfirm();
              setConfirmModal(null);
            }}>
              {saving ? 'Deleting…' : 'Delete'}
            </Btn>
          </>}
        >
          <p style={{ margin: 0, color: 'var(--text1)' }}>{confirmModal.message}</p>
        </Modal>
      )}
    </div>
  );
}

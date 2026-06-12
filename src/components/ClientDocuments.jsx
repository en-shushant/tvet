import { useState, useEffect, useRef } from 'react';
import { ErrorBanner } from './ui/Modal.jsx';
import { api } from '../utils/api.js';

function ClientDocuments({ client, instituteId, token, canEdit, isAdmin }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [docErr, setDocErr] = useState('');
  const [pending, setPending] = useState([]); // [{file, label, preview}]
  const fileRef = useRef(null);

  const loadDocs = () => {
    const params = `institute_id=${instituteId}${client.id ? `&client_id=${client.id}` : ''}`;
    api('GET', `/documents?${params}`, null, token)
      .then(d => { setDocs(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { if (expanded) loadDocs(); }, [expanded]);

  const handleSelect = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const newPending = files.map(file => ({
      file,
      label: file.name,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
    }));
    setPending(p => [...p, ...newPending]);
    e.target.value = '';
  };

  const updateLabel = (i, val) => setPending(p => p.map((x, idx) => idx === i ? {...x, label: val} : x));
  const removePending = (i) => setPending(p => p.filter((_, idx) => idx !== i));

  const handleUpload = async () => {
    if (!pending.length) return;
    setUploading(true);
    setDocErr('');
    try {
      for (const item of pending) {
        const file_data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = ev => resolve(ev.target.result.split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(item.file);
        });
        await api('POST', '/documents', {
          institute_id: instituteId,
          client_id: client.id || null,
          client_name: client.fullName,
          file_name: item.label || item.file.name,
          file_size: item.file.size,
          content_type: item.file.type,
          file_data,
        }, token);
      }
      pending.forEach(p => { if (p.preview) URL.revokeObjectURL(p.preview); });
      setPending([]);
      loadDocs();
    } catch(err) { setDocErr('Upload failed: ' + err.message); }
    finally { setUploading(false); }
  };

  const deleteDoc = async (doc) => {
    if (!confirm(`Delete "${doc.file_name}"?`)) return;
    setDocErr('');
    try {
      await api('DELETE', `/documents/${doc.id}`, null, token);
      setDocs(d => d.filter(x => x.id !== doc.id));
    } catch(err) { setDocErr(err.message); }
  };

  const fmtSize = (b) => b ? (b > 1048576 ? (b/1048576).toFixed(1)+' MB' : (b/1024).toFixed(0)+' KB') : '';
  const isImage = (ct) => ct?.startsWith('image/');
  const isPdf = (ct) => ct?.includes('pdf');

  return (
    <div className="card" style={{marginBottom:12, padding:0}}>
      <button style={{width:'100%', background:'none', border:'none', cursor:'pointer', padding:'14px 18px', display:'flex', alignItems:'center', gap:12, textAlign:'left', fontFamily:'var(--font)'}}
        onClick={() => setExpanded(x => !x)}>
        <span style={{fontSize:18}}>🤝</span>
        <div style={{flex:1}}>
          <div style={{fontWeight:600, fontSize:14, color:'var(--text)'}}>{client.name}</div>
          <div style={{fontSize:12, color:'var(--text3)', marginTop:1}}>{client.fullName !== client.name ? client.fullName + ' · ' : ''}{client.type} · {client.assignmentCount} assignment{client.assignmentCount!==1?'s':''}</div>
        </div>
        <div style={{display:'flex', alignItems:'center', gap:8}}>
          {!loading && docs.length > 0 && <span className="badge badge-info">{docs.length} file{docs.length!==1?'s':''}</span>}
          <span style={{color:'var(--text3)', fontSize:12}}>{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div style={{borderTop:'1px solid var(--border)', padding:'12px 18px'}}>
          {docErr && <ErrorBanner msg={docErr} onDismiss={()=>setDocErr('')}/>}

          {/* Uploaded docs */}
          {loading
            ? <div style={{color:'var(--text3)', fontSize:13, padding:'8px 0'}}>Loading…</div>
            : docs.length === 0 && !pending.length
              ? <div style={{color:'var(--text3)', fontSize:13, padding:'8px 0', fontStyle:'italic'}}>No documents uploaded yet.</div>
              : (
                <div style={{display:'flex', flexWrap:'wrap', gap:12, marginBottom: docs.length ? 12 : 0}}>
                  {docs.map(doc => (
                    <div key={doc.id} style={{width:120, position:'relative', border:'1px solid var(--border)', borderRadius:'var(--radius)', overflow:'hidden', background:'var(--bg2)'}}>
                      {/* Thumbnail */}
                      <div style={{height:90, display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)', cursor:'pointer'}}
                        onClick={() => doc.url && window.open(doc.url, '_blank')}>
                        {isImage(doc.content_type) && doc.url
                          ? <img src={doc.url} alt={doc.file_name} style={{width:'100%', height:'100%', objectFit:'cover'}}/>
                          : <span style={{fontSize:36}}>{isPdf(doc.content_type) ? '📄' : '📎'}</span>
                        }
                      </div>
                      {/* Label */}
                      <div style={{padding:'6px 8px'}}>
                        <div style={{fontSize:11, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'var(--text)'}} title={doc.file_name}>{doc.file_name}</div>
                        <div style={{fontSize:10, color:'var(--text3)', marginTop:2}}>{fmtSize(doc.file_size)} · {new Date(doc.uploaded_at).toLocaleDateString()}</div>
                        <div style={{display:'flex', gap:4, marginTop:6}}>
                          {doc.url && <a href={doc.url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm" style={{fontSize:10, padding:'2px 6px'}}>View</a>}
                          {(canEdit || isAdmin) && <button className="btn btn-danger btn-sm" style={{fontSize:10, padding:'2px 6px'}} onClick={()=>deleteDoc(doc)}>🗑</button>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
          }

          {/* Pending files to upload */}
          {pending.length > 0 && (
            <div style={{border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:12, marginBottom:12, background:'color-mix(in srgb, var(--accent) 5%, var(--bg2))'}}>
              <div style={{fontSize:12, fontWeight:600, marginBottom:8, color:'var(--text2)'}}>Ready to upload ({pending.length})</div>
              {pending.map((item, i) => (
                <div key={i} style={{display:'flex', alignItems:'center', gap:10, marginBottom:8}}>
                  {item.preview
                    ? <img src={item.preview} alt="" style={{width:44, height:44, objectFit:'cover', borderRadius:4, border:'1px solid var(--border)', flexShrink:0}}/>
                    : <div style={{width:44, height:44, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:4, border:'1px solid var(--border)', background:'var(--bg)', flexShrink:0, fontSize:22}}>
                        {item.file.type.includes('pdf') ? '📄' : '📎'}
                      </div>
                  }
                  <input className="form-input" style={{flex:1, fontSize:12}}
                    placeholder="File label…"
                    value={item.label}
                    onChange={e => updateLabel(i, e.target.value)}/>
                  <button style={{background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:16, flexShrink:0}} onClick={()=>removePending(i)}>✕</button>
                </div>
              ))}
              <div style={{display:'flex', gap:8, marginTop:4}}>
                <button className="btn btn-primary btn-sm" onClick={handleUpload} disabled={uploading}>
                  {uploading ? '⏳ Uploading…' : `⬆ Upload ${pending.length} file${pending.length!==1?'s':''}`}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={()=>{ pending.forEach(p=>{if(p.preview)URL.revokeObjectURL(p.preview);}); setPending([]); }}>Cancel</button>
              </div>
            </div>
          )}

          {canEdit && (
            <div style={{marginTop: docs.length || pending.length ? 4 : 0}}>
              <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.webp" multiple style={{display:'none'}} onChange={handleSelect}/>
              <button className="btn btn-secondary btn-sm" onClick={()=>fileRef.current?.click()}>
                📎 Upload experience letters
              </button>
              <span style={{fontSize:11, color:'var(--text3)', marginLeft:10}}>PDF, image, or Word document</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
export default ClientDocuments;

import { useState, useEffect, useRef } from 'react';
import { ErrorBanner } from './ui/Modal.jsx';
import { api } from '../utils/api.js';

function ClientDocuments({ client, instituteId, token, canEdit, isAdmin }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [docErr, setDocErr] = useState('');
  const fileRef = useRef(null);

  const loadDocs = () => {
    const params = `institute_id=${instituteId}${client.id ? `&client_id=${client.id}` : ''}`;
    api('GET', `/documents?${params}`, null, token)
      .then(d => { setDocs(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { if (expanded) loadDocs(); }, [expanded]);

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploading(true);
    setDocErr('');
    try {
      for (const file of files) {
        const file_data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = ev => resolve(ev.target.result.split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        await api('POST', '/documents', {
          institute_id: instituteId,
          client_id: client.id || null,
          client_name: client.fullName,
          file_name: file.name,
          file_size: file.size,
          content_type: file.type,
          file_data,
        }, token);
      }
      loadDocs();
    } catch(err) { setDocErr('Upload failed: ' + err.message); }
    finally { setUploading(false); e.target.value = ''; }
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
          {!loading && expanded && <span className="badge badge-info">{docs.length} file{docs.length!==1?'s':''}</span>}
          <span style={{color:'var(--text3)', fontSize:12}}>{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div style={{borderTop:'1px solid var(--border)', padding:'12px 18px'}}>
          {docErr && <ErrorBanner msg={docErr} onDismiss={()=>setDocErr('')}/>}
          {loading
            ? <div style={{color:'var(--text3)', fontSize:13, padding:'8px 0'}}>Loading…</div>
            : docs.length === 0
              ? <div style={{color:'var(--text3)', fontSize:13, padding:'8px 0', fontStyle:'italic'}}>No documents uploaded yet.</div>
              : docs.map(doc => (
                <div key={doc.id} style={{display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid var(--border)'}}>
                  <span style={{fontSize:20}}>{doc.content_type?.includes('pdf') ? '📄' : doc.content_type?.startsWith('image') ? '🖼' : '📎'}</span>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{fontSize:13, fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{doc.file_name}</div>
                    <div style={{fontSize:11, color:'var(--text3)'}}>{fmtSize(doc.file_size)} · {new Date(doc.uploaded_at).toLocaleDateString()}</div>
                  </div>
                  <div style={{display:'flex', gap:6, flexShrink:0}}>
                    {doc.url && <a href={doc.url} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">👁 View</a>}
                    {(canEdit || isAdmin) && <button className="btn btn-danger btn-sm" onClick={()=>deleteDoc(doc)}>🗑</button>}
                  </div>
                </div>
              ))
          }
          {canEdit && (
            <div style={{marginTop:10}}>
              <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" multiple style={{display:'none'}} onChange={handleUpload}/>
              <button className="btn btn-secondary btn-sm" onClick={()=>fileRef.current?.click()} disabled={uploading}>
                {uploading ? '⏳ Uploading…' : '📎 Upload experience letters'}
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

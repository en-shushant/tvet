export default function Pagination({ page, setPage, totalPages, total, start, end, label = 'items' }) {
  if (totalPages <= 1) return null;

  const pages = [];
  const delta = 2;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - delta && i <= page + delta)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }

  return (
    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:18, paddingTop:14, borderTop:'1px solid var(--border)'}}>
      <span style={{fontSize:12.5, color:'var(--text3)'}}>
        Showing <strong style={{color:'var(--text2)'}}>{start + 1}–{end}</strong> of <strong style={{color:'var(--text2)'}}>{total}</strong> {label}
      </span>
      <div style={{display:'flex', gap:5, alignItems:'center'}}>
        <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
          style={{display:'flex', alignItems:'center', gap:3}}>
          <span className="material-icons-round" style={{fontSize:14}}>chevron_left</span> Prev
        </button>
        {pages.map((p, i) =>
          p === '...'
            ? <span key={`e${i}`} style={{padding:'0 4px', color:'var(--text3)', fontSize:13}}>…</span>
            : <button key={p} className="btn btn-sm" onClick={() => setPage(p)}
                style={{
                  minWidth:34, padding:'5px 8px',
                  background: p === page ? 'var(--primary)' : 'var(--surface)',
                  color: p === page ? '#fff' : 'var(--text2)',
                  border: `1.5px solid ${p === page ? 'var(--primary)' : 'var(--border)'}`,
                  fontWeight: p === page ? 700 : 400,
                  boxShadow: p === page ? '0 2px 8px rgba(93,135,255,0.3)' : 'none',
                }}>{p}</button>
        )}
        <button className="btn btn-secondary btn-sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
          style={{display:'flex', alignItems:'center', gap:3}}>
          Next <span className="material-icons-round" style={{fontSize:14}}>chevron_right</span>
        </button>
      </div>
    </div>
  );
}

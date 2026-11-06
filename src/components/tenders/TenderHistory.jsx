/** What was done on this tender, newest first. */
export default function TenderHistory({ events = [] }) {
  if (!events.length) return null;
  const when = (t) => new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return (
    <details className="tw-opts tw-history" style={{ marginTop: 18 }}>
      <summary><strong>History</strong> <span className="tw-hint">· {events.length} entr{events.length === 1 ? 'y' : 'ies'}, latest {when(events[0].created_at)}</span></summary>
      <ul className="tw-history-list">
        {events.map(e => (
          <li key={e.id}><span className="tw-hint">{when(e.created_at)}{e.user_name ? ` · ${e.user_name}` : ''}</span><span>{e.text}</span></li>
        ))}
      </ul>
    </details>
  );
}

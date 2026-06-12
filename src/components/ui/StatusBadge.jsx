export default function StatusBadge({status}) {
  const cls = status === 'Active' ? 'badge-active' : status === 'Pending Renewal' ? 'badge-pending' : 'badge-expired';
  return <span className={`badge ${cls}`}>{status}</span>;
}

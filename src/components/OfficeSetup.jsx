/** Office setup (premises and equipment per firm) as its own screen, so it is not buried in each firm's page. */
import { useState } from 'react';
import { PageHeader } from './ui/primitives.jsx';
import Select from './ui/Select.jsx';
import { InfrastructureTab } from './institute/InfrastructureTab.jsx';

export default function OfficeSetup({ institutes = [], token, embedded = false }) {
  const [id, setId] = useState(institutes[0]?.id || '');
  return (
    <div className="fade-in">
      {embedded
        ? <p className="tw-hint" style={{ marginTop: 0 }}>Premises, equipment and facilities for each firm — used in 4(B) of the EOI report.</p>
        : <PageHeader title="Office setup" sub="Premises, equipment and facilities for each firm — used in 4(B) of the EOI report." />}
      <Select className="tw-in" style={{ width: 'auto', minWidth: 280, marginBottom: 14 }} aria-label="Firm"
        value={id} onChange={e => setId(e.target.value)}>
        {institutes.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
      </Select>
      {id ? <InfrastructureTab key={id} instituteId={id} token={token} canEdit /> : <p>No firms yet.</p>}
    </div>
  );
}

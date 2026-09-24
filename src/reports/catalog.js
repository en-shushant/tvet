/**
 * The report formats, as a name and a label only.
 *
 * REPORT_FAMILIES itself carries the builders, which drag in docx and jsPDF.
 * The tender screen only needs to offer the formats by name and say which one
 * a bidder is submitting in, so it reads this instead and keeps the reports out
 * of its own chunk.
 *
 * `defaultFor` is the format a stage opens with — the one most notices at that
 * stage ask for. It is a starting point, not a restriction: a client can demand
 * any format at either stage, so all of them stay selectable.
 *
 * A test pins this against REPORT_FAMILIES, so a family added, renamed or
 * removed there and not here fails the suite rather than silently offering a
 * format that cannot be built.
 */
const REPORT_CATALOG = [
  { id: 'helvetas', label: 'Helvetas Reports' },
  { id: 'firmwise', label: 'Firm-wise Summary' },
  { id: 'tools',    label: 'Tools & Consumables' },
  { id: 'detailed', label: 'Detailed Experience' },
  { id: 'enssure',  label: 'ENSSURE' },
  { id: 'bolpatra', label: 'Bolpatra (Standard EOI)', defaultFor: 'EOI' },
  { id: 'bagmati',  label: 'Bagmati Province RFP Format', defaultFor: 'RFP' },
];

/** The format a stage opens with, falling back to the first on the list. */
export function defaultFamilyFor(stage) {
  const m = REPORT_CATALOG.find(f => f.defaultFor === stage);
  return (m || REPORT_CATALOG[0]).id;
}

export default REPORT_CATALOG;

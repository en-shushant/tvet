import bolpatra from '../reports/bolpatra.jsx';

/**
 * Experience-tab shortcut: exports section 3(B) Specific Experience for one firm.
 *
 * Delegates to the Bolpatra report family so the table geometry, labels and
 * value formatting stay identical to the Reports section — there is exactly one
 * implementation of the EOI form.
 */
export async function generateEoiDocx(institute, experiences, clients) {
  return bolpatra.downloadMultiDOCX(
    [{ inst: institute, exps: experiences }],
    clients,
    '3b',
    { clients }
  );
}

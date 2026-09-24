/**
 * The handoff from Tenders to the report builder.
 *
 * Its own module so neither screen has to import the other: they are separate
 * lazy chunks and one replaces the other, so a direct import would fuse them
 * into a single download for the sake of one string.
 *
 * Written on "Prepare the EOI", read once on the report builder's mount, and
 * cleared as it is read — a bid someone looked at last week must not quietly
 * re-filter Reports on a later visit.
 */
export const TENDER_CONTEXT_KEY = 'tvettrack_tender_context';

export function takeTenderContext() {
  try {
    const raw = sessionStorage.getItem(TENDER_CONTEXT_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(TENDER_CONTEXT_KEY);
    return JSON.parse(raw);
  } catch { return null; }
}

export function putTenderContext(ctx) {
  try { sessionStorage.setItem(TENDER_CONTEXT_KEY, JSON.stringify(ctx)); }
  catch { /* a blocked sessionStorage just means nothing is pre-filled */ }
}

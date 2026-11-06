/**
 * The tour of copying a shortlist, and who has seen it.
 *
 * "Seen" is remembered per signed-in user in this browser, so each person who can
 * copy gets the banner once; someone sharing a browser is not skipped because a
 * colleague dismissed it.
 */
const key = (session) => `tvettrack_tour_copy_shortlist:${session?.email || session?.id || 'anon'}`;

export const tourSeen = (session) => { try { return localStorage.getItem(key(session)) === '1'; } catch { return false; } };
export const markTourSeen = (session) => { try { localStorage.setItem(key(session), '1'); } catch { /* private mode */ } };

/** Steps for <GuidedTour>. `openCopy` opens the copy dialog on the first shortlist; `closeCopy` shuts it. */
export function copyTourSteps({ openCopy, closeCopy }) {
  return [
    {
      target: '[aria-label="Copy shortlist to another organization"]',
      title: 'Copy a shortlist',
      body: 'Every shortlist has this copy icon. It makes a new shortlist for another organization from this one, with the same firms, so you do not assign them all again.',
      enter: closeCopy,
    },
    {
      target: '[data-tour="copy-org"]',
      title: 'Name the new organization',
      body: 'Give the organization, its department and address, and who the letter is addressed to. These start blank because they are what changes. The letter format, name, year and dates start as the original’s and can be edited.',
      enter: openCopy,
    },
    {
      target: '[data-tour="copy-firms"]',
      title: 'Choose the firms',
      body: 'Every firm comes across by default. Untick any that should not be on the new shortlist. Firms you are not assigned to are skipped.',
    },
    {
      target: '[data-tour="copy-go"]',
      title: 'Copy it',
      body: 'This creates the new shortlist. The original is not changed, and its shortlisting document and contract amounts stay with it. Open the new one afterwards to edit anything or assign more firms.',
    },
  ];
}

/**
 * Page navigation.
 *
 * Every control here is a plain button sharing one set of classes. It used to
 * mix Material Web buttons for Prev/Next with raw buttons for the numbers, and
 * the two element types have different box models — so they could not be made
 * the same height or shape, and the active page sat visibly below its
 * neighbours. That is also why the shadow was a hardcoded blue that stayed the
 * same in dark mode.
 *
 * Marked up as a nav with aria-current on the active page, so it is announced
 * as pagination rather than as a row of unlabelled numbers.
 */

/**
 * Page numbers with long runs collapsed to ellipses, e.g. 1 … 4 5 6 … 20.
 *
 * The first and last page are always shown so the ends of the range stay
 * reachable in one click.
 *
 * A gap of a single page is rendered as that page rather than an ellipsis: it
 * occupies the same width either way, so "1 … 3" costs exactly as much as
 * "1 2 3" while hiding a page instead of offering it.
 */
function pageItems(page, totalPages, delta = 2) {
  const shown = [];
  for (let i = 1; i <= totalPages; i++) {
    const nearCurrent = i >= page - delta && i <= page + delta;
    if (i === 1 || i === totalPages || nearCurrent) shown.push(i);
  }

  const items = [];
  shown.forEach((n, i) => {
    const previous = shown[i - 1];
    if (previous !== undefined) {
      const missing = n - previous - 1;
      if (missing === 1) items.push(previous + 1);
      else if (missing > 1) items.push('…');
    }
    items.push(n);
  });
  return items;
}

export default function Pagination({ page, setPage, totalPages, total, start, end, label = 'items' }) {
  if (totalPages <= 1) return null;

  const items = pageItems(page, totalPages);
  const atStart = page === 1;
  const atEnd = page === totalPages;

  return (
    <nav className="pagination" aria-label="Pagination">
      <p className="pagination-summary">
        Showing <strong>{start + 1}–{end}</strong> of <strong>{total}</strong> {label}
      </p>

      <div className="pagination-controls">
        <button type="button" className="page-btn page-btn-nav"
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={atStart} aria-label="Previous page">
          <span className="material-icons-round" aria-hidden="true">chevron_left</span>
          <span>Prev</span>
        </button>

        {items.map((item, i) => item === '…' ? (
          <span key={`gap-${i}`} className="page-gap" aria-hidden="true">…</span>
        ) : (
          <button key={item} type="button"
            className={`page-btn page-btn-num${item === page ? ' is-active' : ''}`}
            onClick={() => setPage(item)}
            aria-label={`Page ${item}`}
            aria-current={item === page ? 'page' : undefined}>
            {item}
          </button>
        ))}

        <button type="button" className="page-btn page-btn-nav"
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={atEnd} aria-label="Next page">
          <span>Next</span>
          <span className="material-icons-round" aria-hidden="true">chevron_right</span>
        </button>
      </div>
    </nav>
  );
}

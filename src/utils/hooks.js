import { useState, useEffect } from 'react';

export function usePagination(items, pageSize = 12) {
  const [page, setPage] = useState(1);
  // Reset to page 1 whenever items change (search/filter applied)
  useEffect(() => { setPage(1); }, [items.length]);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const start = (page - 1) * pageSize;
  const paged = items.slice(start, start + pageSize);
  return { paged, page, setPage, totalPages, total: items.length, start, end: Math.min(start + pageSize, items.length) };
}

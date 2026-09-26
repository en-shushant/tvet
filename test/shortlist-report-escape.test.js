import { describe, it, expect, vi } from 'vitest';
import { printShortlistReport } from '../src/components/shortlisting/table.jsx';

describe('printable shortlist report', () => {
  it('prints names as text, never as markup', () => {
    let html = '';
    const win = { document: { write: (h) => { html = h; }, close: () => {} } };
    const open = vi.spyOn(window, 'open').mockReturnValue(win);
    const evil = '<img src=x onerror="alert(1)">';
    printShortlistReport([{
      institute_name: evil, institute_acronym: '<b>X</b>', client_name: `Org ${evil}`,
      standing_list_name: '<script>steal()</script>', fy: '2081/82', status: 'Active',
    }], 'org', { search: '<svg onload=x>' });
    open.mockRestore();
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<script>steal');
    expect(html).not.toContain('<svg onload');
    expect(html).not.toContain('<b>X</b>');
    expect(html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  });
});

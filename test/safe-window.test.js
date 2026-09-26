import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { withNoScriptPolicy, writeSafeDocument, isSafeFileUrl, openFileViewer, openFileUrl } from '../src/utils/safeWindow.js';

const read = (f) => readFileSync(resolve(process.cwd(), f), 'utf8');
const CSP_RE = /Content-Security-Policy" content="script-src 'none'/;

describe('printable pages open with scripts disabled', () => {
  it('puts the policy first in <head>, before any record data', () => {
    const out = withNoScriptPolicy('<!doctype html><html><head><title><img src=x onerror=alert(1)></title></head><body></body></html>');
    expect(out.indexOf('Content-Security-Policy')).toBeLessThan(out.indexOf('<title>'));
  });
  it('adds a head when the page has none', () => {
    expect(withNoScriptPolicy('<html><body>x</body></html>')).toMatch(/<html><head><meta http-equiv="Content-Security-Policy"/);
    expect(withNoScriptPolicy('<p>x</p>')).toMatch(/^<meta http-equiv="Content-Security-Policy"/);
  });
  it('keeps print and close buttons working without inline handlers', () => {
    const doc = document.implementation.createHTMLDocument('');
    let written = '';
    const win = { document: { open() {}, write(h) { written = h; }, close() { doc.documentElement.innerHTML = written; },
      querySelectorAll: (q) => doc.querySelectorAll(q) }, print: vi.fn(), close: vi.fn() };
    win.document.querySelectorAll = (q) => doc.querySelectorAll(q);
    writeSafeDocument(win, '<html><head></head><body><button id="p" onclick="window.print()">P</button><button id="c" onclick="window.close()">C</button><button id="x" onclick="steal()">X</button></body></html>');
    expect(written).toMatch(CSP_RE);
    doc.getElementById('p').click(); doc.getElementById('c').click(); doc.getElementById('x').click();
    expect(win.print).toHaveBeenCalledTimes(1);
    expect(win.close).toHaveBeenCalledTimes(1);
    expect(doc.querySelectorAll('[onclick]').length).toBe(0);
  });
});

describe('opening uploaded files', () => {
  it('accepts only real file locations', () => {
    expect(isSafeFileUrl('data:application/pdf;base64,AAA')).toBe(true);
    expect(isSafeFileUrl('blob:http://x/1')).toBe(true);
    expect(isSafeFileUrl('https://files.example/a.pdf')).toBe(true);
    expect(isSafeFileUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeFileUrl(' JavaScript:alert(1)')).toBe(false);
    expect(isSafeFileUrl('"><script>')).toBe(false);
  });
  it('refuses to open anything else', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    expect(openFileViewer('javascript:alert(1)')).toBeNull();
    expect(openFileUrl('javascript:alert(1)')).toBeNull();
    expect(open).not.toHaveBeenCalled();
    open.mockRestore();
  });
});

describe('no screen writes raw HTML into a window any more', () => {
  it.each([
    'src/utils/export.js', 'src/components/ReportsView.jsx', 'src/components/tenders/TenderWorkspace.jsx',
    'src/components/ExperienceForm.jsx', 'src/components/InstituteDetail.jsx', 'src/components/ExpCard.jsx',
    'src/components/shortlisting/table.jsx',
  ])('%s', (f) => {
    const src = read(f);
    expect(src).not.toMatch(/\.document\.write\(/);
    expect(src).not.toMatch(/window\.open\((exp|form)\.referenceFile\)/);
  });
});

describe('stored uploads are served safely', () => {
  it('never echoes an uploader-chosen type inline', async () => {
    const { sendStoredFile } = await import('../backend/lib/safeDownload.js');
    const headers = {};
    const reply = { header: (k, v) => { headers[k] = v; return reply; }, send: (b) => b };
    sendStoredFile(reply, { file_name: 'x".html', content_type: 'text/html' }, Buffer.from('<script>'));
    expect(headers['Content-Type']).toBe('application/octet-stream');
    expect(headers['Content-Disposition']).toMatch(/^attachment; filename="x_\.html"/);
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Content-Security-Policy']).toMatch(/sandbox/);
    sendStoredFile(reply, { file_name: 'a.pdf', content_type: 'application/pdf' }, Buffer.from(''));
    expect(headers['Content-Type']).toBe('application/pdf');
    expect(headers['Content-Disposition']).toMatch(/^inline;/);
  });
});

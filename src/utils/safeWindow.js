/**
 * Opening printable pages and uploaded files in a new window, safely.
 *
 * A window opened with window.open('') starts as about:blank and inherits the
 * app's origin. Anything written into it runs with the app's privileges —
 * including reading the signed-in session from localStorage. Printable reports
 * are built from names people type (institutes, clients, trainers), so a name
 * carrying markup must never become running code there.
 *
 * writeSafeDocument() puts a Content-Security-Policy at the top of the page
 * that forbids every script, inline handler and javascript: URL. The report
 * templates have no scripts of their own; printing is driven from here, and the
 * few buttons that used inline onclick handlers are wired from outside.
 */

const CSP = `<meta http-equiv="Content-Security-Policy" content="script-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">`;

/** The HTML with the no-scripts policy as the first thing in <head>. */
export function withNoScriptPolicy(html) {
  const s = String(html ?? '');
  const head = /<head(\s[^>]*)?>/i.exec(s);
  if (head) return s.slice(0, head.index + head[0].length) + CSP + s.slice(head.index + head[0].length);
  const htmlTag = /<html(\s[^>]*)?>/i.exec(s);
  if (htmlTag) {
    const at = htmlTag.index + htmlTag[0].length;
    return s.slice(0, at) + `<head>${CSP}</head>` + s.slice(at);
  }
  return CSP + s;
}

/**
 * Write a whole page into `win` with scripts disabled. Buttons whose inline
 * handler only printed or closed the window keep doing so.
 */
export function writeSafeDocument(win, html) {
  if (!win) return null;
  const doc = win.document;
  doc.open?.();
  doc.write(withNoScriptPolicy(html));
  doc.close?.();
  for (const el of doc.querySelectorAll?.('[onclick]') || []) {
    const code = el.getAttribute('onclick') || '';
    el.removeAttribute('onclick');
    if (/window\.print\(\)/.test(code)) el.addEventListener('click', () => win.print());
    else if (/window\.close\(\)/.test(code)) el.addEventListener('click', () => win.close());
  }
  return win;
}

/** Open a new tab and write a page into it safely. */
export function openSafeDocument(html) {
  return writeSafeDocument(window.open('', '_blank'), html);
}

/**
 * Only real file locations may be opened: an uploaded file's data:/blob: URL
 * or a web address. A javascript: URL opened from here would run as the app.
 */
export function isSafeFileUrl(src) {
  return /^(data:|blob:|https?:\/\/|\/)/i.test(String(src ?? '').trim());
}

/** Open an uploaded file (PDF, image) in a new tab, full-window. */
export function openFileViewer(src) {
  if (!isSafeFileUrl(src)) return null;
  const w = window.open('', '_blank');
  if (!w) return null;
  const doc = w.document;
  doc.open();
  doc.write(withNoScriptPolicy('<!doctype html><html><head><title>Document</title></head>'
    + '<body style="margin:0;height:100vh"></body></html>'));
  doc.close();
  // Built with DOM calls, so the address is set as a value, never parsed as HTML.
  const frame = doc.createElement('iframe');
  frame.setAttribute('src', String(src).trim());
  frame.setAttribute('style', 'border:none;width:100%;height:100%;display:block');
  doc.body.appendChild(frame);
  return w;
}

/** Open a file's address directly, if it is a real file location. */
export function openFileUrl(src) {
  if (!isSafeFileUrl(src)) return null;
  return window.open(String(src).trim(), '_blank', 'noopener');
}

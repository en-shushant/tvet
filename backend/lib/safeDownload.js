// lib/safeDownload.js — sending a stored upload back without letting it act as a page.
//
// The content type is whatever the uploader's browser claimed. Served inline
// from this origin, a file claiming text/html (or SVG with script) would run
// with the app's privileges. Documents here are PDFs, images and Office files,
// so those are shown inline as before; anything else downloads as a plain file.
// Every response is also sandboxed and may not be type-sniffed.

const INLINE_TYPES = new Set([
  'application/pdf',
  'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff',
]);
const DOWNLOAD_TYPES = new Set([
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip', 'text/csv', 'text/plain',
]);

/** A filename safe inside a quoted header value, plus its UTF-8 form. */
function dispositionName(name) {
  const raw = String(name || 'document').replace(/[\r\n"\\]/g, '_');
  const ascii = raw.replace(/[^\x20-\x7e]/g, '_');
  return `filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(raw)}`;
}

function sendStoredFile(reply, { file_name, content_type }, buf) {
  const type = String(content_type || '').toLowerCase().split(';')[0].trim();
  const inline = INLINE_TYPES.has(type);
  const served = inline || DOWNLOAD_TYPES.has(type) ? type : 'application/octet-stream';
  reply.header('Content-Type', served);
  reply.header('Content-Disposition', `${inline ? 'inline' : 'attachment'}; ${dispositionName(file_name)}`);
  reply.header('X-Content-Type-Options', 'nosniff');
  // Anything not shown inline gets no scripts and no same-origin access even if
  // a browser renders it. (PDFs and images are left alone: they cannot run the
  // app's script, and Chrome will not display a PDF served sandboxed.)
  if (!inline) reply.header('Content-Security-Policy', "sandbox; default-src 'none'");
  return reply.send(buf);
}

module.exports = { sendStoredFile };

/**
 * A failed request must always carry a readable message.
 *
 * The app builds user-facing text by concatenation — `'Merge failed: ' +
 * err.message` — so an empty message renders as a bare prefix with nothing
 * after it. That is exactly what a merge failure showed, and it made the real
 * cause undiagnosable.
 *
 * The trap is res.statusText: over HTTP/2 it is *always* the empty string, so
 * the old fallback chain (body.error || statusText) produced '' for any
 * response our own API did not write — a proxy's HTML error page during a
 * container restart, a gateway timeout, a 413.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { api } from '../src/utils/api.js';

const respond = (body, init) => {
  globalThis.fetch = () => Promise.resolve(new Response(body, init));
};

/** HTTP/2 responses carry no reason phrase. */
const http2 = (status) => ({ status, statusText: '' });

afterEach(() => { delete globalThis.fetch; });

describe('api() error messages', () => {
  it('uses the API’s own error text when there is one', async () => {
    respond(JSON.stringify({ error: 'Admin access required' }), http2(403));
    await expect(api('POST', '/occupations/merge', {}, 't'))
      .rejects.toThrow('Admin access required');
  });

  it('never throws an empty message for a proxy HTML error page', async () => {
    respond('<html><head><title>502 Bad Gateway</title></head></html>', http2(502));
    const err = await api('POST', '/occupations/merge', {}, 't').catch(e => e);
    expect(err.message).not.toBe('');
    expect(err.message).toContain('502');
    expect(err.message).toContain('non-JSON');
  });

  it('never throws an empty message for an empty body', async () => {
    respond('', http2(504));
    const err = await api('POST', '/occupations/merge', {}, 't').catch(e => e);
    expect(err.message.trim()).not.toBe('');
    expect(err.message).toContain('504');
  });

  it('never throws an empty message for JSON without an error field', async () => {
    respond(JSON.stringify({ message: 'something' }), http2(500));
    const err = await api('GET', '/occupations', null, 't').catch(e => e);
    expect(err.message.trim()).not.toBe('');
    expect(err.message).toContain('500');
  });

  it('distinguishes a client error from a server error', async () => {
    respond('', http2(413));
    const err = await api('POST', '/occupations/merge', {}, 't').catch(e => e);
    expect(err.message).toContain('413');
    expect(err.message).not.toContain('Server error');
  });

  it('keeps the status on the error so callers can branch on it', async () => {
    respond('', http2(502));
    const err = await api('GET', '/occupations', null, 't').catch(e => e);
    expect(err.status).toBe(502);
  });

  it('still concatenates into something readable', async () => {
    // How the caller actually uses it.
    respond('<html>504</html>', http2(504));
    const err = await api('POST', '/occupations/merge', {}, 't').catch(e => e);
    const shown = 'Merge failed: ' + err.message;
    expect(shown).not.toBe('Merge failed: ');
    expect(shown.length).toBeGreaterThan('Merge failed: '.length + 10);
  });
});

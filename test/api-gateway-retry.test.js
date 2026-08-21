/**
 * A gateway error that the API did not write is retried.
 *
 * Measured in production: a POST on an upstream connection idle ~30 seconds
 * returns 502 with nginx's HTML page in ~45ms, and the identical request
 * immediately after succeeds. nginx retries idempotent requests itself but
 * excludes non-idempotent ones by default, so GETs never surfaced this while
 * POSTs silently failed — a bulk save dropped its first row and kept the rest.
 *
 * The retry is gated on the body not being ours. That is what makes it safe to
 * repeat a POST: the proxy answered, so the request never reached the API and
 * cannot have been applied. A 502 that the API itself produced would have a
 * JSON body and is left alone.
 */
import { describe, it, beforeEach, expect, vi } from 'vitest';
import { api } from '../src/utils/api.js';

const NGINX_502 = '<html>\r\n<head><title>502 Bad Gateway</title></head>\r\n<body><center>nginx</center></body>\r\n</html>';
const html = (status) => new Response(NGINX_502, { status, headers: { 'Content-Type': 'text/html' } });
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); });

describe('api() gateway retry', () => {
  it('retries a POST that the proxy rejected, and returns the second result', async () => {
    const calls = [];
    globalThis.fetch = (url, opts) => {
      calls.push(opts.method);
      return Promise.resolve(calls.length === 1 ? html(502) : json({ id: 7, name: 'Tool 1' }));
    };
    await expect(api('POST', '/occupation-tools', { name: 'Tool 1' }, 't'))
      .resolves.toEqual({ id: 7, name: 'Tool 1' });
    expect(calls).toEqual(['POST', 'POST']);
  });

  it('does not retry a 502 the API itself produced', async () => {
    let n = 0;
    globalThis.fetch = () => { n++; return Promise.resolve(json({ error: 'upstream database down' }, 502)); };
    await expect(api('POST', '/occupation-tools', { name: 'x' }, 't')).rejects.toThrow('upstream database down');
    expect(n).toBe(1);
  });

  it('gives up after two retries rather than hammering', async () => {
    let n = 0;
    globalThis.fetch = () => { n++; return Promise.resolve(html(504)); };
    await expect(api('POST', '/x', { a: 1 }, 't')).rejects.toThrow(/Server error 504/);
    expect(n).toBe(3);   // original + 2 retries
  });

  it('leaves a 400 alone — a real validation failure must surface', async () => {
    let n = 0;
    globalThis.fetch = () => { n++; return Promise.resolve(json({ error: 'occupation_id, level and name required' }, 400)); };
    await expect(api('POST', '/occupation-tools', {}, 't')).rejects.toThrow(/name required/);
    expect(n).toBe(1);
  });

  it('applies to GETs too', async () => {
    const seen = [];
    globalThis.fetch = (u, o) => { seen.push(o.method); return Promise.resolve(seen.length === 1 ? html(503) : json([1, 2])); };
    await expect(api('GET', '/occupation-tools/counts', null, 't')).resolves.toEqual([1, 2]);
    expect(seen.length).toBe(2);
  });
});

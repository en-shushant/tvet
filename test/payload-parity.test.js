/**
 * The institute list and detail payloads must agree on the fields the client
 * merges between them.
 *
 * App.jsx replaces an institute's entry in its shared `institutes` array with
 * the response from GET /institutes/:id whenever one is opened or refreshed.
 * That makes the two payloads interchangeable by assumption — and the detail
 * endpoint was a plain SELECT *, carrying none of the aggregates the list
 * computes. So opening an institute silently zeroed its trainee, skill-test and
 * programme totals, and the dashboard, which sums exactly those fields across
 * every institute, reported smaller numbers the more you browsed. A reload
 * refetched the list and put them back, which is why it looked like the
 * dashboard was only right immediately after a refresh.
 *
 * Read statically: there is no database in CI, so this checks that both queries
 * name the same aggregate columns rather than comparing live responses.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const source = readFileSync(
  path.resolve(import.meta.dirname, '../backend/routes/institutes.js'), 'utf8');

/** The block of a route handler, from its registration to the next one. */
function handler(pathLiteral) {
  const start = source.indexOf(`fastify.get('${pathLiteral}'`);
  expect(start, `no handler for GET ${pathLiteral}`).toBeGreaterThan(-1);
  const next = source.indexOf('fastify.get(', start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

/**
 * Fields the client reads off an institute regardless of which endpoint
 * produced it. normInst maps each of these; a payload missing one yields 0.
 */
const MERGED_AGGREGATES = [
  'total_trainees',
  'total_st_appeared',
  'total_clients',
  'total_aff_programs',
];

describe('institute list and detail payloads stay interchangeable', () => {
  const list = handler('/');
  const detail = handler('/:id');

  for (const column of MERGED_AGGREGATES) {
    it(`both endpoints return ${column}`, () => {
      expect(list, `GET /institutes is missing ${column}`).toContain(column);
      expect(detail,
        `GET /institutes/:id is missing ${column}. App.jsx merges this response ` +
        `into the institutes array, so the field would be zeroed for any ` +
        `institute that gets opened.`).toContain(column);
    });
  }

  it('normInst reads every one of them', () => {
    // If a field is dropped here the endpoints could agree while the client
    // still loses it.
    const api = readFileSync(
      path.resolve(import.meta.dirname, '../src/utils/api.js'), 'utf8');
    for (const column of MERGED_AGGREGATES) {
      expect(api, `normInst does not read ${column}`).toContain(column);
    }
  });

  it('detail still returns the relations the list summarises', () => {
    // These are what the detail page adds; losing them would be the same class
    // of fault in the other direction.
    for (const key of ['experience', 'nstb', 'taxClearance', 'affiliation', 'infrastructure']) {
      expect(detail, `GET /institutes/:id no longer returns ${key}`).toContain(key);
    }
  });
});

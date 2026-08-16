/**
 * Merging occupations rewrites live foreign keys, so the queries are checked
 * rather than trusted.
 *
 * The two references fail in opposite directions if a source is removed before
 * they are repointed: assignment_occupations.ctevt_occupation_id is
 * ON DELETE SET NULL, so assignments would silently lose their occupation,
 * while occupation_tools.occupation_id is ON DELETE CASCADE, so that
 * occupation's entire tool list would be destroyed. Order matters, and so does
 * not deleting at all.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const source = readFileSync(
  path.resolve(import.meta.dirname, '../backend/routes/occupations.js'), 'utf8');

const mergeHandler = (() => {
  const start = source.indexOf("fastify.post('/merge'");
  expect(start, 'no merge handler').toBeGreaterThan(-1);
  const next = source.indexOf('fastify.', start + 10);
  return source.slice(start, next === -1 ? source.length : next);
})();

describe('occupation merge', () => {
  it('repoints assignments onto the target', () => {
    expect(mergeHandler).toMatch(/UPDATE assignment_occupations SET ctevt_occupation_id/);
  });

  it('moves the tools across', () => {
    expect(mergeHandler).toMatch(/UPDATE occupation_tools SET occupation_id/);
  });

  it('deactivates rather than deletes the sources', () => {
    expect(mergeHandler).toMatch(/UPDATE occupations SET is_active = FALSE/);
    // A hard delete would cascade the tools away and null the assignments.
    expect(mergeHandler).not.toMatch(/DELETE FROM occupations/);
  });

  it('never deletes an assignment row', () => {
    expect(mergeHandler).not.toMatch(/DELETE FROM assignment_occupations/);
  });

  it('only deletes tools that duplicate one the target already has', () => {
    // The single DELETE present must be guarded by an EXISTS against the target.
    const deletes = mergeHandler.match(/DELETE FROM occupation_tools[\s\S]*?`/g) || [];
    expect(deletes.length, 'expected exactly one guarded delete').toBe(1);
    expect(deletes[0]).toMatch(/EXISTS \(SELECT 1 FROM occupation_tools t/);
    expect(deletes[0]).toMatch(/t\.occupation_id = \$1/);
  });

  it('drops duplicates before moving, so the move cannot collide', () => {
    const dropAt = mergeHandler.search(/DELETE FROM occupation_tools/);
    const moveAt = mergeHandler.search(/UPDATE occupation_tools SET occupation_id/);
    expect(dropAt).toBeGreaterThan(-1);
    expect(moveAt).toBeGreaterThan(dropAt);
  });

  it('runs in one transaction and rolls back on failure', () => {
    expect(mergeHandler).toMatch(/BEGIN/);
    expect(mergeHandler).toMatch(/COMMIT/);
    expect((mergeHandler.match(/ROLLBACK/g) || []).length).toBeGreaterThanOrEqual(2);
    expect(mergeHandler).toMatch(/client\.release\(\)/);
  });

  it('cannot merge an occupation into itself', () => {
    expect(mergeHandler).toMatch(/n !== targetId/);
  });

  it('rejects a request with no valid sources', () => {
    expect(mergeHandler).toMatch(/at least one other occupation to merge/);
  });

  it('is restricted to admins', () => {
    expect(mergeHandler).toMatch(/preHandler: requireAdmin/);
  });

  it('leaves name_in_letter alone', () => {
    // What the client called the trade is worth keeping after unification.
    expect(mergeHandler).not.toMatch(/name_in_letter/);
  });

  it('exposes usage counts so the survivor can be chosen on evidence', () => {
    expect(source).toMatch(/fastify\.get\('\/usage'/);
    expect(source).toMatch(/assignment_occupations ao ON ao\.ctevt_occupation_id = o\.id/);
    expect(source).toMatch(/occupation_tools ot\s+ON ot\.occupation_id = o\.id/);
  });
});

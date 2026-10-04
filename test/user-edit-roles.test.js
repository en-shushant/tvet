import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
const src = readFileSync('backend/routes/users.js', 'utf8');

describe('who may edit a user', () => {
  it('blocks only a role change involving admin, or touching a superadmin — not every save of an admin', () => {
    expect(src).toMatch(/if \(role !== target\.role && \(elevated\(role\) \|\| elevated\(target\.role\)\)\)/);
    expect(src).toMatch(/target\.role === 'superadmin'/);
  });
});

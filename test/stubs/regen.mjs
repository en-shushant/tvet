// Regenerates material.js from whatever src/md.jsx currently imports.
// Run with: node test/stubs/regen.mjs
import { readFileSync, writeFileSync } from 'node:fs';
const src = readFileSync(new URL('../../src/md.jsx', import.meta.url), 'utf8');
const names = new Set();
for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*'@material\/web\/[^']*'/g)) {
  for (const n of m[1].split(',')) {
    const name = n.trim().split(' as ')[0].trim();
    if (name) names.add(name);
  }
}
const out = `class StubElement {}\n\n${[...names].sort().map(n => `export const ${n} = StubElement;`).join('\n')}\nexport default StubElement;\n`;
writeFileSync(new URL('./material.js', import.meta.url), out);
console.log(`material.js regenerated with ${names.size} exports`);

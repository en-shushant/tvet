/**
 * Deliberately narrow: this is a correctness net, not a style guide.
 *
 * Four separate faults reached production from splitting large files, every one
 * of them a name used without being imported — instToAPI, getSession, useRef,
 * fmtDate. Vite resolves imports but never checks identifiers, and the smoke
 * tests only mount, so a reference on a save or generate path stays invisible
 * until someone clicks it.
 *
 * `no-undef` is the rule that catches all four. Style rules are left off on
 * purpose: turning them on across a codebase this size would produce thousands
 * of findings and the useful signal would drown.
 */
import globals from 'globals';

export default [
  // Built bundles, not source.
  { ignores: ['backend/public/**', 'dist/**'] },
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2021 },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-undef': 'error',
    },
  },
  {
    files: ['backend/**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      'no-undef': 'error',
    },
  },
];

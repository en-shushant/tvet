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
 *
 * `react-hooks/rules-of-hooks` is here for the same reason. A useState declared
 * below App's early returns for the login/loading/error states changed the hook
 * count between renders and white-screened the whole app on cold load — the
 * "refresh two or three times before it appears" bug. It is a crash, not a
 * style opinion, and the rule has effectively no false positives.
 * `exhaustive-deps` stays off: that one *is* advisory and would drown the
 * signal, exactly like the style rules above.
 */
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

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
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'no-undef': 'error',
      'react-hooks/rules-of-hooks': 'error',
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

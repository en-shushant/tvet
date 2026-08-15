import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * Test config, separate from vite.config.js so the production build is
 * untouched by anything here.
 *
 * @material/web is stubbed. Its components are Lit custom elements that expect
 * a real browser (adopted stylesheets, ElementInternals, form association) and
 * fall over in jsdom. Stubbing them is not a loss of coverage: the smoke test
 * exists to catch faults in *our* screens — a memo reading a variable above its
 * declaration, a bad prop, a column that does not exist — not to re-test
 * Google's component library.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^@material\/web\/.*/, replacement: path.resolve('./test/stubs/material.js') },
      { find: '@lit/react', replacement: path.resolve('./test/stubs/lit-react.js') },
    ],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.js'],
    include: ['test/**/*.test.{js,jsx}'],
  },
});

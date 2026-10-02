import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
      '@engine': fileURLToPath(new URL('./src/engine', import.meta.url)),
      '@ui': fileURLToPath(new URL('./src/ui', import.meta.url)),
      '@data': fileURLToPath(new URL('./src/data', import.meta.url)),
      // The data pipeline lives in scripts/ and owns the area definitions and the
      // source-spacing guard, both of which the DEM tests assert against. Aliased
      // rather than imported by relative path so the tests do not depend on how
      // deep in the tree they sit.
      '@pipeline': fileURLToPath(new URL('./scripts', import.meta.url)),
    },
  },
  test: {
    // Engine and shared tests run in plain Node - no DOM. That is the whole
    // point of the architecture rule in AGENTS.md section 3: simulations are
    // testable headlessly. A test that needs a DOM declares it inline with a
    // `@vitest-environment jsdom` docblock, so nothing can quietly come to
    // depend on a browser existing.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});

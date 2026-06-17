import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Unit-test config. Targets the PURE business-logic engines (no I/O), so the
// default `node` environment is enough — no Next/React/jsdom needed.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    // Pure engines only for now; UI/integration tests can widen this later.
    exclude: ['node_modules/**', 'supabase/**', '.next/**'],
  },
});

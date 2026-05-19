import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Mirrors the `@/*` path alias from tsconfig.json so test files can import the
// same way the production code does. Tests live next to the code they cover
// (`*.test.ts`) so a feature folder stays one find-in-files away.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'jobs/**/*.test.ts', 'tests/**/*.test.ts'],
    // Exclude Next.js build output + node_modules so a stale .next/ doesn't
    // pollute the test set. Also exclude the pre-existing `__tests__/`
    // suites under lib/billing/ — those use the Node native test runner
    // (`node:test`) and aren't compatible with vitest's discovery.
    exclude: ['node_modules/**', '.next/**', '**/__tests__/**'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})

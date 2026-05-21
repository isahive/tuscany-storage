import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// Two-project setup so unit tests for libs (pure Node) and component tests
// (React + DOM) run in the right environment without one slowing the other
// down. The `@/*` alias mirrors tsconfig.json paths so imports look the same
// as production code.
//
// Layout:
//   lib/**/*.test.ts           → Node env, fast
//   jobs/**/*.test.ts          → Node env
//   tests/unit/**/*.test.ts    → Node env (API route handlers, services)
//   tests/components/**/*.test.tsx → happy-dom env (React + testing-library)
//
// Coverage thresholds live here too — start low, raise as the suite grows.

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    // Exclude pre-existing `__tests__/` folders under lib/billing — they use
    // node:test, not vitest, and would double-run otherwise.
    exclude: ['node_modules/**', '.next/**', '**/__tests__/**', 'e2e/**', 'playwright-report/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary', 'lcov'],
      reportsDirectory: './coverage',
      include: ['lib/**/*.ts', 'app/api/**/*.ts', 'jobs/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/*.d.ts',
        '**/types.ts',
        'lib/billing/__tests__/**',
      ],
      // Keep thresholds modest at the start so a single failing file doesn't
      // mask coverage growth. Raise quarterly as the matrix in docs/TESTING.md
      // gets checked off.
      thresholds: {
        statements: 30,
        branches: 30,
        functions: 30,
        lines: 30,
      },
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: [
            'lib/**/*.test.ts',
            'jobs/**/*.test.ts',
            'tests/unit/**/*.test.ts',
          ],
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          environment: 'happy-dom',
          include: ['tests/components/**/*.test.{ts,tsx}'],
        },
      },
    ],
  },
})

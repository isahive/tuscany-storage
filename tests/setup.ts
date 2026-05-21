import { afterEach, vi } from 'vitest'

// jest-dom matchers (toBeInTheDocument, toHaveTextContent, etc.) — only
// resolved in the dom project but importing here is harmless under node.
import '@testing-library/jest-dom/vitest'

// Sensible defaults for any test that touches code reading these envs at
// import time. Override per-test with `vi.stubEnv` when behavior depends on
// the value.
process.env.NEXTAUTH_URL ??= 'http://localhost:3000'
process.env.NEXTAUTH_SECRET ??= 'test-secret'
process.env.NEXT_PUBLIC_APP_URL ??= 'http://localhost:3000'
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/tuscany-storage-test'
// NODE_ENV is read-only under recent @types/node; assign through the
// indexer so TS doesn't reject it. Vitest already sets it to 'test'.
;(process.env as Record<string, string>).NODE_ENV ??= 'test'

// Auto-clean DOM + mocks between tests so accidental cross-test pollution
// surfaces as a missing setup step, not a flaky failure.
afterEach(async () => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  if (typeof document !== 'undefined') {
    const { cleanup } = await import('@testing-library/react')
    cleanup()
  }
})

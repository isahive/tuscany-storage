import type { Session } from 'next-auth'

/**
 * Session helpers — pair these with a top-level
 *   vi.mock('next-auth', async () => { ... })
 * in your test file. mockServerSession() was moved out because vi.mock calls
 * inside helpers don't get hoisted to the test file's top level.
 *
 * Usage:
 *   import { getServerSession } from 'next-auth'
 *   import { vi } from 'vitest'
 *   vi.mocked(getServerSession).mockResolvedValueOnce(adminSession())
 */

export function adminSession(id = '507f1f77bcf86cd799439011'): Session {
  return {
    expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    user: { id, role: 'admin', email: 'admin@test.local', name: 'Test Admin' } as Session['user'],
  }
}

export function tenantSession(id: string, name = 'Test Tenant'): Session {
  return {
    expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    user: { id, role: 'tenant', email: 'tenant@test.local', name } as Session['user'],
  }
}

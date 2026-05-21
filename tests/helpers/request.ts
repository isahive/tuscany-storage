import { NextRequest } from 'next/server'

/**
 * Build a NextRequest that App Router route handlers will accept.
 * Body is JSON-encoded automatically when provided.
 *
 * Usage:
 *   const req = makeRequest('POST', '/api/move-out', { leaseId, requestedMoveOutDate: ... })
 *   const res = await POST(req)
 *   const json = await res.json()
 */
export function makeRequest(
  method: string,
  url: string,
  body?: unknown,
  init: RequestInit = {},
): NextRequest {
  const fullUrl = url.startsWith('http') ? url : `http://localhost:3000${url}`
  const headers = new Headers({ 'content-type': 'application/json', ...(init.headers as Record<string, string>) })
  // Cast through unknown — NextRequest's RequestInit narrows `signal` to
  // exclude null, while DOM RequestInit allows it. Tests never pass a
  // signal so the values are compatible.
  return new NextRequest(fullUrl, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...init,
  } as unknown as ConstructorParameters<typeof NextRequest>[1])
}

/** Awaits and parses JSON from a route handler Response. */
export async function readJson<T = unknown>(res: Response): Promise<T> {
  return (await res.json()) as T
}

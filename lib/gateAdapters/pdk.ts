/**
 * Domain operations against the PDK API surfaced as plain functions.
 *
 * Why a thin layer over `pdkFetch`: callers (sync helpers, jobs, webhook
 * handler, admin routes) think in terms of "create a holder for this tenant"
 * or "disable this holder", not "PATCH /holders/{id}". This module is the only
 * place that knows the wire shape — if PDK changes a path or field name we
 * fix it in one file.
 *
 * All functions throw on non-2xx. Callers decide whether to swallow or retry;
 * we don't want a silent failure here because that masks gate-access drift,
 * which is the worst failure mode for this integration (tenant locked out
 * with no signal in the logs).
 */
import { pdkFetch } from '@/lib/pdkAuth'

export interface PdkHolder {
  id: string
  firstName: string
  lastName: string
  email?: string
  pin?: string
  enabled: boolean
  groups?: string[]
  partition?: string
}

export interface NewHolderInput {
  firstName: string
  lastName: string
  email?: string
  pin?: string
  /** Defaults to true. Pass false to provision a tenant whose access is
   *  pre-revoked (e.g. lease signed but balance unpaid). */
  enabled?: boolean
  groups?: string[]
}

async function readJsonOrThrow<T>(res: Response, op: string): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`PDK ${op} failed: ${res.status} ${body}`)
  }
  return (await res.json()) as T
}

export async function createHolder(input: NewHolderInput): Promise<PdkHolder> {
  const res = await pdkFetch('/holders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      firstName: input.firstName,
      lastName: input.lastName,
      ...(input.email ? { email: input.email } : {}),
      ...(input.pin ? { pin: input.pin } : {}),
      enabled: input.enabled ?? true,
      ...(input.groups ? { groups: input.groups } : {}),
    }),
  })
  return readJsonOrThrow<PdkHolder>(res, 'createHolder')
}

export async function getHolder(holderId: string): Promise<PdkHolder> {
  const res = await pdkFetch(`/holders/${holderId}`)
  return readJsonOrThrow<PdkHolder>(res, 'getHolder')
}

export async function listHolders(): Promise<PdkHolder[]> {
  const res = await pdkFetch('/holders')
  return readJsonOrThrow<PdkHolder[]>(res, 'listHolders')
}

export async function updateHolderPin(
  holderId: string,
  pin: string | null,
): Promise<void> {
  const res = await pdkFetch(`/holders/${holderId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`PDK updateHolderPin failed: ${res.status} ${body}`)
  }
}

export async function setHolderEnabled(
  holderId: string,
  enabled: boolean,
): Promise<void> {
  const res = await pdkFetch(`/holders/${holderId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`PDK setHolderEnabled failed: ${res.status} ${body}`)
  }
}

export async function deleteHolder(holderId: string): Promise<void> {
  const res = await pdkFetch(`/holders/${holderId}`, { method: 'DELETE' })
  // PDK returns 204 on successful delete; 404 is treated as already-gone
  // because callers (move-out flow, reconcile) want delete to be idempotent.
  if (!res.ok && res.status !== 404) {
    const body = await res.text().catch(() => '')
    throw new Error(`PDK deleteHolder failed: ${res.status} ${body}`)
  }
}

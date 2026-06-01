import { describe, it, expect, vi, beforeEach } from 'vitest'

const { pdkFetchMock } = vi.hoisted(() => ({ pdkFetchMock: vi.fn() }))
vi.mock('@/lib/pdkAuth', () => ({ pdkFetch: pdkFetchMock }))

import {
  createHolder,
  getHolder,
  listHolders,
  updateHolderPin,
  setHolderEnabled,
  deleteHolder,
  createGroup,
  getGroup,
  listGroups,
  deleteGroup,
  addHolderToGroup,
  removeHolderFromGroup,
  createGroupRule,
  listGroupRules,
  updateGroupRule,
  deleteGroupRule,
} from './pdk'
import type { NewAccessRule } from './pdk'

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  pdkFetchMock.mockReset()
})

describe('createHolder', () => {
  it('POSTs the holder body and returns the created holder', async () => {
    const holder = { id: 'h1', firstName: 'New', lastName: 'Tenant', enabled: true }
    pdkFetchMock.mockResolvedValueOnce(jsonRes(holder, 201))

    const result = await createHolder({
      firstName: 'New', lastName: 'Tenant', pin: '1234', email: 'n@e.com',
    })
    expect(result).toEqual(holder)

    const [path, init] = pdkFetchMock.mock.calls[0]
    expect(path).toBe('/holders')
    expect((init as RequestInit).method).toBe('POST')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body).toMatchObject({
      firstName: 'New', lastName: 'Tenant', pin: '1234', email: 'n@e.com', enabled: true,
    })
  })

  it('defaults enabled to true when not specified', async () => {
    pdkFetchMock.mockResolvedValueOnce(jsonRes({ id: 'h2', firstName: 'A', lastName: 'B', enabled: true }))
    await createHolder({ firstName: 'A', lastName: 'B' })
    const body = JSON.parse((pdkFetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.enabled).toBe(true)
  })

  it('omits pin and email from payload when not provided', async () => {
    pdkFetchMock.mockResolvedValueOnce(jsonRes({ id: 'h3', firstName: 'A', lastName: 'B', enabled: true }))
    await createHolder({ firstName: 'A', lastName: 'B' })
    const body = JSON.parse((pdkFetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect('pin' in body).toBe(false)
    expect('email' in body).toBe(false)
  })

  it('throws on non-2xx with the response body in the message', async () => {
    pdkFetchMock.mockResolvedValueOnce(new Response('email already exists', { status: 409 }))
    await expect(createHolder({ firstName: 'A', lastName: 'B' })).rejects.toThrow(/409.*email already exists/)
  })
})

describe('getHolder', () => {
  it('GETs the holder by id', async () => {
    pdkFetchMock.mockResolvedValueOnce(jsonRes({ id: 'h1', firstName: 'X', lastName: 'Y', enabled: true, pin: '4444' }))
    const h = await getHolder('h1')
    expect(h.pin).toBe('4444')
    expect(pdkFetchMock.mock.calls[0][0]).toBe('/holders/h1')
  })

  it('throws on 404', async () => {
    pdkFetchMock.mockResolvedValueOnce(new Response('not found', { status: 404 }))
    await expect(getHolder('missing')).rejects.toThrow(/404/)
  })
})

describe('listHolders', () => {
  it('returns the array as-is', async () => {
    pdkFetchMock.mockResolvedValueOnce(jsonRes([
      { id: 'h1', firstName: 'A', lastName: 'B', enabled: true },
      { id: 'h2', firstName: 'C', lastName: 'D', enabled: false },
    ]))
    const list = await listHolders()
    expect(list).toHaveLength(2)
  })
})

describe('updateHolderPin', () => {
  it('PATCHes the holder with new pin', async () => {
    pdkFetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await updateHolderPin('h1', '9876')
    const [path, init] = pdkFetchMock.mock.calls[0]
    expect(path).toBe('/holders/h1')
    expect((init as RequestInit).method).toBe('PATCH')
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ pin: '9876' })
  })

  it('sends pin=null to clear it (revoke PIN access)', async () => {
    pdkFetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await updateHolderPin('h1', null)
    expect(JSON.parse((pdkFetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({ pin: null })
  })

  it('throws on failure', async () => {
    pdkFetchMock.mockResolvedValueOnce(new Response('bad pin', { status: 400 }))
    await expect(updateHolderPin('h1', '99')).rejects.toThrow(/400/)
  })
})

describe('setHolderEnabled', () => {
  it('PATCHes enabled flag', async () => {
    pdkFetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await setHolderEnabled('h1', false)
    expect(JSON.parse((pdkFetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({ enabled: false })
  })
})

describe('deleteHolder', () => {
  it('DELETEs the holder and returns void on 204', async () => {
    pdkFetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await expect(deleteHolder('h1')).resolves.toBeUndefined()
    expect((pdkFetchMock.mock.calls[0][1] as RequestInit).method).toBe('DELETE')
  })

  it('treats 404 as already-gone (idempotent)', async () => {
    pdkFetchMock.mockResolvedValueOnce(new Response('gone', { status: 404 }))
    await expect(deleteHolder('missing')).resolves.toBeUndefined()
  })

  it('throws on 500', async () => {
    pdkFetchMock.mockResolvedValueOnce(new Response('boom', { status: 500 }))
    await expect(deleteHolder('h1')).rejects.toThrow(/500/)
  })
})

describe('createGroup', () => {
  it('POSTs the group name', async () => {
    pdkFetchMock.mockResolvedValueOnce(jsonRes({ id: 'g1', name: 'Tenants' }, 200))
    const g = await createGroup('Tenants')
    expect(g.id).toBe('g1')
    const [path, init] = pdkFetchMock.mock.calls[0]
    expect(path).toBe('/groups')
    expect((init as RequestInit).method).toBe('POST')
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ name: 'Tenants' })
  })

  it('includes partition when provided', async () => {
    pdkFetchMock.mockResolvedValueOnce(jsonRes({ id: 'g2', name: 'X', partition: 'p1' }))
    await createGroup('X', 'p1')
    expect(JSON.parse((pdkFetchMock.mock.calls[0][1] as RequestInit).body as string))
      .toEqual({ name: 'X', partition: 'p1' })
  })

  it('throws on failure', async () => {
    pdkFetchMock.mockResolvedValueOnce(new Response('dup', { status: 409 }))
    await expect(createGroup('Tenants')).rejects.toThrow(/409/)
  })
})

describe('getGroup / listGroups / deleteGroup', () => {
  it('GETs group by id', async () => {
    pdkFetchMock.mockResolvedValueOnce(jsonRes({ id: 'g1', name: 'X' }))
    const g = await getGroup('g1')
    expect(g.id).toBe('g1')
    expect(pdkFetchMock.mock.calls[0][0]).toBe('/groups/g1')
  })

  it('lists all groups', async () => {
    pdkFetchMock.mockResolvedValueOnce(jsonRes([{ id: 'g1', name: 'A' }, { id: 'g2', name: 'B' }]))
    expect(await listGroups()).toHaveLength(2)
  })

  it('deleteGroup treats 404 as idempotent', async () => {
    pdkFetchMock.mockResolvedValueOnce(new Response('gone', { status: 404 }))
    await expect(deleteGroup('missing')).resolves.toBeUndefined()
  })
})

describe('addHolderToGroup', () => {
  it('PUTs to /holders/{hid}/groups/{gid}', async () => {
    pdkFetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await addHolderToGroup('h1', 'g1')
    const [path, init] = pdkFetchMock.mock.calls[0]
    expect(path).toBe('/holders/h1/groups/g1')
    expect((init as RequestInit).method).toBe('PUT')
  })

  it('treats 409 (already a member) as success', async () => {
    pdkFetchMock.mockResolvedValueOnce(new Response('already member', { status: 409 }))
    await expect(addHolderToGroup('h1', 'g1')).resolves.toBeUndefined()
  })

  it('throws on 500', async () => {
    pdkFetchMock.mockResolvedValueOnce(new Response('boom', { status: 500 }))
    await expect(addHolderToGroup('h1', 'g1')).rejects.toThrow(/500/)
  })
})

describe('removeHolderFromGroup', () => {
  it('DELETEs the membership', async () => {
    pdkFetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await removeHolderFromGroup('h1', 'g1')
    expect((pdkFetchMock.mock.calls[0][1] as RequestInit).method).toBe('DELETE')
  })

  it('treats 404 (not a member) as idempotent', async () => {
    pdkFetchMock.mockResolvedValueOnce(new Response('not member', { status: 404 }))
    await expect(removeHolderFromGroup('h1', 'g1')).resolves.toBeUndefined()
  })
})

describe('createGroupRule', () => {
  const RULE: NewAccessRule = {
    devices: ['d1', 'd2'],
    authenticationPolicy: 'pinOnly',
    startTime: '05:00',
    stopTime: '22:00',
    recurring: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  }

  it('POSTs with type=access, allow=true defaults, and the full body', async () => {
    pdkFetchMock.mockResolvedValueOnce(jsonRes({ id: 'r1', type: 'access', allow: true, ...RULE }))
    const r = await createGroupRule('g1', RULE)
    expect(r.id).toBe('r1')

    const [path, init] = pdkFetchMock.mock.calls[0]
    expect(path).toBe('/groups/g1/rules')
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body).toEqual({
      type: 'access',
      allow: true,
      devices: ['d1', 'd2'],
      authenticationPolicy: 'pinOnly',
      startTime: '05:00',
      stopTime: '22:00',
      recurring: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    })
  })

  it('passes through allow=false when explicitly set (deny rule)', async () => {
    pdkFetchMock.mockResolvedValueOnce(jsonRes({ id: 'r2', type: 'access', allow: false, ...RULE }))
    await createGroupRule('g1', { ...RULE, allow: false })
    const body = JSON.parse((pdkFetchMock.mock.calls[0][1] as RequestInit).body as string)
    expect(body.allow).toBe(false)
  })
})

describe('listGroupRules / updateGroupRule / deleteGroupRule', () => {
  it('lists rules for the group', async () => {
    pdkFetchMock.mockResolvedValueOnce(jsonRes([{ id: 'r1' }, { id: 'r2' }]))
    expect(await listGroupRules('g1')).toHaveLength(2)
    expect(pdkFetchMock.mock.calls[0][0]).toBe('/groups/g1/rules')
  })

  it('PUTs to update with the rule body', async () => {
    pdkFetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await updateGroupRule('g1', 'r1', {
      devices: ['d1'],
      authenticationPolicy: 'pinOnly',
      startTime: '00:00',
      stopTime: '23:59',
      recurring: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    })
    const [path, init] = pdkFetchMock.mock.calls[0]
    expect(path).toBe('/groups/g1/rules/r1')
    expect((init as RequestInit).method).toBe('PUT')
    expect(JSON.parse((init as RequestInit).body as string).startTime).toBe('00:00')
  })

  it('deleteGroupRule treats 404 as idempotent', async () => {
    pdkFetchMock.mockResolvedValueOnce(new Response('gone', { status: 404 }))
    await expect(deleteGroupRule('g1', 'missing')).resolves.toBeUndefined()
  })
})

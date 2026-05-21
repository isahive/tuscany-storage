import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const { useSessionMock } = vi.hoisted(() => ({
  useSessionMock: vi.fn(() => ({
    data: { user: { id: 'tenant-1', email: 't@x.com' }, expires: 'never' },
    status: 'authenticated',
  })),
}))
vi.mock('next-auth/react', () => ({ useSession: useSessionMock }))

import ProfilePage from '@/app/portal/profile/page'

function mockFetchSequence(responses: Array<{ ok?: boolean; status?: number; body: unknown }>) {
  const queue = [...responses]
  vi.stubGlobal('fetch', vi.fn(async () => {
    const next = queue.shift()
    if (!next) throw new Error('fetch over-called')
    return {
      ok: next.ok ?? true,
      status: next.status ?? 200,
      json: async () => next.body,
    } as unknown as Response
  }))
}

const settingsAllow = { success: true, data: { customersCanEditProfile: true } }
const settingsDeny  = { success: true, data: { customersCanEditProfile: false } }
const tenantBody = {
  success: true,
  data: {
    firstName: 'Ada', lastName: 'Lovelace',
    email: 'ada@x.com', phone: '555-1212',
    alternatePhone: '', alternateEmail: '',
    address: '123 Main', city: 'Townsville', state: 'TN', zip: '37714',
  },
}

describe('<ProfilePage>', () => {
  beforeEach(() => { useSessionMock.mockClear() })

  it('shows the loaded profile name', async () => {
    mockFetchSequence([{ body: settingsAllow }, { body: tenantBody }])
    await act(async () => { render(<ProfilePage />) })
    expect(await screen.findByDisplayValue('Ada')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Lovelace')).toBeInTheDocument()
  })

  it('Edit button visible when customersCanEditProfile is true', async () => {
    mockFetchSequence([{ body: settingsAllow }, { body: tenantBody }])
    await act(async () => { render(<ProfilePage />) })
    expect(await screen.findByRole('button', { name: /Edit/i })).toBeInTheDocument()
  })

  it('Edit button hidden when customersCanEditProfile is false', async () => {
    mockFetchSequence([{ body: settingsDeny }, { body: tenantBody }])
    await act(async () => { render(<ProfilePage />) })
    await screen.findByDisplayValue('Ada')
    expect(screen.queryByRole('button', { name: /^Edit$/i })).toBeNull()
  })

  it('saves the form via PATCH when user changes a field', async () => {
    mockFetchSequence([
      { body: settingsAllow },
      { body: tenantBody },
      { body: { success: true, data: { ...tenantBody.data, phone: '555-9999' } } },
    ])
    await act(async () => { render(<ProfilePage />) })
    await screen.findByDisplayValue('Ada')

    await userEvent.click(screen.getByRole('button', { name: /Edit/i }))
    const phone = screen.getByDisplayValue('555-1212')
    await userEvent.clear(phone)
    await userEvent.type(phone, '555-9999')
    await userEvent.click(screen.getByRole('button', { name: /Save/i }))

    await waitFor(() => expect(screen.getByDisplayValue('555-9999')).toBeInTheDocument())
  })
})

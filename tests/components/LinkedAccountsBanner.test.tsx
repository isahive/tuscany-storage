import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import LinkedAccountsBanner from '@/components/admin/LinkedAccountsBanner'

function mockFetchSequence(responses: Array<{ ok?: boolean; body: unknown }>) {
  const queue = [...responses]
  vi.stubGlobal('fetch', vi.fn(async () => {
    const next = queue.shift()
    if (!next) throw new Error('fetch over-called')
    return { ok: next.ok ?? true, json: async () => next.body } as unknown as Response
  }))
}

describe('<LinkedAccountsBanner>', () => {
  it('renders nothing when there are no linked accounts', async () => {
    mockFetchSequence([{ body: { success: true, data: { linked: [] } } }])
    const { container } = await act(async () => render(<LinkedAccountsBanner tenantId="t-1" />))
    await waitFor(() => expect(container.querySelector('.MuiAlert-root')).toBeNull())
  })

  it('lists one linked account with a singular header', async () => {
    mockFetchSequence([{
      body: {
        success: true,
        data: { linked: [{ id: 't-2', firstName: 'Bob', lastName: 'Smith' }] },
      },
    }])
    await act(async () => render(<LinkedAccountsBanner tenantId="t-1" />))
    expect(await screen.findByText(/also has 1 linked account$/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Bob Smith/i })).toHaveAttribute('href', '/admin/tenants/t-2')
  })

  it('uses plural header for two or more accounts', async () => {
    mockFetchSequence([{
      body: {
        success: true,
        data: {
          linked: [
            { id: 't-2', firstName: 'Bob', lastName: 'Smith' },
            { id: 't-3', firstName: 'Carol', lastName: 'Jones' },
          ],
        },
      },
    }])
    await act(async () => render(<LinkedAccountsBanner tenantId="t-1" />))
    expect(await screen.findByText(/also has 2 linked accounts/i)).toBeInTheDocument()
  })

  it('renders nothing when the API call fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network down') }))
    const { container } = await act(async () => render(<LinkedAccountsBanner tenantId="t-1" />))
    expect(container.querySelector('.MuiAlert-root')).toBeNull()
  })
})

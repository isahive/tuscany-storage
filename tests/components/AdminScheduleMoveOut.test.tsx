import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), refresh: vi.fn() }),
  useParams: () => ({ id: 'tenant-1' }),
  useSearchParams: () => new URLSearchParams('leaseId=lease-1'),
  usePathname: () => '/admin/tenants/tenant-1/schedule-move-out',
}))

import ScheduleMoveOutPage from '@/app/admin/tenants/[id]/schedule-move-out/page'

function mockFetchSequence(responses: Array<{ ok?: boolean; status?: number; body: unknown }>) {
  const queue = [...responses]
  vi.stubGlobal('fetch', vi.fn(async () => {
    const next = queue.shift()
    if (!next) throw new Error('fetch called more than expected')
    return {
      ok: next.ok ?? true,
      status: next.status ?? 200,
      json: async () => next.body,
    } as unknown as Response
  }))
}

const leasesOk = {
  success: true,
  data: { items: [{ _id: 'lease-1', unitId: { unitNumber: 'B12' } }] },
}

describe('<ScheduleMoveOutPage>', () => {
  beforeEach(() => { pushMock.mockReset() })

  it('renders unit label after loading the lease', async () => {
    mockFetchSequence([{ body: leasesOk }])
    await act(async () => { render(<ScheduleMoveOutPage />) })
    expect(await screen.findByText(/Schedule Move Out of Unit B12/)).toBeInTheDocument()
  })

  it('submits with the leaseId in the payload and redirects to tenant detail', async () => {
    mockFetchSequence([
      { body: leasesOk },
      { body: { success: true } },
    ])
    await act(async () => { render(<ScheduleMoveOutPage />) })
    await screen.findByText(/Schedule Move Out of Unit B12/)

    await userEvent.click(screen.getByRole('button', { name: /^Schedule Move Out$/ }))

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/admin/tenants/tenant-1'))
  })

  it('surfaces server errors instead of redirecting', async () => {
    mockFetchSequence([
      { body: leasesOk },
      { body: { success: false, error: 'A pending move-out already exists.' }, ok: false, status: 409 },
    ])
    await act(async () => { render(<ScheduleMoveOutPage />) })
    await screen.findByText(/Schedule Move Out of Unit B12/)

    await userEvent.click(screen.getByRole('button', { name: /^Schedule Move Out$/ }))

    expect(await screen.findByText(/already exists/)).toBeInTheDocument()
    expect(pushMock).not.toHaveBeenCalled()
  })
})

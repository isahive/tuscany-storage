import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), refresh: vi.fn() }),
  useParams: () => ({ id: 'tenant-1' }),
  useSearchParams: () => new URLSearchParams('moveOutId=mo-1'),
  usePathname: () => '/admin/tenants/tenant-1/finalize-move-out',
}))

import FinalizeMoveOutPage from '@/app/admin/tenants/[id]/finalize-move-out/page'

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

const loadOk = { success: true, data: [{ _id: 'mo-1', unitId: { unitNumber: 'G5' } }] }

describe('<FinalizeMoveOutPage>', () => {
  beforeEach(() => { pushMock.mockReset() })

  it('renders unit status select with Available default + archive checkbox', async () => {
    mockFetchSequence([{ body: loadOk }])
    await act(async () => { render(<FinalizeMoveOutPage />) })
    expect(await screen.findByText(/Finalize Move Out of Unit G5/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Unit Status/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Archive Customer After Move Out/)).toBeInTheDocument()
  })

  it('posts unit status + archive flag and redirects to the receipt page', async () => {
    mockFetchSequence([
      { body: loadOk },
      { body: { success: true } },
    ])
    await act(async () => { render(<FinalizeMoveOutPage />) })
    await screen.findByText(/Finalize Move Out of Unit G5/)

    await userEvent.click(screen.getByLabelText(/Archive Customer After Move Out/))
    await userEvent.click(screen.getByRole('button', { name: /^Finalize Move Out$/ }))

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(
        '/admin/tenants/tenant-1/move-out-receipt?moveOutId=mo-1',
      ),
    )
  })

  it('surfaces server errors and stays on the page', async () => {
    mockFetchSequence([
      { body: loadOk },
      { body: { success: false, error: 'Lease already ended' }, ok: false, status: 409 },
    ])
    await act(async () => { render(<FinalizeMoveOutPage />) })
    await screen.findByText(/Finalize Move Out of Unit G5/)

    await userEvent.click(screen.getByRole('button', { name: /^Finalize Move Out$/ }))

    expect(await screen.findByText(/Lease already ended/)).toBeInTheDocument()
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('renders "Finalize Later" link back to the tenant detail page', async () => {
    mockFetchSequence([{ body: loadOk }])
    await act(async () => { render(<FinalizeMoveOutPage />) })
    await screen.findByText(/Finalize Move Out of Unit G5/)
    const link = screen.getByRole('link', { name: /Finalize Later/i })
    expect(link).toHaveAttribute('href', '/admin/tenants/tenant-1')
  })
})

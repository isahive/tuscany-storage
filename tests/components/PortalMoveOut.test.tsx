import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mocks must be hoisted, so they live at the top of the file.
const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams('leaseId=lease-1'),
  usePathname: () => '/portal/move-out',
}))

import MoveOutPage from '@/app/portal/move-out/page'

const dashboardOk = {
  success: true,
  data: { rentals: [{ leaseId: 'lease-1', unitNumber: 'G5', status: 'active' }] },
}

interface FakeResponseSpec {
  ok?: boolean
  status?: number
  body: unknown
}

function mockFetchSequence(responses: FakeResponseSpec[]) {
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

describe('<MoveOutPage>', () => {
  beforeEach(() => { pushMock.mockReset() })

  it('renders the rental unit and a today-as-minimum date input', async () => {
    mockFetchSequence([{ body: dashboardOk }])
    render(<MoveOutPage />)
    expect(await screen.findByText(/Request Move Out of Unit G5/)).toBeInTheDocument()
    const input = screen.getByLabelText(/Select requested move out date/) as HTMLInputElement
    // Match the page's local-time computation; toISOString() (UTC) drifts a
    // day around midnight and made this test flaky.
    const d = new Date()
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    expect(input.min).toBe(today)
  })

  it('submits the request and redirects to the dashboard with success', async () => {
    mockFetchSequence([
      { body: dashboardOk },
      { body: { success: true, data: { _id: 'mo-1' } }, status: 201 },
    ])
    render(<MoveOutPage />)
    await screen.findByText(/Request Move Out of Unit G5/)

    await userEvent.click(screen.getByRole('button', { name: /Request Move Out/ }))

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/portal?moveout=success'))
  })

  it('surfaces server errors without redirecting', async () => {
    mockFetchSequence([
      { body: dashboardOk },
      { body: { success: false, error: 'A pending move-out request already exists for this lease.' }, ok: false, status: 409 },
    ])
    render(<MoveOutPage />)
    await screen.findByText(/Request Move Out of Unit G5/)

    await userEvent.click(screen.getByRole('button', { name: /Request Move Out/ }))

    expect(await screen.findByText(/already exists/)).toBeInTheDocument()
    expect(pushMock).not.toHaveBeenCalled()
  })
})

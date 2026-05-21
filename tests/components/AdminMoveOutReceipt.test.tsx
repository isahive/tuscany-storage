import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), refresh: vi.fn() }),
  useParams: () => ({ id: 'tenant-1' }),
  useSearchParams: () => new URLSearchParams('moveOutId=mo-1'),
  usePathname: () => '/admin/tenants/tenant-1/move-out-receipt',
}))

import MoveOutReceiptPage from '@/app/admin/tenants/[id]/move-out-receipt/page'

function mockFetchSequence(responses: Array<{ ok?: boolean; status?: number; body?: unknown; blob?: Blob }>) {
  const queue = [...responses]
  vi.stubGlobal('fetch', vi.fn(async () => {
    const next = queue.shift()
    if (!next) throw new Error('fetch called more than expected')
    return {
      ok: next.ok ?? true,
      status: next.status ?? 200,
      json: async () => next.body,
      blob: async () => next.blob ?? new Blob(),
    } as unknown as Response
  }))
}

const receiptOk = {
  success: true,
  data: {
    tenant: { firstName: 'Silvio', lastName: 'Lorenzana', email: 'silvio@x.com', phone: '555-1212' },
    unitNumber: 'G5',
    balance: 0,
    template: {
      subject: 'Move-Out Confirmation — Tuscany',
      emailHtml: '<p>Hello Silvio, your unit G5 is closed.</p>',
      emailHtmlWrapped: '<html><body>Hello</body></html>',
      smsBody: 'Tuscany: Your unit G5 is closed.',
      emailEnabled: true,
      textEnabled: true,
    },
  },
}

describe('<MoveOutReceiptPage>', () => {
  beforeEach(() => { pushMock.mockReset() })

  it('renders subject + rendered email + SMS preview', async () => {
    mockFetchSequence([{ body: receiptOk }])
    await act(async () => { render(<MoveOutReceiptPage />) })
    expect(await screen.findByRole('heading', { name: /Unit G5 Move Out Receipt/ })).toBeInTheDocument()
    expect(screen.getByText(/Subject:/)).toBeInTheDocument()
    expect(screen.getByText(/Hello Silvio, your unit G5 is closed\./)).toBeInTheDocument()
    expect(screen.getByText(/Tuscany: Your unit G5 is closed\./)).toBeInTheDocument()
  })

  it('Send as Email button is enabled when email channel is on + tenant has email', async () => {
    mockFetchSequence([{ body: receiptOk }])
    await act(async () => { render(<MoveOutReceiptPage />) })
    await screen.findByRole('heading', { name: /Unit G5 Move Out Receipt/ })
    expect(screen.getByRole('button', { name: /Send as Email/i })).toBeEnabled()
    expect(screen.getByRole('button', { name: /Send as Text/i })).toBeEnabled()
  })

  it('disables Send as Email when template emailEnabled is false', async () => {
    mockFetchSequence([{
      body: {
        ...receiptOk,
        data: { ...receiptOk.data, template: { ...receiptOk.data.template, emailEnabled: false } },
      },
    }])
    await act(async () => { render(<MoveOutReceiptPage />) })
    await screen.findByRole('heading', { name: /Unit G5 Move Out Receipt/ })
    expect(screen.getByRole('button', { name: /Send as Email/i })).toBeDisabled()
  })

  it('hits the email endpoint and shows a success snackbar', async () => {
    mockFetchSequence([
      { body: receiptOk },
      { body: { success: true } },
    ])
    await act(async () => { render(<MoveOutReceiptPage />) })
    await screen.findByRole('heading', { name: /Unit G5 Move Out Receipt/ })

    await userEvent.click(screen.getByRole('button', { name: /Send as Email/i }))

    expect(await screen.findByText(/Receipt sent via email\./i)).toBeInTheDocument()
  })

  it('Return to Customer navigates back to the tenant page', async () => {
    mockFetchSequence([{ body: receiptOk }])
    await act(async () => { render(<MoveOutReceiptPage />) })
    await screen.findByRole('heading', { name: /Unit G5 Move Out Receipt/ })

    await userEvent.click(screen.getByRole('button', { name: /Return to Customer/i }))
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/admin/tenants/tenant-1'))
  })

  it('warns and links to /admin/communications/templates when template is null', async () => {
    mockFetchSequence([{ body: { ...receiptOk, data: { ...receiptOk.data, template: null } } }])
    await act(async () => { render(<MoveOutReceiptPage />) })
    await screen.findByRole('heading', { name: /Unit G5 Move Out Receipt/ })
    expect(screen.getByText(/template has not been seeded/i)).toBeInTheDocument()
  })
})

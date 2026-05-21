import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import SendResetLinkDialog from '@/components/admin/SendResetLinkDialog'

function mockFetch(body: unknown, ok = true) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok, json: async () => body } as unknown as Response)))
}

describe('<SendResetLinkDialog>', () => {
  beforeEach(() => {
    // jsdom-style navigator.clipboard is a frozen getter; define it directly.
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn(async () => undefined) },
    })
  })

  it('does not render when open is false', () => {
    render(<SendResetLinkDialog open={false} onClose={vi.fn()} tenantId="t-1" tenantEmail="x@y.com" />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renders the dialog with tenant email when open', () => {
    render(<SendResetLinkDialog open onClose={vi.fn()} tenantId="t-1" tenantEmail="silvio@example.com" />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/silvio@example\.com/)).toBeInTheDocument()
  })

  it('shows the URL + Copy + Emailed status on success', async () => {
    mockFetch({
      success: true,
      data: {
        url: 'http://localhost:3000/reset-password?token=abc',
        emailed: true,
        emailError: null,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
    })
    await act(async () =>
      render(<SendResetLinkDialog open onClose={vi.fn()} tenantId="t-1" tenantEmail="x@y.com" />),
    )

    await userEvent.click(screen.getByRole('button', { name: /Send|Generate/i }))

    await waitFor(() =>
      expect(screen.getByDisplayValue(/reset-password\?token=abc/)).toBeInTheDocument(),
    )
    expect(screen.getByText(/Reset email sent to x@y\.com/)).toBeInTheDocument()
  })

  it('shows an error message when the API returns success:false', async () => {
    mockFetch({ success: false, error: 'Tenant not found' }, false)
    await act(async () =>
      render(<SendResetLinkDialog open onClose={vi.fn()} tenantId="t-1" tenantEmail="x@y.com" />),
    )

    await userEvent.click(screen.getByRole('button', { name: /Send|Generate/i }))
    expect(await screen.findByText(/Tenant not found/)).toBeInTheDocument()
  })

  it('Close button calls onClose', async () => {
    const onClose = vi.fn()
    render(<SendResetLinkDialog open onClose={onClose} tenantId="t-1" tenantEmail="x@y.com" />)
    await userEvent.click(screen.getByRole('button', { name: /Close|Cancel/i }))
    expect(onClose).toHaveBeenCalled()
  })
})

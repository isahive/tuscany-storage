import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const { useSessionMock } = vi.hoisted(() => ({
  useSessionMock: vi.fn(() => ({
    data: { user: { id: 'tenant-1' }, expires: 'never' },
    status: 'authenticated',
  })),
}))
vi.mock('next-auth/react', () => ({ useSession: useSessionMock }))

// Stub Stripe Elements entirely — testing the Element iframe is impossible
// under happy-dom (cross-origin). We assert the surrounding component shell.
vi.mock('@stripe/stripe-js', () => ({ loadStripe: () => Promise.resolve(null) }))
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <div data-testid="stripe-elements">{children}</div>,
  CardElement: () => <div data-testid="stripe-card-element" />,
  useStripe: () => ({}),
  useElements: () => ({}),
}))

import BillingPage from '@/app/portal/billing/page'

function mockFetchSequence(responses: Array<{ ok?: boolean; body: unknown }>) {
  const queue = [...responses]
  vi.stubGlobal('fetch', vi.fn(async () => {
    const next = queue.shift()
    if (!next) throw new Error('fetch over-called')
    return { ok: next.ok ?? true, json: async () => next.body } as unknown as Response
  }))
}

const settingsBody = { success: true, data: { customersCanEditBilling: true } }
const billingBody = {
  success: true,
  data: {
    autopayEnabled: false,
    paymentMethod: null,
    hasStripe: false,
  },
}
const billingWithCard = {
  success: true,
  data: {
    autopayEnabled: true,
    paymentMethod: { id: 'pm_x', brand: 'visa', last4: '4242', expMonth: 12, expYear: 2030 },
    hasStripe: true,
  },
}

describe('<BillingPage>', () => {
  beforeEach(() => { useSessionMock.mockClear() })

  it('renders the autopay section with no card on file', async () => {
    mockFetchSequence([{ body: settingsBody }, { body: billingBody }])
    await act(async () => { render(<BillingPage />) })
    await waitFor(() => expect(screen.getByText(/Autopay|Recurring Billing/i)).toBeInTheDocument())
  })

  it('shows the existing card brand + last4 when a payment method is on file', async () => {
    mockFetchSequence([{ body: settingsBody }, { body: billingWithCard }])
    await act(async () => { render(<BillingPage />) })
    await waitFor(() => {
      expect(screen.getByText(/4242/)).toBeInTheDocument()
    })
  })

  it('hides controls when customersCanEditBilling is false', async () => {
    mockFetchSequence([
      { body: { success: true, data: { customersCanEditBilling: false } } },
      { body: billingBody },
    ])
    await act(async () => { render(<BillingPage />) })
    await waitFor(() => expect(screen.getByText(/Autopay|Recurring Billing/i)).toBeInTheDocument())
    // Add/update buttons should not be present
    expect(screen.queryByRole('button', { name: /Add (a )?Card|Update Card/i })).toBeNull()
  })
})

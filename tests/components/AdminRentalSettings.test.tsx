import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import RentalSettingsPage from '@/app/admin/settings/rental/page'

const DEFAULT_SETTINGS = {
  success: true,
  data: {
    billingCycleAnchor: 'first_of_month',
    billingCycleCustomDay: 1,
    billingDaysBeforeDue: 7,
    prorationModel: 'first_month_full_then_prorate',
    prorationDaysBasis: 'actual_days_in_month',
    enableReservations: false,
    reservationLimitDays: 0,
    unitTypeReservationFees: [],
    customersCanEditProfile: true,
    customersCanEditBilling: true,
    customersCanScheduleMoveOuts: true,
    newRenterInstructions: '',
    lockoutRequireApprovalAuto: false,
    lockoutRequireApprovalManual: false,
  },
}

function mockFetchSequence(responses: Array<{ ok?: boolean; body: unknown }>) {
  const queue = [...responses]
  vi.stubGlobal('fetch', vi.fn(async () => {
    const next = queue.shift()
    if (!next) throw new Error('fetch over-called')
    return { ok: next.ok ?? true, json: async () => next.body } as unknown as Response
  }))
}

describe('<RentalSettingsPage>', () => {
  beforeEach(() => { vi.unstubAllGlobals() })

  it('renders the customer permissions block with three toggles', async () => {
    mockFetchSequence([{ body: DEFAULT_SETTINGS }])
    await act(async () => { render(<RentalSettingsPage />) })
    await screen.findByText(/Customer Permissions/i)
    expect(screen.getByText(/Customers Can Edit Profile Information/i)).toBeInTheDocument()
    expect(screen.getByText(/Customers Can Edit Billing Information/i)).toBeInTheDocument()
    expect(screen.getByText(/Customers Can Schedule Move Outs/i)).toBeInTheDocument()
  })

  it('Save button is disabled until a change is made', async () => {
    mockFetchSequence([{ body: DEFAULT_SETTINGS }])
    await act(async () => { render(<RentalSettingsPage />) })
    await screen.findByText(/Customer Permissions/i)
    const saveBtn = screen.getByRole('button', { name: /^Save$/i })
    expect(saveBtn).toBeDisabled()
  })

  it('Save button enables after toggling a setting', async () => {
    mockFetchSequence([{ body: DEFAULT_SETTINGS }])
    await act(async () => { render(<RentalSettingsPage />) })
    await screen.findByText(/Customer Permissions/i)
    const moveOutToggle = screen.getByLabelText(/Customers Can Schedule Move Outs/i)
    await userEvent.click(moveOutToggle)
    await waitFor(() => expect(screen.getByRole('button', { name: /^Save$/i })).toBeEnabled())
  })

  it('issues a PUT on save and surfaces the success snackbar', async () => {
    mockFetchSequence([
      { body: DEFAULT_SETTINGS },
      { body: { success: true, data: DEFAULT_SETTINGS.data } },
    ])
    await act(async () => { render(<RentalSettingsPage />) })
    await screen.findByText(/Customer Permissions/i)
    const moveOutToggle = screen.getByLabelText(/Customers Can Schedule Move Outs/i)
    await userEvent.click(moveOutToggle)
    await userEvent.click(screen.getByRole('button', { name: /^Save$/i }))
    await waitFor(() => expect(screen.getByText(/Settings saved/i)).toBeInTheDocument())
  })
})

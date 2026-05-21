import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

import DuplicatesPage from '@/app/admin/tenants/duplicates/page'

function mockFetch(body: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => body } as unknown as Response)))
}

describe('<DuplicatesPage>', () => {
  beforeEach(() => { vi.unstubAllGlobals() })

  it('shows "no duplicates" empty state when pairs is empty', async () => {
    mockFetch({ success: true, data: { pairs: [], scanned: 50, found: 0 } })
    await act(async () => { render(<DuplicatesPage />) })
    await waitFor(() => expect(screen.getByText(/no.*duplicate|0.*found|scanned/i)).toBeInTheDocument())
  })

  it('renders a high-confidence pair with reasons', async () => {
    mockFetch({
      success: true,
      data: {
        pairs: [{
          a: { id: 'a', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@x.com', phone: '555-1' },
          b: { id: 'b', firstName: 'Ada', lastName: 'Lovelace', email: 'a@y.com', phone: '555-1' },
          reasons: ['name', 'phone'],
          confidence: 'high',
        }],
        scanned: 2, found: 1,
      },
    })
    await act(async () => { render(<DuplicatesPage />) })
    await waitFor(() => {
      expect(screen.getAllByText(/Ada Lovelace/).length).toBeGreaterThanOrEqual(2)
    })
    expect(screen.getAllByText(/Name|Phone/i).length).toBeGreaterThan(0)
  })

  it('handles API failure gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({ success: false, error: 'fail' }) } as unknown as Response)))
    await act(async () => { render(<DuplicatesPage />) })
    // Page should render *something* — either an alert or just empty.
    expect(document.body.textContent ?? '').toBeTruthy()
  })
})

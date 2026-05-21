import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams('leaseId=lease-1'),
}))

// Signature canvas is a third-party canvas-using component — happy-dom can't
// run canvas drawing, so we stub it. Asserting the wrapper is enough.
vi.mock('react-signature-canvas', () => ({
  default: () => <canvas data-testid="signature-canvas" />,
}))

import LeaseSignPage from '@/app/portal/lease/sign/page'

function mockFetch(body: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => body } as unknown as Response)))
}

describe('<LeaseSignPage>', () => {
  beforeEach(() => { pushMock.mockReset(); vi.unstubAllGlobals() })

  it('renders without crashing under the dom env', async () => {
    mockFetch({
      success: true,
      data: {
        _id: 'lease-1',
        agreement: '<p>Agreement body</p>',
        signedAt: null,
        unitId: { unitNumber: 'A1' },
      },
    })
    await act(async () => { render(<LeaseSignPage />) })
    // Any rendered text or fallback indicates the route mounted
    expect(document.body.textContent ?? '').toBeTruthy()
  })
})

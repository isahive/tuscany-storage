import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'

const pushMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
  useParams: () => ({ id: 'tpl-1' }),
}))

// TipTap uses DOM APIs happy-dom doesn't implement fully — stub the editor.
vi.mock('@tiptap/react', () => ({
  useEditor: () => null,
  EditorContent: () => <div data-testid="tiptap-editor" />,
}))
vi.mock('@tiptap/starter-kit', () => ({ default: {} }))
vi.mock('@tiptap/extension-text-align', () => ({ default: { configure: () => ({}) } }))
vi.mock('@tiptap/extension-underline', () => ({ default: {} }))

import TemplateEditPage from '@/app/admin/communications/templates/[id]/page'

function mockFetchSequence(responses: Array<{ ok?: boolean; body: unknown }>) {
  const queue = [...responses]
  vi.stubGlobal('fetch', vi.fn(async () => {
    const next = queue.shift()
    if (!next) throw new Error('fetch over-called')
    return { ok: next.ok ?? true, json: async () => next.body } as unknown as Response
  }))
}

const tplBody = {
  success: true,
  data: {
    _id: 'tpl-1',
    name: 'Move Out Receipt',
    type: 'default',
    emailSubject: 'Move-Out — [[FACILITY_NAME]]',
    emailContent: '<p>Hello [[CUSTOMER_NAME]]</p>',
    textContent: 'Tuscany: bye [[CUSTOMER_NAME]].',
    emailEnabled: true,
    textEnabled: false,
    active: true,
  },
}

describe('<TemplateEditPage>', () => {
  beforeEach(() => { pushMock.mockReset(); vi.unstubAllGlobals() })

  it('renders the template name + subject from the API', async () => {
    mockFetchSequence([{ body: tplBody }])
    await act(async () => { render(<TemplateEditPage />) })
    await waitFor(() => expect(screen.getByDisplayValue(/Move-Out — \[\[FACILITY_NAME\]\]/)).toBeInTheDocument())
  })

  it('shows the email + text channel toggles', async () => {
    mockFetchSequence([{ body: tplBody }])
    await act(async () => { render(<TemplateEditPage />) })
    await screen.findByDisplayValue(/Move-Out/)
    expect(screen.getAllByText(/Email/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Text|SMS/i).length).toBeGreaterThan(0)
  })
})

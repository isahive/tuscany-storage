import { describe, it, expect, beforeEach, vi } from 'vitest'
import { tenantSession } from '@/tests/helpers/session'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
import { getServerSession } from 'next-auth'

const s3Mocks = vi.hoisted(() => ({
  send: vi.fn(),
}))
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class { send = s3Mocks.send },
  PutObjectCommand: class { constructor(public input: unknown) {} },
}))

import { POST as moveOutPhotoPost } from '@/app/api/portal/move-out-photo/route'

function makeForm(file: File): FormData {
  const fd = new FormData()
  fd.append('file', file)
  return fd
}

function fileOfType(type: string, size = 100, name = 'photo.jpg'): File {
  return new File([new Uint8Array(size)], name, { type })
}

function postRequest(form: FormData) {
  return new Request('http://localhost/api/portal/move-out-photo', {
    method: 'POST',
    body: form,
  }) as any
}

const SAVED_ENV = { ...process.env }

beforeEach(() => {
  s3Mocks.send.mockReset()
  vi.mocked(getServerSession).mockReset()
  process.env = {
    ...SAVED_ENV,
    R2_ACCESS_KEY_ID: 'k', R2_SECRET_ACCESS_KEY: 's',
    R2_BUCKET: 'b', R2_ENDPOINT: 'https://r2.test',
    R2_PUBLIC_URL: 'https://pub.test',
    NODE_ENV: 'production',
  }
})

describe('POST /api/portal/move-out-photo', () => {
  it('401s when no session', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(null)
    const res = await moveOutPhotoPost(postRequest(makeForm(fileOfType('image/jpeg'))))
    expect(res.status).toBe(401)
  })

  it('400s when no file is provided', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession('t1'))
    const res = await moveOutPhotoPost(postRequest(new FormData()))
    expect(res.status).toBe(400)
  })

  it('415s on disallowed MIME types', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession('t1'))
    const res = await moveOutPhotoPost(postRequest(makeForm(fileOfType('application/pdf'))))
    expect(res.status).toBe(415)
  })

  it('413s when the file exceeds 8 MB', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession('t1'))
    const big = fileOfType('image/jpeg', 9 * 1024 * 1024)
    const res = await moveOutPhotoPost(postRequest(makeForm(big)))
    expect(res.status).toBe(413)
  })

  it('uploads to R2 under move-out-photos/{tenantId}/ and returns the public URL', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession('tenant-abc'))
    s3Mocks.send.mockResolvedValueOnce({})
    const res = await moveOutPhotoPost(postRequest(makeForm(fileOfType('image/jpeg', 100, 'unit.jpg'))))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.url).toMatch(/^https:\/\/pub\.test\/move-out-photos\/tenant-abc\//)
    expect(s3Mocks.send).toHaveBeenCalledTimes(1)
  })

  it('returns 500 in production when R2 credentials are missing', async () => {
    process.env = { ...SAVED_ENV, NODE_ENV: 'production' } // wipe R2 vars
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession('t1'))
    const res = await moveOutPhotoPost(postRequest(makeForm(fileOfType('image/jpeg'))))
    expect(res.status).toBe(500)
  })

  it('falls back to a data URL in development when R2 credentials are missing', async () => {
    process.env = { ...SAVED_ENV, NODE_ENV: 'development' }
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession('t1'))
    const res = await moveOutPhotoPost(postRequest(makeForm(fileOfType('image/jpeg'))))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.url).toMatch(/^data:image\/jpeg;base64,/)
  })

  it('surfaces a 500 when the R2 upload throws', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce(tenantSession('t1'))
    s3Mocks.send.mockRejectedValueOnce(new Error('R2 timeout'))
    const res = await moveOutPhotoPost(postRequest(makeForm(fileOfType('image/jpeg'))))
    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toMatch(/R2 timeout/)
  })
})

/**
 * Upload a single move-out photo to Cloudflare R2.
 *
 * Tenant-facing endpoint used by the portal move-out flow (Step 2). Returns a
 * public URL that the frontend stashes in form state and submits with the
 * move-out request payload. Photos land under `move-out-photos/{tenantId}/`
 * so admins reviewing the request can identify which tenant uploaded what.
 *
 * Diverges from `/api/upload` (admin-only, agreement editor) in two ways:
 *   1. Auth requires a tenant session — admins also pass but the route is
 *      designed for tenant traffic.
 *   2. The R2 key is namespaced by tenant ID, not a flat asset folder.
 *
 * In dev without R2 configured we fall back to an inline data URL so the
 * flow stays runnable without infra — but this is NEVER acceptable in prod
 * (the data URL would balloon the MoveOutRequest doc). Prod throws.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import crypto from 'crypto'
import { authOptions } from '@/lib/auth'

const MAX_BYTES = 8 * 1024 * 1024 // 8 MB — phone photos can be hefty
const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
])

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
  }

  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { success: false, error: 'Only JPEG, PNG, WebP, or HEIC images are allowed' },
      { status: 415 },
    )
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { success: false, error: 'File too large (max 8 MB)' },
      { status: 413 },
    )
  }

  const {
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET,
    R2_ENDPOINT,
    R2_PUBLIC_URL,
  } = process.env

  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase()
  const key = `move-out-photos/${session.user.id}/${crypto.randomBytes(12).toString('hex')}.${ext}`

  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET || !R2_ENDPOINT || !R2_PUBLIC_URL) {
    if (process.env.NODE_ENV === 'development') {
      const dataUrl = `data:${file.type};base64,${buffer.toString('base64')}`
      console.warn('[DEV] R2 not configured — returning data URL for move-out photo')
      return NextResponse.json({ success: true, url: dataUrl })
    }
    return NextResponse.json(
      { success: false, error: 'Photo storage not configured' },
      { status: 500 },
    )
  }

  try {
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')
    const s3 = new S3Client({
      region: 'auto',
      endpoint: R2_ENDPOINT,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    })
    await s3.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: file.type,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    )
    const publicUrl = `${R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`
    return NextResponse.json({ success: true, url: publicUrl })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Upload failed'
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}

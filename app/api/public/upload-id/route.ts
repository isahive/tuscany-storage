import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

// POST /api/public/upload-id
// Upload an ID photo during the reservation flow (no auth required).
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ success: false, error: 'Only JPG, PNG, or WebP images are allowed' }, { status: 415 })
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: 'File too large (max 10 MB)' }, { status: 413 })
    }

    const ext = file.name.split('.').pop() ?? 'jpg'
    const key = `id-photos/${crypto.randomBytes(16).toString('hex')}.${ext}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const {
      R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY,
      R2_BUCKET,
      R2_ENDPOINT,
      R2_PUBLIC_URL,
    } = process.env

    if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET || !R2_ENDPOINT || !R2_PUBLIC_URL) {
      // Dev fallback — return inline data URL
      const dataUrl = `data:${file.type};base64,${buffer.toString('base64')}`
      console.warn('[DEV] R2 not configured — returning data URL for ID photo upload')
      return NextResponse.json({ success: true, url: dataUrl })
    }

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
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload failed'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

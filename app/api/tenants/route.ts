import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import { parsePaginationParams } from '@/lib/utils'
import Tenant from '@/models/Tenant'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const { searchParams } = req.nextUrl
    const { page, limit, skip } = parsePaginationParams(searchParams)
    const status = searchParams.get('status')
    const search = searchParams.get('search')

    const filter: Record<string, unknown> = {}

    if (status) {
      filter.status = status
    }

    if (search) {
      // Escape regex metacharacters to prevent ReDoS / injection
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      filter.$or = [
        { firstName: { $regex: escaped, $options: 'i' } },
        { lastName: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } },
        { phone: { $regex: escaped, $options: 'i' } },
      ]
    }

    // Non-admin tenants can only list themselves
    if (session.user.role !== 'admin') {
      filter._id = session.user.id
    }

    const [items, total] = await Promise.all([
      Tenant.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
      Tenant.countDocuments(filter),
    ])

    return NextResponse.json({
      success: true,
      data: {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

const createTenantSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  password: z.string().min(6),
  alternatePhone: z.string().optional(),
  alternateEmail: z.string().email().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  driversLicense: z.string().optional(),
  role: z.enum(['tenant', 'admin']).optional(),
  smsOptIn: z.boolean().optional(),
  referralSource: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const parsed = createTenantSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.message }, { status: 400 })
    }

    await connectDB()

    const existing = await Tenant.findOne({ email: parsed.data.email.toLowerCase() })
    if (existing) {
      return NextResponse.json({ success: false, error: 'Email already in use' }, { status: 409 })
    }

    const hashedPassword = await bcrypt.hash(parsed.data.password, 12)

    const tenant = await Tenant.create({
      ...parsed.data,
      password: hashedPassword,
    })

    // Remove password from response
    const tenantObj = tenant.toObject()
    delete (tenantObj as Record<string, unknown>).password

    return NextResponse.json({ success: true, data: tenantObj }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

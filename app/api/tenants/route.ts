import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { authOptions } from '@/lib/auth'
import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'
import Settings from '@/models/Settings'
import { buildTenantGroupFilter } from '@/lib/tenantGroupResolver'

// API responses must always reflect live data — never prerender at build.
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    await connectDB()

    const { searchParams } = req.nextUrl
    // `limit=all` returns the entire collection. Numeric values are honored
    // up to the actual collection size — no artificial cap.
    const rawLimit = searchParams.get('limit') || '20'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const status = searchParams.get('status')
    const group = searchParams.get('group')
    const search = searchParams.get('search')

    const filter: Record<string, unknown> = {}

    if (status) {
      filter.status = status
    }

    // Storable customer-group segmentation. Resolved server-side so the
    // dropdown UI doesn't have to know about Lease/Payment joins.
    if (group) {
      const groupFilter = await buildTenantGroupFilter(group)
      if (groupFilter) Object.assign(filter, groupFilter)
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

    const total = await Tenant.countDocuments(filter)

    // Resolve effective limit: 'all' → entire collection, otherwise the
    // requested value clamped to the actual collection size.
    const parsedLimit = parseInt(rawLimit, 10)
    const limit =
      rawLimit === 'all' || isNaN(parsedLimit) || parsedLimit < 1
        ? total
        : Math.min(parsedLimit, total)
    const skip = (page - 1) * limit

    const settings = await Settings.findOne({}).lean<{ customerNameFormat?: 'last_first' | 'first_last' }>()
    const sortByLastFirst = (settings?.customerNameFormat ?? 'last_first') === 'last_first'
    const sortSpec = sortByLastFirst
      ? { lastName: 1 as const, firstName: 1 as const }
      : { firstName: 1 as const, lastName: 1 as const }

    const items = await Tenant.find(filter)
      .skip(skip)
      .limit(limit)
      .sort(sortSpec)

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
  password: z.string().min(4),
  // Primary address
  address: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  // Alternate contact
  alternateContactName: z.string().optional(),
  alternatePhone: z.string().optional(),
  alternateEmail: z.string().email().optional().or(z.literal('')),
  alternateAddress: z.string().optional(),
  alternateCity: z.string().optional(),
  alternateState: z.string().optional(),
  alternateZip: z.string().optional(),
  // Personal info
  driversLicense: z.string().optional(),
  driversLicenseNumber: z.string().optional(),
  driversLicenseState: z.string().optional(),
  ssn: z.string().optional(),
  employerName: z.string().optional(),
  employerPhone: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
  securityQuestion: z.string().optional(),
  securityAnswer: z.string().optional(),
  idPhotoUrl: z.string().optional(),
  // Auth / ops
  role: z.enum(['tenant', 'admin']).optional(),
  gateCode: z.string().optional(),
  smsOptIn: z.boolean().optional(),
  smsConsent: z.boolean().optional(),
  referralSource: z.string().optional(),
  howDidYouHear: z.string().optional(),
  howDidYouHearOther: z.string().optional(),
  // Admin-defined custom fields (key/value bag)
  customFields: z.record(z.string(), z.string()).optional(),
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

    // Duplicate account check: warn admin if same physical address already exists
    let duplicateWarning: { tenantId: string; name: string; address: string } | null = null
    if (parsed.data.address && parsed.data.zip) {
      const normalizeAddr = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')
      const addrNorm = normalizeAddr(parsed.data.address)
      const zipNorm = parsed.data.zip.trim()

      const addressMatch = await Tenant.findOne({
        zip: zipNorm,
        status: { $ne: 'moved_out' },
      })

      if (
        addressMatch &&
        addressMatch.address &&
        normalizeAddr(addressMatch.address) === addrNorm
      ) {
        duplicateWarning = {
          tenantId: (addressMatch._id as { toString(): string }).toString(),
          name: `${addressMatch.firstName} ${addressMatch.lastName}`,
          address: `${addressMatch.address}, ${addressMatch.city ?? ''} ${addressMatch.state ?? ''} ${addressMatch.zip ?? ''}`.trim(),
        }
      }
    }

    const hashedPassword = await bcrypt.hash(parsed.data.password, 12)

    const tenant = await Tenant.create({
      ...parsed.data,
      password: hashedPassword,
    })

    // Remove password from response
    const tenantObj = tenant.toObject()
    delete (tenantObj as Record<string, unknown>).password

    return NextResponse.json(
      { success: true, data: tenantObj, duplicateWarning },
      { status: 201 },
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

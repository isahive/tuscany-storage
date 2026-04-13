import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { connectDB } from '@/lib/db'
import Tenant from '@/models/Tenant'
import Lease from '@/models/Lease'
import Unit from '@/models/Unit'
import Settings from '@/models/Settings'

const schema = z.object({
  unitId: z.string(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(7),
  password: z.string().min(8),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  driversLicense: z.string().optional(),
  alternatePhone: z.string().optional(),
  alternateEmail: z.string().optional(),
  idPhotoUrl: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Please fill in all required fields.' }, { status: 400 })
    }

    const {
      unitId, firstName, lastName, email, phone, password,
      address, city, state, zip, driversLicense, alternatePhone, alternateEmail, idPhotoUrl,
    } = parsed.data

    await connectDB()

    const unit = await Unit.findById(unitId)
    if (!unit) return NextResponse.json({ success: false, error: 'Unit not found' }, { status: 404 })
    if (unit.status !== 'available') {
      return NextResponse.json({ success: false, error: 'This unit is no longer available.' }, { status: 409 })
    }

    const existing = await Tenant.findOne({ email: email.toLowerCase() })
    if (existing) {
      return NextResponse.json({ success: false, error: 'An account with this email already exists. Please sign in.' }, { status: 409 })
    }

    // Gate code — use settings to determine method and length
    const settings = await Settings.findOne({}).lean()
    const autoAssign = settings?.gateAutoAssign ?? true
    const method = settings?.gateAutoAssignMethod ?? 'phone_last4'
    const codeLen = settings?.gateCodeLength ?? 4

    let gateCode = ''
    if (autoAssign) {
      if (method === 'phone_last4') {
        const digits = phone.replace(/\D/g, '')
        gateCode = digits.slice(-codeLen).padStart(codeLen, '0')
      } else {
        // random code
        const min = Math.pow(10, codeLen - 1)
        const max = Math.pow(10, codeLen) - 1
        gateCode = String(Math.floor(Math.random() * (max - min + 1)) + min)
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12)
    const tenant = await Tenant.create({
      firstName, lastName, email, phone,
      password: hashedPassword,
      address, city, state, zip,
      driversLicense,
      idPhotoUrl,
      alternatePhone, alternateEmail,
      gateCode,
      role: 'tenant',
      status: 'active',
    })

    const today = new Date()
    const billingDay = Math.min(today.getDate(), 28)
    const lease = await Lease.create({
      tenantId: tenant._id,
      unitId: unit._id,
      startDate: today,
      monthlyRate: unit.price,
      deposit: unit.price,
      proratedFirstMonth: 0,
      billingDay,
      status: 'active',
    })

    // Reserve the unit
    unit.status = 'reserved'
    unit.currentLeaseId = lease._id
    unit.currentTenantId = tenant._id
    await unit.save()

    // Create Stripe PaymentIntent (first month + deposit)
    const totalAmount = unit.price * 2
    let clientSecret: string | null = null

    if (process.env.STRIPE_SECRET_KEY) {
      const { stripe } = await import('@/lib/stripe')

      const customer = await stripe.customers.create({
        email: tenant.email,
        name: `${firstName} ${lastName}`,
        phone,
        metadata: { tenantId: tenant._id.toString() },
      })

      tenant.stripeCustomerId = customer.id
      await tenant.save()

      const intent = await stripe.paymentIntents.create({
        amount: totalAmount,
        currency: 'usd',
        customer: customer.id,
        payment_method_types: ['card'],
        setup_future_usage: 'off_session',
        metadata: {
          tenantId: tenant._id.toString(),
          leaseId: lease._id.toString(),
          type: 'move_in',
        },
      }, {
        idempotencyKey: `reserve-${unit._id}-${tenant._id}-${Date.now()}`,
      })
      clientSecret = intent.client_secret
    }

    return NextResponse.json({
      success: true,
      data: {
        tenantId: tenant._id.toString(),
        leaseId: lease._id.toString(),
        gateCode,
        clientSecret,
        totalAmount,
        devMode: !process.env.STRIPE_SECRET_KEY,
      },
    }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Lease from '@/models/Lease'
import Tenant from '@/models/Tenant'
import Unit from '@/models/Unit'
import Settings from '@/models/Settings'
import { DEFAULT_SETTINGS } from '@/lib/defaultSettings'

// Minimal TipTap JSON → HTML converter (no external deps)
function nodeToHtml(node: any): string {
  if (!node) return ''
  const children = (): string => (node.content ?? []).map(nodeToHtml).join('')

  switch (node.type) {
    case 'doc': return children()
    case 'heading': {
      const l = node.attrs?.level ?? 1
      const align = node.attrs?.textAlign ? ` style="text-align:${node.attrs.textAlign}"` : ''
      return `<h${l}${align}>${children()}</h${l}>`
    }
    case 'paragraph': {
      const align = node.attrs?.textAlign ? ` style="text-align:${node.attrs.textAlign}"` : ''
      return `<p${align}>${children() || '<br>'}</p>`
    }
    case 'text': {
      let t = (node.text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      for (const m of node.marks ?? []) {
        if (m.type === 'bold') t = `<strong>${t}</strong>`
        else if (m.type === 'italic') t = `<em>${t}</em>`
        else if (m.type === 'underline') t = `<u>${t}</u>`
        else if (m.type === 'strike') t = `<s>${t}</s>`
        else if (m.type === 'highlight') t = `<mark>${t}</mark>`
      }
      return t
    }
    case 'bulletList':  return `<ul>${children()}</ul>`
    case 'orderedList': return `<ol>${children()}</ol>`
    case 'listItem':    return `<li>${children()}</li>`
    case 'horizontalRule': return '<hr>'
    case 'hardBreak':   return '<br>'
    case 'blockquote':  return `<blockquote>${children()}</blockquote>`
    case 'image': {
      const s = node.attrs?.src ?? ''
      const a = node.attrs?.alt ?? ''
      return `<img src="${s}" alt="${a}" style="max-width:100%;height:auto">`
    }
    default: return children()
  }
}

interface RouteContext {
  params: Promise<{ leaseId: string }>
}

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const { leaseId } = await context.params

    await connectDB()

    const lease = await Lease.findById(leaseId)
    if (!lease) return NextResponse.json({ success: false, error: 'Lease not found' }, { status: 404 })

    const [tenant, unit, settingsDoc] = await Promise.all([
      Tenant.findById(lease.tenantId),
      Unit.findById(lease.unitId),
      Settings.findOne({}).lean(),
    ])

    const cfg = { ...DEFAULT_SETTINGS, ...(settingsDoc ?? {}) }
    const rawTemplate = (cfg as Record<string, unknown>).agreementTemplate

    // agreementTemplate is stored as a JSON string in the DB — parse it
    let parsedTemplate: unknown = rawTemplate
    if (typeof rawTemplate === 'string' && rawTemplate.length > 0) {
      try { parsedTemplate = JSON.parse(rawTemplate) } catch { /* ignore, fall back below */ }
    }

    const effectiveTemplate = (parsedTemplate && typeof parsedTemplate === 'object')
      ? parsedTemplate
      : DEFAULT_SETTINGS.agreementTemplate

    if (!effectiveTemplate || typeof effectiveTemplate !== 'object') {
      return NextResponse.json({ success: false, error: 'No agreement template has been configured.' }, { status: 404 })
    }

    const fmt = (c: number) =>
      new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(c / 100)

    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    const fullAddress = [tenant?.address, tenant?.city, tenant?.state, tenant?.zip].filter(Boolean).join(', ')

    const tokens: Record<string, string> = {
      '[[CUSTOMER_NAME]]': tenant ? `${tenant.firstName} ${tenant.lastName}` : '',
      '[[CUSTOMER_ADDRESS]]': fullAddress,
      '[[CUSTOMER_PHONE_NUMBER]]': tenant?.phone ?? '',
      '[[EMAIL_ADDRESS]]': tenant?.email ?? '',
      '[[CUSTOMER_USERNAME]]': tenant?.email ?? '',
      '[[UNIT]]': unit?.unitNumber ?? '',
      '[[UNIT_SIZE]]': unit?.size ?? '',
      '[[RENT]]': fmt(unit?.price ?? 0),
      '[[DEPOSIT]]': fmt(unit?.price ?? 0),
      '[[CUSTOMER_ACCESS_CODE]]': tenant?.gateCode ?? '',
      '[[DATE]]': today,
      '[[TODAY]]': today,
      '[[BALANCE]]': fmt(unit?.price ?? 0),
      '[[FACILITY_NAME]]': 'Tuscany Village Self Storage',
      '[[ALTERNATE_CONTACT]]': tenant ? `${tenant.firstName} ${tenant.lastName}` : '',
      '[[ALTERNATE_ADDRESS]]': fullAddress,
      '[[ALTERNATE_PHONE_NUMBER]]': tenant?.alternatePhone ?? '',
      '[[ALTERNATE_EMAIL]]': tenant?.alternateEmail ?? '',
    }

    let html = nodeToHtml(effectiveTemplate)
    for (const [token, value] of Object.entries(tokens)) {
      html = html.replaceAll(token, `<span class="token-value">${value}</span>`)
    }

    return NextResponse.json({
      success: true,
      data: {
        html,
        title: (cfg as Record<string, unknown>).agreementTitle ?? 'Storage Rental Agreement',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

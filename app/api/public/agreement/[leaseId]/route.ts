import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import Lease from '@/models/Lease'
import Tenant from '@/models/Tenant'
import Unit from '@/models/Unit'
import Settings from '@/models/Settings'
import { DEFAULT_SETTINGS } from '@/lib/defaultSettings'
import { buildPlaceholders } from '@/lib/sendNotification'

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

    // Use the unified placeholder builder so the agreement matches what every
    // template (email, sms, letters) substitutes — same token names, same
    // resolution against tenant/unit/settings.
    const placeholders = tenant
      ? await buildPlaceholders({
          tenant: tenant as any,
          unitNumber: unit?.unitNumber,
          unitSize: unit?.size,
          monthlyRate: lease.monthlyRate,
          deposit: lease.deposit,
          balance: (tenant as any).balance,
        })
      : {}

    let html = nodeToHtml(effectiveTemplate)
    for (const [key, value] of Object.entries(placeholders)) {
      // Only wrap the ALL_CAPS variants so the agreement keeps its highlight
      // styling — camelCase aliases substitute silently for legacy templates.
      const wrapped = /^[A-Z_]+$/.test(key) ? `<span class="token-value">${value}</span>` : value
      html = html.replaceAll(`[[${key}]]`, wrapped)
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

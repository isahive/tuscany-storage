import type { ISettingsDocument } from '@/models/Settings'

interface BrandingSource {
  facilityName?: string
  facilityAddress?: string
  facilityCity?: string
  facilityState?: string
  facilityZip?: string
  facilityPhone?: string
  emailLogoUrl?: string
  emailFooterHtml?: string
}

/** Public path to the bundled brand logo — used when Settings.emailLogoUrl is blank. */
const DEFAULT_LOGO_PATH = '/images/brand/logo.png'

function absolutize(url: string): string {
  if (!url) return url
  if (/^https?:\/\//i.test(url)) return url
  const base = process.env.NEXT_PUBLIC_APP_URL ?? ''
  if (!base) return url
  return `${base.replace(/\/$/, '')}${url.startsWith('/') ? '' : '/'}${url}`
}

function defaultFooter(s: BrandingSource): string {
  const lines = [
    s.facilityName ?? '',
    s.facilityAddress ?? '',
    [s.facilityCity, s.facilityState, s.facilityZip].filter(Boolean).join(', ').replace(/, ([A-Z]{2}), /, ', $1 ').trim(),
  ].filter(Boolean)
  return lines.map((l) => `<div>${l}</div>`).join('')
}

/**
 * Wrap a template body in the standard tenant-email layout:
 *
 *   ┌────────────────────────────────────────┐
 *   │           full-width logo              │
 *   ├────────────────────────────────────────┤
 *   │  body html (from the template)         │
 *   ├────────────────────────────────────────┤
 *   │  facility signature                    │
 *   └────────────────────────────────────────┘
 *
 * Width is fixed at 640px (the email-safe max) — the logo image is set to
 * `width: 100%` so it scales to fill the container, matching the live admin's
 * full-width banner.
 */
export function wrapTenantEmail(bodyHtml: string, settings: BrandingSource): string {
  const logoSrc = absolutize(settings.emailLogoUrl?.trim() || DEFAULT_LOGO_PATH)
  const footer = settings.emailFooterHtml?.trim() || defaultFooter(settings)

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${settings.facilityName ?? ''}</title>
  </head>
  <body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#1c0f06;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" style="max-width:640px;">
            <tr>
              <td style="padding:0 0 24px 0;">
                <img src="${logoSrc}" alt="${settings.facilityName ?? ''}" style="display:block;width:100%;max-width:640px;height:auto;border:0;outline:none;text-decoration:none;" />
              </td>
            </tr>
            <tr>
              <td style="padding:0 16px;font-size:15px;line-height:1.6;color:#1c0f06;">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:32px 16px 0 16px;border-top:1px solid #ede5d8;margin-top:24px;font-size:14px;line-height:1.6;color:#1c0f06;">
                ${footer}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

export type EmailBranding = BrandingSource

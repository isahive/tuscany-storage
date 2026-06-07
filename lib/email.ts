import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const fromEmail =
  process.env.EMAIL_FROM || "Tuscany Storage <noreply@tuscanystorage.com>";
const adminEmail = process.env.ADMIN_EMAIL || "Tuscanystorage@gmail.com";

export async function sendEmail(
  to: string | string[],
  subject: string,
  html: string,
  options?: { replyTo?: string },
): Promise<string | null> {
  // Hard safety gate: only send real email when explicitly running in production.
  // If NODE_ENV is unset, 'development', 'dev', 'test', or anything else, suppress
  // — even when RESEND_API_KEY is configured (a key in .env.local would otherwise
  // dispatch to real customers from a dev/staging environment).
  if (process.env.NODE_ENV !== "production") {
    const recipients = Array.isArray(to) ? to.join(", ") : to;
    console.log(
      `[EMAIL GUARD] suppressed (NODE_ENV=${process.env.NODE_ENV ?? "(unset)"}) — To: ${recipients}, Subject: ${subject}`,
    );
    return null;
  }

  if (!resend) {
    // Production deploys MUST configure RESEND_API_KEY. Silently no-oping here
    // is worse than failing — callers (sendTemplatedNotification) record a
    // 'failed' Notification so the admin sees the gap.
    throw new Error(
      "Email service not configured: RESEND_API_KEY is not set",
    );
  }

  const recipients = Array.isArray(to) ? to.join(", ") : to;
  console.log(`[EMAIL] Sending to: ${recipients} | Subject: ${subject}`);

  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to,
    subject,
    html,
    ...(options?.replyTo ? { replyTo: options.replyTo } : {}),
  });

  if (error) {
    console.error("[EMAIL] Resend error:", error);
    throw new Error(`Email delivery failed: ${error.message}`);
  }

  console.log(`[EMAIL] Sent successfully, id: ${data?.id}`);
  return data?.id ?? null;
}

export async function sendAdminNotification(
  subject: string,
  html: string,
): Promise<void> {
  await sendEmail(adminEmail, subject, html);
}

export { resend };

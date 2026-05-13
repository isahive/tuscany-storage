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
): Promise<void> {
  if (process.env.NODE_ENV === "development" && !resend) {
    const recipients = Array.isArray(to) ? to.join(", ") : to;
    console.log(`[EMAIL DEV] To: ${recipients}, Subject: ${subject}`);
    return;
  }

  if (!resend) {
    console.warn("[EMAIL] Resend not configured — set RESEND_API_KEY");
    return;
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
}

export async function sendAdminNotification(
  subject: string,
  html: string,
): Promise<void> {
  await sendEmail(adminEmail, subject, html);
}

export { resend };

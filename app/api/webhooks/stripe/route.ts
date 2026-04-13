import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Payment from "@/models/Payment";
import Notification from "@/models/Notification";
import Tenant from "@/models/Tenant";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { success: false, error: "Missing stripe-signature header" },
        { status: 400 },
      );
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return NextResponse.json(
        { success: false, error: "Webhook secret not configured" },
        { status: 500 },
      );
    }

    // Verify signature and parse event
    let event: { type: string; data: { object: any } };

    try {
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");
      const constructed = stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret,
      );
      event = constructed as unknown as typeof event;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid signature";
      return NextResponse.json(
        { success: false, error: `Webhook verification failed: ${message}` },
        { status: 400 },
      );
    }

    await connectDB();

    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;
        const paymentIntentId = paymentIntent.id as string;

        const payment = await Payment.findOne({
          stripePaymentIntentId: paymentIntentId,
        });
        if (payment) {
          payment.status = "succeeded";
          payment.lastAttemptAt = new Date();
          if (paymentIntent.latest_charge) {
            payment.stripeChargeId = paymentIntent.latest_charge as string;
          }
          await payment.save();

          // Create receipt notification
          await Notification.create({
            tenantId: payment.tenantId,
            type: "payment_confirmation",
            channel: "email",
            subject: "Payment Confirmation",
            body: `Your payment of $${(payment.amount / 100).toFixed(2)} has been received. Thank you!`,
            status: "pending",
          });
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object;
        const paymentIntentId = paymentIntent.id as string;

        const payment = await Payment.findOne({
          stripePaymentIntentId: paymentIntentId,
        });
        if (payment) {
          payment.status = "failed";
          payment.attemptCount += 1;
          payment.lastAttemptAt = new Date();

          const lastError = paymentIntent.last_payment_error as
            | Record<string, unknown>
            | undefined;
          if (lastError?.message) {
            payment.failureReason = lastError.message as string;
          }

          await payment.save();
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object;
        const paymentIntentId = charge.payment_intent as string;
        if (paymentIntentId) {
          const payment = await Payment.findOne({
            stripePaymentIntentId: paymentIntentId,
          });
          if (payment && payment.status !== "refunded") {
            payment.status = "refunded";
            await payment.save();

            // Reduce tenant balance
            await Tenant.findByIdAndUpdate(payment.tenantId, {
              $inc: { balance: -payment.amount },
            });
          }
        }
        break;
      }

      case "charge.dispute.created": {
        const dispute = event.data.object;
        const paymentIntentId = dispute.payment_intent as string;
        if (paymentIntentId) {
          const payment = await Payment.findOne({
            stripePaymentIntentId: paymentIntentId,
          });
          if (payment) {
            payment.failureReason = `Dispute: ${dispute.reason ?? "unknown"}`;
            await payment.save();

            await Notification.create({
              tenantId: payment.tenantId,
              type: "payment_reminder",
              channel: "email",
              subject: "Payment Dispute Received",
              body: `A dispute has been filed for your payment of $${(payment.amount / 100).toFixed(2)}. Please contact us immediately.`,
              status: "pending",
            });
          }
        }
        break;
      }

      default:
        // Unhandled event type
        break;
    }

    return NextResponse.json({ success: true, data: { received: true } });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

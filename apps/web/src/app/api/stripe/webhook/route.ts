import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { stripe, STRIPE_WEBHOOK_SECRET, IS_DEV_MODE } from "@/lib/stripe";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature") || "";

  let event;
  if (!IS_DEV_MODE) {
    try {
      event = stripe!.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
    } catch (error) {
      console.error("Webhook signature verification failed:", error);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
  } else {
    try {
      event = JSON.parse(body);
    } catch {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object;
        const paymentId = paymentIntent.id;
        const metadata = paymentIntent.metadata;
        const userId = metadata.userId;
        const originalAmount = parseFloat(metadata.originalAmount || "0");

        const payment = await db.payment.findFirst({
          where: { stripePaymentId: paymentId },
        });

        if (!payment || payment.status === "COMPLETED") break;

        await db.$transaction(async (tx) => {
          await tx.payment.update({
            where: { id: payment.id },
            data: { status: "COMPLETED" },
          });

          if (userId) {
            await tx.user.update({
              where: { id: userId },
              data: { balance: { increment: originalAmount } },
            });
          }
        });

        if (userId) {
          const invoiceNumber = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-7)}`;
          await db.invoice.create({
            data: {
              userId,
              invoiceNumber,
              paymentId: payment.id,
              subtotal: originalAmount.toString(),
              taxAmount: "0",
              discountAmount: metadata.discountAmount || "0",
              total: (originalAmount - parseFloat(metadata.discountAmount || "0")).toString(),
              currency: "usd",
              status: "PAID",
            },
          });
        }

        console.log(`[webhook] Payment ${paymentId} succeeded for user ${userId}`);
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object;
        const payment = await db.payment.findFirst({
          where: { stripePaymentId: paymentIntent.id },
        });

        if (payment) {
          await db.payment.update({
            where: { id: payment.id },
            data: { status: "FAILED" },
          });
        }

        console.log(`[webhook] Payment ${paymentIntent.id} failed`);
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

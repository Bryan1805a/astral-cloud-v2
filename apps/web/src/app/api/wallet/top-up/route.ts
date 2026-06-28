import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { stripe, IS_DEV_MODE } from "@/lib/stripe";
import { getAuthToken, apiError, apiSuccess } from "@/lib/errors";
import { verifyAccessToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const token = getAuthToken(request);
  if (!token) return apiError("UNAUTHORIZED", "Missing authorization token.");

  let payload;
  try {
    payload = await verifyAccessToken(token);
  } catch {
    return apiError("TOKEN_EXPIRED", "Access token has expired.");
  }

  const body = await request.json();
  const amount = body.amount;
  const voucherCode = body.voucherCode;

  if (!amount || typeof amount !== "number" || amount < 1) {
    return apiError("VALIDATION_ERROR", "Amount must be at least 1.");
  }

  const user = await db.user.findUnique({ where: { id: payload.sub } });
  if (!user) return apiError("NOT_FOUND", "User not found.");

  let discountAmount = 0;
  let voucherId: string | undefined;

  if (voucherCode) {
    const voucher = await db.voucher.findFirst({
      where: { code: { equals: voucherCode, mode: "insensitive" }, isActive: true },
    });

    if (!voucher) {
      return apiError("VOUCHER_EXPIRED", "Invalid voucher code.");
    }

    if (voucher.validFrom && voucher.validFrom > new Date()) {
      return apiError("VOUCHER_EXPIRED", "This voucher is not yet valid.");
    }
    if (voucher.validUntil && voucher.validUntil < new Date()) {
      return apiError("VOUCHER_EXPIRED", "This voucher has expired.");
    }
    if (voucher.maxUses && voucher.currentUses >= voucher.maxUses) {
      return apiError("VOUCHER_EXHAUSTED", "This voucher has reached its maximum uses.");
    }

    const existingUsage = await db.voucherUsage.findFirst({
      where: { voucherId: voucher.id, userId: user.id },
    });
    if (existingUsage) {
      return apiError("VOUCHER_ALREADY_USED", "You have already used this voucher.");
    }

    if (voucher.minSpend && Number(voucher.minSpend) > amount) {
      return apiError("VOUCHER_MIN_SPEND", `This voucher requires a minimum spend of $${voucher.minSpend}.`);
    }

    if (voucher.discountType === "PERCENTAGE") {
      discountAmount = Math.round(amount * (Number(voucher.discountValue) / 100) * 100) / 100;
    } else {
      discountAmount = Math.min(amount, Number(voucher.discountValue));
    }

    voucherId = voucher.id;
  }

  const finalAmount = Math.round((amount - discountAmount) * 100);

  const payment = await db.payment.create({
    data: {
      userId: user.id,
      stripePaymentId: "pending",
      amount: amount.toString(),
      currency: "usd",
      status: "PENDING",
      type: "TOP_UP",
      voucherId: voucherId || undefined,
    },
  });

  if (voucherId) {
    await db.voucher.update({
      where: { id: voucherId },
      data: { currentUses: { increment: 1 } },
    });

    await db.voucherUsage.create({
      data: {
        voucherId,
        userId: user.id,
        paymentId: payment.id,
        discountAmount: discountAmount.toString(),
      },
    });
  }

  try {
    if (IS_DEV_MODE) {
      const fakePaymentIntentId = `pi_dev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await db.payment.update({
        where: { id: payment.id },
        data: { stripePaymentId: fakePaymentIntentId },
      });

      await db.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: "COMPLETED" },
        });
        await tx.user.update({
          where: { id: user.id },
          data: { balance: { increment: amount } },
        });
      });

      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-7)}`;
      await db.invoice.create({
        data: {
          userId: user.id,
          invoiceNumber,
          paymentId: payment.id,
          subtotal: amount.toString(),
          taxAmount: "0",
          discountAmount: discountAmount.toString(),
          total: (amount - discountAmount).toString(),
          currency: "usd",
          status: "PAID",
        },
      });

      await db.auditLog.create({
        data: {
          userId: user.id,
          action: "PAYMENT_COMPLETED",
          targetType: "Payment",
          targetId: payment.id,
          result: "SUCCESS",
          ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
        },
      });

      return apiSuccess({
        paymentId: payment.id,
        originalAmount: amount,
        discountAmount,
        finalAmount: amount - discountAmount,
        voucherCode: voucherCode || null,
        status: "COMPLETED",
      });
    }

    const paymentIntent = await stripe!.paymentIntents.create({
      amount: finalAmount,
      currency: "usd",
      metadata: {
        userId: user.id,
        paymentId: payment.id,
        originalAmount: amount.toString(),
        discountAmount: discountAmount.toString(),
        voucherId: voucherId || "",
      },
    });

    await db.payment.update({
      where: { id: payment.id },
      data: { stripePaymentId: paymentIntent.id },
    });

    return apiSuccess({
      paymentId: payment.id,
      clientSecret: paymentIntent.client_secret,
      originalAmount: amount,
      discountAmount,
      finalAmount: finalAmount / 100,
      voucherCode: voucherCode || null,
    });
  } catch (error) {
    await db.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED" },
    });

    if (voucherId) {
      await db.voucher.update({
        where: { id: voucherId },
        data: { currentUses: { decrement: 1 } },
      });
    }

    console.error("Top-up error:", error);
    return apiError("INTERNAL_ERROR", "Payment processing failed. Please try again.");
  }
}

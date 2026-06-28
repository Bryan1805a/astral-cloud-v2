import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { stripe, IS_DEV_MODE } from "@/lib/stripe";
import { getAuthToken, apiError, apiSuccess } from "@/lib/errors";
import { verifyAccessToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = getAuthToken(request);
  if (!token) return apiError("UNAUTHORIZED", "Missing authorization token.");

  let payload;
  try {
    payload = await verifyAccessToken(token);
  } catch {
    return apiError("TOKEN_EXPIRED", "Access token has expired.");
  }

  const methods = await db.paymentMethod.findMany({
    where: { userId: payload.sub },
    orderBy: { createdAt: "desc" },
  });

  return apiSuccess(
    methods.map((m) => ({
      id: m.id,
      brand: m.brand,
      last4: m.last4,
      expMonth: m.expMonth,
      expYear: m.expYear,
      isDefault: m.isDefault,
      createdAt: m.createdAt.toISOString(),
    }))
  );
}

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
  const { paymentMethodId, setDefault } = body;

  if (!paymentMethodId) {
    return apiError("VALIDATION_ERROR", "Payment method ID is required.");
  }

  try {
    if (IS_DEV_MODE) {
      const method = await db.paymentMethod.create({
        data: {
          userId: payload.sub,
          stripePaymentMethodId: paymentMethodId || `pm_dev_${Date.now()}`,
          brand: "visa",
          last4: "4242",
          expMonth: 12,
          expYear: 2030,
          isDefault: setDefault || false,
        },
      });

      return apiSuccess(
        {
          id: method.id,
          brand: method.brand,
          last4: method.last4,
          expMonth: method.expMonth,
          expYear: method.expYear,
          isDefault: method.isDefault,
        },
        201
      );
    }

    const pm = await stripe!.paymentMethods.retrieve(paymentMethodId);

    await stripe!.paymentMethods.attach(paymentMethodId, {
      customer: payload.sub,
    });

    if (setDefault) {
      await db.paymentMethod.updateMany({
        where: { userId: payload.sub },
        data: { isDefault: false },
      });
    }

    const method = await db.paymentMethod.create({
      data: {
        userId: payload.sub,
        stripePaymentMethodId: paymentMethodId,
        brand: pm.card?.brand || "unknown",
        last4: pm.card?.last4 || "0000",
        expMonth: pm.card?.exp_month || 1,
        expYear: pm.card?.exp_year || 2030,
        isDefault: setDefault || false,
      },
    });

    return apiSuccess(
      {
        id: method.id,
        brand: method.brand,
        last4: method.last4,
        expMonth: method.expMonth,
        expYear: method.expYear,
        isDefault: method.isDefault,
      },
      201
    );
  } catch (error) {
    console.error("Save payment method error:", error);
    return apiError("INTERNAL_ERROR", "Failed to save payment method.");
  }
}

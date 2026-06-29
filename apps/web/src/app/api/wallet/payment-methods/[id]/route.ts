import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { stripe, IS_DEV_MODE } from "@/lib/stripe";
import { getAuthToken, apiError, apiSuccess } from "@/lib/errors";
import { verifyAccessToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = getAuthToken(request);
  if (!token) return apiError("UNAUTHORIZED", "Missing authorization token.");

  let payload;
  try {
    payload = await verifyAccessToken(token);
  } catch {
    return apiError("TOKEN_EXPIRED", "Access token has expired.");
  }

  const method = await db.paymentMethod.findFirst({
    where: { id: params.id, userId: payload.sub },
  });
  if (!method) return apiError("NOT_FOUND", "Payment method not found.");

  const body = await request.json();
  if (body.isDefault) {
    await db.paymentMethod.updateMany({
      where: { userId: payload.sub },
      data: { isDefault: false },
    });
    await db.paymentMethod.update({
      where: { id: method.id },
      data: { isDefault: true },
    });
  }

  return apiSuccess({ id: method.id, isDefault: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = getAuthToken(request);
  if (!token) return apiError("UNAUTHORIZED", "Missing authorization token.");

  let payload;
  try {
    payload = await verifyAccessToken(token);
  } catch {
    return apiError("TOKEN_EXPIRED", "Access token has expired.");
  }

  const method = await db.paymentMethod.findFirst({
    where: { id: params.id, userId: payload.sub },
  });

  if (!method) return apiError("NOT_FOUND", "Payment method not found.");

  try {
    if (!IS_DEV_MODE) {
      await stripe!.paymentMethods.detach(method.stripePaymentMethodId);
    }
  } catch {
    // Already detached
  }

  const remaining = await db.paymentMethod.count({
    where: { userId: payload.sub },
  });

  if (method.isDefault && remaining > 1) {
    const next = await db.paymentMethod.findFirst({
      where: { userId: payload.sub, id: { not: method.id } },
      orderBy: { createdAt: "desc" },
    });
    if (next) {
      await db.paymentMethod.update({
        where: { id: next.id },
        data: { isDefault: true },
      });
    }
  }

  await db.paymentMethod.delete({ where: { id: method.id } });

  return apiSuccess({ message: "Payment method deleted." });
}

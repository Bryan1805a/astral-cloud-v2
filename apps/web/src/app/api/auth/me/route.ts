import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, apiSuccess, authenticateRequest } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    if (!auth) return apiError("UNAUTHORIZED", "Missing authorization token.");

    const user = await db.user.findUnique({
      where: { id: auth.userId },
      include: { twoFactorAuth: true },
    });

    if (!user || user.deletedAt) {
      return apiError("NOT_FOUND", "User not found.");
    }

    return apiSuccess({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
      balance: user.balance.toString(),
      referralCode: user.referralCode,
      taxExempt: user.taxExempt,
      billingAddress: user.billingAddress,
      twoFactorEnabled: user.twoFactorAuth?.enabled || false,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() || null,
      lastLoginAt: user.lastLoginAt?.toISOString() || null,
      createdAt: user.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("Me error:", error);
    return apiError("INTERNAL_ERROR", "An unexpected error occurred.");
  }
}

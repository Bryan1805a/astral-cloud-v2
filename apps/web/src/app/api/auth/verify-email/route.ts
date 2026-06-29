import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { verifyEmailToken } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { token } = body;

  if (!token) return apiError("VALIDATION_ERROR", "Token required.");

  const userId = await verifyEmailToken(token);
  if (!userId) return apiError("NOT_FOUND", "Invalid or expired verification token.");

  await db.user.update({
    where: { id: userId },
    data: { emailVerifiedAt: new Date(), status: "ACTIVE" },
  });

  return apiSuccess({ message: "Email verified successfully." });
}

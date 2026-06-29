import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { verifyAccessToken, verifyTOTP } from "@/lib/auth";
import { apiError, apiSuccess, getAuthToken } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const token = getAuthToken(request);
  if (!token) return apiError("UNAUTHORIZED", "Missing authorization.");
  let payload;
  try { payload = await verifyAccessToken(token); } catch { return apiError("TOKEN_EXPIRED", "Token expired."); }

  const user = await db.user.findUnique({ where: { id: payload.sub } });
  if (!user) return apiError("NOT_FOUND", "User not found.");
  if (user.role === "ADMIN") return apiError("FORBIDDEN", "ADMIN accounts cannot disable 2FA.");

  const body = await request.json();
  const totpCode = body.totpCode as string;
  if (!totpCode) return apiError("VALIDATION_ERROR", "TOTP code required.");

  const tfa = await db.twoFactorAuth.findUnique({ where: { userId: payload.sub } });
  if (!tfa?.enabled) return apiError("INVALID_STATE", "2FA is not enabled.");
  if (!tfa.secret || !await verifyTOTP(tfa.secret, totpCode)) return apiError("INVALID_2FA_CODE", "Invalid code.");

  await db.twoFactorAuth.update({
    where: { userId: payload.sub },
    data: { enabled: false, secret: "", backupCodes: "[]" },
  });

  await db.auditLog.create({
    data: {
      userId: payload.sub,
      action: "TWO_FACTOR_DISABLED",
      targetType: "User",
      targetId: payload.sub,
      result: "SUCCESS",
      ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
    },
  });

  return apiSuccess({ message: "Two-factor authentication has been disabled." });
}

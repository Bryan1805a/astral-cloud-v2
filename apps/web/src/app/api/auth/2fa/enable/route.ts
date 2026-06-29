import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { verifyAccessToken, generateTOTPSecret, generateTOTPUri, verifyTOTP, generateBackupCodes } from "@/lib/auth";
import { apiError, apiSuccess, getAuthToken } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = getAuthToken(request);
  if (!token) return apiError("UNAUTHORIZED", "Missing authorization.");
  let payload;
  try { payload = await verifyAccessToken(token); } catch { return apiError("TOKEN_EXPIRED", "Token expired."); }

  const existing = await db.twoFactorAuth.findUnique({ where: { userId: payload.sub } });
  if (existing?.enabled) return apiError("INVALID_STATE", "2FA is already enabled on this account.");

  const secret = generateTOTPSecret();
  const qrCodeUri = generateTOTPUri(secret, payload.sub);

  await db.twoFactorAuth.upsert({
    where: { userId: payload.sub },
    update: { secret },
    create: { userId: payload.sub, secret },
  });

  return apiSuccess({ secret, qrCodeUri, backupCodes: generateBackupCodes() });
}

export async function POST(request: NextRequest) {
  const token = getAuthToken(request);
  if (!token) return apiError("UNAUTHORIZED", "Missing authorization.");
  let payload;
  try { payload = await verifyAccessToken(token); } catch { return apiError("TOKEN_EXPIRED", "Token expired."); }

  const body = await request.json();
  const totpCode = body.totpCode as string;

  if (!totpCode || totpCode.length !== 6) return apiError("VALIDATION_ERROR", "A valid 6-digit TOTP code is required.");

  const tfa = await db.twoFactorAuth.findUnique({ where: { userId: payload.sub } });
  if (!tfa?.secret) return apiError("INVALID_STATE", "Setup not initiated. Call GET first.");

  if (!await verifyTOTP(tfa.secret, totpCode)) return apiError("INVALID_2FA_CODE", "Invalid authentication code.");

  const backupCodes = generateBackupCodes();
  const hashedBackups = await Promise.all(
    backupCodes.map(async (c) => {
      const { hash } = await import("bcryptjs").then((bcrypt) => ({ hash: bcrypt.hashSync(c, 6) }));
      return hash;
    })
  );

  await db.twoFactorAuth.update({
    where: { userId: payload.sub },
    data: { enabled: true, backupCodes: JSON.stringify(hashedBackups) },
  });

  await db.auditLog.create({
    data: {
      userId: payload.sub,
      action: "TWO_FACTOR_ENABLED",
      targetType: "User",
      targetId: payload.sub,
      result: "SUCCESS",
      ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
    },
  });

  return apiSuccess({ backupCodes });
}

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createAccessToken, createRefreshToken, createSession, verifyTOTP, verifyAccessToken } from "@/lib/auth";
import { apiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { tempToken, totpCode } = body;
  const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";

  if (!tempToken || !totpCode) return apiError("VALIDATION_ERROR", "tempToken and totpCode required.");

  let payload;
  try { payload = await verifyAccessToken(tempToken); } catch { return apiError("TOKEN_EXPIRED", "Temporary token expired."); }

  const user = await db.user.findFirst({
    where: { id: payload.sub, deletedAt: null },
    include: { twoFactorAuth: true },
  });

  if (!user || !user.twoFactorAuth?.enabled || !user.twoFactorAuth.secret) {
    return apiError("INVALID_STATE", "2FA is not enabled on this account.");
  }

  const isValid = await verifyTOTP(user.twoFactorAuth.secret, totpCode);
  if (!isValid) {
    const backupString = JSON.parse((user.twoFactorAuth.backupCodes as string) || "[]");
    const isValidBackup = backupString.some((hash: string) => bcrypt.compareSync(totpCode, hash));
    if (!isValidBackup) return apiError("INVALID_2FA_CODE", "Invalid authentication code.");

    const remainingBackups = backupString.filter((hash: string) => !bcrypt.compareSync(totpCode, hash));
    await db.twoFactorAuth.update({
      where: { userId: user.id },
      data: { backupCodes: JSON.stringify(remainingBackups) },
    });
  }

  const accessToken = await createAccessToken(user.id, user.role);
  const refreshToken = await createRefreshToken(user.id, user.role);
  const refreshTokenHash = await bcrypt.hash(refreshToken, 6);

  await createSession(user.id, refreshTokenHash, ip, request.headers.get("user-agent") || undefined);

  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await db.auditLog.create({
    data: {
      userId: user.id,
      action: "USER_LOGIN",
      targetType: "User",
      targetId: user.id,
      result: "SUCCESS",
      ipAddress: ip,
    },
  });

  const response = NextResponse.json({
    data: {
      accessToken,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
        twoFactorEnabled: true,
      },
    },
  });

  response.cookies.set("refresh_token", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/auth/refresh",
    maxAge: 7 * 24 * 60 * 60,
  });

  return response;
}

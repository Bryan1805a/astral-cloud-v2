import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { loginSchema } from "@astral/shared";
import { db } from "@/lib/db";
import {
  verifyPassword,
  createAccessToken,
  createRefreshToken,
  createTempToken,
  createSession,
  getClientIp,
} from "@/lib/auth";
import { apiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        "Request body validation failed.",
        400,
        parsed.error.errors.map((e) => ({ field: e.path.join("."), message: e.message }))
      );
    }

    const { email, password, rememberMe, totpCode } = parsed.data;
    const ip = getClientIp(request);

    const user = await db.user.findFirst({
      where: { email, deletedAt: null },
      include: { twoFactorAuth: true },
    });

    if (!user) {
      return apiError("INVALID_CREDENTIALS", "Invalid username or password.");
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return apiError(
        "ACCOUNT_LOCKED",
        "Your account has been locked due to too many failed attempts. Please try again in 15 minutes."
      );
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      const windowMs = 10 * 60 * 1000;
      const recent = await db.auditLog.count({
        where: {
          userId: user.id,
          action: "USER_LOGIN",
          result: "FAILURE",
          createdAt: { gte: new Date(Date.now() - windowMs) },
        },
      });

      await db.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: { increment: 1 },
          ...(recent >= 4
            ? { lockedUntil: new Date(Date.now() + 15 * 60 * 1000), failedLoginAttempts: 0 }
            : {}),
        },
      });

      return apiError("INVALID_CREDENTIALS", "Invalid username or password.");
    }

    if (user.twoFactorAuth?.enabled) {
      if (!totpCode) {
        const tempToken = await createTempToken(user.id);
        return apiError("TWO_FACTOR_REQUIRED", "This account has two-factor authentication enabled.", 401, undefined, {
          tempToken,
        });
      }

      if (!user.twoFactorAuth.secret) {
        return apiError("INTERNAL_ERROR", "2FA configuration error.");
      }

      const { verifyTOTP } = await import("@/lib/auth");
      const isValid = await verifyTOTP(user.twoFactorAuth.secret, totpCode);

      if (!isValid) {
        const backupString = JSON.parse((user.twoFactorAuth.backupCodes as string) || "[]");
        const isValidBackup = backupString.some((hash: string) => bcrypt.compareSync(totpCode, hash));

        if (isValidBackup) {
          const remainingBackups = backupString.filter((hash: string) => !bcrypt.compareSync(totpCode, hash));
          await db.twoFactorAuth.update({
            where: { userId: user.id },
            data: { backupCodes: JSON.stringify(remainingBackups) },
          });
        } else {
          return apiError("INVALID_2FA_CODE", "Invalid authentication code.");
        }
      }
    }

    const accessToken = await createAccessToken(user.id, user.role);
    const refreshToken = await createRefreshToken(user.id, user.role);

    const refreshTokenHash = await bcrypt.hash(refreshToken, 6);

    await createSession(user.id, refreshTokenHash, ip, request.headers.get("user-agent") || undefined);

    await db.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
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
          twoFactorEnabled: user.twoFactorAuth?.enabled || false,
        },
      },
    });

    const maxAge = rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60;
    response.cookies.set("access_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60,
    });
    response.cookies.set("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/auth/refresh",
      maxAge,
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return apiError("INTERNAL_ERROR", "An unexpected error occurred.");
  }
}

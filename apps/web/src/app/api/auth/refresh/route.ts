import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  verifyRefreshToken,
  createAccessToken,
  createRefreshToken,
  createSession,
  getClientIp,
} from "@/lib/auth";
import { extractTokenFromCookie, apiError } from "@/lib/errors";
import bcrypt from "bcryptjs";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const token = extractTokenFromCookie(request, "refresh_token");
    if (!token) {
      return apiError("UNAUTHORIZED", "Refresh token not found.");
    }

    let payload;
    try {
      payload = await verifyRefreshToken(token);
    } catch {
      return apiError("TOKEN_EXPIRED", "Refresh token has expired.");
    }

    const sessions = await db.session.findMany({
      where: { userId: payload.sub },
      orderBy: { createdAt: "desc" },
    });

    let validSession = false;
    for (const session of sessions) {
      if (await bcrypt.compare(token, session.refreshTokenHash)) {
        validSession = true;
        await db.session.delete({ where: { id: session.id } });
        break;
      }
    }

    if (!validSession) {
      return apiError("UNAUTHORIZED", "Invalid refresh token.");
    }

    const user = await db.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user || user.deletedAt) {
      return apiError("UNAUTHORIZED", "User not found.");
    }

    const accessToken = await createAccessToken(user.id, user.role);
    const refreshToken = await createRefreshToken(user.id, user.role);

    const refreshTokenHash = await bcrypt.hash(refreshToken, 6);
    const ip = getClientIp(request);

    await createSession(user.id, refreshTokenHash, ip, request.headers.get("user-agent") || undefined);

    const response = NextResponse.json({
      data: {
        accessToken,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
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
  } catch (error) {
    console.error("Refresh error:", error);
    return apiError("INTERNAL_ERROR", "An unexpected error occurred.");
  }
}

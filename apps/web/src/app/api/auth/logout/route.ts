import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthToken, apiError, apiSuccess } from "@/lib/errors";
import { verifyAccessToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const token = getAuthToken(request);
    if (!token) {
      return apiError("UNAUTHORIZED", "Missing authorization token.");
    }

    let payload;
    try {
      payload = await verifyAccessToken(token);
    } catch {
      return apiError("TOKEN_EXPIRED", "Access token has expired.");
    }

    await db.session.deleteMany({ where: { userId: payload.sub } });

    await db.auditLog.create({
      data: {
        userId: payload.sub,
        action: "USER_LOGOUT",
        targetType: "User",
        targetId: payload.sub,
        result: "SUCCESS",
        ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
      },
    });

    const response = NextResponse.json({
      data: { message: "Logged out successfully." },
    });

    response.cookies.set("refresh_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/api/auth/refresh",
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return apiError("INTERNAL_ERROR", "An unexpected error occurred.");
  }
}

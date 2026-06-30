import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const body = await request.json();
  const { username, email } = body;

  if (!username && !email) return apiError("VALIDATION_ERROR", "Nothing to update.");

  const data: Record<string, string> = {};
  if (username) {
    if (username.length < 1 || username.length > 32) return apiError("VALIDATION_ERROR", "Username must be 1-32 characters.");
    const existing = await db.user.findFirst({ where: { username, id: { not: auth.userId }, deletedAt: null } });
    if (existing) return apiError("USERNAME_TAKEN", "Username already in use.");
    data.username = username.trim();
  }
  if (email) {
    if (email.length > 255) return apiError("VALIDATION_ERROR", "Email too long.");
    const existing = await db.user.findFirst({ where: { email, id: { not: auth.userId }, deletedAt: null } });
    if (existing) return apiError("EMAIL_TAKEN", "Email already in use.");
    data.email = email.trim();
  }

  const user = await db.user.update({ where: { id: auth.userId }, data });

  return apiSuccess({ username: user.username, email: user.email });
}

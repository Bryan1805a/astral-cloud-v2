import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";
import { hashPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const body = await request.json();
  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) return apiError("VALIDATION_ERROR", "Current and new password required.");
  if (newPassword.length < 8) return apiError("VALIDATION_ERROR", "Password must be at least 8 characters.");

  const user = await db.user.findUnique({ where: { id: auth.userId } });
  if (!user) return apiError("NOT_FOUND", "User not found.");

  const { verifyPassword } = await import("@/lib/auth");
  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) return apiError("INVALID_CREDENTIALS", "Current password is incorrect.");

  const passwordHash = await hashPassword(newPassword);
  await db.user.update({ where: { id: user.id }, data: { passwordHash } });

  return apiSuccess({ message: "Password changed." });
}

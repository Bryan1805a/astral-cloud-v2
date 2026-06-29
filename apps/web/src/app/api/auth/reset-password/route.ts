import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { createHash } from "crypto";
import { hashPassword, consumeResetToken } from "@/lib/auth";
import { apiError, apiSuccess } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { token, newPassword } = body;

  if (!token || !newPassword) return apiError("VALIDATION_ERROR", "Token and new password required.");
  if (newPassword.length < 8) return apiError("VALIDATION_ERROR", "Password must be at least 8 characters.");
  if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return apiError("VALIDATION_ERROR", "Password needs uppercase, lowercase, and digit.");
  }

  const settings = await db.systemSetting.findMany({ where: { key: { startsWith: "reset_" } } });
  let userId: string | null = null;

  for (const setting of settings) {
    try {
      const data = JSON.parse(setting.value);
      if (new Date(data.expiresAt) < new Date()) continue;
      if (createHash("sha256").update(token).digest("hex") === data.hash) {
        userId = setting.key.replace("reset_", "");
        break;
      }
    } catch { continue; }
  }

  if (!userId) return apiError("NOT_FOUND", "Invalid or expired reset token.");

  const passwordHash = await hashPassword(newPassword);
  await db.user.update({ where: { id: userId }, data: { passwordHash } });
  await consumeResetToken(userId);

  await db.session.deleteMany({ where: { userId } });

  return apiSuccess({ message: "Password has been reset successfully." });
}

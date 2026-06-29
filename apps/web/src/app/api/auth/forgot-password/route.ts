import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { createResetToken } from "@/lib/auth";
import { sendPasswordResetEmail } from "@/lib/email";
import { apiError, apiSuccess } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email } = body;

  if (!email) return apiError("VALIDATION_ERROR", "Email is required.");

  const user = await db.user.findFirst({ where: { email, deletedAt: null } });

  if (user) {
    const token = await createResetToken(user.id);
    sendPasswordResetEmail(user.email, token).catch((e) => console.error("Failed to send reset email:", e));
  }

  return apiSuccess({ message: "If an account with that email exists, a password reset link has been sent." });
}

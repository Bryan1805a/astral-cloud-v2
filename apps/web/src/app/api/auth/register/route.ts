import { NextRequest } from "next/server";
import { registerSchema } from "@astral/shared";
import { db } from "@/lib/db";
import { hashPassword, createVerificationToken } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email";
import { apiError, apiSuccess } from "@/lib/errors";
import { UserRole, UserStatus } from "@astral/shared";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        "Request body validation failed.",
        400,
        parsed.error.errors.map((e) => ({ field: e.path.join("."), message: e.message }))
      );
    }

    const { username, email, password, referralCode } = parsed.data;

    const existing = await db.user.findFirst({
      where: {
        OR: [{ username }, { email }],
        deletedAt: null,
      },
    });
    if (existing) {
      if (existing.username === username) {
        return apiError("USERNAME_TAKEN", "This username is already in use.");
      }
      return apiError("EMAIL_TAKEN", "An account with this email already exists.");
    }

    const passwordHash = await hashPassword(password);

    const referralCode_ = generateReferralCode();

    const user = await db.user.create({
      data: {
        username,
        email,
        passwordHash,
        referralCode: referralCode_,
        role: UserRole.CUSTOMER,
        status: UserStatus.ACTIVE,
      },
    });

    await db.notificationPreference.create({
      data: { userId: user.id },
    });

    if (referralCode) {
      const referrer = await db.user.findFirst({
        where: { referralCode, deletedAt: null },
      });
      if (referrer && referrer.id !== user.id) {
        await db.referral.create({
          data: {
            referrerId: referrer.id,
            refereeId: user.id,
            refereeIpAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
            status: "PENDING",
            referrerCredit: "0",
            refereeCredit: "0",
          },
        });
      }
    }

    await db.auditLog.create({
      data: {
        userId: user.id,
        action: "USER_CREATED",
        targetType: "User",
        targetId: user.id,
        result: "SUCCESS",
        ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
      },
    });

    const verifyToken = await createVerificationToken(user.id);
    sendVerificationEmail(user.email, verifyToken).catch((e) => console.error("Failed to send verification email:", e));

    return apiSuccess(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        status: user.status,
        referralCode: user.referralCode,
        createdAt: user.createdAt.toISOString(),
      },
      201
    );
  } catch (error) {
    console.error("Register error:", error);
    return apiError("INTERNAL_ERROR", "Registration failed. Please try again later.");
  }
}

function generateReferralCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

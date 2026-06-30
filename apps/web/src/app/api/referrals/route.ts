import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const user = await db.user.findUnique({
    where: { id: auth.userId },
    select: { referralCode: true, balance: true },
  });
  if (!user) return apiError("NOT_FOUND", "User not found.");

  const referrals = await db.referral.findMany({
    where: { referrerId: auth.userId },
    orderBy: { createdAt: "desc" },
    include: { referee: { select: { username: true, createdAt: true } } },
  });

  const creditedCount = referrals.filter((r) => r.status === "CREDITED").length;
  const pendingCount = referrals.filter((r) => r.status === "PENDING").length;
  const totalEarnings = referrals
    .filter((r) => r.status === "CREDITED")
    .reduce((sum, r) => sum + Number(r.referrerCredit), 0);

  const payouts = await db.referralPayout.findMany({
    where: { userId: auth.userId },
    orderBy: { createdAt: "desc" },
  });
  const totalPaidOut = payouts
    .filter((p) => p.status === "COMPLETED")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  return apiSuccess({
    referralCode: user.referralCode,
    referralLink: `https://astral.cloud/register?ref=${user.referralCode}`,
    stats: {
      totalReferrals: referrals.length,
      creditedReferrals: creditedCount,
      pendingReferrals: pendingCount,
      totalEarnings,
      availableBalance: totalEarnings - totalPaidOut,
      totalPaidOut,
    },
    referrals: referrals.map((r) => ({
      id: r.id,
      referee: r.referee.username,
      status: r.status,
      referrerCredit: r.referrerCredit.toString(),
      refereeCredit: r.refereeCredit.toString(),
      createdAt: r.createdAt.toISOString(),
    })),
  });
}

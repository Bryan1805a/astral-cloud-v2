import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getAuthToken, apiError, apiPaginated } from "@/lib/errors";
import { verifyAccessToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = getAuthToken(request);
  if (!token) return apiError("UNAUTHORIZED", "Missing authorization token.");

  let payload;
  try {
    payload = await verifyAccessToken(token);
  } catch {
    return apiError("TOKEN_EXPIRED", "Access token has expired.");
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
  const skip = (page - 1) * limit;

  const [payments, total] = await Promise.all([
    db.payment.findMany({
      where: { userId: payload.sub },
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    db.payment.count({ where: { userId: payload.sub } }),
  ]);

  const data = payments.map((p) => ({
    id: p.id,
    amount: p.amount.toString(),
    currency: p.currency,
    status: p.status,
    type: p.type,
    createdAt: p.createdAt.toISOString(),
  }));

  return apiPaginated(data, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
}

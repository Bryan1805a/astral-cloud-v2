import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiPaginated } from "@/lib/errors";

export const dynamic = "force-dynamic";

async function requireAdmin(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth || (auth.role !== "ADMIN" && auth.role !== "STAFF")) return null;
  return auth;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth) return apiError("FORBIDDEN", "Admin or staff access required.");

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    db.user.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        status: true,
        balance: true,
        taxExempt: true,
        emailVerifiedAt: true,
        lastLoginAt: true,
        createdAt: true,
      },
    }),
    db.user.count(),
  ]);

  const data = users.map((u) => ({
    ...u,
    balance: u.balance.toString(),
    emailVerifiedAt: u.emailVerifiedAt?.toISOString() || null,
    lastLoginAt: u.lastLoginAt?.toISOString() || null,
    createdAt: u.createdAt.toISOString(),
  }));

  return apiPaginated(data, { page, limit, total, totalPages: Math.ceil(total / limit) });
}

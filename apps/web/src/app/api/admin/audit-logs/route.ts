import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiPaginated } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth || (auth.role !== "ADMIN" && auth.role !== "STAFF")) {
    return apiError("FORBIDDEN", "Admin or staff access required.");
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
  const skip = (page - 1) * limit;
  const action = searchParams.get("action");

  const where: Record<string, unknown> = {};
  if (action) where.action = action;

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    db.auditLog.count({ where }),
  ]);

  const data = logs.map((l) => ({
    id: l.id,
    userId: l.userId,
    action: l.action,
    targetType: l.targetType,
    targetId: l.targetId,
    result: l.result,
    metadata: l.metadata,
    ipAddress: l.ipAddress,
    createdAt: l.createdAt.toISOString(),
  }));

  return apiPaginated(data, { page, limit, total, totalPages: Math.ceil(total / limit) });
}

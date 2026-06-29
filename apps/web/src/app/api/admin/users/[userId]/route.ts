import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";

async function requireAdmin(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth || auth.role !== "ADMIN") return null;
  return auth;
}

export async function PUT(request: NextRequest, { params }: { params: { userId: string } }) {
  const auth = await requireAdmin(request);
  if (!auth) return apiError("FORBIDDEN", "Admin access required.");

  const body = await request.json();
  const { role, status, taxExempt } = body;

  const data: Record<string, unknown> = {};
  if (role) data.role = role;
  if (status) data.status = status;
  if (taxExempt !== undefined) data.taxExempt = taxExempt;

  if (Object.keys(data).length === 0) {
    return apiError("VALIDATION_ERROR", "No valid fields to update.");
  }

  const user = await db.user.update({
    where: { id: params.userId },
    data,
  });

  await db.auditLog.create({
    data: {
      userId: auth.userId,
      action: "USER_UPDATED",
      targetType: "User",
      targetId: params.userId,
      result: "SUCCESS",
      ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
      metadata: JSON.parse(JSON.stringify(data)),
    },
  });

  return apiSuccess({
    id: user.id,
    username: user.username,
    role: user.role,
    status: user.status,
    taxExempt: user.taxExempt,
  });
}

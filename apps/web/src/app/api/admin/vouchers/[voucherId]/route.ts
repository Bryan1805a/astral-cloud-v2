import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";

async function requireAdmin(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth || (auth.role !== "ADMIN" && auth.role !== "STAFF")) return null;
  return auth;
}

export async function DELETE(request: NextRequest, { params }: { params: { voucherId: string } }) {
  const auth = await requireAdmin(request);
  if (!auth) return apiError("FORBIDDEN", "Admin or staff access required.");

  await db.voucher.update({
    where: { id: params.voucherId },
    data: { isActive: false },
  });

  await db.auditLog.create({
    data: {
      userId: auth.userId,
      action: "VOUCHER_DEACTIVATED",
      targetType: "Voucher",
      targetId: params.voucherId,
      result: "SUCCESS",
      ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
    },
  });

  return apiSuccess({ message: "Voucher deactivated." });
}

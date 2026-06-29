import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";
import { createVoucherSchema } from "@astral/shared";

export const dynamic = "force-dynamic";

async function requireAdmin(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth || (auth.role !== "ADMIN" && auth.role !== "STAFF")) return null;
  return auth;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth) return apiError("FORBIDDEN", "Admin or staff access required.");

  const vouchers = await db.voucher.findMany({
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { username: true } } },
  });

  return apiSuccess(
    vouchers.map((v) => ({
      id: v.id,
      code: v.code,
      description: v.description,
      discountType: v.discountType,
      discountValue: v.discountValue.toString(),
      maxUses: v.maxUses,
      currentUses: v.currentUses,
      maxUsesPerUser: v.maxUsesPerUser,
      minSpend: v.minSpend?.toString() || null,
      validFrom: v.validFrom?.toISOString() || null,
      validUntil: v.validUntil?.toISOString() || null,
      isActive: v.isActive,
      createdBy: v.createdBy.username,
      createdAt: v.createdAt.toISOString(),
    }))
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth) return apiError("FORBIDDEN", "Admin or staff access required.");

  const body = await request.json();
  const parsed = createVoucherSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid voucher data.", 400,
      parsed.error.errors.map((e) => ({ field: e.path.join("."), message: e.message })));
  }

  const voucher = await db.voucher.create({
    data: { ...parsed.data, createdByUserId: auth.userId },
  });

  await db.auditLog.create({
    data: {
      userId: auth.userId,
      action: "VOUCHER_CREATED",
      targetType: "Voucher",
      targetId: voucher.id,
      result: "SUCCESS",
      ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
    },
  });

  return apiSuccess({ id: voucher.id, code: voucher.code }, 201);
}

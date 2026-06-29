import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";
import { updateServerPlanSchema } from "@astral/shared";

async function requireAdmin(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth || auth.role !== "ADMIN") return null;
  return auth;
}

export async function PUT(request: NextRequest, { params }: { params: { planId: string } }) {
  const auth = await requireAdmin(request);
  if (!auth) return apiError("FORBIDDEN", "Admin access required.");

  const body = await request.json();
  const parsed = updateServerPlanSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid plan data.", 400,
      parsed.error.errors.map((e) => ({ field: e.path.join("."), message: e.message })));
  }

  const { regionIds, ...data } = parsed.data;

  const plan = await db.serverPlan.update({
    where: { id: params.planId },
    data,
  });

  if (regionIds) {
    await db.planRegion.deleteMany({ where: { planId: plan.id } });
    await db.planRegion.createMany({
      data: regionIds.map((regionId) => ({ planId: plan.id, regionId })),
    });
  }

  await db.auditLog.create({
    data: {
      userId: auth.userId,
      action: "PLAN_UPDATED",
      targetType: "ServerPlan",
      targetId: plan.id,
      result: "SUCCESS",
      ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
      metadata: JSON.parse(JSON.stringify(data)),
    },
  });

  return apiSuccess({ id: plan.id, name: plan.name });
}

export async function DELETE(request: NextRequest, { params }: { params: { planId: string } }) {
  const auth = await requireAdmin(request);
  if (!auth) return apiError("FORBIDDEN", "Admin access required.");

  await db.serverPlan.update({
    where: { id: params.planId },
    data: { isActive: false },
  });

  await db.auditLog.create({
    data: {
      userId: auth.userId,
      action: "PLAN_DEACTIVATED",
      targetType: "ServerPlan",
      targetId: params.planId,
      result: "SUCCESS",
      ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
    },
  });

  return apiSuccess({ message: "Plan deactivated." });
}

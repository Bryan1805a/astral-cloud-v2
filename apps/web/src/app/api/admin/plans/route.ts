import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";
import { createServerPlanSchema } from "@astral/shared";

export const dynamic = "force-dynamic";

async function requireAdmin(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth || auth.role !== "ADMIN") return null;
  return auth;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth) return apiError("FORBIDDEN", "Admin access required.");

  const plans = await db.serverPlan.findMany({
    orderBy: { createdAt: "desc" },
    include: { planRegions: { include: { region: { select: { id: true, name: true, slug: true } } } } },
  });

  return apiSuccess(
    plans.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      vcpu: p.vcpu,
      ramMB: p.ramMB,
      diskGB: p.diskGB,
      bandwidthMbps: p.bandwidthMbps,
      priceMonthly: p.priceMonthly.toString(),
      priceHourly: p.priceHourly.toString(),
      maxServers: p.maxServers,
      isActive: p.isActive,
      regions: p.planRegions.map((pr) => pr.region),
      createdAt: p.createdAt.toISOString(),
    }))
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth) return apiError("FORBIDDEN", "Admin access required.");

  const body = await request.json();
  const parsed = createServerPlanSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid plan data.", 400,
      parsed.error.errors.map((e) => ({ field: e.path.join("."), message: e.message })));
  }

  const { regionIds, ...data } = parsed.data;

  const plan = await db.serverPlan.create({ data });

  if (regionIds.length > 0) {
    await db.planRegion.createMany({
      data: regionIds.map((regionId) => ({ planId: plan.id, regionId })),
    });
  }

  await db.auditLog.create({
    data: {
      userId: auth.userId,
      action: "PLAN_CREATED",
      targetType: "ServerPlan",
      targetId: plan.id,
      result: "SUCCESS",
      ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
      metadata: JSON.parse(JSON.stringify(data)),
    },
  });

  return apiSuccess({ id: plan.id, name: plan.name, slug: plan.slug }, 201);
}

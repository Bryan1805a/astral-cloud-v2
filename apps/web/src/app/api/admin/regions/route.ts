import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";
import { createRegionSchema } from "@astral/shared";

export const dynamic = "force-dynamic";

async function requireAdmin(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth || auth.role !== "ADMIN") return null;
  return auth;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth) return apiError("FORBIDDEN", "Admin access required.");

  const regions = await db.region.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { nodes: true, serverInstances: true } },
    },
  });

  return apiSuccess(
    regions.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      isActive: r.isActive,
      nodeCount: r._count.nodes,
      serverCount: r._count.serverInstances,
      createdAt: r.createdAt.toISOString(),
    }))
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth) return apiError("FORBIDDEN", "Admin access required.");

  const body = await request.json();
  const parsed = createRegionSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid region data.", 400,
      parsed.error.errors.map((e) => ({ field: e.path.join("."), message: e.message })));
  }

  const region = await db.region.create({ data: parsed.data });

  await db.auditLog.create({
    data: {
      userId: auth.userId,
      action: "REGION_CREATED",
      targetType: "Region",
      targetId: region.id,
      result: "SUCCESS",
      ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
    },
  });

  return apiSuccess({ id: region.id, name: region.name, slug: region.slug }, 201);
}

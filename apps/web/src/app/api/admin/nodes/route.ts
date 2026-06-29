import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";
import { createNodeSchema } from "@astral/shared";

export const dynamic = "force-dynamic";

async function requireAdmin(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth || auth.role !== "ADMIN") return null;
  return auth;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth) return apiError("FORBIDDEN", "Admin access required.");

  const nodes = await db.node.findMany({
    orderBy: { createdAt: "desc" },
    include: { region: { select: { id: true, name: true, slug: true } } },
  });

  return apiSuccess(
    nodes.map((n) => ({
      id: n.id,
      name: n.name,
      region: n.region,
      dockerEndpoint: n.dockerEndpoint,
      status: n.status,
      totalVcpu: n.totalVcpu,
      totalRamMB: n.totalRamMB,
      totalDiskGB: n.totalDiskGB,
      allocatedVcpu: n.allocatedVcpu,
      allocatedRamMB: n.allocatedRamMB,
      allocatedDiskGB: n.allocatedDiskGB,
      lastHeartbeatAt: n.lastHeartbeatAt?.toISOString() || null,
      createdAt: n.createdAt.toISOString(),
    }))
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth) return apiError("FORBIDDEN", "Admin access required.");

  const body = await request.json();
  const parsed = createNodeSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid node data.", 400,
      parsed.error.errors.map((e) => ({ field: e.path.join("."), message: e.message })));
  }

  const node = await db.node.create({ data: parsed.data });

  await db.auditLog.create({
    data: {
      userId: auth.userId,
      action: "NODE_CREATED",
      targetType: "Node",
      targetId: node.id,
      result: "SUCCESS",
      ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
      metadata: JSON.parse(JSON.stringify(parsed.data)),
    },
  });

  return apiSuccess({ id: node.id, name: node.name }, 201);
}

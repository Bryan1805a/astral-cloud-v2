import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";
import { updateNodeSchema } from "@astral/shared";

async function requireAdmin(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth || auth.role !== "ADMIN") return null;
  return auth;
}

export async function PUT(request: NextRequest, { params }: { params: { nodeId: string } }) {
  const auth = await requireAdmin(request);
  if (!auth) return apiError("FORBIDDEN", "Admin access required.");

  const body = await request.json();
  const parsed = updateNodeSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid node data.", 400,
      parsed.error.errors.map((e) => ({ field: e.path.join("."), message: e.message })));
  }

  const node = await db.node.update({
    where: { id: params.nodeId },
    data: parsed.data,
  });

  await db.auditLog.create({
    data: {
      userId: auth.userId,
      action: "NODE_UPDATED",
      targetType: "Node",
      targetId: node.id,
      result: "SUCCESS",
      ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
      metadata: JSON.parse(JSON.stringify(parsed.data)),
    },
  });

  return apiSuccess({ id: node.id, name: node.name });
}

export async function DELETE(request: NextRequest, { params }: { params: { nodeId: string } }) {
  const auth = await requireAdmin(request);
  if (!auth) return apiError("FORBIDDEN", "Admin access required.");

  await db.node.update({
    where: { id: params.nodeId },
    data: { status: "OFFLINE" },
  });

  await db.auditLog.create({
    data: {
      userId: auth.userId,
      action: "NODE_DELETED",
      targetType: "Node",
      targetId: params.nodeId,
      result: "SUCCESS",
      ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
    },
  });

  return apiSuccess({ message: "Node deactivated." });
}

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";
import { assignFloatingIpSchema } from "@astral/shared";

export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest, { params }: { params: { ipId: string } }) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const fip = await db.floatingIp.findFirst({
    where: { id: params.ipId, userId: auth.userId },
  });
  if (!fip) return apiError("NOT_FOUND", "Floating IP not found.");

  await db.floatingIp.delete({ where: { id: fip.id } });
  return apiSuccess({ deleted: true });
}

export async function PUT(request: NextRequest, { params }: { params: { ipId: string } }) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const fip = await db.floatingIp.findFirst({
    where: { id: params.ipId, userId: auth.userId },
  });
  if (!fip) return apiError("NOT_FOUND", "Floating IP not found.");

  const body = await request.json();
  const parsed = assignFloatingIpSchema.safeParse(body);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Server ID required.");

  if (fip.serverId) return apiError("INVALID_STATE", "IP is already assigned. Unassign it first.");

  const server = await db.serverInstance.findFirst({
    where: { id: parsed.data.serverId, userId: auth.userId, deletedAt: null },
  });
  if (!server) return apiError("NOT_FOUND", "Server not found.");
  if (server.regionId !== fip.regionId) return apiError("VALIDATION_ERROR", "Server must be in the same region.");
  if (server.status !== "ACTIVE" && server.status !== "STOPPED") {
    return apiError("INVALID_STATE", "Server must be ACTIVE or STOPPED.");
  }
  if (server.lockedBy) return apiError("INVALID_STATE", `Server is currently ${server.lockedBy.toLowerCase()}.`);

  const updated = await db.$transaction(async (tx) => {
    const assigned = await tx.floatingIp.update({
      where: { id: fip.id },
      data: { serverId: parsed.data.serverId, assignedAt: new Date() },
    });
    if (!assigned) throw new Error("Concurrent assignment detected. Try again.");
    return assigned;
  }).catch(() => null);

  if (!updated) return apiError("INVALID_STATE", "IP was assigned by another request. Try again.");

  return apiSuccess({ id: fip.id, serverId: parsed.data.serverId, status: "assigned" });
}

export async function POST(request: NextRequest, { params }: { params: { ipId: string } }) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const fip = await db.floatingIp.findFirst({
    where: { id: params.ipId, userId: auth.userId },
  });
  if (!fip) return apiError("NOT_FOUND", "Floating IP not found.");
  if (!fip.serverId) return apiError("INVALID_STATE", "IP is not assigned to any server.");

  await db.floatingIp.update({
    where: { id: fip.id },
    data: { serverId: null, assignedAt: null },
  });

  return apiSuccess({ id: fip.id, serverId: null, status: "unassigned" });
}

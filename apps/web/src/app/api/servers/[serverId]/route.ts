import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getAuthToken, apiError, apiSuccess } from "@/lib/errors";
import { verifyAccessToken } from "@/lib/auth";
import { deleteServer, InvalidStateError, ServerLockedError } from "@/lib/services/server.service";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { serverId: string } }
) {
  const token = getAuthToken(request);
  if (!token) return apiError("UNAUTHORIZED", "Missing authorization token.");

  let payload;
  try {
    payload = await verifyAccessToken(token);
  } catch {
    return apiError("TOKEN_EXPIRED", "Access token has expired.");
  }

  const server = await db.serverInstance.findFirst({
    where: { id: params.serverId, userId: payload.sub, deletedAt: null },
    include: {
      serverPlan: true,
      imageTemplate: true,
      region: true,
      node: { select: { id: true, name: true } },
      sshKey: { select: { id: true, label: true, publicKey: true } },
      serverTags: { include: { tag: true } },
    },
  });

  if (!server) return apiError("NOT_FOUND", "Server not found.");

  return apiSuccess({
    id: server.id,
    hostname: server.hostname,
    status: server.status,
    ipAddress: server.ipAddress,
    dockerContainerId: server.dockerContainerId,
    plan: server.serverPlan,
    image: server.imageTemplate,
    region: server.region,
    node: server.node,
    sshKey: server.sshKey,
    snapshot: null,
    billingModel: server.billingModel,
    vcpu: server.vcpu,
    ramMB: server.ramMB,
    diskGB: server.diskGB,
    nextBillingAt: server.nextBillingAt?.toISOString() || null,
    gracePeriodEndsAt: server.gracePeriodEndsAt?.toISOString() || null,
    tags: server.serverTags.map((st) => ({
      id: st.tag.id,
      name: st.tag.name,
      color: st.tag.color,
    })),
    createdAt: server.createdAt.toISOString(),
    updatedAt: server.updatedAt.toISOString(),
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { serverId: string } }
) {
  const token = getAuthToken(request);
  if (!token) return apiError("UNAUTHORIZED", "Missing authorization token.");

  let payload;
  try {
    payload = await verifyAccessToken(token);
  } catch {
    return apiError("TOKEN_EXPIRED", "Access token has expired.");
  }

  let body: Record<string, string> = {};
  try { body = await request.json(); } catch { /* no body */ }
  const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";

  try {
    const server = await deleteServer(
      params.serverId,
      payload.sub,
      body.confirmHostname || "",
      ip
    );

    return apiSuccess({
      id: server.id,
      hostname: server.hostname,
      status: "DELETED",
      deletedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof InvalidStateError) {
      return apiError("INVALID_STATE", "You must stop the server before deleting it.");
    }
    if (error instanceof ServerLockedError) {
      return apiError("INVALID_STATE", `Server is currently ${error.lockedBy}`);
    }
    if (error instanceof Error) {
      return apiError("VALIDATION_ERROR", error.message);
    }
    console.error("Delete server error:", error);
    return apiError("INTERNAL_ERROR", "An unexpected error occurred.");
  }
}

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getAuthToken, apiError, apiSuccess } from "@/lib/errors";
import { verifyAccessToken } from "@/lib/auth";

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
  });

  if (!server) return apiError("NOT_FOUND", "Server not found.");
  if (server.status !== "ACTIVE") {
    return apiError("INVALID_STATE", "Server is not running.");
  }

  return apiSuccess({
    cpuPercent: 0,
    ramUsedMB: 0,
    ramTotalMB: server.ramMB,
    ramPercent: 0,
    diskUsedGB: 0,
    diskTotalGB: server.diskGB,
    diskPercent: 0,
    bandwidthInMbps: 0,
    bandwidthOutMbps: 0,
    uptimeSeconds: 0,
    collectedAt: new Date().toISOString(),
  });
}

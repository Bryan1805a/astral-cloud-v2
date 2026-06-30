import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { networkId: string } }) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const network = await db.privateNetwork.findFirst({
    where: { id: params.networkId, userId: auth.userId },
  });
  if (!network) return apiError("NOT_FOUND", "Network not found.");

  const body = await request.json();
  const { serverId } = body;
  if (!serverId) return apiError("VALIDATION_ERROR", "Server ID required.");

  const membership = await db.serverPrivateNetwork.findFirst({
    where: { serverId, networkId: network.id },
  });
  if (!membership) return apiError("NOT_FOUND", "Server is not a member of this network.");

  await db.serverPrivateNetwork.delete({ where: { id: membership.id } });
  return apiSuccess({ detached: true });
}

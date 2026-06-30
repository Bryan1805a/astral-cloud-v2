import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { volumeId: string } }) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const volume = await db.blockVolume.findFirst({
    where: { id: params.volumeId, userId: auth.userId, deletedAt: null },
  });
  if (!volume) return apiError("NOT_FOUND", "Volume not found.");
  if (volume.status !== "ATTACHED") return apiError("INVALID_STATE", "Volume is not attached.");

  const server = volume.serverId ? await db.serverInstance.findUnique({ where: { id: volume.serverId } }) : null;
  if (server?.lockedBy) return apiError("INVALID_STATE", `Server is currently ${server.lockedBy.toLowerCase()}.`);

  await db.blockVolume.update({
    where: { id: volume.id },
    data: { serverId: null, devicePath: null, attachedAt: null, status: "AVAILABLE" },
  });

  return apiSuccess({ status: "AVAILABLE" });
}

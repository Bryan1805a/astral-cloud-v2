import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";
import { serverQueue, JobType } from "@/lib/queue";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { volumeId: string } }) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const volume = await db.blockVolume.findFirst({
    where: { id: params.volumeId, userId: auth.userId, deletedAt: null },
    include: {
      region: { select: { id: true, name: true, slug: true } },
      node: { select: { id: true, name: true } },
      server: { select: { id: true, hostname: true } },
    },
  });
  if (!volume) return apiError("NOT_FOUND", "Volume not found.");

  return apiSuccess({
    id: volume.id, name: volume.name, sizeGB: volume.sizeGB, status: volume.status,
    region: volume.region, node: volume.node,
    serverId: volume.serverId, serverHostname: volume.server?.hostname || null,
    devicePath: volume.devicePath, attachedAt: volume.attachedAt?.toISOString() || null,
    dockerVolumeId: volume.dockerVolumeId,
    createdAt: volume.createdAt.toISOString(),
  });
}

export async function DELETE(request: NextRequest, { params }: { params: { volumeId: string } }) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const volume = await db.blockVolume.findFirst({
    where: { id: params.volumeId, userId: auth.userId, deletedAt: null },
  });
  if (!volume) return apiError("NOT_FOUND", "Volume not found.");
  if (volume.status === "ATTACHED") return apiError("INVALID_STATE", "Detach the volume before deleting.");
  if (volume.status === "CREATING" || volume.status === "DELETING" || volume.status === "DETACHING") {
    return apiError("INVALID_STATE", `Volume is currently ${volume.status.toLowerCase()}.`);
  }

  await db.blockVolume.update({ where: { id: volume.id }, data: { status: "DELETING" } });

  await serverQueue.add(JobType.VOLUME_DELETE, { type: JobType.VOLUME_DELETE, volumeId: volume.id });

  return apiSuccess({ deleted: true });
}

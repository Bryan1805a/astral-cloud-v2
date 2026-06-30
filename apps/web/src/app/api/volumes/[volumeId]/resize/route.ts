import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";
import { resizeVolumeSchema } from "@astral/shared";

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest, { params }: { params: { volumeId: string } }) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const volume = await db.blockVolume.findFirst({
    where: { id: params.volumeId, userId: auth.userId, deletedAt: null },
  });
  if (!volume) return apiError("NOT_FOUND", "Volume not found.");
  if (volume.status === "CREATING" || volume.status === "DELETING") {
    return apiError("INVALID_STATE", "Volume is busy.");
  }

  const body = await request.json();
  const parsed = resizeVolumeSchema.safeParse(body);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Invalid size.");

  if (parsed.data.sizeGB <= volume.sizeGB) {
    return apiError("VALIDATION_ERROR", "Volume size can only be increased, not decreased.");
  }

  if (volume.nodeId) {
    const node = await db.node.findUnique({ where: { id: volume.nodeId } });
    if (node) {
      const freeDisk = node.totalDiskGB - node.allocatedDiskGB;
      const increase = parsed.data.sizeGB - volume.sizeGB;
      if (increase > freeDisk) return apiError("NODE_CAPACITY", "Not enough disk space on node.");
    }
  }

  const updated = await db.$transaction(async (tx) => {
    const v = await tx.blockVolume.update({
      where: { id: volume.id },
      data: { sizeGB: parsed.data.sizeGB },
    });
    if (volume.nodeId) {
      await tx.node.update({
        where: { id: volume.nodeId },
        data: { allocatedDiskGB: { increment: parsed.data.sizeGB - volume.sizeGB } },
      });
    }
    return v;
  });

  return apiSuccess({ id: updated.id, sizeGB: updated.sizeGB });
}

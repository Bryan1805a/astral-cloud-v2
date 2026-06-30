import { PrismaClient } from "@prisma/client";
import type { ContainerRuntime } from "../runtime/types";

const db = new PrismaClient();

export async function handleVolumeCreateJob(runtime: ContainerRuntime, volumeId: string) {
  const volume = await db.blockVolume.findUnique({
    where: { id: volumeId },
    include: { node: true },
  });

  if (!volume) { console.error(`[volume-create] Volume ${volumeId} not found`); return; }
  if (volume.status === "AVAILABLE") { console.log(`[volume-create] Already available`); return; }
  if (!volume.node) { console.error(`[volume-create] No node assigned`); return; }

  try {
    const volumeIdResult = await runtime.createVolume(
      volume.node.dockerEndpoint,
      `vol-${volume.id.slice(0, 12)}`,
      volume.sizeGB
    );

    await db.blockVolume.update({
      where: { id: volumeId },
      data: { status: "AVAILABLE", dockerVolumeId: volumeIdResult },
    });

    console.log(`[volume-create] Volume ${volumeId} created: ${volumeIdResult}`);
  } catch (error) {
    console.error(`[volume-create] Failed:`, error);
    await db.blockVolume.update({ where: { id: volumeId }, data: { status: "ERROR" } });
  }
}

export async function handleVolumeDeleteJob(runtime: ContainerRuntime, volumeId: string) {
  const volume = await db.blockVolume.findUnique({
    where: { id: volumeId },
    include: { node: true },
  });

  if (!volume) { console.error(`[volume-delete] Volume ${volumeId} not found`); return; }

  try {
    if (volume.dockerVolumeId && volume.node) {
      await runtime.deleteVolume(volume.node.dockerEndpoint, volume.dockerVolumeId);
    }

    await db.$transaction(async (tx) => {
      if (volume.nodeId) {
        await tx.node.update({
          where: { id: volume.nodeId },
          data: { allocatedDiskGB: { decrement: volume.sizeGB } },
        });
      }
      await tx.blockVolume.update({
        where: { id: volumeId },
        data: { deletedAt: new Date(), status: "DELETING" },
      });
    });

    console.log(`[volume-delete] Volume ${volumeId} deleted`);
  } catch (error) {
    console.error(`[volume-delete] Failed:`, error);
    await db.blockVolume.update({ where: { id: volumeId }, data: { status: "ERROR" } });
  }
}

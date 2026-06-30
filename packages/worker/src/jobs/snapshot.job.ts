import { PrismaClient } from "@prisma/client";
import type { ContainerRuntime } from "../runtime/types";

const db = new PrismaClient();

export async function handleSnapshotJob(runtime: ContainerRuntime, serverId: string, snapshotId: string) {
  const snapshot = await db.snapshot.findUnique({ where: { id: snapshotId } });
  if (!snapshot) { console.error(`[snapshot] Snapshot ${snapshotId} not found`); return; }

  const server = await db.serverInstance.findUnique({
    where: { id: serverId },
    include: { node: true },
  });

  if (!server || !server.dockerContainerId) {
    console.error(`[snapshot] Server ${serverId} not found or no container`);
    await db.serverInstance.update({
      where: { id: serverId },
      data: { lockedBy: null, lockedAt: null },
    });
    return;
  }

  try {
    const imageId = await runtime.createSnapshot(
      server.node.dockerEndpoint,
      server.dockerContainerId,
      `snap-${snapshotId.slice(0, 12)}`
    );

    console.log(`[snapshot] Created snapshot ${snapshotId}, image: ${imageId}`);

    await db.serverInstance.update({
      where: { id: serverId },
      data: { lockedBy: null, lockedAt: null },
    });
  } catch (error) {
    console.error(`[snapshot] Failed:`, error);
    await db.serverInstance.update({
      where: { id: serverId },
      data: { lockedBy: null, lockedAt: null },
    });
  }
}

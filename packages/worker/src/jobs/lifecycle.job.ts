import { PrismaClient } from "@prisma/client";
import type { ContainerRuntime } from "../runtime/types";

const db = new PrismaClient();

export async function handleStartJob(runtime: ContainerRuntime, serverId: string) {
  const server = await db.serverInstance.findUnique({
    where: { id: serverId },
    include: { node: true },
  });

  if (!server || !server.dockerContainerId) {
    console.error(`[start] Server ${serverId} not found or has no container`);
    return;
  }

  try {
    await runtime.startServer(server.node.dockerEndpoint, server.dockerContainerId);
    await db.serverInstance.update({
      where: { id: serverId },
      data: { status: "ACTIVE", lockedBy: null, lockedAt: null },
    });
    console.log(`[start] Server ${serverId} started`);
  } catch (error) {
    console.error(`[start] Failed to start server ${serverId}:`, error);
    await db.serverInstance.update({
      where: { id: serverId },
      data: { status: "ERROR", lockedBy: null, lockedAt: null },
    });
  }
}

export async function handleStopJob(runtime: ContainerRuntime, serverId: string) {
  const server = await db.serverInstance.findUnique({
    where: { id: serverId },
    include: { node: true },
  });

  if (!server || !server.dockerContainerId) {
    console.error(`[stop] Server ${serverId} not found or has no container`);
    return;
  }

  try {
    await runtime.stopServer(server.node.dockerEndpoint, server.dockerContainerId, true);
    await db.serverInstance.update({
      where: { id: serverId },
      data: { status: "STOPPED", lockedBy: null, lockedAt: null },
    });
    console.log(`[stop] Server ${serverId} stopped`);
  } catch (error) {
    console.error(`[stop] Graceful stop failed for ${serverId}, trying force:`, error);
    try {
      await runtime.stopServer(server.node.dockerEndpoint, server.dockerContainerId, false);
      await db.serverInstance.update({
        where: { id: serverId },
        data: { status: "STOPPED", lockedBy: null, lockedAt: null },
      });
    } catch (forceError) {
      console.error(`[stop] Force stop also failed for ${serverId}:`, forceError);
      await db.serverInstance.update({
        where: { id: serverId },
        data: { status: "ERROR", lockedBy: null, lockedAt: null },
      });
    }
  }
}

export async function handleRestartJob(runtime: ContainerRuntime, serverId: string) {
  const server = await db.serverInstance.findUnique({
    where: { id: serverId },
    include: { node: true },
  });

  if (!server || !server.dockerContainerId) {
    console.error(`[restart] Server ${serverId} not found or has no container`);
    return;
  }

  try {
    await runtime.restartServer(server.node.dockerEndpoint, server.dockerContainerId);
    await db.serverInstance.update({
      where: { id: serverId },
      data: { status: "ACTIVE", lockedBy: null, lockedAt: null },
    });
    console.log(`[restart] Server ${serverId} restarted`);
  } catch (error) {
    console.error(`[restart] Failed to restart server ${serverId}:`, error);
    await db.serverInstance.update({
      where: { id: serverId },
      data: { status: "ERROR", lockedBy: null, lockedAt: null },
    });
  }
}

export async function handleDeleteJob(runtime: ContainerRuntime, serverId: string) {
  const server = await db.serverInstance.findUnique({
    where: { id: serverId },
    include: { node: true },
  });

  if (!server) {
    console.error(`[delete] Server ${serverId} not found`);
    return;
  }

  try {
    if (server.dockerContainerId) {
      await runtime.deleteServer(server.node.dockerEndpoint, server.dockerContainerId);
    }

    await db.$transaction(async (tx) => {
      await tx.ipAddress.updateMany({
        where: { serverId },
        data: { serverId: null, allocatedAt: null },
      });

      await tx.node.update({
        where: { id: server.nodeId },
        data: {
          allocatedVcpu: { decrement: server.vcpu },
          allocatedRamMB: { decrement: server.ramMB },
          allocatedDiskGB: { decrement: server.diskGB },
        },
      });

      await tx.backup.deleteMany({ where: { serverId } });
      await tx.firewallRule.deleteMany({ where: { serverId } });
      await tx.dnsRecord.deleteMany({ where: { serverId } });
      await tx.serverTag.deleteMany({ where: { serverId } });

      await tx.serverInstance.update({
        where: { id: serverId },
        data: {
          deletedAt: new Date(),
          lockedBy: null,
          lockedAt: null,
        },
      });
    });

    console.log(`[delete] Server ${serverId} deleted and resources released`);
  } catch (error) {
    console.error(`[delete] Failed to delete server ${serverId}:`, error);
    await db.serverInstance.update({
      where: { id: serverId },
      data: { status: "ERROR", lockedBy: null, lockedAt: null },
    });
  }
}

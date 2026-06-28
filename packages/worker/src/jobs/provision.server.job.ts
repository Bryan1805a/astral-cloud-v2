import { PrismaClient } from "@prisma/client";
import type { ContainerRuntime } from "../runtime/types";

const db = new PrismaClient();

export async function handleProvisionJob(
  runtime: ContainerRuntime,
  serverId: string
) {
  const server = await db.serverInstance.findUnique({
    where: { id: serverId },
    include: { imageTemplate: true, node: true, snapshot: true },
  });

  if (!server) {
    console.error(`[provision] Server ${serverId} not found`);
    return;
  }

  const node = server.node;
  const image = server.imageTemplate || server.snapshot;
  if (!image) {
    console.error(`[provision] No image or snapshot found for server ${serverId}`);
    await db.serverInstance.update({
      where: { id: serverId },
      data: { status: "ERROR", lockedBy: null, lockedAt: null },
    });
    return;
  }

  try {
    const existing = await runtime.getServerStatus(node.dockerEndpoint, `astral-${serverId.slice(0, 10)}`);
    if (existing.running) {
      console.log(`[provision] Container already exists for ${serverId}, syncing DB`);
      await db.serverInstance.update({
        where: { id: serverId },
        data: {
          status: "ACTIVE",
          lockedBy: null,
          lockedAt: null,
          ipAddress: existing.ipAddress || undefined,
        },
      });
      return;
    }
  } catch {
    // Container not found, proceed with creation
  }

  const imageRef = "dockerImage" in image ? image.dockerImage : "ubuntu:24.04";

  const result = await runtime.createServer(node.dockerEndpoint, {
    serverId,
    userId: server.userId,
    hostname: server.hostname,
    image: imageRef,
    vcpu: server.vcpu,
    ramMB: server.ramMB,
    diskGB: server.diskGB,
    rootPassword: server.rootPassword || undefined,
    sshPublicKey: undefined,
    cloudInitScript: server.cloudInitScript || undefined,
  });

  await db.serverInstance.update({
    where: { id: serverId },
    data: {
      status: "ACTIVE",
      dockerContainerId: result.containerId,
      ipAddress: result.ipAddress,
      lockedBy: null,
      lockedAt: null,
    },
  });

  await db.auditLog.create({
    data: {
      userId: server.userId,
      action: "SERVER_CREATED",
      targetType: "ServerInstance",
      targetId: serverId,
      result: "SUCCESS",
      ipAddress: result.ipAddress,
    },
  });

  console.log(`[provision] Server ${serverId} provisioned: ${result.containerId} @ ${result.ipAddress}`);
}

import { PrismaClient } from "@prisma/client";
import type { ContainerRuntime } from "../runtime/types";
import { dispatchWebhookEvent } from "./webhook.dispatch";

const db = new PrismaClient();

export async function handleBackupJob(
  runtime: ContainerRuntime,
  serverId: string,
  backupId: string
) {
  const backup = await db.backup.findUnique({ where: { id: backupId } });
  if (!backup) {
    console.error(`[backup] Backup ${backupId} not found`);
    return;
  }

  if (backup.status === "AVAILABLE") {
    console.log(`[backup] Backup ${backupId} already available, skipping`);
    return;
  }

  const server = await db.serverInstance.findUnique({
    where: { id: serverId },
    include: { node: true },
  });

  if (!server) {
    console.error(`[backup] Server ${serverId} not found`);
    await db.backup.update({ where: { id: backupId }, data: { status: "FAILED" } });
    await db.serverInstance.update({
      where: { id: serverId },
      data: { lockedBy: null, lockedAt: null },
    });
    return;
  }

  if (!server.dockerContainerId) {
    console.error(`[backup] Server ${serverId} has no container ID`);
    await db.backup.update({ where: { id: backupId }, data: { status: "FAILED" } });
    await db.serverInstance.update({
      where: { id: serverId },
      data: { lockedBy: null, lockedAt: null },
    });
    return;
  }

  const storagePath = `/backups/${serverId}/${backupId}.tar.gz`;

  try {
    await runtime.createBackup(server.node.dockerEndpoint, server.dockerContainerId, storagePath);

    await db.$transaction(async (tx) => {
      await tx.backup.update({
        where: { id: backupId },
        data: {
          status: "AVAILABLE",
          storagePath,
          sizeMB: Math.floor((server.diskGB * 1024) * 0.3),
        },
      });

      await tx.serverInstance.update({
        where: { id: serverId },
        data: { lockedBy: null, lockedAt: null },
      });
    });

    await txNotification(server.userId, server.hostname, server.id, backupId);

    dispatchWebhookEvent(server.userId, "backup.completed", {
      serverId: server.id, hostname: server.hostname, backupId,
    }).catch(() => {});

    console.log(`[backup] Backup ${backupId} created for server ${serverId}`);
  } catch (error) {
    console.error(`[backup] Failed to create backup ${backupId}:`, error);

    dispatchWebhookEvent(server.userId, "backup.failed", {
      serverId: server.id, hostname: server.hostname, backupId,
    }).catch(() => {});

    await db.backup.update({ where: { id: backupId }, data: { status: "FAILED" } });
    await db.serverInstance.update({
      where: { id: serverId },
      data: { lockedBy: null, lockedAt: null },
    });
  }
}

async function txNotification(userId: string, hostname: string, serverId: string, backupId: string) {
  try {
    await db.notification.create({
      data: {
        userId,
        type: "BACKUP_COMPLETED",
        title: "Backup completed",
        body: `Backup of "${hostname}" is complete and available.`,
        link: `/dashboard/servers/${serverId}`,
      },
    });

    await db.auditLog.create({
      data: {
        userId,
        action: "BACKUP_CREATED",
        targetType: "Backup",
        targetId: backupId,
        result: "SUCCESS",
        ipAddress: "0.0.0.0",
      },
    });
  } catch (error) {
    console.error("[backup] Failed to create notification/audit:", error);
  }
}

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess, apiPaginated } from "@/lib/errors";
import { serverQueue, JobType } from "@/lib/queue";
import { createNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { serverId: string } }) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const server = await db.serverInstance.findFirst({
    where: { id: params.serverId, userId: auth.userId, deletedAt: null },
  });
  if (!server) return apiError("NOT_FOUND", "Server not found.");

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
  const skip = (page - 1) * limit;

  const [backups, total] = await Promise.all([
    db.backup.findMany({
      where: { serverId: params.serverId },
      skip, take: limit,
      orderBy: { createdAt: "desc" },
    }),
    db.backup.count({ where: { serverId: params.serverId } }),
  ]);

  const data = backups.map((b) => ({
    id: b.id, label: b.label, type: b.type, status: b.status,
    sizeMB: b.sizeMB, expiresAt: b.expiresAt?.toISOString() || null,
    createdAt: b.createdAt.toISOString(),
  }));

  return apiPaginated(data, { page, limit, total, totalPages: Math.ceil(total / limit) });
}

export async function POST(request: NextRequest, { params }: { params: { serverId: string } }) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const server = await db.serverInstance.findFirst({
    where: { id: params.serverId, userId: auth.userId, deletedAt: null },
  });
  if (!server) return apiError("NOT_FOUND", "Server not found.");

  if (server.status !== "ACTIVE") {
    return apiError("INVALID_STATE", "Server must be ACTIVE to create a backup.");
  }

  if (server.lockedBy) {
    return apiError("INVALID_STATE", `Server is currently ${server.lockedBy.toLowerCase()}.`);
  }

  const existingInProgress = await db.backup.findFirst({
    where: { serverId: server.id, status: "CREATING" },
  });
  if (existingInProgress) {
    return apiError("INVALID_STATE", "A backup is already in progress for this server.");
  }

  const existingBackups = await db.backup.aggregate({
    where: { serverId: server.id, status: "AVAILABLE" },
    _sum: { sizeMB: true },
  });
  const totalBackupMB = existingBackups._sum.sizeMB || 0;
  const maxBackupMB = server.diskGB * 1024 * 2;
  if (totalBackupMB >= maxBackupMB) {
    return apiError("INSUFFICIENT_BALANCE", "Backup storage quota exceeded. Delete older backups to make room.");
  }

  const label = `backup-${new Date().toISOString().slice(0, 10)}`;

  const backup = await db.$transaction(async (tx) => {
    const lockResult = await tx.serverInstance.updateMany({
      where: { id: server.id, lockedBy: null },
      data: { lockedBy: "BACKING_UP", lockedAt: new Date() },
    });
    if (lockResult.count === 0) throw new Error("Server is currently locked.");

    return tx.backup.create({
      data: {
        serverId: server.id,
        label,
        type: "MANUAL",
        sizeMB: 0,
        status: "CREATING",
        storagePath: "",
      },
    });
  }).catch(() => null);

  if (!backup) return apiError("INVALID_STATE", "Server is currently busy with another operation.");

  await serverQueue.add(JobType.BACKUP, {
    type: JobType.BACKUP,
    serverId: server.id,
    backupId: backup.id,
  });

  await db.auditLog.create({
    data: {
      userId: auth.userId, action: "BACKUP_CREATED", targetType: "Backup", targetId: backup.id,
      result: "SUCCESS", ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
    },
  });

  createNotification(auth.userId, "SERVER_CREATED" as never,
    "Backup started",
    `A backup of "${server.hostname}" is being created.`,
    `/dashboard/servers/${server.id}`).catch(() => {});

  return apiSuccess({
    id: backup.id, label: backup.label, type: backup.type,
    status: backup.status, createdAt: backup.createdAt.toISOString(),
  }, 201);
}

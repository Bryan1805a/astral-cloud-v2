import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest, { params }: { params: { serverId: string; backupId: string } }) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const server = await db.serverInstance.findFirst({
    where: { id: params.serverId, userId: auth.userId, deletedAt: null },
  });
  if (!server) return apiError("NOT_FOUND", "Server not found.");

  const backup = await db.backup.findFirst({
    where: { id: params.backupId, serverId: params.serverId },
  });
  if (!backup) return apiError("NOT_FOUND", "Backup not found.");
  if (backup.status === "CREATING") return apiError("INVALID_STATE", "Cannot delete a backup that is in progress.");

  await db.backup.delete({ where: { id: backup.id } });

  await db.auditLog.create({
    data: {
      userId: auth.userId, action: "BACKUP_DELETED", targetType: "Backup", targetId: backup.id,
      result: "SUCCESS", ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
    },
  });

  return apiSuccess({ deleted: true });
}

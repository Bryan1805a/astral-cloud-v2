import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { serverId: string; backupId: string } }) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const server = await db.serverInstance.findFirst({
    where: { id: params.serverId, userId: auth.userId, deletedAt: null },
  });
  if (!server) return apiError("NOT_FOUND", "Server not found.");
  if (server.status !== "STOPPED") return apiError("INVALID_STATE", "Server must be STOPPED to restore a backup.");
  if (server.lockedBy) return apiError("INVALID_STATE", `Server is currently ${server.lockedBy.toLowerCase()}.`);

  const backup = await db.backup.findFirst({
    where: { id: params.backupId, serverId: params.serverId, status: "AVAILABLE" },
  });
  if (!backup) return apiError("NOT_FOUND", "Backup not found or not available.");

  await db.serverInstance.update({
    where: { id: server.id },
    data: { lockedBy: "RESTORING", lockedAt: new Date() },
  });

  return apiSuccess({ message: "Restore initiated. Server will be available with restored data shortly." });
}

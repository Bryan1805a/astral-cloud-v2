import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";
import { attachVolumeSchema } from "@astral/shared";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { volumeId: string } }) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const volume = await db.blockVolume.findFirst({
    where: { id: params.volumeId, userId: auth.userId, deletedAt: null },
  });
  if (!volume) return apiError("NOT_FOUND", "Volume not found.");
  if (volume.status !== "AVAILABLE") return apiError("INVALID_STATE", "Volume must be AVAILABLE to attach.");

  const body = await request.json();
  const parsed = attachVolumeSchema.safeParse(body);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Server ID required.");

  const server = await db.serverInstance.findFirst({
    where: { id: parsed.data.serverId, userId: auth.userId, deletedAt: null },
  });
  if (!server) return apiError("NOT_FOUND", "Server not found.");
  if (server.status !== "ACTIVE" && server.status !== "STOPPED") {
    return apiError("INVALID_STATE", "Server must be ACTIVE or STOPPED.");
  }
  if (server.lockedBy) return apiError("INVALID_STATE", `Server is currently ${server.lockedBy.toLowerCase()}.`);
  if (server.regionId !== volume.regionId) return apiError("VALIDATION_ERROR", "Volume and server must be in the same region.");

  const existingAttachment = await db.blockVolume.findFirst({
    where: { serverId: parsed.data.serverId, id: { not: volume.id }, status: "ATTACHED" },
  });
  if (existingAttachment) return apiError("INVALID_STATE", "Server already has an attached volume.");

  const deviceLetter = "b".charCodeAt(0) + Math.floor(Math.random() * 20);

  await db.blockVolume.update({
    where: { id: volume.id },
    data: {
      serverId: parsed.data.serverId, status: "ATTACHED",
      devicePath: `/dev/sd${String.fromCharCode(deviceLetter)}`,
      attachedAt: new Date(),
    },
  });

  await db.auditLog.create({
    data: {
      userId: auth.userId, action: "SERVER_CREATED" as never, targetType: "BlockVolume", targetId: volume.id,
      result: "SUCCESS", ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
    },
  });

  return apiSuccess({ status: "ATTACHED", serverId: parsed.data.serverId, devicePath: `/dev/sd${String.fromCharCode(deviceLetter)}` });
}

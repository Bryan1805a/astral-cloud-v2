import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";
import { serverQueue, JobType } from "@/lib/queue";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { serverId: string } }) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const server = await db.serverInstance.findFirst({
    where: { id: params.serverId, userId: auth.userId, deletedAt: null },
  });
  if (!server) return apiError("NOT_FOUND", "Server not found.");

  const snapshots = await db.snapshot.findMany({
    where: { sourceServerId: params.serverId },
    orderBy: { createdAt: "desc" },
  });

  return apiSuccess(snapshots.map((s) => ({
    id: s.id, label: s.label, sizeGB: s.sizeGB,
    createdAt: s.createdAt.toISOString(),
  })));
}

export async function POST(request: NextRequest, { params }: { params: { serverId: string } }) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const server = await db.serverInstance.findFirst({
    where: { id: params.serverId, userId: auth.userId, deletedAt: null },
  });
  if (!server) return apiError("NOT_FOUND", "Server not found.");
  if (server.status !== "STOPPED") return apiError("INVALID_STATE", "Server must be STOPPED to create a snapshot.");
  if (server.lockedBy) return apiError("INVALID_STATE", `Server is currently ${server.lockedBy.toLowerCase()}.`);

  const label = `snap-${new Date().toISOString().slice(0, 10)}`;

  const snapshot = await db.$transaction(async (tx) => {
    const lockResult = await tx.serverInstance.updateMany({
      where: { id: server.id, lockedBy: null },
      data: { lockedBy: "BACKING_UP", lockedAt: new Date() },
    });
    if (lockResult.count === 0) throw new Error("locked");

    return tx.snapshot.create({
      data: { userId: auth.userId, sourceServerId: server.id, label, sizeGB: server.diskGB },
    });
  }).catch(() => null);

  if (!snapshot) return apiError("INVALID_STATE", "Server is busy. Try again.");

  await serverQueue.add(JobType.SNAPSHOT, {
    type: JobType.SNAPSHOT,
    serverId: server.id,
    snapshotId: snapshot.id,
  });

  return apiSuccess({
    id: snapshot.id, label: snapshot.label, sizeGB: snapshot.sizeGB,
    createdAt: snapshot.createdAt.toISOString(),
  }, 201);
}

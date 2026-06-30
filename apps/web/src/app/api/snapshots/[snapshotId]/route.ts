import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest, { params }: { params: { snapshotId: string } }) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const snapshot = await db.snapshot.findFirst({
    where: { id: params.snapshotId, userId: auth.userId },
  });
  if (!snapshot) return apiError("NOT_FOUND", "Snapshot not found.");

  const serversUsing = await db.serverInstance.count({
    where: { snapshotId: snapshot.id, deletedAt: null },
  });
  if (serversUsing > 0) return apiError("INVALID_STATE", "Snapshot is in use by a server.");

  await db.snapshot.delete({ where: { id: snapshot.id } });
  return apiSuccess({ deleted: true });
}

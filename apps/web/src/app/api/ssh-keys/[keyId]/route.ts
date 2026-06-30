import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiSuccess, apiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest, { params }: { params: { keyId: string } }) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Authentication required.");

  const key = await db.sSHKey.findFirst({
    where: { id: params.keyId, userId: auth.userId },
  });
  if (!key) return apiError("NOT_FOUND", "SSH key not found.");

  const usageCount = await db.serverInstance.count({
    where: { sshKeyId: key.id, deletedAt: null },
  });
  if (usageCount > 0) {
    return apiError("INVALID_STATE", "This key is in use by a server. Remove it from the server first.");
  }

  await db.sSHKey.delete({ where: { id: key.id } });
  return apiSuccess({ deleted: true });
}

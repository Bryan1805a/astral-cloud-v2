import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, apiSuccess, authenticateRequest } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { keyId: string } }
) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const key = await db.apiKey.findFirst({
    where: { id: params.keyId, userId: auth.userId },
  });

  if (!key) return apiError("NOT_FOUND", "API key not found.");

  await db.apiKey.delete({ where: { id: key.id } });

  await db.auditLog.create({
    data: {
      userId: auth.userId,
      action: "API_KEY_REVOKED",
      targetType: "ApiKey",
      targetId: key.id,
      result: "SUCCESS",
      ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
    },
  });

  return apiSuccess({ message: "API key revoked." });
}

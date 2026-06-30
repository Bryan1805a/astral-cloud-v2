import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest, { params }: { params: { key: string } }) {
  const auth = await authenticateRequest(request);
  if (!auth || auth.role !== "ADMIN") return apiError("FORBIDDEN", "Admin access required.");

  const setting = await db.systemSetting.findUnique({
    where: { key: params.key },
  });
  if (!setting) return apiError("NOT_FOUND", "Setting not found.");
  if (setting.isImmutable) return apiError("FORBIDDEN", "This setting cannot be modified.");

  const body = await request.json();
  const { value } = body;
  if (value === undefined) return apiError("VALIDATION_ERROR", "Value is required.");

  const updated = await db.systemSetting.update({
    where: { key: params.key },
    data: { value: String(value), updatedByUserId: auth.userId },
  });

  return apiSuccess({
    id: updated.id, key: updated.key, value: updated.value, type: updated.type,
    updatedAt: updated.updatedAt.toISOString(),
  });
}

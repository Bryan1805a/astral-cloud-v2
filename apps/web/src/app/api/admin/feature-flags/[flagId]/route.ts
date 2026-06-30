import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";
import { updateFeatureFlagRulesSchema } from "@astral/shared";

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest, { params }: { params: { flagId: string } }) {
  const auth = await authenticateRequest(request);
  if (!auth || auth.role !== "ADMIN") return apiError("FORBIDDEN", "Admin access required.");

  const flag = await db.featureFlag.findUnique({ where: { id: params.flagId } });
  if (!flag) return apiError("NOT_FOUND", "Feature flag not found.");

  const body = await request.json();
  const parsed = updateFeatureFlagRulesSchema.safeParse(body);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Invalid data.");

  const data: Record<string, unknown> = {};
  if (parsed.data.enabled !== undefined) data.enabled = parsed.data.enabled;
  if (parsed.data.rules !== undefined) data.rules = parsed.data.rules;

  const updated = await db.featureFlag.update({ where: { id: flag.id }, data });
  return apiSuccess({ id: updated.id, key: updated.key, enabled: updated.enabled });
}

export async function DELETE(request: NextRequest, { params }: { params: { flagId: string } }) {
  const auth = await authenticateRequest(request);
  if (!auth || auth.role !== "ADMIN") return apiError("FORBIDDEN", "Admin access required.");

  await db.featureFlag.delete({ where: { id: params.flagId } });
  return apiSuccess({ deleted: true });
}

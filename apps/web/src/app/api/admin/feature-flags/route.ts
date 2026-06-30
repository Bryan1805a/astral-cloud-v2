import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";
import { createFeatureFlagSchema } from "@astral/shared";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth || auth.role !== "ADMIN") return apiError("FORBIDDEN", "Admin access required.");

  const flags = await db.featureFlag.findMany({
    orderBy: { key: "asc" },
  });

  return apiSuccess(flags.map((f) => ({
    id: f.id, key: f.key, description: f.description,
    enabled: f.enabled, rules: f.rules,
    updatedAt: f.updatedAt.toISOString(),
  })));
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth || auth.role !== "ADMIN") return apiError("FORBIDDEN", "Admin access required.");

  const body = await request.json();
  const parsed = createFeatureFlagSchema.safeParse(body);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Invalid data.");

  const existing = await db.featureFlag.findUnique({ where: { key: parsed.data.key } });
  if (existing) return apiError("EMAIL_TAKEN", "A flag with this key already exists.", 409);

  const flag = await db.featureFlag.create({
    data: {
      key: parsed.data.key, description: parsed.data.description,
      createdByUserId: auth.userId, enabled: false,
    },
  });

  return apiSuccess({ id: flag.id, key: flag.key, enabled: flag.enabled }, 201);
}

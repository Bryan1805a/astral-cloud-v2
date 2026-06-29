import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";
import { updateRegionSchema } from "@astral/shared";

async function requireAdmin(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth || auth.role !== "ADMIN") return null;
  return auth;
}

export async function PUT(request: NextRequest, { params }: { params: { regionId: string } }) {
  const auth = await requireAdmin(request);
  if (!auth) return apiError("FORBIDDEN", "Admin access required.");

  const body = await request.json();
  const parsed = updateRegionSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid region data.", 400,
      parsed.error.errors.map((e) => ({ field: e.path.join("."), message: e.message })));
  }

  const region = await db.region.update({
    where: { id: params.regionId },
    data: parsed.data,
  });

  return apiSuccess({ id: region.id, name: region.name, slug: region.slug });
}

export async function DELETE(request: NextRequest, { params }: { params: { regionId: string } }) {
  const auth = await requireAdmin(request);
  if (!auth) return apiError("FORBIDDEN", "Admin access required.");

  await db.region.update({
    where: { id: params.regionId },
    data: { isActive: false },
  });

  await db.auditLog.create({
    data: {
      userId: auth.userId,
      action: "REGION_DEACTIVATED",
      targetType: "Region",
      targetId: params.regionId,
      result: "SUCCESS",
      ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
    },
  });

  return apiSuccess({ message: "Region deactivated." });
}

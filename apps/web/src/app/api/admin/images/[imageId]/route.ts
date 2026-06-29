import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";
import { updateImageTemplateSchema } from "@astral/shared";

async function requireAdmin(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth || auth.role !== "ADMIN") return null;
  return auth;
}

export async function PUT(request: NextRequest, { params }: { params: { imageId: string } }) {
  const auth = await requireAdmin(request);
  if (!auth) return apiError("FORBIDDEN", "Admin access required.");

  const body = await request.json();
  const parsed = updateImageTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid image data.", 400,
      parsed.error.errors.map((e) => ({ field: e.path.join("."), message: e.message })));
  }

  const { regionIds, ...data } = parsed.data;

  const image = await db.imageTemplate.update({
    where: { id: params.imageId },
    data,
  });

  if (regionIds) {
    await db.imageRegion.deleteMany({ where: { imageId: image.id } });
    await db.imageRegion.createMany({
      data: regionIds.map((regionId) => ({ imageId: image.id, regionId })),
    });
  }

  await db.auditLog.create({
    data: {
      userId: auth.userId,
      action: "IMAGE_UPDATED",
      targetType: "ImageTemplate",
      targetId: image.id,
      result: "SUCCESS",
      ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
      metadata: JSON.parse(JSON.stringify(data)),
    },
  });

  return apiSuccess({ id: image.id, name: image.name });
}

export async function DELETE(request: NextRequest, { params }: { params: { imageId: string } }) {
  const auth = await requireAdmin(request);
  if (!auth) return apiError("FORBIDDEN", "Admin access required.");

  await db.imageTemplate.update({
    where: { id: params.imageId },
    data: { isActive: false },
  });

  await db.auditLog.create({
    data: {
      userId: auth.userId,
      action: "IMAGE_DEACTIVATED",
      targetType: "ImageTemplate",
      targetId: params.imageId,
      result: "SUCCESS",
      ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
    },
  });

  return apiSuccess({ message: "Image deactivated." });
}

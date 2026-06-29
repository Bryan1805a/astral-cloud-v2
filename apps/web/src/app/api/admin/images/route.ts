import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";
import { createImageTemplateSchema } from "@astral/shared";

export const dynamic = "force-dynamic";

async function requireAdmin(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth || auth.role !== "ADMIN") return null;
  return auth;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth) return apiError("FORBIDDEN", "Admin access required.");

  const images = await db.imageTemplate.findMany({
    orderBy: { createdAt: "desc" },
    include: { imageRegions: { include: { region: { select: { id: true, name: true, slug: true } } } } },
  });

  return apiSuccess(
    images.map((i) => ({
      id: i.id,
      name: i.name,
      slug: i.slug,
      osType: i.osType,
      version: i.version,
      dockerImage: i.dockerImage,
      diskSizeGB: i.diskSizeGB,
      defaultUser: i.defaultUser,
      isActive: i.isActive,
      regions: i.imageRegions.map((ir) => ir.region),
      createdAt: i.createdAt.toISOString(),
    }))
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth) return apiError("FORBIDDEN", "Admin access required.");

  const body = await request.json();
  const parsed = createImageTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid image data.", 400,
      parsed.error.errors.map((e) => ({ field: e.path.join("."), message: e.message })));
  }

  const { regionIds, ...data } = parsed.data;

  const image = await db.imageTemplate.create({ data });

  if (regionIds.length > 0) {
    await db.imageRegion.createMany({
      data: regionIds.map((regionId) => ({ imageId: image.id, regionId })),
    });
  }

  await db.auditLog.create({
    data: {
      userId: auth.userId,
      action: "IMAGE_CREATED",
      targetType: "ImageTemplate",
      targetId: image.id,
      result: "SUCCESS",
      ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
      metadata: JSON.parse(JSON.stringify(data)),
    },
  });

  return apiSuccess({ id: image.id, name: image.name, slug: image.slug }, 201);
}

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";
import { updateTagSchema } from "@astral/shared";

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest, { params }: { params: { tagId: string } }) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const tag = await db.vpsTag.findFirst({
    where: { id: params.tagId, userId: auth.userId },
  });
  if (!tag) return apiError("NOT_FOUND", "Tag not found.");

  const body = await request.json();
  const parsed = updateTagSchema.safeParse(body);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Invalid tag data.");

  if (parsed.data.name) {
    const existing = await db.vpsTag.findFirst({
      where: { userId: auth.userId, name: { equals: parsed.data.name, mode: "insensitive" }, id: { not: tag.id } },
    });
    if (existing) return apiError("EMAIL_TAKEN", "A tag with this name already exists.", 409);
  }

  const updated = await db.vpsTag.update({
    where: { id: tag.id },
    data: { ...parsed.data },
  });

  return apiSuccess({
    id: updated.id, name: updated.name, color: updated.color,
  });
}

export async function DELETE(request: NextRequest, { params }: { params: { tagId: string } }) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const tag = await db.vpsTag.findFirst({
    where: { id: params.tagId, userId: auth.userId },
  });
  if (!tag) return apiError("NOT_FOUND", "Tag not found.");

  await db.serverTag.deleteMany({ where: { tagId: tag.id } });
  await db.vpsTag.delete({ where: { id: tag.id } });

  return apiSuccess({ deleted: true });
}

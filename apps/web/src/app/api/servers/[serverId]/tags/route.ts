import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";
import { setServerTagsSchema } from "@astral/shared";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { serverId: string } }) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const server = await db.serverInstance.findFirst({
    where: { id: params.serverId, userId: auth.userId, deletedAt: null },
  });
  if (!server) return apiError("NOT_FOUND", "Server not found.");

  const serverTags = await db.serverTag.findMany({
    where: { serverId: params.serverId },
    include: { tag: true },
  });

  return apiSuccess(serverTags.map((st) => ({
    id: st.tag.id,
    name: st.tag.name,
    color: st.tag.color,
  })));
}

export async function PUT(request: NextRequest, { params }: { params: { serverId: string } }) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const server = await db.serverInstance.findFirst({
    where: { id: params.serverId, userId: auth.userId, deletedAt: null },
  });
  if (!server) return apiError("NOT_FOUND", "Server not found.");

  const body = await request.json();
  const parsed = setServerTagsSchema.safeParse(body);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Invalid tag IDs.");

  const userTags = await db.vpsTag.findMany({
    where: { userId: auth.userId, id: { in: parsed.data.tagIds } },
  });
  const validIds = userTags.map((t) => t.id);
  const invalidIds = parsed.data.tagIds.filter((id) => !validIds.includes(id));
  if (invalidIds.length > 0) return apiError("VALIDATION_ERROR", "Some tag IDs are invalid.");

  await db.$transaction(async (tx) => {
    await tx.serverTag.deleteMany({ where: { serverId: params.serverId } });
    if (validIds.length > 0) {
      await tx.serverTag.createMany({
        data: validIds.map((tagId) => ({ serverId: params.serverId, tagId })),
      });
    }
  });

  return apiSuccess({ tagIds: validIds });
}

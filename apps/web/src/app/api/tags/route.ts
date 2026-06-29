import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";
import { createTagSchema } from "@astral/shared";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const tags = await db.vpsTag.findMany({
    where: { userId: auth.userId },
    orderBy: { name: "asc" },
    include: { _count: { select: { serverTags: true } } },
  });

  return apiSuccess(tags.map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
    serverCount: t._count.serverTags,
    createdAt: t.createdAt.toISOString(),
  })));
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const body = await request.json();
  const parsed = createTagSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid tag data.", 400,
      parsed.error.errors.map((e) => ({ field: e.path.join("."), message: e.message })));
  }

  const existing = await db.vpsTag.findFirst({
    where: { userId: auth.userId, name: { equals: parsed.data.name, mode: "insensitive" } },
  });
  if (existing) return apiError("EMAIL_TAKEN", "A tag with this name already exists.", 409);

  const tag = await db.vpsTag.create({
    data: {
      userId: auth.userId,
      name: parsed.data.name,
      color: parsed.data.color || null,
    },
  });

  return apiSuccess({
    id: tag.id, name: tag.name, color: tag.color,
    serverCount: 0, createdAt: tag.createdAt.toISOString(),
  }, 201);
}

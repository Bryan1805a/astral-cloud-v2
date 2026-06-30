import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";
import { updateAnnouncementSchema } from "@astral/shared";

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest, { params }: { params: { announcementId: string } }) {
  const auth = await authenticateRequest(request);
  if (!auth || auth.role !== "ADMIN") return apiError("FORBIDDEN", "Admin access required.");

  const announcement = await db.announcement.findUnique({ where: { id: params.announcementId } });
  if (!announcement) return apiError("NOT_FOUND", "Announcement not found.");

  const body = await request.json();
  const parsed = updateAnnouncementSchema.safeParse(body);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Invalid data.");

  const data: Record<string, unknown> = { ...parsed.data };
  delete data.startsAt; delete data.endsAt;
  if (parsed.data.startsAt !== undefined) data.startsAt = parsed.data.startsAt ? new Date(parsed.data.startsAt) : null;
  if (parsed.data.endsAt !== undefined) data.endsAt = parsed.data.endsAt ? new Date(parsed.data.endsAt) : null;

  const updated = await db.announcement.update({ where: { id: announcement.id }, data });
  return apiSuccess({ id: updated.id, title: updated.title, isActive: updated.isActive });
}

export async function DELETE(request: NextRequest, { params }: { params: { announcementId: string } }) {
  const auth = await authenticateRequest(request);
  if (!auth || auth.role !== "ADMIN") return apiError("FORBIDDEN", "Admin access required.");

  await db.announcement.delete({ where: { id: params.announcementId } });
  return apiSuccess({ deleted: true });
}

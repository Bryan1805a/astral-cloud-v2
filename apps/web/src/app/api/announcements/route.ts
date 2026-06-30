import { db } from "@/lib/db";
import { apiSuccess } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET() {
  const now = new Date();

  const announcements = await db.announcement.findMany({
    where: {
      isActive: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  return apiSuccess(announcements.map((a) => ({
    id: a.id, title: a.title, body: a.body, severity: a.severity,
    createdAt: a.createdAt.toISOString(),
  })));
}

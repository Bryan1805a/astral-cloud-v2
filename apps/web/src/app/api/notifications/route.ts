import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get("unread") === "true";

  const where: Record<string, unknown> = { userId: auth.userId };
  if (unreadOnly) where.isRead = false;

  const [notifications, total, unreadCount] = await Promise.all([
    db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.notification.count({ where: { userId: auth.userId } }),
    db.notification.count({ where: { userId: auth.userId, isRead: false } }),
  ]);

  return apiSuccess({
    notifications: notifications.map((n) => ({
      id: n.id, type: n.type, title: n.title, body: n.body, link: n.link,
      isRead: n.isRead, createdAt: n.createdAt.toISOString(),
    })),
    unreadCount,
    total,
  });
}

export async function PUT(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const body = await request.json();
  const { markAllRead } = body;

  if (markAllRead) {
    await db.notification.updateMany({
      where: { userId: auth.userId, isRead: false },
      data: { isRead: true },
    });
    return apiSuccess({ message: "All notifications marked as read." });
  }

  return apiError("VALIDATION_ERROR", "Specify markAllRead=true");
}

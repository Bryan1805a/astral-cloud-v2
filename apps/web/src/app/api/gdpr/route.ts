import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";
import { requestAccountDeletionSchema } from "@astral/shared";
import { createNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const requests = await db.gdprRequest.findMany({
    where: { userId: auth.userId },
    orderBy: { createdAt: "desc" },
  });

  return apiSuccess(requests.map((r) => ({
    id: r.id, type: r.type, status: r.status,
    downloadUrl: r.downloadUrl,
    completedAt: r.completedAt?.toISOString() || null,
    expiresAt: r.expiresAt?.toISOString() || null,
    createdAt: r.createdAt.toISOString(),
  })));
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const body = await request.json();
  const type = body.type as string;

  if (type === "EXPORT") {
    const pending = await db.gdprRequest.findFirst({
      where: { userId: auth.userId, type: "EXPORT", status: { in: ["PENDING", "PROCESSING"] } },
    });
    if (pending) return apiError("INVALID_STATE", "You already have a pending export request.");

    const user = await db.user.findUnique({ where: { id: auth.userId } });
    if (!user) return apiError("NOT_FOUND", "User not found.");

    const userData: Record<string, unknown> = {
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
    };

    const servers = await db.serverInstance.findMany({
      where: { userId: auth.userId, deletedAt: null },
      select: { hostname: true, status: true, ipAddress: true, createdAt: true },
    });
    userData.servers = servers;

    const payments = await db.payment.findMany({ where: { userId: auth.userId } });
    userData.payments = payments.map((p) => ({ amount: p.amount.toString(), type: p.type, status: p.status, createdAt: p.createdAt.toISOString() }));

    const downloadUrl = `data:application/json,${encodeURIComponent(JSON.stringify(userData, null, 2))}`;

    const gdprRequest = await db.gdprRequest.create({
      data: {
        userId: auth.userId, type: "EXPORT", status: "COMPLETED",
        downloadUrl, completedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    createNotification(auth.userId, "GDPR_EXPORT_READY" as never,
      "Data export ready",
      "Your personal data export is ready to download.",
      "/dashboard/gdpr").catch(() => {});

    return apiSuccess({
      id: gdprRequest.id, type: "EXPORT", status: "COMPLETED",
      downloadUrl, createdAt: gdprRequest.createdAt.toISOString(),
    });
  }

  if (type === "DELETE") {
    const parsed = requestAccountDeletionSchema.safeParse(body);
    if (!parsed.success) return apiError("VALIDATION_ERROR", "Username confirmation required.");

    const user = await db.user.findUnique({ where: { id: auth.userId } });
    if (!user || user.username !== parsed.data.confirmUsername) {
      return apiError("VALIDATION_ERROR", "Username does not match.");
    }

    const activeServers = await db.serverInstance.count({
      where: { userId: auth.userId, deletedAt: null, status: { not: "DELETED" } },
    });
    if (activeServers > 0) {
      return apiError("INVALID_STATE", "You must delete all servers before requesting account deletion.");
    }

    await db.gdprRequest.create({
      data: {
        userId: auth.userId, type: "DELETE", status: "PROCESSING",
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    await db.user.update({
      where: { id: auth.userId },
      data: { deletedAt: new Date(), status: "SUSPENDED" },
    });

    return apiSuccess({ type: "DELETE", status: "PROCESSING", message: "Account deletion scheduled. Your data will be removed within 30 days." });
  }

  return apiError("VALIDATION_ERROR", "Invalid request type.");
}

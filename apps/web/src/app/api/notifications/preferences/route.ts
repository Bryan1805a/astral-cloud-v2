import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  let prefs = await db.notificationPreference.findUnique({ where: { userId: auth.userId } });
  if (!prefs) {
    prefs = await db.notificationPreference.create({ data: { userId: auth.userId } });
  }

  return apiSuccess(prefs);
}

export async function PUT(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const body = await request.json();
  const allowed = ["emailServerCreated", "emailServerDeleted", "emailPaymentFailure", "emailTicketUpdates", "emailMarketing", "pushServerCreated", "pushTicketUpdates"] as const;
  const data: Record<string, boolean> = {};
  for (const key of allowed) {
    if (typeof body[key] === "boolean") data[key] = body[key];
  }

  if (Object.keys(data).length === 0) return apiError("VALIDATION_ERROR", "No valid preferences.");

  const prefs = await db.notificationPreference.upsert({
    where: { userId: auth.userId },
    update: data,
    create: { userId: auth.userId, ...data },
  });

  return apiSuccess(prefs);
}

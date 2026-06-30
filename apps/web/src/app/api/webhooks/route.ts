import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";
import { createWebhookSchema } from "@astral/shared";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const endpoints = await db.webhookEndpoint.findMany({
    where: { userId: auth.userId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { deliveries: true } } },
  });

  return apiSuccess(endpoints.map((e) => ({
    id: e.id, url: e.url, events: e.events, isActive: e.isActive,
    deliveryCount: e._count.deliveries,
    lastDeliveryAt: e.lastDeliveryAt?.toISOString() || null,
    createdAt: e.createdAt.toISOString(), updatedAt: e.updatedAt.toISOString(),
  })));
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const count = await db.webhookEndpoint.count({ where: { userId: auth.userId } });
  if (count >= 10) return apiError("SERVER_LIMIT_REACHED", "Maximum 10 webhook endpoints.", 403);

  const body = await request.json();
  const parsed = createWebhookSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid data.", 400,
      parsed.error.errors.map((e) => ({ field: e.path.join("."), message: e.message })));
  }

  const secret = crypto.randomBytes(32).toString("hex");

  const endpoint = await db.webhookEndpoint.create({
    data: {
      userId: auth.userId, url: parsed.data.url, secret,
      events: parsed.data.events as never,
    },
  });

  return apiSuccess({
    id: endpoint.id, url: endpoint.url, secret, events: endpoint.events,
    isActive: endpoint.isActive, createdAt: endpoint.createdAt.toISOString(),
  }, 201);
}

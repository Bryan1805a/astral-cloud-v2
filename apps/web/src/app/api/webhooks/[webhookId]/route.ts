import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";
import { updateWebhookSchema } from "@astral/shared";

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest, { params }: { params: { webhookId: string } }) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const endpoint = await db.webhookEndpoint.findFirst({
    where: { id: params.webhookId, userId: auth.userId },
  });
  if (!endpoint) return apiError("NOT_FOUND", "Webhook not found.");

  const body = await request.json();
  const parsed = updateWebhookSchema.safeParse(body);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Invalid data.");

  const data: Record<string, unknown> = {};
  if (parsed.data.url !== undefined) data.url = parsed.data.url;
  if (parsed.data.events !== undefined) data.events = parsed.data.events;
  if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;

  const updated = await db.webhookEndpoint.update({ where: { id: endpoint.id }, data });
  return apiSuccess({ id: updated.id, url: updated.url, isActive: updated.isActive });
}

export async function DELETE(request: NextRequest, { params }: { params: { webhookId: string } }) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const endpoint = await db.webhookEndpoint.findFirst({
    where: { id: params.webhookId, userId: auth.userId },
  });
  if (!endpoint) return apiError("NOT_FOUND", "Webhook not found.");

  await db.webhookDelivery.deleteMany({ where: { endpointId: endpoint.id } });
  await db.webhookEndpoint.delete({ where: { id: endpoint.id } });
  return apiSuccess({ deleted: true });
}

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiPaginated } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { webhookId: string } }) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const endpoint = await db.webhookEndpoint.findFirst({
    where: { id: params.webhookId, userId: auth.userId },
  });
  if (!endpoint) return apiError("NOT_FOUND", "Webhook not found.");

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
  const skip = (page - 1) * limit;

  const [deliveries, total] = await Promise.all([
    db.webhookDelivery.findMany({
      where: { endpointId: params.webhookId },
      skip, take: limit, orderBy: { createdAt: "desc" },
    }),
    db.webhookDelivery.count({ where: { endpointId: params.webhookId } }),
  ]);

  return apiPaginated(deliveries.map((d) => ({
    id: d.id, event: d.event, status: d.status,
    responseCode: d.responseCode, attemptCount: d.attemptCount,
    payload: d.payload,
    createdAt: d.createdAt.toISOString(),
  })), { page, limit, total, totalPages: Math.ceil(total / limit) });
}

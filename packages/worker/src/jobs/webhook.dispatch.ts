import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const db = new PrismaClient();

export async function dispatchWebhookEvent(userId: string, event: string, payload: Record<string, unknown>) {
  try {
    const endpoints = await db.webhookEndpoint.findMany({
      where: { userId, isActive: true },
    });

    for (const endpoint of endpoints) {
      const events = (endpoint.events as string[]) || [];
      if (!events.includes(event)) continue;

      const body = JSON.stringify({ event, timestamp: new Date().toISOString(), data: payload });
      const signature = crypto
        .createHmac("sha256", endpoint.secret)
        .update(body)
        .digest("hex");

      let status: string = "PENDING";
      let responseCode: number | null = null;

      try {
        const res = await fetch(endpoint.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Astral-Signature": signature,
            "X-Astral-Event": event,
          },
          body,
          signal: AbortSignal.timeout(10000),
        });
        responseCode = res.status;
        status = res.ok ? "DELIVERED" : "FAILED";
      } catch {
        status = "FAILED";
      }

      await db.webhookDelivery.create({
        data: {
          endpointId: endpoint.id,
          event,
          payload: payload as never,
          status: status as never,
          responseCode,
          attemptCount: 1,
          nextRetryAt: status === "FAILED" ? new Date(Date.now() + 5 * 60 * 1000) : null,
        },
      });

      if (status === "DELIVERED") {
        await db.webhookEndpoint.update({
          where: { id: endpoint.id },
          data: { lastDeliveryAt: new Date() },
        });
      }
    }
  } catch (error) {
    console.error("[webhook] Dispatch error:", error);
  }
}

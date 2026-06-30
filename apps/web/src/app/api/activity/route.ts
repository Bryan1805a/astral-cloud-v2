import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";

export const dynamic = "force-dynamic";

const EVENT_LABELS: Record<string, string> = {
  SERVER_CREATED: "created server",
  SERVER_STARTED: "started server",
  SERVER_STOPPED: "stopped server",
  SERVER_RESTARTED: "restarted server",
  SERVER_DELETED: "deleted server",
  TICKET_CREATED: "opened ticket",
  TICKET_UPDATED: "updated ticket",
  TICKET_CLOSED: "closed ticket",
  BACKUP_CREATED: "created backup",
  BACKUP_DELETED: "deleted backup",
  BACKUP_COMPLETED: "completed backup",
  PAYMENT_COMPLETED: "payment received",
  PAYMENT_FAILED: "payment failed",
  USER_CREATED: "account created",
  FIREWALL_RULE_CREATED: "added firewall rule",
  FIREWALL_RULE_DELETED: "removed firewall rule",
  DNS_RECORD_CREATED: "added DNS record",
  DNS_RECORD_DELETED: "removed DNS record",
};

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const events = await db.auditLog.findMany({
    where: { userId: auth.userId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return apiSuccess(events.map((e) => ({
    id: e.id,
    action: e.action,
    label: EVENT_LABELS[e.action] || e.action,
    targetType: e.targetType,
    targetId: e.targetId,
    result: e.result,
    createdAt: e.createdAt.toISOString(),
  })));
}

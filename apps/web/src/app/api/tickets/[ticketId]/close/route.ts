import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { ticketId: string } }) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const ticket = await db.ticket.findFirst({ where: { id: params.ticketId, userId: auth.userId } });
  if (!ticket) return apiError("NOT_FOUND", "Ticket not found.");
  if (ticket.status !== "RESOLVED") return apiError("INVALID_STATE", "Only resolved tickets can be closed.");

  await db.ticket.update({ where: { id: ticket.id }, data: { status: "CLOSED", closedAt: new Date() } });

  await db.auditLog.create({
    data: { userId: auth.userId, action: "TICKET_CLOSED", targetType: "Ticket", targetId: ticket.id,
      result: "SUCCESS", ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1" },
  });

  return apiSuccess({ status: "CLOSED" });
}

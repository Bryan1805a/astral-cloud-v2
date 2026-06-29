import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";
import { addTicketMessageSchema } from "@astral/shared";
import { createNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { ticketId: string } }) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const ticket = await db.ticket.findFirst({ where: { id: params.ticketId, userId: auth.userId } });
  if (!ticket) return apiError("NOT_FOUND", "Ticket not found.");
  if (ticket.status === "CLOSED") return apiError("INVALID_STATE", "Ticket is closed.");

  const body = await request.json();
  const parsed = addTicketMessageSchema.safeParse(body);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Message body required.");

  const message = await db.ticketMessage.create({
    data: { ticketId: ticket.id, userId: auth.userId, body: parsed.data.body },
  });

  const newStatus = ticket.status === "RESOLVED" ? "OPEN" : ticket.status === "WAITING_ON_CUSTOMER" ? "IN_PROGRESS" : undefined;
  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (newStatus) updateData.status = newStatus;
  if (newStatus === "OPEN") updateData.resolvedAt = null;

  await db.ticket.update({ where: { id: ticket.id }, data: updateData as never });

  if (ticket.assignedUserId) {
    createNotification(ticket.assignedUserId, "TICKET_UPDATED" as never,
      "Customer replied",
      `Customer replied to ticket "${ticket.subject}".`,
      `/dashboard/admin/tickets/${ticket.id}`).catch(() => {});
  }

  return apiSuccess({ id: message.id, body: message.body, createdAt: message.createdAt.toISOString() }, 201);
}

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";
import { addTicketMessageSchema } from "@astral/shared";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { ticketId: string } }) {
  const auth = await authenticateRequest(request);
  if (!auth || (auth.role !== "ADMIN" && auth.role !== "STAFF")) return apiError("FORBIDDEN", "Staff access required.");

  const body = await request.json();
  const parsed = addTicketMessageSchema.safeParse(body);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Message body required.");

  const ticket = await db.ticket.findUnique({ where: { id: params.ticketId } });
  if (!ticket) return apiError("NOT_FOUND", "Ticket not found.");
  if (ticket.status === "CLOSED") return apiError("INVALID_STATE", "Ticket is closed.");

  const isInternal = body.isInternal === true;

  const message = await db.ticketMessage.create({
    data: { ticketId: ticket.id, userId: auth.userId, body: parsed.data.body, isInternal },
  });

  const newStatus = isInternal ? undefined : ticket.status === "OPEN" ? "IN_PROGRESS" : undefined;
  if (newStatus) {
    await db.ticket.update({ where: { id: ticket.id }, data: { status: newStatus } });
  }

  return apiSuccess({ id: message.id, body: message.body, isInternal, createdAt: message.createdAt.toISOString() }, 201);
}

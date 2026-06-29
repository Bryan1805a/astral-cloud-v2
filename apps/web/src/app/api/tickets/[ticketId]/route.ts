import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { ticketId: string } }) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const ticket = await db.ticket.findFirst({
    where: { id: params.ticketId, userId: auth.userId },
    include: {
      messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { id: true, username: true, role: true } } } },
      assignee: { select: { id: true, username: true } },
    },
  });

  if (!ticket) return apiError("NOT_FOUND", "Ticket not found.");

  return apiSuccess({
    id: ticket.id, subject: ticket.subject, status: ticket.status, priority: ticket.priority, category: ticket.category,
    assignedTo: ticket.assignee ? { id: ticket.assignee.id, username: ticket.assignee.username } : null,
    messages: ticket.messages.map((m) => ({
      id: m.id, body: m.body, isInternal: m.isInternal,
      author: { id: m.author.id, username: m.author.username, role: m.author.role },
      createdAt: m.createdAt.toISOString(),
    })),
    createdAt: ticket.createdAt.toISOString(), updatedAt: ticket.updatedAt.toISOString(),
  });
}

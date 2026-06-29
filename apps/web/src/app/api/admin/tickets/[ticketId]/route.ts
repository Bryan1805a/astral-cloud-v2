import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";

export const dynamic = "force-dynamic";

async function requireStaff(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth || (auth.role !== "ADMIN" && auth.role !== "STAFF")) return null;
  return auth;
}

export async function GET(request: NextRequest, { params }: { params: { ticketId: string } }) {
  const auth = await requireStaff(request);
  if (!auth) return apiError("FORBIDDEN", "Staff access required.");

  const ticket = await db.ticket.findUnique({
    where: { id: params.ticketId },
    include: {
      customer: { select: { id: true, username: true, email: true } },
      assignee: { select: { id: true, username: true } },
      messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { id: true, username: true, role: true } } } },
    },
  });

  if (!ticket) return apiError("NOT_FOUND", "Ticket not found.");

  return apiSuccess({
    id: ticket.id, subject: ticket.subject, status: ticket.status, priority: ticket.priority, category: ticket.category,
    customer: { id: ticket.customer.id, username: ticket.customer.username, email: ticket.customer.email },
    assignedTo: ticket.assignee ? { id: ticket.assignee.id, username: ticket.assignee.username } : null,
    messages: ticket.messages.map((m) => ({
      id: m.id, body: m.body, isInternal: m.isInternal,
      author: { id: m.author.id, username: m.author.username, role: m.author.role },
      createdAt: m.createdAt.toISOString(),
    })),
    createdAt: ticket.createdAt.toISOString(), updatedAt: ticket.updatedAt.toISOString(),
  });
}

export async function PUT(request: NextRequest, { params }: { params: { ticketId: string } }) {
  const auth = await requireStaff(request);
  if (!auth) return apiError("FORBIDDEN", "Staff access required.");

  const body = await request.json();
  const { status, priority, assignedUserId, category } = body;

  const data: Record<string, unknown> = {};
  if (status) data.status = status;
  if (priority) data.priority = priority;
  if (assignedUserId !== undefined) data.assignedUserId = assignedUserId;
  if (category) data.category = category;

  if (Object.keys(data).length === 0) return apiError("VALIDATION_ERROR", "No fields to update.");

  if (status === "RESOLVED") data.resolvedAt = new Date();

  const ticket = await db.ticket.update({ where: { id: params.ticketId }, data });

  await db.auditLog.create({
    data: { userId: auth.userId, action: "TICKET_UPDATED", targetType: "Ticket", targetId: ticket.id,
      result: "SUCCESS", ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1", metadata: JSON.parse(JSON.stringify(data)) },
  });

  return apiSuccess({ id: ticket.id, status: ticket.status, priority: ticket.priority, assignedUserId: ticket.assignedUserId });
}

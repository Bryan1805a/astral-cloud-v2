import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess, apiPaginated } from "@/lib/errors";
import { createTicketSchema } from "@astral/shared";
import { notifyTicketEvent } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
  const skip = (page - 1) * limit;
  const status = searchParams.get("status");

  const where: Record<string, unknown> = { userId: auth.userId };
  if (status) where.status = status;

  const [tickets, total] = await Promise.all([
    db.ticket.findMany({
      where,
      skip, take: limit,
      orderBy: { updatedAt: "desc" },
      include: { assignee: { select: { username: true } }, _count: { select: { messages: true } } },
    }),
    db.ticket.count({ where }),
  ]);

  const data = tickets.map((t) => ({
    id: t.id, subject: t.subject, status: t.status, priority: t.priority, category: t.category,
    assignedTo: t.assignee?.username || null,
    messageCount: t._count.messages,
    createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString(),
  }));

  return apiPaginated(data, { page, limit, total, totalPages: Math.ceil(total / limit) });
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const body = await request.json();
  const parsed = createTicketSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid ticket data.", 400,
      parsed.error.errors.map((e) => ({ field: e.path.join("."), message: e.message })));
  }

  const ticket = await db.ticket.create({
    data: {
      userId: auth.userId, subject: parsed.data.subject,
      category: parsed.data.category, priority: parsed.data.priority,
      messages: { create: { userId: auth.userId, body: parsed.data.message } },
    },
  });

  await db.auditLog.create({
    data: {
      userId: auth.userId, action: "TICKET_CREATED", targetType: "Ticket", targetId: ticket.id,
      result: "SUCCESS", ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
    },
  });

  notifyTicketEvent(auth.userId, ticket.subject, "created", ticket.id).catch(() => {});

  return apiSuccess({
    id: ticket.id, subject: ticket.subject, status: ticket.status,
    priority: ticket.priority, category: ticket.category, createdAt: ticket.createdAt.toISOString(),
  }, 201);
}

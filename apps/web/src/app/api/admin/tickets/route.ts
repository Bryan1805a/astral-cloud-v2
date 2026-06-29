import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiPaginated } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth || (auth.role !== "ADMIN" && auth.role !== "STAFF")) return apiError("FORBIDDEN", "Staff access required.");

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
  const skip = (page - 1) * limit;
  const status = searchParams.get("status");
  const priority = searchParams.get("priority");
  const category = searchParams.get("category");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (priority) where.priority = priority;
  if (category) where.category = category;

  const [tickets, total] = await Promise.all([
    db.ticket.findMany({
      where, skip, take: limit, orderBy: { updatedAt: "desc" },
      include: {
        customer: { select: { id: true, username: true, email: true } },
        assignee: { select: { id: true, username: true } },
        _count: { select: { messages: true } },
      },
    }),
    db.ticket.count({ where }),
  ]);

  const data = tickets.map((t) => ({
    id: t.id, subject: t.subject, status: t.status, priority: t.priority, category: t.category,
    customer: { id: t.customer.id, username: t.customer.username, email: t.customer.email },
    assignedTo: t.assignee ? { id: t.assignee.id, username: t.assignee.username } : null,
    messageCount: t._count.messages,
    createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString(),
  }));

  return apiPaginated(data, { page, limit, total, totalPages: Math.ceil(total / limit) });
}

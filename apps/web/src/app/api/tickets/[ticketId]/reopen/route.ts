import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { ticketId: string } }) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const ticket = await db.ticket.findFirst({ where: { id: params.ticketId, userId: auth.userId } });
  if (!ticket) return apiError("NOT_FOUND", "Ticket not found.");
  if (ticket.status !== "CLOSED") return apiError("INVALID_STATE", "Only closed tickets can be reopened.");

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  if (ticket.closedAt && ticket.closedAt < sevenDaysAgo) {
    return apiError("INVALID_STATE", "Ticket has been closed for more than 7 days. Please create a new ticket.");
  }

  await db.ticket.update({ where: { id: ticket.id }, data: { status: "OPEN", closedAt: null } });

  return apiSuccess({ status: "OPEN" });
}

import type { TicketStatus, TicketPriority, TicketCategory } from "../constants";

export interface Ticket {
  id: string;
  userId: string;
  assignedUserId: string | null;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  userId: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
}

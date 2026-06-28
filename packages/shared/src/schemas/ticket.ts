import { z } from "zod";
import { TicketCategory, TicketPriority } from "../constants";

export const createTicketSchema = z.object({
  subject: z.string().min(1).max(255),
  category: z.nativeEnum(TicketCategory),
  message: z.string().min(1),
  priority: z.nativeEnum(TicketPriority).optional().default(TicketPriority.NORMAL),
});

export const addTicketMessageSchema = z.object({
  body: z.string().min(1),
});

export const changeTicketStatusSchema = z.object({
  status: z.string().min(1),
  reason: z.string().optional(),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type AddTicketMessageInput = z.infer<typeof addTicketMessageSchema>;

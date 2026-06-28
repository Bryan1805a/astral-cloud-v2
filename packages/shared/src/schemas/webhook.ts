import { z } from "zod";
import { WebhookEvent } from "../constants";

export const createWebhookSchema = z.object({
  url: z.string().url().max(512),
  events: z.array(z.nativeEnum(WebhookEvent)).min(1),
  description: z.string().max(255).optional(),
});

export const updateWebhookSchema = z.object({
  url: z.string().url().max(512).optional(),
  events: z.array(z.nativeEnum(WebhookEvent)).min(1).optional(),
  description: z.string().max(255).optional(),
  isActive: z.boolean().optional(),
});

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;
export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;

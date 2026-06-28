import { z } from "zod";

export const updateNotificationPreferencesSchema = z.object({
  emailServerCreated: z.boolean().optional(),
  emailServerDeleted: z.boolean().optional(),
  emailPaymentFailure: z.boolean().optional(),
  emailTicketUpdates: z.boolean().optional(),
  emailMarketing: z.boolean().optional(),
  pushServerCreated: z.boolean().optional(),
  pushTicketUpdates: z.boolean().optional(),
});

export type UpdateNotificationPreferencesInput = z.infer<typeof updateNotificationPreferencesSchema>;

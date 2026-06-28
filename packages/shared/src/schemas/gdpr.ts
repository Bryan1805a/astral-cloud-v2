import { z } from "zod";

export const requestGdprExportSchema = z.object({});

export const requestAccountDeletionSchema = z.object({
  confirmUsername: z.string().min(1),
});

export type RequestAccountDeletionInput = z.infer<typeof requestAccountDeletionSchema>;

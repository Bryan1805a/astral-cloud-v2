import { z } from "zod";

export const createBackupScheduleSchema = z.object({
  enabled: z.boolean().optional(),
  intervalHours: z.number().int().min(6).optional(),
  retainDaily: z.number().int().min(1).optional(),
  retainWeekly: z.number().int().min(1).optional(),
  retainMonthly: z.number().int().min(1).optional(),
});

export type CreateBackupScheduleInput = z.infer<typeof createBackupScheduleSchema>;

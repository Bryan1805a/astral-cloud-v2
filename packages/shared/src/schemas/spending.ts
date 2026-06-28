import { z } from "zod";

export const configureSpendingCapSchema = z.object({
  cap: z.number().min(0),
});

export type ConfigureSpendingCapInput = z.infer<typeof configureSpendingCapSchema>;

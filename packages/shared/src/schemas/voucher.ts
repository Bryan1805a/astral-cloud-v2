import { z } from "zod";

export const applyVoucherSchema = z.object({
  code: z.string().min(1).max(32),
});

export type ApplyVoucherInput = z.infer<typeof applyVoucherSchema>;

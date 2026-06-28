import { z } from "zod";

export const topUpSchema = z.object({
  amount: z.number().min(1),
  voucherCode: z.string().max(32).optional(),
  paymentMethodId: z.string().optional(),
});

export const savePaymentMethodSchema = z.object({
  paymentMethodId: z.string().min(1),
  setDefault: z.boolean().optional().default(false),
});

export type TopUpInput = z.infer<typeof topUpSchema>;

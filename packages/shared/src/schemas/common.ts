import { z } from "zod";

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const paginatedResponse = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: z.array(dataSchema),
    meta: z.object({
      page: z.number(),
      limit: z.number(),
      total: z.number(),
      totalPages: z.number(),
    }),
  });

export const uuidParam = (name: string) =>
  z.object({ [name]: z.string().uuid() });

export const successResponse = z.object({
  data: z.object({
    message: z.string(),
  }),
});

export const idempotencyKey = z.string().uuid().optional();

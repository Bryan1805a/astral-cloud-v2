import { z } from "zod";

export const createTagSchema = z.object({
  name: z.string().min(1).max(32),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a hex color code").optional(),
});

export const updateTagSchema = z.object({
  name: z.string().min(1).max(32).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
});

export const setServerTagsSchema = z.object({
  tagIds: z.array(z.string().uuid()),
});

export type CreateTagInput = z.infer<typeof createTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
export type SetServerTagsInput = z.infer<typeof setServerTagsSchema>;

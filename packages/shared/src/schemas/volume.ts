import { z } from "zod";

export const createBlockVolumeSchema = z.object({
  name: z.string().min(1).max(64),
  regionId: z.string().uuid(),
  sizeGB: z.number().int().min(1).max(16384),
});

export const attachVolumeSchema = z.object({
  serverId: z.string().uuid(),
});

export const resizeVolumeSchema = z.object({
  sizeGB: z.number().int().min(1).max(16384),
});

export type CreateBlockVolumeInput = z.infer<typeof createBlockVolumeSchema>;
export type AttachVolumeInput = z.infer<typeof attachVolumeSchema>;
export type ResizeVolumeInput = z.infer<typeof resizeVolumeSchema>;

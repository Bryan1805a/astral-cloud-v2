import { z } from "zod";

export const createPrivateNetworkSchema = z.object({
  name: z.string().min(1).max(64),
  regionId: z.string().uuid(),
  cidr: z.string().min(1).max(18),
});

export const attachToPrivateNetworkSchema = z.object({
  serverId: z.string().uuid(),
});

export type CreatePrivateNetworkInput = z.infer<typeof createPrivateNetworkSchema>;
export type AttachToPrivateNetworkInput = z.infer<typeof attachToPrivateNetworkSchema>;

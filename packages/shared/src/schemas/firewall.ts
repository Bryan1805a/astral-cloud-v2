import { z } from "zod";
import { FirewallProtocol, FirewallAction } from "../constants";

export const createFirewallRuleSchema = z.object({
  protocol: z.nativeEnum(FirewallProtocol),
  portRange: z.string().min(1).max(16),
  sourceCidr: z.string().min(1).max(45),
  action: z.nativeEnum(FirewallAction),
  priority: z.number().int(),
  description: z.string().max(128).optional(),
});

export const updateFirewallRuleSchema = z.object({
  protocol: z.nativeEnum(FirewallProtocol).optional(),
  portRange: z.string().min(1).max(16).optional(),
  sourceCidr: z.string().min(1).max(45).optional(),
  action: z.nativeEnum(FirewallAction).optional(),
  priority: z.number().int().optional(),
  description: z.string().max(128).optional(),
});

export type CreateFirewallRuleInput = z.infer<typeof createFirewallRuleSchema>;
export type UpdateFirewallRuleInput = z.infer<typeof updateFirewallRuleSchema>;

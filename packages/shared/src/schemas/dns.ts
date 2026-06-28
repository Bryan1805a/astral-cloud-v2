import { z } from "zod";
import { DnsRecordType } from "../constants";

export const createDnsRecordSchema = z.object({
  type: z.nativeEnum(DnsRecordType),
  name: z.string().min(1).max(255),
  value: z.string().min(1).max(512),
  ttl: z.number().int().min(1).optional().default(3600),
  priority: z.number().int().optional().nullable(),
});

export const updateDnsRecordSchema = z.object({
  type: z.nativeEnum(DnsRecordType).optional(),
  name: z.string().min(1).max(255).optional(),
  value: z.string().min(1).max(512).optional(),
  ttl: z.number().int().min(1).optional(),
  priority: z.number().int().optional().nullable(),
});

export type CreateDnsRecordInput = z.infer<typeof createDnsRecordSchema>;
export type UpdateDnsRecordInput = z.infer<typeof updateDnsRecordSchema>;

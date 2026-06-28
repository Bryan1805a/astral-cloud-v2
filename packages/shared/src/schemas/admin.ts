import { z } from "zod";
import { DiscountType } from "../constants";
import { SystemSettingType, AnnouncementSeverity } from "../constants";

export const createServerPlanSchema = z.object({
  name: z.string().min(1).max(64),
  slug: z.string().min(1).max(32),
  vcpu: z.number().int().min(1),
  ramMB: z.number().int().min(256),
  diskGB: z.number().int().min(5),
  bandwidthMbps: z.number().int().min(10),
  priceMonthly: z.string().min(1),
  priceHourly: z.string().min(1),
  maxServers: z.number().int().min(1).optional().nullable(),
  regionIds: z.array(z.string().uuid()).min(1),
});

export const updateServerPlanSchema = createServerPlanSchema.partial();

export const createImageTemplateSchema = z.object({
  name: z.string().min(1).max(128),
  slug: z.string().min(1).max(64),
  osType: z.literal("LINUX"),
  version: z.string().min(1).max(32),
  dockerImage: z.string().min(1).max(255),
  diskSizeGB: z.number().int().min(1),
  defaultUser: z.string().min(1).max(32),
  regionIds: z.array(z.string().uuid()).min(1),
});

export const updateImageTemplateSchema = createImageTemplateSchema.partial();

export const createNodeSchema = z.object({
  name: z.string().min(1).max(64),
  regionId: z.string().uuid(),
  dockerEndpoint: z.string().min(1).max(255),
  totalVcpu: z.number().int().min(1),
  totalRamMB: z.number().int().min(256),
  totalDiskGB: z.number().int().min(5),
});

export const updateNodeSchema = createNodeSchema.partial();

export const createRegionSchema = z.object({
  name: z.string().min(1).max(64),
  slug: z.string().min(1).max(16),
});

export const updateRegionSchema = createRegionSchema.partial();

export const createVoucherSchema = z.object({
  code: z.string().min(1).max(32),
  description: z.string().min(1).max(255),
  discountType: z.nativeEnum(DiscountType),
  discountValue: z.number().min(1),
  maxUses: z.number().int().min(1).optional().nullable(),
  maxUsesPerUser: z.number().int().min(1).optional().default(1),
  minSpend: z.number().min(0).optional().nullable(),
  validFrom: z.string().datetime().optional().nullable(),
  validUntil: z.string().datetime().optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const updateSystemSettingSchema = z.object({
  value: z.string().min(1),
});

export const createEmailTemplateSchema = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(128),
  subject: z.string().min(1).max(255),
  htmlBody: z.string().min(1),
  textBody: z.string().optional(),
  variables: z.array(z.string()).optional(),
});

export const updateEmailTemplateSchema = createEmailTemplateSchema.partial();

export const createTaxRateSchema = z.object({
  regionId: z.string().uuid(),
  name: z.string().min(1).max(64),
  rate: z.string().min(1),
});

export const updateTaxRateSchema = createTaxRateSchema.partial();

export const createAnnouncementSchema = z.object({
  title: z.string().min(1).max(128),
  body: z.string().min(1),
  severity: z.nativeEnum(AnnouncementSeverity).optional().default(AnnouncementSeverity.INFO),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
});

export const updateAnnouncementSchema = createAnnouncementSchema.partial();

export const createFeatureFlagSchema = z.object({
  key: z.string().min(1).max(64),
  name: z.string().min(1).max(128),
  description: z.string().min(1).max(255),
});

export const updateFeatureFlagRulesSchema = z.object({
  enabled: z.boolean().optional(),
  rules: z.record(z.unknown()).optional(),
});

export type CreateServerPlanInput = z.infer<typeof createServerPlanSchema>;
export type UpdateServerPlanInput = z.infer<typeof updateServerPlanSchema>;
export type CreateImageTemplateInput = z.infer<typeof createImageTemplateSchema>;
export type CreateNodeInput = z.infer<typeof createNodeSchema>;
export type CreateRegionInput = z.infer<typeof createRegionSchema>;
export type CreateVoucherInput = z.infer<typeof createVoucherSchema>;
export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;

import { z } from "zod";
import { BillingModel } from "../constants";

export const customSpecsSchema = z.object({
  vcpu: z.number().int().min(1),
  ramMB: z.number().int().min(256),
  diskGB: z.number().int().min(5),
});

export const createServerSchema = z
  .object({
    hostname: z
      .string()
      .min(1)
      .max(64)
      .regex(
        /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/,
        "Hostname must be lowercase alphanumeric with hyphens"
      ),
    planId: z.string().uuid().nullable(),
    imageId: z.string().uuid().nullable(),
    snapshotId: z.string().uuid().nullable(),
    regionId: z.string().uuid(),
    sshKeyId: z.string().uuid().optional(),
    billingModel: z.nativeEnum(BillingModel),
    customSpecs: customSpecsSchema.optional(),
    voucherCode: z.string().max(32).optional(),
    cloudInitScript: z.string().max(65536).optional(),
  })
  .refine((data) => (data.planId === null) !== (data.customSpecs === undefined), {
    message: "Exactly one of planId or customSpecs must be provided",
  })
  .refine((data) => {
    const hasImage = data.imageId !== null && data.imageId !== undefined;
    const hasSnapshot = data.snapshotId !== null && data.snapshotId !== undefined;
    return hasImage !== hasSnapshot;
  }, {
    message: "Exactly one of imageId or snapshotId must be provided",
  });

export const startServerSchema = z.object({});

export const stopServerSchema = z.object({
  force: z.boolean().optional().default(false),
});

export const restartServerSchema = z.object({});

export const deleteServerSchema = z.object({
  confirmHostname: z.string().min(1).max(64),
});

export type CreateServerInput = z.infer<typeof createServerSchema>;
export type StopServerInput = z.infer<typeof stopServerSchema>;
export type DeleteServerInput = z.infer<typeof deleteServerSchema>;

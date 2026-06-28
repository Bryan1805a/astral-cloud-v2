import { z } from "zod";
import { AbuseReportType } from "../constants";

export const submitAbuseReportSchema = z.object({
  reporterName: z.string().min(1).max(128).optional(),
  reporterEmail: z.string().email().optional(),
  type: z.nativeEnum(AbuseReportType),
  serverIpOrHostname: z.string().min(1).max(128),
  description: z.string().min(1),
  evidence: z.string().optional(),
});

export type SubmitAbuseReportInput = z.infer<typeof submitAbuseReportSchema>;

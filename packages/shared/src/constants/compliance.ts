export const GdprRequestType = {
  EXPORT: "EXPORT",
  DELETE: "DELETE",
} as const;
export type GdprRequestType = (typeof GdprRequestType)[keyof typeof GdprRequestType];

export const GdprRequestStatus = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;
export type GdprRequestStatus = (typeof GdprRequestStatus)[keyof typeof GdprRequestStatus];

export const AbuseReportType = {
  DMCA: "DMCA",
  SPAM: "SPAM",
  MALWARE: "MALWARE",
  CRYPTO_MINING: "CRYPTO_MINING",
  PHISHING: "PHISHING",
  OTHER: "OTHER",
} as const;
export type AbuseReportType = (typeof AbuseReportType)[keyof typeof AbuseReportType];

export const AbuseReportStatus = {
  PENDING_REVIEW: "PENDING_REVIEW",
  INVESTIGATING: "INVESTIGATING",
  VALIDATED: "VALIDATED",
  DISMISSED: "DISMISSED",
  SUSPENDED: "SUSPENDED",
  RESOLVED: "RESOLVED",
} as const;
export type AbuseReportStatus = (typeof AbuseReportStatus)[keyof typeof AbuseReportStatus];

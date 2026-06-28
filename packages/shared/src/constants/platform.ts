export const SystemSettingType = {
  STRING: "STRING",
  NUMBER: "NUMBER",
  BOOLEAN: "BOOLEAN",
  JSON: "JSON",
} as const;
export type SystemSettingType = (typeof SystemSettingType)[keyof typeof SystemSettingType];

export const AnnouncementSeverity = {
  INFO: "INFO",
  WARNING: "WARNING",
  CRITICAL: "CRITICAL",
} as const;
export type AnnouncementSeverity = (typeof AnnouncementSeverity)[keyof typeof AnnouncementSeverity];

export const TermsType = {
  TOS: "TOS",
  PRIVACY_POLICY: "PRIVACY_POLICY",
} as const;
export type TermsType = (typeof TermsType)[keyof typeof TermsType];

export const FeatureFlagType = {
  BOOLEAN: "BOOLEAN",
  MULTIVARIATE: "MULTIVARIATE",
} as const;
export type FeatureFlagType = (typeof FeatureFlagType)[keyof typeof FeatureFlagType];

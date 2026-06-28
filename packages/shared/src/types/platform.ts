import type { SystemSettingType, AnnouncementSeverity, TermsType, FeatureFlagType } from "../constants";

export interface SystemSetting {
  id: string;
  key: string;
  value: string;
  type: SystemSettingType;
  label: string;
  description: string | null;
  isImmutable: boolean;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmailTemplate {
  id: string;
  code: string;
  name: string;
  subject: string;
  htmlBody: string;
  textBody: string | null;
  variables: string[] | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  severity: AnnouncementSeverity;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdByUserId: string;
  createdAt: string;
}

export interface TaxRate {
  id: string;
  regionId: string;
  name: string;
  rate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FeatureFlag {
  id: string;
  key: string;
  description: string;
  enabled: boolean;
  rules: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

import type { GdprRequestType, GdprRequestStatus, AbuseReportType, AbuseReportStatus } from "../constants";

export interface GdprRequest {
  id: string;
  userId: string;
  type: GdprRequestType;
  status: GdprRequestStatus;
  downloadUrl: string | null;
  completedAt: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface TermsAcceptance {
  id: string;
  userId: string;
  termsType: TermsType;
  version: string;
  acceptedAt: string;
}

export interface CookieConsent {
  id: string;
  userId: string | null;
  sessionId: string | null;
  preferences: Record<string, boolean>;
  createdAt: string;
}

export interface AbuseReport {
  id: string;
  reporterUserId: string | null;
  serverId: string | null;
  type: AbuseReportType;
  description: string;
  evidence: string | null;
  status: AbuseReportStatus;
  resolution: string | null;
  reviewedByUserId: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

import type { TermsType } from "../constants";

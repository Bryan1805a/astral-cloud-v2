import type { UserRole, UserStatus, BillingModel } from "../constants";

export interface BillingAddress {
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postal: string;
  country: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  balance: string;
  referralCode: string;
  taxExempt: boolean;
  billingAddress: BillingAddress | null;
  spendingCap: string | null;
  failedLoginAttempts: number;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface TwoFactorAuth {
  id: string;
  userId: string;
  secret: string;
  enabled: boolean;
  backupCodes: string[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  userId: string;
  refreshTokenHash: string;
  userAgent: string | null;
  ipAddress: string;
  expiresAt: string;
  createdAt: string;
}

export interface ApiKey {
  id: string;
  userId: string;
  label: string;
  keyPrefix: string;
  keyHash: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface SSHKey {
  id: string;
  userId: string;
  label: string;
  publicKey: string;
  createdAt: string;
}

export interface NotificationPreference {
  id: string;
  userId: string;
  emailServerCreated: boolean;
  emailServerDeleted: boolean;
  emailPaymentFailure: boolean;
  emailTicketUpdates: boolean;
  emailMarketing: boolean;
  pushServerCreated: boolean;
  pushTicketUpdates: boolean;
}

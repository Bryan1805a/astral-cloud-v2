export const ReferralStatus = {
  PENDING: "PENDING",
  CREDITED: "CREDITED",
  PAID_OUT: "PAID_OUT",
} as const;
export type ReferralStatus = (typeof ReferralStatus)[keyof typeof ReferralStatus];

export const ReferralPayoutStatus = {
  PENDING: "PENDING",
  COMPLETED: "COMPLETED",
  FAILED: "FAILED",
} as const;
export type ReferralPayoutStatus = (typeof ReferralPayoutStatus)[keyof typeof ReferralPayoutStatus];

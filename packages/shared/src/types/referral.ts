import type { ReferralStatus, ReferralPayoutStatus } from "../constants";

export interface Referral {
  id: string;
  referrerId: string;
  refereeId: string;
  refereeIpAddress: string;
  status: ReferralStatus;
  referrerCredit: string;
  refereeCredit: string;
  createdAt: string;
}

export interface ReferralPayout {
  id: string;
  userId: string;
  amount: string;
  paymentId: string | null;
  status: ReferralPayoutStatus;
  createdAt: string;
}

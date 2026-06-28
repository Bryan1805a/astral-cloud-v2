import type { PaymentStatus, PaymentType, InvoiceStatus, DiscountType } from "../constants";

export interface Payment {
  id: string;
  userId: string;
  stripePaymentId: string;
  amount: string;
  currency: string;
  status: PaymentStatus;
  type: PaymentType;
  voucherId: string | null;
  createdAt: string;
}

export interface PaymentMethod {
  id: string;
  userId: string;
  stripePaymentMethodId: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
  createdAt: string;
}

export interface Invoice {
  id: string;
  userId: string;
  invoiceNumber: string;
  paymentId: string;
  subtotal: string;
  taxAmount: string;
  discountAmount: string;
  total: string;
  currency: string;
  status: InvoiceStatus;
  pdfUrl: string | null;
  createdAt: string;
}

export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: string;
  total: string;
}

export interface Voucher {
  id: string;
  code: string;
  description: string;
  discountType: DiscountType;
  discountValue: string;
  maxUses: number | null;
  currentUses: number;
  maxUsesPerUser: number;
  minSpend: string | null;
  validFrom: string | null;
  validUntil: string | null;
  isActive: boolean;
  createdByUserId: string;
  createdAt: string;
}

export interface VoucherUsage {
  id: string;
  voucherId: string;
  userId: string;
  paymentId: string | null;
  discountAmount: string;
  createdAt: string;
}

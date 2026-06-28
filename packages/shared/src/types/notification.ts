import type { NotificationType, WebhookEvent, WebhookDeliveryStatus } from "../constants";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface WebhookEndpoint {
  id: string;
  userId: string;
  url: string;
  secret: string;
  events: WebhookEvent[];
  isActive: boolean;
  lastDeliveryAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDelivery {
  id: string;
  endpointId: string;
  event: string;
  payload: Record<string, unknown>;
  status: WebhookDeliveryStatus;
  responseCode: number | null;
  attemptCount: number;
  nextRetryAt: string | null;
  createdAt: string;
}

export interface BandwidthUsage {
  id: string;
  serverId: string;
  date: string;
  bytesIn: number;
  bytesOut: number;
}

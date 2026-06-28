export const NotificationType = {
  SERVER_CREATED: "SERVER_CREATED",
  SERVER_DELETED: "SERVER_DELETED",
  SERVER_STARTED: "SERVER_STARTED",
  SERVER_STOPPED: "SERVER_STOPPED",
  PAYMENT_SUCCEEDED: "PAYMENT_SUCCEEDED",
  PAYMENT_FAILED: "PAYMENT_FAILED",
  TICKET_UPDATED: "TICKET_UPDATED",
  TICKET_CREATED: "TICKET_CREATED",
  BACKUP_COMPLETED: "BACKUP_COMPLETED",
  BACKUP_FAILED: "BACKUP_FAILED",
  BALANCE_LOW: "BALANCE_LOW",
  GRACE_PERIOD_WARNING: "GRACE_PERIOD_WARNING",
  SERVER_SUSPENDED: "SERVER_SUSPENDED",
  BANDWIDTH_WARNING: "BANDWIDTH_WARNING",
  BANDWIDTH_EXCEEDED: "BANDWIDTH_EXCEEDED",
  REFERRAL_CREDITED: "REFERRAL_CREDITED",
  ANNOUNCEMENT: "ANNOUNCEMENT",
  GDPR_EXPORT_READY: "GDPR_EXPORT_READY",
  ACCOUNT_DELETED: "ACCOUNT_DELETED",
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export const WebhookEvent = {
  SERVER_CREATED: "server.created",
  SERVER_STARTED: "server.started",
  SERVER_STOPPED: "server.stopped",
  SERVER_DELETED: "server.deleted",
  BACKUP_COMPLETED: "backup.completed",
  BACKUP_FAILED: "backup.failed",
  PAYMENT_SUCCEEDED: "payment.succeeded",
  PAYMENT_FAILED: "payment.failed",
} as const;
export type WebhookEvent = (typeof WebhookEvent)[keyof typeof WebhookEvent];

export const WebhookDeliveryStatus = {
  PENDING: "PENDING",
  DELIVERED: "DELIVERED",
  FAILED: "FAILED",
} as const;
export type WebhookDeliveryStatus = (typeof WebhookDeliveryStatus)[keyof typeof WebhookDeliveryStatus];

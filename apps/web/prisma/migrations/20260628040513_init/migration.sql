-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'STAFF', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'LOCKED', 'PENDING_VERIFICATION', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ServerStatus" AS ENUM ('CREATING', 'ACTIVE', 'STOPPING', 'STOPPED', 'RESTARTING', 'DELETING', 'DELETED', 'ERROR');

-- CreateEnum
CREATE TYPE "LockedBy" AS ENUM ('CREATING', 'STOPPING', 'RESTARTING', 'DELETING', 'BACKING_UP', 'RESTORING');

-- CreateEnum
CREATE TYPE "BillingModel" AS ENUM ('MONTHLY', 'HOURLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "OsType" AS ENUM ('LINUX');

-- CreateEnum
CREATE TYPE "NodeStatus" AS ENUM ('ONLINE', 'OFFLINE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "IpType" AS ENUM ('IPv4', 'IPv6');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('TOP_UP', 'CHARGE', 'REFUND');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('PAID', 'VOID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TicketCategory" AS ENUM ('GENERAL', 'BILLING', 'TECHNICAL', 'ABUSE');

-- CreateEnum
CREATE TYPE "FirewallProtocol" AS ENUM ('TCP', 'UDP', 'ICMP', 'ALL');

-- CreateEnum
CREATE TYPE "FirewallAction" AS ENUM ('ALLOW', 'DENY');

-- CreateEnum
CREATE TYPE "DnsRecordType" AS ENUM ('A', 'AAAA', 'CNAME', 'MX', 'TXT', 'PTR');

-- CreateEnum
CREATE TYPE "BackupType" AS ENUM ('MANUAL', 'AUTOMATED');

-- CreateEnum
CREATE TYPE "BackupStatus" AS ENUM ('CREATING', 'AVAILABLE', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "BlogPostStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SERVER_CREATED', 'SERVER_DELETED', 'SERVER_STARTED', 'SERVER_STOPPED', 'PAYMENT_SUCCEEDED', 'PAYMENT_FAILED', 'TICKET_UPDATED', 'TICKET_CREATED', 'BACKUP_COMPLETED', 'BACKUP_FAILED', 'BALANCE_LOW', 'GRACE_PERIOD_WARNING', 'SERVER_SUSPENDED', 'BANDWIDTH_WARNING', 'BANDWIDTH_EXCEEDED', 'REFERRAL_CREDITED', 'ANNOUNCEMENT', 'GDPR_EXPORT_READY', 'ACCOUNT_DELETED');

-- CreateEnum
CREATE TYPE "BlockVolumeStatus" AS ENUM ('CREATING', 'AVAILABLE', 'ATTACHED', 'DETACHING', 'DELETING', 'ERROR');

-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'CREDITED', 'PAID_OUT');

-- CreateEnum
CREATE TYPE "ReferralPayoutStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('SERVER_CREATED', 'SERVER_STARTED', 'SERVER_STOPPED', 'SERVER_RESTARTED', 'SERVER_DELETED', 'USER_CREATED', 'USER_UPDATED', 'USER_DELETED', 'USER_LOGIN', 'USER_LOGOUT', 'PASSWORD_CHANGED', 'TWO_FACTOR_ENABLED', 'TWO_FACTOR_DISABLED', 'API_KEY_CREATED', 'API_KEY_REVOKED', 'PLAN_CREATED', 'PLAN_UPDATED', 'PLAN_DEACTIVATED', 'IMAGE_CREATED', 'IMAGE_UPDATED', 'IMAGE_DEACTIVATED', 'NODE_CREATED', 'NODE_UPDATED', 'NODE_DELETED', 'REGION_CREATED', 'REGION_UPDATED', 'REGION_DEACTIVATED', 'PAYMENT_CREATED', 'PAYMENT_COMPLETED', 'PAYMENT_FAILED', 'BALANCE_DEDUCTED', 'TICKET_CREATED', 'TICKET_UPDATED', 'TICKET_CLOSED', 'BACKUP_CREATED', 'BACKUP_DELETED', 'BACKUP_RESTORED', 'FIREWALL_RULE_CREATED', 'FIREWALL_RULE_UPDATED', 'FIREWALL_RULE_DELETED', 'DNS_RECORD_CREATED', 'DNS_RECORD_UPDATED', 'DNS_RECORD_DELETED', 'VOUCHER_CREATED', 'VOUCHER_DEACTIVATED', 'VOUCHER_APPLIED', 'BLOG_POST_CREATED', 'BLOG_POST_UPDATED', 'BLOG_POST_PUBLISHED', 'BLOG_POST_DELETED', 'SETTING_UPDATED', 'TAX_RATE_CREATED', 'TAX_RATE_UPDATED', 'GDPR_EXPORT_REQUESTED', 'GDPR_EXPORT_COMPLETED', 'GDPR_DELETION_REQUESTED', 'GDPR_DELETION_COMPLETED', 'IMPERSONATION_START', 'IMPERSONATION_END', 'FEATURE_FLAG_CREATED', 'FEATURE_FLAG_UPDATED', 'VOLUME_CREATED', 'VOLUME_ATTACHED', 'VOLUME_DETACHED', 'VOLUME_RESIZED', 'VOLUME_DELETED', 'FLOATING_IP_ALLOCATED', 'FLOATING_IP_ASSIGNED', 'FLOATING_IP_RELEASED', 'PRIVATE_NETWORK_CREATED', 'PRIVATE_NETWORK_DELETED', 'ABUSE_REPORT_SUBMITTED', 'ABUSE_REPORT_RESOLVED', 'REFERRAL_CREDITED', 'TERMS_ACCEPTED', 'ANNOUNCEMENT_CREATED', 'ANNOUNCEMENT_DELETED', 'WEBHOOK_CREATED', 'WEBHOOK_DELETED', 'CLOUD_INIT_EXECUTED', 'LOCK_STALE');

-- CreateEnum
CREATE TYPE "AuditResult" AS ENUM ('SUCCESS', 'FAILURE');

-- CreateEnum
CREATE TYPE "SystemSettingType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'JSON');

-- CreateEnum
CREATE TYPE "AnnouncementSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "TermsType" AS ENUM ('TOS', 'PRIVACY_POLICY');

-- CreateEnum
CREATE TYPE "GdprRequestType" AS ENUM ('EXPORT', 'DELETE');

-- CreateEnum
CREATE TYPE "GdprRequestStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AbuseReportType" AS ENUM ('DMCA', 'SPAM', 'MALWARE', 'CRYPTO_MINING', 'PHISHING', 'OTHER');

-- CreateEnum
CREATE TYPE "AbuseReportStatus" AS ENUM ('PENDING_REVIEW', 'INVESTIGATING', 'VALIDATED', 'DISMISSED', 'SUSPENDED', 'RESOLVED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "referralCode" TEXT NOT NULL,
    "taxExempt" BOOLEAN NOT NULL DEFAULT false,
    "billingAddress" JSONB,
    "spendingCap" DECIMAL(10,2),
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "emailVerifiedAt" TIMESTAMP(3),
    "termsAcceptedVersion" TEXT,
    "maxServers" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TwoFactorAuth" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "backupCodes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TwoFactorAuth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "userAgent" VARCHAR(512),
    "ipAddress" VARCHAR(45) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" VARCHAR(64) NOT NULL,
    "keyPrefix" VARCHAR(8) NOT NULL,
    "keyHash" VARCHAR(128) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SSHKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" VARCHAR(64) NOT NULL,
    "publicKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SSHKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServerPlan" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "slug" VARCHAR(32) NOT NULL,
    "vcpu" INTEGER NOT NULL,
    "ramMB" INTEGER NOT NULL,
    "diskGB" INTEGER NOT NULL,
    "bandwidthMbps" INTEGER NOT NULL,
    "priceMonthly" DECIMAL(10,2) NOT NULL,
    "priceHourly" DECIMAL(10,2) NOT NULL,
    "maxServers" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServerPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageTemplate" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "osType" "OsType" NOT NULL,
    "version" VARCHAR(32) NOT NULL,
    "dockerImage" VARCHAR(255) NOT NULL,
    "diskSizeGB" INTEGER NOT NULL,
    "defaultUser" VARCHAR(32) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImageTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Region" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "slug" VARCHAR(16) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Node" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "regionId" TEXT NOT NULL,
    "status" "NodeStatus" NOT NULL DEFAULT 'ONLINE',
    "dockerEndpoint" VARCHAR(255) NOT NULL,
    "totalVcpu" INTEGER NOT NULL,
    "totalRamMB" INTEGER NOT NULL,
    "totalDiskGB" INTEGER NOT NULL,
    "allocatedVcpu" INTEGER NOT NULL DEFAULT 0,
    "allocatedRamMB" INTEGER NOT NULL DEFAULT 0,
    "allocatedDiskGB" INTEGER NOT NULL DEFAULT 0,
    "lastHeartbeatAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Node_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IpAddress" (
    "id" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "address" VARCHAR(45) NOT NULL,
    "type" "IpType" NOT NULL,
    "serverId" TEXT,
    "allocatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IpAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServerInstance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serverPlanId" TEXT,
    "imageTemplateId" TEXT,
    "snapshotId" TEXT,
    "nodeId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "sshKeyId" TEXT,
    "hostname" VARCHAR(64) NOT NULL,
    "status" "ServerStatus" NOT NULL DEFAULT 'CREATING',
    "lockedBy" "LockedBy",
    "lockedAt" TIMESTAMP(3),
    "ipAddress" VARCHAR(45),
    "dockerContainerId" VARCHAR(64),
    "vcpu" INTEGER NOT NULL,
    "ramMB" INTEGER NOT NULL,
    "diskGB" INTEGER NOT NULL DEFAULT 5,
    "billingModel" "BillingModel" NOT NULL DEFAULT 'MONTHLY',
    "rootPassword" VARCHAR(255),
    "cloudInitScript" TEXT,
    "nextBillingAt" TIMESTAMP(3),
    "gracePeriodEndsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ServerInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanRegion" (
    "planId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,

    CONSTRAINT "PlanRegion_pkey" PRIMARY KEY ("planId","regionId")
);

-- CreateTable
CREATE TABLE "ImageRegion" (
    "imageId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,

    CONSTRAINT "ImageRegion_pkey" PRIMARY KEY ("imageId","regionId")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripePaymentId" VARCHAR(64) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "status" "PaymentStatus" NOT NULL,
    "type" "PaymentType" NOT NULL,
    "voucherId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripePaymentMethodId" VARCHAR(64) NOT NULL,
    "brand" VARCHAR(32) NOT NULL,
    "last4" VARCHAR(4) NOT NULL,
    "expMonth" INTEGER NOT NULL,
    "expYear" INTEGER NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "invoiceNumber" VARCHAR(32) NOT NULL,
    "paymentId" TEXT NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "taxAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "status" "InvoiceStatus" NOT NULL,
    "pdfUrl" VARCHAR(512),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLineItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "InvoiceLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Voucher" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "discountType" "DiscountType" NOT NULL,
    "discountValue" DECIMAL(10,2) NOT NULL,
    "maxUses" INTEGER,
    "currentUses" INTEGER NOT NULL DEFAULT 0,
    "maxUsesPerUser" INTEGER NOT NULL DEFAULT 1,
    "minSpend" DECIMAL(10,2),
    "validFrom" TIMESTAMP(3),
    "validUntil" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Voucher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoucherUsage" (
    "id" TEXT NOT NULL,
    "voucherId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paymentId" TEXT,
    "discountAmount" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoucherUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedUserId" TEXT,
    "subject" VARCHAR(255) NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "TicketPriority" NOT NULL DEFAULT 'NORMAL',
    "category" "TicketCategory" NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketMessage" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FirewallRule" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "protocol" "FirewallProtocol" NOT NULL,
    "portRange" VARCHAR(16) NOT NULL,
    "sourceCidr" VARCHAR(45) NOT NULL,
    "action" "FirewallAction" NOT NULL,
    "priority" INTEGER NOT NULL,
    "description" VARCHAR(128),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FirewallRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DnsRecord" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "type" "DnsRecordType" NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "value" VARCHAR(512) NOT NULL,
    "ttl" INTEGER NOT NULL DEFAULT 3600,
    "priority" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DnsRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Backup" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "label" VARCHAR(64) NOT NULL,
    "type" "BackupType" NOT NULL,
    "sizeMB" INTEGER NOT NULL,
    "status" "BackupStatus" NOT NULL,
    "storagePath" VARCHAR(512) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Backup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackupSchedule" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "intervalHours" INTEGER NOT NULL DEFAULT 24,
    "retainDaily" INTEGER NOT NULL DEFAULT 7,
    "retainWeekly" INTEGER NOT NULL DEFAULT 4,
    "retainMonthly" INTEGER NOT NULL DEFAULT 3,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackupSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogCategory" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "description" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlogCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlogPost" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "excerpt" VARCHAR(500),
    "body" TEXT NOT NULL,
    "coverImageUrl" VARCHAR(512),
    "status" "BlogPostStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "tags" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BlogPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" VARCHAR(128) NOT NULL,
    "body" VARCHAR(512) NOT NULL,
    "link" VARCHAR(512),
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailServerCreated" BOOLEAN NOT NULL DEFAULT true,
    "emailServerDeleted" BOOLEAN NOT NULL DEFAULT true,
    "emailPaymentFailure" BOOLEAN NOT NULL DEFAULT true,
    "emailTicketUpdates" BOOLEAN NOT NULL DEFAULT true,
    "emailMarketing" BOOLEAN NOT NULL DEFAULT false,
    "pushServerCreated" BOOLEAN NOT NULL DEFAULT true,
    "pushTicketUpdates" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrivateNetwork" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "cidr" VARCHAR(18) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrivateNetwork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServerPrivateNetwork" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "networkId" TEXT NOT NULL,
    "privateIp" VARCHAR(45) NOT NULL,
    "attachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServerPrivateNetwork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FloatingIp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "ipAddress" VARCHAR(45) NOT NULL,
    "serverId" TEXT,
    "assignedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FloatingIp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlockVolume" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "nodeId" TEXT,
    "name" VARCHAR(64) NOT NULL,
    "sizeGB" INTEGER NOT NULL,
    "status" "BlockVolumeStatus" NOT NULL DEFAULT 'CREATING',
    "serverId" TEXT,
    "devicePath" VARCHAR(16),
    "attachedAt" TIMESTAMP(3),
    "dockerVolumeId" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "BlockVolume_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEndpoint" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "url" VARCHAR(512) NOT NULL,
    "secret" VARCHAR(64) NOT NULL,
    "events" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastDeliveryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookDelivery" (
    "id" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "event" VARCHAR(64) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WebhookDeliveryStatus" NOT NULL,
    "responseCode" INTEGER,
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "nextRetryAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BandwidthUsage" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "bytesIn" BIGINT NOT NULL DEFAULT 0,
    "bytesOut" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "BandwidthUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "refereeId" TEXT NOT NULL,
    "refereeIpAddress" VARCHAR(45) NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "referrerCredit" DECIMAL(10,2) NOT NULL,
    "refereeCredit" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralPayout" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "paymentId" TEXT,
    "status" "ReferralPayoutStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReferralPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" "AuditAction" NOT NULL,
    "targetType" VARCHAR(32) NOT NULL,
    "targetId" TEXT NOT NULL,
    "result" "AuditResult" NOT NULL,
    "metadata" JSONB,
    "ipAddress" VARCHAR(45) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VpsTag" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(32) NOT NULL,
    "color" VARCHAR(7),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VpsTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServerTag" (
    "serverId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "ServerTag_pkey" PRIMARY KEY ("serverId","tagId")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(64) NOT NULL,
    "value" TEXT NOT NULL,
    "type" "SystemSettingType" NOT NULL,
    "label" VARCHAR(128) NOT NULL,
    "description" VARCHAR(255),
    "isImmutable" BOOLEAN NOT NULL DEFAULT false,
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTemplate" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "htmlBody" TEXT NOT NULL,
    "textBody" TEXT,
    "variables" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(128) NOT NULL,
    "body" TEXT NOT NULL,
    "severity" "AnnouncementSeverity" NOT NULL DEFAULT 'INFO',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxRate" (
    "id" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "rate" DECIMAL(5,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "key" VARCHAR(64) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "rules" JSONB,
    "lastEvaluatedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImpersonationSession" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "ipAddress" VARCHAR(45) NOT NULL,

    CONSTRAINT "ImpersonationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TermsAcceptance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "termsType" "TermsType" NOT NULL,
    "version" VARCHAR(32) NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TermsAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CookieConsent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "sessionId" VARCHAR(64),
    "preferences" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CookieConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GdprRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "GdprRequestType" NOT NULL,
    "status" "GdprRequestStatus" NOT NULL DEFAULT 'PENDING',
    "downloadUrl" VARCHAR(512),
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GdprRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbuseReport" (
    "id" TEXT NOT NULL,
    "reporterUserId" TEXT,
    "serverId" TEXT,
    "type" "AbuseReportType" NOT NULL,
    "description" TEXT NOT NULL,
    "evidence" TEXT,
    "status" "AbuseReportStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "resolution" TEXT,
    "reviewedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "AbuseReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Snapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceServerId" TEXT,
    "label" VARCHAR(64) NOT NULL,
    "sizeGB" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- CreateIndex
CREATE INDEX "User_email_deletedAt_idx" ON "User"("email", "deletedAt");

-- CreateIndex
CREATE INDEX "User_username_deletedAt_idx" ON "User"("username", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TwoFactorAuth_userId_key" ON "TwoFactorAuth"("userId");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "ApiKey_userId_idx" ON "ApiKey"("userId");

-- CreateIndex
CREATE INDEX "SSHKey_userId_idx" ON "SSHKey"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ServerPlan_slug_key" ON "ServerPlan"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ImageTemplate_slug_key" ON "ImageTemplate"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Region_slug_key" ON "Region"("slug");

-- CreateIndex
CREATE INDEX "Node_regionId_idx" ON "Node"("regionId");

-- CreateIndex
CREATE INDEX "Node_status_idx" ON "Node"("status");

-- CreateIndex
CREATE UNIQUE INDEX "IpAddress_serverId_key" ON "IpAddress"("serverId");

-- CreateIndex
CREATE INDEX "IpAddress_nodeId_idx" ON "IpAddress"("nodeId");

-- CreateIndex
CREATE UNIQUE INDEX "IpAddress_nodeId_address_key" ON "IpAddress"("nodeId", "address");

-- CreateIndex
CREATE INDEX "ServerInstance_userId_idx" ON "ServerInstance"("userId");

-- CreateIndex
CREATE INDEX "ServerInstance_nodeId_idx" ON "ServerInstance"("nodeId");

-- CreateIndex
CREATE INDEX "ServerInstance_regionId_idx" ON "ServerInstance"("regionId");

-- CreateIndex
CREATE INDEX "ServerInstance_status_idx" ON "ServerInstance"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ServerInstance_userId_hostname_deletedAt_key" ON "ServerInstance"("userId", "hostname", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripePaymentId_key" ON "Payment"("stripePaymentId");

-- CreateIndex
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMethod_stripePaymentMethodId_key" ON "PaymentMethod"("stripePaymentMethodId");

-- CreateIndex
CREATE INDEX "PaymentMethod_userId_idx" ON "PaymentMethod"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- CreateIndex
CREATE INDEX "Invoice_userId_idx" ON "Invoice"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Voucher_code_key" ON "Voucher"("code");

-- CreateIndex
CREATE INDEX "VoucherUsage_voucherId_idx" ON "VoucherUsage"("voucherId");

-- CreateIndex
CREATE UNIQUE INDEX "VoucherUsage_voucherId_userId_key" ON "VoucherUsage"("voucherId", "userId");

-- CreateIndex
CREATE INDEX "Ticket_userId_idx" ON "Ticket"("userId");

-- CreateIndex
CREATE INDEX "Ticket_assignedUserId_idx" ON "Ticket"("assignedUserId");

-- CreateIndex
CREATE INDEX "Ticket_status_idx" ON "Ticket"("status");

-- CreateIndex
CREATE INDEX "TicketMessage_ticketId_idx" ON "TicketMessage"("ticketId");

-- CreateIndex
CREATE INDEX "FirewallRule_serverId_idx" ON "FirewallRule"("serverId");

-- CreateIndex
CREATE INDEX "DnsRecord_serverId_idx" ON "DnsRecord"("serverId");

-- CreateIndex
CREATE UNIQUE INDEX "DnsRecord_serverId_type_name_key" ON "DnsRecord"("serverId", "type", "name");

-- CreateIndex
CREATE INDEX "Backup_serverId_idx" ON "Backup"("serverId");

-- CreateIndex
CREATE UNIQUE INDEX "BackupSchedule_serverId_key" ON "BackupSchedule"("serverId");

-- CreateIndex
CREATE UNIQUE INDEX "BlogCategory_slug_key" ON "BlogCategory"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "BlogPost_slug_key" ON "BlogPost"("slug");

-- CreateIndex
CREATE INDEX "BlogPost_categoryId_idx" ON "BlogPost"("categoryId");

-- CreateIndex
CREATE INDEX "BlogPost_authorId_idx" ON "BlogPost"("authorId");

-- CreateIndex
CREATE INDEX "BlogPost_status_idx" ON "BlogPost"("status");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE INDEX "PrivateNetwork_userId_idx" ON "PrivateNetwork"("userId");

-- CreateIndex
CREATE INDEX "PrivateNetwork_regionId_idx" ON "PrivateNetwork"("regionId");

-- CreateIndex
CREATE INDEX "ServerPrivateNetwork_networkId_idx" ON "ServerPrivateNetwork"("networkId");

-- CreateIndex
CREATE UNIQUE INDEX "ServerPrivateNetwork_serverId_key" ON "ServerPrivateNetwork"("serverId");

-- CreateIndex
CREATE UNIQUE INDEX "FloatingIp_serverId_key" ON "FloatingIp"("serverId");

-- CreateIndex
CREATE INDEX "FloatingIp_userId_idx" ON "FloatingIp"("userId");

-- CreateIndex
CREATE INDEX "FloatingIp_regionId_idx" ON "FloatingIp"("regionId");

-- CreateIndex
CREATE INDEX "BlockVolume_userId_idx" ON "BlockVolume"("userId");

-- CreateIndex
CREATE INDEX "BlockVolume_regionId_idx" ON "BlockVolume"("regionId");

-- CreateIndex
CREATE INDEX "BlockVolume_status_idx" ON "BlockVolume"("status");

-- CreateIndex
CREATE INDEX "WebhookEndpoint_userId_idx" ON "WebhookEndpoint"("userId");

-- CreateIndex
CREATE INDEX "WebhookDelivery_endpointId_idx" ON "WebhookDelivery"("endpointId");

-- CreateIndex
CREATE INDEX "BandwidthUsage_serverId_idx" ON "BandwidthUsage"("serverId");

-- CreateIndex
CREATE UNIQUE INDEX "BandwidthUsage_serverId_date_key" ON "BandwidthUsage"("serverId", "date");

-- CreateIndex
CREATE INDEX "Referral_referrerId_idx" ON "Referral"("referrerId");

-- CreateIndex
CREATE INDEX "Referral_refereeId_idx" ON "Referral"("refereeId");

-- CreateIndex
CREATE INDEX "ReferralPayout_userId_idx" ON "ReferralPayout"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "VpsTag_userId_idx" ON "VpsTag"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VpsTag_userId_name_key" ON "VpsTag"("userId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "EmailTemplate_code_key" ON "EmailTemplate"("code");

-- CreateIndex
CREATE UNIQUE INDEX "TaxRate_regionId_key" ON "TaxRate"("regionId");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");

-- CreateIndex
CREATE INDEX "ImpersonationSession_adminUserId_idx" ON "ImpersonationSession"("adminUserId");

-- CreateIndex
CREATE INDEX "TermsAcceptance_userId_idx" ON "TermsAcceptance"("userId");

-- CreateIndex
CREATE INDEX "GdprRequest_userId_idx" ON "GdprRequest"("userId");

-- CreateIndex
CREATE INDEX "AbuseReport_status_idx" ON "AbuseReport"("status");

-- CreateIndex
CREATE INDEX "AbuseReport_serverId_idx" ON "AbuseReport"("serverId");

-- CreateIndex
CREATE INDEX "Snapshot_userId_idx" ON "Snapshot"("userId");

-- AddForeignKey
ALTER TABLE "TwoFactorAuth" ADD CONSTRAINT "TwoFactorAuth_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SSHKey" ADD CONSTRAINT "SSHKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Node" ADD CONSTRAINT "Node_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IpAddress" ADD CONSTRAINT "IpAddress_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IpAddress" ADD CONSTRAINT "IpAddress_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "ServerInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerInstance" ADD CONSTRAINT "ServerInstance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerInstance" ADD CONSTRAINT "ServerInstance_serverPlanId_fkey" FOREIGN KEY ("serverPlanId") REFERENCES "ServerPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerInstance" ADD CONSTRAINT "ServerInstance_imageTemplateId_fkey" FOREIGN KEY ("imageTemplateId") REFERENCES "ImageTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerInstance" ADD CONSTRAINT "ServerInstance_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "Snapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerInstance" ADD CONSTRAINT "ServerInstance_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerInstance" ADD CONSTRAINT "ServerInstance_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerInstance" ADD CONSTRAINT "ServerInstance_sshKeyId_fkey" FOREIGN KEY ("sshKeyId") REFERENCES "SSHKey"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanRegion" ADD CONSTRAINT "PlanRegion_planId_fkey" FOREIGN KEY ("planId") REFERENCES "ServerPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanRegion" ADD CONSTRAINT "PlanRegion_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageRegion" ADD CONSTRAINT "ImageRegion_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "ImageTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageRegion" ADD CONSTRAINT "ImageRegion_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Voucher" ADD CONSTRAINT "Voucher_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherUsage" ADD CONSTRAINT "VoucherUsage_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherUsage" ADD CONSTRAINT "VoucherUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoucherUsage" ADD CONSTRAINT "VoucherUsage_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirewallRule" ADD CONSTRAINT "FirewallRule_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "ServerInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DnsRecord" ADD CONSTRAINT "DnsRecord_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "ServerInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Backup" ADD CONSTRAINT "Backup_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "ServerInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackupSchedule" ADD CONSTRAINT "BackupSchedule_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "ServerInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "BlogCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogPost" ADD CONSTRAINT "BlogPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateNetwork" ADD CONSTRAINT "PrivateNetwork_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrivateNetwork" ADD CONSTRAINT "PrivateNetwork_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerPrivateNetwork" ADD CONSTRAINT "ServerPrivateNetwork_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "ServerInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerPrivateNetwork" ADD CONSTRAINT "ServerPrivateNetwork_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "PrivateNetwork"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FloatingIp" ADD CONSTRAINT "FloatingIp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FloatingIp" ADD CONSTRAINT "FloatingIp_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FloatingIp" ADD CONSTRAINT "FloatingIp_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "ServerInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockVolume" ADD CONSTRAINT "BlockVolume_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockVolume" ADD CONSTRAINT "BlockVolume_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockVolume" ADD CONSTRAINT "BlockVolume_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "Node"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlockVolume" ADD CONSTRAINT "BlockVolume_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "ServerInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BandwidthUsage" ADD CONSTRAINT "BandwidthUsage_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "ServerInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_refereeId_fkey" FOREIGN KEY ("refereeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralPayout" ADD CONSTRAINT "ReferralPayout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralPayout" ADD CONSTRAINT "ReferralPayout_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VpsTag" ADD CONSTRAINT "VpsTag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerTag" ADD CONSTRAINT "ServerTag_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "ServerInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServerTag" ADD CONSTRAINT "ServerTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "VpsTag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemSetting" ADD CONSTRAINT "SystemSetting_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRate" ADD CONSTRAINT "TaxRate_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureFlag" ADD CONSTRAINT "FeatureFlag_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpersonationSession" ADD CONSTRAINT "ImpersonationSession_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImpersonationSession" ADD CONSTRAINT "ImpersonationSession_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TermsAcceptance" ADD CONSTRAINT "TermsAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CookieConsent" ADD CONSTRAINT "CookieConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GdprRequest" ADD CONSTRAINT "GdprRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbuseReport" ADD CONSTRAINT "AbuseReport_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbuseReport" ADD CONSTRAINT "AbuseReport_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "ServerInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbuseReport" ADD CONSTRAINT "AbuseReport_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Snapshot" ADD CONSTRAINT "Snapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Snapshot" ADD CONSTRAINT "Snapshot_sourceServerId_fkey" FOREIGN KEY ("sourceServerId") REFERENCES "ServerInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

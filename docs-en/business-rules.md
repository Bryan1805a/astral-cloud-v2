# Business Rules

All business rules are numbered and serve as a single source of truth. Use cases reference rules by their BR-XX identifier.

---

## Domain Invariants

### BR-01 — User–Server Ownership (One-to-Many)
A user may own multiple server instances.

### BR-02 — Server Ownership Exclusivity
A server instance belongs to exactly one user at any point in time.

### BR-03 — ImageTemplate Requirement
Every server instance must be created from either a valid ImageTemplate or a Snapshot — exactly one must be specified.

### BR-04 — Physical Node Deployment
Every server instance must be deployed on exactly one physical node (Docker host).

### BR-05 — Node Resource Ceiling
A physical node must never be allocated more resources (vCPU, RAM, storage) than its total available capacity. The resource **check and allocation must be atomic** — a concurrent server creation request must not be able to observe the same free capacity and double-allocate it.

---

## Server Creation Rules

### BR-06 — Concurrent Server Limit
A customer may have a maximum of **5 active server instances** at any time. This limit does NOT apply to customers on the Enterprise plan.

### BR-07 — Provisioning Timeout
The container runtime must respond successfully within **60 seconds** from the moment the create request is dispatched. If no response is received within this window, the operation is marked as FAILED and the transaction is rolled back.

### BR-08 — Image Size ≤ Plan Disk
The disk size of the selected ImageTemplate must be less than or equal to the disk capacity of the chosen ServerPlan.

### BR-09 — Regional Availability
A customer may only create a server in a data center (region) that is enabled for their account and subscription plan.

### BR-10 — Minimum Disk Size
Every server instance must have a minimum disk size of **5 GB**.

### BR-11 — Hostname Uniqueness per User
A customer's server hostnames must be unique within their own account (different users may have same hostname).

### BR-12 — SSH Key Ownership
An SSH key used for server authentication must belong to the same customer creating the server.

---

## Server Lifecycle Rules

### BR-13 — Start Precondition
A server instance must be in the `STOPPED` state before a Start operation can be accepted.

### BR-14 — Stop Precondition
A server instance must be in the `RUNNING` state before a Stop operation can be accepted.

### BR-15 — Deletion Precondition
A server instance must be in the `STOPPED` state before it can be deleted (terminated).

### BR-16 — Resource Release on Deletion
When a server is deleted, ALL resources (vCPU, RAM, storage, IP address) allocated to that instance must be released back to the node's available pool. The IP must be set back to free state (`IpAddress.serverId = NULL`).

### BR-16a — IP Uniqueness
No public IP address may be assigned to more than one server at any time. IP allocation is atomic — the reservation happens in the same database transaction as Node capacity reservation.

### BR-16b — IP Pool Capacity
Each node must have at least one free IP address in its pool to accept a new server deployment. If no free IPs exist on any node with sufficient capacity, the provisioning request is rejected ([BR-05]).

### BR-17 — Force Stop Fallback
If graceful shutdown (SIGTERM) does not complete within 30 seconds, a force stop (SIGKILL) is applied.

### BR-18 — Server Backup Deletion
When a server is deleted, all associated backups must also be deleted and their storage released.

---

## Audit Rules

### BR-17a — Server Operation Lock
A server instance must not accept a new async operation (create, stop, restart, delete, backup, restore) while another is in progress. The `lockedBy` field is atomically checked via a conditional UPDATE before any Docker Engine call. If the server is already locked, the API returns `409 CONFLICT` with the active operation name.

### BR-17b — Stale Lock Recovery
If an operation exceeds its configured timeout (e.g., CREATING > 60s, BACKING_UP > 5min), a cron job clears the lock, marks the server as `ERROR`, and alerts admin. Timeout thresholds are per-operation and configurable via `SystemSetting`.

### BR-19 — State-Change Audit
Every state-changing operation (create, start, stop, restart, delete) on a server must generate an immutable audit log entry recording: actor, action, target server ID, timestamp, and result (success/failure).

### BR-20 — Admin Action Audit
Any admin action that modifies user accounts, server plans, images, nodes, system settings, or tax rates must generate an audit log entry.

---

## Authentication & Account Rules

### BR-21 — Unique Credentials
Each user must have a unique username and a unique email address across the system. Uniqueness is enforced only among **active accounts** (`deletedAt IS NULL`). A soft-deleted account's username and email become available for re-registration immediately upon deletion.

### BR-22 — Password Complexity
Passwords must be at least **8 characters** long and contain at least one uppercase letter, one lowercase letter, and one digit.

### BR-23 — Account Lockout
After **5 consecutive failed login attempts** within a 10-minute window, the account is locked for **15 minutes**.

### BR-24 — 2FA Enforcement (Admin)
Admin accounts must have 2FA enabled. Staff accounts are encouraged but not required.

### BR-25 — Session Management
A user may have at most 5 active sessions. Creating a 6th session invalidates the oldest.

### BR-26 — API Key Rate Limit
API key-authenticated requests are subject to the same rate limits as bearer-token-authenticated requests (60 req/min per key).

---

## Billing & Payment Rules

### BR-27 — Pre-payment Required
A customer must have sufficient wallet balance to cover at least the first billing period (monthly) or first hour (hourly) before a server can be created.

### BR-28 — Auto-deduction
For hourly billing, the system deducts from the wallet balance every hour. For monthly billing, deduction occurs at creation and each renewal date.

### BR-29 — Insufficient Balance Grace Period
If auto-deduction fails due to insufficient balance, the server enters a 24-hour grace period. After grace period expiry without top-up, the server is stopped.

### BR-30 — Invoice Generation
An invoice is generated for every wallet deduction (top-up receipts) and every billing charge. Invoices are stored as immutable PDF records.

### BR-31 — Payment Method Retention
Stripe payment methods are tokenized — raw card numbers are never stored in Astral Cloud's database.

### BR-32 — Refund Policy
Refunds are only processed for unused pre-paid monthly balance (prorated). Hourly billing is non-refundable.

---

## Voucher Rules

### BR-33 — Voucher Uniqueness
Voucher codes must be unique across the system (case-insensitive).

### BR-34 — Voucher Validity Window
A voucher has optional `validFrom` and `validUntil` dates. Outside this window, the voucher is rejected.

### BR-35 — Voucher Usage Limit
A voucher may have a maximum usage count (`maxUses`). Once reached, further redemptions are rejected.

### BR-36 — Voucher per User Limit
A customer may redeem a specific voucher at most once.

### BR-37 — Voucher Minimum Spend
A voucher may require a minimum order/payment amount before it can be applied.

### BR-38 — Voucher Stacking
Multiple vouchers may be applied to a single payment, but the total discount cannot exceed the payment amount.

---

## Support Ticket Rules

### BR-39 — Ticket Ownership
A ticket is visible only to the customer who opened it and staff/admin users.

### BR-40 — Ticket Status Lifecycle
Ticket status transitions: OPEN → IN_PROGRESS → WAITING_ON_CUSTOMER → RESOLVED → CLOSED. Only staff/admin can set RESOLVED; only the customer can set CLOSED.

### BR-41 — Ticket Reopening
A CLOSED ticket may be reopened by the customer within 7 days. After 7 days, a new ticket must be created.

### BR-42 — Ticket Auto-close
RESOLVED tickets with no customer response for 72 hours are automatically CLOSED.

---

## Blog Rules

### BR-43 — Blog Visibility
Blog posts may be DRAFT (visible only to staff/admin), PUBLISHED (visible to all), or ARCHIVED (hidden from listings but accessible by direct URL).

### BR-44 — Blog Slug Uniqueness
Blog post slugs must be unique across the system.

### BR-45 — Blog Author Attribution
A blog post's author must be a STAFF or ADMIN user. If the author account is deleted, the post retains the author name as a snapshot.

---

## Firewall Rules

### BR-46 — Firewall Rule Scope
Firewall rules apply to a single server. Default deny-all policy for inbound traffic except ports explicitly opened.

### BR-47 — Firewall Rule Priority
Rules are evaluated in priority order (lower number = higher priority). First matching rule determines the action (ALLOW/DENY).

### BR-48 — Firewall Default Rules
On server creation, default rules allow: SSH (22/tcp), HTTP (80/tcp), HTTPS (443/tcp). Customer may modify or remove.

---

## DNS Rules

### BR-49 — DNS Record Uniqueness
A DNS record (name + type) must be unique per server.

### BR-50 — Reverse DNS
Each server may have exactly one PTR (reverse DNS) record pointing to its primary IP.

---

## Backup Rules

### BR-51 — Backup Retention
Automated backups are retained for the period specified by the backup schedule (default: 7 daily, 4 weekly, 3 monthly).

### BR-52 — Backup Storage Quota
Total backup storage per server cannot exceed 2× the server's allocated disk size.

### BR-53 — Concurrent Backups
A server may have at most one backup job running at any time.

---

## Referral Rules

### BR-54 — Referral Code Uniqueness
Each user has exactly one referral code, generated on account creation. It is immutable.

### BR-55 — Referral Credit
When a referred user makes their first payment (top-up), both referrer and referee receive a configurable credit amount.

### BR-56 — Referral Payout Threshold
Referral credits become withdrawable (payout) when accumulated credits reach a configurable minimum threshold (default: $50).

### BR-57 — Self-referral Prevention
A user cannot use their own referral code. Referral is tracked by IP and browser fingerprint to prevent abuse.

---

## Notification Rules

### BR-58 — Notification Channels
Notifications are delivered via in-app notification center AND email (if user has verified email). Users may opt out of non-critical emails.

### BR-59 — Critical Notifications
Server provisioning failure, payment failure, and account security alerts are critical — users cannot opt out of these.

---

## Tax Rules

### BR-60 — Tax by Billing Region
Tax rate is determined by the customer's billing address region. If no billing address is set, the server's region determines the default tax rate.

### BR-61 — Tax-Exempt
Users with valid tax-exempt status (verified by admin) are not charged tax. This flag is set on the user record.

---

## GDPR / Data Privacy Rules

### BR-62 — Data Export
A customer may request a machine-readable export of all their personal data. The export is generated asynchronously and a download link is emailed.

### BR-63 — Account Deletion
A customer may request permanent account deletion. All servers must be deleted first. After confirmation, all personal data is removed within 30 days. Audit logs are anonymized (userId set to null, IP truncated).

---

## API Key Rules

### BR-64 — API Key Permissions
API keys inherit the permissions of the user who created them. Rotating a key invalidates the previous key.

### BR-65 — API Key Expiry
API keys may have an optional expiry date. Expired keys are rejected with 401.

---

## System Configuration Rules

### BR-66 — System Setting Validation
System settings are typed (STRING, NUMBER, BOOLEAN, JSON) and validated on save. Invalid values are rejected.

### BR-67 — Immutable Settings
Certain system settings (e.g., `JWT_SECRET`) are marked as immutable via the UI and can only be changed via environment variables.

---

## Node / Infrastructure Rules

### BR-68 — Node Status
A node may be ONLINE (accepting deployments), OFFLINE (not accepting), or MAINTENANCE (draining — existing servers run, no new deployments).

### BR-69 — Node Draining
When a node enters MAINTENANCE, no new servers are deployed to it. Existing servers continue to run until migrated or deleted. Admin is responsible for migration.

### BR-70 — Container Runtime Health
Each node's Docker daemon health is checked every 60 seconds. Three consecutive failures trigger an admin alert and automatic status change to OFFLINE.

---

## Private Networking Rules

### BR-71 — Private Network Scope
A private network exists within a single region. Servers in different regions cannot be on the same private network.

### BR-72 — Private Network CIDR
Each private network must have a non-overlapping CIDR range. Admin configures available CIDR blocks; customers select from available ranges.

### BR-73 — Server per Private Network
A server may be attached to at most one private network at a time.

### BR-74 — Private IP Assignment
When a server joins a private network, it receives an auto-assigned private IP from the network's CIDR range. The IP is released when the server leaves the network or is deleted.

---

## Floating IP Rules

### BR-75 — Floating IP Assignment
A floating IP may be assigned to exactly one server at a time, or be unassigned. Assignment is atomic (same conditional UPDATE pattern as IPAM).

### BR-76 — Floating IP Transfer
A floating IP can be transferred between two servers in the same region. The transfer is atomic — the IP is never accessible from both servers simultaneously.

### BR-77 — Floating IP Retention
Floating IPs are billed as long as they exist, regardless of assignment. Unassigned floating IPs incur a holding fee.

---

## Block Volume Rules

### BR-78 — Volume Region Binding
A block volume exists in a single region and can only be attached to servers in that region.

### BR-79 — Volume Size Limits
Minimum volume size: 1 GB. Maximum: 16 TB. Volumes can be resized upward only (never shrunk).

### BR-80 — Volume Attachment
A volume can be attached to at most one server at a time. Attachment requires the server to be in ACTIVE or STOPPED state and not locked.

### BR-81 — Volume Detachment
Volumes must be detached before deletion. Force-detach is available but may cause data corruption — a warning is displayed.

### BR-82 — Volume Billing
Volumes are billed hourly based on provisioned size, regardless of attachment status.

---

## Cloud-init Rules

### BR-83 — Cloud-init Execution
A cloud-init script (user-data) runs exactly once — on first boot after server creation. It does not re-run on subsequent starts.

### BR-84 — Cloud-init Size Limit
Cloud-init scripts are limited to 64 KB. Scripts are validated for syntax errors before server creation.

---

## Bandwidth & Overage Rules

### BR-85 — Bandwidth Pool
Each server has a monthly bandwidth allowance defined by its ServerPlan (`bandwidthMbps` translates to a GB/month cap). Outbound traffic beyond the allowance is billed at a per-GB overage rate.

### BR-86 — Bandwidth Metering
Bandwidth usage is metered at the container network interface level and aggregated daily. Usage is queryable by the customer in 1-hour granularity.

### BR-87 — Soft Cap Notification
Customers receive an in-app notification at 80% and 100% of their monthly bandwidth allowance.

---

## Webhook Rules

### BR-88 — Webhook Endpoint Limit
A customer may have at most 10 webhook endpoints.

### BR-89 — Webhook Delivery
Webhooks are delivered with at-most-once semantics. Failed deliveries are retried up to 3 times with exponential backoff (1s, 5s, 25s). After 3 failures, the delivery is marked FAILED.

### BR-90 — Webhook Secret Verification
Each webhook endpoint has a signing secret. The payload is signed with HMAC-SHA256; customers verify signatures to ensure authenticity.

### BR-91 — Webhook Events
Supported events: server.created, server.stopped, server.started, server.deleted, backup.completed, backup.failed, payment.succeeded, payment.failed.

---

## CLI & Terraform Rules

### BR-92 — CLI Authentication
The CLI authenticates via API keys. A config profile stores the API key locally.

### BR-93 — Terraform Provider
The Terraform provider uses the same REST API as the web UI. No privileged internal endpoints. All operations are rate-limited identically to API key requests.

---

## Observability Rules

### BR-94 — Metrics Retention
Application metrics (API latency, error rate, queue depth, resource usage) are retained for 90 days at 1-minute granularity. After 90 days, data is downsampled to 1-hour granularity and retained for 2 years.

### BR-95 — Alerting
Critical alerts (node offline, dead-letter queue growth, payment failure spike, provisioning failure rate > 1%) page the admin via email. Warning alerts (80% node capacity, bandwidth soft cap) generate in-app notifications.

---

## Operational Maturity Rules

### BR-96 — Database Migration Safety
All database migrations must be backward-compatible. The expand-contract pattern is mandatory: add new columns/tables (expand), deploy code that writes to both old and new schemas, migrate data, deploy code that reads from new schema only, remove old columns (contract). No `ALTER TABLE` that takes an exclusive lock on a production table.

### BR-97 — Deployment Strategy
Production deploys use blue-green: a new stack is deployed alongside the existing one, smoke-tested, then traffic is switched. Rollback is instant (switch back to the old stack).

### BR-98 — Disaster Recovery
Full database backups every 6 hours with point-in-time recovery. Recovery drill (restore to a clean environment from latest backup) is performed quarterly. Recovery Time Objective (RTO): 4 hours. Recovery Point Objective (RPO): 6 hours.

### BR-99 — Runbooks
Documented procedures must exist for: node failure, IP pool exhaustion, payment gateway outage, worker crash storm, GDPR request processing, abuse complaint handling. Runbooks are tested during disaster recovery drills.

---

## Security Hardening Rules

### BR-100 — Container Isolation (Production)
Production servers run under gVisor or Firecracker for hardware-level isolation. The learning/development environment uses standard Docker container isolation (acceptable risk documented in the threat model).

### BR-101 — WAF
A Web Application Firewall (ModSecurity with OWASP Core Rule Set) sits in front of the Nginx reverse proxy. WAF is enabled in production; optional in staging/dev.

### BR-102 — Image Signing
Container images are signed with cosign before being pushed to the registry. The worker verifies signatures before pulling. Unsigned images are rejected.

### BR-103 — Audit Log Tamper Detection
Each AuditLog entry includes a hash chain: `SHA256(previousEntry.hash || thisEntry.data)`. Tampering is detectable by walking the chain and comparing hashes.

### BR-104 — Penetration Testing
A third-party penetration test is conducted before onboarding paying customers. Critical and high findings must be remediated before launch.

---

## Compliance & Legal Rules

### BR-105 — Terms Acceptance
Users must accept the current Terms of Service and Privacy Policy before creating their first server. Acceptance is versioned — when terms are updated, existing users are prompted to re-accept on next login.

### BR-106 — Cookie Consent
EU visitors must consent to non-essential cookies before they are set. Consent preferences are stored and honored for 12 months. Essential cookies (auth, CSRF) do not require consent.

### BR-107 — DMCA Takedown
DMCA complaints are processed within 48 hours. The abuse report system tracks receipt, investigation, notification to the server owner, and resolution.

### BR-108 — DPA for Business Customers
A Data Processing Agreement (DPA) template is available for business customers upon request. The DPA references the platform's security measures (encryption, access controls, audit logging, backup policies).

---

## Admin Tools Rules

### BR-109 — Impersonation
Admin can impersonate any user to debug issues. Impersonation generates an audit log entry with both the admin and target user IDs. The admin session includes a visual banner: "Impersonating {username} — all actions are audited."

### BR-110 — Feature Flags
Features can be toggled per-user, per-role, or by percentage rollout. Feature flags are checked server-side on every request. Stale flags (> 90 days since last evaluation) generate an admin alert.

### BR-111 — Revenue Dashboard
Admin dashboard includes: MRR (Monthly Recurring Revenue), churn rate, top-up conversion rate, voucher redemption volume, customer acquisition cost, and server count by plan. Data is refreshed daily from billing aggregates.

### BR-112 — Spending Caps
Customers may set a monthly spending cap. When the cap is reached, new server creation and volume creation are blocked until the next billing cycle. Existing servers continue to run and incur charges.

### BR-113 — Volume Discounts
Annual prepayment on monthly-billed servers provides a 20% discount. The discount is applied as a credit to the wallet at the start of each billing month. Early cancellation forfeits the remaining prepaid discount.

### BR-114 — Invoice CSV Export
Customers and admins can export invoice history as CSV for accounting purposes. The export respects the same pagination and filter parameters as the billing history API.

### BR-115 — Abuse Handling
Abuse reports (DMCA, spam, malware, crypto mining) are reviewed by staff within 24 hours. Validated reports result in server suspension with 48 hours for the customer to respond. Unresolved abuse leads to server deletion.

(End of file - total 234 lines)

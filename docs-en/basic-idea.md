# Basic Idea

## 1. What is Astral Cloud?

Astral Cloud is a full-featured cloud hosting platform that lets users rent, manage, and monitor containerized servers through a centralized web interface. It automates resource allocation, billing, support, and content management — delivering the complete experience of a professional cloud provider.

Under the hood, servers are Docker containers (not full VMs), which makes provisioning near-instant and eliminates the need for nested virtualization. The platform is designed as both a production-ready application and a reference architecture for enterprise SaaS patterns.

## 2. Who uses it?

**Customers** — deploy and manage servers, read blog posts, open support tickets, apply vouchers.
**Staff** — respond to tickets, publish blog content, manage vouchers, moderate the platform.
**Admin** — manage everything: nodes, pricing, users, system settings, tax rates, email templates.

## 3. What do they want to do?

### Customers
- Register, login (with 2FA), manage profile
- Create, start, stop, restart, delete servers
- View server details (IP, resource usage, billing)
- Apply voucher/coupon codes for discounts
- Top up wallet via payment gateway (Stripe)
- View billing history and download invoices
- Open and track support tickets
- Read blog articles and changelog
- Manage API keys for programmatic access
- Enable/configure automated backups
- Configure firewall rules per server
- Manage DNS / reverse DNS records
- Tag servers for organization
- Refer friends and earn credits
- Receive in-app and email notifications

### Staff
- Respond to and resolve support tickets
- Write and publish blog posts
- Create and manage voucher campaigns
- View customer accounts (read-only)
- Moderate user-generated content

### Admin
- All staff capabilities
- Create, update, deactivate ServerPlans and ImageTemplates
- Add, update, remove physical Nodes and Regions
- Manage all users (role, status, force lock/unlock)
- View all audit logs with filters
- Configure tax rates per region
- Manage email templates
- Configure system-wide settings
- View job processing history and dead-letter queues
- Process GDPR data requests
- Manage announcements and status page
- View platform analytics and metrics

## 4. What is MVP?

Phase 1 (core):
- Register / Login / Forgot Password
- 2FA (TOTP)
- Create / List / View / Start / Stop / Delete Server
- Wallet top-up (Stripe integration)
- Server plans, images, regions (admin-managed)
- Audit logging on all state changes

Phase 2 (customer features):
- Support tickets
- Voucher / coupon system
- API keys
- Automated backups
- Firewall rules per server
- DNS / reverse DNS management
- Server tags
- In-app notifications
- Billing history + invoice download

Phase 3 (platform features):
- Blog / articles / changelog
- Referral / affiliate system
- Email template management
- Tax / VAT by region
- System settings panel
- Announcements / status page
- GDPR data export / delete
- Job history admin panel
- Referral payouts

## 5. What are the main entities?

```
User
├── owns ──── ServerInstance (1:*)
├── owns ──── SSHKey (1:*)
├── owns ──── Snapshot (1:*)
├── owns ──── ApiKey (1:*)
├── owns ──── Backup (1:* via ServerInstance)
├── opens ─── Ticket (1:*)
├── refers ── Referral (1:*)
├── has ───── Notification (1:*)
├── has ───── Session (1:*)
├── has ───── PaymentMethod (1:*)
├── owns ──── Payment (1:*)
└── has ───── TwoFactorAuth (1:1)

ServerInstance
├── based on ──── ServerPlan (*:1)
├── uses ──────── ImageTemplate (*:1)
├── deployed on ─ Node (*:1)
├── located in ── Region (*:1)
├── auth with ─── SSHKey (*:0..1)
├── boot from ─── Snapshot (*:0..1)
├── has ───────── Backup (1:*)
├── has ───────── FirewallRule (1:*)
├── has ───────── DnsRecord (1:*)
├── has ───────── VpsTag (*:*)
└── generates ─── Invoice (via billing)

User
├── generates ── AuditLog (1:*)
└── uses ──────── Voucher (1:* via VoucherUsage)

Ticket
├── opened by ─── User (*:1)
├── assigned to ── User (Staff) (*:0..1)
└── has ───────── TicketMessage (1:*)

BlogPost
├── authored by ── User (Staff/Admin) (*:1)
└── belongs to ─── BlogCategory (*:1)

Voucher
└── used by ────── VoucherUsage (1:*)
    └── applied to ── Payment (*:0..1)

Referral
├── referred by ── User (referrer) (*:1)
└── claimed by ─── User (referee) (*:1)
    └── generates ── ReferralPayout (1:*)
```

## 6. What are the error scenarios?

**Resource exhaustion:** All nodes full → customer sees "No capacity available" + admin alerted.
**Payment failure:** Stripe declines → customer notified, server may be suspended after grace period.
**Container runtime unreachable:** Docker daemon down on node → server operations fail, admin alerted, status page updated.
**Worker crash mid-provisioning:** Container created but DB not updated → retry with idempotency guard detects existing container and syncs DB.
**Concurrent node reservation race:** Two requests for same node's last capacity → conditional UPDATE atomically grants only one; loser retries next node.
**Stale state after network partition:** Docker says container is running, DB says STOPPED → reconciliation job syncs reality into DB.

(End of file - total 135 lines)

# Domain Model

---

## Entity-Relationship Overview

```
 ┌──────────┐       1..*  ┌────────────────┐      1..1    ┌──────────────┐
 │   User   │────────────▶│ ServerInstance │◀───────────│  ServerPlan  │
 └──────────┘             └────────────────┘              └──────────────┘
      │                         │       ▲                      │
      │ 1..*                    │ 1..1  │ 0..1                 │
      ▼                         ▼       │                      │
 ┌──────────┐             ┌──────────────┐                      │
 │ AuditLog │             │ ImageTemplate│◀────────────────────┘
 └──────────┘             └──────────────┘       (plan constrains image)
                                │
                                │ 1..1
                                ▼
                          ┌────────────────┐      1..*     ┌──────────┐      1..*  ┌────────────┐
                          │ ServerInstance  │────────────▶│   Node   │────────────▶│ IpAddress  │
                          └────────────────┘               └──────────┘              └────────────┘
                                │                           │                           │
                                │ 1..1                      │ 1..1                      │ 0..1
                                ▼                           ▼                           ▼
                          ┌──────────┐               ┌──────────┐              ┌────────────────┐
                          │  Region  │◀──────────────│  Region  │              │ ServerInstance  │
                          └──────────┘               └──────────┘              │ (when allocated)│
                               ▲ ▲                                              └────────────────┘
                               │ │
      ┌──────────┐             │ │
      │  SSHKey  │─── 0..1 ───▶│ │ ServerInstance (optional)
      └──────────┘             │ │
      ┌──────────┐             │ │
      │ Snapshot │─── 0..1 ───▶│ │ ServerInstance (optional, as boot source)
      └──────────┘             │ │
                               │ │
  ── Infrastructure ──         │ │
                               │ │
  ┌──────────────────┐         │ │       ┌─────────────────────┐
  │  PrivateNetwork   │───1..*─▶│ │       │ServerPrivateNetwork │◀───0..1─── ServerInstance
  └──────────────────┘         │ │       └─────────────────────┘
      │        │               │ │        (UNIQUE on serverId)
      │ 1..*   │ *..1          │ │
      ▼        ▼               │ │
     User    Region◀───────────┘ │
                                 │
  ┌──────────────┐               │
  │  FloatingIp  │──── 0..1 ───▶ ServerInstance
  └──────────────┘
      │        ▲
      │ 1..*   │ *..1
      ▼        │
     User    Region

  ┌──────────────┐               ┌──────────┐      ┌──────┐
  │ BlockVolume  │──── 0..1 ───▶ ServerInstance      │ Node │
  └──────────────┘                                   └──────┘
      │        ▲                                      ▲
      │ 1..*   │ *..1                                 │ 0..1
      ▼        │                                      │
     User    Region◀──────────── *..1 ────────────────┘

  ── Webhook / Events ──

  ┌─────────────────┐     1..*     ┌─────────────────┐
  │ WebhookEndpoint │────────────▶│ WebhookDelivery  │
  └─────────────────┘              └─────────────────┘
      │
      │ 1..* (belongs to)
      ▼
     User

  ┌─────────────────┐
  │ BandwidthUsage   │──── *..1 ───▶ ServerInstance
  └─────────────────┘

  ── Platform ──

  ┌──────────────┐
  │ FeatureFlag  │ (standalone — global configuration)
  └──────────────┘

  ┌──────────────┐      0..1      ┌──────────┐
  │ AbuseReport  │───────────────▶│   User   │ (reporter)
  └──────────────┘                └──────────┘
      │        ▲
      │ 0..1   │ 0..1 (reviewed by)
      ▼        │
  ServerInstance  User

  ┌─────────────────┐              ┌──────────┐
  │ TermsAcceptance │────────────▶│   User    │
  └─────────────────┘              └──────────┘

  ┌─────────────────┐     0..1     ┌──────────┐
  │  CookieConsent  │─────────────▶│   User    │
  └─────────────────┘              └──────────┘
```

**Cardinality summary:**

| Relationship              | From            | To              | Cardinality            |
|---------------------------|-----------------|-----------------|------------------------|
| owns                      | User            | ServerInstance  | 1 : 0..*               |
| generates                 | User            | AuditLog        | 1 : 0..*               |
| owns                      | User            | SSHKey          | 1 : 0..*               |
| owns                      | User            | Snapshot        | 1 : 0..*               |
| owns                      | User            | ApiKey          | 1 : 0..*               |
| opens                     | User            | Ticket          | 1 : 0..*               |
| refers                    | User            | Referral        | 1 : 0..*               |
| has                       | User            | Notification    | 1 : 0..*               |
| has                       | User            | Session         | 1 : 0..*               |
| has                       | User            | PaymentMethod   | 1 : 0..*               |
| has                       | User            | TwoFactorAuth   | 1 : 0..1               |
| based on                  | ServerInstance  | ServerPlan      | * : 1                  |
| uses image                | ServerInstance  | ImageTemplate   | * : 1                  |
| deployed on               | ServerInstance  | Node            | * : 1                  |
| located in                | ServerInstance  | Region          | * : 1                  |
| auth with                 | ServerInstance  | SSHKey          | * : 0..1               |
| boot from                 | ServerInstance  | Snapshot        | * : 0..1               |
| has                       | ServerInstance  | Backup          | 1 : 0..*               |
| has                       | ServerInstance  | FirewallRule    | 1 : 0..*               |
| has                       | ServerInstance  | DnsRecord       | 1 : 0..*               |
| has                       | ServerInstance  | VpsTag          | * : *                  |
| serves                    | Region          | ServerPlan      | * : *                  |
| serves                    | Region          | ImageTemplate   | * : *                  |
| located in                | Node            | Region          | * : 1                  |
| owns (pool)               | Node            | IpAddress       | 1 : 0..*               |
| assigned to               | IpAddress       | ServerInstance  | 0..1 : 1               |
| owns                      | User            | Payment         | 1 : 0..*               |
| generates                 | User            | Invoice         | 1 : 0..*               |
| uses                      | User            | Voucher         | * : * via VoucherUsage |
| authored by               | BlogPost        | User            | * : 1                  |
| belongs to                | BlogPost        | BlogCategory    | * : 1                  |
| assigned to               | Ticket          | User (Staff)    | * : 0..1               |
| owns                      | User            | PrivateNetwork  | 1 : 0..*               |
| scoped to                 | PrivateNetwork  | Region          | * : 1                  |
| joins (via SPN)           | ServerInstance  | PrivateNetwork  | * : 0..1 via ServerPrivateNetwork |
| owns                      | User            | FloatingIp      | 1 : 0..*               |
| scoped to                 | FloatingIp      | Region          | * : 1                  |
| assigned to               | FloatingIp      | ServerInstance  | 0..1 : 1               |
| owns                      | User            | BlockVolume     | 1 : 0..*               |
| scoped to                 | BlockVolume     | Region          | * : 1                  |
| provisioned on            | BlockVolume     | Node            | 0..1 : 1               |
| attached to               | BlockVolume     | ServerInstance  | 0..1 : 1               |
| has                       | User            | WebhookEndpoint | 1 : 0..*               |
| generates                 | WebhookEndpoint | WebhookDelivery | 1 : 0..*               |
| tracks                    | ServerInstance  | BandwidthUsage  | 1 : 0..*               |
| reports                   | User            | AbuseReport     | 0..1 : 0..*            |
| concerns                  | AbuseReport     | ServerInstance  | 0..1 : 1               |
| reviewed by               | User (Staff)    | AbuseReport     | 0..1 : 0..*            |
| accepts                   | User            | TermsAcceptance | 1 : 0..*               |
| consents via              | User            | CookieConsent   | 0..1 : 0..*            |

---

## Core Entities

### User

| Attribute              | Type            | Constraints                          | Description                                     |
|------------------------|-----------------|--------------------------------------|-------------------------------------------------|
| id                     | UUID            | PK, not null                         |                                                 |
| username             | string(32)      | UNIQUE (partial, active only), not null | Display name and login identifier       |
| email                | string(255)     | UNIQUE (partial, active only), not null | Contact and login identifier          |
| passwordHash           | string(60)      | not null                             | bcrypt hash                                     |
| role                   | enum            | not null, default: CUSTOMER          | CUSTOMER, STAFF, ADMIN                          |
| status                 | enum            | not null, default: ACTIVE            | ACTIVE, LOCKED, PENDING_VERIFICATION, SUSPENDED |
| balance                | decimal(12,2)   | not null, default: 0.00              | Wallet balance in system currency               |
| referralCode           | string(16)      | UNIQUE, not null                     | Auto-generated on creation                      |
| taxExempt              | boolean         | not null, default: false             | Admin-set flag                                  |
| billingAddress         | JSON?           | nullable                             | {line1, line2, city, state, postal, country}    |
| spendingCap            | decimal(10,2)?  | nullable                             | Null = no spending cap ([BR-112])               |
| failedLoginAttempts    | int             | not null, default: 0                 | Resets on successful login                      |
| lockedUntil            | datetime?       | nullable                             | Null when account is not locked                 |
| lastLoginAt            | datetime?       | nullable                             |                                                 |
| emailVerifiedAt        | datetime?       | nullable                             |                                                 |
| createdAt              | datetime        | not null, default: now()             |                                                 |
| updatedAt              | datetime        | not null, auto-update                |                                                 |
| deletedAt              | datetime?       | nullable (GDPR account deletion)     |                                          |

**Uniqueness constraint:** Both `username` and `email` use **partial unique indexes** — uniqueness is enforced only on rows where `deletedAt IS NULL`. This means a soft-deleted account's credentials are freed for re-registration:

```sql
CREATE UNIQUE INDEX "User_username_key" ON "User" (LOWER(username)) WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX "User_email_key"    ON "User" (LOWER(email))    WHERE "deletedAt" IS NULL;
```

**Edge cases handled:**
- Deleted user re-registers with the same email → allowed (old record excluded from index).
- Active user tries to claim an email belonging to another active user → blocked.
- GDPR deletion: after hard-delete (30 days post-request), the row is physically removed; the partial index remains effective for remaining active users.
- Username/email changes by active users are validated against the active subset only.

### TwoFactorAuth

| Attribute              | Type            | Constraints                          | Description                              |
|------------------------|-----------------|--------------------------------------|------------------------------------------|
| id                     | UUID            | PK, not null                         |                                          |
| userId                 | UUID            | FK → User, UNIQUE, not null          | One per user                             |
| secret                 | string(64)      | not null                             | TOTP secret (encrypted)                  |
| enabled                | boolean         | not null, default: false             |                                          |
| backupCodes            | JSON            | nullable                             | Array of hashed backup codes             |
| createdAt              | datetime        | not null, default: now()             |                                          |
| updatedAt              | datetime        | not null, auto-update                |                                          |

### Session

| Attribute              | Type            | Constraints                          | Description                              |
|------------------------|-----------------|--------------------------------------|------------------------------------------|
| id                     | UUID            | PK, not null                         |                                          |
| userId                 | UUID            | FK → User, not null                  |                                          |
| refreshTokenHash       | string(128)     | not null                             | Hashed refresh token                     |
| userAgent              | string(512)?    | nullable                             | Browser/client info                      |
| ipAddress              | string(45)      | not null                             |                                          |
| expiresAt              | datetime        | not null                             |                                          |
| createdAt              | datetime        | not null, default: now()             |                                          |

### ApiKey

| Attribute              | Type            | Constraints                          | Description                              |
|------------------------|-----------------|--------------------------------------|------------------------------------------|
| id                     | UUID            | PK, not null                         |                                          |
| userId                 | UUID            | FK → User, not null                  |                                          |
| label                  | string(64)      | not null                             | e.g. "My CI/CD pipeline"                 |
| keyPrefix              | string(8)       | not null                             | First 8 chars for identification         |
| keyHash                | string(128)     | not null                             | Hashed full key                          |
| lastUsedAt             | datetime?       | nullable                             |                                          |
| expiresAt              | datetime?       | nullable                             | Null = never expires                     |
| createdAt              | datetime        | not null, default: now()             |                                          |

### ServerPlan

| Attribute        | Type            | Constraints                  | Description                                  |
|------------------|-----------------|------------------------------|----------------------------------------------|
| id               | UUID            | PK, not null                 |                                              |
| name             | string(64)      | not null                     | e.g. "Starter", "Pro", "Enterprise"          |
| slug             | string(32)      | UNIQUE, not null             | URL-friendly identifier                      |
| vcpu             | int             | not null, ≥ 1                | Virtual CPU cores (cgroup shares)            |
| ramMB            | int             | not null, ≥ 256              | RAM in megabytes                             |
| diskGB           | int             | not null, ≥ 5                | Disk size in gigabytes                       |
| bandwidthMbps    | int             | not null, ≥ 10               | Network bandwidth cap                        |
| priceMonthly     | decimal(10,2)   | not null                     | Monthly subscription price                   |
| priceHourly      | decimal(10,2)   | not null                     | Pay-as-you-go hourly rate                    |
| maxServers       | int?            | nullable                     | Max servers for this plan (null = unlimited) |
| isActive         | boolean         | not null, default: true      | Soft-disable for retired plans               |
| createdAt        | datetime        | not null, default: now()     |                                              |
| updatedAt        | datetime        | not null, auto-update        |                                              |

### ImageTemplate

| Attribute        | Type            | Constraints                  | Description                              |
|------------------|-----------------|------------------------------|------------------------------------------|
| id               | UUID            | PK, not null                 |                                          |
| name             | string(128)     | not null                     | e.g. "Ubuntu 24.04 LTS"                  |
| slug             | string(64)      | UNIQUE, not null             |                                          |
| osType           | enum            | not null                     | LINUX                                    |
| version          | string(32)      | not null                     | e.g. "24.04"                             |
| dockerImage      | string(255)     | not null                     | e.g. "registry.astral.cloud/ubuntu:24.04"|
| diskSizeGB       | int             | not null                     | Size of the base image disk              |
| defaultUser      | string(32)      | not null                     | Default SSH user (e.g. "root")           |
| isActive         | boolean         | not null, default: true      |                                          |
| createdAt        | datetime        | not null, default: now()     |                                          |
| updatedAt        | datetime        | not null, auto-update        |                                          |

### Region

| Attribute        | Type            | Constraints                  | Description                              |
|------------------|-----------------|------------------------------|------------------------------------------|
| id               | UUID            | PK, not null                 |                                          |
| name             | string(64)      | not null                     | e.g. "US East", "EU West"                |
| slug             | string(16)      | UNIQUE, not null             | e.g. "us-east", "eu-west"                |
| isActive         | boolean         | not null, default: true      |                                          |
| createdAt        | datetime        | not null, default: now()     |                                          |

### Node (Docker Host)

| Attribute            | Type            | Constraints                  | Description                                             |
|----------------------|-----------------|------------------------------|---------------------------------------------------------|
| id                   | UUID            | PK, not null                 |                                                         |
| name                 | string(64)      | not null                     | e.g. "docker-node-01"                                   |
| regionId             | UUID            | FK → Region, not null        |                                                         |
| status               | enum            | not null                     | ONLINE, OFFLINE, MAINTENANCE                            |
| dockerEndpoint       | string(255)     | not null                     | e.g. "unix:///var/run/docker.sock" or "tcp://host:2375" |
| totalVcpu            | int             | not null                     | Total CPU cores available                               |
| totalRamMB           | int             | not null                     | Total RAM available                                     |
| totalDiskGB          | int             | not null                     | Total disk available for volumes                        |
| allocatedVcpu        | int             | not null, default: 0         | Sum of vCPU allocated to containers                     |
| allocatedRamMB       | int             | not null, default: 0         | Sum of RAM allocated to containers                      |
| allocatedDiskGB      | int             | not null, default: 0         | Sum of disk allocated to containers                     |
| lastHeartbeatAt      | datetime?       | nullable                     | Last successful health check                            |
| createdAt            | datetime        | not null, default: now()     |                                                         |
| updatedAt            | datetime        | not null, auto-update        |                                                         |

**Invariant:** `allocatedX ≤ totalX` for vCPU, RAM, and disk ([BR-05]).

### IpAddress (IPAM)

| Attribute            | Type            | Constraints                  | Description                              |
|----------------------|-----------------|------------------------------|------------------------------------------|
| id                   | UUID            | PK, not null                 |                                          |
| nodeId               | UUID            | FK → Node, not null          | Which host this IP lives on              |
| address              | string(45)      | not null                     | e.g. "203.0.113.42"                      |
| type                 | enum            | not null                     | IPv4, IPv6                               |
| serverId             | UUID?           | FK → ServerInstance, UNIQUE  | Null = FREE; non-null = assigned         |
| allocatedAt          | datetime?       | nullable                     | Set when `serverId` is assigned          |
| createdAt            | datetime        | not null, default: now()     |                                          |

**Invariant:** `serverId` is `UNIQUE` — no two ServerInstances can reference the same IpAddress. An IP is allocated atomically alongside Node capacity reservation ([BR-05]). When a server is deleted, `serverId` and `allocatedAt` are set to `NULL`, releasing the IP back to the pool ([BR-16]).

**Constraint:** `(nodeId, address)` must be unique — no duplicate IPs within a node.

### ServerInstance

| Attribute            | Type            | Constraints                  | Description                              |
|----------------------|-----------------|------------------------------|------------------------------------------|
| id                   | UUID            | PK, not null                 |                                          |
| userId               | UUID            | FK → User, not null          | Owner                                    |
| serverPlanId         | UUID            | FK → ServerPlan, not null    | Base plan (null if custom specs)         |
| imageTemplateId      | UUID?           | FK → ImageTemplate           | Null when created from snapshot          |
| snapshotId           | UUID?           | FK → Snapshot                | Null when created from image             |
| nodeId               | UUID            | FK → Node, not null          | Docker host                              |
| regionId             | UUID            | FK → Region, not null        |                                          |
| sshKeyId             | UUID?           | FK → SSHKey                  | Null if password auth used               |
| hostname             | string(64)      | not null                     | User-assigned label ([BR-11])            |
| status               | enum            | not null, default: CREATING  | See state machine below                  |
| lockedBy             | enum?           | nullable                     | Active async operation: CREATING, STOPPING, RESTARTING, DELETING, BACKING_UP, RESTORING |
| lockedAt             | datetime?       | nullable                     | Set when lock acquired; NULL when unlocked |
| ipAddress            | string(45)      | nullable                     | Derived from IpAddress; assigned after provisioning |
| dockerContainerId    | string(64)      | nullable                     | Docker container ID                      |
| vcpu                 | int             | not null                     | Allocated vCPU                           |
| ramMB                | int             | not null                     | Allocated RAM                            |
| diskGB               | int             | not null, ≥ 5                | Allocated disk ([BR-10])                 |
| billingModel         | enum            | not null, default: MONTHLY   | MONTHLY, HOURLY                          |
| rootPassword         | string(255)?    | nullable (encrypted)         | Null if SSH key auth used                |
| cloudInitScript      | text?           | nullable (max 64 KB)         | Cloud-init user-data script              |
| nextBillingAt        | datetime?       | nullable                     | Next auto-deduction time                 |
| gracePeriodEndsAt    | datetime?       | nullable                     | Set when deduction fails ([BR-29])       |
| createdAt            | datetime        | not null, default: now()     |                                          |
| updatedAt            | datetime        | not null, auto-update        |                                          |
| deletedAt            | datetime?       | nullable (soft delete)       |                                          |

**Constraint:** Exactly one of `imageTemplateId` or `snapshotId` must be non-null ([BR-03]).

**Lock semantics:** `lockedBy` and `lockedAt` form a pessimistic lock preventing concurrent operations on the same server. The lock is acquired atomically via a conditional UPDATE before any Docker Engine call:

```sql
UPDATE "ServerInstance"
SET "lockedBy" = :operation, "lockedAt" = NOW()
WHERE "id" = :serverId AND "lockedBy" IS NULL;
```

If `rows affected = 0`, the server is already locked — the API returns `409 CONFLICT` with the current `lockedBy` value (e.g., `"Server is currently backing up"`). The lock is released by setting both fields to `NULL` on operation completion (success or failure). Stale locks (exceeding operation-specific timeouts) are detected and cleared by a cron job, which also marks the server as `ERROR` and alerts admin.

### PrivateNetwork

| Attribute        | Type            | Constraints                  | Description                              |
|------------------|-----------------|------------------------------|------------------------------------------|
| id               | UUID            | PK, not null                 |                                          |
| userId           | UUID            | FK → User, not null          | Owner                                    |
| regionId         | UUID            | FK → Region, not null        | Networks are region-scoped               |
| name             | string(64)      | not null                     | e.g. "web-tier"                         |
| cidr             | string(18)      | not null                     | e.g. "10.0.0.0/24"                      |
| isActive         | boolean         | not null, default: true      |                                          |
| createdAt        | datetime        | not null, default: now()     |                                          |

### ServerPrivateNetwork (join table)

| Attribute            | Type            | Constraints                  | Description                              |
|----------------------|-----------------|------------------------------|------------------------------------------|
| id                   | UUID            | PK, not null                 |                                          |
| serverId             | UUID            | FK → ServerInstance, not null|                                          |
| networkId            | UUID            | FK → PrivateNetwork, not null|                                          |
| privateIp            | string(45)      | not null                     | Auto-assigned from CIDR                  |
| attachedAt           | datetime        | not null, default: now()     |                                          |

**Constraint:** A server may belong to at most one PrivateNetwork at a time (UNIQUE on serverId).

### FloatingIp

| Attribute            | Type            | Constraints                  | Description                              |
|----------------------|-----------------|------------------------------|------------------------------------------|
| id                   | UUID            | PK, not null                 |                                          |
| userId               | UUID            | FK → User, not null          | Owner                                    |
| regionId             | UUID            | FK → Region, not null        |                                          |
| ipAddress            | string(45)      | not null                     | The floating IP address                  |
| serverId             | UUID?           | FK → ServerInstance, UNIQUE  | Null = unassigned                        |
| assignedAt           | datetime?       | nullable                     |                                          |
| createdAt            | datetime        | not null, default: now()     |                                          |

### BlockVolume

| Attribute            | Type            | Constraints                  | Description                              |
|----------------------|-----------------|------------------------------|------------------------------------------|
| id                   | UUID            | PK, not null                 |                                          |
| userId               | UUID            | FK → User, not null          | Owner                                    |
| regionId             | UUID            | FK → Region, not null        |                                          |
| nodeId               | UUID?           | FK → Node                    | Set when provisioned                     |
| name                 | string(64)      | not null                     | User-assigned label                      |
| sizeGB               | int             | not null, ≥ 1, ≤ 16384       | Block storage size                       |
| status               | enum            | not null, default: CREATING  | CREATING, AVAILABLE, ATTACHED, DETACHING, DELETING, ERROR |
| serverId             | UUID?           | FK → ServerInstance          | Null = unattached                        |
| devicePath           | string(16)?     | nullable                     | e.g. "/dev/sdb" — set when attached      |
| attachedAt           | datetime?       | nullable                     |                                          |
| dockerVolumeId       | string(64)?     | nullable                     | Docker volume ID                         |
| createdAt            | datetime        | not null, default: now()     |                                          |
| deletedAt            | datetime?       | nullable (soft delete)       |                                          |

### AuditLog

| Attribute        | Type            | Constraints                  | Description                              |
|------------------|-----------------|------------------------------|------------------------------------------|
| id               | UUID            | PK, not null                 |                                          |
| userId           | UUID?           | FK → User                    | Null after GDPR anonymization            |
| action           | enum            | not null                     | SERVER_CREATED, SERVER_STARTED, etc.     |
| targetType       | string(32)      | not null                     | e.g. "ServerInstance", "User"            |
| targetId         | UUID            | not null                     | ID of the target entity                  |
| result           | enum            | not null                     | SUCCESS, FAILURE                         |
| metadata         | JSON            | nullable                     | Additional context                       |
| ipAddress        | string(45)      | not null                     | Client IP (truncated after GDPR)         |
| createdAt        | datetime        | not null, default: now()     | Immutable — no update column             |

---

## Billing Entities

### Payment (Stripe)

| Attribute        | Type            | Constraints                  | Description                              |
|------------------|-----------------|------------------------------|------------------------------------------|
| id               | UUID            | PK, not null                 |                                          |
| userId           | UUID            | FK → User, not null          |                                          |
| stripePaymentId  | string(64)      | UNIQUE, not null             | Stripe PaymentIntent ID                  |
| amount           | decimal(10,2)   | not null                     | Amount in system currency                |
| currency         | string(3)       | not null, default: "USD"     | ISO 4217                                 |
| status           | enum            | not null                     | PENDING, COMPLETED, FAILED, REFUNDED     |
| type             | enum            | not null                     | TOP_UP, CHARGE, REFUND                   |
| voucherId        | UUID?           | FK → Voucher                 | Voucher applied (via VoucherUsage)       |
| createdAt        | datetime        | not null, default: now()     |                                          |

### PaymentMethod

| Attribute            | Type            | Constraints                  | Description                              |
|----------------------|-----------------|------------------------------|------------------------------------------|
| id                   | UUID            | PK, not null                 |                                          |
| userId               | UUID            | FK → User, not null          |                                          |
| stripePaymentMethodId| string(64)      | UNIQUE, not null             | Stripe PaymentMethod ID                  |
| brand                | string(32)      | not null                     | e.g. "visa", "mastercard"                |
| last4                | string(4)       | not null                     | Last 4 digits                            |
| expMonth             | int             | not null                     |                                          |
| expYear              | int             | not null                     |                                          |
| isDefault            | boolean         | not null, default: false     |                                          |
| createdAt            | datetime        | not null, default: now()     |                                          |

### Invoice

| Attribute        | Type            | Constraints                  | Description                              |
|------------------|-----------------|------------------------------|------------------------------------------|
| id               | UUID            | PK, not null                 |                                          |
| userId           | UUID            | FK → User, not null          |                                          |
| invoiceNumber    | string(32)      | UNIQUE, not null             | Sequential, e.g. "INV-2026-00042"        |
| paymentId        | UUID            | FK → Payment, not null       |                                          |
| subtotal         | decimal(10,2)   | not null                     |                                          |
| taxAmount        | decimal(10,2)   | not null, default: 0.00      |                                          |
| discountAmount   | decimal(10,2)   | not null, default: 0.00      | From voucher                             |
| total            | decimal(10,2)   | not null                     |                                          |
| currency         | string(3)       | not null, default: "USD"     |                                          |
| status           | enum            | not null                     | PAID, VOID, REFUNDED                     |
| pdfUrl           | string(512)?    | nullable                     | Generated PDF storage URL                |
| createdAt        | datetime        | not null, default: now()     |                                          |

### InvoiceLineItem

| Attribute        | Type            | Constraints                  | Description                              |
|------------------|-----------------|------------------------------|------------------------------------------|
| id               | UUID            | PK, not null                 |                                          |
| invoiceId        | UUID            | FK → Invoice, not null       |                                          |
| description      | string(255)     | not null                     | e.g. "Server: my-web-server (Starter)"   |
| quantity         | int             | not null, default: 1         |                                          |
| unitPrice        | decimal(10,2)   | not null                     |                                          |
| total            | decimal(10,2)   | not null                     | quantity × unitPrice                     |

---

## Voucher Entities

### Voucher

| Attribute        | Type            | Constraints                  | Description                              |
|------------------|-----------------|------------------------------|------------------------------------------|
| id               | UUID            | PK, not null                 |                                          |
| code             | string(32)      | UNIQUE, not null             | Case-insensitive unique code             |
| description      | string(255)     | not null                     | e.g. "Launch week 20% off"               |
| discountType     | enum            | not null                     | PERCENTAGE, FIXED_AMOUNT                 |
| discountValue    | decimal(10,2)   | not null                     | e.g. 20.00 = 20% or $20.00               |
| maxUses          | int?            | nullable                     | Null = unlimited                         |
| currentUses      | int             | not null, default: 0         |                                          |
| maxUsesPerUser   | int             | not null, default: 1         |                                          |
| minSpend         | decimal(10,2)   | nullable                     | Minimum payment to apply voucher         |
| validFrom        | datetime?       | nullable                     |                                          |
| validUntil       | datetime?       | nullable                     |                                          |
| isActive         | boolean         | not null, default: true      | Admin can disable                        |
| createdByUserId  | UUID            | FK → User, not null          | Admin/staff who created it               |
| createdAt        | datetime        | not null, default: now()     |                                          |

### VoucherUsage

| Attribute        | Type            | Constraints                  | Description                              |
|------------------|-----------------|------------------------------|------------------------------------------|
| id               | UUID            | PK, not null                 |                                          |
| voucherId        | UUID            | FK → Voucher, not null       |                                          |
| userId           | UUID            | FK → User, not null          | Who redeemed it                          |
| paymentId        | UUID?           | FK → Payment                 | Which payment it was applied to          |
| discountAmount   | decimal(10,2)   | not null                     | Actual discount given                    |
| createdAt        | datetime        | not null, default: now()     |                                          |

---

## Support Entities

### Ticket

| Attribute        | Type            | Constraints                  | Description                                              |
|------------------|-----------------|------------------------------|----------------------------------------------------------|
| id               | UUID            | PK, not null                 |                                                          |
| userId           | UUID            | FK → User, not null          | Customer who opened                                      |
| assignedUserId   | UUID?           | FK → User                    | Staff member assigned                                    |
| subject          | string(255)     | not null                     |                                                          |
| status           | enum            | not null, default: OPEN      | OPEN, IN_PROGRESS, WAITING_ON_CUSTOMER, RESOLVED, CLOSED |
| priority         | enum            | not null, default: NORMAL    | LOW, NORMAL, HIGH, URGENT                                |
| category         | enum            | not null                     | GENERAL, BILLING, TECHNICAL, ABUSE                       |
| resolvedAt       | datetime?       | nullable                     |                                                          |
| closedAt         | datetime?       | nullable                     |                                                          |
| createdAt        | datetime        | not null, default: now()     |                                                          |
| updatedAt        | datetime        | not null, auto-update        |                                                          |

### TicketMessage

| Attribute        | Type            | Constraints                  | Description                              |
|------------------|-----------------|------------------------------|------------------------------------------|
| id               | UUID            | PK, not null                 |                                          |
| ticketId         | UUID            | FK → Ticket, not null        |                                          |
| userId           | UUID            | FK → User, not null          | Author (customer or staff)               |
| body             | text            | not null                     | Message content                          |
| isInternal       | boolean         | not null, default: false     | Staff-only note                          |
| createdAt        | datetime        | not null, default: now()     | Immutable                                |

---

## Blog Entities

### BlogCategory

| Attribute        | Type            | Constraints                  | Description                              |
|------------------|-----------------|------------------------------|------------------------------------------|
| id               | UUID            | PK, not null                 |                                          |
| name             | string(64)      | not null                     | e.g. "Tutorials", "Changelog", "News"    |
| slug             | string(64)      | UNIQUE, not null             |                                          |
| description      | string(255)?    | nullable                     |                                          |
| createdAt        | datetime        | not null, default: now()     |                                          |

### BlogPost

| Attribute        | Type            | Constraints                  | Description                              |
|------------------|-----------------|------------------------------|------------------------------------------|
| id               | UUID            | PK, not null                 |                                          |
| categoryId       | UUID            | FK → BlogCategory, not null  |                                          |
| authorId         | UUID            | FK → User, not null          | Must be STAFF or ADMIN                   |
| title            | string(255)     | not null                     |                                          |
| slug             | string(255)     | UNIQUE, not null             |                                          |
| excerpt          | string(500)?    | nullable                     | Summary for cards                        |
| body             | text            | not null                     | Markdown content                         |
| coverImageUrl    | string(512)?    | nullable                     |                                          |
| status           | enum            | not null, default: DRAFT     | DRAFT, PUBLISHED, ARCHIVED               |
| publishedAt      | datetime?       | nullable                     | Set on first publish                     |
| tags             | JSON            | nullable                     | Array of tag strings                     |
| createdAt        | datetime        | not null, default: now()     |                                          |
| updatedAt        | datetime        | not null, auto-update        |                                          |

---

## Networking Entities

### FirewallRule

| Attribute        | Type            | Constraints                  | Description                              |
|------------------|-----------------|------------------------------|------------------------------------------|
| id               | UUID            | PK, not null                 |                                          |
| serverId         | UUID            | FK → ServerInstance, not null|                                          |
| protocol         | enum            | not null                     | TCP, UDP, ICMP, ALL                      |
| portRange        | string(16)      | not null                     | e.g. "22", "80", "8000-8100"             |
| sourceCidr       | string(45)      | not null                     | e.g. "0.0.0.0/0", "10.0.0.0/8"           |
| action           | enum            | not null                     | ALLOW, DENY                              |
| priority         | int             | not null                     | Lower = evaluated first                  |
| description      | string(128)?    | nullable                     |                                          |
| createdAt        | datetime        | not null, default: now()     |                                          |

### DnsRecord

| Attribute        | Type            | Constraints                  | Description                              |
|------------------|-----------------|------------------------------|------------------------------------------|
| id               | UUID            | PK, not null                 |                                          |
| serverId         | UUID            | FK → ServerInstance, not null|                                          |
| type             | enum            | not null                     | A, AAAA, CNAME, MX, TXT, PTR             |
| name             | string(255)     | not null                     | e.g. "@", "www", "mail"                  |
| value            | string(512)     | not null                     | e.g. IP address, domain name             |
| ttl              | int             | not null, default: 3600      | Time to live in seconds                  |
| priority         | int?            | nullable                     | MX priority                              |
| createdAt        | datetime        | not null, default: now()     |                                          |

---

## Backup Entities

### Backup

| Attribute        | Type            | Constraints                  | Description                              |
|------------------|-----------------|------------------------------|------------------------------------------|
| id               | UUID            | PK, not null                 |                                          |
| serverId         | UUID            | FK → ServerInstance, not null|                                          |
| label            | string(64)      | not null                     | Auto-generated or user-provided          |
| type             | enum            | not null                     | MANUAL, AUTOMATED                        |
| sizeMB           | int             | not null                     | Backup size                              |
| status           | enum            | not null                     | CREATING, AVAILABLE, FAILED, EXPIRED     |
| storagePath      | string(512)     | not null                     | Path to backup archive on node           |
| expiresAt        | datetime?       | nullable                     | Per retention policy                     |
| createdAt        | datetime        | not null, default: now()     |                                          |

### BackupSchedule

| Attribute            | Type            | Constraints                  | Description                              |
|----------------------|-----------------|------------------------------|------------------------------------------|
| id                   | UUID            | PK, not null                 |                                          |
| serverId             | UUID            | FK → ServerInstance, UNIQUE  | One schedule per server                  |
| enabled              | boolean         | not null, default: false     |                                          |
| intervalHours        | int             | not null, default: 24        | Frequency (e.g. 24 = daily)              |
| retainDaily          | int             | not null, default: 7         |                                          |
| retainWeekly         | int             | not null, default: 4         |                                          |
| retainMonthly        | int             | not null, default: 3         |                                          |
| nextRunAt            | datetime        | not null                     | Next scheduled backup                    |
| createdAt            | datetime        | not null, default: now()     |                                          |
| updatedAt            | datetime        | not null, auto-update        |                                          |

---

## Notification Entities

### Notification

| Attribute        | Type            | Constraints                  | Description                                          |
|------------------|-----------------|------------------------------|------------------------------------------------------|
| id               | UUID            | PK, not null                 |                                                      |
| userId           | UUID            | FK → User, not null          |                                                      |
| type             | enum            | not null                     | SERVER_CREATED, PAYMENT_FAILED, TICKET_UPDATED, etc. |
| title            | string(128)     | not null                     |                                                      |
| body             | string(512)     | not null                     |                                                      |
| link             | string(512)?    | nullable                     | Deep link to relevant page                           |
| isRead           | boolean         | not null, default: false     |                                                      |
| createdAt        | datetime        | not null, default: now()     |                                                      |

### NotificationPreference

| Attribute            | Type            | Constraints                  | Description                              |
|----------------------|-----------------|------------------------------|------------------------------------------|
| id                   | UUID            | PK, not null                 |                                          |
| userId               | UUID            | FK → User, UNIQUE            | One set per user                         |
| emailServerCreated   | boolean         | not null, default: true      |                                          |
| emailServerDeleted   | boolean         | not null, default: true      |                                          |
| emailPaymentFailure  | boolean         | not null, default: true      | Critical — cannot fully disable          |
| emailTicketUpdates   | boolean         | not null, default: true      |                                          |
| emailMarketing       | boolean         | not null, default: false     |                                          |
| pushServerCreated    | boolean         | not null, default: true      | In-app push                              |
| pushTicketUpdates    | boolean         | not null, default: true      |                                          |

### WebhookEndpoint

| Attribute            | Type            | Constraints                  | Description                              |
|----------------------|-----------------|------------------------------|------------------------------------------|
| id                   | UUID            | PK, not null                 |                                          |
| userId               | UUID            | FK → User, not null          |                                          |
| url                  | string(512)     | not null                     | Must be HTTPS                            |
| secret               | string(64)      | not null                     | HMAC-SHA256 signing secret               |
| events               | JSON            | not null                     | Array of event type strings              |
| isActive             | boolean         | not null, default: true      |                                          |
| lastDeliveryAt       | datetime?       | nullable                     |                                          |
| createdAt            | datetime        | not null, default: now()     |                                          |
| updatedAt            | datetime        | not null, auto-update        |                                          |

### WebhookDelivery

| Attribute            | Type            | Constraints                  | Description                              |
|----------------------|-----------------|------------------------------|------------------------------------------|
| id                   | UUID            | PK, not null                 |                                          |
| endpointId           | UUID            | FK → WebhookEndpoint, not null|                                         |
| event                | string(64)      | not null                     | e.g. "server.created"                    |
| payload              | JSON            | not null                     | The delivered payload                    |
| status               | enum            | not null                     | PENDING, DELIVERED, FAILED               |
| responseCode         | int?            | nullable                     |                                          |
| attemptCount         | int             | not null, default: 1         |                                          |
| nextRetryAt          | datetime?       | nullable                     |                                          |
| createdAt            | datetime        | not null, default: now()     |                                          |

### BandwidthUsage (daily aggregate)

| Attribute        | Type            | Constraints                  | Description                              |
|------------------|-----------------|------------------------------|------------------------------------------|
| id               | UUID            | PK, not null                 |                                          |
| serverId         | UUID            | FK → ServerInstance, not null|                                          |
| date             | date            | not null                     | Aggregation date                         |
| bytesIn          | bigint          | not null, default: 0         |                                          |
| bytesOut         | bigint          | not null, default: 0         |                                          |

**Constraint:** UNIQUE(serverId, date)

---

## Referral Entities

### Referral

| Attribute            | Type            | Constraints                  | Description                              |
|----------------------|-----------------|------------------------------|------------------------------------------|
| id                   | UUID            | PK, not null                 |                                          |
| referrerId           | UUID            | FK → User, not null          | User who referred                        |
| refereeId            | UUID            | FK → User, not null          | User who signed up with code             |
| refereeIpAddress     | string(45)      | not null                     | For abuse prevention                     |
| status               | enum            | not null, default: PENDING   | PENDING, CREDITED, PAID_OUT              |
| referrerCredit       | decimal(10,2)   | not null                     | Credit given to referrer                 |
| refereeCredit        | decimal(10,2)   | not null                     | Credit given to referee                  |
| createdAt            | datetime        | not null, default: now()     |                                          |

### ReferralPayout

| Attribute            | Type            | Constraints                  | Description                              |
|----------------------|-----------------|------------------------------|------------------------------------------|
| id                   | UUID            | PK, not null                 |                                          |
| userId               | UUID            | FK → User, not null          | Referrer receiving payout                |
| amount               | decimal(10,2)   | not null                     |                                          |
| paymentId            | UUID?           | FK → Payment                 | Linked payment (if paid via Stripe)      |
| status               | enum            | not null, default: PENDING   | PENDING, COMPLETED, FAILED               |
| createdAt            | datetime        | not null, default: now()     |                                          |

---

## Platform Entities

### SystemSetting

| Attribute        | Type            | Constraints                  | Description                              |
|------------------|-----------------|------------------------------|------------------------------------------|
| id               | UUID            | PK, not null                 |                                          |
| key              | string(64)      | UNIQUE, not null             | e.g. "site.name", "billing.currency"     |
| value            | text            | not null                     | String-encoded value                     |
| type             | enum            | not null                     | STRING, NUMBER, BOOLEAN, JSON            |
| label            | string(128)     | not null                     | Human-readable name                      |
| description      | string(255)?    | nullable                     |                                          |
| isImmutable      | boolean         | not null, default: false     | Cannot be changed via UI                 |
| updatedByUserId  | UUID?           | FK → User                    | Last admin to modify                     |
| createdAt        | datetime        | not null, default: now()     |                                          |
| updatedAt        | datetime        | not null, auto-update        |                                          |

### EmailTemplate

| Attribute        | Type            | Constraints                  | Description                              |
|------------------|-----------------|------------------------------|------------------------------------------|
| id               | UUID            | PK, not null                 |                                          |
| code             | string(64)      | UNIQUE, not null             | e.g. "server.created", "payment.failed"  |
| name             | string(128)     | not null                     | Human-readable label                     |
| subject          | string(255)     | not null                     | Subject line (supports variables)        |
| htmlBody         | text            | not null                     | HTML email body (supports variables)     |
| textBody         | text            | nullable                     | Plain-text fallback                      |
| variables        | JSON            | nullable                     | Array of available variable names        |
| isActive         | boolean         | not null, default: true      |                                          |
| createdAt        | datetime        | not null, default: now()     |                                          |
| updatedAt        | datetime        | not null, auto-update        |                                          |

### Announcement

| Attribute        | Type            | Constraints                  | Description                              |
|------------------|-----------------|------------------------------|------------------------------------------|
| id               | UUID            | PK, not null                 |                                          |
| title            | string(128)     | not null                     |                                          |
| body             | text            | not null                     | Markdown content                         |
| severity         | enum            | not null, default: INFO      | INFO, WARNING, CRITICAL                  |
| isActive         | boolean         | not null, default: true      |                                          |
| startsAt         | datetime?       | nullable                     | Scheduled display start                  |
| endsAt           | datetime?       | nullable                     | Scheduled display end                    |
| createdByUserId  | UUID            | FK → User, not null          |                                          |
| createdAt        | datetime        | not null, default: now()     |                                          |

### TaxRate

| Attribute        | Type            | Constraints                  | Description                              |
|------------------|-----------------|------------------------------|------------------------------------------|
| id               | UUID            | PK, not null                 |                                          |
| regionId         | UUID            | FK → Region, UNIQUE          | One rate per region                      |
| name             | string(64)      | not null                     | e.g. "US Sales Tax", "EU VAT"            |
| rate             | decimal(5,2)    | not null                     | Percentage (e.g. 8.25)                   |
| isActive         | boolean         | not null, default: true      |                                          |
| createdAt        | datetime        | not null, default: now()     |                                          |
| updatedAt        | datetime        | not null, auto-update        |                                          |

### FeatureFlag

| Attribute            | Type            | Constraints                  | Description                              |
|----------------------|-----------------|------------------------------|------------------------------------------|
| id                   | UUID            | PK, not null                 |                                          |
| key                  | string(64)      | UNIQUE, not null             | e.g. "floating_ips", "private_networking"|
| description          | string(255)     | not null                     |                                          |
| enabled              | boolean         | not null, default: false     | Global on/off                            |
| rules                | JSON?           | nullable                     | Per-user, per-role, percentage rollout   |
| createdAt            | datetime        | not null, default: now()     |                                          |
| updatedAt            | datetime        | not null, auto-update        |                                          |

### AbuseReport

| Attribute            | Type            | Constraints                  | Description                              |
|----------------------|-----------------|------------------------------|------------------------------------------|
| id                   | UUID            | PK, not null                 |                                          |
| reporterUserId       | UUID?           | FK → User                    | Null if submitted anonymously via form   |
| serverId             | UUID?           | FK → ServerInstance          | Null if not server-specific              |
| type                 | enum            | not null                     | DMCA, SPAM, MALWARE, CRYPTO_MINING, PHISHING, OTHER |
| description          | text            | not null                     | Details of the abuse                     |
| evidence             | text?           | nullable                     | URLs, screenshots, etc.                  |
| status               | enum            | not null, default: PENDING   | PENDING, REVIEWING, VALIDATED, DISMISSED, RESOLVED |
| resolution           | text?           | nullable                     | Admin notes on resolution                |
| reviewedByUserId     | UUID?           | FK → User                    | Staff/admin who reviewed                 |
| createdAt            | datetime        | not null, default: now()     |                                          |
| resolvedAt           | datetime?       | nullable                     |                                          |

### TermsAcceptance

| Attribute            | Type            | Constraints                  | Description                              |
|----------------------|-----------------|------------------------------|------------------------------------------|
| id                   | UUID            | PK, not null                 |                                          |
| userId               | UUID            | FK → User, not null          |                                          |
| termsType            | enum            | not null                     | TOS, PRIVACY_POLICY                      |
| version              | string(32)      | not null                     | e.g. "2026.1"                            |
| acceptedAt           | datetime        | not null, default: now()     |                                          |

### CookieConsent

| Attribute            | Type            | Constraints                  | Description                              |
|----------------------|-----------------|------------------------------|------------------------------------------|
| id                   | UUID            | PK, not null                 |                                          |
| userId               | UUID?           | FK → User                    | Null for anonymous visitors              |
| sessionId            | string(64)?     | nullable                     | For anonymous tracking                   |
| preferences          | JSON            | not null                     | {analytics: true, marketing: false, ...} |
| createdAt            | datetime        | not null, default: now()     |                                          |

### GdprRequest

| Attribute        | Type            | Constraints                  | Description                              |
|------------------|-----------------|------------------------------|------------------------------------------|
| id               | UUID            | PK, not null                 |                                          |
| userId           | UUID            | FK → User, not null          |                                          |
| type             | enum            | not null                     | EXPORT, DELETE                           |
| status           | enum            | not null, default: PENDING   | PENDING, PROCESSING, COMPLETED, FAILED   |
| downloadUrl      | string(512)?    | nullable                     | Export download link (expires)           |
| completedAt      | datetime?       | nullable                     |                                          |
| expiresAt        | datetime        | not null                     | Request auto-expires if not actioned     |
| createdAt        | datetime        | not null, default: now()     |                                          |

---

## Join Tables & Lightweight Entities

### PlanRegion (ServerPlan ↔ Region)

| Attribute  | Type  | Constraints              |
|------------|-------|--------------------------|
| planId     | UUID  | FK → ServerPlan, PK      |
| regionId   | UUID  | FK → Region, PK          |

### ImageRegion (ImageTemplate ↔ Region)

| Attribute  | Type  | Constraints              |
|------------|-------|--------------------------|
| imageId    | UUID  | FK → ImageTemplate, PK   |
| regionId   | UUID  | FK → Region, PK          |

### VpsTag

| Attribute  | Type            | Constraints                         | Description                          |
|------------|-----------------|-------------------------------------|--------------------------------------|
| id         | UUID            | PK, not null                        |                                      |
| userId     | UUID            | FK → User, not null                 | Owner (for user-specific tags)       |
| name       | string(32)      | not null                            | e.g. "production", "staging"         |
| color      | string(7)       | nullable                            | Hex color code e.g. "#FF5733"      |
| createdAt  | datetime        | not null, default: now()            |                                      |

### ServerTag (ServerInstance ↔ VpsTag)

| Attribute  | Type  | Constraints                          |
|------------|-------|--------------------------------------|
| serverId   | UUID  | FK → ServerInstance, PK              |
| tagId      | UUID  | FK → VpsTag, PK                      |

### SSHKey

| Attribute  | Type            | Constraints                  | Description                              |
|------------|-----------------|------------------------------|------------------------------------------|
| id         | UUID            | PK, not null                 |                                          |
| userId     | UUID            | FK → User, not null          |                                          |
| label      | string(64)      | not null                     | e.g. "My laptop"                         |
| publicKey  | text            | not null                     | OpenSSH-format public key                |
| createdAt  | datetime        | not null, default: now()     |                                          |

### Snapshot *(deferred)*

| Attribute    | Type            | Constraints                  | Description                              |
|--------------|-----------------|------------------------------|------------------------------------------|
| id           | UUID            | PK, not null                 |                                          |
| userId       | UUID            | FK → User, not null          |                                          |
| sourceServerId | UUID?         | FK → ServerInstance          | Source server (null if deleted)          |
| label        | string(64)      | not null                     | User-assigned name                       |
| sizeGB       | int             | not null                     | Actual snapshot size                     |
| createdAt    | datetime        | not null, default: now()     |                                          |

---

## Server Lifecycle State Machine

```
                    ┌──────────┐
                    │ CREATING │  ◀── lockedBy = CREATING
                    └────┬─────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
         success    timeout     error
              │     (BR-07)        │
              ▼          ▼          ▼
        ┌────────┐  ┌───────┐  ┌───────┐
        │ ACTIVE │  │ ERROR │  │ ERROR │
        └───┬──┬─┘  └───────┘  └───────┘
            │  │
            │  │   ┌────────────┐
            │  │   │ STOPPING   │  ◀── lockedBy = STOPPING
            │  │   └─────┬──────┘
            │  │         │
            │  │    ┌────┴────┐
            │  │  success  timeout → force kill
            │  │    │            │
            │  │    ▼            ▼
            │  │  ┌─────────┐
            │  └─▶│ STOPPED │
            │     └────┬────┘
            │          │
            │    ┌─────┴──────┐
            │    │  DELETING   │  ◀── lockedBy = DELETING
            │    └─────┬──────┘
            │          │
            │     success
            │          │
            │          ▼
            │     ┌─────────┐
            │     │ DELETED │
            │     └─────────┘
            │
            │     ┌─────────────┐
            └─────│ RESTARTING  │  ◀── lockedBy = RESTARTING
                  └──────┬──────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
         success    timeout     error
              │          │          │
              ▼          ▼          ▼
         ┌────────┐  ┌───────┐  ┌───────┐
         │ ACTIVE │  │ ERROR │  │ ERROR │
         └────────┘  └───────┘  └───────┘

   ┌──────────────┐
   │ BACKING_UP   │  ◀── lockedBy = BACKING_UP, status unchanged (ACTIVE/STOPPED)
   └──────┬───────┘
          │
     ┌────┴────┐
   success   error
     │          │
     ▼          ▼
  (status   (backup
  unchanged) failed,
             admin
             alerted)

   ┌──────────────┐
   │ RESTORING    │  ◀── lockedBy = RESTORING, server must be STOPPED
   └──────┬───────┘
          │
     ┌────┴────┐
   success   error
     │          │
     ▼          ▼
  ACTIVE     ERROR
  or STOPPED
```

**Valid transitions:**

| From       | To          | Trigger                      | Lock acquired        | Rule    |
|------------|-------------|------------------------------|----------------------|---------|
| (none)     | CREATING    | Create server                | CREATING             | UC-01   |
| CREATING   | ACTIVE      | Provision success            | (released on finish) | UC-01   |
| CREATING   | ERROR       | Provision failure            | (released on finish) | UC-01   |
| ACTIVE     | STOPPING    | Stop server (graceful)       | STOPPING             | BR-14   |
| STOPPING   | STOPPED     | Shutdown success             | (released on finish) | UC-06   |
| STOPPING   | ACTIVE      | Shutdown failure / timeout → force → success | (released on finish) | UC-06 |
| STOPPED    | ACTIVE      | Start server                 | (no lock needed)     | BR-13   |
| ACTIVE     | RESTARTING  | Restart server               | RESTARTING           | Derived |
| RESTARTING | ACTIVE      | Restart success              | (released on finish) | Derived |
| RESTARTING | ERROR       | Restart failure              | (released on finish) | Derived |
| STOPPED    | DELETING    | Delete server                | DELETING             | BR-15   |
| DELETING   | DELETED     | Deletion success             | (released on finish) | UC-07   |
| DELETING   | ERROR       | Deletion failure (save record)| (released on finish) | UC-07   |
| ACTIVE     | STOPPED     | Grace period expired (BR-29) | (no lock — cron)     | Auto    |
| ERROR      | (manual)    | Admin intervention           | (no lock)            | Admin   |
| ACTIVE     | (lock-only) | Backup created               | BACKING_UP           | UC-13   |
| STOPPED    | (lock-only) | Backup created               | BACKING_UP           | UC-13   |
| STOPPED    | RESTORING   | Restore from backup          | RESTORING            | UC-13   |

**Lock-only operations:** `BACKING_UP` and `RESTORING` do not change the `status` field (except RESTORING starts from STOPPED and ends in ACTIVE or STOPPED). They use `lockedBy` purely to prevent concurrent operations while Docker processes the backup/restore.

**Operation timeouts (before stale lock is cleared by cron):**

| Locked Operation | Timeout    |
|------------------|------------|
| CREATING         | 60 seconds |
| STOPPING         | 30 seconds |
| RESTARTING       | 60 seconds |
| DELETING         | 30 seconds |
| BACKING_UP       | 5 minutes  |
| RESTORING        | 5 minutes  |

**Invalid transitions are rejected at the API layer** — the handler checks `lockedBy IS NOT NULL` and returns `409 CONFLICT` before any Docker call is made.

---

## Key Invariants

1. **Ownership:** `ServerInstance.userId` references exactly one `User` ([BR-01], [BR-02]).
2. **Active server cap:** ≤ 5 servers in non-DELETED state unless on Enterprise plan ([BR-06]).
3. **Resource ceiling:** `allocatedX ≤ totalX` for every `Node` ([BR-05]).
4. **Disk minimum:** `ServerInstance.diskGB ≥ 5` ([BR-10]).
5. **Image/snapshot size:** `ImageTemplate.diskSizeGB ≤ ServerInstance.diskGB` ([BR-08]).
6. **Hostname uniqueness:** `ServerInstance.hostname` unique per `userId` ([BR-11]).
7. **Audit trail:** Every state-changing operation inserts one immutable `AuditLog` row ([BR-19]).
8. **Resource release:** On server deletion, node `allocated*` counters are decremented AND the IP is released (`IpAddress.serverId = NULL`) ([BR-16]).
9. **IP uniqueness:** A public IP address cannot be assigned to more than one server at a time. The `IpAddress.serverId` UNIQUE constraint enforces this.
10. **IP atomic allocation:** An IP address is reserved in the same database transaction as Node capacity — if either fails, the entire transaction rolls back ([BR-05]).
11. **Voucher once per user:** A user cannot redeem the same voucher twice ([BR-36]).
12. **Referral no self:** A user cannot use their own referral code ([BR-57]).
13. **Soft-delete + uniqueness:** Any entity with both soft-delete (`deletedAt`) and a unique constraint uses a **partial unique index** (`WHERE "deletedAt" IS NULL`). This allows deleted records' identifiers to be safely reused by new active records without UNIQUE conflict.
14. **Server operation lock:** At most one async operation may execute on a server at any time. The `lockedBy` field is checked and set atomically before any Docker Engine call. An API request arriving while a server is locked receives `409 CONFLICT`.
15. **Stale lock detection:** A cron job scans for servers where `lockedAt` exceeds the operation-specific timeout. Stale locks are cleared (`lockedBy = NULL, lockedAt = NULL`), the server is marked `ERROR`, and admin is alerted.

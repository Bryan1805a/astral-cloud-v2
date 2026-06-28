# Glossary (Ubiquitous Language)

This glossary defines every domain-specific term used across the Astral Cloud codebase, documentation, API, and UI. All contributors must use these terms consistently.

---

## Core Domain: Server & Infrastructure

| Term                    | Definition                                                                                                   |
|-------------------------|---------------------------------------------------------------------------------------------------------------|
| **Server**              | A containerized Ubuntu instance rented by a customer, deployed on a Docker host. Provisioned in seconds.      |
| **Server Instance**     | The database record representing a single server (`ServerInstance`). Includes hostname, IP, status, resources.|
| **Node**                | A physical server running Docker Engine, capable of hosting multiple server instances.                        |
| **Container Runtime**   | The software layer that creates and manages containers. In this project: Docker Engine.                       |
| **Provisioning**        | The process of creating a Docker container: pulling image, allocating resources, configuring network, starting.|
| **Lifecycle**           | The set of states a server transitions through: CREATING → ACTIVE ↔ STOPPED → DELETED.                       |
| **Region**              | A logical grouping of physical Nodes in the same geographic data center.                                     |
| **IP Pool**             | A range of public IP addresses available for assignment to server instances on a node. Managed via the `IpAddress` table — each row is either FREE (`serverId = NULL`) or allocated. IP allocation is atomic, reserved in the same DB transaction as node capacity. |
| **Server Plan**         | A predefined set of compute resources (vCPU, RAM, disk) offered at a fixed price.                            |
| **Image Template**      | A pre-configured OS container image available for server creation (e.g., "Ubuntu 24.04 LTS").                |
| **Snapshot**            | A point-in-time copy of a server's data volume, saved for later restoration or cloning.                       |
| **Custom Specs**        | A customer-defined resource configuration that does not correspond to any predefined ServerPlan.              |

---

## Billing & Finance

| Term                  | Definition                                                                                                   |
|-----------------------|---------------------------------------------------------------------------------------------------------------|
| **Wallet**            | An account's pre-paid balance from which server charges are deducted.                                         |
| **Balance**           | The current amount of funds available in a customer's wallet.                                                 |
| **Billing Model**     | How a server is charged: `MONTHLY` (auto-renew) or `HOURLY` (pay-as-you-go).                                 |
| **Top-Up**            | Adding funds to a wallet via payment gateway (Stripe).                                                        |
| **Invoice**           | An immutable record of a billing transaction (charge or top-up). Generated as a downloadable PDF.             |
| **Payment Method**    | A tokenized representation of a customer's payment instrument (Stripe PaymentMethod).                         |
| **Grace Period**      | The 24-hour window after a failed auto-deduction before a server is stopped.                                  |
| **Voucher**           | A discount code (coupon) that reduces the amount charged. May be percentage-based or fixed-amount.            |
| **Voucher Usage**     | A record linking a voucher redemption to a specific user and optionally a payment.                            |

---

## Authentication & Security

| Term                  | Definition                                                                                                   |
|-----------------------|---------------------------------------------------------------------------------------------------------------|
| **Access Token**      | A short-lived JWT (1 hour) used to authenticate API requests.                                                 |
| **Refresh Token**     | A longer-lived opaque token (7 days) stored in an HTTP-only cookie for silent token renewal.                 |
| **Session**           | A user's authenticated state. Users may have up to 5 active sessions.                                         |
| **Account Lock**      | A temporary block on login (15 minutes) after 5 consecutive failed attempts within 10 minutes.               |
| **Role**              | A user's permission level: `CUSTOMER`, `STAFF`, or `ADMIN`.                                                  |
| **2FA**               | Two-factor authentication via TOTP (Time-based One-Time Password). Required for admin accounts.              |
| **API Key**           | A long-lived credential for programmatic API access. Scoped to the creating user's permissions.               |
| **Idempotency Key**   | A UUID header that prevents duplicate operations when retrying requests. Scoped per-user, 24-hour TTL.        |

---

## Support & Content

| Term                  | Definition                                                                                                   |
|-----------------------|---------------------------------------------------------------------------------------------------------------|
| **Ticket**            | A support request opened by a customer, assigned to staff for resolution.                                    |
| **Ticket Message**    | An individual message within a ticket thread (from customer or staff).                                        |
| **Blog Post**         | A published article on the platform's blog. May be DRAFT, PUBLISHED, or ARCHIVED.                            |
| **Blog Category**     | A grouping for blog posts (e.g., "Tutorials," "Changelog," "News").                                          |
| **Announcement**      | A platform-wide notice displayed to all users (e.g., maintenance window, new feature).                        |

---

## Networking & Security Features

| Term                  | Definition                                                                                                   |
|-----------------------|---------------------------------------------------------------------------------------------------------------|
| **Firewall Rule**     | A per-server inbound traffic rule specifying protocol, port, source CIDR, and action (ALLOW/DENY).            |
| **Firewall Group**    | A named collection of firewall rules that can be applied to multiple servers (deferred).                      |
| **DNS Record**         | A forward DNS entry (A, AAAA, CNAME, MX, TXT) for a server's domain.                                        |
| **DNS Zone**           | A logical grouping of DNS records for a domain (deferred — MVP uses per-server records).                     |
| **Reverse DNS (PTR)**  | A DNS record mapping an IP address back to a hostname.                                                        |

---

## Data Management

| Term                  | Definition                                                                                                   |
|-----------------------|---------------------------------------------------------------------------------------------------------------|
| **Backup**            | A point-in-time snapshot of a server's data volume, stored for disaster recovery.                             |
| **Backup Schedule**   | A configuration defining how often automated backups run and how long they are retained.                      |
| **GDPR Request**      | A formal request from a customer to export or delete all their personal data.                                 |
| **Referral**          | A record of a user referring another user. Both parties receive credits on the referee's first payment.       |
| **Referral Payout**   | A withdrawal of accumulated referral credits once the threshold is met.                                       |
| **VpsTag**            | A user-defined label applied to a server for organization and filtering.                                      |
| **IpAddress**          | A record representing a single public IP in a node's IP pool. Tracks whether the IP is FREE or allocated to a specific server. |

---

## Async Processing

| Term                  | Definition                                                                                                   |
|-----------------------|---------------------------------------------------------------------------------------------------------------|
| **Job**               | A unit of work enqueued in BullMQ for async processing (provision, start, stop, delete, backup, notify).     |
| **Queue**             | A named, ordered list of jobs backed by Redis.                                                                |
| **Worker**            | A separate Node.js process that dequeues and executes jobs from BullMQ queues.                               |
| **Idempotency**       | The property that running a job N times produces the same final state as running it once.                    |
| **Idempotency Guard** | Code at the start of every job handler that queries Docker for real-world state before acting.               |
| **Dead-Letter Queue** | Holds jobs that have exhausted all retry attempts. Requires admin investigation.                             |

---

## Database & State

| Term                  | Definition                                                                                                   |
|-----------------------|---------------------------------------------------------------------------------------------------------------|
| **Atomic Reservation**| Reserving Node resources (CPU, RAM, disk) AND a public IP address using conditional UPDATEs that only succeed if sufficient free resources exist. All reservations happen in a single DB transaction. |
| **Soft Delete**       | Marking a record as deleted (`deletedAt` timestamp) without removing it from the database.                   |
| **Dual-Write Boundary**| The gap between PostgreSQL and Docker that cannot share a transaction. Coordinated via idempotency.          |
| **Audit Log**          | An immutable, append-only record of every state-changing operation.                                          |

---

## System Configuration

| Term                  | Definition                                                                                                   |
|-----------------------|---------------------------------------------------------------------------------------------------------------|
| **System Setting**    | A key-value configuration entry stored in the database. Typed, validated, and admin-managed.                 |
| **Email Template**    | A configurable HTML/text template for transactional emails. Supports variable substitution.                  |
| **Tax Rate**          | A percentage tax applied to charges based on the customer's billing region.                                  |
| **Rate Card**         | A custom pricing tier assigned to specific customers, overriding default plan pricing (deferred).            |

---

## Infrastructure & Networking

| Term                  | Definition                                                                                                   |
|-----------------------|---------------------------------------------------------------------------------------------------------------|
| **Private Network**   | A virtual network (VLAN) within a single region allowing servers to communicate over private IPs.             |
| **Floating IP**       | A public IP that can be dynamically reassigned between servers in the same region for failover.               |
| **Block Volume**      | Detachable persistent storage (1 GB–16 TB) that can be attached to a server as an additional disk.            |
| **Cloud-init**        | A user-provided shell script (user-data) that runs on first boot, automating server setup.                    |
| **Webhook**           | An HTTP callback to a customer-provided URL, triggered by platform events (server created, backup complete).  |
| **Webhook Delivery**  | A single attempted delivery of a webhook event to an endpoint, with retry status.                            |
| **Bandwidth Allowance**| Monthly outbound data transfer cap per server plan. Overage is billed per GB.                                |
| **Overage**           | Usage beyond the plan's bandwidth allowance, billed at a per-GB rate.                                        |
| **Spending Cap**      | A user-configured monthly spending limit. When reached, new resource creation is blocked.                     |
| **Rescue Mode**       | Booting a broken server from a recovery image to troubleshoot and repair the root filesystem.                |

---

## Developer Tools

| Term                  | Definition                                                                                                   |
|-----------------------|---------------------------------------------------------------------------------------------------------------|
| **CLI Tool**          | A command-line interface (`astral`) for managing servers, volumes, and DNS — consuming the same REST API.     |
| **Terraform Provider**| An infrastructure-as-code provider that lets DevOps engineers declare Astral Cloud resources in HCL.          |
| **API SDK**           | A language-specific client library (Node.js, Python, Go) wrapping the REST API with type-safe interfaces.     |

---

## Observability

| Term                  | Definition                                                                                                   |
|-----------------------|---------------------------------------------------------------------------------------------------------------|
| **Metrics Pipeline**  | Prometheus scrapes application and infrastructure metrics; Grafana dashboards visualize them.                |
| **Structured Logging**| JSON-format logs from all containers, shipped to Loki or Elasticsearch for centralized search and analysis.  |
| **Distributed Tracing**| End-to-end request tracing (API → worker → Docker) using OpenTelemetry, stored in Tempo or Jaeger.          |
| **Alerting**          | Prometheus AlertManager triggers alerts on SLO breaches, resource exhaustion, and dead-letter queue growth.  |
| **SLO**               | Service Level Objective — a quantitative reliability target (e.g., 99.5% API availability).                 |
| **Error Budget**      | The allowed downtime derived from the SLO (e.g., 0.5% = 3.6 hours/month). Exceeding it freezes new features.|
| **Status Page**       | Public-facing page showing current platform status and incident history, auto-updated from health checks.    |

---

## Operational Maturity

| Term                  | Definition                                                                                                   |
|-----------------------|---------------------------------------------------------------------------------------------------------------|
| **Blue-Green Deploy** | Running two identical production stacks; traffic switches after smoke-testing the new one. Zero-downtime.    |
| **Expand-Contract**   | Database migration pattern: add columns → dual-write → migrate → read-new → drop-old. No exclusive locks.   |
| **Runbook**           | A documented step-by-step procedure for handling operational incidents (node failure, payment outage, etc.). |
| **Disaster Recovery** | Quarterly drill: restore the full platform from backups to a clean environment within the RTO.              |
| **Chaos Engineering** | Deliberately killing workers, nodes, or network links to verify idempotency and graceful degradation.        |

---

## Security & Compliance

| Term                  | Definition                                                                                                   |
|-----------------------|---------------------------------------------------------------------------------------------------------------|
| **gVisor / Firecracker**| Sandboxed container runtimes providing hardware-level isolation between customer workloads. Production only. |
| **WAF**               | Web Application Firewall (ModSecurity) filtering malicious HTTP traffic before it reaches the application.    |
| **Audit Hash Chain**  | Each AuditLog entry includes `SHA256(prev_hash || current_data)`, making tampering detectable.               |
| **Cosign**            | Container image signing tool — images are signed before push and verified before pull by the worker.         |
| **Penetration Test**  | Third-party security assessment conducted before customer onboarding. Critical/high findings must be fixed.  |
| **Terms Acceptance**  | Versioned acceptance of Terms of Service and Privacy Policy. Users re-accept when terms are updated.         |
| **Cookie Consent**    | EU-compliant cookie banner storing consent preferences. Essential cookies (auth) do not require consent.     |
| **DMCA Takedown**     | Process for handling copyright infringement complaints against hosted content. 48-hour response window.     |
| **DPA**               | Data Processing Agreement — a legal document for business customers defining how their data is handled.      |
| **Impersonation**     | Admin ability to log in as any user for debugging, with full audit trail and visual indicator.               |
| **Feature Flag**      | A server-side toggle enabling/disabling features per-user, per-role, or by percentage rollout.              |
| **Revenue Dashboard** | Admin analytics: MRR, churn, conversion rates, voucher redemption, server counts by plan.                   |

---

## Conventions

1. **Entity names**: `ServerInstance` (not "VPS"), `ServerPlan` (not "plan"), `Node` (not "host").
2. **Status values**: SCREAMING_CASE — `ACTIVE`, `STOPPED`, `CREATING`, `ERROR`, `DELETED`.
3. **Business rules**: Referenced by ID — "per BR-06," not "per the server limit rule."
4. **API endpoints**: Written as `METHOD /path` — `POST /api/servers`, `GET /api/servers/:serverId`.
5. **Runtime operations**: "create/remove" for Docker containers. "Start/stop/restart" for lifecycle actions. "Provision" for the end-to-end process.

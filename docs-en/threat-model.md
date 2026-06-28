# Threat Model — Astral Cloud Platform

This document analyzes security threats to the Astral Cloud platform using the **STRIDE** methodology. Threats are organized by system component and each includes a severity rating and mitigation strategy.

---

## Methodology

**STRIDE** categorizes threats by what the attacker aims to do:

| Category             | Property Violated     |
|----------------------|-----------------------|
| Spoofing             | Authentication        |
| Tampering            | Integrity             |
| Repudiation          | Non-repudiation       |
| Information Disclosure | Confidentiality     |
| Denial of Service    | Availability          |
| Elevation of Privilege | Authorization       |

**Severity** definitions for this platform:

| Severity  | Meaning                                                      |
|-----------|--------------------------------------------------------------|
| Critical  | Direct customer data breach, financial loss, or platform takeover |
| High      | Significant exposure or disruption, may affect multiple users    |
| Medium    | Limited exposure, single-user impact, or requires chained exploits |
| Low       | Minimal impact, defense-in-depth issue, or accepted risk         |

**Mitigation tags:** `[MVP]` — must be in place for first release. `*post-MVP*` — planned for later.

---

## 1. Web Application (Next.js)

### T-01 — Credential Brute-Force

| Attribute      | Value |
|----------------|-------|
| **Category**   | Spoofing |
| **Severity**   | High |
| **Mitigation** | Account lockout after 5 consecutive failures within a 10-minute window; 15-minute lockout duration ([BR-23]). Per-IP and per-account rate limiting on `/api/auth/login` and all credential-based endpoints. Failed attempt counters stored in Redis with sliding window. Generic error messages prevent username enumeration. [MVP] |

### T-02 — JWT Token Forgery

| Attribute      | Value |
|----------------|-------|
| **Category**   | Spoofing |
| **Severity**   | Critical |
| **Mitigation** | JWTs signed with HS256 using a secret of at least 256 bits (32 random bytes). Short-lived access tokens (15 minutes) with refresh token rotation. Refresh tokens hashed before DB storage (via Session.refreshTokenHash). NextAuth.js v5 enforces signature verification on every request. JWT secret stored exclusively in environment variables, never in code or config files. [MVP] |

### T-03 — Cross-Site Request Forgery (CSRF)

| Attribute      | Value |
|----------------|-------|
| **Category**   | Tampering |
| **Severity**   | Medium |
| **Mitigation** | NextAuth.js v5 provides built-in CSRF protection for auth routes. Session cookies set with `SameSite=Strict`. All state-mutation API routes require `Authorization: Bearer <token>` header — no cookie-based session for API mutations. SameSite + Bearer tokens together prevent CSRF on both browser and API surfaces. [MVP] |

### T-04 — SQL Injection / Cross-Site Scripting (XSS)

| Attribute      | Value |
|----------------|-------|
| **Category**   | Tampering |
| **Severity**   | Critical |
| **Mitigation** | All API inputs validated with Zod schemas before processing (strict types, length limits, format validation). Prisma generates parameterized queries — no raw SQL concatenation. React automatically escapes output (no `dangerouslySetInnerHTML` without sanitization). `Content-Security-Policy` header restricts script sources and disallows inline scripts. Markdown rendered through a safe library (e.g., remark) with HTML pass-through disabled. [MVP] |

### T-05 — Idempotency-Key Replay

| Attribute      | Value |
|----------------|-------|
| **Category**   | Tampering |
| **Severity**   | High |
| **Mitigation** | Idempotency keys scoped per-user (key is `userId + key` composite). Keys stored in Redis with 24-hour TTL. Server checks Redis before processing: if key exists with a recorded response, the duplicate is rejected with 409 Conflict. First request atomically sets the key via `SET NX`. This prevents cross-user replay and limits the window for malicious reuse to the same user within TTL. [MVP] |

### T-06 — User Enumeration via Login/Register Errors

| Attribute      | Value |
|----------------|-------|
| **Category**   | Information Disclosure |
| **Severity**   | Medium |
| **Mitigation** | Generic error messages on all auth endpoints: "Invalid credentials" regardless of whether the email/username exists, and "If an account with that email exists, a verification link has been sent" for registration. Rate limiting on login/register endpoints further inhibits enumeration by timing analysis. [MVP] |

### T-07 — Secrets in Code or Logs

| Attribute      | Value |
|----------------|-------|
| **Category**   | Information Disclosure |
| **Severity**   | Critical |
| **Mitigation** | All secrets (JWT secret, database passwords, Stripe keys, Docker credentials, email API keys) stored exclusively in environment variables. `.env` files gitignored; only `.env.example` with placeholder values committed. Structured logging (JSON) with field-level redaction: any field matching known secret key patterns or containing `password`, `secret`, `token`, `key` is replaced with `[REDACTED]`. Pre-commit hooks scan for secrets via tooling. [MVP] |

### T-08 — Server Data Leakage Between Customers

| Attribute      | Value |
|----------------|-------|
| **Category**   | Information Disclosure |
| **Severity**   | Critical |
| **Mitigation** | Every database query scoped by `userId` extracted from the verified JWT — the `userId` is never accepted from the request body or URL parameters. Service-level functions receive `userId` as a trusted parameter from the auth middleware. Row-Level Security (RLS) can be layered *post-MVP*. API routes for server operations (start, stop, delete, view) check that `server.userId === session.userId` before proceeding. [MVP] |

### T-09 — API Resource Exhaustion (DoS)

| Attribute      | Value |
|----------------|-------|
| **Category**   | Denial of Service |
| **Severity**   | High |
| **Mitigation** | Rate limiting per endpoint class via Redis counters: auth endpoints (5/min per IP), standard API (60/min per user), expensive operations like server creation (10/min per user). Rate limit headers returned on all responses. Connection timeouts set on all external calls (Stripe, Docker, SMTP). Next.js server configured with reasonable body size limits (e.g., 1 MB for JSON, 5 MB for file uploads). [MVP] |

### T-10 — Server Creation Spam

| Attribute      | Value |
|----------------|-------|
| **Category**   | Denial of Service |
| **Severity**   | Medium |
| **Mitigation** | Active server limit of 5 per customer ([BR-06]) acts as a hard cap. Server creation endpoint rate-limited (10/min per user). Balance check enforced before creation ([BR-27]) — insufficient balance prevents creation. Combined, these prevent a single user from exhausting node resources even at maximum creation rate. [MVP] |

### T-11 — Horizontal Privilege Escalation

| Attribute      | Value |
|----------------|-------|
| **Category**   | Elevation of Privilege |
| **Severity**   | Critical |
| **Mitigation** | Ownership check on every server operation: the server's `userId` must match the authenticated user's `userId` from the JWT. This check is performed at the service layer, not the client. API routes do not accept `userId` or `serverId` from the client for owner-scoped operations — the server ID comes from the URL parameter and the user ID from the JWT; both are verified to match. [MVP] |

### T-12 — Vertical Privilege Escalation

| Attribute      | Value |
|----------------|-------|
| **Category**   | Elevation of Privilege |
| **Severity**   | Critical |
| **Mitigation** | JWT role (`CUSTOMER`, `STAFF`, `ADMIN`) verified by middleware on all admin-scoped routes. Admin API routes (`/api/admin/*`) require the `ADMIN` role. Staff routes require `STAFF` or `ADMIN`. Middleware rejects with 403 before any handler executes. Server-side re-verification of role for sensitive operations (user suspension, plan modification, node management) even within admin routes. [MVP] |

### T-13 — JWT Role Tampering

| Attribute      | Value |
|----------------|-------|
| **Category**   | Elevation of Privilege |
| **Severity**   | Critical |
| **Mitigation** | JWT signature verified by NextAuth.js v5 on every request — tampered tokens are rejected before reaching application code. Role embedded in the JWT payload during session creation, derived from the database `User.role` at that moment. For sensitive operations (admin panel access, user impersonation, system setting changes), the role is re-verified against the database in addition to the JWT check. Refresh token rotation ensures that even if a token is compromised, its window of abuse is limited. [MVP] |

### T-14 — 2FA Bypass

| Attribute      | Value |
|----------------|-------|
| **Category**   | Spoofing |
| **Severity**   | High |
| **Mitigation** | 2FA (TOTP) enforced for all ADMIN accounts ([BR-24]). TOTP secrets encrypted at rest using AES-256-GCM with a key derived from an environment variable — not stored in plaintext in the TwoFactorAuth table. Backup codes hashed with bcrypt before storage. 2FA verification required on every new session creation, not just on login. Rate limiting on TOTP verification attempts (5 attempts per 15 minutes). Session not elevated to authenticated state until 2FA code is verified. [MVP] |

### T-15 — Password Reset Token Abuse

| Attribute      | Value |
|----------------|-------|
| **Category**   | Spoofing |
| **Severity**   | High |
| **Mitigation** | Password reset tokens are cryptographically random (32 bytes, hex-encoded), stored hashed in Redis with a short TTL (15 minutes). Tokens are single-use: verified tokens are immediately invalidated. Rate limiting on password reset request endpoint (3 per hour per email). Reset link emailed, never returned in API response. Token not tied to any persistent storage — validation is stateless via hash comparison. [MVP] |

### T-16 — File Upload Abuse (Blog Cover Images)

| Attribute      | Value |
|----------------|-------|
| **Category**   | Tampering |
| **Severity**   | Medium |
| **Mitigation** | File type validation via magic bytes (not extension) — only `image/jpeg`, `image/png`, `image/webp` accepted. Maximum file size of 5 MB enforced at the API layer before processing. Uploaded files stored in object storage (not served from the application server). Content-Disposition set to `attachment` for untrusted paths. Virus scanning of uploaded files *post-MVP*. [MVP] |

---

## 2. BullMQ Worker

### T-17 — Malicious Job Injection

| Attribute      | Value |
|----------------|-------|
| **Category**   | Tampering |
| **Severity**   | Critical |
| **Mitigation** | Redis instance not exposed externally — bound to internal Docker network only (no port mapping to host). BullMQ job data validated against Zod schemas in the worker before any action is taken. Jobs are enqueued exclusively by the web application (trusted side), never directly by external clients. Redis password-protected in production (`requirepass`). [MVP] |

### T-18 — Job Queue Flooding

| Attribute      | Value |
|----------------|-------|
| **Category**   | Denial of Service |
| **Severity**   | Medium |
| **Mitigation** | Concurrency limits per job type configured in BullMQ (e.g., max 3 concurrent provisioning jobs, max 5 concurrent notification jobs). Job prioritization ensures critical jobs (provisioning, billing) are processed before lower-priority jobs. API rate limiting on the web tier prevents excessive enqueuing at the source. BullMQ's built-in stalled job detection and retry with backoff prevents infinite retry loops. [MVP] |

### T-19 — Docker Credentials in Worker Logs

| Attribute      | Value |
|----------------|-------|
| **Category**   | Information Disclosure |
| **Severity**   | High |
| **Mitigation** | Docker API credentials (TLS certs, endpoint URLs) stored in environment variables, never hardcoded. Structured JSON logging with field-level redaction: any log field containing credential patterns is redacted before emission. Worker log level set to `info` in production (not `debug`), suppressing verbose request/response bodies that may contain credentials in transit. [MVP] |

### T-20 — MITM on Docker API Calls

| Attribute      | Value |
|----------------|-------|
| **Category**   | Information Disclosure / Tampering |
| **Severity**   | Critical |
| **Mitigation** | For remote Docker daemons (production nodes), all communication uses TLS (`tcp://node:2376` with TLS verification). Docker TLS certificates (CA, client cert, client key) verified before every connection. For local development, Unix socket (`unix:///var/run/docker.sock`) is used which is not susceptible to network MITM. Certificate verification is never disabled, even in development against local Docker. [MVP] |

---

## 3. Database (PostgreSQL)

### T-21 — Direct External Database Access

| Attribute      | Value |
|----------------|-------|
| **Category**   | Spoofing / Information Disclosure |
| **Severity**   | Critical |
| **Mitigation** | PostgreSQL port (5432) not exposed to the host or external network — bound exclusively to the internal Docker network. Strong, randomly-generated database password stored in environment variables. PostgreSQL configured with `pg_hba.conf` allowing only `md5`/`scram-sha-256` authentication from the internal Docker subnet. No `trust` authentication, even in development. [MVP] |

### T-22 — Unencrypted Data at Rest

| Attribute      | Value |
|----------------|-------|
| **Category**   | Information Disclosure |
| **Severity**   | High |
| **Mitigation** | User passwords hashed with bcrypt (cost factor ≥ 12). Server root passwords encrypted with AES-256-GCM before storage in `ServerInstance.rootPassword`. TOTP secrets encrypted at rest. Payment method data never stored — Stripe tokenization only ([BR-31]). Database-level Transparent Data Encryption (TDE) *post-MVP* for full data-at-rest protection. [MVP] |

### T-23 — Unauthorized Database Modification

| Attribute      | Value |
|----------------|-------|
| **Category**   | Tampering |
| **Severity**   | High |
| **Mitigation** | Scoped database users with minimum required permissions: the web application user has SELECT/INSERT/UPDATE/DELETE on application tables but no DDL permissions (no CREATE/ALTER/DROP). Migration user is separate and only used during deployments. `AuditLog` table uses append-only pattern — application code never issues UPDATE or DELETE against it (enforced by database permissions). Row-Level Security *post-MVP*. [MVP] |

### T-24 — Connection Exhaustion

| Attribute      | Value |
|----------------|-------|
| **Category**   | Denial of Service |
| **Severity**   | Medium |
| **Mitigation** | Prisma configured with a reasonable `connection_limit` (default: `num_cpus * 2 + 1`). Connection pooling via PgBouncer or `pg-pool` in production for connection reuse under load. Idle connection timeout set to prevent dead connections from accumulating. Database connection errors caught at the application layer with exponential backoff retry. [MVP] |

---

## 4. Redis

### T-25 — Unauthenticated Redis Access

| Attribute      | Value |
|----------------|-------|
| **Category**   | Spoofing / Information Disclosure |
| **Severity**   | Critical |
| **Mitigation** | Redis port (6379) not exposed externally — bound to internal Docker network only. `protected-mode yes` enabled to reject connections from non-loopback interfaces unless explicitly configured. `requirepass` set with a strong password in production. No `rename-command` needed since Redis is not externally reachable. [MVP] |

### T-26 — Redis Memory Exhaustion

| Attribute      | Value |
|----------------|-------|
| **Category**   | Denial of Service |
| **Severity**   | Medium |
| **Mitigation** | Redis `maxmemory` policy configured (`maxmemory-policy volatile-lru`) to evict least-recently-used keys with TTL when memory limit is reached. Job payloads kept minimal (only IDs and references, not full entity data). BullMQ completed job retention configured with a TTL (e.g., 24 hours for most job types, 7 days for audit-related jobs). Session and rate-limit keys have TTLs to auto-expire. Memory usage monitored with admin alerts on threshold breach. [MVP] |

---

## 5. Docker Engine (Container Runtime)

### T-27 — Unauthorized Docker API Access

| Attribute      | Value |
|----------------|-------|
| **Category**   | Spoofing / Elevation of Privilege |
| **Severity**   | Critical |
| **Mitigation** | Docker socket (`/var/run/docker.sock`) permissions restricted to the `docker` group only — the worker process runs as a member of this group. In production (separate node hosts), Docker API exposed only over TLS-authenticated TCP (`:2376`), never plaintext (`:2375`). Docker API is never exposed to customers — only the web application and worker interact with it. Firewall rules restrict access to the Docker API port to the platform's internal IP range only. [MVP] |

### T-28 — Container Breakout (Customer A Accesses Customer B's Container)

| Attribute      | Value |
|----------------|-------|
| **Category**   | Information Disclosure / Elevation of Privilege |
| **Severity**   | Critical |
| **Mitigation** | Every Docker container labeled with `serverId` and `userId` at creation time. Worker validates ownership by checking container labels before every lifecycle operation (start, stop, delete): the `userId` from the job payload must match the container's `userId` label. Docker internal bridge network isolates containers from each other — no inter-container routing without explicit network attachment. Container names include `serverId` prefix as additional defense in depth. [MVP] |

### T-29 — Resource Exhaustion on Docker Host

| Attribute      | Value |
|----------------|-------|
| **Category**   | Denial of Service |
| **Severity**   | High |
| **Mitigation** | Atomic resource reservation via conditional UPDATE in PostgreSQL prevents over-allocation ([BR-05]). Docker containers configured with cgroup resource limits: `--cpus` for CPU, `--memory` for RAM, and volume size limits for disk. These limits are set from the plan specs during container creation, preventing any single container from consuming more than allocated. Node resource usage monitored; admin alerts triggered when utilization exceeds 80%. [MVP] |

### T-30 — Docker API Request Tampering

| Attribute      | Value |
|----------------|-------|
| **Category**   | Tampering |
| **Severity**   | High |
| **Mitigation** | TLS with certificate verification for all remote Docker API calls. All parameters sent to Docker API validated against Zod schemas before dispatch (container config, resource limits, environment variables). Worker uses the typed `ContainerRuntime` interface — all calls go through a single, validated client. No raw Docker API calls outside the runtime adapter. [MVP] |

### T-31 — Malicious Container Image

| Attribute      | Value |
|----------------|-------|
| **Category**   | Tampering |
| **Severity**   | High |
| **Mitigation** | Customers cannot upload custom container images — only admin-curated `ImageTemplate` records are available for server creation. Image references point to a controlled container registry (`registry.astral.cloud`). Admin review and approval required before an image is made available to customers. Image signature verification (Docker Content Trust / Notary) *post-MVP* to cryptographically verify image integrity at pull time. [MVP] |

### T-32 — Container Escape / Kernel Exploit

| Attribute      | Value |
|----------------|-------|
| **Category**   | Elevation of Privilege |
| **Severity**   | Critical |
| **Mitigation** | Containers share the host kernel — this is an **accepted risk** for the MVP learning project. Standard Docker security practices applied: containers run as non-root user where possible (via `USER` directive in curated images), capabilities dropped (`--cap-drop=ALL`, `--cap-add` only what's needed), no privileged mode, read-only root filesystem where feasible, seccomp and AppArmor profiles applied. For production: gVisor (user-space kernel) or Firecracker (microVM) for hardware-level isolation between customer workloads. *post-MVP* |

---

## 6. Stripe (Payment Gateway)

### T-33 — Payment Webhook Spoofing

| Attribute      | Value |
|----------------|-------|
| **Category**   | Spoofing / Tampering |
| **Severity**   | Critical |
| **Mitigation** | Stripe webhook signature verified on every incoming webhook request using the webhook signing secret (stored as environment variable). Signature verification uses Stripe's official library (`stripe.webhooks.constructEvent`) which cryptographically validates the payload against the secret. Webhooks received without valid signatures are rejected with 400 and logged for investigation. Stripe webhook endpoint secret is environment-specific (different for dev/test/prod). [MVP] |

### T-34 — Payment Amount Tampering

| Attribute      | Value |
|----------------|-------|
| **Category**   | Tampering |
| **Severity**   | Critical |
| **Mitigation** | Payment amounts verified server-side from the database, never accepted from the client. For top-ups: the amount is validated against allowed preset values (not arbitrary). For billing charges: the amount is calculated server-side from the server plan price and billing period. The Stripe PaymentIntent is created server-side with the verified amount before the client sees it. Client only provides a PaymentMethod ID — the amount is immutable from the client's perspective. [MVP] |

### T-35 — Stored Payment Method Theft

| Attribute      | Value |
|----------------|-------|
| **Category**   | Information Disclosure |
| **Severity**   | Critical |
| **Mitigation** | Stripe tokenization used exclusively — raw card numbers, CVCs, and full expiration dates are never transmitted to or stored in Astral Cloud's servers ([BR-31]). Payment methods stored as Stripe `PaymentMethod` objects; Astral Cloud stores only the Stripe PaymentMethod ID, brand, last 4 digits, and expiration month/year in `PaymentMethod`. This minimizes PCI DSS scope to SAQ-A (fully outsourced card data handling). All communication with Stripe uses HTTPS. [MVP] |

### T-36 — Idempotent Payment Replay

| Attribute      | Value |
|----------------|-------|
| **Category**   | Tampering |
| **Severity**   | High |
| **Mitigation** | Stripe idempotency keys used on all PaymentIntent creation and confirmation requests — Stripe guarantees that retrying a request with the same idempotency key returns the original result, not a duplicate charge. Database-level deduplication: `Payment.stripePaymentId` is UNIQUE, preventing duplicate payment records even if a webhook is delivered more than once. Idempotency keys generated server-side as `payment_<userId>_<timestamp>_<random>`. [MVP] |

---

## 7. Email / Notifications

### T-37 — Email Template Injection

| Attribute      | Value |
|----------------|-------|
| **Category**   | Tampering |
| **Severity**   | Medium |
| **Mitigation** | Email templates use context-sensitive escaping for all template variables — no raw HTML from user input is interpolated without escaping. Template variables are predefined per template (listed in `EmailTemplate.variables`) and only those variables are accepted; unknown variables are rejected. Email subject lines also escaped. Email bodies rendered server-side with a template engine that auto-escapes HTML by default (e.g., Handlebars with `noEscape` disabled, or Nunjucks with autoescaping). [MVP] |

### T-38 — Email Spoofing (Sending as Astral Cloud)

| Attribute      | Value |
|----------------|-------|
| **Category**   | Spoofing |
| **Severity**   | Medium |
| **Mitigation** | SPF record configured on the sending domain (`astral.cloud`) to authorize only the email service provider's (SendGrid) sending IPs. DKIM signing enabled on all outgoing emails via the email provider. DMARC policy set to `p=reject` to instruct receiving mail servers to reject unauthenticated emails. Custom domain verified with the email provider to prevent unauthorized use. [MVP] |

---

## 8. Communication Channels

### T-39 — Inter-Container Data Exposure

| Attribute      | Value |
|----------------|-------|
| **Category**   | Information Disclosure |
| **Severity**   | High |
| **Mitigation** | All containers (platform and customer) connected via Docker internal bridge network. No external routing between customer containers — each container has its own network namespace. Customer containers cannot address each other by default (no shared user-defined network). Platform containers (web, worker, postgres, redis) on a separate internal network from customer containers. Firewall rules configured per container via Docker network policies. [MVP] |

### T-40 — TLS Certificate Issues on Public Endpoint

| Attribute      | Value |
|----------------|-------|
| **Category**   | Spoofing / Information Disclosure |
| **Severity**   | Critical |
| **Mitigation** | Nginx reverse proxy terminates TLS with certificates from Let's Encrypt (auto-renewed via certbot). HTTP Strict Transport Security (HSTS) header set with `max-age=31536000; includeSubDomains; preload`. All HTTP requests redirected to HTTPS (301). TLS configured with modern cipher suites only (TLS 1.2 minimum, TLS 1.3 preferred). Certificate transparency monitoring enabled. [MVP] |

---

## 9. GDPR / Data Privacy

### T-41 — Incomplete Data Export

| Attribute      | Value |
|----------------|-------|
| **Category**   | Repudiation |
| **Severity**   | Medium |
| **Mitigation** | GDPR data export includes all user-related tables: User, Session, ApiKey, SSHKey, ServerInstance, Payment, Invoice, Ticket, TicketMessage, Notification, Referral, VoucherUsage, TwoFactorAuth, GdprRequest. Export generation is verified by an automated test that ensures all user-scoped tables are covered. Export format is machine-readable JSON. Download link expires after 7 days and requires re-authentication. [MVP] |

### T-42 — Data Retention After Deletion

| Attribute      | Value |
|----------------|-------|
| **Category**   | Information Disclosure |
| **Severity**   | Medium |
| **Mitigation** | Account deletion is a soft-delete first (`User.deletedAt` set), followed by hard-delete of all personal data after 30 days ([BR-63]). AuditLog entries are anonymized (userId set to NULL, IP truncated to `/24` subnet) rather than deleted to preserve audit trail integrity. Automated cleanup job runs daily to process accounts past the 30-day retention window. Server records are likewise soft-deleted and hard-deleted after the retention period. [MVP] |

### T-43 — Unauthorized GDPR Request

| Attribute      | Value |
|----------------|-------|
| **Category**   | Spoofing |
| **Severity**   | High |
| **Mitigation** | GDPR requests (data export, account deletion) require authentication — the user must be logged in. Additionally, the user must re-verify their password before the request is created. This prevents an attacker with a stolen but unexpired session from initiating GDPR actions. `GdprRequest` records are linked to `userId` and only visible to that user and admin staff. [MVP] |

---

## 10. Voucher / Coupon System

### T-44 — Voucher Brute-Force Guessing

| Attribute      | Value |
|----------------|-------|
| **Category**   | Spoofing |
| **Severity**   | Medium |
| **Mitigation** | Rate limiting on the voucher validation/redemption endpoint (10 attempts per minute per IP, 30 per hour per user). Voucher codes are randomly generated (cryptographically random, not sequential — e.g., 16-character alphanumeric), making them unguessable. Failed redemption attempts logged for abuse detection. Valid voucher codes are never disclosed in client-side code or public pages. [MVP] |

### T-45 — Voucher Abuse (Multiple Accounts)

| Attribute      | Value |
|----------------|-------|
| **Category**   | Tampering |
| **Severity**   | Medium |
| **Mitigation** | Per-user redemption limit enforced at the database level (`VoucherUsage` uniqueness on `voucherId + userId`, [BR-36]). IP and browser fingerprint tracking for cross-account abuse detection ([BR-57]). Manual admin review of voucher redemption patterns for suspicious activity. Voucher usage dashboard for admins to monitor redemption velocity and detect anomalies. [MVP] |

---

## 11. Referral System

### T-46 — Self-Referral Fraud

| Attribute      | Value |
|----------------|-------|
| **Category**   | Tampering |
| **Severity**   | Medium |
| **Mitigation** | A user's own referral code is rejected at registration ([BR-57]). IP address and browser fingerprint check: if the referrer and referee share the same IP and fingerprint within a short time window, the referral is flagged for manual review. Same payment method check: if referrer and referee use the same Stripe PaymentMethod ID, the referral is invalidated. Referral credits are reversible by admin for confirmed fraud. [MVP] |

### T-47 — Referral Farming (Fake Accounts)

| Attribute      | Value |
|----------------|-------|
| **Category**   | Tampering |
| **Severity**   | Medium |
| **Mitigation** | Referral credits are issued only when the referred user makes their first real-money payment (top-up), not at sign-up ([BR-55]). Payouts (withdrawals of referral credits) have a minimum threshold (default $50, [BR-56]), requiring substantial legitimate activity. Rate of referral code usage per referrer is monitored; anomalous spikes trigger admin review. Accounts created solely for referral abuse are subject to suspension. [MVP] |

---

## 12. Blog / Content

### T-48 — XSS in Blog Content

| Attribute      | Value |
|----------------|-------|
| **Category**   | Tampering |
| **Severity**   | Medium |
| **Mitigation** | Blog post bodies stored as Markdown, rendered with a safe Markdown library (e.g., `remark` / `rehype`) that sanitizes HTML output — no raw HTML passthrough. `Content-Security-Policy` header restricts script execution sources. React's built-in escaping prevents XSS in blog titles, excerpts, and metadata. Any user-submitted content in blog comments (if implemented) is sanitized before rendering. [MVP] |

### T-49 — Unauthorized Blog Publishing

| Attribute      | Value |
|----------------|-------|
| **Category**   | Elevation of Privilege |
| **Severity**   | Low |
| **Mitigation** | Only STAFF and ADMIN users can create, publish, or modify blog posts ([BR-45]). Role verification at the API route level: `POST/PUT /api/blog` requires `STAFF` or `ADMIN` role in the JWT. The `authorId` on `BlogPost` is set server-side from the authenticated user, not from client input. Draft posts are visible only to the author and admin users. [MVP] |

---

## 13. Additional Production Components

### 13.1 Private Networking

### T-52 — VLAN Hopping

| Attribute      | Value |
|----------------|-------|
| **Category**   | Information Disclosure / Elevation of Privilege |
| **Severity**   | High |
| **Mitigation** | Docker network isolation and network policy enforcement at the bridge level. Customer containers are attached to their own private networks only — no shared user-defined networks between customers. Container network namespace is isolated; kernel-level network policies (iptables/nftables rules applied at Docker bridge) prevent cross-network traffic. Container labels and network attachment verified by the worker before any network operation. [MVP] |

### T-53 — CIDR Overlap Attack

| Attribute      | Value |
|----------------|-------|
| **Category**   | Tampering |
| **Severity**   | High |
| **Mitigation** | Customer-configured CIDR ranges validated server-side before private network creation. CIDR must not overlap with reserved ranges: node management network, Docker bridge subnet (`172.17.0.0/16`), internal platform service network. Validation rejects any CIDR that falls within or contains a reserved range. Overlap check performed with an allowlist of permitted private ranges (RFC 1918). [MVP] |

### 13.2 Floating IPs

### T-54 — Floating IP Hijacking

| Attribute      | Value |
|----------------|-------|
| **Category**   | Spoofing / Tampering |
| **Severity**   | Critical |
| **Mitigation** | Floating IP assignment uses an atomic conditional UPDATE in PostgreSQL: `UPDATE "FloatingIp" SET "serverId" = $1 WHERE id = $2 AND "serverId" IS NULL` — the query returns zero rows if the IP is already assigned. Ownership validation: the target server's `userId` must match the authenticated user. Floating IP reassignment requires explicit unassignment first. IP-to-server mapping verified by the worker before applying the NAT/routing rule. [MVP] |

### 13.3 Block Volumes

### T-55 — Cross-Customer Volume Access

| Attribute      | Value |
|----------------|-------|
| **Category**   | Information Disclosure |
| **Severity**   | Critical |
| **Mitigation** | Ownership check on both volume and target server before attach: the volume's `userId` and server's `userId` must match the authenticated user. `Volume.serverId` has a UNIQUE constraint — a volume can only be attached to one server at a time, preventing simultaneous cross-customer access. The worker re-verifies ownership labels on the Docker volume before performing the bind mount. Volume attach/detach operations are logged to AuditLog. [MVP] |

### T-56 — Volume Data Remnant

| Attribute      | Value |
|----------------|-------|
| **Category**   | Information Disclosure |
| **Severity**   | Medium |
| **Mitigation** | Docker volumes are encrypted at rest *post-MVP* using LUKS/dm-crypt on the underlying block storage, ensuring data is unreadable without the encryption key even if physical storage is reused by another customer. Secure wipe (overwrite with zeros or random data, followed by `blkdiscard` on SSD) on volume delete *post-MVP*. For MVP: volumes are logically scoped by Docker volume namespace and deleted with `docker volume rm`, which removes the volume data from the host filesystem. Risk of filesystem-level data remnant accepted for MVP. [MVP] |

### 13.4 Cloud-Init

### T-57 — Malicious Cloud-Init Script

| Attribute      | Value |
|----------------|-------|
| **Category**   | Elevation of Privilege |
| **Severity**   | High |
| **Mitigation** | Cloud-init script runs exclusively inside the customer's container (passed as a bind-mounted file or environment variable), never executed on the host. Container resource limits enforced by cgroups (`--cpus`, `--memory`) — the script cannot exhaust host resources. Script size validated: maximum 64 KB. Script content validated at API submission time to reject binary or non-text content. Container runs with `--cap-drop=ALL` and no privileged mode, so even a malicious script cannot escape to the host. [MVP] |

### 13.5 Webhooks

### T-58 — Webhook SSRF

| Attribute      | Value |
|----------------|-------|
| **Category**   | Information Disclosure / Elevation of Privilege |
| **Severity**   | High |
| **Mitigation** | Webhook URL validated before delivery: reject URLs resolving to private IP ranges (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, link-local 169.254.0.0/16), localhost, or Docker-internal subnets. DNS resolution performed server-side and the resolved address checked against the deny-list before the HTTP request is made. DNS rebinding protection: after initial resolution, subsequent redirects from the target are also validated against the internal IP deny-list. Webhook delivery runs from an isolated network context with no access to internal services. [MVP] |

### T-59 — Webhook Secret Brute-Force

| Attribute      | Value |
|----------------|-------|
| **Category**   | Spoofing |
| **Severity**   | Medium |
| **Mitigation** | Webhook HMAC secrets are cryptographically random 64-character strings (384 bits of entropy), making brute-force computationally infeasible. Rate limiting on webhook delivery attempt inspection endpoints: 30 requests per minute per user to prevent an attacker from testing guessed secrets by observing delivery behavior. Failed signature verification events logged and monitored for anomalous patterns (e.g., repeated incorrect signatures from the same IP). [MVP] |

### 13.6 CLI / Terraform

### T-60 — API Key Theft from CLI Config

| Attribute      | Value |
|----------------|-------|
| **Category**   | Information Disclosure |
| **Severity**   | Medium |
| **Mitigation** | CLI configuration file (`~/.astral/config.json`) created with restrictive file permissions (0600 — owner read/write only). CLI emits a warning on startup if the config file is world-readable or group-readable, with instructions to run `chmod 600 ~/.astral/config.json`. Optional: encryption of the API key at rest using the OS keychain (macOS Keychain, freedesktop Secret Service, Windows Credential Manager) *post-MVP*. CLI documentation advises against sharing config files and recommends environment variable (`ASTRAL_API_KEY`) as an alternative. [MVP] |

### T-61 — Terraform State Contains Secrets

| Attribute      | Value |
|----------------|-------|
| **Category**   | Information Disclosure |
| **Severity**   | High |
| **Mitigation** | Sensitive fields in the Terraform provider schema marked with `Sensitive: true` — Terraform redacts these values from console output and warns if they appear in plan diffs. `rootPassword` is excluded from the server resource output entirely (no computed attribute for it). Provider documentation instructs users to use remote state backends (S3, Terraform Cloud, GCS) with encryption at rest and access controls, never committing `.tfstate` to version control. `terraform.tfstate` and `*.tfstate` patterns added to `.gitignore` in example projects. [MVP] |

### 13.7 Observability

### T-62 — Sensitive Data in Logs

| Attribute      | Value |
|----------------|-------|
| **Category**   | Information Disclosure |
| **Severity**   | High |
| **Mitigation** | Field-level redaction in structured logging middleware: any log field whose key matches a sensitive pattern (`password`, `secret`, `token`, `key`, `credit`, `cvv`, `ssn`, `card`) or whose value matches a regex for common secret formats is replaced with `[REDACTED]`. Automated tests in CI verify that no sensitive patterns appear in sample log output — a test suite replays known requests through the logging pipeline and asserts zero matches on a denylist of secret patterns. Log aggregation pipeline (e.g., Loki/Fluentd) *post-MVP* also performs server-side redaction as defense-in-depth. [MVP] |

### T-63 — Metrics Endpoint Exposed Publicly

| Attribute      | Value |
|----------------|-------|
| **Category**   | Information Disclosure |
| **Severity**   | Medium |
| **Mitigation** | The `/metrics` endpoint (Prometheus scrape target) is bound to the internal Docker network interface only — not exposed through the Nginx reverse proxy or to the public internet. Nginx configuration explicitly does not proxy `/metrics`. For production environments where metrics need to be scraped by an external monitoring service: basic auth protects the endpoint with a strong, randomly-generated credential. No internal hostnames, IP addresses, or infrastructure details are included in metric labels. [MVP] |

### 13.8 Operational Maturity

### T-64 — Database Migration Locks Production

| Attribute      | Value |
|----------------|-------|
| **Category**   | Denial of Service |
| **Severity**   | High |
| **Mitigation** | CI pipeline rejects any migration containing `ALTER TABLE ... ADD COLUMN ... NOT NULL` without a `DEFAULT` value — this pattern acquires an `ACCESS EXCLUSIVE` lock and rewrites the entire table. The expand-contract pattern is enforced by code review: (1) add column with a default (instant), (2) backfill any needed data, (3) add the `NOT NULL` constraint in a later migration. Migration linter (e.g., `pgroll` or custom script) runs as a pre-merge check. Long-running migrations flagged by CI with a warning comment on the PR. [MVP] |

### T-65 — Blue-Green Deployment Data Inconsistency

| Attribute      | Value |
|----------------|-------|
| **Category**   | Tampering |
| **Severity**   | High |
| **Mitigation** | Both Blue and Green deployment environments connect to the same PostgreSQL database — there is no data replication lag or split-brain risk. All database migrations follow the expand-contract pattern: every migration is backward-compatible, meaning the old (Blue) application code can run against the new schema. No destructive changes (column drops, renames) are deployed in the same migration as the code change. The switchover is performed at the Nginx level by updating the upstream target — this is instant and connection-draining ensures in-flight requests complete before the old containers are terminated. [MVP] |

### 13.9 Security Hardening

### T-66 — Container Escape via Kernel Exploit

| Attribute      | Value |
|----------------|-------|
| **Category**   | Elevation of Privilege |
| **Severity**   | Critical |
| **Mitigation** | Production deployments use gVisor (user-space kernel, syscall filtering) or Firecracker (microVM with hardware virtualization) for customer workloads, providing hardware-level or syscall-level isolation from the host kernel. Development environment uses standard Docker containers with seccomp profiles, `--cap-drop=ALL`, no privileged mode, and read-only root filesystems — this weaker isolation is accepted as a documented risk for non-production environments. Kernel security updates are applied to the host within 24 hours of release. Host kernel is a minimal, hardened distribution (e.g., Container-Optimized OS). [MVP] |

### T-67 — Unsigned Container Image Pulled

| Attribute      | Value |
|----------------|-------|
| **Category**   | Tampering |
| **Severity**   | Critical |
| **Mitigation** | Container image signature verification via cosign before every `docker pull`: the worker verifies the image signature against the platform's public key ([BR-102]). Unsigned images or images with invalid signatures are rejected — the pull is aborted and the server provisioning job fails with a logged error. Admin image publishing pipeline automatically signs images upon push to the registry. Signature verification is never skipped, even in development (self-signed dev keys are used). [MVP] |

### T-68 — Audit Log Tampering by Database Admin

| Attribute      | Value |
|----------------|-------|
| **Category**   | Tampering |
| **Severity**   | High |
| **Mitigation** | Cryptographic hash chain across all AuditLog entries ([BR-103]): each new entry includes `hash(previous_entry_hash || current_entry_data)`, creating a tamper-evident chain. Any modification to a past entry invalidates all subsequent hashes, making tampering detectable. An admin audit dashboard periodically verifies the chain integrity end-to-end and alerts on mismatch. The hash chain is stored in the `AuditLog` table alongside each entry. Database-level permissions still enforce append-only access as defense-in-depth. [MVP] |

### 13.10 Compliance

### T-69 — Incomplete GDPR Data Export

| Attribute      | Value |
|----------------|-------|
| **Category**   | Repudiation |
| **Severity**   | Medium |
| **Mitigation** | Automated test suite verifies that all user-related tables are included in the GDPR export function — the test introspects the database schema, enumerates all tables containing a `userId` column, and asserts each is present in the export manifest. The export schema is versioned (`exportSchemaVersion`) and stored alongside each generated export, enabling traceability of which tables were included at the time of export. When new user-scoped tables are added via migration, the test fails until the export function is updated, preventing regressions. [MVP] |

### T-70 — Cookie Set Before Consent

| Attribute      | Value |
|----------------|-------|
| **Category**   | Information Disclosure |
| **Severity**   | Medium |
| **Mitigation** | No non-essential cookies (analytics, marketing, third-party tracking) are set until the user explicitly accepts via the consent banner. Essential cookies (session, CSRF, i18n preference) are set without consent — these are exempt under ePrivacy Directive / GDPR. `Content-Security-Policy` headers with `script-src` restrictions block third-party script loading until consent is recorded and the CSP is updated via a nonce or hash-based approach. Consent status (`consent.analytics`, `consent.marketing`) stored server-side and evaluated before any cookie or script injection. [MVP] |

### T-71 — Terms Acceptance Bypass

| Attribute      | Value |
|----------------|-------|
| **Category**   | Tampering |
| **Severity**   | Medium |
| **Mitigation** | Server-side enforcement: `User.maxServers` defaults to `0` and is only updated to the plan default when `User.termsAcceptedVersion` matches the current terms version. The server creation endpoint checks `maxServers > currentServerCount` — a user who has not accepted terms will have `maxServers = 0` and cannot create servers. Terms version is tracked per-user and must be re-accepted when the terms document is versioned. This check is performed at the API level, not just in the UI, preventing direct API bypass. [MVP] |

### 13.11 Admin Tools

### T-72 — Impersonation Abuse

| Attribute      | Value |
|----------------|-------|
| **Category**   | Repudiation |
| **Severity**   | High |
| **Mitigation** | Every action performed during an impersonation session logs both the admin user ID and the target (impersonated) user ID in the AuditLog — all actions are doubly attributable. A persistent, non-dismissible UI banner is displayed at all times during impersonation to prevent the admin from forgetting they are acting as another user. Impersonation sessions have a short timeout (30 minutes) after which the admin is returned to their own session. Impersonation start and end events are logged as distinct audit entries. The admin audit dashboard surfaces all impersonation sessions for review. [MVP] |

### T-73 — Feature Flag Leak

| Attribute      | Value |
|----------------|-------|
| **Category**   | Information Disclosure / Elevation of Privilege |
| **Severity**   | Medium |
| **Mitigation** | All feature-gated API endpoints check the feature flag server-side in the route handler or middleware — not just in the UI. If the feature flag resolves to `false`, the endpoint returns 404 (Not Found) to avoid leaking the existence of the feature. Feature flag evaluation happens on every request (no caching of "enabled" state per user) to allow real-time flag changes. Regression tests verify that disabled features return 404 for both API and page routes. UI-only hiding (e.g., removing a button) is treated as UX optimization, not a security control. [MVP] |

### 13.12 Abuse & Legal

### T-74 — Automated Abuse Report Spam

| Attribute      | Value |
|----------------|-------|
| **Category**   | Denial of Service |
| **Severity**   | Medium |
| **Mitigation** | Rate limiting on abuse report submission: 5 reports per IP per hour. Authenticated users are subject to a higher limit (10 per hour) but both tiers are enforced. CAPTCHA required on all anonymous (unauthenticated) abuse report submissions to prevent automated bots. Reports from the same IP about the same server within a short window are deduplicated. Admin dashboard surfaces report velocity metrics to detect spam campaigns. [MVP] |

### T-75 — DMCA Counter-Notice Bypass

| Attribute      | Value |
|----------------|-------|
| **Category**   | Repudiation |
| **Severity**   | High |
| **Mitigation** | After a validated abuse report against a server, the server is suspended for 48 hours — the customer must acknowledge the report and confirm content removal before the server can be restarted. After 2 validated abuse reports against the same server (from different reporters), the server is automatically deleted — this prevents indefinite counter-notice loops. All abuse report actions (report received, validation, suspension, deletion) are logged to AuditLog with the server ID and reporting party. Admin override is possible but requires a second admin approval (four-eyes principle). [MVP] |

---

## 14. API Keys

### T-50 — API Key Leakage

| Attribute      | Value |
|----------------|-------|
| **Category**   | Information Disclosure |
| **Severity**   | High |
| **Mitigation** | API keys hashed with SHA-256 before storage in `ApiKey.keyHash` — the full key is never stored in plaintext. Only the first 8 characters are stored in plaintext (`ApiKey.keyPrefix`) for identification in the UI. The full key is shown to the user exactly once at creation time, with a prominent warning to copy it immediately. Users can revoke keys at any time from the dashboard, which invalidates the key by deleting the record. API keys are transmitted only over HTTPS and should be used as `Authorization: Bearer <key>` header. [MVP] |

### T-51 — API Key Brute-Force

| Attribute      | Value |
|----------------|-------|
| **Category**   | Spoofing |
| **Severity**   | Medium |
| **Mitigation** | API key-authenticated requests are subject to the same rate limits as JWT bearer token requests: 60 requests per minute per key ([BR-26]). API keys are 32+ character random strings, providing sufficient entropy (~192 bits) to be computationally infeasible to brute-force. Failed API key authentication attempts are logged and monitored for patterns (e.g., many failures from one IP across different key prefixes). Expired keys are rejected with 401 ([BR-65]). [MVP] |

---

## Risk Acceptance

The following risks are acknowledged and accepted for the MVP release, with rationale:

| Risk                               | Rationale                                                                                                                                                                  |
|------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Redis data loss                    | Redis is used as a cache and job queue, not a primary data store. BullMQ jobs are idempotent by design — replaying a lost job from the database state produces the same result. Session data loss requires re-login (acceptable UX trade-off for MVP). Rate-limit counter loss is a temporary DoS hardening gap. |
| No Web Application Firewall (WAF)  | Rate limiting, input validation (Zod), parameterized queries, and CSP headers provide layered protection sufficient for MVP. WAF can be added in production (Cloudflare, AWS WAF) as a defense-in-depth measure. |
| Self-signed certificates in development | Development environment uses self-signed certificates or plain HTTP on localhost. This is standard practice and does not affect production, where Let's Encrypt provides valid certificates. |
| No database Transparent Data Encryption (TDE) | The highest-value data (passwords, TOTP secrets, root passwords) is encrypted at the application layer (bcrypt, AES-256-GCM). TDE provides defense-in-depth for full database files but is not critical for MVP given application-layer encryption of sensitive fields. |
| No audit log hash chaining         | Audit logs are stored append-only with database-level enforcement, but entries are not cryptographically chained (no Merkle tree / blockchain). Tampering would require database root access, which is already a critical compromise scenario. Hash chaining can be added *post-MVP* for cryptographic non-repudiation. |
| Container kernel sharing           | In MVP, customer containers share the host Linux kernel with each other and with the platform containers. A kernel exploit could allow container escape. This risk is accepted for the learning-project phase. For production, hardware-level isolation via gVisor (user-space kernel) or Firecracker (microVM) is the planned mitigation path. |

# Requirements

All requirements are derived from the use cases (`use-case.md`) and business rules (`business-rules.md`). Each requirement is testable.

---

## Functional Requirements

### FR-AUTH — Authentication & Authorization

| ID            | Requirement                                                      | Source       |
|---------------|------------------------------------------------------------------|--------------|
| FR-AUTH-01    | Visitors can register an account with username, email, and password. | UC-02     |
| FR-AUTH-02    | Registered users can log in with username/email and password.    | UC-03        |
| FR-AUTH-03    | System issues a JWT access token (1 hour) and refresh token (7 days) on successful login. | UC-03 |
| FR-AUTH-04    | System supports token refresh without requiring re-authentication. | UC-03       |
| FR-AUTH-05    | Account locks for 15 minutes after 5 consecutive failed login attempts within 10 minutes. | BR-23, UC-03 |
| FR-AUTH-06    | Username and email must each be unique across the system.        | BR-21        |
| FR-AUTH-07    | Password must be ≥ 8 characters with uppercase, lowercase, and digit. | BR-22    |
| FR-AUTH-08    | System supports optional social login (OAuth2: Google, GitHub).  | UC-02        |
| FR-AUTH-09    | Users can enable TOTP-based 2FA (scan QR code, verify with code). | UC-08       |
| FR-AUTH-10    | 2FA is required for ADMIN accounts.                              | BR-24        |
| FR-AUTH-11    | Users can manage active sessions (view, revoke individual sessions). | UC-03       |
| FR-AUTH-12    | Maximum 5 active sessions per user; 6th invalidates oldest.      | BR-25        |
| FR-AUTH-13    | Users can request password reset via email.                      | Derived      |
| FR-AUTH-14    | Users can verify their email address via token link.             | Derived      |

### FR-APIKEY — API Key Management

| ID            | Requirement                                                      | Source       |
|---------------|------------------------------------------------------------------|--------------|
| FR-APIKEY-01  | Users can create API keys with a custom label.                   | UC-09        |
| FR-APIKEY-02  | System returns the full key only once (on creation).             | UC-09        |
| FR-APIKEY-03  | API keys can be revoked (soft-delete).                           | UC-09        |
| FR-APIKEY-04  | API keys authenticate requests via `Authorization: Bearer <key>` header. | UC-09  |
| FR-APIKEY-05  | API keys inherit the permissions of the creating user.           | BR-64        |
| FR-APIKEY-06  | Optional expiry date on API keys; expired keys rejected with 401.| BR-65        |

### FR-SERVER — Server Lifecycle Management

| ID            | Requirement                                                      | Source       |
|---------------|------------------------------------------------------------------|--------------|
| FR-SERVER-01  | Customer can create a server by selecting a ServerPlan, ImageTemplate, and region. | UC-01 |
| FR-SERVER-02  | Customer can customize vCPU, RAM, and disk when creating a server (bypass ServerPlan). | UC-01 |
| FR-SERVER-03  | Customer can provide an SSH public key for authentication instead of a password. | UC-01 |
| FR-SERVER-04  | Customer can select billing model: MONTHLY or HOURLY.            | UC-01        |
| FR-SERVER-05  | Customer can create a server from a saved snapshot instead of an ImageTemplate. | UC-01 |
| FR-SERVER-06  | System validates server limit (max 5 active, or plan-specific) before creation. | BR-06, UC-01 |
| FR-SERVER-07  | System validates that the image/snapshot disk size ≤ plan disk capacity. | BR-08, UC-01 |
| FR-SERVER-08  | System validates that the selected region is available for the account. | BR-09, UC-01 |
| FR-SERVER-09  | System enforces minimum disk size of 5 GB on all servers.        | BR-10, UC-01 |
| FR-SERVER-10  | System selects a physical node with sufficient free resources before provisioning. | BR-05, UC-01 |
| FR-SERVER-11  | System provisions the Docker container and assigns an IP address. | UC-01       |
| FR-SERVER-12  | Customer can view a paginated list of all their servers with status, IP, plan, and region. | UC-04 |
| FR-SERVER-13  | Customer can filter the server list by status and by tags.       | UC-04        |
| FR-SERVER-14  | Customer can start a server that is in STOPPED state.            | UC-05, BR-13 |
| FR-SERVER-15  | Customer can stop a server that is in RUNNING state (graceful shutdown). | UC-06, BR-14 |
| FR-SERVER-16  | System applies force stop if graceful shutdown exceeds 30 seconds. | UC-06, BR-17 |
| FR-SERVER-17  | Customer can restart a server that is in RUNNING state.          | Derived      |
| FR-SERVER-18  | Customer can delete a server that is in STOPPED state (with confirmation + hostname entry). | UC-07, BR-15 |
| FR-SERVER-19  | On deletion, all resources (vCPU, RAM, disk, IP) are released back to the node. | BR-16, UC-07 |
| FR-SERVER-20  | Customer can view detailed information for a single server.      | UC-04        |
| FR-SERVER-21  | Customer can assign and remove tags on servers.                  | Derived      |
| FR-SERVER-22  | Hostname must be unique per user's account.                      | BR-11        |

### FR-BILL — Billing & Wallet

| ID            | Requirement                                                      | Source       |
|---------------|------------------------------------------------------------------|--------------|
| FR-BILL-01    | System checks wallet balance before creating a server.           | UC-01        |
| FR-BILL-02    | Customer can view current wallet balance.                        | Derived      |
| FR-BILL-03    | Customer can add funds via payment gateway (Stripe).             | UC-10        |
| FR-BILL-04    | System deducts charges automatically based on billing model.     | BR-28        |
| FR-BILL-05    | Customer can view billing history with pagination.               | UC-10        |
| FR-BILL-06    | Customer can download invoices as PDF.                           | UC-10, BR-30 |
| FR-BILL-07    | System enters 24-hour grace period on failed auto-deduction.     | BR-29        |
| FR-BILL-08    | Customer can save, view, and delete payment methods.             | UC-10, BR-31 |
| FR-BILL-09    | System generates an invoice for every charge and top-up.         | BR-30        |
| FR-BILL-10    | Customer can request a refund for unused pre-paid monthly balance. | BR-32       |

### FR-VOUCHER — Voucher / Coupon System

| ID            | Requirement                                                      | Source       |
|---------------|------------------------------------------------------------------|--------------|
| FR-VOUCHER-01 | Customer can apply a voucher code at checkout (top-up or server creation). | UC-11 |
| FR-VOUCHER-02 | System validates voucher: exists, active, within date window, uses remaining. | BR-34, BR-35 |
| FR-VOUCHER-03 | System validates per-user usage limit.                           | BR-36        |
| FR-VOUCHER-04 | System validates minimum spend requirement.                      | BR-37        |
| FR-VOUCHER-05 | Multiple vouchers can be stacked on a single payment.            | BR-38        |
| FR-VOUCHER-06 | Staff/admin can create vouchers (code, type, value, limits).     | UC-21        |
| FR-VOUCHER-07 | Staff/admin can view voucher usage statistics.                   | UC-21        |
| FR-VOUCHER-08 | Staff/admin can deactivate a voucher.                            | UC-21        |

### FR-TICKET — Support Tickets

| ID            | Requirement                                                      | Source       |
|---------------|------------------------------------------------------------------|--------------|
| FR-TICKET-01  | Customer can create a support ticket with subject, category, and message. | UC-12 |
| FR-TICKET-02  | Customer can view all their tickets with status.                 | UC-12        |
| FR-TICKET-03  | Customer and staff can add messages to a ticket thread.          | UC-12        |
| FR-TICKET-04  | Staff can change ticket status through the lifecycle.            | BR-40        |
| FR-TICKET-05  | Customer can close a ticket after resolution.                    | BR-40        |
| FR-TICKET-06  | Customer can reopen a closed ticket within 7 days.               | BR-41        |
| FR-TICKET-07  | Resolved tickets auto-close after 72 hours of customer inactivity. | BR-42       |
| FR-TICKET-08  | Staff can assign tickets to themselves or other staff.           | UC-22        |
| FR-TICKET-09  | Staff can add internal notes (not visible to customer).          | Derived      |
| FR-TICKET-10  | Staff can filter and search tickets by status, priority, category, assignee. | UC-22 |

### FR-BACKUP — Server Backups

| ID            | Requirement                                                      | Source       |
|---------------|------------------------------------------------------------------|--------------|
| FR-BACKUP-01  | Customer can create a manual backup of a server.                 | UC-13        |
| FR-BACKUP-02  | Customer can view backup history per server.                     | UC-13        |
| FR-BACKUP-03  | Customer can restore a server from a specific backup.            | UC-13        |
| FR-BACKUP-04  | Customer can delete individual backups.                          | UC-13        |
| FR-BACKUP-05  | Customer can configure an automated backup schedule.             | UC-13        |
| FR-BACKUP-06  | Backups are retained per schedule policy (daily/weekly/monthly). | BR-51        |
| FR-BACKUP-07  | Total backup storage per server ≤ 2× allocated disk.             | BR-52        |
| FR-BACKUP-08  | Only one backup job runs per server at a time.                   | BR-53        |

### FR-FIREWALL — Firewall Rules

| ID            | Requirement                                                      | Source       |
|---------------|------------------------------------------------------------------|--------------|
| FR-FW-01      | Customer can list firewall rules for a server.                   | UC-14        |
| FR-FW-02      | Customer can create a firewall rule (protocol, port, source, action, priority). | UC-14 |
| FR-FW-03      | Customer can update a firewall rule.                             | UC-14        |
| FR-FW-04      | Customer can delete a firewall rule.                             | UC-14        |
| FR-FW-05      | Rules are evaluated in priority order; first match applies.      | BR-47        |
| FR-FW-06      | Default rules on creation: allow 22/tcp, 80/tcp, 443/tcp.        | BR-48        |
| FR-FW-07      | Default deny-all for unmatched inbound traffic.                  | BR-46        |

### FR-DNS — DNS Management

| ID            | Requirement                                                      | Source       |
|---------------|------------------------------------------------------------------|--------------|
| FR-DNS-01     | Customer can list DNS records for a server.                      | UC-15        |
| FR-DNS-02     | Customer can create a DNS record (type, name, value, TTL).       | UC-15        |
| FR-DNS-03     | Customer can update a DNS record.                                | UC-15        |
| FR-DNS-04     | Customer can delete a DNS record.                                | UC-15        |
| FR-DNS-05     | Each server may have exactly one PTR (reverse DNS) record.       | BR-50        |

### FR-BLOG — Blog / Content Management

| ID            | Requirement                                                      | Source       |
|---------------|------------------------------------------------------------------|--------------|
| FR-BLOG-01    | Visitors and customers can view published blog posts (paginated). | UC-16       |
| FR-BLOG-02    | Blog posts can be filtered by category and searched by keyword.  | UC-16        |
| FR-BLOG-03    | Staff/admin can create and edit blog posts.                      | UC-23        |
| FR-BLOG-04    | Blog posts support Markdown body content.                        | Derived      |
| FR-BLOG-05    | Staff can manage blog categories.                                | UC-23        |
| FR-BLOG-06    | Blog post status: DRAFT (hidden), PUBLISHED (visible), ARCHIVED.  | BR-43        |
| FR-BLOG-07    | Blog post slug must be unique.                                    | BR-44        |

### FR-REFERRAL — Referral / Affiliate System

| ID            | Requirement                                                      | Source       |
|---------------|------------------------------------------------------------------|--------------|
| FR-REF-01     | Each user has a unique, auto-generated referral code.            | BR-54        |
| FR-REF-02     | Users can share their referral code/link.                        | UC-17        |
| FR-REF-03     | New users can enter a referral code during registration.         | UC-02        |
| FR-REF-04     | Both referrer and referee receive credits on referee's first payment. | BR-55   |
| FR-REF-05     | Users can view their referral history and accumulated credits.   | UC-17        |
| FR-REF-06     | Referral credits become withdrawable at a configurable threshold. | BR-56       |
| FR-REF-07     | Self-referral is blocked (IP + browser fingerprint check).       | BR-57        |

### FR-NOTIF — Notifications

| ID            | Requirement                                                      | Source       |
|---------------|------------------------------------------------------------------|--------------|
| FR-NOTIF-01   | System sends in-app notification on server creation, deletion, payment events, ticket updates. | Derived |
| FR-NOTIF-02   | System sends email notification for critical events.             | BR-58, BR-59 |
| FR-NOTIF-03   | User can view notification history (in-app notification center). | UC-18        |
| FR-NOTIF-04   | User can mark notifications as read.                             | UC-18        |
| FR-NOTIF-05   | User can configure notification preferences per channel.         | UC-18        |
| FR-NOTIF-06   | Critical notifications (payment failure, security) cannot be disabled. | BR-59   |

### FR-ANNOUNCE — Announcements / Status Page

| ID            | Requirement                                                      | Source       |
|---------------|------------------------------------------------------------------|--------------|
| FR-ANNOUNCE-01| Admin can create platform-wide announcements.                    | UC-24        |
| FR-ANNOUNCE-02| Announcements have severity: INFO, WARNING, CRITICAL.            | Derived      |
| FR-ANNOUNCE-03| Active announcements are displayed to all users.                 | Derived      |
| FR-ANNOUNCE-04| Announcements can be scheduled (startsAt / endsAt).              | Derived      |

### FR-AUDIT — Audit Logging

| ID            | Requirement                                                      | Source       |
|---------------|------------------------------------------------------------------|--------------|
| FR-AUDIT-01   | Every state-changing server operation generates an audit log entry. | BR-19     |
| FR-AUDIT-02   | Admin actions modifying users, plans, images, nodes, settings, taxes generate audit entries. | BR-20 |
| FR-AUDIT-03   | Audit log entries record: actor ID, action, target type/ID, timestamp, result. | BR-19 |
| FR-AUDIT-04   | Admin can view and filter audit logs.                            | UC-24        |

### FR-ADMIN — Administrative Functions

| ID            | Requirement                                                      | Source       |
|---------------|------------------------------------------------------------------|--------------|
| FR-ADMIN-01   | Admin can create, update, and deactivate ServerPlans.            | UC-20        |
| FR-ADMIN-02   | Admin can create, update, and deactivate ImageTemplates.         | UC-20        |
| FR-ADMIN-03   | Admin can add, update, and remove physical Nodes.                | UC-20        |
| FR-ADMIN-04   | Admin can manage Regions.                                        | UC-20        |
| FR-ADMIN-05   | Admin receives alerts on provisioning failures and node exhaustion. | UC-01    |
| FR-ADMIN-06   | Admin can view all users, filter, and manage (role, status, lock). | UC-24       |
| FR-ADMIN-07   | Admin can review and process GDPR requests.                      | UC-25        |
| FR-ADMIN-08   | Admin can view job queue status and dead-letter queue.           | UC-24        |
| FR-ADMIN-09   | Admin can configure tax rates per region.                        | UC-24        |
| FR-ADMIN-10   | Admin can manage email templates (subject, body, variables).     | UC-24        |
| FR-ADMIN-11   | Admin can manage system settings.                                | UC-24        |
| FR-ADMIN-12   | Admin can manage voucher campaigns (create, view stats, deactivate). | UC-21    |

### FR-GDPR — Data Privacy

| ID            | Requirement                                                      | Source       |
|---------------|------------------------------------------------------------------|--------------|
| FR-GDPR-01    | Customer can request a machine-readable export of all personal data. | UC-25, BR-62 |
| FR-GDPR-02    | Customer can request permanent account deletion.                 | UC-25, BR-63 |
| FR-GDPR-03    | Export is generated asynchronously; download link is emailed.    | BR-62        |
| FR-GDPR-04    | On deletion, all personal data removed; audit logs anonymized.   | BR-63        |

### FR-TAX — Tax Management

| ID            | Requirement                                                      | Source       |
|---------------|------------------------------------------------------------------|--------------|
| FR-TAX-01     | Tax rate applied based on customer's billing address region.     | BR-60        |
| FR-TAX-02     | Fallback to server region if no billing address set.             | BR-60        |
| FR-TAX-03     | Tax-exempt users are not charged tax (admin-set flag).           | BR-61        |
| FR-TAX-04     | Invoice displays tax amount as a separate line item.             | Derived      |

### FR-NET — Private Networking

| ID            | Requirement                                                      | Source       |
|---------------|------------------------------------------------------------------|--------------|
| FR-NET-01     | Customer can create a private network in a region with a CIDR range. | UC-27     |
| FR-NET-02     | Customer can attach a server to a private network (auto-assigned private IP). | UC-27 |
| FR-NET-03     | Customer can detach a server from a private network.             | UC-27        |
| FR-NET-04     | Customer can delete a private network (must be empty of servers). | UC-27       |
| FR-NET-05     | System validates CIDR does not overlap with existing networks in the region. | BR-72 |
| FR-NET-06     | A server can belong to at most one private network at a time.    | BR-73        |

### FR-FLOAT — Floating IPs

| ID            | Requirement                                                      | Source       |
|---------------|------------------------------------------------------------------|--------------|
| FR-FLOAT-01   | Customer can allocate a floating IP in a region.                 | UC-28        |
| FR-FLOAT-02   | Customer can assign a floating IP to a server.                   | UC-28        |
| FR-FLOAT-03   | Customer can reassign a floating IP to another server.           | UC-28, BR-76 |
| FR-FLOAT-04   | Customer can unassign a floating IP (return to pool).            | UC-28        |
| FR-FLOAT-05   | Customer can release (delete) a floating IP.                     | UC-28        |
| FR-FLOAT-06   | Floating IP transfer between servers is atomic.                  | BR-76        |
| FR-FLOAT-07   | Unassigned floating IPs incur a holding fee.                     | BR-77        |

### FR-VOL — Block Volumes

| ID            | Requirement                                                      | Source       |
|---------------|------------------------------------------------------------------|--------------|
| FR-VOL-01     | Customer can create a block volume (1 GB–16 TB) in a region.     | UC-29        |
| FR-VOL-02     | Customer can attach a volume to a server in the same region.     | UC-29, BR-80 |
| FR-VOL-03     | Customer can detach a volume from a server.                      | UC-29, BR-81 |
| FR-VOL-04     | Customer can resize a volume upward only (not shrink).           | UC-29, BR-79 |
| FR-VOL-05     | Customer can delete a volume (must be detached first).           | UC-29        |
| FR-VOL-06     | Volumes are billed hourly based on provisioned size.             | BR-82        |
| FR-VOL-07     | Volume attachment requires server not locked by another operation. | BR-80     |

### FR-CLOUDINIT — Cloud-init

| ID            | Requirement                                                      | Source       |
|---------------|------------------------------------------------------------------|--------------|
| FR-CLOUDINIT-01 | Customer can provide a cloud-init script (user-data) during server creation. | UC-30 |
| FR-CLOUDINIT-02 | Cloud-init script runs exactly once on first boot.              | BR-83        |
| FR-CLOUDINIT-03 | Script size limited to 64 KB; validated before creation.        | BR-84        |

### FR-WEBHOOK — Webhooks

| ID            | Requirement                                                      | Source       |
|---------------|------------------------------------------------------------------|--------------|
| FR-WEBHOOK-01 | Customer can create a webhook endpoint (URL, events, secret).    | UC-31        |
| FR-WEBHOOK-02 | Customer can update, deactivate, or delete a webhook endpoint.   | UC-31        |
| FR-WEBHOOK-03 | System signs webhook payloads with HMAC-SHA256.                  | BR-90        |
| FR-WEBHOOK-04 | System retries failed deliveries up to 3 times with exponential backoff. | BR-89     |
| FR-WEBHOOK-05 | Customer can view webhook delivery history per endpoint.         | UC-31        |
| FR-WEBHOOK-06 | Max 10 webhook endpoints per customer.                           | BR-88        |

### FR-BW — Bandwidth Metering

| ID            | Requirement                                                      | Source       |
|---------------|------------------------------------------------------------------|--------------|
| FR-BW-01      | System meters outbound bandwidth per server at the container interface. | BR-86   |
| FR-BW-02      | Bandwidth usage is aggregated daily and queryable hourly.        | BR-86        |
| FR-BW-03      | Customer notified at 80% and 100% of monthly allowance.          | BR-87        |
| FR-BW-04      | Overage is billed per GB beyond the plan's monthly allowance.    | BR-85        |

### FR-CLI — CLI Tool

| ID            | Requirement                                                      | Source       |
|---------------|------------------------------------------------------------------|--------------|
| FR-CLI-01     | CLI authenticates via API key (stored in local config).          | BR-92        |
| FR-CLI-02     | CLI supports: servers (list, create, start, stop, delete, ssh), volumes, DNS, firewall. | Derived     |
| FR-CLI-03     | CLI consumes the same REST API as the web UI — no privileged endpoints. | BR-93    |

### FR-TF — Terraform Provider

| ID            | Requirement                                                      | Source       |
|---------------|------------------------------------------------------------------|--------------|
| FR-TF-01      | Terraform provider maps REST API resources to HCL resources.     | BR-93        |
| FR-TF-02      | Supported resources: server, volume, floating_ip, private_network, dns_record, firewall_rule, ssh_key. | Derived |
| FR-TF-03      | Provider uses API key authentication with same rate limits as direct API consumers. | BR-93 |

### FR-OBS — Observability

| ID            | Requirement                                                      | Source       |
|---------------|------------------------------------------------------------------|--------------|
| FR-OBS-01     | Application emits Prometheus metrics on a `/metrics` endpoint.   | BR-94        |
| FR-OBS-02     | All containers emit structured JSON logs to stdout.              | Derived      |
| FR-OBS-03     | Distributed tracing propagates traceId across API → worker → Docker. | Derived   |
| FR-OBS-04     | Admin dashboard includes metrics dashboards.                     | Derived      |
| FR-OBS-05     | AlertManager alerts on node failure, dead-letter growth, provisioning failure spike. | BR-95 |

### FR-OPS — Operational Maturity

| ID            | Requirement                                                      | Source       |
|---------------|------------------------------------------------------------------|--------------|
| FR-OPS-01     | Database migrations follow expand-contract pattern (CI enforces safety). | BR-96   |
| FR-OPS-02     | Production uses blue-green deployment with smoke tests.          | BR-97        |
| FR-OPS-03     | Full DB backups every 6 hours with PITR enabled.                 | BR-98        |
| FR-OPS-04     | Disaster recovery drill is documented and executed quarterly.    | BR-98        |
| FR-OPS-05     | Runbooks exist for all major incident types.                     | BR-99        |

### FR-SEC — Security Hardening

| ID            | Requirement                                                      | Source       |
|---------------|------------------------------------------------------------------|--------------|
| FR-SEC-01     | Production uses gVisor/Firecracker for container isolation.      | BR-100       |
| FR-SEC-02     | WAF (ModSecurity OWASP CRS) deployed in front of Nginx.          | BR-101       |
| FR-SEC-03     | Container images signed with cosign; worker verifies before pull. | BR-102      |
| FR-SEC-04     | Audit log hash chain enables tamper detection.                   | BR-103       |
| FR-SEC-05     | Third-party penetration test conducted before customer onboarding. | BR-104     |

### FR-COMP — Compliance

| ID            | Requirement                                                      | Source       |
|---------------|------------------------------------------------------------------|--------------|
| FR-COMP-01    | Users must accept Terms of Service and Privacy Policy before creating first server. | BR-105 |
| FR-COMP-02    | Terms acceptance is versioned; users re-accept on updates.       | BR-105       |
| FR-COMP-03    | Cookie consent banner for EU visitors; essential cookies exempt. | BR-106       |
| FR-COMP-04    | DMCA takedown process via abuse report system (48-hour response). | BR-107      |
| FR-COMP-05    | DPA template available for business customers upon request.      | BR-108       |

### FR-ADMIN2 — Additional Admin Tools

| ID            | Requirement                                                      | Source       |
|---------------|------------------------------------------------------------------|--------------|
| FR-ADMIN2-01  | Admin can impersonate any user for debugging (full audit trail).  | BR-109       |
| FR-ADMIN2-02  | Admin can manage feature flags (global, per-user, per-role, percentage). | BR-110   |
| FR-ADMIN2-03  | Admin revenue dashboard: MRR, churn, conversion, voucher volume.  | BR-111       |
| FR-ADMIN2-04  | Admin can process abuse reports.                                 | BR-115       |
| FR-ADMIN2-05  | Customer can set a monthly spending cap.                         | BR-112       |
| FR-ADMIN2-06  | Annual prepayment gives 20% discount on monthly servers.         | BR-113       |
| FR-ADMIN2-07  | Invoice CSV export for customers and admins.                     | BR-114       |

---

## Non-Functional Requirements

### NFR-PERF — Performance

| ID            | Requirement                                                      | Measurement  |
|---------------|------------------------------------------------------------------|--------------|
| NFR-PERF-01   | Server provisioning completes (or fails) within 60 seconds.      | BR-07        |
| NFR-PERF-02   | Dashboard / server list page loads in ≤ 2 seconds (p95).         | p95 latency  |
| NFR-PERF-03   | API read endpoints respond in ≤ 200 ms (p95).                    | p95 latency  |
| NFR-PERF-04   | API write endpoints (non-provisioning) respond in ≤ 500 ms (p95). | p95 latency |
| NFR-PERF-05   | Blog post pages load in ≤ 1 second (p95).                        | p95 latency  |

### NFR-SEC — Security

| ID            | Requirement                                                      |
|---------------|------------------------------------------------------------------|
| NFR-SEC-01    | All authentication handled via signed JWT tokens (HS256).        |
| NFR-SEC-02    | Passwords hashed with bcrypt (cost factor ≥ 12).                 |
| NFR-SEC-03    | All client-server communication uses HTTPS (TLS 1.3).            |
| NFR-SEC-04    | Input validation on every API endpoint (Zod schemas).            |
| NFR-SEC-05    | Rate limiting: 10/min auth endpoints, 60/min general, 5/min server create. |
| NFR-SEC-06    | Secrets never committed to source control or logged.             |
| NFR-SEC-07    | Generic error messages on auth failures (no user enumeration).   |
| NFR-SEC-08    | 2FA TOTP secrets encrypted at rest.                              |
| NFR-SEC-09    | API keys hashed before storage (only prefix stored in plaintext). |
| NFR-SEC-10    | Stripe payment tokens only — raw card data never touches our servers. |
| NFR-SEC-11    | CORS restricted to known origins.                                |
| NFR-SEC-12    | Content-Security-Policy header set.                              |
| NFR-SEC-13    | File uploads (blog cover images) validated for type and size.    |

### NFR-AVAIL — Availability & Resilience

| ID            | Requirement                                                      |
|---------------|------------------------------------------------------------------|
| NFR-AVAIL-01  | Web application uptime target: 99.5% (excluding planned maintenance). |
| NFR-AVAIL-02  | Graceful degradation: if Docker daemon is unreachable, the web UI and database remain operational. |
| NFR-AVAIL-03  | Database backups performed daily with point-in-time recovery.    |
| NFR-AVAIL-04  | Job queue (BullMQ/Redis) survives worker restarts without data loss. |
| NFR-AVAIL-05  | Docker connectivity loss must not cause database corruption — failed jobs retry or dead-letter. |
| NFR-AVAIL-06  | Redis failure degrades gracefully: auth blocklist unavailable, rate limiting permissive. |

### NFR-AVAIL — SLOs

| ID            | SLI                                   | SLO Target                | Window    |
|---------------|---------------------------------------|---------------------------|-----------|
| SLO-01        | HTTP availability (non-5xx)           | 99.5%                     | 30 days   |
| SLO-02        | API read latency (p95)                | ≤ 200 ms                  | 30 days   |
| SLO-03        | API write latency (p95)               | ≤ 500 ms                  | 30 days   |
| SLO-04        | Server provisioning success rate      | ≥ 99.5%                   | 30 days   |
| SLO-05        | Server provisioning latency (p95)     | ≤ 60 seconds              | 30 days   |
| SLO-06        | Dashboard page load (p95)             | ≤ 2 seconds               | 30 days   |
| SLO-07        | Auth endpoint success rate            | ≥ 99.9%                   | 30 days   |
| SLO-08        | Payment processing success rate       | ≥ 99%                     | 30 days   |

**Error budget**: 3.6 hours/month (0.5% of 720 hours). Exceeding triggers freeze on new features.

### NFR-MAINT — Maintainability

| ID            | Requirement                                                      |
|---------------|------------------------------------------------------------------|
| NFR-MAINT-01  | All code written in TypeScript (strict mode).                    |
| NFR-MAINT-02  | Database schema versioned with Prisma migrations.                |
| NFR-MAINT-03  | Structured JSON logging for all server-side components.          |
| NFR-MAINT-04  | REST API documented with OpenAPI 3.1 / Swagger.                  |
| NFR-MAINT-05  | Unit test coverage ≥ 80% for business logic and API handlers.    |
| NFR-MAINT-06  | Monorepo structure with shared types package.                    |
| NFR-MAINT-07  | Environment variables documented in `.env.example`.              |

### NFR-SCALE — Scalability

| ID            | Requirement                                                      |
|---------------|------------------------------------------------------------------|
| NFR-SCALE-01  | System supports ≥ 100 concurrent authenticated users.            |
| NFR-SCALE-02  | Background worker scales independently of the web server.        |
| NFR-SCALE-03  | Stateless web tier allows horizontal scaling.                    |

### NFR-DATA — Data Retention & Compliance

| ID            | Requirement                                                      |
|---------------|------------------------------------------------------------------|
| NFR-DATA-01   | Audit logs retained for minimum 5 years.                         |
| NFR-DATA-02   | Deleted user data anonymized within 30 days of GDPR request.     |
| NFR-DATA-03   | Invoice records retained indefinitely (legal requirement).       |
| NFR-DATA-04   | Server backups auto-deleted upon server deletion.                |

---

## Constraints

| ID   | Constraint                                                                    |
|------|-------------------------------------------------------------------------------|
| C-01 | MVP must be deployable on a single server (Docker Compose).                  |
| C-02 | All infrastructure components must be open-source.                            |
| C-03 | No vendor lock-in to a specific container runtime; abstraction layer required.|
| C-04 | Target browser support: latest 2 versions of Chrome, Firefox, Safari, Edge.  |
| C-05 | Payment processing via Stripe (no other gateway for MVP).                     |
| C-06 | Email delivery via SMTP or SendGrid/Mailgun API.                              |

---

## Assumptions

| ID   | Assumption                                                                    |
|------|-------------------------------------------------------------------------------|
| AS-01 | A Docker Engine host is provisioned and accessible for each node.             |
| AS-02 | An SMTP service is configured for transactional emails.                       |
| AS-03 | DNS records and domain are configured for the application.                    |
| AS-04 | A public IP pool is available on each node for server assignment.             |
| AS-05 | Stripe account is configured with webhook endpoint for payment events.        |
| AS-06 | Docker images are pre-built and stored in an accessible container registry.   |

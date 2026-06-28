# Vision

This document defines the business vision, target outcomes, and non-goals for Astral Cloud. It serves as the north star — every feature, requirement, and architectural decision should align with the vision articulated here.

---

## Product Vision

**Astral Cloud is a production-grade cloud hosting platform that competes with DigitalOcean, Vultr, and Linode on developer experience while remaining fully self-hostable and open-source.**

We deliver the complete experience of a professional cloud provider — servers, block storage, private networking, floating IPs, firewall, DNS, backups, billing, support, CLI tooling, and API — without the complexity of hyperscale clouds or the limitations of shared hosting.

The platform is also a **reference architecture** — its codebase intentionally mirrors enterprise SaaS patterns: monorepo structure, async job processing with idempotency, atomic resource reservations, audit trails, Stripe billing, multi-role administration, CI/CD pipelines, and production observability.

---

## Target Outcomes (Success Metrics)

These are measurable outcomes the product must achieve. They drive prioritization of features and non-functional requirements.

| ID    | Outcome                                                          | Measurement Method                      | Target                        |
|-------|------------------------------------------------------------------|-----------------------------------------|-------------------------------|
| O-01  | Time-to-first-server (sign-up to SSH-ready)                      | Telemetry from registration to ACTIVE   | ≤ 60 seconds (p95)            |
| O-02  | Server provisioning reliability                                  | (successful provisions / total) × 100   | ≥ 99.5% over 30-day window    |
| O-03  | Customer retention (monthly active servers > 0)                  | Active server count per account/month   | ≥ 80% after first server      |
| O-04  | Support ticket first-response time                               | Time from open to first staff reply     | ≤ 4 business hours            |
| O-05  | Resource utilization per node                                    | Node metrics dashboard                  | ≥ 60% without over-allocation |
| O-06  | Time to recover from worker crash (idempotency)                  | BullMQ retry latency                    | ≤ 30 seconds                  |
| O-07  | Payment success rate                                             | (successful charges / total) × 100      | ≥ 99%                         |
| O-08  | Blog content freshness                                           | Days since last published post          | ≤ 14 days                     |
| O-09  | API availability (non-5xx)                                       | Load balancer / health endpoint         | 99.5% (SLO-01)                |
| O-10  | Block volume attach latency                                      | API request to ATTACHED state           | ≤ 15 seconds (p95)            |
| O-11  | Webhook delivery success rate                                    | (delivered / total) × 100               | ≥ 99.9%                       |
| O-12  | Mean time to detect (MTTD) node failure                          | Health check → alert latency            | ≤ 60 seconds                  |

---

## Target Personas

| Persona               | Description                                                                   | Primary Goal                                                              |
|-----------------------|-------------------------------------------------------------------------------|---------------------------------------------------------------------------|
| **Indie Hacker**      | Solo developer hosting side projects, blogs, or small SaaS apps.              | Cheap, reliable server + volume, SSH in seconds, never think about infra. |
| **Small Agency**      | Web agency managing client websites. Needs multiple servers per client.       | Manage 5–20 servers across clients, private networking, Terraform.        |
| **Gaming Admin**      | Community admin running game servers (Minecraft, Valheim, CS2).               | Spin up and destroy game servers on demand, pay hourly.                   |
| **Content Creator**   | Blogger, YouTuber, or educator hosting WordPress, Ghost, or custom sites.     | One-click deploy, automatic backups, zero maintenance.                    |
| **DevOps Engineer**   | Infrastructure engineer using Terraform/CLI to provision resources.           | Manage infra-as-code, webhook automations, programmatic API access.       |
| **Staff/Support**     | Platform staff handling tickets, content moderation, abuse reports.          | Resolve tickets, review abuse reports, publish blog posts, manage vouchers.|
| **Admin**             | Platform operator managing everything: nodes, pricing, security, compliance.  | Monitor infra health, manage feature flags, process GDPR, audit platform. |

---

## Scope Boundaries (Non-Goals)

| Non-Goal                                    | Rationale                                                                                               |
|---------------------------------------------|---------------------------------------------------------------------------------------------------------|
| Object storage (S3-compatible blob store)   | Separate product category.                                                                              |
| Managed databases (DBaaS)                   | Significant operational complexity. Servers + volumes cover most use cases.                             |
| Kubernetes / container orchestration        | Different abstraction. Servers are simpler and sufficient for target personas.                          |
| Load balancers as a service                 | Out of scope. Floating IPs + DNS provide basic failover.                                                |
| Serverless functions (FaaS)                 | Mismatch with container-based model.                                                                    |
| CDN / edge caching                          | The platform focuses on compute, not content delivery.                                                  |
| Multi-tenant billing with sub-accounts      | Deferred. One billing owner per account for initial production release.                                 |
| Mobile native apps (iOS/Android)            | Web UI is mobile-responsive. Native apps add maintenance burden.                                        |
| Custom container image upload by customers  | Security risk. Admin-curated images only. Cloud-init handles customization.                             |
| Managed Kubernetes                          | Out of scope.                                                                                          |

---

## Principles

1. **Simplify, then scale.** — Work end-to-end on a single host before multi-region clustering.
2. **Trust through transparency.** — Customers see what node their server is on, what they consume, what they're billed. No dark patterns.
3. **Self-host friendly.** — Open-source, run on your own hardware. No mandatory SaaS dependency.
4. **Async by default.** — Operations > 500 ms are async with clear progress indicators. The UI never blocks.
5. **Fail safe, not fail silent.** — Every error path produces an audit log + admin alert + user-visible explanation.
6. **DB is truth, runtime is reality.** — Database is business truth; Docker is physical truth. Reconciliation queries reality first.
7. **Documentation is a feature.** — Every entity, rule, endpoint, and decision is documented before code exists.
8. **Observability is not optional.** — Metrics, logs, traces, and alerts are built in from day one of production.
9. **API-first design.** — Every feature is built API-first. The web UI and CLI/Terraform consume the same REST API.
10. **Security in depth.** — No single layer is trusted. Rate limiting + input validation + ownership checks + container isolation + audit logging + WAF form a defense-in-depth strategy.

(End of file - total 81 lines)

# Architecture

This document describes the high-level architecture of Astral Cloud using the [C4 model](https://c4model.com/) at Levels 1 and 2. Technology decisions are recorded as ADRs in `docs/adr/`.

---

## 1. System Context (C4 Level 1)

```
 ┌──────────┐           ┌─────────────────────────────────────┐           ┌──────────────┐
 │          │           │                                     │           │              │
 │ Customer │◀──HTTPS──▶│        Astral Cloud Platform        │───REST──▶│ Docker       │
 │ (Browser)│           │                                     │           │ Engine       │
 │          │           └─────────────────────────────────────┘           │ (on nodes)   │
 └──────────┘                    │            │                           └──────────────┘
                                 │            │
                          ┌──────┘            └──────┐
                          ▼                          ▼
                   ┌──────────────┐          ┌──────────────┐
                   │ SMTP / Email │          │ Stripe       │
                   │ Service      │          │ Payment      │
                   │ (SendGrid)   │          │ Gateway      │
                   └──────────────┘          └──────────────┘
```

**External systems:**

| System             | Protocol     | Purpose                                                     |
|--------------------|--------------|-------------------------------------------------------------|
| Customer (Browser) | HTTPS        | Web application client                                      |
| Docker Engine      | REST API     | Container lifecycle (create, start, stop, delete) on nodes  |
| SMTP / Email       | SMTP / API   | Transactional emails (SendGrid, SMTP fallback)              |
| Stripe             | HTTPS / API  | Wallet top-ups, payment method management, refunds          |

---

## 2. Container Diagram (C4 Level 2)

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                          Astral Cloud Platform                         │
 │                                                                        │
 │  ┌────────────────────┐    ┌────────────────────┐    ┌───────────────┐ │
 │  │                    │    │                    │    │               │ │
 │  │   Next.js Web App  │    │   BullMQ Worker    │    │   Cron Jobs   │ │
 │  │                    │    │                    │    │               │ │
 │  │  - SSR pages       │    │  - Container prov. │    │  - Billing    │ │
 │  │  - REST API routes │    │  - Container life. │    │  - Cleanup    │ │
 │  │  - Auth (NextAuth) │    │  - Notifications   │    │  - Health     │ │
 │  │                    │    │  - Balance deduct  │    │               │ │
 │  └────────┬───────────┘    └────────┬───────────┘    └───────┬───────┘ │
 │           │                         │                        │         │
 │           │    ┌────────────────────┼────────────────────────┘         │
 │           │    │                    │                                  │
 │           ▼    ▼                    ▼                                  │
 │  ┌─────────────────┐    ┌──────────────────┐                           │
 │  │   PostgreSQL    │    │      Redis       │                           │
 │  │                 │    │                  │                           │
 │  │  - Users        │    │  - Job queues    │                           │
 │  │  - Servers      │    │  - Session cache │                           │
 │  │  - Audit logs   │    │  - Rate limits   │                           │
 │  │  - Plans/Images │    │                  │                           │
 │  │  - Nodes        │    │                  │                           │
 │  │  - Billing data │    │                  │                           │
 │  └─────────────────┘    └──────────────────┘                           │
 │                                                                        │
 └────────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ REST API (Docker socket or TCP)
                                  ▼
                     ┌──────────────────────┐
                     │    Docker Engine     │
                     │    (on Nodes)        │
                     │                      │
                     │  - Container run     │
                     │  - Image pulls       │
                     │  - Network mgmt      │
                     │  - Volume mgmt       │
                     └──────────────────────┘
```

**Container responsibilities:**

| Container     | Technology                   | Responsibility                                                                                    |
|---------------|------------------------------|---------------------------------------------------------------------------------------------------|
| Web App       | Next.js 14 (App Router)      | Serves HTML pages (SSR), exposes REST API routes, handles authentication (NextAuth.js v5).        |
| BullMQ Worker | BullMQ + Node.js             | Processes async jobs: container provisioning, lifecycle ops, notifications, balance deduction.    |
| Cron Jobs     | node-cron / BullMQ repeatable| Scheduled tasks: hourly billing deduction, stale server cleanup, node health checks.              |
| PostgreSQL    | PostgreSQL 16                | Primary relational database. All durable state: users, servers, nodes, audit logs, billing.       |
| Redis         | Redis 7                      | Job queue backend (BullMQ), session cache, rate-limit counters.                                  |

---

## 3. Technology Stack

| Layer              | Choice                   | Rationale (summary)                                                   |
|--------------------|--------------------------|------------------------------------------------------------------------|
| Language           | TypeScript (strict)      | Type safety across full stack; shared types between web app and worker.|
| Frontend           | Next.js 14 App Router    | SSR + API routes in one project. React ecosystem, server components.   |
| Styling            | Tailwind CSS + shadcn/ui | Utility-first CSS, pre-built accessible components.                    |
| API Validation     | Zod                      | Runtime type validation, shares types with TypeScript.                 |
| ORM                | Prisma                   | Type-safe queries, auto-generated migrations, multi-schema support.    |
| Database           | PostgreSQL 16            | ACID compliance, row-level locking (atomic reservation), JSON support. |
| Auth               | NextAuth.js v5           | JWT sessions, credential + OAuth providers, middleware protection.     |
| Job Queue          | BullMQ + Redis           | Reliable async processing with retry, priority, idempotency support.   |
| Cache              | Redis 7                  | Also serves as BullMQ backend. Session store, rate-limit counters.     |
| Container Runtime  | Docker Engine            | Industry-standard container runtime; REST API over socket or TCP.      |
| Payments           | Stripe                   | PaymentIntents for top-up, PaymentMethod tokenization, webhook sync.   |
| Email              | SendGrid / SMTP          | Transactional emails (verification, notifications, invoices).          |
| Containerization   | Docker + Docker Compose  | Consistent dev and deployment environment. Single compose file.        |
| CI/CD              | GitHub Actions           | Lint, type-check, test, build Docker images, run migrations.           |

---

## 4. Deployment View (MVP)

```
 ┌──────────────────────────────────────────────────┐
 │              Docker Host (VPS / Bare Metal)       │
 │                                                  │
 │  ┌──────────┐                                    │
 │  │  Nginx   │  ← Reverse proxy, TLS termination  │
 │  │  :443    │                                    │
 │  └────┬─────┘                                    │
 │       │                                          │
 │  ┌────┴───────────────────────────────────────┐  │
 │  │            Docker Compose Stack            │  │
 │  │                                            │  │
 │  │  ┌──────────┐  ┌──────────┐  ┌─────────┐   │  │
 │  │  │  web     │  │  worker  │  │  cron   │   │  │
 │  │  │ :3000    │  │          │  │         │   │  │
 │  │  └──────────┘  └──────────┘  └─────────┘   │  │
 │  │       │              │             │       │  │
 │  │       └──────────────┼─────────────┘       │  │
 │  │                      │                     │  │
 │  │  ┌──────────┐  ┌──────────┐                │  │
 │  │  │ postgres │  │  redis   │                │  │
 │  │  │ :5432    │  │ :6379    │                │  │
 │  │  └──────────┘  └──────────┘                │  │
 │  └────────────────────────────────────────────┘  │
 │                                                  │
 └──────────────────────────────────────────────────┘
                          │
                          │ Docker Engine on same host serves
                          │ BOTH the platform containers AND
                          │ customer server containers.
                          │
                          ▼
          ┌──────────────────────────────┐
          │  Docker Engine (host daemon)  │
          │                              │
          │  - Platform containers        │
          │  - Customer server containers │
          └──────────────────────────────┘


 ┌──────────────────────────────────────────────────┐
 │          Separate Node Hosts (production)         │
 │                                                  │
 │  ┌──────────────┐  ┌──────────────┐              │
 │  │  Node 1      │  │  Node 2      │    ...       │
 │  │  Docker      │  │  Docker      │              │
 │  │  Engine      │  │  Engine      │              │
 │  │  :2375/tcp   │  │  :2375/tcp   │              │
 │  └──────────────┘  └──────────────┘              │
 │        │                  │                      │
 │        └──────────────────┼──────────────────────┘
 │                           │                      │
 │              Docker API (TCP/TLS)                 │
 └──────────────────────────────────────────────────┘
```

For development, Nginx is optional — Next.js dev server can run directly on port 3000. In MVP, the control-plane host and the Docker Engine host may be the same machine; the platform's Docker Compose stack and customer containers run on a single Docker daemon.

---

## 5. Development Environment

During development, the entire stack runs inside Docker containers. No host installations (Node.js, npm, pnpm, Python) are required — only Docker Engine and Git are needed on the host. All application processes, infrastructure services, and tooling execute inside containers, following the project's Docker-first development philosophy.

### Topology

```
 ┌──────────────────────────────────────────────────────────────────┐
 │                     Developer Machine (Linux / macOS / Windows)   │
 │                                                                  │
 │  ┌────────────────────────────────────────────────────────────┐  │
 │  │                   Docker Engine                             │  │
 │  │                                                            │  │
 │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │  │
 │  │  │ Next.js  │  │  Worker  │  │PostgreSQL│  │  Redis   │   │  │
 │  │  │ web      │  │ (Node.js)│  │ :5432    │  │ :6379    │   │  │
 │  │  │ :3000    │  │          │  │          │  │          │   │  │
 │  │  │          │  │ (hot-    │  │          │  │          │   │  │
 │  │  │ (hot-    │  │  reload) │  │          │  │          │   │  │
 │  │  │  reload) │  │          │  │          │  │          │   │  │
 │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │  │
 │  │                                                            │  │
 │  │  ┌──────────────────┐                                      │  │
 │  │  │ Customer server   │  ← Dev/test containers              │  │
 │  │  │ containers        │    created by the worker            │  │
 │  │  └──────────────────┘                                      │  │
 │  │                                                            │  │
 │  └────────────────────────────────────────────────────────────┘  │
 │                                                                  │
 │  VS Code / Browser → http://localhost:3000                       │
 │                                                                  │
 └──────────────────────────────────────────────────────────────────┘
```

### Components

| Component       | Runs on                   | Notes                                                       |
|-----------------|---------------------------|-------------------------------------------------------------|
| Next.js Web App | Docker container          | `docker compose up`, port 3000. Source code volume-mounted for hot-reload. |
| BullMQ Worker   | Docker container          | Separate service in compose file. Source code volume-mounted for hot-reload. |
| PostgreSQL      | Docker Engine             | Defined in `docker/docker-compose.dev.yml`                  |
| Redis           | Docker Engine             | Defined in `docker/docker-compose.dev.yml`                  |
| Customer        | Docker Engine             | Created by worker — same daemon, isolated by containers. Worker container mounts Docker socket (`/var/run/docker.sock`) to create customer containers. |

### Prerequisites

- **Docker Engine**: Docker Desktop (macOS/Windows) or native `docker-ce` (Linux). No virtualization extensions needed beyond standard container support.
- **RAM**: Minimum **8 GB**. Docker uses ~2 GB for infrastructure; web + worker containers use ~1 GB; test containers consume remaining.
- **Disk**: ~10 GB free for container images and volumes.
- **Git**: Required on the host for source control.
- **VS Code** (recommended): With Dev Containers extension for an integrated development experience. Plain editor + browser also works.

The host machine must NOT have Node.js, npm, pnpm, Python, or any other runtime installed. All tooling and runtimes live inside Docker containers.

### Getting Started

1. Start all services (web, worker, postgres, redis):
   ```bash
   docker compose -f docker/docker-compose.dev.yml up -d
   ```
2. Run database migrations (inside the web container):
   ```bash
   docker compose -f docker/docker-compose.dev.yml exec web npx prisma migrate dev
   ```
3. The web app is now running at `http://localhost:3000` with hot-reload enabled.
4. View logs:
   ```bash
   docker compose -f docker/docker-compose.dev.yml logs -f web worker
   ```
5. Seed a node record pointing at the local Docker daemon (the worker container mounts the Docker socket, so the endpoint is the socket path inside the container):
   ```
   dockerEndpoint = "unix:///var/run/docker.sock"
   ```

All development commands (`prisma generate`, `prisma migrate`, `npm install`, `npm run test`) execute inside containers via `docker compose exec`. No npm, Node.js, or Prisma CLI is installed on the host.

### Mock Container Runtime

For faster development and testing without Docker, a mock implementation of the `ContainerRuntime` interface (defined in `packages/worker/src/runtime/types.ts`) returns simulated container IDs and IPs instantly — no Docker Engine required. Development switches between mock and real Docker via an environment variable set in the compose file:

```env
CONTAINER_RUNTIME_DRIVER=mock    # or "docker"
```

Both drivers implement the same TypeScript interface, so all business logic, API routes, and UI development can continue regardless of which is active. This is the same abstraction that allows swapping Docker for another container runtime in the future. When using the mock driver, the Docker socket mount and Docker daemon are not needed.

---

## 6. Request Flow: Create Server (UC-01)

```
0. Customer POST /api/servers (JWT in Authorization header)

1. Web App validates:
   - JWT (NextAuth)
   - Request body (Zod schema)
   - Business rules (BR-06, BR-08, BR-09, BR-10)

2. Web App checks balance in PostgreSQL

3. Web App queries PostgreSQL for candidate nodes sorted by free capacity DESC

4. Web App attempts atomic resource reservation inside a DB transaction:
   ┌─────────────────────────────────────────────────────────────┐
   │  Atomic Reservation Algorithm (prevents race conditions)    │
   │                                                             │
   │  FOR each candidate node (ordered by free capacity):        │
   │                                                             │
   │    -- Step A: Reserve a free IP on this node                │
   │    -- Conditional UPDATE: claims a free IPv4 address        │
   │    -- atomically. If no free IP, skip to next node.         │
   │    UPDATE "IpAddress"                                       │
   │    SET                                                      │
   │      "serverId"    = :serverId,                             │
   │      "allocatedAt" = NOW()                                  │
   │    WHERE "nodeId" = :nodeId                                 │
   │      AND "type"   = 'IPv4'                                  │
   │      AND "serverId" IS NULL                                 │
   │      AND "id" = (                                           │
   │        SELECT "id" FROM "IpAddress"                         │
   │        WHERE "nodeId" = :nodeId                             │
   │          AND "type"   = 'IPv4'                              │
   │          AND "serverId" IS NULL                             │
   │        LIMIT 1                                              │
   │      )                                                      │
   │    RETURNING "address";                                     │
   │                                                             │
   │    IF no rows RETURNED:                                     │
   │      CONTINUE (this node has no free IPs).                  │
   │                                                             │
   │    -- Step B: Reserve node capacity                         │
   │    -- Conditional UPDATE: succeeds ONLY IF enough free      │
   │    -- capacity remains. Two concurrent requests will        │
   │    -- never BOTH see the same free capacity and succeed.    │
   │    UPDATE "Node"                                            │
   │    SET                                                      │
   │      "allocatedVcpu"    = "allocatedVcpu"    + :vcpu,       │
   │      "allocatedRamMB"   = "allocatedRamMB"   + :ramMB,      │
   │      "allocatedDiskGB"  = "allocatedDiskGB"  + :diskGB      │
   │    WHERE "id" = :nodeId                                     │
   │      AND ("totalVcpu"    - "allocatedVcpu")    >= :vcpu     │
   │      AND ("totalRamMB"   - "allocatedRamMB")   >= :ramMB    │
   │      AND ("totalDiskGB"  - "allocatedDiskGB")  >= :diskGB;  │
   │                                                             │
   │    IF rows affected = 1:                                    │
   │      -- This node is ours; INSERT ServerInstance, COMMIT.   │
   │      BREAK.                                                 │
   │    ELSE:                                                    │
   │      -- Node capacity race lost. Release the reserved IP.   │
   │      UPDATE "IpAddress" SET "serverId" = NULL,              │
   │                            "allocatedAt" = NULL             │
   │      WHERE "serverId" = :serverId;                          │
   │      CONTINUE.                                              │
   │                                                             │
   │  IF no candidate succeeded:                                 │
   │    ROLLBACK and throw EX-01-3 (no node available).          │
   │                                                             │
   │  One INSERT (same transaction): ServerInstance              │
   │  (status = CREATING, nodeId = reserved node,                │
   │   ipAddress = reserved IP)                                  │
   └─────────────────────────────────────────────────────────────┘

5. Web App enqueues job to BullMQ: { type: "provision", serverId, nodeId, planId, imageId }
   ─────────────────────────────────────────────────
   (HTTP response returns 202 Accepted + serverId to Customer)
   ─────────────────────────────────────────────────

6. Worker picks up job from Redis/BullMQ

   ╔══════════════════════════════════════════════════════════════╗
   ║  IDEMPOTENCY GUARD (before any Docker call)                  ║
   ║                                                              ║
   ║  Worker queries Docker: "Does a container tagged with        ║
   ║  serverId=<serverId> already exist on node <nodeId>?"        ║
   ║                                                              ║
   ║  If YES → skip to step 9 (retry after crash scenario).       ║
   ║  If NO  → continue to step 7 (first attempt).                ║
   ╚══════════════════════════════════════════════════════════════╝

7. Worker calls Docker Engine API: POST /containers/create
   - Sets image, CPU quota, memory limit, disk size (volume)
   - Configures network (bridge, port mapping, public IP)
   - Sets labels: { serverId, userId, hostname }

8. Docker Engine pulls image and creates container (async, worker polls via /containers/{id}/json)

   ╔══════════════════════════════════════════════════════════════╗
   ║  DATABASE TRANSACTION (steps 9, 10, 11, 13 are atomic)       ║
   ║                                                              ║
   ║  If ANY of these fail, the entire block rolls back.          ║
   ║  The job is re-queued. On retry, the idempotency guard       ║
   ║  at step 6 detects the existing container and re-applies     ║
   ║  the database sync.                                          ║
   ╚══════════════════════════════════════════════════════════════╝

9. Worker updates ServerInstance: status = ACTIVE, dockerContainerId
   (ipAddress was already set during atomic reservation at step 4)

10. Worker updates Node: allocatedVcpu += vcpu, allocatedRamMB += ramMB, etc.
    (Or no-op — if capacity was reserved at step 4, just confirm.)

11. Worker inserts AuditLog (BR-19)

12. Worker enqueues notification job → sends email (OUTSIDE transaction)

13. Worker deducts balance from User
```

### Why a conditional UPDATE (not just a SELECT)

A naive `SELECT` to find a node, followed by an `UPDATE` to reserve, has a race window: two concurrent requests can both `SELECT` the same free capacity before either `UPDATE` lands, causing over-allocation. The conditional `UPDATE ... WHERE total - allocated >= :needed` is **atomic at the database row level** — PostgreSQL's MVCC guarantees that only one of the two concurrent UPDATEs will see enough capacity and modify the row. The loser sees `rows affected = 0` and retries with the next candidate. This enforces [BR-05] without application-level locks.

### Why IP is reserved at step 4 (not step 9)

IP addresses are reserved in the same atomic transaction as node capacity. A `SELECT ... LIMIT 1` followed by a separate `UPDATE` on `IpAddress` would have the same race-window problem as node capacity: two concurrent requests could both claim "this IP is free" before either UPDATE marks it allocated. The conditional subquery (`WHERE serverId IS NULL ... RETURNING address`) is atomic — PostgreSQL's row-level locking ensures two concurrent requests cannot claim the same IP. If the node capacity reservation (Step B) subsequently fails, the IP is released back to `NULL` within the same transaction — no orphaned IPs. This enforces **IP uniqueness** at the database level.

### Why capacity is reserved at step 4 (not step 9)

The reservation and the `ServerInstance` INSERT happen in the same database transaction. If any subsequent validation fails or no node can be reserved, the transaction rolls back entirely — no partial state (IP, capacity, or server record). If provisioning later fails (EX-01-4, EX-01-6), the worker **rolls back** the reservation by decrementing the node counters, releasing the IP (`IpAddress.serverId = NULL`), and marking the server as `ERROR`.

### Why the idempotency guard exists

The gap between Docker success (step 8) and database commit (steps 9–13) is a **dual-write boundary** — Docker Engine and PostgreSQL cannot share a transaction. If the worker crashes in this window, the container exists on Docker but the database was never updated. BullMQ re-delivers the job; the guard at step 6 detects the existing container via its Docker label and replays only the database sync — skipping re-creation. This makes the provisioning job **idempotent**. See also UC-01 EX-01-7 and UC-07 EX-07-3 for the delete-side equivalent.

### Operation Locking (Server-level pessimistic lock)

Any async operation on an existing server (stop, restart, delete, backup, restore) must first acquire the `lockedBy` lock atomically:

```
POST /api/servers/:serverId/stop

1. Web App validates JWT, ownership, status (must be ACTIVE per BR-14)

2. Web App attempts atomic lock acquisition:
   ┌─────────────────────────────────────────────────────────────┐
   │  UPDATE "ServerInstance"                                    │
   │  SET "lockedBy" = 'STOPPING', "lockedAt" = NOW()             │
   │  WHERE "id"  = :serverId                                    │
   │    AND "lockedBy" IS NULL;                                  │
   │                                                             │
   │  IF rows affected = 0:                                      │
   │    -- Server is already locked. Read current lockedBy.      │
   │    -- Return 409 CONFLICT: "Server is currently {lockedBy}" │
   │    STOP.                                                    │
   └─────────────────────────────────────────────────────────────┘

3. Web App updates status to STOPPING (same transaction or immediate follow-up)

4. Web App enqueues BullMQ job: { type: "stop", serverId }
   Returns 202 Accepted to customer.

5. Worker executes stop → on completion (success or failure):
   UPDATE "ServerInstance" SET "lockedBy" = NULL, "lockedAt" = NULL, status = :newStatus
```

This guarantees that a user cannot click "Stop" and "Delete" while a backup is running, or start two concurrent backups. The lock is released unconditionally on job completion — both success and failure paths.

For **CREATE**, the lock is set at INSERT time (`lockedBy = 'CREATING'`) since no row existed before. For **START**, no lock is needed (the operation is nearly instant — `docker start` is a single API call).

**Stale lock cleanup (Cron Job):**

```
Every 30 seconds, the cron job runs:

SELECT "id", "lockedBy", "lockedAt"
FROM "ServerInstance"
WHERE "lockedBy" IS NOT NULL
  AND "lockedAt" < NOW() - INTERVAL 'timeout';

-- timeout is per-operation (60s for CREATING, 30s for STOPPING, etc.)

FOR each stale server:
  UPDATE "ServerInstance"
  SET "lockedBy" = NULL, "lockedAt" = NULL, "status" = 'ERROR'
  WHERE "id" = :serverId;

  INSERT AuditLog (action = LOCK_STALE, metadata = { lockedBy, duration });
  ALERT admin;
```

---

## 7. Project Structure (Monorepo)

```
astral-cloud-v2/
├── apps/
│   └── web/                  # Next.js app
│       ├── src/
│       │   ├── app/          # App Router pages + API routes
│       │   ├── components/   # React components (shadcn/ui)
│       │   ├── lib/          # Prisma client, auth config, utils
│       │   └── middleware.ts # Auth middleware
│       ├── prisma/
│       │   └── schema.prisma # Database schema
│       ├── public/           # Static assets
│       ├── package.json
│       └── Dockerfile
│
├── packages/
│   ├── worker/               # BullMQ worker process
│   │   └── src/
│   │       ├── jobs/         # Job handlers (provision, stop, delete, notify)
│   │       ├── runtime/      # Docker client, ContainerRuntime interface
│   │       │   └── types.ts  # ContainerRuntime interface definition
│   │       ├── notifications/# Email client (SendGrid / SMTP)
│   │       └── index.ts      # Worker entry point
│   │
│   └── shared/               # Shared types, Zod schemas, constants
│       └── src/
│           ├── schemas/      # Zod validation schemas
│           ├── types/        # TypeScript type definitions
│           └── constants/    # Enums, config values
│
├── docker/
│   ├── docker-compose.yml
│   ├── docker-compose.dev.yml
│   └── nginx.conf
│
├── docs/                     # All documentation
│   └── adr/                  # Architecture Decision Records
│
├── .github/
│   └── workflows/            # CI/CD pipelines (GitHub Actions)
│
├── turbo.json                # Turborepo config
└── package.json              # Root workspace
```

### Key paths

| Path                                    | Purpose                                                       |
|-----------------------------------------|---------------------------------------------------------------|
| `packages/worker/src/runtime/types.ts`  | `ContainerRuntime` interface — abstraction over Docker        |
| `packages/worker/src/runtime/`          | Docker API client + mock implementation                       |
| `packages/worker/src/jobs/`             | BullMQ job handlers (one file per job type)                   |
| `packages/worker/src/notifications/`    | Email client abstraction (SendGrid / SMTP)                    |
| `apps/web/prisma/schema.prisma`         | Single source of truth for all database models                |
| `packages/shared/src/schemas/`          | Zod schemas shared between web app and worker                 |
| `docker/docker-compose.yml`             | Production stack: web, worker, cron, postgres, redis, nginx   |
| `docker/docker-compose.dev.yml`         | Dev dependencies only: postgres, redis                        |
| `docs/adr/`                             | Architecture Decision Records (one per major decision)        |
| `packages/cli/`                          | CLI tool (`astral` command) — consumes REST API               |
| `packages/sdk-node/`                     | Node.js SDK for programmatic API access (deferred)            |
| `packages/terraform-provider/`           | Terraform provider plugin (deferred)                          |

---

## 8. Application Architecture & Design Patterns

The monorepo contains multiple packages with different architectural needs. A single pattern (MVC, Clean Architecture, Hexagonal) applied uniformly would be over-engineered for some packages and insufficient for others. Instead, each package uses the pattern that best fits its role — unified by shared domain types and Zod schemas in `packages/shared/`.

### 8.1 Per-Package Architectural Patterns

| Package               | Best-Fit Pattern                | Rationale                                                                                                  |
|-----------------------|---------------------------------|------------------------------------------------------------------------------------------------------------|
| `apps/web/`           | **Layered (Feature-based)**    | Next.js App Router naturally splits code by route (presentation) and by concern (lib, middleware). Layers: Presentation → Application → Domain → Infrastructure. |
| `packages/worker/`    | **Pipeline / Chain of Resp.**  | Jobs flow through a pipeline: dequeue → idempotency guard → execute → audit → notify. Each stage is a discrete handler. |
| `packages/worker/src/runtime/` | **Ports & Adapters (Hexagonal)** | The `ContainerRuntime` interface is the port; `DockerRuntime` and `MockRuntime` are adapters. This is a textbook hexagonal architecture — the domain (worker logic) never depends on infrastructure (Docker API). |
| `packages/shared/`    | **Domain Layer**                | Pure TypeScript types + Zod schemas + constants. No framework dependencies. Consumed by all other packages. |
| `packages/cli/`       | **Command Pattern**             | Each CLI subcommand (`servers list`, `volumes create`) is a discrete command object, dispatched by a router. |
| `packages/terraform-provider/` | **Adapter**             | Translates between Terraform's CRUD lifecycle and Astral Cloud's REST API. One resource type → one adapter. |

### 8.2 Layered Architecture (apps/web/)

The Next.js web application uses a **feature-based layered** architecture — layers are organized by concern, and each feature (servers, billing, tickets) spans all layers:

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Presentation Layer                             │
│  app/(dashboard)/servers/page.tsx                                   │
│  app/(dashboard)/servers/[id]/page.tsx                              │
│  components/servers/ServerCard.tsx, ServerList.tsx                   │
│  (React Server Components + Client Components + shadcn/ui)          │
├─────────────────────────────────────────────────────────────────────┤
│                      Application Layer                              │
│  app/api/servers/route.ts      (REST route handlers)                │
│  lib/services/server.service.ts (use case orchestration)             │
│  lib/validators/server.schema.ts (Zod request/response schemas)     │
│  middleware.ts                  (auth, rate limiting, logging)       │
│  (Thin controllers → delegate to services → return responses)       │
├─────────────────────────────────────────────────────────────────────┤
│                      Domain Layer  ← shared package                 │
│  packages/shared/src/types/server.ts   (TypeScript interfaces)      │
│  packages/shared/src/schemas/server.ts (Zod validation schemas)     │
│  packages/shared/src/constants/        (enums, status values)       │
│  (Pure functions, no side effects, no framework imports)            │
├─────────────────────────────────────────────────────────────────────┤
│                      Infrastructure Layer                           │
│  lib/db.ts              (Prisma client singleton)                   │
│  lib/auth.ts            (NextAuth configuration)                    │
│  lib/email.ts           (SendGrid/SMTP adapter)                     │
│  lib/stripe.ts          (Stripe client)                             │
│  lib/queue.ts           (BullMQ producer)                           │
│  (All external I/O: database, auth, email, payment, job queue)     │
└─────────────────────────────────────────────────────────────────────┘
```

Dependency rule: **Presentation → Application → Domain ← Infrastructure**. The domain layer has zero dependencies on frameworks; the application layer depends on domain + infrastructure; the presentation layer depends on application.

### 8.3 Ports & Adapters / Hexagonal (packages/worker/src/runtime/)

The container runtime is the textbook example of hexagonal architecture in this project:

```
                  ┌─────────────────────────────┐
                  │       Worker (Domain)        │
                  │                              │
                  │  Job handlers:               │
                  │  provision.server.job.ts     │
                  │  stop.server.job.ts          │
                  │  delete.server.job.ts        │
                  │                              │
                  │  ┌───────────────────────┐   │
                  │  │  ContainerRuntime     │   │  ← Port (interface)
                  │  │  (types.ts)           │   │
                  │  │                       │   │
                  │  │  + createServer()     │   │
                  │  │  + startServer()      │   │
                  │  │  + stopServer()       │   │
                  │  │  + deleteServer()     │   │
                  │  │  + getServerStatus()  │   │
                  │  │  + getNodeResources() │   │
                  │  │  + createBackup()     │   │
                  │  │  + restoreBackup()    │   │
                  │  └───────┬───────┬───────┘   │
                  └──────────┼───────┼───────────┘
                             │       │
                    ┌────────┘       └────────┐
                    ▼                         ▼
        ┌───────────────────┐     ┌───────────────────┐
        │  DockerRuntime    │     │   MockRuntime     │  ← Adapters
        │  (dockerode)      │     │   (in-memory)     │
        │                   │     │                   │
        │  → Docker Engine  │     │  → Fake responses │
        │    REST API       │     │    for testing    │
        └───────────────────┘     └───────────────────┘
```

The worker's job handler code never imports `dockerode` — it only references the `ContainerRuntime` interface. At startup, a factory creates the appropriate adapter:

```typescript
// packages/worker/src/runtime/factory.ts
function createRuntime(config: Config): ContainerRuntime {
  switch (config.driver) {
    case "docker":  return new DockerRuntime(config.dockerEndpoint);
    case "mock":    return new MockRuntime();
    case "gvisor":  return new GVisorRuntime(config);
    default:        throw new Error(`Unknown runtime: ${config.driver}`);
  }
}
```

This same pattern applies to the email adapter (`EmailProvider` interface → `SendGridAdapter` | `SmtpAdapter` | `MockEmailAdapter`) and the payment adapter (`PaymentProvider` interface → `StripeAdapter` | `MockPaymentAdapter`).

### 8.4 Pipeline Pattern (packages/worker/src/jobs/)

Each BullMQ job handler executes a pipeline of discrete stages:

```
                     ┌─────────────────────┐
                     │   Dequeue Job from   │
                     │   BullMQ / Redis     │
                     └──────────┬──────────┘
                                │
                                ▼
                     ┌─────────────────────┐
                     │  IDEMPOTENCY GUARD  │ ← Query runtime for real state
                     │  "Does this already │
                     │   exist?"           │
                     └──────────┬──────────┘
                                │
                         ┌──────┴──────┐
                         │ exists?      │ new
                         ▼              ▼
              ┌──────────────┐  ┌──────────────────┐
              │ Skip to sync │  │  EXECUTE          │
              │ (just update │  │  Docker API call  │
              │  DB state)   │  │                   │
              └──────┬───────┘  └────────┬──────────┘
                     │                   │
                     └─────────┬─────────┘
                               │
                               ▼
                     ┌─────────────────────┐
                     │  DATABASE SYNC      │
                     │  Update status,     │
                     │  counters, lock     │
                     └──────────┬──────────┘
                                │
                                ▼
                     ┌─────────────────────┐
                     │  AUDIT LOG          │
                     │  Insert AuditLog    │
                     └──────────┬──────────┘
                                │
                                ▼
                     ┌─────────────────────┐
                     │  NOTIFY             │
                     │  Email + In-app     │
                     └──────────┬──────────┘
                                │
                                ▼
                     ┌─────────────────────┐
                     │  RELEASE LOCK       │
                     │  lockedBy = NULL    │
                     └─────────────────────┘
```

Each stage is idempotent: the idempotency guard means re-running the entire pipeline after a crash produces the same final state. Stages are composed via async function chaining rather than class inheritance.

### 8.5 Design Patterns Reference

| Pattern                   | Where Used                                                                                | GoF Category |
|---------------------------|-------------------------------------------------------------------------------------------|--------------|
| **Singleton**             | Prisma client, Redis client, BullMQ connection, Stripe client — one instance per process  | Creational   |
| **Factory Method**        | `createRuntime(driver)` — returns DockerRuntime | MockRuntime | GVisorRuntime   | Creational   |
| **Abstract Factory**      | `createAdapters(config)` — returns { runtime, email, payment } adapter suite              | Creational   |
| **Builder**               | Zod `.refine().transform()` chains for request validation; Docker container create options | Creational   |
| **Adapter**               | `ContainerRuntime`, `EmailProvider`, `PaymentProvider` — wrap external APIs as interfaces  | Structural   |
| **Decorator**             | Auth middleware wraps route handlers; logging middleware wraps all API routes              | Structural   |
| **Facade**                | `server.service.ts` — single method `createServer()` orchestrates validation, reservation, enqueue | Structural |
| **Proxy**                 | BullMQ rate limiter group — limits concurrent jobs; idempotency guard proxies Docker calls | Structural   |
| **Chain of Responsibility**| Next.js middleware chain: CORS → rate limit → auth → validation → route handler            | Behavioral   |
| **Command**               | BullMQ job types (`provision`, `stop`, `delete`, `backup`) — each is a command object       | Behavioral   |
| **Observer / Pub-Sub**    | BullMQ job events (`completed`, `failed`); Stripe webhook events; Notification dispatching  | Behavioral   |
| **Strategy**              | `ContainerRuntime` interface with `DockerRuntime` vs `MockRuntime` strategies              | Behavioral   |
| **Template Method**       | Job handler base: `acquireLock()` → `execute()` → `syncDb()` → `audit()` → `releaseLock()`  | Behavioral   |
| **State**                 | `ServerInstance.status` + `lockedBy` form a state machine with validated transitions       | Behavioral   |
| **Memento**               | `AuditLog.metadata` captures snapshot of state before/after mutations                       | Behavioral   |
| **Dependency Injection**  | Services injected via function parameters or module-level configuration, not a DI container | (principle)  |

### 8.6 Dependency Flow

```
  ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌───────────────┐
  │  apps/   │────▶│ packages/│◀────│ packages/│◀────│  External     │
  │  web/    │     │ shared/  │     │ worker/  │     │  Services     │
  │ (Next.js)│     │ (Domain) │     │ (Jobs)   │     │               │
  └────┬─────┘     └──────────┘     └────┬─────┘     │ Docker Engine │
       │                                 │            │ Stripe        │
       │                                 │            │ SendGrid      │
       ▼                                 ▼            │ Proxmox (opt) │
  ┌──────────┐                    ┌────────────┐     └───────────────┘
  │Prisma    │                    │ Container  │
  │PostgreSQL│                    │ Runtime    │
  │ Redis    │                    │ Interface  │
  └──────────┘                    └────────────┘
```

- `packages/shared/` depends on **nothing** except TypeScript + Zod
- `apps/web/` depends on `packages/shared/` + infrastructure (Prisma, Redis, Stripe)
- `packages/worker/` depends on `packages/shared/` + infrastructure (Docker, email, Stripe)
- No circular dependencies — enforced by Turborepo

### 8.7 Why Not Pure Clean Architecture?

Clean Architecture (Entities → Use Cases → Interface Adapters → Frameworks) requires abstractions for every external dependency. In a Next.js monorepo, this would mean:

- An `IUserRepository` interface, a `PrismaUserRepository` implementation, and a factory to wire them
- An `IAuthService` interface behind NextAuth, despite NextAuth being deeply coupled to Next.js
- An `IQueue` interface behind BullMQ

This adds **significant boilerplate** for minimal benefit when:
- Prisma already provides a type-safe data access layer
- NextAuth is the standard and unlikely to be swapped
- BullMQ is the standard for Redis-backed job queues
- The monorepo structure already provides dependency direction control

Instead, the project uses **pragmatic layering**: abstract only where swapping is realistic (container runtime, email provider, payment gateway). For everything else, use the framework's native patterns directly. The shared types package serves as the "domain" layer without the ceremony of repository interfaces.

The `ContainerRuntime` port is the one place where full hexagonal architecture is worth the cost — it enables mock testing, future runtime swaps, and clean separation between business logic and Docker internals.

---

## 9. Observability Stack

Production observability is not "add later" — it is built into the deployment from day one.

```
 ┌─────────────────────────────────────────────────────────────────┐
 │                      Observability Stack                        │
 │                                                                 │
 │   ┌──────────────┐   ┌──────────────┐   ┌───────────────────┐   │
 │   │  Prometheus  │   │    Loki      │   │     Tempo         │   │
 │   │  (metrics)   │   │   (logs)     │   │    (traces)       │   │
 │   └──────┬───────┘   └──────┬───────┘   └────────┬──────────┘   │
 │          │                  │                    │              │
 │          ▼                  ▼                    ▼              │
 │   ┌──────────────┐   ┌──────────────┐   ┌───────────────────┐   │
 │   │   Grafana    │   │  AlertManager│   │  Status Page      │   │
 │   │ (dashboards) │   │  (alerting)  │   │  (public-facing)  │   │
 │   └──────────────┘   └──────────────┘   └───────────────────┘   │
 │                                                                 │
 └─────────────────────────────────────────────────────────────────┘
```

### Metrics (Prometheus + Grafana)

| Metric Category       | Examples                                                   | Retention     |
|-----------------------|------------------------------------------------------------|---------------|
| Application           | API request rate, latency p50/p95/p99, error rate by route | 90 days (1m)  |
| Infrastructure        | Node CPU/RAM/disk, Docker container count, Redis memory    | 90 days (1m)  |
| Business              | Server creations/min, payment volume, sign-up rate         | 90 days (1m)  |
| BullMQ                | Queue depth, job throughput, failed job count, dead-letter | 90 days (1m)  |

**Grafana dashboards:**
- **API Overview**: request rate, latency percentiles, error rate by endpoint
- **Node Health**: per-node CPU, RAM, disk, container count, status history
- **Queue Monitor**: queue depth, processing rate, failure rate, dead-letter count
- **Business Metrics**: MRR, sign-ups, server count by plan, churn, voucher usage
- **SLO Dashboard**: error budget remaining, burn rate, SLO compliance by window

### Logging (Loki / Elasticsearch)

All containers emit structured JSON logs with the following standard fields:

```json
{
  "timestamp": "2026-06-27T12:00:00Z",
  "level": "INFO",
  "service": "web",
  "traceId": "a1b2c3d4...",
  "userId": "c1a2b3c4...",
  "message": "Server provisioned",
  "serverId": "d4e5f6a7...",
  "durationMs": 3200
}
```

Redaction rules prevent secrets, tokens, passwords, and Stripe keys from appearing in logs.

### Distributed Tracing (OpenTelemetry → Tempo/Jaeger)

Every incoming request generates a `traceId` that propagates through:
1. Nginx → Next.js API route
2. Prisma database queries
3. BullMQ job enqueue
4. Worker picks up job (carries `traceId` in job data)
5. Docker Engine API calls
6. Stripe API calls (via `Stripe-Request-Id` header correlation)

This allows tracing a single "Create Server" operation from the customer's browser click all the way through to the Docker container being started.

### Alerting

| Alert                               | Severity | Channel              | Threshold                                   |
|-------------------------------------|----------|----------------------|---------------------------------------------|
| Node offline                        | CRITICAL | Email + status page  | 3 consecutive health check failures         |
| Dead-letter queue growing           | WARNING  | Email                | > 10 jobs in dead-letter in 5 minutes      |
| Provisioning failure rate           | CRITICAL | Email + status page  | > 1% failure rate over 5 minutes            |
| Payment failure spike               | WARNING  | Email                | > 5% of charges failing over 10 minutes     |
| Node at 80% capacity                | WARNING  | In-app notification  | Any node crossing 80% allocation            |
| SLO error budget burn rate          | CRITICAL | Email + status page  | Projected to exhaust within 3 days          |

### Status Page

A public status page (`status.astral.cloud`) displays:
- Current platform status (operational / degraded / outage)
- Per-component status: API, Dashboard, Server Provisioning, Billing, Support
- Active incidents with timeline
- Historical uptime (90-day rolling)

The status page is auto-updated from health checks; admins can manually create incidents and post updates.

---

## 10. Operational Maturity

### Deployment Strategy (Blue-Green)

```
 ┌────────────────────────────────────────────────────┐
 │              Nginx (reverse proxy)                 │
 │                                                    │
 │   ┌───────────┐        ┌───────────┐               │
 │   │  Blue     │  ───▶  │  Green    │               │    
 │   │  (active) │  switch│ (standby) │               │
 │   └───────────┘        └───────────┘               │
 │                                                    │
 │ 1. Deploy Green (new version) alongside Blue       |
 │ 2. Run smoke tests against Green                   |
 │ 3. Switch Nginx upstream to Green                  |
 │ 4. Keep Blue warm for 5 minutes (instant rollback) |
 │ 5. Tear down Blue                                  |
 └────────────────────────────────────────────────────┘
```

### Database Migration Safety (Expand-Contract)

All schema changes follow this pattern to avoid exclusive table locks:

```
Phase 1 (Expand):  ADD COLUMN (nullable), CREATE new table
                   → Deploy code that writes to both old and new

Phase 2 (Migrate): Backfill data from old to new in batches

Phase 3 (Contract): Deploy code that reads only from new
                    → DROP old column/table
```

Prisma migrations are reviewed for lock risk before merge. Migrations requiring `ACCESS EXCLUSIVE` locks are rejected in CI.

### Disaster Recovery

| Metric | Target              | Frequency |
|--------|---------------------|-----------|
| RTO    | 4 hours             | —         |
| RPO    | 6 hours             | —         |
| Backup | Full DB every 6h    | Automatic |
| PITR   | Point-in-time       | Enabled   |
| Drill  | Full restore test   | Quarterly |

The DR drill restores the entire platform (PostgreSQL, Redis snapshot, Docker images, configuration) to a clean environment from the latest backup. Runbooks are verified during the drill.

### Runbooks (documented procedures)

| Incident                   | Runbook Location                      |
|----------------------------|---------------------------------------|
| Node failure               | `docs/runbooks/node-failure.md`       |
| IP pool exhaustion         | `docs/runbooks/ip-exhaustion.md`      |
| Payment gateway outage     | `docs/runbooks/stripe-outage.md`      |
| Worker crash storm         | `docs/runbooks/worker-storm.md`       |
| GDPR request               | `docs/runbooks/gdpr-request.md`       |
| Abuse complaint            | `docs/runbooks/abuse-handling.md`     |
| Database restore           | `docs/runbooks/database-restore.md`   |

### Chaos Engineering (Optional, Production-Only)

Periodic tests verify resilience assumptions:
- **Worker kill**: Kill the worker mid-provisioning → verify idempotency guard recovers
- **Docker daemon restart**: Restart Docker on a node → verify health check detects outage, admin alerted
- **Redis restart**: Restart Redis → verify BullMQ jobs persist, rate limiting degrades gracefully
- **Network partition**: Isolate a node from the platform → verify no database corruption, stale lock cron recovers

---

## 11. Security Hardening (Production)

### Container Isolation

| Environment      | Runtime          | Isolation Level           |
|------------------|------------------|---------------------------|
| Development      | Docker (runc)    | Kernel sharing            |
| Production       | gVisor / Firecracker | Hardware-virtualized  |

The `ContainerRuntime` interface at `packages/worker/src/runtime/` accepts a `runtime` parameter (`runc`, `gvisor`, `firecracker`) — swapping is a configuration change, not a code change.

### Web Application Firewall

```
Internet → Nginx (TLS termination) → ModSecurity (OWASP CRS) → Next.js
```

The WAF blocks:
- SQL injection attempts (redundant with Prisma, but defense in depth)
- XSS payloads (redundant with React escaping)
- Path traversal, command injection, protocol attacks
- Rate-based DoS at the Nginx level (before hitting the application)

### Container Image Signing

```
Build pipeline:
  1. Build Docker image
  2. Push to registry
  3. cosign sign --key cosign.key <image>
  4. Worker: cosign verify <image> before docker pull
```

Unsigned images are rejected by the worker. The signing key is stored in a secrets manager.

### Audit Log Tamper Detection

Each `AuditLog` row includes a `chainHash` field:
```
chainHash = SHA256(previousRow.chainHash || thisRow.id || thisRow.userId || thisRow.action || thisRow.targetId || thisRow.createdAt)
```

The chain starts at a genesis hash. Walking the chain and recomputing hashes reveals any tampering. An admin dashboard page verifies chain integrity.

---

## 12. Developer Tooling

### CLI (`astral`)

The CLI is a Node.js package in `packages/cli/` that consumes the same REST API:

```bash
astral login                    # Store API key
astral servers list             # List servers
astral servers create --plan starter --image ubuntu-24.04 --region us-east
astral servers ssh my-server    # SSH into server via proxy
astral volumes list
astral volumes attach vol-xxx my-server /dev/sdb
astral dns list my-server
```

### Terraform Provider

The Terraform provider (`packages/terraform-provider/`) maps REST API resources to Terraform resources:

```hcl
resource "astral_server" "web" {
  hostname  = "web-01"
  plan      = "starter"
  image     = "ubuntu-24.04"
  region    = "us-east"
  ssh_key   = astral_ssh_key.laptop.id
}

resource "astral_volume" "data" {
  name   = "web-data"
  size_gb = 100
  region = "us-east"
}

resource "astral_volume_attachment" "data" {
  server_id = astral_server.web.id
  volume_id = astral_volume.data.id
  device    = "/dev/sdb"
}
```

### API SDKs

SDKs are generated from the OpenAPI 3.1 spec using openapi-generator:
- `@astral/sdk-node` — Node.js/TypeScript
- `astral-sdk-python` — Python (PyPI)
- `astral-sdk-go` — Go module

All SDKs share the same authentication (API key via Bearer token), rate limiting, and error handling as direct REST API consumers.

---

## 13. Architectural Principles

1. **Stateless web tier** — The Next.js process stores no in-memory state. All state lives in PostgreSQL or Redis. This allows horizontal scaling of the web tier without sticky sessions.

2. **Async over sync for long operations** — Container provisioning (image pull + create + start) can take seconds to minutes. The web API returns 202 immediately; the worker handles the actual Docker Engine call asynchronously.

3. **Job-level idempotency (Docker-based guard)** — Every BullMQ job checks the **current real-world state** on Docker before acting. Provisioning queries Docker for an existing container with the same server label and skips to database sync if found. Retrying N times converges to the same end state as running once.

4. **Fail-safe resource tracking** — Node capacity and an IP address are **reserved** in the same database transaction (status = CREATING), preventing over-commit. On failure, the worker rolls back: release IP, decrement node counters.

5. **Abstraction over container runtime** — All Docker-specific logic lives behind the `ContainerRuntime` interface. Swapping to another runtime only requires implementing this interface. A mock implementation enables dev/testing without Docker.

6. **Audit everything** — Every state-changing operation generates an immutable AuditLog entry. Logs are append-only. Hash chaining detects tampering.

7. **DB-before-runtime for mutations** — Database writes happen **before** the container runtime call. If the worker crashes mid-job, the database always has a record to recover from. The retry guard queries reality and syncs the database to match.

8. **Pessimistic locking for async operations** — Long-running operations atomically acquire a `lockedBy` lock before enqueuing work. Prevents concurrent conflicting operations. Stale lock cron recovers from worker crashes.

9. **API-first design** — Every feature is built API-first. The web UI, CLI, and Terraform provider all consume the same REST API. No privileged internal endpoints for different clients.

10. **Observability is not optional** — Metrics, structured logs, and distributed traces are built in from day one of production. SLOs define reliability targets; error budgets gate new feature deployment.

11. **Security in depth** — No single layer is trusted. WAF + rate limiting + input validation + ownership checks + container isolation + audit logging + image signing form a defense-in-depth strategy.

12. **Documentation is a feature** — Architecture decisions are recorded as ADRs. The domain model, business rules, glossary, and use cases form the complete specification. Every PR updates the relevant doc.

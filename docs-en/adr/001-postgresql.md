# ADR-001: Use PostgreSQL as Primary Database

| Attribute | Value                          |
|-----------|--------------------------------|
| Date      | 2026-06-26                     |
| Status    | Accepted                       |
| Author    | Bryan                          |

## Context

Astral Cloud needs a primary database to store users, VPS instances, audit logs, plans, images, nodes, and billing data. The data is relational by nature — customers own VPS instances, instances reference plans and nodes, and audit logs reference users and targets — which favors a relational database over document stores.

## Decision

**Use PostgreSQL 16 as the primary database.**

## Alternatives Considered

| Option         | Rejected because...                                                              |
|----------------|----------------------------------------------------------------------------------|
| MySQL/MariaDB  | Weaker JSON support, no `CHECK` constraints natively, no `EXCLUDE` constraints.  |
| SQLite         | Not suitable for concurrent write-heavy workloads; no network access.            |
| MongoDB        | Document model does not fit relational domain (VPS→User, VPS→Node, Audit trail). ACID transactions across collections are limited. |

## Consequences

**Positive:**
- Full ACID compliance — critical for billing and resource allocation.
- Strong schema enforcement via `CHECK` constraints, foreign keys, and unique indexes.
- JSONB column type allows flexible metadata (e.g., `AuditLog.metadata`) without losing relational integrity.
- Mature ecosystem: Prisma ORM, connection pooling (PgBouncer), managed hosting (Supabase, RDS, Crunchy).

**Negative:**
- Requires a separate process/container (unlike SQLite).
- Connection management needed under high concurrency (mitigated by PgBouncer or `pg-pool`).

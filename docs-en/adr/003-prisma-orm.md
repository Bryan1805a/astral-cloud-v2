# ADR-003: Use Prisma as ORM

| Attribute | Value                          |
|-----------|--------------------------------|
| Date      | 2026-06-26                     |
| Status    | Accepted                       |
| Author    | Bryan                          |

## Context

We need a way to interact with PostgreSQL that provides type safety, migration management, and protection against SQL injection. We want to avoid writing raw SQL for basic CRUD operations while maintaining the ability to write raw SQL for complex queries when needed.

## Decision

**Use Prisma as the ORM (Object-Relational Mapper).**

## Alternatives Considered

| Option       | Rejected because...                                                                                        |
|--------------|-------------------------------------------------------------------------------                             |
| Drizzle ORM  | Younger project, smaller community. Prisma's schema-first approach is clearer for a team/learning context. |
| TypeORM      | Complex API, inconsistent documentation, less active maintenance.                                          |
| Knex.js      | Query builder, not an ORM — no typed result objects by default, manual schema management.                  |
| Raw SQL      | No type safety, tedious boilerplate, manual migration tracking.                                            |

## Consequences

**Positive:**
- Schema-first design: `schema.prisma` serves as both documentation and source of truth for the database schema.
- Auto-generated TypeScript types for all queries and mutations — no manual typing.
- Declarative migration system (`prisma migrate dev`) with auto-generated SQL.
- `prisma studio` provides a visual database browser during development.
- Supports transactions and raw queries (`$queryRaw`) when ORM abstractions are insufficient.
- Prisma client can be shared between the web app and the worker package in our monorepo.

**Negative:**
- Prisma client is a generated binary — adds build complexity and ~2–5 MB to the bundle.
- N+1 queries can occur without careful use of `include`. Mitigated by code review and Prisma's `findMany` with `include`.
- Not optimized for extremely complex analytical queries (which we don't need for MVP).
- Adds a dependency. If Prisma is abandoned, we'd need to migrate to another ORM or raw SQL.

# ADR-002: Use Next.js as Full-Stack Framework

| Attribute | Value                          |
|-----------|--------------------------------|
| Date      | 2026-06-26                     |
| Status    | Accepted                       |
| Author    | Bryan                          |

## Context

Astral Cloud needs both a web frontend (dashboard, landing page) and a backend API (REST endpoints for VPS management, auth, billing). For the MVP, we want to minimize infrastructure complexity and maximize development velocity. We also want type safety shared between frontend and backend.

## Decision

**Use Next.js 14 (App Router) as the full-stack framework** — serving both server-rendered React pages and REST API routes from a single project.

## Alternatives Considered

| Option                 | Rejected because...                                                           |
|------------------------|-------------------------------------------------------------------------------|
| React (Vite) + Express | Two separate projects doubles tooling, deployment, and loses shared types.    |
| Remix                  | Smaller ecosystem, fewer component libraries. Next.js has wider adoption.     |
| Nuxt (Vue)             | Vue ecosystem; team preference for React.                                     |
| Separate React SPA + Go backend | Higher complexity for MVP; two languages, two deployment units.       |

## Consequences

**Positive:**
- Single TypeScript codebase — shared Zod schemas, types, and utilities between frontend and backend.
- NextAuth.js integrates natively with Next.js for JWT-based auth.
- API routes can be colocated with pages — natural code organization.
- Vercel deployment is trivial, but Docker deploy also works.
- React Server Components reduce client-side JS bundle size for data-heavy pages.

**Negative:**
- API routes run in a serverless-like model (Request/Response). Long-lived WebSocket connections are not natively supported (but not needed for MVP).
- The frontend and backend scale together in the same process. Mitigated by extracting the worker into a separate process (see ADR-005).
- Next.js convention-heavy — opinions on routing and data fetching must be learned.

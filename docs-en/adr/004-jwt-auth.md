# ADR-004: Use JWT-Based Authentication with Refresh Tokens

| Attribute | Value                          |
|-----------|--------------------------------|
| Date      | 2026-06-26                     |
| Status    | Accepted                       |
| Author    | Bryan                          |

## Context

Users must authenticate to manage VPS instances. The authentication system needs to be stateless (no server-side session store) so that the web tier can scale horizontally. We also need to support both credential-based login (username/password) and — optionally — social login (OAuth2).

## Decision

**Use JWT (JSON Web Token) for authentication**, with:
- **Access tokens**: short-lived (1 hour), signed with HS256, stored in memory/closure on the client (not localStorage).
- **Refresh tokens**: longer-lived (7 days), opaque, stored in an HTTP-only cookie.
- **NextAuth.js v5** as the authentication library (handles JWT issuance, rotation, and provider configuration).

## Alternatives Considered

| Option               | Rejected because...                                                                                                                       |
|----------------------|-------------------------------------------------------------------------------------------------------------------------------------------|
| Server-side sessions | Requires session store (Redis or DB), adds latency to every request, complicates horizontal scaling.                                      |
| API keys             | Less secure for browser-based apps; no built-in expiry/rotation mechanism.                                                                |
| OAuth-only           | Some customers prefer email/password. We need both.                                                                                       |
| DIY JWT              | Re-inventing token rotation, CSRF protection, and session invalidation is error-prone. NextAuth.js handles these securely out of the box. |

## Consequences

**Positive:**
- Stateless authentication — no database lookup needed on every API call (JWT is self-contained).
- NextAuth.js integrates seamlessly with Next.js App Router.
- Built-in CSRF protection, secure cookie handling, and OAuth provider support.
- Access token rotation is handled transparently.
- Refresh tokens can be revoked server-side if needed (by storing a deny-list in Redis).

**Negative:**
- Token revocation before natural expiry requires a blocklist (Redis or database).
- JWT payload size increases with each added claim (kept minimal — only `userId` and `role`).
- Refresh token stored in a cookie is vulnerable to CSRF if not properly configured. Mitigated by NextAuth's CSRF protection and `SameSite=Strict` cookies.

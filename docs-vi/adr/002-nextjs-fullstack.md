# ADR-002: Sử dụng Next.js làm Full-Stack Framework

| Attribute | Value                          |
|-----------|--------------------------------|
| Date      | 2026-06-26                     |
| Status    | Accepted                       |
| Author    | Bryan                          |

## Context

Astral Cloud cần cả một web frontend (dashboard, landing page) và một backend API (REST endpoints cho VPS management, auth, billing). Đối với MVP, chúng tôi muốn giảm thiểu độ phức tạp của infrastructure và tối đa hóa tốc độ phát triển. Chúng tôi cũng muốn type safety được chia sẻ giữa frontend và backend.

## Decision

**Sử dụng Next.js 14 (App Router) làm full-stack framework** — phục vụ đồng thời cả server-rendered React pages và REST API routes từ một project duy nhất.

## Alternatives Considered

| Option                 | Rejected because...                                                           |
|------------------------|-------------------------------------------------------------------------------|
| React (Vite) + Express | Hai project riêng biệt nhân đôi tooling, deployment và mất shared types.    |
| Remix                  | Hệ sinh thái nhỏ hơn, ít component libraries hơn. Next.js có mức độ áp dụng rộng hơn.     |
| Nuxt (Vue)             | Hệ sinh thái Vue; team ưu tiên React.                                     |
| Separate React SPA + Go backend | Độ phức tạp cao hơn cho MVP; hai ngôn ngữ, hai deployment units.       |

## Consequences

**Positive:**
- Codebase TypeScript duy nhất — chia sẻ Zod schemas, types và utilities giữa frontend và backend.
- NextAuth.js tích hợp native với Next.js cho JWT-based auth.
- API routes có thể được đặt cùng vị trí với pages — tổ chức code tự nhiên.
- Triển khai trên Vercel đơn giản, nhưng Docker deploy cũng hoạt động.
- React Server Components giảm kích thước client-side JS bundle cho các trang nặng dữ liệu.

**Negative:**
- API routes chạy trong mô hình serverless-like (Request/Response). Long-lived WebSocket connections không được hỗ trợ native (nhưng không cần thiết cho MVP).
- Frontend và backend scale cùng nhau trong cùng một process. Được giảm thiểu bằng cách tách worker thành một process riêng (xem ADR-005).
- Next.js nặng convention — các quy ước về routing và data fetching cần phải học.

# ADR-001: Sử dụng PostgreSQL làm Cơ sở dữ liệu Chính

| Attribute | Value                          |
|-----------|--------------------------------|
| Date      | 2026-06-26                     |
| Status    | Accepted                       |
| Author    | Bryan                          |

## Context

Astral Cloud cần một cơ sở dữ liệu chính để lưu trữ users, VPS instances, audit logs, plans, images, nodes và dữ liệu billing. Dữ liệu có bản chất quan hệ — customers sở hữu VPS instances, instances tham chiếu đến plans và nodes, và audit logs tham chiếu đến users và targets — điều này ưu tiên một cơ sở dữ liệu quan hệ hơn là document stores.

## Decision

**Sử dụng PostgreSQL 16 làm cơ sở dữ liệu chính.**

## Alternatives Considered

| Option         | Rejected because...                                                              |
|----------------|----------------------------------------------------------------------------------|
| MySQL/MariaDB  | Hỗ trợ JSON yếu hơn, không có `CHECK` constraints native, không có `EXCLUDE` constraints.  |
| SQLite         | Không phù hợp cho các workload ghi đồng thời cao; không có network access.            |
| MongoDB        | Document model không phù hợp với miền quan hệ (VPS→User, VPS→Node, Audit trail). ACID transactions trên các collections bị giới hạn. |

## Consequences

**Positive:**
- Tuân thủ ACID đầy đủ — quan trọng cho billing và resource allocation.
- Ràng buộc schema mạnh mẽ thông qua `CHECK` constraints, foreign keys và unique indexes.
- Kiểu cột JSONB cho phép metadata linh hoạt (ví dụ: `AuditLog.metadata`) mà không làm mất tính toàn vẹn quan hệ.
- Hệ sinh thái trưởng thành: Prisma ORM, connection pooling (PgBouncer), managed hosting (Supabase, RDS, Crunchy).

**Negative:**
- Yêu cầu một process/container riêng biệt (không giống SQLite).
- Cần quản lý connection khi có high concurrency (được giảm thiểu bởi PgBouncer hoặc `pg-pool`).

# ADR-003: Sử dụng Prisma làm ORM

| Attribute | Value                          |
|-----------|--------------------------------|
| Date      | 2026-06-26                     |
| Status    | Accepted                       |
| Author    | Bryan                          |

## Context

Chúng tôi cần một cách để tương tác với PostgreSQL cung cấp type safety, quản lý migration và bảo vệ chống SQL injection. Chúng tôi muốn tránh viết raw SQL cho các thao tác CRUD cơ bản trong khi vẫn duy trì khả năng viết raw SQL cho các truy vấn phức tạp khi cần.

## Decision

**Sử dụng Prisma làm ORM (Object-Relational Mapper).**

## Alternatives Considered

| Option       | Rejected because...                                                                                        |
|--------------|-------------------------------------------------------------------------------                             |
| Drizzle ORM  | Dự án trẻ hơn, cộng đồng nhỏ hơn. Cách tiếp cận schema-first của Prisma rõ ràng hơn cho ngữ cảnh nhóm/học tập. |
| TypeORM      | API phức tạp, tài liệu không nhất quán, bảo trì kém tích cực hơn.                                          |
| Knex.js      | Query builder, không phải ORM — không có typed result objects mặc định, quản lý schema thủ công.                  |
| Raw SQL      | Không có type safety, boilerplate nhàm chán, theo dõi migration thủ công.                                            |

## Consequences

**Positive:**
- Thiết kế schema-first: `schema.prisma` đóng vai trò vừa là tài liệu vừa là nguồn chân lý cho database schema.
- TypeScript types được tạo tự động cho tất cả queries và mutations — không cần gõ kiểu thủ công.
- Hệ thống migration khai báo (`prisma migrate dev`) với SQL được tạo tự động.
- `prisma studio` cung cấp một trình duyệt database trực quan trong quá trình phát triển.
- Hỗ trợ transactions và raw queries (`$queryRaw`) khi các trừu tượng ORM không đủ.
- Prisma client có thể được chia sẻ giữa web app và worker package trong monorepo của chúng tôi.

**Negative:**
- Prisma client là một binary được tạo ra — thêm độ phức tạp build và ~2–5 MB vào bundle.
- N+1 queries có thể xảy ra nếu không sử dụng `include` cẩn thận. Được giảm thiểu bởi code review và `findMany` với `include` của Prisma.
- Không được tối ưu cho các truy vấn phân tích cực kỳ phức tạp (điều chúng tôi không cần cho MVP).
- Thêm một dependency. Nếu Prisma bị bỏ rơi, chúng tôi sẽ cần migrate sang một ORM khác hoặc raw SQL.

# ADR-004: Sử dụng Xác thực dựa trên JWT với Refresh Tokens

| Attribute | Value                          |
|-----------|--------------------------------|
| Date      | 2026-06-26                     |
| Status    | Accepted                       |
| Author    | Bryan                          |

## Context

Users phải xác thực để quản lý VPS instances. Hệ thống xác thực cần phải stateless (không có server-side session store) để web tier có thể scale theo chiều ngang. Chúng tôi cũng cần hỗ trợ cả đăng nhập dựa trên credential (username/password) và — tùy chọn — social login (OAuth2).

## Decision

**Sử dụng JWT (JSON Web Token) cho xác thực**, với:
- **Access tokens**: thời hạn ngắn (1 giờ), ký bằng HS256, lưu trữ trong memory/closure trên client (không phải localStorage).
- **Refresh tokens**: thời hạn dài hơn (7 ngày), opaque, lưu trữ trong HTTP-only cookie.
- **NextAuth.js v5** làm thư viện xác thực (xử lý JWT issuance, rotation và cấu hình provider).

## Alternatives Considered

| Option               | Rejected because...                                                                                                                       |
|----------------------|-------------------------------------------------------------------------------------------------------------------------------------------|
| Server-side sessions | Yêu cầu session store (Redis hoặc DB), thêm độ trễ cho mỗi request, làm phức tạp horizontal scaling.                                      |
| API keys             | Kém an toàn hơn cho các ứng dụng dựa trên trình duyệt; không có cơ chế expiry/rotation tích hợp.                                                                |
| OAuth-only           | Một số customers thích email/password hơn. Chúng tôi cần cả hai.                                                                                       |
| DIY JWT              | Tự phát minh lại token rotation, CSRF protection và session invalidation dễ mắc lỗi. NextAuth.js xử lý những điều này an toàn ngay từ đầu. |

## Consequences

**Positive:**
- Xác thực stateless — không cần tra cứu database trên mỗi API call (JWT là self-contained).
- NextAuth.js tích hợp liền mạch với Next.js App Router.
- CSRF protection tích hợp, xử lý cookie an toàn và hỗ trợ OAuth provider.
- Access token rotation được xử lý minh bạch.
- Refresh tokens có thể bị thu hồi phía server nếu cần (bằng cách lưu trữ deny-list trong Redis).

**Negative:**
- Thu hồi token trước khi hết hạn tự nhiên yêu cầu một blocklist (Redis hoặc database).
- Kích thước JWT payload tăng với mỗi claim được thêm vào (được giữ ở mức tối thiểu — chỉ `userId` và `role`).
- Refresh token được lưu trong cookie dễ bị CSRF nếu không được cấu hình đúng. Được giảm thiểu bởi CSRF protection của NextAuth và cookie `SameSite=Strict`.

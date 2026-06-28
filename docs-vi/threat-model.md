# Threat Model — Nền tảng Astral Cloud

Tài liệu này phân tích các mối đe dọa bảo mật đối với nền tảng Astral Cloud sử dụng phương pháp **STRIDE**. Các mối đe dọa được tổ chức theo thành phần hệ thống và mỗi mối đe dọa bao gồm đánh giá mức độ nghiêm trọng và chiến lược giảm thiểu.

---

## Phương pháp

**STRIDE** phân loại mối đe dọa theo mục tiêu của kẻ tấn công:

| Category             | Property Violated     |
|----------------------|-----------------------|
| Spoofing             | Authentication        |
| Tampering            | Integrity             |
| Repudiation          | Non-repudiation       |
| Information Disclosure | Confidentiality     |
| Denial of Service    | Availability          |
| Elevation of Privilege | Authorization       |

Định nghĩa **Severity** cho nền tảng này:

| Severity  | Meaning                                                      |
|-----------|--------------------------------------------------------------|
| Critical  | Vi phạm dữ liệu khách hàng trực tiếp, tổn thất tài chính hoặc chiếm quyền nền tảng |
| High      | Lộ hoặc gián đoạn đáng kể, có thể ảnh hưởng đến nhiều người dùng    |
| Medium    | Lộ giới hạn, ảnh hưởng một người dùng hoặc yêu cầu khai thác chuỗi |
| Low       | Tác động tối thiểu, vấn đề phòng thủ chuyên sâu hoặc rủi ro được chấp nhận         |

**Thẻ giảm thiểu:** `[MVP]` — phải có sẵn cho bản phát hành đầu tiên. `*post-MVP*` — dự kiến cho sau này.

---

## 1. Ứng dụng Web (Next.js)

### T-01 — Brute-Force Thông Tin Xác Thực

| Attribute      | Value |
|----------------|-------|
| **Category**   | Spoofing |
| **Severity**   | High |
| **Mitigation** | Khóa tài khoản sau 5 lần thất bại liên tiếp trong khoảng thời gian 10 phút; thời gian khóa 15 phút ([BR-23]). Giới hạn tốc độ theo IP và theo tài khoản trên `/api/auth/login` và tất cả các endpoint dựa trên thông tin xác thực. Bộ đếm lần thử thất bại được lưu trong Redis với cửa sổ trượt. Thông báo lỗi chung chung ngăn việc liệt kê tên người dùng. [MVP] |

### T-02 — Giả Mạo JWT Token

| Attribute      | Value |
|----------------|-------|
| **Category**   | Spoofing |
| **Severity**   | Critical |
| **Mitigation** | JWT được ký bằng HS256 sử dụng secret ít nhất 256 bit (32 byte ngẫu nhiên). Access token có thời gian sống ngắn (15 phút) với cơ chế xoay refresh token. Refresh token được băm trước khi lưu vào DB (qua Session.refreshTokenHash). NextAuth.js v5 thực thi xác minh chữ ký trên mỗi request. JWT secret được lưu trữ độc quyền trong biến môi trường, không bao giờ trong code hoặc file cấu hình. [MVP] |

### T-03 — Cross-Site Request Forgery (CSRF)

| Attribute      | Value |
|----------------|-------|
| **Category**   | Tampering |
| **Severity**   | Medium |
| **Mitigation** | NextAuth.js v5 cung cấp bảo vệ CSRF tích hợp cho các route xác thực. Session cookie được đặt với `SameSite=Strict`. Tất cả các API route thay đổi trạng thái yêu cầu header `Authorization: Bearer <token>` — không sử dụng cookie-based session cho các API mutation. SameSite + Bearer token cùng nhau ngăn CSRF trên cả bề mặt trình duyệt và API. [MVP] |

### T-04 — SQL Injection / Cross-Site Scripting (XSS)

| Attribute      | Value |
|----------------|-------|
| **Category**   | Tampering |
| **Severity**   | Critical |
| **Mitigation** | Tất cả đầu vào API được xác thực bằng Zod schema trước khi xử lý (kiểu chặt chẽ, giới hạn độ dài, xác thực định dạng). Prisma tạo các truy vấn tham số hóa — không nối chuỗi SQL thô. React tự động escape đầu ra (không `dangerouslySetInnerHTML` nếu không có sanitization). Header `Content-Security-Policy` hạn chế nguồn script và không cho phép inline script. Markdown được render qua thư viện an toàn (ví dụ: remark) với HTML pass-through bị vô hiệu hóa. [MVP] |

### T-05 — Phát Lại Idempotency-Key

| Attribute      | Value |
|----------------|-------|
| **Category**   | Tampering |
| **Severity**   | High |
| **Mitigation** | Idempotency key được gắn phạm vi theo người dùng (key là tổ hợp `userId + key`). Key được lưu trong Redis với TTL 24 giờ. Server kiểm tra Redis trước khi xử lý: nếu key tồn tại với phản hồi đã ghi, bản sao bị từ chối với 409 Conflict. Request đầu tiên đặt key một cách nguyên tử qua `SET NX`. Điều này ngăn phát lại chéo người dùng và giới hạn cửa sổ lạm dụng trong cùng một người dùng trong TTL. [MVP] |

### T-06 — Liệt Kê Người Dùng Qua Lỗi Đăng Nhập/Đăng Ký

| Attribute      | Value |
|----------------|-------|
| **Category**   | Information Disclosure |
| **Severity**   | Medium |
| **Mitigation** | Thông báo lỗi chung chung trên tất cả các endpoint xác thực: "Invalid credentials" bất kể email/username có tồn tại hay không, và "If an account with that email exists, a verification link has been sent" cho đăng ký. Giới hạn tốc độ trên endpoint đăng nhập/đăng ký tiếp tục ngăn việc liệt kê qua phân tích thời gian. [MVP] |

### T-07 — Secrets Trong Code Hoặc Log

| Attribute      | Value |
|----------------|-------|
| **Category**   | Information Disclosure |
| **Severity**   | Critical |
| **Mitigation** | Tất cả secrets (JWT secret, mật khẩu database, Stripe keys, Docker credentials, email API keys) được lưu trữ độc quyền trong biến môi trường. File `.env` được gitignore; chỉ `.env.example` với giá trị placeholder được commit. Structured logging (JSON) với redaction cấp trường: bất kỳ trường nào khớp với pattern khóa bí mật đã biết hoặc chứa `password`, `secret`, `token`, `key` được thay thế bằng `[REDACTED]`. Pre-commit hook quét secrets qua công cụ. [MVP] |

### T-08 — Rò Rỉ Dữ Liệu Server Giữa Các Khách Hàng

| Attribute      | Value |
|----------------|-------|
| **Category**   | Information Disclosure |
| **Severity**   | Critical |
| **Mitigation** | Mọi truy vấn database được gắn phạm vi theo `userId` trích xuất từ JWT đã xác minh — `userId` không bao giờ được nhận từ request body hoặc URL parameter. Các hàm cấp service nhận `userId` như một tham số tin cậy từ auth middleware. Row-Level Security (RLS) có thể được thêm lớp *post-MVP*. API route cho các thao tác server (start, stop, delete, view) kiểm tra `server.userId === session.userId` trước khi tiến hành. [MVP] |

### T-09 — Cạn Kiệt Tài Nguyên API (DoS)

| Attribute      | Value |
|----------------|-------|
| **Category**   | Denial of Service |
| **Severity**   | High |
| **Mitigation** | Giới hạn tốc độ theo loại endpoint qua Redis counter: auth endpoint (5/phút mỗi IP), standard API (60/phút mỗi người dùng), thao tác tốn kém như tạo server (10/phút mỗi người dùng). Rate limit header được trả về trên tất cả phản hồi. Connection timeout được đặt trên tất cả các cuộc gọi bên ngoài (Stripe, Docker, SMTP). Next.js server được cấu hình với giới hạn kích thước body hợp lý (ví dụ: 1 MB cho JSON, 5 MB cho upload file). [MVP] |

### T-10 — Spam Tạo Server

| Attribute      | Value |
|----------------|-------|
| **Category**   | Denial of Service |
| **Severity**   | Medium |
| **Mitigation** | Giới hạn server đang hoạt động 5 máy mỗi khách hàng ([BR-06]) đóng vai trò giới hạn cứng. Endpoint tạo server bị giới hạn tốc độ (10/phút mỗi người dùng). Kiểm tra số dư được thực thi trước khi tạo ([BR-27]) — số dư không đủ ngăn việc tạo. Kết hợp lại, những điều này ngăn một người dùng làm cạn kiệt tài nguyên node ngay cả ở tốc độ tạo tối đa. [MVP] |

### T-11 — Leo Thang Đặc Quyền Ngang

| Attribute      | Value |
|----------------|-------|
| **Category**   | Elevation of Privilege |
| **Severity**   | Critical |
| **Mitigation** | Kiểm tra quyền sở hữu trên mọi thao tác server: `userId` của server phải khớp với `userId` của người dùng đã xác thực từ JWT. Việc kiểm tra này được thực hiện ở tầng service, không phải client. API route không nhận `userId` hoặc `serverId` từ client cho các thao tác có phạm vi chủ sở hữu — server ID đến từ URL parameter và user ID từ JWT; cả hai đều được xác minh khớp. [MVP] |

### T-12 — Leo Thang Đặc Quyền Dọc

| Attribute      | Value |
|----------------|-------|
| **Category**   | Elevation of Privilege |
| **Severity**   | Critical |
| **Mitigation** | JWT role (`CUSTOMER`, `STAFF`, `ADMIN`) được xác minh bởi middleware trên tất cả các route có phạm vi admin. Admin API route (`/api/admin/*`) yêu cầu role `ADMIN`. Staff route yêu cầu `STAFF` hoặc `ADMIN`. Middleware từ chối với 403 trước khi bất kỳ handler nào thực thi. Xác minh lại role phía server cho các thao tác nhạy cảm (đình chỉ người dùng, sửa đổi gói, quản lý node) ngay cả trong admin route. [MVP] |

### T-13 — Giả Mạo JWT Role

| Attribute      | Value |
|----------------|-------|
| **Category**   | Elevation of Privilege |
| **Severity**   | Critical |
| **Mitigation** | Chữ ký JWT được xác minh bởi NextAuth.js v5 trên mỗi request — token bị giả mạo bị từ chối trước khi đến code ứng dụng. Role được nhúng trong JWT payload khi tạo session, lấy từ database `User.role` tại thời điểm đó. Đối với các thao tác nhạy cảm (truy cập admin panel, mạo danh người dùng, thay đổi cài đặt hệ thống), role được xác minh lại với database ngoài việc kiểm tra JWT. Xoay refresh token đảm bảo ngay cả khi token bị xâm phạm, cửa sổ lạm dụng của nó bị giới hạn. [MVP] |

### T-14 — Bỏ Qua 2FA

| Attribute      | Value |
|----------------|-------|
| **Category**   | Spoofing |
| **Severity**   | High |
| **Mitigation** | 2FA (TOTP) được thực thi cho tất cả tài khoản ADMIN ([BR-24]). TOTP secret được mã hóa khi lưu trữ bằng AES-256-GCM với khóa dẫn xuất từ biến môi trường — không lưu dưới dạng plaintext trong bảng TwoFactorAuth. Backup code được băm bằng bcrypt trước khi lưu. Xác minh 2FA được yêu cầu trên mỗi lần tạo session mới, không chỉ khi đăng nhập. Giới hạn tốc độ trên các lần thử xác minh TOTP (5 lần thử mỗi 15 phút). Session không được nâng lên trạng thái đã xác thực cho đến khi mã 2FA được xác minh. [MVP] |

### T-15 — Lạm Dụng Token Đặt Lại Mật Khẩu

| Attribute      | Value |
|----------------|-------|
| **Category**   | Spoofing |
| **Severity**   | High |
| **Mitigation** | Token đặt lại mật khẩu là ngẫu nhiên mật mã (32 byte, mã hóa hex), được lưu dưới dạng băm trong Redis với TTL ngắn (15 phút). Token chỉ dùng một lần: token đã xác minh bị vô hiệu hóa ngay lập tức. Giới hạn tốc độ trên endpoint yêu cầu đặt lại mật khẩu (3 lần mỗi giờ mỗi email). Liên kết đặt lại được gửi qua email, không bao giờ trả về trong API response. Token không gắn với bất kỳ lưu trữ bền vững nào — xác thực là stateless qua so sánh băm. [MVP] |

### T-16 — Lạm Dụng Upload File (Ảnh Bìa Blog)

| Attribute      | Value |
|----------------|-------|
| **Category**   | Tampering |
| **Severity**   | Medium |
| **Mitigation** | Xác thực loại file qua magic byte (không phải extension) — chỉ `image/jpeg`, `image/png`, `image/webp` được chấp nhận. Kích thước file tối đa 5 MB được thực thi ở tầng API trước khi xử lý. File đã upload được lưu trong object storage (không được phục vụ từ application server). Content-Disposition được đặt thành `attachment` cho các đường dẫn không tin cậy. Quét virus file upload *post-MVP*. [MVP] |

---

## 2. BullMQ Worker

### T-17 — Tiêm Job Độc Hại

| Attribute      | Value |
|----------------|-------|
| **Category**   | Tampering |
| **Severity**   | Critical |
| **Mitigation** | Redis instance không được lộ ra bên ngoài — chỉ gắn với internal Docker network (không ánh xạ cổng ra host). Dữ liệu BullMQ job được xác thực với Zod schema trong worker trước khi bất kỳ hành động nào được thực hiện. Job được enqueue độc quyền bởi ứng dụng web (phía tin cậy), không bao giờ trực tiếp bởi client bên ngoài. Redis được bảo vệ bằng mật khẩu trong production (`requirepass`). [MVP] |

### T-18 — Làm Ngập Job Queue

| Attribute      | Value |
|----------------|-------|
| **Category**   | Denial of Service |
| **Severity**   | Medium |
| **Mitigation** | Giới hạn đồng thời theo loại job được cấu hình trong BullMQ (ví dụ: tối đa 3 job provisioning đồng thời, tối đa 5 job notification đồng thời). Ưu tiên job đảm bảo các job quan trọng (provisioning, billing) được xử lý trước các job ưu tiên thấp hơn. Giới hạn tốc độ API ở tầng web ngăn việc enqueue quá mức tại nguồn. BullMQ tích hợp sẵn phát hiện job bị stall và retry với backoff ngăn vòng lặp retry vô hạn. [MVP] |

### T-19 — Docker Credentials Trong Worker Log

| Attribute      | Value |
|----------------|-------|
| **Category**   | Information Disclosure |
| **Severity**   | High |
| **Mitigation** | Docker API credentials (TLS certs, endpoint URLs) được lưu trong biến môi trường, không bao giờ hardcode. Structured JSON logging với redaction cấp trường: bất kỳ trường log nào chứa pattern credential bị redact trước khi phát ra. Worker log level được đặt thành `info` trong production (không phải `debug`), ngăn chặn verbose request/response body có thể chứa credentials trong quá trình truyền. [MVP] |

### T-20 — MITM Trên Docker API Calls

| Attribute      | Value |
|----------------|-------|
| **Category**   | Information Disclosure / Tampering |
| **Severity**   | Critical |
| **Mitigation** | Đối với Docker daemon từ xa (production node), tất cả giao tiếp sử dụng TLS (`tcp://node:2376` với xác minh TLS). Docker TLS certificates (CA, client cert, client key) được xác minh trước mỗi kết nối. Đối với development cục bộ, Unix socket (`unix:///var/run/docker.sock`) được sử dụng, không dễ bị MITM mạng. Xác minh certificate không bao giờ bị vô hiệu hóa, ngay cả trong development với Docker cục bộ. [MVP] |

---

## 3. Database (PostgreSQL)

### T-21 — Truy Cập Database Trực Tiếp Từ Bên Ngoài

| Attribute      | Value |
|----------------|-------|
| **Category**   | Spoofing / Information Disclosure |
| **Severity**   | Critical |
| **Mitigation** | Cổng PostgreSQL (5432) không được lộ ra host hoặc mạng bên ngoài — chỉ gắn độc quyền với internal Docker network. Mật khẩu database mạnh, được tạo ngẫu nhiên, lưu trong biến môi trường. PostgreSQL được cấu hình với `pg_hba.conf` chỉ cho phép xác thực `md5`/`scram-sha-256` từ internal Docker subnet. Không xác thực `trust`, ngay cả trong development. [MVP] |

### T-22 — Dữ Liệu Không Mã Hóa Khi Lưu Trữ

| Attribute      | Value |
|----------------|-------|
| **Category**   | Information Disclosure |
| **Severity**   | High |
| **Mitigation** | Mật khẩu người dùng được băm bằng bcrypt (cost factor ≥ 12). Mật khẩu root server được mã hóa bằng AES-256-GCM trước khi lưu trong `ServerInstance.rootPassword`. TOTP secret được mã hóa khi lưu trữ. Dữ liệu phương thức thanh toán không bao giờ được lưu — chỉ tokenization của Stripe ([BR-31]). Transparent Data Encryption (TDE) cấp database *post-MVP* để bảo vệ toàn bộ dữ liệu khi lưu trữ. [MVP] |

### T-23 — Sửa Đổi Database Trái Phép

| Attribute      | Value |
|----------------|-------|
| **Category**   | Tampering |
| **Severity**   | High |
| **Mitigation** | Database user được gắn phạm vi với quyền tối thiểu cần thiết: web application user có SELECT/INSERT/UPDATE/DELETE trên các bảng ứng dụng nhưng không có quyền DDL (không CREATE/ALTER/DROP). Migration user riêng biệt và chỉ được sử dụng trong quá trình triển khai. Bảng `AuditLog` sử dụng mẫu append-only — code ứng dụng không bao giờ thực hiện UPDATE hoặc DELETE đối với nó (được thực thi bởi database permission). Row-Level Security *post-MVP*. [MVP] |

### T-24 — Cạn Kiệt Kết Nối

| Attribute      | Value |
|----------------|-------|
| **Category**   | Denial of Service |
| **Severity**   | Medium |
| **Mitigation** | Prisma được cấu hình với `connection_limit` hợp lý (mặc định: `num_cpus * 2 + 1`). Connection pooling qua PgBouncer hoặc `pg-pool` trong production để tái sử dụng kết nối dưới tải. Idle connection timeout được đặt để ngăn kết nối chết tích lũy. Lỗi kết nối database được bắt ở tầng ứng dụng với retry exponential backoff. [MVP] |

---

## 4. Redis

### T-25 — Truy Cập Redis Không Xác Thực

| Attribute      | Value |
|----------------|-------|
| **Category**   | Spoofing / Information Disclosure |
| **Severity**   | Critical |
| **Mitigation** | Cổng Redis (6379) không được lộ ra bên ngoài — chỉ gắn với internal Docker network. `protected-mode yes` được bật để từ chối kết nối từ các interface không phải loopback trừ khi được cấu hình rõ ràng. `requirepass` được đặt với mật khẩu mạnh trong production. Không cần `rename-command` vì Redis không thể truy cập từ bên ngoài. [MVP] |

### T-26 — Cạn Kiệt Bộ Nhớ Redis

| Attribute      | Value |
|----------------|-------|
| **Category**   | Denial of Service |
| **Severity**   | Medium |
| **Mitigation** | Redis `maxmemory` policy được cấu hình (`maxmemory-policy volatile-lru`) để loại bỏ các key ít được sử dụng gần đây nhất có TTL khi đạt giới hạn bộ nhớ. Job payload được giữ tối thiểu (chỉ ID và tham chiếu, không phải dữ liệu entity đầy đủ). BullMQ completed job retention được cấu hình với TTL (ví dụ: 24 giờ cho hầu hết các loại job, 7 ngày cho job liên quan đến audit). Session và rate-limit key có TTL để tự động hết hạn. Sử dụng bộ nhớ được giám sát với cảnh báo admin khi vượt ngưỡng. [MVP] |

---

## 5. Docker Engine (Container Runtime)

### T-27 — Truy Cập Docker API Trái Phép

| Attribute      | Value |
|----------------|-------|
| **Category**   | Spoofing / Elevation of Privilege |
| **Severity**   | Critical |
| **Mitigation** | Docker socket (`/var/run/docker.sock`) quyền bị hạn chế chỉ cho nhóm `docker` — worker process chạy với tư cách thành viên của nhóm này. Trong production (các node host riêng biệt), Docker API chỉ được lộ qua TCP có xác thực TLS (`:2376`), không bao giờ là plaintext (`:2375`). Docker API không bao giờ được lộ cho khách hàng — chỉ web application và worker tương tác với nó. Quy tắc firewall hạn chế truy cập vào cổng Docker API chỉ cho dải IP nội bộ của nền tảng. [MVP] |

### T-28 — Container Breakout (Khách Hàng A Truy Cập Container Của Khách Hàng B)

| Attribute      | Value |
|----------------|-------|
| **Category**   | Information Disclosure / Elevation of Privilege |
| **Severity**   | Critical |
| **Mitigation** | Mỗi Docker container được gắn nhãn với `serverId` và `userId` tại thời điểm tạo. Worker xác thực quyền sở hữu bằng cách kiểm tra nhãn container trước mỗi thao tác vòng đời (start, stop, delete): `userId` từ job payload phải khớp với nhãn `userId` của container. Docker internal bridge network cô lập các container với nhau — không có định tuyến liên container nếu không có network attachment rõ ràng. Tên container bao gồm tiền tố `serverId` như một lớp phòng thủ bổ sung. [MVP] |

### T-29 — Cạn Kiệt Tài Nguyên Trên Docker Host

| Attribute      | Value |
|----------------|-------|
| **Category**   | Denial of Service |
| **Severity**   | High |
| **Mitigation** | Đặt trước tài nguyên nguyên tử qua conditional UPDATE trong PostgreSQL ngăn phân bổ quá mức ([BR-05]). Docker container được cấu hình với cgroup resource limit: `--cpus` cho CPU, `--memory` cho RAM, và giới hạn kích thước volume cho disk. Các giới hạn này được đặt từ thông số gói trong quá trình tạo container, ngăn bất kỳ container nào tiêu thụ nhiều hơn mức được phân bổ. Sử dụng tài nguyên node được giám sát; cảnh báo admin được kích hoạt khi sử dụng vượt quá 80%. [MVP] |

### T-30 — Giả Mạo Docker API Request

| Attribute      | Value |
|----------------|-------|
| **Category**   | Tampering |
| **Severity**   | High |
| **Mitigation** | TLS với xác minh certificate cho tất cả các cuộc gọi Docker API từ xa. Tất cả tham số gửi đến Docker API được xác thực với Zod schema trước khi gửi (cấu hình container, giới hạn tài nguyên, biến môi trường). Worker sử dụng interface `ContainerRuntime` có kiểu — tất cả các cuộc gọi đều đi qua một client duy nhất, đã được xác thực. Không có cuộc gọi Docker API thô nào bên ngoài runtime adapter. [MVP] |

### T-31 — Container Image Độc Hại

| Attribute      | Value |
|----------------|-------|
| **Category**   | Tampering |
| **Severity**   | High |
| **Mitigation** | Khách hàng không thể upload container image tùy chỉnh — chỉ các bản ghi `ImageTemplate` do admin quản lý mới có sẵn để tạo server. Tham chiếu image trỏ đến container registry được kiểm soát (`registry.astral.cloud`). Cần admin review và phê duyệt trước khi image có sẵn cho khách hàng. Xác minh chữ ký image (Docker Content Trust / Notary) *post-MVP* để xác minh mật mã tính toàn vẹn của image tại thời điểm pull. [MVP] |

### T-32 — Container Escape / Kernel Exploit

| Attribute      | Value |
|----------------|-------|
| **Category**   | Elevation of Privilege |
| **Severity**   | Critical |
| **Mitigation** | Container chia sẻ host kernel — đây là **rủi ro được chấp nhận** cho MVP learning project. Các thực hành bảo mật Docker tiêu chuẩn được áp dụng: container chạy với tư cách non-root user khi có thể (qua directive `USER` trong curated image), capabilities bị loại bỏ (`--cap-drop=ALL`, `--cap-add` chỉ những gì cần thiết), không privileged mode, root filesystem chỉ đọc khi khả thi, seccomp và AppArmor profile được áp dụng. Cho production: gVisor (user-space kernel) hoặc Firecracker (microVM) để cô lập cấp phần cứng giữa các workload khách hàng. *post-MVP* |

---

## 6. Stripe (Payment Gateway)

### T-33 — Giả Mạo Payment Webhook

| Attribute      | Value |
|----------------|-------|
| **Category**   | Spoofing / Tampering |
| **Severity**   | Critical |
| **Mitigation** | Chữ ký Stripe webhook được xác minh trên mỗi request webhook đến sử dụng webhook signing secret (lưu dưới dạng biến môi trường). Xác minh chữ ký sử dụng thư viện chính thức của Stripe (`stripe.webhooks.constructEvent`) xác thực mật mã payload với secret. Webhook nhận được không có chữ ký hợp lệ bị từ chối với 400 và được ghi log để điều tra. Stripe webhook endpoint secret là environment-specific (khác nhau cho dev/test/prod). [MVP] |

### T-34 — Giả Mạo Số Tiền Thanh Toán

| Attribute      | Value |
|----------------|-------|
| **Category**   | Tampering |
| **Severity**   | Critical |
| **Mitigation** | Số tiền thanh toán được xác minh phía server từ database, không bao giờ được nhận từ client. Đối với nạp tiền: số tiền được xác thực với các giá trị preset được phép (không phải tùy ý). Đối với billing charge: số tiền được tính phía server từ giá gói server và chu kỳ thanh toán. Stripe PaymentIntent được tạo phía server với số tiền đã xác minh trước khi client thấy nó. Client chỉ cung cấp PaymentMethod ID — số tiền là bất biến từ góc nhìn của client. [MVP] |

### T-35 — Đánh Cắp Phương Thức Thanh Toán Đã Lưu

| Attribute      | Value |
|----------------|-------|
| **Category**   | Information Disclosure |
| **Severity**   | Critical |
| **Mitigation** | Stripe tokenization được sử dụng độc quyền — số thẻ thô, CVC và ngày hết hạn đầy đủ không bao giờ được truyền đến hoặc lưu trữ trong server của Astral Cloud ([BR-31]). Phương thức thanh toán được lưu dưới dạng Stripe `PaymentMethod` object; Astral Cloud chỉ lưu Stripe PaymentMethod ID, brand, 4 chữ số cuối và tháng/năm hết hạn trong `PaymentMethod`. Điều này giảm thiểu phạm vi PCI DSS xuống SAQ-A (xử lý dữ liệu thẻ hoàn toàn outsourced). Tất cả giao tiếp với Stripe sử dụng HTTPS. [MVP] |

### T-36 — Phát Lại Thanh Toán Idempotent

| Attribute      | Value |
|----------------|-------|
| **Category**   | Tampering |
| **Severity**   | High |
| **Mitigation** | Stripe idempotency key được sử dụng trên tất cả các request tạo và xác nhận PaymentIntent — Stripe đảm bảo rằng retry request với cùng idempotency key trả về kết quả ban đầu, không phải charge trùng lặp. Deduplication cấp database: `Payment.stripePaymentId` là UNIQUE, ngăn bản ghi thanh toán trùng lặp ngay cả khi webhook được gửi nhiều hơn một lần. Idempotency key được tạo phía server dưới dạng `payment_<userId>_<timestamp>_<random>`. [MVP] |

---

## 7. Email / Thông Báo

### T-37 — Tiêm Email Template

| Attribute      | Value |
|----------------|-------|
| **Category**   | Tampering |
| **Severity**   | Medium |
| **Mitigation** | Email template sử dụng escaping nhạy cảm với ngữ cảnh cho tất cả biến template — không có HTML thô từ đầu vào người dùng được nội suy mà không escaping. Biến template được định nghĩa trước cho mỗi template (được liệt kê trong `EmailTemplate.variables`) và chỉ những biến đó được chấp nhận; biến không xác định bị từ chối. Dòng tiêu đề email cũng được escape. Email body được render phía server với template engine tự động escape HTML theo mặc định (ví dụ: Handlebars với `noEscape` bị vô hiệu hóa, hoặc Nunjucks với autoescaping). [MVP] |

### T-38 — Giả Mạo Email (Gửi Với Tư Cách Astral Cloud)

| Attribute      | Value |
|----------------|-------|
| **Category**   | Spoofing |
| **Severity**   | Medium |
| **Mitigation** | SPF record được cấu hình trên domain gửi (`astral.cloud`) để chỉ ủy quyền IP gửi của nhà cung cấp dịch vụ email (SendGrid). DKIM signing được bật trên tất cả email gửi đi qua nhà cung cấp email. DMARC policy được đặt thành `p=reject` để hướng dẫn mail server nhận từ chối email không xác thực. Custom domain được xác minh với nhà cung cấp email để ngăn sử dụng trái phép. [MVP] |

---

## 8. Kênh Giao Tiếp

### T-39 — Lộ Dữ Liệu Liên Container

| Attribute      | Value |
|----------------|-------|
| **Category**   | Information Disclosure |
| **Severity**   | High |
| **Mitigation** | Tất cả container (nền tảng và khách hàng) được kết nối qua Docker internal bridge network. Không có định tuyến bên ngoài giữa các container khách hàng — mỗi container có network namespace riêng. Container khách hàng không thể định địa chỉ lẫn nhau theo mặc định (không có user-defined network chung). Container nền tảng (web, worker, postgres, redis) trên một internal network riêng biệt với container khách hàng. Quy tắc firewall được cấu hình cho mỗi container qua Docker network policy. [MVP] |

### T-40 — Vấn Đề TLS Certificate Trên Public Endpoint

| Attribute      | Value |
|----------------|-------|
| **Category**   | Spoofing / Information Disclosure |
| **Severity**   | Critical |
| **Mitigation** | Nginx reverse proxy kết thúc TLS với certificate từ Let's Encrypt (tự động gia hạn qua certbot). HTTP Strict Transport Security (HSTS) header được đặt với `max-age=31536000; includeSubDomains; preload`. Tất cả HTTP request được chuyển hướng sang HTTPS (301). TLS được cấu hình chỉ với bộ cipher hiện đại (TLS 1.2 tối thiểu, TLS 1.3 ưu tiên). Certificate transparency monitoring được bật. [MVP] |

---

## 9. GDPR / Quyền Riêng Tư Dữ Liệu

### T-41 — Xuất Dữ Liệu Không Đầy Đủ

| Attribute      | Value |
|----------------|-------|
| **Category**   | Repudiation |
| **Severity**   | Medium |
| **Mitigation** | GDPR data export bao gồm tất cả các bảng liên quan đến người dùng: User, Session, ApiKey, SSHKey, ServerInstance, Payment, Invoice, Ticket, TicketMessage, Notification, Referral, VoucherUsage, TwoFactorAuth, GdprRequest. Việc tạo export được xác minh bằng test tự động đảm bảo tất cả các bảng có phạm vi người dùng được bao phủ. Định dạng export là JSON máy đọc được. Liên kết tải xuống hết hạn sau 7 ngày và yêu cầu xác thực lại. [MVP] |

### T-42 — Lưu Giữ Dữ Liệu Sau Khi Xóa

| Attribute      | Value |
|----------------|-------|
| **Category**   | Information Disclosure |
| **Severity**   | Medium |
| **Mitigation** | Xóa tài khoản là soft-delete trước (`User.deletedAt` được đặt), sau đó là hard-delete tất cả dữ liệu cá nhân sau 30 ngày ([BR-63]). AuditLog entry được ẩn danh (userId đặt thành NULL, IP cắt thành subnet `/24`) thay vì xóa để bảo toàn tính toàn vẹn của audit trail. Automated cleanup job chạy hàng ngày để xử lý các tài khoản đã qua cửa sổ lưu giữ 30 ngày. Server record cũng được soft-delete và hard-delete sau thời gian lưu giữ. [MVP] |

### T-43 — GDPR Request Trái Phép

| Attribute      | Value |
|----------------|-------|
| **Category**   | Spoofing |
| **Severity**   | High |
| **Mitigation** | GDPR request (xuất dữ liệu, xóa tài khoản) yêu cầu xác thực — người dùng phải đăng nhập. Ngoài ra, người dùng phải xác minh lại mật khẩu trước khi request được tạo. Điều này ngăn kẻ tấn công với session bị đánh cắp nhưng chưa hết hạn khởi tạo hành động GDPR. Bản ghi `GdprRequest` được liên kết với `userId` và chỉ hiển thị cho người dùng đó và admin staff. [MVP] |

---

## 10. Hệ Thống Voucher / Coupon

### T-44 — Đoán Voucher Brute-Force

| Attribute      | Value |
|----------------|-------|
| **Category**   | Spoofing |
| **Severity**   | Medium |
| **Mitigation** | Giới hạn tốc độ trên endpoint xác thực/đổi voucher (10 lần thử mỗi phút mỗi IP, 30 lần mỗi giờ mỗi người dùng). Mã voucher được tạo ngẫu nhiên (ngẫu nhiên mật mã, không tuần tự — ví dụ: 16 ký tự chữ-số), khiến chúng không thể đoán được. Lần thử đổi thất bại được ghi log để phát hiện lạm dụng. Mã voucher hợp lệ không bao giờ được tiết lộ trong client-side code hoặc trang công khai. [MVP] |

### T-45 — Lạm Dụng Voucher (Nhiều Tài Khoản)

| Attribute      | Value |
|----------------|-------|
| **Category**   | Tampering |
| **Severity**   | Medium |
| **Mitigation** | Giới hạn đổi cho mỗi người dùng được thực thi ở cấp database (`VoucherUsage` uniqueness trên `voucherId + userId`, [BR-36]). Theo dõi IP và browser fingerprint để phát hiện lạm dụng chéo tài khoản ([BR-57]). Admin review thủ công các mẫu đổi voucher cho hoạt động đáng ngờ. Voucher usage dashboard cho admin để giám sát tốc độ đổi và phát hiện bất thường. [MVP] |

---

## 11. Hệ Thống Giới Thiệu

### T-46 — Gian Lận Tự Giới Thiệu

| Attribute      | Value |
|----------------|-------|
| **Category**   | Tampering |
| **Severity**   | Medium |
| **Mitigation** | Mã giới thiệu của chính người dùng bị từ chối khi đăng ký ([BR-57]). Kiểm tra IP address và browser fingerprint: nếu người giới thiệu và người được giới thiệu chia sẻ cùng IP và fingerprint trong cửa sổ thời gian ngắn, giới thiệu bị gắn cờ để admin review. Kiểm tra cùng phương thức thanh toán: nếu người giới thiệu và người được giới thiệu sử dụng cùng Stripe PaymentMethod ID, giới thiệu bị vô hiệu hóa. Referral credit có thể bị admin thu hồi đối với gian lận đã xác nhận. [MVP] |

### T-47 — Referral Farming (Tài Khoản Giả)

| Attribute      | Value |
|----------------|-------|
| **Category**   | Tampering |
| **Severity**   | Medium |
| **Mitigation** | Referral credit chỉ được phát hành khi người dùng được giới thiệu thực hiện thanh toán tiền thật đầu tiên (nạp tiền), không phải khi đăng ký ([BR-55]). Payout (rút referral credit) có ngưỡng tối thiểu (mặc định $50, [BR-56]), yêu cầu hoạt động hợp pháp đáng kể. Tốc độ sử dụng mã giới thiệu cho mỗi người giới thiệu được giám sát; đột biến bất thường kích hoạt admin review. Tài khoản được tạo chỉ để lạm dụng giới thiệu có thể bị đình chỉ. [MVP] |

---

## 12. Blog / Nội Dung

### T-48 — XSS Trong Nội Dung Blog

| Attribute      | Value |
|----------------|-------|
| **Category**   | Tampering |
| **Severity**   | Medium |
| **Mitigation** | Nội dung bài blog được lưu dưới dạng Markdown, render bằng thư viện Markdown an toàn (ví dụ: `remark` / `rehype`) sanitize HTML output — không có raw HTML passthrough. Header `Content-Security-Policy` hạn chế nguồn thực thi script. React built-in escaping ngăn XSS trong tiêu đề blog, đoạn trích và metadata. Bất kỳ nội dung do người dùng gửi trong bình luận blog (nếu được triển khai) được sanitize trước khi render. [MVP] |

### T-49 — Xuất Bản Blog Trái Phép

| Attribute      | Value |
|----------------|-------|
| **Category**   | Elevation of Privilege |
| **Severity**   | Low |
| **Mitigation** | Chỉ người dùng STAFF và ADMIN mới có thể tạo, xuất bản hoặc sửa bài blog ([BR-45]). Xác minh role ở cấp API route: `POST/PUT /api/blog` yêu cầu role `STAFF` hoặc `ADMIN` trong JWT. `authorId` trên `BlogPost` được đặt phía server từ người dùng đã xác thực, không từ đầu vào client. Bài nháp chỉ hiển thị cho tác giả và admin user. [MVP] |

---

## 13. Các Thành Phần Production Bổ Sung

### 13.1 Private Networking

### T-52 — VLAN Hopping

| Attribute      | Value |
|----------------|-------|
| **Category**   | Information Disclosure / Elevation of Privilege |
| **Severity**   | High |
| **Mitigation** | Docker network isolation và network policy enforcement ở cấp bridge. Container khách hàng chỉ được gắn vào private network của riêng họ — không có user-defined network chung giữa các khách hàng. Container network namespace được cô lập; kernel-level network policy (quy tắc iptables/nftables được áp dụng tại Docker bridge) ngăn lưu lượng chéo mạng. Nhãn container và network attachment được xác minh bởi worker trước bất kỳ thao tác mạng nào. [MVP] |

### T-53 — Tấn Công CIDR Overlap

| Attribute      | Value |
|----------------|-------|
| **Category**   | Tampering |
| **Severity**   | High |
| **Mitigation** | CIDR range do khách hàng cấu hình được xác thực phía server trước khi tạo private network. CIDR không được chồng lấn với reserved range: node management network, Docker bridge subnet (`172.17.0.0/16`), internal platform service network. Xác thực từ chối bất kỳ CIDR nào nằm trong hoặc chứa reserved range. Kiểm tra chồng lấn được thực hiện với allowlist các private range được phép (RFC 1918). [MVP] |

### 13.2 Floating IPs

### T-54 — Chiếm Đoạt Floating IP

| Attribute      | Value |
|----------------|-------|
| **Category**   | Spoofing / Tampering |
| **Severity**   | Critical |
| **Mitigation** | Gán Floating IP sử dụng conditional UPDATE nguyên tử trong PostgreSQL: `UPDATE "FloatingIp" SET "serverId" = $1 WHERE id = $2 AND "serverId" IS NULL` — truy vấn trả về 0 dòng nếu IP đã được gán. Xác thực quyền sở hữu: `userId` của server đích phải khớp với người dùng đã xác thực. Gán lại Floating IP yêu cầu hủy gán rõ ràng trước. Ánh xạ IP-to-server được xác minh bởi worker trước khi áp dụng quy tắc NAT/routing. [MVP] |

### 13.3 Block Volumes

### T-55 — Truy Cập Volume Chéo Khách Hàng

| Attribute      | Value |
|----------------|-------|
| **Category**   | Information Disclosure |
| **Severity**   | Critical |
| **Mitigation** | Kiểm tra quyền sở hữu trên cả volume và server đích trước khi attach: `userId` của volume và `userId` của server phải khớp với người dùng đã xác thực. `Volume.serverId` có UNIQUE constraint — một volume chỉ có thể được gắn vào một server tại một thời điểm, ngăn truy cập chéo khách hàng đồng thời. Worker xác minh lại nhãn quyền sở hữu trên Docker volume trước khi thực hiện bind mount. Thao tác attach/detach volume được ghi vào AuditLog. [MVP] |

### T-56 — Dữ Liệu Volume Còn Sót Lại

| Attribute      | Value |
|----------------|-------|
| **Category**   | Information Disclosure |
| **Severity**   | Medium |
| **Mitigation** | Docker volume được mã hóa khi lưu trữ *post-MVP* sử dụng LUKS/dm-crypt trên block storage bên dưới, đảm bảo dữ liệu không thể đọc được nếu không có khóa mã hóa ngay cả khi lưu trữ vật lý được tái sử dụng bởi khách hàng khác. Secure wipe (ghi đè bằng số không hoặc dữ liệu ngẫu nhiên, sau đó là `blkdiscard` trên SSD) khi xóa volume *post-MVP*. Đối với MVP: volume được gắn phạm vi logic theo Docker volume namespace và bị xóa bằng `docker volume rm`, loại bỏ dữ liệu volume khỏi filesystem host. Rủi ro dữ liệu còn sót ở cấp filesystem được chấp nhận cho MVP. [MVP] |

### 13.4 Cloud-Init

### T-57 — Cloud-Init Script Độc Hại

| Attribute      | Value |
|----------------|-------|
| **Category**   | Elevation of Privilege |
| **Severity**   | High |
| **Mitigation** | Cloud-init script chạy độc quyền bên trong container của khách hàng (được truyền dưới dạng file bind-mounted hoặc biến môi trường), không bao giờ được thực thi trên host. Giới hạn tài nguyên container được thực thi bởi cgroups (`--cpus`, `--memory`) — script không thể làm cạn kiệt tài nguyên host. Kích thước script được xác thực: tối đa 64 KB. Nội dung script được xác thực tại thời điểm gửi API để từ chối nội dung nhị phân hoặc không phải văn bản. Container chạy với `--cap-drop=ALL` và không privileged mode, vì vậy ngay cả script độc hại cũng không thể escape ra host. [MVP] |

### 13.5 Webhooks

### T-58 — Webhook SSRF

| Attribute      | Value |
|----------------|-------|
| **Category**   | Information Disclosure / Elevation of Privilege |
| **Severity**   | High |
| **Mitigation** | Webhook URL được xác thực trước khi gửi: từ chối URL phân giải đến dải IP riêng (127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, link-local 169.254.0.0/16), localhost hoặc Docker-internal subnet. Phân giải DNS được thực hiện phía server và địa chỉ đã phân giải được kiểm tra với deny-list trước khi HTTP request được thực hiện. Bảo vệ DNS rebinding: sau khi phân giải ban đầu, các redirect tiếp theo từ đích cũng được xác thực với internal IP deny-list. Webhook delivery chạy từ ngữ cảnh mạng cô lập không có quyền truy cập vào internal service. [MVP] |

### T-59 — Brute-Force Webhook Secret

| Attribute      | Value |
|----------------|-------|
| **Category**   | Spoofing |
| **Severity**   | Medium |
| **Mitigation** | Webhook HMAC secret là chuỗi ngẫu nhiên mật mã 64 ký tự (384 bit entropy), khiến brute-force không khả thi về mặt tính toán. Giới hạn tốc độ trên endpoint kiểm tra webhook delivery attempt: 30 request mỗi phút mỗi người dùng để ngăn kẻ tấn công kiểm tra secret đoán bằng cách quan sát hành vi delivery. Sự kiện xác minh chữ ký thất bại được ghi log và giám sát các mẫu bất thường (ví dụ: chữ ký không chính xác lặp lại từ cùng một IP). [MVP] |

### 13.6 CLI / Terraform

### T-60 — Đánh Cắp API Key Từ CLI Config

| Attribute      | Value |
|----------------|-------|
| **Category**   | Information Disclosure |
| **Severity**   | Medium |
| **Mitigation** | File cấu hình CLI (`~/.astral/config.json`) được tạo với quyền file hạn chế (0600 — chỉ chủ sở hữu đọc/ghi). CLI phát ra cảnh báo khi khởi động nếu file cấu hình world-readable hoặc group-readable, với hướng dẫn chạy `chmod 600 ~/.astral/config.json`. Tùy chọn: mã hóa API key khi lưu trữ sử dụng OS keychain (macOS Keychain, freedesktop Secret Service, Windows Credential Manager) *post-MVP*. Tài liệu CLI khuyên không chia sẻ file cấu hình và khuyến nghị biến môi trường (`ASTRAL_API_KEY`) như một giải pháp thay thế. [MVP] |

### T-61 — Terraform State Chứa Secrets

| Attribute      | Value |
|----------------|-------|
| **Category**   | Information Disclosure |
| **Severity**   | High |
| **Mitigation** | Các trường nhạy cảm trong Terraform provider schema được đánh dấu với `Sensitive: true` — Terraform redact các giá trị này khỏi console output và cảnh báo nếu chúng xuất hiện trong plan diff. `rootPassword` bị loại trừ hoàn toàn khỏi server resource output (không có computed attribute cho nó). Tài liệu provider hướng dẫn người dùng sử dụng remote state backend (S3, Terraform Cloud, GCS) với mã hóa khi lưu trữ và kiểm soát truy cập, không bao giờ commit `.tfstate` vào version control. Pattern `terraform.tfstate` và `*.tfstate` được thêm vào `.gitignore` trong các dự án mẫu. [MVP] |

### 13.7 Observability

### T-62 — Dữ Liệu Nhạy Cảm Trong Log

| Attribute      | Value |
|----------------|-------|
| **Category**   | Information Disclosure |
| **Severity**   | High |
| **Mitigation** | Redaction cấp trường trong structured logging middleware: bất kỳ trường log nào có key khớp với pattern nhạy cảm (`password`, `secret`, `token`, `key`, `credit`, `cvv`, `ssn`, `card`) hoặc có giá trị khớp với regex cho các định dạng secret phổ biến được thay thế bằng `[REDACTED]`. Automated test trong CI xác minh rằng không có pattern nhạy cảm nào xuất hiện trong sample log output — một test suite phát lại các request đã biết qua logging pipeline và assert zero match trên denylist các pattern secret. Log aggregation pipeline (ví dụ: Loki/Fluentd) *post-MVP* cũng thực hiện redaction phía server như defense-in-depth. [MVP] |

### T-63 — Metrics Endpoint Bị Lộ Công Khai

| Attribute      | Value |
|----------------|-------|
| **Category**   | Information Disclosure |
| **Severity**   | Medium |
| **Mitigation** | Endpoint `/metrics` (Prometheus scrape target) chỉ được gắn với internal Docker network interface — không được lộ qua Nginx reverse proxy hoặc internet công cộng. Cấu hình Nginx rõ ràng không proxy `/metrics`. Đối với môi trường production nơi metrics cần được scrape bởi dịch vụ giám sát bên ngoài: basic auth bảo vệ endpoint với credential mạnh, được tạo ngẫu nhiên. Không có hostname nội bộ, địa chỉ IP hoặc chi tiết hạ tầng được bao gồm trong metric label. [MVP] |

### 13.8 Operational Maturity

### T-64 — Database Migration Khóa Production

| Attribute      | Value |
|----------------|-------|
| **Category**   | Denial of Service |
| **Severity**   | High |
| **Mitigation** | CI pipeline từ chối bất kỳ migration nào chứa `ALTER TABLE ... ADD COLUMN ... NOT NULL` không có giá trị `DEFAULT` — mẫu này chiếm `ACCESS EXCLUSIVE` lock và ghi lại toàn bộ bảng. Mẫu expand-contract được thực thi bởi code review: (1) thêm cột với default (tức thì), (2) backfill dữ liệu cần thiết, (3) thêm `NOT NULL` constraint trong migration sau. Migration linter (ví dụ: `pgroll` hoặc script tùy chỉnh) chạy như một pre-merge check. Migration chạy lâu bị CI gắn cờ với comment cảnh báo trên PR. [MVP] |

### T-65 — Blue-Green Deployment Data Inconsistency

| Attribute      | Value |
|----------------|-------|
| **Category**   | Tampering |
| **Severity**   | High |
| **Mitigation** | Cả môi trường triển khai Blue và Green đều kết nối đến cùng một database PostgreSQL — không có độ trễ replication dữ liệu hoặc rủi ro split-brain. Tất cả database migration tuân theo mẫu expand-contract: mỗi migration đều tương thích ngược, nghĩa là code ứng dụng cũ (Blue) có thể chạy với schema mới. Không có thay đổi phá hủy (xóa cột, đổi tên) được triển khai trong cùng migration với thay đổi code. Việc chuyển đổi được thực hiện ở cấp Nginx bằng cách cập nhật upstream target — điều này là tức thì và connection-draining đảm bảo các request đang bay hoàn thành trước khi container cũ bị kết thúc. [MVP] |

### 13.9 Security Hardening

### T-66 — Container Escape Qua Kernel Exploit

| Attribute      | Value |
|----------------|-------|
| **Category**   | Elevation of Privilege |
| **Severity**   | Critical |
| **Mitigation** | Triển khai production sử dụng gVisor (user-space kernel, lọc syscall) hoặc Firecracker (microVM với ảo hóa phần cứng) cho workload khách hàng, cung cấp cô lập cấp phần cứng hoặc cấp syscall với host kernel. Môi trường development sử dụng container Docker tiêu chuẩn với seccomp profile, `--cap-drop=ALL`, không privileged mode và root filesystem chỉ đọc — cô lập yếu hơn này được chấp nhận như một rủi ro được ghi nhận cho môi trường phi production. Cập nhật bảo mật kernel được áp dụng cho host trong vòng 24 giờ sau khi phát hành. Host kernel là bản phân phối tối thiểu, được tăng cường bảo mật (ví dụ: Container-Optimized OS). [MVP] |

### T-67 — Pull Container Image Không Chữ Ký

| Attribute      | Value |
|----------------|-------|
| **Category**   | Tampering |
| **Severity**   | Critical |
| **Mitigation** | Xác minh chữ ký container image qua cosign trước mỗi lần `docker pull`: worker xác minh chữ ký image với public key của nền tảng ([BR-102]). Image không chữ ký hoặc image có chữ ký không hợp lệ bị từ chối — pull bị hủy bỏ và job provisioning server thất bại với lỗi được ghi log. Admin image publishing pipeline tự động ký image khi push lên registry. Xác minh chữ ký không bao giờ bị bỏ qua, ngay cả trong development (self-signed dev key được sử dụng). [MVP] |

### T-68 — Audit Log Tampering Bởi Database Admin

| Attribute      | Value |
|----------------|-------|
| **Category**   | Tampering |
| **Severity**   | High |
| **Mitigation** | Chuỗi băm mật mã trên tất cả AuditLog entry ([BR-103]): mỗi entry mới bao gồm `hash(previous_entry_hash || current_entry_data)`, tạo ra chuỗi chống giả mạo. Bất kỳ sửa đổi nào đối với entry trong quá khứ đều làm mất hiệu lực tất cả các băm sau đó, khiến việc giả mạo có thể phát hiện được. Admin audit dashboard định kỳ xác minh tính toàn vẹn của chuỗi end-to-end và cảnh báo khi không khớp. Chuỗi băm được lưu trong bảng `AuditLog` cùng với mỗi entry. Database-level permission vẫn thực thi quyền truy cập append-only như defense-in-depth. [MVP] |

### 13.10 Compliance

### T-69 — Xuất Dữ Liệu GDPR Không Đầy Đủ

| Attribute      | Value |
|----------------|-------|
| **Category**   | Repudiation |
| **Severity**   | Medium |
| **Mitigation** | Automated test suite xác minh rằng tất cả các bảng liên quan đến người dùng được bao gồm trong hàm GDPR export — test introspects database schema, liệt kê tất cả các bảng chứa cột `userId` và assert mỗi bảng có mặt trong export manifest. Export schema được phiên bản hóa (`exportSchemaVersion`) và lưu cùng mỗi export được tạo, cho phép truy xuất nguồn gốc những bảng nào được bao gồm tại thời điểm export. Khi bảng mới có phạm vi người dùng được thêm qua migration, test thất bại cho đến khi hàm export được cập nhật, ngăn thoái lui. [MVP] |

### T-70 — Cookie Được Đặt Trước Khi Có Sự Đồng Ý

| Attribute      | Value |
|----------------|-------|
| **Category**   | Information Disclosure |
| **Severity**   | Medium |
| **Mitigation** | Không có cookie không thiết yếu (analytics, marketing, third-party tracking) được đặt cho đến khi người dùng chấp nhận rõ ràng qua consent banner. Cookie thiết yếu (session, CSRF, i18n preference) được đặt mà không cần sự đồng ý — những cookie này được miễn trừ theo ePrivacy Directive / GDPR. Header `Content-Security-Policy` với hạn chế `script-src` chặn tải script bên thứ ba cho đến khi sự đồng ý được ghi nhận và CSP được cập nhật qua cách tiếp cận dựa trên nonce hoặc hash. Trạng thái đồng ý (`consent.analytics`, `consent.marketing`) được lưu phía server và đánh giá trước khi bất kỳ cookie hoặc script nào được tiêm. [MVP] |

### T-71 — Bỏ Qua Chấp Nhận Điều Khoản

| Attribute      | Value |
|----------------|-------|
| **Category**   | Tampering |
| **Severity**   | Medium |
| **Mitigation** | Thực thi phía server: `User.maxServers` mặc định là `0` và chỉ được cập nhật thành mặc định của gói khi `User.termsAcceptedVersion` khớp với phiên bản điều khoản hiện tại. Endpoint tạo server kiểm tra `maxServers > currentServerCount` — người dùng chưa chấp nhận điều khoản sẽ có `maxServers = 0` và không thể tạo server. Phiên bản điều khoản được theo dõi cho mỗi người dùng và phải được chấp nhận lại khi tài liệu điều khoản được phiên bản hóa. Kiểm tra này được thực hiện ở cấp API, không chỉ trong UI, ngăn việc bỏ qua trực tiếp qua API. [MVP] |

### 13.11 Admin Tools

### T-72 — Lạm Dụng Mạo Danh

| Attribute      | Value |
|----------------|-------|
| **Category**   | Repudiation |
| **Severity**   | High |
| **Mitigation** | Mọi hành động được thực hiện trong phiên mạo danh đều ghi log cả admin user ID và target (impersonated) user ID trong AuditLog — tất cả hành động đều có thể quy kết kép. Một banner UI bền vững, không thể tắt được hiển thị mọi lúc trong quá trình mạo danh để ngăn admin quên rằng họ đang hành động với tư cách người dùng khác. Phiên mạo danh có timeout ngắn (30 phút) sau đó admin được trả về phiên của chính họ. Sự kiện bắt đầu và kết thúc mạo danh được ghi log như các audit entry riêng biệt. Admin audit dashboard hiển thị tất cả các phiên mạo danh để xem xét. [MVP] |

### T-73 — Rò Rỉ Feature Flag

| Attribute      | Value |
|----------------|-------|
| **Category**   | Information Disclosure / Elevation of Privilege |
| **Severity**   | Medium |
| **Mitigation** | Tất cả API endpoint được feature-gate kiểm tra feature flag phía server trong route handler hoặc middleware — không chỉ trong UI. Nếu feature flag phân giải thành `false`, endpoint trả về 404 (Not Found) để tránh làm lộ sự tồn tại của tính năng. Feature flag evaluation xảy ra trên mỗi request (không caching trạng thái "enabled" cho mỗi người dùng) để cho phép thay đổi flag thời gian thực. Regression test xác minh rằng các tính năng bị vô hiệu hóa trả về 404 cho cả API và page route. Ẩn UI-only (ví dụ: xóa nút) được coi là tối ưu UX, không phải kiểm soát bảo mật. [MVP] |

### 13.12 Abuse & Legal

### T-74 — Spam Báo Cáo Lạm Dụng Tự Động

| Attribute      | Value |
|----------------|-------|
| **Category**   | Denial of Service |
| **Severity**   | Medium |
| **Mitigation** | Giới hạn tốc độ trên việc gửi báo cáo lạm dụng: 5 báo cáo mỗi IP mỗi giờ. Người dùng đã xác thực có giới hạn cao hơn (10 mỗi giờ) nhưng cả hai bậc đều được thực thi. CAPTCHA được yêu cầu trên tất cả các lần gửi báo cáo lạm dụng ẩn danh (không xác thực) để ngăn bot tự động. Báo cáo từ cùng IP về cùng server trong cửa sổ thời gian ngắn được deduplicate. Admin dashboard hiển thị số liệu tốc độ báo cáo để phát hiện chiến dịch spam. [MVP] |

### T-75 — Bỏ Qua DMCA Counter-Notice

| Attribute      | Value |
|----------------|-------|
| **Category**   | Repudiation |
| **Severity**   | High |
| **Mitigation** | Sau khi báo cáo lạm dụng đã xác thực đối với một server, server bị đình chỉ trong 48 giờ — khách hàng phải xác nhận báo cáo và xác nhận xóa nội dung trước khi server có thể được khởi động lại. Sau 2 báo cáo lạm dụng đã xác thực đối với cùng một server (từ các báo cáo viên khác nhau), server tự động bị xóa — điều này ngăn vòng lặp counter-notice vô hạn. Tất cả hành động báo cáo lạm dụng (báo cáo nhận được, xác thực, đình chỉ, xóa) được ghi vào AuditLog với server ID và bên báo cáo. Admin override có thể nhưng yêu cầu phê duyệt của admin thứ hai (nguyên tắc bốn mắt). [MVP] |

---

## 14. API Keys

### T-50 — Rò Rỉ API Key

| Attribute      | Value |
|----------------|-------|
| **Category**   | Information Disclosure |
| **Severity**   | High |
| **Mitigation** | API key được băm bằng SHA-256 trước khi lưu trong `ApiKey.keyHash` — key đầy đủ không bao giờ được lưu dưới dạng plaintext. Chỉ 8 ký tự đầu tiên được lưu dưới dạng plaintext (`ApiKey.keyPrefix`) để nhận dạng trong UI. Key đầy đủ được hiển thị cho người dùng đúng một lần tại thời điểm tạo, với cảnh báo nổi bật để sao chép ngay lập tức. Người dùng có thể thu hồi key bất kỳ lúc nào từ dashboard, vô hiệu hóa key bằng cách xóa bản ghi. API key chỉ được truyền qua HTTPS và nên được sử dụng dưới dạng header `Authorization: Bearer <key>`. [MVP] |

### T-51 — Brute-Force API Key

| Attribute      | Value |
|----------------|-------|
| **Category**   | Spoofing |
| **Severity**   | Medium |
| **Mitigation** | Request xác thực bằng API key chịu cùng giới hạn tốc độ như request bằng JWT bearer token: 60 request mỗi phút mỗi key ([BR-26]). API key là chuỗi ngẫu nhiên 32+ ký tự, cung cấp entropy đủ (~192 bit) để không khả thi về mặt tính toán để brute-force. Lần thử xác thực API key thất bại được ghi log và giám sát các mẫu (ví dụ: nhiều lần thất bại từ một IP trên các key prefix khác nhau). Key hết hạn bị từ chối với 401 ([BR-65]). [MVP] |

---

## Risk Acceptance

Các rủi ro sau được thừa nhận và chấp nhận cho bản phát hành MVP, với lý do:

| Risk                               | Rationale                                                                                                                                                                  |
|------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Redis data loss                    | Redis được sử dụng như cache và job queue, không phải primary data store. BullMQ job được thiết kế idempotent — phát lại job bị mất từ trạng thái database tạo ra cùng kết quả. Mất dữ liệu session yêu cầu đăng nhập lại (đánh đổi UX chấp nhận được cho MVP). Mất rate-limit counter là khoảng trống tạm thời về DoS hardening. |
| No Web Application Firewall (WAF)  | Giới hạn tốc độ, xác thực đầu vào (Zod), truy vấn tham số hóa và CSP header cung cấp bảo vệ phân lớp đủ cho MVP. WAF có thể được thêm trong production (Cloudflare, AWS WAF) như một biện pháp defense-in-depth. |

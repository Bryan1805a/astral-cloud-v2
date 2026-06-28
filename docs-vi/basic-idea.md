# Ý Tưởng Cơ Bản

## 1. Astral Cloud là gì?

Astral Cloud là một nền tảng hosting đám mây đầy đủ tính năng cho phép người dùng thuê, quản lý và giám sát các máy chủ được container hóa thông qua giao diện web tập trung. Nó tự động hóa việc phân bổ tài nguyên, thanh toán, hỗ trợ và quản lý nội dung — mang đến trải nghiệm hoàn chỉnh của một nhà cung cấp đám mây chuyên nghiệp.

Bên dưới, các máy chủ là các Docker container (không phải VM đầy đủ), giúp việc khởi tạo gần như tức thời và loại bỏ nhu cầu ảo hóa lồng nhau. Nền tảng được thiết kế vừa là một ứng dụng sẵn sàng cho production vừa là một kiến trúc tham khảo cho các mẫu SaaS doanh nghiệp.

## 2. Ai sử dụng?

**Customers** — triển khai và quản lý máy chủ, đọc bài viết blog, mở ticket hỗ trợ, áp dụng voucher.
**Staff** — phản hồi ticket, xuất bản nội dung blog, quản lý voucher, kiểm duyệt nền tảng.
**Admin** — quản lý mọi thứ: nodes, pricing, users, system settings, tax rates, email templates.

## 3. Họ muốn làm gì?

### Customers
- Đăng ký, đăng nhập (với 2FA), quản lý hồ sơ
- Tạo, start, stop, restart, delete máy chủ
- Xem chi tiết máy chủ (IP, resource usage, billing)
- Áp dụng mã voucher/coupon để được giảm giá
- Nạp tiền vào ví qua cổng thanh toán (Stripe)
- Xem lịch sử thanh toán và tải xuống invoice
- Mở và theo dõi ticket hỗ trợ
- Đọc bài viết blog và changelog
- Quản lý API keys cho truy cập lập trình
- Bật/cấu hình backup tự động
- Cấu hình firewall rules cho từng máy chủ
- Quản lý DNS / reverse DNS records
- Gắn tag cho máy chủ để tổ chức
- Giới thiệu bạn bè và nhận credits
- Nhận thông báo trong ứng dụng và qua email

### Staff
- Phản hồi và giải quyết ticket hỗ trợ
- Viết và xuất bản bài viết blog
- Tạo và quản lý chiến dịch voucher
- Xem tài khoản khách hàng (chỉ đọc)
- Kiểm duyệt nội dung do người dùng tạo

### Admin
- Tất cả khả năng của Staff
- Tạo, cập nhật, vô hiệu hóa ServerPlans và ImageTemplates
- Thêm, cập nhật, xóa các Node và Region vật lý
- Quản lý tất cả users (role, status, force lock/unlock)
- Xem tất cả audit logs với bộ lọc
- Cấu hình tax rates theo region
- Quản lý email templates
- Cấu hình system-wide settings
- Xem lịch sử xử lý job và dead-letter queues
- Xử lý yêu cầu dữ liệu GDPR
- Quản lý announcements và status page
- Xem phân tích và metrics của nền tảng

## 4. MVP là gì?

Phase 1 (core):
- Đăng ký / Đăng nhập / Quên mật khẩu
- 2FA (TOTP)
- Tạo / Liệt kê / Xem / Start / Stop / Delete Server
- Nạp tiền ví (tích hợp Stripe)
- Server plans, images, regions (do admin quản lý)
- Audit logging trên mọi thay đổi trạng thái

Phase 2 (tính năng khách hàng):
- Ticket hỗ trợ
- Hệ thống voucher / coupon
- API keys
- Backup tự động
- Firewall rules cho từng máy chủ
- Quản lý DNS / reverse DNS
- Tag máy chủ
- Thông báo trong ứng dụng
- Lịch sử thanh toán + tải xuống invoice

Phase 3 (tính năng nền tảng):
- Blog / articles / changelog
- Hệ thống referral / affiliate
- Quản lý email templates
- Tax / VAT theo region
- Bảng system settings
- Announcements / status page
- Xuất / xóa dữ liệu GDPR
- Bảng quản trị job history
- Referral payouts

## 5. Các thực thể chính là gì?

```
User
├── owns ──── ServerInstance (1:*)
├── owns ──── SSHKey (1:*)
├── owns ──── Snapshot (1:*)
├── owns ──── ApiKey (1:*)
├── owns ──── Backup (1:* via ServerInstance)
├── opens ─── Ticket (1:*)
├── refers ── Referral (1:*)
├── has ───── Notification (1:*)
├── has ───── Session (1:*)
├── has ───── PaymentMethod (1:*)
├── owns ──── Payment (1:*)
└── has ───── TwoFactorAuth (1:1)

ServerInstance
├── based on ──── ServerPlan (*:1)
├── uses ──────── ImageTemplate (*:1)
├── deployed on ─ Node (*:1)
├── located in ── Region (*:1)
├── auth with ─── SSHKey (*:0..1)
├── boot from ─── Snapshot (*:0..1)
├── has ───────── Backup (1:*)
├── has ───────── FirewallRule (1:*)
├── has ───────── DnsRecord (1:*)
├── has ───────── VpsTag (*:*)
└── generates ─── Invoice (via billing)

User
├── generates ── AuditLog (1:*)
└── uses ──────── Voucher (1:* via VoucherUsage)

Ticket
├── opened by ─── User (*:1)
├── assigned to ── User (Staff) (*:0..1)
└── has ───────── TicketMessage (1:*)

BlogPost
├── authored by ── User (Staff/Admin) (*:1)
└── belongs to ─── BlogCategory (*:1)

Voucher
└── used by ────── VoucherUsage (1:*)
    └── applied to ── Payment (*:0..1)

Referral
├── referred by ── User (referrer) (*:1)
└── claimed by ─── User (referee) (*:1)
    └── generates ── ReferralPayout (1:*)
```

## 6. Các tình huống lỗi là gì?

**Cạn kiệt tài nguyên (Resource exhaustion):** Tất cả nodes đầy → khách hàng thấy "No capacity available" + admin được cảnh báo.
**Thanh toán thất bại (Payment failure):** Stripe từ chối → khách hàng được thông báo, máy chủ có thể bị tạm ngưng sau thời gian gia hạn.
**Container runtime không thể kết nối:** Docker daemon ngừng hoạt động trên node → thao tác máy chủ thất bại, admin được cảnh báo, status page được cập nhật.
**Worker gặp sự cố giữa chừng khi provisioning:** Container đã được tạo nhưng DB chưa được cập nhật → retry với idempotency guard phát hiện container hiện có và đồng bộ DB.
**Tranh chấp đặt chỗ node đồng thời (Concurrent node reservation race):** Hai yêu cầu cho dung lượng cuối cùng của cùng một node → conditional UPDATE nguyên tử chỉ cấp cho một; yêu cầu thua sẽ thử lại node tiếp theo.
**Trạng thái cũ sau phân vùng mạng (Stale state after network partition):** Docker báo container đang running, DB báo STOPPED → reconciliation job đồng bộ thực tế vào DB.

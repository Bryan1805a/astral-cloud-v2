# Mô Hình Miền

---

## Tổng Quan Thực Thể - Quan Hệ

```
 ┌──────────┐       1..*  ┌────────────────┐      1..1    ┌──────────────┐
 │   User   │────────────▶│ ServerInstance │◀───────────│  ServerPlan  │
 └──────────┘             └────────────────┘              └──────────────┘
      │                         │       ▲                      │
      │ 1..*                    │ 1..1  │ 0..1                 │
      ▼                         ▼       │                      │
 ┌──────────┐             ┌──────────────┐                      │
 │ AuditLog │             │ ImageTemplate│◀────────────────────┘
 └──────────┘             └──────────────┘       (plan constrains image)
                                │
                                │ 1..1
                                ▼
                          ┌────────────────┐      1..*     ┌──────────┐      1..*  ┌────────────┐
                          │ ServerInstance  │────────────▶│   Node   │────────────▶│ IpAddress  │
                          └────────────────┘               └──────────┘              └────────────┘
                                │                           │                           │
                                │ 1..1                      │ 1..1                      │ 0..1
                                ▼                           ▼                           ▼
                          ┌──────────┐               ┌──────────┐              ┌────────────────┐
                          │  Region  │◀──────────────│  Region  │              │ ServerInstance  │
                          └──────────┘               └──────────┘              │ (when allocated)│
                               ▲ ▲                                              └────────────────┘
                               │ │
      ┌──────────┐             │ │
      │  SSHKey  │─── 0..1 ───▶│ │ ServerInstance (optional)
      └──────────┘             │ │
      ┌──────────┐             │ │
      │ Snapshot │─── 0..1 ───▶│ │ ServerInstance (optional, as boot source)
      └──────────┘             │ │
                               │ │
  ── Infrastructure ──         │ │
                               │ │
  ┌──────────────────┐         │ │       ┌─────────────────────┐
  │  PrivateNetwork   │───1..*─▶│ │       │ServerPrivateNetwork │◀───0..1─── ServerInstance
  └──────────────────┘         │ │       └─────────────────────┘
      │        │               │ │        (UNIQUE on serverId)
      │ 1..*   │ *..1          │ │
      ▼        ▼               │ │
     User    Region◀───────────┘ │
                                 │
  ┌──────────────┐               │
  │  FloatingIp  │──── 0..1 ───▶ ServerInstance
  └──────────────┘
      │        ▲
      │ 1..*   │ *..1
      ▼        │
     User    Region

  ┌──────────────┐               ┌──────────┐      ┌──────┐
  │ BlockVolume  │──── 0..1 ───▶ ServerInstance      │ Node │
  └──────────────┘                                   └──────┘
      │        ▲                                      ▲
      │ 1..*   │ *..1                                 │ 0..1
      ▼        │                                      │
     User    Region◀──────────── *..1 ────────────────┘

  ── Webhook / Events ──

  ┌─────────────────┐     1..*     ┌─────────────────┐
  │ WebhookEndpoint │────────────▶│ WebhookDelivery  │
  └─────────────────┘              └─────────────────┘
      │
      │ 1..* (belongs to)
      ▼
     User

  ┌─────────────────┐
  │ BandwidthUsage   │──── *..1 ───▶ ServerInstance
  └─────────────────┘

  ── Platform ──

  ┌──────────────┐
  │ FeatureFlag  │ (standalone — global configuration)
  └──────────────┘

  ┌──────────────┐      0..1      ┌──────────┐
  │ AbuseReport  │───────────────▶│   User   │ (reporter)
  └──────────────┘                └──────────┘
      │        ▲
      │ 0..1   │ 0..1 (reviewed by)
      ▼        │
  ServerInstance  User

  ┌─────────────────┐              ┌──────────┐
  │ TermsAcceptance │────────────▶│   User    │
  └─────────────────┘              └──────────┘

  ┌─────────────────┐     0..1     ┌──────────┐
  │  CookieConsent  │─────────────▶│   User    │
  └─────────────────┘              └──────────┘
```

**Tóm tắt cardinality:**

| Quan hệ                | Từ             | Đến             | Cardinality            |
|---------------------------|-----------------|-----------------|------------------------|
| sở hữu                      | User            | ServerInstance  | 1 : 0..*               |
| tạo ra                     | User            | AuditLog        | 1 : 0..*               |
| sở hữu                      | User            | SSHKey          | 1 : 0..*               |
| sở hữu                      | User            | Snapshot        | 1 : 0..*               |
| sở hữu                      | User            | ApiKey          | 1 : 0..*               |
| mở                     | User            | Ticket          | 1 : 0..*               |
| giới thiệu                    | User            | Referral        | 1 : 0..*               |
| có                       | User            | Notification    | 1 : 0..*               |
| có                       | User            | Session         | 1 : 0..*               |
| có                       | User            | PaymentMethod   | 1 : 0..*               |
| có                       | User            | TwoFactorAuth   | 1 : 0..1               |
| dựa trên                  | ServerInstance  | ServerPlan      | * : 1                  |
| sử dụng image                | ServerInstance  | ImageTemplate   | * : 1                  |
| triển khai trên               | ServerInstance  | Node            | * : 1                  |
| đặt tại                | ServerInstance  | Region          | * : 1                  |
| xác thực bằng                 | ServerInstance  | SSHKey          | * : 0..1               |
| khởi động từ                 | ServerInstance  | Snapshot        | * : 0..1               |
| có                       | ServerInstance  | Backup          | 1 : 0..*               |
| có                       | ServerInstance  | FirewallRule    | 1 : 0..*               |
| có                       | ServerInstance  | DnsRecord       | 1 : 0..*               |
| có                       | ServerInstance  | VpsTag          | * : *                  |
| phục vụ                    | Region          | ServerPlan      | * : *                  |
| phục vụ                    | Region          | ImageTemplate   | * : *                  |
| đặt tại                | Node            | Region          | * : 1                  |
| sở hữu (pool)               | Node            | IpAddress       | 1 : 0..*               |
| được gán cho               | IpAddress       | ServerInstance  | 0..1 : 1               |
| sở hữu                      | User            | Payment         | 1 : 0..*               |
| tạo ra                     | User            | Invoice         | 1 : 0..*               |
| sử dụng                      | User            | Voucher         | * : * qua VoucherUsage |
| được viết bởi               | BlogPost        | User            | * : 1                  |
| thuộc về                | BlogPost        | BlogCategory    | * : 1                  |
| được gán cho               | Ticket          | User (Staff)    | * : 0..1               |
| sở hữu                      | User            | PrivateNetwork  | 1 : 0..*               |
| giới hạn trong                 | PrivateNetwork  | Region          | * : 1                  |
| tham gia (qua SPN)           | ServerInstance  | PrivateNetwork  | * : 0..1 qua ServerPrivateNetwork |
| sở hữu                      | User            | FloatingIp      | 1 : 0..*               |
| giới hạn trong                 | FloatingIp      | Region          | * : 1                  |
| được gán cho               | FloatingIp      | ServerInstance  | 0..1 : 1               |
| sở hữu                      | User            | BlockVolume     | 1 : 0..*               |
| giới hạn trong                 | BlockVolume     | Region          | * : 1                  |
| được cấp phát trên            | BlockVolume     | Node            | 0..1 : 1               |
| được gắn vào               | BlockVolume     | ServerInstance  | 0..1 : 1               |
| có                       | User            | WebhookEndpoint | 1 : 0..*               |
| tạo ra                     | WebhookEndpoint | WebhookDelivery | 1 : 0..*               |
| theo dõi                    | ServerInstance  | BandwidthUsage  | 1 : 0..*               |
| báo cáo                   | User            | AbuseReport     | 0..1 : 0..*            |
| liên quan đến                  | AbuseReport     | ServerInstance  | 0..1 : 1               |
| được xem xét bởi       | User (Staff)    | AbuseReport     | 0..1 : 0..*            |
| chấp nhận                   | User            | TermsAcceptance | 1 : 0..*               |
| đồng ý qua              | User            | CookieConsent   | 0..1 : 0..*            |

---

## Thực Thể Cốt Lõi

### User

| Thuộc tính              | Kiểu            | Ràng buộc                              | Mô tả                                              |
|------------------------|-----------------|--------------------------------------|-------------------------------------------------|
| id                     | UUID            | PK, not null                         |                                                 |
| username               | string(32)      | UNIQUE (partial, active only), not null | Tên hiển thị và định danh đăng nhập       |
| email                  | string(255)     | UNIQUE (partial, active only), not null | Liên hệ và định danh đăng nhập          |
| passwordHash           | string(60)      | not null                             | Hash bcrypt                                     |
| role                   | enum            | not null, default: CUSTOMER          | CUSTOMER, STAFF, ADMIN                          |
| status                 | enum            | not null, default: ACTIVE            | ACTIVE, LOCKED, PENDING_VERIFICATION, SUSPENDED |
| balance                | decimal(12,2)   | not null, default: 0.00              | Số dư ví trong đơn vị tiền tệ hệ thống               |
| referralCode           | string(16)      | UNIQUE, not null                     | Tự động tạo khi khởi tạo                     |
| taxExempt              | boolean         | not null, default: false             | Cờ do Admin đặt                                  |
| billingAddress         | JSON?           | nullable                             | {line1, line2, city, state, postal, country}    |
| spendingCap            | decimal(10,2)?  | nullable                             | Null = không giới hạn chi tiêu ([BR-112])               |
| failedLoginAttempts    | int             | not null, default: 0                 | Đặt lại khi đăng nhập thành công                      |
| lockedUntil            | datetime?       | nullable                             | Null khi tài khoản không bị khóa                 |
| lastLoginAt            | datetime?       | nullable                             |                                                 |
| emailVerifiedAt        | datetime?       | nullable                             |                                                 |
| createdAt              | datetime        | not null, default: now()             |                                                 |
| updatedAt              | datetime        | not null, auto-update                |                                                 |
| deletedAt              | datetime?       | nullable (xóa tài khoản GDPR)        |                                                 |

**Ràng buộc tính duy nhất:** Cả `username` và `email` đều sử dụng **chỉ mục duy nhất một phần** — tính duy nhất chỉ được thực thi trên các hàng có `deletedAt IS NULL`. Điều này có nghĩa là thông tin đăng nhập của tài khoản đã bị xóa mềm được giải phóng để đăng ký lại:

```sql
CREATE UNIQUE INDEX "User_username_key" ON "User" (LOWER(username)) WHERE "deletedAt" IS NULL;
CREATE UNIQUE INDEX "User_email_key"    ON "User" (LOWER(email))    WHERE "deletedAt" IS NULL;
```

**Các trường hợp biên được xử lý:**
- Người dùng đã xóa đăng ký lại với cùng email → được phép (bản ghi cũ bị loại khỏi chỉ mục).
- Người dùng đang hoạt động cố gắng sử dụng email thuộc về người dùng đang hoạt động khác → bị chặn.
- Xóa GDPR: sau khi xóa cứng (30 ngày sau yêu cầu), hàng bị xóa vật lý; chỉ mục một phần vẫn có hiệu lực với các người dùng đang hoạt động còn lại.
- Thay đổi username/email bởi người dùng đang hoạt động chỉ được xác thực dựa trên tập con đang hoạt động.

### TwoFactorAuth

| Thuộc tính              | Kiểu            | Ràng buộc                          | Mô tả                              |
|------------------------|-----------------|--------------------------------------|------------------------------------------|
| id                     | UUID            | PK, not null                         |                                          |
| userId                 | UUID            | FK → User, UNIQUE, not null          | Một trên mỗi người dùng                             |
| secret                 | string(64)      | not null                             | TOTP secret (đã mã hóa)                  |
| enabled                | boolean         | not null, default: false             |                                          |
| backupCodes            | JSON            | nullable                             | Mảng mã dự phòng đã hash             |
| createdAt              | datetime        | not null, default: now()             |                                          |
| updatedAt              | datetime        | not null, auto-update                |                                          |

### Session

| Thuộc tính              | Kiểu            | Ràng buộc                          | Mô tả                              |
|------------------------|-----------------|--------------------------------------|------------------------------------------|
| id                     | UUID            | PK, not null                         |                                          |
| userId                 | UUID            | FK → User, not null                  |                                          |
| refreshTokenHash       | string(128)     | not null                             | Refresh token đã hash                     |
| userAgent              | string(512)?    | nullable                             | Thông tin trình duyệt/client                      |
| ipAddress              | string(45)      | not null                             |                                          |
| expiresAt              | datetime        | not null                             |                                          |
| createdAt              | datetime        | not null, default: now()             |                                          |

### ApiKey

| Thuộc tính              | Kiểu            | Ràng buộc                          | Mô tả                              |
|------------------------|-----------------|--------------------------------------|------------------------------------------|
| id                     | UUID            | PK, not null                         |                                          |
| userId                 | UUID            | FK → User, not null                  |                                          |
| label                  | string(64)      | not null                             | VD: "My CI/CD pipeline"                 |
| keyPrefix              | string(8)       | not null                             | 8 ký tự đầu để nhận dạng         |
| keyHash                | string(128)     | not null                             | Khóa đầy đủ đã hash                          |
| lastUsedAt             | datetime?       | nullable                             |                                          |
| expiresAt              | datetime?       | nullable                             | Null = không bao giờ hết hạn                     |
| createdAt              | datetime        | not null, default: now()             |                                          |

### ServerPlan

| Thuộc tính        | Kiểu            | Ràng buộc                  | Mô tả                                  |
|------------------|-----------------|------------------------------|----------------------------------------------|
| id               | UUID            | PK, not null                 |                                              |
| name             | string(64)      | not null                     | VD: "Starter", "Pro", "Enterprise"          |
| slug             | string(32)      | UNIQUE, not null             | Định danh thân thiện URL                      |
| vcpu             | int             | not null, ≥ 1                | Số lõi CPU ảo (cgroup shares)            |
| ramMB            | int             | not null, ≥ 256              | RAM tính bằng megabyte                             |
| diskGB           | int             | not null, ≥ 5                | Dung lượng đĩa tính bằng gigabyte                       |
| bandwidthMbps    | int             | not null, ≥ 10               | Giới hạn băng thông mạng                        |
| priceMonthly     | decimal(10,2)   | not null                     | Giá đăng ký hàng tháng                   |
| priceHourly      | decimal(10,2)   | not null                     | Giá theo giờ                    |
| maxServers       | int?            | nullable                     | Số server tối đa cho gói này (null = không giới hạn) |
| isActive         | boolean         | not null, default: true      | Vô hiệu hóa mềm cho các gói đã ngừng               |
| createdAt        | datetime        | not null, default: now()     |                                              |
| updatedAt        | datetime        | not null, auto-update        |                                              |

### ImageTemplate

| Thuộc tính        | Kiểu            | Ràng buộc                  | Mô tả                              |
|------------------|-----------------|------------------------------|------------------------------------------|
| id               | UUID            | PK, not null                 |                                          |
| name             | string(128)     | not null                     | VD: "Ubuntu 24.04 LTS"                  |
| slug             | string(64)      | UNIQUE, not null             |                                          |
| osType           | enum            | not null                     | LINUX                                    |
| version          | string(32)      | not null                     | VD: "24.04"                             |
| dockerImage      | string(255)     | not null                     | VD: "registry.astral.cloud/ubuntu:24.04"|
| diskSizeGB       | int             | not null                     | Kích thước đĩa image cơ sở              |
| defaultUser      | string(32)      | not null                     | Người dùng SSH mặc định (VD: "root")           |
| isActive         | boolean         | not null, default: true      |                                          |
| createdAt        | datetime        | not null, default: now()     |                                          |
| updatedAt        | datetime        | not null, auto-update        |                                          |

### Region

| Thuộc tính        | Kiểu            | Ràng buộc                  | Mô tả                              |
|------------------|-----------------|------------------------------|------------------------------------------|
| id               | UUID            | PK, not null                 |                                          |
| name             | string(64)      | not null                     | VD: "US East", "EU West"                |
| slug             | string(16)      | UNIQUE, not null             | VD: "us-east", "eu-west"                |
| isActive         | boolean         | not null, default: true      |                                          |
| createdAt        | datetime        | not null, default: now()     |                                          |

### Node (Máy Chủ Docker)

| Thuộc tính            | Kiểu            | Ràng buộc                  | Mô tả                                                  |
|----------------------|-----------------|------------------------------|---------------------------------------------------------|
| id                   | UUID            | PK, not null                 |                                                         |
| name                 | string(64)      | not null                     | VD: "docker-node-01"                                   |
| regionId             | UUID            | FK → Region, not null        |                                                         |
| status               | enum            | not null                     | ONLINE, OFFLINE, MAINTENANCE                            |
| dockerEndpoint       | string(255)     | not null                     | VD: "unix:///var/run/docker.sock" hoặc "tcp://host:2375" |
| totalVcpu            | int             | not null                     | Tổng số lõi CPU khả dụng                               |
| totalRamMB           | int             | not null                     | Tổng RAM khả dụng                                     |
| totalDiskGB          | int             | not null                     | Tổng dung lượng đĩa khả dụng cho volumes                        |
| allocatedVcpu        | int             | not null, default: 0         | Tổng vCPU đã phân bổ cho containers                     |
| allocatedRamMB       | int             | not null, default: 0         | Tổng RAM đã phân bổ cho containers                      |
| allocatedDiskGB      | int             | not null, default: 0         | Tổng dung lượng đĩa đã phân bổ cho containers                     |
| lastHeartbeatAt      | datetime?       | nullable                     | Lần kiểm tra sức khỏe thành công cuối cùng                            |
| createdAt            | datetime        | not null, default: now()     |                                                         |
| updatedAt            | datetime        | not null, auto-update        |                                                         |

**Bất biến:** `allocatedX ≤ totalX` cho vCPU, RAM và disk ([BR-05]).

### IpAddress (IPAM)

| Thuộc tính            | Kiểu            | Ràng buộc                  | Mô tả                              |
|----------------------|-----------------|------------------------------|------------------------------------------|
| id                   | UUID            | PK, not null                 |                                          |
| nodeId               | UUID            | FK → Node, not null          | Máy chủ mà IP này thuộc về              |
| address              | string(45)      | not null                     | VD: "203.0.113.42"                      |
| type                 | enum            | not null                     | IPv4, IPv6                               |
| serverId             | UUID?           | FK → ServerInstance, UNIQUE  | Null = TRỐNG; non-null = đã gán         |
| allocatedAt          | datetime?       | nullable                     | Được đặt khi `serverId` được gán          |
| createdAt            | datetime        | not null, default: now()     |                                          |

**Bất biến:** `serverId` là `UNIQUE` — không có hai ServerInstances nào có thể tham chiếu cùng một IpAddress. Một IP được phân bổ nguyên tử cùng với đặt chỗ dung lượng Node ([BR-05]). Khi một server bị xóa, `serverId` và `allocatedAt` được đặt thành `NULL`, giải phóng IP trở lại pool ([BR-16]).

**Ràng buộc:** `(nodeId, address)` phải là duy nhất — không có IP trùng lặp trong cùng một node.

### ServerInstance

| Thuộc tính            | Kiểu            | Ràng buộc                  | Mô tả                                              |
|----------------------|-----------------|------------------------------|------------------------------------------|
| id                   | UUID            | PK, not null                 |                                          |
| userId               | UUID            | FK → User, not null          | Chủ sở hữu                                    |
| serverPlanId         | UUID            | FK → ServerPlan, not null    | Gói cơ sở (null nếu thông số tùy chỉnh)         |
| imageTemplateId      | UUID?           | FK → ImageTemplate           | Null khi tạo từ snapshot          |
| snapshotId           | UUID?           | FK → Snapshot                | Null khi tạo từ image             |
| nodeId               | UUID            | FK → Node, not null          | Máy chủ Docker                              |
| regionId             | UUID            | FK → Region, not null        |                                          |
| sshKeyId             | UUID?           | FK → SSHKey                  | Null nếu sử dụng xác thực mật khẩu               |
| hostname             | string(64)      | not null                     | Nhãn do người dùng đặt ([BR-11])            |
| status               | enum            | not null, default: CREATING  | Xem máy trạng thái bên dưới                  |
| lockedBy             | enum?           | nullable                     | Thao tác async đang hoạt động: CREATING, STOPPING, RESTARTING, DELETING, BACKING_UP, RESTORING |
| lockedAt             | datetime?       | nullable                     | Được đặt khi khóa được chiếm; NULL khi mở khóa |
| ipAddress            | string(45)      | nullable                     | Dẫn xuất từ IpAddress; được gán sau khi provisioning |
| dockerContainerId    | string(64)      | nullable                     | Docker container ID                      |
| vcpu                 | int             | not null                     | vCPU đã phân bổ                           |
| ramMB                | int             | not null                     | RAM đã phân bổ                            |
| diskGB               | int             | not null, ≥ 5                | Dung lượng đĩa đã phân bổ ([BR-10])                 |
| billingModel         | enum            | not null, default: MONTHLY   | MONTHLY, HOURLY                          |
| rootPassword         | string(255)?    | nullable (đã mã hóa)         | Null nếu sử dụng xác thực khóa SSH                |
| cloudInitScript      | text?           | nullable (tối đa 64 KB)      | Cloud-init user-data script              |
| nextBillingAt        | datetime?       | nullable                     | Thời điểm tự động trừ tiền tiếp theo                 |
| gracePeriodEndsAt    | datetime?       | nullable                     | Được đặt khi trừ tiền thất bại ([BR-29])       |
| createdAt            | datetime        | not null, default: now()     |                                          |
| updatedAt            | datetime        | not null, auto-update        |                                          |
| deletedAt            | datetime?       | nullable (xóa mềm)           |                                          |

**Ràng buộc:** Chính xác một trong `imageTemplateId` hoặc `snapshotId` phải khác null ([BR-03]).

**Ngữ nghĩa khóa:** `lockedBy` và `lockedAt` tạo thành một khóa bi quan ngăn chặn các thao tác đồng thời trên cùng một server. Khóa được chiếm nguyên tử qua một UPDATE có điều kiện trước bất kỳ lệnh gọi Docker Engine nào:

```sql
UPDATE "ServerInstance"
SET "lockedBy" = :operation, "lockedAt" = NOW()
WHERE "id" = :serverId AND "lockedBy" IS NULL;
```

Nếu `rows affected = 0`, server đã bị khóa — API trả về `409 CONFLICT` với giá trị `lockedBy` hiện tại (VD: `"Server is currently backing up"`). Khóa được giải phóng bằng cách đặt cả hai trường thành `NULL` khi thao tác hoàn tất (thành công hoặc thất bại). Các khóa cũ (vượt quá timeout cụ thể cho từng thao tác) được phát hiện và xóa bởi một cron job, cron job này cũng đánh dấu server là `ERROR` và cảnh báo admin.

### PrivateNetwork

| Thuộc tính        | Kiểu            | Ràng buộc                  | Mô tả                              |
|------------------|-----------------|------------------------------|------------------------------------------|
| id               | UUID            | PK, not null                 |                                          |
| userId           | UUID            | FK → User, not null          | Chủ sở hữu                                    |
| regionId         | UUID            | FK → Region, not null        | Mạng được giới hạn theo region               |
| name             | string(64)      | not null                     | VD: "web-tier"                         |
| cidr             | string(18)      | not null                     | VD: "10.0.0.0/24"                      |
| isActive         | boolean         | not null, default: true      |                                          |
| createdAt        | datetime        | not null, default: now()     |                                          |

### ServerPrivateNetwork (bảng liên kết)

| Thuộc tính            | Kiểu            | Ràng buộc                  | Mô tả                              |
|----------------------|-----------------|------------------------------|------------------------------------------|
| id                   | UUID            | PK, not null                 |                                          |
| serverId             | UUID            | FK → ServerInstance, not null|                                          |
| networkId            | UUID            | FK → PrivateNetwork, not null|                                          |
| privateIp            | string(45)      | not null                     | Tự động gán từ CIDR                  |
| attachedAt           | datetime        | not null, default: now()     |                                          |

**Ràng buộc:** Một server chỉ có thể thuộc về tối đa một PrivateNetwork tại một thời điểm (UNIQUE trên serverId).

### FloatingIp

| Thuộc tính            | Kiểu            | Ràng buộc                  | Mô tả                              |
|----------------------|-----------------|------------------------------|------------------------------------------|
| id                   | UUID            | PK, not null                 |                                          |
| userId               | UUID            | FK → User, not null          | Chủ sở hữu                                    |
| regionId             | UUID            | FK → Region, not null        |                                          |
| ipAddress            | string(45)      | not null                     | Địa chỉ IP floating                  |
| serverId             | UUID?           | FK → ServerInstance, UNIQUE  | Null = chưa gán                        |
| assignedAt           | datetime?       | nullable                     |                                          |
| createdAt            | datetime        | not null, default: now()     |                                          |

### BlockVolume

| Thuộc tính            | Kiểu            | Ràng buộc                  | Mô tả                              |
|----------------------|-----------------|------------------------------|------------------------------------------|
| id                   | UUID            | PK, not null                 |                                          |
| userId               | UUID            | FK → User, not null          | Chủ sở hữu                                    |
| regionId             | UUID            | FK → Region, not null        |                                          |
| nodeId               | UUID?           | FK → Node                    | Được đặt khi đã cấp phát                     |
| name                 | string(64)      | not null                     | Nhãn do người dùng đặt                      |
| sizeGB               | int             | not null, ≥ 1, ≤ 16384       | Kích thước block storage                       |
| status               | enum            | not null, default: CREATING  | CREATING, AVAILABLE, ATTACHED, DETACHING, DELETING, ERROR |
| serverId             | UUID?           | FK → ServerInstance          | Null = chưa gắn                        |
| devicePath           | string(16)?     | nullable                     | VD: "/dev/sdb" — được đặt khi đã gắn      |
| attachedAt           | datetime?       | nullable                     |                                          |
| dockerVolumeId       | string(64)?     | nullable                     | Docker volume ID                         |
| createdAt            | datetime        | not null, default: now()     |                                          |
| deletedAt            | datetime?       | nullable (xóa mềm)           |                                          |

### AuditLog

| Thuộc tính        | Kiểu            | Ràng buộc                  | Mô tả                              |
|------------------|-----------------|------------------------------|------------------------------------------|
| id               | UUID            | PK, not null                 |                                          |
| userId           | UUID?           | FK → User                    | Null sau khi ẩn danh GDPR            |
| action           | enum            | not null                     | SERVER_CREATED, SERVER_STARTED, v.v.     |
| targetType       | string(32)      | not null                     | VD: "ServerInstance", "User"            |
| targetId         | UUID            | not null                     | ID của thực thể đích                  |
| result           | enum            | not null                     | SUCCESS, FAILURE                         |
| metadata         | JSON            | nullable                     | Ngữ cảnh bổ sung                       |
| ipAddress        | string(45)      | not null                     | IP máy khách (được cắt ngắn sau GDPR)     |
| createdAt        | datetime        | not null, default: now()     | Bất biến — không có cột update             |

---

## Thực Thể Thanh Toán

### Payment (Stripe)

| Thuộc tính        | Kiểu            | Ràng buộc                  | Mô tả                              |
|------------------|-----------------|------------------------------|------------------------------------------|
| id               | UUID            | PK, not null                 |                                          |
| userId           | UUID            | FK → User, not null          |                                          |
| stripePaymentId  | string(64)      | UNIQUE, not null             | Stripe PaymentIntent ID                  |
| amount           | decimal(10,2)   | not null                     | Số tiền trong đơn vị tiền tệ hệ thống                |
| currency         | string(3)       | not null, default: "USD"     | ISO 4217                                 |
| status           | enum            | not null                     | PENDING, COMPLETED, FAILED, REFUNDED     |
| type             | enum            | not null                     | TOP_UP, CHARGE, REFUND                   |
| voucherId        | UUID?           | FK → Voucher                 | Voucher đã áp dụng (qua VoucherUsage)       |
| createdAt        | datetime        | not null, default: now()     |                                          |

### PaymentMethod

| Thuộc tính               | Kiểu            | Ràng buộc                  | Mô tả                              |
|----------------------|-----------------|------------------------------|------------------------------------------|
| id                   | UUID            | PK, not null                 |                                          |
| userId               | UUID            | FK → User, not null          |                                          |
| stripePaymentMethodId| string(64)      | UNIQUE, not null             | Stripe PaymentMethod ID                  |
| brand                | string(32)      | not null                     | VD: "visa", "mastercard"                |
| last4                | string(4)       | not null                     | 4 chữ số cuối                            |
| expMonth             | int             | not null                     |                                          |
| expYear              | int             | not null                     |                                          |
| isDefault            | boolean         | not null, default: false     |                                          |
| createdAt            | datetime        | not null, default: now()     |                                          |

### Invoice

| Thuộc tính        | Kiểu            | Ràng buộc                  | Mô tả                              |
|------------------|-----------------|------------------------------|------------------------------------------|
| id               | UUID            | PK, not null                 |                                          |
| userId           | UUID            | FK → User, not null          |                                          |
| invoiceNumber    | string(32)      | UNIQUE, not null             | Tuần tự, VD: "INV-2026-00042"        |
| paymentId        | UUID            | FK → Payment, not null       |                                          |
| subtotal         | decimal(10,2)   | not null                     |                                          |
| taxAmount        | decimal(10,2)   | not null, default: 0.00      |                                          |
| discountAmount   | decimal(10,2)   | not null, default: 0.00      | Từ voucher                             |
| total            | decimal(10,2)   | not null                     |                                          |
| currency         | string(3)       | not null, default: "USD"     |                                          |
| status           | enum            | not null                     | PAID, VOID, REFUNDED                     |
| pdfUrl           | string(512)?    | nullable                     | URL lưu trữ PDF đã tạo                |
| createdAt        | datetime        | not null, default: now()     |                                          |

### InvoiceLineItem

| Thuộc tính        | Kiểu            | Ràng buộc                  | Mô tả                              |
|------------------|-----------------|------------------------------|------------------------------------------|
| id               | UUID            | PK, not null                 |                                          |
| invoiceId        | UUID            | FK → Invoice, not null       |                                          |
| description      | string(255)     | not null                     | VD: "Server: my-web-server (Starter)"   |
| quantity         | int             | not null, default: 1         |                                          |
| unitPrice        | decimal(10,2)   | not null                     |                                          |
| total            | decimal(10,2)   | not null                     | quantity × unitPrice                     |

---

## Thực Thể Voucher

### Voucher

| Thuộc tính        | Kiểu            | Ràng buộc                  | Mô tả                              |
|------------------|-----------------|------------------------------|------------------------------------------|
| id               | UUID            | PK, not null                 |                                          |
| code             | string(32)      | UNIQUE, not null             | Mã duy nhất không phân biệt hoa thường             |
| description      | string(255)     | not null                     | VD: "Launch week 20% off"               |
| discountType     | enum            | not null                     | PERCENTAGE, FIXED_AMOUNT                 |
| discountValue    | decimal(10,2)   | not null                     | VD: 20.00 = 20% hoặc $20.00               |
| maxUses          | int?            | nullable                     | Null = không giới hạn                         |
| currentUses      | int             | not null, default: 0         |                                          |
| maxUsesPerUser   | int             | not null, default: 1         |                                          |
| minSpend         | decimal(10,2)   | nullable                     | Thanh toán tối thiểu để áp dụng voucher         |
| validFrom        | datetime?       | nullable                     |                                          |
| validUntil       | datetime?       | nullable                     |                                          |
| isActive         | boolean         | not null, default: true      | Admin có thể vô hiệu hóa                        |
| createdByUserId  | UUID            | FK → User, not null          | Admin/staff đã tạo               |
| createdAt        | datetime        | not null, default: now()     |                                          |

### VoucherUsage

| Thuộc tính        | Kiểu            | Ràng buộc                  | Mô tả                              |
|------------------|-----------------|------------------------------|------------------------------------------|
| id               | UUID            | PK, not null                 |                                          |
| voucherId        | UUID            | FK → Voucher, not null       |                                          |
| userId           | UUID            | FK → User, not null          | Người đã đổi                          |
| paymentId        | UUID?           | FK → Payment                 | Thanh toán nào được áp dụng          |
| discountAmount   | decimal(10,2)   | not null                     | Giảm giá thực tế đã cấp                    |
| createdAt        | datetime        | not null, default: now()     |                                          |

---

## Thực Thể Hỗ Trợ

### Ticket

| Thuộc tính        | Kiểu            | Ràng buộc                  | Mô tả                                                       |
|------------------|-----------------|------------------------------|----------------------------------------------------------|
| id               | UUID            | PK, not null                 |                                                          |
| userId           | UUID            | FK → User, not null          | Khách hàng đã mở                                      |
| assignedUserId   | UUID?           | FK → User                    | Nhân viên được phân công                                    |
| subject          | string(255)     | not null                     |                                                          |
| status           | enum            | not null, default: OPEN      | OPEN, IN_PROGRESS, WAITING_ON_CUSTOMER, RESOLVED, CLOSED |
| priority         | enum            | not null, default: NORMAL    | LOW, NORMAL, HIGH, URGENT                                |
| category         | enum            | not null                     | GENERAL, BILLING, TECHNICAL, ABUSE                       |
| resolvedAt       | datetime?       | nullable                     |                                                          |
| closedAt         | datetime?       | nullable                     |                                                          |
| createdAt        | datetime        | not null, default: now()     |                                                          |
| updatedAt        | datetime        | not null, auto-update        |                                                          |

### TicketMessage

| Thuộc tính        | Kiểu            | Ràng buộc                  | Mô tả                              |
|------------------|-----------------|------------------------------|------------------------------------------|
| id               | UUID            | PK, not null                 |                                          |
| ticketId         | UUID            | FK → Ticket, not null        |                                          |
| userId           | UUID            | FK → User, not null          | Tác giả (khách hàng hoặc nhân viên)               |
| body             | text            | not null                     | Nội dung tin nhắn                          |
| isInternal       | boolean         | not null, default: false     | Ghi chú chỉ dành cho nhân viên                          |
| createdAt        | datetime        | not null, default: now()     | Bất biến                                |

---

## Thực Thể Blog

### BlogCategory

| Thuộc tính        | Kiểu            | Ràng buộc                  | Mô tả                              |
|------------------|-----------------|------------------------------|------------------------------------------|
| id               | UUID            | PK, not null                 |                                          |
| name             | string(64)      | not null                     | VD: "Tutorials", "Changelog", "News"    |
| slug             | string(64)      | UNIQUE, not null             |                                          |
| description      | string(255)?    | nullable                     |                                          |
| createdAt        | datetime        | not null, default: now()     |                                          |

### BlogPost

| Thuộc tính        | Kiểu            | Ràng buộc                  | Mô tả                              |
|------------------|-----------------|------------------------------|------------------------------------------|
| id               | UUID            | PK, not null                 |                                          |
| categoryId       | UUID            | FK → BlogCategory, not null  |                                          |
| authorId         | UUID            | FK → User, not null          | Phải là STAFF hoặc ADMIN                   |
| title            | string(255)     | not null                     |                                          |
| slug             | string(255)     | UNIQUE, not null             |                                          |
| excerpt          | string(500)?    | nullable                     | Tóm tắt cho cards                        |
| body             | text            | not null                     | Nội dung Markdown                         |
| coverImageUrl    | string(512)?    | nullable                     |                                          |
| status           | enum            | not null, default: DRAFT     | DRAFT, PUBLISHED, ARCHIVED               |
| publishedAt      | datetime?       | nullable                     | Được đặt khi xuất bản lần đầu                     |
| tags             | JSON            | nullable                     | Mảng chuỗi tag                     |
| createdAt        | datetime        | not null, default: now()     |                                          |
| updatedAt        | datetime        | not null, auto-update        |                                          |

---

## Thực Thể Mạng

### FirewallRule

| Thuộc tính        | Kiểu            | Ràng buộc                  | Mô tả                              |
|------------------|-----------------|------------------------------|------------------------------------------|
| id               | UUID            | PK, not null                 |                                          |
| serverId         | UUID            | FK → ServerInstance, not null|                                          |
| protocol         | enum            | not null                     | TCP, UDP, ICMP, ALL                      |
| portRange        | string(16)      | not null                     | VD: "22", "80", "8000-8100"             |
| sourceCidr       | string(45)      | not null                     | VD: "0.0.0.0/0", "10.0.0.0/8"           |
| action           | enum            | not null                     | ALLOW, DENY                              |
| priority         | int             | not null                     | Thấp hơn = được đánh giá trước                  |
| description      | string(128)?    | nullable                     |                                          |
| createdAt        | datetime        | not null, default: now()     |                                          |

### DnsRecord

| Thuộc tính        | Kiểu            | Ràng buộc                  | Mô tả                              |
|------------------|-----------------|------------------------------|------------------------------------------|
| id               | UUID            | PK, not null                 |                                          |
| serverId         | UUID            | FK → ServerInstance, not null|                                          |
| type             | enum            | not null                     | A, AAAA, CNAME, MX, TXT, PTR             |
| name             | string(255)     | not null                     | VD: "@", "www", "mail"                  |
| value            | string(512)     | not null                     | VD: địa chỉ IP, tên miền             |
| ttl              | int             | not null, default: 3600      | Thời gian sống tính bằng giây                  |
| priority         | int?            | nullable                     | Ưu tiên MX                              |
| createdAt        | datetime        | not null, default: now()     |                                          |

---

## Thực Thể Sao Lưu

### Backup

| Thuộc tính        | Kiểu            | Ràng buộc                  | Mô tả                              |
|------------------|-----------------|------------------------------|------------------------------------------|
| id               | UUID            | PK, not null                 |                                          |
| serverId         | UUID            | FK → ServerInstance, not null|                                          |
| label            | string(64)      | not null                     | Tự động tạo hoặc do người dùng cung cấp          |
| type             | enum            | not null                     | MANUAL, AUTOMATED                        |
| sizeMB           | int             | not null                     | Kích thước sao lưu                              |
| status           | enum            | not null                     | CREATING, AVAILABLE, FAILED, EXPIRED     |
| storagePath      | string(512)     | not null                     | Đường dẫn đến kho lưu trữ sao lưu trên node           |
| expiresAt        | datetime?       | nullable                     | Theo chính sách lưu giữ                     |
| createdAt        | datetime        | not null, default: now()     |                                          |

### BackupSchedule

| Thuộc tính            | Kiểu            | Ràng buộc                  | Mô tả                              |
|----------------------|-----------------|------------------------------|------------------------------------------|
| id                   | UUID            | PK, not null                 |                                          |
| serverId             | UUID            | FK → ServerInstance, UNIQUE  | Một lịch trên mỗi server                  |
| enabled              | boolean         | not null, default: false     |                                          |
| intervalHours        | int             | not null, default: 24        | Tần suất (VD: 24 = hàng ngày)              |
| retainDaily          | int             | not null, default: 7         |                                          |
| retainWeekly         | int             | not null, default: 4         |                                          |
| retainMonthly        | int             | not null, default: 3         |                                          |
| nextRunAt            | datetime        | not null                     | Lần sao lưu theo lịch tiếp theo                    |
| createdAt            | datetime        | not null, default: now()     |                                          |
| updatedAt            | datetime        | not null, auto-update        |                                          |

---

## Thực Thể Thông Báo

### Notification

| Thuộc tính        | Kiểu            | Ràng buộc                  | Mô tả                                                   |
|------------------|-----------------|------------------------------|------------------------------------------------------|
| id               | UUID            | PK, not null                 |                                                      |
| userId           | UUID            | FK → User, not null          |                                                      |
| type             | enum            | not null                     | SERVER_CREATED, PAYMENT_FAILED, TICKET_UPDATED, v.v. |
| title            | string(128)     | not null                     |                                                      |
| body             | string(512)     | not null                     |                                                      |
| link             | string(512)?    | nullable                     | Deep link đến trang liên quan                           |
| isRead           | boolean         | not null, default: false     |                                                      |
| createdAt        | datetime        | not null, default: now()     |                                                      |

### NotificationPreference

| Thuộc tính               | Kiểu            | Ràng buộc                  | Mô tả                              |
|----------------------|-----------------|------------------------------|------------------------------------------|
| id                   | UUID            | PK, not null                 |                                          |
| userId               | UUID            | FK → User, UNIQUE            | Một bộ trên mỗi người dùng                         |
| emailServerCreated   | boolean         | not null, default: true      |                                          |
| emailServerDeleted   | boolean         | not null, default: true      |                                          |
| emailPaymentFailure  | boolean         | not null, default: true      | Quan trọng — không thể vô hiệu hóa hoàn toàn          |
| emailTicketUpdates   | boolean         | not null, default: true      |                                          |
| emailMarketing       | boolean         | not null, default: false     |                                          |
| pushServerCreated    | boolean         | not null, default: true      | Push trong ứng dụng                              |
| pushTicketUpdates    | boolean         | not null, default: true      |                                          |

### WebhookEndpoint

| Thuộc tính            | Kiểu            | Ràng buộc                  | Mô tả                              |
|----------------------|-----------------|------------------------------|------------------------------------------|
| id                   | UUID            | PK, not null                 |                                          |
| userId               | UUID            | FK → User, not null          |                                          |
| url                  | string(512)     | not null                     | Phải là HTTPS                            |
| secret               | string(64)      | not null                     | Khóa ký HMAC-SHA256               |
| events               | JSON            | not null                     | Mảng chuỗi loại sự kiện              |
| isActive             | boolean         | not null, default: true      |                                          |
| lastDeliveryAt       | datetime?       | nullable                     |                                          |
| createdAt            | datetime        | not null, default: now()     |                                          |
| updatedAt            | datetime        | not null, auto-update        |                                          |

### WebhookDelivery

| Thuộc tính            | Kiểu            | Ràng buộc                  | Mô tả                              |
|----------------------|-----------------|------------------------------|------------------------------------------|
| id                   | UUID            | PK, not null                 |                                          |
| endpointId           | UUID            | FK → WebhookEndpoint, not null|                                         |
| event                | string(64)      | not null                     | VD: "server.created"                    |
| payload              | JSON            | not null                     | Payload đã gửi                    |
| status               | enum            | not null                     | PENDING, DELIVERED, FAILED               |
| responseCode         | int?            | nullable                     |                                          |
| attemptCount         | int             | not null, default: 1         |                                          |
| nextRetryAt          | datetime?       | nullable                     |                                          |
| createdAt            | datetime        | not null, default: now()     |                                          |

### BandwidthUsage (tổng hợp hàng ngày)

| Thuộc tính        | Kiểu            | Ràng buộc                  | Mô tả                              |
|------------------|-----------------|------------------------------|------------------------------------------|
| id               | UUID            | PK, not null                 |                                          |
| serverId         | UUID            | FK → ServerInstance, not null|                                          |
| date             | date            | not null                     | Ngày tổng hợp                         |
| bytesIn          | bigint          | not null, default: 0         |                                          |
| bytesOut         | bigint          | not null, default: 0         |                                          |

**Ràng buộc:** UNIQUE(serverId, date)

---

## Thực Thể Giới Thiệu

### Referral

| Thuộc tính            | Kiểu            | Ràng buộc                  | Mô tả                              |
|----------------------|-----------------|------------------------------|------------------------------------------|
| id                   | UUID            | PK, not null                 |                                          |
| referrerId           | UUID            | FK → User, not null          | Người dùng đã giới thiệu                        |
| refereeId            | UUID            | FK → User, not null          | Người dùng đã đăng ký bằng mã             |
| refereeIpAddress     | string(45)      | not null                     | Để chống lạm dụng                     |
| status               | enum            | not null, default: PENDING   | PENDING, CREDITED, PAID_OUT              |
| referrerCredit       | decimal(10,2)   | not null                     | Credit cấp cho người giới thiệu                 |
| refereeCredit        | decimal(10,2)   | not null                     | Credit cấp cho người được giới thiệu                  |
| createdAt            | datetime        | not null, default: now()     |                                          |

### ReferralPayout

| Thuộc tính            | Kiểu            | Ràng buộc                  | Mô tả                              |
|----------------------|-----------------|------------------------------|------------------------------------------|
| id                   | UUID            | PK, not null                 |                                          |
| userId               | UUID            | FK → User, not null          | Người giới thiệu nhận thanh toán                |
| amount               | decimal(10,2)   | not null                     |                                          |
| paymentId            | UUID?           | FK → Payment                 | Thanh toán liên kết (nếu thanh toán qua Stripe)      |
| status               | enum            | not null, default: PENDING   | PENDING, COMPLETED, FAILED               |
| createdAt            | datetime        | not null, default: now()     |                                          |

---

## Thực Thể Nền Tảng

### SystemSetting

| Thuộc tính        | Kiểu            | Ràng buộc                  | Mô tả                              |
|------------------|-----------------|------------------------------|------------------------------------------|
| id               | UUID            | PK, not null                 |                                          |
| key              | string(64)      | UNIQUE, not null             | VD: "site.name", "billing.currency"     |
| value            | text            | not null                     | Giá trị mã hóa chuỗi                     |
| type             | enum            | not null                     | STRING, NUMBER, BOOLEAN, JSON            |
| label            | string(128)     | not null                     | Tên dễ đọc                      |
| description      | string(255)?    | nullable                     |                                          |
| isImmutable      | boolean         | not null, default: false     | Không thể thay đổi qua UI                 |
| updatedByUserId  | UUID?           | FK → User                    | Admin cuối cùng đã sửa                     |
| createdAt        | datetime        | not null, default: now()     |                                          |
| updatedAt        | datetime        | not null, auto-update        |                                          |

### EmailTemplate

| Thuộc tính        | Kiểu            | Ràng buộc                  | Mô tả                              |
|------------------|-----------------|------------------------------|------------------------------------------|
| id               | UUID            | PK, not null                 |                                          |
| code             | string(64)      | UNIQUE, not null             | VD: "server.created", "payment.failed"  |
| name             | string(128)     | not null                     | Nhãn dễ đọc                     |
| subject          | string(255)     | not null                     | Dòng tiêu đề (hỗ trợ biến)        |
| htmlBody         | text            | not null                     | Nội dung email HTML (hỗ trợ biến)     |
| textBody         | text            | nullable                     | Dự phòng văn bản thuần                      |
| variables        | JSON            | nullable                     | Mảng tên biến khả dụng        |
| isActive         | boolean         | not null, default: true      |                                          |
| createdAt        | datetime        | not null, default: now()     |                                          |
| updatedAt        | datetime        | not null, auto-update        |                                          |

### Announcement

| Thuộc tính        | Kiểu            | Ràng buộc                  | Mô tả                              |
|------------------|-----------------|------------------------------|------------------------------------------|
| id               | UUID            | PK, not null                 |                                          |
| title            | string(128)     | not null                     |                                          |
| body             | text            | not null                     | Nội dung Markdown                         |
| severity         | enum            | not null, default: INFO      | INFO, WARNING, CRITICAL                  |
| isActive         | boolean         | not null, default: true      |                                          |
| startsAt         | datetime?       | nullable                     | Thời gian bắt đầu hiển thị theo lịch                  |
| endsAt           | datetime?       | nullable                     | Thời gian kết thúc hiển thị theo lịch                    |
| createdByUserId  | UUID            | FK → User, not null          |                                          |
| createdAt        | datetime        | not null, default: now()     |                                          |

### TaxRate

| Thuộc tính        | Kiểu            | Ràng buộc                  | Mô tả                              |
|------------------|-----------------|------------------------------|------------------------------------------|
| id               | UUID            | PK, not null                 |                                          |
| regionId         | UUID            | FK → Region, UNIQUE          | Một mức thuế trên mỗi region                      |
| name             | string(64)      | not null                     | VD: "US Sales Tax", "EU VAT"            |
| rate             | decimal(5,2)    | not null                     | Phần trăm (VD: 8.25)                   |
| isActive         | boolean         | not null, default: true      |                                          |
| createdAt        | datetime        | not null, default: now()     |                                          |
| updatedAt        | datetime        | not null, auto-update        |                                          |

### FeatureFlag

| Thuộc tính            | Kiểu            | Ràng buộc                  | Mô tả                              |
|----------------------|-----------------|------------------------------|------------------------------------------|
| id                   | UUID            | PK, not null                 |                                          |
| key                  | string(64)      | UNIQUE, not null             | VD: "floating_ips", "private_networking"|
| description          | string(255)     | not null                     |                                          |
| enabled              | boolean         | not null, default: false     | Bật/tắt toàn cục                            |
| rules                | JSON?           | nullable                     | Theo người dùng, theo vai trò, triển khai theo phần trăm   |
| createdAt            | datetime        | not null, default: now()     |                                          |
| updatedAt            | datetime        | not null, auto-update        |                                          |

### AbuseReport

| Thuộc tính            | Kiểu            | Ràng buộc                  | Mô tả                              |
|----------------------|-----------------|------------------------------|------------------------------------------|
| id                   | UUID            | PK, not null                 |                                          |
| reporterUserId       | UUID?           | FK → User                    | Null nếu gửi ẩn danh qua biểu mẫu   |
| serverId             | UUID?           | FK → ServerInstance          | Null nếu không liên quan đến server cụ thể              |
| type                 | enum            | not null                     | DMCA, SPAM, MALWARE, CRYPTO_MINING, PHISHING, OTHER |
| description          | text            | not null                     | Chi tiết lạm dụng                     |
| evidence             | text?           | nullable                     | URL, ảnh chụp màn hình, v.v.                  |
| status               | enum            | not null, default: PENDING   | PENDING, REVIEWING, VALIDATED, DISMISSED, RESOLVED |
| resolution           | text?           | nullable                     | Ghi chú của admin về giải quyết                |
| reviewedByUserId     | UUID?           | FK → User                    | Staff/admin đã xem xét                 |
| createdAt            | datetime        | not null, default: now()     |                                          |
| resolvedAt           | datetime?       | nullable                     |                                          |

### TermsAcceptance

| Thuộc tính            | Kiểu            | Ràng buộc                  | Mô tả                              |
|----------------------|-----------------|------------------------------|------------------------------------------|
| id                   | UUID            | PK, not null                 |                                          |
| userId               | UUID            | FK → User, not null          |                                          |
| termsType            | enum            | not null                     | TOS, PRIVACY_POLICY                      |
| version              | string(32)      | not null                     | VD: "2026.1"                            |
| acceptedAt           | datetime        | not null, default: now()     |                                          |

### CookieConsent

| Thuộc tính            | Kiểu            | Ràng buộc                  | Mô tả                              |
|----------------------|-----------------|------------------------------|------------------------------------------|
| id                   | UUID            | PK, not null                 |                                          |
| userId               | UUID?           | FK → User                    | Null cho khách truy cập ẩn danh              |
| sessionId            | string(64)?     | nullable                     | Để theo dõi ẩn danh                   |
| preferences          | JSON            | not null                     | {analytics: true, marketing: false, ...} |
| createdAt            | datetime        | not null, default: now()     |                                          |

### GdprRequest

| Thuộc tính        | Kiểu            | Ràng buộc                  | Mô tả                              |
|------------------|-----------------|------------------------------|------------------------------------------|
| id               | UUID            | PK, not null                 |                                          |
| userId           | UUID            | FK → User, not null          |                                          |
| type             | enum            | not null                     | EXPORT, DELETE                           |
| status           | enum            | not null, default: PENDING   | PENDING, PROCESSING, COMPLETED, FAILED   |
| downloadUrl      | string(512)?    | nullable                     | Link tải xuống export (có hạn)           |
| completedAt      | datetime?       | nullable                     |                                          |
| expiresAt        | datetime        | not null                     | Yêu cầu tự động hết hạn nếu không được xử lý     |
| createdAt        | datetime        | not null, default: now()     |                                          |

---

## Bảng Liên Kết & Thực Thể Nhẹ

### PlanRegion (ServerPlan ↔ Region)

| Thuộc tính  | Kiểu  | Ràng buộc              |
|------------|-------|--------------------------|
| planId     | UUID  | FK → ServerPlan, PK      |
| regionId   | UUID  | FK → Region, PK          |

### ImageRegion (ImageTemplate ↔ Region)

| Thuộc tính  | Kiểu  | Ràng buộc              |
|------------|-------|--------------------------|
| imageId    | UUID  | FK → ImageTemplate, PK   |
| regionId   | UUID  | FK → Region, PK          |

### VpsTag

| Thuộc tính  | Kiểu            | Ràng buộc                         | Mô tả                                |
|------------|-----------------|-------------------------------------|--------------------------------------|
| id         | UUID            | PK, not null                        |                                      |
| userId     | UUID            | FK → User, not null                 | Chủ sở hữu (cho tag riêng của người dùng)       |
| name       | string(32)      | not null                            | VD: "production", "staging"         |
| color      | string(7)       | nullable                            | Mã màu hex VD: "#FF5733"      |
| createdAt  | datetime        | not null, default: now()            |                                      |

### ServerTag (ServerInstance ↔ VpsTag)

| Thuộc tính  | Kiểu  | Ràng buộc                          |
|------------|-------|--------------------------------------|
| serverId   | UUID  | FK → ServerInstance, PK              |
| tagId      | UUID  | FK → VpsTag, PK                      |

### SSHKey

| Thuộc tính  | Kiểu            | Ràng buộc                  | Mô tả                              |
|------------|-----------------|------------------------------|------------------------------------------|
| id         | UUID            | PK, not null                 |                                          |
| userId     | UUID            | FK → User, not null          |                                          |
| label      | string(64)      | not null                     | VD: "My laptop"                         |
| publicKey  | text            | not null                     | Khóa công khai định dạng OpenSSH                |
| createdAt  | datetime        | not null, default: now()     |                                          |

### Snapshot *(hoãn lại)*

| Thuộc tính      | Kiểu            | Ràng buộc                  | Mô tả                              |
|--------------|-----------------|------------------------------|------------------------------------------|
| id           | UUID            | PK, not null                 |                                          |
| userId       | UUID            | FK → User, not null          |                                          |
| sourceServerId | UUID?         | FK → ServerInstance          | Server nguồn (null nếu đã xóa)          |
| label        | string(64)      | not null                     | Tên do người dùng đặt                       |
| sizeGB       | int             | not null                     | Kích thước snapshot thực tế                     |
| createdAt    | datetime        | not null, default: now()     |                                          |

---

## Máy Trạng Thái Vòng Đời Server

```
                    ┌──────────┐
                    │ CREATING │  ◀── lockedBy = CREATING
                    └────┬─────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
         success    timeout     error
              │     (BR-07)        │
              ▼          ▼          ▼
        ┌────────┐  ┌───────┐  ┌───────┐
        │ ACTIVE │  │ ERROR │  │ ERROR │
        └───┬──┬─┘  └───────┘  └───────┘
            │  │
            │  │   ┌────────────┐
            │  │   │ STOPPING   │  ◀── lockedBy = STOPPING
            │  │   └─────┬──────┘
            │  │         │
            │  │    ┌────┴────┐
            │  │  success  timeout → force kill
            │  │    │            │
            │  │    ▼            ▼
            │  │  ┌─────────┐
            │  └─▶│ STOPPED │
            │     └────┬────┘
            │          │
            │    ┌─────┴──────┐
            │    │  DELETING   │  ◀── lockedBy = DELETING
            │    └─────┬──────┘
            │          │
            │     success
            │          │
            │          ▼
            │     ┌─────────┐
            │     │ DELETED │
            │     └─────────┘
            │
            │     ┌─────────────┐
            └─────│ RESTARTING  │  ◀── lockedBy = RESTARTING
                  └──────┬──────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
         success    timeout     error
              │          │          │
              ▼          ▼          ▼
         ┌────────┐  ┌───────┐  ┌───────┐
         │ ACTIVE │  │ ERROR │  │ ERROR │
         └────────┘  └───────┘  └───────┘

   ┌──────────────┐
   │ BACKING_UP   │  ◀── lockedBy = BACKING_UP, status unchanged (ACTIVE/STOPPED)
   └──────┬───────┘
          │
     ┌────┴────┐
   success   error
     │          │
     ▼          ▼
  (status   (backup
  unchanged) failed,
             admin
             alerted)

   ┌──────────────┐
   │ RESTORING    │  ◀── lockedBy = RESTORING, server must be STOPPED
   └──────┬───────┘
          │
     ┌────┴────┐
   success   error
     │          │
     ▼          ▼
  ACTIVE     ERROR
  or STOPPED
```

**Các chuyển đổi hợp lệ:**

| Từ          | Đến          | Kích hoạt                  | Khóa được chiếm        | Quy tắc    |
|------------|-------------|------------------------------|----------------------|---------|
| (không)     | CREATING    | Tạo server                | CREATING             | UC-01   |
| CREATING   | ACTIVE      | Provision thành công            | (được giải phóng khi hoàn tất) | UC-01   |
| CREATING   | ERROR       | Provision thất bại            | (được giải phóng khi hoàn tất) | UC-01   |
| ACTIVE     | STOPPING    | Dừng server (graceful)       | STOPPING             | BR-14   |
| STOPPING   | STOPPED     | Tắt máy thành công             | (được giải phóng khi hoàn tất) | UC-06   |
| STOPPING   | ACTIVE      | Tắt máy thất bại / timeout → force → thành công | (được giải phóng khi hoàn tất) | UC-06 |
| STOPPED    | ACTIVE      | Khởi động server                 | (không cần khóa)     | BR-13   |
| ACTIVE     | RESTARTING  | Khởi động lại server               | RESTARTING           | Dẫn xuất |
| RESTARTING | ACTIVE      | Khởi động lại thành công              | (được giải phóng khi hoàn tất) | Dẫn xuất |
| RESTARTING | ERROR       | Khởi động lại thất bại              | (được giải phóng khi hoàn tất) | Dẫn xuất |
| STOPPED    | DELETING    | Xóa server                | DELETING             | BR-15   |
| DELETING   | DELETED     | Xóa thành công             | (được giải phóng khi hoàn tất) | UC-07   |
| DELETING   | ERROR       | Xóa thất bại (lưu bản ghi)| (được giải phóng khi hoàn tất) | UC-07   |
| ACTIVE     | STOPPED     | Thời gian gia hạn đã hết (BR-29) | (không khóa — cron)     | Tự động    |
| ERROR      | (thủ công)    | Can thiệp của admin           | (không khóa)            | Admin   |
| ACTIVE     | (chỉ khóa) | Sao lưu đã tạo               | BACKING_UP           | UC-13   |
| STOPPED    | (chỉ khóa) | Sao lưu đã tạo               | BACKING_UP           | UC-13   |
| STOPPED    | RESTORING   | Khôi phục từ sao lưu          | RESTORING            | UC-13   |

**Thao tác chỉ khóa:** `BACKING_UP` và `RESTORING` không thay đổi trường `status` (trừ RESTORING bắt đầu từ STOPPED và kết thúc ở ACTIVE hoặc STOPPED). Chúng sử dụng `lockedBy` chỉ để ngăn chặn các thao tác đồng thời trong khi Docker xử lý sao lưu/khôi phục.

**Timeout thao tác (trước khi khóa cũ bị cron xóa):**

| Thao tác bị khóa | Timeout    |
|------------------|------------|
| CREATING         | 60 giây |
| STOPPING         | 30 giây |
| RESTARTING       | 60 giây |
| DELETING         | 30 giây |
| BACKING_UP       | 5 phút  |
| RESTORING        | 5 phút  |

**Các chuyển đổi không hợp lệ bị từ chối ở tầng API** — handler kiểm tra `lockedBy IS NOT NULL` và trả về `409 CONFLICT` trước khi bất kỳ lệnh gọi Docker nào được thực hiện.

---

## Các Bất Biến Chính

1. **Quyền sở hữu:** `ServerInstance.userId` tham chiếu chính xác một `User` ([BR-01], [BR-02]).
2. **Giới hạn server đang hoạt động:** ≤ 5 server ở trạng thái không phải DELETED trừ khi dùng gói Enterprise ([BR-06]).
3. **Trần tài nguyên:** `allocatedX ≤ totalX` cho mọi `Node` ([BR-05]).
4. **Dung lượng đĩa tối thiểu:** `ServerInstance.diskGB ≥ 5` ([BR-10]).
5. **Kích thước image/snapshot:** `ImageTemplate.diskSizeGB ≤ ServerInstance.diskGB` ([BR-08]).
6. **Tính duy nhất hostname:** `ServerInstance.hostname` duy nhất trên mỗi `userId` ([BR-11]).
7. **Dấu vết kiểm toán:** Mọi thao tác thay đổi trạng thái đều chèn một hàng `AuditLog` bất biến ([BR-19]).
8. **Giải phóng tài nguyên:** Khi xóa server, các bộ đếm `allocated*` của node được giảm VÀ IP được giải phóng (`IpAddress.serverId = NULL`) ([BR-16]).
9. **Tính duy nhất IP:** Một địa chỉ IP công cộng không thể được gán cho nhiều hơn một server tại một thời điểm. Ràng buộc UNIQUE `IpAddress.serverId` thực thi điều này.
10. **Phân bổ IP nguyên tử:** Một địa chỉ IP được đặt chỗ trong cùng một transaction cơ sở dữ liệu với dung lượng Node — nếu một trong hai thất bại, toàn bộ transaction sẽ rollback ([BR-05]).
11. **Voucher một lần mỗi người dùng:** Một người dùng không thể đổi cùng một voucher hai lần ([BR-36]).
12. **Giới thiệu không tự giới thiệu:** Một người dùng không thể sử dụng mã giới thiệu của chính mình ([BR-57]).
13. **Xóa mềm + tính duy nhất:** Bất kỳ thực thể nào có cả xóa mềm (`deletedAt`) và ràng buộc duy nhất đều sử dụng **chỉ mục duy nhất một phần** (`WHERE "deletedAt" IS NULL`). Điều này cho phép các định danh của bản ghi đã xóa được tái sử dụng an toàn bởi các bản ghi đang hoạt động mới mà không bị xung đột UNIQUE.
14. **Khóa thao tác server:** Tối đa một thao tác async có thể thực thi trên một server tại bất kỳ thời điểm nào. Trường `lockedBy` được kiểm tra và đặt nguyên tử trước bất kỳ lệnh gọi Docker Engine nào. Một yêu cầu API đến khi server đang bị khóa sẽ nhận được `409 CONFLICT`.
15. **Phát hiện khóa cũ:** Một cron job quét các server có `lockedAt` vượt quá timeout cụ thể cho thao tác. Các khóa cũ được xóa (`lockedBy = NULL, lockedAt = NULL`), server được đánh dấu `ERROR`, và admin được cảnh báo.

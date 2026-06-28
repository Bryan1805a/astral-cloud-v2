# Kiến trúc

Tài liệu này mô tả kiến trúc tổng quan của Astral Cloud sử dụng [mô hình C4](https://c4model.com/) ở Cấp độ 1 và 2. Các quyết định công nghệ được ghi lại dưới dạng ADR trong `docs/adr/`.

---

## 1. Bối cảnh Hệ thống (C4 Cấp độ 1)

```
 ┌──────────┐           ┌─────────────────────────────────────┐           ┌──────────────┐
 │          │           │                                     │           │              │
 │ Customer │◀──HTTPS──▶│        Astral Cloud Platform        │───REST──▶│ Docker       │
 │ (Browser)│           │                                     │           │ Engine       │
 │          │           └─────────────────────────────────────┘           │ (on nodes)   │
 └──────────┘                    │            │                           └──────────────┘
                                 │            │
                          ┌──────┘            └──────┐
                          ▼                          ▼
                   ┌──────────────┐          ┌──────────────┐
                   │ SMTP / Email │          │ Stripe       │
                   │ Service      │          │ Payment      │
                   │ (SendGrid)   │          │ Gateway      │
                   └──────────────┘          └──────────────┘
```

**Hệ thống bên ngoài:**

| Hệ thống             | Giao thức     | Mục đích                                                        |
|----------------------|---------------|-----------------------------------------------------------------|
| Customer (Browser)   | HTTPS         | Ứng dụng web client                                             |
| Docker Engine        | REST API      | Vòng đời container (tạo, khởi động, dừng, xóa) trên các node     |
| SMTP / Email         | SMTP / API    | Email giao dịch (SendGrid, SMTP dự phòng)                       |
| Stripe               | HTTPS / API   | Nạp tiền ví, quản lý phương thức thanh toán, hoàn tiền           |

---

## 2. Sơ đồ Container (C4 Cấp độ 2)

```
 ┌────────────────────────────────────────────────────────────────────────┐
 │                          Astral Cloud Platform                         │
 │                                                                        │
 │  ┌────────────────────┐    ┌────────────────────┐    ┌───────────────┐ │
 │  │                    │    │                    │    │               │ │
 │  │   Next.js Web App  │    │   BullMQ Worker    │    │   Cron Jobs   │ │
 │  │                    │    │                    │    │               │ │
 │  │  - SSR pages       │    │  - Container prov. │    │  - Billing    │ │
 │  │  - REST API routes │    │  - Container life. │    │  - Cleanup    │ │
 │  │  - Auth (NextAuth) │    │  - Notifications   │    │  - Health     │ │
 │  │                    │    │  - Balance deduct  │    │               │ │
 │  └────────┬───────────┘    └────────┬───────────┘    └───────┬───────┘ │
 │           │                         │                        │         │
 │           │    ┌────────────────────┼────────────────────────┘         │
 │           │    │                    │                                  │
 │           ▼    ▼                    ▼                                  │
 │  ┌─────────────────┐    ┌──────────────────┐                           │
 │  │   PostgreSQL    │    │      Redis       │                           │
 │  │                 │    │                  │                           │
 │  │  - Users        │    │  - Job queues    │                           │
 │  │  - Servers      │    │  - Session cache │                           │
 │  │  - Audit logs   │    │  - Rate limits   │                           │
 │  │  - Plans/Images │    │                  │                           │
 │  │  - Nodes        │    │                  │                           │
 │  │  - Billing data │    │                  │                           │
 │  └─────────────────┘    └──────────────────┘                           │
 │                                                                        │
 └────────────────────────────────────────────────────────────────────────┘
                                  │
                                  │ REST API (Docker socket or TCP)
                                  ▼
                     ┌──────────────────────┐
                     │    Docker Engine     │
                     │    (on Nodes)        │
                     │                      │
                     │  - Container run     │
                     │  - Image pulls       │
                     │  - Network mgmt      │
                     │  - Volume mgmt       │
                     └──────────────────────┘
```

**Trách nhiệm của các container:**

| Container       | Công nghệ                     | Trách nhiệm                                                                                            |
|-----------------|-------------------------------|--------------------------------------------------------------------------------------------------------|
| Web App         | Next.js 14 (App Router)       | Phục vụ trang HTML (SSR), cung cấp REST API routes, xử lý xác thực (NextAuth.js v5).                  |
| BullMQ Worker   | BullMQ + Node.js              | Xử lý job bất đồng bộ: provision container, thao tác vòng đời, thông báo, trừ số dư.                  |
| Cron Jobs       | node-cron / BullMQ repeatable | Tác vụ định kỳ: trừ tiền theo giờ, dọn dẹp server cũ, kiểm tra sức khỏe node.                          |
| PostgreSQL      | PostgreSQL 16                 | Cơ sở dữ liệu quan hệ chính. Toàn bộ trạng thái bền vững: users, servers, nodes, audit logs, billing. |
| Redis           | Redis 7                       | Backend hàng đợi job (BullMQ), cache phiên, bộ đếm rate-limit.                                         |

---

## 3. Ngăn xếp Công nghệ

| Tầng               | Lựa chọn                  | Lý do (tóm tắt)                                                        |
|--------------------|---------------------------|------------------------------------------------------------------------|
| Ngôn ngữ           | TypeScript (strict)       | An toàn kiểu trên toàn bộ ngăn xếp; kiểu dùng chung giữa web app và worker. |
| Frontend           | Next.js 14 App Router     | SSR + API routes trong một dự án. Hệ sinh thái React, server components. |
| Styling            | Tailwind CSS + shadcn/ui  | CSS utility-first, các component có sẵn, hỗ trợ accessibility.          |
| API Validation     | Zod                       | Xác thực kiểu lúc runtime, chia sẻ kiểu với TypeScript.                 |
| ORM                | Prisma                    | Truy vấn type-safe, migration tự sinh, hỗ trợ multi-schema.            |
| Database           | PostgreSQL 16             | Tuân thủ ACID, row-level locking (đặt chỗ nguyên tử), hỗ trợ JSON.      |
| Auth               | NextAuth.js v5            | JWT sessions, credential + OAuth providers, middleware bảo vệ.          |
| Job Queue          | BullMQ + Redis            | Xử lý bất đồng bộ tin cậy với retry, ưu tiên, hỗ trợ idempotency.      |
| Cache              | Redis 7                   | Cũng đóng vai trò backend BullMQ. Lưu phiên, bộ đếm rate-limit.         |
| Container Runtime  | Docker Engine             | Container runtime chuẩn công nghiệp; REST API qua socket hoặc TCP.      |
| Payments           | Stripe                    | PaymentIntents cho nạp tiền, mã hóa PaymentMethod, đồng bộ webhook.     |
| Email              | SendGrid / SMTP           | Email giao dịch (xác minh, thông báo, hóa đơn).                         |
| Containerization   | Docker + Docker Compose   | Môi trường dev và deployment nhất quán. Một file compose duy nhất.      |
| CI/CD              | GitHub Actions            | Lint, type-check, test, build Docker images, chạy migrations.           |

---

## 4. Góc nhìn Triển khai (MVP)

```
 ┌──────────────────────────────────────────────────┐
 │              Docker Host (VPS / Bare Metal)       │
 │                                                  │
 │  ┌──────────┐                                    │
 │  │  Nginx   │  ← Reverse proxy, TLS termination  │
 │  │  :443    │                                    │
 │  └────┬─────┘                                    │
 │       │                                          │
 │  ┌────┴───────────────────────────────────────┐  │
 │  │            Docker Compose Stack            │  │
 │  │                                            │  │
 │  │  ┌──────────┐  ┌──────────┐  ┌─────────┐   │  │
 │  │  │  web     │  │  worker  │  │  cron   │   │  │
 │  │  │ :3000    │  │          │  │         │   │  │
 │  │  └──────────┘  └──────────┘  └─────────┘   │  │
 │  │       │              │             │       │  │
 │  │       └──────────────┼─────────────┘       │  │
 │  │                      │                     │  │
 │  │  ┌──────────┐  ┌──────────┐                │  │
 │  │  │ postgres │  │  redis   │                │  │
 │  │  │ :5432    │  │ :6379    │                │  │
 │  │  └──────────┘  └──────────┘                │  │
 │  └────────────────────────────────────────────┘  │
 │                                                  │
 └──────────────────────────────────────────────────┘
                          │
                          │ Docker Engine on same host serves
                          │ BOTH the platform containers AND
                          │ customer server containers.
                          │
                          ▼
          ┌──────────────────────────────┐
          │  Docker Engine (host daemon)  │
          │                              │
          │  - Platform containers        │
          │  - Customer server containers │
          └──────────────────────────────┘


 ┌──────────────────────────────────────────────────┐
 │          Separate Node Hosts (production)         │
 │                                                  │
 │  ┌──────────────┐  ┌──────────────┐              │
 │  │  Node 1      │  │  Node 2      │    ...       │
 │  │  Docker      │  │  Docker      │              │
 │  │  Engine      │  │  Engine      │              │
 │  │  :2375/tcp   │  │  :2375/tcp   │              │
 │  └──────────────┘  └──────────────┘              │
 │        │                  │                      │
 │        └──────────────────┼──────────────────────┘
 │                           │                      │
 │              Docker API (TCP/TLS)                 │
 └──────────────────────────────────────────────────┘
```

Trong quá trình phát triển, Nginx là tùy chọn — Next.js dev server có thể chạy trực tiếp trên cổng 3000. Trong MVP, host control-plane và host Docker Engine có thể là cùng một máy; Docker Compose stack của nền tảng và các container khách hàng chạy trên cùng một Docker daemon.

---

## 5. Môi trường Phát triển

Trong quá trình phát triển, toàn bộ ngăn xếp chạy trực tiếp trên máy của lập trình viên. Không cần ảo hóa lồng — Docker Engine chạy trực tiếp (native).

### Sơ đồ kết nối

```
 ┌──────────────────────────────────────────────────────────────────┐
 │                     Developer Machine (Linux / macOS / Windows)   │
 │                                                                  │
 │  ┌───────────┐   ┌───────────┐                                  │
 │  │ Next.js   │   │  Worker   │                                  │
 │  │ :3000     │   │ (Node.js) │                                  │
 │  │           │   │           │                                  │
 │  │ npm run   │   │ npm run   │                                  │
 │  │ dev       │   │ dev:worker│                                  │
 │  └─────┬─────┘   └─────┬─────┘                                  │
 │        │               │                                        │
 │        └───────┬───────┘                                        │
 │                │                                                │
 │  ┌─────────────┴────────────┐                                   │
 │  │    Docker Engine         │                                   │
 │  │    (Docker Desktop or    │                                   │
 │  │     native daemon)       │                                   │
 │  │                          │                                   │
 │  │  ┌──────────┐ ┌──────┐   │                                   │
 │  │  │PostgreSQL│ │Redis │   │                                   │
 │  │  │ :5432    │ │:6379 │   │                                   │
 │  │  └──────────┘ └──────┘   │                                   │
 │  │                          │                                   │
 │  │  ┌──────────────────┐    │                                   │
 │  │  │ Customer server   │    │  ← Dev/test containers           │
 │  │  │ containers        │    │    created by the worker         │
 │  │  └──────────────────┘    │                                   │
 │  └──────────────────────────┘                                   │
 │                                                                  │
 └──────────────────────────────────────────────────────────────────┘
```

### Thành phần

| Thành phần        | Chạy trên                       | Ghi chú                                                     |
|-------------------|---------------------------------|-------------------------------------------------------------|
| Next.js Web App   | Máy chủ (trực tiếp)             | `npm run dev`, cổng 3000                                    |
| BullMQ Worker     | Máy chủ (trực tiếp)             | `npm run dev:worker` trong một terminal riêng               |
| PostgreSQL        | Docker Engine                   | Định nghĩa trong `docker/docker-compose.dev.yml`            |
| Redis             | Docker Engine                   | Định nghĩa trong `docker/docker-compose.dev.yml`            |
| Customer          | Docker Engine                   | Được tạo bởi worker — cùng daemon, cách ly bởi container    |

### Điều kiện tiên quyết

- **Docker Engine**: Docker Desktop (macOS/Windows) hoặc `docker-ce` native (Linux). Không cần tiện ích mở rộng ảo hóa ngoài hỗ trợ container chuẩn.
- **RAM**: Tối thiểu **8 GB**. Docker sử dụng ~2 GB; Next.js + worker sử dụng ~1 GB; các container kiểm thử tiêu thụ phần còn lại.
- **Ổ đĩa**: ~10 GB trống cho container images và volumes.
- **Node.js**: 20 LTS trở lên để chạy Next.js và tiến trình worker.

### Bắt đầu

1. Khởi động các phụ thuộc hạ tầng:
   ```bash
   docker compose -f docker/docker-compose.dev.yml up -d
   ```
2. Chạy database migrations:
   ```bash
   npx prisma migrate dev
   ```
3. Khởi động web app:
   ```bash
   npm run dev
   ```
4. Trong terminal thứ hai, khởi động worker:
   ```bash
   npm run dev:worker
   ```
5. Tạo bản ghi node trỏ đến Docker daemon cục bộ:
   ```
   dockerEndpoint = "unix:///var/run/docker.sock"  (hoặc "tcp://localhost:2375")
   ```

### Container Runtime Giả lập

Để phát triển và kiểm thử nhanh hơn mà không cần Docker, một implementation giả lập của giao diện `ContainerRuntime` (định nghĩa trong `packages/worker/src/runtime/types.ts`) trả về container ID và IP giả lập ngay lập tức — không cần Docker Engine. Việc phát triển chuyển đổi giữa mock và Docker thực thông qua biến môi trường:

```env
CONTAINER_RUNTIME_DRIVER=mock    # hoặc "docker"
```

Cả hai driver đều triển khai cùng một TypeScript interface, vì vậy toàn bộ logic nghiệp vụ, API routes, và phát triển UI có thể tiếp tục bất kể driver nào đang hoạt động. Đây cũng chính là lớp trừu tượng cho phép thay thế Docker bằng một container runtime khác trong tương lai.

---

## 6. Luồng Yêu cầu: Tạo Server (UC-01)

```
0. Customer POST /api/servers (JWT in Authorization header)

1. Web App validates:
   - JWT (NextAuth)
   - Request body (Zod schema)
   - Business rules (BR-06, BR-08, BR-09, BR-10)

2. Web App checks balance in PostgreSQL

3. Web App queries PostgreSQL for candidate nodes sorted by free capacity DESC

4. Web App attempts atomic resource reservation inside a DB transaction:
   ┌─────────────────────────────────────────────────────────────┐
   │  Atomic Reservation Algorithm (prevents race conditions)    │
   │                                                             │
   │  FOR each candidate node (ordered by free capacity):        │
   │                                                             │
   │    -- Step A: Reserve a free IP on this node                │
   │    -- Conditional UPDATE: claims a free IPv4 address        │
   │    -- atomically. If no free IP, skip to next node.         │
   │    UPDATE "IpAddress"                                       │
   │    SET                                                      │
   │      "serverId"    = :serverId,                             │
   │      "allocatedAt" = NOW()                                  │
   │    WHERE "nodeId" = :nodeId                                 │
   │      AND "type"   = 'IPv4'                                  │
   │      AND "serverId" IS NULL                                 │
   │      AND "id" = (                                           │
   │        SELECT "id" FROM "IpAddress"                         │
   │        WHERE "nodeId" = :nodeId                             │
   │          AND "type"   = 'IPv4'                              │
   │          AND "serverId" IS NULL                             │
   │        LIMIT 1                                              │
   │      )                                                      │
   │    RETURNING "address";                                     │
   │                                                             │
   │    IF no rows RETURNED:                                     │
   │      CONTINUE (this node has no free IPs).                  │
   │                                                             │
   │    -- Step B: Reserve node capacity                         │
   │    -- Conditional UPDATE: succeeds ONLY IF enough free      │
   │    -- capacity remains. Two concurrent requests will        │
   │    -- never BOTH see the same free capacity and succeed.    │
   │    UPDATE "Node"                                            │
   │    SET                                                      │
   │      "allocatedVcpu"    = "allocatedVcpu"    + :vcpu,       │
   │      "allocatedRamMB"   = "allocatedRamMB"   + :ramMB,      │
   │      "allocatedDiskGB"  = "allocatedDiskGB"  + :diskGB      │
   │    WHERE "id" = :nodeId                                     │
   │      AND ("totalVcpu"    - "allocatedVcpu")    >= :vcpu     │
   │      AND ("totalRamMB"   - "allocatedRamMB")   >= :ramMB    │
   │      AND ("totalDiskGB"  - "allocatedDiskGB")  >= :diskGB;  │
   │                                                             │
   │    IF rows affected = 1:                                    │
   │      -- This node is ours; INSERT ServerInstance, COMMIT.   │
   │      BREAK.                                                 │
   │    ELSE:                                                    │
   │      -- Node capacity race lost. Release the reserved IP.   │
   │      UPDATE "IpAddress" SET "serverId" = NULL,              │
   │                            "allocatedAt" = NULL             │
   │      WHERE "serverId" = :serverId;                          │
   │      CONTINUE.                                              │
   │                                                             │
   │  IF no candidate succeeded:                                 │
   │    ROLLBACK and throw EX-01-3 (no node available).          │
   │                                                             │
   │  One INSERT (same transaction): ServerInstance              │
   │  (status = CREATING, nodeId = reserved node,                │
   │   ipAddress = reserved IP)                                  │
   └─────────────────────────────────────────────────────────────┘

5. Web App enqueues job to BullMQ: { type: "provision", serverId, nodeId, planId, imageId }
   ─────────────────────────────────────────────────
   (HTTP response returns 202 Accepted + serverId to Customer)
   ─────────────────────────────────────────────────

6. Worker picks up job from Redis/BullMQ

   ╔══════════════════════════════════════════════════════════════╗
   ║  IDEMPOTENCY GUARD (before any Docker call)                  ║
   ║                                                              ║
   ║  Worker queries Docker: "Does a container tagged with        ║
   ║  serverId=<serverId> already exist on node <nodeId>?"        ║
   ║                                                              ║
   ║  If YES → skip to step 9 (retry after crash scenario).       ║
   ║  If NO  → continue to step 7 (first attempt).                ║
   ╚══════════════════════════════════════════════════════════════╝

7. Worker calls Docker Engine API: POST /containers/create
   - Sets image, CPU quota, memory limit, disk size (volume)
   - Configures network (bridge, port mapping, public IP)
   - Sets labels: { serverId, userId, hostname }

8. Docker Engine pulls image and creates container (async, worker polls via /containers/{id}/json)

   ╔══════════════════════════════════════════════════════════════╗
   ║  DATABASE TRANSACTION (steps 9, 10, 11, 13 are atomic)       ║
   ║                                                              ║
   ║  If ANY of these fail, the entire block rolls back.          ║
   ║  The job is re-queued. On retry, the idempotency guard       ║
   ║  at step 6 detects the existing container and re-applies     ║
   ║  the database sync.                                          ║
   ╚══════════════════════════════════════════════════════════════╝

9. Worker updates ServerInstance: status = ACTIVE, dockerContainerId
   (ipAddress was already set during atomic reservation at step 4)

10. Worker updates Node: allocatedVcpu += vcpu, allocatedRamMB += ramMB, etc.
    (Or no-op — if capacity was reserved at step 4, just confirm.)

11. Worker inserts AuditLog (BR-19)

12. Worker enqueues notification job → sends email (OUTSIDE transaction)

13. Worker deducts balance from User
```

### Tại sao dùng conditional UPDATE (không chỉ SELECT)

Một câu `SELECT` ngây thơ để tìm node, theo sau bởi `UPDATE` để đặt chỗ, có một khoảng trống race condition: hai yêu cầu đồng thời đều có thể `SELECT` cùng một dung lượng trống trước khi một trong hai `UPDATE` được thực thi, gây ra tình trạng cấp phát vượt mức. Câu lệnh `UPDATE ... WHERE total - allocated >= :needed` có điều kiện là **nguyên tử ở cấp độ hàng cơ sở dữ liệu** — MVCC của PostgreSQL đảm bảo rằng chỉ một trong hai UPDATE đồng thời nhìn thấy đủ dung lượng và sửa đổi hàng đó. Bên thua thấy `rows affected = 0` và thử lại với node ứng viên tiếp theo. Điều này thực thi [BR-05] mà không cần khóa cấp ứng dụng.

### Tại sao IP được đặt chỗ ở bước 4 (không phải bước 9)

Địa chỉ IP được đặt chỗ trong cùng một giao dịch nguyên tử với dung lượng node. Một câu `SELECT ... LIMIT 1` theo sau bởi `UPDATE` riêng biệt trên `IpAddress` sẽ có cùng vấn đề race-window như dung lượng node: hai yêu cầu đồng thời đều có thể cho rằng "IP này còn trống" trước khi một trong hai UPDATE đánh dấu nó đã được cấp phát. Câu truy vấn con có điều kiện (`WHERE serverId IS NULL ... RETURNING address`) là nguyên tử — row-level locking của PostgreSQL đảm bảo hai yêu cầu đồng thời không thể chiếm cùng một IP. Nếu việc đặt chỗ dung lượng node (Bước B) sau đó thất bại, IP được giải phóng trở về `NULL` trong cùng một giao dịch — không có IP mồ côi. Điều này thực thi **tính duy nhất của IP** ở cấp cơ sở dữ liệu.

### Tại sao dung lượng được đặt chỗ ở bước 4 (không phải bước 9)

Việc đặt chỗ và câu lệnh `ServerInstance` INSERT xảy ra trong cùng một giao dịch cơ sở dữ liệu. Nếu bất kỳ xác thực nào sau đó thất bại hoặc không thể đặt chỗ node nào, toàn bộ giao dịch rollback — không có trạng thái một phần (IP, dung lượng, hoặc bản ghi server). Nếu provisioning sau đó thất bại (EX-01-4, EX-01-6), worker **rollback** việc đặt chỗ bằng cách giảm bộ đếm node, giải phóng IP (`IpAddress.serverId = NULL`), và đánh dấu server là `ERROR`.

### Tại sao cần idempotency guard

Khoảng cách giữa Docker thành công (bước 8) và commit cơ sở dữ liệu (bước 9–13) là một **ranh giới dual-write** — Docker Engine và PostgreSQL không thể chia sẻ chung một giao dịch. Nếu worker gặp sự cố trong khoảng thời gian này, container tồn tại trên Docker nhưng cơ sở dữ liệu chưa được cập nhật. BullMQ gửi lại job; guard ở bước 6 phát hiện container hiện có thông qua Docker label của nó và chỉ phát lại đồng bộ cơ sở dữ liệu — bỏ qua việc tạo lại. Điều này làm cho job provisioning có tính **idempotent**. Xem thêm UC-01 EX-01-7 và UC-07 EX-07-3 cho tình huống tương đương ở phía xóa.

### Khóa Thao tác (Pessimistic lock cấp Server)

Bất kỳ thao tác bất đồng bộ nào trên một server hiện có (stop, restart, delete, backup, restore) trước tiên phải chiếm khóa `lockedBy` một cách nguyên tử:

```
POST /api/servers/:serverId/stop

1. Web App validates JWT, ownership, status (must be ACTIVE per BR-14)

2. Web App attempts atomic lock acquisition:
   ┌─────────────────────────────────────────────────────────────┐
   │  UPDATE "ServerInstance"                                    │
   │  SET "lockedBy" = 'STOPPING', "lockedAt" = NOW()             │
   │  WHERE "id"  = :serverId                                    │
   │    AND "lockedBy" IS NULL;                                  │
   │                                                             │
   │  IF rows affected = 0:                                      │
   │    -- Server is already locked. Read current lockedBy.      │
   │    -- Return 409 CONFLICT: "Server is currently {lockedBy}" │
   │    STOP.                                                    │
   └─────────────────────────────────────────────────────────────┘

3. Web App updates status to STOPPING (same transaction or immediate follow-up)

4. Web App enqueues BullMQ job: { type: "stop", serverId }
   Returns 202 Accepted to customer.

5. Worker executes stop → on completion (success or failure):
   UPDATE "ServerInstance" SET "lockedBy" = NULL, "lockedAt" = NULL, status = :newStatus
```

Điều này đảm bảo rằng người dùng không thể nhấp "Stop" và "Delete" trong khi một backup đang chạy, hoặc khởi động hai backup đồng thời. Khóa được giải phóng vô điều kiện khi job hoàn thành — cả đường dẫn thành công và thất bại.

Đối với **CREATE**, khóa được đặt lúc INSERT (`lockedBy = 'CREATING'`) vì chưa có hàng nào tồn tại trước đó. Đối với **START**, không cần khóa (thao tác gần như tức thì — `docker start` là một lệnh gọi API đơn lẻ).

**Dọn dẹp khóa cũ (Cron Job):**

```
Every 30 seconds, the cron job runs:

SELECT "id", "lockedBy", "lockedAt"
FROM "ServerInstance"
WHERE "lockedBy" IS NOT NULL
  AND "lockedAt" < NOW() - INTERVAL 'timeout';

-- timeout is per-operation (60s for CREATING, 30s for STOPPING, etc.)

FOR each stale server:
  UPDATE "ServerInstance"
  SET "lockedBy" = NULL, "lockedAt" = NULL, "status" = 'ERROR'
  WHERE "id" = :serverId;

  INSERT AuditLog (action = LOCK_STALE, metadata = { lockedBy, duration });
  ALERT admin;
```

---

## 7. Cấu trúc Dự án (Monorepo)

```
astral-cloud-v2/
├── apps/
│   └── web/                  # Next.js app
│       ├── src/
│       │   ├── app/          # App Router pages + API routes
│       │   ├── components/   # React components (shadcn/ui)
│       │   ├── lib/          # Prisma client, auth config, utils
│       │   └── middleware.ts # Auth middleware
│       ├── prisma/
│       │   └── schema.prisma # Database schema
│       ├── public/           # Static assets
│       ├── package.json
│       └── Dockerfile
│
├── packages/
│   ├── worker/               # BullMQ worker process
│   │   └── src/
│   │       ├── jobs/         # Job handlers (provision, stop, delete, notify)
│   │       ├── runtime/      # Docker client, ContainerRuntime interface
│   │       │   └── types.ts  # ContainerRuntime interface definition
│   │       ├── notifications/# Email client (SendGrid / SMTP)
│   │       └── index.ts      # Worker entry point
│   │
│   └── shared/               # Shared types, Zod schemas, constants
│       └── src/
│           ├── schemas/      # Zod validation schemas
│           ├── types/        # TypeScript type definitions
│           └── constants/    # Enums, config values
│
├── docker/
│   ├── docker-compose.yml
│   ├── docker-compose.dev.yml
│   └── nginx.conf
│
├── docs/                     # All documentation
│   └── adr/                  # Architecture Decision Records
│
├── .github/
│   └── workflows/            # CI/CD pipelines (GitHub Actions)
│
├── turbo.json                # Turborepo config
└── package.json              # Root workspace
```

### Đường dẫn chính

| Đường dẫn                                | Mục đích                                                              |
|------------------------------------------|-----------------------------------------------------------------------|
| `packages/worker/src/runtime/types.ts`   | Giao diện `ContainerRuntime` — lớp trừu tượng hóa Docker               |
| `packages/worker/src/runtime/`           | Docker API client + mock implementation                               |
| `packages/worker/src/jobs/`              | BullMQ job handlers (một file cho mỗi loại job)                       |
| `packages/worker/src/notifications/`     | Lớp trừu tượng email client (SendGrid / SMTP)                         |
| `apps/web/prisma/schema.prisma`          | Nguồn sự thật duy nhất cho toàn bộ database models                    |
| `packages/shared/src/schemas/`           | Zod schemas dùng chung giữa web app và worker                         |
| `docker/docker-compose.yml`              | Stack production: web, worker, cron, postgres, redis, nginx           |
| `docker/docker-compose.dev.yml`          | Chỉ phụ thuộc dev: postgres, redis                                    |
| `docs/adr/`                              | Architecture Decision Records (một cho mỗi quyết định lớn)            |
| `packages/cli/`                          | Công cụ CLI (lệnh `astral`) — tiêu thụ REST API                       |
| `packages/sdk-node/`                     | Node.js SDK để truy cập API lập trình (tạm hoãn)                      |
| `packages/terraform-provider/`           | Terraform provider plugin (tạm hoãn)                                   |

---

## 8. Kiến trúc Ứng dụng & Mẫu Thiết kế

Monorepo chứa nhiều package với các nhu cầu kiến trúc khác nhau. Một mẫu duy nhất (MVC, Clean Architecture, Hexagonal) áp dụng đồng nhất sẽ là over-engineered cho một số package và không đủ cho những package khác. Thay vào đó, mỗi package sử dụng mẫu phù hợp nhất với vai trò của nó — được thống nhất bởi các domain type và Zod schema dùng chung trong `packages/shared/`.

### 8.1 Mẫu Kiến trúc cho Từng Package

| Package                              | Mẫu Phù hợp Nhất                   | Lý do                                                                                                          |
|--------------------------------------|------------------------------------|----------------------------------------------------------------------------------------------------------------|
| `apps/web/`                          | **Phân lớp (Dựa trên Tính năng)** | Next.js App Router tự nhiên phân chia code theo route (presentation) và theo mối quan tâm (lib, middleware). Các lớp: Presentation → Application → Domain → Infrastructure. |
| `packages/worker/`                   | **Pipeline / Chain of Resp.**     | Các job chảy qua một pipeline: dequeue → idempotency guard → execute → audit → notify. Mỗi giai đoạn là một handler rời rạc. |
| `packages/worker/src/runtime/`       | **Ports & Adapters (Hexagonal)**  | Giao diện `ContainerRuntime` là port; `DockerRuntime` và `MockRuntime` là các adapter. Đây là kiến trúc hexagonal kiểu mẫu — domain (worker logic) không bao giờ phụ thuộc vào infrastructure (Docker API). |
| `packages/shared/`                   | **Domain Layer**                   | TypeScript types thuần + Zod schemas + constants. Không phụ thuộc framework. Được tất cả các package khác sử dụng. |
| `packages/cli/`                      | **Command Pattern**                | Mỗi lệnh con CLI (`servers list`, `volumes create`) là một command object rời rạc, được router phân phối. |
| `packages/terraform-provider/`       | **Adapter**                        | Dịch giữa vòng đời CRUD của Terraform và REST API của Astral Cloud. Một loại resource → một adapter. |

### 8.2 Kiến trúc Phân lớp (apps/web/)

Ứng dụng web Next.js sử dụng kiến trúc **phân lớp dựa trên tính năng** — các lớp được tổ chức theo mối quan tâm, và mỗi tính năng (servers, billing, tickets) trải dài qua tất cả các lớp:

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Presentation Layer                             │
│  app/(dashboard)/servers/page.tsx                                   │
│  app/(dashboard)/servers/[id]/page.tsx                              │
│  components/servers/ServerCard.tsx, ServerList.tsx                   │
│  (React Server Components + Client Components + shadcn/ui)          │
├─────────────────────────────────────────────────────────────────────┤
│                      Application Layer                              │
│  app/api/servers/route.ts      (REST route handlers)                │
│  lib/services/server.service.ts (use case orchestration)             │
│  lib/validators/server.schema.ts (Zod request/response schemas)     │
│  middleware.ts                  (auth, rate limiting, logging)       │
│  (Thin controllers → delegate to services → return responses)       │
├─────────────────────────────────────────────────────────────────────┤
│                      Domain Layer  ← shared package                 │
│  packages/shared/src/types/server.ts   (TypeScript interfaces)      │
│  packages/shared/src/schemas/server.ts (Zod validation schemas)     │
│  packages/shared/src/constants/        (enums, status values)       │
│  (Pure functions, no side effects, no framework imports)            │
├─────────────────────────────────────────────────────────────────────┤
│                      Infrastructure Layer                           │
│  lib/db.ts              (Prisma client singleton)                   │
│  lib/auth.ts            (NextAuth configuration)                    │
│  lib/email.ts           (SendGrid/SMTP adapter)                     │
│  lib/stripe.ts          (Stripe client)                             │
│  lib/queue.ts           (BullMQ producer)                           │
│  (All external I/O: database, auth, email, payment, job queue)     │
└─────────────────────────────────────────────────────────────────────┘
```

Quy tắc phụ thuộc: **Presentation → Application → Domain ← Infrastructure**. Lớp domain không có phụ thuộc vào framework; lớp application phụ thuộc vào domain + infrastructure; lớp presentation phụ thuộc vào application.

### 8.3 Ports & Adapters / Hexagonal (packages/worker/src/runtime/)

Container runtime là ví dụ điển hình của kiến trúc hexagonal trong dự án này:

```
                  ┌─────────────────────────────┐
                  │       Worker (Domain)        │
                  │                              │
                  │  Job handlers:               │
                  │  provision.server.job.ts     │
                  │  stop.server.job.ts          │
                  │  delete.server.job.ts        │
                  │                              │
                  │  ┌───────────────────────┐   │
                  │  │  ContainerRuntime     │   │  ← Port (interface)
                  │  │  (types.ts)           │   │
                  │  │                       │   │
                  │  │  + createServer()     │   │
                  │  │  + startServer()      │   │
                  │  │  + stopServer()       │   │
                  │  │  + deleteServer()     │   │
                  │  │  + getServerStatus()  │   │
                  │  │  + getNodeResources() │   │
                  │  │  + createBackup()     │   │
                  │  │  + restoreBackup()    │   │
                  │  └───────┬───────┬───────┘   │
                  └──────────┼───────┼───────────┘
                             │       │
                    ┌────────┘       └────────┐
                    ▼                         ▼
        ┌───────────────────┐     ┌───────────────────┐
        │  DockerRuntime    │     │   MockRuntime     │  ← Adapters
        │  (dockerode)      │     │   (in-memory)     │
        │                   │     │                   │
        │  → Docker Engine  │     │  → Fake responses │
        │    REST API       │     │    for testing    │
        └───────────────────┘     └───────────────────┘
```

Mã nguồn job handler của worker không bao giờ import `dockerode` — nó chỉ tham chiếu giao diện `ContainerRuntime`. Lúc khởi động, một factory tạo adapter phù hợp:

```typescript
// packages/worker/src/runtime/factory.ts
function createRuntime(config: Config): ContainerRuntime {
  switch (config.driver) {
    case "docker":  return new DockerRuntime(config.dockerEndpoint);
    case "mock":    return new MockRuntime();
    case "gvisor":  return new GVisorRuntime(config);
    default:        throw new Error(`Unknown runtime: ${config.driver}`);
  }
}
```

Mẫu tương tự áp dụng cho email adapter (`EmailProvider` interface → `SendGridAdapter` | `SmtpAdapter` | `MockEmailAdapter`) và payment adapter (`PaymentProvider` interface → `StripeAdapter` | `MockPaymentAdapter`).

### 8.4 Mẫu Pipeline (packages/worker/src/jobs/)

Mỗi BullMQ job handler thực thi một pipeline gồm các giai đoạn rời rạc:

```
                     ┌─────────────────────┐
                     │   Dequeue Job from   │
                     │   BullMQ / Redis     │
                     └──────────┬──────────┘
                                │
                                ▼
                     ┌─────────────────────┐
                     │  IDEMPOTENCY GUARD  │ ← Query runtime for real state
                     │  "Does this already │
                     │   exist?"           │
                     └──────────┬──────────┘
                                │
                         ┌──────┴──────┐
                         │ exists?      │ new
                         ▼              ▼
              ┌──────────────┐  ┌──────────────────┐
              │ Skip to sync │  │  EXECUTE          │
              │ (just update │  │  Docker API call  │
              │  DB state)   │  │                   │
              └──────┬───────┘  └────────┬──────────┘
                     │                   │
                     └─────────┬─────────┘
                               │
                               ▼
                     ┌─────────────────────┐
                     │  DATABASE SYNC      │
                     │  Update status,     │
                     │  counters, lock     │
                     └──────────┬──────────┘
                                │
                                ▼
                     ┌─────────────────────┐
                     │  AUDIT LOG          │
                     │  Insert AuditLog    │
                     └──────────┬──────────┘
                                │
                                ▼
                     ┌─────────────────────┐
                     │  NOTIFY             │
                     │  Email + In-app     │
                     └──────────┬──────────┘
                                │
                                ▼
                     ┌─────────────────────┐
                     │  RELEASE LOCK       │
                     │  lockedBy = NULL    │
                     └─────────────────────┘
```

Mỗi giai đoạn đều có tính idempotent: idempotency guard có nghĩa là việc chạy lại toàn bộ pipeline sau một sự cố tạo ra cùng một trạng thái cuối cùng. Các giai đoạn được kết hợp thông qua async function chaining thay vì class inheritance.

### 8.5 Tham khảo Mẫu Thiết kế

| Mẫu                          | Nơi Sử dụng                                                                                               | Danh mục GoF |
|------------------------------|-----------------------------------------------------------------------------------------------------------|--------------|
| **Singleton**                | Prisma client, Redis client, BullMQ connection, Stripe client — mỗi process một instance                  | Creational   |
| **Factory Method**           | `createRuntime(driver)` — trả về DockerRuntime | MockRuntime | GVisorRuntime                          | Creational   |
| **Abstract Factory**         | `createAdapters(config)` — trả về bộ adapter { runtime, email, payment }                                  | Creational   |
| **Builder**                  | Zod `.refine().transform()` chains cho xác thực request; Docker container create options                  | Creational   |
| **Adapter**                  | `ContainerRuntime`, `EmailProvider`, `PaymentProvider` — bao bọc API bên ngoài dưới dạng giao diện        | Structural   |
| **Decorator**                | Auth middleware bao bọc route handlers; logging middleware bao bọc tất cả API routes                      | Structural   |
| **Facade**                   | `server.service.ts` — phương thức `createServer()` duy nhất điều phối validation, reservation, enqueue    | Structural   |
| **Proxy**                    | BullMQ rate limiter group — giới hạn job đồng thời; idempotency guard làm proxy cho Docker calls          | Structural   |
| **Chain of Responsibility**  | Next.js middleware chain: CORS → rate limit → auth → validation → route handler                           | Behavioral   |
| **Command**                  | BullMQ job types (`provision`, `stop`, `delete`, `backup`) — mỗi loại là một command object               | Behavioral   |
| **Observer / Pub-Sub**       | BullMQ job events (`completed`, `failed`); Stripe webhook events; Notification dispatching                | Behavioral   |
| **Strategy**                 | Giao diện `ContainerRuntime` với chiến lược `DockerRuntime` vs `MockRuntime`                              | Behavioral   |
| **Template Method**          | Job handler base: `acquireLock()` → `execute()` → `syncDb()` → `audit()` → `releaseLock()`                | Behavioral   |
| **State**                    | `ServerInstance.status` + `lockedBy` tạo thành một state machine với các chuyển đổi được xác thực         | Behavioral   |
| **Memento**                  | `AuditLog.metadata` chụp snapshot trạng thái trước/sau khi thay đổi                                       | Behavioral   |
| **Dependency Injection**     | Services được inject qua tham số hàm hoặc cấu hình cấp module, không phải DI container                    | (nguyên tắc) |

### 8.6 Luồng Phụ thuộc

```
  ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌───────────────┐
  │  apps/   │────▶│ packages/│◀────│ packages/│◀────│  External     │
  │  web/    │     │ shared/  │     │ worker/  │     │  Services     │
  │ (Next.js)│     │ (Domain) │     │ (Jobs)   │     │               │
  └────┬─────┘     └──────────┘     └────┬─────┘     │ Docker Engine │
       │                                 │            │ Stripe        │
       │                                 │            │ SendGrid      │
       ▼                                 ▼            │ Proxmox (opt) │
  ┌──────────┐                    ┌────────────┐     └───────────────┘
  │Prisma    │                    │ Container  │
  │PostgreSQL│                    │ Runtime    │
  │ Redis    │                    │ Interface  │
  └──────────┘                    └────────────┘
```

- `packages/shared/` chỉ phụ thuộc vào TypeScript + Zod
- `apps/web/` phụ thuộc vào `packages/shared/` + infrastructure (Prisma, Redis, Stripe)
- `packages/worker/` phụ thuộc vào `packages/shared/` + infrastructure (Docker, email, Stripe)
- Không có phụ thuộc vòng — được thực thi bởi Turborepo

### 8.7 Tại sao Không dùng Pure Clean Architecture?

Clean Architecture (Entities → Use Cases → Interface Adapters → Frameworks) yêu cầu abstractions cho mọi phụ thuộc bên ngoài. Trong một monorepo Next.js, điều này có nghĩa là:

- Một giao diện `IUserRepository`, một implementation `PrismaUserRepository`, và một factory để kết nối chúng
- Một giao diện `IAuthService` đứng sau NextAuth, mặc dù NextAuth được tích hợp sâu với Next.js
- Một giao diện `IQueue` đứng sau BullMQ

Điều này thêm vào **lượng boilerplate đáng kể** nhưng lợi ích tối thiểu khi:
- Prisma đã cung cấp một lớp truy cập dữ liệu type-safe
- NextAuth là tiêu chuẩn và không có khả năng bị thay thế
- BullMQ là tiêu chuẩn cho hàng đợi job dựa trên Redis
- Cấu trúc monorepo đã cung cấp kiểm soát hướng phụ thuộc

Thay vào đó, dự án sử dụng **phân lớp thực dụng**: chỉ trừu tượng hóa những nơi mà việc thay thế là thực tế (container runtime, email provider, payment gateway). Với mọi thứ khác, sử dụng trực tiếp các mẫu native của framework. Package shared types đóng vai trò là lớp "domain" mà không cần đến các nghi thức của repository interfaces.

Port `ContainerRuntime` là nơi duy nhất mà kiến trúc hexagonal đầy đủ đáng với chi phí bỏ ra — nó cho phép mock testing, hoán đổi runtime trong tương lai, và phân tách rõ ràng giữa logic nghiệp vụ và nội bộ Docker.

---

## 9. Ngăn xếp Quan sát (Observability)

Quan sát trong production không phải "thêm sau" — nó được tích hợp vào triển khai ngay từ ngày đầu tiên.

```
 ┌─────────────────────────────────────────────────────────────────┐
 │                      Observability Stack                        │
 │                                                                 │
 │   ┌──────────────┐   ┌──────────────┐   ┌───────────────────┐   │
 │   │  Prometheus  │   │    Loki      │   │     Tempo         │   │
 │   │  (metrics)   │   │   (logs)     │   │    (traces)       │   │
 │   └──────┬───────┘   └──────┬───────┘   └────────┬──────────┘   │
 │          │                  │                    │              │
 │          ▼                  ▼                    ▼              │
 │   ┌──────────────┐   ┌──────────────┐   ┌───────────────────┐   │
 │   │   Grafana    │   │  AlertManager│   │  Status Page      │   │
 │   │ (dashboards) │   │  (alerting)  │   │  (public-facing)  │   │
 │   └──────────────┘   └──────────────┘   └───────────────────┘   │
 │                                                                 │
 └─────────────────────────────────────────────────────────────────┘
```

### Chỉ số (Prometheus + Grafana)

| Danh mục Chỉ số     | Ví dụ                                                                   | Lưu trữ            |
|---------------------|-------------------------------------------------------------------------|--------------------|
| Ứng dụng            | Tỷ lệ API request, độ trễ p50/p95/p99, tỷ lệ lỗi theo route            | 90 ngày (1m)       |
| Hạ tầng             | Node CPU/RAM/disk, số lượng Docker container, bộ nhớ Redis              | 90 ngày (1m)       |
| Kinh doanh          | Số server tạo/phút, khối lượng thanh toán, tỷ lệ đăng ký                | 90 ngày (1m)       |
| BullMQ              | Độ sâu hàng đợi, job throughput, số job thất bại, dead-letter           | 90 ngày (1m)       |

**Bảng điều khiển Grafana:**
- **API Overview**: tỷ lệ request, phân vị độ trễ, tỷ lệ lỗi theo endpoint
- **Node Health**: CPU, RAM, disk, số container, lịch sử trạng thái theo từng node
- **Queue Monitor**: độ sâu hàng đợi, tỷ lệ xử lý, tỷ lệ thất bại, số dead-letter
- **Business Metrics**: MRR, đăng ký mới, số server theo gói, tỷ lệ rời bỏ, sử dụng voucher
- **SLO Dashboard**: error budget còn lại, tốc độ tiêu hao, tuân thủ SLO theo khoảng thời gian

### Ghi log (Loki / Elasticsearch)

Tất cả container xuất ra structured JSON logs với các trường chuẩn sau:

```json
{
  "timestamp": "2026-06-27T12:00:00Z",
  "level": "INFO",
  "service": "web",
  "traceId": "a1b2c3d4...",
  "userId": "c1a2b3c4...",
  "message": "Server provisioned",
  "serverId": "d4e5f6a7...",
  "durationMs": 3200
}
```

Quy tắc biên tập (redaction) ngăn secrets, tokens, passwords, và Stripe keys xuất hiện trong log.

### Distributed Tracing (OpenTelemetry → Tempo/Jaeger)

Mỗi request đến tạo ra một `traceId` được lan truyền qua:
1. Nginx → Next.js API route
2. Prisma database queries
3. BullMQ job enqueue
4. Worker nhận job (mang `traceId` trong dữ liệu job)
5. Docker Engine API calls
6. Stripe API calls (qua tương quan `Stripe-Request-Id` header)

Điều này cho phép truy vết một thao tác "Create Server" duy nhất từ lần nhấp chuột trên trình duyệt của khách hàng cho đến khi Docker container được khởi động.

### Cảnh báo

| Cảnh báo                            | Mức độ   | Kênh                     | Ngưỡng                                         |
|-------------------------------------|----------|--------------------------|------------------------------------------------|
| Node offline                        | CRITICAL | Email + status page      | 3 lần kiểm tra sức khỏe liên tiếp thất bại      |
| Dead-letter queue đang tăng         | WARNING  | Email                    | > 10 job trong dead-letter trong 5 phút        |
| Tỷ lệ provisioning thất bại         | CRITICAL | Email + status page      | > 1% tỷ lệ thất bại trong 5 phút               |
| Đột biến thanh toán thất bại        | WARNING  | Email                    | > 5% charges thất bại trong 10 phút            |
| Node đạt 80% dung lượng             | WARNING  | Thông báo trong ứng dụng | Bất kỳ node nào vượt 80% cấp phát               |
| Tốc độ tiêu hao SLO error budget    | CRITICAL | Email + status page      | Dự kiến cạn kiệt trong vòng 3 ngày             |

### Trang Trạng thái

Một trang trạng thái công khai (`status.astral.cloud`) hiển thị:
- Trạng thái nền tảng hiện tại (operational / degraded / outage)
- Trạng thái từng thành phần: API, Dashboard, Server Provisioning, Billing, Support
- Sự cố đang hoạt động với dòng thời gian
- Thời gian hoạt động lịch sử (90-ngày cuộn)

Trang trạng thái được cập nhật tự động từ health checks; quản trị viên có thể tạo sự cố và đăng cập nhật thủ công.

---

## 10. Độ Trưởng thành Vận hành

### Chiến lược Triển khai (Blue-Green)

```
 ┌────────────────────────────────────────────────────┐
 │              Nginx (reverse proxy)                 │
 │                                                    │
 │   ┌───────────┐        ┌───────────┐               │
 │   │  Blue     │  ───▶  │  Green    │               │    
 │   │  (active) │  switch│ (standby) │               │
 │   └───────────┘        └───────────┘               │
 │                                                    │
 │ 1. Deploy Green (new version) alongside Blue       |
 │ 2. Run smoke tests against Green                   |
 │ 3. Switch Nginx upstream to Green                  |
 │ 4. Keep Blue warm for 5 minutes (instant rollback) |
 │ 5. Tear down Blue                                  |
 └────────────────────────────────────────────────────┘
```

### An toàn Database Migration (Expand-Contract)

Tất cả thay đổi schema tuân theo mẫu này để tránh exclusive table locks:

```
Phase 1 (Expand):  ADD COLUMN (nullable), CREATE new table
                   → Deploy code that writes to both old and new

Phase 2 (Migrate): Backfill data from old to new in batches

Phase 3 (Contract): Deploy code that reads only from new
                    → DROP old column/table
```

Prisma migrations được xem xét về rủi ro khóa trước khi merge. Các migration yêu cầu khóa `ACCESS EXCLUSIVE` bị từ chối trong CI.

### Phục hồi Thảm họa

| Chỉ số | Mục tiêu            | Tần suất   |
|--------|---------------------|------------|
| RTO    | 4 giờ               | —          |
| RPO    | 6 giờ               | —          |
| Backup | Full DB mỗi 6h      | Tự động    |
| PITR   | Point-in-time       | Đã kích hoạt |
| Diễn tập | Full restore test | Hàng quý   |

Diễn tập DR khôi phục toàn bộ nền tảng (PostgreSQL, Redis snapshot, Docker images, cấu hình) vào một môi trường sạch từ bản backup gần nhất. Runbooks được xác minh trong quá trình diễn tập.

### Runbooks (quy trình được ghi lại)

| Sự cố                        | Vị trí Runbook                        |
|------------------------------|---------------------------------------|
| Node failure                 | `docs/runbooks/node-failure.md`       |
| IP pool exhaustion           | `docs/runbooks/ip-exhaustion.md`      |
| Payment gateway outage       | `docs/runbooks/stripe-outage.md`      |
| Worker crash storm           | `docs/runbooks/worker-storm.md`       |
| GDPR request                 | `docs/runbooks/gdpr-request.md`       |
| Abuse complaint              | `docs/runbooks/abuse-handling.md`     |
| Database restore             | `docs/runbooks/database-restore.md`   |

### Chaos Engineering (Tùy chọn, Chỉ Production)

Kiểm tra định kỳ xác minh các giả định về khả năng phục hồi:
- **Worker kill**: Dừng worker giữa chừng khi provisioning → xác minh idempotency guard khôi phục
- **Docker daemon restart**: Khởi động lại Docker trên một node → xác minh health check phát hiện sự cố, admin được cảnh báo
- **Redis restart**: Khởi động lại Redis → xác minh BullMQ jobs được duy trì, giới hạn tốc độ giảm nhẹ nhàng
- **Network partition**: Cô lập một node khỏi nền tảng → xác minh không có hỏng hóc cơ sở dữ liệu, stale lock cron khôi phục

---

## 11. Tăng cường Bảo mật (Production)

### Cách ly Container

| Môi trường   | Runtime             | Mức độ Cách ly              |
|--------------|---------------------|-----------------------------|
| Phát triển   | Docker (runc)       | Chia sẻ kernel              |
| Production   | gVisor / Firecracker| Ảo hóa phần cứng            |

Giao diện `ContainerRuntime` tại `packages/worker/src/runtime/` nhận tham số `runtime` (`runc`, `gvisor`, `firecracker`) — việc hoán đổi là thay đổi cấu hình, không phải thay đổi mã nguồn.

### Web Application Firewall

```
Internet → Nginx (TLS termination) → ModSecurity (OWASP CRS) → Next.js
```

WAF chặn:
- SQL injection attempts (dư thừa với Prisma, nhưng là defense in depth)
- XSS payloads (dư thừa với React escaping)
- Path traversal, command injection, protocol attacks
- Rate-based DoS ở cấp Nginx (trước khi đến ứng dụng)

### Ký Container Image

```
Build pipeline:
  1. Build Docker image
  2. Push to registry
  3. cosign sign --key cosign.key <image>
  4. Worker: cosign verify <image> before docker pull
```

Các image không được ký bị worker từ chối. Khóa ký được lưu trong secrets manager.

### Phát hiện Giả mạo Audit Log

Mỗi hàng `AuditLog` bao gồm một trường `chainHash`:
```
chainHash = SHA256(previousRow.chainHash || thisRow.id || thisRow.userId || thisRow.action || thisRow.targetId || thisRow.createdAt)
```

Chuỗi bắt đầu từ một genesis hash. Duyệt qua chuỗi và tính toán lại hash sẽ phát hiện mọi giả mạo. Một trang admin dashboard xác minh tính toàn vẹn của chuỗi.

---

## 12. Công cụ cho Lập trình viên

### CLI (`astral`)

CLI là một package Node.js trong `packages/cli/` tiêu thụ cùng REST API:

```bash
astral login                    # Lưu API key
astral servers list             # Liệt kê servers
astral servers create --plan starter --image ubuntu-24.04 --region us-east
astral servers ssh my-server    # SSH vào server qua proxy
astral volumes list
astral volumes attach vol-xxx my-server /dev/sdb
astral dns list my-server
```

### Terraform Provider

Terraform provider (`packages/terraform-provider/`) ánh xạ REST API resources thành Terraform resources:

```hcl
resource "astral_server" "web" {
  hostname  = "web-01"
  plan      = "starter"
  image     = "ubuntu-24.04"
  region    = "us-east"
  ssh_key   = astral_ssh_key.laptop.id
}

resource "astral_volume" "data" {
  name   = "web-data"
  size_gb = 100
  region = "us-east"
}

resource "astral_volume_attachment" "data" {
  server_id = astral_server.web.id
  volume_id = astral_volume.data.id
  device    = "/dev/sdb"
}
```

### API SDKs

SDKs được sinh từ OpenAPI 3.1 spec sử dụng openapi-generator:
- `@astral/sdk-node` — Node.js/TypeScript
- `astral-sdk-python` — Python (PyPI)
- `astral-sdk-go` — Go module

Tất cả SDKs chia sẻ cùng cơ chế xác thực (API key qua Bearer token), giới hạn tốc độ, và xử lý lỗi như người dùng REST API trực tiếp.

---

## 13. Nguyên tắc Kiến trúc

1. **Web tier không trạng thái** — Tiến trình Next.js không lưu trữ trạng thái trong bộ nhớ. Toàn bộ trạng thái nằm trong PostgreSQL hoặc Redis. Điều này cho phép mở rộng ngang web tier mà không cần sticky sessions.

2. **Bất đồng bộ thay vì đồng bộ cho thao tác dài** — Container provisioning (image pull + create + start) có thể mất từ vài giây đến vài phút. Web API trả về 202 ngay lập tức; worker xử lý lệnh gọi Docker Engine thực tế một cách bất đồng bộ.

3. **Job-level idempotency (dựa trên Docker guard)** — Mỗi BullMQ job kiểm tra **trạng thái thực tế hiện tại** trên Docker trước khi hành động. Provisioning truy vấn Docker tìm container hiện có với cùng server label và bỏ qua để đồng bộ cơ sở dữ liệu nếu tìm thấy. Thử lại N lần hội tụ về cùng trạng thái cuối cùng như chạy một lần.

4. **Theo dõi tài nguyên an toàn khi thất bại** — Dung lượng node và địa chỉ IP được **đặt chỗ** trong cùng một giao dịch cơ sở dữ liệu (status = CREATING), ngăn chặn cấp phát vượt mức. Khi thất bại, worker rollback: giải phóng IP, giảm bộ đếm node.

5. **Trừu tượng hóa container runtime** — Toàn bộ logic đặc thù Docker nằm sau giao diện `ContainerRuntime`. Hoán đổi sang runtime khác chỉ cần triển khai giao diện này. Một mock implementation cho phép dev/testing mà không cần Docker.

6. **Audit mọi thứ** — Mỗi thao tác thay đổi trạng thái tạo ra một mục AuditLog bất biến. Log chỉ được thêm vào. Hash chaining phát hiện giả mạo.

7. **DB-trước-runtime cho mutations** — Việc ghi cơ sở dữ liệu xảy ra **trước** lệnh gọi container runtime. Nếu worker gặp sự cố giữa job, cơ sở dữ liệu luôn có bản ghi để khôi phục. Retry guard truy vấn thực tế và đồng bộ cơ sở dữ liệu cho khớp.

8. **Pessimistic locking cho thao tác bất đồng bộ** — Các thao tác chạy dài chiếm khóa `lockedBy` một cách nguyên tử trước khi đưa công việc vào hàng đợi. Ngăn chặn các thao tác đồng thời xung đột. Stale lock cron khôi phục từ sự cố worker.

9. **Thiết kế API-first** — Mọi tính năng được xây dựng theo API-first. Web UI, CLI, và Terraform provider đều tiêu thụ cùng một REST API. Không có privileged internal endpoints cho các client khác nhau.

10. **Quan sát không phải tùy chọn** — Metrics, structured logs, và distributed traces được tích hợp ngay từ ngày đầu tiên của production. SLOs định nghĩa mục tiêu độ tin cậy; error budgets kiểm soát việc triển khai tính năng mới.

11. **Bảo mật theo chiều sâu** — Không có lớp đơn lẻ nào được tin cậy tuyệt đối. WAF + rate limiting + input validation + ownership checks + container isolation + audit logging + image signing tạo thành chiến lược defense-in-depth.

12. **Tài liệu là một tính năng** — Các quyết định kiến trúc được ghi lại dưới dạng ADRs. Domain model, business rules, glossary, và use cases tạo thành đặc tả hoàn chỉnh. Mỗi PR cập nhật tài liệu liên quan.

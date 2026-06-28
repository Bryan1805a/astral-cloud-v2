# Use Cases

---

# UC-01: Tạo Server

| Attribute                 | Value                                                                                                                    |
|---------------------------|--------------------------------------------------------------------------------------------------------------------------|
| UC ID                     | UC-01                                                                                                                    |
| UC Name                   | Tạo Server                                                                                                            |
| Actor(s)                  | Khách hàng (đã xác thực)                                                                                                 |
| Priority                  | High                                                                                                                     |
| Trigger                   | Khách hàng nhấp "Tạo Server" trên bảng điều khiển                                                                         |
| Pre-conditions            | Khách hàng đã đăng nhập (JWT hợp lệ). Tài khoản không bị khóa hoặc quá hạn.                                                     |
| Post-conditions (success) | Bản ghi server được lưu (status = `ACTIVE`). Container được cung cấp với IP và thông tin đăng nhập. Thông báo được gửi. Audit log được ghi. |
| Post-conditions (failure) | Không có server nào được tạo. Tài nguyên đã đặt chỗ được giải phóng. Không có phí nào được áp dụng. Lỗi được ghi log.                                        |
| Business Rules            | BR-01, BR-02, BR-03, BR-04, BR-05, BR-06, BR-07, BR-08, BR-09, BR-10, BR-11, BR-12, BR-19, BR-27                         |
| Related UCs               | UC-02 (đăng ký), UC-03 (đăng nhập), UC-04 (danh sách server), UC-10 (ví), UC-11 (áp dụng voucher), UC-26 (quản lý thẻ)        |

## Luồng Chính

1. Khách hàng chọn một **ServerPlan** (hoặc tùy chỉnh CPU/RAM/disk theo 1a).
2. Khách hàng chọn một **ImageTemplate** (hoặc snapshot theo 2a).
3. Khách hàng có thể chọn (tùy chọn) một **region** (trung tâm dữ liệu).
4. Khách hàng có thể nhập (tùy chọn) một **mã voucher** (UC-11).
5. Khách hàng có thể cung cấp (tùy chọn) một **SSH public key** theo 1b.
6. Khách hàng chọn một **mô hình thanh toán** theo 1c.
7. Khách hàng nhấp vào **Create**.
8. Hệ thống xác thực:
   - Khách hàng chưa vượt quá số lượng server tối đa ([BR-06]).
   - Số dư tài khoản đủ ([BR-27]).
   - Kích thước disk của ImageTemplate ≤ kích thước disk của ServerPlan ([BR-08]).
   - Region đã chọn có sẵn cho tài khoản này ([BR-09]).
9. Hệ thống chọn một **node** vật lý và **đặt chỗ nguyên tử** dung lượng cần thiết ([BR-05]). Việc đặt chỗ (tăng bộ đếm `node.allocated*`) và INSERT `ServerInstance` diễn ra trong **cùng một giao dịch database**. Nếu hai yêu cầu đồng thời tranh giành dung lượng còn lại cuối cùng của cùng một node, chỉ một lần đặt chỗ thành công — kiểm tra nguyên tử ở cấp database từ chối bên thua. Sau đó hệ thống thử lại với node tốt tiếp theo (xem EX-01-3).
10. Hệ thống đưa một job vào hàng đợi job cung cấp vào BullMQ với:
    - Tham chiếu image template hoặc snapshot.
    - vCPU cores, RAM (MB), disk size (GB).
    - Cấu hình mạng (public IPv4).
    - Thông tin đăng nhập (mật khẩu hoặc SSH public key theo 1b).
    - Server ID và node ID.
11. Hệ thống trả về `202 Accepted` với `serverId` cho khách hàng.
12. Worker nhận job và thực thi **idempotency guard**: truy vấn Docker daemon trên node đích: "Có container nào được gắn thẻ `astral-server-id=<serverId>` đã tồn tại không?"
    - Nếu **tìm thấy**: bỏ qua tạo container và tiến thẳng đến database sync (bước 16).
    - Nếu **không tìm thấy**: tiếp tục đến bước 13.
13. Worker kéo Docker image (nếu chưa được cache) và tạo container với:
    - Giới hạn tài nguyên (CPU shares, giới hạn bộ nhớ, disk volume).
    - Cấu hình mạng với một public IP từ pool IP của node.
    - Tags: `astral-server-id=<serverId>`, `astral-user-id=<userId>`, `astral-hostname=<hostname>`.
    - Mật khẩu root hoặc SSH public key được đưa vào qua cloud-init hoặc biến môi trường.
14. Docker tạo và khởi động container (cung cấp hoàn tất trong vài giây).
15. Worker lấy **Docker container ID** và **địa chỉ IP** được gán.
16. Worker thực thi **database sync** trong một giao dịch:
    - Cập nhật `ServerInstance`: status = `ACTIVE`, `dockerContainerId`, `ipAddress`.
    - Xác nhận bộ đếm dung lượng node (hoặc không làm gì nếu đã đặt chỗ ở bước 9).
    - Ghi một bản ghi `AuditLog` bất biến ([BR-19]).
    - Khấu trừ số dư từ ví của người dùng ([BR-27]).
17. Worker đưa job thông báo vào hàng đợi (email + in-app).
18. Hệ thống gửi thông báo thành công cho khách hàng (IP, thông tin đăng nhập, trạng thái).

## Luồng Thay Thế

### 1a — Cấu Hình Tài Nguyên Tùy Chỉnh
Thay vì chọn một ServerPlan định sẵn, khách hàng chỉ định thủ công số lõi vCPU, RAM và kích thước disk.
- Hệ thống hiển thị các phạm vi tài nguyên có sẵn resource ranges and tính giá.
- [BR-10] vẫn áp dụng (tối thiểu 5 GB disk).

### 1b — Xác Thực Bằng SSH Key
Thay vì thông tin đăng nhập mật khẩu tự động tạo, khách hàng cung cấp một **SSH public key** hiện có.
- Hệ thống xác thực SSH key thuộc về khách hàng ([BR-12]).
- Hệ thống đưa public key vào container qua cloud-init.
- Không có mật khẩu root nào được tạo; `rootPassword` vẫn là null.

### 1c — Chọn Mô Hình Thanh Toán
Khách hàng chọn **auto-renew** (monthly) hoặc **pay-as-you-go** (theo giờ).
- Hệ thống áp dụng giá tương ứng và đặt `nextBillingAt` phù hợp.
- Hàng tháng: khấu trừ ngay cho tháng đầu tiên.
- Theo giờ: khấu trừ ngay cho giờ đầu tiên.

### 1d — Chọn Region
Khách hàng chọn một region trung tâm dữ liệu cụ thể.
- Hệ thống lọc các ServerPlan và ImageTemplate có sẵn chỉ còn những cái được hỗ trợ trong region đó ([BR-09]).
- Hệ thống chọn một node trong region đó.

### 2a — Tạo Từ Snapshot
Thay vì chọn một ImageTemplate, khách hàng chọn một **snapshot đã lưu trước đó**.
- Hệ thống hiển thị chỉ các snapshot thuộc về khách hàng đó.
- Hệ thống xác thực rằng kích thước của snapshot không vượt quá dung lượng disk của gói đã chọn ([BR-08]).
- Hệ thống tạo container sử dụng snapshot làm nguồn data volume.

## Luồng Ngoại Lệ

### EX-01-1 — Insufficient Balance
- Được kích hoạt khi số dư ví không đủ để chi trả ít nhất kỳ thanh toán đầu tiên ([BR-27]).
- Hệ thống hiển thị: "Insufficient balance. Please add funds and try again."
- Không có server nào được tạo. Không có phí nào được áp dụng.

### EX-01-2 — Server Limit Exceeded
- Được kích hoạt khi khách hàng có ≥ 5 server instance đang hoạt động (hoặc giới hạn của gói) ([BR-06]).
- Hệ thống hiển thị: "Server limit reached. Upgrade your plan or delete an existing server."

### EX-01-3 — No Node Available
- Không có node vật lý nào có đủ tài nguyên trống ([BR-05]), **hoặc** mọi đặt chỗ nguyên tử của node ứng viên đều bị từ chối vì các yêu cầu đồng thời đã chiếm dung lượng trước.
- Hệ thống hiển thị: "All nodes are currently at capacity. Please try again in a few minutes."
- Hệ thống thông báo cho đội ngũ admin để lập kế hoạch dung lượng.

### EX-01-4 — Provisioning Timeout
- Docker daemon không phản hồi thành công trong vòng 60 giây ([BR-07]).
- Hệ thống đánh dấu thao tác là `FAILED`.
- Hệ thống cập nhật trạng thái bản ghi server thành `ERROR`.
- Hệ thống giải phóng dung lượng node đã đặt chỗ (rollback).
- Hệ thống gửi một cảnh báo cho admin.
- Khách hàng thấy: "Cung cấp đã hết thời gian. Đội ngũ của chúng tôi đã được thông báo."

### EX-01-5 — Image Not Found
- Docker image của ImageTemplate đã chọn không có sẵn hoặc pull thất bại.
- Hệ thống hiển thị: "The selected image is không có sẵn. Please choose a different image."
- Giao dịch được rollback. Dung lượng node đã đặt chỗ được giải phóng.

### EX-01-6 — Docker API Error
- Docker daemon trả về lỗi (cấu hình không hợp lệ, pull thất bại, lỗi nội bộ).
- Hệ thống ghi log phản hồi lỗi thô.
- Hệ thống đánh dấu thao tác là `FAILED` và thông báo cho admin.
- Khách hàng thấy: "Đã xảy ra lỗi không mong muốn. Vui lòng thử lại sau."

### EX-01-7 — Worker Crashes After Container Provisioning (Distributed State Mismatch)
- Kịch bản: Docker tạo và khởi động container thành công, nhưng BullMQ worker gặp sự cố (hoặc mất kết nối database) trước khi có thể cập nhật bản ghi ServerInstance (status = ACTIVE), tăng bộ đếm node, ghi audit log, hoặc khấu trừ số dư.
- Database vẫn hiển thị `ServerInstance.status = CREATING`. Container chạy trên Docker nhưng bảng điều khiển của khách hàng hiển thị "Đang tạo..." vô thời hạn. Chưa có khấu trừ thanh toán nào xảy ra.
- **Khôi phục** (được tích hợp trong idempotency của worker):
  1. BullMQ phát hiện job chưa được xác nhận và gửi lại nó.
  2. Khi thử lại, worker truy vấn **Docker trước**: `GET /containers/json?filters={"label":["astral-server-id=<serverId>"]}` trên node được chỉ định.
  3. Nếu Docker trả về một container — worker bỏ qua tạo lại và tiến thẳng đến **database sync**: cập nhật `ServerInstance.status = ACTIVE`, đặt `dockerContainerId` và `ipAddress`, xác nhận bộ đếm node, ghi audit log, khấu trừ số dư, gửi thông báo.
  4. Nếu tất cả các lần thử lại đều hết (database vẫn không thể truy cập), worker **dead-letter** job và cảnh báo admin với đầy đủ ngữ cảnh (server ID, Docker container ID, tên node).
- **Đối chiếu của admin**: Admin xác minh container tồn tại trên Docker, sau đó cập nhật thủ công database hoặc kích hoạt job đồng bộ một lần.
- Mẫu này làm cho job cung cấp **idempotent** — chạy N lần tạo ra cùng một trạng thái cuối cùng như chạy một lần.

---

## Sơ Đồ Trình Tự: UC-01 Luồng Thành Công (Docker Runtime)

```
Customer       Next.js        PostgreSQL      BullMQ        Worker        Docker
   |               |              |              |             |              |
   |  POST /api/   |              |              |             |              |
   |  servers      |              |              |             |              |
   |-------------->|              |              |             |              |
   |               | Validate:    |              |             |              |
   |               | BR-06,08,09, |              |             |              |
   |               | BR-10,27     |              |             |              |
   |               |              |              |             |              |
   |               | Atomic Node Reservation +   |             |              |
   |               | INSERT ServerInstance       |             |              |
   |               | (status=CREATING)           |             |              |
   |               |─────────────>|              |             |              |
   |               | COMMIT OK    |              |             |              |
   |               |<─────────────|              |             |              |
   |               |              |              |             |              |
   |               | Enqueue provision job       |             |              |
   |               |────────────────────────────>|             |              |
   |               |              |              |             |              |
   |  202 Accepted |              |              |             |              |
   |  { serverId } |              |              |             |              |
   |<--------------|              |              |             |              |
   |               |              |              |             |              |
   |               |              |         Dequeue job        |              |
   |               |              |              |────────────>|              |
   |               |              |              |             |              |
   |               |              |              |  IDEMPOTENCY GUARD         |
   |               |              |              |  GET /containers/json      |
   |               |              |              |  ?filters={"label":        |
   |               |              |              |   ["astral-server-id=..."]}|
   |               |              |              |             |─────────────>|
   |               |              |              |             |  no container|
   |               |              |              |             |<─────────────|
   |               |              |              |             |              |
   |               |              |              |  Create container           |
   |               |              |              |  POST /containers/create   |
   |               |              |              |  (image, CPU, RAM, disk,   |
   |               |              |              |   network, tags)            |
   |               |              |              |             |─────────────>|
   |               |              |              |             |  container   |
   |               |              |              |             |  created &   |
   |               |              |              |             |  started     |
   |               |              |              |             |<─────────────|
   |               |              |              |             |              |
   |               |              |  DB TRANSACTION             |              |
   |               |              |  UPDATE ServerInstance:     |              |
   |               |              |    status=ACTIVE,           |              |
   |               |              |    dockerContainerId, ip    |              |
   |               |              |  INSERT AuditLog (BR-19)    |              |
   |               |              |  DEDUCT balance             |              |
   |               |              |  COMMIT       |             |              |
   |               |              |<──────────────|             |              |
   |               |              |              |             |              |
   |               |              |  Enqueue notification job   |              |
   |               |              |              |────────────>|              |
   |               |              |              |             |  → email +   |
   |               |              |              |             |    in-app    |
```

---

## Sơ Đồ Trình Tự: EX-01-7 Worker Crash Recovery (Docker Idempotency)

```
Customer       Next.js        PostgreSQL      BullMQ        Worker        Docker
   |               |              |              |             |              |
   |  POST /api/servers           |              |             |              |
   |-------------->|              |              |             |              |
   |               |  RESERVE node + INSERT Server (CREATING)  |              |
   |               |─────────────>|              |             |              |
   |               |              |              |             |              |
   |               |  Enqueue provision job     |             |              |
   |               |───────────────────────────>|             |              |
   |               |              |              |             |              |
   |  202 Accepted |              |              |             |              |
   |<--------------|              |              |             |              |
   |               |              |              |             |              |
   |               |              |         Dequeue job        |              |
   |               |              |              |────────────>|              |
   |               |              |              |             |              |
   |               |              |  IDEMPOTENCY GUARD:        |              |
   |               |              |  GET /containers/json      |              |
   |               |              |  (label: astral-server-id) |              |
   |               |              |              |             |─────────────>|
   |               |              |              |             |  no container|
   |               |              |              |             |<─────────────|
   |               |              |              |             |              |
   |               |              |  CREATE container           |              |
   |               |              |  POST /containers/create   |              |
   |               |              |              |             |─────────────>|
   |               |              |              |             |  container   |
   |               |              |              |             |  created     |
   |               |              |              |             |  cId=X, ip=Y |
   |               |              |              |             |<─────────────|
   |               |              |              |             |              |
   |               |              |    ╔══════════════════════╗|              |
   |               |              |    ║  WORKER CRASHES      ║|              |
   |               |              |    ║  (before DB sync)    ║|              |
   |               |              |    ╚══════════════════════╝|              |
   |               |              |              |             |              |
   |               |              |  BullMQ detects            |              |
   |               |              |  unacknowledged job        |              |
   |               |              |  → re-delivers             |              |
   |               |              |              |             |              |
   |               |              |  Re-deliver provision job  |              |
   |               |              |              |────────────>|              |
   |               |              |              |             |              |
   |               |              |  IDEMPOTENCY GUARD:        |              |
   |               |              |  GET /containers/json      |              |
   |               |              |  (label: astral-server-id) |              |
   |               |              |              |             |─────────────>|
   |               |              |              |             | CONTAINER    |
   |               |              |              |             | FOUND!       |
   |               |              |              |             | cId=X, ip=Y  |
   |               |              |              |             |<─────────────|
   |               |              |              |             |              |
   |               |              |  SKIP container creation   |              |
   |               |              |  → PROCEED to DB sync      |              |
   |               |              |              |             |              |
   |               |              |  UPDATE Server:            |              |
   |               |              |    status=ACTIVE,          |              |
   |               |              |    dockerContainerId=X,    |              |
   |               |              |    ipAddress=Y             |              |
   |               |              |  INSERT AuditLog           |              |
   |               |              |  DEDUCT balance            |              |
   |               |              |<───────────────────────────|              |
   |               |              |              |             |              |
   |               |              |  Enqueue notification job  |              |
   |               |              |              |────────────>|              |
   |               |              |              |             |              |
   |               |              |  ✓ DB state converges to   |              |
   |               |              |    same result as if the   |              |
   |               |              |    crash never happened.   |              |
```

---

# UC-02: Register

| Attribute                 | Value                                                                                         |
|---------------------------|-----------------------------------------------------------------------------------------------|
| UC ID                     | UC-02                                                                                         |
| UC Name                   | Đăng Ký Tài Khoản Mới                                                                          |
| Actor(s)                  | Khách truy cập (chưa xác thực)                                                                     |
| Priority                  | High                                                                                          |
| Trigger                   | Khách truy cập nhấp "Sign Up" hoặc "Register" trên trang đích                                    |
| Pre-conditions            | None                                                                                          |
| Post-conditions (success) | Tài khoản người dùng được tạo trong cơ sở dữ liệu. Mã giới thiệu được tạo. Phiên được thiết lập hoặc chuyển hướng đến đăng nhập. |
| Post-conditions (failure) | Không có tài khoản nào được tạo. Các trường biểu mẫu được giữ lại nếu có thể.                                     |
| Business Rules            | BR-21, BR-22, BR-54, BR-57                                                                    |
| Related UCs               | UC-03 (đăng nhập), UC-17 (chương trình giới thiệu)                                                       |

## Luồng Chính

1. Khách truy cập điều hướng đến trang đăng ký.
2. Khách truy cập điền vào:
   - **Username** (duy nhất, per [BR-21]).
   - **Email address** (duy nhất, per [BR-21]).
   - **Password** (phải đáp ứng độ phức tạp per [BR-22]).
   - **Confirm password** (phải khớp).
   - **Referral code** (tùy chọn).
3. Khách truy cập gửi biểu mẫu.
4. Hệ thống xác thực:
   - Tất cả các trường bắt buộc đều không trống.
   - Username chưa được sử dụng ([BR-21]).
   - Email chưa được đăng ký ([BR-21]).
   - Mật khẩu đáp ứng yêu cầu độ phức tạp ([BR-22]).
   - Mật khẩu và xác nhận mật khẩu khớp nhau.
   - Mã giới thiệu (nếu được cung cấp): tồn tại, thuộc về người dùng khác, người dùng không tự giới thiệu ([BR-57]).
5. Hệ thống tạo **User** record:
   - Băm mật khẩu với bcrypt.
   - Tạo một **referralCode** duy nhất ([BR-54]).
   - Đặt `role = CUSTOMER`.
   - Đặt `status = ACTIVE` (hoặc `PENDING_VERIFICATION` theo 2a).
   - Tạo bản ghi `NotificationPreference` mặc định.
6. Nếu một mã giới thiệu hợp lệ được nhập, hệ thống tạo bản ghi `Referral` với `status = PENDING` liên kết người giới thiệu và người được giới thiệu ([BR-54], [BR-57]).
7. Hệ thống chuyển hướng khách truy cập đến trang đăng nhập, hoặc tự động xác thực và chuyển hướng đến bảng điều khiển.

## Luồng Thay Thế

### 2a — Yêu Cầu Xác Minh Email
- Sau bước 5, hệ thống gửi email xác minh với token có thời hạn.
- Người dùng phải nhấp vào liên kết trước khi đăng nhập.
- Tài khoản được tạo với `status = PENDING_VERIFICATION`.

### 2b — Đăng Ký Qua Mạng Xã Hội
- Khách truy cập nhấp "Đăng ký với Google/GitHub."
- Luồng OAuth2 hoàn tất; hệ thống tạo tài khoản với provider ID.
- Các trường mật khẩu và xác nhận mật khẩu được bỏ qua.
- Mã giới thiệu được thu thập sau đăng ký nếu không được cung cấp trong luồng OAuth.

## Luồng Ngoại Lệ

### EX-02-1 — Username Already Taken
- Hệ thống đánh dấu trường username: "This username is already in use."

### EX-02-2 — Email Already Registered
- Hệ thống đánh dấu trường email: "An account with this email already exists. Log in instead?"

### EX-02-3 — Password Too Weak
- Hệ thống đánh dấu password field: "Password phải là at least 8 characters and include an uppercase letter, a lowercase letter, and a digit." ([BR-22])

### EX-02-4 — Passwords Do Not Match
- Hệ thống đánh dấu confirm-password field: "Passwords do not match."

### EX-02-5 — Database Failure
- Hệ thống hiển thị: "Registration thất bại. Please try again later." Logs error internally.

### EX-02-6 — Invalid Referral Code
- Được kích hoạt khi the supplied referral code does not exist, is inđang hoạt động, or belongs to the registering user.
- Hệ thống đánh dấu referral code field: "Mã giới thiệu không hợp lệ. Vui lòng kiểm tra và thử lại."
- Đăng ký tiếp tục mà không có tín dụng giới thiệu; không có bản ghi Referral nào được tạo.

---

# UC-03: Login

| Attribute                 | Value                                                                 |
|---------------------------|-----------------------------------------------------------------------|
| UC ID                     | UC-03                                                                 |
| UC Name                   | Đăng Nhập / Xác Thực                                                  |
| Actor(s)                  | Khách truy cập (chưa xác thực)                                             |
| Priority                  | High                                                                  |
| Trigger                   | Khách truy cập nhấp vào "Login" or is redirected to trang đăng nhập             |
| Pre-conditions            | Tài khoản tồn tại (đã đăng ký qua UC-02). Tài khoản không bị khóa.         |
| Post-conditions (success) | JWT access token và refresh token được cấp. Phiên được thiết lập.       |
| Post-conditions (failure) | Lần thử thất bại được tính vào khóa tài khoản ([BR-23]).                      |
| Business Rules            | BR-23, BR-24, BR-25                                                   |
| Related UCs               | UC-02 (đăng ký), UC-01 (tạo server), UC-04 (danh sách server), UC-08 (bật 2FA) |

## Luồng Chính

1. Khách truy cập nhập **username/email** và **password**.
2. Khách truy cập nhấp vào **Login**.
3. Hệ thống tra cứu tài khoản theo username hoặc email.
4. Hệ thống xác minh the password against the stored bcrypt hash.
5. Hệ thống kiểm tra xem tài khoản is locked ([BR-23]).
6. Hệ thống kiểm tra xem 2FA is được bật cho tài khoản này.
   - Nếu 2FA **không được bật**: tiếp tục đến bước 7.
   - Nếu 2FA **được bật**: rẽ nhánh sang luồng thay thế 3c (2FA).
7. Hệ thống kiểm tra đang hoạt động session count; if ≥ 5, invalidates the oldest session ([BR-25]).
8. Hệ thống tạo:
   - **Access token** (JWT, short-lived, 1 hour).
   - **Refresh token** (opaque or JWT, 7 days).
9. Hệ thống tạo một new `Session` record.
10. Hệ thống trả về tokens và chuyển hướng khách hàng to bảng điều khiển.
11. Hệ thống đặt lại bộ đếm đăng nhập thất bại cho tài khoản này.

## Luồng Thay Thế

### 3a — Ghi Nhớ Đăng Nhập
- Khách truy cập chọn "Ghi nhớ đăng nhập."
- Hệ thống gia hạn refresh token lên 30 ngày.

### 3b — Đăng Nhập Mạng Xã Hội
- Khách truy cập nhấp vào "Login with Google/GitHub."
- Luồng OAuth2 hoàn tất; hệ thống cấp tokens trực tiếp.

### 3c — Luồng Xác Thực Hai Yếu Tố
- Sau khi xác thực mật khẩu thành công (bước 4), hệ thống phát hiện 2FA đã được bật.
- Hệ thống nhắc visitor: "Enter the 6-digit code from your authenticator app."
- Hệ thống lưu trữ partial-authentication state (e.g., a short-lived, single-use TOTP challenge token).
- Khách truy cập nhập the **TOTP code** from their authenticator app.
- Hệ thống xác thực TOTP code against the stored secret (time-window: current ± 1 step, 30-second intervals).
- Khi thành công: tiếp tục đến bước 7 (tạo phiên và cấp token).
- Khi thất bại: xem EX-03-4.

### 3d — Mã Dự Phòng
- Nếu khách truy cập mất quyền truy cập vào ứng dụng authenticator, họ có thể nhập **mã dự phòng** thay vì mã TOTP.
- Hệ thống xác thực backup code against the hashed backup codes list.
- Khi thành công: tiêu thụ mã dự phòng (xóa nó khỏi tập hợp) và tiếp tục đến bước 7.
- Khi thất bại: xem EX-03-5.

## Luồng Ngoại Lệ

### EX-03-1 — Invalid Credentials
- Hệ thống tăng bộ đếm đăng nhập thất bại.
- Hệ thống hiển thị: "Invalid username or password."
- Sau 5 lần thất bại liên tiếp trong vòng 10 phút, tài khoản bị khóa trong 15 phút ([BR-23]).

### EX-03-2 — Account Locked
- Hệ thống hiển thị: "Your account has been locked due to too many thất bại attempts. Please try again in 15 minutes." ([BR-23])

### EX-03-3 — Account Not Found
- Hệ thống trả về same generic message as không hợp lệ credentials to avoid user enumeration: "Invalid username or password."

### EX-03-4 — Invalid TOTP Code
- Hệ thống hiển thị: "Mã xác thực không hợp lệ. Vui lòng thử lại."
- **Không** tính vào ngưỡng khóa tài khoản (bước mật khẩu đã thành công).

### EX-03-5 — Invalid Backup Code
- Hệ thống hiển thị: "Mã dự phòng không hợp lệ."
- Nếu khách truy cập đã sử dụng hết tất cả mã dự phòng, họ phải liên hệ hỗ trợ để đặt lại 2FA.

### EX-03-6 — Session Limit Reached
- Hệ thống tự động vô hiệu hóa phiên cũ nhất và tạo một phiên mới ([BR-25]).
- Đây là đường dẫn không lỗi; khách truy cập được thông báo: "Phiên cũ nhất của bạn đã bị đăng xuất."

---

## Sơ Đồ Trình Tự: UC-03 với Luồng 2FA

```
Visitor          Next.js              PostgreSQL           TOTP Service
   |                |                      |                     |
   |  POST /auth/   |                      |                     |
   |  login         |                      |                     |
   |  (email, pwd)  |                      |                     |
   |───────────────>|                      |                     |
   |                |                      |                     |
   |                |  SELECT User WHERE   |                     |
   |                |  email = :email      |                     |
   |                |─────────────────────>|                     |
   |                |  user row + hash     |                     |
   |                |<─────────────────────|                     |
   |                |                      |                     |
   |                |  bcrypt.compare()    |                     |
   |                |  ✓ password matches  |                     |
   |                |                      |                     |
   |                |  Check: account      |                     |
   |                |  locked? (BR-23)     |                     |
   |                |  ✓ not locked        |                     |
   |                |                      |                     |
   |                |  Check: 2FA được bật? |                     |
   |                |  ✓ 2FA được bật       |                     |
   |                |                      |                     |
   |                |  Generate TOTP       |                     |
   |                |  challenge token     |                     |
   |                |  (short-lived, 5 min)|                     |
   |                |                      |                     |
   |  200 OK        |                      |                     |
   |  { challengeToken,                    |                     |
   |    requires2FA: true }                |                     |
   |<───────────────|                      |                     |
   |                |                      |                     |
   |  Client displays TOTP input           |                     |
   |                |                      |                     |
   |  POST /auth/   |                      |                     |
   |  verify-2fa    |                      |                     |
   |  (challengeToken,                     |                     |
   |   totpCode)    |                      |                     |
   |───────────────>|                      |                     |
   |                |                      |                     |
   |                |  Validate challenge  |                     |
   |                |  token (not đã hết hạn, |                     |
   |                |  matches session)    |                     |
   |                |                      |                     |
   |                |  SELECT TwoFactorAuth|                     |
   |                |  WHERE userId = :id  |                     |
   |                |─────────────────────>|                     |
   |                |  secret              |                     |
   |                |<─────────────────────|                     |
   |                |                      |                     |
   |                |  Verify TOTP         |                     |
   |                |  (secret, totpCode,  |                     |
   |                |   window: ±1 step)   |                     |
   |                |─────────────────────────────────────────>|
   |                |  ✓ code hợp lệ        |                     |
   |                |<─────────────────────────────────────────|
   |                |                      |                     |
   |                |  Check session limit |                     |
   |                |  (BR-25: max 5)      |                     |
   |                |  Evict oldest if ≥ 5 |                     |
   |                |─────────────────────>|                     |
   |                |                      |                     |
   |                |  Generate access     |                     |
   |                |  token (JWT, 1h) +  |                     |
   |                |  refresh token (7d)  |                     |
   |                |                      |                     |
   |                |  INSERT Session      |                     |
   |                |  RESET failedLogin   |                     |
   |                |  UPDATE lastLoginAt  |                     |
   |                |─────────────────────>|                     |
   |                |                      |                     |
   |  200 OK        |                      |                     |
   |  { accessToken, |                      |                     |
   |    refreshToken }                      |                     |
   |<───────────────|                      |                     |
   |                |                      |                     |
   |  Redirect to dashboard                |                     |
```

---

# UC-04: Danh Sách Server (Bảng Điều Khiển)

| Attribute                 | Value                                                                              |
|---------------------------|------------------------------------------------------------------------------------|
| UC ID                     | UC-04                                                                              |
| UC Name                   | Danh Sách Server (Bảng Điều Khiển)                                                           |
| Actor(s)                  | Khách hàng (đã xác thực)                                                           |
| Priority                  | High                                                                               |
| Trigger                   | Khách hàng điều hướng đến dashboard / server list page                              |
| Pre-conditions            | Khách hàng đã đăng nhập (JWT hợp lệ).                                                 |
| Post-conditions (success) | Danh sách phân trang các server của khách hàng hiển thị với trạng thái và metadata.       |
| Post-conditions (failure) | Thông báo lỗi hiển thị.                                                           |
| Business Rules            | BR-01, BR-02                                                                       |
| Related UCs               | UC-01 (tạo server), UC-05 (khởi động), UC-06 (dừng), UC-07 (xóa), UC-26 (quản lý thẻ) |

## Luồng Chính

1. Khách hàng điều hướng đến dashboard.
2. Hệ thống truy vấn tất cả **ServerInstance** records belonging to the authenticated customer ([BR-01], [BR-02]).
3. Hệ thống trả về một paginated list with each server showing:
   - **Hostname**
   - **Status** (ACTIVE, STOPPED, CREATING, ERROR)
   - **IP address**
   - **ServerPlan** (or custom spec)
   - **Region** / data center
   - **Tags** (được gán via UC-26)
   - **Created date**
   - **Billing model**
4. Khách hàng thấy danh sách rendered in a bảng or card layout.

## Luồng Thay Thế

### 4a — Phân Trang
- If khách hàng has more than 20 servers, danh sách is paginated.
- Khách hàng có thể điều hướng between pages and choose page size (10, 20, 50).

### 4b — Lọc Theo Trạng Thái
- Customer filters danh sách to show only ACTIVE, STOPPED, CREATING, or ERROR servers.

### 4c — Lọc Theo Thẻ
- Khách hàng chọn one or more tags from their tag collection.
- Hệ thống lọc servers that have **all** selected tags được gán (AND logic).
- System shows lọced list with tag chips visible.

### 4d — Sắp Xếp
- Customer sorts danh sách by hostname, status, region, or creation date (ascending/descending).

### 4e — Trạng Thái Trống
- Customer has zero servers.
- Hệ thống hiển thị: "Bạn chưa có server nào. Hãy tạo server đầu tiên!" with a link to UC-01.

## Luồng Ngoại Lệ

### EX-04-1 — Database Uncó sẵn
- Hệ thống hiển thị: "Không thể tải danh sách server của bạn. Vui lòng thử lại."

---

# UC-05: Start Server

| Attribute                 | Value                                                                          |
|---------------------------|--------------------------------------------------------------------------------|
| UC ID                     | UC-05                                                                          |
| UC Name                   | Khởi Động Server Đã Dừng                                                         |
| Actor(s)                  | Khách hàng (đã xác thực)                                                       |
| Priority                  | High                                                                           |
| Trigger                   | Khách hàng nhấp vào "Start" on server in `STOPPED` state                         |
| Pre-conditions            | Khách hàng đã đăng nhập. Server thuộc về khách hàng này. Trạng thái server là `STOPPED`. |
| Post-conditions (success) | Trạng thái server được cập nhật thành `ACTIVE`. Container được khởi động trên Docker. Audit log được ghi. |
| Post-conditions (failure) | Server status remains `STOPPED` (or marked `ERROR`). Lỗi được ghi log.             |
| Business Rules            | BR-13, BR-19                                                                   |
| Related UCs               | UC-01 (tạo server), UC-04 (danh sách server), UC-06 (dừng server)               |

## Luồng Chính

1. Khách hàng điều hướng đến server list (UC-04).
2. Khách hàng tìm server có trạng thái `STOPPED`.
3. Khách hàng nhấp vào the **Start** action.
4. Hệ thống xác thực rằng server thuộc về khách hàng này and is in `STOPPED` state ([BR-13]).
5. Hệ thống đưa job khởi động vào hàng đợi BullMQ.
6. Hệ thống trả về `202 Accepted` với server ID.
7. Worker nhận job:
   - **Idempotency guard**: checks if server is already `ACTIVE` in database or if container is already running on Docker. If so, skips.
   - Gọi Docker daemon trên node đích: `POST /containers/{dockerContainerId}/start`.
   - Docker khởi động container hiện có.
8. Worker cập nhật server record status to `ACTIVE`.
9. Worker ghi một audit log entry ([BR-19]).
10. Hệ thống làm mới dashboard to show cập nhậtd status.

## Luồng Ngoại Lệ

### EX-05-1 — Server Not in STOPPED State
- Hệ thống trả về mộtn lỗi: "Server này không thể khởi động vì không ở trạng thái đã dừng." ([BR-13])

### EX-05-2 — Docker Daemon Unreachable
- The Docker daemon on node does not respond.
- Hệ thống hiển thị: "Unable to reach máy chủ node. Please try again later."
- Hệ thống ghi log error and alerts admin.

### EX-05-3 — Container Start Failure
- Docker báo lỗi khởi động (ví dụ: volume hỏng, xung đột cổng).
- Hệ thống cập nhật trạng thái server thành `ERROR`.
- Hệ thống thông báo cho customer and admin.

---

# UC-06: Stop Server

| Attribute                 | Value                                                                          |
|---------------------------|--------------------------------------------------------------------------------|
| UC ID                     | UC-06                                                                          |
| UC Name                   | Dừng Server Đang Chạy                                                          |
| Actor(s)                  | Khách hàng (đã xác thực)                                                       |
| Priority                  | High                                                                           |
| Trigger                   | Khách hàng nhấp vào "Stop" on server in `ACTIVE` state                           |
| Pre-conditions            | Khách hàng đã đăng nhập. Server thuộc về khách hàng này. Trạng thái server là `ACTIVE`. |
| Post-conditions (success) | Trạng thái server được cập nhật thành `STOPPED`. Container được dừng một cách nhẹ nhàng. Audit log được ghi. |
| Post-conditions (failure) | Server state unchanged or marked `ERROR`. Lỗi được ghi log.                        |
| Business Rules            | BR-14, BR-17, BR-19                                                             |
| Related UCs               | UC-01 (tạo server), UC-04 (danh sách server), UC-05 (start server)              |

## Luồng Chính

1. Khách hàng điều hướng đến server list (UC-04).
2. Khách hàng tìm server có trạng thái `ACTIVE`.
3. Khách hàng nhấp vào the **Stop** action.
4. System shows a confirmation dialog: "Bạn có chắc muốn dừng server này không? Bạn sẽ không mất dữ liệu."
5. Khách hàng xác nhận.
6. Hệ thống xác thực rằng server thuộc về khách hàng này and is in `ACTIVE` state ([BR-14]).
7. Hệ thống đưa job dừng vào hàng đợi BullMQ.
8. Hệ thống trả về `202 Accepted` với server ID.
9. Worker nhận job:
   - **Idempotency guard**: checks if server is already `STOPPED` in database or if container is already stopped on Docker. If so, skips.
   - Gửi **SIGTERM** đến container: `POST /containers/{dockerContainerId}/stop?signal=SIGTERM`.
   - Đợi tối đa **30 giây** để tắt nhẹ nhàng ([BR-17]).
   - Nếu container vẫn chạy sau 30 giây, gửi **SIGKILL**: `POST /containers/{dockerContainerId}/stop?signal=SIGKILL` (dừng cưỡng bức, theo [BR-17]).
10. Worker cập nhật server record status to `STOPPED` (với ghi chú nếu đã sử dụng dừng cưỡng bức).
11. Worker ghi một audit log entry ([BR-19]).
12. Hệ thống làm mới bảng điều khiển.

## Luồng Thay Thế

### 6a — Tắt Nhẹ Nhàng Thành Công
- Container phản hồi SIGTERM và thoát trong vòng 30 giây.
- Hệ thống ghi lại a normal stop in audit log.

### 6b — Yêu Cầu Dừng Cưỡng Bức
- Container không thoát trong vòng 30 giây kể từ SIGTERM.
- Hệ thống gửi SIGKILL ([BR-17]).
- Hệ thống thêm ghi chú vào audit log chỉ ra lần dừng cưỡng bức.

## Luồng Ngoại Lệ

### EX-06-1 — Server Not in ACTIVE State
- Hệ thống trả về mộtn lỗi: "Server này không thể dừng vì không đang chạy." ([BR-14])

### EX-06-2 — Docker Daemon Error
- Hệ thống ghi log error. Server status may be set to `ERROR`.
- Khách hàng thấy: "Failed to stop server. Please try again."

---

# UC-07: Delete Server

| Attribute                 | Value                                                                                |
|---------------------------|--------------------------------------------------------------------------------------|
| UC ID                     | UC-07                                                                                |
| UC Name                   | Xóa (Hủy) Server                                                          |
| Actor(s)                  | Khách hàng (đã xác thực)                                                             |
| Priority                  | High                                                                                 |
| Trigger                   | Khách hàng nhấp vào "Delete" on server in `STOPPED` state                              |
| Pre-conditions            | Khách hàng đã đăng nhập. Server thuộc về khách hàng này. Trạng thái server là `STOPPED`.  |
| Post-conditions (success) | Bản ghi server được xóa mềm. Container + volume bị xóa. Tất cả tài nguyên được giải phóng. Audit log được ghi. |
| Post-conditions (failure) | Server record unchanged. Resources remain allocated. Lỗi được ghi log.                   |
| Business Rules            | BR-15, BR-16, BR-18, BR-19                                                           |
| Related UCs               | UC-01 (tạo server), UC-04 (danh sách server), UC-06 (dừng server), UC-13 (sao lưu)    |

## Luồng Chính

1. Khách hàng điều hướng đến server list (UC-04).
2. Khách hàng tìm server có trạng thái `STOPPED`.
3. Khách hàng nhấp vào the **Delete** action.
4. Hệ thống hiển thị hộp thoại xác nhận với cảnh báo: "Hành động này không thể hoàn tác. Tất cả dữ liệu trên server này sẽ bị mất vĩnh viễn. Bạn có chắc không?"
5. Khách hàng nhập hostname của server để xác nhận, sau đó nhấp **Delete**.
6. Hệ thống xác thực rằng server thuộc về khách hàng này và ở trạng thái `STOPPED` ([BR-15]).
7. Hệ thống đưa job xóa vào hàng đợi BullMQ.
8. Hệ thống trả về `200 OK` với server ID.
9. Worker nhận job:
   - **Idempotency guard**: queries the Docker daemon trên node đích: `GET /containers/{dockerContainerId}/json`.
     - Nếu container **tồn tại**: tiếp tục đến bước 10.
     - Nếu container **không tồn tại**: bỏ qua xóa container và tiến thẳng đến dọn dẹp database (bước 12).
   - Xóa container: `DELETE /containers/{dockerContainerId}?force=true`.
   - Xóa volume liên quan: `DELETE /volumes/{volumeName}`.
10. Docker xác nhận đã xóa container và volume.
11. Worker thực thi **database cleanup** in a transaction:
    - Xóa tất cả các bản sao lưu liên quan và giải phóng dung lượng lưu trữ ([BR-18]).
    - Giải phóng địa chỉ public IP trở lại pool của node ([BR-16]).
    - Giảm bộ đếm `allocated*` của node ([BR-16]).
    - Xóa mềm bản ghi `ServerInstance` (đặt `deletedAt`).
    - Xóa các bản ghi join `ServerTag` liên quan.
    - Xóa các bản ghi `FirewallRule` liên quan.
    - Xóa các bản ghi `DnsRecord` liên quan.
    - Ghi một bản ghi audit log ([BR-19]).
12. Hệ thống làm mới bảng điều khiển.

## Luồng Thay Thế

### 7a — Dọn Dẹp Database Khi Thử Lại (Idempotency)
- Nếu worker gặp sự cố sau khi xóa Docker nhưng trước khi dọn dẹp database, idempotency guard của lần thử lại phát hiện container đã biến mất trên Docker.
- Worker bỏ qua hoàn toàn các lời gọi Docker và tiến thẳng đến dọn dẹp database (bước 12), giải phóng tài nguyên và xóa mềm bản ghi với ghi chú: "Container đã bị hủy trong lần thử lại trước."

## Luồng Ngoại Lệ

### EX-07-1 — Server Not in STOPPED State
- Hệ thống trả về lỗi: "Bạn phải dừng server trước khi xóa." ([BR-15])
- Nếu server đang ACTIVE, giao diện cung cấp phím tắt "Dừng & Xóa" một nhấp liên kết UC-06 rồi UC-07.

### EX-07-2 — Docker Deletion Failure
- Docker daemon báo lỗi trong quá trình xóa container hoặc volume.
- Hệ thống giữ bản ghi server (status = `ERROR`) để ngăn thanh toán mồ côi.
- Hệ thống cảnh báo admin.
- Khách hàng thấy: "Xóa thất bại. Đội ngũ của chúng tôi đã được thông báo."

### EX-07-3 — Partial Deletion (Distributed State Mismatch)
- Kịch bản: Docker xóa container và volume thành công, nhưng BullMQ worker gặp sự cố trước khi dọn dẹp database (giải phóng IP, giảm bộ đếm node, xóa mềm ServerInstance, ghi audit log).
- Database still shows server as `STOPPED` (or `DELETING`). Node counters still count its resources. The container no longer exists on Docker.
- **Khôi phục** (được tích hợp trong idempotency của worker):
  1. BullMQ phát hiện job chưa được xác nhận và gửi lại nó.
  2. On retry, worker queries **Docker first**: `GET /containers/{dockerContainerId}/json`.
  3. Nếu Docker trả về **"không tìm thấy container"** — worker coi container đã bị hủy và tiến thẳng đến **dọn dẹp database**: giải phóng IP, giảm bộ đếm node, xóa mềm ServerInstance, ghi audit log (kết quả = SUCCESS với ghi chú "Container đã bị hủy trong lần thử lại trước").
  4. Nếu tất cả các lần thử lại đều hết (database vẫn không thể truy cập), worker dead-letter job và cảnh báo admin.
- **Đối chiếu của admin**: Admin xác minh container đã biến mất khỏi Docker, sau đó giải phóng thủ công tài nguyên và cập nhật database.
- Mẫu này làm cho job xóa **idempotent** — thử lại bất kỳ số lần nào cuối cùng cũng hội tụ về trạng thái đúng mà không giải phóng kép tài nguyên.

---

# UC-08: Bật Xác Thực Hai Yếu Tố (2FA)

| Attribute                 | Value                                                                                        |
|---------------------------|----------------------------------------------------------------------------------------------|
| UC ID                     | UC-08                                                                                        |
| UC Name                   | Bật Xác Thực Hai Yếu Tố                                                             |
| Actor(s)                  | Customer, Admin (bắt buộc for admin accounts per [BR-24])                                    |
| Priority                  | High (blocking for admin accounts)                                                           |
| Trigger                   | Người dùng điều hướng đến Profile > Security > "Bật Xác Thực Hai Yếu Tố"                    |
| Pre-conditions            | Người dùng đã đăng nhập (JWT hợp lệ). Người dùng chưa bật 2FA.                             |
| Post-conditions (success) | 2FA được bật trên tài khoản. Mã dự phòng được tạo và hiển thị. TOTP secret được lưu trữ mã hóa. |
| Post-conditions (failure) | 2FA không được bật. Không có thay đổi trạng thái.                                                           |
| Business Rules            | BR-24                                                                                        |
| Related UCs               | UC-03 (đăng nhập), UC-19 (quản lý hồ sơ)                                                        |

## Luồng Chính

1. Người dùng điều hướng đến security settings page.
2. Người dùng nhấp vào **Bật Xác Thực Hai Yếu Tố**.
3. Hệ thống tạo một duy nhất TOTP secret (cryptographically random).
4. Hệ thống lưu trữ TOTP secret (encrypted at rest) in the `TwoFactorAuth` bảng with `được bật = false`.
5. Hệ thống tạo một QR code URI (`otpauth://totp/AstralCloud:{username}?secret={secret}&issuer=Astral+Cloud`).
6. Hệ thống kết xuất QR code image on screen.
7. Người dùng quét mã QR bằng ứng dụng authenticator của họ (Google Authenticator, Authy, v.v.).
8. Người dùng nhập the **6-digit TOTP code** from their authenticator app as verification.
9. Hệ thống xác thực TOTP code against the stored secret (time-window: current ± 1 step).
10. On success:
    - Hệ thống tạo **10 backup codes** (8-character alphanumeric strings).
    - Hệ thống băm mỗi mã dự phòng và lưu trữ các hash.
    - Hệ thống cập nhật `TwoFactorAuth.được bật = true`.
    - Hệ thống ghi một audit log entry.
    - Hệ thống hiển thị 10 backup codes to người dùng with a warning: "Save these codes in a secure location. They will not be shown again."
11. Người dùng xác nhận they have saved bản sao lưu codes.

## Luồng Thay Thế

### 8a — Mã QR Không Hoạt Động
- If người dùng's camera cannot scan the QR code, hệ thống hiển thị **raw TOTP secret** as a text string that can be manually entered into the authenticator app.

### 8b — Tạo Lại Mã Dự Phòng
- Người dùng đã bật 2FA điều hướng đến cài đặt bảo mật.
- Người dùng nhấp vào "Regenerate Backup Codes."
- Hệ thống yêu cầu người dùng's current password.
- Hệ thống vô hiệu hóa tất cả mã dự phòng trước đó.
- Hệ thống tạo mộtnd displays 10 new backup codes.
- Các mã dự phòng trước đó không còn hợp lệ.

### 8c — Tắt 2FA
- Người dùng nhấp vào "Disable Two-Factor Authentication" in security settings.
- Hệ thống yêu cầu current password OR a hợp lệ TOTP code.
- Khi xác minh thành công, hệ thống đặt `TwoFactorAuth.được bật = false` và xóa mã dự phòng.
- Hệ thống ghi một audit log entry.
- **Note**: Tài khoản admin không thể tắt 2FA ([BR-24]) — nút tắt bị ẩn đối với người dùng admin.

## Luồng Ngoại Lệ

### EX-08-1 — Invalid Verification Code
- Người dùng nhập an incorrect TOTP code during the setup verification.
- Hệ thống hiển thị: "Mã không hợp lệ. Vui lòng đảm bảo thời gian trên thiết bị của bạn được đồng bộ và thử lại."
- User có thể thử lại up to 3 times before the setup is cancelled and secret is discarded.

### EX-08-2 — Session Expired During Setup
- If người dùng's JWT expires mid-setup, hệ thống redirects to login and the partial `TwoFactorAuth` record is cleaned up.

### EX-08-3 — Two-Factor Auth Already Enabled
- Hệ thống ẩn "Enable" button and shows "Two-factor authentication is already được bật" with options to regenerate backup codes or disable.

---

# UC-09: Quản Lý API Key

| Attribute                 | Value                                                                                  |
|---------------------------|----------------------------------------------------------------------------------------|
| UC ID                     | UC-09                                                                                  |
| UC Name                   | Quản Lý API Key                                                                        |
| Actor(s)                  | Khách hàng (đã xác thực)                                                               |
| Priority                  | Medium                                                                                 |
| Trigger                   | Khách hàng điều hướng đến Profile > API Keys                                               |
| Pre-conditions            | Khách hàng đã đăng nhập (JWT hợp lệ).                                                     |
| Post-conditions (success) | API key được tạo, thu hồi hoặc xem.                                                   |
| Post-conditions (failure) | Không có thay đổi trạng thái. Lỗi hiển thị.                                                      |
| Business Rules            | BR-26, BR-64, BR-65                                                                    |
| Related UCs               | UC-03 (đăng nhập)                                                                          |

## Luồng Chính

### Tạo API Key

1. Khách hàng điều hướng đến API Keys page.
2. Hệ thống hiển thị một list of existing API keys (prefix + last used + created date + expiry) — the full key is never shown again.
3. Khách hàng nhấp vào **Create API Key**.
4. Khách hàng nhập a **label** (e.g., "My CI/CD pipeline").
5. Khách hàng có thể đặt (tùy chọn) an **expiry date** ([BR-65]).
6. Khách hàng nhấp vào **Tạo**.
7. Hệ thống tạo một cryptographically random API key (e.g., `astral_sk_<random>`).
8. Hệ thống lưu trữ SHA-256 hash of khóa and its first 8 characters as the `keyPrefix`.
9. Hệ thống tạo `ApiKey` record.
10. Hệ thống hiển thị **full API key once** with a warning: "Copy your API key now. For security, it will not be shown again."
11. Customer copies khóa.

### Xem API Key

1. Khách hàng điều hướng đến API Keys page.
2. Hệ thống hiển thị một bảng with:
   - **Label**
   - **Key prefix** (e.g., `astral_sk_...`)
   - **Created date**
   - **Expiry date** (if set)
   - **Last used** timestamp
   - **Revoke** action

### Thu hồi API Key

1. Khách hàng nhấp vào **Revoke** on an API key in danh sách.
2. Hệ thống nhắc: "Are you sure? Any service using this key will lose access immediately."
3. Khách hàng xác nhận.
4. Hệ thống xóa `ApiKey` record (hard delete).
5. Hệ thống xác nhận: "API key revoked. Any requests using this key will now receive 401."

## Luồng Ngoại Lệ

### EX-09-1 — Key Not Copied
- After creation, if khách hàng navigates away without copying khóa, the full key is lost.
- Hệ thống hiển thị: "Key not shown. You must create a new one."
- Bản ghi khóa cũ bị xóa và phải tạo một khóa mới.

### EX-09-2 — Expired Key
- Các yêu cầu API sử dụng khóa hết hạn nhận được `401 Unauthorized` với thông báo: "API key đã hết hạn." ([BR-65])

### EX-09-3 — Rate Limit Exceeded
- Các yêu cầu API key vượt quá 60 req/min nhận được `429 Too Many Requests` ([BR-26]).

---

# UC-10: Ví & Thanh Toán

| Attribute                 | Value                                                                                        |
|---------------------------|----------------------------------------------------------------------------------------------|
| UC ID                     | UC-10                                                                                        |
| UC Name                   | Ví & Thanh Toán                                                                            |
| Actor(s)                  | Khách hàng (đã xác thực)                                                                     |
| Priority                  | High                                                                                         |
| Trigger                   | Khách hàng điều hướng đến Billing page or initiates a top-up                                     |
| Pre-conditions            | Khách hàng đã đăng nhập (JWT hợp lệ).                                                           |
| Post-conditions (success) | Ví được nạp tiền hoặc lịch sử thanh toán hiển thị.                                                  |
| Post-conditions (failure) | Không có thay đổi trạng thái. Lỗi hiển thị.                                                            |
| Business Rules            | BR-27, BR-28, BR-29, BR-30, BR-31, BR-32, BR-60, BR-61                                       |
| Related UCs               | UC-01 (tạo server), UC-11 (áp dụng voucher)                                                 |

## Luồng Chính

### Xem Số Dư & Trang Thanh Toán

1. Khách hàng điều hướng đến Billing page.
2. Hệ thống hiển thị:
   - **Current wallet balance**.
   - **Billing history** bảng (paginated):
     - Date, description (server charge, top-up, refund), amount, status, invoice link.
   - **Upcoming charges** summary (next billing dates for monthly servers, current hourly burn rate).
   - **Tax rate** applied to khách hàng's billing address region ([BR-60], [BR-61]).

### Nạp Tiền

1. Khách hàng nhấp vào **Nạp Tiền** on the Billing page.
2. Khách hàng nhập an **amount** to add (minimum configurable, mặc định $5).
3. Khách hàng có thể nhập (tùy chọn) a **voucher code** (see UC-11).
4. Khách hàng nhấp vào **Tiếp Tục Thanh Toán**.
5. Hệ thống tạo một Stripe PaymentIntent for the amount (minus voucher discount).
6. Hệ thống chuyển hướng to the Stripe checkout (or hiển thị embedded Stripe Elements form).
7. Customer completes thanh toán (card details handled entirely by Stripe — raw card numbers never touch Astral Cloud's servers, [BR-31]).
8. Stripe webhook thông báo hệ thống of thành công payment.
9. Hệ thống cập nhật wallet balance.
10. Hệ thống tạo mộtn invoice with `status = PAID` ([BR-30]).
11. Hệ thống tạo một `Payment` record.
12. Hệ thống gửi một confirmation notification.

### Xem Lịch Sử Thanh Toán

1. Khách hàng điều hướng đến Billing page.
2. Hệ thống truy vấn tất cả `Payment` records belonging to khách hàng, ordered by date descending.
3. Hệ thống trả về một paginated list with:
   - **Date**
   - **Type** (TOP_UP, CHARGE, REFUND)
   - **Description** (server name, top-up amount)
   - **Amount** (+/-)
   - **Status** (COMPLETED, FAILED, REFUNDED)
   - **Invoice link** (PDF download)

### Tải Xuống Hóa Đơn PDF

1. From thanh toán history, customer nhấp vào **Download Invoice** icon.
2. Hệ thống cung cấp PDF đã tạo sẵn từ bộ lưu trữ ([BR-30]).
3. Nếu PDF chưa được tạo, hệ thống tạo nó ngay lập tức và trả về.

### Quản Lý Phương Thức Thanh Toán

1. Khách hàng điều hướng đến Billing > Payment Methods.
2. Hệ thống hiển thị saved payment methods (brand, last4, expiry, mặc định status) — tokenized via Stripe ([BR-31]).
3. Customer can:
   - **Add** a new payment method (via Stripe Elements).
   - **Set mặc định** — mark a payment method as mặc định for future charges.
   - **Delete** a saved payment method.
4. Ít nhất một phương thức thanh toán phải là mặc định; phương thức cuối cùng không thể bị xóa nếu không thêm phương thức thay thế.

## Luồng Thay Thế

### 10a — Tự Động Khấu Trừ (Hàng Tháng)
- Cron job chạy theo khoảng thời gian đã cấu hình.
- Đối với mỗi server có `billingModel = MONTHLY` và `nextBillingAt ≤ now()`:
  - Hệ thống cố gắng tự động khấu trừ từ số dư ví.
  - Khi thành công: tạo bản ghi phí, tạo hóa đơn, đặt ngày thanh toán tiếp theo.
  - Khi thất bại: vào thời gian gia hạn theo [BR-29].

### 10b — Tự Động Khấu Trừ (Hàng Giờ)
- Cron job chạy mỗi giờ.
- Đối với mỗi server có `billingModel = HOURLY` và status = ACTIVE:
  - Hệ thống khấu trừ hourly rate from wallet balance ([BR-28]).
  - Khi thành công: tạo bản ghi phí.
  - Khi thất bại: vào thời gian gia hạn theo [BR-29].

### 10c — Thời Gian Gia Hạn
- Nếu tự động khấu trừ thất bại, server vào thời gian gia hạn 24 giờ ([BR-29]).
- Hệ thống gửi payment failure notification (critical — cannot be opted out).
- Nếu khách hàng nạp tiền trong vòng 24 giờ, các khoản phí đang chờ được áp dụng và thanh toán tiếp tục.
- After 24 hours without top-up, server is automatically stopped.

## Luồng Ngoại Lệ

### EX-10-1 — Payment Failed (Stripe)
- Stripe reports thanh toán was declined or thất bại.
- Hệ thống hiển thị: "Thanh toán bị từ chối. Vui lòng thử phương thức thanh toán khác."
- Không có số dư nào được thêm. Không có hóa đơn nào được tạo.

### EX-10-2 — Webhook Timeout
- If the Stripe webhook is delayed or not received, thanh toán shows as PENDING.
- Khách hàng có thể thử lại hoặc liên hệ hỗ trợ.

### EX-10-3 — Insufficient Balance for Service
- If wallet balance is insufficient to create a new server ([BR-27]) or is depleted during auto-deduction, server enters grace period ([BR-29]).

---

# UC-11: Apply Voucher

| Attribute                 | Value                                                                                        |
|---------------------------|----------------------------------------------------------------------------------------------|
| UC ID                     | UC-11                                                                                        |
| UC Name                   | Áp Dụng Voucher / Mã Giảm Giá                                                                  |
| Actor(s)                  | Khách hàng (đã xác thực)                                                                     |
| Priority                  | Medium                                                                                       |
| Trigger                   | Khách hàng nhập a voucher code during wallet top-up or server creation                       |
| Pre-conditions            | Khách hàng đã đăng nhập. Quá trình nạp tiền hoặc tạo server đang diễn ra.                        |
| Post-conditions (success) | Voucher được áp dụng; giảm giá phản ánh trong số tiền thanh toán. Bản ghi VoucherUsage được tạo.          |
| Post-conditions (failure) | Voucher không được áp dụng. Thông báo lỗi hiển thị giải thích lý do.                              |
| Business Rules            | BR-33, BR-34, BR-35, BR-36, BR-37, BR-38                                                     |
| Related UCs               | UC-01 (tạo server), UC-10 (ví), UC-21 (quản lý voucher)                               |

## Luồng Chính

1. Trong quá trình nạp tiền (UC-10) hoặc tạo server (UC-01), khách hàng thấy trường "Áp Dụng Voucher".
2. Khách hàng nhập a voucher code.
3. Khách hàng nhấp vào **Áp Dụng**.
4. Hệ thống thực hiện validation checks:
   - Voucher code exists in database (case-insensitive match, [BR-33]).
   - Voucher đang hoạt động (`isActive = true`).
   - Voucher nằm trong cửa sổ hiệu lực (`validFrom ≤ now ≤ validUntil`, [BR-34]).
   - Voucher còn lượt sử dụng (`currentUses < maxUses`, [BR-35]).
   - Customer chưa vượt quá per-user usage limit (`count(VoucherUsage) < maxUsesPerUser`, [BR-36]).
   - Số tiền thanh toán hiện tại đáp ứng yêu cầu chi tiêu tối thiểu nếu được đặt ([BR-37]).
5. Hệ thống tính toán discount:
   - `PERCENTAGE`: giảm giá = paymentAmount × (discountValue / 100).
   - `FIXED_AMOUNT`: giảm giá = min(discountValue, paymentAmount) (giảm giá không thể vượt quá số tiền thanh toán).
6. Hệ thống hiển thị **adjusted amount** with discount breakdown:
   - Original amount: $50.00
   - Voucher discount (WELCOME20): -$10.00
   - Amount to pay: $40.00
7. Customer proceeds with thanh toán at giảm giáed amount.
8. Sau khi thanh toán/tính phí thành công:
   - Hệ thống tăng `voucher.currentUses`.
   - Hệ thống tạo một `VoucherUsage` record linking voucher, user, and payment.
   - Hệ thống tạo `Payment` record with `voucherId` set.
   - Invoice reflects giảm giá as a line item.

## Luồng Thay Thế

### 11a — Nhiều Voucher
- Khách hàng nhập additional voucher codes.
- Hệ thống xác thực each individually against all rules.
- System sums discounts, but total discount cannot exceed thanh toán amount ([BR-38]).
- Hệ thống hiển thị một stacked breakdown of each voucher's contribution.

### 11b — Xóa Voucher
- Khách hàng nhấp vào "Remove" next to an applied voucher.
- Hệ thống tính lại tổng mà không có voucher đó.

### 11c — Xác Thực Trước Voucher (Không Mua)
- Khách hàng nhập a voucher code to check its value before proceeding.
- Hệ thống xác thực code và hiển thị giảm giá amount without finalizing.

## Luồng Ngoại Lệ

### EX-11-1 — Voucher Not Found
- Hệ thống hiển thị: "Mã voucher không hợp lệ. Vui lòng kiểm tra và thử lại."

### EX-11-2 — Voucher Expired
- Hệ thống hiển thị: "Voucher này đã hết hạn." ([BR-34])

### EX-11-3 — Voucher Exhausted
- Hệ thống hiển thị: "Voucher này đã đạt đến số lượt sử dụng tối đa." ([BR-35])

### EX-11-4 — Voucher Already Used by Customer
- Hệ thống hiển thị: "Bạn đã sử dụng voucher này rồi." ([BR-36])

### EX-11-5 — Minimum Spend Not Met
- Hệ thống hiển thị: "Voucher này yêu cầu chi tiêu tối thiểu $X. Nạp thêm tiền để áp dụng." ([BR-37])

### EX-11-6 — Discount Exceeds Payment
- When applying multiple vouchers: "The total discount cannot exceed thanh toán amount." ([BR-38])
- System reduces the last-applied voucher's discount to match thanh toán amount.

---

## Sơ Đồ Trình Tự: UC-11 Luồng Sử Dụng Voucher

```
Customer        Next.js          PostgreSQL          Stripe
   |               |                  |                  |
   |  POST /api/   |                  |                  |
   |  wallet/      |                  |                  |
   |  top-up       |                  |                  |
   |  { amount:50, |                  |                  |
   |    voucherCode:|                  |                  |
   |    "WELCOME20"}|                  |                  |
   |──────────────>|                  |                  |
   |               |                  |                  |
   |               |  BEGIN TRANSACTION                 |
   |               |─────────────────>|                  |
   |               |                  |                  |
   |               |  SELECT Voucher  |                  |
   |               |  WHERE code =    |                  |
   |               |  'WELCOME20'     |                  |
   |               |  (case-insensitive)                |
   |               |─────────────────>|                  |
   |               |  voucher found   |                  |
   |               |<─────────────────|                  |
   |               |                  |                  |
   |               |  Validate:       |                  |
   |               |  ✓ isActive=true |                  |
   |               |  ✓ validFrom ≤ now ≤ validUntil     |
   |               |    (BR-34)       |                  |
   |               |  ✓ currentUses=5 < maxUses=100      |
   |               |    (BR-35)       |                  |
   |               |  ✓ count(VoucherUsage WHERE         |
   |               |    userId=:uid   |                  |
   |               |    AND voucherId=:vid) = 0 < 1      |
   |               |    (BR-36)       |                  |
   |               |─────────────────>|                  |
   |               |  count = 0       |                  |
   |               |<─────────────────|                  |
   |               |                  |                  |
   |               |  ✓ $50.00 ≥     |                  |
   |               |    minSpend=$20  |                  |
   |               |    (BR-37)       |                  |
   |               |                  |                  |
   |               |  Calculate discount:               |
   |               |  type=PERCENTAGE, |                  |
   |               |  value=20.00      |                  |
   |               |  discount = $50 × |                  |
   |               |  0.20 = $10.00    |                  |
   |               |                  |                  |
   |               |  Amount to charge:|                  |
   |               |  $50 - $10 = $40  |                  |
   |               |                  |                  |
   |               |  COMMIT          |                  |
   |               |<─────────────────|                  |
   |               |                  |                  |
   |               |  Create Stripe   |                  |
   |               |  PaymentIntent   |                  |
   |               |  amount: 4000    |                  |
   |               |  (cents)         |                  |
   |               |─────────────────────────────────────>|
   |               |                  |  PaymentIntent   |
   |               |                  |  created         |
   |               |<─────────────────────────────────────|
   |               |                  |                  |
   |  200 OK       |                  |                  |
   |  { originalAmount: 50.00,           |                  |
   |    discount: 10.00,                 |                  |
   |    finalAmount: 40.00,              |                  |
   |    voucherCode: "WELCOME20",        |                  |
   |    clientSecret: "pi_..." }         |                  |
   |<──────────────|                  |                  |
   |               |                  |                  |
   |  Customer completes payment via Stripe               |
   |─────────────────────────────────────────────────────>|
   |               |                  |   webhook:       |
   |               |                  |   payment_intent.|
   |               |                  |   succeeded      |
   |               |<─────────────────────────────────────|
   |               |                  |                  |
   |               |  INSERT Payment  |                  |
   |               |  (status=COMPLETED,                 |
   |               |   voucherId=:vid) |                  |
   |               |─────────────────>|                  |
   |               |                  |                  |
   |               |  UPDATE Voucher  |                  |
   |               |  currentUses = 6 |                  |
   |               |─────────────────>|                  |
   |               |                  |                  |
   |               |  INSERT VoucherUsage               |
   |               |  (voucherId, userId,                |
   |               |   paymentId, discount=$10)          |
   |               |─────────────────>|                  |
   |               |                  |                  |
   |               |  UPDATE User     |                  |
   |               |  balance += 50   |                  |
   |               |─────────────────>|                  |
   |               |                  |                  |
   |               |  INSERT Invoice  |                  |
   |               |  (subtotal=50,   |                  |
   |               |   discount=10,   |                  |
   |               |   total=40)      |                  |
   |               |─────────────────>|                  |
   |               |                  |                  |
   |  Notification sent to customer     |                  |
   |  "Wallet funded: $50.00            |                  |
   |   Discount: $10.00                 |                  |
   |   (WELCOME20)"                     |                  |
```

---

# UC-12: Support Tickets

| Attribute                 | Value                                                                                   |
|---------------------------|-----------------------------------------------------------------------------------------|
| UC ID                     | UC-12                                                                                   |
| UC Name                   | Ticket Hỗ Trợ (Giao Diện Khách Hàng)                                                         |
| Actor(s)                  | Khách hàng (đã xác thực)                                                                |
| Priority                  | Medium                                                                                  |
| Trigger                   | Khách hàng điều hướng đến Support                                                           |
| Pre-conditions            | Khách hàng đã đăng nhập (JWT hợp lệ).                                                      |
| Post-conditions (success) | Ticket được tạo, xem hoặc cập nhật.                                                     |
| Post-conditions (failure) | Không có thay đổi trạng thái. Lỗi hiển thị.                                                       |
| Business Rules            | BR-39, BR-40, BR-41, BR-42                                                              |
| Related UCs               | UC-22 (staff quản lý ticket)                                                            |

## Luồng Chính

### Tạo Ticket

1. Khách hàng điều hướng đến Support > New Ticket.
2. Khách hàng điền vào:
   - **Subject** (bắt buộc).
   - **Category** (GENERAL, BILLING, TECHNICAL, ABUSE).
   - **Message body** (bắt buộc, supports Markdown).
   - **Priority** (LOW, NORMAL, HIGH, URGENT).
3. Khách hàng nhấp vào **Gửi**.
4. Hệ thống tạo một `Ticket` record with `status = OPEN` and links it to khách hàng's account ([BR-39]).
5. Hệ thống tạo first `TicketMessage` with khách hàng's message body.
6. Hệ thống thông báo staff of a new ticket.
7. Khách hàng thấy ticket detail page với thread.

### Xem Danh Sách Ticket

1. Khách hàng điều hướng đến Support > My Tickets.
2. Hệ thống truy vấn tất cả `Ticket` records belonging to khách hàng ([BR-39]), ordered by most recently updated.
3. Hệ thống trả về một paginated list with:
   - **Ticket #** (short ID)
   - **Subject**
   - **Status** (OPEN, IN_PROGRESS, WAITING_ON_CUSTOMER, RESOLVED, CLOSED)
   - **Category**
   - **Priority**
   - **Last updated**

### Xem Chi Tiết Ticket & Thêm Tin Nhắn

1. Khách hàng nhấp vào một ticket from danh sách.
2. Hệ thống hiển thị full ticket thread with all `TicketMessage` entries chronologically.
3. Internal notes (staff-only) are hidden from khách hàng.
4. Khách hàng nhập a reply in tin nhắn box.
5. Khách hàng nhấp vào **Gửi**.
6. Hệ thống tạo một new `TicketMessage` record.
7. Hệ thống cập nhật `Ticket.updatedAt`.
8. Hệ thống thông báo được gán staff (if any).

### Đóng Ticket

1. Khách hàng xem một ticket đã được giải quyết.
2. Khách hàng nhấp vào **Close Ticket**.
3. Hệ thống xác thực ticket is in `RESOLVED` status ([BR-40]).
4. Hệ thống cập nhật status to `CLOSED` và đặt `closedAt`.
5. Hệ thống ghi một audit log entry.

### Mở Lại Ticket

1. Khách hàng xem một ticket đã đóng trong vòng 7 ngày kể từ khi đóng.
2. Khách hàng nhấp vào **Reopen**.
3. Hệ thống xác thực ticket was closed within the last 7 days ([BR-41]).
4. Hệ thống cập nhật status to `OPEN`.
5. Nếu hơn 7 ngày đã trôi qua, nút "Mở Lại" bị ẩn và khách hàng thấy: "Ticket này đã bị đóng hơn 7 ngày. Vui lòng tạo ticket mới."

## Luồng Ngoại Lệ

### EX-12-1 — Invalid Status Transition
- Khách hàng cố gắng thay đổi trạng thái ticket theo cách không hợp lệ (ví dụ: đóng ticket vẫn đang OPEN).
- Hệ thống hiển thị: "Không thể đóng ticket này ở trạng thái hiện tại." ([BR-40])

### EX-12-2 — Empty Message
- Hệ thống xác thực message body is non-empty before submission.
- Hệ thống hiển thị: "Tin nhắn không thể để trống."

---

# UC-13: Sao Lưu Server

| Attribute                 | Value                                                                                       |
|---------------------------|---------------------------------------------------------------------------------------------|
| UC ID                     | UC-13                                                                                       |
| UC Name                   | Sao Lưu Server                                                                              |
| Actor(s)                  | Khách hàng (đã xác thực)                                                                    |
| Priority                  | Medium                                                                                      |
| Trigger                   | Khách hàng điều hướng đến Backups tab on server detail page                                   |
| Pre-conditions            | Khách hàng đã đăng nhập. Server thuộc về khách hàng. Server status is `ACTIVE` or `STOPPED`. |
| Post-conditions (success) | Sao lưu được tạo, khôi phục, xóa hoặc lịch trình được cấu hình.                                  |
| Post-conditions (failure) | Không có thay đổi trạng thái. Lỗi hiển thị.                                                           |
| Business Rules            | BR-51, BR-52, BR-53                                                                         |
| Related UCs               | UC-01 (tạo server), UC-04 (danh sách server)                                                 |

## Luồng Chính

### Tạo Sao Lưu Thủ Công

1. Khách hàng điều hướng đến server detail page > Backups tab.
2. Khách hàng nhấp vào **Tạo Sao Lưu**.
3. Khách hàng có thể nhập (tùy chọn) a **label** (auto-generated if blank, e.g., "backup-2026-06-27-1430").
4. Khách hàng nhấp vào **Xác Nhận**.
5. Hệ thống xác thực:
   - Không có job sao lưu nào khác đang chạy cho server này ([BR-53]).
   - Tổng dung lượng sao lưu bao gồm bản sao lưu mới sẽ không vượt quá 2× disk đã phân bổ ([BR-52]).
6. Hệ thống đưa một job vào hàng đợi backup job to BullMQ.
7. Hệ thống trả về `202 Accepted`.
8. Worker nhận job:
   - Creates a volume snapshot or tarball of container's data volume.
   - Stores bản sao lưu archive on node's backup storage path.
   - Tạo bản ghi `Backup` với `status = AVAILABLE`, `type = MANUAL`, `sizeMB`.
9. Hệ thống gửi một notification to khách hàng.

### Xem Lịch Sử Sao Lưu

1. Khách hàng điều hướng đến server detail page > Backups tab.
2. Hệ thống truy vấn tất cả `Backup` records for server, ordered by creation date descending.
3. Hệ thống hiển thị:
   - **Label**
   - **Type** (MANUAL, AUTOMATED)
   - **Size** (MB)
   - **Status** (CREATING, AVAILABLE, FAILED, EXPIRED)
   - **Created date**
   - **Expiry date** (if set)
   - **Actions**: Restore, Delete

### Khôi Phục Từ Sao Lưu

1. Khách hàng nhấp vào **Khôi Phục** on a backup with `status = AVAILABLE`.
2. Hệ thống nhắc: "Restoring from a backup will replace all current data on this server. Are you sure?"
3. Customer types server hostname and clicks **Xác Nhận**.
4. Hệ thống xác thực server is in `STOPPED` state (restore requires a stopped server).
5. Hệ thống đưa một job vào hàng đợi restore job to BullMQ.
6. Worker:
   - Stops container if running.
   - Restores the data volume from bản sao lưu archive.
   - Restarts container.
   - Updates server status to `ACTIVE`.
7. Hệ thống gửi một notification.

### Cấu Hình Lịch Sao Lưu Tự Động

1. Khách hàng điều hướng đến server detail page > Backups > Schedule.
2. Customer configures:
   - **Enabled** (bật/tắt on/off).
   - **Interval** (hours between backups, mặc định 24).
   - **Retain Daily** (how many daily backups to keep, mặc định 7).
   - **Retain Weekly** (how many weekly backups to keep, mặc định 4).
   - **Retain Monthly** (how many monthly backups to keep, mặc định 3).
3. Khách hàng nhấp vào **Lưu**.
4. Hệ thống tạo or cập nhật `BackupSchedule` record.
5. Cron job picks up lịch trình và tạo automated backups at the configured interval.

### Xóa Sao Lưu

1. Khách hàng nhấp vào **Delete** on a backup.
2. Hệ thống xác nhận: "This backup will be permanently deleted. Are you sure?"
3. Khách hàng xác nhận.
4. Hệ thống xóa backup archive từ bộ lưu trữ.
5. Hệ thống xóa `Backup` record.
6. Released storage is credited back to hạn ngạch.

## Luồng Ngoại Lệ

### EX-13-1 — Backup Quota Exceeded
- Hệ thống hiển thị: "Hạn ngạch lưu trữ sao lưu đã vượt quá. Xóa các bản sao lưu cũ hoặc nâng cấp gói của bạn." ([BR-52])

### EX-13-2 — Backup Job Already Running
- Hệ thống hiển thị: "Một bản sao lưu đang được tiến hành cho server này." ([BR-53])

### EX-13-3 — Backup Failed
- Docker daemon error during snapshot creation.
- Hệ thống cập nhật backup status to `FAILED`.
- Hệ thống thông báo customer.

### EX-13-4 — Server Must Be Stopped for Restore
- Hệ thống hiển thị: "You must stop server before restoring from a backup."
- Giao diện cung cấp phím tắt "Dừng & Khôi Phục" một nhấp.

---

# UC-14: Quy Tắc Tường Lửa

| Attribute                 | Value                                                                               |
|---------------------------|-------------------------------------------------------------------------------------|
| UC ID                     | UC-14                                                                               |
| UC Name                   | Quy Tắc Tường Lửa                                                                      |
| Actor(s)                  | Khách hàng (đã xác thực)                                                            |
| Priority                  | Medium                                                                              |
| Trigger                   | Khách hàng điều hướng đến Firewall tab on server detail page                          |
| Pre-conditions            | Khách hàng đã đăng nhập. Server thuộc về khách hàng.                                  |
| Post-conditions (success) | Quy tắc tường lửa được tạo, cập nhật hoặc xóa. Quy tắc ipbảngs Docker được đồng bộ.           |
| Post-conditions (failure) | Không có thay đổi trạng thái. Lỗi hiển thị.                                                   |
| Business Rules            | BR-46, BR-47, BR-48                                                                 |
| Related UCs               | UC-01 (tạo server), UC-04 (danh sách server)                                         |

## Luồng Chính

### List Quy Tắc Tường Lửa

1. Khách hàng điều hướng đến server detail page > Firewall tab.
2. Hệ thống truy vấn tất cả `FirewallRule` records for server, ordered by `priority` ascending.
3. Hệ thống hiển thị một bảng:
   - **Priority** (lower = evaluated first)
   - **Action** (ALLOW / DENY)
   - **Protocol** (TCP, UDP, ICMP, ALL)
   - **Port Range** (e.g., "22", "80", "8000-8100")
   - **Source CIDR** (e.g., "0.0.0.0/0", "10.0.0.0/8")
   - **Description**
   - **Actions**: Edit, Delete

### Tạo Quy Tắc Tường Lửa

1. Khách hàng nhấp vào **Thêm Quy Tắc**.
2. Khách hàng điền vào:
   - **Protocol** (TCP, UDP, ICMP, ALL)
   - **Port Range** (e.g., "443")
   - **Source CIDR** (e.g., "0.0.0.0/0")
   - **Action** (ALLOW / DENY)
   - **Priority** (integer, mặc định: next có sẵn)
   - **Description** (tùy chọn)
3. Khách hàng nhấp vào **Lưu**.
4. Hệ thống xác thực rule và tạo a `FirewallRule` record.
5. System triggers a firewall sync: áp dụng new rule to the Docker container via ipbảngs rules on the Docker host.
6. Hệ thống trả về success với new rule details.

### Cập Nhật Quy Tắc Tường Lửa

1. Khách hàng nhấp vào **Edit** on an existing rule.
2. Khách hàng sửa đổi các trường mong muốn.
3. Khách hàng nhấp vào **Lưu**.
4. Hệ thống cập nhật `FirewallRule` record.
5. Hệ thống đồng bộ lại quy tắc tường lửa cho Docker container.

### Xóa Quy Tắc Tường Lửa

1. Khách hàng nhấp vào **Delete** on a rule.
2. Hệ thống nhắc: "Remove this firewall rule?"
3. Khách hàng xác nhận.
4. Hệ thống xóa `FirewallRule` record.
5. Hệ thống đồng bộ lại quy tắc tường lửa cho Docker container.

## Chi Tiết Quy Tắc Nghiệp Vụ

- **Default rules** ([BR-48]): Khi tạo server, ba quy tắc mặc định được chèn:
  1. Priority 100: ALLOW TCP port 22 from 0.0.0.0/0 (SSH)
  2. Priority 200: ALLOW TCP port 80 from 0.0.0.0/0 (HTTP)
  3. Priority 300: ALLOW TCP port 443 from 0.0.0.0/0 (HTTPS)
- **Default deny** ([BR-46]): Một quy tắc DENY ALL ngầm định ở priority 99999 bắt lưu lượng không khớp.
- **Priority evaluation** ([BR-47]): Rules are evaluated in ascending priority order. The first matching rule determines hành động; subsequent rules are not evaluated.

## Luồng Ngoại Lệ

### EX-14-1 — Invalid Port Range
- Hệ thống hiển thị: "Phạm vi cổng không hợp lệ. Sử dụng một cổng đơn (ví dụ: 80) hoặc một phạm vi (ví dụ: 8000-8100)."

### EX-14-2 — Firewall Sync Failure
- Docker daemon fails to apply the ipbảngs rules.
- Hệ thống hiển thị: "Không thể áp dụng quy tắc tường lửa. Thay đổi của bạn đã được lưu nhưng chưa có hiệu lực. Vui lòng thử lại."
- Rule records remain in database; sync can be retried.

---

# UC-15: Quản Lý DNS

| Attribute                 | Value                                                                               |
|---------------------------|-------------------------------------------------------------------------------------|
| UC ID                     | UC-15                                                                               |
| UC Name                   | Quản Lý DNS                                                                      |
| Actor(s)                  | Khách hàng (đã xác thực)                                                            |
| Priority                  | Medium                                                                              |
| Trigger                   | Khách hàng điều hướng đến DNS tab on server detail page                               |
| Pre-conditions            | Khách hàng đã đăng nhập. Server thuộc về khách hàng.                                  |
| Post-conditions (success) | Bản ghi DNS được tạo, cập nhật hoặc xóa.                                            |
| Post-conditions (failure) | Không có thay đổi trạng thái. Lỗi hiển thị.                                                   |
| Business Rules            | BR-49, BR-50                                                                        |
| Related UCs               | UC-01 (tạo server), UC-04 (danh sách server)                                         |

## Luồng Chính

### Liệt Kê Bản Ghi DNS

1. Khách hàng điều hướng đến server detail page > DNS tab.
2. Hệ thống truy vấn tất cả `DnsRecord` records for server.
3. Hệ thống hiển thị một bảng:
   - **Type** (A, AAAA, CNAME, MX, TXT, PTR)
   - **Name** (e.g., "@", "www", "mail")
   - **Value** (IP address or domain)
   - **TTL** (seconds)
   - **Priority** (MX records only)
   - **Actions**: Edit, Delete

### Tạo Bản Ghi DNS

1. Khách hàng nhấp vào **Thêm Bản Ghi**.
2. Khách hàng điền vào:
   - **Type** (A, AAAA, CNAME, MX, TXT, PTR)
   - **Name** (e.g., "www" — the subdomain; "@" for root)
   - **Value** (IP address for A/AAAA, domain for CNAME/MX, text for TXT)
   - **TTL** (seconds, mặc định: 3600)
   - **Priority** (MX only)
3. Khách hàng nhấp vào **Lưu**.
4. Hệ thống xác thực:
   - Name + Type combination is duy nhất cho server này ([BR-49]).
   - If type is PTR, no other PTR record exists cho server này ([BR-50]).
   - Value format matches bản ghi type (IP for A/AAAA, etc.).
5. Hệ thống tạo một `DnsRecord` record.
6. Hệ thống trả về success.

### Cập Nhật Bản Ghi DNS

1. Khách hàng nhấp vào **Edit** on an existing record.
2. Khách hàng sửa đổi các trường mong muốn.
3. Khách hàng nhấp vào **Lưu**.
4. Hệ thống xác thực và cập nhật `DnsRecord` record.

### Xóa Bản Ghi DNS

1. Khách hàng nhấp vào **Delete** on a record.
2. Hệ thống nhắc: "Remove this DNS record?"
3. Khách hàng xác nhận.
4. Hệ thống xóa `DnsRecord` record.

## Luồng Ngoại Lệ

### EX-15-1 — Duplicate Record
- Hệ thống hiển thị: "Một bản ghi với tên và kiểu này đã tồn tại cho server này." ([BR-49])

### EX-15-2 — Multiple PTR Records
- Hệ thống hiển thị: "Mỗi server chỉ có thể có một bản ghi PTR (reverse DNS)." ([BR-50])

### EX-15-3 — Invalid Value Format
- Hệ thống hiển thị: "Giá trị không hợp lệ cho kiểu bản ghi. Mong đợi một địa chỉ IPv4/IPv6/tên miền hợp lệ."

---

# UC-16: Read Blog

| Attribute                 | Value                                                                               |
|---------------------------|-------------------------------------------------------------------------------------|
| UC ID                     | UC-16                                                                               |
| UC Name                   | Đọc Blog / Duyệt Nội Dung                                                          |
| Actor(s)                  | Khách truy cập (chưa xác thực), Khách hàng (đã xác thực)                                 |
| Priority                  | Low                                                                                 |
| Trigger                   | Khách truy cập điều hướng đến /blog                                                          |
| Pre-conditions            | None                                                                                |
| Post-conditions (success) | Bài viết blog hiển thị.                                                               |
| Post-conditions (failure) | Thông báo lỗi hiển thị.                                                            |
| Business Rules            | BR-43, BR-44                                                                        |
| Related UCs               | UC-23 (staff quản lý blog)                                                           |

## Luồng Chính

### Duyệt Blog

1. Khách truy cập điều hướng đến /blog page.
2. Hệ thống truy vấn tất cả blog posts with `status = PUBLISHED` ([BR-43]), ordered by `publishedAt` descending.
3. Hệ thống kết xuất một paginated list of post cards showing:
   - **Cover image** (if có sẵn)
   - **Title**
   - **Excerpt**
   - **Author name** ([BR-45])
   - **Category**
   - **Published date**
   - **Tags**

### Xem Bài Viết Blog

1. Khách truy cập nhấp vào on a blog post card.
2. Hệ thống lấy the post by slug ([BR-44]).
3. Hệ thống kết xuất full post:
   - Title, author, published date, category.
   - Cover image.
   - Markdown body rendered to HTML.
   - Tags.
4. If the post is DRAFT or ARCHIVED, it is only visible to authenticated staff/admin users ([BR-43]).

### Lọc Theo Danh Mục

1. Visitor chọn một category từ category list/sidebar.
2. Hệ thống lọc posts to only those in the selected category.

### Tìm Kiếm Theo Từ Khóa

1. Khách truy cập nhập a search keyword in the blog search bar.
2. Hệ thống thực hiện một full-text search (or `ILIKE` for MVP) on post titles, excerpts, and tags.
3. Hệ thống trả về matching published posts, ordered by relevance.

## Luồng Thay Thế

### 16a — RSS Feed
- System provides an RSS/Atom feed at `/blog/feed.xml` (or `/blog/rss`) containing the most recent published posts.

## Luồng Ngoại Lệ

### EX-16-1 — Post Not Found
- If the slug does not match any PUBLISHED post, system trả về một 404 page.
- If the post exists but is DRAFT and khách truy cập không staff/admin, return 404 (do not reveal existence).

### EX-16-2 — Empty Category
- Hệ thống hiển thị: "No posts in this category yet."

---

# UC-17: Chương Trình Giới Thiệu

| Attribute                 | Value                                                                               |
|---------------------------|-------------------------------------------------------------------------------------|
| UC ID                     | UC-17                                                                               |
| UC Name                   | Chương Trình Giới Thiệu                                                                    |
| Actor(s)                  | Khách hàng (đã xác thực)                                                            |
| Priority                  | Low                                                                                 |
| Trigger                   | Khách hàng điều hướng đến Referrals page                                                |
| Pre-conditions            | Khách hàng đã đăng nhập (JWT hợp lệ).                                                  |
| Post-conditions (success) | Thông tin giới thiệu hiển thị hoặc liên kết giới thiệu được chia sẻ.                             |
| Post-conditions (failure) | Lỗi hiển thị.                                                                    |
| Business Rules            | BR-54, BR-55, BR-56, BR-57                                                          |
| Related UCs               | UC-02 (đăng ký), UC-10 (ví)                                                    |

## Luồng Chính

### Xem Bảng Điều Khiển Giới Thiệu

1. Khách hàng điều hướng đến Referrals page.
2. Hệ thống hiển thị:
   - **Referral code** (duy nhất, immubảng, [BR-54]).
   - **Referral link** (e.g., `https://astral.cloud/register?ref=CODE123`).
   - **Total referrals** (count of Referral records where this user is the referrer).
   - **Total credits earned** (sum of `referrerCredit` where `status = CREDITED`).
   - **Available for payout** (accumulated credits that have met ngưỡng, [BR-56]).
   - **Payout threshold** (configurable, mặc định $50, [BR-56]).

### Xem Lịch Sử Giới Thiệu

1. Customer xem referral history bảng on the Referrals page.
2. Hệ thống truy vấn tất cả `Referral` records where this user is the referrer.
3. Hệ thống hiển thị for each:
   - **Referee username** (anonymized partial — e.g., "john***").
   - **Date referred**.
   - **Status** (PENDING, CREDITED, PAID_OUT).
   - **Credit earned** ($ amount).

### Chia Sẻ Liên Kết Giới Thiệu

1. Khách hàng nhấp vào **Copy Link** to copy the referral link to clipboard.
2. System provides share buttons for social media / email with pre-populated text (tùy chọn).

## Luồng Thay Thế

### 17a — Yêu Cầu Thanh Toán
- Khách hàng nhấp vào **Yêu Cầu Thanh Toán** when accumulated credits reach the payout threshold ([BR-56]).
- Hệ thống tạo một `ReferralPayout` record.
- If người dùng has a withdrawal method configured, the payout is processed.
- If below threshold, nút is bị vô hiệu hóa with text: "Minimum $50.00 bắt buộc for payout."

## Luồng Ngoại Lệ

### EX-17-1 — Payout Below Threshold
- Hệ thống hiển thị: "You need at least $50.00 in referral credits to request a payout." ([BR-56])

---

# UC-18: Thông Báo

| Attribute                 | Value                                                                               |
|---------------------------|-------------------------------------------------------------------------------------|
| UC ID                     | UC-18                                                                               |
| UC Name                   | Thông Báo                                                                       |
| Actor(s)                  | Khách hàng (đã xác thực)                                                            |
| Priority                  | Low                                                                                 |
| Trigger                   | Khách hàng nhấp vào biểu tượng chuông thông báo or điều hướng đến Notification Center      |
| Pre-conditions            | Khách hàng đã đăng nhập (JWT hợp lệ).                                                  |
| Post-conditions (success) | Thông Báo displayed, marked read, or preferences updated.                       |
| Post-conditions (failure) | Lỗi hiển thị.                                                                    |
| Business Rules            | BR-58, BR-59                                                                        |
| Related UCs               | UC-01 (tạo server), UC-03 (đăng nhập), UC-10 (ví), UC-12 (tickets)               |

## Luồng Chính

### Xem Trung Tâm Thông Báo

1. Khách hàng nhấp vào biểu tượng chuông thông báo in the header.
2. Hệ thống truy vấn most recent 20 `Notification` records for khách hàng, ordered by `createdAt` descending.
3. Hệ thống hiển thị một danh sách thả xuống/popover with:
   - Unread count badge on the bell icon.
   - List of notifications with: title, body, time ago, read/unread indicator.
4. Khách hàng có thể nhấp "View All" to navigate to the full Notification Center page.

### Đánh Dấu Đã Đọc

1. Customer hovers or nhấp vào an unread notification.
2. Hệ thống cập nhật `isRead = true`.
3. (Optionally) navigating to a được liên kết page auto-marks thông báo as read.

### Đánh Dấu Tất Cả Đã Đọc

1. Khách hàng nhấp vào **Mark All as Read**.
2. Hệ thống cập nhật all unread notifications cho khách hàng này to `isRead = true`.

### Cấu Hình Tùy Chọn Thông Báo

1. Khách hàng điều hướng đến Profile > Notification Preferences.
2. Hệ thống hiển thị current `NotificationPreference` settings:
   - **Email**: Server Created, Server Deleted, Payment Failure, Ticket Updates, Marketing.
   - **In-App Push**: Server Created, Ticket Updates.
3. Customer bật each channel on/off.
4. Payment Failure notifications cannot be fully bị vô hiệu hóa (critical per [BR-59]); nút bật/tắt is locked in the ON position.
5. Khách hàng nhấp vào **Lưu**.
6. Hệ thống cập nhật `NotificationPreference` record.

## Luồng Ngoại Lệ

### EX-18-1 — Critical Notification Opt-Out Attempted
- Hệ thống hiển thị: "Payment failure notifications cannot be bị vô hiệu hóa." ([BR-59])

---

# UC-19: Quản Lý Hồ Sơ

| Attribute                 | Value                                                                               |
|---------------------------|-------------------------------------------------------------------------------------|
| UC ID                     | UC-19                                                                               |
| UC Name                   | Quản Lý Hồ Sơ                                                                      |
| Actor(s)                  | Khách hàng, Staff, Admin (đã xác thực)                                              |
| Priority                  | Medium                                                                              |
| Trigger                   | Người dùng điều hướng đến Profile / Account Settings                                        |
| Pre-conditions            | Người dùng đã đăng nhập (JWT hợp lệ).                                                      |
| Post-conditions (success) | Hồ sơ được cập nhật, phiên được quản lý.                                                  |
| Post-conditions (failure) | Không có thay đổi trạng thái. Lỗi hiển thị.                                                   |
| Business Rules            | BR-21, BR-22, BR-25, BR-60, BR-61                                                  |
| Related UCs               | UC-02 (đăng ký), UC-03 (đăng nhập), UC-08 (bật 2FA), UC-09 (manage API keys)        |

## Luồng Chính

### Cập Nhật Hồ Sơ

1. Người dùng điều hướng đến Profile > Account Settings.
2. Người dùng có thể sửa đổi:
   - **Username** (phải là duy nhất, [BR-21])
   - **Email** (phải là duy nhất, [BR-21])
   - **Billing address** (line1, line2, city, state, postal, country)
3. If changing email, system gửi một verification email to the new address. Old email remains đang hoạt động until verification completes.
4. Hệ thống xác thực:
   - Username không already taken by another user.
   - Email không already registered to another user.
5. Hệ thống cập nhật `User` record.
6. Hệ thống ghi một audit log entry.

### Đổi Mật Khẩu

1. Người dùng điều hướng đến Profile > Security > Change Password.
2. Người dùng nhập:
   - **Current password**
   - **New password** ([BR-22])
   - **Confirm new password**
3. Hệ thống xác thực current password against the stored hash.
4. Hệ thống xác thực new password meets complexity requirements.
5. If 2FA is được bật, system prompts for a TOTP code.
6. Hệ thống cập nhật password hash.
7. System invalidates all existing sessions (forces re-login on all devices).
8. Hệ thống ghi một audit log entry.

### Xem Phiên Đang Hoạt Động

1. Người dùng điều hướng đến Profile > Security > Active Sessions.
2. Hệ thống truy vấn tất cả đang hoạt động `Session` records for this user ([BR-25]).
3. Hệ thống hiển thị:
   - **IP Address**
   - **User Agent** (browser/OS)
   - **Created date**
   - **Expires date**
   - **Current session** indicator

### Thu Hồi Phiên

1. Người dùng nhấp vào **Revoke** on a session (not the current one).
2. Hệ thống xóa `Session` record.
3. That session's refresh token is immediately không hợp lệ.
4. Hệ thống xác nhận: "Session revoked."

### Thu Hồi Tất Cả Phiên Khác

1. Người dùng nhấp vào **Sign Out All Other Devices**.
2. Hệ thống xóa all `Session` records except the current one.
3. Hệ thống xác nhận: "All other sessions have been signed out."

## Luồng Ngoại Lệ

### EX-19-1 — Username Already Taken
- Hệ thống đánh dấu trường username: "This username is already in use." ([BR-21])

### EX-19-2 — Email Already Registered
- Hệ thống đánh dấu trường email: "This email is already registered to another account." ([BR-21])

### EX-19-3 — Current Password Incorrect
- Hệ thống hiển thị: "Current password is incorrect."

### EX-19-4 — Password Too Weak
- Hệ thống hiển thị password complexity requirements ([BR-22]).

---

# UC-20: Admin — Quản Lý Cơ Sở Hạ Tầng

| Attribute                 | Value                                                                                         |
|---------------------------|-----------------------------------------------------------------------------------------------|
| UC ID                     | UC-20                                                                                         |
| UC Name                   | Admin — Quản Lý Cơ Sở Hạ Tầng                                                                |
| Actor(s)                  | Admin (đã xác thực, role = ADMIN)                                                           |
| Priority                  | High                                                                                          |
| Trigger                   | Admin điều hướng đến Admin Panel > Infrastructure                                               |
| Pre-conditions            | Admin đã đăng nhập. 2FA phải được bật ([BR-24]).                                            |
| Post-conditions (success) | Tài nguyên cơ sở hạ tầng được tạo, cập nhật hoặc vô hiệu hóa. Audit log được ghi.                 |
| Post-conditions (failure) | Không có thay đổi trạng thái. Lỗi hiển thị.                                                             |
| Business Rules            | BR-05, BR-08, BR-09, BR-10, BR-20, BR-24, BR-68, BR-69, BR-70                                |
| Related UCs               | UC-01 (tạo server), UC-21 (quản lý voucher), UC-24 (quản lý nền tảng)                    |

## Luồng Chính

### Quản Lý ServerPlan

1. Admin điều hướng đến Admin > Infrastructure > Server Plans.
2. Hệ thống hiển thị một bảng of all ServerPlans with columns: name, slug, vCPU, RAM, disk, bandwidth, monthly price, hourly price, đang hoạt động status, regions.
3. Admin can:
   - **Create**: Enter plan details (name, slug, vCPU, RAM, disk, bandwidth, prices, maxServers). Associate with regions.
   - **Edit**: Modify plan details or region associations.
   - **Deactivate**: Soft-disable a plan (`isActive = false`). Active servers on this plan are not affected but no new servers can use it.
4. Hệ thống xác thực: disk ≥ 5 GB ([BR-10]), RAM ≥ 256 MB, vCPU ≥ 1.
5. Hệ thống ghi một audit log entry for each create/edit/deactivate ([BR-20]).

### Quản Lý ImageTemplate

1. Admin điều hướng đến Admin > Infrastructure > Image Templates.
2. Hệ thống hiển thị một bảng of all ImageTemplates: name, slug, OS type, version, Docker image, disk size, đang hoạt động status, regions.
3. Admin can:
   - **Create**: Enter image details (name, slug, OS type, version, `dockerImage` registry path, disk size). Associate with regions.
   - **Edit**: Modify image details or region associations.
   - **Deactivate**: Soft-disable an image (`isActive = false`).
4. Hệ thống xác thực: image disk size is within reasonable bounds.
5. Hệ thống ghi một audit log entry ([BR-20]).

### Quản Lý Node (Máy Chủ Docker)

1. Admin điều hướng đến Admin > Infrastructure > Nodes.
2. Hệ thống hiển thị một bảng of all Nodes: name, region, status, Docker endpoint, total vs allocated resources (vCPU, RAM, disk), last heartbeat, health.
3. Admin can:
   - **Create**: Enter node details (name, region, Docker endpoint, total vCPU/RAM/disk capacity).
   - **Edit**: Modify node details or capacity. Editing capacity triggers a validation that total ≥ allocated ([BR-05]).
   - **Change Status**: Set node to ONLINE, OFFLINE, or MAINTENANCE ([BR-68]).
     - **MAINTENANCE**: Node continues running existing servers but rejects new deployments ([BR-69]).
     - **OFFLINE**: Node is removed from scheduling entirely.
   - **Delete**: Remove a node from hệ thống. Prevented if node has đang hoạt động servers.
4. Hệ thống hiển thị resource utilization percentage for each node.
5. Hệ thống ghi một audit log entry for each config change ([BR-20]).

### Quản Lý Region

1. Admin điều hướng đến Admin > Infrastructure > Regions.
2. Hệ thống hiển thị một bảng of all Regions: name, slug, đang hoạt động status.
3. Admin can:
   - **Create**: Enter name and slug.
   - **Edit**: Modify name or slug.
   - **Deactivate**: Soft-disable a region (`isActive = false`).
4. Hệ thống ghi một audit log entry ([BR-20]).

## Luồng Thay Thế

### 20a — Giám Sát Tình Trạng Node
- Every 60 seconds, the cron job checks each ONLINE node's Docker daemon health ([BR-70]).
- Three consecutive failures → automatic status change to OFFLINE + admin alert.
- Heartbeat timestamp (`lastHeartbeatAt`) is updated on each thành công check.

### 20b — Thao Tác Hàng Loạt
- Admin có thể thực hiện hàng loạt-deactivate multiple ServerPlans or ImageTemplates.

## Luồng Ngoại Lệ

### EX-20-1 — Capacity Violation
- Admin attempts to reduce a node's total capacity below currently allocated resources.
- Hệ thống hiển thị: "Cannot reduce capacity below current allocation. Current allocation: vCPU X, RAM Y MB, Disk Z GB." ([BR-05])

### EX-20-2 — Node Delete Blocked
- Admin attempts to delete a node that has đang hoạt động servers.
- Hệ thống hiển thị: "Cannot delete node with đang hoạt động servers. Migrate or delete all servers on this node first."

---

# UC-21: Admin/Staff — Manage Vouchers

| Attribute                 | Value                                                                               |
|---------------------------|-------------------------------------------------------------------------------------|
| UC ID                     | UC-21                                                                               |
| UC Name                   | Quản Lý Voucher (Admin / Staff)                                                     |
| Actor(s)                  | Admin, Staff (đã xác thực, role = STAFF hoặc ADMIN)                                 |
| Priority                  | Medium                                                                              |
| Trigger                   | Staff điều hướng đến Admin > Vouchers                                                 |
| Pre-conditions            | Người dùng đã đăng nhập với vai trò STAFF hoặc ADMIN.                                                |
| Post-conditions (success) | Voucher được tạo, vô hiệu hóa hoặc thống kê được xem. Audit log được ghi.              |
| Post-conditions (failure) | Không có thay đổi trạng thái. Lỗi hiển thị.                                                   |
| Business Rules            | BR-33, BR-34, BR-35, BR-36, BR-37, BR-38, BR-20                                     |
| Related UCs               | UC-11 (áp dụng voucher)                                                               |

## Luồng Chính

### Xem Voucher

1. Staff điều hướng đến Admin > Vouchers.
2. Hệ thống hiển thị một bảng of all vouchers:
   - **Code**
   - **Description**
   - **Type** (PERCENTAGE / FIXED_AMOUNT)
   - **Value**
   - **Uses** (current / max)
   - **Validity** (from – until)
   - **Status** (đang hoạt động / inđang hoạt động)
   - **Created by**
   - **Created date**

### Tạo Voucher

1. Staff nhấp vào **Tạo Voucher**.
2. Staff điền vào:
   - **Code** (duy nhất, case-insensitive, [BR-33])
   - **Description** (e.g., "Launch Week 20% Off")
   - **Discount Type** (PERCENTAGE or FIXED_AMOUNT)
   - **Discount Value**
   - **Max Uses** (tùy chọn — null = unlimited, [BR-35])
   - **Max Uses Per User** (mặc định: 1, [BR-36])
   - **Minimum Spend** (tùy chọn, [BR-37])
   - **Valid From** (tùy chọn, [BR-34])
   - **Valid Until** (tùy chọn, [BR-34])
   - **Is Active** (mặc định: true)
3. Staff nhấp vào **Create**.
4. Hệ thống xác thực:
   - Code không already in use (case-insensitive check).
   - Discount value is hợp lệ (percentage 1–100, fixed > 0).
   - `validFrom < validUntil` if both are set.
5. Hệ thống tạo `Voucher` record.
6. Hệ thống ghi một audit log entry ([BR-20]).

### Xem Thống Kê Voucher

1. Staff nhấp vào on a voucher to view details.
2. Hệ thống hiển thị:
   - **Total redemptions** (currentUses).
   - **Total discount given** (sum of VoucherUsage.discountAmount).
   - **Redemption history** (list of VoucherUsage records with user, payment, date, amount).
   - **Remaining uses** (maxUses - currentUses, if limited).

### Vô Hiệu Hóa Voucher

1. Staff nhấp vào **Deactivate** on an đang hoạt động voucher.
2. Hệ thống xác nhận: "Deactivate voucher 'CODE'? Future redemptions will be rejected."
3. Staff xác nhận.
4. Hệ thống đặt `isActive = false`.
5. Hệ thống ghi một audit log entry ([BR-20]).

## Luồng Ngoại Lệ

### EX-21-1 — Duplicate Code
- Hệ thống hiển thị: "A voucher with this code already exists." ([BR-33])

### EX-21-2 — Invalid Discount Value
- PERCENTAGE: "Percentage phải là between 1 and 100."
- FIXED_AMOUNT: "Amount phải là greater than 0."

### EX-21-3 — Invalid Validity Dates
- Hệ thống hiển thị: "Valid until date phải là after hợp lệ from date."

---

# UC-22: Staff — Quản Lý Ticket

| Attribute                 | Value                                                                               |
|---------------------------|-------------------------------------------------------------------------------------|
| UC ID                     | UC-22                                                                               |
| UC Name                   | Staff — Quản Lý Ticket                                                              |
| Actor(s)                  | Staff, Admin (đã xác thực, role = STAFF hoặc ADMIN)                                 |
| Priority                  | Medium                                                                              |
| Trigger                   | Staff điều hướng đến Support > Ticket Queue                                           |
| Pre-conditions            | Người dùng đã đăng nhập với vai trò STAFF hoặc ADMIN.                                                |
| Post-conditions (success) | Ticket được quản lý (gán, trả lời, thay đổi trạng thái, thêm ghi chú nội bộ).          |
| Post-conditions (failure) | Không có thay đổi trạng thái. Lỗi hiển thị.                                                   |
| Business Rules            | BR-39, BR-40, BR-41, BR-42                                                          |
| Related UCs               | UC-12 (customer support tickets)                                                    |

## Luồng Chính

### Xem Hàng Đợi Ticket

1. Staff điều hướng đến Support > Ticket Queue.
2. Hệ thống hiển thị mộtll tickets, filterable by:
   - **Status** (OPEN, IN_PROGRESS, WAITING_ON_CUSTOMER, RESOLVED, CLOSED)
   - **Priority** (LOW, NORMAL, HIGH, URGENT)
   - **Category** (GENERAL, BILLING, TECHNICAL, ABUSE)
   - **Assignee** (chưa gán, specific staff member)
3. Hệ thống hiển thị:
   - **Ticket #**, subject, customer, status, priority, category, assignee, last updated.

### Gán Ticket

1. Staff nhấp vào **Assign to Me** on an chưa gán ticket.
2. Hệ thống cập nhật `assignedUserId` thành ID của thành viên staff.
3. Hệ thống cập nhật trạng thái thành `IN_PROGRESS` nếu hiện tại là `OPEN`.
4. Hệ thống ghi ghi chú nội bộ: "Ticket được gán cho [tên staff]."

### Trả Lời Ticket

1. Staff mở trang chi tiết ticket.
2. Staff xem toàn bộ luồng bao gồm tin nhắn của khách hàng.
3. Staff nhập câu trả lời vào hộp tin nhắn.
4. Staff có thể bật/tắt (tùy chọn) **Internal Note** để làm tin nhắn chỉ hiển thị với staff (không hiển thị cho khách hàng).
5. Staff nhấp vào **Gửi**.
6. Hệ thống tạo bản ghi `TicketMessage` với `isInternal = true/false`.
7. Hệ thống cập nhật `Ticket.updatedAt`.
8. Hệ thống thông báo cho khách hàng (đối với tin nhắn không phải nội bộ).

### Thay Đổi Trạng Thái Ticket

1. Staff xem một ticket.
2. Staff chọn trạng thái mới từ danh sách thả xuống (chuyển đổi hợp lệ theo [BR-40]):
   - OPEN → IN_PROGRESS
   - IN_PROGRESS → WAITING_ON_CUSTOMER
   - IN_PROGRESS → RESOLVED
   - WAITING_ON_CUSTOMER → IN_PROGRESS
3. Hệ thống ghi ghi chú nội bộ với lý do thay đổi trạng thái (tùy chọn).
4. Hệ thống thông báo cho khách hàng về thay đổi trạng thái.

### Thêm Ghi Chú Nội Bộ

1. Staff mở một ticket, nhập tin nhắn và bật "Ghi Chú Nội Bộ."
2. Hệ thống tạo `TicketMessage` với `isInternal = true`.
3. Ghi chú chỉ hiển thị với người dùng STAFF/ADMIN.

## Luồng Thay Thế

### 22a — Gán Hàng Loạt
- Staff có thể chọn nhiều ticket và gán cho một thành viên staff.

### 22b — Nâng Mức Ưu Tiên
- Staff có thể thay đổi ưu tiên của ticket (LOW → NORMAL → HIGH → URGENT).

### 22c — Tìm Kiếm Ticket
- Staff tìm kiếm ticket theo username, email của khách hàng, chủ đề ticket hoặc số ticket.

## Luồng Ngoại Lệ

### EX-22-1 — Invalid Status Transition
- Hệ thống hiển thị: "Không thể chuyển từ [current] to [new]." ([BR-40])

---

# UC-23: Staff — Manage Blog

| Attribute                 | Value                                                                               |
|---------------------------|-------------------------------------------------------------------------------------|
| UC ID                     | UC-23                                                                               |
| UC Name                   | Quản Lý Blog (Staff / Admin)                                                         |
| Actor(s)                  | Staff, Admin (đã xác thực, role = STAFF hoặc ADMIN)                                 |
| Priority                  | Low                                                                                 |
| Trigger                   | Staff điều hướng đến Blog > Manage Posts                                              |
| Pre-conditions            | Người dùng đã đăng nhập với vai trò STAFF hoặc ADMIN.                                                |
| Post-conditions (success) | Bài viết blog hoặc danh mục được tạo, chỉnh sửa hoặc xuất bản. Audit log được ghi.             |
| Post-conditions (failure) | Không có thay đổi trạng thái. Lỗi hiển thị.                                                   |
| Business Rules            | BR-43, BR-44, BR-45, BR-20                                                          |
| Related UCs               | UC-16 (read blog)                                                                   |

## Luồng Chính

### Quản Lý Bài Viết Blog

1. Staff điều hướng đến Blog > Manage Posts.
2. Hệ thống hiển thị mộtll blog posts regardless of status, ordered by `updatedAt` descending:
   - **Title**, slug, category, author, status badge (DRAFT/PUBLISHED/ARCHIVED), published date, updated date.
3. Staff can:
   - **Create**: Navigate to post editor.
   - **Edit**: Open existing post in editor.
   - **Publish/Unpublish/Archive**: Change status per [BR-43].
   - **Delete**: Soft-delete a post (archive first).

### Tạo / Chỉnh Sửa Bài Viết Blog

1. Staff điền vào the post form:
   - **Title** (bắt buộc)
   - **Slug** (auto-generated from title, edibảng, [BR-44])
   - **Category** (danh sách thả xuống, [BR-45] requires STAFF/ADMIN author)
   - **Excerpt** (tùy chọn, summary for cards)
   - **Body** (Markdown, bắt buộc)
   - **Cover Image** (tùy chọn, file upload)
   - **Tags** (comma-separated or chip input)
   - **Status** (DRAFT, PUBLISHED, ARCHIVED, [BR-43])
2. Staff nhấp vào **Save Draft** (status = DRAFT) or **Publish** (status = PUBLISHED).
3. On publish:
   - Hệ thống đặt `publishedAt` to now (if first publish).
   - Hệ thống đặt `authorId` to the current user (bắt buộc; phải là STAFF or ADMIN).
4. System saves the blog post.
5. Hệ thống ghi một audit log entry ([BR-20]).

### Quản Lý Danh Mục Blog

1. Staff điều hướng đến Blog > Categories.
2. Hệ thống hiển thị mộtll categories: name, slug, description.
3. Staff can:
   - **Create**: Enter name, slug, tùy chọn description.
   - **Edit**: Modify name, slug, description.
   - **Delete**: Remove category (only if no posts belong to it).

## Luồng Ngoại Lệ

### EX-23-1 — Duplicate Slug
- Hệ thống hiển thị: "A post with this slug already exists. Please choose a different slug." ([BR-44])

### EX-23-2 — Category Has Posts
- Staff tries to delete a category that has posts.
- Hệ thống hiển thị: "Cannot delete a category that contains blog posts. Reassign the posts first."

### EX-23-3 — Invalid Author
- Hệ thống thực thi that the author phải là STAFF or ADMIN ([BR-45]). If a CUSTOMER somehow reaches this page, the publish action is rejected.

---

# UC-24: Admin — Quản Lý Nền Tảng

| Attribute                 | Value                                                                               |
|---------------------------|-------------------------------------------------------------------------------------|
| UC ID                     | UC-24                                                                               |
| UC Name                   | Admin — Quản Lý Nền Tảng                                                         |
| Actor(s)                  | Admin (đã xác thực, role = ADMIN)                                                 |
| Priority                  | High                                                                                |
| Trigger                   | Admin điều hướng đến various Admin sections                                           |
| Pre-conditions            | Admin đã đăng nhập. 2FA phải được bật ([BR-24]).                                  |
| Post-conditions (success) | Cấu hình nền tảng được cập nhật. Audit log được ghi.                                  |
| Post-conditions (failure) | Không có thay đổi trạng thái. Lỗi hiển thị.                                                   |
| Business Rules            | BR-20, BR-61, BR-66, BR-67                                                          |
| Related UCs               | UC-20 (manage infrastructure), UC-21 (quản lý voucher), UC-25 (yêu cầu GDPR)       |

## Luồng Chính

### Quản Lý Người Dùng

1. Admin điều hướng đến Admin > Users.
2. Hệ thống hiển thị một paginated bảng of all users with filters for role, status, and search.
3. Columns: Username, email, role, status, server count, balance, registration date.
4. Admin can:
   - **View detail**: Xem hồ sơ người dùng, server, ticket, thanh toán.
   - **Change role**: CUSTOMER ↔ STAFF ↔ ADMIN.
   - **Change status**: ACTIVE, LOCKED, SUSPENDED.
   - **Unlock account**: Đặt lại `failedLoginAttempts` và `lockedUntil`.
   - **Set tax-exempt**: Bật/tắt cờ `taxExempt` ([BR-61]).
5. Hệ thống ghi audit log for each change ([BR-20]).

### Quản Lý Cài Đặt Hệ Thống

1. Admin điều hướng đến Admin > Settings.
2. Hệ thống hiển thị mộtll `SystemSetting` records grouped by category.
3. Each setting shows: key, label, description, current value, type (STRING, NUMBER, BOOLEAN, JSON).
4. Admin can:
   - **Edit**: Modify giá trị with type-specific input validation ([BR-66]).
   - **View immubảng**: Settings marked `isImmubảng = true` are chỉ đọc in giao diện người dùng ([BR-67]).
5. Hệ thống xác thực value against the declared type ([BR-66]).
6. Hệ thống ghi một audit log entry ([BR-20]).

### Quản Lý Mẫu Email

1. Admin điều hướng đến Admin > Email Templates.
2. Hệ thống hiển thị mộtll `EmailTemplate` records: code, name, subject (truncated), đang hoạt động status.
3. Admin can:
   - **Edit**: Open a template editor with subject, HTML body, text body, có sẵn variables list.
   - **Preview**: Kết xuất mẫu với dữ liệu mẫu.
   - **Deactivate**: Đặt `isActive = false`.
4. Hệ thống ghi một audit log entry ([BR-20]).

### Quản Lý Thuế Suất

1. Admin điều hướng đến Admin > Tax Rates.
2. Hệ thống hiển thị mộtll `TaxRate` records: region, name, rate, đang hoạt động status.
3. Admin can:
   - **Create**: Liên kết thuế suất với region.
   - **Edit**: Sửa đổi tên, phần trăm thuế suất.
   - **Deactivate**: Đặt `isActive = false`.
4. Hệ thống ghi một audit log entry ([BR-20]).

### Quản Lý Thông Báo

1. Admin điều hướng đến Admin > Announcements.
2. Hệ thống hiển thị mộtll announcements: title, severity (INFO/WARNING/CRITICAL), đang hoạt động status, scheduled dates.
3. Admin can:
   - **Create**: Enter title, body (Markdown), severity, tùy chọn startsAt/endsAt schedule.
   - **Edit**: Sửa đổi chi tiết thông báo.
   - **Deactivate**: Đặt `isActive = false`.
   - **Delete**: Xóa thông báo.
4. Active announcements are displayed to all users on bảng điều khiển/landing page.

### Xem Audit Log

1. Admin điều hướng đến Admin > Audit Logs.
2. Hệ thống hiển thị một paginated, filterable view of all `AuditLog` entries.
3. Filters: user, action type, target type, result (SUCCESS/FAILURE), date range.
4. Columns: timestamp, user, action, target type/ID, result, IP address.
5. Entries are chỉ đọc, immubảng.

### Giám Sát Hàng Đợi Job

1. Admin điều hướng đến Admin > Job Queue.
2. Hệ thống hiển thị BullMQ queue statistics:
   - **Active jobs** count.
   - **Waiting jobs** count.
   - **Completed jobs** count.
   - **Failed jobs** count.
   - **Dead-letter jobs** count (requires admin investigation).
3. Admin can:
   - **View dead-letter queue**: List jobs that exhausted all retries with error details, metadata, timestamps.
   - **Retry a dead-lettered job**: Manually re-enqueue after investigation.
   - **Remove a job**: Permanently discard a job.

## Luồng Ngoại Lệ

### EX-24-1 — Invalid System Setting Value
- Hệ thống hiển thị: "Invalid value for type [TYPE]. Expected: [constraint]." ([BR-66])

### EX-24-2 — Immubảng Setting Edit Attempted
- The edit field is bị vô hiệu hóa with a tooltip: "This setting cannot be changed via giao diện người dùng." ([BR-67])

---

# UC-25: GDPR Requests

| Attribute                 | Value                                                                                     |
|---------------------------|-------------------------------------------------------------------------------------------|
| UC ID                     | UC-25                                                                                     |
| UC Name                   | Yêu Cầu GDPR (Xuất Dữ Liệu / Xóa Tài Khoản)                                            |
| Actor(s)                  | Khách hàng (người yêu cầu), Admin (người xử lý)                                                   |
| Priority                  | Medium                                                                                    |
| Trigger                   | Customer submits a data export or deletion request via Profile > Privacy                  |
| Pre-conditions            | Khách hàng đã đăng nhập. Customer has no đang hoạt động servers for deletion requests.              |
| Post-conditions (success) | Xuất: liên kết tải xuống được gửi qua email. Xóa: tài khoản và dữ liệu bị xóa, audit log được ẩn danh. |
| Post-conditions (failure) | Request rejected or thất bại. Lỗi được ghi log.                                                 |
| Business Rules            | BR-62, BR-63                                                                              |
| Related UCs               | UC-19 (quản lý hồ sơ), UC-24 (quản lý nền tảng)                                       |

## Luồng Chính

### Yêu Cầu Xuất Dữ Liệu

1. Khách hàng điều hướng đến Profile > Privacy.
2. Khách hàng nhấp vào **Request Data Export**.
3. Hệ thống hiển thị: "You will receive an email with a download link containing all your personal data."
4. Khách hàng nhấp vào **Xác Nhận**.
5. Hệ thống tạo một `GdprRequest` record with `type = EXPORT`, `status = PENDING`.
6. Hệ thống đưa một job vào hàng đợin export job to BullMQ.
7. Worker:
   - Gathers all customer data: User record, ServerInstance records, Ticket records, Payment history, Invoice records, Notification records, Session records, Referral records.
   - Generates a machine-readable JSON or CSV file ([BR-62]).
   - Uploads tệp to secure temporary storage.
   - Updates `GdprRequest.status = COMPLETED`, sets `downloadUrl` with an expiry.
   - Sends an email to khách hàng với download link.
8. The download link expires after 7 days; after expiry, tệp is deleted.

### Yêu Cầu Xóa Tài Khoản

1. Khách hàng điều hướng đến Profile > Privacy.
2. Khách hàng nhấp vào **Request Account Deletion**.
3. Hệ thống xác thực:
   - Customer has no đang hoạt động servers. If they do, display: "You must delete all your servers before requesting account deletion. You have X đang hoạt động server(s)."
4. Hệ thống hiển thị một final warning: "This action is irreversible. All your data will be permanently deleted trong vòng 30 ngày."
5. Khách hàng nhậpir username and clicks **Confirm Deletion**.
6. Hệ thống tạo một `GdprRequest` record with `type = DELETE`, `status = PENDING`, `expiresAt = now + 30 days`.
7. Hệ thống khóa account (`status = SUSPENDED`).
8. Admin reviews yêu cầu.
9. Admin approves and initiates the deletion process.
10. System:
    - Deletes all personal data: User record, SSH keys, snapshots, tickets, notifications, sessions, API keys, payment methods ([BR-63]).
    - Anonymizes audit logs: sets `userId = null`, truncates `ipAddress` to /24 prefix ([BR-63]).
    - Retains invoice records (legal requirement) but anonymizes người dùng reference.
    - Updates `GdprRequest.status = COMPLETED`, `completedAt`.
11. Hệ thống gửi một final confirmation email.

### Admin Xử Lý Yêu Cầu GDPR

1. Admin điều hướng đến Admin > GDPR Requests.
2. Hệ thống hiển thị mộtll `GdprRequest` records: user, type, status, created date, expiry.
3. Admin can:
   - **View detail**: See yêu cầu and associated user data summary.
   - **Approve export**: Triggers the export job.
   - **Approve deletion**: Initiates the deletion process.
   - **Reject**: Provides a reason (e.g., legal hold, đang hoạt động services).
4. Hệ thống ghi một audit log entry for each admin action ([BR-20]).

## Luồng Ngoại Lệ

### EX-25-1 — Active Servers (Deletion Blocked)
- Hệ thống hiển thị: "You have X đang hoạt động server(s). Please delete all servers before requesting account deletion." ([BR-63])

### EX-25-2 — Request Already Pending
- Hệ thống hiển thị: "You already have a đang chờ [export/deletion] request. It will be processed soon."

### EX-25-3 — Export Generation Failed
- Hệ thống cập nhật `GdprRequest.status = FAILED`.
- Admin được thông báo. Khách hàng được thông báo để thử lại.

---

# UC-26: Quản Lý Thẻ (Tag)

| Attribute                 | Value                                                                               |
|---------------------------|-------------------------------------------------------------------------------------|
| UC ID                     | UC-26                                                                               |
| UC Name                   | Quản Lý Thẻ (Tag)                                                                         |
| Actor(s)                  | Khách hàng (đã xác thực)                                                            |
| Priority                  | Low                                                                                 |
| Trigger                   | Khách hàng điều hướng đến Tags management page or server detail page                  |
| Pre-conditions            | Khách hàng đã đăng nhập (JWT hợp lệ).                                                  |
| Post-conditions (success) | Thẻ được tạo, chỉnh sửa, xóa hoặc gán/xóa khỏi server.                  |
| Post-conditions (failure) | Không có thay đổi trạng thái. Lỗi hiển thị.                                                   |
| Business Rules            | None specific                                                                       |
| Related UCs               | UC-01 (tạo server), UC-04 (danh sách server)                                         |

## Luồng Chính

### Liệt Kê Thẻ

1. Khách hàng điều hướng đến Tags management page (or sees their tag collection in danh sách server sidebar).
2. Hệ thống truy vấn tất cả `VpsTag` records belonging to khách hàng.
3. Hệ thống hiển thị each tag with:
   - **Name**
   - **Color** (hex color swatch)
   - **Server count** (how many servers have this tag được gán)
   - **Actions**: Edit, Delete

### Tạo Thẻ

1. Khách hàng nhấp vào **Tạo Thẻ**.
2. Khách hàng nhập:
   - **Name** (bắt buộc, max 32 characters)
   - **Color** (tùy chọn, color picker or hex input, e.g., "#FF5733")
3. Khách hàng nhấp vào **Lưu**.
4. Hệ thống xác thực:
   - Tag name không empty.
   - Tag name is duy nhất cho khách hàng này (same tag name can exist for different customers).
5. Hệ thống tạo một `VpsTag` record.

### Chỉnh Sửa Thẻ

1. Khách hàng nhấp vào **Edit** on a tag.
2. Customer modifies the name or color.
3. Khách hàng nhấp vào **Lưu**.
4. Hệ thống xác thực name duy nhấtness.
5. Hệ thống cập nhật `VpsTag` record.

### Xóa Thẻ

1. Khách hàng nhấp vào **Delete** on a tag.
2. Hệ thống nhắc: "Remove tag '[name]'? It will be removed from all servers."
3. Khách hàng xác nhận.
4. Hệ thống xóa all `ServerTag` join records cho thẻ này.
5. Hệ thống xóa `VpsTag` record.

### Gán Thẻ Cho Server

1. Khách hàng điều hướng đến server's detail page or selects server in bảng điều khiển.
2. Customer opens thẻ assignment danh sách thả xuống/menu.
3. Khách hàng chọn an existing tag from danh sách (or tạo một new one inline).
4. Hệ thống tạo một `ServerTag` join record linking server and tag.
5. The tag appears as a colored chip on server card/row.

### Xóa Thẻ Khỏi Server

1. Khách hàng nhấp vào the **×** on a tag chip on server.
2. Hệ thống xóa `ServerTag` join record.
3. The tag chip is removed (thẻ itself still exists for use on other servers).

## Luồng Thay Thế

### 26a — Tạo Thẻ Trực Tiếp
- During tag assignment, if the desired tag does not exist, customer can type a new name and color inline to create and assign in one step.

### 26b — Gán Thẻ Hàng Loạt
- Khách hàng chọn multiple servers in bảng điều khiển (hộp kiểm).
- Customer opens the bulk action menu and selects "Assign Tag."
- Hệ thống tạo `ServerTag` records for all selected servers.

## Luồng Ngoại Lệ

### EX-26-1 — Duplicate Tag Name
- Hệ thống hiển thị: "You already have a tag with this name." (Unique per customer.)

### EX-26-2 — Invalid Color
- Hệ thống hiển thị: "Please enter a hợp lệ hex color code (e.g., #FF5733)."

---

# Recovery Sequence Diagrams

## EX-07-3: Worker Crash Sau Khi Xóa Docker (Khôi Phục Trạng Thái Phân Tán)

```
Customer       Next.js        PostgreSQL      BullMQ        Worker        Docker
   |               |              |              |             |              |
   |  User stopped server earlier (Server.status = STOPPED)    |              |
   |               |              |              |             |              |
   |  DELETE /api/ |              |              |             |              |
   |  servers/:id  |              |              |             |              |
   |-------------->|              |              |             |              |
   |               |  VALIDATE: Server is       |             |              |
   |               |  STOPPED, belongs to       |             |              |
   |               |  this customer (BR-15)     |             |              |
   |               |─────────────>|              |             |              |
   |               |              |              |             |              |
   |               |  UPDATE Server:            |             |              |
   |               |  status=DELETING           |             |              |
   |               |─────────────>|              |             |              |
   |               |              |              |             |              |
   |               |  Enqueue delete job        |             |              |
   |               |───────────────────────────>|             |              |
   |               |              |              |             |              |
   |  200 OK       |              |              |             |              |
   |  (Server      |              |              |             |              |
   |   deleting)   |              |              |             |              |
   |<--------------|              |              |             |              |
   |               |              |              |             |              |
   |               |              |         Dequeue job        |              |
   |               |              |              |────────────>|              |
   |               |              |              |             |              |
   |               |              |  IDEMPOTENCY GUARD:        |              |
   |               |              |  GET /containers/{cId}/json|              |
   |               |              |              |             |─────────────>|
   |               |              |              |             |  container   |
   |               |              |              |             |  exists      |
   |               |              |              |             |<─────────────|
   |               |              |              |             |              |
   |               |              |  REMOVE container           |              |
   |               |              |  DELETE /containers/{cId}   |              |
   |               |              |  ?force=true                |              |
   |               |              |              |             |─────────────>|
   |               |              |              |             |  container   |
   |               |              |              |             |  removed     |
   |               |              |              |             |<─────────────|
   |               |              |              |             |              |
   |               |              |  REMOVE volume              |              |
   |               |              |  DELETE /volumes/{vol}      |              |
   |               |              |              |             |─────────────>|
   |               |              |              |             |  volume      |
   |               |              |              |             |  removed     |
   |               |              |              |             |<─────────────|
   |               |              |              |             |              |
   |               |              |    ╔══════════════════════╗ |              |
   |               |              |    ║  WORKER CRASHES      ║ |              |
   |               |              |    ║  (before DB sync)    ║ |              |
   |               |              |    ╚══════════════════════╝ |              |
   |               |              |              |             |              |
   |               |              |  BullMQ detects            |              |
   |               |              |  unacknowledged job        |              |
   |               |              |  → re-delivers             |              |
   |               |              |              |             |              |
   |               |              |  Re-deliver delete job     |              |
   |               |              |              |────────────>|              |
   |               |              |              |             |              |
   |               |              |  IDEMPOTENCY GUARD:        |              |
   |               |              |  GET /containers/{cId}/json|              |
   |               |              |              |             |─────────────>|
   |               |              |              |             |  CONTAINER   |
   |               |              |              |             |  NOT FOUND!  |
   |               |              |              |             |<─────────────|
   |               |              |              |             |              |
   |               |              |  SKIP container/volume     |              |
   |               |              |  removal → PROCEED to      |              |
   |               |              |  DB cleanup                |              |
   |               |              |              |             |              |
   |               |              |  UPDATE Node:              |              |
   |               |              |  allocatedCpu -= vcpu      |              |
   |               |              |  allocatedRamMB -= ramMB   |              |
   |               |              |  allocatedDiskGB -= diskGB |              |
   |               |              |─────────────>|             |              |
   |               |              |              |             |              |
   |               |              |  RELEASE IP back to pool   |              |
   |               |              |─────────────>|             |              |
   |               |              |              |             |              |
   |               |              |  DELETE backups            |              |
   |               |              |  (BR-18)    |              |              |
   |               |              |─────────────>|             |              |
   |               |              |              |             |              |
   |               |              |  UPDATE Server:            |              |
   |               |              |  deletedAt=NOW             |              |
   |               |              |  (soft-delete)             |              |
   |               |              |─────────────>|             |              |
   |               |              |              |             |              |
   |               |              |  INSERT AuditLog           |              |
   |               |              |  (note: "Container already |              |
   |               |              |   destroyed on retry")     |              |
   |               |              |─────────────>|             |              |
   |               |              |              |             |              |
   |               |              |  ✓ Resources released.     |              |
   |               |              |    DB state converged.     |              |
    |               |              |    No double-free.         |              |
```

---

# UC-27: Quản Lý Mạng Riêng

| Attribute                 | Value                                                                                         |
|---------------------------|-----------------------------------------------------------------------------------------------|
| UC ID                     | UC-27                                                                                         |
| UC Name                   | Quản Lý Mạng Riêng                                                                       |
| Actor(s)                  | Khách hàng (đã xác thực)                                                                      |
| Priority                  | Medium                                                                                        |
| Trigger                   | Khách hàng điều hướng đến Networking > Private Networks                                           |
| Pre-conditions            | Khách hàng đã đăng nhập (JWT hợp lệ).                                                            |
| Post-conditions (success) | Mạng riêng được tạo/xóa, server được gắn/gỡ với IP riêng được tự động gán.      |
| Post-conditions (failure) | Không có thay đổi trạng thái. Lỗi hiển thị.                                                             |
| Business Rules            | BR-71, BR-72, BR-73, BR-74, BR-17a, BR-19                                                     |
| Related UCs               | UC-01 (tạo server), UC-04 (danh sách server), UC-28 (quản lý floating IP)                      |

## Luồng Chính

### Liệt Kê Mạng Riêng

1. Khách hàng điều hướng đến Networking > Private Networks.
2. Hệ thống truy vấn tất cả bản ghi `PrivateNetwork` thuộc về khách hàng.
3. Hệ thống hiển thị một bảng:
   - **Name**
   - **Region** ([BR-71])
   - **CIDR Range** ([BR-72])
   - **Attached Servers** (count + hostname list)
   - **Created date**
   - **Actions**: View, Delete

### Tạo Mạng Riêng

1. Khách hàng nhấp vào **Create Private Network**.
2. Khách hàng điền vào:
   - **Name** (bắt buộc, duy nhất cho mỗi khách hàng).
   - **Region** (danh sách thả xuống, only regions được bật cho tài khoản này).
   - **CIDR Range** (danh sách thả xuống các khối không chồng lấn có sẵn do admin cấu hình, [BR-72]).
3. Khách hàng nhấp vào **Create**.
4. Hệ thống xác thực:
   - CIDR block nằm trong phạm vi có sẵn của region và không chồng lấn với bất kỳ mạng riêng hiện có nào trong region đó ([BR-72]).
   - Name is duy nhất cho khách hàng này.
5. Hệ thống tạo một `PrivateNetwork` record.
6. Hệ thống ghi một audit log entry ([BR-19]).

### Xem Chi Tiết Mạng Riêng

1. Khách hàng nhấp vào một private network from danh sách.
2. Hệ thống hiển thị:
   - **Network details**: name, region, CIDR, created date.
   - **Attached servers** bảng: hostname, private IP ([BR-74]), status, được gắn date, detach action.

### Gắn Server Vào Mạng Riêng

1. Từ trang chi tiết mạng riêng, khách hàng nhấp **Attach Server**.
2. Hệ thống hiển thị một danh sách thả xuống các server của khách hàng này trong cùng region chưa được gắn vào bất kỳ mạng riêng nào ([BR-73]).
3. Khách hàng chọn server and clicks **Gắn**.
4. Hệ thống xác thực:
   - Server is trong cùng region as the private network ([BR-71]).
   - Server không already được gắn to a private network ([BR-73]).
   - Server không bị khóa by another async operation — the `lockedBy` field is checked atomically ([BR-17a]).
5. System assigns a **private IP** from mạng's CIDR range ([BR-74]):
   - Finds the first có sẵn IP in the CIDR block.
   - Creates a `PrivateNetworkMember` record với được gán IP.
6. Hệ thống đưa một job vào hàng đợin attach job to BullMQ:
   - Worker tạo một virtual NIC on server's Docker container với được gán private IP.
7. Hệ thống trả về `202 Accepted`.
8. Worker completes the attach và cập nhật bản ghi.
9. Hệ thống ghi một audit log entry ([BR-19]).

### Gỡ Server Khỏi Mạng Riêng

1. Từ trang chi tiết mạng riêng, khách hàng nhấp **Gỡ** on server.
2. Hệ thống nhắc: "Detach [hostname] from this private network? Its private IP will be released."
3. Khách hàng xác nhận.
4. Hệ thống xác thực server không bị khóa ([BR-17a]).
5. Hệ thống đưa một job vào hàng đợi detach job to BullMQ:
   - Worker xóa virtual NIC from container.
6. System giải phóng private IP back to mạng's pool ([BR-74]).
7. Hệ thống xóa `PrivateNetworkMember` record.
8. Hệ thống ghi một audit log entry ([BR-19]).

### Xóa Mạng Riêng

1. Khách hàng nhấp vào **Delete** on a private network with zero được gắn servers.
2. Hệ thống nhắc: "Delete private network '[name]'? This action cannot be undone."
3. Khách hàng xác nhận.
4. Hệ thống xác thực no servers are still được gắn.
5. Hệ thống xóa `PrivateNetwork` record.
6. Hệ thống ghi một audit log entry ([BR-19]).

## Luồng Thay Thế

### 27a — Gắn Trực Tiếp Khi Tạo Server
- During UC-01 step 3 (region selection), if region has private networks owned by khách hàng, an tùy chọn "Attach to Private Network" danh sách thả xuống appears.
- System attaches server to the selected network during provisioning (parallel to step 13 of UC-01).

## Luồng Ngoại Lệ

### EX-27-1 — Server Already Attached
- Hệ thống hiển thị: "This server is already được gắn to a private network. Detach it first." ([BR-73])

### EX-27-2 — Region Mismatch
- Server is in a different region than the private network.
- Hệ thống hiển thị: "Server phải là trong cùng region as the private network." ([BR-71])

### EX-27-3 — Network Has Attached Servers (Delete Blocked)
- Hệ thống hiển thị: "Cannot delete a private network with được gắn servers. Detach all servers first."

### EX-27-4 — CIDR Conflict
- Hệ thống hiển thị: "This CIDR range overlaps with an existing private network in this region." ([BR-72])

### EX-27-5 — Server Locked
- Hệ thống trả về `409 CONFLICT` với đang hoạt động operation name. ([BR-17a])

### EX-27-6 — CIDR Exhausted
- No free private IPs remain in mạng's CIDR range.
- Hệ thống hiển thị: "No có sẵn IP addresses in this network's range. Contact support to expand the CIDR block."

---

# UC-28: Quản Lý Floating IP

| Attribute                 | Value                                                                                         |
|---------------------------|-----------------------------------------------------------------------------------------------|
| UC ID                     | UC-28                                                                                         |
| UC Name                   | Quản Lý Floating IP                                                                           |
| Actor(s)                  | Khách hàng (đã xác thực)                                                                      |
| Priority                  | Medium                                                                                        |
| Trigger                   | Khách hàng điều hướng đến Networking > Floating IPs                                               |
| Pre-conditions            | Khách hàng đã đăng nhập (JWT hợp lệ).                                                            |
| Post-conditions (success) | Floating IP được cấp phát, gán, gán lại hoặc giải phóng. Chuyển giao nguyên tử giữa các server.    |
| Post-conditions (failure) | Không có thay đổi trạng thái. Lỗi hiển thị.                                                             |
| Business Rules            | BR-75, BR-76, BR-77, BR-16a, BR-17a, BR-19                                                    |
| Related UCs               | UC-01 (tạo server), UC-04 (danh sách server), UC-27 (manage private networks)                  |

## Luồng Chính

### Liệt Kê Floating IP

1. Khách hàng điều hướng đến Networking > Floating IPs.
2. Hệ thống truy vấn tất cả `FloatingIp` records belonging to khách hàng.
3. Hệ thống hiển thị một bảng:
   - **IP Address**
   - **Region**
   - **Assigned Server** (hostname or "Unassigned")
   - **Assigned date**
   - **Created date**
   - **Actions**: Assign, Reassign, Release

### Cấp Phát Floating IP

1. Khách hàng nhấp vào **Allocate Floating IP**.
2. Khách hàng chọn a **region**.
3. Khách hàng nhấp vào **Allocate**.
4. Hệ thống xác thực region is có sẵn cho tài khoản này ([BR-09]).
5. System selects an có sẵn public IP from region's floating IP pool and allocates it atomically ([BR-16a], [BR-75]).
6. Hệ thống tạo một `FloatingIp` record with `assignedServerId = null`.
7. Hệ thống trả về allocated IP address.
8. Hệ thống ghi một audit log entry ([BR-19]).

### Gán Floating IP Cho Server

1. Khách hàng nhấp vào **Assign** on an chưa gán floating IP.
2. Hệ thống hiển thị một danh sách thả xuống of khách hàng's servers trong cùng region.
3. Khách hàng chọn server and clicks **Assign**.
4. Hệ thống xác thực:
   - Server is trong cùng region as the floating IP.
   - Server không bị khóa ([BR-17a]).
   - Floating IP không already được gán ([BR-75]).
5. Hệ thống thực hiện mộtn **atomic assignment**:
   - Conditional UPDATE on `FloatingIp` row: `WHERE id = :fipId AND assignedServerId IS NULL` → sets `assignedServerId`.
   - If no row updated (concurrent assignment), return `409 CONFLICT`.
6. Hệ thống đưa một job vào hàng đợi floating IP bind job to BullMQ:
   - Worker cấu hình floating IP as a secondary IP on server's network interface.
7. Hệ thống trả về `202 Accepted`.
8. Worker completes the bind và cập nhật bản ghi.
9. Hệ thống ghi một audit log entry ([BR-19]).

### Gán Lại Floating IP Giữa Các Server (Chuyển Giao Nguyên Tử)

1. Khách hàng nhấp vào **Reassign** on an được gán floating IP.
2. Hệ thống hiển thị một danh sách thả xuống of eligible servers trong cùng region (excluding the current server).
3. Khách hàng chọn the target server and clicks **Reassign**.
4. Hệ thống xác thực:
   - Target server is trong cùng region as the floating IP.
   - Neither source nor target server is locked ([BR-17a]).
5. Hệ thống thực hiện mộtn **atomic transfer** ([BR-76]):
   - Conditional UPDATE on `FloatingIp`: `WHERE id = :fipId AND assignedServerId = :oldServerId` → sets `assignedServerId = :newServerId`.
   - If no row updated, return `409 CONFLICT`.
   - The IP is never simultaneously được gán to both servers.
6. Hệ thống đưa một job vào hàng đợi transfer job to BullMQ:
   - Worker unbinds the floating IP từ old server's interface.
   - Worker gắn floating IP to the new server's interface.
   - The IP is never accessible from both servers simultaneously ([BR-76]).
7. Hệ thống trả về `202 Accepted`.
8. Hệ thống ghi một audit log entry ([BR-19]).

### Giải Phóng Floating IP

1. Khách hàng nhấp vào **Release** on a floating IP.
2. Hệ thống nhắc: "Release floating IP [address]? You will lose this IP and it will return to the public pool."
3. Khách hàng xác nhận.
4. Hệ thống xác thực được gán server không bị khóa ([BR-17a]).
5. Hệ thống đưa một job vào hàng đợi release job to BullMQ:
   - Worker unbinds the floating IP from server (if được gán).
   - Worker returns IP to region's floating IP pool.
6. Hệ thống xóa `FloatingIp` record.
7. Hệ thống ghi một audit log entry ([BR-19]).
8. Billing for this floating IP stops.

## Luồng Thay Thế

### 28a — Tự Động Gán Khi Tạo Server
- Optionally allocate and assign a floating IP during UC-01 server creation (step 3 region selection).
- Hệ thống tạo floating IP và gán it in the same provisioning job.

## Luồng Ngoại Lệ

### EX-28-1 — Floating IP Already Assigned
- Hệ thống hiển thị: "This floating IP is already được gán to another server." ([BR-75])

### EX-28-2 — Region Mismatch
- Hệ thống hiển thị: "Server phải là trong cùng region as the floating IP."

### EX-28-3 — Concurrent Assignment Conflict
- Another request được gán the floating IP between when khách hàng loaded trang and submitted.
- Hệ thống trả về `409 CONFLICT` và làm mới trang.

### EX-28-4 — No Floating IPs Available in Region
- Hệ thống hiển thị: "No floating IPs are currently có sẵn in this region. Please try again later."

### EX-28-5 — Server Locked
- Hệ thống trả về `409 CONFLICT` với đang hoạt động operation name. ([BR-17a])

---

# UC-29: Quản Lý Block Volume

| Attribute                 | Value                                                                                         |
|---------------------------|-----------------------------------------------------------------------------------------------|
| UC ID                     | UC-29                                                                                         |
| UC Name                   | Quản Lý Block Volume                                                                          |
| Actor(s)                  | Khách hàng (đã xác thực)                                                                      |
| Priority                  | Medium                                                                                        |
| Trigger                   | Khách hàng điều hướng đến Storage > Block Volumes                                                 |
| Pre-conditions            | Khách hàng đã đăng nhập (JWT hợp lệ). Số dư tài khoản đủ cho kỳ thanh toán đầu tiên.|
| Post-conditions (success) | Block volume được tạo, gắn, gỡ, thay đổi kích thước hoặc xóa.                                |
| Post-conditions (failure) | Không có thay đổi trạng thái. Lỗi hiển thị.                                                             |
| Business Rules            | BR-78, BR-79, BR-80, BR-81, BR-82, BR-17a, BR-19, BR-27                                       |
| Related UCs               | UC-01 (tạo server), UC-04 (danh sách server), UC-10 (ví)                                   |

## Luồng Chính

### Liệt Kê Block Volume

1. Khách hàng điều hướng đến Storage > Block Volumes.
2. Hệ thống truy vấn tất cả `BlockVolume` records belonging to khách hàng.
3. Hệ thống hiển thị một bảng:
   - **Name**
   - **Size** (GB)
   - **Region** ([BR-78])
   - **Status** (CREATING, AVAILABLE, ATTACHED, DETACHING, RESIZING, ERROR, DELETED)
   - **Attached Server** (hostname or "Unattached")
   - **Device Path** (e.g., `/dev/sdb`)
   - **Created date**
   - **Actions**: Attach, Detach, Resize, Delete

### Tạo Block Volume

1. Khách hàng nhấp vào **Tạo Volume**.
2. Khách hàng điền vào:
   - **Name** (bắt buộc, duy nhất cho mỗi khách hàng).
   - **Region** (danh sách thả xuống, [BR-78]).
   - **Size** (GB, 1–16384 per [BR-79]).
3. Khách hàng nhấp vào **Create**.
4. Hệ thống xác thực:
   - Account balance is sufficient for at least the first hour of billing ([BR-27], [BR-82]).
   - Size is within limits ([BR-79]).
5. Hệ thống tạo một `BlockVolume` record with `status = CREATING`.
6. Hệ thống đưa một job vào hàng đợi volume creation job to BullMQ.
7. Hệ thống trả về `202 Accepted` với `volumeId`.
8. Worker nhận job:
   - Executes `docker volume create` on a storage node in the selected region with labels: `astral-volume-id=<volumeId>`, `astral-user-id=<userId>`.
   - Updates `BlockVolume`: `status = AVAILABLE`, `dockerVolumeName`, `nodeId`.
   - Ghi một bản ghi audit log ([BR-19]).
   - Deducts the first hour's billing from ví ([BR-82], [BR-27]).
9. Hệ thống gửi một notification upon completion.

### Gắn Volume Vào Server

1. Khách hàng nhấp vào **Gắn** on an có sẵn volume (`status = AVAILABLE`).
2. Hệ thống hiển thị một danh sách thả xuống of this customer's servers trong cùng region.
3. Khách hàng chọn server and clicks **Gắn**.
4. Hệ thống xác thực:
   - Volume is trong cùng region as server ([BR-78]).
   - Volume không already được gắn to any server ([BR-80]).
   - Server status is `ACTIVE` or `STOPPED` ([BR-80]).
   - Server không bị khóa — the `lockedBy` field is checked atomically ([BR-17a]).
5. Hệ thống thực hiện mộtn **atomic lock+assign**:
   - Conditional UPDATE on `BlockVolume`: `WHERE id = :volId AND status = 'AVAILABLE' AND assignedServerId IS NULL` → sets `assignedServerId`, `status = ATTACHED`.
6. Hệ thống đưa một job vào hàng đợin attach job to BullMQ.
7. Hệ thống trả về `202 Accepted`.
8. Worker:
   - Binds the Docker volume to server's container (or schedules for next container start if server is `STOPPED`).
   - Assigns a device path (e.g., `/dev/sdb`) based on server's có sẵn device slots.
   - Updates `BlockVolume.devicePath`.
9. Hệ thống ghi một audit log entry ([BR-19]).

### Gỡ Volume Khỏi Server

1. Khách hàng nhấp vào **Gỡ** on an được gắn volume (`status = ATTACHED`).
2. Hệ thống nhắc: "Detaching a volume while server is running may cause data loss if volume is in use. Ensure volume is unmounted inside server first."
3. Khách hàng xác nhận.
4. Hệ thống xác thực server không bị khóa ([BR-17a]).
5. Hệ thống cập nhật `BlockVolume.status = DETACHING`.
6. Hệ thống đưa job gỡ vào hàng đợi BullMQ.
7. Worker:
   - Unbinds the Docker volume from container.
   - Updates `BlockVolume`: `status = AVAILABLE`, `assignedServerId = null`, `devicePath = null`.
8. Hệ thống ghi một audit log entry ([BR-19]).

### Gỡ Volume Cưỡng Bức

1. If server is không thể truy cập or volume cannot be unmounted normally, customer clicks **Gỡ Cưỡng Bức**.
2. Hệ thống hiển thị một stronger warning: "Force detach may cause data corruption. Only use if normal detach fails."
3. Customer types volume name và xác nhận.
4. Worker forcibly removes volume binding từ Docker host.
5. Volume status is set to `AVAILABLE` with a `forceDetached` flag in audit log.

### Thay Đổi Kích Thước Volume

1. Khách hàng nhấp vào **Resize** on a volume (`status = AVAILABLE`).
2. Khách hàng nhập a **new size** (phải là larger than current per [BR-79]).
3. Khách hàng nhấp vào **Resize**.
4. Hệ thống xác thực new size is ≥ current size ([BR-79]).
5. Hệ thống đưa job thay đổi kích thước vào hàng đợi BullMQ.
6. Worker:
   - Resizes the underlying Docker volume (filesystem expand).
   - Updates `BlockVolume.sizeMB`.
7. Hệ thống ghi một audit log entry ([BR-19]).
8. Billing adjusts to the new size ([BR-82]).

### Xóa Volume

1. Khách hàng nhấp vào **Delete** on a volume with `status = AVAILABLE`.
2. Hệ thống nhắc: "Delete volume '[name]'? All data will be permanently lost."
3. Customer types volume name và xác nhận.
4. Hệ thống đưa một job vào hàng đợi deletion job to BullMQ.
5. Worker:
   - Executes `docker volume rm` to remove volume from lưu trữ node.
   - Soft-xóa `BlockVolume` record.
   - Ghi một bản ghi audit log ([BR-19]).
6. Billing for this volume stops.

## Luồng Thay Thế

### 29a — Gắn Khi Tạo Server
- During UC-01, customer có thể chọn an existing có sẵn volume to auto-attach post-provisioning.

### 29b — Khôi Phục Khi Tạo Volume Thất Bại
- If the Docker volume creation job fails, worker updates status to `ERROR` and alerts admin.
- Khách hàng thấy: "Volume creation thất bại. Please try again."
- No billing charges applied for thất bại creations.

## Luồng Ngoại Lệ

### EX-29-1 — Volume Not Available
- Hệ thống hiển thị: "This volume cannot be được gắn because it không in an có sẵn state."

### EX-29-2 — Region Mismatch
- Hệ thống hiển thị: "Volume and server phải là trong cùng region." ([BR-78])

### EX-29-3 — Volume Already Attached
- Hệ thống trả về `409 CONFLICT`: "This volume is already được gắn to another server." ([BR-80])

### EX-29-4 — Server Locked
- Hệ thống trả về `409 CONFLICT` với đang hoạt động operation name. ([BR-17a])

### EX-29-5 — Volume Not Detached (Delete Blocked)
- Hệ thống hiển thị: "You must detach volume before deleting it." ([BR-81])

### EX-29-6 — Resize Below Current Size
- Hệ thống hiển thị: "New size phải là larger than the current size. Volumes can only be resized upward." ([BR-79])

### EX-29-7 — Insufficient Balance
- Hệ thống hiển thị: "Insufficient balance to create a volume of this size." ([BR-27])

### EX-29-8 — Server Must Be ACTIVE or STOPPED
- Hệ thống hiển thị: "Volumes can only be được gắn to servers that are running or stopped." ([BR-80])

---

# UC-30: Sử Dụng Cloud-init

| Attribute                 | Value                                                                                         |
|---------------------------|-----------------------------------------------------------------------------------------------|
| UC ID                     | UC-30                                                                                         |
| UC Name                   | Sử Dụng Cloud-init                                                                                |
| Actor(s)                  | Khách hàng (đã xác thực)                                                                      |
| Priority                  | Medium                                                                                        |
| Trigger                   | Customer provides a cloud-init script during server creation (UC-01)                          |
| Pre-conditions            | Khách hàng đã đăng nhập. Quá trình tạo server đang diễn ra.                                   |
| Post-conditions (success) | Script cloud-init được xác thực, lưu trữ và thực thi chính xác một lần khi khởi động lần đầu.                 |
| Post-conditions (failure) | Script bị từ chối với lỗi xác thực. Tạo server tiếp tục mà không có cloud-init.           |
| Business Rules            | BR-83, BR-84                                                                                  |
| Related UCs               | UC-01 (tạo server)                                                                         |

## Luồng Chính

1. During server creation (UC-01, between step 6 and step 7), customer clicks **Advanced Options > Cloud-init**.
2. Hệ thống hiển thị một text editor for the cloud-init script with syntax highlighting.
3. Customer pastes or writes a cloud-init (user-data) script in YAML format.
4. Khách hàng có thể chọn (tùy chọn) a **template** from a list of common scripts (e.g., "Install Docker", "Setup LAMP Stack", "Create User").
5. Khách hàng nhấp vào **Validate** (tùy chọn, before final submission).
6. Hệ thống thực hiện validation:
   - **Size check**: Script must not exceed 64 KB ([BR-84]).
   - **Syntax check**: YAML parser xác thực structure. Valid cloud-init directives (e.g., `#cloud-config` header, `packages`, `runcmd`, `write_files`, `users`) are recognized. Basic YAML syntax errors are caught.
   - Hệ thống hiển thị validation results inline: "Syntax OK" or "Error on line 12: không hợp lệ YAML indentation."
7. Khách hàng nhấp vào **Create** (UC-01 step 7).
8. Hệ thống lưu trữ cloud-init script alongside server creation request.
9. During provisioning (UC-01 step 13), worker:
   - Passes the cloud-init script to container via a mounted config drive or environment variable.
   - Docker/cloud-init executes script **exactly once** on first boot ([BR-83]).
10. After container boots, worker ghi một audit log entry ([BR-19]) recording that cloud-init was executed.
11. On subsequent server starts (UC-05), the cloud-init script does not re-run ([BR-83]).

## Luồng Thay Thế

### 30a — Xem Trước Script Cloud-init
- Khách hàng có thể thấy a rendered preview of script with variable placeholders resolved (e.g., `$HOSTNAME`, `$PUBLIC_IP` are shown as literal values).

### 30b — Xem Log Thực Thi
- After server is đang hoạt động, customer điều hướng đến Server > Cloud-init Log.
- Hệ thống lấy `/var/log/cloud-init-output.log` from container.
- Khách hàng có thể xem đầu ra to verify their script ran correctly.

### 30c — Bỏ Qua Xác Thực
- Khách hàng nhấp vào **Skip Validation** and script is accepted as-is, provided it does not exceed 64 KB ([BR-84]).
- Syntax errors during execution are logged and visible in the cloud-init log (30b).

## Luồng Ngoại Lệ

### EX-30-1 — Script Exceeds Size Limit
- Hệ thống hiển thị: "Cloud-init script exceeds tối đaimum size of 64 KB. Please reduce script size." ([BR-84])

### EX-30-2 — YAML Syntax Error
- Hệ thống hiển thị: "Invalid YAML syntax at line [N]: [error message]. Please correct script."
- The **Validate** button highlights lỗi. Customer can still skip and create server (script will fail at boot).

### EX-30-3 — Cloud-init Execution Failure
- The script fails during first boot (non-zero exit code).
- System does not revert server — server remains ACTIVE.
- The failure is logged in the cloud-init log (accessible via 30b).
- Hệ thống gửi một notification: "Cloud-init script đã hoàn thành with errors. View the execution log for details."

---

# UC-31: Quản Lý Webhook

| Attribute                 | Value                                                                                         |
|---------------------------|-----------------------------------------------------------------------------------------------|
| UC ID                     | UC-31                                                                                         |
| UC Name                   | Quản Lý Webhook                                                                               |
| Actor(s)                  | Khách hàng (đã xác thực)                                                                      |
| Priority                  | Low                                                                                           |
| Trigger                   | Khách hàng điều hướng đến Settings > Webhooks                                                     |
| Pre-conditions            | Khách hàng đã đăng nhập (JWT hợp lệ).                                                            |
| Post-conditions (success) | Webhook endpoint được tạo, cập nhật, xóa. Lịch sử gửi có thể xem được.                        |
| Post-conditions (failure) | Không có thay đổi trạng thái. Lỗi hiển thị.                                                             |
| Business Rules            | BR-88, BR-89, BR-90, BR-91                                                                    |
| Related UCs               | UC-01 (tạo server), UC-05 (start server), UC-06 (dừng server), UC-07 (delete server), UC-13 (sao lưu), UC-10 (ví) |

## Luồng Chính

### Liệt Kê Webhook Endpoint

1. Khách hàng điều hướng đến Settings > Webhooks.
2. Hệ thống truy vấn tất cả `WebhookEndpoint` records belonging to khách hàng.
3. Hệ thống hiển thị một bảng:
   - **URL**
   - **Events** (subscribed event types)
   - **Status** (ACTIVE, DISABLED)
   - **Last delivery** timestamp + status
   - **Created date**
   - **Actions**: View deliveries, Edit, Delete

### Tạo Webhook Endpoint

1. Khách hàng nhấp vào **Create Webhook**.
2. Khách hàng điền vào:
   - **URL** (HTTPS bắt buộc, validated for reachability).
   - **Events** (multi-select hộp kiểm from [BR-91]):
     - `server.created`, `server.started`, `server.stopped`, `server.deleted`
     - `backup.đã hoàn thành`, `backup.thất bại`
     - `payment.succeeded`, `payment.thất bại`
   - **Description** (tùy chọn).
3. Khách hàng nhấp vào **Create**.
4. Hệ thống xác thực:
   - URL is a hợp lệ HTTPS URL.
   - Customer has fewer than 10 endpoints ([BR-88]).
5. Hệ thống tạo một **signing secret** (cryptographically random, displayed once).
6. Hệ thống tạo một `WebhookEndpoint` record with `status = ACTIVE`.
7. Hệ thống gửi một **test ping** to endpoint to verify reachability:
   - HTTP POST with a `ping` event type and HMAC-SHA256 signature.
   - If endpoint returns 2xx, endpoint is marked as verified.
   - If endpoint fails, endpoint is still created but shows a warning: "Could not verify endpoint. Deliveries may fail."

### Cập Nhật Webhook Endpoint

1. Khách hàng nhấp vào **Edit** on an endpoint.
2. Khách hàng có thể sửa đổi: URL, events, description.
3. Khách hàng nhấp vào **Lưu**.
4. Hệ thống xác thực và cập nhật bản ghi.
5. If URL changed, system gửi một new test ping.

### Xóa Webhook Endpoint

1. Khách hàng nhấp vào **Delete** on an endpoint.
2. Hệ thống nhắc: "Delete this webhook endpoint? All đang chờ deliveries will be cancelled."
3. Khách hàng xác nhận.
4. Hệ thống xóa `WebhookEndpoint` record.
5. System cancels any đang chờ retries cho endpoint này.

### Xem Lịch Sử Gửi

1. Khách hàng nhấp vào **View Deliveries** on an endpoint.
2. Hệ thống truy vấn tất cả `WebhookDelivery` records cho endpoint này, ordered by `createdAt` descending.
3. Hệ thống hiển thị một paginated bảng:
   - **Event Type** (e.g., `server.created`)
   - **Target URL**
   - **Status** (SUCCESS, FAILED, PENDING)
   - **Response Code** (e.g., 200, 500, timeout)
   - **Attempts** (1/3)
   - **Delivered at**
   - **Actions**: View payload, Retry

### Xem Payload Gửi Đi

1. Khách hàng nhấp vào một delivery to expand its details.
2. Hệ thống hiển thị:
   - **Request headers** (including `X-Astral-Signature`).
   - **Request body** (JSON payload).
   - **Response headers** and **response body** from endpoint.
   - **Attempt history** (timestamps, response codes for each retry).

### Thử Lại Gửi Thất Bại

1. Khách hàng nhấp vào **Retry** on a thất bại delivery.
2. System re-enqueues webhook delivery job to BullMQ.
3. The retry follows the same exponential backoff schedule ([BR-89]).

### Xoay Khóa Ký

1. Khách hàng nhấp vào **Rotate Secret** on an endpoint.
2. System cảnh báo: "Rotating secret will invalidate the current secret immediately. Update your receiving server."
3. Khách hàng xác nhận.
4. Hệ thống tạo một new secret và hiển thị it once.

## Luồng Hệ Thống: Webhook Delivery

1. When a subscribed event occurs (e.g., `server.created`), hệ thống đưa vào hàng đợi một webhook delivery job to BullMQ.
2. Worker nhận job:
   - Constructs the payload (event type, timestamp, resource data).
   - Signs the payload with HMAC-SHA256 using endpoint's secret ([BR-90]).
   - Sends an HTTP POST to endpoint URL với `X-Astral-Signature` header.
3. If endpoint responds with 2xx, the delivery is marked `SUCCESS`.
4. If endpoint responds with non-2xx or times out (10s timeout), the delivery is retried up to 3 times with exponential backoff: 1s, 5s, 25s ([BR-89]).
5. After 3 thất bại attempts, the delivery is marked `FAILED`.
6. System does not retry further unless manually triggered by khách hàng.

## Luồng Thay Thế

### 31a — Vô Hiệu Hóa/Kích Hoạt Lại Endpoint
- Khách hàng có thể bật/tắt an endpoint's status between ACTIVE and DISABLED.
- Disabled endpoints do not receive any deliveries.
- Pending deliveries for a bị vô hiệu hóa endpoint are cancelled.
- Re-enabling gửi một test ping.

### 31b — Đăng Ký Sự Kiện Hàng Loạt
- Khách hàng có thể bật/tắt "All Server Events" or "All Payment Events" to select/deselect groups of events at once.

## Luồng Ngoại Lệ

### EX-31-1 — Endpoint Limit Reached
- Hệ thống hiển thị: "You have reached tối đaimum of 10 webhook endpoints. Delete an existing endpoint first." ([BR-88])

### EX-31-2 — Invalid URL
- Hệ thống hiển thị: "Please enter a hợp lệ HTTPS URL."

### EX-31-3 — Test Ping Failed
- Hệ thống hiển thị một warning: "Could not verify endpoint. The endpoint returned [status code]." Endpoint is still created.

---

# UC-32: Xem Mức Sử Dụng Băng Thông

| Attribute                 | Value                                                                                         |
|---------------------------|-----------------------------------------------------------------------------------------------|
| UC ID                     | UC-32                                                                                         |
| UC Name                   | Xem Mức Sử Dụng Băng Thông                                                                          |
| Actor(s)                  | Khách hàng (đã xác thực)                                                                      |
| Priority                  | Low                                                                                           |
| Trigger                   | Khách hàng điều hướng đến server detail page > Bandwidth tab                                    |
| Pre-conditions            | Khách hàng đã đăng nhập. Server thuộc về khách hàng.                                            |
| Post-conditions (success) | Biểu đồ băng thông hiển thị. Hạn mức so với mức sử dụng được hiển thị. Cảnh báo vượt mức được đưa ra.                |
| Post-conditions (failure) | Error displaying graphs.                                                                      |
| Business Rules            | BR-85, BR-86, BR-87                                                                           |
| Related UCs               | UC-01 (tạo server), UC-04 (danh sách server), UC-18 (notifications)                            |

## Luồng Chính

### Xem Biểu Đồ Băng Thông

1. Khách hàng điều hướng đến server detail page > Bandwidth tab.
2. Hệ thống truy vấn bandwidth usage metrics cho server này from thời gian-series data store.
3. Hệ thống kết xuất mộtn interđang hoạt động graph:
   - **X-axis**: time (hourly or daily granularity, [BR-86]).
   - **Y-axis**: bandwidth (in GB or Mbps).
   - **Two lines/areas**: inbound traffic, outbound traffic.
   - **Overlay line**: monthly allowance cap ([BR-85]).
4. Khách hàng có thể bật/tắt between:
   - **Hourly view** (last 24 hours, 1-hour granularity, [BR-86]).
   - **Daily view** (last 30 days, daily aggregation).
   - **Monthly view** (last 12 months, monthly aggregation).
5. Khách hàng có thể di chuột qua over data points to see exact values.

### Xem Tóm Tắt Hạn Mức

1. Above the graph, system hiển thị một summary card:
   - **Monthly Allowance**: [X] GB (derived from ServerPlan `bandwidthMbps`, [BR-85]).
   - **Used This Month**: [Y] GB ([Y/X]%).
   - **Remaining**: [X−Y] GB.
   - **Overage Rate**: $[Z]/GB (if applicable).
2. A progress bar shows used vs remaining with color coding:
   - Green: < 60%
   - Yellow: 60–80%
   - Orange: 80–100%
   - Red: > 100%

### Xem Phân Tích Mức Sử Dụng

1. Below the graph, system hiển thị một bảng of daily usage totals:
   - **Date**
   - **Inbound** (GB)
   - **Outbound** (GB)
   - **Total** (GB)
2. Rows exceeding the daily prorated allowance are highlighted.

### Nhận Cảnh Báo Vượt Mức

1. Hệ thống giám sát bandwidth consumption in near real-time ([BR-86]).
2. At **80%** of monthly allowance, system generates an in-app notification: "Server '[hostname]' has used 80% of its monthly bandwidth allowance." ([BR-87])
3. At **100%** of monthly allowance, system tạo một second notification: "Server '[hostname]' đã vượt quá its monthly bandwidth allowance. Overage charges now apply at $[Z]/GB." ([BR-87])
4. These are non-critical notifications — customer có thể từ chối per [BR-58].
5. If khách hàng exceeds 150% of allowance without action, a critical notification is sent (cannot opt out, per [BR-59]).

## Luồng Thay Thế

### 32a — Xem Tổng Hợp Nhiều Server
- From the main Bandwidth page (not server-specific), customer sees an aggregate graph combining all servers' bandwidth usage.
- Each server is a separate line on the graph.
- Total aggregate allowance vs usage is displayed.

### 32b — Xuất CSV
- Khách hàng nhấp vào **Export** to download băng thông data as a CSV file for the selected time range.

## Luồng Ngoại Lệ

### EX-32-1 — Metrics Uncó sẵn
- If thời gian-series data store is không thể truy cập, system displays: "Bandwidth data is temporarily không có sẵn. Please try again later."

### EX-32-2 — No Data
- If server was just created or has zero traffic, system displays: "No bandwidth data có sẵn yet. Data will appear once your server processes traffic."

---

# UC-33: Sử Dụng Công Cụ CLI

| Attribute                 | Value                                                                                         |
|---------------------------|-----------------------------------------------------------------------------------------------|
| UC ID                     | UC-33                                                                                         |
| UC Name                   | Sử Dụng Công Cụ CLI                                                                                  |
| Actor(s)                  | Khách hàng (nhà phát triển/vận hành)                                                                 |
| Priority                  | Low                                                                                           |
| Trigger                   | Customer installs và cấu hình Astral Cloud CLI                                         |
| Pre-conditions            | Khách hàng có tài khoản đang hoạt động với ít nhất một API key (UC-09).                             |
| Post-conditions (success) | CLI được xác thực và thực thi lệnh quản lý server, volume và DNS.              |
| Post-conditions (failure) | Lệnh thất bại với thông báo lỗi. Xác thực bị từ chối.                                    |
| Business Rules            | BR-92, BR-26                                                                                  |
| Related UCs               | UC-09 (manage API keys), UC-01 (tạo server), UC-15 (quản lý DNS), UC-29 (quản lý block volume) |

## Luồng Chính

### Cài Đặt CLI

1. Customer visits CLI documentation page or GitHub releases.
2. Customer downloads CLI binary for their OS/architecture (Linux, macOS, Windows).
3. Customer installs the binary:
   - **Linux/macOS**: `curl -fsSL https://cli.astral.cloud/install.sh | bash` or manual download to `/usr/local/bin`.
   - **Windows**: Download `.exe` installer or use `winget`.
4. Khách hàng xác minh cài đặt: `astral version`.

### Xác Thực

1. Khách hàng chạy `astral auth login`.
2. CLI nhắc: "Nhập API key của bạn:" (nhập ẩn).
3. Khách hàng nhập their API key (created via UC-09).
4. CLI gửi một validation request to `GET /api/v1/auth/verify` with API key as a Bearer token ([BR-92]).
5. On success, CLI stores API key in a local config profile (`~/.config/astral/config.yaml`) ([BR-92]).
6. CLI displays: "Authenticated as [username]."
7. On failure, CLI displays: "Authentication thất bại. Check your API key and try again."

### Quản Lý Nhiều Hồ Sơ

1. Customer runs `astral auth login --profile production` to create a named profile.
2. Customer switches profiles: `astral auth use production`.
3. CLI commands use the đang hoạt động profile's API key.

### Lệnh: Quản Lý Server

1. **List servers**: `astral server list`
   - Flags: `--status`, `--region`, `--tag`, `--limit`, `--json`
   - Output: bảng (mặc định) or JSON.

2. **Create server**: `astral server create`
   - Required flags: `--plan`, `--image`, `--region`, `--hostname`
   - Optional flags: `--ssh-key`, `--voucher`, `--billing`, `--tags`, `--cloud-init`, `--private-network`, `--floating-ip`
   - Output: server ID, IP address, credentials (if password auth).

3. **Start/Stop/Delete server**: `astral server start|stop|delete <server-id-or-hostname>`
   - Confirmation prompt (skip with `--force`).

4. **SSH proxy**: `astral server ssh <server-id-or-hostname>`
   - CLI establishes an SSH connection to server via an SSH proxy service.
   - If khách hàng has an SSH key configured, it is used automatically.
   - If password auth, CLI prompts for the password or auto-fills from known credentials.

5. **View server details**: `astral server info <server-id-or-hostname>`
   - Output: hostname, IP, status, plan, region, tags, created date, bandwidth usage.

### Lệnh: Quản Lý Volume

1. **List volumes**: `astral volume list` with flags: `--region`, `--status`, `--json`.
2. **Create volume**: `astral volume create --name <name> --size <GB> --region <region>`.
3. **Attach/Detach**: `astral volume attach|detach <volume-id> --server <server-id>`.
4. **Resize**: `astral volume resize <volume-id> --size <new-GB>`.
5. **Delete**: `astral volume delete <volume-id>` (with confirmation).

### Commands: Quản Lý DNS

1. **List DNS records**: `astral dns list --server <server-id>`.
2. **Create record**: `astral dns create --server <server-id> --type A --name www --value <ip> --ttl 3600`.
3. **Update record**: `astral dns update <record-id> --value <new-value>`.
4. **Delete record**: `astral dns delete <record-id>`.

### Lệnh: Chung

1. **View account**: `astral account info` — displays username, balance, server count, plan.
2. **View billing**: `astral billing history` — paginated billing history.
3. **Help**: `astral help [command]` — shows command usage and examples.
4. **Output format**: All list commands support `--json` for programmatic use and `--bảng` (mặc định) for human-readable output.

## Luồng Thay Thế

### 33a — Chế Độ Không Tương Tác
- All commands support `--api-key <key>` flag for CI/CD pipelines, bypassing the config profile.
- Commands support `--no-confirm` to skip confirmation prompts.

### 33b — Tự Động Hoàn Thành Shell
- Customer runs `astral completion bash|zsh|fish` to generate shell auto-completion scripts.

## Luồng Ngoại Lệ

### EX-33-1 — Authentication Failed
- CLI displays: "Authentication thất bại. Verify your API key is đang hoạt động and not đã hết hạn." ([BR-92])

### EX-33-2 — Rate Limited
- CLI receives `429 Too Many Requests` và hiển thị: "Rate limit exceeded. Please wait [N] seconds." ([BR-26])

### EX-33-3 — Invalid Command
- CLI hiển thị help text for the command with hợp lệ subcommands and examples.

### EX-33-4 — Network Error
- CLI displays: "Could not connect to Astral Cloud API. Check your internet connection."

---

# UC-34: Sử Dụng Terraform Provider

| Attribute                 | Value                                                                                         |
|---------------------------|-----------------------------------------------------------------------------------------------|
| UC ID                     | UC-34                                                                                         |
| UC Name                   | Sử Dụng Terraform Provider                                                                        |
| Actor(s)                  | Kỹ Sư DevOps, Khách hàng (xác thực qua API key)                                         |
| Priority                  | Low                                                                                           |
| Trigger                   | Kỹ sư DevOps writes Terraform configuration (HCL) referencing Astral Cloud provider    |
| Pre-conditions            | Khách hàng có tài khoản đang hoạt động với ít nhất một API key (UC-09). Terraform is installed.     |
| Post-conditions (success) | Cơ sở hạ tầng được khai báo trong HCL được lập kế hoạch và áp dụng với Astral Cloud API.           |
| Post-conditions (failure) | Kế hoạch thất bại xác thực hoặc áp dụng bị từ chối với lỗi API.                                    |
| Business Rules            | BR-93, BR-26                                                                                  |
| Related UCs               | UC-09 (manage API keys), UC-01 (tạo server), UC-15 (quản lý DNS), UC-27 (mạng riêng), UC-28 (floating IP), UC-29 (block volume) |

## Luồng Chính

### Cấu Hình Provider

1. Kỹ sư DevOps tạo một `main.tf` file.
2. Kỹ sư DevOps configures Astral Cloud provider:

```hcl
terraform {
  bắt buộc_providers {
    astral = {
      source  = "registry.terraform.io/astral/astral"
      version = "~> 1.0"
    }
  }
}

provider "astral" {
  api_key = var.astral_api_key  # or set ASTRAL_API_KEY env var
}
```

3. The API key is provided via a Terraform variable or the `ASTRAL_API_KEY` environment variable ([BR-92], [BR-93]).
4. The API key is never hardcoded in version-controlled `.tf` files.

### Khai Báo Tài Nguyên

1. Kỹ sư DevOps declares resources in HCL:

```hcl
resource "astral_server" "web" {
  hostname = "web-01"
  plan     = "starter-2"
  image    = "ubuntu-24.04"
  region   = "nyc1"
  ssh_keys = [astral_ssh_key.admin.id]
  tags     = ["production", "web"]

  billing_model = "monthly"

  cloud_init = file("./cloud-init.yaml")
}

resource "astral_floating_ip" "web_ip" {
  region  = "nyc1"
  server_id = astral_server.web.id
}

resource "astral_block_volume" "web_data" {
  name   = "web-data"
  size   = 100
  region = "nyc1"
  server_id = astral_server.web.id
}

resource "astral_dns_record" "www" {
  server_id = astral_server.web.id
  type      = "A"
  name      = "www"
  value     = astral_floating_ip.web_ip.address
  ttl       = 3600
}

resource "astral_private_network" "backend" {
  name   = "backend-net"
  region = "nyc1"
  cidr   = "10.0.0.0/24"
}

resource "astral_firewall_rule" "allow_https" {
  server_id  = astral_server.web.id
  protocol   = "tcp"
  port_range = "443"
  source_cidr = "0.0.0.0/0"
  action     = "allow"
  priority   = 100
}
```

### Lập Kế Hoạch Cơ Sở Hạ Tầng

1. Kỹ sư DevOps runs `terraform plan`.
2. Terraform reads the HCL configuration.
3. The Astral Cloud provider calls chỉ đọc API endpoints to determine current state ([BR-93]):
   - `GET /api/v1/servers` to list existing servers.
   - `GET /api/v1/floating-ips` to list floating IPs.
   - `GET /api/v1/volumes` to list volumes.
   - (No internal/privileged endpoints — all calls use the same public REST API.)
4. Provider computes khác biệt between desired state (HCL) and current state (API).
5. Terraform outputs the execution plan:
   - Resources to create: `+`
   - Resources to modify: `~`
   - Resources to destroy: `-`

### Áp Dụng Cơ Sở Hạ Tầng

1. Kỹ sư DevOps runs `terraform apply`.
2. Terraform prompts for confirmation (skip with `-auto-approve`).
3. The provider calls Astral Cloud API in dependency order:
   - Creates `astral_private_network` first (no dependencies).
   - Creates `astral_server` (depends on network).
   - Creates `astral_floating_ip` (depends on server).
   - Creates `astral_block_volume` và gắn it (depends on server).
   - Creates `astral_dns_record` (depends on floating IP).
   - Creates `astral_firewall_rule` (depends on server).
4. API calls are subject to the same rate limits (60 req/min per API key) as any other API request ([BR-26], [BR-93]).
5. Provider handles `202 Accepted` responses for async operations (server creation, volume creation) by polling for completion.
6. Provider writes tài nguyên IDs to Terraform state file (`terraform.tfstate`).

### Hủy Cơ Sở Hạ Tầng

1. Kỹ sư DevOps runs `terraform destroy`.
2. Terraform destroys resources in reverse dependency order.
3. All API calls use the standard public endpoints ([BR-93]).

### Nhập Tài Nguyên Hiện Có

1. Kỹ sư DevOps runs `terraform import astral_server.web <server-id>`.
2. The provider fetches current resource state from API and populates Terraform state file.

## Luồng Thay Thế

### 34a — Terraform Cloud / CI/CD
- The API key is injected via Terraform Cloud workspace variables or CI/CD secrets.
- `terraform plan` runs on PR; `terraform apply` runs on merge to main.

### 34b — Tái Sử Dụng Module
- Kỹ sư DevOps defines reusable Terraform modules encapsulating common patterns (e.g., "web server with floating IP and DNS").

## Luồng Ngoại Lệ

### EX-34-1 — Provider Authentication Failed
- Terraform displays: "Error: authentication thất bại. Verify your API key."
- `terraform plan` or `apply` aborts with exit code 1.

### EX-34-2 — API Rate Limit
- Provider backs off and retries with exponential backoff.
- If all retries exhausted, Terraform displays: "Error: rate limit exceeded. Try again in [N] seconds." ([BR-26])

### EX-34-3 — Resource Already Exists
- Terraform displays: "Error: A server with hostname '[name]' already exists in your account."

### EX-34-4 — Async Operation Timed Out
- Provider polls for status up to a configurable timeout (mặc định: 5 minutes).
- On timeout, Terraform displays: "Error: Operation timed out waiting for resource to become ready."

### EX-34-5 — State Drift
- Running `terraform plan` detects resources manually modified outside Terraform (e.g., server deleted via UI).
- Terraform hiển thị drift in gói output; customer can reconcile by re-applying.

---

# UC-35: Thiết Lập Giới Hạn Chi Tiêu

| Attribute                 | Value                                                                                         |
|---------------------------|-----------------------------------------------------------------------------------------------|
| UC ID                     | UC-35                                                                                         |
| UC Name                   | Thiết Lập Giới Hạn Chi Tiêu                                                                              |
| Actor(s)                  | Khách hàng (đã xác thực)                                                                      |
| Priority                  | Medium                                                                                        |
| Trigger                   | Khách hàng điều hướng đến Billing > Spending Cap                                                  |
| Pre-conditions            | Khách hàng đã đăng nhập (JWT hợp lệ).                                                            |
| Post-conditions (success) | Giới hạn chi tiêu hàng tháng được cấu hình. Tạo tài nguyên bị chặn khi đạt đến.                      |
| Post-conditions (failure) | Giới hạn không được đặt. Lỗi hiển thị.                                                                 |
| Business Rules            | BR-112, BR-27                                                                                 |
| Related UCs               | UC-01 (tạo server), UC-10 (ví), UC-29 (quản lý block volume)                           |

## Luồng Chính

### Cấu Hình Giới Hạn Chi Tiêu

1. Khách hàng điều hướng đến Billing > Spending Cap.
2. Hệ thống hiển thị:
   - **Current trạng thái giới hạn**: "No cap set" or the current cap amount.
   - **Current month spend**: total charges this billing cycle.
   - **Projected month spend**: extrapolated from current burn rate.
3. Khách hàng nhập a **giới hạn chi tiêu hàng tháng** in USD (số dương, or 0 to disable).
4. Khách hàng nhấp vào **Lưu**.
5. Hệ thống xác thực cap amount is a số dương (or 0).
6. Hệ thống lưu trữ cap in the `User` record (`monthlySpendingCap`).
7. Hệ thống ghi một audit log entry.

### Thực Thi Giới Hạn

1. When a customer attempts to create server (UC-01) or a block volume (UC-29), hệ thống checks:
   - `currentMonthSpend + estimatedNewResourceCost > monthlySpendingCap`
   - Estimated cost is the first billing period charge: 1 hour for hourly, 1 month for monthly.
2. If giới hạn **would be exceeded**:
   - Hệ thống chặn creation và hiển thị: "Monthly spending cap of $[X] would be exceeded. Current spend: $[Y]. This resource would add $[Z]/[period]. Increase your cap or wait until next billing cycle." ([BR-112])
3. Existing servers continue to run and incur charges even if giới hạn is exceeded ([BR-112]).
   - The cap only blocks **new** resource creation.
   - Auto-deductions for existing resources are not affected.
4. Hệ thống gửi mộtn in-app notification when giới hạn is reached.

### Xem Mức Sử Dụng Giới Hạn

1. Khách hàng điều hướng đến Billing > Spending Cap.
2. Hệ thống hiển thị một progress bar:
   - **Spent this month**: $[Y]
   - **Cap**: $[X]
   - **Percentage**: [Y/X]%
3. Color coding: green (< 60%), yellow (60–80%), orange (80–100%), red (reached).
4. When giới hạn is reached, a banner appears on bảng điều khiển: "Monthly spending cap reached. New resource creation is blocked until the next billing cycle."

### Sửa Đổi hoặc Xóa Giới Hạn

1. Customer changes giới hạn amount and clicks **Lưu**.
2. If giới hạn is increased, blocked resources can now be created.
3. If giới hạn is removed (set to 0), all restrictions are lifted.

## Luồng Thay Thế

### 35a — Ngưỡng Cảnh Báo Giới Hạn
- Customer có thể cấu hình an tùy chọn warning threshold (e.g., 80% of cap).
- Hệ thống gửi mộtn in-app notification when this threshold is reached, before the hard cap blocks creation.

## Luồng Ngoại Lệ

### EX-35-1 — Invalid Cap Amount
- Hệ thống hiển thị: "Please enter a hợp lệ số dương or 0 to disable giới hạn."

### EX-35-2 — Resource Creation Blocked
- Hệ thống hiển thị: "Monthly spending cap of $[X] reached ($[Y] spent). New resource creation is blocked." ([BR-112])

---

# UC-36: Thanh Toán Trước Hàng Năm

| Attribute                 | Value                                                                                         |
|---------------------------|-----------------------------------------------------------------------------------------------|
| UC ID                     | UC-36                                                                                         |
| UC Name                   | Thanh Toán Trước Hàng Năm                                                                             |
| Actor(s)                  | Khách hàng (đã xác thực)                                                                      |
| Priority                  | Low                                                                                           |
| Trigger                   | Khách hàng chọn annual billing during server creation or switches an existing server         |
| Pre-conditions            | Khách hàng đã đăng nhập. Server đang ở gói thanh toán hàng tháng. Số dư ví đủ cho chi phí hàng năm.|
| Post-conditions (success) | Server được chuyển sang thanh toán hàng năm với giảm giá 20% được áp dụng. Thanh toán trước được khấu trừ.             |
| Post-conditions (failure) | Chuyển đổi không được thực hiện. Không có phí. Lỗi hiển thị.                                                 |
| Business Rules            | BR-113, BR-27, BR-28                                                                          |
| Related UCs               | UC-01 (tạo server), UC-10 (ví)                                                         |

## Luồng Chính

### Chọn Thanh Toán Hàng Năm Khi Tạo Server

1. During server creation (UC-01 step 6), customer chọn **Annual** billing model alongside Monthly and Hourly options.
2. Hệ thống tính toán annual price:
   - Annual base cost = monthly price × 12.
   - Discount = annual base cost × 20% ([BR-113]).
   - Annual prepay amount = annual base cost − discount.
3. Hệ thống hiển thị một comparison:
   - Monthly: $[X]/month × 12 = $[12X]/year
   - Annual: $[12X] − 20% = $[9.6X]/year (save $[2.4X])
4. Hệ thống xác thực wallet balance covers the full annual prepay amount ([BR-27]).
5. Hệ thống khấu trừ annual prepay amount from ví và áp dụng the 20% discount ([BR-113]):
   - A `ServerBilling` record is created for the annual term.
   - Each month, hệ thống credits 1/12 of giảm giá to ví billing entry for accounting purposes.
6. System continues server creation flow (UC-01 step 7+).

### Chuyển Server Hiện Tại Sang Thanh Toán Hàng Năm

1. Khách hàng điều hướng đến server detail page > Billing.
2. If server is on a **monthly** plan, hệ thống hiển thị một "Switch to Annual — Save 20%" option.
3. Khách hàng nhấp vào **Switch to Annual**.
4. Hệ thống hiển thị pro-rated calculation:
   - Remaining months in current annual period (prorated).
   - Discount calculation.
5. Khách hàng xác nhận.
6. Hệ thống khấu trừ prorated annual amount from ví.
7. Hệ thống cập nhật `ServerBilling.model = ANNUAL` và đặt `nextBillingAt` to 12 months from now.
8. Hệ thống ghi một audit log entry ([BR-19]).
9. The 20% discount is applied to each billing month going forward ([BR-113]).

### Xem Trạng Thái Thanh Toán Hàng Năm

1. Khách hàng điều hướng đến server detail page > Billing.
2. Hệ thống hiển thị:
   - **Billing model**: Annual (20% discount)
   - **Prepaid through**: [date]
   - **Monthly equivalent**: $[X]/month (after discount)
   - **Saved this year**: $[Y]

## Luồng Thay Thế

### 36a — Tự Động Gia Hạn Hàng Năm
- 30 days before the annual term expires, system gửi một renewal reminder.
- Customer can enable auto-renewal: system automatically khấu trừ next year's prepayment at the current rate.

## Luồng Ngoại Lệ

### EX-36-1 — Insufficient Balance for Thanh Toán Trước Hàng Năm
- Hệ thống hiển thị: "Insufficient balance. The annual prepayment is $[X]. Your current balance is $[Y]. Add funds to continue." ([BR-27])

### EX-36-2 — Early Cancellation
- Customer deletes (UC-07) server on annual billing before năm is complete.
- Hệ thống xử lý early cancellation ([BR-113]):
  - Calculates the prorated refund for unused full months remaining.
  - Forfeits the remaining 20% discount for hủyled period ([BR-113]).
  - Refunds the prorated unused months (at giảm giáed rate) to ví.
  - Displays a breakdown: "Refund: $[X] for [N] unused months. Forfeited discount: $[Y]."
- Khách hàng xác nhận and server is deleted.

### EX-36-3 — Already on Annual Plan
- Hệ thống ẩn "Switch to Annual" option và hiển thị: "This server is already on an annual billing plan."

---

# UC-37: Báo Cáo Lạm Dụng

| Attribute                 | Value                                                                                          |
|---------------------------|------------------------------------------------------------------------------------------------|
| UC ID                     | UC-37                                                                                          |
| UC Name                   | Báo Cáo Lạm Dụng                                                                                |
| Actor(s)                  | Khách truy cập (chưa xác thực), Customer (authenticated, reporter); Staff, Admin (processor)        |
| Priority                  | Medium                                                                                         |
| Trigger                   | Reporter submits an abuse report via trang báo cáo lạm dụng or email                         |
| Pre-conditions            | None (reporter). Staff phải đăng nhập để xử lý.                                       |
| Post-conditions (success) | Báo cáo lạm dụng được ghi log và xem xét. Báo cáo được xác thực dẫn đến đình chỉ server. Đã giải quyết.       |
| Post-conditions (failure) | Báo cáo bị bác bỏ là không hợp lệ. Server không thay đổi.                                                 |
| Business Rules            | BR-107, BR-115, BR-19, BR-20                                                                   |
| Related UCs               | UC-04 (danh sách server), UC-06 (dừng server), UC-07 (delete server), UC-24 (quản lý nền tảng)  |

## Luồng Chính

### Gửi Báo Cáo Lạm Dụng (Người Báo Cáo)

1. Người báo cáo điều hướng đến `/abuse` or clicks "Report Abuse" từ footer/contact page.
2. Reporter điền vào abuse report form:
   - **Reporter name** (tùy chọn for authenticated customers, auto-filled).
   - **Reporter email** (bắt buộc for visitors; auto-filled for authenticated customers).
   - **Abuse type** (danh sách thả xuống: DMCA/Copyright, Spam, Malware/Phishing, Crypto Mining, DDoS Origin, Harassment, Other).
   - **Offending server IP or hostname** (bắt buộc).
   - **Description** (bắt buộc, detailed explanation of the abuse).
   - **Evidence** (tùy chọn file uploads: screenshots, logs, headers, DMCA takedown notice PDF).
3. Người báo cáo hoàn thành CAPTCHA (for unauthenticated submissions).
4. Reporter clicks **Gửi**.
5. Hệ thống tạo mộtn `AbuseReport` record with:
   - `status = PENDING_REVIEW`
   - `reportedAt = now`
   - All submitted fields.
   - If authenticated, `reporterUserId` is set.
6. Hệ thống hiển thị: "Your abuse report has been submitted. Our team will review it trong vòng 24 giờ." ([BR-115])

### Staff Xem Xét Hàng Đợi Lạm Dụng

1. Staff điều hướng đến Admin > Abuse Reports.
2. Hệ thống hiển thị một queue of all `AbuseReport` records, ordered by priority and report date:
   - **Report #**
   - **Type** (with severity: DMCA = HIGH, Spam = MEDIUM, etc.)
   - **Offending IP/Hostname** (with link to server if identified)
   - **Reporter** (name/email)
   - **Status** (PENDING_REVIEW, INVESTIGATING, VALIDATED, DISMISSED, SUSPENDED, RESOLVED)
   - **Reported date**
   - **SLA remaining** (24h from submission, [BR-115])
3. Staff có thể lọc by status, type, and date range.

### Điều Tra và Xác Thực

1. Staff nhấp vào một report to view details:
   - Full report content, evidence files, reporter info.
   - **Server lookup**: System attempts to match báo cáoed IP/hostname to a `ServerInstance` record.
   - If matched, displays: server owner, server status, creation date, related tickets/previous reports.
2. Staff investigates the claim:
   - Reviews evidence.
   - May verify the offending server directly (access logs, open ports, running processes via admin console).
   - Adds **internal notes** to báo cáo.
3. Staff chọn an action:
   - **Validate**: Abuse confirmed — proceeds to "Suspend Server."
   - **Dismiss**: Abuse not confirmed or insufficient evidence — report closed.
4. Hệ thống ghi một audit log entry for staff action ([BR-20]).

### Bác Bỏ Báo Cáo

1. Staff nhấp vào **Dismiss**.
2. Staff chọn a **dismissal reason**: INSUFFICIENT_EVIDENCE, NOT_ABUSE, DUPLICATE, OUT_OF_SCOPE.
3. Staff có thể viết (tùy chọn) a note (visible only internally).
4. Hệ thống cập nhật `AbuseReport.status = DISMISSED`.
5. System tùy chọnly gửi một email to người báo cáo (if email provided): "Your report #[N] has been reviewed and no abuse was confirmed."
6. Hệ thống ghi một audit log entry ([BR-20]).

### Đình Chỉ Server

1. Staff nhấp vào **Validate & Suspend**.
2. Hệ thống hiển thị một confirmation: "Suspend server '[hostname]' owned by [username]? The server will be stopped and khách hàng notified."
3. Staff xác nhận and tùy chọnly writes a **suspension reason** that will be shown to khách hàng.
4. System:
   - Updates `ServerInstance.status = SUSPENDED`.
   - Enqueues a stop job to BullMQ: worker stops the Docker container with a suspension label.
   - Sends a critical notification to server owner: "Your server '[hostname]' has been suspended due to an abuse report. Reason: [reason]. You have 48 hours to respond." ([BR-115], [BR-59])
   - Writes an audit log entry ([BR-19], [BR-20]).
5. Hệ thống bắt đầu một 48-hour response timer ([BR-115]).

### Giải Quyết Vụ Việc Lạm Dụng

1. After the 48-hour period, or upon customer response, staff reviews the case.
2. Staff chọn a resolution:
   - **Resolved — Customer Remedied**: Customer removed the offending content/activity. Server is unsuspended.
   - **Resolved — Server Deleted**: Abuse not remedied, server is permanently deleted ([BR-115]).
   - **Resolved — With Warning**: Minor infraction, server unsuspended with a warning on tài khoản.
3. Hệ thống xử lý resolution:
   - If **unsuspend**: Enqueues a start job, sets server status back to previous state.
   - If **delete**: Initiates server deletion (UC-07).
   - Updates `AbuseReport.status = RESOLVED` with resolution details.
   - Notifies server owner and người báo cáo (if applicable).
   - Writes audit log entries ([BR-19], [BR-20]).

## Luồng Thay Thế

### 37a — Phản Đối DMCA
- Server owner submits a DMCA counter-notice within the 48-hour window.
- Staff reviews đếmer-notice. If hợp lệ, server is unsuspended.
- The original reporter is notified of đếmer-notice per DMCA process.

### 37b — Lạm Dụng Hàng Loạt Từ Một Server
- If multiple abuse reports target the same server, they are được liên kết and reviewed as a single case.

### 37c — Phát Hiện Spam Tự Động
- System may auto-flag servers with high outbound SMTP traffic for manual abuse review.

## Luồng Ngoại Lệ

### EX-37-1 — Server Not Found
- The reported IP/hostname does not match any server in hệ thống.
- Staff marks báo cáo as DISMISSED with reason: "Server not found in our system."
- Reporter is notified: "The reported IP/hostname does not belong to our platform."

### EX-37-2 — Report Already Pending
- Hệ thống phát hiện a duplicate report for the same IP trong vòng 7 ngày.
- The new report is được liên kết to the existing case; người báo cáo receives: "This server is already under investigation."

### EX-37-3 — SLA Breach
- A report remains PENDING_REVIEW for > 24 hours ([BR-115]).
- System escalates báo cáo và gửi an admin alert: "Abuse report #[N] đã vượt quá the 24-hour SLA."

### EX-37-4 — Customer No-Response
- 48 hours pass without customer response ([BR-115]).
- System auto-escalates: server is automatically deleted. Staff is notified.

---

# UC-38: Accept Terms

| Attribute                 | Value                                                                                         |
|---------------------------|-----------------------------------------------------------------------------------------------|
| UC ID                     | UC-38                                                                                         |
| UC Name                   | Chấp Nhận Điều Khoản Dịch Vụ & Chính Sách Bảo Mật                                                      |
| Actor(s)                  | New User (unauthenticated → authenticated), Existing User (authenticated)                     |
| Priority                  | High                                                                                          |
| Trigger                   | Người dùng mới cố gắng tạo server đầu tiên; người dùng hiện tại đăng nhập sau khi điều khoản được cập nhật            |
| Pre-conditions            | Người dùng mới đã đăng ký. Người dùng hiện tại chưa chấp nhận phiên bản điều khoản mới nhất.         |
| Post-conditions (success) | Bản ghi chấp nhận điều khoản được tạo. Tạo server được mở khóa (người dùng mới). Phiên tiếp tục (người dùng hiện tại).|
| Post-conditions (failure) | Điều khoản không được chấp nhận. Tạo server bị chặn. Người dùng được chuyển hướng đến trang điều khoản.                   |
| Business Rules            | BR-105                                                                                        |
| Related UCs               | UC-01 (tạo server), UC-02 (đăng ký), UC-03 (đăng nhập)                                        |

## Luồng Chính

### Người Dùng Mới Chấp Nhận Điều Khoản

1. After registration (UC-02), the new user is redirected to bảng điều khiển.
2. When người dùng clicks "Tạo Server" for the first time, hệ thống checks: `Has người dùng accepted the current ToS version?`
3. If not, hệ thống redirects to the Terms Acceptance page instead of server creation form.
4. The page displays:
   - **Terms of Service** (full text, scrollable).
   - **Privacy Policy** (full text, scrollable).
   - Two hộp kiểm: "I have read and agree to the Terms of Service" and "I have read and agree to the Privacy Policy."
5. User scrolls to the bottom of each document (scroll detection enables hộp kiểmes).
6. User checks both boxes and clicks **Accept**.
7. Hệ thống tạo một `TermsAcceptance` record:
   - `userId`, `termsVersion` (current version string), `privacyPolicyVersion` (current version string), `acceptedAt`, `ipAddress`.
8. Hệ thống ghi một audit log entry ([BR-19]).
9. Hệ thống chuyển hướng user back to their intended destination.

### Người Dùng Hiện Tại Chấp Nhận Lại Điều Khoản Cập Nhật

1. Admin publishes a new version of the Terms of Service or Privacy Policy ([BR-105]).
2. On the next login (UC-03), after JWT issuance, hệ thống checks: `user.latestAcceptedTermsVersion < currentTermsVersion`.
3. If true, hệ thống hiển thị một interstitial page: "Our Terms of Service have been updated. Please review and accept thay đổis to continue."
4. The page highlights **what changed** (diff view of cập nhậtd sections).
5. User scrolls through cập nhậtd terms, checks chấp nhận boxes, and clicks **Accept**.
6. Hệ thống tạo một new `TermsAcceptance` record với new version ([BR-105]).
7. Hệ thống ghi một audit log entry ([BR-19]).
8. User proceeds to bảng điều khiển.

### Xem Lịch Sử Chấp Nhận

1. Người dùng điều hướng đến Profile > Legal.
2. Hệ thống hiển thị mộtll `TermsAcceptance` records for this user:
   - **Terms version**, **Privacy Policy version**, **Accepted date**, **IP address**.

## Luồng Thay Thế

### 38a — Bỏ Qua Cho Yêu Cầu API
- API-authenticated requests (API keys, CLI, Terraform) are not subject to điều khoản acceptance interstitial.
- However, new API keys cannot be generated until terms are accepted (trang API Keys is behind chấp nhận check).

### 38b — Admin Chấp Nhận Trước
- Admin sets the `currentTermsVersion` and `currentPrivacyPolicyVersion` in System Settings.
- Admin can preview chấp nhận page before publishing.

## Luồng Ngoại Lệ

### EX-38-1 — Terms Not Accepted (Server Creation Blocked)
- Hệ thống hiển thị: "You must accept the Terms of Service and Privacy Policy before creating your first server." ([BR-105])
- The "Create" button is bị vô hiệu hóa with a link to điều khoản page.

### EX-38-2 — Single Checkbox Not Checked
- Hệ thống hiển thị: "You must accept both the Terms of Service and Privacy Policy to continue."

---

# UC-39: Đồng Ý Cookie

| Attribute                 | Value                                                                                         |
|---------------------------|-----------------------------------------------------------------------------------------------|
| UC ID                     | UC-39                                                                                         |
| UC Name                   | Đồng Ý Cookie                                                                                |
| Actor(s)                  | Khách truy cập (chưa xác thực)                                                                     |
| Priority                  | Medium                                                                                        |
| Trigger                   | EU visitor lands on any page of the Astral Cloud website for the first time                   |
| Pre-conditions            | Visitor has not previously accepted or declined cookies (or consent has đã hết hạn after 12 months). IP geolocation indicates EU region (or visitor self-identifies). |
| Post-conditions (success) | Tùy chọn đồng ý được lưu trữ. Cookie phù hợp được đặt. Banner bị loại bỏ.                        |
| Post-conditions (failure) | Đồng ý không được lưu trữ. Chỉ cookie thiết yếu được đặt. Banner vẫn còn.                              |
| Business Rules            | BR-106                                                                                        |
| Related UCs               | None                                                                                          |

## Luồng Chính

### Hiển Thị Banner Cookie

1. A visitor (EU IP address detected via geolocation, or flagged by browser DNT/GPC signals) điều hướng đến any page on `astral.cloud`.
2. Hệ thống kiểm tra for an existing `CookieConsent` record (via a consent cookie or localStorage).
   - If consent exists and is < 12 months old ([BR-106]): no banner. Proceed to step 5.
   - If no consent or đã hết hạn: display the cookie banner.
3. Hệ thống kết xuất một cookie consent banner at the bottom of trang:
   - **Text**: "We use cookies to improve your experience. Essential cookies are bắt buộc for the site to function. You may accept all cookies or customize your preferences."
   - **Buttons**: "Accept All", "Customize", "Reject Non-Essential".
   - **Link**: "Cookie Policy" (full page).

### Chấp Nhận Tất Cả Cookie

1. Khách truy cập nhấp vào **Accept All**.
2. Hệ thống đặt một `CookieConsent` record (or cookie): `preferences = ALL`, `acceptedAt = now`, `expiresAt = now + 12 months` ([BR-106]).
3. Hệ thống đặt mộtll cookies: essential (auth, CSRF) + analytics + marketing.
4. Banner disappears.

### Tùy Chỉnh Tùy Chọn

1. Khách truy cập nhấp vào **Customize**.
2. System expands banner (or opens a modal) with cookie categories:
   - **Essential** (locked ON, cannot be bị vô hiệu hóa): Session authentication, CSRF token, cookie consent itself. ([BR-106])
   - **Analytics** (bật/tắtable): Google Analytics, Plausible, or self-hosted analytics — page views, referral data.
   - **Marketing** (bật/tắtable): Ad tracking pixels, retargeting.
3. Each category shows a description of what data is collected and for what purpose.
4. Visitor bật categories ON/OFF and clicks **Save Preferences**.
5. Hệ thống đặt một `CookieConsent` record: `preferences = CUSTOM`, analytics = true/false, marketing = true/false, `expiresAt = now + 12 months`.
6. Hệ thống đặt only the approved cookie categories.
7. Banner disappears.

### Từ Chối Cookie Không Thiết Yếu

1. Khách truy cập nhấp vào **Reject Non-Essential**.
2. Hệ thống đặt một `CookieConsent` record: `preferences = ESSENTIAL_ONLY`, `expiresAt = now + 12 months` ([BR-106]).
3. Hệ thống đặt only essential cookies ([BR-106]).
4. Banner disappears.

### Xem Lại Tùy Chọn

1. At any time, khách truy cập có thể nhấp "Cookie Settings" in the footer.
2. System re-opens the preference modal showing current choices.
3. Visitor có thể thay đổi preferences and save.
4. Hệ thống cập nhật `CookieConsent` record.

### Hết Hạn Đồng Ý

1. After 12 months from acceptance, consent expires ([BR-106]).
2. On the next visit, banner is re-displayed and khách truy cập must re-consent.
3. Previously set non-essential cookies are cleared.

## Luồng Thay Thế

### 39a — Khách Truy Cập Ngoài EU
- Hệ thống phát hiện non-EU IP via geolocation.
- Essential cookies are set immediately.
- Non-essential cookies are set immediately (subject to browser settings).
- No consent banner is displayed by mặc định (a smaller "We use cookies" notice with a link to Cookie Policy may appear).

### 39b — Tín Hiệu Global Privacy Control (GPC)
- Browser sends `Sec-GPC: 1` header or `navigator.globalPrivacyControl` is set.
- System treats this as "Reject Non-Essential" by mặc định, regardless of IP region.
- The cookie banner still appears but "Reject Non-Essential" is pre-selected.

## Luồng Ngoại Lệ

### EX-39-1 — Consent Storage Failure
- If đồng ý cookie/localStorage write fails (blocked by browser settings):
  - Hệ thống ghi log a warning.
  - Essential cookies still function.
  - Banner reappears on next page load.

### EX-39-2 — Geolocation Uncó sẵn
- If IP geolocation service is không thể truy cập, system mặc địnhs to showing đồng ý banner (conservative approach).

---

# UC-40: Mạo Danh Admin

| Attribute                 | Value                                                                                         |
|---------------------------|-----------------------------------------------------------------------------------------------|
| UC ID                     | UC-40                                                                                         |
| UC Name                   | Mạo Danh Admin                                                                           |
| Actor(s)                  | Admin (đã xác thực, role = ADMIN)                                                           |
| Priority                  | Medium                                                                                        |
| Trigger                   | Admin điều hướng đến a user detail page and clicks "Impersonate"                                |
| Pre-conditions            | Admin đã đăng nhập. 2FA phải được bật ([BR-24]). Target user exists and không an admin.    |
| Post-conditions (success) | Admin đăng nhập với tư cách người dùng mục tiêu. Banner trực quan hiển thị. Đầy đủ audit trail được ghi lại.    |
| Post-conditions (failure) | Impersonation not started. Lỗi được ghi log.                                                      |
| Business Rules            | BR-109, BR-20                                                                                 |
| Related UCs               | UC-24 (quản lý nền tảng), UC-03 (đăng nhập)                                                    |

## Luồng Chính

### Khởi Tạo Mạo Danh

1. Admin điều hướng đến Admin > Users and nhấp vào a target user.
2. On người dùng detail page, admin clicks **Impersonate**.
3. Hệ thống hiển thị một confirmation dialog: "You are about to log in as [username]. All actions you take will be recorded in audit log under both your account and the target user's account. Are you sure?"
4. Admin nhấp vào **Xác Nhận**.
5. Hệ thống xác thực:
   - Admin has 2FA được bật ([BR-24]).
   - Target user không an ADMIN (admin-to-admin impersonation is blocked).
6. Hệ thống tạo mộtn **impersonation session**:
   - Generates a new JWT access token with:
     - `sub = targetUserId` (target user ID).
     - `impersonatedBy = adminUserId` (admin's user ID).
     - `sessionType = IMPERSONATION`.
     - Short expiry (15 minutes, [BR-109]).
   - Creates an `ImpersonationSession` record: `adminUserId`, `targetUserId`, `startedAt`, `ipAddress`.
   - Writes an audit log entry: action = `IMPERSONATION_START`, actor = adminUserId, target = targetUserId ([BR-20], [BR-109]).
7. Hệ thống đặt impersonation token as the đang hoạt động session.

### Xem Giao Diện với Tư Cách Người Dùng Mục Tiêu

1. Admin is redirected to the target user's dashboard (UC-04).
2. A **persistent visual banner** is rendered at the top of every page ([BR-109]):
   - Yellow/amber background stripe.
   - Text: "You are impersonating **[username]**. All actions are audited. [End Impersonation]"
   - The banner cannot be dismissed.
3. Every API request made during the impersonation session is tagged với impersonation context.
4. All audit log entries written during phiên record both the impersonated user and admin ([BR-109], [BR-19]).

### Thực Hiện Hành Động

1. Admin có thể điều hướng giao diện người dùng as the target user: view servers, create servers, manage volumes, view billing, etc.
2. Each state-changing action generates an audit log entry with:
   - `actorUserId = targetUserId` (the impersonated account).
   - `impersonatedByUserId = adminUserId` (admin who initiated).
   - `sessionType = IMPERSONATION`.
3. Admin cannot access admin-only pages while impersonating — attempts redirect to the target user's dashboard.

### Kết Thúc Mạo Danh

1. Admin nhấp vào **End Impersonation** in the yellow banner.
2. OR impersonation session expires after 15 minutes ([BR-109]).
3. System:
   - Invalidates the impersonation JWT.
   - Updates `ImpersonationSession.endedAt = now`.
   - Writes an audit log entry: action = `IMPERSONATION_END`, actor = adminUserId, target = targetUserId ([BR-20], [BR-109]).
   - Re-issues admin's original session token.
4. Admin is redirected to the Admin Dashboard.

### Xem Audit Trail Mạo Danh

1. Admin điều hướng đến Admin > Audit Logs.
2. Admin filters by action = IMPERSONATION_START, IMPERSONATION_END.
3. Hệ thống hiển thị mộtll impersonation sessions:
   - **Admin**, **Target User**, **Started**, **Ended**, **Actions Performed** count.
4. Clicking a session shows every audit log entry generated during that session.

## Luồng Thay Thế

### 40a — Hết Hạn Phiên Mạo Danh
- If admin is inđang hoạt động trong 15 phút, the impersonation token expires.
- Admin sees: "Impersonation session đã hết hạn. You have been returned to your admin account."
- Admin is redirected to the Admin Dashboard.

### 40b — Gỡ Lỗi Tự Phục Vụ Người Dùng Mục Tiêu
- Not a true impersonation, but admin có thể xem a "Login as user" preview that hiển thị rendered dashboard without the ability to perform actions (chỉ đọc mode).

## Luồng Ngoại Lệ

### EX-40-1 — Target Is Admin
- Hệ thống hiển thị: "Cannot impersonate another admin user."

### EX-40-2 — Admin 2FA Not Enabled
- Hệ thống hiển thị: "You must enable two-factor authentication before using impersonation." ([BR-24])

### EX-40-3 — Concurrent Impersonation
- An admin already has an đang hoạt động impersonation session.
- Hệ thống hiển thị: "You have an đang hoạt động impersonation session for [username]. End it before starting a new one."

---

# UC-41: Quản Lý Feature Flag

| Attribute                 | Value                                                                                         |
|---------------------------|-----------------------------------------------------------------------------------------------|
| UC ID                     | UC-41                                                                                         |
| UC Name                   | Quản Lý Feature Flag                                                                          |
| Actor(s)                  | Admin (đã xác thực, role = ADMIN)                                                           |
| Priority                  | Medium                                                                                        |
| Trigger                   | Admin điều hướng đến Admin > Feature Flags                                                      |
| Pre-conditions            | Admin đã đăng nhập. 2FA phải được bật ([BR-24]).                                            |
| Post-conditions (success) | Feature flag được tạo, bật/tắt hoặc cấu hình. Audit log được ghi.                              |
| Post-conditions (failure) | Không có thay đổi trạng thái. Lỗi hiển thị.                                                             |
| Business Rules            | BR-110, BR-20                                                                                 |
| Related UCs               | UC-24 (quản lý nền tảng)                                                                   |

## Luồng Chính

### Liệt Kê Feature Flag

1. Admin điều hướng đến Admin > Feature Flags.
2. Hệ thống hiển thị bảng tất cả feature flag:
   - **Key** (duy nhất identifier, e.g., `beta_dashboard`, `new_billing_ui`)
   - **Name** (human-readable)
   - **Description**
   - **Status** (ENABLED, DISABLED, CONDITIONAL)
   - **Rollout Rules**: per-user, per-role, percentage
   - **Last evaluated** (timestamp, [BR-110])
   - **Stale indicator** (⚠ if no evaluation in > 90 days, [BR-110])
   - **Created date**
   - **Actions**: Edit, Toggle, Delete

### Tạo Feature Flag

1. Admin nhấp vào **Tạo Feature Flag**.
2. Admin điền vào:
   - **Key** (duy nhất, alphanumeric + underscores, e.g., `beta_dashboard`).
   - **Name** (human-readable label).
   - **Description** (explaining what flag controls).
   - **Type** (BOOLEAN bật/tắt or MULTIVARIATE with values).
3. Admin nhấp vào **Create**.
4. Hệ thống tạo `FeatureFlag` record with `được bật = false` by mặc định.
5. Hệ thống ghi một audit log entry ([BR-20]).

### Cấu Hình Quy Tắc Flag

1. Admin nhấp **Chỉnh Sửa** trên feature flag.
2. Admin configures **rollout rules** ([BR-110]):
   - **Global bật/tắt**: ON/OFF — overrides all other rules.
   - **Per-User**: Add specific user IDs or usernames to an allowlist or denylist.
   - **Per-Role**: Enable for CUSTOMER, STAFF, ADMIN roles individually.
   - **Percentage Rollout**: Enable for X% of users (deterministic hash of userId). Options: 1%, 5%, 10%, 25%, 50%, 75%, 100%.
3. Rules are evaluated in priority order:
   - Denylist (if user is denylisted → OFF).
   - Allowlist (if user is allowlisted → ON).
   - Role-based (if user's role matches → ON).
   - Percentage (hash(userId) % 100 < percentage → ON).
   - Default: OFF.
4. Admin saves cấu hình.
5. Hệ thống ghi một audit log entry ([BR-20]).

### Bật/Tắt Feature Flag

1. Admin nhấp vào the **Quick Toggle** on a flag to enable/disable globally.
2. This sets the global bật/tắt and does not affect other rules.
3. Hệ thống ghi một audit log entry ([BR-20]).

### Xóa Feature Flag

1. Admin nhấp vào **Delete** on a flag that has been fully rolled out (100%) and had no evaluations in > 30 days.
2. Hệ thống nhắc: "Delete feature flag '[name]'? Ensure all code references to this flag have been removed."
3. Admin xác nhận.
4. Hệ thống xóa `FeatureFlag` record.
5. Hệ thống ghi một audit log entry ([BR-20]).

### Đánh Giá Flag Phía Hệ Thống

1. On every API request (or application startup for global flags), hệ thống evaluates all đang hoạt động feature flags.
2. Each evaluation updates `lastEvaluatedAt` on flag.
3. A cron job runs daily:
   - Identifies flags with `lastEvaluatedAt` older than 90 days ([BR-110]).
   - Sends an admin alert: "Feature flag '[key]' has not been evaluated in 90+ days. Consider removing it."

### Xem Lịch Sử Đánh Giá Flag

1. From tính năng flag list, admin clicks **History** on a flag.
2. Hệ thống hiển thị một timeline of:
   - **Config changes** (who changed what and when).
   - **Evaluation count** (daily count of flag checks).
   - **Evaluation percentage** (what % of requests had flag ON vs OFF).

## Luồng Thay Thế

### 41a — Giám Sát Triển Khai Dần
- For percentage rollouts, admin có thể xem a metrics dashboard showing:
  - Users with flag ON vs OFF.
  - Error rates, latency, or conversion rates split by flag state (requires integration with observability).

### 41b — Phụ Thuộc Flag
- A feature flag can reference a parent flag: "Only evaluate this flag if the parent flag is được bật."
- Useful for nested feature rollouts.

## Luồng Ngoại Lệ

### EX-41-1 — Duplicate Key
- Hệ thống hiển thị: "A feature flag with this key already exists."

### EX-41-2 — Stale Flag Alert
- System alerts admin: "Feature flag '[key]' has not been evaluated in 90+ days." ([BR-110])

### EX-41-3 — Flag Not Found (Code)
- Application code references a feature flag that has been deleted.
- System mặc địnhs flag to OFF and logs a warning: "Unknown feature flag: [key]."

---

# UC-42: Bảng Điều Khiển Doanh Thu

| Attribute                 | Value                                                                                         |
|---------------------------|-----------------------------------------------------------------------------------------------|
| UC ID                     | UC-42                                                                                         |
| UC Name                   | Bảng Điều Khiển Doanh Thu                                                                             |
| Actor(s)                  | Admin (đã xác thực, role = ADMIN)                                                           |
| Priority                  | Low                                                                                           |
| Trigger                   | Admin điều hướng đến Admin > Bảng Điều Khiển Doanh Thu                                                  |
| Pre-conditions            | Admin đã đăng nhập. 2FA phải được bật ([BR-24]). Billing data aggregation is up to date.    |
| Post-conditions (success) | Chỉ số doanh thu hiển thị với biểu đồ và tóm tắt.                                          |
| Post-conditions (failure) | Lỗi tải chỉ số.                                                                        |
| Business Rules            | BR-111, BR-94                                                                                 |
| Related UCs               | UC-10 (ví), UC-11 (áp dụng voucher), UC-21 (quản lý voucher), UC-24 (quản lý nền tảng)   |

## Luồng Chính

### Xem MRR (Doanh Thu Định Kỳ Hàng Tháng)

1. Admin điều hướng đến Admin > Bảng Điều Khiển Doanh Thu.
2. Hệ thống truy vấn billing aggregates (refreshed daily per [BR-111]) và hiển thị:
   - **Current MRR**: Sum of all đang hoạt động monthly and annual billing subscriptions (annual shown as monthly equivalent).
   - **MRR Trend**: Line chart of MRR over the last 12 months.
   - **MRR Breakdown**: By plan (Starter, Pro, Enterprise, Custom), stacked bar chart.
   - **MRR Change**: Month-over-month growth (absolute $ and percentage).

### Xem Tỷ Lệ Rời Bỏ & Giữ Chân

1. Hệ thống hiển thị churn metrics:
   - **Monthly Churn Rate**: (Customers lost this month / Customers at start of month) × 100%.
   - **Revenue Churn**: MRR lost from cancellations vs MRR gained from new subscriptions.
   - **Net Revenue Retention**: (Existing MRR + Expansion − Contraction − Churn) / Existing MRR × 100%.
   - **Churn by Plan**: Churn rate broken down by plan tier.
   - **Churn by Cohort**: Retention curve showing what percentage of customers from each monthly cohort are still đang hoạt động after 1, 3, 6, 12 months.

### Xem Tỷ Lệ Chuyển Đổi

1. Hệ thống hiển thị conversion metrics:
   - **Registration → First Server**: Percentage of registered users who create a first server trong vòng 7 ngày.
   - **Free Trial → Paid**: If trials are offered, conversion rate from trial to paying customer.
   - **Top-Up Conversion**: Percentage of users who add funds vs those who only browse.
   - **Top-Up Value Distribution**: Histogram of top-up amounts ($5, $10, $25, $50, $100+).

### Xem Hiệu Suất Voucher

1. Hệ thống hiển thị voucher metrics ([BR-111]):
   - **Top Redeemed Vouchers**: Table of vouchers sorted by total redemptions (code, times used, total discount given, conversion rate).
   - **Voucher-Driven Revenue**: Revenue from payments where a voucher was applied.
   - **Voucher Redemption Trend**: Line chart of voucher redemptions per month.
   - **Voucher Stacking Rate**: Percentage of payments using multiple vouchers.

### Xem Chỉ Số Server

1. Hệ thống hiển thị server counts by plan ([BR-111]):
   - **Total Active Servers**: Count with trend line.
   - **Servers by Plan**: Bar chart showing counts for Starter, Pro, Enterprise, Custom.
   - **Servers by Region**: Heatmap or bar chart showing distribution across data centers.
   - **Avg Server Lifetime**: Average duration between creation and deletion.

### Xem Tóm Tắt Doanh Thu

1. Hệ thống hiển thị một summary card at the top:
   - **Total Revenue (MTD)**: All payments this month.
   - **Total Revenue (YTD)**: All payments this year.
   - **Average Revenue Per User (ARPU)**: Total revenue / đang hoạt động users.
   - **Customer Lifetime Value (LTV)**: ARPU × average customer lifetime.
   - **Customer Acquisition Cost (CAC)**: (Marketing spend + sales cost) / new customers acquired ([BR-111]).

### Lọc & Khoảng Thời Gian

1. Admin có thể chọn:
   - **Date range**: Last 7 days, 30 days, 90 days, 12 months, custom range.
   - **Granularity**: Daily, weekly, monthly.
   - **Region**: Filter metrics by data center region.
   - **Plan**: Filter by ServerPlan.
2. All charts and metrics update to reflect the selected filters.

### Xuất Báo Cáo Doanh Thu

1. Admin nhấp vào **Xuất Báo Cáo**.
2. Hệ thống tạo một PDF or CSV summary of bảng điều khiển data for the selected period.
3. The export includes all charts as images and raw data bảngs.

## Luồng Thay Thế

### 42a — Theo Dõi Doanh Thu Thời Gian Thực
- Admin can bật/tắt a real-time mode that shows revenue events as they happen (server creation, top-up, hourly deduction) in a scrolling ticker.

### 42b — Báo Cáo Doanh Thu Định Kỳ
- Admin configures a weekly or monthly email report with key metrics automatically generated and sent to admin/staff.

## Luồng Ngoại Lệ

### EX-42-1 — Aggregation Not Ready
- Billing aggregation job is still running or has thất bại.
- Hệ thống hiển thị: "Revenue data is being refreshed. Some metrics may not reflect the latest transactions. Last refreshed: [timestamp]."

### EX-42-2 — No Data
- If nền tảng has no billing data (pre-launch), system displays: "No revenue data có sẵn yet."

---

# UC-43: Diễn Tập Khắc Phục Thảm Họa

| Attribute                 | Value                                                                                         |
|---------------------------|-----------------------------------------------------------------------------------------------|
| UC ID                     | UC-43                                                                                         |
| UC Name                   | Diễn Tập Khắc Phục Thảm Họa                                                                       |
| Actor(s)                  | Admin (đã xác thực, role = ADMIN)                                                           |
| Priority                  | High                                                                                          |
| Trigger                   | Scheduled quarterly DR drill (per [BR-98]) or admin-initiated manual drill                    |
| Pre-conditions            | Admin đã đăng nhập. 2FA đã được bật ([BR-24]). Bản sao lưu mới nhất tồn tại và đã được xác minh. Môi trường đích sạch có sẵn. |
| Post-conditions (success) | Nền tảng được khôi phục từ bản sao lưu sang môi trường sạch. RTO và RPO được xác minh. Báo cáo diễn tập được nộp.  |
| Post-conditions (failure) | Khôi phục thất bại. Nguyên nhân gốc được xác định. Sự cố được ghi log.                                   |
| Business Rules            | BR-97, BR-98, BR-99, BR-20                                                                    |
| Related UCs               | UC-24 (quản lý nền tảng), UC-20 (manage infrastructure)                                    |

## Luồng Chính

### Chuẩn Bị Diễn Tập DR

1. Admin điều hướng đến Admin > Disaster Recovery.
2. Hệ thống hiển thị DR drill dashboard:
   - **Last drill date**: [timestamp]
   - **Next scheduled drill**: [date] (quarterly per [BR-98])
   - **Last backup**: [timestamp] (every 6 hours per [BR-98])
   - **Backup integrity**: VERIFIED / UNVERIFIED / FAILED
   - **Target environment**: Available / Uncó sẵn
3. Admin nhấp vào **Bắt Đầu Diễn Tập DR** (or lịch trình triggers automatically).
4. Hệ thống hiển thị DR runbook checklist ([BR-99]):
   - [ ] Notify team of upcoming drill.
   - [ ] Verify latest backup integrity.
   - [ ] Provision or confirm clean target environment.
   - [ ] Execute restore.
   - [ ] Verify platform functionality.
   - [ ] Measure RTO and RPO.
   - [ ] File drill report.
5. Admin xác nhận each pre-flight check.

### Xác Minh Tính Toàn Vẹn Bản Sao Lưu

1. Hệ thống truy vấn latest database backup (full backup every 6 hours, point-in-time recovery per [BR-98]).
2. Hệ thống xác minh:
   - Backup file exists and is within expected size range.
   - Backup checksum matches the stored checksum.
   - Backup can be decrypted (if encrypted at rest).
3. Hệ thống hiển thị: "Backup integrity: VERIFIED. Backup timestamp: [timestamp]. Size: [X] GB."
4. If a full backup không có sẵn (e.g., corrupted), system attempts the previous backup.
5. If no hợp lệ backup within 12 hours, diễn tập is aborted and admin is alerted.

### Cung Cấp Môi Trường Sạch

1. Hệ thống sử dụng infrastructure-as-code (Terraform) declarations to provision a clean environment ([BR-97]):
   - Compute instances for: Next.js app, BullMQ worker(s), PostgreSQL, Redis, Docker registry, storage services.
   - Network: VPC, subnets, security groups, load balancer.
   - The environment is isolated from production (no cross-environment traffic).
2. Admin can also manually provision or confirm an existing staging environment.
3. Hệ thống xác nhận target environment is ready.

### Thực Thi Khôi Phục

1. Admin nhấp vào **Thực Thi Khôi Phục**.
2. Hệ thống thực thi documented restore procedure ([BR-98], [BR-99]):
   - **Database**: Restores the latest full backup to the clean PostgreSQL instance. Applies Write-Ahead Log (WAL) segments for point-in-time recovery to the latest có sẵn transaction. Runs all migrations to ensure schema is current.
   - **Redis**: Seeds from backup or starts fresh (session data is disposable).
   - **Object Storage**: Restores server images, backup archives, invoice PDFs from backup.
   - **Docker Registry**: Restores container image metadata.
   - **DNS / Configuration**: Configures application environment variables to point at the clean environment's services.
   - **Smoke Test Data**: Generates or restores anonymized test customer data for verification.
3. Hệ thống bắt đầu application stack: Next.js, workers, Nginx/WAF.
4. Hệ thống chạy database migrations to ensure schema is current.
5. Hệ thống hiển thị một live progress log of each restoration step.

### Xác Minh Chức Năng Nền Tảng

1. Once stack is running, hệ thống executes automated verification checks:
   - **API health**: `GET /api/health` returns 200.
   - **Database connectivity**: Can query users, servers, and billing data.
   - **Authentication**: Can register a new user, log in, and receive a hợp lệ JWT.
   - **Server lifecycle**: Can create a test server (using a minimal test plan), start it, stop it, delete it.
   - **Billing**: Can look up wallet balances and payment history.
   - **Web UI**: Key pages render without errors (dashboard, server list, billing).
   - **Worker processing**: A test job is enqueued and processed by a BullMQ worker.
2. System reports each check as PASSED or FAILED.

### Đo Lường RTO và RPO

1. Hệ thống tính toán:
   - **RTO (Recovery Time Objective)**: Time elapsed from "Execute Restore" click to "All verification checks passed." Target: ≤ 4 hours ([BR-98]).
   - **RPO (Recovery Point Objective)**: Difference between the last restored transaction timestamp and thời gian diễn tập started. Target: ≤ 6 hours ([BR-98]).
2. Hệ thống hiển thị:
   - **RTO**: [X] hours [Y] minutes (Target: ≤ 4h) — PASSED / FAILED
   - **RPO**: [X] hours [Y] minutes (Target: ≤ 6h) — PASSED / FAILED

### Nộp Báo Cáo Diễn Tập

1. Hệ thống tự động tạo a DR drill report:
   - **Drill date** and **participants**.
   - **Backup used**: timestamp, size, integrity check.
   - **Restoration steps log** (with timestamps for each step).
   - **Verification results** (checklist with pass/fail).
   - **RTO**: measured vs target.
   - **RPO**: measured vs target.
   - **Issues encountered** and **remediation notes**.
2. Admin adds manual notes and observations.
3. Admin nhấp vào **Nộp Báo Cáo**.
4. Hệ thống lưu trữ `DrillReport` record and its PDF.
5. Hệ thống ghi một audit log entry ([BR-20]).
6. Hệ thống gửi report to admin team.

### Dọn Dẹp Môi Trường Sạch

1. Admin nhấp vào **Dọn Dẹp Môi Trường**.
2. System deprovisions all resources in the clean environment to avoid ongoing costs.
3. System confirms teardown and logs sự kiện.

## Luồng Thay Thế

### 43a — Khôi Phục Từng Thành Phần
- Admin can drill a specific component (e.g., database only) instead of the full platform.
- Useful for testing specific recovery procedures without provisioning the full stack.

### 43b — Diễn Tập Thủ Công
- Admin có thể khởi tạo an unscheduled manual drill at any time.
- Same procedure as scheduled drill; documented as "unscheduled" in báo cáo.

### 43c — Chạy Thử (Chỉ Xác Thực)
- Admin runs a "dry run" that verifies backup integrity and environment provisioning without actually restoring data.
- Confirms readiness without affecting any systems.

## Luồng Ngoại Lệ

### EX-43-1 — Backup Corrupted
- Last backup fails integrity check.
- Hệ thống hiển thị: "Latest backup is corrupted. Attempting previous backup."
- If the previous backup is also corrupted, system alerts: "No hợp lệ backup within 12 hours. DR drill aborted." ([BR-98])
- Admin must investigate backup pipeline.

### EX-43-2 — Environment Provisioning Failed
- Target environment fails to provision (e.g., cloud provider capacity issues).
- Hệ thống hiển thị: "Failed to provision target environment. Reason: [error]. Drill aborted."
- Admin có thể thử lại with different region or instance types.

### EX-43-3 — RTO Exceeded
- Restoration takes longer than 4 hours ([BR-98]).
- System highlights this in red on báo cáo: "RTO exceeded. Target: 4h, Actual: [X]h [Y]m."
- Admin adds root cause analysis to báo cáo.

### EX-43-4 — RPO Exceeded
- Latest backup is older than 6 hours ([BR-98]).
- System highlights this in red: "RPO exceeded. Target: 6h, Actual: [X]h [Y]m."
- Indicates backup pipeline issues that need investigation.

### EX-43-5 — Verification Failure
- One or more automated checks fail.
- Hệ thống hiển thị thất bại check with details.
- Admin có thể thủ công verify and override, or abort diễn tập.
- Failures are documented in diễn tập report.

### EX-43-6 — Drill In Progress
- A DR drill is already in progress.
- Hệ thống hiển thị: "A disaster recovery drill is already in progress. Started at [timestamp]."


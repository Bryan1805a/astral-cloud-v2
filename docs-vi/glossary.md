# Thuật Ngữ (Ngôn Ngữ Chung)

Thuật ngữ này định nghĩa mọi thuật ngữ chuyên ngành được sử dụng trong toàn bộ mã nguồn, tài liệu, API và giao diện người dùng của Astral Cloud. Tất cả người đóng góp phải sử dụng các thuật ngữ này một cách nhất quán.

---

## Miền Lõi: Máy Chủ & Hạ Tầng

| Thuật Ngữ               | Định Nghĩa                                                                                                   |
|-------------------------|---------------------------------------------------------------------------------------------------------------|
| **Server**              | Một phiên bản Ubuntu được container hóa do khách hàng thuê, triển khai trên một Docker host. Được cung cấp trong vài giây.      |
| **Server Instance**     | Bản ghi cơ sở dữ liệu đại diện cho một server duy nhất (`ServerInstance`). Bao gồm hostname, IP, trạng thái, tài nguyên.|
| **Node**                | Một máy chủ vật lý chạy Docker Engine, có khả năng lưu trữ nhiều server instance.                        |
| **Container Runtime**   | Lớp phần mềm tạo và quản lý container. Trong dự án này: Docker Engine.                       |
| **Provisioning**        | Quá trình tạo một Docker container: kéo image, phân bổ tài nguyên, cấu hình mạng, khởi động.|
| **Lifecycle**           | Tập hợp các trạng thái mà một server trải qua: CREATING → ACTIVE ↔ STOPPED → DELETED.                       |
| **Region**              | Một nhóm logic các Node vật lý trong cùng một trung tâm dữ liệu địa lý.                                     |
| **IP Pool**             | Một dải địa chỉ IP công cộng có sẵn để gán cho các server instance trên một node. Được quản lý qua bảng `IpAddress` — mỗi dòng là FREE (`serverId = NULL`) hoặc đã được phân bổ. Việc phân bổ IP là nguyên tử, được dành riêng trong cùng một giao dịch DB với dung lượng node. |
| **Server Plan**         | Một bộ tài nguyên tính toán được định sẵn (vCPU, RAM, disk) được cung cấp với giá cố định.                            |
| **Image Template**      | Một image container hệ điều hành được cấu hình sẵn có sẵn để tạo server (ví dụ: "Ubuntu 24.04 LTS").                |
| **Snapshot**            | Một bản sao tại một thời điểm của ổ dữ liệu của server, được lưu để khôi phục hoặc nhân bản sau này.                       |
| **Custom Specs**        | Một cấu hình tài nguyên do khách hàng định nghĩa, không tương ứng với bất kỳ ServerPlan định sẵn nào.              |

---

## Thanh Toán & Tài Chính

| Thuật Ngữ             | Định Nghĩa                                                                                                   |
|-----------------------|---------------------------------------------------------------------------------------------------------------|
| **Wallet**            | Số dư trả trước của tài khoản mà từ đó các khoản phí server được khấu trừ.                                         |
| **Balance**           | Số tiền hiện có trong wallet của khách hàng.                                                 |
| **Billing Model**     | Cách một server được tính phí: `MONTHLY` (tự động gia hạn) hoặc `HOURLY` (trả theo mức sử dụng).                                 |
| **Top-Up**            | Thêm tiền vào wallet qua cổng thanh toán (Stripe).                                                        |
| **Invoice**           | Một bản ghi bất biến của một giao dịch thanh toán (tính phí hoặc nạp tiền). Được tạo dưới dạng PDF có thể tải xuống.             |
| **Payment Method**    | Một đại diện đã được token hóa của phương thức thanh toán của khách hàng (Stripe PaymentMethod).                         |
| **Grace Period**      | Khoảng thời gian 24 giờ sau khi tự động khấu trừ thất bại trước khi một server bị dừng.                                  |
| **Voucher**           | Một mã giảm giá (coupon) làm giảm số tiền bị tính phí. Có thể dựa trên phần trăm hoặc số tiền cố định.            |
| **Voucher Usage**     | Một bản ghi liên kết việc đổi voucher với một người dùng cụ thể và tùy chọn một khoản thanh toán.                            |

---

## Xác Thực & Bảo Mật

| Thuật Ngữ             | Định Nghĩa                                                                                                   |
|-----------------------|---------------------------------------------------------------------------------------------------------------|
| **Access Token**      | Một JWT có thời hạn ngắn (1 giờ) dùng để xác thực các yêu cầu API.                                                 |
| **Refresh Token**     | Một token opaque có thời hạn dài hơn (7 ngày) được lưu trong cookie HTTP-only để gia hạn token một cách âm thầm.                 |
| **Session**           | Trạng thái đã xác thực của người dùng. Người dùng có thể có tối đa 5 session đang hoạt động.                                         |
| **Account Lock**      | Một khóa tạm thời không cho đăng nhập (15 phút) sau 5 lần thử đăng nhập thất bại liên tiếp trong vòng 10 phút.               |
| **Role**              | Cấp quyền của người dùng: `CUSTOMER`, `STAFF`, hoặc `ADMIN`.                                                  |
| **2FA**               | Xác thực hai yếu tố qua TOTP (Mật Khẩu Một Lần Dựa Trên Thời Gian). Bắt buộc đối với tài khoản admin.              |
| **API Key**           | Một thông tin xác thực có thời hạn dài cho truy cập API theo chương trình. Có phạm vi là quyền của người dùng đã tạo nó.               |
| **Idempotency Key**   | Một header UUID ngăn chặn các thao tác trùng lặp khi thử lại yêu cầu. Phạm vi theo từng người dùng, TTL 24 giờ.        |

---

## Hỗ Trợ & Nội Dung

| Thuật Ngữ             | Định Nghĩa                                                                                                   |
|-----------------------|---------------------------------------------------------------------------------------------------------------|
| **Ticket**            | Một yêu cầu hỗ trợ do khách hàng mở, được gán cho nhân viên để giải quyết.                                    |
| **Ticket Message**    | Một tin nhắn riêng lẻ trong một luồng ticket (từ khách hàng hoặc nhân viên).                                        |
| **Blog Post**         | Một bài viết đã xuất bản trên blog của nền tảng. Có thể là DRAFT, PUBLISHED, hoặc ARCHIVED.                            |
| **Blog Category**     | Một nhóm cho các bài đăng blog (ví dụ: "Tutorials," "Changelog," "News").                                          |
| **Announcement**      | Một thông báo toàn nền tảng hiển thị cho tất cả người dùng (ví dụ: cửa sổ bảo trì, tính năng mới).                        |

---

## Mạng & Các Tính Năng Bảo Mật

| Thuật Ngữ             | Định Nghĩa                                                                                                   |
|-----------------------|---------------------------------------------------------------------------------------------------------------|
| **Firewall Rule**     | Một quy tắc lưu lượng đến theo từng server, chỉ định giao thức, cổng, CIDR nguồn và hành động (ALLOW/DENY).            |
| **Firewall Group**    | Một tập hợp có tên các quy tắc firewall có thể được áp dụng cho nhiều server (trì hoãn).                      |
| **DNS Record**         | Một bản ghi DNS xuôi (A, AAAA, CNAME, MX, TXT) cho tên miền của server.                                        |
| **DNS Zone**           | Một nhóm logic các bản ghi DNS cho một tên miền (trì hoãn — MVP sử dụng bản ghi theo từng server).                     |
| **Reverse DNS (PTR)**  | Một bản ghi DNS ánh xạ địa chỉ IP trở lại hostname.                                                        |

---

## Quản Lý Dữ Liệu

| Thuật Ngữ             | Định Nghĩa                                                                                                   |
|-----------------------|---------------------------------------------------------------------------------------------------------------|
| **Backup**            | Một bản snapshot tại một thời điểm của ổ dữ liệu của server, được lưu để khôi phục sau thảm họa.                             |
| **Backup Schedule**   | Một cấu hình xác định tần suất chạy backup tự động và thời gian lưu giữ chúng.                      |
| **GDPR Request**      | Một yêu cầu chính thức từ khách hàng để xuất hoặc xóa tất cả dữ liệu cá nhân của họ.                                 |
| **Referral**          | Một bản ghi về việc một người dùng giới thiệu người dùng khác. Cả hai bên nhận được tín dụng khi người được giới thiệu thanh toán lần đầu.       |
| **Referral Payout**   | Một lần rút tín dụng giới thiệu đã tích lũy khi đạt đến ngưỡng.                                       |
| **VpsTag**            | Một nhãn do người dùng định nghĩa áp dụng cho một server để tổ chức và lọc.                                      |
| **IpAddress**          | Một bản ghi đại diện cho một IP công cộng duy nhất trong IP pool của một node. Theo dõi IP đó là FREE hay đã được phân bổ cho một server cụ thể. |

---

## Xử Lý Bất Đồng Bộ

| Thuật Ngữ             | Định Nghĩa                                                                                                   |
|-----------------------|---------------------------------------------------------------------------------------------------------------|
| **Job**               | Một đơn vị công việc được đưa vào hàng đợi BullMQ để xử lý bất đồng bộ (provision, start, stop, delete, backup, notify).     |
| **Queue**             | Một danh sách công việc có tên, được sắp xếp thứ tự, được hỗ trợ bởi Redis.                                                                |
| **Worker**            | Một tiến trình Node.js riêng biệt lấy và thực thi các job từ các hàng đợi BullMQ.                               |
| **Idempotency**       | Tính chất mà việc chạy một job N lần tạo ra cùng một trạng thái cuối cùng như chạy một lần.                    |
| **Idempotency Guard** | Mã ở đầu mỗi job handler truy vấn Docker để lấy trạng thái thực tế trước khi hành động.               |
| **Dead-Letter Queue** | Chứa các job đã hết tất cả các lần thử lại. Yêu cầu admin điều tra.                             |

---

## Cơ Sở Dữ Liệu & Trạng Thái

| Thuật Ngữ             | Định Nghĩa                                                                                                   |
|-----------------------|---------------------------------------------------------------------------------------------------------------|
| **Atomic Reservation**| Dành riêng tài nguyên Node (CPU, RAM, disk) VÀ một địa chỉ IP công cộng sử dụng các UPDATE có điều kiện chỉ thành công nếu có đủ tài nguyên rảnh. Tất cả các đặt chỗ xảy ra trong một giao dịch DB duy nhất. |
| **Soft Delete**       | Đánh dấu một bản ghi là đã xóa (timestamp `deletedAt`) mà không xóa nó khỏi cơ sở dữ liệu.                   |
| **Dual-Write Boundary**| Khoảng cách giữa PostgreSQL và Docker không thể chia sẻ một giao dịch. Được phối hợp qua tính idempotency.          |
| **Audit Log**          | Một bản ghi bất biến, chỉ thêm vào của mọi thao tác thay đổi trạng thái.                                          |

---

## Cấu Hình Hệ Thống

| Thuật Ngữ             | Định Nghĩa                                                                                                   |
|-----------------------|---------------------------------------------------------------------------------------------------------------|
| **System Setting**    | Một mục cấu hình key-value được lưu trong cơ sở dữ liệu. Có kiểu, được xác thực và do admin quản lý.                 |
| **Email Template**    | Một mẫu HTML/text có thể cấu hình cho email giao dịch. Hỗ trợ thay thế biến.                  |
| **Tax Rate**          | Một phần trăm thuế áp dụng cho các khoản phí dựa trên khu vực thanh toán của khách hàng.                                  |
| **Rate Card**         | Một bậc giá tùy chỉnh được gán cho các khách hàng cụ thể, ghi đè giá gói mặc định (trì hoãn).            |

---

## Hạ Tầng & Mạng

| Thuật Ngữ             | Định Nghĩa                                                                                                   |
|-----------------------|---------------------------------------------------------------------------------------------------------------|
| **Private Network**   | Một mạng ảo (VLAN) trong một region duy nhất cho phép các server giao tiếp qua các IP riêng.             |
| **Floating IP**       | Một IP công cộng có thể được gán lại động giữa các server trong cùng một region để chuyển đổi dự phòng.               |
| **Block Volume**      | Lưu trữ bền vững có thể tách rời (1 GB–16 TB) có thể được gắn vào một server như một ổ đĩa bổ sung.            |
| **Cloud-init**        | Một script shell do người dùng cung cấp (user-data) chạy khi khởi động lần đầu, tự động hóa thiết lập server.                    |
| **Webhook**           | Một HTTP callback đến một URL do khách hàng cung cấp, được kích hoạt bởi các sự kiện nền tảng (server được tạo, backup hoàn tất).  |
| **Webhook Delivery**  | Một lần thử gửi duy nhất một sự kiện webhook đến một endpoint, với trạng thái thử lại.                            |
| **Bandwidth Allowance**| Giới hạn truyền dữ liệu đi hàng tháng cho mỗi gói server. Vượt mức bị tính phí theo GB.                                |
| **Overage**           | Mức sử dụng vượt quá bandwidth allowance của gói, bị tính phí theo tỷ lệ mỗi GB.                                        |
| **Spending Cap**      | Một giới hạn chi tiêu hàng tháng do người dùng cấu hình. Khi đạt đến, việc tạo tài nguyên mới bị chặn.                     |
| **Rescue Mode**       | Khởi động một server bị hỏng từ một image khôi phục để khắc phục sự cố và sửa chữa hệ thống tệp gốc.                |

---

## Công Cụ Nhà Phát Triển

| Thuật Ngữ             | Định Nghĩa                                                                                                   |
|-----------------------|---------------------------------------------------------------------------------------------------------------|
| **CLI Tool**          | Một giao diện dòng lệnh (`astral`) để quản lý server, volume, và DNS — sử dụng cùng REST API.     |
| **Terraform Provider**| Một provider hạ tầng dưới dạng mã cho phép các kỹ sư DevOps khai báo tài nguyên Astral Cloud bằng HCL.          |
| **API SDK**           | Một thư viện client theo ngôn ngữ cụ thể (Node.js, Python, Go) bọc REST API với các interface an toàn kiểu.     |

---

## Khả Năng Quan Sát

| Thuật Ngữ             | Định Nghĩa                                                                                                   |
|-----------------------|---------------------------------------------------------------------------------------------------------------|
| **Metrics Pipeline**  | Prometheus thu thập số liệu ứng dụng và hạ tầng; các dashboard Grafana trực quan hóa chúng.                |
| **Structured Logging**| Log định dạng JSON từ tất cả các container, được gửi đến Loki hoặc Elasticsearch để tìm kiếm và phân tích tập trung.  |
| **Distributed Tracing**| Theo dõi yêu cầu đầu cuối (API → worker → Docker) sử dụng OpenTelemetry, lưu trữ trong Tempo hoặc Jaeger.          |
| **Alerting**          | Prometheus AlertManager kích hoạt cảnh báo về vi phạm SLO, cạn kiệt tài nguyên và tăng trưởng dead-letter queue.  |
| **SLO**               | Service Level Objective — một mục tiêu độ tin cậy định lượng (ví dụ: 99.5% tính sẵn sàng của API).                 |
| **Error Budget**      | Thời gian ngừng hoạt động cho phép được suy ra từ SLO (ví dụ: 0.5% = 3.6 giờ/tháng). Vượt quá nó sẽ đóng băng các tính năng mới.|
| **Status Page**       | Trang công khai hiển thị trạng thái nền tảng hiện tại và lịch sử sự cố, được tự động cập nhật từ các health check.    |

---

## Trưởng Thành Vận Hành

| Thuật Ngữ             | Định Nghĩa                                                                                                   |
|-----------------------|---------------------------------------------------------------------------------------------------------------|
| **Blue-Green Deploy** | Chạy hai ngăn xếp sản xuất giống hệt nhau; lưu lượng chuyển đổi sau khi smoke-test cái mới. Không có thời gian ngừng hoạt động.    |
| **Expand-Contract**   | Mẫu di chuyển cơ sở dữ liệu: thêm cột → ghi kép → di chuyển → đọc-mới → xóa-cũ. Không có khóa độc quyền.   |
| **Runbook**           | Một quy trình từng bước được ghi lại để xử lý các sự cố vận hành (lỗi node, gián đoạn thanh toán, v.v.). |
| **Disaster Recovery** | Diễn tập hàng quý: khôi phục toàn bộ nền tảng từ các bản backup vào một môi trường sạch trong RTO.              |
| **Chaos Engineering** | Cố ý giết các worker, node, hoặc liên kết mạng để xác minh tính idempotency và suy giảm chất lượng một cách nhẹ nhàng.        |

---

## Bảo Mật & Tuân Thủ

| Thuật Ngữ             | Định Nghĩa                                                                                                   |
|-----------------------|---------------------------------------------------------------------------------------------------------------|
| **gVisor / Firecracker**| Các container runtime được sandbox cung cấp cô lập cấp phần cứng giữa các khối lượng công việc của khách hàng. Chỉ trong sản xuất. |
| **WAF**               | Web Application Firewall (ModSecurity) lọc lưu lượng HTTP độc hại trước khi nó đến ứng dụng.    |
| **Audit Hash Chain**  | Mỗi mục AuditLog bao gồm `SHA256(prev_hash || current_data)`, làm cho việc giả mạo có thể phát hiện được.               |
| **Cosign**            | Công cụ ký image container — image được ký trước khi push và được xác minh trước khi pull bởi worker.         |
| **Penetration Test**  | Đánh giá bảo mật của bên thứ ba được thực hiện trước khi tiếp nhận khách hàng. Các phát hiện critical/high phải được sửa.  |
| **Terms Acceptance**  | Chấp nhận có phiên bản của Điều Khoản Dịch Vụ và Chính Sách Quyền Riêng Tư. Người dùng chấp nhận lại khi điều khoản được cập nhật.         |
| **Cookie Consent**    | Biểu ngữ cookie tuân thủ EU lưu trữ tùy chọn đồng ý. Cookie thiết yếu (auth) không yêu cầu đồng ý.     |
| **DMCA Takedown**     | Quy trình xử lý khiếu nại vi phạm bản quyền đối với nội dung được lưu trữ. Cửa sổ phản hồi 48 giờ.     |
| **DPA**               | Data Processing Agreement — một tài liệu pháp lý cho khách hàng doanh nghiệp xác định cách dữ liệu của họ được xử lý.      |
| **Impersonation**     | Khả năng của admin đăng nhập với tư cách bất kỳ người dùng nào để gỡ lỗi, với đầy đủ audit trail và chỉ báo trực quan.               |
| **Feature Flag**      | Một nút bật tắt phía server bật/tắt tính năng theo từng người dùng, từng role hoặc theo triển khai phần trăm.              |
| **Revenue Dashboard** | Phân tích dành cho admin: MRR, tỷ lệ rời bỏ, tỷ lệ chuyển đổi, đổi voucher, số lượng server theo gói.                   |

---

## Quy Ước

1. **Tên thực thể**: `ServerInstance` (không phải "VPS"), `ServerPlan` (không phải "plan"), `Node` (không phải "host").
2. **Giá trị trạng thái**: SCREAMING_CASE — `ACTIVE`, `STOPPED`, `CREATING`, `ERROR`, `DELETED`.
3. **Quy tắc nghiệp vụ**: Được tham chiếu bằng ID — "theo BR-06," không phải "theo quy tắc giới hạn server."
4. **API endpoint**: Được viết dưới dạng `METHOD /path` — `POST /api/servers`, `GET /api/servers/:serverId`.
5. **Thao tác runtime**: "create/remove" cho Docker container. "Start/stop/restart" cho các hành động lifecycle. "Provision" cho quy trình đầu cuối.

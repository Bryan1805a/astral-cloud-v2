# Tầm nhìn

Tài liệu này định nghĩa tầm nhìn kinh doanh, kết quả mục tiêu, và các phạm vi ngoài dự kiến cho Astral Cloud. Nó đóng vai trò như kim chỉ nam — mọi tính năng, yêu cầu, và quyết định kiến trúc phải phù hợp với tầm nhìn được trình bày tại đây.

---

## Tầm nhìn Sản phẩm

**Astral Cloud là một nền tảng lưu trữ đám mây cấp sản xuất cạnh tranh với DigitalOcean, Vultr, và Linode về trải nghiệm nhà phát triển trong khi vẫn hoàn toàn có thể tự lưu trữ và mã nguồn mở.**

Chúng tôi cung cấp trải nghiệm đầy đủ của một nhà cung cấp đám mây chuyên nghiệp — máy chủ, block storage, private networking, floating IPs, firewall, DNS, sao lưu, thanh toán, hỗ trợ, công cụ CLI, và API — mà không có sự phức tạp của các đám mây siêu quy mô hay những hạn chế của shared hosting.

Nền tảng này cũng là một **kiến trúc tham chiếu** — codebase của nó cố ý phản ánh các mẫu SaaS doanh nghiệp: cấu trúc monorepo, xử lý công việc bất đồng bộ với tính lũy đẳng (idempotency), đặt trước tài nguyên nguyên tử (atomic resource reservations), audit trails, thanh toán Stripe, quản trị đa vai trò, pipeline CI/CD, và khả năng quan sát sản xuất.

---

## Kết quả Mục tiêu (Chỉ số Thành công)

Đây là những kết quả có thể đo lường được mà sản phẩm phải đạt được. Chúng định hướng việc ưu tiên các tính năng và yêu cầu phi chức năng.

| ID    | Kết quả                                                          | Phương pháp Đo lường                   | Mục tiêu                      |
|-------|------------------------------------------------------------------|-----------------------------------------|-------------------------------|
| O-01  | Thời gian tạo máy chủ đầu tiên (từ đăng ký đến sẵn sàng SSH)     | Telemetry từ đăng ký đến ACTIVE         | ≤ 60 giây (p95)               |
| O-02  | Độ tin cậy cung cấp máy chủ                                      | (successful provisions / total) × 100   | ≥ 99.5% trong khoảng 30 ngày  |
| O-03  | Tỷ lệ giữ chân khách hàng (máy chủ hoạt động hàng tháng > 0)     | Số lượng máy chủ hoạt động trên mỗi tài khoản/tháng | ≥ 80% sau máy chủ đầu tiên    |
| O-04  | Thời gian phản hồi đầu tiên cho ticket hỗ trợ                    | Thời gian từ khi mở đến phản hồi đầu tiên của nhân viên | ≤ 4 giờ làm việc              |
| O-05  | Tỷ lệ sử dụng tài nguyên trên mỗi node                           | Bảng điều khiển số liệu node            | ≥ 60% không vượt quá phân bổ  |
| O-06  | Thời gian phục hồi sau sự cố worker (tính lũy đẳng)              | Độ trễ thử lại BullMQ                  | ≤ 30 giây                     |
| O-07  | Tỷ lệ thanh toán thành công                                      | (successful charges / total) × 100      | ≥ 99%                         |
| O-08  | Độ mới của nội dung blog                                         | Số ngày kể từ bài viết cuối cùng được đăng | ≤ 14 ngày                     |
| O-09  | Tính khả dụng của API (không có lỗi 5xx)                         | Load balancer / health endpoint         | 99.5% (SLO-01)                |
| O-10  | Độ trễ gắn block volume                                          | Yêu cầu API đến trạng thái ATTACHED     | ≤ 15 giây (p95)               |
| O-11  | Tỷ lệ gửi webhook thành công                                     | (delivered / total) × 100               | ≥ 99.9%                       |
| O-12  | Thời gian trung bình phát hiện (MTTD) sự cố node                 | Độ trễ Health check → cảnh báo          | ≤ 60 giây                     |

---

## Chân dung Mục tiêu

| Chân dung             | Mô tả                                                                         | Mục tiêu Chính                                                            |
|-----------------------|-------------------------------------------------------------------------------|---------------------------------------------------------------------------|
| **Indie Hacker**      | Nhà phát triển độc lập lưu trữ dự án phụ, blog, hoặc ứng dụng SaaS nhỏ.       | Máy chủ + volume rẻ, đáng tin cậy, SSH trong vài giây, không bao giờ phải nghĩ về hạ tầng. |
| **Small Agency**      | Công ty web quản lý website khách hàng. Cần nhiều máy chủ cho mỗi khách hàng. | Quản lý 5–20 máy chủ trên nhiều khách hàng, private networking, Terraform. |
| **Gaming Admin**      | Quản trị viên cộng đồng chạy máy chủ game (Minecraft, Valheim, CS2).          | Khởi tạo và hủy máy chủ game theo nhu cầu, thanh toán theo giờ.            |
| **Content Creator**   | Blogger, YouTuber, hoặc nhà giáo dục lưu trữ WordPress, Ghost, hoặc trang web tùy chỉnh. | Triển khai một cú nhấp, sao lưu tự động, không cần bảo trì.              |
| **DevOps Engineer**   | Kỹ sư hạ tầng sử dụng Terraform/CLI để cung cấp tài nguyên.                  | Quản lý hạ tầng dưới dạng mã, tự động hóa webhook, truy cập API lập trình. |
| **Staff/Support**     | Nhân viên nền tảng xử lý ticket, kiểm duyệt nội dung, báo cáo lạm dụng.      | Giải quyết ticket, xem xét báo cáo lạm dụng, đăng bài blog, quản lý voucher. |
| **Admin**             | Người vận hành nền tảng quản lý mọi thứ: node, giá cả, bảo mật, tuân thủ.    | Giám sát tình trạng hạ tầng, quản lý feature flag, xử lý GDPR, kiểm toán nền tảng. |

---

## Ranh giới Phạm vi (Phạm vi Ngoài dự kiến)

| Phạm vi ngoài dự kiến                       | Lý do                                                                                                 |
|---------------------------------------------|---------------------------------------------------------------------------------------------------------|
| Object storage (S3-compatible blob store)   | Danh mục sản phẩm riêng biệt.                                                                            |
| Managed databases (DBaaS)                   | Độ phức tạp vận hành đáng kể. Máy chủ + volume đáp ứng hầu hết trường hợp sử dụng.                       |
| Kubernetes / container orchestration        | Mức trừu tượng khác. Máy chủ đơn giản hơn và đủ cho các chân dung mục tiêu.                              |
| Load balancers as a service                 | Ngoài phạm vi. Floating IPs + DNS cung cấp failover cơ bản.                                              |
| Serverless functions (FaaS)                 | Không phù hợp với mô hình dựa trên container.                                                            |
| CDN / edge caching                          | Nền tảng tập trung vào tính toán, không phải phân phối nội dung.                                          |
| Multi-tenant billing with sub-accounts      | Tạm hoãn. Một chủ sở hữu thanh toán cho mỗi tài khoản trong bản phát hành sản xuất ban đầu.               |
| Mobile native apps (iOS/Android)            | Web UI có khả năng responsive trên di động. Ứng dụng native tăng thêm gánh nặng bảo trì.                  |
| Custom container image upload by customers  | Rủi ro bảo mật. Chỉ sử dụng image được Admin quản lý. Cloud-init xử lý tùy chỉnh.                         |
| Managed Kubernetes                          | Ngoài phạm vi.                                                                                          |

---

## Nguyên tắc

1. **Đơn giản hóa, rồi mở rộng.** — Hoạt động đầu cuối trên một máy chủ duy nhất trước khi phân cụm đa vùng.
2. **Niềm tin qua minh bạch.** — Khách hàng thấy máy chủ của họ đang ở node nào, họ tiêu thụ những gì, họ bị tính phí ra sao. Không có dark pattern.
3. **Thân thiện với tự lưu trữ.** — Mã nguồn mở, chạy trên phần cứng của riêng bạn. Không phụ thuộc bắt buộc vào SaaS.
4. **Bất đồng bộ mặc định.** — Các thao tác > 500 ms được xử lý bất đồng bộ với chỉ báo tiến trình rõ ràng. UI không bao giờ bị chặn.
5. **Thất bại an toàn, không thất bại âm thầm.** — Mọi đường dẫn lỗi đều tạo ra audit log + cảnh báo admin + giải thích hiển thị cho người dùng.
6. **DB là chân lý, runtime là thực tế.** — Database là chân lý kinh doanh; Docker là chân lý vật lý. Reconciliation truy vấn thực tế trước.
7. **Tài liệu là một tính năng.** — Mọi entity, rule, endpoint, và quyết định đều được ghi lại tài liệu trước khi code tồn tại.
8. **Khả năng quan sát không phải là tùy chọn.** — Metrics, logs, traces, và alerts được tích hợp sẵn từ ngày đầu tiên của sản xuất.
9. **Thiết kế API-first.** — Mọi tính năng được xây dựng theo cách API-first. Web UI và CLI/Terraform sử dụng cùng một REST API.
10. **Bảo mật theo chiều sâu.** — Không có lớp nào được tin tưởng tuyệt đối. Rate limiting + input validation + ownership checks + container isolation + audit logging + WAF tạo thành chiến lược defense-in-depth.


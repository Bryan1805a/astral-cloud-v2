# ADR-005: Sử dụng BullMQ cho Xử lý Job Bất đồng bộ

| Attribute | Value                          |
|-----------|--------------------------------|
| Date      | 2026-06-26                     |
| Status    | Accepted                       |
| Author    | Bryan                          |

## Context

VPS provisioning có thể mất tới 3 phút (BR-07). HTTP request/response cycles không nên bị chặn lâu như vậy. Chúng tôi cần một cách đáng tin cậy để:
- Nhận yêu cầu tạo VPS và phản hồi 202 ngay lập tức.
- Xử lý VM provisioning thực tế một cách bất đồng bộ (gọi Proxmox VE API, chờ hoàn tất).
- Xử lý retries khi có lỗi tạm thời.
- Xử lý notifications (email) mà không làm chậm phản hồi API chính.
- Hỗ trợ lập lịch các tác vụ định kỳ (billing, health checks).

## Decision

**Sử dụng BullMQ với Redis làm hệ thống job queue.**

Web app enqueue các jobs; một worker process riêng biệt dequeue và thực thi chúng.

## Alternatives Considered

| Option            | Rejected because...                                                                                                                   |
|-------------------|---------------------------------------------------------------------------------------------------------------------------------------|
| In-process async  | Nếu web server gặp sự cố, các VM đang trong quá trình tạo sẽ bị mất. Không có retry.                                                                 |
| RabbitMQ          | Yêu cầu quản lý một broker riêng biệt (Erlang runtime). Redis đã có sẵn trong stack cho caching. Gánh nặng vận hành lớn hơn.          |
| SQS / Cloud Tasks | Vendor lock-in. MVP nhắm đến triển khai self-hosted.                                                                                   |
| pg-boss           | Sử dụng PostgreSQL cho queues — khả thi, nhưng Redis/BullMQ có monitoring, retry semantics và throughput tốt hơn cho các tác vụ khối lượng cao. |

## Consequences

**Positive:**
- Job persistence: các jobs tồn tại qua các lần khởi động lại Redis hoặc worker.
- Retry tích hợp với exponential backoff (có thể cấu hình theo loại job).
- Delayed jobs cho lập lịch (ví dụ: billing vào cuối tháng, cleanup tasks).
- Rate limiting theo loại job (ví dụ: chỉ N concurrent provisioning jobs trên toàn cluster).
- Bull Board cung cấp một web UI để giám sát queues, failed jobs và throughput.
- Redis đã có sẵn trong stack như một cache — không cần infrastructure mới.

**Negative:**
- Redis trở thành một dependency quan trọng. Nếu Redis mất dữ liệu, các jobs đang xử lý sẽ bị mất (được giảm thiểu bởi Redis AOF persistence).
- Workers phải được triển khai như một process/container riêng biệt — thêm một service nữa để giám sát.
- Các jobs vượt quá giới hạn retry sẽ kết thúc trong dead-letter queue và yêu cầu can thiệp thủ công hoặc admin alerts.

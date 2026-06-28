# Yêu cầu

Tất cả các yêu cầu được dẫn xuất từ các use case (`use-case.md`) và business rules (`business-rules.md`). Mỗi yêu cầu đều có thể kiểm thử.

---

## Yêu cầu Chức năng

### FR-AUTH — Xác thực & Phân quyền

| ID            | Yêu cầu                                                          | Nguồn       |
|---------------|------------------------------------------------------------------|--------------|
| FR-AUTH-01    | Người truy cập có thể đăng ký tài khoản với tên người dùng, email và mật khẩu. | UC-02     |
| FR-AUTH-02    | Người dùng đã đăng ký có thể đăng nhập bằng tên người dùng/email và mật khẩu. | UC-03        |
| FR-AUTH-03    | Hệ thống cấp JWT access token (1 giờ) và refresh token (7 ngày) khi đăng nhập thành công. | UC-03 |
| FR-AUTH-04    | Hệ thống hỗ trợ làm mới token mà không yêu cầu xác thực lại. | UC-03       |
| FR-AUTH-05    | Tài khoản bị khóa trong 15 phút sau 5 lần đăng nhập thất bại liên tiếp trong vòng 10 phút. | BR-23, UC-03 |
| FR-AUTH-06    | Tên người dùng và email phải là duy nhất trên toàn hệ thống. | BR-21        |
| FR-AUTH-07    | Mật khẩu phải có ≥ 8 ký tự bao gồm chữ hoa, chữ thường và chữ số. | BR-22    |
| FR-AUTH-08    | Hệ thống hỗ trợ đăng nhập mạng xã hội tùy chọn (OAuth2: Google, GitHub). | UC-02        |
| FR-AUTH-09    | Người dùng có thể bật 2FA dựa trên TOTP (quét mã QR, xác minh bằng mã). | UC-08       |
| FR-AUTH-10    | 2FA là bắt buộc đối với tài khoản ADMIN. | BR-24        |
| FR-AUTH-11    | Người dùng có thể quản lý các phiên hoạt động (xem, thu hồi từng phiên). | UC-03       |
| FR-AUTH-12    | Tối đa 5 phiên hoạt động cho mỗi người dùng; phiên thứ 6 sẽ vô hiệu hóa phiên cũ nhất. | BR-25        |
| FR-AUTH-13    | Người dùng có thể yêu cầu đặt lại mật khẩu qua email. | Dẫn xuất      |
| FR-AUTH-14    | Người dùng có thể xác minh địa chỉ email qua liên kết token. | Dẫn xuất      |

### FR-APIKEY — Quản lý Khóa API

| ID            | Yêu cầu                                                          | Nguồn       |
|---------------|------------------------------------------------------------------|--------------|
| FR-APIKEY-01  | Người dùng có thể tạo khóa API với nhãn tùy chỉnh. | UC-09        |
| FR-APIKEY-02  | Hệ thống chỉ trả về khóa đầy đủ một lần duy nhất (khi tạo). | UC-09        |
| FR-APIKEY-03  | Khóa API có thể bị thu hồi (xóa mềm). | UC-09        |
| FR-APIKEY-04  | Khóa API xác thực yêu cầu qua header `Authorization: Bearer <key>`. | UC-09  |
| FR-APIKEY-05  | Khóa API kế thừa các quyền của người dùng đã tạo ra nó. | BR-64        |
| FR-APIKEY-06  | Ngày hết hạn tùy chọn trên khóa API; khóa hết hạn bị từ chối với mã 401. | BR-65        |

### FR-SERVER — Quản lý Vòng đời Máy chủ

| ID            | Yêu cầu                                                          | Nguồn       |
|---------------|------------------------------------------------------------------|--------------|
| FR-SERVER-01  | Khách hàng có thể tạo máy chủ bằng cách chọn ServerPlan, ImageTemplate và region. | UC-01 |
| FR-SERVER-02  | Khách hàng có thể tùy chỉnh vCPU, RAM và ổ đĩa khi tạo máy chủ (ghi đè ServerPlan). | UC-01 |
| FR-SERVER-03  | Khách hàng có thể cung cấp khóa công khai SSH để xác thực thay vì mật khẩu. | UC-01 |
| FR-SERVER-04  | Khách hàng có thể chọn mô hình thanh toán: MONTHLY hoặc HOURLY. | UC-01        |
| FR-SERVER-05  | Khách hàng có thể tạo máy chủ từ snapshot đã lưu thay vì ImageTemplate. | UC-01 |
| FR-SERVER-06  | Hệ thống xác thực giới hạn máy chủ (tối đa 5 đang hoạt động, hoặc theo plan) trước khi tạo. | BR-06, UC-01 |
| FR-SERVER-07  | Hệ thống xác thực rằng kích thước ổ đĩa của image/snapshot ≤ dung lượng ổ đĩa của plan. | BR-08, UC-01 |
| FR-SERVER-08  | Hệ thống xác thực rằng region đã chọn khả dụng cho tài khoản. | BR-09, UC-01 |
| FR-SERVER-09  | Hệ thống áp dụng kích thước ổ đĩa tối thiểu 5 GB cho tất cả máy chủ. | BR-10, UC-01 |
| FR-SERVER-10  | Hệ thống chọn một node vật lý có đủ tài nguyên trống trước khi cấp phát. | BR-05, UC-01 |
| FR-SERVER-11  | Hệ thống cấp phát Docker container và gán địa chỉ IP. | UC-01       |
| FR-SERVER-12  | Khách hàng có thể xem danh sách phân trang tất cả máy chủ của mình kèm trạng thái, IP, plan và region. | UC-04 |
| FR-SERVER-13  | Khách hàng có thể lọc danh sách máy chủ theo trạng thái và theo tags. | UC-04        |
| FR-SERVER-14  | Khách hàng có thể khởi động máy chủ đang ở trạng thái STOPPED. | UC-05, BR-13 |
| FR-SERVER-15  | Khách hàng có thể dừng máy chủ đang ở trạng thái RUNNING (tắt graceful). | UC-06, BR-14 |
| FR-SERVER-16  | Hệ thống áp dụng force stop nếu graceful shutdown vượt quá 30 giây. | UC-06, BR-17 |
| FR-SERVER-17  | Khách hàng có thể khởi động lại máy chủ đang ở trạng thái RUNNING. | Dẫn xuất      |
| FR-SERVER-18  | Khách hàng có thể xóa máy chủ đang ở trạng thái STOPPED (kèm xác nhận + nhập hostname). | UC-07, BR-15 |
| FR-SERVER-19  | Khi xóa, tất cả tài nguyên (vCPU, RAM, ổ đĩa, IP) được giải phóng về node. | BR-16, UC-07 |
| FR-SERVER-20  | Khách hàng có thể xem thông tin chi tiết của một máy chủ. | UC-04        |
| FR-SERVER-21  | Khách hàng có thể gán và gỡ bỏ tags trên máy chủ. | Dẫn xuất      |
| FR-SERVER-22  | Hostname phải là duy nhất trong tài khoản của mỗi người dùng. | BR-11        |

### FR-BILL — Thanh toán & Ví

| ID            | Yêu cầu                                                          | Nguồn       |
|---------------|------------------------------------------------------------------|--------------|
| FR-BILL-01    | Hệ thống kiểm tra số dư ví trước khi tạo máy chủ. | UC-01        |
| FR-BILL-02    | Khách hàng có thể xem số dư ví hiện tại. | Dẫn xuất      |
| FR-BILL-03    | Khách hàng có thể nạp tiền qua cổng thanh toán (Stripe). | UC-10        |
| FR-BILL-04    | Hệ thống tự động khấu trừ phí dựa trên mô hình thanh toán. | BR-28        |
| FR-BILL-05    | Khách hàng có thể xem lịch sử thanh toán có phân trang. | UC-10        |
| FR-BILL-06    | Khách hàng có thể tải hóa đơn dưới dạng PDF. | UC-10, BR-30 |
| FR-BILL-07    | Hệ thống áp dụng thời gian gia hạn 24 giờ khi tự động khấu trừ thất bại. | BR-29        |
| FR-BILL-08    | Khách hàng có thể lưu, xem và xóa phương thức thanh toán. | UC-10, BR-31 |
| FR-BILL-09    | Hệ thống tạo hóa đơn cho mỗi khoản phí và mỗi lần nạp tiền. | BR-30        |
| FR-BILL-10    | Khách hàng có thể yêu cầu hoàn tiền cho số dư hàng tháng trả trước chưa sử dụng. | BR-32       |

### FR-VOUCHER — Hệ thống Voucher / Coupon

| ID            | Yêu cầu                                                          | Nguồn       |
|---------------|------------------------------------------------------------------|--------------|
| FR-VOUCHER-01 | Khách hàng có thể áp dụng mã voucher khi thanh toán (nạp tiền hoặc tạo máy chủ). | UC-11 |
| FR-VOUCHER-02 | Hệ thống xác thực voucher: tồn tại, đang hoạt động, trong cửa sổ ngày, còn lượt sử dụng. | BR-34, BR-35 |
| FR-VOUCHER-03 | Hệ thống xác thực giới hạn sử dụng cho mỗi người dùng. | BR-36        |
| FR-VOUCHER-04 | Hệ thống xác thực yêu cầu chi tiêu tối thiểu. | BR-37        |
| FR-VOUCHER-05 | Nhiều voucher có thể được kết hợp trên cùng một khoản thanh toán. | BR-38        |
| FR-VOUCHER-06 | Nhân viên/admin có thể tạo voucher (mã, loại, giá trị, giới hạn). | UC-21        |
| FR-VOUCHER-07 | Nhân viên/admin có thể xem thống kê sử dụng voucher. | UC-21        |
| FR-VOUCHER-08 | Nhân viên/admin có thể vô hiệu hóa voucher. | UC-21        |

### FR-TICKET — Vé Hỗ trợ

| ID            | Yêu cầu                                                          | Nguồn       |
|---------------|------------------------------------------------------------------|--------------|
| FR-TICKET-01  | Khách hàng có thể tạo vé hỗ trợ với chủ đề, danh mục và nội dung. | UC-12 |
| FR-TICKET-02  | Khách hàng có thể xem tất cả vé của mình kèm trạng thái. | UC-12        |
| FR-TICKET-03  | Khách hàng và nhân viên có thể thêm tin nhắn vào luồng vé. | UC-12        |
| FR-TICKET-04  | Nhân viên có thể thay đổi trạng thái vé theo vòng đời. | BR-40        |
| FR-TICKET-05  | Khách hàng có thể đóng vé sau khi được giải quyết. | BR-40        |
| FR-TICKET-06  | Khách hàng có thể mở lại vé đã đóng trong vòng 7 ngày. | BR-41        |
| FR-TICKET-07  | Vé đã giải quyết tự động đóng sau 72 giờ khách hàng không phản hồi. | BR-42       |
| FR-TICKET-08  | Nhân viên có thể gán vé cho chính mình hoặc nhân viên khác. | UC-22        |
| FR-TICKET-09  | Nhân viên có thể thêm ghi chú nội bộ (không hiển thị cho khách hàng). | Dẫn xuất      |
| FR-TICKET-10  | Nhân viên có thể lọc và tìm kiếm vé theo trạng thái, mức ưu tiên, danh mục, người được gán. | UC-22 |

### FR-BACKUP — Sao lưu Máy chủ

| ID            | Yêu cầu                                                          | Nguồn       |
|---------------|------------------------------------------------------------------|--------------|
| FR-BACKUP-01  | Khách hàng có thể tạo bản sao lưu thủ công cho máy chủ. | UC-13        |
| FR-BACKUP-02  | Khách hàng có thể xem lịch sử sao lưu cho mỗi máy chủ. | UC-13        |
| FR-BACKUP-03  | Khách hàng có thể khôi phục máy chủ từ một bản sao lưu cụ thể. | UC-13        |
| FR-BACKUP-04  | Khách hàng có thể xóa từng bản sao lưu riêng lẻ. | UC-13        |
| FR-BACKUP-05  | Khách hàng có thể cấu hình lịch sao lưu tự động. | UC-13        |
| FR-BACKUP-06  | Bản sao lưu được giữ lại theo chính sách lịch (hàng ngày/hàng tuần/hàng tháng). | BR-51        |
| FR-BACKUP-07  | Tổng dung lượng sao lưu cho mỗi máy chủ ≤ 2× ổ đĩa được phân bổ. | BR-52        |
| FR-BACKUP-08  | Chỉ một tác vụ sao lưu chạy cho mỗi máy chủ tại một thời điểm. | BR-53        |

### FR-FIREWALL — Quy tắc Tường lửa

| ID            | Yêu cầu                                                          | Nguồn       |
|---------------|------------------------------------------------------------------|--------------|
| FR-FW-01      | Khách hàng có thể liệt kê các quy tắc tường lửa cho một máy chủ. | UC-14        |
| FR-FW-02      | Khách hàng có thể tạo quy tắc tường lửa (protocol, port, source, action, priority). | UC-14 |
| FR-FW-03      | Khách hàng có thể cập nhật quy tắc tường lửa. | UC-14        |
| FR-FW-04      | Khách hàng có thể xóa quy tắc tường lửa. | UC-14        |
| FR-FW-05      | Quy tắc được đánh giá theo thứ tự ưu tiên; kết quả khớp đầu tiên được áp dụng. | BR-47        |
| FR-FW-06      | Quy tắc mặc định khi tạo: cho phép 22/tcp, 80/tcp, 443/tcp. | BR-48        |
| FR-FW-07      | Mặc định từ chối tất cả lưu lượng inbound không khớp. | BR-46        |

### FR-DNS — Quản lý DNS

| ID            | Yêu cầu                                                          | Nguồn       |
|---------------|------------------------------------------------------------------|--------------|
| FR-DNS-01     | Khách hàng có thể liệt kê các bản ghi DNS cho một máy chủ. | UC-15        |
| FR-DNS-02     | Khách hàng có thể tạo bản ghi DNS (type, name, value, TTL). | UC-15        |
| FR-DNS-03     | Khách hàng có thể cập nhật bản ghi DNS. | UC-15        |
| FR-DNS-04     | Khách hàng có thể xóa bản ghi DNS. | UC-15        |
| FR-DNS-05     | Mỗi máy chủ chỉ được có đúng một bản ghi PTR (reverse DNS). | BR-50        |

### FR-BLOG — Blog / Quản lý Nội dung

| ID            | Yêu cầu                                                          | Nguồn       |
|---------------|------------------------------------------------------------------|--------------|
| FR-BLOG-01    | Người truy cập và khách hàng có thể xem bài đăng blog đã xuất bản (phân trang). | UC-16       |
| FR-BLOG-02    | Bài đăng blog có thể được lọc theo danh mục và tìm kiếm theo từ khóa. | UC-16        |
| FR-BLOG-03    | Nhân viên/admin có thể tạo và chỉnh sửa bài đăng blog. | UC-23        |
| FR-BLOG-04    | Bài đăng blog hỗ trợ nội dung Markdown. | Dẫn xuất      |
| FR-BLOG-05    | Nhân viên có thể quản lý danh mục blog. | UC-23        |
| FR-BLOG-06    | Trạng thái bài đăng blog: DRAFT (ẩn), PUBLISHED (hiển thị), ARCHIVED. | BR-43        |
| FR-BLOG-07    | Slug của bài đăng blog phải là duy nhất. | BR-44        |

### FR-REFERRAL — Hệ thống Giới thiệu / Tiếp thị liên kết

| ID            | Yêu cầu                                                          | Nguồn       |
|---------------|------------------------------------------------------------------|--------------|
| FR-REF-01     | Mỗi người dùng có một mã giới thiệu duy nhất, được tạo tự động. | BR-54        |
| FR-REF-02     | Người dùng có thể chia sẻ mã/liên kết giới thiệu của mình. | UC-17        |
| FR-REF-03     | Người dùng mới có thể nhập mã giới thiệu trong quá trình đăng ký. | UC-02        |
| FR-REF-04     | Cả người giới thiệu và người được giới thiệu đều nhận credit khi người được giới thiệu thực hiện thanh toán đầu tiên. | BR-55   |
| FR-REF-05     | Người dùng có thể xem lịch sử giới thiệu và credit tích lũy của mình. | UC-17        |
| FR-REF-06     | Credit giới thiệu có thể rút được khi đạt ngưỡng có thể cấu hình. | BR-56       |
| FR-REF-07     | Tự giới thiệu bị chặn (kiểm tra IP + fingerprint trình duyệt). | BR-57        |

### FR-NOTIF — Thông báo

| ID            | Yêu cầu                                                          | Nguồn       |
|---------------|------------------------------------------------------------------|--------------|
| FR-NOTIF-01   | Hệ thống gửi thông báo trong ứng dụng khi tạo máy chủ, xóa máy chủ, sự kiện thanh toán, cập nhật vé. | Dẫn xuất |
| FR-NOTIF-02   | Hệ thống gửi thông báo email cho các sự kiện quan trọng. | BR-58, BR-59 |
| FR-NOTIF-03   | Người dùng có thể xem lịch sử thông báo (trung tâm thông báo trong ứng dụng). | UC-18        |
| FR-NOTIF-04   | Người dùng có thể đánh dấu thông báo là đã đọc. | UC-18        |
| FR-NOTIF-05   | Người dùng có thể cấu hình tùy chọn thông báo cho từng kênh. | UC-18        |
| FR-NOTIF-06   | Thông báo quan trọng (thanh toán thất bại, bảo mật) không thể bị tắt. | BR-59   |

### FR-ANNOUNCE — Thông báo Nền tảng / Trang Trạng thái

| ID            | Yêu cầu                                                          | Nguồn       |
|---------------|------------------------------------------------------------------|--------------|
| FR-ANNOUNCE-01| Admin có thể tạo thông báo trên toàn nền tảng. | UC-24        |
| FR-ANNOUNCE-02| Thông báo có mức độ nghiêm trọng: INFO, WARNING, CRITICAL. | Dẫn xuất      |
| FR-ANNOUNCE-03| Thông báo đang hoạt động được hiển thị cho tất cả người dùng. | Dẫn xuất      |
| FR-ANNOUNCE-04| Thông báo có thể được lên lịch (startsAt / endsAt). | Dẫn xuất      |

### FR-AUDIT — Ghi nhật ký Kiểm toán

| ID            | Yêu cầu                                                          | Nguồn       |
|---------------|------------------------------------------------------------------|--------------|
| FR-AUDIT-01   | Mỗi thao tác thay đổi trạng thái máy chủ đều tạo một mục nhật ký kiểm toán. | BR-19     |
| FR-AUDIT-02   | Các hành động của admin sửa đổi người dùng, plan, image, node, cài đặt, thuế đều tạo mục kiểm toán. | BR-20 |
| FR-AUDIT-03   | Mục nhật ký kiểm toán ghi lại: ID tác nhân, hành động, loại/ID đối tượng, dấu thời gian, kết quả. | BR-19 |
| FR-AUDIT-04   | Admin có thể xem và lọc nhật ký kiểm toán. | UC-24        |

### FR-ADMIN — Chức năng Quản trị

| ID            | Yêu cầu                                                          | Nguồn       |
|---------------|------------------------------------------------------------------|--------------|
| FR-ADMIN-01   | Admin có thể tạo, cập nhật và vô hiệu hóa ServerPlan. | UC-20        |
| FR-ADMIN-02   | Admin có thể tạo, cập nhật và vô hiệu hóa ImageTemplate. | UC-20        |
| FR-ADMIN-03   | Admin có thể thêm, cập nhật và xóa Node vật lý. | UC-20        |
| FR-ADMIN-04   | Admin có thể quản lý Region. | UC-20        |
| FR-ADMIN-05   | Admin nhận cảnh báo về lỗi cấp phát và tình trạng cạn kiệt node. | UC-01    |
| FR-ADMIN-06   | Admin có thể xem tất cả người dùng, lọc và quản lý (vai trò, trạng thái, khóa). | UC-24       |
| FR-ADMIN-07   | Admin có thể xem xét và xử lý yêu cầu GDPR. | UC-25        |
| FR-ADMIN-08   | Admin có thể xem trạng thái hàng đợi job và dead-letter queue. | UC-24        |
| FR-ADMIN-09   | Admin có thể cấu hình thuế suất theo region. | UC-24        |
| FR-ADMIN-10   | Admin có thể quản lý mẫu email (subject, body, variables). | UC-24        |
| FR-ADMIN-11   | Admin có thể quản lý cài đặt hệ thống. | UC-24        |
| FR-ADMIN-12   | Admin có thể quản lý chiến dịch voucher (tạo, xem thống kê, vô hiệu hóa). | UC-21    |

### FR-GDPR — Quyền riêng tư Dữ liệu

| ID            | Yêu cầu                                                          | Nguồn       |
|---------------|------------------------------------------------------------------|--------------|
| FR-GDPR-01    | Khách hàng có thể yêu cầu xuất dữ liệu cá nhân ở định dạng máy đọc được. | UC-25, BR-62 |
| FR-GDPR-02    | Khách hàng có thể yêu cầu xóa vĩnh viễn tài khoản. | UC-25, BR-63 |
| FR-GDPR-03    | Việc xuất dữ liệu được tạo bất đồng bộ; liên kết tải xuống được gửi qua email. | BR-62        |
| FR-GDPR-04    | Khi xóa, tất cả dữ liệu cá nhân bị loại bỏ; nhật ký kiểm toán được ẩn danh. | BR-63        |

### FR-TAX — Quản lý Thuế

| ID            | Yêu cầu                                                          | Nguồn       |
|---------------|------------------------------------------------------------------|--------------|
| FR-TAX-01     | Thuế suất được áp dụng dựa trên region địa chỉ thanh toán của khách hàng. | BR-60        |
| FR-TAX-02     | Sử dụng region máy chủ làm dự phòng nếu chưa đặt địa chỉ thanh toán. | BR-60        |
| FR-TAX-03     | Người dùng được miễn thuế không bị tính thuế (cờ do admin đặt). | BR-61        |
| FR-TAX-04     | Hóa đơn hiển thị số tiền thuế như một mục riêng biệt. | Dẫn xuất      |

### FR-NET — Mạng Riêng

| ID            | Yêu cầu                                                          | Nguồn       |
|---------------|------------------------------------------------------------------|--------------|
| FR-NET-01     | Khách hàng có thể tạo mạng riêng trong một region với dải CIDR. | UC-27     |
| FR-NET-02     | Khách hàng có thể gắn máy chủ vào mạng riêng (IP riêng được gán tự động). | UC-27 |
| FR-NET-03     | Khách hàng có thể gỡ máy chủ khỏi mạng riêng. | UC-27        |
| FR-NET-04     | Khách hàng có thể xóa mạng riêng (phải không còn máy chủ nào). | UC-27       |
| FR-NET-05     | Hệ thống xác thực CIDR không trùng lặp với các mạng hiện có trong region. | BR-72 |
| FR-NET-06     | Một máy chủ chỉ có thể thuộc về tối đa một mạng riêng tại một thời điểm. | BR-73        |

### FR-FLOAT — IP Động (Floating IPs)

| ID            | Yêu cầu                                                          | Nguồn       |
|---------------|------------------------------------------------------------------|--------------|
| FR-FLOAT-01   | Khách hàng có thể phân bổ một floating IP trong một region. | UC-28        |
| FR-FLOAT-02   | Khách hàng có thể gán floating IP cho một máy chủ. | UC-28        |
| FR-FLOAT-03   | Khách hàng có thể gán lại floating IP cho máy chủ khác. | UC-28, BR-76 |
| FR-FLOAT-04   | Khách hàng có thể hủy gán floating IP (trả về pool). | UC-28        |
| FR-FLOAT-05   | Khách hàng có thể giải phóng (xóa) floating IP. | UC-28        |
| FR-FLOAT-06   | Việc chuyển floating IP giữa các máy chủ là nguyên tử (atomic). | BR-76        |
| FR-FLOAT-07   | Floating IP chưa được gán sẽ chịu phí giữ. | BR-77        |

### FR-VOL — Ổ đĩa Khối (Block Volumes)

| ID            | Yêu cầu                                                          | Nguồn       |
|---------------|------------------------------------------------------------------|--------------|
| FR-VOL-01     | Khách hàng có thể tạo block volume (1 GB–16 TB) trong một region. | UC-29        |
| FR-VOL-02     | Khách hàng có thể gắn volume vào máy chủ trong cùng region. | UC-29, BR-80 |
| FR-VOL-03     | Khách hàng có thể gỡ volume khỏi máy chủ. | UC-29, BR-81 |
| FR-VOL-04     | Khách hàng chỉ có thể tăng kích thước volume (không thể giảm). | UC-29, BR-79 |
| FR-VOL-05     | Khách hàng có thể xóa volume (phải gỡ ra trước). | UC-29        |
| FR-VOL-06     | Volume được tính phí theo giờ dựa trên kích thước đã cấp phát. | BR-82        |
| FR-VOL-07     | Việc gắn volume yêu cầu máy chủ không bị khóa bởi thao tác khác. | BR-80     |

### FR-CLOUDINIT — Cloud-init

| ID            | Yêu cầu                                                          | Nguồn       |
|---------------|------------------------------------------------------------------|--------------|
| FR-CLOUDINIT-01 | Khách hàng có thể cung cấp cloud-init script (user-data) khi tạo máy chủ. | UC-30 |
| FR-CLOUDINIT-02 | Cloud-init script chỉ chạy đúng một lần khi khởi động lần đầu. | BR-83        |
| FR-CLOUDINIT-03 | Kích thước script giới hạn ở 64 KB; được xác thực trước khi tạo. | BR-84        |

### FR-WEBHOOK — Webhooks

| ID            | Yêu cầu                                                          | Nguồn       |
|---------------|------------------------------------------------------------------|--------------|
| FR-WEBHOOK-01 | Khách hàng có thể tạo webhook endpoint (URL, events, secret). | UC-31        |
| FR-WEBHOOK-02 | Khách hàng có thể cập nhật, vô hiệu hóa hoặc xóa webhook endpoint. | UC-31        |
| FR-WEBHOOK-03 | Hệ thống ký webhook payload bằng HMAC-SHA256. | BR-90        |
| FR-WEBHOOK-04 | Hệ thống thử lại các lần gửi thất bại tối đa 3 lần với exponential backoff. | BR-89     |
| FR-WEBHOOK-05 | Khách hàng có thể xem lịch sử gửi webhook cho mỗi endpoint. | UC-31        |
| FR-WEBHOOK-06 | Tối đa 10 webhook endpoint cho mỗi khách hàng. | BR-88        |

### FR-BW — Đo lường Băng thông

| ID            | Yêu cầu                                                          | Nguồn       |
|---------------|------------------------------------------------------------------|--------------|
| FR-BW-01      | Hệ thống đo lường băng thông outbound cho mỗi máy chủ tại container interface. | BR-86   |
| FR-BW-02      | Mức sử dụng băng thông được tổng hợp hàng ngày và có thể truy vấn theo giờ. | BR-86        |
| FR-BW-03      | Khách hàng được thông báo khi đạt 80% và 100% giới hạn hàng tháng. | BR-87        |
| FR-BW-04      | Phần vượt quá được tính phí theo GB vượt quá giới hạn hàng tháng của plan. | BR-85        |

### FR-CLI — Công cụ CLI

| ID            | Yêu cầu                                                          | Nguồn       |
|---------------|------------------------------------------------------------------|--------------|
| FR-CLI-01     | CLI xác thực qua khóa API (lưu trong cấu hình cục bộ). | BR-92        |
| FR-CLI-02     | CLI hỗ trợ: servers (list, create, start, stop, delete, ssh), volumes, DNS, firewall. | Dẫn xuất     |
| FR-CLI-03     | CLI sử dụng cùng REST API như giao diện web — không có endpoint đặc quyền. | BR-93    |

### FR-TF — Terraform Provider

| ID            | Yêu cầu                                                          | Nguồn       |
|---------------|------------------------------------------------------------------|--------------|
| FR-TF-01      | Terraform provider ánh xạ tài nguyên REST API sang tài nguyên HCL. | BR-93        |
| FR-TF-02      | Tài nguyên được hỗ trợ: server, volume, floating_ip, private_network, dns_record, firewall_rule, ssh_key. | Dẫn xuất |
| FR-TF-03      | Provider sử dụng xác thực khóa API với cùng giới hạn tốc độ như người dùng API trực tiếp. | BR-93 |

### FR-OBS — Khả năng Quan sát (Observability)

| ID            | Yêu cầu                                                          | Nguồn       |
|---------------|------------------------------------------------------------------|--------------|
| FR-OBS-01     | Ứng dụng phát ra Prometheus metrics trên endpoint `/metrics`. | BR-94        |
| FR-OBS-02     | Tất cả container phát ra structured JSON logs ra stdout. | Dẫn xuất      |
| FR-OBS-03     | Distributed tracing lan truyền traceId qua API → worker → Docker. | Dẫn xuất   |
| FR-OBS-04     | Bảng điều khiển admin bao gồm metrics dashboards. | Dẫn xuất      |
| FR-OBS-05     | AlertManager cảnh báo về lỗi node, dead-letter tăng, đột biến lỗi cấp phát. | BR-95 |

### FR-OPS — Độ Hoàn thiện Vận hành

| ID            | Yêu cầu                                                          | Nguồn       |
|---------------|------------------------------------------------------------------|--------------|
| FR-OPS-01     | Database migration tuân theo mẫu expand-contract (CI thực thi an toàn). | BR-96   |
| FR-OPS-02     | Production sử dụng blue-green deployment với smoke test. | BR-97        |
| FR-OPS-03     | Sao lưu toàn bộ DB mỗi 6 giờ với PITR được bật. | BR-98        |
| FR-OPS-04     | Diễn tập khôi phục thảm họa được lập thành tài liệu và thực hiện hàng quý. | BR-98        |
| FR-OPS-05     | Runbook tồn tại cho tất cả các loại sự cố chính. | BR-99        |

### FR-SEC — Tăng cường Bảo mật

| ID            | Yêu cầu                                                          | Nguồn       |
|---------------|------------------------------------------------------------------|--------------|
| FR-SEC-01     | Production sử dụng gVisor/Firecracker để cô lập container. | BR-100       |
| FR-SEC-02     | WAF (ModSecurity OWASP CRS) được triển khai trước Nginx. | BR-101       |
| FR-SEC-03     | Container image được ký bằng cosign; worker xác minh trước khi pull. | BR-102      |
| FR-SEC-04     | Chuỗi băm nhật ký kiểm toán cho phép phát hiện giả mạo. | BR-103       |
| FR-SEC-05     | Kiểm thử thâm nhập bên thứ ba được thực hiện trước khi tiếp nhận khách hàng. | BR-104     |

### FR-COMP — Tuân thủ

| ID            | Yêu cầu                                                          | Nguồn       |
|---------------|------------------------------------------------------------------|--------------|
| FR-COMP-01    | Người dùng phải chấp nhận Điều khoản Dịch vụ và Chính sách Quyền riêng tư trước khi tạo máy chủ đầu tiên. | BR-105 |
| FR-COMP-02    | Việc chấp nhận điều khoản được lập phiên bản; người dùng chấp nhận lại khi có cập nhật. | BR-105       |
| FR-COMP-03    | Biểu ngữ đồng ý cookie cho khách truy cập EU; cookie thiết yếu được miễn trừ. | BR-106       |
| FR-COMP-04    | Quy trình gỡ bỏ DMCA qua hệ thống báo cáo lạm dụng (phản hồi trong 48 giờ). | BR-107      |
| FR-COMP-05    | Mẫu DPA có sẵn cho khách hàng doanh nghiệp theo yêu cầu. | BR-108       |

### FR-ADMIN2 — Công cụ Quản trị Bổ sung

| ID            | Yêu cầu                                                          | Nguồn       |
|---------------|------------------------------------------------------------------|--------------|
| FR-ADMIN2-01  | Admin có thể mạo danh bất kỳ người dùng nào để gỡ lỗi (đầy đủ audit trail). | BR-109       |
| FR-ADMIN2-02  | Admin có thể quản lý feature flags (toàn cục, theo người dùng, theo vai trò, theo phần trăm). | BR-110   |
| FR-ADMIN2-03  | Bảng điều khiển doanh thu admin: MRR, churn, conversion, khối lượng voucher. | BR-111       |
| FR-ADMIN2-04  | Admin có thể xử lý báo cáo lạm dụng. | BR-115       |
| FR-ADMIN2-05  | Khách hàng có thể đặt giới hạn chi tiêu hàng tháng. | BR-112       |
| FR-ADMIN2-06  | Thanh toán trước hàng năm được giảm giá 20% cho máy chủ hàng tháng. | BR-113       |
| FR-ADMIN2-07  | Xuất hóa đơn CSV cho khách hàng và admin. | BR-114       |

---

## Yêu cầu Phi Chức năng

### NFR-PERF — Hiệu năng

| ID            | Yêu cầu                                                          | Đo lường     |
|---------------|------------------------------------------------------------------|--------------|
| NFR-PERF-01   | Việc cấp phát máy chủ hoàn thành (hoặc thất bại) trong vòng 60 giây. | BR-07        |
| NFR-PERF-02   | Trang dashboard / danh sách máy chủ tải trong ≤ 2 giây (p95). | p95 latency  |
| NFR-PERF-03   | API read endpoint phản hồi trong ≤ 200 ms (p95). | p95 latency  |
| NFR-PERF-04   | API write endpoint (không cấp phát) phản hồi trong ≤ 500 ms (p95). | p95 latency |
| NFR-PERF-05   | Trang bài đăng blog tải trong ≤ 1 giây (p95). | p95 latency  |

### NFR-SEC — Bảo mật

| ID            | Yêu cầu                                                          |
|---------------|------------------------------------------------------------------|
| NFR-SEC-01    | Tất cả xác thực được xử lý qua JWT token đã ký (HS256). |
| NFR-SEC-02    | Mật khẩu được băm bằng bcrypt (cost factor ≥ 12). |
| NFR-SEC-03    | Tất cả giao tiếp client-server sử dụng HTTPS (TLS 1.3). |
| NFR-SEC-04    | Xác thực đầu vào trên mọi API endpoint (Zod schemas). |
| NFR-SEC-05    | Giới hạn tốc độ: 10/phút cho auth endpoint, 60/phút chung, 5/phút tạo máy chủ. |
| NFR-SEC-06    | Secrets không bao giờ được commit vào source control hoặc ghi vào log. |
| NFR-SEC-07    | Thông báo lỗi chung chung khi xác thực thất bại (không liệt kê người dùng). |
| NFR-SEC-08    | 2FA TOTP secrets được mã hóa khi lưu trữ. |
| NFR-SEC-09    | Khóa API được băm trước khi lưu trữ (chỉ prefix được lưu dạng plaintext). |
| NFR-SEC-10    | Chỉ Stripe payment tokens — dữ liệu thẻ thô không bao giờ chạm vào máy chủ của chúng tôi. |
| NFR-SEC-11    | CORS bị giới hạn cho các origin đã biết. |
| NFR-SEC-12    | Content-Security-Policy header được thiết lập. |
| NFR-SEC-13    | File upload (ảnh bìa blog) được xác thực loại và kích thước. |

### NFR-AVAIL — Tính Sẵn sàng & Khả năng Phục hồi

| ID            | Yêu cầu                                                          |
|---------------|------------------------------------------------------------------|
| NFR-AVAIL-01  | Mục tiêu uptime ứng dụng web: 99.5% (không bao gồm bảo trì theo kế hoạch). |
| NFR-AVAIL-02  | Graceful degradation: nếu Docker daemon không thể truy cập, giao diện web và database vẫn hoạt động. |
| NFR-AVAIL-03  | Sao lưu database được thực hiện hàng ngày với point-in-time recovery. |
| NFR-AVAIL-04  | Hàng đợi job (BullMQ/Redis) tồn tại sau khi worker khởi động lại mà không mất dữ liệu. |
| NFR-AVAIL-05  | Mất kết nối Docker không được gây hỏng database — job thất bại được thử lại hoặc đưa vào dead-letter. |
| NFR-AVAIL-06  | Lỗi Redis được xử lý graceful: auth blocklist không khả dụng, rate limiting dễ dãi hơn. |

### NFR-AVAIL — SLOs

| ID            | SLI                                   | Mục tiêu SLO              | Cửa sổ    |
|---------------|---------------------------------------|---------------------------|-----------|
| SLO-01        | HTTP availability (non-5xx)           | 99.5%                     | 30 ngày   |
| SLO-02        | API read latency (p95)                | ≤ 200 ms                  | 30 ngày   |
| SLO-03        | API write latency (p95)               | ≤ 500 ms                  | 30 ngày   |
| SLO-04        | Tỷ lệ cấp phát máy chủ thành công     | ≥ 99.5%                   | 30 ngày   |
| SLO-05        | Độ trễ cấp phát máy chủ (p95)         | ≤ 60 giây                 | 30 ngày   |
| SLO-06        | Tải trang dashboard (p95)             | ≤ 2 giây                  | 30 ngày   |
| SLO-07        | Tỷ lệ thành công auth endpoint        | ≥ 99.9%                   | 30 ngày   |
| SLO-08        | Tỷ lệ xử lý thanh toán thành công     | ≥ 99%                     | 30 ngày   |

**Error budget**: 3.6 giờ/tháng (0.5% của 720 giờ). Vượt quá sẽ kích hoạt đóng băng tính năng mới.

### NFR-MAINT — Khả năng Bảo trì

| ID            | Yêu cầu                                                          |
|---------------|------------------------------------------------------------------|
| NFR-MAINT-01  | Tất cả code được viết bằng TypeScript (strict mode). |
| NFR-MAINT-02  | Database schema được lập phiên bản với Prisma migrations. |
| NFR-MAINT-03  | Structured JSON logging cho tất cả thành phần phía server. |
| NFR-MAINT-04  | REST API được lập tài liệu với OpenAPI 3.1 / Swagger. |
| NFR-MAINT-05  | Unit test coverage ≥ 80% cho business logic và API handler. |
| NFR-MAINT-06  | Cấu trúc monorepo với shared types package. |
| NFR-MAINT-07  | Biến môi trường được lập tài liệu trong `.env.example`. |

### NFR-SCALE — Khả năng Mở rộng

| ID            | Yêu cầu                                                          |
|---------------|------------------------------------------------------------------|
| NFR-SCALE-01  | Hệ thống hỗ trợ ≥ 100 người dùng đã xác thực đồng thời. |
| NFR-SCALE-02  | Background worker có thể mở rộng độc lập với web server. |
| NFR-SCALE-03  | Web tier không trạng thái cho phép mở rộng ngang. |

### NFR-DATA — Lưu trữ Dữ liệu & Tuân thủ

| ID            | Yêu cầu                                                          |
|---------------|------------------------------------------------------------------|
| NFR-DATA-01   | Nhật ký kiểm toán được lưu trữ tối thiểu 5 năm. |
| NFR-DATA-02   | Dữ liệu người dùng đã xóa được ẩn danh trong vòng 30 ngày kể từ yêu cầu GDPR. |
| NFR-DATA-03   | Hồ sơ hóa đơn được lưu trữ vô thời hạn (yêu cầu pháp lý). |
| NFR-DATA-04   | Sao lưu máy chủ tự động bị xóa khi máy chủ bị xóa. |

---

## Ràng buộc

| ID   | Ràng buộc                                                                     |
|------|-------------------------------------------------------------------------------|
| C-01 | MVP phải có thể triển khai trên một máy chủ duy nhất (Docker Compose). |
| C-02 | Tất cả thành phần hạ tầng phải là open-source. |
| C-03 | Không phụ thuộc nhà cung cấp vào một container runtime cụ thể; yêu cầu lớp trừu tượng. |
| C-04 | Hỗ trợ trình duyệt mục tiêu: 2 phiên bản mới nhất của Chrome, Firefox, Safari, Edge. |
| C-05 | Xử lý thanh toán qua Stripe (không có cổng nào khác cho MVP). |
| C-06 | Gửi email qua SMTP hoặc SendGrid/Mailgun API. |

---

## Giả định

| ID   | Giả định                                                                      |
|------|-------------------------------------------------------------------------------|
| AS-01 | Một Docker Engine host được cấp phát và có thể truy cập cho mỗi node. |
| AS-02 | Một dịch vụ SMTP được cấu hình cho email giao dịch. |
| AS-03 | Bản ghi DNS và domain được cấu hình cho ứng dụng. |
| AS-04 | Một public IP pool có sẵn trên mỗi node để gán máy chủ. |
| AS-05 | Tài khoản Stripe được cấu hình với webhook endpoint cho sự kiện thanh toán. |
| AS-06 | Docker image được build sẵn và lưu trữ trong container registry có thể truy cập. |

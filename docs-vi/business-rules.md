# Quy tắc Nghiệp vụ

Tất cả các quy tắc nghiệp vụ được đánh số và đóng vai trò là nguồn sự thật duy nhất. Các use case tham chiếu đến quy tắc bằng mã định danh BR-XX của chúng.

---

## Bất biến Miền

### BR-01 — Quyền Sở hữu Người dùng–Máy chủ (Một-Nhiều)
Một người dùng có thể sở hữu nhiều phiên bản máy chủ.

### BR-02 — Tính Độc quyền Sở hữu Máy chủ
Một phiên bản máy chủ chỉ thuộc về đúng một người dùng tại bất kỳ thời điểm nào.

### BR-03 — Yêu cầu ImageTemplate
Mỗi phiên bản máy chủ phải được tạo từ một ImageTemplate hợp lệ hoặc một Snapshot — phải chỉ định chính xác một trong hai.

### BR-04 — Triển khai lên Nút Vật lý
Mỗi phiên bản máy chủ phải được triển khai trên đúng một nút vật lý (Docker host).

### BR-05 — Trần Tài nguyên Nút
Một nút vật lý không bao giờ được phân bổ tài nguyên (vCPU, RAM, lưu trữ) vượt quá tổng dung lượng khả dụng của nó. Việc **kiểm tra và phân bổ tài nguyên phải là nguyên tử** — một yêu cầu tạo máy chủ đồng thời không được phép quan sát cùng dung lượng trống và phân bổ kép lên đó.

---

## Quy tắc Tạo Máy chủ

### BR-06 — Giới hạn Máy chủ Đồng thời
Một khách hàng có thể có tối đa **5 phiên bản máy chủ đang hoạt động** tại bất kỳ thời điểm nào. Giới hạn này KHÔNG áp dụng cho khách hàng thuộc gói Enterprise.

### BR-07 — Thời gian Chờ Cung cấp
Container runtime phải phản hồi thành công trong vòng **60 giây** kể từ thời điểm yêu cầu tạo được gửi đi. Nếu không nhận được phản hồi trong khoảng thời gian này, thao tác được đánh dấu là FAILED và giao dịch bị rollback.

### BR-08 — Kích thước Image ≤ Dung lượng Đĩa Gói
Kích thước đĩa của ImageTemplate được chọn phải nhỏ hơn hoặc bằng dung lượng đĩa của ServerPlan đã chọn.

### BR-09 — Tính khả dụng theo Khu vực
Khách hàng chỉ được tạo máy chủ trong trung tâm dữ liệu (khu vực) được kích hoạt cho tài khoản và gói đăng ký của họ.

### BR-10 — Kích thước Đĩa Tối thiểu
Mỗi phiên bản máy chủ phải có kích thước đĩa tối thiểu là **5 GB**.

### BR-11 — Tính Duy nhất của Hostname trên mỗi Người dùng
Hostname máy chủ của khách hàng phải là duy nhất trong chính tài khoản của họ (những người dùng khác nhau có thể có cùng hostname).

### BR-12 — Quyền Sở hữu Khóa SSH
Khóa SSH được sử dụng cho xác thực máy chủ phải thuộc về chính khách hàng đang tạo máy chủ đó.

---

## Quy tắc Vòng đời Máy chủ

### BR-13 — Điều kiện Tiên quyết Start
Một phiên bản máy chủ phải ở trạng thái `STOPPED` trước khi thao tác Start được chấp nhận.

### BR-14 — Điều kiện Tiên quyết Stop
Một phiên bản máy chủ phải ở trạng thái `RUNNING` trước khi thao tác Stop được chấp nhận.

### BR-15 — Điều kiện Tiên quyết Xóa
Một phiên bản máy chủ phải ở trạng thái `STOPPED` trước khi có thể bị xóa (hủy).

### BR-16 — Giải phóng Tài nguyên khi Xóa
Khi một máy chủ bị xóa, TẤT CẢ tài nguyên (vCPU, RAM, lưu trữ, địa chỉ IP) được phân bổ cho phiên bản đó phải được trả lại về nhóm khả dụng của nút. IP phải được đặt về trạng thái tự do (`IpAddress.serverId = NULL`).

### BR-16a — Tính Duy nhất của IP
Không có địa chỉ IP công cộng nào được gán cho nhiều hơn một máy chủ tại bất kỳ thời điểm nào. Việc phân bổ IP là nguyên tử — việc đặt chỗ diễn ra trong cùng một giao dịch cơ sở dữ liệu với việc đặt chỗ dung lượng Nút.

### BR-16b — Dung lượng Nhóm IP
Mỗi nút phải có ít nhất một địa chỉ IP trống trong nhóm của nó để chấp nhận triển khai máy chủ mới. Nếu không có IP trống nào trên bất kỳ nút nào có đủ dung lượng, yêu cầu cung cấp bị từ chối ([BR-05]).

### BR-17 — Phương án Dự phòng Force Stop
Nếu tắt máy nhẹ nhàng (SIGTERM) không hoàn thành trong vòng 30 giây, một force stop (SIGKILL) sẽ được áp dụng.

### BR-18 — Xóa Backup Máy chủ
Khi một máy chủ bị xóa, tất cả các backup liên quan cũng phải bị xóa và dung lượng lưu trữ của chúng được giải phóng.

---

## Quy tắc Kiểm toán

### BR-17a — Khóa Thao tác Máy chủ
Một phiên bản máy chủ không được chấp nhận một thao tác bất đồng bộ mới (create, stop, restart, delete, backup, restore) trong khi một thao tác khác đang diễn ra. Trường `lockedBy` được kiểm tra nguyên tử thông qua UPDATE có điều kiện trước bất kỳ lệnh gọi Docker Engine nào. Nếu máy chủ đã bị khóa, API trả về `409 CONFLICT` kèm tên thao tác đang hoạt động.

### BR-17b — Khôi phục Khóa Cũ
Nếu một thao tác vượt quá thời gian chờ đã cấu hình (ví dụ: CREATING > 60s, BACKING_UP > 5 phút), một cron job sẽ xóa khóa, đánh dấu máy chủ là `ERROR` và cảnh báo quản trị viên. Ngưỡng thời gian chờ được định nghĩa cho từng thao tác và có thể cấu hình thông qua `SystemSetting`.

### BR-19 — Kiểm toán Thay đổi Trạng thái
Mỗi thao tác thay đổi trạng thái (create, start, stop, restart, delete) trên một máy chủ phải tạo ra một bản ghi nhật ký kiểm toán bất biến ghi lại: tác nhân, hành động, ID máy chủ đích, dấu thời gian và kết quả (thành công/thất bại).

### BR-20 — Kiểm toán Hành động Quản trị
Bất kỳ hành động quản trị nào sửa đổi tài khoản người dùng, gói máy chủ, image, nút, cài đặt hệ thống hoặc mức thuế suất đều phải tạo ra một bản ghi nhật ký kiểm toán.

---

## Quy tắc Xác thực & Tài khoản

### BR-21 — Thông tin Đăng nhập Duy nhất
Mỗi người dùng phải có một tên người dùng duy nhất và một địa chỉ email duy nhất trên toàn hệ thống. Tính duy nhất chỉ được thực thi giữa các **tài khoản đang hoạt động** (`deletedAt IS NULL`). Tên người dùng và email của tài khoản bị xóa mềm trở nên khả dụng để đăng ký lại ngay sau khi xóa.

### BR-22 — Độ phức tạp Mật khẩu
Mật khẩu phải dài ít nhất **8 ký tự** và chứa ít nhất một chữ hoa, một chữ thường và một chữ số.

### BR-23 — Khóa Tài khoản
Sau **5 lần đăng nhập thất bại liên tiếp** trong cửa sổ 10 phút, tài khoản bị khóa trong **15 phút**.

### BR-24 — Thực thi 2FA (Quản trị viên)
Tài khoản quản trị viên phải bật 2FA. Tài khoản nhân viên được khuyến khích nhưng không bắt buộc.

### BR-25 — Quản lý Phiên
Một người dùng có thể có tối đa 5 phiên hoạt động. Tạo phiên thứ 6 sẽ vô hiệu hóa phiên cũ nhất.

### BR-26 — Giới hạn Tốc độ API Key
Các yêu cầu xác thực bằng API key chịu cùng giới hạn tốc độ như các yêu cầu xác thực bằng bearer token (60 req/phút cho mỗi key).

---

## Quy tắc Thanh toán & Hóa đơn

### BR-27 — Yêu cầu Trả trước
Khách hàng phải có số dư ví đủ để chi trả ít nhất cho kỳ thanh toán đầu tiên (theo tháng) hoặc giờ đầu tiên (theo giờ) trước khi máy chủ có thể được tạo.

### BR-28 — Tự động Khấu trừ
Đối với hóa đơn theo giờ, hệ thống khấu trừ từ số dư ví mỗi giờ. Đối với hóa đơn theo tháng, việc khấu trừ diễn ra khi tạo và vào mỗi ngày gia hạn.

### BR-29 — Thời gian Gia hạn Số dư Không đủ
Nếu tự động khấu trừ thất bại do số dư không đủ, máy chủ sẽ vào thời gian gia hạn 24 giờ. Sau khi hết thời gian gia hạn mà không nạp tiền, máy chủ sẽ bị dừng.

### BR-30 — Tạo Hóa đơn
Một hóa đơn được tạo cho mỗi lần khấu trừ ví (biên lai nạp tiền) và mỗi lần tính phí. Hóa đơn được lưu trữ dưới dạng bản ghi PDF bất biến.

### BR-31 — Lưu giữ Phương thức Thanh toán
Phương thức thanh toán Stripe được mã hóa — số thẻ thô không bao giờ được lưu trữ trong cơ sở dữ liệu của Astral Cloud.

### BR-32 — Chính sách Hoàn tiền
Hoàn tiền chỉ được xử lý cho số dư trả trước theo tháng chưa sử dụng (tính theo tỷ lệ). Hóa đơn theo giờ không được hoàn tiền.

---

## Quy tắc Voucher

### BR-33 — Tính Duy nhất của Voucher
Mã voucher phải là duy nhất trên toàn hệ thống (không phân biệt chữ hoa chữ thường).

### BR-34 — Cửa sổ Hiệu lực Voucher
Voucher có các ngày `validFrom` và `validUntil` tùy chọn. Ngoài cửa sổ này, voucher bị từ chối.

### BR-35 — Giới hạn Sử dụng Voucher
Voucher có thể có số lần sử dụng tối đa (`maxUses`). Khi đạt đến, các lần đổi tiếp theo bị từ chối.

### BR-36 — Giới hạn Voucher trên mỗi Người dùng
Một khách hàng chỉ được đổi một voucher cụ thể tối đa một lần.

### BR-37 — Chi tiêu Tối thiểu của Voucher
Voucher có thể yêu cầu số tiền đơn hàng/thanh toán tối thiểu trước khi có thể được áp dụng.

### BR-38 — Kết hợp Voucher
Nhiều voucher có thể được áp dụng cho một lần thanh toán, nhưng tổng chiết khấu không được vượt quá số tiền thanh toán.

---

## Quy tắc Vé Hỗ trợ

### BR-39 — Quyền Sở hữu Vé
Vé chỉ hiển thị với khách hàng đã mở vé và người dùng nhân viên/quản trị viên.

### BR-40 — Vòng đời Trạng thái Vé
Chuyển đổi trạng thái vé: OPEN → IN_PROGRESS → WAITING_ON_CUSTOMER → RESOLVED → CLOSED. Chỉ nhân viên/quản trị viên mới có thể đặt RESOLVED; chỉ khách hàng mới có thể đặt CLOSED.

### BR-41 — Mở lại Vé
Vé CLOSED có thể được khách hàng mở lại trong vòng 7 ngày. Sau 7 ngày, phải tạo vé mới.

### BR-42 — Tự động Đóng Vé
Vé RESOLVED không có phản hồi từ khách hàng trong 72 giờ sẽ tự động được CLOSED.

---

## Quy tắc Blog

### BR-43 — Hiển thị Blog
Bài đăng blog có thể là DRAFT (chỉ hiển thị với nhân viên/quản trị viên), PUBLISHED (hiển thị với tất cả), hoặc ARCHIVED (ẩn khỏi danh sách nhưng có thể truy cập qua URL trực tiếp).

### BR-44 — Tính Duy nhất của Slug Blog
Slug của bài đăng blog phải là duy nhất trên toàn hệ thống.

### BR-45 — Ghi nhận Tác giả Blog
Tác giả của bài đăng blog phải là người dùng STAFF hoặc ADMIN. Nếu tài khoản tác giả bị xóa, bài đăng vẫn giữ tên tác giả dưới dạng snapshot.

---

## Quy tắc Tường lửa

### BR-46 — Phạm vi Quy tắc Tường lửa
Quy tắc tường lửa áp dụng cho một máy chủ đơn lẻ. Chính sách từ chối tất cả mặc định cho lưu lượng vào ngoại trừ các cổng được mở rõ ràng.

### BR-47 — Ưu tiên Quy tắc Tường lửa
Quy tắc được đánh giá theo thứ tự ưu tiên (số thấp hơn = ưu tiên cao hơn). Quy tắc khớp đầu tiên xác định hành động (ALLOW/DENY).

### BR-48 — Quy tắc Tường lửa Mặc định
Khi tạo máy chủ, các quy tắc mặc định cho phép: SSH (22/tcp), HTTP (80/tcp), HTTPS (443/tcp). Khách hàng có thể sửa đổi hoặc xóa.

---

## Quy tắc DNS

### BR-49 — Tính Duy nhất của Bản ghi DNS
Bản ghi DNS (tên + loại) phải là duy nhất trên mỗi máy chủ.

### BR-50 — Reverse DNS
Mỗi máy chủ có thể có đúng một bản ghi PTR (reverse DNS) trỏ đến IP chính của nó.

---

## Quy tắc Backup

### BR-51 — Lưu giữ Backup
Backup tự động được lưu giữ trong khoảng thời gian được chỉ định bởi lịch backup (mặc định: 7 bản hàng ngày, 4 bản hàng tuần, 3 bản hàng tháng).

### BR-52 — Hạn ngạch Lưu trữ Backup
Tổng dung lượng lưu trữ backup trên mỗi máy chủ không được vượt quá 2× kích thước đĩa được phân bổ của máy chủ.

### BR-53 — Backup Đồng thời
Một máy chủ có thể có tối đa một tác vụ backup đang chạy tại bất kỳ thời điểm nào.

---

## Quy tắc Giới thiệu

### BR-54 — Tính Duy nhất của Mã Giới thiệu
Mỗi người dùng có đúng một mã giới thiệu, được tạo khi tạo tài khoản. Nó là bất biến.

### BR-55 — Tín dụng Giới thiệu
Khi người dùng được giới thiệu thực hiện thanh toán đầu tiên (nạp tiền), cả người giới thiệu và người được giới thiệu đều nhận được một số tiền tín dụng có thể cấu hình.

### BR-56 — Ngưỡng Rút tiền Giới thiệu
Tín dụng giới thiệu trở nên có thể rút (payout) khi tín dụng tích lũy đạt đến ngưỡng tối thiểu có thể cấu hình (mặc định: $50).

### BR-57 — Ngăn chặn Tự Giới thiệu
Người dùng không thể sử dụng mã giới thiệu của chính mình. Việc giới thiệu được theo dõi theo IP và fingerprint trình duyệt để ngăn chặn lạm dụng.

---

## Quy tắc Thông báo

### BR-58 — Kênh Thông báo
Thông báo được gửi qua trung tâm thông báo trong ứng dụng VÀ email (nếu người dùng đã xác minh email). Người dùng có thể từ chối nhận email không quan trọng.

### BR-59 — Thông báo Quan trọng
Lỗi cung cấp máy chủ, lỗi thanh toán và cảnh báo bảo mật tài khoản là quan trọng — người dùng không thể từ chối nhận những thông báo này.

---

## Quy tắc Thuế

### BR-60 — Thuế theo Khu vực Hóa đơn
Mức thuế suất được xác định bởi khu vực địa chỉ thanh toán của khách hàng. Nếu không có địa chỉ thanh toán nào được đặt, khu vực của máy chủ sẽ xác định mức thuế suất mặc định.

### BR-61 — Miễn Thuế
Người dùng có trạng thái miễn thuế hợp lệ (được quản trị viên xác minh) không bị tính thuế. Cờ này được đặt trên bản ghi người dùng.

---

## Quy tắc GDPR / Quyền riêng tư Dữ liệu

### BR-62 — Xuất Dữ liệu
Khách hàng có thể yêu cầu xuất tất cả dữ liệu cá nhân của họ dưới định dạng máy đọc được. Việc xuất được tạo bất đồng bộ và một liên kết tải xuống được gửi qua email.

### BR-63 — Xóa Tài khoản
Khách hàng có thể yêu cầu xóa tài khoản vĩnh viễn. Tất cả máy chủ phải được xóa trước. Sau khi xác nhận, tất cả dữ liệu cá nhân sẽ bị xóa trong vòng 30 ngày. Nhật ký kiểm toán được ẩn danh (userId được đặt thành null, IP bị cắt ngắn).

---

## Quy tắc API Key

### BR-64 — Quyền của API Key
API key kế thừa các quyền của người dùng đã tạo ra chúng. Việc xoay vòng key sẽ vô hiệu hóa key trước đó.

### BR-65 — Hết hạn API Key
API key có thể có ngày hết hạn tùy chọn. Key đã hết hạn bị từ chối với mã 401.

---

## Quy tắc Cấu hình Hệ thống

### BR-66 — Xác thực Thiết lập Hệ thống
Thiết lập hệ thống được định kiểu (STRING, NUMBER, BOOLEAN, JSON) và được xác thực khi lưu. Giá trị không hợp lệ bị từ chối.

### BR-67 — Thiết lập Bất biến
Một số thiết lập hệ thống (ví dụ: `JWT_SECRET`) được đánh dấu là bất biến qua giao diện người dùng và chỉ có thể thay đổi qua biến môi trường.

---

## Quy tắc Nút / Cơ sở Hạ tầng

### BR-68 — Trạng thái Nút
Một nút có thể là ONLINE (chấp nhận triển khai), OFFLINE (không chấp nhận), hoặc MAINTENANCE (draining — máy chủ hiện có vẫn chạy, không triển khai mới).

### BR-69 — Drain Nút
Khi một nút vào trạng thái MAINTENANCE, không có máy chủ mới nào được triển khai lên nó. Máy chủ hiện có tiếp tục chạy cho đến khi được di chuyển hoặc xóa. Quản trị viên chịu trách nhiệm di chuyển.

### BR-70 — Sức khỏe Container Runtime
Sức khỏe Docker daemon của mỗi nút được kiểm tra mỗi 60 giây. Ba lần thất bại liên tiếp kích hoạt cảnh báo quản trị viên và tự động thay đổi trạng thái thành OFFLINE.

---

## Quy tắc Mạng Riêng

### BR-71 — Phạm vi Mạng Riêng
Một mạng riêng tồn tại trong một khu vực duy nhất. Máy chủ ở các khu vực khác nhau không thể nằm trên cùng một mạng riêng.

### BR-72 — CIDR Mạng Riêng
Mỗi mạng riêng phải có một dải CIDR không chồng lấn. Quản trị viên cấu hình các khối CIDR khả dụng; khách hàng chọn từ các dải có sẵn.

### BR-73 — Máy chủ trên mỗi Mạng Riêng
Một máy chủ có thể được gắn vào tối đa một mạng riêng tại một thời điểm.

### BR-74 — Gán IP Riêng
Khi một máy chủ tham gia mạng riêng, nó nhận được một IP riêng được tự động gán từ dải CIDR của mạng. IP được giải phóng khi máy chủ rời mạng hoặc bị xóa.

---

## Quy tắc Floating IP

### BR-75 — Gán Floating IP
Một floating IP có thể được gán cho đúng một máy chủ tại một thời điểm, hoặc không được gán. Việc gán là nguyên tử (cùng mẫu UPDATE có điều kiện như IPAM).

### BR-76 — Chuyển Floating IP
Một floating IP có thể được chuyển giữa hai máy chủ trong cùng một khu vực. Việc chuyển là nguyên tử — IP không bao giờ có thể truy cập từ cả hai máy chủ đồng thời.

### BR-77 — Lưu giữ Floating IP
Floating IP được tính phí miễn là chúng tồn tại, bất kể trạng thái gán. Floating IP không được gán chịu phí giữ chỗ.

---

## Quy tắc Block Volume

### BR-78 — Ràng buộc Khu vực Volume
Một block volume tồn tại trong một khu vực duy nhất và chỉ có thể được gắn vào máy chủ trong khu vực đó.

### BR-79 — Giới hạn Kích thước Volume
Kích thước volume tối thiểu: 1 GB. Tối đa: 16 TB. Volume chỉ có thể được tăng kích thước (không bao giờ thu nhỏ).

### BR-80 — Gắn Volume
Một volume có thể được gắn vào tối đa một máy chủ tại một thời điểm. Việc gắn yêu cầu máy chủ ở trạng thái ACTIVE hoặc STOPPED và không bị khóa.

### BR-81 — Tháo Volume
Volume phải được tháo trước khi xóa. Force-detach có sẵn nhưng có thể gây hỏng dữ liệu — một cảnh báo được hiển thị.

### BR-82 — Hóa đơn Volume
Volume được tính phí theo giờ dựa trên kích thước được cung cấp, bất kể trạng thái gắn.

---

## Quy tắc Cloud-init

### BR-83 — Thực thi Cloud-init
Một script cloud-init (user-data) chỉ chạy đúng một lần — vào lần khởi động đầu tiên sau khi tạo máy chủ. Nó không chạy lại trong các lần khởi động sau.

### BR-84 — Giới hạn Kích thước Cloud-init
Script cloud-init được giới hạn ở 64 KB. Script được xác thực lỗi cú pháp trước khi tạo máy chủ.

---

## Quy tắc Băng thông & Vượt mức

### BR-85 — Nhóm Băng thông
Mỗi máy chủ có một hạn mức băng thông hàng tháng được xác định bởi ServerPlan của nó (`bandwidthMbps` quy đổi thành giới hạn GB/tháng). Lưu lượng ra vượt quá hạn mức được tính phí theo tỷ lệ vượt mức trên mỗi GB.

### BR-86 — Đo lường Băng thông
Việc sử dụng băng thông được đo lường ở cấp độ giao diện mạng container và được tổng hợp hàng ngày. Mức sử dụng có thể được khách hàng truy vấn với độ chi tiết 1 giờ.

### BR-87 — Thông báo Mức Cảnh báo Mềm
Khách hàng nhận được thông báo trong ứng dụng ở mức 80% và 100% hạn mức băng thông hàng tháng của họ.

---

## Quy tắc Webhook

### BR-88 — Giới hạn Điểm cuối Webhook
Một khách hàng có thể có tối đa 10 điểm cuối webhook.

### BR-89 — Gửi Webhook
Webhook được gửi với ngữ nghĩa at-most-once. Các lần gửi thất bại được thử lại tối đa 3 lần với exponential backoff (1s, 5s, 25s). Sau 3 lần thất bại, lần gửi được đánh dấu FAILED.

### BR-90 — Xác minh Bí mật Webhook
Mỗi điểm cuối webhook có một bí mật ký. Payload được ký bằng HMAC-SHA256; khách hàng xác minh chữ ký để đảm bảo tính xác thực.

### BR-91 — Sự kiện Webhook
Các sự kiện được hỗ trợ: server.created, server.stopped, server.started, server.deleted, backup.completed, backup.failed, payment.succeeded, payment.failed.

---

## Quy tắc CLI & Terraform

### BR-92 — Xác thực CLI
CLI xác thực qua API key. Một hồ sơ cấu hình lưu trữ API key cục bộ.

### BR-93 — Terraform Provider
Terraform provider sử dụng cùng REST API như giao diện web. Không có điểm cuối nội bộ đặc quyền. Tất cả các thao tác đều bị giới hạn tốc độ giống hệt như yêu cầu API key.

---

## Quy tắc Quan sát

### BR-94 — Lưu giữ Metrics
Metrics ứng dụng (độ trễ API, tỷ lệ lỗi, độ sâu hàng đợi, sử dụng tài nguyên) được lưu giữ trong 90 ngày với độ chi tiết 1 phút. Sau 90 ngày, dữ liệu được giảm mẫu xuống độ chi tiết 1 giờ và được lưu giữ trong 2 năm.

### BR-95 — Cảnh báo
Cảnh báo quan trọng (nút ngoại tuyến, tăng trưởng hàng đợi dead-letter, đột biến lỗi thanh toán, tỷ lệ lỗi cung cấp > 1%) gửi trang đến quản trị viên qua email. Cảnh báo cảnh giác (dung lượng nút 80%, mức cảnh báo mềm băng thông) tạo thông báo trong ứng dụng.

---

## Quy tắc Trưởng thành Vận hành

### BR-96 — An toàn Migration Cơ sở Dữ liệu
Tất cả migration cơ sở dữ liệu phải tương thích ngược. Mẫu expand-contract là bắt buộc: thêm cột/bảng mới (expand), triển khai code ghi vào cả schema cũ và mới, di chuyển dữ liệu, triển khai code chỉ đọc từ schema mới, xóa cột cũ (contract). Không có `ALTER TABLE` nào chiếm khóa độc quyền trên bảng production.

### BR-97 — Chiến lược Triển khai
Triển khai production sử dụng blue-green: một stack mới được triển khai song song với stack hiện có, được smoke-test, sau đó lưu lượng được chuyển đổi. Rollback là tức thì (chuyển về stack cũ).

### BR-98 — Khôi phục Thảm họa
Backup toàn bộ cơ sở dữ liệu mỗi 6 giờ với khả năng point-in-time recovery. Diễn tập khôi phục (khôi phục về môi trường sạch từ backup mới nhất) được thực hiện hàng quý. Recovery Time Objective (RTO): 4 giờ. Recovery Point Objective (RPO): 6 giờ.

### BR-99 — Runbook
Phải có quy trình được ghi chép cho: lỗi nút, cạn kiệt nhóm IP, gián đoạn cổng thanh toán, bùng nổ worker crash, xử lý yêu cầu GDPR, xử lý khiếu nại lạm dụng. Runbook được kiểm tra trong các đợt diễn tập khôi phục thảm họa.

---

## Quy tắc Tăng cường Bảo mật

### BR-100 — Cô lập Container (Production)
Máy chủ production chạy dưới gVisor hoặc Firecracker để cô lập cấp độ phần cứng. Môi trường học tập/phát triển sử dụng cô lập container Docker tiêu chuẩn (rủi ro chấp nhận được đã được ghi chép trong mô hình mối đe dọa).

### BR-101 — WAF
Một Web Application Firewall (ModSecurity với OWASP Core Rule Set) nằm trước Nginx reverse proxy. WAF được bật trong production; tùy chọn trong staging/dev.

### BR-102 — Ký Image
Container image được ký bằng cosign trước khi được đẩy lên registry. Worker xác minh chữ ký trước khi pull. Image không được ký bị từ chối.

### BR-103 — Phát hiện Giả mạo Nhật ký Kiểm toán
Mỗi bản ghi AuditLog bao gồm một chuỗi băm: `SHA256(previousEntry.hash || thisEntry.data)`. Việc giả mạo có thể bị phát hiện bằng cách duyệt chuỗi và so sánh các giá trị băm.

### BR-104 — Kiểm thử Thâm nhập
Một cuộc kiểm thử thâm nhập bởi bên thứ ba được thực hiện trước khi tiếp nhận khách hàng trả phí. Các phát hiện ở mức critical và high phải được khắc phục trước khi ra mắt.

---

## Quy tắc Tuân thủ & Pháp lý

### BR-105 — Chấp nhận Điều khoản
Người dùng phải chấp nhận Điều khoản Dịch vụ và Chính sách Quyền riêng tư hiện hành trước khi tạo máy chủ đầu tiên của họ. Việc chấp nhận được lập phiên bản — khi điều khoản được cập nhật, người dùng hiện có được nhắc chấp nhận lại vào lần đăng nhập tiếp theo.

### BR-106 — Đồng ý Cookie
Khách truy cập EU phải đồng ý với cookie không thiết yếu trước khi chúng được đặt. Tùy chọn đồng ý được lưu trữ và tôn trọng trong 12 tháng. Cookie thiết yếu (auth, CSRF) không yêu cầu đồng ý.

### BR-107 — Gỡ bỏ DMCA
Khiếu nại DMCA được xử lý trong vòng 48 giờ. Hệ thống báo cáo lạm dụng theo dõi việc tiếp nhận, điều tra, thông báo cho chủ sở hữu máy chủ và giải quyết.

### BR-108 — DPA cho Khách hàng Doanh nghiệp
Mẫu Thỏa thuận Xử lý Dữ liệu (DPA) có sẵn cho khách hàng doanh nghiệp theo yêu cầu. DPA tham chiếu đến các biện pháp bảo mật của nền tảng (mã hóa, kiểm soát truy cập, ghi nhật ký kiểm toán, chính sách backup).

---

## Quy tắc Công cụ Quản trị

### BR-109 — Mạo danh
Quản trị viên có thể mạo danh bất kỳ người dùng nào để gỡ lỗi vấn đề. Việc mạo danh tạo ra một bản ghi nhật ký kiểm toán với cả ID quản trị viên và người dùng đích. Phiên quản trị viên bao gồm một biểu ngữ trực quan: "Impersonating {username} — all actions are audited."

### BR-110 — Feature Flag
Tính năng có thể được bật/tắt theo từng người dùng, từng vai trò hoặc theo tỷ lệ phần trăm triển khai. Feature flag được kiểm tra phía máy chủ trong mỗi yêu cầu. Flag cũ (> 90 ngày kể từ lần đánh giá cuối cùng) tạo cảnh báo quản trị viên.

### BR-111 — Bảng điều khiển Doanh thu
Bảng điều khiển quản trị viên bao gồm: MRR (Monthly Recurring Revenue), tỷ lệ rời bỏ, tỷ lệ chuyển đổi nạp tiền, khối lượng đổi voucher, chi phí thu hút khách hàng và số lượng máy chủ theo gói. Dữ liệu được làm mới hàng ngày từ các tổng hợp hóa đơn.

### BR-112 — Trần Chi tiêu
Khách hàng có thể đặt trần chi tiêu hàng tháng. Khi đạt đến trần, việc tạo máy chủ mới và tạo volume bị chặn cho đến chu kỳ hóa đơn tiếp theo. Máy chủ hiện có tiếp tục chạy và phát sinh phí.

### BR-113 — Chiết khấu theo Số lượng
Trả trước hàng năm cho máy chủ hóa đơn theo tháng cung cấp chiết khấu 20%. Khoản chiết khấu được áp dụng dưới dạng tín dụng vào ví vào đầu mỗi tháng hóa đơn. Hủy sớm sẽ mất khoản chiết khấu trả trước còn lại.

### BR-114 — Xuất CSV Hóa đơn
Khách hàng và quản trị viên có thể xuất lịch sử hóa đơn dưới dạng CSV cho mục đích kế toán. Việc xuất tôn trọng cùng tham số phân trang và bộ lọc như API lịch sử hóa đơn.

### BR-115 — Xử lý Lạm dụng
Báo cáo lạm dụng (DMCA, spam, phần mềm độc hại, đào tiền mã hóa) được nhân viên xem xét trong vòng 24 giờ. Báo cáo được xác thực dẫn đến đình chỉ máy chủ với 48 giờ để khách hàng phản hồi. Lạm dụng không được giải quyết dẫn đến xóa máy chủ.

(Hết tệp - tổng cộng 486 dòng)

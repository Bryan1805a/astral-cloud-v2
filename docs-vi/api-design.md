# Astral Cloud — Thiết kế API

URL gốc: `https://<domain>/api`

---

## 1. Xác thực

Astral Cloud sử dụng xác thực dựa trên JWT với access token ngắn hạn và refresh token dài hạn.

| Token | Thời hạn | Lưu trữ | Truyền tải | Luân chuyển |
|-------|----------|---------|-------------|----------|
| Access token | 1 giờ | Bộ nhớ client | `Authorization: Bearer <token>` header | Mỗi lần refresh |
| Refresh token | 7 ngày | Cookie HTTP-only, Secure, SameSite=Strict | `Set-Cookie: refresh_token=...` | Mỗi lần sử dụng |

**Payload token (access):**
```json
{
  "sub": "550e8400-e29b-41d4-a716-446655440001",
  "role": "CUSTOMER",
  "type": "access",
  "iat": 1711234567,
  "exp": 1711238167
}
```

**Quy trình refresh token:**
1. Client gọi `POST /api/auth/refresh` — trình duyệt tự động gửi cookie HTTP-only `refresh_token`.
2. Server xác thực hash của refresh token với bảng `Session`, kiểm tra thời hạn.
3. Server cấp access token mới (trong body response) và refresh token mới (cookie), vô hiệu hóa session cũ.

**Phương án thay thế API key:** Request cũng có thể xác thực qua header `Authorization: Bearer ak_<prefix_hash>`, sử dụng API key do người dùng tạo. API key kế thừa quyền của người dùng tạo ra nó (BR-64).

---

## 2. Định dạng Response & Mã Lỗi

### Định dạng thành công

Tất cả response thành công được bọc trong:

```json
{
  "data": { }
}
```

Đối với response danh sách có phân trang:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 142,
    "totalPages": 8
  }
}
```

### Định dạng lỗi

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description of the error."
  }
}
```

Đối với lỗi validation, `details` có thể được bao gồm thêm:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request body validation failed.",
    "details": [
      { "field": "email", "message": "Invalid email format" },
      { "field": "password", "message": "Must be at least 8 characters" }
    ]
  }
}
```

### Mã Lỗi

| Mã | HTTP Status | Ý nghĩa |
|------|-------------|---------|
| `VALIDATION_ERROR` | 400 | Đầu vào không hợp lệ theo Zod schema |
| `UNAUTHORIZED` | 401 | Thiếu hoặc access token không hợp lệ |
| `INVALID_CREDENTIALS` | 401 | Email/mật khẩu không đúng |
| `TOKEN_EXPIRED` | 401 | Access token đã hết hạn; sử dụng refresh |
| `INSUFFICIENT_BALANCE` | 402 | Số dư ví không đủ cho thao tác |
| `SERVER_LIMIT_REACHED` | 403 | Người dùng đã đạt giới hạn 5 server đang hoạt động (BR-06) |
| `ACCOUNT_LOCKED` | 423 | Tài khoản bị khóa do đăng nhập sai quá nhiều lần (BR-23) |
| `FORBIDDEN` | 403 | Đã xác thực nhưng thiếu quyền yêu cầu |
| `NOT_FOUND` | 404 | Tài nguyên yêu cầu không tồn tại |
| `INVALID_STATE` | 409 | Thao tác không hợp lệ với trạng thái hiện tại của tài nguyên (vd: khởi động server đang chạy) |
| `USERNAME_TAKEN` | 409 | Username đã được đăng ký (BR-21) |
| `EMAIL_TAKEN` | 409 | Email đã được đăng ký (BR-21) |
| `VOUCHER_EXPIRED` | 400 | Voucher ngoài thời hạn hiệu lực (BR-34) |
| `VOUCHER_EXHAUSTED` | 400 | Voucher đã đạt giới hạn sử dụng (BR-35) |
| `VOUCHER_ALREADY_USED` | 400 | Người dùng đã sử dụng voucher này rồi (BR-36) |
| `VOUCHER_MIN_SPEND` | 400 | Số tiền thanh toán thấp hơn mức tối thiểu của voucher (BR-37) |
| `INVALID_REFERRAL_CODE` | 400 | Mã giới thiệu không tồn tại hoặc là của chính người dùng (BR-57) |
| `RATE_LIMITED` | 429 | Quá nhiều request (xem Giới hạn Tốc độ) |
| `INTERNAL_ERROR` | 500 | Lỗi server chưa được xử lý |
| `NODE_CAPACITY` | 503 | Không có node nào khả dụng với đủ tài nguyên trống (BR-05) |
| `RUNTIME_UNREACHABLE` | 502 | Không thể kết nối Docker daemon trên node đích |
| `2FA_REQUIRED` | 401 | Tài khoản đã bật 2FA; phải cung cấp mã TOTP |
| `INVALID_2FA_CODE` | 401 | Mã TOTP không hợp lệ |

---

## 3. Endpoints — Xác thực

### POST /api/auth/register

**Auth:** None (public)

**Idempotency:** Not applicable

**UC-02:** Register Account
**BR-21:** Unique Credentials
**BR-22:** Password Complexity

Đăng ký tài khoản người dùng mới. Khi thành công, email xác minh sẽ được gửi.

**Request Body:**
```json
{
  "username": "jane_doe",
  "email": "jane@example.com",
  "password": "Str0ng!Pass",
  "confirmPassword": "Str0ng!Pass",
  "referralCode": "ALICE1234"
}
```

| Trường | Type | Bắt buộc | Constraints |
|-------|------|----------|-------------|
| `username` | string(32) | Có | Phải duy nhất (BR-21), chữ cái/số và dấu gạch dưới, 3–32 ký tự |
| `email` | string(255) | Có | Phải duy nhất (BR-21), định dạng email hợp lệ |
| `password` | string(128) | Có | Tối thiểu 8 ký tự, 1 chữ hoa, 1 chữ thường, 1 số (BR-22) |
| `confirmPassword` | string(128) | Có | Phải khớp chính xác với `password` |
| `referralCode` | string(16) | Không | Phải là mã giới thiệu hợp lệ, đang hoạt động; không thể là của chính người dùng (BR-57) |

**Response (201 Created):**
```json
{
  "data": {
    "userId": "550e8400-e29b-41d4-a716-446655440001",
    "username": "jane_doe",
    "email": "jane@example.com",
    "role": "CUSTOMER",
    "status": "PENDING_VERIFICATION",
    "referralCode": "JANE42KX",
    "createdAt": "2026-06-27T14:30:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `USERNAME_TAKEN`, `EMAIL_TAKEN`, `INVALID_REFERRAL_CODE`, `RATE_LIMITED`

---

### POST /api/auth/login

**Auth:** None (public)

**UC-03:** Login
**BR-23:** Account Lockout
**BR-24:** 2FA Enforcement (Admin)
**BR-25:** Session Management

Xác thực bằng email và mật khẩu. Nếu tài khoản đã bật 2FA, lỗi `2FA_REQUIRED` được trả về với token tạm thời cho bước thứ hai.

**Request Body:**
```json
{
  "email": "jane@example.com",
  "password": "Str0ng!Pass",
  "rememberMe": true,
  "totpCode": "123456"
}
```

| Trường | Type | Bắt buộc | Constraints |
|-------|------|----------|-------------|
| `email` | string(255) | Có | |
| `password` | string(128) | Có | |
| `rememberMe` | boolean | Không (mặc định: false) | Kéo dài refresh token lên 30 ngày |
| `totpCode` | string(6) | Không | Chỉ bắt buộc nếu tài khoản đã bật 2FA |

**Response (200 OK) — không có 2FA:**
```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresAt": "2026-06-27T15:30:00.000Z",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "username": "jane_doe",
      "email": "jane@example.com",
      "role": "CUSTOMER",
      "status": "ACTIVE",
      "twoFactorEnabled": false
    }
  }
}
```

`Set-Cookie: refresh_token=<token>; HttpOnly; Secure; SameSite=Strict; Path=/api/auth/refresh; Max-Age=604800`

**Response (200 OK) — yêu cầu 2FA:**
```json
{
  "error": {
    "code": "2FA_REQUIRED",
    "message": "This account has two-factor authentication enabled. Please provide a TOTP code.",
    "data": {
      "tempToken": "eyJhbGciOiJIUzI1NiIs..."
    }
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `INVALID_CREDENTIALS`, `ACCOUNT_LOCKED`, `2FA_REQUIRED`, `RATE_LIMITED`

---

### POST /api/auth/refresh

**Auth:** Cookie (refresh token)

**UC-03:** Login

Đổi cookie refresh token hợp lệ để nhận access token mới + refresh token mới. Session cũ bị vô hiệu hóa.

**Request Body:** None (cookie-based)

**Response (200 OK):**
```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresAt": "2026-06-27T15:30:00.000Z"
  }
}
```

Cookie `Set-Cookie` mới được cấp.

**Error Codes:** `UNAUTHORIZED`, `TOKEN_EXPIRED`, `RATE_LIMITED`

---

### GET /api/auth/me

**Auth:** Bearer token or API key

**UC-03:** Login

Trả về hồ sơ của người dùng hiện đang xác thực.

**Response (200 OK):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "username": "jane_doe",
    "email": "jane@example.com",
    "role": "CUSTOMER",
    "status": "ACTIVE",
    "balance": "42.50",
    "referralCode": "JANE42KX",
    "taxExempt": false,
    "billingAddress": {
      "line1": "123 Main St",
      "line2": "Apt 4B",
      "city": "San Francisco",
      "state": "CA",
      "postal": "94102",
      "country": "US"
    },
    "twoFactorEnabled": true,
    "emailVerifiedAt": "2026-06-27T14:45:00.000Z",
    "lastLoginAt": "2026-06-27T14:30:05.000Z",
    "createdAt": "2026-06-27T14:30:00.000Z"
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `TOKEN_EXPIRED`

---

### POST /api/auth/logout

**Auth:** Bearer token

**UC-03:** Login

Vô hiệu hóa session hiện tại (thu hồi refresh token). Client nên hủy bỏ access token.

**Request Body:** None

**Response (200 OK):**
```json
{
  "data": {
    "message": "Logged out successfully."
  }
}
```

`Set-Cookie` với `Max-Age=0` để xóa cookie refresh token.

**Error Codes:** `UNAUTHORIZED`

---

### POST /api/auth/forgot-password

**Auth:** None (public)

**FR-AUTH-13:** Password Reset

Gửi email đặt lại mật khẩu đến địa chỉ đã đăng ký. Luôn trả về 200 (không liệt kê người dùng — NFR-SEC-07).

**Request Body:**
```json
{
  "email": "jane@example.com"
}
```

| Trường | Type | Bắt buộc |
|-------|------|----------|
| `email` | string(255) | Có |

**Response (200 OK):**
```json
{
  "data": {
    "message": "If an account with that email exists, a password reset link has been sent."
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `RATE_LIMITED`

---

### POST /api/auth/reset-password

**Auth:** None (public)

**FR-AUTH-13:** Password Reset

Đặt lại mật khẩu bằng token được gửi qua email cho người dùng.

**Request Body:**
```json
{
  "token": "c2VjcmV0LXBhc3N3b3JkLXJlc2V0LXRva2Vu...",
  "newPassword": "NewStr0ng!Pass"
}
```

| Trường | Type | Bắt buộc | Constraints |
|-------|------|----------|-------------|
| `token` | string | Có | Token đặt lại được gửi qua email |
| `newPassword` | string(128) | Có | Tối thiểu 8 ký tự, 1 chữ hoa, 1 chữ thường, 1 số (BR-22) |

**Response (200 OK):**
```json
{
  "data": {
    "message": "Password has been reset successfully. You may now log in."
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `NOT_FOUND` (invalid/expired token), `RATE_LIMITED`

---

### POST /api/auth/verify-email

**Auth:** None (public)

**FR-AUTH-14:** Email Verification

Xác minh địa chỉ email bằng token được gửi trong quá trình đăng ký.

**Request Body:**
```json
{
  "token": "ZW1haWwtdmVyaWZpY2F0aW9uLXRva2Vu..."
}
```

| Trường | Type | Bắt buộc |
|-------|------|----------|
| `token` | string | Có |

**Response (200 OK):**
```json
{
  "data": {
    "message": "Email verified successfully."
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `NOT_FOUND` (invalid/expired token)

---

### POST /api/auth/2fa/enable

**Auth:** Bearer token

**UC-08:** 2FA Management
**FR-AUTH-09:** TOTP 2FA

Bắt đầu quá trình thiết lập 2FA. Trả về TOTP secret và QR code URI. Yêu cầu xác nhận qua bước verify.

**Request Body:**
```json
{
  "totpCode": "654321"
}
```

| Trường | Type | Bắt buộc | Constraints |
|-------|------|----------|-------------|
| `totpCode` | string(6) | Có | Mã từ ứng dụng authenticator, dùng để hoàn tất kích hoạt |

**Response (200 OK) — Thiết lập ban đầu (trước khi verify):**
```json
{
  "data": {
    "secret": "JBSWY3DPEHPK3PXP",
    "qrCodeUri": "otpauth://totp/Astral%20Cloud:jane@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Astral%20Cloud",
    "backupCodes": [
      "a1b2-c3d4-e5f6",
      "g7h8-i9j0-k1l2",
      "m3n4-o5p6-q7r8",
      "s9t0-u1v2-w3x4",
      "y5z6-a7b8-c9d0"
    ]
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `INVALID_2FA_CODE`, `UNAUTHORIZED`

---

### POST /api/auth/2fa/disable

**Auth:** Bearer token

**UC-08:** 2FA Management

Tắt 2FA cho tài khoản hiện tại. Yêu cầu mã TOTP hợp lệ để xác nhận. Tài khoản ADMIN không thể tắt 2FA (BR-24).

**Request Body:**
```json
{
  "totpCode": "123456"
}
```

| Trường | Type | Bắt buộc |
|-------|------|----------|
| `totpCode` | string(6) | Có |

**Response (200 OK):**
```json
{
  "data": {
    "message": "Two-factor authentication has been disabled."
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `INVALID_2FA_CODE`, `FORBIDDEN` (cho tài khoản ADMIN — BR-24), `UNAUTHORIZED`

---

### POST /api/auth/2fa/verify

**Auth:** Temporary token (returned from login as `tempToken`)

Dùng trong quy trình đăng nhập để hoàn tất xác minh 2FA.

**Request Body:**
```json
{
  "tempToken": "eyJhbGciOiJIUzI1NiIs...",
  "totpCode": "123456"
}
```

| Trường | Type | Bắt buộc |
|-------|------|----------|
| `tempToken` | string | Có | Token tạm thời từ response đăng nhập |
| `totpCode` | string(6) | Có | Mã TOTP hiện tại từ ứng dụng authenticator |

**Response (200 OK):**
```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresAt": "2026-06-27T15:30:00.000Z",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "username": "jane_doe",
      "email": "jane@example.com",
      "role": "CUSTOMER",
      "status": "ACTIVE",
      "twoFactorEnabled": true
    }
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `INVALID_2FA_CODE`, `TOKEN_EXPIRED`

---

### GET /api/auth/sessions

**Auth:** Bearer token

**FR-AUTH-11:** Quản lý Session

Liệt kê tất cả session đang hoạt động của người dùng hiện tại.

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "userAgent": "Mozilla/5.0 (X11; Linux x86_64) Chrome/126.0.0.0",
      "ipAddress": "203.0.113.42",
      "createdAt": "2026-06-27T14:30:05.000Z",
      "expiresAt": "2026-07-04T14:30:05.000Z",
      "isCurrent": true
    },
    {
      "id": "3b8a2f14-6a9d-4e1f-b7c2-12d8e4f56a7b",
      "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/17.0",
      "ipAddress": "198.51.100.17",
      "createdAt": "2026-06-26T09:12:00.000Z",
      "expiresAt": "2026-07-03T09:12:00.000Z",
      "isCurrent": false
    }
  ]
}
```

**Error Codes:** `UNAUTHORIZED`

---

### DELETE /api/auth/sessions/:sessionId

**Auth:** Bearer token

**FR-AUTH-11:** Quản lý Session

Thu hồi một session cụ thể. Bản ghi session bị xóa và refresh token của nó bị vô hiệu hóa.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `sessionId` | UUID | ID của session cần thu hồi |

**Response (200 OK):**
```json
{
  "data": {
    "message": "Session revoked."
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN` (nếu cố gắng thu hồi session của người dùng khác)

---

## 4. Endpoints — API Keys

### GET /api/api-keys

**Auth:** Bearer token or API key

**UC-09:** Quản lý API Key
**FR-APIKEY-01:** Tạo API Key

Liệt kê API key của người dùng hiện tại. Chỉ prefix và metadata được trả về — key đầy đủ không bao giờ hiển thị sau khi tạo.

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "label": "CI/CD Pipeline",
      "keyPrefix": "ak_d7f3a1b2",
      "lastUsedAt": "2026-06-27T12:05:00.000Z",
      "expiresAt": "2026-12-31T23:59:59.000Z",
      "createdAt": "2026-06-01T08:00:00.000Z"
    },
    {
      "id": "b2c3d4e5-f678-90ab-cdef-1234567890ab",
      "label": "Dev laptop",
      "keyPrefix": "ak_9e2c4f8a",
      "lastUsedAt": "2026-06-27T13:45:00.000Z",
      "expiresAt": null,
      "createdAt": "2026-06-15T10:30:00.000Z"
    }
  ]
}
```

**Error Codes:** `UNAUTHORIZED`

---

### POST /api/api-keys

**Auth:** Bearer token

**UC-09:** Quản lý API Key
**FR-APIKEY-01:** Tạo API Key
**FR-APIKEY-02:** Key Đầy đủ Một Lần
**BR-65:** Hết hạn API Key

Tạo API key mới. Key đầy đủ chỉ được trả về một lần trong response này (FR-APIKEY-02).

**Request Body:**
```json
{
  "label": "My CI/CD Pipeline",
  "expiresAt": "2026-12-31T23:59:59.000Z"
}
```

| Trường | Type | Bắt buộc | Constraints |
|-------|------|----------|-------------|
| `label` | string(64) | Có | Tối đa 64 ký tự |
| `expiresAt` | datetime (ISO 8601) | Không | Null = không bao giờ hết hạn (BR-65) |

**Response (201 Created):**
```json
{
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "label": "My CI/CD Pipeline",
    "key": "ak_d7f3a1b2c4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
    "keyPrefix": "ak_d7f3a1b2",
    "expiresAt": "2026-12-31T23:59:59.000Z",
    "createdAt": "2026-06-27T14:30:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`

---

### DELETE /api/api-keys/:keyId

**Auth:** Bearer token

**UC-09:** Quản lý API Key
**FR-APIKEY-03:** Thu hồi API Key

Thu hồi (xóa) API key. Key ngừng hoạt động ngay lập tức.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `keyId` | UUID | ID của API key cần thu hồi |

**Response (200 OK):**
```json
{
  "data": {
    "message": "API key revoked."
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN` (không phải key của người dùng)

---

## 5. Endpoints — Servers

### GET /api/servers

**Auth:** Bearer token or API key

**UC-04:** Xem Danh sách Server
**FR-SERVER-12:** Danh sách Phân trang
**FR-SERVER-13:** Lọc theo Trạng thái & Tags

Liệt kê các server của người dùng đã xác thực với phân trang và lọc.

**Query Parameters:**

| Tham số | Type | Bắt buộc | Mặc định | Mô tả |
|-----------|------|----------|---------|-------------|
| `page` | int | Không | 1 | Số trang |
| `limit` | int | Không | 20 | Số mục mỗi trang (tối đa 100) |
| `status` | enum | Không | — | Filter: CREATING, ACTIVE, STOPPED, ERROR |
| `tagId` | UUID | Không | — | Lọc server theo tag đã gán |

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "hostname": "my-web-server",
      "status": "ACTIVE",
      "ipAddress": "203.0.113.10",
      "plan": {
        "id": "b1e4f7a2-c3d5-4890-9f1e-2a3b4c5d6e7f",
        "name": "Starter",
        "slug": "starter"
      },
      "image": {
        "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        "name": "Ubuntu 24.04 LTS",
        "slug": "ubuntu-24-04"
      },
      "region": {
        "id": "8f3a2b1c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
        "name": "US East",
        "slug": "us-east"
      },
      "billingModel": "MONTHLY",
      "vcpu": 2,
      "ramMB": 2048,
      "diskGB": 25,
      "nextBillingAt": "2026-07-27T14:30:00.000Z",
      "createdAt": "2026-06-27T14:30:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 3,
    "totalPages": 1
  }
}
```

**Error Codes:** `UNAUTHORIZED`

---

### GET /api/servers/:serverId

**Auth:** Bearer token or API key

**UC-04:** Xem Chi tiết Server
**FR-SERVER-20:** Thông tin Chi tiết Server

Lấy thông tin chi tiết đầy đủ của một server bao gồm các tag liên kết.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `serverId` | UUID | ID của server |

**Response (200 OK):**
```json
{
  "data": {
    "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "hostname": "my-web-server",
    "status": "ACTIVE",
    "ipAddress": "203.0.113.10",
    "dockerContainerId": "a1b2c3d4e5f6",
    "plan": {
      "id": "b1e4f7a2-c3d5-4890-9f1e-2a3b4c5d6e7f",
      "name": "Starter",
      "slug": "starter",
      "vcpu": 2,
      "ramMB": 2048,
      "diskGB": 25,
      "bandwidthMbps": 100,
      "priceMonthly": "10.00",
      "priceHourly": "0.015"
    },
    "image": {
      "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "name": "Ubuntu 24.04 LTS",
      "slug": "ubuntu-24-04",
      "osType": "LINUX",
      "version": "24.04",
      "defaultUser": "root"
    },
    "region": {
      "id": "8f3a2b1c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
      "name": "US East",
      "slug": "us-east"
    },
    "node": {
      "id": "d2c3b4a5-e6f7-8901-abcd-ef2345678901",
      "name": "docker-node-01"
    },
    "sshKey": {
      "id": "3e4f5a6b-7c8d-9e0f-1a2b-3c4d5e6f7a8b",
      "label": "My laptop",
      "publicKey": "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI..."
    },
    "snapshot": null,
    "billingModel": "MONTHLY",
    "vcpu": 2,
    "ramMB": 2048,
    "diskGB": 25,
    "nextBillingAt": "2026-07-27T14:30:00.000Z",
    "gracePeriodEndsAt": null,
    "tags": [
      {
        "id": "9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d",
        "name": "production",
        "color": "#22c55e"
      }
    ],
    "createdAt": "2026-06-27T14:30:00.000Z",
    "updatedAt": "2026-06-27T14:35:00.000Z"
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN` (không phải server của người dùng)

---

### POST /api/servers

**Auth:** Bearer token

**Idempotency:** Supported via `Idempotency-Key` header. Duplicate keys within 24h return the original response without re-provisioning.

**UC-01:** Tạo Server
**FR-SERVER-01** through **FR-SERVER-11**
**BR-03:** Yêu cầu ImageTemplate
**BR-05:** Giới hạn Tài nguyên Node
**BR-06:** Giới hạn Server
**BR-07:** Timeout Provisioning
**BR-08:** Kích thước Image <= Disk Plan
**BR-09:** Tính Khả dụng theo Khu vực
**BR-10:** Kích thước Disk Tối thiểu
**BR-11:** Tính Duy nhất của Hostname
**BR-12:** Quyền Sở hữu SSH Key
**BR-27:** Yêu cầu Thanh toán Trước

Tạo server mới. Trả về `202 Accepted` — server được provision bất đồng bộ và khởi động ở trạng thái `CREATING`.

**Request Body (with plan):**
```json
{
  "hostname": "my-web-server",
  "planId": "b1e4f7a2-c3d5-4890-9f1e-2a3b4c5d6e7f",
  "imageId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "regionId": "8f3a2b1c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
  "sshKeyId": "3e4f5a6b-7c8d-9e0f-1a2b-3c4d5e6f7a8b",
  "billingModel": "MONTHLY"
}
```

**Request Body (with custom specs — `planId` null):**
```json
{
  "hostname": "my-custom-server",
  "planId": null,
  "imageId": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "regionId": "8f3a2b1c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
  "billingModel": "HOURLY",
  "customSpecs": {
    "vcpu": 4,
    "ramMB": 8192,
    "diskGB": 50
  }
}
```

**Request Body (from snapshot):**
```json
{
  "hostname": "restored-server",
  "planId": "b1e4f7a2-c3d5-4890-9f1e-2a3b4c5d6e7f",
  "snapshotId": "7d6e5f4a-3b2c-1d0e-9f8a-7b6c5d4e3f2a",
  "regionId": "8f3a2b1c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
  "billingModel": "MONTHLY"
}
```

| Trường | Type | Bắt buộc | Constraints |
|-------|------|----------|-------------|
| `hostname` | string(64) | Có | Duy nhất cho mỗi người dùng (BR-11), chữ thường/số và dấu gạch ngang |
| `planId` | UUID | No* | ID plan server; null nếu `customSpecs` được cung cấp |
| `imageId` | UUID | No** | ID image template |
| `snapshotId` | UUID | No** | ID snapshot (khởi động từ snapshot) |
| `regionId` | UUID | Có | Phải khả dụng cho người dùng + plan (BR-09) |
| `sshKeyId` | UUID | Không | Phải thuộc về người dùng (BR-12) |
| `billingModel` | enum | Có | `MONTHLY` or `HOURLY` |
| `customSpecs` | object | No* | Bắt buộc nếu `planId` là null |
| `customSpecs.vcpu` | int | Yes (if custom) | >= 1 |
| `customSpecs.ramMB` | int | Yes (if custom) | >= 256 |
| `customSpecs.diskGB` | int | Yes (if custom) | >= 5 (BR-10) |

\* Chính xác một trong `planId` hoặc `customSpecs` là bắt buộc.
\** Chính xác một trong `imageId` hoặc `snapshotId` là bắt buộc (BR-03).

**Response (202 Accepted):**
```json
{
  "data": {
    "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "hostname": "my-web-server",
    "status": "CREATING",
    "billingModel": "MONTHLY",
    "createdAt": "2026-06-27T14:30:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `INSUFFICIENT_BALANCE` (BR-27), `SERVER_LIMIT_REACHED` (BR-06), `NODE_CAPACITY` (BR-05), `NOT_FOUND` (invalid plan/image/region/sshKey), `FORBIDDEN` (not user's SSH key — BR-12), `RATE_LIMITED`

---

### POST /api/servers/:serverId/start

**Auth:** Bearer token or API key

**UC-05:** Khởi động Server
**FR-SERVER-14:** Khởi động Server
**BR-13:** Điều kiện Khởi động

Khởi động server đang ở trạng thái STOPPED.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `serverId` | UUID | ID của server |

**Request Body:** None

**Response (200 OK):**
```json
{
  "data": {
    "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "hostname": "my-web-server",
    "status": "ACTIVE",
    "updatedAt": "2026-06-27T15:00:00.000Z"
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`, `INVALID_STATE` (không STOPPED — BR-13), `RUNTIME_UNREACHABLE`

---

### POST /api/servers/:serverId/stop

**Auth:** Bearer token or API key

**UC-06:** Dừng Server
**FR-SERVER-15:** Tắt An toàn
**FR-SERVER-16:** Dừng Cưỡng bức
**BR-14:** Điều kiện Dừng
**BR-17:** Dự phòng Dừng Cưỡng bức

Dừng server đang chạy. Ưu tiên tắt an toàn; dừng cưỡng bức sau 30 giây (BR-17).

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `serverId` | UUID | ID của server |

**Request Body:**
```json
{
  "force": false
}
```

| Trường | Type | Bắt buộc | Mặc định | Mô tả |
|-------|------|----------|---------|-------------|
| `force` | boolean | Không | false | Nếu true, bỏ qua tắt an toàn và gửi SIGKILL ngay lập tức |

**Response (200 OK):**
```json
{
  "data": {
    "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "hostname": "my-web-server",
    "status": "STOPPED",
    "updatedAt": "2026-06-27T15:05:00.000Z"
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`, `INVALID_STATE` (không RUNNING — BR-14), `RUNTIME_UNREACHABLE`

---

### POST /api/servers/:serverId/restart

**Auth:** Bearer token or API key

**FR-SERVER-17:** Khởi động lại Server

Khởi động lại server đang chạy (dừng rồi khởi động).

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `serverId` | UUID | ID của server |

**Request Body:** None

**Response (200 OK):**
```json
{
  "data": {
    "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "hostname": "my-web-server",
    "status": "ACTIVE",
    "updatedAt": "2026-06-27T15:10:00.000Z"
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`, `INVALID_STATE` (không RUNNING), `RUNTIME_UNREACHABLE`

---

### DELETE /api/servers/:serverId

**Auth:** Bearer token

**UC-07:** Xóa Server
**FR-SERVER-18:** Xóa Server (xác nhận + hostname)
**BR-15:** Điều kiện Xóa
**BR-16:** Giải phóng Tài nguyên
**BR-18:** Xóa Backup

Xóa vĩnh viễn server. Server phải ở trạng thái STOPPED (BR-15). Tất cả tài nguyên (vCPU, RAM, disk, IP) được giải phóng về node (BR-16). Tất cả backup bị xóa (BR-18).

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `serverId` | UUID | ID của server |

**Request Body:**
```json
{
  "confirmHostname": "my-web-server"
}
```

| Trường | Type | Bắt buộc | Description |
|-------|------|----------|-------------|
| `confirmHostname` | string(64) | Có | Phải khớp chính xác hostname server (FR-SERVER-18) |

**Response (200 OK):**
```json
{
  "data": {
    "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "hostname": "my-web-server",
    "status": "DELETED",
    "deletedAt": "2026-06-27T15:15:00.000Z"
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`, `INVALID_STATE` (không STOPPED — BR-15), `VALIDATION_ERROR` (hostname không khớp)

---

### GET /api/servers/:serverId/stats

**Auth:** Bearer token or API key

Lấy thống kê sử dụng tài nguyên hiện tại của server (CPU, RAM, disk, bandwidth). Dữ liệu được thu thập từ container runtime của node.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `serverId` | UUID | ID của server |

**Response (200 OK):**
```json
{
  "data": {
    "cpuPercent": 12.5,
    "ramUsedMB": 512,
    "ramTotalMB": 2048,
    "ramPercent": 25.0,
    "diskUsedGB": 8.3,
    "diskTotalGB": 25,
    "diskPercent": 33.2,
    "bandwidthInMbps": 2.1,
    "bandwidthOutMbps": 0.8,
    "uptimeSeconds": 86400,
    "collectedAt": "2026-06-27T15:20:00.000Z"
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`, `RUNTIME_UNREACHABLE`

---

### GET /api/servers/:serverId/console

**Auth:** Bearer token

Thiết lập kết nối WebSocket cho truy cập console tương tác. **Tính năng hoãn lại** — endpoint được ghi lại ở đây cho triển khai trong tương lai.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `serverId` | UUID | ID của server |

**Connection:** `wss://<domain>/api/servers/:serverId/console?token=<accessToken>`

Server trả về token console dùng một lần trong HTTP response ban đầu. Client sau đó mở WebSocket sử dụng token đó. WebSocket truyền stdin/stdout thô đến/từ phiên exec của container.

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`, `INVALID_STATE` (server không ACTIVE)

---

## 6. Endpoints — Tags

### GET /api/tags

**Auth:** Bearer token or API key

**FR-SERVER-21:** Quản lý Tag

Liệt kê tất cả tag thuộc về người dùng đã xác thực.

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d",
      "name": "production",
      "color": "#22c55e",
      "serverCount": 2,
      "createdAt": "2026-06-27T14:30:00.000Z"
    },
    {
      "id": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
      "name": "staging",
      "color": "#f59e0b",
      "serverCount": 1,
      "createdAt": "2026-06-20T08:00:00.000Z"
    }
  ]
}
```

**Error Codes:** `UNAUTHORIZED`

---

### POST /api/tags

**Auth:** Bearer token

Tạo tag mới.

**Request Body:**
```json
{
  "name": "production",
  "color": "#22c55e"
}
```

| Trường | Type | Bắt buộc | Constraints |
|-------|------|----------|-------------|
| `name` | string(32) | Có | Tối đa 32 ký tự |
| `color` | string(7) | Không | Mã màu hex vd: "#22c55e" |

**Response (201 Created):**
```json
{
  "data": {
    "id": "9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d",
    "name": "production",
    "color": "#22c55e",
    "serverCount": 0,
    "createdAt": "2026-06-27T14:30:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`

---

### PUT /api/tags/:tagId

**Auth:** Bearer token

Cập nhật tag hiện có.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `tagId` | UUID | ID tag |

**Request Body:**
```json
{
  "name": "production-updated",
  "color": "#16a34a"
}
```

| Trường | Type | Bắt buộc |
|-------|------|----------|
| `name` | string(32) | Không |
| `color` | string(7) | Không |

**Response (200 OK):**
```json
{
  "data": {
    "id": "9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d",
    "name": "production-updated",
    "color": "#16a34a",
    "serverCount": 2,
    "createdAt": "2026-06-27T14:30:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`

---

### DELETE /api/tags/:tagId

**Auth:** Bearer token

Xóa tag. Tag bị xóa khỏi tất cả server liên kết.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `tagId` | UUID | ID tag |

**Response (200 OK):**
```json
{
  "data": {
    "message": "Tag deleted."
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`

---

### POST /api/servers/:serverId/tags

**Auth:** Bearer token

**FR-SERVER-21:** Quản lý Tag

Đồng bộ tag trên server. Mảng `tagIds` được cung cấp sẽ thay thế tập tag hiện tại của server.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `serverId` | UUID | ID của server |

**Request Body:**
```json
{
  "tagIds": [
    "9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d",
    "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d"
  ]
}
```

| Trường | Type | Bắt buộc | Description |
|-------|------|----------|-------------|
| `tagIds` | UUID[] | Có | Tập hợp đầy đủ các ID tag để gán (thay thế tập hiện tại) |

**Response (200 OK):**
```json
{
  "data": {
    "serverId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "tags": [
      {
        "id": "9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d",
        "name": "production",
        "color": "#22c55e"
      },
      {
        "id": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
        "name": "staging",
        "color": "#f59e0b"
      }
    ]
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN` (tag không thuộc về người dùng)

---

## 7. Endpoints — Firewall

### GET /api/servers/:serverId/firewall

**Auth:** Bearer token or API key

**UC-14:** Quản lý Firewall
**FR-FW-01:** Liệt kê Quy tắc Firewall
**BR-46:** Default Deny-All
**BR-47:** Priority Order
**BR-48:** Default Rules

Liệt kê tất cả quy tắc firewall cho server, sắp xếp theo ưu tiên (tăng dần).

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `serverId` | UUID | ID của server |

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "5e4f3a2b-1c0d-9e8f-7a6b-5c4d3e2f1a0b",
      "protocol": "TCP",
      "portRange": "22",
      "sourceCidr": "0.0.0.0/0",
      "action": "ALLOW",
      "priority": 1,
      "description": "Default SSH rule",
      "createdAt": "2026-06-27T14:30:00.000Z"
    },
    {
      "id": "6f5a4b3c-2d1e-0f9a-8b7c-6d5e4f3a2b1c",
      "protocol": "TCP",
      "portRange": "80",
      "sourceCidr": "0.0.0.0/0",
      "action": "ALLOW",
      "priority": 2,
      "description": "Default HTTP rule",
      "createdAt": "2026-06-27T14:30:00.000Z"
    },
    {
      "id": "7a6b5c4d-3e2f-1a0b-9c8d-7e6f5a4b3c2d",
      "protocol": "TCP",
      "portRange": "443",
      "sourceCidr": "0.0.0.0/0",
      "action": "ALLOW",
      "priority": 3,
      "description": "Default HTTPS rule",
      "createdAt": "2026-06-27T14:30:00.000Z"
    },
    {
      "id": "8b7c6d5e-4f3a-2b1c-0d9e-8f7a6b5c4d3e",
      "protocol": "TCP",
      "portRange": "3000-4000",
      "sourceCidr": "10.0.0.0/8",
      "action": "ALLOW",
      "priority": 10,
      "description": "Internal app ports",
      "createdAt": "2026-06-27T15:00:00.000Z"
    }
  ]
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`

---

### POST /api/servers/:serverId/firewall

**Auth:** Bearer token

**UC-14:** Quản lý Firewall
**FR-FW-02:** Tạo Quy tắc Firewall
**BR-47:** Priority Order

Thêm quy tắc firewall mới cho server.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `serverId` | UUID | ID của server |

**Request Body:**
```json
{
  "protocol": "TCP",
  "portRange": "8080",
  "sourceCidr": "0.0.0.0/0",
  "action": "ALLOW",
  "priority": 20,
  "description": "Custom app port"
}
```

| Trường | Type | Bắt buộc | Constraints |
|-------|------|----------|-------------|
| `protocol` | enum | Có | `TCP`, `UDP`, `ICMP`, `ALL` |
| `portRange` | string(16) | Có | vd: "22", "80", "8000-8100" |
| `sourceCidr` | string(45) | Có | Ký hiệu CIDR vd: "0.0.0.0/0", "10.0.0.0/8" |
| `action` | enum | Có | `ALLOW`, `DENY` |
| `priority` | int | Có | Thấp hơn = ưu tiên cao hơn (BR-47) |
| `description` | string(128) | Không | Nhãn tùy chọn |

**Response (201 Created):**
```json
{
  "data": {
    "id": "9c8d7e6f-5a4b-3c2d-1e0f-9a8b7c6d5e4f",
    "serverId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "protocol": "TCP",
    "portRange": "8080",
    "sourceCidr": "0.0.0.0/0",
    "action": "ALLOW",
    "priority": 20,
    "description": "Custom app port",
    "createdAt": "2026-06-27T15:00:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`

---

### PUT /api/servers/:serverId/firewall/:ruleId

**Auth:** Bearer token

**UC-14:** Quản lý Firewall
**FR-FW-03:** Cập nhật Quy tắc Firewall

Cập nhật quy tắc firewall hiện có.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `serverId` | UUID | ID của server |
| `ruleId` | UUID | ID quy tắc firewall |

**Request Body:**
```json
{
  "portRange": "8080-8081",
  "sourceCidr": "192.168.0.0/16",
  "priority": 15,
  "description": "Updated app port range"
}
```

| Trường | Type | Bắt buộc |
|-------|------|----------|
| `protocol` | enum | Không |
| `portRange` | string(16) | Không |
| `sourceCidr` | string(45) | Không |
| `action` | enum | Không |
| `priority` | int | Không |
| `description` | string(128) | Không |

**Response (200 OK):**
```json
{
  "data": {
    "id": "9c8d7e6f-5a4b-3c2d-1e0f-9a8b7c6d5e4f",
    "serverId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "protocol": "TCP",
    "portRange": "8080-8081",
    "sourceCidr": "192.168.0.0/16",
    "action": "ALLOW",
    "priority": 15,
    "description": "Updated app port range",
    "createdAt": "2026-06-27T15:00:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`

---

### DELETE /api/servers/:serverId/firewall/:ruleId

**Auth:** Bearer token

**UC-14:** Quản lý Firewall
**FR-FW-04:** Xóa Quy tắc Firewall

Xóa quy tắc firewall.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `serverId` | UUID | ID của server |
| `ruleId` | UUID | ID quy tắc firewall |

**Response (200 OK):**
```json
{
  "data": {
    "message": "Firewall rule deleted."
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`

---

## 8. Endpoints — DNS

### GET /api/servers/:serverId/dns

**Auth:** Bearer token or API key

**UC-15:** Quản lý Bản ghi DNS
**FR-DNS-01:** Liệt kê Bản ghi DNS
**BR-49:** DNS Record Uniqueness
**BR-50:** Reverse DNS

Liệt kê tất cả bản ghi DNS cho server.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `serverId` | UUID | ID của server |

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "0d9e8f7a-6b5c-4d3e-2f1a-0b9c8d7e6f5a",
      "type": "A",
      "name": "@",
      "value": "203.0.113.10",
      "ttl": 3600,
      "priority": null,
      "createdAt": "2026-06-27T14:30:00.000Z"
    },
    {
      "id": "1e0f9a8b-7c6d-5e4f-3a2b-1c0d9e8f7a6b",
      "type": "CNAME",
      "name": "www",
      "value": "my-web-server.astral.cloud",
      "ttl": 3600,
      "priority": null,
      "createdAt": "2026-06-27T14:35:00.000Z"
    },
    {
      "id": "2f1a0b9c-8d7e-6f5a-4b3c-2d1e0f9a8b7c",
      "type": "MX",
      "name": "@",
      "value": "mail.astral.cloud",
      "ttl": 3600,
      "priority": 10,
      "createdAt": "2026-06-27T14:40:00.000Z"
    }
  ]
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`

---

### POST /api/servers/:serverId/dns

**Auth:** Bearer token

**UC-15:** Quản lý Bản ghi DNS
**FR-DNS-02:** Tạo Bản ghi DNS
**BR-49:** DNS Record Uniqueness
**BR-50:** Reverse DNS

Thêm bản ghi DNS mới cho server.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `serverId` | UUID | ID của server |

**Request Body:**
```json
{
  "type": "A",
  "name": "api",
  "value": "203.0.113.20",
  "ttl": 1800,
  "priority": null
}
```

| Trường | Type | Bắt buộc | Constraints |
|-------|------|----------|-------------|
| `type` | enum | Có | `A`, `AAAA`, `CNAME`, `MX`, `TXT`, `PTR` |
| `name` | string(255) | Có | vd: "@", "www", "mail" |
| `value` | string(512) | Có | Địa chỉ IP hoặc tên miền |
| `ttl` | int | Không (mặc định: 3600) | Thời gian sống tính bằng giây |
| `priority` | int | Không | Bắt buộc với bản ghi MX |

**Response (201 Created):**
```json
{
  "data": {
    "id": "3a2b1c0d-9e8f-7a6b-5c4d-3e2f1a0b9c8d",
    "serverId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "type": "A",
    "name": "api",
    "value": "203.0.113.20",
    "ttl": 1800,
    "priority": null,
    "createdAt": "2026-06-27T15:00:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`, `INVALID_STATE` (bản ghi trùng lặp — BR-49, hoặc PTR thứ hai — BR-50)

---

### PUT /api/servers/:serverId/dns/:recordId

**Auth:** Bearer token

**UC-15:** Quản lý Bản ghi DNS
**FR-DNS-03:** Cập nhật Bản ghi DNS

Cập nhật bản ghi DNS hiện có.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `serverId` | UUID | ID của server |
| `recordId` | UUID | ID bản ghi DNS |

**Request Body:**
```json
{
  "value": "203.0.113.25",
  "ttl": 7200
}
```

| Trường | Type | Bắt buộc |
|-------|------|----------|
| `type` | enum | Không |
| `name` | string(255) | Không |
| `value` | string(512) | Không |
| `ttl` | int | Không |
| `priority` | int | Không |

**Response (200 OK):**
```json
{
  "data": {
    "id": "3a2b1c0d-9e8f-7a6b-5c4d-3e2f1a0b9c8d",
    "serverId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "type": "A",
    "name": "api",
    "value": "203.0.113.25",
    "ttl": 7200,
    "priority": null,
    "createdAt": "2026-06-27T15:00:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`

---

### DELETE /api/servers/:serverId/dns/:recordId

**Auth:** Bearer token

**UC-15:** Quản lý Bản ghi DNS
**FR-DNS-04:** Xóa Bản ghi DNS

Xóa bản ghi DNS.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `serverId` | UUID | ID của server |
| `recordId` | UUID | ID bản ghi DNS |

**Response (200 OK):**
```json
{
  "data": {
    "message": "DNS record deleted."
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`

---

## 9. Endpoints — Backups

### GET /api/servers/:serverId/backups

**Auth:** Bearer token or API key

**UC-13:** Quản lý Backup
**FR-BACKUP-02:** Xem Lịch sử Backup
**BR-51:** Backup Retention

Liệt kê tất cả backup cho server, sắp xếp theo ngày tạo giảm dần.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `serverId` | UUID | ID của server |

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "4b3c2d1e-0f9a-8b7c-6d5e-4f3a2b1c0d9e",
      "label": "Manual backup 2026-06-27",
      "type": "MANUAL",
      "sizeMB": 1024,
      "status": "AVAILABLE",
      "expiresAt": null,
      "createdAt": "2026-06-27T15:00:00.000Z"
    },
    {
      "id": "5c4d3e2f-1a0b-9c8d-7e6f-5a4b3c2d1e0f",
      "label": "Auto backup 2026-06-26 02:00",
      "type": "AUTOMATED",
      "sizeMB": 980,
      "status": "AVAILABLE",
      "expiresAt": "2026-07-03T02:00:00.000Z",
      "createdAt": "2026-06-26T02:00:00.000Z"
    }
  ]
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`

---

### POST /api/servers/:serverId/backups

**Auth:** Bearer token

**UC-13:** Quản lý Backup
**FR-BACKUP-01:** Tạo Backup Thủ công
**BR-52:** Backup Storage Quota
**BR-53:** Concurrent Backups

Tạo backup thủ công cho server. Server phải ở trạng thái ACTIVE.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `serverId` | UUID | ID của server |

**Request Body:** None (label is auto-generated from current date)

**Response (202 Accepted):**
```json
{
  "data": {
    "id": "4b3c2d1e-0f9a-8b7c-6d5e-4f3a2b1c0d9e",
    "serverId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "label": "Manual backup 2026-06-27",
    "type": "MANUAL",
    "sizeMB": 0,
    "status": "CREATING",
    "createdAt": "2026-06-27T15:00:00.000Z"
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`, `INVALID_STATE` (server không ACTIVE, backup đang diễn ra — BR-53, vượt quá hạn ngạch lưu trữ — BR-52)

---

### POST /api/servers/:serverId/backups/:backupId/restore

**Auth:** Bearer token

**UC-13:** Quản lý Backup
**FR-BACKUP-03:** Khôi phục từ Backup

Khôi phục server từ backup cụ thể. Server phải ở trạng thái STOPPED.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `serverId` | UUID | ID của server |
| `backupId` | UUID | ID backup |

**Request Body:** None

**Response (202 Accepted):**
```json
{
  "data": {
    "serverId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "backupId": "4b3c2d1e-0f9a-8b7c-6d5e-4f3a2b1c0d9e",
    "status": "RESTORING",
    "message": "Backup restoration initiated."
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`, `INVALID_STATE` (server không STOPPED, backup not AVAILABLE)

---

### DELETE /api/servers/:serverId/backups/:backupId

**Auth:** Bearer token

**UC-13:** Quản lý Backup
**FR-BACKUP-04:** Xóa Backup

Xóa backup cụ thể và giải phóng dung lượng lưu trữ.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `serverId` | UUID | ID của server |
| `backupId` | UUID | ID backup |

**Response (200 OK):**
```json
{
  "data": {
    "message": "Backup deleted."
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`

---

### GET /api/servers/:serverId/backup-schedule

**Auth:** Bearer token or API key

**UC-13:** Quản lý Backup
**FR-BACKUP-05:** Lịch Backup
**BR-51:** Backup Retention

Lấy cấu hình lịch backup tự động cho server.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `serverId` | UUID | ID của server |

**Response (200 OK):**
```json
{
  "data": {
    "id": "6d5e4f3a-2b1c-0d9e-8f7a-6b5c4d3e2f1a",
    "serverId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "enabled": true,
    "intervalHours": 24,
    "retainDaily": 7,
    "retainWeekly": 4,
    "retainMonthly": 3,
    "nextRunAt": "2026-06-28T02:00:00.000Z",
    "createdAt": "2026-06-27T14:30:00.000Z",
    "updatedAt": "2026-06-27T14:30:00.000Z"
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`

---

### PUT /api/servers/:serverId/backup-schedule

**Auth:** Bearer token

**UC-13:** Quản lý Backup
**FR-BACKUP-05:** Lịch Backup
**BR-51:** Backup Retention

Cập nhật lịch backup tự động cho server.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `serverId` | UUID | ID của server |

**Request Body:**
```json
{
  "enabled": true,
  "intervalHours": 24,
  "retainDaily": 14,
  "retainWeekly": 8,
  "retainMonthly": 6
}
```

| Trường | Type | Bắt buộc | Constraints |
|-------|------|----------|-------------|
| `enabled` | boolean | Không | Bật/tắt backup tự động |
| `intervalHours` | int | Không | Tần suất tính bằng giờ (tối thiểu 6) |
| `retainDaily` | int | Không | Số backup hàng ngày giữ lại |
| `retainWeekly` | int | Không | Số backup hàng tuần giữ lại |
| `retainMonthly` | int | Không | Số backup hàng tháng giữ lại |

**Response (200 OK):**
```json
{
  "data": {
    "id": "6d5e4f3a-2b1c-0d9e-8f7a-6b5c4d3e2f1a",
    "serverId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "enabled": true,
    "intervalHours": 24,
    "retainDaily": 14,
    "retainWeekly": 8,
    "retainMonthly": 6,
    "nextRunAt": "2026-06-28T02:00:00.000Z",
    "createdAt": "2026-06-27T14:30:00.000Z",
    "updatedAt": "2026-06-27T15:30:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`

---

## 10. Endpoints — Ví & Thanh toán

### GET /api/wallet

**Auth:** Bearer token or API key

**FR-BILL-02:** Xem Số dư

Lấy số dư ví hiện tại của người dùng đã xác thực.

**Response (200 OK):**
```json
{
  "data": {
    "balance": "42.50",
    "currency": "USD"
  }
}
```

**Error Codes:** `UNAUTHORIZED`

---

### POST /api/wallet/top-up

**Auth:** Bearer token

**UC-10:** Thanh toán & Ví
**FR-BILL-03:** Nạp Tiền
**FR-VOUCHER-01:** Áp dụng Voucher

Nạp tiền vào ví qua Stripe. Có thể áp dụng mã voucher khi thanh toán.

**Request Body:**
```json
{
  "amount": "50.00",
  "paymentMethodId": "7e6f5a4b-3c2d-1e0f-9a8b-7c6d5e4f3a2b",
  "voucherCode": "LAUNCH2026"
}
```

| Trường | Type | Bắt buộc | Constraints |
|-------|------|----------|-------------|
| `amount` | decimal(10,2) | Có | Tối thiểu 1.00 |
| `paymentMethodId` | UUID | Có | ID phương thức thanh toán đã lưu |
| `voucherCode` | string(32) | Không | Mã voucher để áp dụng (không phân biệt hoa thường) |

**Response (200 OK):**
```json
{
  "data": {
    "paymentId": "8f7a6b5c-4d3e-2f1a-0b9c-8d7e6f5a4b3c",
    "stripePaymentId": "pi_3NqWXYZ1234567890",
    "amount": "50.00",
    "discountAmount": "10.00",
    "finalAmount": "40.00",
    "currency": "USD",
    "status": "COMPLETED",
    "newBalance": "82.50",
    "voucherApplied": {
      "code": "LAUNCH2026",
      "discountAmount": "10.00"
    },
    "createdAt": "2026-06-27T15:00:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `INSUFFICIENT_BALANCE`, `VOUCHER_EXPIRED` (BR-34), `VOUCHER_EXHAUSTED` (BR-35), `VOUCHER_ALREADY_USED` (BR-36), `VOUCHER_MIN_SPEND` (BR-37), `NOT_FOUND` (payment method), `RATE_LIMITED`

---

### GET /api/payments

**Auth:** Bearer token or API key

**UC-10:** Thanh toán & Ví
**FR-BILL-05:** Lịch sử Thanh toán

Liệt kê lịch sử thanh toán với phân trang.

**Query Parameters:**

| Parameter | Type | Required | Default |
|-----------|------|----------|---------|
| `page` | int | Không | 1 |
| `limit` | int | Không | 20 |

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "8f7a6b5c-4d3e-2f1a-0b9c-8d7e6f5a4b3c",
      "amount": "50.00",
      "currency": "USD",
      "status": "COMPLETED",
      "type": "TOP_UP",
      "invoice": {
        "id": "9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d",
        "invoiceNumber": "INV-2026-00042"
      },
      "createdAt": "2026-06-27T15:00:00.000Z"
    },
    {
      "id": "0b9c8d7e-6f5a-4b3c-2d1e-0f9a8b7c6d5e",
      "amount": "10.00",
      "currency": "USD",
      "status": "COMPLETED",
      "type": "CHARGE",
      "description": "Monthly charge: my-web-server (Starter)",
      "invoice": {
        "id": "1c0d9e8f-7a6b-5c4d-3e2b-1a0b9c8d7e6f",
        "invoiceNumber": "INV-2026-00041"
      },
      "createdAt": "2026-06-27T14:30:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 2,
    "totalPages": 1
  }
}
```

**Error Codes:** `UNAUTHORIZED`

---

### GET /api/payments/:paymentId

**Auth:** Bearer token or API key

**FR-BILL-05:** Lịch sử Thanh toán

Lấy chi tiết một khoản thanh toán, bao gồm các mục trong hóa đơn.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `paymentId` | UUID | ID thanh toán |

**Response (200 OK):**
```json
{
  "data": {
    "id": "8f7a6b5c-4d3e-2f1a-0b9c-8d7e6f5a4b3c",
    "stripePaymentId": "pi_3NqWXYZ1234567890",
    "amount": "50.00",
    "currency": "USD",
    "status": "COMPLETED",
    "type": "TOP_UP",
    "voucher": {
      "code": "LAUNCH2026",
      "discountAmount": "10.00"
    },
    "invoice": {
      "id": "9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d",
      "invoiceNumber": "INV-2026-00042",
      "subtotal": "50.00",
      "taxAmount": "4.13",
      "discountAmount": "10.00",
      "total": "44.13",
      "currency": "USD",
      "status": "PAID",
      "pdfUrl": "https://<domain>/api/payments/8f7a6b5c-4d3e-2f1a-0b9c-8d7e6f5a4b3c/invoice",
      "lineItems": [
        {
          "id": "2d1e0f9a-8b7c-6d5e-4f3a-2b1c0d9e8f7a",
          "description": "Wallet Top-up",
          "quantity": 1,
          "unitPrice": "50.00",
          "total": "50.00"
        },
        {
          "id": "3e2f1a0b-9c8d-7e6f-5a4b-3c2d1e0f9a8b",
          "description": "Tax (CA — 8.25%)",
          "quantity": 1,
          "unitPrice": "4.13",
          "total": "4.13"
        },
        {
          "id": "4f3a2b1c-0d9e-8f7a-6b5c-4d3e2f1a0b9c",
          "description": "Voucher: LAUNCH2026 (20% off)",
          "quantity": 1,
          "unitPrice": "-10.00",
          "total": "-10.00"
        }
      ]
    },
    "createdAt": "2026-06-27T15:00:00.000Z"
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`

---

### GET /api/payments/:paymentId/invoice

**Auth:** Bearer token or API key

**UC-10:** Thanh toán & Ví
**FR-BILL-06:** Tải Hóa đơn PDF
**BR-30:** Invoice Generation

Tải hóa đơn PDF cho một khoản thanh toán. Trả về file PDF nhị phân.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `paymentId` | UUID | ID thanh toán |

**Response (200 OK):** `Content-Type: application/pdf` — nội dung PDF nhị phân với `Content-Disposition: attachment; filename="INV-2026-00042.pdf"`.

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`

---

### GET /api/payment-methods

**Auth:** Bearer token or API key

**UC-10:** Thanh toán & Ví
**FR-BILL-08:** Phương thức Thanh toán
**BR-31:** Payment Method Retention

Liệt kê phương thức thanh toán đã lưu của người dùng đã xác thực. Dữ liệu thẻ thô không bao giờ bị lộ (BR-31).

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "7e6f5a4b-3c2d-1e0f-9a8b-7c6d5e4f3a2b",
      "brand": "visa",
      "last4": "4242",
      "expMonth": 12,
      "expYear": 2028,
      "isDefault": true,
      "createdAt": "2026-06-01T08:00:00.000Z"
    },
    {
      "id": "5a4b3c2d-1e0f-9a8b-7c6d-5e4f3a2b1c0d",
      "brand": "mastercard",
      "last4": "5555",
      "expMonth": 3,
      "expYear": 2027,
      "isDefault": false,
      "createdAt": "2026-06-15T10:30:00.000Z"
    }
  ]
}
```

**Error Codes:** `UNAUTHORIZED`

---

### POST /api/payment-methods

**Auth:** Bearer token

**UC-10:** Thanh toán & Ví
**FR-BILL-08:** Phương thức Thanh toán
**BR-31:** Payment Method Retention

Lưu phương thức thanh toán mới sử dụng Stripe SetupIntent. `stripeSetupIntentId` đến từ Stripe Elements trên frontend (số thẻ thô không bao giờ chạm đến server Astral — BR-31, NFR-SEC-10).

**Request Body:**
```json
{
  "stripeSetupIntentId": "seti_1NqXYZAbCdEfGhIjKlMnOp"
}
```

| Trường | Type | Bắt buộc |
|-------|------|----------|
| `stripeSetupIntentId` | string | Có |

**Response (201 Created):**
```json
{
  "data": {
    "id": "6f5a4b3c-2d1e-0f9a-8b7c-6d5e4f3a2b1c",
    "brand": "amex",
    "last4": "0005",
    "expMonth": 8,
    "expYear": 2029,
    "isDefault": false,
    "createdAt": "2026-06-27T15:00:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `INTERNAL_ERROR` (Stripe API thất bại)

---

### DELETE /api/payment-methods/:methodId

**Auth:** Bearer token

**UC-10:** Thanh toán & Ví
**FR-BILL-08:** Phương thức Thanh toán

Xóa phương thức thanh toán đã lưu.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `methodId` | UUID | ID phương thức thanh toán |

**Response (200 OK):**
```json
{
  "data": {
    "message": "Payment method deleted."
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`

---

### POST /api/stripe/webhook

**Auth:** None (Stripe signature verification via `stripe-signature` header)

**AS-05:** Stripe Webhook
**FR-BILL-03:** Nạp Tiền

Endpoint webhook Stripe. Body thô phải được dùng để xác minh chữ ký. Xử lý các sự kiện `payment_intent.succeeded` và `payment_intent.payment_failed`.

**Request Headers:** `stripe-signature: t=1698391200,v1=...`

**Request Body:** JSON thô từ Stripe (không parse bởi Zod — buffer thô truyền vào `stripe.webhooks.constructEvent`).

**Handled events:**

| Sự kiện | Hành động |
|-------|--------|
| `payment_intent.succeeded` | Đánh dấu thanh toán COMPLETED, cộng tiền vào ví, tạo hóa đơn |
| `payment_intent.payment_failed` | Đánh dấu thanh toán FAILED, thông báo cho người dùng |

**Response (200 OK):**
```json
{
  "data": {
    "received": true
  }
}
```

**Error Codes:** `UNAUTHORIZED` (chữ ký không hợp lệ). Giới hạn tốc độ không áp dụng — Stripe webhooks không giới hạn.

---

## 11. Endpoints — Vouchers

### POST /api/vouchers/validate

**Auth:** Bearer token

**UC-11:** Đổi Voucher
**FR-VOUCHER-02:** Xác thực Voucher
**BR-34:** Voucher Validity Window
**BR-35:** Voucher Usage Limit
**BR-36:** Voucher Per-User Limit
**BR-37:** Voucher Minimum Spend

Xác thực mã voucher mà không đổi nó. Trả về chi tiết giảm giá sẽ được áp dụng.

**Request Body:**
```json
{
  "code": "LAUNCH2026",
  "amount": "50.00"
}
```

| Trường | Type | Bắt buộc | Description |
|-------|------|----------|-------------|
| `code` | string(32) | Có | Mã voucher (không phân biệt hoa thường) |
| `amount` | decimal(10,2) | Có | Số tiền thanh toán để kiểm tra chi tiêu tối thiểu (BR-37) |

**Response (200 OK):**
```json
{
  "data": {
    "code": "LAUNCH2026",
    "description": "Launch week 20% off",
    "discountType": "PERCENTAGE",
    "discountValue": "20.00",
    "discountAmount": "10.00",
    "finalAmount": "40.00",
    "valid": true
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `NOT_FOUND` (mã không hợp lệ), `VOUCHER_EXPIRED` (BR-34), `VOUCHER_EXHAUSTED` (BR-35), `VOUCHER_ALREADY_USED` (BR-36), `VOUCHER_MIN_SPEND` (BR-37)

---

### GET /api/vouchers/history

**Auth:** Bearer token

**FR-VOUCHER-07:** Sử dụng Voucher

Xem lịch sử đổi voucher của người dùng đã xác thực.

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "5a4b3c2d-1e0f-9a8b-7c6d-5e4f3a2b1c0d",
      "voucherCode": "LAUNCH2026",
      "discountAmount": "10.00",
      "paymentId": "8f7a6b5c-4d3e-2f1a-0b9c-8d7e6f5a4b3c",
      "createdAt": "2026-06-27T15:00:00.000Z"
    }
  ]
}
```

**Error Codes:** `UNAUTHORIZED`

---

## 12. Endpoints — Tickets Hỗ trợ

### GET /api/tickets

**Auth:** Bearer token or API key

**UC-12:** Tickets Hỗ trợ
**FR-TICKET-02:** Xem Tất cả Tickets
**BR-39:** Ticket Ownership

Liệt kê tickets hỗ trợ của người dùng đã xác thực với phân trang và lọc.

**Query Parameters:**

| Tham số | Type | Bắt buộc | Mặc định | Mô tả |
|-----------|------|----------|---------|-------------|
| `page` | int | Không | 1 | |
| `limit` | int | Không | 20 | |
| `status` | enum | Không | — | OPEN, IN_PROGRESS, WAITING_ON_CUSTOMER, RESOLVED, CLOSED |

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "6d5e4f3a-2b1c-0d9e-8f7a-6b5c4d3e2f1a",
      "subject": "Server not starting",
      "category": "TECHNICAL",
      "status": "OPEN",
      "priority": "NORMAL",
      "assignedUser": null,
      "messageCount": 3,
      "lastMessageAt": "2026-06-27T14:35:00.000Z",
      "createdAt": "2026-06-27T14:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

**Error Codes:** `UNAUTHORIZED`

---

### GET /api/tickets/:ticketId

**Auth:** Bearer token or API key

**UC-12:** Tickets Hỗ trợ
**FR-TICKET-03:** Xem Tin nhắn Ticket
**BR-39:** Ticket Ownership

Lấy một ticket với tất cả tin nhắn của nó.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `ticketId` | UUID | Ticket ID |

**Response (200 OK):**
```json
{
  "data": {
    "id": "6d5e4f3a-2b1c-0d9e-8f7a-6b5c4d3e2f1a",
    "subject": "Server not starting",
    "category": "TECHNICAL",
    "status": "OPEN",
    "priority": "NORMAL",
    "assignedUser": {
      "id": "7e6f5a4b-3c2d-1e0f-9a8b-7c6d5e4f3a2b",
      "username": "support_alex"
    },
    "messages": [
      {
        "id": "8f7a6b5c-4d3e-2f1a-0b9c-8d7e6f5a4b3c",
        "userId": "550e8400-e29b-41d4-a716-446655440001",
        "userName": "jane_doe",
        "body": "My server my-web-server won't start. I'm getting a timeout error.",
        "isInternal": false,
        "createdAt": "2026-06-27T14:00:00.000Z"
      },
      {
        "id": "9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d",
        "userId": "7e6f5a4b-3c2d-1e0f-9a8b-7c6d5e4f3a2b",
        "userName": "support_alex",
        "body": "Hi Jane, I'm looking into this. Could you let me know which region your server is in?",
        "isInternal": false,
        "createdAt": "2026-06-27T14:15:00.000Z"
      },
      {
        "id": "0b9c8d7e-6f5a-4b3c-2d1e-0f9a8b7c6d5e",
        "userId": "7e6f5a4b-3c2d-1e0f-9a8b-7c6d5e4f3a2b",
        "userName": "support_alex",
        "body": "Checked node health — docker-node-01 had a transient issue. Restarting the daemon now.",
        "isInternal": true,
        "createdAt": "2026-06-27T14:20:00.000Z"
      }
    ],
    "resolvedAt": null,
    "closedAt": null,
    "createdAt": "2026-06-27T14:00:00.000Z",
    "updatedAt": "2026-06-27T14:20:00.000Z"
  }
}
```

Lưu ý: tin nhắn với `isInternal: true` chỉ hiển thị với người dùng staff và admin; khách hàng không bao giờ thấy chúng.

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN` (BR-39)

---

### POST /api/tickets

**Auth:** Bearer token

**UC-12:** Tickets Hỗ trợ
**FR-TICKET-01:** Tạo Ticket

Tạo ticket hỗ trợ mới.

**Request Body:**
```json
{
  "subject": "Server not starting",
  "category": "TECHNICAL",
  "message": "My server my-web-server won't start. I'm getting a timeout error."
}
```

| Trường | Type | Bắt buộc | Constraints |
|-------|------|----------|-------------|
| `subject` | string(255) | Có | |
| `category` | enum | Có | `GENERAL`, `BILLING`, `TECHNICAL`, `ABUSE` |
| `message` | string (text) | Có | Nội dung tin nhắn ban đầu |

**Response (201 Created):**
```json
{
  "data": {
    "id": "6d5e4f3a-2b1c-0d9e-8f7a-6b5c4d3e2f1a",
    "subject": "Server not starting",
    "category": "TECHNICAL",
    "status": "OPEN",
    "priority": "NORMAL",
    "createdAt": "2026-06-27T14:00:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`

---

### POST /api/tickets/:ticketId/messages

**Auth:** Bearer token or API key

**UC-12:** Tickets Hỗ trợ
**FR-TICKET-03:** Thêm Tin nhắn

Thêm tin nhắn vào ticket hiện có.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `ticketId` | UUID | Ticket ID |

**Request Body:**
```json
{
  "body": "It's in US East on node docker-node-01.",
  "isInternal": false
}
```

| Trường | Type | Bắt buộc | Mặc định | Mô tả |
|-------|------|----------|---------|-------------|
| `body` | string (text) | Có | | Nội dung tin nhắn |
| `isInternal` | boolean | Không | false | Ghi chú nội bộ (chỉ staff/admin) |

**Response (201 Created):**
```json
{
  "data": {
    "id": "1c0d9e8f-7a6b-5c4d-3e2b-1a0b9c8d7e6f",
    "ticketId": "6d5e4f3a-2b1c-0d9e-8f7a-6b5c4d3e2f1a",
    "userId": "550e8400-e29b-41d4-a716-446655440001",
    "userName": "jane_doe",
    "body": "It's in US East on node docker-node-01.",
    "isInternal": false,
    "createdAt": "2026-06-27T14:25:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN` (BR-39), `INVALID_STATE` (ticket CLOSED)

---

### POST /api/tickets/:ticketId/close

**Auth:** Bearer token or API key

**UC-12:** Tickets Hỗ trợ
**FR-TICKET-05:** Đóng Ticket
**BR-40:** Ticket Status Lifecycle

Đóng ticket. Chỉ chủ sở hữu ticket (khách hàng) mới có thể đóng nó (BR-40).

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `ticketId` | UUID | Ticket ID |

**Request Body:** None

**Response (200 OK):**
```json
{
  "data": {
    "id": "6d5e4f3a-2b1c-0d9e-8f7a-6b5c4d3e2f1a",
    "status": "CLOSED",
    "closedAt": "2026-06-27T15:00:00.000Z",
    "updatedAt": "2026-06-27T15:00:00.000Z"
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN` (BR-39, không phải chủ ticket), `INVALID_STATE` (không RESOLVED — BR-40)

---

### POST /api/tickets/:ticketId/reopen

**Auth:** Bearer token or API key

**UC-12:** Tickets Hỗ trợ
**FR-TICKET-06:** Mở lại Ticket
**BR-41:** Ticket Reopening

Mở lại ticket đã đóng. Phải trong vòng 7 ngày kể từ khi đóng (BR-41).

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `ticketId` | UUID | Ticket ID |

**Request Body:** None

**Response (200 OK):**
```json
{
  "data": {
    "id": "6d5e4f3a-2b1c-0d9e-8f7a-6b5c4d3e2f1a",
    "status": "OPEN",
    "closedAt": null,
    "resolvedAt": null,
    "updatedAt": "2026-06-27T16:00:00.000Z"
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`, `INVALID_STATE` (không CLOSED, hoặc CLOSED > 7 ngày — BR-41)

---

## 13. Endpoints — Thông báo

### GET /api/notifications

**Auth:** Bearer token or API key

**UC-18:** Trung tâm Thông báo
**FR-NOTIF-03:** Lịch sử Thông báo
**FR-NOTIF-01:** Thông báo Trong Ứng dụng

Liệt kê thông báo cho người dùng đã xác thực với phân trang và lọc.

**Query Parameters:**

| Tham số | Type | Bắt buộc | Mặc định | Mô tả |
|-----------|------|----------|---------|-------------|
| `page` | int | Không | 1 | |
| `limit` | int | Không | 20 | |
| `unreadOnly` | boolean | Không | false | Chỉ hiển thị chưa đọc |

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "2d1e0f9a-8b7c-6d5e-4f3a-2b1c0d9e8f7a",
      "type": "SERVER_CREATED",
      "title": "Server created",
      "body": "Your server my-web-server has been created and is now active.",
      "link": "/dashboard/servers/6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "isRead": false,
      "createdAt": "2026-06-27T14:30:00.000Z"
    },
    {
      "id": "3e2f1a0b-9c8d-7e6f-5a4b-3c2d1e0f9a8b",
      "type": "PAYMENT_FAILED",
      "title": "Payment failed",
      "body": "Auto-deduction for my-web-server failed. Your server will enter a 24-hour grace period. Please top up your wallet to avoid suspension.",
      "link": "/dashboard/billing",
      "isRead": true,
      "createdAt": "2026-06-26T14:30:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 2,
    "totalPages": 1
  }
}
```

**Error Codes:** `UNAUTHORIZED`

---

### POST /api/notifications/:notificationId/read

**Auth:** Bearer token or API key

**UC-18:** Trung tâm Thông báo
**FR-NOTIF-04:** Đánh dấu Đã đọc

Đánh dấu một thông báo là đã đọc.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `notificationId` | UUID | ID thông báo |

**Request Body:** None

**Response (200 OK):**
```json
{
  "data": {
    "id": "2d1e0f9a-8b7c-6d5e-4f3a-2b1c0d9e8f7a",
    "isRead": true
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`

---

### POST /api/notifications/read-all

**Auth:** Bearer token or API key

**UC-18:** Trung tâm Thông báo
**FR-NOTIF-04:** Đánh dấu Đã đọc

Đánh dấu tất cả thông báo chưa đọc là đã đọc.

**Request Body:** None

**Response (200 OK):**
```json
{
  "data": {
    "markedRead": 3
  }
}
```

**Error Codes:** `UNAUTHORIZED`

---

### GET /api/notification-preferences

**Auth:** Bearer token or API key

**UC-18:** Trung tâm Thông báo
**FR-NOTIF-05:** Xem Tùy chọn

Lấy tùy chọn thông báo hiện tại của người dùng đã xác thực.

**Response (200 OK):**
```json
{
  "data": {
    "emailServerCreated": true,
    "emailServerDeleted": true,
    "emailPaymentFailure": true,
    "emailTicketUpdates": true,
    "emailMarketing": false,
    "pushServerCreated": true,
    "pushTicketUpdates": true
  }
}
```

Lưu ý: `emailPaymentFailure` luôn là `true` và không thể tắt (BR-59, FR-NOTIF-06).

**Error Codes:** `UNAUTHORIZED`

---

### PUT /api/notification-preferences

**Auth:** Bearer token

**UC-18:** Trung tâm Thông báo
**FR-NOTIF-05:** Cập nhật Tùy chọn
**BR-59:** Critical Notifications

Cập nhật tùy chọn thông báo. Mọi nỗ lực đặt `emailPaymentFailure` thành `false` đều bị bỏ qua âm thầm (BR-59).

**Request Body:**
```json
{
  "emailServerCreated": true,
  "emailServerDeleted": false,
  "emailPaymentFailure": true,
  "emailTicketUpdates": true,
  "emailMarketing": true,
  "pushServerCreated": false,
  "pushTicketUpdates": true
}
```

| Trường | Type | Bắt buộc |
|-------|------|----------|
| `emailServerCreated` | boolean | Không |
| `emailServerDeleted` | boolean | Không |
| `emailPaymentFailure` | boolean | No (bị bỏ qua nếu false — BR-59) |
| `emailTicketUpdates` | boolean | Không |
| `emailMarketing` | boolean | Không |
| `pushServerCreated` | boolean | Không |
| `pushTicketUpdates` | boolean | Không |

**Response (200 OK):**
```json
{
  "data": {
    "emailServerCreated": true,
    "emailServerDeleted": false,
    "emailPaymentFailure": true,
    "emailTicketUpdates": true,
    "emailMarketing": true,
    "pushServerCreated": false,
    "pushTicketUpdates": true
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`

---

## 14. Endpoints — Giới thiệu

### GET /api/referrals

**Auth:** Bearer token or API key

**UC-17:** Chương trình Giới thiệu
**FR-REF-01:** Mã Giới thiệu
**FR-REF-05:** Lịch sử Giới thiệu
**BR-54:** Referral Code Uniqueness
**BR-55:** Referral Credit

Lấy mã giới thiệu, lịch sử và tín dụng tích lũy của người dùng đã xác thực.

**Response (200 OK):**
```json
{
  "data": {
    "referralCode": "JANE42KX",
    "referralLink": "https://astral.cloud/register?ref=JANE42KX",
    "totalReferrals": 5,
    "accumulatedCredits": "75.00",
    "withdrawableCredits": "50.00",
    "payoutThreshold": "50.00",
    "history": [
      {
        "id": "4f3a2b1c-0d9e-8f7a-6b5c-4d3e2f1a0b9c",
        "refereeUsername": "bob_dev",
        "status": "CREDITED",
        "referrerCredit": "15.00",
        "refereeCredit": "10.00",
        "createdAt": "2026-06-20T08:00:00.000Z"
      },
      {
        "id": "5a4b3c2d-1e0f-9a8b-7c6d-5e4f3a2b1c0d",
        "refereeUsername": "charlie_ops",
        "status": "PENDING",
        "referrerCredit": "15.00",
        "refereeCredit": "10.00",
        "createdAt": "2026-06-27T10:00:00.000Z"
      }
    ]
  }
}
```

Lưu ý: `withdrawableCredits` là số tiền vượt trên `payoutThreshold` (BR-56). Nếu `accumulatedCredits < payoutThreshold`, `withdrawableCredits` là `"0.00"`.

**Error Codes:** `UNAUTHORIZED`

---

### GET /api/referrals/payouts

**Auth:** Bearer token or API key

**UC-17:** Chương trình Giới thiệu
**BR-56:** Referral Payout Threshold

Liệt kê lịch sử thanh toán giới thiệu của người dùng đã xác thực.

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "6d5e4f3a-2b1c-0d9e-8f7a-6b5c4d3e2f1a",
      "amount": "50.00",
      "status": "COMPLETED",
      "paymentId": "8f7a6b5c-4d3e-2f1a-0b9c-8d7e6f5a4b3c",
      "createdAt": "2026-06-25T12:00:00.000Z"
    }
  ]
}
```

**Error Codes:** `UNAUTHORIZED`

---

## 15. Endpoints — Blog (Công khai)

### GET /api/blog/posts

**Auth:** None (public)

**UC-16:** Nội dung Blog
**FR-BLOG-01:** Xem Bài viết Blog
**FR-BLOG-02:** Lọc & Tìm kiếm
**BR-43:** Blog Visibility (PUBLISHED only)

Liệt kê bài viết blog đã xuất bản với phân trang, tìm kiếm và lọc.

**Query Parameters:**

| Tham số | Type | Bắt buộc | Mặc định | Mô tả |
|-----------|------|----------|---------|-------------|
| `page` | int | Không | 1 | |
| `limit` | int | Không | 12 | |
| `categorySlug` | string(64) | Không | — | Lọc theo slug danh mục |
| `search` | string(255) | Không | — | Tìm kiếm toàn văn trong tiêu đề & nội dung |
| `tag` | string(64) | Không | — | Lọc theo tag bài viết |

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "7e6f5a4b-3c2d-1e0f-9a8b-7c6d5e4f3a2b",
      "slug": "getting-started-with-docker",
      "title": "Getting Started with Docker on Astral Cloud",
      "excerpt": "Learn how to deploy your first containerized application on Astral Cloud in minutes.",
      "coverImageUrl": "https://cdn.astral.cloud/blog/docker-getting-started-cover.png",
      "category": {
        "id": "8f7a6b5c-4d3e-2f1a-0b9c-8d7e6f5a4b3c",
        "name": "Tutorials",
        "slug": "tutorials"
      },
      "author": {
        "id": "9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d",
        "username": "astral_team"
      },
      "tags": ["docker", "getting-started"],
      "publishedAt": "2026-06-25T10:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 12,
    "total": 25,
    "totalPages": 3
  }
}
```

Lưu ý: Chỉ bài viết có `status: PUBLISHED` được trả về (BR-43).

**Error Codes:** `VALIDATION_ERROR` (phân trang không hợp lệ)

---

### GET /api/blog/posts/:slug

**Auth:** None (public)

**UC-16:** Nội dung Blog
**FR-BLOG-01:** Xem Bài viết Blog
**BR-43:** Blog Visibility

Lấy một bài viết blog đã xuất bản theo slug.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `slug` | string | Slug bài viết blog |

**Response (200 OK):**
```json
{
  "data": {
    "id": "7e6f5a4b-3c2d-1e0f-9a8b-7c6d5e4f3a2b",
    "slug": "getting-started-with-docker",
    "title": "Getting Started with Docker on Astral Cloud",
    "excerpt": "Learn how to deploy your first containerized application on Astral Cloud in minutes.",
    "body": "## Introduction\n\nAstral Cloud makes it easy to deploy containerized applications...\n\n## Step 1: Create Your First Server\n\nHead to the dashboard and click **Create Server**...\n\n## Step 2: Deploy Your Application\n\nOnce your server is ACTIVE, you can SSH in and...",
    "coverImageUrl": "https://cdn.astral.cloud/blog/docker-getting-started-cover.png",
    "category": {
      "id": "8f7a6b5c-4d3e-2f1a-0b9c-8d7e6f5a4b3c",
      "name": "Tutorials",
      "slug": "tutorials"
    },
    "author": {
      "id": "9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d",
      "username": "astral_team"
    },
    "tags": ["docker", "getting-started"],
    "status": "PUBLISHED",
    "publishedAt": "2026-06-25T10:00:00.000Z",
    "updatedAt": "2026-06-25T10:00:00.000Z"
  }
}
```

**Error Codes:** `NOT_FOUND`

---

### GET /api/blog/categories

**Auth:** None (public)

**UC-16:** Nội dung Blog
**FR-BLOG-05:** Danh mục Blog

Liệt kê tất cả danh mục blog.

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "8f7a6b5c-4d3e-2f1a-0b9c-8d7e6f5a4b3c",
      "name": "Tutorials",
      "slug": "tutorials",
      "description": "Step-by-step guides and tutorials",
      "postCount": 12
    },
    {
      "id": "0b9c8d7e-6f5a-4b3c-2d1e-0f9a8b7c6d5e",
      "name": "Changelog",
      "slug": "changelog",
      "description": "Product updates and release notes",
      "postCount": 8
    },
    {
      "id": "1c0d9e8f-7a6b-5c4d-3e2b-1a0b9c8d7e6f",
      "name": "News",
      "slug": "news",
      "description": "Company news and announcements",
      "postCount": 5
    }
  ]
}
```

---

## 16. Endpoints — Hồ sơ

### PUT /api/profile

**Auth:** Bearer token

**UC-02:** Account Management

Cập nhật thông tin hồ sơ của người dùng đã xác thực.

**Request Body:**
```json
{
  "username": "jane_doe_updated",
  "email": "jane.new@example.com",
  "billingAddress": {
    "line1": "456 Oak Ave",
    "line2": "Suite 100",
    "city": "San Francisco",
    "state": "CA",
    "postal": "94105",
    "country": "US"
  }
}
```

| Trường | Type | Bắt buộc | Constraints |
|-------|------|----------|-------------|
| `username` | string(32) | Không | Phải duy nhất nếu thay đổi (BR-21) |
| `email` | string(255) | Không | Phải duy nhất nếu thay đổi (BR-21); kích hoạt email xác minh mới |
| `billingAddress` | object | Không | `{ line1, line2?, city, state, postal, country }` |

**Response (200 OK):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "username": "jane_doe_updated",
    "email": "jane.new@example.com",
    "billingAddress": {
      "line1": "456 Oak Ave",
      "line2": "Suite 100",
      "city": "San Francisco",
      "state": "CA",
      "postal": "94105",
      "country": "US"
    },
    "updatedAt": "2026-06-27T15:30:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `USERNAME_TAKEN`, `EMAIL_TAKEN`

---

### PUT /api/profile/password

**Auth:** Bearer token

Đổi mật khẩu. Yêu cầu xác nhận mật khẩu hiện tại.

**Request Body:**
```json
{
  "currentPassword": "OldStr0ng!Pass",
  "newPassword": "NewStr0ng!Pass2"
}
```

| Trường | Type | Bắt buộc | Constraints |
|-------|------|----------|-------------|
| `currentPassword` | string(128) | Có | Phải khớp với mật khẩu hiện tại |
| `newPassword` | string(128) | Có | Tối thiểu 8 ký tự, 1 chữ hoa, 1 chữ thường, 1 số (BR-22) |

**Response (200 OK):**
```json
{
  "data": {
    "message": "Password changed successfully."
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `INVALID_CREDENTIALS` (mật khẩu hiện tại sai)

---

### POST /api/profile/gdpr/export

**Auth:** Bearer token

**UC-25:** Xuất Dữ liệu GDPR
**FR-GDPR-01:** Yêu cầu Xuất
**BR-62:** Data Export

Yêu cầu xuất dữ liệu cá nhân dưới dạng máy đọc được. Được tạo bất đồng bộ; liên kết tải về được gửi qua email (BR-62).

**Request Body:** None

**Response (200 OK):**
```json
{
  "data": {
    "requestId": "3e2f1a0b-9c8d-7e6f-5a4b-3c2d1e0f9a8b",
    "type": "EXPORT",
    "status": "PENDING",
    "message": "Your data export has been requested. You will receive an email with a download link when it is ready.",
    "expiresAt": "2026-07-27T15:30:00.000Z",
    "createdAt": "2026-06-27T15:30:00.000Z"
  }
}
```

**Error Codes:** `UNAUTHORIZED`

---

### POST /api/profile/gdpr/delete

**Auth:** Bearer token

**UC-25:** Xóa Tài khoản GDPR
**FR-GDPR-02:** Yêu cầu Xóa
**BR-63:** Account Deletion

Yêu cầu xóa tài khoản vĩnh viễn. Tất cả server phải được xóa trước (BR-63). Yêu cầu xác nhận mật khẩu.

**Request Body:**
```json
{
  "password": "Str0ng!Pass"
}
```

| Trường | Type | Bắt buộc | Description |
|-------|------|----------|-------------|
| `password` | string | Có | Mật khẩu hiện tại để xác nhận |

**Response (200 OK):**
```json
{
  "data": {
    "requestId": "4f3a2b1c-0d9e-8f7a-6b5c-4d3e2f1a0b9c",
    "type": "DELETE",
    "status": "PENDING",
    "message": "Your account deletion has been requested. All data will be removed within 30 days.",
    "expiresAt": "2026-07-27T15:30:00.000Z",
    "createdAt": "2026-06-27T15:30:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `INVALID_CREDENTIALS` (wrong password), `INVALID_STATE` (có server đang hoạt động — BR-63)

---

## 17. Endpoints — Dữ liệu Tham khảo (Công khai)

### GET /api/plans

**Auth:** Tùy chọn (trả về dữ liệu công khai; người dùng đã xác thực nhận được lọc theo khả dụng khu vực)

**FR-SERVER-01:** Plans Server
**BR-09:** Tính Khả dụng theo Khu vực

Liệt kê plans server khả dụng. Kết quả được lọc chỉ hiển thị plans đang hoạt động.

**Query Parameters:**

| Tham số | Type | Bắt buộc | Mô tả |
|-----------|------|----------|-------------|
| `regionId` | UUID | Không | Lọc plans khả dụng trong một khu vực cụ thể |

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "b1e4f7a2-c3d5-4890-9f1e-2a3b4c5d6e7f",
      "name": "Starter",
      "slug": "starter",
      "vcpu": 2,
      "ramMB": 2048,
      "diskGB": 25,
      "bandwidthMbps": 100,
      "priceMonthly": "10.00",
      "priceHourly": "0.015",
      "maxServers": 5
    },
    {
      "id": "c2f5a8b3-d4e6-4901-0f2e-3b4c5d6e7f8a",
      "name": "Pro",
      "slug": "pro",
      "vcpu": 4,
      "ramMB": 8192,
      "diskGB": 80,
      "bandwidthMbps": 500,
      "priceMonthly": "35.00",
      "priceHourly": "0.050",
      "maxServers": 10
    },
    {
      "id": "d3a6b9c4-e5f7-4912-1a3f-4c5d6e7f8a9b",
      "name": "Enterprise",
      "slug": "enterprise",
      "vcpu": 8,
      "ramMB": 16384,
      "diskGB": 160,
      "bandwidthMbps": 1000,
      "priceMonthly": "100.00",
      "priceHourly": "0.150",
      "maxServers": null
    }
  ]
}
```

Note: `maxServers: null` nghĩa là không giới hạn (plan Enterprise — ngoại lệ BR-06).

**Error Codes:** None

---

### GET /api/images

**Auth:** Optional (public data)

**FR-SERVER-01:** Image Templates

Liệt kê image templates khả dụng. Kết quả được lọc chỉ hiển thị images đang hoạt động.

**Query Parameters:**

| Tham số | Type | Bắt buộc | Mô tả |
|-----------|------|----------|-------------|
| `regionId` | UUID | Không | Lọc images khả dụng trong một khu vực cụ thể |

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "name": "Ubuntu 24.04 LTS",
      "slug": "ubuntu-24-04",
      "osType": "LINUX",
      "version": "24.04",
      "diskSizeGB": 3,
      "defaultUser": "root"
    },
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "name": "Debian 12",
      "slug": "debian-12",
      "osType": "LINUX",
      "version": "12",
      "diskSizeGB": 2,
      "defaultUser": "root"
    },
    {
      "id": "b2c3d4e5-f678-90ab-cdef-1234567890ab",
      "name": "Alpine Linux 3.20",
      "slug": "alpine-3-20",
      "osType": "LINUX",
      "version": "3.20",
      "diskSizeGB": 1,
      "defaultUser": "root"
    }
  ]
}
```

**Error Codes:** None

---

### GET /api/regions

**Auth:** Optional (public data)

Liệt kê các khu vực khả dụng.

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "8f3a2b1c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
      "name": "US East",
      "slug": "us-east"
    },
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "name": "US West",
      "slug": "us-west"
    },
    {
      "id": "b2c3d4e5-f678-90ab-cdef-1234567890ab",
      "name": "EU West",
      "slug": "eu-west"
    }
  ]
}
```

**Error Codes:** None

---

### GET /api/announcements

**Auth:** Optional (public data)

**FR-ANNOUNCE-03:** Thông báo Đang hoạt động

Liệt kê thông báo hiện đang hoạt động (hiển thị với tất cả người dùng).

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "c3d4e5f6-a789-01bc-def0-1234567890ab",
      "title": "Scheduled maintenance: US East",
      "body": "We will be performing scheduled maintenance on the US East region on July 1, 2026 from 02:00–04:00 UTC. During this window, server provisioning in US East will be temporarily unavailable. Existing servers will continue to run.",
      "severity": "WARNING",
      "startsAt": "2026-06-27T00:00:00.000Z",
      "endsAt": "2026-07-02T04:00:00.000Z",
      "createdAt": "2026-06-27T00:00:00.000Z"
    }
  ]
}
```

**Error Codes:** None

---

## 18. Endpoints — Mạng Riêng

### GET /api/networks

**Auth:** Bearer token or API key

Liệt kê mạng riêng của người dùng đã xác thực.

**Query Parameters:**

| Tham số | Type | Bắt buộc | Mô tả |
|-----------|------|----------|-------------|
| `regionId` | UUID | Không | Lọc mạng trong một khu vực cụ thể |

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "7e6f5a4b-3c2d-1e0f-9a8b-7c6d5e4f3a2b",
      "name": "backend-net",
      "region": {
        "id": "8f3a2b1c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
        "name": "US East",
        "slug": "us-east"
      },
      "cidr": "10.0.0.0/24",
      "serverCount": 3,
      "createdAt": "2026-06-27T14:30:00.000Z"
    }
  ]
}
```

**Error Codes:** `UNAUTHORIZED`

---

### POST /api/networks

**Auth:** Bearer token

Tạo mạng riêng mới trong một khu vực.

**Request Body:**
```json
{
  "name": "backend-net",
  "regionId": "8f3a2b1c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
  "cidr": "10.0.0.0/24"
}
```

| Trường | Type | Bắt buộc | Constraints |
|-------|------|----------|-------------|
| `name` | string(64) | Có | |
| `regionId` | UUID | Có | |
| `cidr` | string(18) | Có | Ký hiệu CIDR vd: "10.0.0.0/24" |

**Response (201 Created):**
```json
{
  "data": {
    "id": "7e6f5a4b-3c2d-1e0f-9a8b-7c6d5e4f3a2b",
    "name": "backend-net",
    "region": {
      "id": "8f3a2b1c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
      "name": "US East",
      "slug": "us-east"
    },
    "cidr": "10.0.0.0/24",
    "serverCount": 0,
    "createdAt": "2026-06-27T14:30:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `NOT_FOUND` (regionId không hợp lệ)

---

### DELETE /api/networks/:networkId

**Auth:** Bearer token

Xóa mạng riêng. Mạng phải trống server.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `networkId` | UUID | ID mạng |

**Response (200 OK):**
```json
{
  "data": {
    "message": "Network deleted."
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`, `INVALID_STATE` (mạng không trống)

---

### GET /api/networks/:networkId/servers

**Auth:** Bearer token or API key

Liệt kê tất cả server được gắn vào mạng riêng.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `networkId` | UUID | ID mạng |

**Response (200 OK):**
```json
{
  "data": [
    {
      "serverId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "hostname": "my-web-server",
      "privateIp": "10.0.0.4",
      "status": "ACTIVE",
      "attachedAt": "2026-06-27T15:00:00.000Z"
    },
    {
      "serverId": "3b8a2f14-6a9d-4e1f-b7c2-12d8e4f56a7b",
      "hostname": "db-server",
      "privateIp": "10.0.0.5",
      "status": "ACTIVE",
      "attachedAt": "2026-06-27T15:05:00.000Z"
    }
  ]
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`

---

### POST /api/networks/:networkId/servers

**Auth:** Bearer token

Gắn server vào mạng riêng. IP riêng được tự động gán từ dải CIDR của mạng.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `networkId` | UUID | ID mạng |

**Request Body:**
```json
{
  "serverId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
}
```

| Trường | Type | Bắt buộc |
|-------|------|----------|
| `serverId` | UUID | Có |

**Response (200 OK):**
```json
{
  "data": {
    "serverId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "hostname": "my-web-server",
    "privateIp": "10.0.0.4",
    "attachedAt": "2026-06-27T15:00:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN` (server không thuộc về người dùng), `INVALID_STATE` (server đã được gắn vào mạng này, hoặc server ở khu vực khác)

---

### DELETE /api/networks/:networkId/servers/:serverId

**Auth:** Bearer token

Gỡ server khỏi mạng riêng. IP riêng của server được giải phóng.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `networkId` | UUID | ID mạng |
| `serverId` | UUID | Server ID |

**Response (200 OK):**
```json
{
  "data": {
    "message": "Server detached from network."
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`

---

## 19. Endpoints — Floating IPs

### GET /api/floating-ips

**Auth:** Bearer token or API key

Liệt kê floating IPs của người dùng đã xác thực.

**Query Parameters:**

| Tham số | Type | Bắt buộc | Mô tả |
|-----------|------|----------|-------------|
| `regionId` | UUID | Không | Lọc floating IPs trong một khu vực cụ thể |

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "8f7a6b5c-4d3e-2f1a-0b9c-8d7e6f5a4b3c",
      "ip": "203.0.113.50",
      "region": {
        "id": "8f3a2b1c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
        "name": "US East",
        "slug": "us-east"
      },
      "assignedServer": {
        "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
        "hostname": "my-web-server"
      },
      "createdAt": "2026-06-27T14:30:00.000Z"
    }
  ]
}
```

**Error Codes:** `UNAUTHORIZED`

---

### POST /api/floating-ips

**Auth:** Bearer token

Cấp phát floating IP mới trong một khu vực.

**Request Body:**
```json
{
  "regionId": "8f3a2b1c-4d5e-6f7a-8b9c-0d1e2f3a4b5c"
}
```

| Trường | Type | Bắt buộc |
|-------|------|----------|
| `regionId` | UUID | Có |

**Response (201 Created):**
```json
{
  "data": {
    "id": "8f7a6b5c-4d3e-2f1a-0b9c-8d7e6f5a4b3c",
    "ip": "203.0.113.50",
    "region": {
      "id": "8f3a2b1c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
      "name": "US East",
      "slug": "us-east"
    },
    "assignedServer": null,
    "createdAt": "2026-06-27T14:30:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `NOT_FOUND` (regionId không hợp lệ)

---

### POST /api/floating-ips/:fipId/assign

**Auth:** Bearer token

Gán floating IP cho server. Server phải ở cùng khu vực.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `fipId` | UUID | ID floating IP |

**Request Body:**
```json
{
  "serverId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
}
```

| Trường | Type | Bắt buộc |
|-------|------|----------|
| `serverId` | UUID | Có |

**Response (200 OK):**
```json
{
  "data": {
    "id": "8f7a6b5c-4d3e-2f1a-0b9c-8d7e6f5a4b3c",
    "ip": "203.0.113.50",
    "assignedServer": {
      "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "hostname": "my-web-server"
    },
    "updatedAt": "2026-06-27T15:00:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`, `INVALID_STATE` (đã được gán, hoặc server ở khu vực khác)

---

### POST /api/floating-ips/:fipId/unassign

**Auth:** Bearer token

Gỡ gán floating IP khỏi server hiện tại.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `fipId` | UUID | ID floating IP |

**Request Body:** None

**Response (200 OK):**
```json
{
  "data": {
    "id": "8f7a6b5c-4d3e-2f1a-0b9c-8d7e6f5a4b3c",
    "ip": "203.0.113.50",
    "assignedServer": null,
    "updatedAt": "2026-06-27T15:30:00.000Z"
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`, `INVALID_STATE` (chưa được gán)

---

### DELETE /api/floating-ips/:fipId

**Auth:** Bearer token

Giải phóng floating IP về pool.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `fipId` | UUID | ID floating IP |

**Response (200 OK):**
```json
{
  "data": {
    "message": "Floating IP released."
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`, `INVALID_STATE` (đang được gán — phải gỡ gán trước)

---

## 20. Endpoints — Block Volumes

### GET /api/volumes

**Auth:** Bearer token or API key

Liệt kê block volumes của người dùng đã xác thực.

**Query Parameters:**

| Tham số | Type | Bắt buộc | Mô tả |
|-----------|------|----------|-------------|
| `regionId` | UUID | Không | Lọc volumes trong một khu vực cụ thể |
| `status` | enum | Không | CREATING, AVAILABLE, ATTACHED, RESIZING, ERROR |

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d",
      "name": "data-volume-1",
      "sizeGB": 100,
      "status": "ATTACHED",
      "region": {
        "id": "8f3a2b1c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
        "name": "US East",
        "slug": "us-east"
      },
      "attachedServer": {
        "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
        "hostname": "my-web-server"
      },
      "devicePath": "/dev/sdb",
      "createdAt": "2026-06-27T14:30:00.000Z"
    }
  ]
}
```

**Error Codes:** `UNAUTHORIZED`

---

### GET /api/volumes/:volumeId

**Auth:** Bearer token or API key

Lấy chi tiết đầy đủ của một block volume.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `volumeId` | UUID | ID volume |

**Response (200 OK):**
```json
{
  "data": {
    "id": "9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d",
    "name": "data-volume-1",
    "sizeGB": 100,
    "status": "ATTACHED",
    "region": {
      "id": "8f3a2b1c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
      "name": "US East",
      "slug": "us-east"
    },
    "attachedServer": {
      "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "hostname": "my-web-server"
    },
    "devicePath": "/dev/sdb",
    "createdAt": "2026-06-27T14:30:00.000Z",
    "updatedAt": "2026-06-27T15:00:00.000Z"
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`

---

### POST /api/volumes

**Auth:** Bearer token

Tạo block volume mới. Trả về `202 Accepted` — tạo volume là bất đồng bộ và bắt đầu ở trạng thái `CREATING`.

**Request Body:**
```json
{
  "name": "data-volume-1",
  "regionId": "8f3a2b1c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
  "sizeGB": 100
}
```

| Trường | Type | Bắt buộc | Constraints |
|-------|------|----------|-------------|
| `name` | string(64) | Có | |
| `regionId` | UUID | Có | |
| `sizeGB` | int | Có | Tối thiểu 1 GB, tăng theo đơn vị 1 GB |

**Response (202 Accepted):**
```json
{
  "data": {
    "id": "9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d",
    "name": "data-volume-1",
    "sizeGB": 100,
    "status": "CREATING",
    "region": {
      "id": "8f3a2b1c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
      "name": "US East",
      "slug": "us-east"
    },
    "createdAt": "2026-06-27T14:30:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `NOT_FOUND` (regionId không hợp lệ), `INSUFFICIENT_BALANCE`

---

### POST /api/volumes/:volumeId/attach

**Auth:** Bearer token

Gắn volume vào server. Volume và server phải ở cùng khu vực.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `volumeId` | UUID | ID volume |

**Request Body:**
```json
{
  "serverId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "devicePath": "/dev/sdb"
}
```

| Trường | Type | Bắt buộc | Mặc định | Mô tả |
|-------|------|----------|---------|-------------|
| `serverId` | UUID | Có | | Server để gắn volume vào |
| `devicePath` | string(32) | Không | tự động gán | Đường dẫn thiết bị trên server |

**Response (200 OK):**
```json
{
  "data": {
    "id": "9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d",
    "status": "ATTACHED",
    "attachedServer": {
      "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "hostname": "my-web-server"
    },
    "devicePath": "/dev/sdb",
    "updatedAt": "2026-06-27T15:00:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`, `INVALID_STATE` (volume not AVAILABLE, server in different region, server không ACTIVE)

---

### POST /api/volumes/:volumeId/detach

**Auth:** Bearer token

Gỡ volume khỏi server của nó.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `volumeId` | UUID | ID volume |

**Request Body:**
```json
{
  "force": false
}
```

| Trường | Type | Bắt buộc | Mặc định | Mô tả |
|-------|------|----------|---------|-------------|
| `force` | boolean | Không | false | Gỡ cưỡng bức ngay cả khi đang sử dụng (có thể gây mất dữ liệu) |

**Response (200 OK):**
```json
{
  "data": {
    "id": "9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d",
    "status": "AVAILABLE",
    "attachedServer": null,
    "devicePath": null,
    "updatedAt": "2026-06-27T15:30:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`, `INVALID_STATE` (volume không ATTACHED)

---

### POST /api/volumes/:volumeId/resize

**Auth:** Bearer token

Thay đổi kích thước volume. Chỉ có thể tăng (chỉ tăng lên).

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `volumeId` | UUID | ID volume |

**Request Body:**
```json
{
  "sizeGB": 200
}
```

| Trường | Type | Bắt buộc | Constraints |
|-------|------|----------|-------------|
| `sizeGB` | int | Có | Phải lớn hơn kích thước hiện tại |

**Response (200 OK):**
```json
{
  "data": {
    "id": "9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d",
    "sizeGB": 200,
    "status": "RESIZING",
    "updatedAt": "2026-06-27T16:00:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`, `INVALID_STATE` (volume đang sử dụng, hoặc kích thước mới <= kích thước hiện tại)

---

### DELETE /api/volumes/:volumeId

**Auth:** Bearer token

Xóa volume. Volume phải được gỡ ra trước.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `volumeId` | UUID | ID volume |

**Response (200 OK):**
```json
{
  "data": {
    "message": "Volume deleted."
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`, `INVALID_STATE` (volume đang ATTACHED — phải gỡ ra trước)

---

## 21. Endpoints — Cloud-init

Cloud-init được cấu hình lúc tạo server thông qua trường bổ sung trên `POST /api/servers`. Không có endpoint cloud-init độc lập.

**Trường bổ sung cho request body `POST /api/servers`:**

| Trường | Type | Bắt buộc | Constraints |
|-------|------|----------|-------------|
| `cloudInitScript` | string (text) | Không | Tối đa 64 KB, có thể null. Script user-data cloud-init định dạng YAML hoặc shell. |

Khi được cung cấp, script cloud-init được tiêm vào server lúc provisioning và thực thi khi khởi động lần đầu (trước khi server vào trạng thái `ACTIVE`). Nếu bỏ qua, server khởi động với cấu hình mặc định của image.

**Error Codes:** `VALIDATION_ERROR` (script vượt quá 64 KB hoặc chứa nội dung không hợp lệ)

---

## 22. Endpoints — Webhooks

### GET /api/webhooks

**Auth:** Bearer token or API key

Liệt kê endpoint webhook của người dùng đã xác thực.

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "0b9c8d7e-6f5a-4b3c-2d1e-0f9a8b7c6d5e",
      "url": "https://myapp.example.com/webhooks/astral",
      "events": ["server.created", "server.deleted", "backup.completed"],
      "isActive": true,
      "secretPrefix": "whsec_a1b2c3d4",
      "lastDeliveryAt": "2026-06-27T14:35:00.000Z",
      "createdAt": "2026-06-27T14:30:00.000Z",
      "updatedAt": "2026-06-27T14:30:00.000Z"
    }
  ]
}
```

**Error Codes:** `UNAUTHORIZED`

---

### POST /api/webhooks

**Auth:** Bearer token

Tạo endpoint webhook mới. Secret ký được tự động tạo nếu không được cung cấp.

**Request Body:**
```json
{
  "url": "https://myapp.example.com/webhooks/astral",
  "events": ["server.created", "server.deleted", "backup.completed"],
  "secret": null
}
```

| Trường | Type | Bắt buộc | Constraints |
|-------|------|----------|-------------|
| `url` | string(512) | Có | Phải là HTTPS |
| `events` | string[] | Có | Mảng các loại sự kiện để đăng ký |
| `secret` | string(128) | Không | Secret ký webhook; tự động tạo nếu bỏ qua |

**Available event types:**
- `server.created`
- `server.deleted`
- `server.started`
- `server.stopped`
- `backup.created`
- `backup.completed`
- `backup.deleted`
- `volume.attached`
- `volume.detached`
- `payment.completed`
- `payment.failed`

**Response (201 Created):**
```json
{
  "data": {
    "id": "0b9c8d7e-6f5a-4b3c-2d1e-0f9a8b7c6d5e",
    "url": "https://myapp.example.com/webhooks/astral",
    "events": ["server.created", "server.deleted", "backup.completed"],
    "secret": "whsec_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2",
    "isActive": true,
    "createdAt": "2026-06-27T14:30:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`

---

### PUT /api/webhooks/:webhookId

**Auth:** Bearer token

Cập nhật endpoint webhook hiện có.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `webhookId` | UUID | ID webhook |

**Request Body:**
```json
{
  "url": "https://myapp.example.com/webhooks/astral-v2",
  "events": ["server.created", "server.deleted", "backup.completed", "payment.failed"],
  "isActive": false
}
```

| Trường | Type | Bắt buộc |
|-------|------|----------|
| `url` | string(512) | Không |
| `events` | string[] | Không |
| `isActive` | boolean | Không |

**Response (200 OK):**
```json
{
  "data": {
    "id": "0b9c8d7e-6f5a-4b3c-2d1e-0f9a8b7c6d5e",
    "url": "https://myapp.example.com/webhooks/astral-v2",
    "events": ["server.created", "server.deleted", "backup.completed", "payment.failed"],
    "isActive": false,
    "updatedAt": "2026-06-27T15:00:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`

---

### DELETE /api/webhooks/:webhookId

**Auth:** Bearer token

Xóa endpoint webhook.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `webhookId` | UUID | ID webhook |

**Response (200 OK):**
```json
{
  "data": {
    "message": "Webhook deleted."
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`

---

### GET /api/webhooks/:webhookId/deliveries

**Auth:** Bearer token or API key

Xem lịch sử gửi của endpoint webhook.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `webhookId` | UUID | ID webhook |

**Query Parameters:**

| Tham số | Type | Bắt buộc | Mặc định | Mô tả |
|-----------|------|----------|---------|-------------|
| `page` | int | Không | 1 | |
| `limit` | int | Không | 20 | |
| `status` | enum | Không | — | PENDING, SUCCESS, FAILED |

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "1c0d9e8f-7a6b-5c4d-3e2b-1a0b9c8d7e6f",
      "event": "server.created",
      "status": "SUCCESS",
      "responseCode": 200,
      "responseDurationMs": 342,
      "requestBody": "{...}",
      "responseBody": "{...}",
      "attempts": 1,
      "createdAt": "2026-06-27T14:35:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 15,
    "totalPages": 1
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`

---

## 23. Endpoints — Bandwidth

### GET /api/servers/:serverId/bandwidth

**Auth:** Bearer token or API key

Lấy dữ liệu sử dụng bandwidth cho server trong một khoảng thời gian.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `serverId` | UUID | ID của server |

**Query Parameters:**

| Tham số | Type | Bắt buộc | Mặc định | Mô tả |
|-----------|------|----------|---------|-------------|
| `startDate` | datetime | Có | | ISO 8601, bắt đầu khoảng |
| `endDate` | datetime | Có | | ISO 8601, kết thúc khoảng |
| `granularity` | enum | Có | hàng ngày | `hourly` or `hàng ngày` |

**Response (200 OK):**
```json
{
  "data": {
    "serverId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "startDate": "2026-06-01T00:00:00.000Z",
    "endDate": "2026-06-27T00:00:00.000Z",
    "granularity": "daily",
    "dataPoints": [
      {
        "date": "2026-06-27T00:00:00.000Z",
        "inboundGB": 2.34,
        "outboundGB": 5.67,
        "totalGB": 8.01
      },
      {
        "date": "2026-06-26T00:00:00.000Z",
        "inboundGB": 1.89,
        "outboundGB": 4.12,
        "totalGB": 6.01
      }
    ]
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`, `VALIDATION_ERROR` (khoảng thời gian không hợp lệ)

---

### GET /api/servers/:serverId/bandwidth/summary

**Auth:** Bearer token or API key

Lấy tóm tắt bandwidth tháng hiện tại bao gồm hạn mức, mức sử dụng và ước tính vượt mức.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `serverId` | UUID | ID của server |

**Response (200 OK):**
```json
{
  "data": {
    "serverId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "monthlyAllowanceGB": 100,
    "usedGB": 72.45,
    "remainingGB": 27.55,
    "overageEstimateGB": 0,
    "overageEstimateCost": "0.00",
    "overageRatePerGB": "0.01",
    "daysElapsed": 27,
    "daysRemaining": 3,
    "periodStart": "2026-06-01T00:00:00.000Z",
    "periodEnd": "2026-07-01T00:00:00.000Z"
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`

---

## 24. Endpoints — Giới hạn Chi tiêu

### GET /api/profile/spending-cap

**Auth:** Bearer token or API key

Xem giới hạn chi tiêu hiện tại của người dùng đã xác thực.

**Response (200 OK):**
```json
{
  "data": {
    "amount": "100.00",
    "isActive": true,
    "currentSpend": "42.50",
    "remaining": "57.50",
    "updatedAt": "2026-06-27T14:30:00.000Z"
  }
}
```

Lưu ý: `amount` là `null` khi không đặt giới hạn (chi tiêu không giới hạn).

**Error Codes:** `UNAUTHORIZED`

---

### PUT /api/profile/spending-cap

**Auth:** Bearer token

Đặt hoặc cập nhật giới hạn chi tiêu. Đặt `amount` thành `null` để xóa giới hạn hoàn toàn.

**Request Body:**
```json
{
  "amount": "100.00"
}
```

| Trường | Type | Bắt buộc | Constraints |
|-------|------|----------|-------------|
| `amount` | decimal(10,2) | Không | Null = no cap (unlimited). Tối thiểu 1.00 if set. |

**Response (200 OK):**
```json
{
  "data": {
    "amount": "100.00",
    "isActive": true,
    "currentSpend": "42.50",
    "remaining": "57.50",
    "updatedAt": "2026-06-27T15:30:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`

---

## 25. Endpoints — Báo cáo Lạm dụng

### POST /api/abuse-reports

**Auth:** Tùy chọn (công khai; không yêu cầu xác thực với báo cáo ẩn danh)

Gửi báo cáo lạm dụng. Báo cáo của người dùng đã xác thực được liên kết với tài khoản của họ.

**Request Body:**
```json
{
  "serverId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "type": "SPAM",
  "description": "This server is sending unsolicited commercial email from IP 203.0.113.10.",
  "evidence": "Email headers and sample attached: https://example.com/evidence/abuse-001.txt"
}
```

| Trường | Type | Bắt buộc | Constraints |
|-------|------|----------|-------------|
| `serverId` | UUID | Không | Server vi phạm, nếu biết |
| `type` | enum | Có | SPAM, PHISHING, MALWARE, DDoS, COPYRIGHT, HARASSMENT, OTHER |
| `description` | string (text) | Có | Mô tả chi tiết về hành vi lạm dụng |
| `evidence` | string(2048) | Không | URL hoặc văn bản tham chiếu đến bằng chứng hỗ trợ |

**Response (201 Created):**
```json
{
  "data": {
    "id": "2d1e0f9a-8b7c-6d5e-4f3a-2b1c0d9e8f7a",
    "status": "PENDING_REVIEW",
    "message": "Your abuse report has been submitted and will be reviewed by our team.",
    "createdAt": "2026-06-27T15:00:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `RATE_LIMITED`

---

### GET /api/admin/abuse-reports

**Auth:** Bearer token (chỉ ADMIN)

Liệt kê tất cả báo cáo lạm dụng với lọc và phân trang.

**Query Parameters:**

| Tham số | Type | Bắt buộc | Mặc định | Mô tả |
|-----------|------|----------|---------|-------------|
| `page` | int | Không | 1 | |
| `limit` | int | Không | 20 | |
| `status` | enum | Không | — | PENDING_REVIEW, INVESTIGATING, RESOLVED, DISMISSED |
| `type` | enum | Không | — | SPAM, PHISHING, MALWARE, DDoS, COPYRIGHT, HARASSMENT, OTHER |

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "2d1e0f9a-8b7c-6d5e-4f3a-2b1c0d9e8f7a",
      "type": "SPAM",
      "description": "This server is sending unsolicited commercial email from IP 203.0.113.10.",
      "status": "PENDING_REVIEW",
      "reportedServer": {
        "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
        "hostname": "my-web-server"
      },
      "reportedBy": {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "username": "jane_doe"
      },
      "createdAt": "2026-06-27T15:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 12,
    "totalPages": 1
  }
}
```

Lưu ý: `reportedBy` là `null` với báo cáo ẩn danh.

**Error Codes:** `UNAUTHORIZED`, `FORBIDDEN`

---

### PUT /api/admin/abuse-reports/:reportId

**Auth:** Bearer token (chỉ ADMIN)

Cập nhật báo cáo lạm dụng (trạng thái, ghi chú giải quyết).

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `reportId` | UUID | ID báo cáo |

**Request Body:**
```json
{
  "status": "RESOLVED",
  "resolution": "Server terminated. User notified. IP blacklisted."
}
```

| Trường | Type | Bắt buộc | Constraints |
|-------|------|----------|-------------|
| `status` | enum | Không | PENDING_REVIEW, INVESTIGATING, RESOLVED, DISMISSED |
| `resolution` | string(2048) | Không | Ghi chú về cách báo cáo được giải quyết |

**Response (200 OK):**
```json
{
  "data": {
    "id": "2d1e0f9a-8b7c-6d5e-4f3a-2b1c0d9e8f7a",
    "status": "RESOLVED",
    "resolution": "Server terminated. User notified. IP blacklisted.",
    "updatedAt": "2026-06-27T16:00:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`

---

### POST /api/admin/abuse-reports/:reportId/suspend-server

**Auth:** Bearer token (chỉ ADMIN)

Đình chỉ server liên quan đến báo cáo lạm dụng. Server bị dừng ngay lập tức và chủ sở hữu được thông báo.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `reportId` | UUID | ID báo cáo |

**Request Body:** None

**Response (200 OK):**
```json
{
  "data": {
    "serverId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "status": "SUSPENDED",
    "suspendedAt": "2026-06-27T16:00:00.000Z",
    "message": "Server suspended pending abuse resolution."
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `INVALID_STATE` (không có server liên quan đến báo cáo, hoặc server đã bị đình chỉ)

---

## 26. Endpoints — Điều khoản & Tuân thủ

### GET /api/terms

**Auth:** Optional (public)

Lấy điều khoản dịch vụ hoặc chính sách bảo mật hiện tại (hoặc theo yêu cầu).

**Query Parameters:**

| Tham số | Type | Bắt buộc | Mặc định | Mô tả |
|-----------|------|----------|---------|-------------|
| `type` | enum | Có | | TOS, PRIVACY_POLICY |
| `version` | string(16) | Không | latest | Phiên bản cụ thể; trả về hiện tại nếu bỏ qua |

**Response (200 OK):**
```json
{
  "data": {
    "type": "TOS",
    "version": "2.1",
    "title": "Terms of Service",
    "content": "# Astral Cloud Terms of Service\n\nLast updated: June 15, 2026\n\n## 1. Acceptance of Terms\n\nBy accessing or using Astral Cloud services...",
    "publishedAt": "2026-06-15T00:00:00.000Z",
    "effectiveAt": "2026-06-30T00:00:00.000Z",
    "isLatest": true
  }
}
```

**Error Codes:** `VALIDATION_ERROR` (loại không hợp lệ), `NOT_FOUND` (không tìm thấy phiên bản)

---

### POST /api/terms/accept

**Auth:** Bearer token

Ghi nhận việc chấp nhận điều khoản hoặc chính sách bảo mật của người dùng.

**Request Body:**
```json
{
  "type": "TOS",
  "version": "2.1"
}
```

| Trường | Type | Bắt buộc |
|-------|------|----------|
| `type` | enum | Có | TOS, PRIVACY_POLICY |
| `version` | string(16) | Có | Phiên bản đang được chấp nhận |

**Response (200 OK):**
```json
{
  "data": {
    "type": "TOS",
    "version": "2.1",
    "acceptedAt": "2026-06-27T15:30:00.000Z",
    "message": "Terms accepted."
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `NOT_FOUND` (phiên bản không hợp lệ)

---

### GET /api/profile/terms-acceptance

**Auth:** Bearer token or API key

Xem lịch sử chấp nhận điều khoản của người dùng đã xác thực.

**Response (200 OK):**
```json
{
  "data": [
    {
      "type": "TOS",
      "version": "2.1",
      "acceptedAt": "2026-06-27T15:30:00.000Z"
    },
    {
      "type": "PRIVACY_POLICY",
      "version": "3.0",
      "acceptedAt": "2026-06-27T15:30:00.000Z"
    },
    {
      "type": "TOS",
      "version": "2.0",
      "acceptedAt": "2026-01-15T08:00:00.000Z"
    }
  ]
}
```

**Error Codes:** `UNAUTHORIZED`

---

### POST /api/cookie-consent

**Auth:** Optional (supports anonymous users via `sessionId`)

Ghi nhận tùy chọn đồng ý cookie. Dùng cho tuân thủ GDPR/CCPA.

**Request Body:**
```json
{
  "preferences": {
    "necessary": true,
    "functional": true,
    "analytics": false,
    "marketing": false
  },
  "sessionId": "sess_abc123def456"
}
```

| Trường | Type | Bắt buộc | Description |
|-------|------|----------|-------------|
| `preferences` | object | Có | Đối tượng JSON ánh xạ danh mục cookie sang boolean đồng ý |
| `sessionId` | string(64) | Không | Định danh session ẩn danh; không bắt buộc với người dùng đã xác thực |

**Response (200 OK):**
```json
{
  "data": {
    "message": "Cookie preferences recorded.",
    "recordedAt": "2026-06-27T15:30:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`

---

## 27. Endpoints — Admin: Feature Flags

### GET /api/admin/feature-flags

**Auth:** Bearer token (chỉ ADMIN)

Liệt kê tất cả feature flags với trạng thái và quy tắc hiện tại.

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "3e2f1a0b-9c8d-7e6f-5a4b-3c2d1e0f9a8b",
      "key": "private_networking",
      "description": "Enable private networking features",
      "enabled": true,
      "rules": {
        "rolloutPercentage": 50,
        "userIds": ["550e8400-e29b-41d4-a716-446655440001"],
        "regions": ["us-east"]
      },
      "createdAt": "2026-06-01T08:00:00.000Z",
      "updatedAt": "2026-06-27T12:00:00.000Z"
    },
    {
      "id": "4f3a2b1c-0d9e-8f7a-6b5c-4d3e2f1a0b9c",
      "key": "block_volumes",
      "description": "Enable block storage volumes",
      "enabled": false,
      "rules": null,
      "createdAt": "2026-06-15T10:00:00.000Z",
      "updatedAt": "2026-06-15T10:00:00.000Z"
    }
  ]
}
```

**Error Codes:** `UNAUTHORIZED`, `FORBIDDEN`

---

### POST /api/admin/feature-flags

**Auth:** Bearer token (chỉ ADMIN)

Tạo feature flag mới.

**Request Body:**
```json
{
  "key": "floating_ips",
  "description": "Enable floating IP address management",
  "enabled": false,
  "rules": {
    "rolloutPercentage": 10
  }
}
```

| Trường | Type | Bắt buộc | Constraints |
|-------|------|----------|-------------|
| `key` | string(64) | Có | Phải duy nhất |
| `description` | string(255) | Có | |
| `enabled` | boolean | Không (mặc định: false) | |
| `rules` | object | Không | Quy tắc JSON cho triển khai có mục tiêu (vd: ID người dùng, khu vực, tỷ lệ phần trăm) |

**Response (201 Created):**
```json
{
  "data": {
    "id": "5a4b3c2d-1e0f-9a8b-7c6d-5e4f3a2b1c0d",
    "key": "floating_ips",
    "description": "Enable floating IP address management",
    "enabled": false,
    "rules": {
      "rolloutPercentage": 10
    },
    "createdAt": "2026-06-27T16:00:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`

---

### PUT /api/admin/feature-flags/:flagId

**Auth:** Bearer token (chỉ ADMIN)

Cập nhật feature flag.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `flagId` | UUID | ID flag |

**Request Body:**
```json
{
  "enabled": true,
  "rules": {
    "rolloutPercentage": 100
  }
}
```

| Trường | Type | Bắt buộc |
|-------|------|----------|
| `enabled` | boolean | Không |
| `rules` | object | Không |

**Response (200 OK):**
```json
{
  "data": {
    "id": "5a4b3c2d-1e0f-9a8b-7c6d-5e4f3a2b1c0d",
    "key": "floating_ips",
    "enabled": true,
    "rules": {
      "rolloutPercentage": 100
    },
    "updatedAt": "2026-06-27T16:30:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`

---

### DELETE /api/admin/feature-flags/:flagId

**Auth:** Bearer token (chỉ ADMIN)

Xóa feature flag.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `flagId` | UUID | ID flag |

**Response (200 OK):**
```json
{
  "data": {
    "message": "Feature flag deleted."
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`

---

## 28. Endpoints — Admin: Mạo danh

### POST /api/admin/impersonate

**Auth:** Bearer token (chỉ ADMIN)

Bắt đầu mạo danh người dùng mục tiêu. Mục nhật ký audit ghi lại cả admin và người dùng mục tiêu.

**Request Body:**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440001"
}
```

| Trường | Type | Bắt buộc |
|-------|------|----------|
| `userId` | UUID | Có |

**Response (200 OK):**
```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresAt": "2026-06-27T16:30:00.000Z",
    "impersonating": {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "username": "jane_doe",
      "email": "jane@example.com",
      "role": "CUSTOMER"
    },
    "message": "Impersonation session started. All actions will be attributed to the target user."
  }
}
```

Access token trả về được giới hạn cho người dùng mục tiêu. Session admin gốc được giữ lại cho endpoint stop.

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`

---

### POST /api/admin/impersonate/stop

**Auth:** Bearer token (admin's original token from the impersonation session)

Kết thúc phiên mạo danh và quay lại session của admin.

**Request Body:** None

**Response (200 OK):**
```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresAt": "2026-06-27T16:30:00.000Z",
    "message": "Impersonation ended. Returned to admin session."
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `INVALID_STATE` (không đang mạo danh)

---

## 29. Endpoints — Admin: Doanh thu

### GET /api/admin/revenue/summary

**Auth:** Bearer token (chỉ ADMIN)

Lấy chỉ số doanh thu hiện tại: MRR, tỷ lệ rời bỏ, người đăng ký hoạt động, ARPU.

**Response (200 OK):**
```json
{
  "data": {
    "mrr": "24,580.00",
    "mrrGrowth": "+12.5",
    "churnRate": "3.2",
    "activeSubscribers": 892,
    "arpu": "27.56",
    "currency": "USD",
    "calculatedAt": "2026-06-27T16:00:00.000Z"
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `FORBIDDEN`

---

### GET /api/admin/revenue/breakdown

**Auth:** Bearer token (chỉ ADMIN)

Lấy phân tích doanh thu theo plan, khu vực và mô hình thanh toán trong một khoảng thời gian.

**Query Parameters:**

| Tham số | Type | Bắt buộc | Mặc định | Mô tả |
|-----------|------|----------|---------|-------------|
| `startDate` | datetime | Có | | ISO 8601 |
| `endDate` | datetime | Có | | ISO 8601 |

**Response (200 OK):**
```json
{
  "data": {
    "startDate": "2026-06-01T00:00:00.000Z",
    "endDate": "2026-06-27T00:00:00.000Z",
    "totalRevenue": "24,580.00",
    "byPlan": [
      { "planId": "b1e4f7a2-c3d5-4890-9f1e-2a3b4c5d6e7f", "planName": "Starter", "revenue": "8,420.00", "subscriberCount": 410 },
      { "planId": "c2f5a8b3-d4e6-4901-0f2e-3b4c5d6e7f8a", "planName": "Pro", "revenue": "12,680.00", "subscriberCount": 378 },
      { "planId": "d3a6b9c4-e5f7-4912-1a3f-4c5d6e7f8a9b", "planName": "Enterprise", "revenue": "3,480.00", "subscriberCount": 104 }
    ],
    "byRegion": [
      { "regionId": "8f3a2b1c-4d5e-6f7a-8b9c-0d1e2f3a4b5c", "regionName": "US East", "revenue": "12,290.00" },
      { "regionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890", "regionName": "US West", "revenue": "7,374.00" },
      { "regionId": "b2c3d4e5-f678-90ab-cdef-1234567890ab", "regionName": "EU West", "revenue": "4,916.00" }
    ],
    "byBillingModel": [
      { "model": "MONTHLY", "revenue": "22,860.00", "count": 782 },
      { "model": "HOURLY", "revenue": "1,720.00", "count": 110 }
    ]
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `FORBIDDEN`, `VALIDATION_ERROR` (khoảng thời gian không hợp lệ)

---

### GET /api/admin/revenue/vouchers

**Auth:** Bearer token (chỉ ADMIN)

Lấy thống kê đổi voucher.

**Response (200 OK):**
```json
{
  "data": {
    "totalRedeemed": 1247,
    "totalDiscountAmount": "6,235.00",
    "redemptionsByVoucher": [
      {
        "voucherCode": "LAUNCH2026",
        "redemptionCount": 342,
        "totalDiscount": "3,420.00"
      },
      {
        "voucherCode": "SUMMER2026",
        "redemptionCount": 128,
        "totalDiscount": "1,280.00"
      }
    ]
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `FORBIDDEN`

---

## 30. Endpoints — API SDK & CLI

### GET /api/docs/openapi.yaml

**Auth:** None (public)

Trả về đặc tả OpenAPI 3.1 cho Astral Cloud API, được tự động tạo từ Zod schema dùng trong validation phía server.

**Response (200 OK):** `Content-Type: application/yaml` — đặc tả OpenAPI 3.1 đầy đủ định dạng YAML.

**Error Codes:** None

**Lưu ý:** Astral CLI chính thức, Terraform provider và SDK bên thứ ba đều sử dụng cùng các API endpoint được ghi trong tài liệu này. Đặc tả OpenAPI đóng vai trò là nguồn sự thật duy nhất cho cả validation phía server và tạo code phía client.

---

## 31. Endpoints — Trang Trạng thái (Công khai)

### GET /api/status

**Auth:** None (public)

Lấy trạng thái nền tảng hiện tại bao gồm trạng thái thành phần và các sự cố đang hoạt động.

**Response (200 OK):**
```json
{
  "data": {
    "overallStatus": "MAJOR_OUTAGE",
    "components": [
      {
        "name": "Server Provisioning",
        "status": "OPERATIONAL",
        "updatedAt": "2026-06-27T15:00:00.000Z"
      },
      {
        "name": "Container Runtime — US East",
        "status": "MAJOR_OUTAGE",
        "description": "Degraded performance on docker-node-01. Engineers are investigating.",
        "updatedAt": "2026-06-27T15:28:00.000Z"
      },
      {
        "name": "Billing",
        "status": "OPERATIONAL",
        "updatedAt": "2026-06-27T15:00:00.000Z"
      },
      {
        "name": "DNS",
        "status": "OPERATIONAL",
        "updatedAt": "2026-06-27T15:00:00.000Z"
      },
      {
        "name": "API",
        "status": "OPERATIONAL",
        "updatedAt": "2026-06-27T15:00:00.000Z"
      }
    ],
    "activeIncidents": [
      {
        "id": "6d5e4f3a-2b1c-0d9e-8f7a-6b5c4d3e2f1a",
        "title": "Degraded container runtime performance in US East",
        "severity": "MAJOR_OUTAGE",
        "status": "INVESTIGATING",
        "createdAt": "2026-06-27T15:30:00.000Z"
      }
    ]
  }
}
```

Các giá trị trạng thái thành phần: `OPERATIONAL`, `DEGRADED_PERFORMANCE`, `PARTIAL_OUTAGE`, `MAJOR_OUTAGE`, `UNDER_MAINTENANCE`.

**Error Codes:** None

---

### GET /api/status/incidents

**Auth:** None (public)

Lấy lịch sử sự cố gần đây của nền tảng.

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "6d5e4f3a-2b1c-0d9e-8f7a-6b5c4d3e2f1a",
      "title": "Degraded container runtime performance in US East",
      "severity": "MAJOR_OUTAGE",
      "status": "INVESTIGATING",
      "updates": [
        {
          "id": "7e6f5a4b-3c2d-1e0f-9a8b-7c6d5e4f3a2b",
          "message": "We are investigating reports of degraded performance on docker-node-01 in US East. Some servers may experience slow I/O.",
          "status": "INVESTIGATING",
          "createdAt": "2026-06-27T15:30:00.000Z"
        }
      ],
      "createdAt": "2026-06-27T15:30:00.000Z",
      "resolvedAt": null
    },
    {
      "id": "8f7a6b5c-4d3e-2f1a-0b9c-8d7e6f5a4b3c",
      "title": "Scheduled maintenance: US East networking upgrade",
      "severity": "UNDER_MAINTENANCE",
      "status": "RESOLVED",
      "updates": [
        {
          "id": "9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d",
          "message": "Scheduled maintenance is starting.",
          "status": "IN_PROGRESS",
          "createdAt": "2026-06-25T02:00:00.000Z"
        },
        {
          "id": "0b9c8d7e-6f5a-4b3c-2d1e-0f9a8b7c6d5e",
          "message": "Maintenance complete. All systems operational.",
          "status": "RESOLVED",
          "createdAt": "2026-06-25T04:00:00.000Z"
        }
      ],
      "createdAt": "2026-06-25T01:00:00.000Z",
      "resolvedAt": "2026-06-25T04:00:00.000Z"
    }
  ]
}
```

**Error Codes:** None

---

## 32. Endpoints — Admin

Tất cả admin endpoint yêu cầu quyền ADMIN. Người dùng Staff không thể truy cập tài nguyên chỉ dành cho admin.

### GET /api/admin/users

**Auth:** Bearer token (chỉ ADMIN)

**UC-24:** Quản lý Người dùng
**FR-ADMIN-06:** Xem Tất cả Người dùng

Liệt kê tất cả người dùng với lọc và phân trang.

**Query Parameters:**

| Tham số | Type | Bắt buộc | Mặc định | Mô tả |
|-----------|------|----------|---------|-------------|
| `page` | int | Không | 1 | |
| `limit` | int | Không | 20 | |
| `search` | string(64) | Không | — | Tìm kiếm theo username hoặc email |
| `role` | enum | Không | — | CUSTOMER, STAFF, ADMIN |
| `status` | enum | Không | — | ACTIVE, LOCKED, PENDING_VERIFICATION, SUSPENDED |

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "username": "jane_doe",
      "email": "jane@example.com",
      "role": "CUSTOMER",
      "status": "ACTIVE",
      "balance": "42.50",
      "taxExempt": false,
      "serverCount": 3,
      "twoFactorEnabled": true,
      "emailVerifiedAt": "2026-06-27T14:45:00.000Z",
      "lastLoginAt": "2026-06-27T14:30:05.000Z",
      "createdAt": "2026-06-27T14:30:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 142,
    "totalPages": 8
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `FORBIDDEN`

---

### PUT /api/admin/users/:userId

**Auth:** Bearer token (chỉ ADMIN)

**UC-24:** Quản lý Người dùng
**BR-20:** Admin Action Audit

Cập nhật thuộc tính người dùng (role, status, miễn thuế). Tạo mục nhật ký audit (BR-20).

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `userId` | UUID | ID người dùng |

**Request Body:**
```json
{
  "role": "STAFF",
  "status": "ACTIVE",
  "taxExempt": false
}
```

| Trường | Type | Bắt buộc | Constraints |
|-------|------|----------|-------------|
| `role` | enum | Không | CUSTOMER, STAFF, ADMIN |
| `status` | enum | Không | ACTIVE, LOCKED, SUSPENDED |
| `taxExempt` | boolean | Không | BR-61 |

**Response (200 OK):**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "username": "jane_doe",
    "role": "STAFF",
    "status": "ACTIVE",
    "taxExempt": false,
    "updatedAt": "2026-06-27T16:00:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`

---

### GET /api/admin/plans

**Auth:** Bearer token (chỉ ADMIN)

**UC-20:** Quản lý Plan
**FR-ADMIN-01:** Quản lý Plans

Liệt kê tất cả plans server, bao gồm cả không hoạt động.

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "b1e4f7a2-c3d5-4890-9f1e-2a3b4c5d6e7f",
      "name": "Starter",
      "slug": "starter",
      "vcpu": 2,
      "ramMB": 2048,
      "diskGB": 25,
      "bandwidthMbps": 100,
      "priceMonthly": "10.00",
      "priceHourly": "0.015",
      "maxServers": 5,
      "isActive": true,
      "serverCount": 87,
      "regionIds": [
        "8f3a2b1c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
        "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
      ],
      "createdAt": "2026-01-15T08:00:00.000Z",
      "updatedAt": "2026-06-01T10:00:00.000Z"
    }
  ]
}
```

**Error Codes:** `UNAUTHORIZED`, `FORBIDDEN`

---

### POST /api/admin/plans

**Auth:** Bearer token (chỉ ADMIN)

**UC-20:** Quản lý Plan
**FR-ADMIN-01:** Quản lý Plans
**BR-20:** Admin Action Audit

Tạo plan server mới.

**Request Body:**
```json
{
  "name": "Developer",
  "slug": "developer",
  "vcpu": 2,
  "ramMB": 4096,
  "diskGB": 50,
  "bandwidthMbps": 200,
  "priceMonthly": "20.00",
  "priceHourly": "0.030",
  "maxServers": 10,
  "regionIds": [
    "8f3a2b1c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
    "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  ]
}
```

| Trường | Type | Bắt buộc | Constraints |
|-------|------|----------|-------------|
| `name` | string(64) | Có | |
| `slug` | string(32) | Có | Phải duy nhất |
| `vcpu` | int | Có | >= 1 |
| `ramMB` | int | Có | >= 256 |
| `diskGB` | int | Có | >= 5 |
| `bandwidthMbps` | int | Có | >= 10 |
| `priceMonthly` | decimal(10,2) | Có | |
| `priceHourly` | decimal(10,2) | Có | |
| `maxServers` | int | Không | Null = unlimited |
| `regionIds` | UUID[] | Có | Các khu vực plan này khả dụng |

**Response (201 Created):**
```json
{
  "data": {
    "id": "e4a7b8c5-d6e7-4932-2b4a-5d6e7f8a9b0c",
    "name": "Developer",
    "slug": "developer",
    "vcpu": 2,
    "ramMB": 4096,
    "diskGB": 50,
    "bandwidthMbps": 200,
    "priceMonthly": "20.00",
    "priceHourly": "0.030",
    "maxServers": 10,
    "isActive": true,
    "createdAt": "2026-06-27T16:00:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`

---

### PUT /api/admin/plans/:planId

**Auth:** Bearer token (chỉ ADMIN)

**UC-20:** Quản lý Plan
**FR-ADMIN-01:** Quản lý Plans
**BR-20:** Admin Action Audit

Cập nhật plan server hiện có.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `planId` | UUID | ID plan |

**Request Body:**
```json
{
  "name": "Developer v2",
  "priceMonthly": "22.00",
  "regionIds": [
    "8f3a2b1c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
    "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "b2c3d4e5-f678-90ab-cdef-1234567890ab"
  ]
}
```

| Trường | Type | Bắt buộc |
|-------|------|----------|
| `name` | string(64) | Không |
| `slug` | string(32) | Không |
| `vcpu` | int | Không |
| `ramMB` | int | Không |
| `diskGB` | int | Không |
| `bandwidthMbps` | int | Không |
| `priceMonthly` | decimal(10,2) | Không |
| `priceHourly` | decimal(10,2) | Không |
| `maxServers` | int | Không |
| `isActive` | boolean | Không |
| `regionIds` | UUID[] | Không |

**Response (200 OK):**
```json
{
  "data": {
    "id": "e4a7b8c5-d6e7-4932-2b4a-5d6e7f8a9b0c",
    "name": "Developer v2",
    "slug": "developer",
    "priceMonthly": "22.00",
    "updatedAt": "2026-06-27T16:30:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`

---

### DELETE /api/admin/plans/:planId

**Auth:** Bearer token (chỉ ADMIN)

**UC-20:** Quản lý Plan
**FR-ADMIN-01:** Quản lý Plans (deactivate)
**BR-20:** Admin Action Audit

Vô hiệu hóa plan server (xóa mềm). Các server hiện có trên plan này tiếp tục chạy không thay đổi.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `planId` | UUID | ID plan |

**Response (200 OK):**
```json
{
  "data": {
    "id": "e4a7b8c5-d6e7-4932-2b4a-5d6e7f8a9b0c",
    "name": "Developer v2",
    "isActive": false,
    "updatedAt": "2026-06-27T17:00:00.000Z"
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`

---

### GET /api/admin/images

**Auth:** Bearer token (chỉ ADMIN)

**UC-20:** Quản lý Image
**FR-ADMIN-02:** Quản lý Images

Liệt kê tất cả image templates, bao gồm cả không hoạt động.

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "name": "Ubuntu 24.04 LTS",
      "slug": "ubuntu-24-04",
      "osType": "LINUX",
      "version": "24.04",
      "dockerImage": "registry.astral.cloud/ubuntu:24.04",
      "diskSizeGB": 3,
      "defaultUser": "root",
      "isActive": true,
      "serverCount": 512,
      "regionIds": [
        "8f3a2b1c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
        "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "b2c3d4e5-f678-90ab-cdef-1234567890ab"
      ],
      "createdAt": "2026-01-15T08:00:00.000Z",
      "updatedAt": "2026-04-30T12:00:00.000Z"
    }
  ]
}
```

**Error Codes:** `UNAUTHORIZED`, `FORBIDDEN`

---

### POST /api/admin/images

**Auth:** Bearer token (chỉ ADMIN)

**UC-20:** Quản lý Image
**FR-ADMIN-02:** Quản lý Images
**BR-20:** Admin Action Audit

Tạo image template mới.

**Request Body:**
```json
{
  "name": "Fedora 40",
  "slug": "fedora-40",
  "osType": "LINUX",
  "version": "40",
  "dockerImage": "registry.astral.cloud/fedora:40",
  "diskSizeGB": 3,
  "defaultUser": "root",
  "regionIds": [
    "8f3a2b1c-4d5e-6f7a-8b9c-0d1e2f3a4b5c"
  ]
}
```

| Trường | Type | Bắt buộc | Constraints |
|-------|------|----------|-------------|
| `name` | string(128) | Có | |
| `slug` | string(64) | Có | Phải duy nhất |
| `osType` | enum | Có | LINUX |
| `version` | string(32) | Có | |
| `dockerImage` | string(255) | Có | Tham chiếu container registry hợp lệ |
| `diskSizeGB` | int | Có | |
| `defaultUser` | string(32) | Có | |
| `regionIds` | UUID[] | Có | Các khu vực image này khả dụng |

**Response (201 Created):**
```json
{
  "data": {
    "id": "d4e5f6a7-b8c9-0123-def4-567890abcdef",
    "name": "Fedora 40",
    "slug": "fedora-40",
    "osType": "LINUX",
    "version": "40",
    "dockerImage": "registry.astral.cloud/fedora:40",
    "diskSizeGB": 3,
    "defaultUser": "root",
    "isActive": true,
    "createdAt": "2026-06-27T16:00:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`

---

### PUT /api/admin/images/:imageId

**Auth:** Bearer token (chỉ ADMIN)

**UC-20:** Quản lý Image
**FR-ADMIN-02:** Quản lý Images
**BR-20:** Admin Action Audit

Cập nhật image template hiện có.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `imageId` | UUID | ID image |

**Request Body:**
```json
{
  "name": "Fedora 40 (Updated)",
  "dockerImage": "registry.astral.cloud/fedora:40.1"
}
```

| Trường | Type | Bắt buộc |
|-------|------|----------|
| `name` | string(128) | Không |
| `slug` | string(64) | Không |
| `osType` | enum | Không |
| `version` | string(32) | Không |
| `dockerImage` | string(255) | Không |
| `diskSizeGB` | int | Không |
| `defaultUser` | string(32) | Không |
| `isActive` | boolean | Không |
| `regionIds` | UUID[] | Không |

**Response (200 OK):**
```json
{
  "data": {
    "id": "d4e5f6a7-b8c9-0123-def4-567890abcdef",
    "name": "Fedora 40 (Updated)",
    "dockerImage": "registry.astral.cloud/fedora:40.1",
    "updatedAt": "2026-06-27T16:30:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`

---

### DELETE /api/admin/images/:imageId

**Auth:** Bearer token (chỉ ADMIN)

**UC-20:** Quản lý Image
**FR-ADMIN-02:** Quản lý Images (deactivate)
**BR-20:** Admin Action Audit

Vô hiệu hóa image template. Các server hiện có sử dụng image này tiếp tục chạy không thay đổi.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `imageId` | UUID | ID image |

**Response (200 OK):**
```json
{
  "data": {
    "id": "d4e5f6a7-b8c9-0123-def4-567890abcdef",
    "isActive": false,
    "updatedAt": "2026-06-27T17:00:00.000Z"
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`

---

### GET /api/admin/nodes

**Auth:** Bearer token (chỉ ADMIN)

**UC-20:** Quản lý Node
**FR-ADMIN-03:** Quản lý Nodes
**BR-68:** Node Status
**BR-69:** Node Draining

Liệt kê tất cả node vật lý (Docker hosts) với phân bổ tài nguyên của chúng.

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "d2c3b4a5-e6f7-8901-abcd-ef2345678901",
      "name": "docker-node-01",
      "region": {
        "id": "8f3a2b1c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
        "name": "US East",
        "slug": "us-east"
      },
      "status": "ONLINE",
      "dockerEndpoint": "tcp://10.0.1.10:2375",
      "totalVcpu": 64,
      "allocatedVcpu": 38,
      "totalRamMB": 262144,
      "allocatedRamMB": 98304,
      "totalDiskGB": 2048,
      "allocatedDiskGB": 512,
      "serverCount": 23,
      "lastHeartbeatAt": "2026-06-27T15:28:00.000Z",
      "createdAt": "2026-01-15T08:00:00.000Z",
      "updatedAt": "2026-06-27T14:30:00.000Z"
    },
    {
      "id": "e3d4c5b6-f7a8-9012-bcde-ef3456789012",
      "name": "docker-node-02",
      "region": {
        "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "name": "US West",
        "slug": "us-west"
      },
      "status": "MAINTENANCE",
      "dockerEndpoint": "tcp://10.0.2.20:2375",
      "totalVcpu": 64,
      "allocatedVcpu": 52,
      "totalRamMB": 262144,
      "allocatedRamMB": 196608,
      "totalDiskGB": 2048,
      "allocatedDiskGB": 1024,
      "serverCount": 31,
      "lastHeartbeatAt": "2026-06-27T15:28:30.000Z",
      "createdAt": "2026-01-15T08:00:00.000Z",
      "updatedAt": "2026-06-27T12:00:00.000Z"
    }
  ]
}
```

**Error Codes:** `UNAUTHORIZED`, `FORBIDDEN`

---

### POST /api/admin/nodes

**Auth:** Bearer token (chỉ ADMIN)

**UC-20:** Quản lý Node
**FR-ADMIN-03:** Quản lý Nodes
**BR-20:** Admin Action Audit

Thêm node vật lý mới vào một khu vực.

**Request Body:**
```json
{
  "name": "docker-node-03",
  "regionId": "b2c3d4e5-f678-90ab-cdef-1234567890ab",
  "dockerEndpoint": "tcp://10.0.3.30:2375",
  "totalVcpu": 64,
  "totalRamMB": 262144,
  "totalDiskGB": 2048
}
```

| Trường | Type | Bắt buộc | Constraints |
|-------|------|----------|-------------|
| `name` | string(64) | Có | |
| `regionId` | UUID | Có | |
| `dockerEndpoint` | string(255) | Có | URL Docker daemon |
| `totalVcpu` | int | Có | >= 1 |
| `totalRamMB` | int | Có | >= 1024 |
| `totalDiskGB` | int | Có | >= 10 |

**Response (201 Created):**
```json
{
  "data": {
    "id": "f4e5d6c7-a8b9-0123-cdef-4567890123ab",
    "name": "docker-node-03",
    "regionId": "b2c3d4e5-f678-90ab-cdef-1234567890ab",
    "status": "ONLINE",
    "dockerEndpoint": "tcp://10.0.3.30:2375",
    "totalVcpu": 64,
    "totalRamMB": 262144,
    "totalDiskGB": 2048,
    "allocatedVcpu": 0,
    "allocatedRamMB": 0,
    "allocatedDiskGB": 0,
    "createdAt": "2026-06-27T16:00:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`

---

### PUT /api/admin/nodes/:nodeId

**Auth:** Bearer token (chỉ ADMIN)

**UC-20:** Quản lý Node
**FR-ADMIN-03:** Quản lý Nodes
**BR-68:** Node Status
**BR-69:** Node Draining
**BR-20:** Admin Action Audit

Cập nhật thuộc tính của node, bao gồm thay đổi trạng thái (ONLINE, OFFLINE, MAINTENANCE).

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `nodeId` | UUID | ID node |

**Request Body:**
```json
{
  "name": "docker-node-03-renamed",
  "status": "MAINTENANCE"
}
```

| Trường | Type | Bắt buộc | Constraints |
|-------|------|----------|-------------|
| `name` | string(64) | Không | |
| `dockerEndpoint` | string(255) | Không | |
| `status` | enum | Không | ONLINE, OFFLINE, MAINTENANCE |
| `totalVcpu` | int | Không | |
| `totalRamMB` | int | Không | |
| `totalDiskGB` | int | Không | |

**Response (200 OK):**
```json
{
  "data": {
    "id": "f4e5d6c7-a8b9-0123-cdef-4567890123ab",
    "name": "docker-node-03-renamed",
    "status": "MAINTENANCE",
    "updatedAt": "2026-06-27T16:30:00.000Z"
  }
}
```

Lưu ý: Đặt trạng thái MAINTENANCE kích hoạt draining node (BR-69) — không server mới nào được triển khai, server hiện có tiếp tục chạy.

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`

---

### GET /api/admin/regions

**Auth:** Bearer token (chỉ ADMIN)

**UC-20:** Quản lý Khu vực
**FR-ADMIN-04:** Quản lý Khu vực

Liệt kê tất cả khu vực.

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "8f3a2b1c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
      "name": "US East",
      "slug": "us-east",
      "isActive": true,
      "nodeCount": 3,
      "serverCount": 142,
      "taxRate": {
        "id": "9c8d7e6f-5a4b-3c2d-1e0f-9a8b7c6d5e4f",
        "name": "US Sales Tax",
        "rate": "8.25"
      },
      "createdAt": "2026-01-15T08:00:00.000Z"
    }
  ]
}
```

**Error Codes:** `UNAUTHORIZED`, `FORBIDDEN`

---

### POST /api/admin/regions

**Auth:** Bearer token (chỉ ADMIN)

**UC-20:** Quản lý Khu vực
**FR-ADMIN-04:** Quản lý Khu vực
**BR-20:** Admin Action Audit

Tạo khu vực mới.

**Request Body:**
```json
{
  "name": "Asia Pacific",
  "slug": "ap-southeast"
}
```

| Trường | Type | Bắt buộc | Constraints |
|-------|------|----------|-------------|
| `name` | string(64) | Có | |
| `slug` | string(16) | Có | Phải duy nhất |

**Response (201 Created):**
```json
{
  "data": {
    "id": "c3d4e5f6-a789-01bc-def0-1234567890ab",
    "name": "Asia Pacific",
    "slug": "ap-southeast",
    "isActive": true,
    "createdAt": "2026-06-27T16:00:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`

---

### PUT /api/admin/regions/:regionId

**Auth:** Bearer token (chỉ ADMIN)

**UC-20:** Quản lý Khu vực
**FR-ADMIN-04:** Quản lý Khu vực
**BR-20:** Admin Action Audit

Cập nhật khu vực.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `regionId` | UUID | ID khu vực |

**Request Body:**
```json
{
  "name": "Asia Pacific (Singapore)",
  "isActive": true
}
```

| Trường | Type | Bắt buộc |
|-------|------|----------|
| `name` | string(64) | Không |
| `slug` | string(16) | Không |
| `isActive` | boolean | Không |

**Response (200 OK):**
```json
{
  "data": {
    "id": "c3d4e5f6-a789-01bc-def0-1234567890ab",
    "name": "Asia Pacific (Singapore)",
    "isActive": true,
    "updatedAt": "2026-06-27T16:30:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`

---

### GET /api/admin/audit-logs

**Auth:** Bearer token (chỉ ADMIN)

**UC-24:** Nhật ký Audit
**FR-AUDIT-04:** Xem & Lọc Nhật ký Audit
**BR-19:** State-Change Audit
**BR-20:** Admin Action Audit

Liệt kê mục nhật ký audit với lọc và phân trang.

**Query Parameters:**

| Tham số | Type | Bắt buộc | Mặc định | Mô tả |
|-----------|------|----------|---------|-------------|
| `page` | int | Không | 1 | |
| `limit` | int | Không | 50 | |
| `userId` | UUID | Không | — | Lọc theo người thực hiện |
| `action` | enum | Không | — | SERVER_CREATED, SERVER_STARTED, SERVER_STOPPED, SERVER_RESTARTED, SERVER_DELETED, ADMIN_ACTION, etc. |
| `targetType` | string(32) | Không | — | e.g. "ServerInstance", "User", "ServerPlan" |
| `startDate` | datetime | Không | — | ISO 8601 |
| `endDate` | datetime | Không | — | ISO 8601 |

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "5a4b3c2d-1e0f-9a8b-7c6d-5e4f3a2b1c0d",
      "actor": {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "username": "jane_doe"
      },
      "action": "SERVER_CREATED",
      "targetType": "ServerInstance",
      "targetId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "result": "SUCCESS",
      "metadata": {
        "hostname": "my-web-server",
        "planId": "b1e4f7a2-c3d5-4890-9f1e-2a3b4c5d6e7f",
        "regionId": "8f3a2b1c-4d5e-6f7a-8b9c-0d1e2f3a4b5c"
      },
      "ipAddress": "203.0.113.42",
      "createdAt": "2026-06-27T14:30:00.000Z"
    },
    {
      "id": "6d5e4f3a-2b1c-0d9e-8f7a-6b5c4d3e2f1a",
      "actor": {
        "id": "7e6f5a4b-3c2d-1e0f-9a8b-7c6d5e4f3a2b",
        "username": "admin_root"
      },
      "action": "ADMIN_ACTION",
      "targetType": "User",
      "targetId": "550e8400-e29b-41d4-a716-446655440001",
      "result": "SUCCESS",
      "metadata": {
        "changes": {
          "role": { "from": "CUSTOMER", "to": "STAFF" }
        }
      },
      "ipAddress": "198.51.100.10",
      "createdAt": "2026-06-27T16:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 50,
    "total": 1420,
    "totalPages": 29
  }
}
```

Lưu ý: Các mục được ẩn danh GDPR có `userId` và `ipAddress` bị cắt ngắn (BR-63).

**Error Codes:** `UNAUTHORIZED`, `FORBIDDEN`

---

### GET /api/admin/vouchers

**Auth:** Bearer token (ADMIN hoặc STAFF)

**UC-21:** Quản lý Voucher
**FR-VOUCHER-06:** Tạo Vouchers
**FR-VOUCHER-07:** Xem Thống kê Voucher

Liệt kê tất cả vouchers.

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "3e2f1a0b-9c8d-7e6f-5a4b-3c2d1e0f9a8b",
      "code": "LAUNCH2026",
      "description": "Launch week 20% off",
      "discountType": "PERCENTAGE",
      "discountValue": "20.00",
      "maxUses": 1000,
      "currentUses": 342,
      "maxUsesPerUser": 1,
      "minSpend": "10.00",
      "validFrom": "2026-06-01T00:00:00.000Z",
      "validUntil": "2026-06-30T23:59:59.000Z",
      "isActive": true,
      "createdBy": {
        "id": "7e6f5a4b-3c2d-1e0f-9a8b-7c6d5e4f3a2b",
        "username": "admin_root"
      },
      "createdAt": "2026-06-01T00:00:00.000Z"
    }
  ]
}
```

**Error Codes:** `UNAUTHORIZED`, `FORBIDDEN`

---

### POST /api/admin/vouchers

**Auth:** Bearer token (ADMIN hoặc STAFF)

**UC-21:** Quản lý Voucher
**FR-VOUCHER-06:** Tạo Vouchers
**BR-33:** Voucher Uniqueness
**BR-20:** Admin Action Audit

Tạo mã voucher mới.

**Request Body:**
```json
{
  "code": "SUMMER2026",
  "description": "Summer sale 25% off",
  "discountType": "PERCENTAGE",
  "discountValue": "25.00",
  "maxUses": 500,
  "maxUsesPerUser": 1,
  "minSpend": "20.00",
  "validFrom": "2026-07-01T00:00:00.000Z",
  "validUntil": "2026-07-31T23:59:59.000Z"
}
```

| Trường | Type | Bắt buộc | Constraints |
|-------|------|----------|-------------|
| `code` | string(32) | Có | Phải duy nhất, case-insensitive (BR-33) |
| `description` | string(255) | Có | |
| `discountType` | enum | Có | PERCENTAGE, FIXED_AMOUNT |
| `discountValue` | decimal(10,2) | Có | vd: 25.00 = 25% hoặc $25.00 |
| `maxUses` | int | Không | Null = không giới hạn (BR-35) |
| `maxUsesPerUser` | int | Không (mặc định: 1) | BR-36 |
| `minSpend` | decimal(10,2) | Không | BR-37 |
| `validFrom` | datetime | Không | BR-34 |
| `validUntil` | datetime | Không | BR-34 |

**Response (201 Created):**
```json
{
  "data": {
    "id": "4f3a2b1c-0d9e-8f7a-6b5c-4d3e2f1a0b9c",
    "code": "SUMMER2026",
    "description": "Summer sale 25% off",
    "discountType": "PERCENTAGE",
    "discountValue": "25.00",
    "isActive": true,
    "createdAt": "2026-06-27T16:00:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`

---

### PUT /api/admin/vouchers/:voucherId

**Auth:** Bearer token (ADMIN hoặc STAFF)

**UC-21:** Quản lý Voucher
**FR-VOUCHER-08:** Deactivate Voucher
**BR-20:** Admin Action Audit

Cập nhật voucher (vd: vô hiệu hóa, gia hạn hiệu lực).

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `voucherId` | UUID | ID voucher |

**Request Body:**
```json
{
  "isActive": false
}
```

| Trường | Type | Bắt buộc |
|-------|------|----------|
| `code` | string(32) | Không |
| `description` | string(255) | Không |
| `discountType` | enum | Không |
| `discountValue` | decimal(10,2) | Không |
| `maxUses` | int | Không |
| `maxUsesPerUser` | int | Không |
| `minSpend` | decimal(10,2) | Không |
| `validFrom` | datetime | Không |
| `validUntil` | datetime | Không |
| `isActive` | boolean | Không |

**Response (200 OK):**
```json
{
  "data": {
    "id": "4f3a2b1c-0d9e-8f7a-6b5c-4d3e2f1a0b9c",
    "code": "SUMMER2026",
    "isActive": false,
    "updatedAt": "2026-06-27T17:00:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`

---

### GET /api/admin/tax-rates

**Auth:** Bearer token (chỉ ADMIN)

**UC-24:** Cấu hình Thuế
**FR-ADMIN-09:** Cấu hình Mức Thuế
**BR-60:** Tax by Billing Region

Liệt kê tất cả mức thuế.

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "9c8d7e6f-5a4b-3c2d-1e0f-9a8b7c6d5e4f",
      "region": {
        "id": "8f3a2b1c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
        "name": "US East",
        "slug": "us-east"
      },
      "name": "US Sales Tax",
      "rate": "8.25",
      "isActive": true,
      "createdAt": "2026-01-15T08:00:00.000Z",
      "updatedAt": "2026-05-01T10:00:00.000Z"
    }
  ]
}
```

**Error Codes:** `UNAUTHORIZED`, `FORBIDDEN`

---

### POST /api/admin/tax-rates

**Auth:** Bearer token (chỉ ADMIN)

**UC-24:** Cấu hình Thuế
**FR-ADMIN-09:** Cấu hình Mức Thuế
**BR-20:** Admin Action Audit

Tạo mức thuế mới cho một khu vực.

**Request Body:**
```json
{
  "regionId": "b2c3d4e5-f678-90ab-cdef-1234567890ab",
  "name": "EU VAT",
  "rate": "21.00"
}
```

| Trường | Type | Bắt buộc | Constraints |
|-------|------|----------|-------------|
| `regionId` | UUID | Có | Không được đã có mức thuế |
| `name` | string(64) | Có | |
| `rate` | decimal(5,2) | Có | Phần trăm, vd: 21.00 = 21% |

**Response (201 Created):**
```json
{
  "data": {
    "id": "0b9c8d7e-6f5a-4b3c-2d1e-0f9a8b7c6d5e",
    "regionId": "b2c3d4e5-f678-90ab-cdef-1234567890ab",
    "name": "EU VAT",
    "rate": "21.00",
    "isActive": true,
    "createdAt": "2026-06-27T16:00:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `INVALID_STATE` (khu vực đã có mức thuế)

---

### PUT /api/admin/tax-rates/:taxRateId

**Auth:** Bearer token (chỉ ADMIN)

**UC-24:** Cấu hình Thuế
**FR-ADMIN-09:** Cấu hình Mức Thuế
**BR-20:** Admin Action Audit

Cập nhật mức thuế.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `taxRateId` | UUID | ID mức thuế |

**Request Body:**
```json
{
  "rate": "20.00"
}
```

| Trường | Type | Bắt buộc |
|-------|------|----------|
| `name` | string(64) | Không |
| `rate` | decimal(5,2) | Không |
| `isActive` | boolean | Không |

**Response (200 OK):**
```json
{
  "data": {
    "id": "0b9c8d7e-6f5a-4b3c-2d1e-0f9a8b7c6d5e",
    "rate": "20.00",
    "updatedAt": "2026-06-27T16:30:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`

---

### GET /api/admin/email-templates

**Auth:** Bearer token (chỉ ADMIN)

**UC-24:** Mẫu Email
**FR-ADMIN-10:** Quản lý Mẫu Email

Liệt kê tất cả mẫu email.

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "2d1e0f9a-8b7c-6d5e-4f3a-2b1c0d9e8f7a",
      "code": "server.created",
      "name": "Server Created",
      "subject": "Your server {{serverHostname}} is ready!",
      "variables": ["serverHostname", "serverIp", "serverPlan", "regionName"],
      "isActive": true,
      "createdAt": "2026-01-15T08:00:00.000Z",
      "updatedAt": "2026-05-01T10:00:00.000Z"
    },
    {
      "id": "3e2f1a0b-9c8d-7e6f-5a4b-3c2d1e0f9a8b",
      "code": "payment.failed",
      "name": "Payment Failed",
      "subject": "Action required: Payment failed for {{serverHostname}}",
      "variables": ["serverHostname", "amount", "dueDate"],
      "isActive": true,
      "createdAt": "2026-01-15T08:00:00.000Z",
      "updatedAt": "2026-05-01T10:00:00.000Z"
    }
  ]
}
```

**Error Codes:** `UNAUTHORIZED`, `FORBIDDEN`

---

### PUT /api/admin/email-templates/:templateId

**Auth:** Bearer token (chỉ ADMIN)

**UC-24:** Mẫu Email
**FR-ADMIN-10:** Quản lý Mẫu Email
**BR-20:** Admin Action Audit

Cập nhật tiêu đề, nội dung hoặc trạng thái hoạt động của mẫu email. Biến mẫu có thể được tham chiếu với cú pháp `{{variableName}}`.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `templateId` | UUID | ID mẫu |

**Request Body:**
```json
{
  "subject": "Your server {{serverHostname}} has been deployed!",
  "htmlBody": "<h1>Server Ready</h1><p>Your server <strong>{{serverHostname}}</strong> ({{serverIp}}) is now active.</p><p>Plan: {{serverPlan}}</p><p>Region: {{regionName}}</p>",
  "textBody": "Server Ready\n\nYour server {{serverHostname}} ({{serverIp}}) is now active.\nPlan: {{serverPlan}}\nRegion: {{regionName}}",
  "isActive": true
}
```

| Trường | Type | Bắt buộc |
|-------|------|----------|
| `subject` | string(255) | Không |
| `htmlBody` | string (text) | Không |
| `textBody` | string (text) | Không |
| `isActive` | boolean | Không |

**Response (200 OK):**
```json
{
  "data": {
    "id": "2d1e0f9a-8b7c-6d5e-4f3a-2b1c0d9e8f7a",
    "code": "server.created",
    "subject": "Your server {{serverHostname}} has been deployed!",
    "isActive": true,
    "updatedAt": "2026-06-27T16:00:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`

---

### GET /api/admin/settings

**Auth:** Bearer token (chỉ ADMIN)

**UC-24:** Cài đặt Hệ thống
**FR-ADMIN-11:** Quản lý Cài đặt
**BR-66:** System Setting Validation
**BR-67:** Immutable Settings

Liệt kê tất cả cài đặt hệ thống.

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "5a4b3c2d-1e0f-9a8b-7c6d-5e4f3a2b1c0d",
      "key": "site.name",
      "value": "Astral Cloud",
      "type": "STRING",
      "label": "Site Name",
      "description": "Display name for the platform",
      "isImmutable": false,
      "updatedBy": {
        "id": "7e6f5a4b-3c2d-1e0f-9a8b-7c6d5e4f3a2b",
        "username": "admin_root"
      },
      "createdAt": "2026-01-15T08:00:00.000Z",
      "updatedAt": "2026-05-01T10:00:00.000Z"
    },
    {
      "id": "6d5e4f3a-2b1c-0d9e-8f7a-6b5c4d3e2f1a",
      "key": "billing.currency",
      "value": "USD",
      "type": "STRING",
      "label": "Billing Currency",
      "description": "ISO 4217 currency code",
      "isImmutable": true,
      "updatedBy": null,
      "createdAt": "2026-01-15T08:00:00.000Z",
      "updatedAt": "2026-01-15T08:00:00.000Z"
    },
    {
      "id": "7e6f5a4b-3c2d-1e0f-9a8b-7c6d5e4f3a2b",
      "key": "referral.payoutThreshold",
      "value": "50.00",
      "type": "NUMBER",
      "label": "Referral Payout Threshold",
      "description": "Minimum accumulated credits before referral payout is available",
      "isImmutable": false,
      "updatedBy": {
        "id": "7e6f5a4b-3c2d-1e0f-9a8b-7c6d5e4f3a2b",
        "username": "admin_root"
      },
      "createdAt": "2026-01-15T08:00:00.000Z",
      "updatedAt": "2026-06-01T12:00:00.000Z"
    }
  ]
}
```

Lưu ý: Cài đặt bất biến (BR-67) chỉ có thể thay đổi qua biến môi trường, không qua API/UI.

**Error Codes:** `UNAUTHORIZED`, `FORBIDDEN`

---

### PUT /api/admin/settings/:settingId

**Auth:** Bearer token (chỉ ADMIN)

**UC-24:** Cài đặt Hệ thống
**FR-ADMIN-11:** Quản lý Cài đặt
**BR-66:** System Setting Validation
**BR-67:** Immutable Settings
**BR-20:** Admin Action Audit

Cập nhật cài đặt hệ thống. Cài đặt bất biến (BR-67) bị từ chối với `FORBIDDEN`. Giá trị được xác thực theo loại của cài đặt (BR-66).

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `settingId` | UUID | ID cài đặt |

**Request Body:**
```json
{
  "value": "Astral Cloud Platform"
}
```

| Trường | Type | Bắt buộc |
|-------|------|----------|
| `value` | string | Có | Phải khớp loại cài đặt (STRING, NUMBER, BOOLEAN, JSON — BR-66) |

**Response (200 OK):**
```json
{
  "data": {
    "id": "5a4b3c2d-1e0f-9a8b-7c6d-5e4f3a2b1c0d",
    "key": "site.name",
    "value": "Astral Cloud Platform",
    "type": "STRING",
    "updatedBy": {
      "id": "7e6f5a4b-3c2d-1e0f-9a8b-7c6d5e4f3a2b",
      "username": "admin_root"
    },
    "updatedAt": "2026-06-27T16:00:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN` (cài đặt bất biến — BR-67), `NOT_FOUND`

---

### GET /api/admin/announcements

**Auth:** Bearer token (chỉ ADMIN)

**UC-24:** Thông báo
**FR-ANNOUNCE-01:** Tạo Thông báo

Liệt kê tất cả thông báo, bao gồm cả không hoạt động và đã lên lịch.

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "c3d4e5f6-a789-01bc-def0-1234567890ab",
      "title": "Scheduled maintenance: US East",
      "body": "We will be performing scheduled maintenance on the US East region on July 1, 2026 from 02:00–04:00 UTC.",
      "severity": "WARNING",
      "isActive": true,
      "startsAt": "2026-06-27T00:00:00.000Z",
      "endsAt": "2026-07-02T04:00:00.000Z",
      "createdBy": {
        "id": "7e6f5a4b-3c2d-1e0f-9a8b-7c6d5e4f3a2b",
        "username": "admin_root"
      },
      "createdAt": "2026-06-27T00:00:00.000Z"
    }
  ]
}
```

**Error Codes:** `UNAUTHORIZED`, `FORBIDDEN`

---

### POST /api/admin/announcements

**Auth:** Bearer token (chỉ ADMIN)

**UC-24:** Thông báo
**FR-ANNOUNCE-01:** Tạo Thông báo
**FR-ANNOUNCE-02:** Severity Levels
**FR-ANNOUNCE-04:** Scheduling

Tạo thông báo nền tảng mới.

**Request Body:**
```json
{
  "title": "New region available: Asia Pacific",
  "body": "We are excited to announce our new Asia Pacific region in Singapore. Servers can now be deployed closer to Asia-Pacific users with lower latency.",
  "severity": "INFO",
  "startsAt": "2026-06-28T00:00:00.000Z",
  "endsAt": "2026-07-28T00:00:00.000Z"
}
```

| Trường | Type | Bắt buộc | Constraints |
|-------|------|----------|-------------|
| `title` | string(128) | Có | |
| `body` | string (text) | Có | Nội dung Markdown |
| `severity` | enum | Không (mặc định: INFO) | INFO, WARNING, CRITICAL |
| `startsAt` | datetime | Không | Thời gian bắt đầu hiển thị |
| `endsAt` | datetime | Không | Thời gian kết thúc hiển thị |

**Response (201 Created):**
```json
{
  "data": {
    "id": "d4e5f6a7-b8c9-0123-def4-567890abcdef",
    "title": "New region available: Asia Pacific",
    "severity": "INFO",
    "isActive": true,
    "startsAt": "2026-06-28T00:00:00.000Z",
    "endsAt": "2026-07-28T00:00:00.000Z",
    "createdAt": "2026-06-27T16:00:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`

---

### PUT /api/admin/announcements/:announcementId

**Auth:** Bearer token (chỉ ADMIN)

**UC-24:** Thông báo

Cập nhật thông báo hiện có.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `announcementId` | UUID | ID thông báo |

**Request Body:**
```json
{
  "isActive": false
}
```

| Trường | Type | Bắt buộc |
|-------|------|----------|
| `title` | string(128) | Không |
| `body` | string (text) | Không |
| `severity` | enum | Không |
| `isActive` | boolean | Không |
| `startsAt` | datetime | Không |
| `endsAt` | datetime | Không |

**Response (200 OK):**
```json
{
  "data": {
    "id": "d4e5f6a7-b8c9-0123-def4-567890abcdef",
    "title": "New region available: Asia Pacific",
    "isActive": false,
    "updatedAt": "2026-06-27T17:00:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`

---

### DELETE /api/admin/announcements/:announcementId

**Auth:** Bearer token (chỉ ADMIN)

**UC-24:** Thông báo

Xóa vĩnh viễn thông báo.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `announcementId` | UUID | ID thông báo |

**Response (200 OK):**
```json
{
  "data": {
    "message": "Announcement deleted."
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`

---

### GET /api/admin/gdpr-requests

**Auth:** Bearer token (chỉ ADMIN)

**UC-25:** Quản lý GDPR
**FR-ADMIN-07:** Xử lý Yêu cầu GDPR
**BR-62:** Data Export
**BR-63:** Account Deletion

Liệt kê tất cả yêu cầu GDPR với lọc và phân trang.

**Query Parameters:**

| Tham số | Type | Bắt buộc | Mặc định | Mô tả |
|-----------|------|----------|---------|-------------|
| `page` | int | Không | 1 | |
| `limit` | int | Không | 20 | |
| `status` | enum | Không | — | PENDING, PROCESSING, COMPLETED, FAILED |

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "3e2f1a0b-9c8d-7e6f-5a4b-3c2d1e0f9a8b",
      "user": {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "username": "jane_doe",
        "email": "jane@example.com"
      },
      "type": "EXPORT",
      "status": "PENDING",
      "downloadUrl": null,
      "completedAt": null,
      "expiresAt": "2026-07-27T15:30:00.000Z",
      "createdAt": "2026-06-27T15:30:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 3,
    "totalPages": 1
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `FORBIDDEN`

---

### POST /api/admin/gdpr-requests/:requestId/process

**Auth:** Bearer token (chỉ ADMIN)

**UC-25:** Quản lý GDPR
**FR-ADMIN-07:** Xử lý Yêu cầu GDPR
**BR-62:** Data Export
**BR-63:** Account Deletion
**BR-20:** Admin Action Audit

Xử lý yêu cầu GDPR. Với EXPORT: tạo lưu trữ dữ liệu và cung cấp để tải về. Với DELETE: khởi động quy trình xóa tài khoản.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `requestId` | UUID | ID yêu cầu GDPR |

**Request Body:** None

**Response (200 OK):**
```json
{
  "data": {
    "id": "3e2f1a0b-9c8d-7e6f-5a4b-3c2d1e0f9a8b",
    "type": "EXPORT",
    "status": "PROCESSING",
    "message": "GDPR request is being processed.",
    "updatedAt": "2026-06-27T16:00:00.000Z"
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `INVALID_STATE` (yêu cầu không PENDING)

---

### GET /api/admin/queues

**Auth:** Bearer token (chỉ ADMIN)

**UC-24:** Giám sát Queue
**FR-ADMIN-08:** Xem Trạng thái Queue

Lấy trạng thái BullMQ queue bao gồm số lượng job và thông tin dead-letter queue.

**Response (200 OK):**
```json
{
  "data": {
    "queues": [
      {
        "name": "server-provisioning",
        "waiting": 3,
        "active": 2,
        "completed": 15234,
        "failed": 12,
        "delayed": 0,
        "deadLetter": 4,
        "oldestPendingAt": "2026-06-27T15:28:00.000Z"
      },
      {
        "name": "billing-deduction",
        "waiting": 0,
        "active": 0,
        "completed": 45678,
        "failed": 3,
        "delayed": 142,
        "deadLetter": 1,
        "oldestPendingAt": null
      },
      {
        "name": "email-dispatch",
        "waiting": 8,
        "active": 1,
        "completed": 89234,
        "failed": 45,
        "delayed": 0,
        "deadLetter": 7,
        "oldestPendingAt": "2026-06-27T15:29:00.000Z"
      }
    ]
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `FORBIDDEN`

---

### GET /api/admin/blog/posts

**Auth:** Bearer token (ADMIN hoặc STAFF)

**UC-23:** Quản lý Blog
**FR-BLOG-03:** Tạo/Sửa Bài viết
**BR-43:** Blog Visibility

Liệt kê tất cả bài viết blog, bao gồm DRAFT và ARCHIVED.

**Query Parameters:**

| Tham số | Type | Bắt buộc | Mặc định | Mô tả |
|-----------|------|----------|---------|-------------|
| `page` | int | Không | 1 | |
| `limit` | int | Không | 20 | |
| `status` | enum | Không | — | DRAFT, PUBLISHED, ARCHIVED |
| `categorySlug` | string(64) | Không | — | |
| `search` | string(255) | Không | — | |

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "7e6f5a4b-3c2d-1e0f-9a8b-7c6d5e4f3a2b",
      "slug": "getting-started-with-docker",
      "title": "Getting Started with Docker on Astral Cloud",
      "status": "PUBLISHED",
      "category": {
        "id": "8f7a6b5c-4d3e-2f1a-0b9c-8d7e6f5a4b3c",
        "name": "Tutorials",
        "slug": "tutorials"
      },
      "author": {
        "id": "9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d",
        "username": "astral_team"
      },
      "excerpt": "Learn how to deploy your first containerized application on Astral Cloud in minutes.",
      "tags": ["docker", "getting-started"],
      "publishedAt": "2026-06-25T10:00:00.000Z",
      "createdAt": "2026-06-24T14:00:00.000Z",
      "updatedAt": "2026-06-25T10:00:00.000Z"
    },
    {
      "id": "8f7a6b5c-4d3e-2f1a-0b9c-8d7e6f5a4b3c",
      "slug": "upcoming-features-q3-2026",
      "title": "Upcoming Features: Q3 2026",
      "status": "DRAFT",
      "category": {
        "id": "1c0d9e8f-7a6b-5c4d-3e2b-1a0b9c8d7e6f",
        "name": "News",
        "slug": "news"
      },
      "author": {
        "id": "9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d",
        "username": "astral_team"
      },
      "excerpt": null,
      "tags": [],
      "publishedAt": null,
      "createdAt": "2026-06-27T10:00:00.000Z",
      "updatedAt": "2026-06-27T10:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `FORBIDDEN`

---

### POST /api/admin/blog/posts

**Auth:** Bearer token (ADMIN hoặc STAFF)

**UC-23:** Quản lý Blog
**FR-BLOG-03:** Create Posts
**BR-44:** Blog Slug Uniqueness
**BR-45:** Blog Author Attribution

Tạo bài viết blog mới.

**Request Body:**
```json
{
  "title": "Getting Started with Docker",
  "slug": "getting-started-with-docker",
  "categoryId": "8f7a6b5c-4d3e-2f1a-0b9c-8d7e6f5a4b3c",
  "excerpt": "Learn how to deploy your first containerized application.",
  "body": "## Introduction\n\nAstral Cloud makes it easy to deploy containerized applications...",
  "coverImageUrl": "https://cdn.astral.cloud/blog/docker-getting-started-cover.png",
  "tags": ["docker", "getting-started"],
  "status": "PUBLISHED"
}
```

| Trường | Type | Bắt buộc | Constraints |
|-------|------|----------|-------------|
| `title` | string(255) | Có | |
| `slug` | string(255) | Có | Phải duy nhất (BR-44) |
| `categoryId` | UUID | Có | |
| `excerpt` | string(500) | Không | Tóm tắt cho cards |
| `body` | string (text) | Có | Nội dung Markdown |
| `coverImageUrl` | string(512) | Không | |
| `tags` | string[] | Không | Mảng chuỗi tag |
| `status` | enum | Không (mặc định: DRAFT) | DRAFT, PUBLISHED, ARCHIVED |

**Response (201 Created):**
```json
{
  "data": {
    "id": "7e6f5a4b-3c2d-1e0f-9a8b-7c6d5e4f3a2b",
    "slug": "getting-started-with-docker",
    "title": "Getting Started with Docker",
    "status": "PUBLISHED",
    "author": {
      "id": "9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d",
      "username": "astral_team"
    },
    "publishedAt": "2026-06-27T16:00:00.000Z",
    "createdAt": "2026-06-27T16:00:00.000Z"
  }
}
```

Lưu ý: Đặt trạng thái PUBLISHED tự động đặt `publishedAt`. Tác giả được đặt là người dùng đã xác thực (phải là STAFF hoặc ADMIN — BR-45).

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`

---

### PUT /api/admin/blog/posts/:postId

**Auth:** Bearer token (ADMIN hoặc STAFF)

**UC-23:** Quản lý Blog
**FR-BLOG-03:** Edit Posts
**BR-43:** Blog Visibility
**BR-44:** Blog Slug Uniqueness

Cập nhật bài viết blog hiện có.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `postId` | UUID | ID bài viết blog |

**Request Body:**
```json
{
  "title": "Getting Started with Docker on Astral Cloud",
  "status": "ARCHIVED"
}
```

| Trường | Type | Bắt buộc |
|-------|------|----------|
| `title` | string(255) | Không |
| `slug` | string(255) | Không |
| `categoryId` | UUID | Không |
| `excerpt` | string(500) | Không |
| `body` | string (text) | Không |
| `coverImageUrl` | string(512) | Không |
| `tags` | string[] | Không |
| `status` | enum | Không |

**Response (200 OK):**
```json
{
  "data": {
    "id": "7e6f5a4b-3c2d-1e0f-9a8b-7c6d5e4f3a2b",
    "slug": "getting-started-with-docker",
    "title": "Getting Started with Docker on Astral Cloud",
    "status": "ARCHIVED",
    "updatedAt": "2026-06-27T16:30:00.000Z"
  }
}
```

Lưu ý: Thay đổi trạng thái từ DRAFT sang PUBLISHED đặt `publishedAt` nếu chưa được đặt. Bài viết ARCHIVED bị ẩn khỏi danh sách nhưng có thể truy cập qua URL trực tiếp (BR-43).

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`

---

### DELETE /api/admin/blog/posts/:postId

**Auth:** Bearer token (chỉ ADMIN)

**UC-23:** Quản lý Blog

Xóa vĩnh viễn bài viết blog.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `postId` | UUID | ID bài viết blog |

**Response (200 OK):**
```json
{
  "data": {
    "message": "Blog post deleted."
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`

---

### GET /api/admin/blog/categories

**Auth:** Bearer token (ADMIN hoặc STAFF)

**UC-23:** Quản lý Blog
**FR-BLOG-05:** Danh mục Blog

Liệt kê tất cả danh mục blog.

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "8f7a6b5c-4d3e-2f1a-0b9c-8d7e6f5a4b3c",
      "name": "Tutorials",
      "slug": "tutorials",
      "description": "Step-by-step guides and tutorials",
      "postCount": 12,
      "createdAt": "2026-01-15T08:00:00.000Z"
    }
  ]
}
```

**Error Codes:** `UNAUTHORIZED`, `FORBIDDEN`

---

### POST /api/admin/blog/categories

**Auth:** Bearer token (ADMIN hoặc STAFF)

**UC-23:** Quản lý Blog
**FR-BLOG-05:** Danh mục Blog

Tạo danh mục blog mới.

**Request Body:**
```json
{
  "name": "Case Studies",
  "slug": "case-studies",
  "description": "Customer success stories and case studies"
}
```

| Trường | Type | Bắt buộc | Constraints |
|-------|------|----------|-------------|
| `name` | string(64) | Có | |
| `slug` | string(64) | Có | Phải duy nhất |
| `description` | string(255) | Không | |

**Response (201 Created):**
```json
{
  "data": {
    "id": "9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d",
    "name": "Case Studies",
    "slug": "case-studies",
    "description": "Customer success stories and case studies",
    "postCount": 0,
    "createdAt": "2026-06-27T16:00:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`

---

### PUT /api/admin/blog/categories/:categoryId

**Auth:** Bearer token (ADMIN hoặc STAFF)

**UC-23:** Quản lý Blog
**FR-BLOG-05:** Danh mục Blog

Cập nhật danh mục blog hiện có.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `categoryId` | UUID | ID danh mục |

**Request Body:**
```json
{
  "name": "Customer Stories",
  "description": "In-depth customer stories and case studies"
}
```

| Trường | Type | Bắt buộc |
|-------|------|----------|
| `name` | string(64) | Không |
| `slug` | string(64) | Không |
| `description` | string(255) | Không |

**Response (200 OK):**
```json
{
  "data": {
    "id": "9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d",
    "name": "Customer Stories",
    "description": "In-depth customer stories and case studies",
    "updatedAt": "2026-06-27T16:30:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`

---

### DELETE /api/admin/blog/categories/:categoryId

**Auth:** Bearer token (chỉ ADMIN)

**UC-23:** Quản lý Blog

Xóa danh mục blog. Bài viết trong danh mục này phải được gán lại trước.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `categoryId` | UUID | ID danh mục |

**Response (200 OK):**
```json
{
  "data": {
    "message": "Blog category deleted."
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `INVALID_STATE` (danh mục có bài viết)

---

## 33. Endpoints — Staff

Staff endpoint yêu cầu quyền STAFF hoặc ADMIN.

### GET /api/staff/tickets

**Auth:** Bearer token (STAFF hoặc ADMIN)

**UC-22:** Quản lý Ticket Staff
**FR-TICKET-10:** Lọc & Tìm kiếm Tickets
**FR-TICKET-08:** Gán Tickets

Liệt kê tất cả tickets hỗ trợ với lọc nâng cao.

**Query Parameters:**

| Tham số | Type | Bắt buộc | Mặc định | Mô tả |
|-----------|------|----------|---------|-------------|
| `page` | int | Không | 1 | |
| `limit` | int | Không | 20 | |
| `status` | enum | Không | — | OPEN, IN_PROGRESS, WAITING_ON_CUSTOMER, RESOLVED, CLOSED |
| `priority` | enum | Không | — | LOW, NORMAL, HIGH, URGENT |
| `assignee` | UUID | Không | — | Lọc theo ID người dùng staff được gán (dùng "unassigned" cho null) |

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "6d5e4f3a-2b1c-0d9e-8f7a-6b5c4d3e2f1a",
      "subject": "Server not starting",
      "category": "TECHNICAL",
      "status": "OPEN",
      "priority": "NORMAL",
      "customer": {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "username": "jane_doe",
        "email": "jane@example.com"
      },
      "assignedUser": {
        "id": "7e6f5a4b-3c2d-1e0f-9a8b-7c6d5e4f3a2b",
        "username": "support_alex"
      },
      "messageCount": 3,
      "lastMessageAt": "2026-06-27T14:35:00.000Z",
      "createdAt": "2026-06-27T14:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 58,
    "totalPages": 3
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `FORBIDDEN`

---

### PUT /api/staff/tickets/:ticketId

**Auth:** Bearer token (STAFF hoặc ADMIN)

**UC-22:** Quản lý Ticket Staff
**FR-TICKET-04:** Change Ticket Status
**FR-TICKET-08:** Gán Tickets
**BR-40:** Ticket Status Lifecycle

Cập nhật thuộc tính ticket: trạng thái, người dùng staff được gán, hoặc mức ưu tiên.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `ticketId` | UUID | Ticket ID |

**Request Body:**
```json
{
  "status": "RESOLVED",
  "assignedUserId": "7e6f5a4b-3c2d-1e0f-9a8b-7c6d5e4f3a2b",
  "priority": "HIGH"
}
```

| Trường | Type | Bắt buộc | Constraints |
|-------|------|----------|-------------|
| `status` | enum | Không | OPEN, IN_PROGRESS, WAITING_ON_CUSTOMER, RESOLVED (CLOSED chỉ bởi khách hàng — BR-40) |
| `assignedUserId` | UUID | Không | ID người dùng staff; null để bỏ gán |
| `priority` | enum | Không | LOW, NORMAL, HIGH, URGENT |

**Response (200 OK):**
```json
{
  "data": {
    "id": "6d5e4f3a-2b1c-0d9e-8f7a-6b5c4d3e2f1a",
    "status": "RESOLVED",
    "assignedUser": {
      "id": "7e6f5a4b-3c2d-1e0f-9a8b-7c6d5e4f3a2b",
      "username": "support_alex"
    },
    "priority": "HIGH",
    "resolvedAt": "2026-06-27T17:00:00.000Z",
    "updatedAt": "2026-06-27T17:00:00.000Z"
  }
}
```

Lưu ý: Đặt trạng thái RESOLVED tự động đặt `resolvedAt`. Ticket RESOLVED không có phản hồi từ khách hàng trong 72 giờ sẽ tự động CLOSED (BR-42).

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `INVALID_STATE` (chuyển trạng thái không hợp lệ — BR-40)

---

### POST /api/staff/tickets/:ticketId/messages

**Auth:** Bearer token (STAFF hoặc ADMIN)

**UC-22:** Quản lý Ticket Staff
**FR-TICKET-03:** Thêm Tin nhắns
**FR-TICKET-09:** Ghi chú Nội bộ

Thêm tin nhắn vào ticket với tư cách staff. Hỗ trợ ghi chú nội bộ không hiển thị với khách hàng.

**Path Parameters:**

| Tham số | Type | Mô tả |
|-----------|------|-------------|
| `ticketId` | UUID | Ticket ID |

**Request Body:**
```json
{
  "body": "Checked the node logs — there was a resource contention issue. I've restarted the Docker daemon on docker-node-01 and your server should be starting now.",
  "isInternal": false
}
```

| Trường | Type | Bắt buộc | Mặc định | Mô tả |
|-------|------|----------|---------|-------------|
| `body` | string (text) | Có | | Nội dung tin nhắn |
| `isInternal` | boolean | Không | false | Đặt true cho ghi chú chỉ staff (FR-TICKET-09) |

**Response (201 Created):**
```json
{
  "data": {
    "id": "0b9c8d7e-6f5a-4b3c-2d1e-0f9a8b7c6d5e",
    "ticketId": "6d5e4f3a-2b1c-0d9e-8f7a-6b5c4d3e2f1a",
    "userId": "7e6f5a4b-3c2d-1e0f-9a8b-7c6d5e4f3a2b",
    "userName": "support_alex",
    "body": "Checked the node logs — there was a resource contention issue...",
    "isInternal": false,
    "createdAt": "2026-06-27T17:00:00.000Z"
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `INVALID_STATE` (ticket CLOSED)

---

## 34. Giới hạn Tốc độ

| Phạm vi | Giới hạn | Khoảng thời gian | Áp dụng Cho |
|-------|-------|--------|------------|
| Auth endpoints | 10 request | mỗi phút, mỗi IP | `/api/auth/register`, `/api/auth/login`, `/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/auth/verify-email` |
| General user | 60 request | mỗi phút, mỗi người dùng (theo token/key) | Tất cả endpoint đã xác thực không được chỉ định khác |
| Server create | 5 request | mỗi phút, mỗi người dùng | `POST /api/servers` |
| Stripe webhook | Unlimited | n/a | `POST /api/stripe/webhook` |

Header giới hạn tốc độ được trả về trên mỗi response:

| Header | Mô tả |
|--------|-------------|
| `X-RateLimit-Limit` | Số request tối đa được phép trong khoảng thời gian |
| `X-RateLimit-Remaining` | Số request còn lại trong khoảng thời gian hiện tại |
| `X-RateLimit-Reset` | Unix timestamp khi khoảng thời gian đặt lại |

Khi bị giới hạn tốc độ, server trả về `429 Too Many Requests` và header `Retry-After` chỉ số giây cần chờ.

---

## 35. Header Chuẩn

### Request Headers

| Header | Bắt buộc | Mô tả |
|--------|----------|-------------|
| `Authorization` | Có điều kiện | `Bearer <accessToken>` or `Bearer <apiKey>` cho endpoint đã xác thực |
| `Content-Type` | Có (cho POST/PUT/PATCH) | Phải là `application/json` |
| `Accept` | Khuyến nghị | Nên là `application/json` |
| `Idempotency-Key` | Optional | UUID v4 cho `POST /api/servers`; đảm bảo ngữ nghĩa chính xác một lần. Phát lại trong 24h trả về response gốc. |
| `User-Agent` | Optional | Được theo dõi trong bản ghi session |
| `X-Forwarded-For` | Optional | IP client thực khi đứng sau proxy |

### Response Headers

| Header | Mô tả |
|--------|-------------|
| `X-Request-Id` | UUID v4 duy nhất cho mỗi request (lan truyền qua logs) |
| `X-RateLimit-Limit` | Trần giới hạn tốc độ cho khoảng thời gian hiện tại |
| `X-RateLimit-Remaining` | Request còn lại trong khoảng thời gian hiện tại |
| `X-RateLimit-Reset` | Unix timestamp khi khoảng thời gian đặt lại |
| `Retry-After` | Số giây cần chờ trước khi thử lại (gửi với response 429) |
| `Set-Cookie` | Cookie `refresh_token` được đặt khi login và refresh; bị xóa khi logout |

---

## 36. Webhooks

### Stripe Webhook

| Thuộc tính | Giá trị |
|-----------|-------|
| URL | `POST /api/stripe/webhook` |
| Auth | Stripe signature header (`stripe-signature`) |
| Content-Type | `application/json` (raw body preserved for signature verification) |
| Rate Limit | None (unlimited) |

**Subscribed events:**

| Sự kiện | Xử lý |
|-------|---------|
| `payment_intent.succeeded` | Cập nhật trạng thái bản ghi thanh toán thành COMPLETED, cộng tiền vào ví, tạo hóa đơn PDF, gửi email xác nhận |
| `payment_intent.payment_failed` | Cập nhật trạng thái bản ghi thanh toán thành FAILED, gửi thông báo thất bại cho người dùng |

**Verification:** Each request is verified using `stripe.webhooks.constructEvent(rawBody, stripeSignature, webhookSecret)`. Requests with chữ ký không hợp lệs return 401.

**Idempotency:** Stripe webhooks có thể được gửi nhiều lần. Handler là idempotent — kiểm tra `stripePaymentId` trước khi xử lý.

---

## Phụ lục A: Quy ước UUID

Tất cả ID thực thể là UUID v4. Định dạng ví dụ: `550e8400-e29b-41d4-a716-446655440001`

Trong các ví dụ request/response xuyên suốt tài liệu này, các UUID lặp lại sau đây được sử dụng nhất quán:

| Thực thể | UUID Ví dụ |
|--------|-------------|
| Người dùng (jane_doe) | `550e8400-e29b-41d4-a716-446655440001` |
| Server (my-web-server) | `6ba7b810-9dad-11d1-80b4-00c04fd430c8` |
| Plan Starter | `b1e4f7a2-c3d5-4890-9f1e-2a3b4c5d6e7f` |
| Image Ubuntu 24.04 | `f47ac10b-58cc-4372-a567-0e02b2c3d479` |
| Khu vực US East | `8f3a2b1c-4d5e-6f7a-8b9c-0d1e2f3a4b5c` |
| Node docker-node-01 | `d2c3b4a5-e6f7-8901-abcd-ef2345678901` |
| Admin (admin_root) | `7e6f5a4b-3c2d-1e0f-9a8b-7c6d5e4f3a2b` |

---

## Phụ lục B: Quy ước Timestamp

Tất cả timestamp là ISO 8601 với độ chính xác millisecond theo UTC:

```
2026-06-27T14:30:00.000Z
```

Số tiền tài chính sử dụng biểu diễn chuỗi (`"42.50"`) để tránh vấn đề độ chính xác dấu phẩy động.

---

## Phụ lục C: Ma trận Truy cập Dựa trên Vai trò

| Vai trò | Phạm vi Endpoint |
|------|---------------|
| Công khai (chưa xác thực) | Xác thực (register, login, forgot/reset password, verify email), Dữ liệu tham khảo (plans, images, regions, announcements), Blog (công khai), Stripe webhook |
| CUSTOMER (mặc định) | Profile, Servers, Tags, Firewall, DNS, Backups, Wallet & Billing, Vouchers, Tickets Hỗ trợ, Notifications, Referrals, API Keys |
| STAFF (thêm vào CUSTOMER) | Quản lý ticket Staff, Quản lý Blog (tạo/sửa bài viết & danh mục) |
| ADMIN (thêm vào STAFF) | Quản lý người dùng, Quản lý Plan/Image/Node/Region, Nhật ký Audit, Quản lý Voucher, Mức thuế, Mẫu Email, Cài đặt Hệ thống, Quản lý Thông báo, Yêu cầu GDPR, Giám sát Queue, Xóa bài viết Blog |

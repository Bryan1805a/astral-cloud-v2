# Astral Cloud — API Design

Base URL: `https://<domain>/api`

---

## 1. Authentication

Astral Cloud uses JWT-based authentication with a short-lived access token and a long-lived refresh token.

| Token | Lifetime | Storage | Transmission | Rotation |
|-------|----------|---------|-------------|----------|
| Access token | 1 hour | Client memory | `Authorization: Bearer <token>` header | On every refresh |
| Refresh token | 7 days | HTTP-only, Secure, SameSite=Strict cookie | `Set-Cookie: refresh_token=...` | On use |

**Token payload (access):**
```json
{
  "sub": "550e8400-e29b-41d4-a716-446655440001",
  "role": "CUSTOMER",
  "type": "access",
  "iat": 1711234567,
  "exp": 1711238167
}
```

**Token refresh flow:**
1. Client calls `POST /api/auth/refresh` — the browser automatically sends the HTTP-only `refresh_token` cookie.
2. Server validates the refresh token hash against the `Session` table, checks expiry.
3. Server issues a new access token (response body) and a new refresh token (cookie), invalidating the old session row.

**API key alternative:** Requests may also authenticate via `Authorization: Bearer ak_<prefix_hash>` header, using a user-created API key. API keys inherit the creating user's permissions (BR-64).

---

## 2. Response Envelope & Error Codes

### Success envelope

All successful responses are wrapped as:

```json
{
  "data": { }
}
```

For paginated list responses:

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

### Error envelope

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description of the error."
  }
}
```

For validation errors, additional `details` may be included:

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

### Error Codes

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `VALIDATION_ERROR` | 400 | Input failed Zod schema validation |
| `UNAUTHORIZED` | 401 | Missing or invalid access token |
| `INVALID_CREDENTIALS` | 401 | Email/password combination wrong |
| `TOKEN_EXPIRED` | 401 | Access token has expired; use refresh |
| `INSUFFICIENT_BALANCE` | 402 | Wallet balance too low for operation |
| `SERVER_LIMIT_REACHED` | 403 | User has hit the 5-active-server cap (BR-06) |
| `ACCOUNT_LOCKED` | 423 | Account locked due to failed login attempts (BR-23) |
| `FORBIDDEN` | 403 | Authenticated but lacking required role |
| `NOT_FOUND` | 404 | Requested resource does not exist |
| `INVALID_STATE` | 409 | Operation invalid given current resource state (e.g. starting a running server) |
| `USERNAME_TAKEN` | 409 | Username already registered (BR-21) |
| `EMAIL_TAKEN` | 409 | Email already registered (BR-21) |
| `VOUCHER_EXPIRED` | 400 | Voucher is outside its validity window (BR-34) |
| `VOUCHER_EXHAUSTED` | 400 | Voucher has reached max uses (BR-35) |
| `VOUCHER_ALREADY_USED` | 400 | User has already redeemed this voucher (BR-36) |
| `VOUCHER_MIN_SPEND` | 400 | Payment amount below voucher minimum spend (BR-37) |
| `INVALID_REFERRAL_CODE` | 400 | Referral code does not exist or is user's own (BR-57) |
| `RATE_LIMITED` | 429 | Too many requests (see Rate Limiting) |
| `INTERNAL_ERROR` | 500 | Unhandled server error |
| `NODE_CAPACITY` | 503 | No node available with sufficient free resources (BR-05) |
| `RUNTIME_UNREACHABLE` | 502 | Docker daemon unreachable on target node |
| `2FA_REQUIRED` | 401 | Account has 2FA enabled; TOTP code must be provided |
| `INVALID_2FA_CODE` | 401 | The provided TOTP code is invalid |

---

## 3. Endpoints — Auth

### POST /api/auth/register

**Auth:** None (public)

**Idempotency:** Not applicable

**UC-02:** Register Account
**BR-21:** Unique Credentials
**BR-22:** Password Complexity

Register a new user account. On success, a verification email is sent.

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

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `username` | string(32) | Yes | Must be unique (BR-21), alphanumeric and underscore, 3–32 chars |
| `email` | string(255) | Yes | Must be unique (BR-21), valid email format |
| `password` | string(128) | Yes | Min 8 chars, 1 uppercase, 1 lowercase, 1 digit (BR-22) |
| `confirmPassword` | string(128) | Yes | Must match `password` exactly |
| `referralCode` | string(16) | No | Must be a valid, active referral code; cannot be user's own (BR-57) |

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

Authenticate with email and password. If the account has 2FA enabled, a `2FA_REQUIRED` error is returned with a temporary token for the second step.

**Request Body:**
```json
{
  "email": "jane@example.com",
  "password": "Str0ng!Pass",
  "rememberMe": true,
  "totpCode": "123456"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `email` | string(255) | Yes | |
| `password` | string(128) | Yes | |
| `rememberMe` | boolean | No (default: false) | Extends refresh token to 30 days |
| `totpCode` | string(6) | No | Required only if 2FA is enabled on account |

**Response (200 OK) — without 2FA:**
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

**Response (200 OK) — 2FA required:**
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

Exchange a valid refresh token cookie for a new access token + new refresh token. The old session row is invalidated.

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

New `Set-Cookie` issued.

**Error Codes:** `UNAUTHORIZED`, `TOKEN_EXPIRED`, `RATE_LIMITED`

---

### GET /api/auth/me

**Auth:** Bearer token or API key

**UC-03:** Login

Return the current authenticated user's profile.

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

Invalidate the current session (revoke refresh token). Client should discard the access token.

**Request Body:** None

**Response (200 OK):**
```json
{
  "data": {
    "message": "Logged out successfully."
  }
}
```

`Set-Cookie` with `Max-Age=0` to clear the refresh token cookie.

**Error Codes:** `UNAUTHORIZED`

---

### POST /api/auth/forgot-password

**Auth:** None (public)

**FR-AUTH-13:** Password Reset

Send a password reset email to the registered address. Always returns 200 (no user enumeration — NFR-SEC-07).

**Request Body:**
```json
{
  "email": "jane@example.com"
}
```

| Field | Type | Required |
|-------|------|----------|
| `email` | string(255) | Yes |

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

Reset the password using a token emailed to the user.

**Request Body:**
```json
{
  "token": "c2VjcmV0LXBhc3N3b3JkLXJlc2V0LXRva2Vu...",
  "newPassword": "NewStr0ng!Pass"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `token` | string | Yes | Emailed reset token |
| `newPassword` | string(128) | Yes | Min 8 chars, 1 uppercase, 1 lowercase, 1 digit (BR-22) |

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

Verify an email address using a token sent during registration.

**Request Body:**
```json
{
  "token": "ZW1haWwtdmVyaWZpY2F0aW9uLXRva2Vu..."
}
```

| Field | Type | Required |
|-------|------|----------|
| `token` | string | Yes |

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

Begin the 2FA setup process. Returns a TOTP secret and QR code URI. Requires confirmation via the verify step.

**Request Body:**
```json
{
  "totpCode": "654321"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `totpCode` | string(6) | Yes | Code from authenticator app, used to finalize enable |

**Response (200 OK) — On initial setup (before verify):**
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

Disable 2FA for the current account. Requires a valid TOTP code for confirmation. ADMIN accounts cannot disable 2FA (BR-24).

**Request Body:**
```json
{
  "totpCode": "123456"
}
```

| Field | Type | Required |
|-------|------|----------|
| `totpCode` | string(6) | Yes |

**Response (200 OK):**
```json
{
  "data": {
    "message": "Two-factor authentication has been disabled."
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `INVALID_2FA_CODE`, `FORBIDDEN` (for ADMIN accounts — BR-24), `UNAUTHORIZED`

---

### POST /api/auth/2fa/verify

**Auth:** Temporary token (returned from login as `tempToken`)

Used during the login flow to complete 2FA verification.

**Request Body:**
```json
{
  "tempToken": "eyJhbGciOiJIUzI1NiIs...",
  "totpCode": "123456"
}
```

| Field | Type | Required |
|-------|------|----------|
| `tempToken` | string | Yes | Temporary token from login response |
| `totpCode` | string(6) | Yes | Current TOTP code from authenticator app |

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

**FR-AUTH-11:** Session Management

List all active sessions for the current user.

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

**FR-AUTH-11:** Session Management

Revoke a specific session. The session record is deleted and its refresh token is invalidated.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `sessionId` | UUID | ID of the session to revoke |

**Response (200 OK):**
```json
{
  "data": {
    "message": "Session revoked."
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN` (if trying to revoke another user's session)

---

## 4. Endpoints — API Keys

### GET /api/api-keys

**Auth:** Bearer token or API key

**UC-09:** API Key Management
**FR-APIKEY-01:** Create API Keys

List the current user's API keys. Only prefix and metadata are returned — the full key is never shown after creation.

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

**UC-09:** API Key Management
**FR-APIKEY-01:** Create API Keys
**FR-APIKEY-02:** Full Key Once
**BR-65:** API Key Expiry

Create a new API key. The full key is returned only once in this response (FR-APIKEY-02).

**Request Body:**
```json
{
  "label": "My CI/CD Pipeline",
  "expiresAt": "2026-12-31T23:59:59.000Z"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `label` | string(64) | Yes | Max 64 characters |
| `expiresAt` | datetime (ISO 8601) | No | Null = never expires (BR-65) |

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

**UC-09:** API Key Management
**FR-APIKEY-03:** Revoke API Keys

Revoke (delete) an API key. The key immediately stops working.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `keyId` | UUID | ID of the API key to revoke |

**Response (200 OK):**
```json
{
  "data": {
    "message": "API key revoked."
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN` (not user's key)

---

## 5. Endpoints — Servers

### GET /api/servers

**Auth:** Bearer token or API key

**UC-04:** View Server List
**FR-SERVER-12:** Paginated List
**FR-SERVER-13:** Filter by Status & Tags

List the authenticated user's server instances with pagination and filtering.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | int | No | 1 | Page number |
| `limit` | int | No | 20 | Items per page (max 100) |
| `status` | enum | No | — | Filter: CREATING, ACTIVE, STOPPED, ERROR |
| `tagId` | UUID | No | — | Filter servers by assigned tag |

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

**UC-04:** View Server Details
**FR-SERVER-20:** Detailed Server Info

Get full details for a single server instance including associated tags.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `serverId` | UUID | Server instance ID |

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

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN` (not user's server)

---

### POST /api/servers

**Auth:** Bearer token

**Idempotency:** Supported via `Idempotency-Key` header. Duplicate keys within 24h return the original response without re-provisioning.

**UC-01:** Create Server
**FR-SERVER-01** through **FR-SERVER-11**
**BR-03:** ImageTemplate Requirement
**BR-05:** Node Resource Ceiling
**BR-06:** Server Limit
**BR-07:** Provisioning Timeout
**BR-08:** Image Size <= Plan Disk
**BR-09:** Regional Availability
**BR-10:** Minimum Disk Size
**BR-11:** Hostname Uniqueness
**BR-12:** SSH Key Ownership
**BR-27:** Pre-payment Required

Create a new server instance. Returns `202 Accepted` — the server is provisioned asynchronously and starts in `CREATING` status.

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

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `hostname` | string(64) | Yes | Unique per user (BR-11), lowercase alphanumeric and hyphens |
| `planId` | UUID | No* | Server plan ID; null if `customSpecs` provided |
| `imageId` | UUID | No** | Image template ID |
| `snapshotId` | UUID | No** | Snapshot ID (boot from snapshot) |
| `regionId` | UUID | Yes | Must be available for user + plan (BR-09) |
| `sshKeyId` | UUID | No | Must belong to user (BR-12) |
| `billingModel` | enum | Yes | `MONTHLY` or `HOURLY` |
| `customSpecs` | object | No* | Required if `planId` is null |
| `customSpecs.vcpu` | int | Yes (if custom) | >= 1 |
| `customSpecs.ramMB` | int | Yes (if custom) | >= 256 |
| `customSpecs.diskGB` | int | Yes (if custom) | >= 5 (BR-10) |

\* Exactly one of `planId` or `customSpecs` required.
\** Exactly one of `imageId` or `snapshotId` required (BR-03).

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

**UC-05:** Start Server
**FR-SERVER-14:** Start Server
**BR-13:** Start Precondition

Start a server that is in STOPPED state.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `serverId` | UUID | Server instance ID |

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

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`, `INVALID_STATE` (not STOPPED — BR-13), `RUNTIME_UNREACHABLE`

---

### POST /api/servers/:serverId/stop

**Auth:** Bearer token or API key

**UC-06:** Stop Server
**FR-SERVER-15:** Graceful Shutdown
**FR-SERVER-16:** Force Stop
**BR-14:** Stop Precondition
**BR-17:** Force Stop Fallback

Stop a running server. Graceful shutdown first; force stop after 30 seconds (BR-17).

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `serverId` | UUID | Server instance ID |

**Request Body:**
```json
{
  "force": false
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `force` | boolean | No | false | If true, skips graceful shutdown and sends SIGKILL immediately |

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

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`, `INVALID_STATE` (not RUNNING — BR-14), `RUNTIME_UNREACHABLE`

---

### POST /api/servers/:serverId/restart

**Auth:** Bearer token or API key

**FR-SERVER-17:** Restart Server

Restart a running server (stop then start).

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `serverId` | UUID | Server instance ID |

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

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`, `INVALID_STATE` (not RUNNING), `RUNTIME_UNREACHABLE`

---

### DELETE /api/servers/:serverId

**Auth:** Bearer token

**UC-07:** Delete Server
**FR-SERVER-18:** Delete Server (confirmation + hostname)
**BR-15:** Deletion Precondition
**BR-16:** Resource Release
**BR-18:** Backup Deletion

Permanently delete a server instance. Server must be in STOPPED state (BR-15). All resources (vCPU, RAM, disk, IP) are released back to the node (BR-16). All backups are deleted (BR-18).

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `serverId` | UUID | Server instance ID |

**Request Body:**
```json
{
  "confirmHostname": "my-web-server"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `confirmHostname` | string(64) | Yes | Must match server hostname exactly (FR-SERVER-18) |

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

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`, `INVALID_STATE` (not STOPPED — BR-15), `VALIDATION_ERROR` (hostname mismatch)

---

### GET /api/servers/:serverId/stats

**Auth:** Bearer token or API key

Get current resource usage statistics for a server (CPU, RAM, disk, bandwidth). Data is polled from the node's container runtime.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `serverId` | UUID | Server instance ID |

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

Establish a WebSocket connection for interactive console access. **Deferred feature** — the endpoint is documented here for future implementation.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `serverId` | UUID | Server instance ID |

**Connection:** `wss://<domain>/api/servers/:serverId/console?token=<accessToken>`

The server returns a single-use console token in the initial HTTP response. The client then opens a WebSocket using that token. The WebSocket passes raw stdin/stdout to/from the container's exec session.

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`, `INVALID_STATE` (server not ACTIVE)

---

## 6. Endpoints — Tags

### GET /api/tags

**Auth:** Bearer token or API key

**FR-SERVER-21:** Tag Management

List all tags belonging to the authenticated user.

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

Create a new tag.

**Request Body:**
```json
{
  "name": "production",
  "color": "#22c55e"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `name` | string(32) | Yes | Max 32 characters |
| `color` | string(7) | No | Hex color code e.g. "#22c55e" |

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

Update an existing tag.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `tagId` | UUID | Tag ID |

**Request Body:**
```json
{
  "name": "production-updated",
  "color": "#16a34a"
}
```

| Field | Type | Required |
|-------|------|----------|
| `name` | string(32) | No |
| `color` | string(7) | No |

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

Delete a tag. The tag is removed from all associated servers.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `tagId` | UUID | Tag ID |

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

**FR-SERVER-21:** Tag Management

Synchronize tags on a server. The provided array of `tagIds` replaces the server's current tag set.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `serverId` | UUID | Server instance ID |

**Request Body:**
```json
{
  "tagIds": [
    "9a8b7c6d-5e4f-3a2b-1c0d-9e8f7a6b5c4d",
    "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d"
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tagIds` | UUID[] | Yes | Complete set of tag IDs to assign (replaces existing) |

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

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN` (tag not owned by user)

---

## 7. Endpoints — Firewall

### GET /api/servers/:serverId/firewall

**Auth:** Bearer token or API key

**UC-14:** Firewall Management
**FR-FW-01:** List Firewall Rules
**BR-46:** Default Deny-All
**BR-47:** Priority Order
**BR-48:** Default Rules

List all firewall rules for a server, ordered by priority (ascending).

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `serverId` | UUID | Server instance ID |

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

**UC-14:** Firewall Management
**FR-FW-02:** Create Firewall Rule
**BR-47:** Priority Order

Add a new firewall rule to a server.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `serverId` | UUID | Server instance ID |

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

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `protocol` | enum | Yes | `TCP`, `UDP`, `ICMP`, `ALL` |
| `portRange` | string(16) | Yes | e.g. "22", "80", "8000-8100" |
| `sourceCidr` | string(45) | Yes | CIDR notation e.g. "0.0.0.0/0", "10.0.0.0/8" |
| `action` | enum | Yes | `ALLOW`, `DENY` |
| `priority` | int | Yes | Lower = higher priority (BR-47) |
| `description` | string(128) | No | Optional label |

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

**UC-14:** Firewall Management
**FR-FW-03:** Update Firewall Rule

Update an existing firewall rule.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `serverId` | UUID | Server instance ID |
| `ruleId` | UUID | Firewall rule ID |

**Request Body:**
```json
{
  "portRange": "8080-8081",
  "sourceCidr": "192.168.0.0/16",
  "priority": 15,
  "description": "Updated app port range"
}
```

| Field | Type | Required |
|-------|------|----------|
| `protocol` | enum | No |
| `portRange` | string(16) | No |
| `sourceCidr` | string(45) | No |
| `action` | enum | No |
| `priority` | int | No |
| `description` | string(128) | No |

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

**UC-14:** Firewall Management
**FR-FW-04:** Delete Firewall Rule

Delete a firewall rule.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `serverId` | UUID | Server instance ID |
| `ruleId` | UUID | Firewall rule ID |

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

**UC-15:** DNS Record Management
**FR-DNS-01:** List DNS Records
**BR-49:** DNS Record Uniqueness
**BR-50:** Reverse DNS

List all DNS records for a server.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `serverId` | UUID | Server instance ID |

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

**UC-15:** DNS Record Management
**FR-DNS-02:** Create DNS Record
**BR-49:** DNS Record Uniqueness
**BR-50:** Reverse DNS

Add a new DNS record to a server.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `serverId` | UUID | Server instance ID |

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

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `type` | enum | Yes | `A`, `AAAA`, `CNAME`, `MX`, `TXT`, `PTR` |
| `name` | string(255) | Yes | e.g. "@", "www", "mail" |
| `value` | string(512) | Yes | IP address or domain name |
| `ttl` | int | No (default: 3600) | Time to live in seconds |
| `priority` | int | No | Required for MX records |

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

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`, `INVALID_STATE` (duplicate record — BR-49, or second PTR — BR-50)

---

### PUT /api/servers/:serverId/dns/:recordId

**Auth:** Bearer token

**UC-15:** DNS Record Management
**FR-DNS-03:** Update DNS Record

Update an existing DNS record.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `serverId` | UUID | Server instance ID |
| `recordId` | UUID | DNS record ID |

**Request Body:**
```json
{
  "value": "203.0.113.25",
  "ttl": 7200
}
```

| Field | Type | Required |
|-------|------|----------|
| `type` | enum | No |
| `name` | string(255) | No |
| `value` | string(512) | No |
| `ttl` | int | No |
| `priority` | int | No |

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

**UC-15:** DNS Record Management
**FR-DNS-04:** Delete DNS Record

Delete a DNS record.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `serverId` | UUID | Server instance ID |
| `recordId` | UUID | DNS record ID |

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

**UC-13:** Backup Management
**FR-BACKUP-02:** View Backup History
**BR-51:** Backup Retention

List all backups for a server, ordered by creation date descending.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `serverId` | UUID | Server instance ID |

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

**UC-13:** Backup Management
**FR-BACKUP-01:** Create Manual Backup
**BR-52:** Backup Storage Quota
**BR-53:** Concurrent Backups

Create a manual backup of a server. The server must be in ACTIVE state.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `serverId` | UUID | Server instance ID |

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

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`, `INVALID_STATE` (server not ACTIVE, backup already in progress — BR-53, storage quota exceeded — BR-52)

---

### POST /api/servers/:serverId/backups/:backupId/restore

**Auth:** Bearer token

**UC-13:** Backup Management
**FR-BACKUP-03:** Restore from Backup

Restore a server from a specific backup. The server must be in STOPPED state.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `serverId` | UUID | Server instance ID |
| `backupId` | UUID | Backup ID |

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

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`, `INVALID_STATE` (server not STOPPED, backup not AVAILABLE)

---

### DELETE /api/servers/:serverId/backups/:backupId

**Auth:** Bearer token

**UC-13:** Backup Management
**FR-BACKUP-04:** Delete Backup

Delete a specific backup and release its storage.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `serverId` | UUID | Server instance ID |
| `backupId` | UUID | Backup ID |

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

**UC-13:** Backup Management
**FR-BACKUP-05:** Backup Schedule
**BR-51:** Backup Retention

Get the automated backup schedule configuration for a server.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `serverId` | UUID | Server instance ID |

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

**UC-13:** Backup Management
**FR-BACKUP-05:** Backup Schedule
**BR-51:** Backup Retention

Update the automated backup schedule for a server.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `serverId` | UUID | Server instance ID |

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

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `enabled` | boolean | No | Enable/disable automated backups |
| `intervalHours` | int | No | Frequency in hours (min 6) |
| `retainDaily` | int | No | Number of daily backups to retain |
| `retainWeekly` | int | No | Number of weekly backups to retain |
| `retainMonthly` | int | No | Number of monthly backups to retain |

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

## 10. Endpoints — Wallet & Billing

### GET /api/wallet

**Auth:** Bearer token or API key

**FR-BILL-02:** View Balance

Get the current wallet balance for the authenticated user.

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

**UC-10:** Billing & Wallet
**FR-BILL-03:** Add Funds
**FR-VOUCHER-01:** Apply Voucher

Add funds to the wallet via Stripe. Optionally apply a voucher code at checkout.

**Request Body:**
```json
{
  "amount": "50.00",
  "paymentMethodId": "7e6f5a4b-3c2d-1e0f-9a8b-7c6d5e4f3a2b",
  "voucherCode": "LAUNCH2026"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `amount` | decimal(10,2) | Yes | Minimum 1.00 |
| `paymentMethodId` | UUID | Yes | Saved payment method ID |
| `voucherCode` | string(32) | No | Voucher code to apply (case-insensitive) |

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

**UC-10:** Billing & Wallet
**FR-BILL-05:** Billing History

List payment/billing history with pagination.

**Query Parameters:**

| Parameter | Type | Required | Default |
|-----------|------|----------|---------|
| `page` | int | No | 1 |
| `limit` | int | No | 20 |

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

**FR-BILL-05:** Billing History

Get details for a single payment, including invoice line items.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `paymentId` | UUID | Payment ID |

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

**UC-10:** Billing & Wallet
**FR-BILL-06:** Download Invoice PDF
**BR-30:** Invoice Generation

Download the invoice PDF for a payment. Returns the binary PDF file.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `paymentId` | UUID | Payment ID |

**Response (200 OK):** `Content-Type: application/pdf` — binary PDF content with `Content-Disposition: attachment; filename="INV-2026-00042.pdf"`.

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`

---

### GET /api/payment-methods

**Auth:** Bearer token or API key

**UC-10:** Billing & Wallet
**FR-BILL-08:** Payment Methods
**BR-31:** Payment Method Retention

List saved payment methods for the authenticated user. Raw card data is never exposed (BR-31).

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

**UC-10:** Billing & Wallet
**FR-BILL-08:** Payment Methods
**BR-31:** Payment Method Retention

Save a new payment method using a Stripe SetupIntent. The `stripeSetupIntentId` comes from Stripe Elements on the frontend (raw card numbers never touch Astral servers — BR-31, NFR-SEC-10).

**Request Body:**
```json
{
  "stripeSetupIntentId": "seti_1NqXYZAbCdEfGhIjKlMnOp"
}
```

| Field | Type | Required |
|-------|------|----------|
| `stripeSetupIntentId` | string | Yes |

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

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `INTERNAL_ERROR` (Stripe API failure)

---

### DELETE /api/payment-methods/:methodId

**Auth:** Bearer token

**UC-10:** Billing & Wallet
**FR-BILL-08:** Payment Methods

Delete a saved payment method.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `methodId` | UUID | Payment method ID |

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
**FR-BILL-03:** Add Funds

Stripe webhook endpoint. Raw body must be used for signature verification. Handles `payment_intent.succeeded` and `payment_intent.payment_failed` events.

**Request Headers:** `stripe-signature: t=1698391200,v1=...`

**Request Body:** Raw JSON from Stripe (not parsed by Zod — raw buffer passed to `stripe.webhooks.constructEvent`).

**Handled events:**

| Event | Action |
|-------|--------|
| `payment_intent.succeeded` | Mark payment as COMPLETED, credit wallet balance, generate invoice |
| `payment_intent.payment_failed` | Mark payment as FAILED, notify user |

**Response (200 OK):**
```json
{
  "data": {
    "received": true
  }
}
```

**Error Codes:** `UNAUTHORIZED` (invalid signature). Rate limiting is not applied — Stripe webhooks are unlimited.

---

## 11. Endpoints — Vouchers

### POST /api/vouchers/validate

**Auth:** Bearer token

**UC-11:** Voucher Redemption
**FR-VOUCHER-02:** Voucher Validation
**BR-34:** Voucher Validity Window
**BR-35:** Voucher Usage Limit
**BR-36:** Voucher Per-User Limit
**BR-37:** Voucher Minimum Spend

Validate a voucher code without redeeming it. Returns discount details that would be applied.

**Request Body:**
```json
{
  "code": "LAUNCH2026",
  "amount": "50.00"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | string(32) | Yes | Voucher code (case-insensitive) |
| `amount` | decimal(10,2) | Yes | Payment amount for min-spend check (BR-37) |

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

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `NOT_FOUND` (invalid code), `VOUCHER_EXPIRED` (BR-34), `VOUCHER_EXHAUSTED` (BR-35), `VOUCHER_ALREADY_USED` (BR-36), `VOUCHER_MIN_SPEND` (BR-37)

---

### GET /api/vouchers/history

**Auth:** Bearer token

**FR-VOUCHER-07:** Voucher Usage

View the authenticated user's voucher redemption history.

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

## 12. Endpoints — Support Tickets

### GET /api/tickets

**Auth:** Bearer token or API key

**UC-12:** Support Tickets
**FR-TICKET-02:** View All Tickets
**BR-39:** Ticket Ownership

List the authenticated user's support tickets with pagination and filtering.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | int | No | 1 | |
| `limit` | int | No | 20 | |
| `status` | enum | No | — | OPEN, IN_PROGRESS, WAITING_ON_CUSTOMER, RESOLVED, CLOSED |

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

**UC-12:** Support Tickets
**FR-TICKET-03:** View Ticket Messages
**BR-39:** Ticket Ownership

Get a single ticket with all its messages.

**Path Parameters:**

| Parameter | Type | Description |
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

Note: messages with `isInternal: true` are only visible to staff and admin users; customers never see them.

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN` (BR-39)

---

### POST /api/tickets

**Auth:** Bearer token

**UC-12:** Support Tickets
**FR-TICKET-01:** Create Ticket

Create a new support ticket.

**Request Body:**
```json
{
  "subject": "Server not starting",
  "category": "TECHNICAL",
  "message": "My server my-web-server won't start. I'm getting a timeout error."
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `subject` | string(255) | Yes | |
| `category` | enum | Yes | `GENERAL`, `BILLING`, `TECHNICAL`, `ABUSE` |
| `message` | string (text) | Yes | Initial message body |

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

**UC-12:** Support Tickets
**FR-TICKET-03:** Add Message

Add a message to an existing ticket.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `ticketId` | UUID | Ticket ID |

**Request Body:**
```json
{
  "body": "It's in US East on node docker-node-01.",
  "isInternal": false
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `body` | string (text) | Yes | | Message content |
| `isInternal` | boolean | No | false | Internal notes (staff/admin only) |

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

**UC-12:** Support Tickets
**FR-TICKET-05:** Close Ticket
**BR-40:** Ticket Status Lifecycle

Close a ticket. Only the ticket's owner (customer) may close it (BR-40).

**Path Parameters:**

| Parameter | Type | Description |
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

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN` (BR-39, not ticket owner), `INVALID_STATE` (not RESOLVED — BR-40)

---

### POST /api/tickets/:ticketId/reopen

**Auth:** Bearer token or API key

**UC-12:** Support Tickets
**FR-TICKET-06:** Reopen Ticket
**BR-41:** Ticket Reopening

Reopen a closed ticket. Must be within 7 days of closure (BR-41).

**Path Parameters:**

| Parameter | Type | Description |
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

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`, `INVALID_STATE` (not CLOSED, or CLOSED > 7 days — BR-41)

---

## 13. Endpoints — Notifications

### GET /api/notifications

**Auth:** Bearer token or API key

**UC-18:** Notification Center
**FR-NOTIF-03:** Notification History
**FR-NOTIF-01:** In-App Notifications

List notifications for the authenticated user with pagination and filtering.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | int | No | 1 | |
| `limit` | int | No | 20 | |
| `unreadOnly` | boolean | No | false | Show only unread |

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

**UC-18:** Notification Center
**FR-NOTIF-04:** Mark as Read

Mark a single notification as read.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `notificationId` | UUID | Notification ID |

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

**UC-18:** Notification Center
**FR-NOTIF-04:** Mark as Read

Mark all unread notifications as read.

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

**UC-18:** Notification Center
**FR-NOTIF-05:** View Preferences

Get the current notification preferences for the authenticated user.

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

Note: `emailPaymentFailure` is always `true` and cannot be disabled (BR-59, FR-NOTIF-06).

**Error Codes:** `UNAUTHORIZED`

---

### PUT /api/notification-preferences

**Auth:** Bearer token

**UC-18:** Notification Center
**FR-NOTIF-05:** Update Preferences
**BR-59:** Critical Notifications

Update notification preferences. Any attempt to set `emailPaymentFailure` to `false` is silently ignored (BR-59).

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

| Field | Type | Required |
|-------|------|----------|
| `emailServerCreated` | boolean | No |
| `emailServerDeleted` | boolean | No |
| `emailPaymentFailure` | boolean | No (ignored if false — BR-59) |
| `emailTicketUpdates` | boolean | No |
| `emailMarketing` | boolean | No |
| `pushServerCreated` | boolean | No |
| `pushTicketUpdates` | boolean | No |

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

## 14. Endpoints — Referrals

### GET /api/referrals

**Auth:** Bearer token or API key

**UC-17:** Referral Program
**FR-REF-01:** Referral Code
**FR-REF-05:** Referral History
**BR-54:** Referral Code Uniqueness
**BR-55:** Referral Credit

Get the authenticated user's referral code, history, and accumulated credits.

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

Note: `withdrawableCredits` is the amount above the `payoutThreshold` (BR-56). If `accumulatedCredits < payoutThreshold`, `withdrawableCredits` is `"0.00"`.

**Error Codes:** `UNAUTHORIZED`

---

### GET /api/referrals/payouts

**Auth:** Bearer token or API key

**UC-17:** Referral Program
**BR-56:** Referral Payout Threshold

List referral payout history for the authenticated user.

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

## 15. Endpoints — Blog (Public)

### GET /api/blog/posts

**Auth:** None (public)

**UC-16:** Blog Content
**FR-BLOG-01:** View Blog Posts
**FR-BLOG-02:** Filter & Search
**BR-43:** Blog Visibility (PUBLISHED only)

List published blog posts with pagination, search, and filtering.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | int | No | 1 | |
| `limit` | int | No | 12 | |
| `categorySlug` | string(64) | No | — | Filter by category slug |
| `search` | string(255) | No | — | Full-text search in title & body |
| `tag` | string(64) | No | — | Filter by post tag |

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

Note: Only posts with `status: PUBLISHED` are returned (BR-43).

**Error Codes:** `VALIDATION_ERROR` (invalid pagination)

---

### GET /api/blog/posts/:slug

**Auth:** None (public)

**UC-16:** Blog Content
**FR-BLOG-01:** View Blog Post
**BR-43:** Blog Visibility

Get a single published blog post by its slug.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `slug` | string | Blog post slug |

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

**UC-16:** Blog Content
**FR-BLOG-05:** Blog Categories

List all blog categories.

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

## 16. Endpoints — Profile

### PUT /api/profile

**Auth:** Bearer token

**UC-02:** Account Management

Update the authenticated user's profile information.

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

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `username` | string(32) | No | Must be unique if changed (BR-21) |
| `email` | string(255) | No | Must be unique if changed (BR-21); triggers new verification email |
| `billingAddress` | object | No | `{ line1, line2?, city, state, postal, country }` |

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

Change password. Requires current password confirmation.

**Request Body:**
```json
{
  "currentPassword": "OldStr0ng!Pass",
  "newPassword": "NewStr0ng!Pass2"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `currentPassword` | string(128) | Yes | Must match current password |
| `newPassword` | string(128) | Yes | Min 8 chars, 1 uppercase, 1 lowercase, 1 digit (BR-22) |

**Response (200 OK):**
```json
{
  "data": {
    "message": "Password changed successfully."
  }
}
```

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `INVALID_CREDENTIALS` (wrong current password)

---

### POST /api/profile/gdpr/export

**Auth:** Bearer token

**UC-25:** GDPR Data Export
**FR-GDPR-01:** Request Export
**BR-62:** Data Export

Request a machine-readable export of all personal data. Generated asynchronously; download link is emailed (BR-62).

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

**UC-25:** GDPR Account Deletion
**FR-GDPR-02:** Request Deletion
**BR-63:** Account Deletion

Request permanent account deletion. All servers must be deleted first (BR-63). Requires password confirmation.

**Request Body:**
```json
{
  "password": "Str0ng!Pass"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `password` | string | Yes | Current password for confirmation |

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

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `INVALID_CREDENTIALS` (wrong password), `INVALID_STATE` (active servers exist — BR-63)

---

## 17. Endpoints — Reference Data (Public)

### GET /api/plans

**Auth:** Optional (returns public data; authenticated users get region-availability filtering)

**FR-SERVER-01:** Server Plans
**BR-09:** Regional Availability

List available server plans. Results are filtered to active plans only.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `regionId` | UUID | No | Filter plans available in a specific region |

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

Note: `maxServers: null` means unlimited (Enterprise plan — BR-06 exemption).

**Error Codes:** None

---

### GET /api/images

**Auth:** Optional (public data)

**FR-SERVER-01:** Image Templates

List available image templates. Results are filtered to active images only.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `regionId` | UUID | No | Filter images available in a specific region |

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

List available regions.

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

**FR-ANNOUNCE-03:** Active Announcements

List currently active announcements (visible to all users).

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

## 18. Endpoints — Private Networking

### GET /api/networks

**Auth:** Bearer token or API key

List the authenticated user's private networks.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `regionId` | UUID | No | Filter networks in a specific region |

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

Create a new private network in a region.

**Request Body:**
```json
{
  "name": "backend-net",
  "regionId": "8f3a2b1c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
  "cidr": "10.0.0.0/24"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `name` | string(64) | Yes | |
| `regionId` | UUID | Yes | |
| `cidr` | string(18) | Yes | CIDR notation e.g. "10.0.0.0/24" |

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

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `NOT_FOUND` (invalid regionId)

---

### DELETE /api/networks/:networkId

**Auth:** Bearer token

Delete a private network. The network must be empty of servers.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `networkId` | UUID | Network ID |

**Response (200 OK):**
```json
{
  "data": {
    "message": "Network deleted."
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`, `INVALID_STATE` (network not empty)

---

### GET /api/networks/:networkId/servers

**Auth:** Bearer token or API key

List all servers attached to a private network.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `networkId` | UUID | Network ID |

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

Attach a server to a private network. A private IP is auto-assigned from the network's CIDR range.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `networkId` | UUID | Network ID |

**Request Body:**
```json
{
  "serverId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
}
```

| Field | Type | Required |
|-------|------|----------|
| `serverId` | UUID | Yes |

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

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN` (server not owned by user), `INVALID_STATE` (server already attached to this network, or server in different region)

---

### DELETE /api/networks/:networkId/servers/:serverId

**Auth:** Bearer token

Detach a server from a private network. The server's private IP is released.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `networkId` | UUID | Network ID |
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

List the authenticated user's floating IPs.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `regionId` | UUID | No | Filter floating IPs in a specific region |

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

Allocate a new floating IP in a region.

**Request Body:**
```json
{
  "regionId": "8f3a2b1c-4d5e-6f7a-8b9c-0d1e2f3a4b5c"
}
```

| Field | Type | Required |
|-------|------|----------|
| `regionId` | UUID | Yes |

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

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `NOT_FOUND` (invalid regionId)

---

### POST /api/floating-ips/:fipId/assign

**Auth:** Bearer token

Assign a floating IP to a server. The server must be in the same region.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `fipId` | UUID | Floating IP ID |

**Request Body:**
```json
{
  "serverId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
}
```

| Field | Type | Required |
|-------|------|----------|
| `serverId` | UUID | Yes |

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

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`, `INVALID_STATE` (already assigned, or server in different region)

---

### POST /api/floating-ips/:fipId/unassign

**Auth:** Bearer token

Unassign a floating IP from its current server.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `fipId` | UUID | Floating IP ID |

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

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`, `INVALID_STATE` (not assigned)

---

### DELETE /api/floating-ips/:fipId

**Auth:** Bearer token

Release a floating IP back to the pool.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `fipId` | UUID | Floating IP ID |

**Response (200 OK):**
```json
{
  "data": {
    "message": "Floating IP released."
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`, `INVALID_STATE` (currently assigned — must unassign first)

---

## 20. Endpoints — Block Volumes

### GET /api/volumes

**Auth:** Bearer token or API key

List the authenticated user's block volumes.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `regionId` | UUID | No | Filter volumes in a specific region |
| `status` | enum | No | CREATING, AVAILABLE, ATTACHED, RESIZING, ERROR |

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

Get full details for a single block volume.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `volumeId` | UUID | Volume ID |

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

Create a new block volume. Returns `202 Accepted` — volume creation is asynchronous and starts in `CREATING` status.

**Request Body:**
```json
{
  "name": "data-volume-1",
  "regionId": "8f3a2b1c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
  "sizeGB": 100
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `name` | string(64) | Yes | |
| `regionId` | UUID | Yes | |
| `sizeGB` | int | Yes | Minimum 1 GB, incremental in 1 GB units |

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

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `NOT_FOUND` (invalid regionId), `INSUFFICIENT_BALANCE`

---

### POST /api/volumes/:volumeId/attach

**Auth:** Bearer token

Attach a volume to a server. The volume and server must be in the same region.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `volumeId` | UUID | Volume ID |

**Request Body:**
```json
{
  "serverId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "devicePath": "/dev/sdb"
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `serverId` | UUID | Yes | | Server to attach the volume to |
| `devicePath` | string(32) | No | auto-assigned | Device path on the server |

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

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`, `INVALID_STATE` (volume not AVAILABLE, server in different region, server not ACTIVE)

---

### POST /api/volumes/:volumeId/detach

**Auth:** Bearer token

Detach a volume from its server.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `volumeId` | UUID | Volume ID |

**Request Body:**
```json
{
  "force": false
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `force` | boolean | No | false | Force detach even if in use (may cause data loss) |

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

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`, `INVALID_STATE` (volume not ATTACHED)

---

### POST /api/volumes/:volumeId/resize

**Auth:** Bearer token

Resize a volume. Size can only be increased (upward only).

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `volumeId` | UUID | Volume ID |

**Request Body:**
```json
{
  "sizeGB": 200
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `sizeGB` | int | Yes | Must be greater than current size |

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

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`, `INVALID_STATE` (volume in use, or new size <= current size)

---

### DELETE /api/volumes/:volumeId

**Auth:** Bearer token

Delete a volume. The volume must be detached first.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `volumeId` | UUID | Volume ID |

**Response (200 OK):**
```json
{
  "data": {
    "message": "Volume deleted."
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`, `INVALID_STATE` (volume is ATTACHED — must detach first)

---

## 21. Endpoints — Cloud-init

Cloud-init is configured at server creation time via an additional field on `POST /api/servers`. There are no standalone cloud-init endpoints.

**Field addition to `POST /api/servers` request body:**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `cloudInitScript` | string (text) | No | Max 64 KB, nullable. Cloud-init user-data script in YAML or shell format. |

When provided, the cloud-init script is injected into the server at provisioning time and executed on first boot (before the server enters `ACTIVE` status). If omitted, the server boots with the image's default configuration.

**Error Codes:** `VALIDATION_ERROR` (script exceeds 64 KB or contains invalid content)

---

## 22. Endpoints — Webhooks

### GET /api/webhooks

**Auth:** Bearer token or API key

List the authenticated user's webhook endpoints.

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

Create a new webhook endpoint. A signing secret is auto-generated if not provided.

**Request Body:**
```json
{
  "url": "https://myapp.example.com/webhooks/astral",
  "events": ["server.created", "server.deleted", "backup.completed"],
  "secret": null
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `url` | string(512) | Yes | Must be HTTPS |
| `events` | string[] | Yes | Array of event types to subscribe to |
| `secret` | string(128) | No | Webhook signing secret; auto-generated if omitted |

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

Update an existing webhook endpoint.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `webhookId` | UUID | Webhook ID |

**Request Body:**
```json
{
  "url": "https://myapp.example.com/webhooks/astral-v2",
  "events": ["server.created", "server.deleted", "backup.completed", "payment.failed"],
  "isActive": false
}
```

| Field | Type | Required |
|-------|------|----------|
| `url` | string(512) | No |
| `events` | string[] | No |
| `isActive` | boolean | No |

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

Delete a webhook endpoint.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `webhookId` | UUID | Webhook ID |

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

View delivery history for a webhook endpoint.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `webhookId` | UUID | Webhook ID |

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | int | No | 1 | |
| `limit` | int | No | 20 | |
| `status` | enum | No | — | PENDING, SUCCESS, FAILED |

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

Get bandwidth usage data for a server over a date range.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `serverId` | UUID | Server instance ID |

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `startDate` | datetime | Yes | | ISO 8601, start of range |
| `endDate` | datetime | Yes | | ISO 8601, end of range |
| `granularity` | enum | Yes | daily | `hourly` or `daily` |

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

**Error Codes:** `UNAUTHORIZED`, `NOT_FOUND`, `FORBIDDEN`, `VALIDATION_ERROR` (invalid date range)

---

### GET /api/servers/:serverId/bandwidth/summary

**Auth:** Bearer token or API key

Get current month bandwidth summary including allowance, usage, and overage estimate.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `serverId` | UUID | Server instance ID |

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

## 24. Endpoints — Spending Cap

### GET /api/profile/spending-cap

**Auth:** Bearer token or API key

View the current spending cap for the authenticated user.

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

Note: `amount` is `null` when no cap is set (unlimited spending).

**Error Codes:** `UNAUTHORIZED`

---

### PUT /api/profile/spending-cap

**Auth:** Bearer token

Set or update the spending cap. Set `amount` to `null` to remove the cap entirely.

**Request Body:**
```json
{
  "amount": "100.00"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `amount` | decimal(10,2) | No | Null = no cap (unlimited). Minimum 1.00 if set. |

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

## 25. Endpoints — Abuse Reports

### POST /api/abuse-reports

**Auth:** Optional (public; no auth required for anonymous reports)

Submit an abuse report. Authenticated users' reports are linked to their account.

**Request Body:**
```json
{
  "serverId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "type": "SPAM",
  "description": "This server is sending unsolicited commercial email from IP 203.0.113.10.",
  "evidence": "Email headers and sample attached: https://example.com/evidence/abuse-001.txt"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `serverId` | UUID | No | The offending server, if known |
| `type` | enum | Yes | SPAM, PHISHING, MALWARE, DDoS, COPYRIGHT, HARASSMENT, OTHER |
| `description` | string (text) | Yes | Detailed description of the abuse |
| `evidence` | string(2048) | No | URL or text reference to supporting evidence |

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

**Auth:** Bearer token (ADMIN only)

List all abuse reports with filtering and pagination.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | int | No | 1 | |
| `limit` | int | No | 20 | |
| `status` | enum | No | — | PENDING_REVIEW, INVESTIGATING, RESOLVED, DISMISSED |
| `type` | enum | No | — | SPAM, PHISHING, MALWARE, DDoS, COPYRIGHT, HARASSMENT, OTHER |

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

Note: `reportedBy` is `null` for anonymous reports.

**Error Codes:** `UNAUTHORIZED`, `FORBIDDEN`

---

### PUT /api/admin/abuse-reports/:reportId

**Auth:** Bearer token (ADMIN only)

Update an abuse report (status, resolution notes).

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `reportId` | UUID | Report ID |

**Request Body:**
```json
{
  "status": "RESOLVED",
  "resolution": "Server terminated. User notified. IP blacklisted."
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `status` | enum | No | PENDING_REVIEW, INVESTIGATING, RESOLVED, DISMISSED |
| `resolution` | string(2048) | No | Notes on how the report was resolved |

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

**Auth:** Bearer token (ADMIN only)

Suspend the server associated with an abuse report. Server is immediately stopped and the owner is notified.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `reportId` | UUID | Report ID |

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

**Error Codes:** `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `INVALID_STATE` (no server associated with report, or server already suspended)

---

## 26. Endpoints — Terms & Compliance

### GET /api/terms

**Auth:** Optional (public)

Get the current (or specified) terms of service or privacy policy.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `type` | enum | Yes | | TOS, PRIVACY_POLICY |
| `version` | string(16) | No | latest | Specific version; returns current if omitted |

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

**Error Codes:** `VALIDATION_ERROR` (invalid type), `NOT_FOUND` (version not found)

---

### POST /api/terms/accept

**Auth:** Bearer token

Record the user's acceptance of terms or privacy policy.

**Request Body:**
```json
{
  "type": "TOS",
  "version": "2.1"
}
```

| Field | Type | Required |
|-------|------|----------|
| `type` | enum | Yes | TOS, PRIVACY_POLICY |
| `version` | string(16) | Yes | The version being accepted |

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

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `NOT_FOUND` (invalid version)

---

### GET /api/profile/terms-acceptance

**Auth:** Bearer token or API key

View the authenticated user's terms acceptance history.

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

Record cookie consent preferences. Used for GDPR/CCPA compliance.

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

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `preferences` | object | Yes | JSON object mapping cookie categories to boolean consent |
| `sessionId` | string(64) | No | Anonymous session identifier; not required for authenticated users |

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

**Auth:** Bearer token (ADMIN only)

List all feature flags with their current state and rules.

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

**Auth:** Bearer token (ADMIN only)

Create a new feature flag.

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

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `key` | string(64) | Yes | Must be unique |
| `description` | string(255) | Yes | |
| `enabled` | boolean | No (default: false) | |
| `rules` | object | No | JSON rules for targeted rollout (e.g. user IDs, region, percentage) |

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

**Auth:** Bearer token (ADMIN only)

Update a feature flag.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `flagId` | UUID | Flag ID |

**Request Body:**
```json
{
  "enabled": true,
  "rules": {
    "rolloutPercentage": 100
  }
}
```

| Field | Type | Required |
|-------|------|----------|
| `enabled` | boolean | No |
| `rules` | object | No |

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

**Auth:** Bearer token (ADMIN only)

Delete a feature flag.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `flagId` | UUID | Flag ID |

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

## 28. Endpoints — Admin: Impersonation

### POST /api/admin/impersonate

**Auth:** Bearer token (ADMIN only)

Begin impersonating a target user. An audit log entry records both the admin and target user.

**Request Body:**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440001"
}
```

| Field | Type | Required |
|-------|------|----------|
| `userId` | UUID | Yes |

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

The returned access token is scoped to the target user. The original admin session is preserved for the stop endpoint.

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`

---

### POST /api/admin/impersonate/stop

**Auth:** Bearer token (admin's original token from the impersonation session)

End an impersonation session and return to the admin's own session.

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

**Error Codes:** `UNAUTHORIZED`, `INVALID_STATE` (not currently impersonating)

---

## 29. Endpoints — Admin: Revenue

### GET /api/admin/revenue/summary

**Auth:** Bearer token (ADMIN only)

Get current revenue metrics: MRR, churn rate, active subscribers, ARPU.

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

**Auth:** Bearer token (ADMIN only)

Get revenue breakdown by plan, region, and billing model over a date range.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `startDate` | datetime | Yes | | ISO 8601 |
| `endDate` | datetime | Yes | | ISO 8601 |

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

**Error Codes:** `UNAUTHORIZED`, `FORBIDDEN`, `VALIDATION_ERROR` (invalid date range)

---

### GET /api/admin/revenue/vouchers

**Auth:** Bearer token (ADMIN only)

Get voucher redemption statistics.

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

Returns the OpenAPI 3.1 specification for the Astral Cloud API, auto-generated from Zod schemas used in server-side validation.

**Response (200 OK):** `Content-Type: application/yaml` — the full OpenAPI 3.1 spec in YAML format.

**Error Codes:** None

**Note:** The official Astral CLI, Terraform provider, and third-party SDKs all consume these same API endpoints documented in this specification. The OpenAPI spec serves as the single source of truth for both server-side validation and client generation.

---

## 31. Endpoints — Status Page (Public)

### GET /api/status

**Auth:** None (public)

Get the current platform status including component statuses and any active incidents.

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

Component status values: `OPERATIONAL`, `DEGRADED_PERFORMANCE`, `PARTIAL_OUTAGE`, `MAJOR_OUTAGE`, `UNDER_MAINTENANCE`.

**Error Codes:** None

---

### GET /api/status/incidents

**Auth:** None (public)

Get recent incident history for the platform.

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

All admin endpoints require ADMIN role. Staff users cannot access admin-only resources.

### GET /api/admin/users

**Auth:** Bearer token (ADMIN only)

**UC-24:** User Management
**FR-ADMIN-06:** View All Users

List all users with filtering and pagination.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | int | No | 1 | |
| `limit` | int | No | 20 | |
| `search` | string(64) | No | — | Search by username or email |
| `role` | enum | No | — | CUSTOMER, STAFF, ADMIN |
| `status` | enum | No | — | ACTIVE, LOCKED, PENDING_VERIFICATION, SUSPENDED |

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

**Auth:** Bearer token (ADMIN only)

**UC-24:** User Management
**BR-20:** Admin Action Audit

Update user properties (role, status, tax exemption). Generates an audit log entry (BR-20).

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `userId` | UUID | User ID |

**Request Body:**
```json
{
  "role": "STAFF",
  "status": "ACTIVE",
  "taxExempt": false
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `role` | enum | No | CUSTOMER, STAFF, ADMIN |
| `status` | enum | No | ACTIVE, LOCKED, SUSPENDED |
| `taxExempt` | boolean | No | BR-61 |

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

**Auth:** Bearer token (ADMIN only)

**UC-20:** Plan Management
**FR-ADMIN-01:** Manage Plans

List all server plans, including inactive ones.

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

**Auth:** Bearer token (ADMIN only)

**UC-20:** Plan Management
**FR-ADMIN-01:** Manage Plans
**BR-20:** Admin Action Audit

Create a new server plan.

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

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `name` | string(64) | Yes | |
| `slug` | string(32) | Yes | Must be unique |
| `vcpu` | int | Yes | >= 1 |
| `ramMB` | int | Yes | >= 256 |
| `diskGB` | int | Yes | >= 5 |
| `bandwidthMbps` | int | Yes | >= 10 |
| `priceMonthly` | decimal(10,2) | Yes | |
| `priceHourly` | decimal(10,2) | Yes | |
| `maxServers` | int | No | Null = unlimited |
| `regionIds` | UUID[] | Yes | Regions this plan is available in |

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

**Auth:** Bearer token (ADMIN only)

**UC-20:** Plan Management
**FR-ADMIN-01:** Manage Plans
**BR-20:** Admin Action Audit

Update an existing server plan.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `planId` | UUID | Plan ID |

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

| Field | Type | Required |
|-------|------|----------|
| `name` | string(64) | No |
| `slug` | string(32) | No |
| `vcpu` | int | No |
| `ramMB` | int | No |
| `diskGB` | int | No |
| `bandwidthMbps` | int | No |
| `priceMonthly` | decimal(10,2) | No |
| `priceHourly` | decimal(10,2) | No |
| `maxServers` | int | No |
| `isActive` | boolean | No |
| `regionIds` | UUID[] | No |

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

**Auth:** Bearer token (ADMIN only)

**UC-20:** Plan Management
**FR-ADMIN-01:** Manage Plans (deactivate)
**BR-20:** Admin Action Audit

Deactivate a server plan (soft-delete). Existing servers on this plan continue to run unmodified.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `planId` | UUID | Plan ID |

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

**Auth:** Bearer token (ADMIN only)

**UC-20:** Image Management
**FR-ADMIN-02:** Manage Images

List all image templates, including inactive ones.

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

**Auth:** Bearer token (ADMIN only)

**UC-20:** Image Management
**FR-ADMIN-02:** Manage Images
**BR-20:** Admin Action Audit

Create a new image template.

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

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `name` | string(128) | Yes | |
| `slug` | string(64) | Yes | Must be unique |
| `osType` | enum | Yes | LINUX |
| `version` | string(32) | Yes | |
| `dockerImage` | string(255) | Yes | Valid container registry reference |
| `diskSizeGB` | int | Yes | |
| `defaultUser` | string(32) | Yes | |
| `regionIds` | UUID[] | Yes | Regions this image is available in |

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

**Auth:** Bearer token (ADMIN only)

**UC-20:** Image Management
**FR-ADMIN-02:** Manage Images
**BR-20:** Admin Action Audit

Update an existing image template.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `imageId` | UUID | Image ID |

**Request Body:**
```json
{
  "name": "Fedora 40 (Updated)",
  "dockerImage": "registry.astral.cloud/fedora:40.1"
}
```

| Field | Type | Required |
|-------|------|----------|
| `name` | string(128) | No |
| `slug` | string(64) | No |
| `osType` | enum | No |
| `version` | string(32) | No |
| `dockerImage` | string(255) | No |
| `diskSizeGB` | int | No |
| `defaultUser` | string(32) | No |
| `isActive` | boolean | No |
| `regionIds` | UUID[] | No |

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

**Auth:** Bearer token (ADMIN only)

**UC-20:** Image Management
**FR-ADMIN-02:** Manage Images (deactivate)
**BR-20:** Admin Action Audit

Deactivate an image template. Existing servers using this image continue to run unmodified.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `imageId` | UUID | Image ID |

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

**Auth:** Bearer token (ADMIN only)

**UC-20:** Node Management
**FR-ADMIN-03:** Manage Nodes
**BR-68:** Node Status
**BR-69:** Node Draining

List all physical nodes (Docker hosts) with their resource allocation.

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

**Auth:** Bearer token (ADMIN only)

**UC-20:** Node Management
**FR-ADMIN-03:** Manage Nodes
**BR-20:** Admin Action Audit

Add a new physical node to a region.

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

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `name` | string(64) | Yes | |
| `regionId` | UUID | Yes | |
| `dockerEndpoint` | string(255) | Yes | Docker daemon URL |
| `totalVcpu` | int | Yes | >= 1 |
| `totalRamMB` | int | Yes | >= 1024 |
| `totalDiskGB` | int | Yes | >= 10 |

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

**Auth:** Bearer token (ADMIN only)

**UC-20:** Node Management
**FR-ADMIN-03:** Manage Nodes
**BR-68:** Node Status
**BR-69:** Node Draining
**BR-20:** Admin Action Audit

Update a node's properties, including status changes (ONLINE, OFFLINE, MAINTENANCE).

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `nodeId` | UUID | Node ID |

**Request Body:**
```json
{
  "name": "docker-node-03-renamed",
  "status": "MAINTENANCE"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `name` | string(64) | No | |
| `dockerEndpoint` | string(255) | No | |
| `status` | enum | No | ONLINE, OFFLINE, MAINTENANCE |
| `totalVcpu` | int | No | |
| `totalRamMB` | int | No | |
| `totalDiskGB` | int | No | |

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

Note: Setting status to MAINTENANCE triggers node draining (BR-69) — no new servers are deployed, existing servers continue running.

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`

---

### GET /api/admin/regions

**Auth:** Bearer token (ADMIN only)

**UC-20:** Region Management
**FR-ADMIN-04:** Manage Regions

List all regions.

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

**Auth:** Bearer token (ADMIN only)

**UC-20:** Region Management
**FR-ADMIN-04:** Manage Regions
**BR-20:** Admin Action Audit

Create a new region.

**Request Body:**
```json
{
  "name": "Asia Pacific",
  "slug": "ap-southeast"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `name` | string(64) | Yes | |
| `slug` | string(16) | Yes | Must be unique |

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

**Auth:** Bearer token (ADMIN only)

**UC-20:** Region Management
**FR-ADMIN-04:** Manage Regions
**BR-20:** Admin Action Audit

Update a region.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `regionId` | UUID | Region ID |

**Request Body:**
```json
{
  "name": "Asia Pacific (Singapore)",
  "isActive": true
}
```

| Field | Type | Required |
|-------|------|----------|
| `name` | string(64) | No |
| `slug` | string(16) | No |
| `isActive` | boolean | No |

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

**Auth:** Bearer token (ADMIN only)

**UC-24:** Audit Logging
**FR-AUDIT-04:** View & Filter Audit Logs
**BR-19:** State-Change Audit
**BR-20:** Admin Action Audit

List audit log entries with filtering and pagination.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | int | No | 1 | |
| `limit` | int | No | 50 | |
| `userId` | UUID | No | — | Filter by actor |
| `action` | enum | No | — | SERVER_CREATED, SERVER_STARTED, SERVER_STOPPED, SERVER_RESTARTED, SERVER_DELETED, ADMIN_ACTION, etc. |
| `targetType` | string(32) | No | — | e.g. "ServerInstance", "User", "ServerPlan" |
| `startDate` | datetime | No | — | ISO 8601 |
| `endDate` | datetime | No | — | ISO 8601 |

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

Note: GDPR-anonymized entries have `userId` and `ipAddress` truncated (BR-63).

**Error Codes:** `UNAUTHORIZED`, `FORBIDDEN`

---

### GET /api/admin/vouchers

**Auth:** Bearer token (ADMIN or STAFF)

**UC-21:** Voucher Management
**FR-VOUCHER-06:** Create Vouchers
**FR-VOUCHER-07:** View Voucher Stats

List all vouchers.

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

**Auth:** Bearer token (ADMIN or STAFF)

**UC-21:** Voucher Management
**FR-VOUCHER-06:** Create Vouchers
**BR-33:** Voucher Uniqueness
**BR-20:** Admin Action Audit

Create a new voucher code.

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

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `code` | string(32) | Yes | Must be unique, case-insensitive (BR-33) |
| `description` | string(255) | Yes | |
| `discountType` | enum | Yes | PERCENTAGE, FIXED_AMOUNT |
| `discountValue` | decimal(10,2) | Yes | e.g. 25.00 = 25% or $25.00 |
| `maxUses` | int | No | Null = unlimited (BR-35) |
| `maxUsesPerUser` | int | No (default: 1) | BR-36 |
| `minSpend` | decimal(10,2) | No | BR-37 |
| `validFrom` | datetime | No | BR-34 |
| `validUntil` | datetime | No | BR-34 |

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

**Auth:** Bearer token (ADMIN or STAFF)

**UC-21:** Voucher Management
**FR-VOUCHER-08:** Deactivate Voucher
**BR-20:** Admin Action Audit

Update a voucher (e.g. deactivate, extend validity).

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `voucherId` | UUID | Voucher ID |

**Request Body:**
```json
{
  "isActive": false
}
```

| Field | Type | Required |
|-------|------|----------|
| `code` | string(32) | No |
| `description` | string(255) | No |
| `discountType` | enum | No |
| `discountValue` | decimal(10,2) | No |
| `maxUses` | int | No |
| `maxUsesPerUser` | int | No |
| `minSpend` | decimal(10,2) | No |
| `validFrom` | datetime | No |
| `validUntil` | datetime | No |
| `isActive` | boolean | No |

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

**Auth:** Bearer token (ADMIN only)

**UC-24:** Tax Configuration
**FR-ADMIN-09:** Configure Tax Rates
**BR-60:** Tax by Billing Region

List all tax rates.

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

**Auth:** Bearer token (ADMIN only)

**UC-24:** Tax Configuration
**FR-ADMIN-09:** Configure Tax Rates
**BR-20:** Admin Action Audit

Create a new tax rate for a region.

**Request Body:**
```json
{
  "regionId": "b2c3d4e5-f678-90ab-cdef-1234567890ab",
  "name": "EU VAT",
  "rate": "21.00"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `regionId` | UUID | Yes | Must not already have a tax rate |
| `name` | string(64) | Yes | |
| `rate` | decimal(5,2) | Yes | Percentage, e.g. 21.00 = 21% |

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

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `INVALID_STATE` (region already has a tax rate)

---

### PUT /api/admin/tax-rates/:taxRateId

**Auth:** Bearer token (ADMIN only)

**UC-24:** Tax Configuration
**FR-ADMIN-09:** Configure Tax Rates
**BR-20:** Admin Action Audit

Update a tax rate.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `taxRateId` | UUID | Tax rate ID |

**Request Body:**
```json
{
  "rate": "20.00"
}
```

| Field | Type | Required |
|-------|------|----------|
| `name` | string(64) | No |
| `rate` | decimal(5,2) | No |
| `isActive` | boolean | No |

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

**Auth:** Bearer token (ADMIN only)

**UC-24:** Email Templates
**FR-ADMIN-10:** Manage Email Templates

List all email templates.

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

**Auth:** Bearer token (ADMIN only)

**UC-24:** Email Templates
**FR-ADMIN-10:** Manage Email Templates
**BR-20:** Admin Action Audit

Update an email template's subject, body, or active status. Template variables can be referenced with `{{variableName}}` syntax.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `templateId` | UUID | Template ID |

**Request Body:**
```json
{
  "subject": "Your server {{serverHostname}} has been deployed!",
  "htmlBody": "<h1>Server Ready</h1><p>Your server <strong>{{serverHostname}}</strong> ({{serverIp}}) is now active.</p><p>Plan: {{serverPlan}}</p><p>Region: {{regionName}}</p>",
  "textBody": "Server Ready\n\nYour server {{serverHostname}} ({{serverIp}}) is now active.\nPlan: {{serverPlan}}\nRegion: {{regionName}}",
  "isActive": true
}
```

| Field | Type | Required |
|-------|------|----------|
| `subject` | string(255) | No |
| `htmlBody` | string (text) | No |
| `textBody` | string (text) | No |
| `isActive` | boolean | No |

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

**Auth:** Bearer token (ADMIN only)

**UC-24:** System Settings
**FR-ADMIN-11:** Manage Settings
**BR-66:** System Setting Validation
**BR-67:** Immutable Settings

List all system settings.

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

Note: Immutable settings (BR-67) can only be changed via environment variables, not through the API/UI.

**Error Codes:** `UNAUTHORIZED`, `FORBIDDEN`

---

### PUT /api/admin/settings/:settingId

**Auth:** Bearer token (ADMIN only)

**UC-24:** System Settings
**FR-ADMIN-11:** Manage Settings
**BR-66:** System Setting Validation
**BR-67:** Immutable Settings
**BR-20:** Admin Action Audit

Update a system setting. Immutable settings (BR-67) are rejected with `FORBIDDEN`. Values are validated against the setting's type (BR-66).

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `settingId` | UUID | Setting ID |

**Request Body:**
```json
{
  "value": "Astral Cloud Platform"
}
```

| Field | Type | Required |
|-------|------|----------|
| `value` | string | Yes | Must match setting type (STRING, NUMBER, BOOLEAN, JSON — BR-66) |

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

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN` (immutable setting — BR-67), `NOT_FOUND`

---

### GET /api/admin/announcements

**Auth:** Bearer token (ADMIN only)

**UC-24:** Announcements
**FR-ANNOUNCE-01:** Create Announcements

List all announcements, including inactive and scheduled ones.

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

**Auth:** Bearer token (ADMIN only)

**UC-24:** Announcements
**FR-ANNOUNCE-01:** Create Announcements
**FR-ANNOUNCE-02:** Severity Levels
**FR-ANNOUNCE-04:** Scheduling

Create a new platform announcement.

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

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `title` | string(128) | Yes | |
| `body` | string (text) | Yes | Markdown content |
| `severity` | enum | No (default: INFO) | INFO, WARNING, CRITICAL |
| `startsAt` | datetime | No | Scheduled display start |
| `endsAt` | datetime | No | Scheduled display end |

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

**Auth:** Bearer token (ADMIN only)

**UC-24:** Announcements

Update an existing announcement.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `announcementId` | UUID | Announcement ID |

**Request Body:**
```json
{
  "isActive": false
}
```

| Field | Type | Required |
|-------|------|----------|
| `title` | string(128) | No |
| `body` | string (text) | No |
| `severity` | enum | No |
| `isActive` | boolean | No |
| `startsAt` | datetime | No |
| `endsAt` | datetime | No |

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

**Auth:** Bearer token (ADMIN only)

**UC-24:** Announcements

Permanently delete an announcement.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `announcementId` | UUID | Announcement ID |

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

**Auth:** Bearer token (ADMIN only)

**UC-25:** GDPR Management
**FR-ADMIN-07:** Process GDPR Requests
**BR-62:** Data Export
**BR-63:** Account Deletion

List all GDPR requests with filtering and pagination.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | int | No | 1 | |
| `limit` | int | No | 20 | |
| `status` | enum | No | — | PENDING, PROCESSING, COMPLETED, FAILED |

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

**Auth:** Bearer token (ADMIN only)

**UC-25:** GDPR Management
**FR-ADMIN-07:** Process GDPR Requests
**BR-62:** Data Export
**BR-63:** Account Deletion
**BR-20:** Admin Action Audit

Process a GDPR request. For EXPORT: generate the data archive and make it available for download. For DELETE: initiate the account deletion workflow.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `requestId` | UUID | GDPR request ID |

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

**Error Codes:** `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `INVALID_STATE` (request not PENDING)

---

### GET /api/admin/queues

**Auth:** Bearer token (ADMIN only)

**UC-24:** Queue Monitoring
**FR-ADMIN-08:** View Queue Status

Get BullMQ queue status including job counts and dead-letter queue information.

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

**Auth:** Bearer token (ADMIN or STAFF)

**UC-23:** Blog Management
**FR-BLOG-03:** Create/Edit Posts
**BR-43:** Blog Visibility

List all blog posts, including DRAFT and ARCHIVED.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | int | No | 1 | |
| `limit` | int | No | 20 | |
| `status` | enum | No | — | DRAFT, PUBLISHED, ARCHIVED |
| `categorySlug` | string(64) | No | — | |
| `search` | string(255) | No | — | |

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

**Auth:** Bearer token (ADMIN or STAFF)

**UC-23:** Blog Management
**FR-BLOG-03:** Create Posts
**BR-44:** Blog Slug Uniqueness
**BR-45:** Blog Author Attribution

Create a new blog post.

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

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `title` | string(255) | Yes | |
| `slug` | string(255) | Yes | Must be unique (BR-44) |
| `categoryId` | UUID | Yes | |
| `excerpt` | string(500) | No | Summary for cards |
| `body` | string (text) | Yes | Markdown content |
| `coverImageUrl` | string(512) | No | |
| `tags` | string[] | No | Array of tag strings |
| `status` | enum | No (default: DRAFT) | DRAFT, PUBLISHED, ARCHIVED |

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

Note: Setting status to PUBLISHED automatically sets `publishedAt`. Author is set to the authenticated user (must be STAFF or ADMIN — BR-45).

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`

---

### PUT /api/admin/blog/posts/:postId

**Auth:** Bearer token (ADMIN or STAFF)

**UC-23:** Blog Management
**FR-BLOG-03:** Edit Posts
**BR-43:** Blog Visibility
**BR-44:** Blog Slug Uniqueness

Update an existing blog post.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `postId` | UUID | Blog post ID |

**Request Body:**
```json
{
  "title": "Getting Started with Docker on Astral Cloud",
  "status": "ARCHIVED"
}
```

| Field | Type | Required |
|-------|------|----------|
| `title` | string(255) | No |
| `slug` | string(255) | No |
| `categoryId` | UUID | No |
| `excerpt` | string(500) | No |
| `body` | string (text) | No |
| `coverImageUrl` | string(512) | No |
| `tags` | string[] | No |
| `status` | enum | No |

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

Note: Changing status from DRAFT to PUBLISHED sets `publishedAt` if not already set. ARCHIVED posts are hidden from listings but accessible by direct URL (BR-43).

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`

---

### DELETE /api/admin/blog/posts/:postId

**Auth:** Bearer token (ADMIN only)

**UC-23:** Blog Management

Permanently delete a blog post.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `postId` | UUID | Blog post ID |

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

**Auth:** Bearer token (ADMIN or STAFF)

**UC-23:** Blog Management
**FR-BLOG-05:** Blog Categories

List all blog categories.

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

**Auth:** Bearer token (ADMIN or STAFF)

**UC-23:** Blog Management
**FR-BLOG-05:** Blog Categories

Create a new blog category.

**Request Body:**
```json
{
  "name": "Case Studies",
  "slug": "case-studies",
  "description": "Customer success stories and case studies"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `name` | string(64) | Yes | |
| `slug` | string(64) | Yes | Must be unique |
| `description` | string(255) | No | |

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

**Auth:** Bearer token (ADMIN or STAFF)

**UC-23:** Blog Management
**FR-BLOG-05:** Blog Categories

Update an existing blog category.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `categoryId` | UUID | Category ID |

**Request Body:**
```json
{
  "name": "Customer Stories",
  "description": "In-depth customer stories and case studies"
}
```

| Field | Type | Required |
|-------|------|----------|
| `name` | string(64) | No |
| `slug` | string(64) | No |
| `description` | string(255) | No |

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

**Auth:** Bearer token (ADMIN only)

**UC-23:** Blog Management

Delete a blog category. Posts in this category must be reassigned first.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `categoryId` | UUID | Category ID |

**Response (200 OK):**
```json
{
  "data": {
    "message": "Blog category deleted."
  }
}
```

**Error Codes:** `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `INVALID_STATE` (category has posts)

---

## 33. Endpoints — Staff

Staff endpoints require STAFF or ADMIN role.

### GET /api/staff/tickets

**Auth:** Bearer token (STAFF or ADMIN)

**UC-22:** Staff Ticket Management
**FR-TICKET-10:** Filter & Search Tickets
**FR-TICKET-08:** Assign Tickets

List all support tickets with advanced filtering.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | int | No | 1 | |
| `limit` | int | No | 20 | |
| `status` | enum | No | — | OPEN, IN_PROGRESS, WAITING_ON_CUSTOMER, RESOLVED, CLOSED |
| `priority` | enum | No | — | LOW, NORMAL, HIGH, URGENT |
| `assignee` | UUID | No | — | Filter by assigned staff user ID (use "unassigned" for null) |

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

**Auth:** Bearer token (STAFF or ADMIN)

**UC-22:** Staff Ticket Management
**FR-TICKET-04:** Change Ticket Status
**FR-TICKET-08:** Assign Tickets
**BR-40:** Ticket Status Lifecycle

Update ticket properties: status, assigned staff user, or priority.

**Path Parameters:**

| Parameter | Type | Description |
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

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `status` | enum | No | OPEN, IN_PROGRESS, WAITING_ON_CUSTOMER, RESOLVED (CLOSED only by customer — BR-40) |
| `assignedUserId` | UUID | No | Staff user ID; null to unassign |
| `priority` | enum | No | LOW, NORMAL, HIGH, URGENT |

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

Note: Setting status to RESOLVED automatically sets `resolvedAt`. RESOLVED tickets without customer response for 72 hours are automatically CLOSED (BR-42).

**Error Codes:** `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `INVALID_STATE` (invalid status transition — BR-40)

---

### POST /api/staff/tickets/:ticketId/messages

**Auth:** Bearer token (STAFF or ADMIN)

**UC-22:** Staff Ticket Management
**FR-TICKET-03:** Add Messages
**FR-TICKET-09:** Internal Notes

Add a message to a ticket as a staff member. Supports internal notes not visible to the customer.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `ticketId` | UUID | Ticket ID |

**Request Body:**
```json
{
  "body": "Checked the node logs — there was a resource contention issue. I've restarted the Docker daemon on docker-node-01 and your server should be starting now.",
  "isInternal": false
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `body` | string (text) | Yes | | Message content |
| `isInternal` | boolean | No | false | Set to true for staff-only notes (FR-TICKET-09) |

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

## 34. Rate Limiting

| Scope | Limit | Window | Applies To |
|-------|-------|--------|------------|
| Auth endpoints | 10 requests | per minute, per IP | `/api/auth/register`, `/api/auth/login`, `/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/auth/verify-email` |
| General user | 60 requests | per minute, per user (by token/key) | All authenticated endpoints not otherwise specified |
| Server create | 5 requests | per minute, per user | `POST /api/servers` |
| Stripe webhook | Unlimited | n/a | `POST /api/stripe/webhook` |

Rate limit headers are returned on every response:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests allowed in the window |
| `X-RateLimit-Remaining` | Remaining requests in the current window |
| `X-RateLimit-Reset` | Unix timestamp when the window resets |

When rate limited, the server responds with `429 Too Many Requests` and a `Retry-After` header indicating seconds to wait.

---

## 35. Standard Headers

### Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Conditional | `Bearer <accessToken>` or `Bearer <apiKey>` for authenticated endpoints |
| `Content-Type` | Yes (for POST/PUT/PATCH) | Must be `application/json` |
| `Accept` | Recommended | Should be `application/json` |
| `Idempotency-Key` | Optional | UUID v4 for `POST /api/servers`; ensures exactly-once semantics. Replayed within 24h returns the original response. |
| `User-Agent` | Optional | Tracked in session records |
| `X-Forwarded-For` | Optional | Real client IP when behind a proxy |

### Response Headers

| Header | Description |
|--------|-------------|
| `X-Request-Id` | Unique UUID v4 for every request (propagated through logs) |
| `X-RateLimit-Limit` | Rate limit ceiling for the current window |
| `X-RateLimit-Remaining` | Requests left in the current window |
| `X-RateLimit-Reset` | Unix timestamp when the window resets |
| `Retry-After` | Seconds to wait before retrying (sent with 429 responses) |
| `Set-Cookie` | `refresh_token` cookie set on login and refresh; cleared on logout |

---

## 36. Webhooks

### Stripe Webhook

| Attribute | Value |
|-----------|-------|
| URL | `POST /api/stripe/webhook` |
| Auth | Stripe signature header (`stripe-signature`) |
| Content-Type | `application/json` (raw body preserved for signature verification) |
| Rate Limit | None (unlimited) |

**Subscribed events:**

| Event | Handler |
|-------|---------|
| `payment_intent.succeeded` | Update payment record status to COMPLETED, credit wallet balance, generate invoice PDF, send confirmation email |
| `payment_intent.payment_failed` | Update payment record status to FAILED, send failure notification to user |

**Verification:** Each request is verified using `stripe.webhooks.constructEvent(rawBody, stripeSignature, webhookSecret)`. Requests with invalid signatures return 401.

**Idempotency:** Stripe webhooks may be delivered more than once. Handlers are idempotent — checking `stripePaymentId` before processing.

---

## Appendix A: UUID Conventions

All entity IDs are UUID v4. Example format: `550e8400-e29b-41d4-a716-446655440001`

In request/response examples throughout this document, the following recurring UUIDs are used consistently:

| Entity | Example UUID |
|--------|-------------|
| User (jane_doe) | `550e8400-e29b-41d4-a716-446655440001` |
| Server (my-web-server) | `6ba7b810-9dad-11d1-80b4-00c04fd430c8` |
| Starter Plan | `b1e4f7a2-c3d5-4890-9f1e-2a3b4c5d6e7f` |
| Ubuntu 24.04 Image | `f47ac10b-58cc-4372-a567-0e02b2c3d479` |
| US East Region | `8f3a2b1c-4d5e-6f7a-8b9c-0d1e2f3a4b5c` |
| Node docker-node-01 | `d2c3b4a5-e6f7-8901-abcd-ef2345678901` |
| Admin (admin_root) | `7e6f5a4b-3c2d-1e0f-9a8b-7c6d5e4f3a2b` |

---

## Appendix B: Timestamp Conventions

All timestamps are ISO 8601 with millisecond precision in UTC:

```
2026-06-27T14:30:00.000Z
```

Financial amounts use string representation (`"42.50"`) to avoid floating-point precision issues.

---

## Appendix C: Role-Based Access Matrix

| Role | Endpoint Scope |
|------|---------------|
| Public (unauthenticated) | Auth (register, login, forgot/reset password, verify email), Reference data (plans, images, regions, announcements), Blog (public), Stripe webhook |
| CUSTOMER (default) | Profile, Servers, Tags, Firewall, DNS, Backups, Wallet & Billing, Vouchers, Support Tickets, Notifications, Referrals, API Keys |
| STAFF (in addition to CUSTOMER) | Staff ticket management, Blog management (create/edit posts & categories) |
| ADMIN (in addition to STAFF) | User management, Plan/Image/Node/Region management, Audit logs, Voucher management, Tax rates, Email templates, System settings, Announcements management, GDPR requests, Queue monitoring, Blog post deletion |

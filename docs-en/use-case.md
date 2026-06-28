# Use Cases

---

# UC-01: Create Server

| Attribute                 | Value                                                                                                                    |
|---------------------------|--------------------------------------------------------------------------------------------------------------------------|
| UC ID                     | UC-01                                                                                                                    |
| UC Name                   | Create Server                                                                                                            |
| Actor(s)                  | Customer (authenticated)                                                                                                 |
| Priority                  | High                                                                                                                     |
| Trigger                   | Customer clicks "Create Server" on the dashboard                                                                         |
| Pre-conditions            | Customer is logged in (valid JWT). Account is not locked or overdue.                                                     |
| Post-conditions (success) | Server record saved (status = `ACTIVE`). Container provisioned with IP and credentials. Notification sent. Audit log written. |
| Post-conditions (failure) | No server created. Reserved resources released. No charges applied. Error logged.                                        |
| Business Rules            | BR-01, BR-02, BR-03, BR-04, BR-05, BR-06, BR-07, BR-08, BR-09, BR-10, BR-11, BR-12, BR-19, BR-27                         |
| Related UCs               | UC-02 (register), UC-03 (login), UC-04 (list servers), UC-10 (wallet), UC-11 (apply voucher), UC-26 (manage tags)        |

## Main Flow

1. Customer selects a **ServerPlan** (or customizes CPU/RAM/disk per 1a).
2. Customer selects an **ImageTemplate** (or a snapshot per 2a).
3. Customer optionally selects a **region** (data center).
4. Customer optionally enters a **voucher code** (UC-11).
5. Customer optionally provides an **SSH public key** per 1b.
6. Customer selects a **billing model** per 1c.
7. Customer clicks **Create**.
8. System validates:
   - Customer has not exceeded maximum server count ([BR-06]).
   - Account balance is sufficient ([BR-27]).
   - ImageTemplate disk size ≤ ServerPlan disk size ([BR-08]).
   - Selected region is available for this account ([BR-09]).
9. System selects a physical **node** and **atomically reserves** the required capacity ([BR-05]). The reservation (incrementing `node.allocated*` counters) and the `ServerInstance` INSERT happen in the **same database transaction**. If two concurrent requests race for the same node's last remaining capacity, only one reservation succeeds — the database-level atomic check rejects the loser. The system then retries with the next-best node (see EX-01-3).
10. System enqueues a provisioning job to BullMQ with:
    - Image template or snapshot reference.
    - vCPU cores, RAM (MB), disk size (GB).
    - Network configuration (public IPv4).
    - Login credentials (password or SSH public key per 1b).
    - Server ID and node ID.
11. System returns `202 Accepted` with the `serverId` to the customer.
12. Worker picks up the job and executes the **idempotency guard**: queries the Docker daemon on the target node: "Does a container tagged with `astral-server-id=<serverId>` already exist?"
    - If **found**: skips container creation and proceeds directly to database sync (step 16).
    - If **not found**: continues to step 13.
13. Worker pulls the Docker image (if not cached) and creates the container with:
    - Resource limits (CPU shares, memory limit, disk volume).
    - Network configuration with a public IP from the node's IP pool.
    - Tags: `astral-server-id=<serverId>`, `astral-user-id=<userId>`, `astral-hostname=<hostname>`.
    - Root password or SSH public key injected via cloud-init or environment.
14. Docker creates and starts the container (provisioning completes in seconds).
15. Worker retrieves the **Docker container ID** and assigned **IP address**.
16. Worker executes the **database sync** in a transaction:
    - Updates `ServerInstance`: status = `ACTIVE`, `dockerContainerId`, `ipAddress`.
    - Confirms node capacity counters (or no-ops if already reserved at step 9).
    - Writes an immutable `AuditLog` entry ([BR-19]).
    - Deducts balance from the user's wallet ([BR-27]).
17. Worker enqueues a notification job (email + in-app).
18. System sends a success notification to the customer (IP, credentials, status).

## Alternative Flows

### 1a — Custom Resource Configuration
Instead of selecting a predefined ServerPlan, the customer manually specifies vCPU cores, RAM, and disk size.
- System displays available resource ranges and computes pricing.
- [BR-10] still applies (minimum 5 GB disk).

### 1b — SSH Key Authentication
Instead of auto-generated password credentials, the customer supplies an existing **SSH public key**.
- System validates the SSH key belongs to the customer ([BR-12]).
- System injects the public key into the container via cloud-init.
- No root password is generated; `rootPassword` remains null.

### 1c — Billing Model Selection
Customer selects **auto-renew** (monthly) or **pay-as-you-go** (hourly) billing.
- System applies the corresponding pricing and sets `nextBillingAt` accordingly.
- Monthly: immediate deduction for the first month.
- Hourly: immediate deduction for the first hour.

### 1d — Region Selection
Customer chooses a specific data center region.
- System filters available ServerPlans and ImageTemplates to only those supported in that region ([BR-09]).
- System selects a node within that region.

### 2a — Create from Snapshot
Instead of selecting an ImageTemplate, the customer selects a **previously saved snapshot**.
- System displays only snapshots belonging to that customer.
- System validates that the snapshot's size does not exceed the selected plan's disk capacity ([BR-08]).
- System creates the container using the snapshot as the data volume source.

## Exception Flows

### EX-01-1 — Insufficient Balance
- Triggered when wallet balance is insufficient to cover at least the first billing period ([BR-27]).
- System displays: "Insufficient balance. Please add funds and try again."
- No server created. No charges applied.

### EX-01-2 — Server Limit Exceeded
- Triggered when customer has ≥ 5 active server instances (or their plan's limit) ([BR-06]).
- System displays: "Server limit reached. Upgrade your plan or delete an existing server."

### EX-01-3 — No Node Available
- No physical node has enough free resources ([BR-05]), **or** every candidate node's atomic reservation was rejected because concurrent requests claimed the capacity first.
- System displays: "All nodes are currently at capacity. Please try again in a few minutes."
- System notifies admin staff for capacity planning.

### EX-01-4 — Provisioning Timeout
- Docker daemon does not respond successfully within 60 seconds ([BR-07]).
- System marks the operation as `FAILED`.
- System updates the server record status to `ERROR`.
- System releases reserved node capacity (rollback).
- System sends an alert to the admin.
- Customer sees: "Provisioning timed out. Our team has been notified."

### EX-01-5 — Image Not Found
- The selected ImageTemplate's Docker image is not available or pull fails.
- System displays: "The selected image is unavailable. Please choose a different image."
- Transaction rolls back. Reserved node capacity released.

### EX-01-6 — Docker API Error
- The Docker daemon returns an error (invalid config, pull failure, internal error).
- System logs the raw error response.
- System marks the operation as `FAILED` and notifies admin.
- Customer sees: "An unexpected error occurred. Please try again later."

### EX-01-7 — Worker Crashes After Container Provisioning (Distributed State Mismatch)
- Scenario: Docker successfully creates and starts the container, but the BullMQ worker crashes (or loses its database connection) before it can update the ServerInstance record (status = ACTIVE), increment node counters, write the audit log, or deduct the balance.
- Database still shows `ServerInstance.status = CREATING`. The container runs on Docker but the customer's dashboard shows "Creating..." indefinitely. No billing deduction occurred yet.
- **Recovery** (built into worker idempotency):
  1. BullMQ detects the unacknowledged job and re-delivers it.
  2. On retry, the worker queries **Docker first**: `GET /containers/json?filters={"label":["astral-server-id=<serverId>"]}` on the assigned node.
  3. If Docker returns a container — the worker skips re-creation and proceeds directly to **database sync**: update `ServerInstance.status = ACTIVE`, set `dockerContainerId` and `ipAddress`, confirm node counters, write audit log, deduct balance, send notification.
  4. If all retries are exhausted (database remains unreachable), the worker **dead-letters** the job and alerts the admin with full context (server ID, Docker container ID, node name).
- **Admin reconciliation**: Admin verifies the container exists on Docker, then manually updates the database or triggers a one-off sync job.
- This pattern makes the provisioning job **idempotent** — running it N times produces the same final state as running it once.

---

## Sequence Diagram: UC-01 Happy Path (Docker Runtime)

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

## Sequence Diagram: EX-01-7 Worker Crash Recovery (Docker Idempotency)

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
| UC Name                   | Register New Account                                                                          |
| Actor(s)                  | Visitor (unauthenticated)                                                                     |
| Priority                  | High                                                                                          |
| Trigger                   | Visitor clicks "Sign Up" or "Register" on the landing page                                    |
| Pre-conditions            | None                                                                                          |
| Post-conditions (success) | User account created in database. Referral code generated. Session established or redirect to login. |
| Post-conditions (failure) | No account created. Form fields preserved where possible.                                     |
| Business Rules            | BR-21, BR-22, BR-54, BR-57                                                                    |
| Related UCs               | UC-03 (login), UC-17 (referral program)                                                       |

## Main Flow

1. Visitor navigates to the registration page.
2. Visitor fills in:
   - **Username** (unique, per [BR-21]).
   - **Email address** (unique, per [BR-21]).
   - **Password** (must meet complexity per [BR-22]).
   - **Confirm password** (must match).
   - **Referral code** (optional).
3. Visitor submits the form.
4. System validates:
   - All required fields are non-empty.
   - Username is not already taken ([BR-21]).
   - Email is not already registered ([BR-21]).
   - Password meets complexity requirements ([BR-22]).
   - Password and confirm-password match.
   - Referral code (if provided): exists, belongs to another user, user is not self-referring ([BR-57]).
5. System creates the **User** record:
   - Hashes password with bcrypt.
   - Generates a unique **referralCode** ([BR-54]).
   - Sets `role = CUSTOMER`.
   - Sets `status = ACTIVE` (or `PENDING_VERIFICATION` per 2a).
   - Creates default `NotificationPreference` record.
6. If a valid referral code was entered, system creates a `Referral` record with `status = PENDING` linking referrer and referee ([BR-54], [BR-57]).
7. System redirects the visitor to the login page, or auto-authenticates and redirects to the dashboard.

## Alternative Flows

### 2a — Email Verification Required
- After step 5, system sends a verification email with a time-limited token.
- User must click the link before logging in.
- Account is created with `status = PENDING_VERIFICATION`.

### 2b — Social Login Registration
- Visitor clicks "Sign up with Google/GitHub."
- OAuth2 flow completes; system creates account with provider ID.
- Password and confirm-password fields are omitted.
- Referral code is collected post-registration if not provided during OAuth flow.

## Exception Flows

### EX-02-1 — Username Already Taken
- System highlights the username field: "This username is already in use."

### EX-02-2 — Email Already Registered
- System highlights the email field: "An account with this email already exists. Log in instead?"

### EX-02-3 — Password Too Weak
- System highlights the password field: "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, and a digit." ([BR-22])

### EX-02-4 — Passwords Do Not Match
- System highlights the confirm-password field: "Passwords do not match."

### EX-02-5 — Database Failure
- System displays: "Registration failed. Please try again later." Logs error internally.

### EX-02-6 — Invalid Referral Code
- Triggered when the supplied referral code does not exist, is inactive, or belongs to the registering user.
- System highlights the referral code field: "Invalid referral code. Please check and try again."
- Registration proceeds without referral credit; no Referral record is created.

---

# UC-03: Login

| Attribute                 | Value                                                                 |
|---------------------------|-----------------------------------------------------------------------|
| UC ID                     | UC-03                                                                 |
| UC Name                   | Login / Authenticate                                                  |
| Actor(s)                  | Visitor (unauthenticated)                                             |
| Priority                  | High                                                                  |
| Trigger                   | Visitor clicks "Login" or is redirected to the login page             |
| Pre-conditions            | Account exists (registered via UC-02). Account is not locked.         |
| Post-conditions (success) | JWT access token and refresh token issued. Session established.       |
| Post-conditions (failure) | Failed attempt counted toward lockout ([BR-23]).                      |
| Business Rules            | BR-23, BR-24, BR-25                                                   |
| Related UCs               | UC-02 (register), UC-01 (create server), UC-04 (list servers), UC-08 (enable 2FA) |

## Main Flow

1. Visitor enters **username/email** and **password**.
2. Visitor clicks **Login**.
3. System looks up the account by username or email.
4. System verifies the password against the stored bcrypt hash.
5. System checks whether the account is locked ([BR-23]).
6. System checks whether 2FA is enabled for this account.
   - If 2FA is **not enabled**: proceeds to step 7.
   - If 2FA is **enabled**: branches to alternative flow 3c (2FA).
7. System checks active session count; if ≥ 5, invalidates the oldest session ([BR-25]).
8. System generates:
   - **Access token** (JWT, short-lived, 1 hour).
   - **Refresh token** (opaque or JWT, 7 days).
9. System creates a new `Session` record.
10. System returns tokens and redirects the customer to the dashboard.
11. System resets the failed-login counter for this account.

## Alternative Flows

### 3a — Remember Me
- Visitor checks "Remember Me."
- System extends the refresh token validity to 30 days.

### 3b — Social Login
- Visitor clicks "Login with Google/GitHub."
- OAuth2 flow completes; system issues tokens directly.

### 3c — Two-Factor Authentication Flow
- After successful password validation (step 4), system detects that 2FA is enabled.
- System prompts the visitor: "Enter the 6-digit code from your authenticator app."
- System stores the partial-authentication state (e.g., a short-lived, single-use TOTP challenge token).
- Visitor enters the **TOTP code** from their authenticator app.
- System validates the TOTP code against the stored secret (time-window: current ± 1 step, 30-second intervals).
- On success: proceeds to step 7 (session creation and token issuance).
- On failure: see EX-03-4.

### 3d — Backup Code
- If the visitor has lost access to their authenticator app, they may enter a **backup code** instead of a TOTP code.
- System validates the backup code against the hashed backup codes list.
- On success: consumes the backup code (removes it from the set) and proceeds to step 7.
- On failure: see EX-03-5.

## Exception Flows

### EX-03-1 — Invalid Credentials
- System increments the failed-login counter.
- System displays: "Invalid username or password."
- After 5 consecutive failures within 10 minutes, the account is locked for 15 minutes ([BR-23]).

### EX-03-2 — Account Locked
- System displays: "Your account has been locked due to too many failed attempts. Please try again in 15 minutes." ([BR-23])

### EX-03-3 — Account Not Found
- System returns the same generic message as invalid credentials to avoid user enumeration: "Invalid username or password."

### EX-03-4 — Invalid TOTP Code
- System displays: "Invalid authentication code. Please try again."
- Does **not** count toward the account lockout threshold (the password step already succeeded).

### EX-03-5 — Invalid Backup Code
- System displays: "Invalid backup code."
- If the visitor has exhausted all backup codes, they must contact support to reset 2FA.

### EX-03-6 — Session Limit Reached
- System automatically invalidates the oldest session and creates a new one ([BR-25]).
- This is a non-error path; the visitor is informed: "Your oldest session has been signed out."

---

## Sequence Diagram: UC-03 with 2FA Flow

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
   |                |  Check: 2FA enabled? |                     |
   |                |  ✓ 2FA enabled       |                     |
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
   |                |  token (not expired, |                     |
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
   |                |  ✓ code valid        |                     |
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

# UC-04: List Servers (Dashboard)

| Attribute                 | Value                                                                              |
|---------------------------|------------------------------------------------------------------------------------|
| UC ID                     | UC-04                                                                              |
| UC Name                   | List Servers (Dashboard)                                                           |
| Actor(s)                  | Customer (authenticated)                                                           |
| Priority                  | High                                                                               |
| Trigger                   | Customer navigates to the dashboard / server list page                              |
| Pre-conditions            | Customer is logged in (valid JWT).                                                 |
| Post-conditions (success) | Paginated list of the customer's servers displayed with status and metadata.       |
| Post-conditions (failure) | Error message displayed.                                                           |
| Business Rules            | BR-01, BR-02                                                                       |
| Related UCs               | UC-01 (create server), UC-05 (start), UC-06 (stop), UC-07 (delete), UC-26 (manage tags) |

## Main Flow

1. Customer navigates to the dashboard.
2. System queries all **ServerInstance** records belonging to the authenticated customer ([BR-01], [BR-02]).
3. System returns a paginated list with each server showing:
   - **Hostname**
   - **Status** (ACTIVE, STOPPED, CREATING, ERROR)
   - **IP address**
   - **ServerPlan** (or custom spec)
   - **Region** / data center
   - **Tags** (assigned via UC-26)
   - **Created date**
   - **Billing model**
4. Customer sees the list rendered in a table or card layout.

## Alternative Flows

### 4a — Pagination
- If the customer has more than 20 servers, the list is paginated.
- Customer can navigate between pages and choose page size (10, 20, 50).

### 4b — Filter by Status
- Customer filters the list to show only ACTIVE, STOPPED, CREATING, or ERROR servers.

### 4c — Filter by Tags
- Customer selects one or more tags from their tag collection.
- System filters servers that have **all** selected tags assigned (AND logic).
- System shows the filtered list with tag chips visible.

### 4d — Sort
- Customer sorts the list by hostname, status, region, or creation date (ascending/descending).

### 4e — Empty State
- Customer has zero servers.
- System displays: "You don't have any servers yet. Create your first one!" with a link to UC-01.

## Exception Flows

### EX-04-1 — Database Unavailable
- System displays: "Unable to load your servers. Please try again."

---

# UC-05: Start Server

| Attribute                 | Value                                                                          |
|---------------------------|--------------------------------------------------------------------------------|
| UC ID                     | UC-05                                                                          |
| UC Name                   | Start a Stopped Server                                                         |
| Actor(s)                  | Customer (authenticated)                                                       |
| Priority                  | High                                                                           |
| Trigger                   | Customer clicks "Start" on a server in `STOPPED` state                         |
| Pre-conditions            | Customer is logged in. Server belongs to this customer. Server status is `STOPPED`. |
| Post-conditions (success) | Server status updated to `ACTIVE`. Container started on Docker. Audit log written. |
| Post-conditions (failure) | Server status remains `STOPPED` (or marked `ERROR`). Error logged.             |
| Business Rules            | BR-13, BR-19                                                                   |
| Related UCs               | UC-01 (create server), UC-04 (list servers), UC-06 (stop server)               |

## Main Flow

1. Customer navigates to the server list (UC-04).
2. Customer locates a server with status `STOPPED`.
3. Customer clicks the **Start** action.
4. System validates that the server belongs to this customer and is in `STOPPED` state ([BR-13]).
5. System enqueues a start job to BullMQ.
6. System returns `202 Accepted` with the server ID.
7. Worker picks up the job:
   - **Idempotency guard**: checks if the server is already `ACTIVE` in the database or if the container is already running on Docker. If so, skips.
   - Calls the Docker daemon on the target node: `POST /containers/{dockerContainerId}/start`.
   - Docker starts the existing container.
8. Worker updates the server record status to `ACTIVE`.
9. Worker writes an audit log entry ([BR-19]).
10. System refreshes the dashboard to show the updated status.

## Exception Flows

### EX-05-1 — Server Not in STOPPED State
- System returns an error: "This server cannot be started because it is not in a stopped state." ([BR-13])

### EX-05-2 — Docker Daemon Unreachable
- The Docker daemon on the node does not respond.
- System displays: "Unable to reach the host node. Please try again later."
- System logs the error and alerts admin.

### EX-05-3 — Container Start Failure
- Docker reports a start error (e.g., corrupted volume, port conflict).
- System updates server status to `ERROR`.
- System notifies the customer and admin.

---

# UC-06: Stop Server

| Attribute                 | Value                                                                          |
|---------------------------|--------------------------------------------------------------------------------|
| UC ID                     | UC-06                                                                          |
| UC Name                   | Stop a Running Server                                                          |
| Actor(s)                  | Customer (authenticated)                                                       |
| Priority                  | High                                                                           |
| Trigger                   | Customer clicks "Stop" on a server in `ACTIVE` state                           |
| Pre-conditions            | Customer is logged in. Server belongs to this customer. Server status is `ACTIVE`. |
| Post-conditions (success) | Server status updated to `STOPPED`. Container stopped gracefully. Audit log written. |
| Post-conditions (failure) | Server state unchanged or marked `ERROR`. Error logged.                        |
| Business Rules            | BR-14, BR-17, BR-19                                                             |
| Related UCs               | UC-01 (create server), UC-04 (list servers), UC-05 (start server)              |

## Main Flow

1. Customer navigates to the server list (UC-04).
2. Customer locates a server with status `ACTIVE`.
3. Customer clicks the **Stop** action.
4. System shows a confirmation dialog: "Are you sure you want to stop this server? You will not lose data."
5. Customer confirms.
6. System validates that the server belongs to this customer and is in `ACTIVE` state ([BR-14]).
7. System enqueues a stop job to BullMQ.
8. System returns `202 Accepted` with the server ID.
9. Worker picks up the job:
   - **Idempotency guard**: checks if the server is already `STOPPED` in the database or if the container is already stopped on Docker. If so, skips.
   - Sends **SIGTERM** to the container: `POST /containers/{dockerContainerId}/stop?signal=SIGTERM`.
   - Waits up to **30 seconds** for graceful shutdown ([BR-17]).
   - If the container is still running after 30 seconds, sends **SIGKILL**: `POST /containers/{dockerContainerId}/stop?signal=SIGKILL` (force stop, per [BR-17]).
10. Worker updates the server record status to `STOPPED` (with a note if force stop was used).
11. Worker writes an audit log entry ([BR-19]).
12. System refreshes the dashboard.

## Alternative Flows

### 6a — Graceful Shutdown Successful
- The container responds to SIGTERM and exits within 30 seconds.
- System records a normal stop in the audit log.

### 6b — Force Stop Required
- The container does not exit within 30 seconds of SIGTERM.
- System sends SIGKILL ([BR-17]).
- System appends a note to the audit log indicating a forced stop.

## Exception Flows

### EX-06-1 — Server Not in ACTIVE State
- System returns an error: "This server cannot be stopped because it is not currently running." ([BR-14])

### EX-06-2 — Docker Daemon Error
- System logs the error. Server status may be set to `ERROR`.
- Customer sees: "Failed to stop the server. Please try again."

---

# UC-07: Delete Server

| Attribute                 | Value                                                                                |
|---------------------------|--------------------------------------------------------------------------------------|
| UC ID                     | UC-07                                                                                |
| UC Name                   | Delete (Terminate) a Server                                                          |
| Actor(s)                  | Customer (authenticated)                                                             |
| Priority                  | High                                                                                 |
| Trigger                   | Customer clicks "Delete" on a server in `STOPPED` state                              |
| Pre-conditions            | Customer is logged in. Server belongs to this customer. Server status is `STOPPED`.  |
| Post-conditions (success) | Server record soft-deleted. Container + volume removed. All resources released. Audit log written. |
| Post-conditions (failure) | Server record unchanged. Resources remain allocated. Error logged.                   |
| Business Rules            | BR-15, BR-16, BR-18, BR-19                                                           |
| Related UCs               | UC-01 (create server), UC-04 (list servers), UC-06 (stop server), UC-13 (backups)    |

## Main Flow

1. Customer navigates to the server list (UC-04).
2. Customer locates a server with status `STOPPED`.
3. Customer clicks the **Delete** action.
4. System shows a confirmation dialog with a warning: "This action is irreversible. All data on this server will be permanently lost. Are you sure?"
5. Customer types the server hostname to confirm, then clicks **Delete**.
6. System validates that the server belongs to this customer and is in `STOPPED` state ([BR-15]).
7. System enqueues a delete job to BullMQ.
8. System returns `200 OK` with the server ID.
9. Worker picks up the job:
   - **Idempotency guard**: queries the Docker daemon on the target node: `GET /containers/{dockerContainerId}/json`.
     - If the container **exists**: continues to step 10.
     - If the container **does not exist**: skips container removal and proceeds directly to database cleanup (step 12).
   - Removes the container: `DELETE /containers/{dockerContainerId}?force=true`.
   - Removes the associated volume: `DELETE /volumes/{volumeName}`.
10. Docker confirms container and volume removal.
11. Worker executes the **database cleanup** in a transaction:
    - Deletes all associated backups and releases their storage ([BR-18]).
    - Releases the public IP address back to the node's pool ([BR-16]).
    - Decrements node `allocated*` counters ([BR-16]).
    - Soft-deletes the `ServerInstance` record (sets `deletedAt`).
    - Deletes associated `ServerTag` join records.
    - Deletes associated `FirewallRule` records.
    - Deletes associated `DnsRecord` records.
    - Writes an audit log entry ([BR-19]).
12. System refreshes the dashboard.

## Alternative Flows

### 7a — Database Cleanup on Retry (Idempotency)
- If the worker crashed after Docker removal but before database cleanup, the retry's idempotency guard discovers the container is already gone on Docker.
- The worker skips Docker calls entirely and proceeds directly to database cleanup (step 12), releasing resources and soft-deleting the record with a note: "Container was already destroyed on retry."

## Exception Flows

### EX-07-1 — Server Not in STOPPED State
- System returns an error: "You must stop the server before deleting it." ([BR-15])
- If the server is ACTIVE, the UI offers a one-click "Stop & Delete" shortcut that chains UC-06 then UC-07.

### EX-07-2 — Docker Deletion Failure
- Docker daemon reports an error during container or volume removal.
- System keeps the server record (status = `ERROR`) to prevent orphaned billing.
- System alerts admin.
- Customer sees: "Deletion failed. Our team has been notified."

### EX-07-3 — Partial Deletion (Distributed State Mismatch)
- Scenario: Docker successfully removes the container and volume, but the BullMQ worker crashes before database cleanup (release IP, decrement node counters, soft-delete ServerInstance, write audit log).
- Database still shows the server as `STOPPED` (or `DELETING`). Node counters still count its resources. The container no longer exists on Docker.
- **Recovery** (built into worker idempotency):
  1. BullMQ detects the unacknowledged job and re-delivers it.
  2. On retry, the worker queries **Docker first**: `GET /containers/{dockerContainerId}/json`.
  3. If Docker returns **"container not found"** — the worker treats the container as already destroyed and proceeds directly to **database cleanup**: release IP, decrement node counters, soft-delete ServerInstance, write audit log (result = SUCCESS with note "Container was already destroyed on retry").
  4. If all retries are exhausted (database remains unreachable), the worker dead-letters the job and alerts the admin.
- **Admin reconciliation**: Admin verifies the container is gone from Docker, then manually releases resources and updates the database.
- This pattern makes the deletion job **idempotent** — retrying any number of times eventually converges to the correct state without double-freeing resources.

---

# UC-08: Enable Two-Factor Authentication (2FA)

| Attribute                 | Value                                                                                        |
|---------------------------|----------------------------------------------------------------------------------------------|
| UC ID                     | UC-08                                                                                        |
| UC Name                   | Enable Two-Factor Authentication                                                             |
| Actor(s)                  | Customer, Admin (required for admin accounts per [BR-24])                                    |
| Priority                  | High (blocking for admin accounts)                                                           |
| Trigger                   | User navigates to Profile > Security > "Enable Two-Factor Authentication"                    |
| Pre-conditions            | User is logged in (valid JWT). User has not already enabled 2FA.                             |
| Post-conditions (success) | 2FA enabled on the account. Backup codes generated and displayed. TOTP secret stored encrypted. |
| Post-conditions (failure) | 2FA not enabled. No state changes.                                                           |
| Business Rules            | BR-24                                                                                        |
| Related UCs               | UC-03 (login), UC-19 (manage profile)                                                        |

## Main Flow

1. User navigates to the security settings page.
2. User clicks **Enable Two-Factor Authentication**.
3. System generates a unique TOTP secret (cryptographically random).
4. System stores the TOTP secret (encrypted at rest) in the `TwoFactorAuth` table with `enabled = false`.
5. System generates a QR code URI (`otpauth://totp/AstralCloud:{username}?secret={secret}&issuer=Astral+Cloud`).
6. System renders the QR code image on screen.
7. User scans the QR code with their authenticator app (Google Authenticator, Authy, etc.).
8. User enters the **6-digit TOTP code** from their authenticator app as verification.
9. System validates the TOTP code against the stored secret (time-window: current ± 1 step).
10. On success:
    - System generates **10 backup codes** (8-character alphanumeric strings).
    - System hashes each backup code and stores the hashes.
    - System updates `TwoFactorAuth.enabled = true`.
    - System writes an audit log entry.
    - System displays the 10 backup codes to the user with a warning: "Save these codes in a secure location. They will not be shown again."
11. User confirms they have saved the backup codes.

## Alternative Flows

### 8a — QR Code Not Working
- If the user's camera cannot scan the QR code, the system displays the **raw TOTP secret** as a text string that can be manually entered into the authenticator app.

### 8b — Regenerate Backup Codes
- User with already-enabled 2FA navigates to security settings.
- User clicks "Regenerate Backup Codes."
- System prompts for the user's current password.
- System invalidates all previous backup codes.
- System generates and displays 10 new backup codes.
- Previous backup codes are no longer valid.

### 8c — Disable 2FA
- User clicks "Disable Two-Factor Authentication" in security settings.
- System prompts for current password OR a valid TOTP code.
- On verification, system sets `TwoFactorAuth.enabled = false` and deletes backup codes.
- System writes an audit log entry.
- **Note**: Admin accounts cannot disable 2FA ([BR-24]) — the disable button is hidden for admin users.

## Exception Flows

### EX-08-1 — Invalid Verification Code
- User enters an incorrect TOTP code during the setup verification.
- System displays: "Invalid code. Please ensure your device's time is synchronized and try again."
- User may retry up to 3 times before the setup is cancelled and the secret is discarded.

### EX-08-2 — Session Expired During Setup
- If the user's JWT expires mid-setup, the system redirects to login and the partial `TwoFactorAuth` record is cleaned up.

### EX-08-3 — Two-Factor Auth Already Enabled
- System hides the "Enable" button and shows "Two-factor authentication is already enabled" with options to regenerate backup codes or disable.

---

# UC-09: Manage API Keys

| Attribute                 | Value                                                                                  |
|---------------------------|----------------------------------------------------------------------------------------|
| UC ID                     | UC-09                                                                                  |
| UC Name                   | Manage API Keys                                                                        |
| Actor(s)                  | Customer (authenticated)                                                               |
| Priority                  | Medium                                                                                 |
| Trigger                   | Customer navigates to Profile > API Keys                                               |
| Pre-conditions            | Customer is logged in (valid JWT).                                                     |
| Post-conditions (success) | API key created, revoked, or viewed.                                                   |
| Post-conditions (failure) | No state change. Error displayed.                                                      |
| Business Rules            | BR-26, BR-64, BR-65                                                                    |
| Related UCs               | UC-03 (login)                                                                          |

## Main Flow

### Create API Key

1. Customer navigates to the API Keys page.
2. System displays a list of existing API keys (prefix + last used + created date + expiry) — the full key is never shown again.
3. Customer clicks **Create API Key**.
4. Customer enters a **label** (e.g., "My CI/CD pipeline").
5. Customer optionally sets an **expiry date** ([BR-65]).
6. Customer clicks **Generate**.
7. System generates a cryptographically random API key (e.g., `astral_sk_<random>`).
8. System stores the SHA-256 hash of the key and its first 8 characters as the `keyPrefix`.
9. System creates the `ApiKey` record.
10. System displays the **full API key once** with a warning: "Copy your API key now. For security, it will not be shown again."
11. Customer copies the key.

### View API Keys

1. Customer navigates to the API Keys page.
2. System displays a table with:
   - **Label**
   - **Key prefix** (e.g., `astral_sk_...`)
   - **Created date**
   - **Expiry date** (if set)
   - **Last used** timestamp
   - **Revoke** action

### Revoke API Key

1. Customer clicks **Revoke** on an API key in the list.
2. System prompts: "Are you sure? Any service using this key will lose access immediately."
3. Customer confirms.
4. System deletes the `ApiKey` record (hard delete).
5. System confirms: "API key revoked. Any requests using this key will now receive 401."

## Exception Flows

### EX-09-1 — Key Not Copied
- After creation, if the customer navigates away without copying the key, the full key is lost.
- System displays: "Key not shown. You must create a new one."
- The old key record is deleted and a new one must be generated.

### EX-09-2 — Expired Key
- API requests using an expired key receive `401 Unauthorized` with message: "API key has expired." ([BR-65])

### EX-09-3 — Rate Limit Exceeded
- API key requests exceeding 60 req/min receive `429 Too Many Requests` ([BR-26]).

---

# UC-10: Wallet & Billing

| Attribute                 | Value                                                                                        |
|---------------------------|----------------------------------------------------------------------------------------------|
| UC ID                     | UC-10                                                                                        |
| UC Name                   | Wallet & Billing                                                                            |
| Actor(s)                  | Customer (authenticated)                                                                     |
| Priority                  | High                                                                                         |
| Trigger                   | Customer navigates to Billing page or initiates a top-up                                     |
| Pre-conditions            | Customer is logged in (valid JWT).                                                           |
| Post-conditions (success) | Wallet funded or billing history displayed.                                                  |
| Post-conditions (failure) | No state change. Error displayed.                                                            |
| Business Rules            | BR-27, BR-28, BR-29, BR-30, BR-31, BR-32, BR-60, BR-61                                       |
| Related UCs               | UC-01 (create server), UC-11 (apply voucher)                                                 |

## Main Flow

### View Balance & Billing Page

1. Customer navigates to the Billing page.
2. System displays:
   - **Current wallet balance**.
   - **Billing history** table (paginated):
     - Date, description (server charge, top-up, refund), amount, status, invoice link.
   - **Upcoming charges** summary (next billing dates for monthly servers, current hourly burn rate).
   - **Tax rate** applied to the customer's billing address region ([BR-60], [BR-61]).

### Add Funds (Top-Up)

1. Customer clicks **Add Funds** on the Billing page.
2. Customer enters an **amount** to add (minimum configurable, default $5).
3. Customer optionally enters a **voucher code** (see UC-11).
4. Customer clicks **Continue to Payment**.
5. System creates a Stripe PaymentIntent for the amount (minus voucher discount).
6. System redirects to the Stripe checkout (or shows the embedded Stripe Elements form).
7. Customer completes the payment (card details handled entirely by Stripe — raw card numbers never touch Astral Cloud's servers, [BR-31]).
8. Stripe webhook notifies the system of successful payment.
9. System updates the wallet balance.
10. System generates an invoice with `status = PAID` ([BR-30]).
11. System creates a `Payment` record.
12. System sends a confirmation notification.

### View Billing History

1. Customer navigates to the Billing page.
2. System queries all `Payment` records belonging to the customer, ordered by date descending.
3. System returns a paginated list with:
   - **Date**
   - **Type** (TOP_UP, CHARGE, REFUND)
   - **Description** (server name, top-up amount)
   - **Amount** (+/-)
   - **Status** (COMPLETED, FAILED, REFUNDED)
   - **Invoice link** (PDF download)

### Download Invoice PDF

1. From the billing history, customer clicks the **Download Invoice** icon.
2. System serves the pre-generated PDF from storage ([BR-30]).
3. If the PDF has not been generated yet, system generates it on-the-fly and returns it.

### Manage Payment Methods

1. Customer navigates to Billing > Payment Methods.
2. System displays saved payment methods (brand, last4, expiry, default status) — tokenized via Stripe ([BR-31]).
3. Customer can:
   - **Add** a new payment method (via Stripe Elements).
   - **Set default** — mark a payment method as the default for future charges.
   - **Delete** a saved payment method.
4. At least one payment method must remain default; the last method cannot be deleted without adding a replacement.

## Alternative Flows

### 10a — Auto-deduction (Monthly)
- Cron job runs at configured intervals.
- For each server with `billingModel = MONTHLY` and `nextBillingAt ≤ now()`:
  - System attempts auto-deduction from wallet balance.
  - On success: creates charge record, generates invoice, sets next billing date.
  - On failure: enters grace period per [BR-29].

### 10b — Auto-deduction (Hourly)
- Cron job runs every hour.
- For each server with `billingModel = HOURLY` and status = ACTIVE:
  - System deducts the hourly rate from wallet balance ([BR-28]).
  - On success: creates charge record.
  - On failure: enters grace period per [BR-29].

### 10c — Grace Period
- If auto-deduction fails, server enters a 24-hour grace period ([BR-29]).
- System sends payment failure notification (critical — cannot be opted out).
- If customer tops up within 24 hours, pending charges are applied and billing resumes.
- After 24 hours without top-up, the server is automatically stopped.

## Exception Flows

### EX-10-1 — Payment Failed (Stripe)
- Stripe reports the payment was declined or failed.
- System displays: "Payment was declined. Please try a different payment method."
- No balance added. No invoice generated.

### EX-10-2 — Webhook Timeout
- If the Stripe webhook is delayed or not received, the payment shows as PENDING.
- Customer can retry or contact support.

### EX-10-3 — Insufficient Balance for Service
- If wallet balance is insufficient to create a new server ([BR-27]) or is depleted during auto-deduction, the server enters grace period ([BR-29]).

---

# UC-11: Apply Voucher

| Attribute                 | Value                                                                                        |
|---------------------------|----------------------------------------------------------------------------------------------|
| UC ID                     | UC-11                                                                                        |
| UC Name                   | Apply Voucher / Coupon Code                                                                  |
| Actor(s)                  | Customer (authenticated)                                                                     |
| Priority                  | Medium                                                                                       |
| Trigger                   | Customer enters a voucher code during wallet top-up or server creation                       |
| Pre-conditions            | Customer is logged in. Top-up or server creation flow is in progress.                        |
| Post-conditions (success) | Voucher applied; discount reflected in payment amount. VoucherUsage record created.          |
| Post-conditions (failure) | Voucher not applied. Error message displayed explaining reason.                              |
| Business Rules            | BR-33, BR-34, BR-35, BR-36, BR-37, BR-38                                                     |
| Related UCs               | UC-01 (create server), UC-10 (wallet), UC-21 (manage vouchers)                               |

## Main Flow

1. During a top-up (UC-10) or server creation (UC-01), customer sees an "Apply Voucher" field.
2. Customer enters a voucher code.
3. Customer clicks **Apply**.
4. System performs validation checks:
   - Voucher code exists in the database (case-insensitive match, [BR-33]).
   - Voucher is active (`isActive = true`).
   - Voucher is within its validity window (`validFrom ≤ now ≤ validUntil`, [BR-34]).
   - Voucher has uses remaining (`currentUses < maxUses`, [BR-35]).
   - Customer has not exceeded per-user usage limit (`count(VoucherUsage) < maxUsesPerUser`, [BR-36]).
   - Current payment amount meets minimum spend requirement if set ([BR-37]).
5. System calculates the discount:
   - `PERCENTAGE`: discount = paymentAmount × (discountValue / 100).
   - `FIXED_AMOUNT`: discount = min(discountValue, paymentAmount) (discount cannot exceed payment amount).
6. System displays the **adjusted amount** with discount breakdown:
   - Original amount: $50.00
   - Voucher discount (WELCOME20): -$10.00
   - Amount to pay: $40.00
7. Customer proceeds with the payment at the discounted amount.
8. After successful payment/charge:
   - System increments `voucher.currentUses`.
   - System creates a `VoucherUsage` record linking voucher, user, and payment.
   - System creates the `Payment` record with `voucherId` set.
   - Invoice reflects the discount as a line item.

## Alternative Flows

### 11a — Multiple Vouchers
- Customer enters additional voucher codes.
- System validates each individually against all rules.
- System sums discounts, but total discount cannot exceed the payment amount ([BR-38]).
- System displays a stacked breakdown of each voucher's contribution.

### 11b — Remove Voucher
- Customer clicks "Remove" next to an applied voucher.
- System recalculates the total without that voucher.

### 11c — Voucher Pre-Validation (No Purchase)
- Customer enters a voucher code to check its value before proceeding.
- System validates the code and displays the discount amount without finalizing.

## Exception Flows

### EX-11-1 — Voucher Not Found
- System displays: "Invalid voucher code. Please check and try again."

### EX-11-2 — Voucher Expired
- System displays: "This voucher has expired." ([BR-34])

### EX-11-3 — Voucher Exhausted
- System displays: "This voucher has reached its maximum number of uses." ([BR-35])

### EX-11-4 — Voucher Already Used by Customer
- System displays: "You have already used this voucher." ([BR-36])

### EX-11-5 — Minimum Spend Not Met
- System displays: "This voucher requires a minimum spend of $X. Add more funds to apply it." ([BR-37])

### EX-11-6 — Discount Exceeds Payment
- When applying multiple vouchers: "The total discount cannot exceed the payment amount." ([BR-38])
- System reduces the last-applied voucher's discount to match the payment amount.

---

## Sequence Diagram: UC-11 Voucher Redemption Flow

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
| UC Name                   | Support Tickets (Customer View)                                                         |
| Actor(s)                  | Customer (authenticated)                                                                |
| Priority                  | Medium                                                                                  |
| Trigger                   | Customer navigates to Support                                                           |
| Pre-conditions            | Customer is logged in (valid JWT).                                                      |
| Post-conditions (success) | Ticket created, viewed, or updated.                                                     |
| Post-conditions (failure) | No state change. Error displayed.                                                       |
| Business Rules            | BR-39, BR-40, BR-41, BR-42                                                              |
| Related UCs               | UC-22 (staff manage tickets)                                                            |

## Main Flow

### Create Ticket

1. Customer navigates to Support > New Ticket.
2. Customer fills in:
   - **Subject** (required).
   - **Category** (GENERAL, BILLING, TECHNICAL, ABUSE).
   - **Message body** (required, supports Markdown).
   - **Priority** (LOW, NORMAL, HIGH, URGENT).
3. Customer clicks **Submit**.
4. System creates a `Ticket` record with `status = OPEN` and links it to the customer's account ([BR-39]).
5. System creates the first `TicketMessage` with the customer's message body.
6. System notifies staff of a new ticket.
7. Customer sees the ticket detail page with the thread.

### View Ticket List

1. Customer navigates to Support > My Tickets.
2. System queries all `Ticket` records belonging to the customer ([BR-39]), ordered by most recently updated.
3. System returns a paginated list with:
   - **Ticket #** (short ID)
   - **Subject**
   - **Status** (OPEN, IN_PROGRESS, WAITING_ON_CUSTOMER, RESOLVED, CLOSED)
   - **Category**
   - **Priority**
   - **Last updated**

### View Ticket Detail & Add Message

1. Customer clicks a ticket from the list.
2. System displays the full ticket thread with all `TicketMessage` entries chronologically.
3. Internal notes (staff-only) are hidden from the customer.
4. Customer enters a reply in the message box.
5. Customer clicks **Send**.
6. System creates a new `TicketMessage` record.
7. System updates `Ticket.updatedAt`.
8. System notifies assigned staff (if any).

### Close Ticket

1. Customer views a resolved ticket.
2. Customer clicks **Close Ticket**.
3. System validates the ticket is in `RESOLVED` status ([BR-40]).
4. System updates status to `CLOSED` and sets `closedAt`.
5. System writes an audit log entry.

### Reopen Ticket

1. Customer views a closed ticket within 7 days of closure.
2. Customer clicks **Reopen**.
3. System validates the ticket was closed within the last 7 days ([BR-41]).
4. System updates status to `OPEN`.
5. If more than 7 days have passed, the "Reopen" button is hidden and customer sees: "This ticket has been closed for more than 7 days. Please create a new ticket."

## Exception Flows

### EX-12-1 — Invalid Status Transition
- Customer attempts to change ticket status in an invalid way (e.g., close a ticket that is still OPEN).
- System displays: "Cannot close this ticket in its current state." ([BR-40])

### EX-12-2 — Empty Message
- System validates message body is non-empty before submission.
- System displays: "Message cannot be empty."

---

# UC-13: Server Backups

| Attribute                 | Value                                                                                       |
|---------------------------|---------------------------------------------------------------------------------------------|
| UC ID                     | UC-13                                                                                       |
| UC Name                   | Server Backups                                                                              |
| Actor(s)                  | Customer (authenticated)                                                                    |
| Priority                  | Medium                                                                                      |
| Trigger                   | Customer navigates to Backups tab on a server detail page                                   |
| Pre-conditions            | Customer is logged in. Server belongs to customer. Server status is `ACTIVE` or `STOPPED`. |
| Post-conditions (success) | Backup created, restored, deleted, or schedule configured.                                  |
| Post-conditions (failure) | No state change. Error displayed.                                                           |
| Business Rules            | BR-51, BR-52, BR-53                                                                         |
| Related UCs               | UC-01 (create server), UC-04 (list servers)                                                 |

## Main Flow

### Create Manual Backup

1. Customer navigates to the server detail page > Backups tab.
2. Customer clicks **Create Backup**.
3. Customer optionally enters a **label** (auto-generated if blank, e.g., "backup-2026-06-27-1430").
4. Customer clicks **Confirm**.
5. System validates:
   - No other backup job is currently running for this server ([BR-53]).
   - Total backup storage including the new backup will not exceed 2× allocated disk ([BR-52]).
6. System enqueues a backup job to BullMQ.
7. System returns `202 Accepted`.
8. Worker picks up the job:
   - Creates a volume snapshot or tarball of the container's data volume.
   - Stores the backup archive on the node's backup storage path.
   - Creates a `Backup` record with `status = AVAILABLE`, `type = MANUAL`, `sizeMB`.
9. System sends a notification to the customer.

### View Backup History

1. Customer navigates to the server detail page > Backups tab.
2. System queries all `Backup` records for the server, ordered by creation date descending.
3. System displays:
   - **Label**
   - **Type** (MANUAL, AUTOMATED)
   - **Size** (MB)
   - **Status** (CREATING, AVAILABLE, FAILED, EXPIRED)
   - **Created date**
   - **Expiry date** (if set)
   - **Actions**: Restore, Delete

### Restore from Backup

1. Customer clicks **Restore** on a backup with `status = AVAILABLE`.
2. System prompts: "Restoring from a backup will replace all current data on this server. Are you sure?"
3. Customer types the server hostname and clicks **Confirm**.
4. System validates the server is in `STOPPED` state (restore requires a stopped server).
5. System enqueues a restore job to BullMQ.
6. Worker:
   - Stops the container if running.
   - Restores the data volume from the backup archive.
   - Restarts the container.
   - Updates the server status to `ACTIVE`.
7. System sends a notification.

### Configure Auto-Backup Schedule

1. Customer navigates to the server detail page > Backups > Schedule.
2. Customer configures:
   - **Enabled** (toggle on/off).
   - **Interval** (hours between backups, default 24).
   - **Retain Daily** (how many daily backups to keep, default 7).
   - **Retain Weekly** (how many weekly backups to keep, default 4).
   - **Retain Monthly** (how many monthly backups to keep, default 3).
3. Customer clicks **Save**.
4. System creates or updates the `BackupSchedule` record.
5. Cron job picks up the schedule and creates automated backups at the configured interval.

### Delete Backup

1. Customer clicks **Delete** on a backup.
2. System confirms: "This backup will be permanently deleted. Are you sure?"
3. Customer confirms.
4. System deletes the backup archive from storage.
5. System deletes the `Backup` record.
6. Released storage is credited back to the quota.

## Exception Flows

### EX-13-1 — Backup Quota Exceeded
- System displays: "Backup storage quota exceeded. Delete old backups or upgrade your plan." ([BR-52])

### EX-13-2 — Backup Job Already Running
- System displays: "A backup is already in progress for this server." ([BR-53])

### EX-13-3 — Backup Failed
- Docker daemon error during snapshot creation.
- System updates backup status to `FAILED`.
- System notifies customer.

### EX-13-4 — Server Must Be Stopped for Restore
- System displays: "You must stop the server before restoring from a backup."
- UI offers a one-click "Stop & Restore" shortcut.

---

# UC-14: Firewall Rules

| Attribute                 | Value                                                                               |
|---------------------------|-------------------------------------------------------------------------------------|
| UC ID                     | UC-14                                                                               |
| UC Name                   | Firewall Rules                                                                      |
| Actor(s)                  | Customer (authenticated)                                                            |
| Priority                  | Medium                                                                              |
| Trigger                   | Customer navigates to Firewall tab on a server detail page                          |
| Pre-conditions            | Customer is logged in. Server belongs to customer.                                  |
| Post-conditions (success) | Firewall rule created, updated, or deleted. Docker iptables rules synced.           |
| Post-conditions (failure) | No state change. Error displayed.                                                   |
| Business Rules            | BR-46, BR-47, BR-48                                                                 |
| Related UCs               | UC-01 (create server), UC-04 (list servers)                                         |

## Main Flow

### List Firewall Rules

1. Customer navigates to the server detail page > Firewall tab.
2. System queries all `FirewallRule` records for the server, ordered by `priority` ascending.
3. System displays a table:
   - **Priority** (lower = evaluated first)
   - **Action** (ALLOW / DENY)
   - **Protocol** (TCP, UDP, ICMP, ALL)
   - **Port Range** (e.g., "22", "80", "8000-8100")
   - **Source CIDR** (e.g., "0.0.0.0/0", "10.0.0.0/8")
   - **Description**
   - **Actions**: Edit, Delete

### Create Firewall Rule

1. Customer clicks **Add Rule**.
2. Customer fills in:
   - **Protocol** (TCP, UDP, ICMP, ALL)
   - **Port Range** (e.g., "443")
   - **Source CIDR** (e.g., "0.0.0.0/0")
   - **Action** (ALLOW / DENY)
   - **Priority** (integer, default: next available)
   - **Description** (optional)
3. Customer clicks **Save**.
4. System validates the rule and creates a `FirewallRule` record.
5. System triggers a firewall sync: applies the new rule to the Docker container via iptables rules on the Docker host.
6. System returns success with the new rule details.

### Update Firewall Rule

1. Customer clicks **Edit** on an existing rule.
2. Customer modifies the desired fields.
3. Customer clicks **Save**.
4. System updates the `FirewallRule` record.
5. System re-syncs firewall rules to the Docker container.

### Delete Firewall Rule

1. Customer clicks **Delete** on a rule.
2. System prompts: "Remove this firewall rule?"
3. Customer confirms.
4. System deletes the `FirewallRule` record.
5. System re-syncs firewall rules to the Docker container.

## Business Rules Detail

- **Default rules** ([BR-48]): On server creation, three default rules are inserted:
  1. Priority 100: ALLOW TCP port 22 from 0.0.0.0/0 (SSH)
  2. Priority 200: ALLOW TCP port 80 from 0.0.0.0/0 (HTTP)
  3. Priority 300: ALLOW TCP port 443 from 0.0.0.0/0 (HTTPS)
- **Default deny** ([BR-46]): An implicit DENY ALL rule at priority 99999 catches unmatched traffic.
- **Priority evaluation** ([BR-47]): Rules are evaluated in ascending priority order. The first matching rule determines the action; subsequent rules are not evaluated.

## Exception Flows

### EX-14-1 — Invalid Port Range
- System displays: "Invalid port range. Use a single port (e.g., 80) or a range (e.g., 8000-8100)."

### EX-14-2 — Firewall Sync Failure
- Docker daemon fails to apply the iptables rules.
- System displays: "Failed to apply firewall rules. Your changes are saved but not yet active. Please try again."
- Rule records remain in the database; sync can be retried.

---

# UC-15: DNS Management

| Attribute                 | Value                                                                               |
|---------------------------|-------------------------------------------------------------------------------------|
| UC ID                     | UC-15                                                                               |
| UC Name                   | DNS Management                                                                      |
| Actor(s)                  | Customer (authenticated)                                                            |
| Priority                  | Medium                                                                              |
| Trigger                   | Customer navigates to DNS tab on a server detail page                               |
| Pre-conditions            | Customer is logged in. Server belongs to customer.                                  |
| Post-conditions (success) | DNS record created, updated, or deleted.                                            |
| Post-conditions (failure) | No state change. Error displayed.                                                   |
| Business Rules            | BR-49, BR-50                                                                        |
| Related UCs               | UC-01 (create server), UC-04 (list servers)                                         |

## Main Flow

### List DNS Records

1. Customer navigates to the server detail page > DNS tab.
2. System queries all `DnsRecord` records for the server.
3. System displays a table:
   - **Type** (A, AAAA, CNAME, MX, TXT, PTR)
   - **Name** (e.g., "@", "www", "mail")
   - **Value** (IP address or domain)
   - **TTL** (seconds)
   - **Priority** (MX records only)
   - **Actions**: Edit, Delete

### Create DNS Record

1. Customer clicks **Add Record**.
2. Customer fills in:
   - **Type** (A, AAAA, CNAME, MX, TXT, PTR)
   - **Name** (e.g., "www" — the subdomain; "@" for root)
   - **Value** (IP address for A/AAAA, domain for CNAME/MX, text for TXT)
   - **TTL** (seconds, default: 3600)
   - **Priority** (MX only)
3. Customer clicks **Save**.
4. System validates:
   - Name + Type combination is unique for this server ([BR-49]).
   - If type is PTR, no other PTR record exists for this server ([BR-50]).
   - Value format matches the record type (IP for A/AAAA, etc.).
5. System creates a `DnsRecord` record.
6. System returns success.

### Update DNS Record

1. Customer clicks **Edit** on an existing record.
2. Customer modifies the desired fields.
3. Customer clicks **Save**.
4. System validates and updates the `DnsRecord` record.

### Delete DNS Record

1. Customer clicks **Delete** on a record.
2. System prompts: "Remove this DNS record?"
3. Customer confirms.
4. System deletes the `DnsRecord` record.

## Exception Flows

### EX-15-1 — Duplicate Record
- System displays: "A record with this name and type already exists for this server." ([BR-49])

### EX-15-2 — Multiple PTR Records
- System displays: "Each server may have only one PTR (reverse DNS) record." ([BR-50])

### EX-15-3 — Invalid Value Format
- System displays: "Invalid value for record type. Expected a valid IPv4/IPv6 address/domain name."

---

# UC-16: Read Blog

| Attribute                 | Value                                                                               |
|---------------------------|-------------------------------------------------------------------------------------|
| UC ID                     | UC-16                                                                               |
| UC Name                   | Read Blog / Browse Content                                                          |
| Actor(s)                  | Visitor (unauthenticated), Customer (authenticated)                                 |
| Priority                  | Low                                                                                 |
| Trigger                   | Visitor navigates to /blog                                                          |
| Pre-conditions            | None                                                                                |
| Post-conditions (success) | Blog posts displayed.                                                               |
| Post-conditions (failure) | Error message displayed.                                                            |
| Business Rules            | BR-43, BR-44                                                                        |
| Related UCs               | UC-23 (staff manage blog)                                                           |

## Main Flow

### Browse Blog

1. Visitor navigates to the /blog page.
2. System queries all blog posts with `status = PUBLISHED` ([BR-43]), ordered by `publishedAt` descending.
3. System renders a paginated list of post cards showing:
   - **Cover image** (if available)
   - **Title**
   - **Excerpt**
   - **Author name** ([BR-45])
   - **Category**
   - **Published date**
   - **Tags**

### View Blog Post

1. Visitor clicks on a blog post card.
2. System fetches the post by slug ([BR-44]).
3. System renders the full post:
   - Title, author, published date, category.
   - Cover image.
   - Markdown body rendered to HTML.
   - Tags.
4. If the post is DRAFT or ARCHIVED, it is only visible to authenticated staff/admin users ([BR-43]).

### Filter by Category

1. Visitor selects a category from the category list/sidebar.
2. System filters posts to only those in the selected category.

### Search by Keyword

1. Visitor enters a search keyword in the blog search bar.
2. System performs a full-text search (or `ILIKE` for MVP) on post titles, excerpts, and tags.
3. System returns matching published posts, ordered by relevance.

## Alternative Flows

### 16a — RSS Feed
- System provides an RSS/Atom feed at `/blog/feed.xml` (or `/blog/rss`) containing the most recent published posts.

## Exception Flows

### EX-16-1 — Post Not Found
- If the slug does not match any PUBLISHED post, system returns a 404 page.
- If the post exists but is DRAFT and the visitor is not staff/admin, return 404 (do not reveal existence).

### EX-16-2 — Empty Category
- System displays: "No posts in this category yet."

---

# UC-17: Referral Program

| Attribute                 | Value                                                                               |
|---------------------------|-------------------------------------------------------------------------------------|
| UC ID                     | UC-17                                                                               |
| UC Name                   | Referral Program                                                                    |
| Actor(s)                  | Customer (authenticated)                                                            |
| Priority                  | Low                                                                                 |
| Trigger                   | Customer navigates to Referrals page                                                |
| Pre-conditions            | Customer is logged in (valid JWT).                                                  |
| Post-conditions (success) | Referral information displayed or referral link shared.                             |
| Post-conditions (failure) | Error displayed.                                                                    |
| Business Rules            | BR-54, BR-55, BR-56, BR-57                                                          |
| Related UCs               | UC-02 (register), UC-10 (wallet)                                                    |

## Main Flow

### View Referral Dashboard

1. Customer navigates to the Referrals page.
2. System displays:
   - **Referral code** (unique, immutable, [BR-54]).
   - **Referral link** (e.g., `https://astral.cloud/register?ref=CODE123`).
   - **Total referrals** (count of Referral records where this user is the referrer).
   - **Total credits earned** (sum of `referrerCredit` where `status = CREDITED`).
   - **Available for payout** (accumulated credits that have met the threshold, [BR-56]).
   - **Payout threshold** (configurable, default $50, [BR-56]).

### View Referral History

1. Customer views the referral history table on the Referrals page.
2. System queries all `Referral` records where this user is the referrer.
3. System displays for each:
   - **Referee username** (anonymized partial — e.g., "john***").
   - **Date referred**.
   - **Status** (PENDING, CREDITED, PAID_OUT).
   - **Credit earned** ($ amount).

### Share Referral Link

1. Customer clicks **Copy Link** to copy the referral link to clipboard.
2. System provides share buttons for social media / email with pre-populated text (optional).

## Alternative Flows

### 17a — Request Payout
- Customer clicks **Request Payout** when accumulated credits reach the payout threshold ([BR-56]).
- System creates a `ReferralPayout` record.
- If the user has a withdrawal method configured, the payout is processed.
- If below threshold, the button is disabled with text: "Minimum $50.00 required for payout."

## Exception Flows

### EX-17-1 — Payout Below Threshold
- System displays: "You need at least $50.00 in referral credits to request a payout." ([BR-56])

---

# UC-18: Notifications

| Attribute                 | Value                                                                               |
|---------------------------|-------------------------------------------------------------------------------------|
| UC ID                     | UC-18                                                                               |
| UC Name                   | Notifications                                                                       |
| Actor(s)                  | Customer (authenticated)                                                            |
| Priority                  | Low                                                                                 |
| Trigger                   | Customer clicks the notification bell icon or navigates to Notification Center      |
| Pre-conditions            | Customer is logged in (valid JWT).                                                  |
| Post-conditions (success) | Notifications displayed, marked read, or preferences updated.                       |
| Post-conditions (failure) | Error displayed.                                                                    |
| Business Rules            | BR-58, BR-59                                                                        |
| Related UCs               | UC-01 (create server), UC-03 (login), UC-10 (wallet), UC-12 (tickets)               |

## Main Flow

### View Notification Center

1. Customer clicks the notification bell icon in the header.
2. System queries the most recent 20 `Notification` records for the customer, ordered by `createdAt` descending.
3. System displays a dropdown/popover with:
   - Unread count badge on the bell icon.
   - List of notifications with: title, body, time ago, read/unread indicator.
4. Customer can click "View All" to navigate to the full Notification Center page.

### Mark as Read

1. Customer hovers or clicks on an unread notification.
2. System updates `isRead = true`.
3. (Optionally) navigating to a linked page auto-marks the notification as read.

### Mark All as Read

1. Customer clicks **Mark All as Read**.
2. System updates all unread notifications for this customer to `isRead = true`.

### Configure Notification Preferences

1. Customer navigates to Profile > Notification Preferences.
2. System displays the current `NotificationPreference` settings:
   - **Email**: Server Created, Server Deleted, Payment Failure, Ticket Updates, Marketing.
   - **In-App Push**: Server Created, Ticket Updates.
3. Customer toggles each channel on/off.
4. Payment Failure notifications cannot be fully disabled (critical per [BR-59]); the toggle is locked in the ON position.
5. Customer clicks **Save**.
6. System updates the `NotificationPreference` record.

## Exception Flows

### EX-18-1 — Critical Notification Opt-Out Attempted
- System displays: "Payment failure notifications cannot be disabled." ([BR-59])

---

# UC-19: Manage Profile

| Attribute                 | Value                                                                               |
|---------------------------|-------------------------------------------------------------------------------------|
| UC ID                     | UC-19                                                                               |
| UC Name                   | Manage Profile                                                                      |
| Actor(s)                  | Customer, Staff, Admin (authenticated)                                              |
| Priority                  | Medium                                                                              |
| Trigger                   | User navigates to Profile / Account Settings                                        |
| Pre-conditions            | User is logged in (valid JWT).                                                      |
| Post-conditions (success) | Profile updated, sessions managed.                                                  |
| Post-conditions (failure) | No state change. Error displayed.                                                   |
| Business Rules            | BR-21, BR-22, BR-25, BR-60, BR-61                                                  |
| Related UCs               | UC-02 (register), UC-03 (login), UC-08 (enable 2FA), UC-09 (manage API keys)        |

## Main Flow

### Update Profile

1. User navigates to Profile > Account Settings.
2. User can modify:
   - **Username** (must be unique, [BR-21])
   - **Email** (must be unique, [BR-21])
   - **Billing address** (line1, line2, city, state, postal, country)
3. If changing email, system sends a verification email to the new address. Old email remains active until verification completes.
4. System validates:
   - Username is not already taken by another user.
   - Email is not already registered to another user.
5. System updates the `User` record.
6. System writes an audit log entry.

### Change Password

1. User navigates to Profile > Security > Change Password.
2. User enters:
   - **Current password**
   - **New password** ([BR-22])
   - **Confirm new password**
3. System validates the current password against the stored hash.
4. System validates new password meets complexity requirements.
5. If 2FA is enabled, system prompts for a TOTP code.
6. System updates the password hash.
7. System invalidates all existing sessions (forces re-login on all devices).
8. System writes an audit log entry.

### View Active Sessions

1. User navigates to Profile > Security > Active Sessions.
2. System queries all active `Session` records for this user ([BR-25]).
3. System displays:
   - **IP Address**
   - **User Agent** (browser/OS)
   - **Created date**
   - **Expires date**
   - **Current session** indicator

### Revoke Session

1. User clicks **Revoke** on a session (not the current one).
2. System deletes the `Session` record.
3. That session's refresh token is immediately invalid.
4. System confirms: "Session revoked."

### Revoke All Other Sessions

1. User clicks **Sign Out All Other Devices**.
2. System deletes all `Session` records except the current one.
3. System confirms: "All other sessions have been signed out."

## Exception Flows

### EX-19-1 — Username Already Taken
- System highlights the username field: "This username is already in use." ([BR-21])

### EX-19-2 — Email Already Registered
- System highlights the email field: "This email is already registered to another account." ([BR-21])

### EX-19-3 — Current Password Incorrect
- System displays: "Current password is incorrect."

### EX-19-4 — Password Too Weak
- System displays password complexity requirements ([BR-22]).

---

# UC-20: Admin — Manage Infrastructure

| Attribute                 | Value                                                                                         |
|---------------------------|-----------------------------------------------------------------------------------------------|
| UC ID                     | UC-20                                                                                         |
| UC Name                   | Admin — Manage Infrastructure                                                                |
| Actor(s)                  | Admin (authenticated, role = ADMIN)                                                           |
| Priority                  | High                                                                                          |
| Trigger                   | Admin navigates to Admin Panel > Infrastructure                                               |
| Pre-conditions            | Admin is logged in. 2FA must be enabled ([BR-24]).                                            |
| Post-conditions (success) | Infrastructure resources created, updated, or deactivated. Audit log written.                 |
| Post-conditions (failure) | No state change. Error displayed.                                                             |
| Business Rules            | BR-05, BR-08, BR-09, BR-10, BR-20, BR-24, BR-68, BR-69, BR-70                                |
| Related UCs               | UC-01 (create server), UC-21 (manage vouchers), UC-24 (platform management)                    |

## Main Flow

### Manage ServerPlans

1. Admin navigates to Admin > Infrastructure > Server Plans.
2. System displays a table of all ServerPlans with columns: name, slug, vCPU, RAM, disk, bandwidth, monthly price, hourly price, active status, regions.
3. Admin can:
   - **Create**: Enter plan details (name, slug, vCPU, RAM, disk, bandwidth, prices, maxServers). Associate with regions.
   - **Edit**: Modify plan details or region associations.
   - **Deactivate**: Soft-disable a plan (`isActive = false`). Active servers on this plan are not affected but no new servers can use it.
4. System validates: disk ≥ 5 GB ([BR-10]), RAM ≥ 256 MB, vCPU ≥ 1.
5. System writes an audit log entry for each create/edit/deactivate ([BR-20]).

### Manage ImageTemplates

1. Admin navigates to Admin > Infrastructure > Image Templates.
2. System displays a table of all ImageTemplates: name, slug, OS type, version, Docker image, disk size, active status, regions.
3. Admin can:
   - **Create**: Enter image details (name, slug, OS type, version, `dockerImage` registry path, disk size). Associate with regions.
   - **Edit**: Modify image details or region associations.
   - **Deactivate**: Soft-disable an image (`isActive = false`).
4. System validates: image disk size is within reasonable bounds.
5. System writes an audit log entry ([BR-20]).

### Manage Nodes (Docker Hosts)

1. Admin navigates to Admin > Infrastructure > Nodes.
2. System displays a table of all Nodes: name, region, status, Docker endpoint, total vs allocated resources (vCPU, RAM, disk), last heartbeat, health.
3. Admin can:
   - **Create**: Enter node details (name, region, Docker endpoint, total vCPU/RAM/disk capacity).
   - **Edit**: Modify node details or capacity. Editing capacity triggers a validation that total ≥ allocated ([BR-05]).
   - **Change Status**: Set node to ONLINE, OFFLINE, or MAINTENANCE ([BR-68]).
     - **MAINTENANCE**: Node continues running existing servers but rejects new deployments ([BR-69]).
     - **OFFLINE**: Node is removed from scheduling entirely.
   - **Delete**: Remove a node from the system. Prevented if node has active servers.
4. System displays resource utilization percentage for each node.
5. System writes an audit log entry for each config change ([BR-20]).

### Manage Regions

1. Admin navigates to Admin > Infrastructure > Regions.
2. System displays a table of all Regions: name, slug, active status.
3. Admin can:
   - **Create**: Enter name and slug.
   - **Edit**: Modify name or slug.
   - **Deactivate**: Soft-disable a region (`isActive = false`).
4. System writes an audit log entry ([BR-20]).

## Alternative Flows

### 20a — Node Health Monitoring
- Every 60 seconds, the cron job checks each ONLINE node's Docker daemon health ([BR-70]).
- Three consecutive failures → automatic status change to OFFLINE + admin alert.
- Heartbeat timestamp (`lastHeartbeatAt`) is updated on each successful check.

### 20b — Bulk Operations
- Admin can bulk-deactivate multiple ServerPlans or ImageTemplates.

## Exception Flows

### EX-20-1 — Capacity Violation
- Admin attempts to reduce a node's total capacity below currently allocated resources.
- System displays: "Cannot reduce capacity below current allocation. Current allocation: vCPU X, RAM Y MB, Disk Z GB." ([BR-05])

### EX-20-2 — Node Delete Blocked
- Admin attempts to delete a node that has active servers.
- System displays: "Cannot delete node with active servers. Migrate or delete all servers on this node first."

---

# UC-21: Admin/Staff — Manage Vouchers

| Attribute                 | Value                                                                               |
|---------------------------|-------------------------------------------------------------------------------------|
| UC ID                     | UC-21                                                                               |
| UC Name                   | Manage Vouchers (Admin / Staff)                                                     |
| Actor(s)                  | Admin, Staff (authenticated, role = STAFF or ADMIN)                                 |
| Priority                  | Medium                                                                              |
| Trigger                   | Staff navigates to Admin > Vouchers                                                 |
| Pre-conditions            | User is logged in as STAFF or ADMIN.                                                |
| Post-conditions (success) | Voucher created, deactivated, or statistics viewed. Audit log written.              |
| Post-conditions (failure) | No state change. Error displayed.                                                   |
| Business Rules            | BR-33, BR-34, BR-35, BR-36, BR-37, BR-38, BR-20                                     |
| Related UCs               | UC-11 (apply voucher)                                                               |

## Main Flow

### View Vouchers

1. Staff navigates to Admin > Vouchers.
2. System displays a table of all vouchers:
   - **Code**
   - **Description**
   - **Type** (PERCENTAGE / FIXED_AMOUNT)
   - **Value**
   - **Uses** (current / max)
   - **Validity** (from – until)
   - **Status** (active / inactive)
   - **Created by**
   - **Created date**

### Create Voucher

1. Staff clicks **Create Voucher**.
2. Staff fills in:
   - **Code** (unique, case-insensitive, [BR-33])
   - **Description** (e.g., "Launch Week 20% Off")
   - **Discount Type** (PERCENTAGE or FIXED_AMOUNT)
   - **Discount Value**
   - **Max Uses** (optional — null = unlimited, [BR-35])
   - **Max Uses Per User** (default: 1, [BR-36])
   - **Minimum Spend** (optional, [BR-37])
   - **Valid From** (optional, [BR-34])
   - **Valid Until** (optional, [BR-34])
   - **Is Active** (default: true)
3. Staff clicks **Create**.
4. System validates:
   - Code is not already in use (case-insensitive check).
   - Discount value is valid (percentage 1–100, fixed > 0).
   - `validFrom < validUntil` if both are set.
5. System creates the `Voucher` record.
6. System writes an audit log entry ([BR-20]).

### View Voucher Statistics

1. Staff clicks on a voucher to view details.
2. System displays:
   - **Total redemptions** (currentUses).
   - **Total discount given** (sum of VoucherUsage.discountAmount).
   - **Redemption history** (list of VoucherUsage records with user, payment, date, amount).
   - **Remaining uses** (maxUses - currentUses, if limited).

### Deactivate Voucher

1. Staff clicks **Deactivate** on an active voucher.
2. System confirms: "Deactivate voucher 'CODE'? Future redemptions will be rejected."
3. Staff confirms.
4. System sets `isActive = false`.
5. System writes an audit log entry ([BR-20]).

## Exception Flows

### EX-21-1 — Duplicate Code
- System displays: "A voucher with this code already exists." ([BR-33])

### EX-21-2 — Invalid Discount Value
- PERCENTAGE: "Percentage must be between 1 and 100."
- FIXED_AMOUNT: "Amount must be greater than 0."

### EX-21-3 — Invalid Validity Dates
- System displays: "Valid until date must be after valid from date."

---

# UC-22: Staff — Manage Tickets

| Attribute                 | Value                                                                               |
|---------------------------|-------------------------------------------------------------------------------------|
| UC ID                     | UC-22                                                                               |
| UC Name                   | Staff — Manage Tickets                                                              |
| Actor(s)                  | Staff, Admin (authenticated, role = STAFF or ADMIN)                                 |
| Priority                  | Medium                                                                              |
| Trigger                   | Staff navigates to Support > Ticket Queue                                           |
| Pre-conditions            | User is logged in as STAFF or ADMIN.                                                |
| Post-conditions (success) | Ticket managed (assigned, responded, status changed, internal note added).          |
| Post-conditions (failure) | No state change. Error displayed.                                                   |
| Business Rules            | BR-39, BR-40, BR-41, BR-42                                                          |
| Related UCs               | UC-12 (customer support tickets)                                                    |

## Main Flow

### View Ticket Queue

1. Staff navigates to Support > Ticket Queue.
2. System displays all tickets, filterable by:
   - **Status** (OPEN, IN_PROGRESS, WAITING_ON_CUSTOMER, RESOLVED, CLOSED)
   - **Priority** (LOW, NORMAL, HIGH, URGENT)
   - **Category** (GENERAL, BILLING, TECHNICAL, ABUSE)
   - **Assignee** (unassigned, specific staff member)
3. System displays:
   - **Ticket #**, subject, customer, status, priority, category, assignee, last updated.

### Assign Ticket

1. Staff clicks **Assign to Me** on an unassigned ticket.
2. System updates `assignedUserId` to the staff member's ID.
3. System updates status to `IN_PROGRESS` if currently `OPEN`.
4. System writes an internal note: "Ticket assigned to [staff name]."

### Respond to Ticket

1. Staff opens a ticket detail page.
2. Staff views the full thread including customer messages.
3. Staff enters a reply in the message box.
4. Staff optionally toggles **Internal Note** to make the message visible only to staff (not the customer).
5. Staff clicks **Send**.
6. System creates a `TicketMessage` record with `isInternal = true/false`.
7. System updates `Ticket.updatedAt`.
8. System notifies the customer (for non-internal messages).

### Change Ticket Status

1. Staff views a ticket.
2. Staff selects a new status from the dropdown (valid transitions per [BR-40]):
   - OPEN → IN_PROGRESS
   - IN_PROGRESS → WAITING_ON_CUSTOMER
   - IN_PROGRESS → RESOLVED
   - WAITING_ON_CUSTOMER → IN_PROGRESS
3. System writes an internal note with the status change reason (optional).
4. System notifies the customer of status changes.

### Add Internal Note

1. Staff opens a ticket, types a message, and toggles "Internal Note."
2. System creates a `TicketMessage` with `isInternal = true`.
3. The note is visible only to STAFF/ADMIN users.

## Alternative Flows

### 22a — Bulk Assignment
- Staff can select multiple tickets and assign them to a staff member.

### 22b — Priority Escalation
- Staff can change a ticket's priority (LOW → NORMAL → HIGH → URGENT).

### 22c — Ticket Search
- Staff searches tickets by customer username, email, ticket subject, or ticket number.

## Exception Flows

### EX-22-1 — Invalid Status Transition
- System displays: "Cannot transition from [current] to [new]." ([BR-40])

---

# UC-23: Staff — Manage Blog

| Attribute                 | Value                                                                               |
|---------------------------|-------------------------------------------------------------------------------------|
| UC ID                     | UC-23                                                                               |
| UC Name                   | Manage Blog (Staff / Admin)                                                         |
| Actor(s)                  | Staff, Admin (authenticated, role = STAFF or ADMIN)                                 |
| Priority                  | Low                                                                                 |
| Trigger                   | Staff navigates to Blog > Manage Posts                                              |
| Pre-conditions            | User is logged in as STAFF or ADMIN.                                                |
| Post-conditions (success) | Blog post or category created, edited, or published. Audit log written.             |
| Post-conditions (failure) | No state change. Error displayed.                                                   |
| Business Rules            | BR-43, BR-44, BR-45, BR-20                                                          |
| Related UCs               | UC-16 (read blog)                                                                   |

## Main Flow

### Manage Blog Posts

1. Staff navigates to Blog > Manage Posts.
2. System displays all blog posts regardless of status, ordered by `updatedAt` descending:
   - **Title**, slug, category, author, status badge (DRAFT/PUBLISHED/ARCHIVED), published date, updated date.
3. Staff can:
   - **Create**: Navigate to post editor.
   - **Edit**: Open existing post in editor.
   - **Publish/Unpublish/Archive**: Change status per [BR-43].
   - **Delete**: Soft-delete a post (archive first).

### Create / Edit Blog Post

1. Staff fills in the post form:
   - **Title** (required)
   - **Slug** (auto-generated from title, editable, [BR-44])
   - **Category** (dropdown, [BR-45] requires STAFF/ADMIN author)
   - **Excerpt** (optional, summary for cards)
   - **Body** (Markdown, required)
   - **Cover Image** (optional, file upload)
   - **Tags** (comma-separated or chip input)
   - **Status** (DRAFT, PUBLISHED, ARCHIVED, [BR-43])
2. Staff clicks **Save Draft** (status = DRAFT) or **Publish** (status = PUBLISHED).
3. On publish:
   - System sets `publishedAt` to now (if first publish).
   - System sets `authorId` to the current user (required; must be STAFF or ADMIN).
4. System saves the blog post.
5. System writes an audit log entry ([BR-20]).

### Manage Blog Categories

1. Staff navigates to Blog > Categories.
2. System displays all categories: name, slug, description.
3. Staff can:
   - **Create**: Enter name, slug, optional description.
   - **Edit**: Modify name, slug, description.
   - **Delete**: Remove category (only if no posts belong to it).

## Exception Flows

### EX-23-1 — Duplicate Slug
- System displays: "A post with this slug already exists. Please choose a different slug." ([BR-44])

### EX-23-2 — Category Has Posts
- Staff tries to delete a category that has posts.
- System displays: "Cannot delete a category that contains blog posts. Reassign the posts first."

### EX-23-3 — Invalid Author
- System enforces that the author must be STAFF or ADMIN ([BR-45]). If a CUSTOMER somehow reaches this page, the publish action is rejected.

---

# UC-24: Admin — Platform Management

| Attribute                 | Value                                                                               |
|---------------------------|-------------------------------------------------------------------------------------|
| UC ID                     | UC-24                                                                               |
| UC Name                   | Admin — Platform Management                                                         |
| Actor(s)                  | Admin (authenticated, role = ADMIN)                                                 |
| Priority                  | High                                                                                |
| Trigger                   | Admin navigates to various Admin sections                                           |
| Pre-conditions            | Admin is logged in. 2FA must be enabled ([BR-24]).                                  |
| Post-conditions (success) | Platform configuration updated. Audit log written.                                  |
| Post-conditions (failure) | No state change. Error displayed.                                                   |
| Business Rules            | BR-20, BR-61, BR-66, BR-67                                                          |
| Related UCs               | UC-20 (manage infrastructure), UC-21 (manage vouchers), UC-25 (GDPR requests)       |

## Main Flow

### Manage Users

1. Admin navigates to Admin > Users.
2. System displays a paginated table of all users with filters for role, status, and search.
3. Columns: Username, email, role, status, server count, balance, registration date.
4. Admin can:
   - **View detail**: See user profile, servers, tickets, payments.
   - **Change role**: CUSTOMER ↔ STAFF ↔ ADMIN.
   - **Change status**: ACTIVE, LOCKED, SUSPENDED.
   - **Unlock account**: Reset `failedLoginAttempts` and `lockedUntil`.
   - **Set tax-exempt**: Toggle `taxExempt` flag ([BR-61]).
5. System writes audit log for each change ([BR-20]).

### Manage System Settings

1. Admin navigates to Admin > Settings.
2. System displays all `SystemSetting` records grouped by category.
3. Each setting shows: key, label, description, current value, type (STRING, NUMBER, BOOLEAN, JSON).
4. Admin can:
   - **Edit**: Modify the value with type-specific input validation ([BR-66]).
   - **View immutable**: Settings marked `isImmutable = true` are read-only in the UI ([BR-67]).
5. System validates the value against the declared type ([BR-66]).
6. System writes an audit log entry ([BR-20]).

### Manage Email Templates

1. Admin navigates to Admin > Email Templates.
2. System displays all `EmailTemplate` records: code, name, subject (truncated), active status.
3. Admin can:
   - **Edit**: Open a template editor with subject, HTML body, text body, available variables list.
   - **Preview**: Render a template with sample data.
   - **Deactivate**: Set `isActive = false`.
4. System writes an audit log entry ([BR-20]).

### Manage Tax Rates

1. Admin navigates to Admin > Tax Rates.
2. System displays all `TaxRate` records: region, name, rate, active status.
3. Admin can:
   - **Create**: Associate a tax rate with a region.
   - **Edit**: Modify name, rate percentage.
   - **Deactivate**: Set `isActive = false`.
4. System writes an audit log entry ([BR-20]).

### Manage Announcements

1. Admin navigates to Admin > Announcements.
2. System displays all announcements: title, severity (INFO/WARNING/CRITICAL), active status, scheduled dates.
3. Admin can:
   - **Create**: Enter title, body (Markdown), severity, optional startsAt/endsAt schedule.
   - **Edit**: Modify announcement details.
   - **Deactivate**: Set `isActive = false`.
   - **Delete**: Remove an announcement.
4. Active announcements are displayed to all users on the dashboard/landing page.

### View Audit Logs

1. Admin navigates to Admin > Audit Logs.
2. System displays a paginated, filterable view of all `AuditLog` entries.
3. Filters: user, action type, target type, result (SUCCESS/FAILURE), date range.
4. Columns: timestamp, user, action, target type/ID, result, IP address.
5. Entries are read-only, immutable.

### Monitor Job Queue

1. Admin navigates to Admin > Job Queue.
2. System displays BullMQ queue statistics:
   - **Active jobs** count.
   - **Waiting jobs** count.
   - **Completed jobs** count.
   - **Failed jobs** count.
   - **Dead-letter jobs** count (requires admin investigation).
3. Admin can:
   - **View dead-letter queue**: List jobs that exhausted all retries with error details, metadata, timestamps.
   - **Retry a dead-lettered job**: Manually re-enqueue after investigation.
   - **Remove a job**: Permanently discard a job.

## Exception Flows

### EX-24-1 — Invalid System Setting Value
- System displays: "Invalid value for type [TYPE]. Expected: [constraint]." ([BR-66])

### EX-24-2 — Immutable Setting Edit Attempted
- The edit field is disabled with a tooltip: "This setting cannot be changed via the UI." ([BR-67])

---

# UC-25: GDPR Requests

| Attribute                 | Value                                                                                     |
|---------------------------|-------------------------------------------------------------------------------------------|
| UC ID                     | UC-25                                                                                     |
| UC Name                   | GDPR Requests (Data Export / Account Deletion)                                            |
| Actor(s)                  | Customer (requestor), Admin (processor)                                                   |
| Priority                  | Medium                                                                                    |
| Trigger                   | Customer submits a data export or deletion request via Profile > Privacy                  |
| Pre-conditions            | Customer is logged in. Customer has no active servers for deletion requests.              |
| Post-conditions (success) | Export: download link emailed. Deletion: account and data removed, audit logs anonymized. |
| Post-conditions (failure) | Request rejected or failed. Error logged.                                                 |
| Business Rules            | BR-62, BR-63                                                                              |
| Related UCs               | UC-19 (manage profile), UC-24 (platform management)                                       |

## Main Flow

### Request Data Export

1. Customer navigates to Profile > Privacy.
2. Customer clicks **Request Data Export**.
3. System displays: "You will receive an email with a download link containing all your personal data."
4. Customer clicks **Confirm**.
5. System creates a `GdprRequest` record with `type = EXPORT`, `status = PENDING`.
6. System enqueues an export job to BullMQ.
7. Worker:
   - Gathers all customer data: User record, ServerInstance records, Ticket records, Payment history, Invoice records, Notification records, Session records, Referral records.
   - Generates a machine-readable JSON or CSV file ([BR-62]).
   - Uploads the file to secure temporary storage.
   - Updates `GdprRequest.status = COMPLETED`, sets `downloadUrl` with an expiry.
   - Sends an email to the customer with the download link.
8. The download link expires after 7 days; after expiry, the file is deleted.

### Request Account Deletion

1. Customer navigates to Profile > Privacy.
2. Customer clicks **Request Account Deletion**.
3. System validates:
   - Customer has no active servers. If they do, display: "You must delete all your servers before requesting account deletion. You have X active server(s)."
4. System displays a final warning: "This action is irreversible. All your data will be permanently deleted within 30 days."
5. Customer types their username and clicks **Confirm Deletion**.
6. System creates a `GdprRequest` record with `type = DELETE`, `status = PENDING`, `expiresAt = now + 30 days`.
7. System locks the account (`status = SUSPENDED`).
8. Admin reviews the request.
9. Admin approves and initiates the deletion process.
10. System:
    - Deletes all personal data: User record, SSH keys, snapshots, tickets, notifications, sessions, API keys, payment methods ([BR-63]).
    - Anonymizes audit logs: sets `userId = null`, truncates `ipAddress` to /24 prefix ([BR-63]).
    - Retains invoice records (legal requirement) but anonymizes the user reference.
    - Updates `GdprRequest.status = COMPLETED`, `completedAt`.
11. System sends a final confirmation email.

### Admin Process GDPR Requests

1. Admin navigates to Admin > GDPR Requests.
2. System displays all `GdprRequest` records: user, type, status, created date, expiry.
3. Admin can:
   - **View detail**: See the request and associated user data summary.
   - **Approve export**: Triggers the export job.
   - **Approve deletion**: Initiates the deletion process.
   - **Reject**: Provides a reason (e.g., legal hold, active services).
4. System writes an audit log entry for each admin action ([BR-20]).

## Exception Flows

### EX-25-1 — Active Servers (Deletion Blocked)
- System displays: "You have X active server(s). Please delete all servers before requesting account deletion." ([BR-63])

### EX-25-2 — Request Already Pending
- System displays: "You already have a pending [export/deletion] request. It will be processed soon."

### EX-25-3 — Export Generation Failed
- System updates `GdprRequest.status = FAILED`.
- Admin is notified. Customer is notified to try again.

---

# UC-26: Manage Tags

| Attribute                 | Value                                                                               |
|---------------------------|-------------------------------------------------------------------------------------|
| UC ID                     | UC-26                                                                               |
| UC Name                   | Manage Tags                                                                         |
| Actor(s)                  | Customer (authenticated)                                                            |
| Priority                  | Low                                                                                 |
| Trigger                   | Customer navigates to Tags management page or a server detail page                  |
| Pre-conditions            | Customer is logged in (valid JWT).                                                  |
| Post-conditions (success) | Tag created, edited, deleted, or assigned to/removed from servers.                  |
| Post-conditions (failure) | No state change. Error displayed.                                                   |
| Business Rules            | None specific                                                                       |
| Related UCs               | UC-01 (create server), UC-04 (list servers)                                         |

## Main Flow

### List Tags

1. Customer navigates to the Tags management page (or sees their tag collection in the server list sidebar).
2. System queries all `VpsTag` records belonging to the customer.
3. System displays each tag with:
   - **Name**
   - **Color** (hex color swatch)
   - **Server count** (how many servers have this tag assigned)
   - **Actions**: Edit, Delete

### Create Tag

1. Customer clicks **Create Tag**.
2. Customer enters:
   - **Name** (required, max 32 characters)
   - **Color** (optional, color picker or hex input, e.g., "#FF5733")
3. Customer clicks **Save**.
4. System validates:
   - Tag name is not empty.
   - Tag name is unique for this customer (same tag name can exist for different customers).
5. System creates a `VpsTag` record.

### Edit Tag

1. Customer clicks **Edit** on a tag.
2. Customer modifies the name or color.
3. Customer clicks **Save**.
4. System validates name uniqueness.
5. System updates the `VpsTag` record.

### Delete Tag

1. Customer clicks **Delete** on a tag.
2. System prompts: "Remove tag '[name]'? It will be removed from all servers."
3. Customer confirms.
4. System deletes all `ServerTag` join records for this tag.
5. System deletes the `VpsTag` record.

### Assign Tag to Server

1. Customer navigates to a server's detail page or selects a server in the dashboard.
2. Customer opens the tag assignment dropdown/menu.
3. Customer selects an existing tag from the list (or creates a new one inline).
4. System creates a `ServerTag` join record linking the server and tag.
5. The tag appears as a colored chip on the server card/row.

### Remove Tag from Server

1. Customer clicks the **×** on a tag chip on a server.
2. System deletes the `ServerTag` join record.
3. The tag chip is removed (the tag itself still exists for use on other servers).

## Alternative Flows

### 26a — Inline Tag Creation
- During tag assignment, if the desired tag does not exist, customer can type a new name and color inline to create and assign in one step.

### 26b — Bulk Tag Assignment
- Customer selects multiple servers in the dashboard (checkboxes).
- Customer opens the bulk action menu and selects "Assign Tag."
- System creates `ServerTag` records for all selected servers.

## Exception Flows

### EX-26-1 — Duplicate Tag Name
- System displays: "You already have a tag with this name." (Unique per customer.)

### EX-26-2 — Invalid Color
- System displays: "Please enter a valid hex color code (e.g., #FF5733)."

---

# Recovery Sequence Diagrams

## EX-07-3: Worker Crash After Docker Deletion (Distributed State Recovery)

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

# UC-27: Manage Private Networks

| Attribute                 | Value                                                                                         |
|---------------------------|-----------------------------------------------------------------------------------------------|
| UC ID                     | UC-27                                                                                         |
| UC Name                   | Manage Private Networks                                                                       |
| Actor(s)                  | Customer (authenticated)                                                                      |
| Priority                  | Medium                                                                                        |
| Trigger                   | Customer navigates to Networking > Private Networks                                           |
| Pre-conditions            | Customer is logged in (valid JWT).                                                            |
| Post-conditions (success) | Private network created/deleted, server attached/detached with auto-assigned private IP.      |
| Post-conditions (failure) | No state change. Error displayed.                                                             |
| Business Rules            | BR-71, BR-72, BR-73, BR-74, BR-17a, BR-19                                                     |
| Related UCs               | UC-01 (create server), UC-04 (list servers), UC-28 (manage floating IPs)                      |

## Main Flow

### List Private Networks

1. Customer navigates to Networking > Private Networks.
2. System queries all `PrivateNetwork` records belonging to the customer.
3. System displays a table:
   - **Name**
   - **Region** ([BR-71])
   - **CIDR Range** ([BR-72])
   - **Attached Servers** (count + hostname list)
   - **Created date**
   - **Actions**: View, Delete

### Create Private Network

1. Customer clicks **Create Private Network**.
2. Customer fills in:
   - **Name** (required, unique per customer).
   - **Region** (dropdown, only regions enabled for this account).
   - **CIDR Range** (dropdown of available non-overlapping blocks configured by admin, [BR-72]).
3. Customer clicks **Create**.
4. System validates:
   - CIDR block is within the region's available ranges and does not overlap with any existing private network in that region ([BR-72]).
   - Name is unique for this customer.
5. System creates a `PrivateNetwork` record.
6. System writes an audit log entry ([BR-19]).

### View Private Network Detail

1. Customer clicks a private network from the list.
2. System displays:
   - **Network details**: name, region, CIDR, created date.
   - **Attached servers** table: hostname, private IP ([BR-74]), status, attached date, detach action.

### Attach Server to Private Network

1. From the private network detail page, customer clicks **Attach Server**.
2. System displays a dropdown of this customer's servers in the same region that are not already attached to any private network ([BR-73]).
3. Customer selects a server and clicks **Attach**.
4. System validates:
   - Server is in the same region as the private network ([BR-71]).
   - Server is not already attached to a private network ([BR-73]).
   - Server is not locked by another async operation — the `lockedBy` field is checked atomically ([BR-17a]).
5. System assigns a **private IP** from the network's CIDR range ([BR-74]):
   - Finds the first available IP in the CIDR block.
   - Creates a `PrivateNetworkMember` record with the assigned IP.
6. System enqueues an attach job to BullMQ:
   - Worker creates a virtual NIC on the server's Docker container with the assigned private IP.
7. System returns `202 Accepted`.
8. Worker completes the attach and updates the record.
9. System writes an audit log entry ([BR-19]).

### Detach Server from Private Network

1. From the private network detail page, customer clicks **Detach** on a server.
2. System prompts: "Detach [hostname] from this private network? Its private IP will be released."
3. Customer confirms.
4. System validates the server is not locked ([BR-17a]).
5. System enqueues a detach job to BullMQ:
   - Worker removes the virtual NIC from the container.
6. System releases the private IP back to the network's pool ([BR-74]).
7. System deletes the `PrivateNetworkMember` record.
8. System writes an audit log entry ([BR-19]).

### Delete Private Network

1. Customer clicks **Delete** on a private network with zero attached servers.
2. System prompts: "Delete private network '[name]'? This action cannot be undone."
3. Customer confirms.
4. System validates no servers are still attached.
5. System deletes the `PrivateNetwork` record.
6. System writes an audit log entry ([BR-19]).

## Alternative Flows

### 27a — Inline Attach During Server Creation
- During UC-01 step 3 (region selection), if the region has private networks owned by the customer, an optional "Attach to Private Network" dropdown appears.
- System attaches the server to the selected network during provisioning (parallel to step 13 of UC-01).

## Exception Flows

### EX-27-1 — Server Already Attached
- System displays: "This server is already attached to a private network. Detach it first." ([BR-73])

### EX-27-2 — Region Mismatch
- Server is in a different region than the private network.
- System displays: "Server must be in the same region as the private network." ([BR-71])

### EX-27-3 — Network Has Attached Servers (Delete Blocked)
- System displays: "Cannot delete a private network with attached servers. Detach all servers first."

### EX-27-4 — CIDR Conflict
- System displays: "This CIDR range overlaps with an existing private network in this region." ([BR-72])

### EX-27-5 — Server Locked
- System returns `409 CONFLICT` with the active operation name. ([BR-17a])

### EX-27-6 — CIDR Exhausted
- No free private IPs remain in the network's CIDR range.
- System displays: "No available IP addresses in this network's range. Contact support to expand the CIDR block."

---

# UC-28: Manage Floating IPs

| Attribute                 | Value                                                                                         |
|---------------------------|-----------------------------------------------------------------------------------------------|
| UC ID                     | UC-28                                                                                         |
| UC Name                   | Manage Floating IPs                                                                           |
| Actor(s)                  | Customer (authenticated)                                                                      |
| Priority                  | Medium                                                                                        |
| Trigger                   | Customer navigates to Networking > Floating IPs                                               |
| Pre-conditions            | Customer is logged in (valid JWT).                                                            |
| Post-conditions (success) | Floating IP allocated, assigned, reassigned, or released. Atomic transfer between servers.    |
| Post-conditions (failure) | No state change. Error displayed.                                                             |
| Business Rules            | BR-75, BR-76, BR-77, BR-16a, BR-17a, BR-19                                                    |
| Related UCs               | UC-01 (create server), UC-04 (list servers), UC-27 (manage private networks)                  |

## Main Flow

### List Floating IPs

1. Customer navigates to Networking > Floating IPs.
2. System queries all `FloatingIp` records belonging to the customer.
3. System displays a table:
   - **IP Address**
   - **Region**
   - **Assigned Server** (hostname or "Unassigned")
   - **Assigned date**
   - **Created date**
   - **Actions**: Assign, Reassign, Release

### Allocate Floating IP

1. Customer clicks **Allocate Floating IP**.
2. Customer selects a **region**.
3. Customer clicks **Allocate**.
4. System validates the region is available for this account ([BR-09]).
5. System selects an available public IP from the region's floating IP pool and allocates it atomically ([BR-16a], [BR-75]).
6. System creates a `FloatingIp` record with `assignedServerId = null`.
7. System returns the allocated IP address.
8. System writes an audit log entry ([BR-19]).

### Assign Floating IP to Server

1. Customer clicks **Assign** on an unassigned floating IP.
2. System displays a dropdown of the customer's servers in the same region.
3. Customer selects a server and clicks **Assign**.
4. System validates:
   - Server is in the same region as the floating IP.
   - Server is not locked ([BR-17a]).
   - Floating IP is not already assigned ([BR-75]).
5. System performs an **atomic assignment**:
   - Conditional UPDATE on `FloatingIp` row: `WHERE id = :fipId AND assignedServerId IS NULL` → sets `assignedServerId`.
   - If no row updated (concurrent assignment), return `409 CONFLICT`.
6. System enqueues a floating IP bind job to BullMQ:
   - Worker configures the floating IP as a secondary IP on the server's network interface.
7. System returns `202 Accepted`.
8. Worker completes the bind and updates the record.
9. System writes an audit log entry ([BR-19]).

### Reassign Floating IP Between Servers (Atomic Transfer)

1. Customer clicks **Reassign** on an assigned floating IP.
2. System displays a dropdown of eligible servers in the same region (excluding the current server).
3. Customer selects the target server and clicks **Reassign**.
4. System validates:
   - Target server is in the same region as the floating IP.
   - Neither source nor target server is locked ([BR-17a]).
5. System performs an **atomic transfer** ([BR-76]):
   - Conditional UPDATE on `FloatingIp`: `WHERE id = :fipId AND assignedServerId = :oldServerId` → sets `assignedServerId = :newServerId`.
   - If no row updated, return `409 CONFLICT`.
   - The IP is never simultaneously assigned to both servers.
6. System enqueues a transfer job to BullMQ:
   - Worker unbinds the floating IP from the old server's interface.
   - Worker binds the floating IP to the new server's interface.
   - The IP is never accessible from both servers simultaneously ([BR-76]).
7. System returns `202 Accepted`.
8. System writes an audit log entry ([BR-19]).

### Release Floating IP

1. Customer clicks **Release** on a floating IP.
2. System prompts: "Release floating IP [address]? You will lose this IP and it will return to the public pool."
3. Customer confirms.
4. System validates the assigned server is not locked ([BR-17a]).
5. System enqueues a release job to BullMQ:
   - Worker unbinds the floating IP from the server (if assigned).
   - Worker returns the IP to the region's floating IP pool.
6. System deletes the `FloatingIp` record.
7. System writes an audit log entry ([BR-19]).
8. Billing for this floating IP stops.

## Alternative Flows

### 28a — Auto-Assign During Server Creation
- Optionally allocate and assign a floating IP during UC-01 server creation (step 3 region selection).
- System creates the floating IP and assigns it in the same provisioning job.

## Exception Flows

### EX-28-1 — Floating IP Already Assigned
- System displays: "This floating IP is already assigned to another server." ([BR-75])

### EX-28-2 — Region Mismatch
- System displays: "Server must be in the same region as the floating IP."

### EX-28-3 — Concurrent Assignment Conflict
- Another request assigned the floating IP between when the customer loaded the page and submitted.
- System returns `409 CONFLICT` and refreshes the page.

### EX-28-4 — No Floating IPs Available in Region
- System displays: "No floating IPs are currently available in this region. Please try again later."

### EX-28-5 — Server Locked
- System returns `409 CONFLICT` with the active operation name. ([BR-17a])

---

# UC-29: Manage Block Volumes

| Attribute                 | Value                                                                                         |
|---------------------------|-----------------------------------------------------------------------------------------------|
| UC ID                     | UC-29                                                                                         |
| UC Name                   | Manage Block Volumes                                                                          |
| Actor(s)                  | Customer (authenticated)                                                                      |
| Priority                  | Medium                                                                                        |
| Trigger                   | Customer navigates to Storage > Block Volumes                                                 |
| Pre-conditions            | Customer is logged in (valid JWT). Account balance is sufficient for the first billing period.|
| Post-conditions (success) | Block volume created, attached, detached, resized, or deleted.                                |
| Post-conditions (failure) | No state change. Error displayed.                                                             |
| Business Rules            | BR-78, BR-79, BR-80, BR-81, BR-82, BR-17a, BR-19, BR-27                                       |
| Related UCs               | UC-01 (create server), UC-04 (list servers), UC-10 (wallet)                                   |

## Main Flow

### List Block Volumes

1. Customer navigates to Storage > Block Volumes.
2. System queries all `BlockVolume` records belonging to the customer.
3. System displays a table:
   - **Name**
   - **Size** (GB)
   - **Region** ([BR-78])
   - **Status** (CREATING, AVAILABLE, ATTACHED, DETACHING, RESIZING, ERROR, DELETED)
   - **Attached Server** (hostname or "Unattached")
   - **Device Path** (e.g., `/dev/sdb`)
   - **Created date**
   - **Actions**: Attach, Detach, Resize, Delete

### Create Block Volume

1. Customer clicks **Create Volume**.
2. Customer fills in:
   - **Name** (required, unique per customer).
   - **Region** (dropdown, [BR-78]).
   - **Size** (GB, 1–16384 per [BR-79]).
3. Customer clicks **Create**.
4. System validates:
   - Account balance is sufficient for at least the first hour of billing ([BR-27], [BR-82]).
   - Size is within limits ([BR-79]).
5. System creates a `BlockVolume` record with `status = CREATING`.
6. System enqueues a volume creation job to BullMQ.
7. System returns `202 Accepted` with the `volumeId`.
8. Worker picks up the job:
   - Executes `docker volume create` on a storage node in the selected region with labels: `astral-volume-id=<volumeId>`, `astral-user-id=<userId>`.
   - Updates `BlockVolume`: `status = AVAILABLE`, `dockerVolumeName`, `nodeId`.
   - Writes an audit log entry ([BR-19]).
   - Deducts the first hour's billing from the wallet ([BR-82], [BR-27]).
9. System sends a notification upon completion.

### Attach Volume to Server

1. Customer clicks **Attach** on an available volume (`status = AVAILABLE`).
2. System displays a dropdown of this customer's servers in the same region.
3. Customer selects a server and clicks **Attach**.
4. System validates:
   - Volume is in the same region as the server ([BR-78]).
   - Volume is not already attached to any server ([BR-80]).
   - Server status is `ACTIVE` or `STOPPED` ([BR-80]).
   - Server is not locked — the `lockedBy` field is checked atomically ([BR-17a]).
5. System performs an **atomic lock+assign**:
   - Conditional UPDATE on `BlockVolume`: `WHERE id = :volId AND status = 'AVAILABLE' AND assignedServerId IS NULL` → sets `assignedServerId`, `status = ATTACHED`.
6. System enqueues an attach job to BullMQ.
7. System returns `202 Accepted`.
8. Worker:
   - Binds the Docker volume to the server's container (or schedules for next container start if server is `STOPPED`).
   - Assigns a device path (e.g., `/dev/sdb`) based on the server's available device slots.
   - Updates `BlockVolume.devicePath`.
9. System writes an audit log entry ([BR-19]).

### Detach Volume from Server

1. Customer clicks **Detach** on an attached volume (`status = ATTACHED`).
2. System prompts: "Detaching a volume while the server is running may cause data loss if the volume is in use. Ensure the volume is unmounted inside the server first."
3. Customer confirms.
4. System validates the server is not locked ([BR-17a]).
5. System updates `BlockVolume.status = DETACHING`.
6. System enqueues a detach job to BullMQ.
7. Worker:
   - Unbinds the Docker volume from the container.
   - Updates `BlockVolume`: `status = AVAILABLE`, `assignedServerId = null`, `devicePath = null`.
8. System writes an audit log entry ([BR-19]).

### Force Detach Volume

1. If the server is unreachable or the volume cannot be unmounted normally, customer clicks **Force Detach**.
2. System displays a stronger warning: "Force detach may cause data corruption. Only use if normal detach fails."
3. Customer types the volume name and confirms.
4. Worker forcibly removes the volume binding from the Docker host.
5. Volume status is set to `AVAILABLE` with a `forceDetached` flag in the audit log.

### Resize Volume

1. Customer clicks **Resize** on a volume (`status = AVAILABLE`).
2. Customer enters a **new size** (must be larger than current per [BR-79]).
3. Customer clicks **Resize**.
4. System validates the new size is ≥ current size ([BR-79]).
5. System enqueues a resize job to BullMQ.
6. Worker:
   - Resizes the underlying Docker volume (filesystem expand).
   - Updates `BlockVolume.sizeMB`.
7. System writes an audit log entry ([BR-19]).
8. Billing adjusts to the new size ([BR-82]).

### Delete Volume

1. Customer clicks **Delete** on a volume with `status = AVAILABLE`.
2. System prompts: "Delete volume '[name]'? All data will be permanently lost."
3. Customer types the volume name and confirms.
4. System enqueues a deletion job to BullMQ.
5. Worker:
   - Executes `docker volume rm` to remove the volume from the storage node.
   - Soft-deletes the `BlockVolume` record.
   - Writes an audit log entry ([BR-19]).
6. Billing for this volume stops.

## Alternative Flows

### 29a — Attach During Server Creation
- During UC-01, customer can select an existing available volume to auto-attach post-provisioning.

### 29b — Volume Creation Failure Recovery
- If the Docker volume creation job fails, worker updates status to `ERROR` and alerts admin.
- Customer sees: "Volume creation failed. Please try again."
- No billing charges applied for failed creations.

## Exception Flows

### EX-29-1 — Volume Not Available
- System displays: "This volume cannot be attached because it is not in an available state."

### EX-29-2 — Region Mismatch
- System displays: "Volume and server must be in the same region." ([BR-78])

### EX-29-3 — Volume Already Attached
- System returns `409 CONFLICT`: "This volume is already attached to another server." ([BR-80])

### EX-29-4 — Server Locked
- System returns `409 CONFLICT` with the active operation name. ([BR-17a])

### EX-29-5 — Volume Not Detached (Delete Blocked)
- System displays: "You must detach the volume before deleting it." ([BR-81])

### EX-29-6 — Resize Below Current Size
- System displays: "New size must be larger than the current size. Volumes can only be resized upward." ([BR-79])

### EX-29-7 — Insufficient Balance
- System displays: "Insufficient balance to create a volume of this size." ([BR-27])

### EX-29-8 — Server Must Be ACTIVE or STOPPED
- System displays: "Volumes can only be attached to servers that are running or stopped." ([BR-80])

---

# UC-30: Use Cloud-init

| Attribute                 | Value                                                                                         |
|---------------------------|-----------------------------------------------------------------------------------------------|
| UC ID                     | UC-30                                                                                         |
| UC Name                   | Use Cloud-init                                                                                |
| Actor(s)                  | Customer (authenticated)                                                                      |
| Priority                  | Medium                                                                                        |
| Trigger                   | Customer provides a cloud-init script during server creation (UC-01)                          |
| Pre-conditions            | Customer is logged in. Server creation flow is in progress.                                   |
| Post-conditions (success) | Cloud-init script validated, stored, and executed exactly once on first boot.                 |
| Post-conditions (failure) | Script rejected with validation error. Server creation proceeds without cloud-init.           |
| Business Rules            | BR-83, BR-84                                                                                  |
| Related UCs               | UC-01 (create server)                                                                         |

## Main Flow

1. During server creation (UC-01, between step 6 and step 7), customer clicks **Advanced Options > Cloud-init**.
2. System displays a text editor for the cloud-init script with syntax highlighting.
3. Customer pastes or writes a cloud-init (user-data) script in YAML format.
4. Customer optionally selects a **template** from a list of common scripts (e.g., "Install Docker", "Setup LAMP Stack", "Create User").
5. Customer clicks **Validate** (optional, before final submission).
6. System performs validation:
   - **Size check**: Script must not exceed 64 KB ([BR-84]).
   - **Syntax check**: YAML parser validates the structure. Valid cloud-init directives (e.g., `#cloud-config` header, `packages`, `runcmd`, `write_files`, `users`) are recognized. Basic YAML syntax errors are caught.
   - System displays validation results inline: "Syntax OK" or "Error on line 12: invalid YAML indentation."
7. Customer clicks **Create** (UC-01 step 7).
8. System stores the cloud-init script alongside the server creation request.
9. During provisioning (UC-01 step 13), the worker:
   - Passes the cloud-init script to the container via a mounted config drive or environment variable.
   - Docker/cloud-init executes the script **exactly once** on first boot ([BR-83]).
10. After the container boots, the worker writes an audit log entry ([BR-19]) recording that cloud-init was executed.
11. On subsequent server starts (UC-05), the cloud-init script does not re-run ([BR-83]).

## Alternative Flows

### 30a — Cloud-init Script Preview
- Customer can see a rendered preview of the script with variable placeholders resolved (e.g., `$HOSTNAME`, `$PUBLIC_IP` are shown as literal values).

### 30b — View Execution Log
- After the server is active, customer navigates to Server > Cloud-init Log.
- System fetches `/var/log/cloud-init-output.log` from the container.
- Customer can view the output to verify their script ran correctly.

### 30c — Skip Validation
- Customer clicks **Skip Validation** and the script is accepted as-is, provided it does not exceed 64 KB ([BR-84]).
- Syntax errors during execution are logged and visible in the cloud-init log (30b).

## Exception Flows

### EX-30-1 — Script Exceeds Size Limit
- System displays: "Cloud-init script exceeds the maximum size of 64 KB. Please reduce the script size." ([BR-84])

### EX-30-2 — YAML Syntax Error
- System displays: "Invalid YAML syntax at line [N]: [error message]. Please correct the script."
- The **Validate** button highlights the error. Customer can still skip and create the server (the script will fail at boot).

### EX-30-3 — Cloud-init Execution Failure
- The script fails during first boot (non-zero exit code).
- System does not revert the server — the server remains ACTIVE.
- The failure is logged in the cloud-init log (accessible via 30b).
- System sends a notification: "Cloud-init script completed with errors. View the execution log for details."

---

# UC-31: Manage Webhooks

| Attribute                 | Value                                                                                         |
|---------------------------|-----------------------------------------------------------------------------------------------|
| UC ID                     | UC-31                                                                                         |
| UC Name                   | Manage Webhooks                                                                               |
| Actor(s)                  | Customer (authenticated)                                                                      |
| Priority                  | Low                                                                                           |
| Trigger                   | Customer navigates to Settings > Webhooks                                                     |
| Pre-conditions            | Customer is logged in (valid JWT).                                                            |
| Post-conditions (success) | Webhook endpoint created, updated, deleted. Delivery history viewable.                        |
| Post-conditions (failure) | No state change. Error displayed.                                                             |
| Business Rules            | BR-88, BR-89, BR-90, BR-91                                                                    |
| Related UCs               | UC-01 (create server), UC-05 (start server), UC-06 (stop server), UC-07 (delete server), UC-13 (backups), UC-10 (wallet) |

## Main Flow

### List Webhook Endpoints

1. Customer navigates to Settings > Webhooks.
2. System queries all `WebhookEndpoint` records belonging to the customer.
3. System displays a table:
   - **URL**
   - **Events** (subscribed event types)
   - **Status** (ACTIVE, DISABLED)
   - **Last delivery** timestamp + status
   - **Created date**
   - **Actions**: View deliveries, Edit, Delete

### Create Webhook Endpoint

1. Customer clicks **Create Webhook**.
2. Customer fills in:
   - **URL** (HTTPS required, validated for reachability).
   - **Events** (multi-select checkboxes from [BR-91]):
     - `server.created`, `server.started`, `server.stopped`, `server.deleted`
     - `backup.completed`, `backup.failed`
     - `payment.succeeded`, `payment.failed`
   - **Description** (optional).
3. Customer clicks **Create**.
4. System validates:
   - URL is a valid HTTPS URL.
   - Customer has fewer than 10 endpoints ([BR-88]).
5. System generates a **signing secret** (cryptographically random, displayed once).
6. System creates a `WebhookEndpoint` record with `status = ACTIVE`.
7. System sends a **test ping** to the endpoint to verify reachability:
   - HTTP POST with a `ping` event type and HMAC-SHA256 signature.
   - If the endpoint returns 2xx, the endpoint is marked as verified.
   - If the endpoint fails, the endpoint is still created but shows a warning: "Could not verify endpoint. Deliveries may fail."

### Update Webhook Endpoint

1. Customer clicks **Edit** on an endpoint.
2. Customer can modify: URL, events, description.
3. Customer clicks **Save**.
4. System validates and updates the record.
5. If the URL changed, system sends a new test ping.

### Delete Webhook Endpoint

1. Customer clicks **Delete** on an endpoint.
2. System prompts: "Delete this webhook endpoint? All pending deliveries will be cancelled."
3. Customer confirms.
4. System deletes the `WebhookEndpoint` record.
5. System cancels any pending retries for this endpoint.

### View Delivery History

1. Customer clicks **View Deliveries** on an endpoint.
2. System queries all `WebhookDelivery` records for this endpoint, ordered by `createdAt` descending.
3. System displays a paginated table:
   - **Event Type** (e.g., `server.created`)
   - **Target URL**
   - **Status** (SUCCESS, FAILED, PENDING)
   - **Response Code** (e.g., 200, 500, timeout)
   - **Attempts** (1/3)
   - **Delivered at**
   - **Actions**: View payload, Retry

### View Delivery Payload

1. Customer clicks a delivery to expand its details.
2. System displays:
   - **Request headers** (including `X-Astral-Signature`).
   - **Request body** (JSON payload).
   - **Response headers** and **response body** from the endpoint.
   - **Attempt history** (timestamps, response codes for each retry).

### Retry Failed Delivery

1. Customer clicks **Retry** on a failed delivery.
2. System re-enqueues the webhook delivery job to BullMQ.
3. The retry follows the same exponential backoff schedule ([BR-89]).

### Rotate Signing Secret

1. Customer clicks **Rotate Secret** on an endpoint.
2. System warns: "Rotating the secret will invalidate the current secret immediately. Update your receiving server."
3. Customer confirms.
4. System generates a new secret and displays it once.

## System Flow: Webhook Delivery

1. When a subscribed event occurs (e.g., `server.created`), the system enqueues a webhook delivery job to BullMQ.
2. Worker picks up the job:
   - Constructs the payload (event type, timestamp, resource data).
   - Signs the payload with HMAC-SHA256 using the endpoint's secret ([BR-90]).
   - Sends an HTTP POST to the endpoint URL with the `X-Astral-Signature` header.
3. If the endpoint responds with 2xx, the delivery is marked `SUCCESS`.
4. If the endpoint responds with non-2xx or times out (10s timeout), the delivery is retried up to 3 times with exponential backoff: 1s, 5s, 25s ([BR-89]).
5. After 3 failed attempts, the delivery is marked `FAILED`.
6. System does not retry further unless manually triggered by the customer.

## Alternative Flows

### 31a — Disable/Re-enable Endpoint
- Customer can toggle an endpoint's status between ACTIVE and DISABLED.
- Disabled endpoints do not receive any deliveries.
- Pending deliveries for a disabled endpoint are cancelled.
- Re-enabling sends a test ping.

### 31b — Bulk Event Subscription
- Customer can toggle "All Server Events" or "All Payment Events" to select/deselect groups of events at once.

## Exception Flows

### EX-31-1 — Endpoint Limit Reached
- System displays: "You have reached the maximum of 10 webhook endpoints. Delete an existing endpoint first." ([BR-88])

### EX-31-2 — Invalid URL
- System displays: "Please enter a valid HTTPS URL."

### EX-31-3 — Test Ping Failed
- System displays a warning: "Could not verify endpoint. The endpoint returned [status code]." Endpoint is still created.

---

# UC-32: View Bandwidth Usage

| Attribute                 | Value                                                                                         |
|---------------------------|-----------------------------------------------------------------------------------------------|
| UC ID                     | UC-32                                                                                         |
| UC Name                   | View Bandwidth Usage                                                                          |
| Actor(s)                  | Customer (authenticated)                                                                      |
| Priority                  | Low                                                                                           |
| Trigger                   | Customer navigates to a server detail page > Bandwidth tab                                    |
| Pre-conditions            | Customer is logged in. Server belongs to customer.                                            |
| Post-conditions (success) | Bandwidth graphs displayed. Allowance vs usage shown. Overage warnings issued.                |
| Post-conditions (failure) | Error displaying graphs.                                                                      |
| Business Rules            | BR-85, BR-86, BR-87                                                                           |
| Related UCs               | UC-01 (create server), UC-04 (list servers), UC-18 (notifications)                            |

## Main Flow

### View Bandwidth Graph

1. Customer navigates to a server detail page > Bandwidth tab.
2. System queries the bandwidth usage metrics for this server from the time-series data store.
3. System renders an interactive graph:
   - **X-axis**: time (hourly or daily granularity, [BR-86]).
   - **Y-axis**: bandwidth (in GB or Mbps).
   - **Two lines/areas**: inbound traffic, outbound traffic.
   - **Overlay line**: monthly allowance cap ([BR-85]).
4. Customer can toggle between:
   - **Hourly view** (last 24 hours, 1-hour granularity, [BR-86]).
   - **Daily view** (last 30 days, daily aggregation).
   - **Monthly view** (last 12 months, monthly aggregation).
5. Customer can hover over data points to see exact values.

### View Allowance Summary

1. Above the graph, system displays a summary card:
   - **Monthly Allowance**: [X] GB (derived from ServerPlan `bandwidthMbps`, [BR-85]).
   - **Used This Month**: [Y] GB ([Y/X]%).
   - **Remaining**: [X−Y] GB.
   - **Overage Rate**: $[Z]/GB (if applicable).
2. A progress bar shows used vs remaining with color coding:
   - Green: < 60%
   - Yellow: 60–80%
   - Orange: 80–100%
   - Red: > 100%

### View Usage Breakdown

1. Below the graph, system displays a table of daily usage totals:
   - **Date**
   - **Inbound** (GB)
   - **Outbound** (GB)
   - **Total** (GB)
2. Rows exceeding the daily prorated allowance are highlighted.

### Receive Overage Warnings

1. System monitors bandwidth consumption in near real-time ([BR-86]).
2. At **80%** of monthly allowance, system generates an in-app notification: "Server '[hostname]' has used 80% of its monthly bandwidth allowance." ([BR-87])
3. At **100%** of monthly allowance, system generates a second notification: "Server '[hostname]' has exceeded its monthly bandwidth allowance. Overage charges now apply at $[Z]/GB." ([BR-87])
4. These are non-critical notifications — customer may opt out per [BR-58].
5. If the customer exceeds 150% of allowance without action, a critical notification is sent (cannot opt out, per [BR-59]).

## Alternative Flows

### 32a — Multi-Server Aggregate View
- From the main Bandwidth page (not server-specific), customer sees an aggregate graph combining all servers' bandwidth usage.
- Each server is a separate line on the graph.
- Total aggregate allowance vs usage is displayed.

### 32b — Export CSV
- Customer clicks **Export** to download the bandwidth data as a CSV file for the selected time range.

## Exception Flows

### EX-32-1 — Metrics Unavailable
- If the time-series data store is unreachable, system displays: "Bandwidth data is temporarily unavailable. Please try again later."

### EX-32-2 — No Data
- If the server was just created or has zero traffic, system displays: "No bandwidth data available yet. Data will appear once your server processes traffic."

---

# UC-33: Use CLI Tool

| Attribute                 | Value                                                                                         |
|---------------------------|-----------------------------------------------------------------------------------------------|
| UC ID                     | UC-33                                                                                         |
| UC Name                   | Use CLI Tool                                                                                  |
| Actor(s)                  | Customer (developer/operator)                                                                 |
| Priority                  | Low                                                                                           |
| Trigger                   | Customer installs and configures the Astral Cloud CLI                                         |
| Pre-conditions            | Customer has an active account with at least one API key (UC-09).                             |
| Post-conditions (success) | CLI authenticated and executing commands for server, volume, and DNS management.              |
| Post-conditions (failure) | Command fails with error message. Authentication rejected.                                    |
| Business Rules            | BR-92, BR-26                                                                                  |
| Related UCs               | UC-09 (manage API keys), UC-01 (create server), UC-15 (DNS management), UC-29 (manage block volumes) |

## Main Flow

### Install CLI

1. Customer visits the CLI documentation page or GitHub releases.
2. Customer downloads the CLI binary for their OS/architecture (Linux, macOS, Windows).
3. Customer installs the binary:
   - **Linux/macOS**: `curl -fsSL https://cli.astral.cloud/install.sh | bash` or manual download to `/usr/local/bin`.
   - **Windows**: Download `.exe` installer or use `winget`.
4. Customer verifies installation: `astral version`.

### Authenticate

1. Customer runs `astral auth login`.
2. CLI prompts: "Enter your API key:" (masked input).
3. Customer enters their API key (created via UC-09).
4. CLI sends a validation request to `GET /api/v1/auth/verify` with the API key as a Bearer token ([BR-92]).
5. On success, CLI stores the API key in a local config profile (`~/.config/astral/config.yaml`) ([BR-92]).
6. CLI displays: "Authenticated as [username]."
7. On failure, CLI displays: "Authentication failed. Check your API key and try again."

### Manage Multiple Profiles

1. Customer runs `astral auth login --profile production` to create a named profile.
2. Customer switches profiles: `astral auth use production`.
3. CLI commands use the active profile's API key.

### Commands: Server Management

1. **List servers**: `astral server list`
   - Flags: `--status`, `--region`, `--tag`, `--limit`, `--json`
   - Output: table (default) or JSON.

2. **Create server**: `astral server create`
   - Required flags: `--plan`, `--image`, `--region`, `--hostname`
   - Optional flags: `--ssh-key`, `--voucher`, `--billing`, `--tags`, `--cloud-init`, `--private-network`, `--floating-ip`
   - Output: server ID, IP address, credentials (if password auth).

3. **Start/Stop/Delete server**: `astral server start|stop|delete <server-id-or-hostname>`
   - Confirmation prompt (skip with `--force`).

4. **SSH proxy**: `astral server ssh <server-id-or-hostname>`
   - CLI establishes an SSH connection to the server via an SSH proxy service.
   - If the customer has an SSH key configured, it is used automatically.
   - If password auth, CLI prompts for the password or auto-fills from known credentials.

5. **View server details**: `astral server info <server-id-or-hostname>`
   - Output: hostname, IP, status, plan, region, tags, created date, bandwidth usage.

### Commands: Volume Management

1. **List volumes**: `astral volume list` with flags: `--region`, `--status`, `--json`.
2. **Create volume**: `astral volume create --name <name> --size <GB> --region <region>`.
3. **Attach/Detach**: `astral volume attach|detach <volume-id> --server <server-id>`.
4. **Resize**: `astral volume resize <volume-id> --size <new-GB>`.
5. **Delete**: `astral volume delete <volume-id>` (with confirmation).

### Commands: DNS Management

1. **List DNS records**: `astral dns list --server <server-id>`.
2. **Create record**: `astral dns create --server <server-id> --type A --name www --value <ip> --ttl 3600`.
3. **Update record**: `astral dns update <record-id> --value <new-value>`.
4. **Delete record**: `astral dns delete <record-id>`.

### Commands: General

1. **View account**: `astral account info` — displays username, balance, server count, plan.
2. **View billing**: `astral billing history` — paginated billing history.
3. **Help**: `astral help [command]` — shows command usage and examples.
4. **Output format**: All list commands support `--json` for programmatic use and `--table` (default) for human-readable output.

## Alternative Flows

### 33a — Non-Interactive Mode
- All commands support `--api-key <key>` flag for CI/CD pipelines, bypassing the config profile.
- Commands support `--no-confirm` to skip confirmation prompts.

### 33b — Shell Completion
- Customer runs `astral completion bash|zsh|fish` to generate shell auto-completion scripts.

## Exception Flows

### EX-33-1 — Authentication Failed
- CLI displays: "Authentication failed. Verify your API key is active and not expired." ([BR-92])

### EX-33-2 — Rate Limited
- CLI receives `429 Too Many Requests` and displays: "Rate limit exceeded. Please wait [N] seconds." ([BR-26])

### EX-33-3 — Invalid Command
- CLI displays the help text for the command with valid subcommands and examples.

### EX-33-4 — Network Error
- CLI displays: "Could not connect to Astral Cloud API. Check your internet connection."

---

# UC-34: Use Terraform Provider

| Attribute                 | Value                                                                                         |
|---------------------------|-----------------------------------------------------------------------------------------------|
| UC ID                     | UC-34                                                                                         |
| UC Name                   | Use Terraform Provider                                                                        |
| Actor(s)                  | DevOps Engineer, Customer (authenticated via API key)                                         |
| Priority                  | Low                                                                                           |
| Trigger                   | DevOps engineer writes Terraform configuration (HCL) referencing the Astral Cloud provider    |
| Pre-conditions            | Customer has an active account with at least one API key (UC-09). Terraform is installed.     |
| Post-conditions (success) | Infrastructure declared in HCL is planned and applied against the Astral Cloud API.           |
| Post-conditions (failure) | Plan fails validation or apply is rejected with API error.                                    |
| Business Rules            | BR-93, BR-26                                                                                  |
| Related UCs               | UC-09 (manage API keys), UC-01 (create server), UC-15 (DNS management), UC-27 (private networks), UC-28 (floating IPs), UC-29 (block volumes) |

## Main Flow

### Configure Provider

1. DevOps engineer creates a `main.tf` file.
2. DevOps engineer configures the Astral Cloud provider:

```hcl
terraform {
  required_providers {
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

### Declare Resources

1. DevOps engineer declares resources in HCL:

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

### Plan Infrastructure

1. DevOps engineer runs `terraform plan`.
2. Terraform reads the HCL configuration.
3. The Astral Cloud provider calls read-only API endpoints to determine current state ([BR-93]):
   - `GET /api/v1/servers` to list existing servers.
   - `GET /api/v1/floating-ips` to list floating IPs.
   - `GET /api/v1/volumes` to list volumes.
   - (No internal/privileged endpoints — all calls use the same public REST API.)
4. Provider computes the diff between desired state (HCL) and current state (API).
5. Terraform outputs the execution plan:
   - Resources to create: `+`
   - Resources to modify: `~`
   - Resources to destroy: `-`

### Apply Infrastructure

1. DevOps engineer runs `terraform apply`.
2. Terraform prompts for confirmation (skip with `-auto-approve`).
3. The provider calls the Astral Cloud API in dependency order:
   - Creates `astral_private_network` first (no dependencies).
   - Creates `astral_server` (depends on network).
   - Creates `astral_floating_ip` (depends on server).
   - Creates `astral_block_volume` and attaches it (depends on server).
   - Creates `astral_dns_record` (depends on floating IP).
   - Creates `astral_firewall_rule` (depends on server).
4. API calls are subject to the same rate limits (60 req/min per API key) as any other API request ([BR-26], [BR-93]).
5. Provider handles `202 Accepted` responses for async operations (server creation, volume creation) by polling for completion.
6. Provider writes the resource IDs to the Terraform state file (`terraform.tfstate`).

### Destroy Infrastructure

1. DevOps engineer runs `terraform destroy`.
2. Terraform destroys resources in reverse dependency order.
3. All API calls use the standard public endpoints ([BR-93]).

### Import Existing Resources

1. DevOps engineer runs `terraform import astral_server.web <server-id>`.
2. The provider fetches current resource state from the API and populates the Terraform state file.

## Alternative Flows

### 34a — Terraform Cloud / CI/CD
- The API key is injected via Terraform Cloud workspace variables or CI/CD secrets.
- `terraform plan` runs on PR; `terraform apply` runs on merge to main.

### 34b — Module Reuse
- DevOps engineer defines reusable Terraform modules encapsulating common patterns (e.g., "web server with floating IP and DNS").

## Exception Flows

### EX-34-1 — Provider Authentication Failed
- Terraform displays: "Error: authentication failed. Verify your API key."
- `terraform plan` or `apply` aborts with exit code 1.

### EX-34-2 — API Rate Limit
- Provider backs off and retries with exponential backoff.
- If all retries exhausted, Terraform displays: "Error: rate limit exceeded. Try again in [N] seconds." ([BR-26])

### EX-34-3 — Resource Already Exists
- Terraform displays: "Error: A server with hostname '[name]' already exists in your account."

### EX-34-4 — Async Operation Timed Out
- Provider polls for status up to a configurable timeout (default: 5 minutes).
- On timeout, Terraform displays: "Error: Operation timed out waiting for resource to become ready."

### EX-34-5 — State Drift
- Running `terraform plan` detects resources manually modified outside Terraform (e.g., server deleted via UI).
- Terraform displays the drift in the plan output; customer can reconcile by re-applying.

---

# UC-35: Set Spending Cap

| Attribute                 | Value                                                                                         |
|---------------------------|-----------------------------------------------------------------------------------------------|
| UC ID                     | UC-35                                                                                         |
| UC Name                   | Set Spending Cap                                                                              |
| Actor(s)                  | Customer (authenticated)                                                                      |
| Priority                  | Medium                                                                                        |
| Trigger                   | Customer navigates to Billing > Spending Cap                                                  |
| Pre-conditions            | Customer is logged in (valid JWT).                                                            |
| Post-conditions (success) | Monthly spending cap configured. Resource creation blocked when reached.                      |
| Post-conditions (failure) | Cap not set. Error displayed.                                                                 |
| Business Rules            | BR-112, BR-27                                                                                 |
| Related UCs               | UC-01 (create server), UC-10 (wallet), UC-29 (manage block volumes)                           |

## Main Flow

### Configure Spending Cap

1. Customer navigates to Billing > Spending Cap.
2. System displays:
   - **Current cap status**: "No cap set" or the current cap amount.
   - **Current month spend**: total charges this billing cycle.
   - **Projected month spend**: extrapolated from current burn rate.
3. Customer enters a **monthly spending cap** in USD (positive number, or 0 to disable).
4. Customer clicks **Save**.
5. System validates the cap amount is a positive number (or 0).
6. System stores the cap in the `User` record (`monthlySpendingCap`).
7. System writes an audit log entry.

### Cap Enforcement

1. When a customer attempts to create a server (UC-01) or a block volume (UC-29), the system checks:
   - `currentMonthSpend + estimatedNewResourceCost > monthlySpendingCap`
   - Estimated cost is the first billing period charge: 1 hour for hourly, 1 month for monthly.
2. If the cap **would be exceeded**:
   - System blocks the creation and displays: "Monthly spending cap of $[X] would be exceeded. Current spend: $[Y]. This resource would add $[Z]/[period]. Increase your cap or wait until next billing cycle." ([BR-112])
3. Existing servers continue to run and incur charges even if the cap is exceeded ([BR-112]).
   - The cap only blocks **new** resource creation.
   - Auto-deductions for existing resources are not affected.
4. System sends an in-app notification when the cap is reached.

### View Cap Usage

1. Customer navigates to Billing > Spending Cap.
2. System displays a progress bar:
   - **Spent this month**: $[Y]
   - **Cap**: $[X]
   - **Percentage**: [Y/X]%
3. Color coding: green (< 60%), yellow (60–80%), orange (80–100%), red (reached).
4. When the cap is reached, a banner appears on the dashboard: "Monthly spending cap reached. New resource creation is blocked until the next billing cycle."

### Modify or Remove Cap

1. Customer changes the cap amount and clicks **Save**.
2. If the cap is increased, blocked resources can now be created.
3. If the cap is removed (set to 0), all restrictions are lifted.

## Alternative Flows

### 35a — Cap Warning Threshold
- Customer can configure an optional warning threshold (e.g., 80% of cap).
- System sends an in-app notification when this threshold is reached, before the hard cap blocks creation.

## Exception Flows

### EX-35-1 — Invalid Cap Amount
- System displays: "Please enter a valid positive number or 0 to disable the cap."

### EX-35-2 — Resource Creation Blocked
- System displays: "Monthly spending cap of $[X] reached ($[Y] spent). New resource creation is blocked." ([BR-112])

---

# UC-36: Annual Prepayment

| Attribute                 | Value                                                                                         |
|---------------------------|-----------------------------------------------------------------------------------------------|
| UC ID                     | UC-36                                                                                         |
| UC Name                   | Annual Prepayment                                                                             |
| Actor(s)                  | Customer (authenticated)                                                                      |
| Priority                  | Low                                                                                           |
| Trigger                   | Customer selects annual billing during server creation or switches an existing server         |
| Pre-conditions            | Customer is logged in. Server is on a monthly billing plan. Wallet balance covers annual cost.|
| Post-conditions (success) | Server switched to annual billing with 20% discount applied. Prepayment deducted.             |
| Post-conditions (failure) | Switch not made. No charges. Error displayed.                                                 |
| Business Rules            | BR-113, BR-27, BR-28                                                                          |
| Related UCs               | UC-01 (create server), UC-10 (wallet)                                                         |

## Main Flow

### Select Annual Billing at Server Creation

1. During server creation (UC-01 step 6), customer selects the **Annual** billing model alongside Monthly and Hourly options.
2. System calculates the annual price:
   - Annual base cost = monthly price × 12.
   - Discount = annual base cost × 20% ([BR-113]).
   - Annual prepay amount = annual base cost − discount.
3. System displays a comparison:
   - Monthly: $[X]/month × 12 = $[12X]/year
   - Annual: $[12X] − 20% = $[9.6X]/year (save $[2.4X])
4. System validates the wallet balance covers the full annual prepay amount ([BR-27]).
5. System deducts the annual prepay amount from the wallet and applies the 20% discount ([BR-113]):
   - A `ServerBilling` record is created for the annual term.
   - Each month, the system credits 1/12 of the discount to the wallet billing entry for accounting purposes.
6. System continues the server creation flow (UC-01 step 7+).

### Switch Existing Server to Annual Billing

1. Customer navigates to a server detail page > Billing.
2. If the server is on a **monthly** plan, the system displays an "Switch to Annual — Save 20%" option.
3. Customer clicks **Switch to Annual**.
4. System displays the pro-rated calculation:
   - Remaining months in current annual period (prorated).
   - Discount calculation.
5. Customer confirms.
6. System deducts the prorated annual amount from the wallet.
7. System updates `ServerBilling.model = ANNUAL` and sets `nextBillingAt` to 12 months from now.
8. System writes an audit log entry ([BR-19]).
9. The 20% discount is applied to each billing month going forward ([BR-113]).

### View Annual Billing Status

1. Customer navigates to the server detail page > Billing.
2. System displays:
   - **Billing model**: Annual (20% discount)
   - **Prepaid through**: [date]
   - **Monthly equivalent**: $[X]/month (after discount)
   - **Saved this year**: $[Y]

## Alternative Flows

### 36a — Annual Auto-Renewal
- 30 days before the annual term expires, system sends a renewal reminder.
- Customer can enable auto-renewal: system automatically deducts the next year's prepayment at the current rate.

## Exception Flows

### EX-36-1 — Insufficient Balance for Annual Prepayment
- System displays: "Insufficient balance. The annual prepayment is $[X]. Your current balance is $[Y]. Add funds to continue." ([BR-27])

### EX-36-2 — Early Cancellation
- Customer deletes (UC-07) a server on annual billing before the year is complete.
- System processes early cancellation ([BR-113]):
  - Calculates the prorated refund for unused full months remaining.
  - Forfeits the remaining 20% discount for the cancelled period ([BR-113]).
  - Refunds the prorated unused months (at the discounted rate) to the wallet.
  - Displays a breakdown: "Refund: $[X] for [N] unused months. Forfeited discount: $[Y]."
- Customer confirms and the server is deleted.

### EX-36-3 — Already on Annual Plan
- System hides the "Switch to Annual" option and displays: "This server is already on an annual billing plan."

---

# UC-37: Abuse Reporting

| Attribute                 | Value                                                                                          |
|---------------------------|------------------------------------------------------------------------------------------------|
| UC ID                     | UC-37                                                                                          |
| UC Name                   | Abuse Reporting                                                                                |
| Actor(s)                  | Visitor (unauthenticated), Customer (authenticated, reporter); Staff, Admin (processor)        |
| Priority                  | Medium                                                                                         |
| Trigger                   | Reporter submits an abuse report via the abuse reporting page or email                         |
| Pre-conditions            | None (reporter). Staff must be logged in for processing.                                       |
| Post-conditions (success) | Abuse report logged and reviewed. Validated reports lead to server suspension. Resolved.       |
| Post-conditions (failure) | Report dismissed as invalid. Server unchanged.                                                 |
| Business Rules            | BR-107, BR-115, BR-19, BR-20                                                                   |
| Related UCs               | UC-04 (list servers), UC-06 (stop server), UC-07 (delete server), UC-24 (platform management)  |

## Main Flow

### Submit Abuse Report (Reporter)

1. Reporter navigates to `/abuse` or clicks "Report Abuse" from the footer/contact page.
2. Reporter fills in the abuse report form:
   - **Reporter name** (optional for authenticated customers, auto-filled).
   - **Reporter email** (required for visitors; auto-filled for authenticated customers).
   - **Abuse type** (dropdown: DMCA/Copyright, Spam, Malware/Phishing, Crypto Mining, DDoS Origin, Harassment, Other).
   - **Offending server IP or hostname** (required).
   - **Description** (required, detailed explanation of the abuse).
   - **Evidence** (optional file uploads: screenshots, logs, headers, DMCA takedown notice PDF).
3. Reporter completes a CAPTCHA (for unauthenticated submissions).
4. Reporter clicks **Submit**.
5. System creates an `AbuseReport` record with:
   - `status = PENDING_REVIEW`
   - `reportedAt = now`
   - All submitted fields.
   - If authenticated, `reporterUserId` is set.
6. System displays: "Your abuse report has been submitted. Our team will review it within 24 hours." ([BR-115])

### Staff Review Abuse Queue

1. Staff navigates to Admin > Abuse Reports.
2. System displays a queue of all `AbuseReport` records, ordered by priority and report date:
   - **Report #**
   - **Type** (with severity: DMCA = HIGH, Spam = MEDIUM, etc.)
   - **Offending IP/Hostname** (with link to server if identified)
   - **Reporter** (name/email)
   - **Status** (PENDING_REVIEW, INVESTIGATING, VALIDATED, DISMISSED, SUSPENDED, RESOLVED)
   - **Reported date**
   - **SLA remaining** (24h from submission, [BR-115])
3. Staff can filter by status, type, and date range.

### Investigate and Validate

1. Staff clicks a report to view details:
   - Full report content, evidence files, reporter info.
   - **Server lookup**: System attempts to match the reported IP/hostname to a `ServerInstance` record.
   - If matched, displays: server owner, server status, creation date, related tickets/previous reports.
2. Staff investigates the claim:
   - Reviews evidence.
   - May verify the offending server directly (access logs, open ports, running processes via the admin console).
   - Adds **internal notes** to the report.
3. Staff selects an action:
   - **Validate**: Abuse confirmed — proceeds to "Suspend Server."
   - **Dismiss**: Abuse not confirmed or insufficient evidence — report closed.
4. System writes an audit log entry for the staff action ([BR-20]).

### Dismiss Report

1. Staff clicks **Dismiss**.
2. Staff selects a **dismissal reason**: INSUFFICIENT_EVIDENCE, NOT_ABUSE, DUPLICATE, OUT_OF_SCOPE.
3. Staff optionally writes a note (visible only internally).
4. System updates `AbuseReport.status = DISMISSED`.
5. System optionally sends an email to the reporter (if email provided): "Your report #[N] has been reviewed and no abuse was confirmed."
6. System writes an audit log entry ([BR-20]).

### Suspend Server

1. Staff clicks **Validate & Suspend**.
2. System displays a confirmation: "Suspend server '[hostname]' owned by [username]? The server will be stopped and the customer notified."
3. Staff confirms and optionally writes a **suspension reason** that will be shown to the customer.
4. System:
   - Updates `ServerInstance.status = SUSPENDED`.
   - Enqueues a stop job to BullMQ: worker stops the Docker container with a suspension label.
   - Sends a critical notification to the server owner: "Your server '[hostname]' has been suspended due to an abuse report. Reason: [reason]. You have 48 hours to respond." ([BR-115], [BR-59])
   - Writes an audit log entry ([BR-19], [BR-20]).
5. System starts a 48-hour response timer ([BR-115]).

### Resolve Abuse Case

1. After the 48-hour period, or upon customer response, staff reviews the case.
2. Staff selects a resolution:
   - **Resolved — Customer Remedied**: Customer removed the offending content/activity. Server is unsuspended.
   - **Resolved — Server Deleted**: Abuse not remedied, server is permanently deleted ([BR-115]).
   - **Resolved — With Warning**: Minor infraction, server unsuspended with a warning on the account.
3. System processes the resolution:
   - If **unsuspend**: Enqueues a start job, sets server status back to previous state.
   - If **delete**: Initiates server deletion (UC-07).
   - Updates `AbuseReport.status = RESOLVED` with resolution details.
   - Notifies the server owner and the reporter (if applicable).
   - Writes audit log entries ([BR-19], [BR-20]).

## Alternative Flows

### 37a — DMCA Counter-Notice
- Server owner submits a DMCA counter-notice within the 48-hour window.
- Staff reviews the counter-notice. If valid, the server is unsuspended.
- The original reporter is notified of the counter-notice per DMCA process.

### 37b — Bulk Abuse from Single Server
- If multiple abuse reports target the same server, they are linked and reviewed as a single case.

### 37c — Automated Spam Detection
- System may auto-flag servers with high outbound SMTP traffic for manual abuse review.

## Exception Flows

### EX-37-1 — Server Not Found
- The reported IP/hostname does not match any server in the system.
- Staff marks the report as DISMISSED with reason: "Server not found in our system."
- Reporter is notified: "The reported IP/hostname does not belong to our platform."

### EX-37-2 — Report Already Pending
- System detects a duplicate report for the same IP within 7 days.
- The new report is linked to the existing case; the reporter receives: "This server is already under investigation."

### EX-37-3 — SLA Breach
- A report remains PENDING_REVIEW for > 24 hours ([BR-115]).
- System escalates the report and sends an admin alert: "Abuse report #[N] has exceeded the 24-hour SLA."

### EX-37-4 — Customer No-Response
- 48 hours pass without customer response ([BR-115]).
- System auto-escalates: the server is automatically deleted. Staff is notified.

---

# UC-38: Accept Terms

| Attribute                 | Value                                                                                         |
|---------------------------|-----------------------------------------------------------------------------------------------|
| UC ID                     | UC-38                                                                                         |
| UC Name                   | Accept Terms of Service & Privacy Policy                                                      |
| Actor(s)                  | New User (unauthenticated → authenticated), Existing User (authenticated)                     |
| Priority                  | High                                                                                          |
| Trigger                   | New user attempts to create first server; existing user logs in after terms update            |
| Pre-conditions            | New user has registered. Existing user has not yet accepted the latest terms version.         |
| Post-conditions (success) | Terms accepted record created. Server creation unblocked (new user). Session proceeds (existing).|
| Post-conditions (failure) | Terms not accepted. Server creation blocked. User redirected to terms page.                   |
| Business Rules            | BR-105                                                                                        |
| Related UCs               | UC-01 (create server), UC-02 (register), UC-03 (login)                                        |

## Main Flow

### New User Accepts Terms

1. After registration (UC-02), the new user is redirected to the dashboard.
2. When the user clicks "Create Server" for the first time, the system checks: `Has the user accepted the current ToS version?`
3. If not, the system redirects to the Terms Acceptance page instead of the server creation form.
4. The page displays:
   - **Terms of Service** (full text, scrollable).
   - **Privacy Policy** (full text, scrollable).
   - Two checkboxes: "I have read and agree to the Terms of Service" and "I have read and agree to the Privacy Policy."
5. User scrolls to the bottom of each document (scroll detection enables the checkboxes).
6. User checks both boxes and clicks **Accept**.
7. System creates a `TermsAcceptance` record:
   - `userId`, `termsVersion` (current version string), `privacyPolicyVersion` (current version string), `acceptedAt`, `ipAddress`.
8. System writes an audit log entry ([BR-19]).
9. System redirects the user back to their intended destination.

### Existing User Re-accepts Updated Terms

1. Admin publishes a new version of the Terms of Service or Privacy Policy ([BR-105]).
2. On the next login (UC-03), after JWT issuance, the system checks: `user.latestAcceptedTermsVersion < currentTermsVersion`.
3. If true, the system displays an interstitial page: "Our Terms of Service have been updated. Please review and accept the changes to continue."
4. The page highlights **what changed** (diff view of the updated sections).
5. User scrolls through the updated terms, checks the acceptance boxes, and clicks **Accept**.
6. System creates a new `TermsAcceptance` record with the new version ([BR-105]).
7. System writes an audit log entry ([BR-19]).
8. User proceeds to the dashboard.

### View Acceptance History

1. User navigates to Profile > Legal.
2. System displays all `TermsAcceptance` records for this user:
   - **Terms version**, **Privacy Policy version**, **Accepted date**, **IP address**.

## Alternative Flows

### 38a — Bypass for API Requests
- API-authenticated requests (API keys, CLI, Terraform) are not subject to the terms acceptance interstitial.
- However, new API keys cannot be generated until terms are accepted (the API Keys page is behind the acceptance check).

### 38b — Admin Pre-Acceptance
- Admin sets the `currentTermsVersion` and `currentPrivacyPolicyVersion` in System Settings.
- Admin can preview the acceptance page before publishing.

## Exception Flows

### EX-38-1 — Terms Not Accepted (Server Creation Blocked)
- System displays: "You must accept the Terms of Service and Privacy Policy before creating your first server." ([BR-105])
- The "Create" button is disabled with a link to the terms page.

### EX-38-2 — Single Checkbox Not Checked
- System displays: "You must accept both the Terms of Service and Privacy Policy to continue."

---

# UC-39: Cookie Consent

| Attribute                 | Value                                                                                         |
|---------------------------|-----------------------------------------------------------------------------------------------|
| UC ID                     | UC-39                                                                                         |
| UC Name                   | Cookie Consent                                                                                |
| Actor(s)                  | Visitor (unauthenticated)                                                                     |
| Priority                  | Medium                                                                                        |
| Trigger                   | EU visitor lands on any page of the Astral Cloud website for the first time                   |
| Pre-conditions            | Visitor has not previously accepted or declined cookies (or consent has expired after 12 months). IP geolocation indicates EU region (or visitor self-identifies). |
| Post-conditions (success) | Consent preferences stored. Appropriate cookies set. Banner dismissed.                        |
| Post-conditions (failure) | Consent not stored. Only essential cookies set. Banner remains.                              |
| Business Rules            | BR-106                                                                                        |
| Related UCs               | None                                                                                          |

## Main Flow

### Cookie Banner Display

1. A visitor (EU IP address detected via geolocation, or flagged by browser DNT/GPC signals) navigates to any page on `astral.cloud`.
2. System checks for an existing `CookieConsent` record (via a consent cookie or localStorage).
   - If consent exists and is < 12 months old ([BR-106]): no banner. Proceed to step 5.
   - If no consent or expired: display the cookie banner.
3. System renders a cookie consent banner at the bottom of the page:
   - **Text**: "We use cookies to improve your experience. Essential cookies are required for the site to function. You may accept all cookies or customize your preferences."
   - **Buttons**: "Accept All", "Customize", "Reject Non-Essential".
   - **Link**: "Cookie Policy" (full page).

### Accept All Cookies

1. Visitor clicks **Accept All**.
2. System sets a `CookieConsent` record (or cookie): `preferences = ALL`, `acceptedAt = now`, `expiresAt = now + 12 months` ([BR-106]).
3. System sets all cookies: essential (auth, CSRF) + analytics + marketing.
4. Banner disappears.

### Customize Preferences

1. Visitor clicks **Customize**.
2. System expands the banner (or opens a modal) with cookie categories:
   - **Essential** (locked ON, cannot be disabled): Session authentication, CSRF token, cookie consent itself. ([BR-106])
   - **Analytics** (toggleable): Google Analytics, Plausible, or self-hosted analytics — page views, referral data.
   - **Marketing** (toggleable): Ad tracking pixels, retargeting.
3. Each category shows a description of what data is collected and for what purpose.
4. Visitor toggles categories ON/OFF and clicks **Save Preferences**.
5. System sets a `CookieConsent` record: `preferences = CUSTOM`, analytics = true/false, marketing = true/false, `expiresAt = now + 12 months`.
6. System sets only the approved cookie categories.
7. Banner disappears.

### Reject Non-Essential Cookies

1. Visitor clicks **Reject Non-Essential**.
2. System sets a `CookieConsent` record: `preferences = ESSENTIAL_ONLY`, `expiresAt = now + 12 months` ([BR-106]).
3. System sets only essential cookies ([BR-106]).
4. Banner disappears.

### Revisit Preferences

1. At any time, the visitor can click "Cookie Settings" in the footer.
2. System re-opens the preference modal showing current choices.
3. Visitor can change preferences and save.
4. System updates the `CookieConsent` record.

### Consent Expiry

1. After 12 months from acceptance, consent expires ([BR-106]).
2. On the next visit, the banner is re-displayed and the visitor must re-consent.
3. Previously set non-essential cookies are cleared.

## Alternative Flows

### 39a — Non-EU Visitor
- System detects non-EU IP via geolocation.
- Essential cookies are set immediately.
- Non-essential cookies are set immediately (subject to browser settings).
- No consent banner is displayed by default (a smaller "We use cookies" notice with a link to Cookie Policy may appear).

### 39b — Global Privacy Control (GPC) Signal
- Browser sends `Sec-GPC: 1` header or `navigator.globalPrivacyControl` is set.
- System treats this as "Reject Non-Essential" by default, regardless of IP region.
- The cookie banner still appears but "Reject Non-Essential" is pre-selected.

## Exception Flows

### EX-39-1 — Consent Storage Failure
- If the consent cookie/localStorage write fails (blocked by browser settings):
  - System logs a warning.
  - Essential cookies still function.
  - Banner reappears on next page load.

### EX-39-2 — Geolocation Unavailable
- If the IP geolocation service is unreachable, system defaults to showing the consent banner (conservative approach).

---

# UC-40: Admin Impersonation

| Attribute                 | Value                                                                                         |
|---------------------------|-----------------------------------------------------------------------------------------------|
| UC ID                     | UC-40                                                                                         |
| UC Name                   | Admin Impersonation                                                                           |
| Actor(s)                  | Admin (authenticated, role = ADMIN)                                                           |
| Priority                  | Medium                                                                                        |
| Trigger                   | Admin navigates to a user detail page and clicks "Impersonate"                                |
| Pre-conditions            | Admin is logged in. 2FA must be enabled ([BR-24]). Target user exists and is not an admin.    |
| Post-conditions (success) | Admin is logged in as the target user. Visual banner displayed. Full audit trail recorded.    |
| Post-conditions (failure) | Impersonation not started. Error logged.                                                      |
| Business Rules            | BR-109, BR-20                                                                                 |
| Related UCs               | UC-24 (platform management), UC-03 (login)                                                    |

## Main Flow

### Initiate Impersonation

1. Admin navigates to Admin > Users and clicks on a target user.
2. On the user detail page, admin clicks **Impersonate**.
3. System displays a confirmation dialog: "You are about to log in as [username]. All actions you take will be recorded in the audit log under both your account and the target user's account. Are you sure?"
4. Admin clicks **Confirm**.
5. System validates:
   - Admin has 2FA enabled ([BR-24]).
   - Target user is not an ADMIN (admin-to-admin impersonation is blocked).
6. System creates an **impersonation session**:
   - Generates a new JWT access token with:
     - `sub = targetUserId` (target user ID).
     - `impersonatedBy = adminUserId` (admin's user ID).
     - `sessionType = IMPERSONATION`.
     - Short expiry (15 minutes, [BR-109]).
   - Creates an `ImpersonationSession` record: `adminUserId`, `targetUserId`, `startedAt`, `ipAddress`.
   - Writes an audit log entry: action = `IMPERSONATION_START`, actor = adminUserId, target = targetUserId ([BR-20], [BR-109]).
7. System sets the impersonation token as the active session.

### Viewing the UI as Target User

1. Admin is redirected to the target user's dashboard (UC-04).
2. A **persistent visual banner** is rendered at the top of every page ([BR-109]):
   - Yellow/amber background stripe.
   - Text: "You are impersonating **[username]**. All actions are audited. [End Impersonation]"
   - The banner cannot be dismissed.
3. Every API request made during the impersonation session is tagged with the impersonation context.
4. All audit log entries written during the session record both the impersonated user and the admin ([BR-109], [BR-19]).

### Perform Actions

1. Admin can navigate the UI as the target user: view servers, create servers, manage volumes, view billing, etc.
2. Each state-changing action generates an audit log entry with:
   - `actorUserId = targetUserId` (the impersonated account).
   - `impersonatedByUserId = adminUserId` (the admin who initiated).
   - `sessionType = IMPERSONATION`.
3. Admin cannot access admin-only pages while impersonating — attempts redirect to the target user's dashboard.

### End Impersonation

1. Admin clicks **End Impersonation** in the yellow banner.
2. OR impersonation session expires after 15 minutes ([BR-109]).
3. System:
   - Invalidates the impersonation JWT.
   - Updates `ImpersonationSession.endedAt = now`.
   - Writes an audit log entry: action = `IMPERSONATION_END`, actor = adminUserId, target = targetUserId ([BR-20], [BR-109]).
   - Re-issues the admin's original session token.
4. Admin is redirected to the Admin Dashboard.

### View Impersonation Audit Trail

1. Admin navigates to Admin > Audit Logs.
2. Admin filters by action = IMPERSONATION_START, IMPERSONATION_END.
3. System displays all impersonation sessions:
   - **Admin**, **Target User**, **Started**, **Ended**, **Actions Performed** count.
4. Clicking a session shows every audit log entry generated during that session.

## Alternative Flows

### 40a — Impersonation Session Timeout
- If the admin is inactive for 15 minutes, the impersonation token expires.
- Admin sees: "Impersonation session expired. You have been returned to your admin account."
- Admin is redirected to the Admin Dashboard.

### 40b — Target User Self-Service Debug
- Not a true impersonation, but admin can view a "Login as user" preview that shows the rendered dashboard without the ability to perform actions (read-only mode).

## Exception Flows

### EX-40-1 — Target Is Admin
- System displays: "Cannot impersonate another admin user."

### EX-40-2 — Admin 2FA Not Enabled
- System displays: "You must enable two-factor authentication before using impersonation." ([BR-24])

### EX-40-3 — Concurrent Impersonation
- An admin already has an active impersonation session.
- System displays: "You have an active impersonation session for [username]. End it before starting a new one."

---

# UC-41: Manage Feature Flags

| Attribute                 | Value                                                                                         |
|---------------------------|-----------------------------------------------------------------------------------------------|
| UC ID                     | UC-41                                                                                         |
| UC Name                   | Manage Feature Flags                                                                          |
| Actor(s)                  | Admin (authenticated, role = ADMIN)                                                           |
| Priority                  | Medium                                                                                        |
| Trigger                   | Admin navigates to Admin > Feature Flags                                                      |
| Pre-conditions            | Admin is logged in. 2FA must be enabled ([BR-24]).                                            |
| Post-conditions (success) | Feature flag created, toggled, or configured. Audit log written.                              |
| Post-conditions (failure) | No state change. Error displayed.                                                             |
| Business Rules            | BR-110, BR-20                                                                                 |
| Related UCs               | UC-24 (platform management)                                                                   |

## Main Flow

### List Feature Flags

1. Admin navigates to Admin > Feature Flags.
2. System displays a table of all feature flags:
   - **Key** (unique identifier, e.g., `beta_dashboard`, `new_billing_ui`)
   - **Name** (human-readable)
   - **Description**
   - **Status** (ENABLED, DISABLED, CONDITIONAL)
   - **Rollout Rules**: per-user, per-role, percentage
   - **Last evaluated** (timestamp, [BR-110])
   - **Stale indicator** (⚠ if no evaluation in > 90 days, [BR-110])
   - **Created date**
   - **Actions**: Edit, Toggle, Delete

### Create Feature Flag

1. Admin clicks **Create Feature Flag**.
2. Admin fills in:
   - **Key** (unique, alphanumeric + underscores, e.g., `beta_dashboard`).
   - **Name** (human-readable label).
   - **Description** (explaining what the flag controls).
   - **Type** (BOOLEAN toggle or MULTIVARIATE with values).
3. Admin clicks **Create**.
4. System creates the `FeatureFlag` record with `enabled = false` by default.
5. System writes an audit log entry ([BR-20]).

### Configure Flag Rules

1. Admin clicks **Edit** on a feature flag.
2. Admin configures **rollout rules** ([BR-110]):
   - **Global toggle**: ON/OFF — overrides all other rules.
   - **Per-User**: Add specific user IDs or usernames to an allowlist or denylist.
   - **Per-Role**: Enable for CUSTOMER, STAFF, ADMIN roles individually.
   - **Percentage Rollout**: Enable for X% of users (deterministic hash of userId). Options: 1%, 5%, 10%, 25%, 50%, 75%, 100%.
3. Rules are evaluated in priority order:
   - Denylist (if user is denylisted → OFF).
   - Allowlist (if user is allowlisted → ON).
   - Role-based (if user's role matches → ON).
   - Percentage (hash(userId) % 100 < percentage → ON).
   - Default: OFF.
4. Admin saves the configuration.
5. System writes an audit log entry ([BR-20]).

### Toggle Feature Flag

1. Admin clicks the **Quick Toggle** on a flag to enable/disable globally.
2. This sets the global toggle and does not affect other rules.
3. System writes an audit log entry ([BR-20]).

### Delete Feature Flag

1. Admin clicks **Delete** on a flag that has been fully rolled out (100%) and had no evaluations in > 30 days.
2. System prompts: "Delete feature flag '[name]'? Ensure all code references to this flag have been removed."
3. Admin confirms.
4. System deletes the `FeatureFlag` record.
5. System writes an audit log entry ([BR-20]).

### System-Side Flag Evaluation

1. On every API request (or application startup for global flags), the system evaluates all active feature flags.
2. Each evaluation updates `lastEvaluatedAt` on the flag.
3. A cron job runs daily:
   - Identifies flags with `lastEvaluatedAt` older than 90 days ([BR-110]).
   - Sends an admin alert: "Feature flag '[key]' has not been evaluated in 90+ days. Consider removing it."

### View Flag Evaluation History

1. From the feature flag list, admin clicks **History** on a flag.
2. System displays a timeline of:
   - **Config changes** (who changed what and when).
   - **Evaluation count** (daily count of flag checks).
   - **Evaluation percentage** (what % of requests had the flag ON vs OFF).

## Alternative Flows

### 41a — Gradual Rollout Monitoring
- For percentage rollouts, admin can view a metrics dashboard showing:
  - Users with flag ON vs OFF.
  - Error rates, latency, or conversion rates split by flag state (requires integration with observability).

### 41b — Flag Dependencies
- A feature flag can reference a parent flag: "Only evaluate this flag if the parent flag is enabled."
- Useful for nested feature rollouts.

## Exception Flows

### EX-41-1 — Duplicate Key
- System displays: "A feature flag with this key already exists."

### EX-41-2 — Stale Flag Alert
- System alerts admin: "Feature flag '[key]' has not been evaluated in 90+ days." ([BR-110])

### EX-41-3 — Flag Not Found (Code)
- Application code references a feature flag that has been deleted.
- System defaults the flag to OFF and logs a warning: "Unknown feature flag: [key]."

---

# UC-42: Revenue Dashboard

| Attribute                 | Value                                                                                         |
|---------------------------|-----------------------------------------------------------------------------------------------|
| UC ID                     | UC-42                                                                                         |
| UC Name                   | Revenue Dashboard                                                                             |
| Actor(s)                  | Admin (authenticated, role = ADMIN)                                                           |
| Priority                  | Low                                                                                           |
| Trigger                   | Admin navigates to Admin > Revenue Dashboard                                                  |
| Pre-conditions            | Admin is logged in. 2FA must be enabled ([BR-24]). Billing data aggregation is up to date.    |
| Post-conditions (success) | Revenue metrics displayed with charts and summaries.                                          |
| Post-conditions (failure) | Error loading metrics.                                                                        |
| Business Rules            | BR-111, BR-94                                                                                 |
| Related UCs               | UC-10 (wallet), UC-11 (apply voucher), UC-21 (manage vouchers), UC-24 (platform management)   |

## Main Flow

### View MRR (Monthly Recurring Revenue)

1. Admin navigates to Admin > Revenue Dashboard.
2. System queries the billing aggregates (refreshed daily per [BR-111]) and displays:
   - **Current MRR**: Sum of all active monthly and annual billing subscriptions (annual shown as monthly equivalent).
   - **MRR Trend**: Line chart of MRR over the last 12 months.
   - **MRR Breakdown**: By plan (Starter, Pro, Enterprise, Custom), stacked bar chart.
   - **MRR Change**: Month-over-month growth (absolute $ and percentage).

### View Churn & Retention

1. System displays churn metrics:
   - **Monthly Churn Rate**: (Customers lost this month / Customers at start of month) × 100%.
   - **Revenue Churn**: MRR lost from cancellations vs MRR gained from new subscriptions.
   - **Net Revenue Retention**: (Existing MRR + Expansion − Contraction − Churn) / Existing MRR × 100%.
   - **Churn by Plan**: Churn rate broken down by plan tier.
   - **Churn by Cohort**: Retention curve showing what percentage of customers from each monthly cohort are still active after 1, 3, 6, 12 months.

### View Conversion Rates

1. System displays conversion metrics:
   - **Registration → First Server**: Percentage of registered users who create a first server within 7 days.
   - **Free Trial → Paid**: If trials are offered, conversion rate from trial to paying customer.
   - **Top-Up Conversion**: Percentage of users who add funds vs those who only browse.
   - **Top-Up Value Distribution**: Histogram of top-up amounts ($5, $10, $25, $50, $100+).

### View Voucher Performance

1. System displays voucher metrics ([BR-111]):
   - **Top Redeemed Vouchers**: Table of vouchers sorted by total redemptions (code, times used, total discount given, conversion rate).
   - **Voucher-Driven Revenue**: Revenue from payments where a voucher was applied.
   - **Voucher Redemption Trend**: Line chart of voucher redemptions per month.
   - **Voucher Stacking Rate**: Percentage of payments using multiple vouchers.

### View Server Metrics

1. System displays server counts by plan ([BR-111]):
   - **Total Active Servers**: Count with trend line.
   - **Servers by Plan**: Bar chart showing counts for Starter, Pro, Enterprise, Custom.
   - **Servers by Region**: Heatmap or bar chart showing distribution across data centers.
   - **Avg Server Lifetime**: Average duration between creation and deletion.

### View Revenue Summary

1. System displays a summary card at the top:
   - **Total Revenue (MTD)**: All payments this month.
   - **Total Revenue (YTD)**: All payments this year.
   - **Average Revenue Per User (ARPU)**: Total revenue / active users.
   - **Customer Lifetime Value (LTV)**: ARPU × average customer lifetime.
   - **Customer Acquisition Cost (CAC)**: (Marketing spend + sales cost) / new customers acquired ([BR-111]).

### Filter & Date Range

1. Admin can select:
   - **Date range**: Last 7 days, 30 days, 90 days, 12 months, custom range.
   - **Granularity**: Daily, weekly, monthly.
   - **Region**: Filter metrics by data center region.
   - **Plan**: Filter by ServerPlan.
2. All charts and metrics update to reflect the selected filters.

### Export Revenue Report

1. Admin clicks **Export Report**.
2. System generates a PDF or CSV summary of the dashboard data for the selected period.
3. The export includes all charts as images and raw data tables.

## Alternative Flows

### 42a — Real-Time Revenue Ticker
- Admin can toggle a real-time mode that shows revenue events as they happen (server creation, top-up, hourly deduction) in a scrolling ticker.

### 42b — Scheduled Revenue Report
- Admin configures a weekly or monthly email report with key metrics automatically generated and sent to admin/staff.

## Exception Flows

### EX-42-1 — Aggregation Not Ready
- Billing aggregation job is still running or has failed.
- System displays: "Revenue data is being refreshed. Some metrics may not reflect the latest transactions. Last refreshed: [timestamp]."

### EX-42-2 — No Data
- If the platform has no billing data (pre-launch), system displays: "No revenue data available yet."

---

# UC-43: Disaster Recovery Drill

| Attribute                 | Value                                                                                         |
|---------------------------|-----------------------------------------------------------------------------------------------|
| UC ID                     | UC-43                                                                                         |
| UC Name                   | Disaster Recovery Drill                                                                       |
| Actor(s)                  | Admin (authenticated, role = ADMIN)                                                           |
| Priority                  | High                                                                                          |
| Trigger                   | Scheduled quarterly DR drill (per [BR-98]) or admin-initiated manual drill                    |
| Pre-conditions            | Admin is logged in. 2FA is enabled ([BR-24]). Latest backup exists and is verified. Clean target environment is available. |
| Post-conditions (success) | Platform restored from backup to clean environment. RTO and RPO verified. Drill report filed.  |
| Post-conditions (failure) | Restoration failed. Root cause identified. Incident logged.                                   |
| Business Rules            | BR-97, BR-98, BR-99, BR-20                                                                    |
| Related UCs               | UC-24 (platform management), UC-20 (manage infrastructure)                                    |

## Main Flow

### Prepare DR Drill

1. Admin navigates to Admin > Disaster Recovery.
2. System displays the DR drill dashboard:
   - **Last drill date**: [timestamp]
   - **Next scheduled drill**: [date] (quarterly per [BR-98])
   - **Last backup**: [timestamp] (every 6 hours per [BR-98])
   - **Backup integrity**: VERIFIED / UNVERIFIED / FAILED
   - **Target environment**: Available / Unavailable
3. Admin clicks **Start DR Drill** (or the schedule triggers automatically).
4. System displays the DR runbook checklist ([BR-99]):
   - [ ] Notify team of upcoming drill.
   - [ ] Verify latest backup integrity.
   - [ ] Provision or confirm clean target environment.
   - [ ] Execute restore.
   - [ ] Verify platform functionality.
   - [ ] Measure RTO and RPO.
   - [ ] File drill report.
5. Admin confirms each pre-flight check.

### Verify Backup Integrity

1. System queries the latest database backup (full backup every 6 hours, point-in-time recovery per [BR-98]).
2. System verifies:
   - Backup file exists and is within expected size range.
   - Backup checksum matches the stored checksum.
   - Backup can be decrypted (if encrypted at rest).
3. System displays: "Backup integrity: VERIFIED. Backup timestamp: [timestamp]. Size: [X] GB."
4. If a full backup is not available (e.g., corrupted), system attempts the previous backup.
5. If no valid backup within 12 hours, the drill is aborted and admin is alerted.

### Provision Clean Environment

1. System uses infrastructure-as-code (Terraform) declarations to provision a clean environment ([BR-97]):
   - Compute instances for: Next.js app, BullMQ worker(s), PostgreSQL, Redis, Docker registry, storage services.
   - Network: VPC, subnets, security groups, load balancer.
   - The environment is isolated from production (no cross-environment traffic).
2. Admin can also manually provision or confirm an existing staging environment.
3. System confirms the target environment is ready.

### Execute Restore

1. Admin clicks **Execute Restore**.
2. System executes the documented restore procedure ([BR-98], [BR-99]):
   - **Database**: Restores the latest full backup to the clean PostgreSQL instance. Applies Write-Ahead Log (WAL) segments for point-in-time recovery to the latest available transaction. Runs all migrations to ensure schema is current.
   - **Redis**: Seeds from backup or starts fresh (session data is disposable).
   - **Object Storage**: Restores server images, backup archives, invoice PDFs from backup.
   - **Docker Registry**: Restores container image metadata.
   - **DNS / Configuration**: Configures application environment variables to point at the clean environment's services.
   - **Smoke Test Data**: Generates or restores anonymized test customer data for verification.
3. System starts the application stack: Next.js, workers, Nginx/WAF.
4. System runs database migrations to ensure schema is current.
5. System displays a live progress log of each restoration step.

### Verify Platform Functionality

1. Once the stack is running, the system executes automated verification checks:
   - **API health**: `GET /api/health` returns 200.
   - **Database connectivity**: Can query users, servers, and billing data.
   - **Authentication**: Can register a new user, log in, and receive a valid JWT.
   - **Server lifecycle**: Can create a test server (using a minimal test plan), start it, stop it, delete it.
   - **Billing**: Can look up wallet balances and payment history.
   - **Web UI**: Key pages render without errors (dashboard, server list, billing).
   - **Worker processing**: A test job is enqueued and processed by a BullMQ worker.
2. System reports each check as PASSED or FAILED.

### Measure RTO and RPO

1. System calculates:
   - **RTO (Recovery Time Objective)**: Time elapsed from "Execute Restore" click to "All verification checks passed." Target: ≤ 4 hours ([BR-98]).
   - **RPO (Recovery Point Objective)**: Difference between the last restored transaction timestamp and the time the drill started. Target: ≤ 6 hours ([BR-98]).
2. System displays:
   - **RTO**: [X] hours [Y] minutes (Target: ≤ 4h) — PASSED / FAILED
   - **RPO**: [X] hours [Y] minutes (Target: ≤ 6h) — PASSED / FAILED

### File Drill Report

1. System auto-generates a DR drill report:
   - **Drill date** and **participants**.
   - **Backup used**: timestamp, size, integrity check.
   - **Restoration steps log** (with timestamps for each step).
   - **Verification results** (checklist with pass/fail).
   - **RTO**: measured vs target.
   - **RPO**: measured vs target.
   - **Issues encountered** and **remediation notes**.
2. Admin adds manual notes and observations.
3. Admin clicks **File Report**.
4. System stores the `DrillReport` record and its PDF.
5. System writes an audit log entry ([BR-20]).
6. System sends the report to the admin team.

### Tear Down Clean Environment

1. Admin clicks **Tear Down Environment**.
2. System deprovisions all resources in the clean environment to avoid ongoing costs.
3. System confirms teardown and logs the event.

## Alternative Flows

### 43a — Partial Component Restoration
- Admin can drill a specific component (e.g., database only) instead of the full platform.
- Useful for testing specific recovery procedures without provisioning the full stack.

### 43b — Manual Drill
- Admin can initiate an unscheduled manual drill at any time.
- Same procedure as scheduled drill; documented as "unscheduled" in the report.

### 43c — Dry Run (Validation Only)
- Admin runs a "dry run" that verifies backup integrity and environment provisioning without actually restoring data.
- Confirms readiness without affecting any systems.

## Exception Flows

### EX-43-1 — Backup Corrupted
- Last backup fails integrity check.
- System displays: "Latest backup is corrupted. Attempting previous backup."
- If the previous backup is also corrupted, system alerts: "No valid backup within 12 hours. DR drill aborted." ([BR-98])
- Admin must investigate backup pipeline.

### EX-43-2 — Environment Provisioning Failed
- Target environment fails to provision (e.g., cloud provider capacity issues).
- System displays: "Failed to provision target environment. Reason: [error]. Drill aborted."
- Admin can retry with different region or instance types.

### EX-43-3 — RTO Exceeded
- Restoration takes longer than 4 hours ([BR-98]).
- System highlights this in red on the report: "RTO exceeded. Target: 4h, Actual: [X]h [Y]m."
- Admin adds root cause analysis to the report.

### EX-43-4 — RPO Exceeded
- Latest backup is older than 6 hours ([BR-98]).
- System highlights this in red: "RPO exceeded. Target: 6h, Actual: [X]h [Y]m."
- Indicates backup pipeline issues that need investigation.

### EX-43-5 — Verification Failure
- One or more automated checks fail.
- System displays the failed check with details.
- Admin can manually verify and override, or abort the drill.
- Failures are documented in the drill report.

### EX-43-6 — Drill In Progress
- A DR drill is already in progress.
- System displays: "A disaster recovery drill is already in progress. Started at [timestamp]."


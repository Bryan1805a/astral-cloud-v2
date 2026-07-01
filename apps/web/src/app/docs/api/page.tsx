export default function ApiPage() {
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">API Overview</h1>
      <p className="mt-4 text-lg text-gray-400">
        Astral Cloud is built API-first. The web dashboard, CLI tool, and Terraform
        provider all consume the same REST API. You can automate everything
        programmatically.
      </p>

      <Step heading="Authentication" id="authentication">
        <p>All API requests require authentication. Astral Cloud supports two methods:</p>

        <SubHeading>JWT Bearer Token</SubHeading>
        <p>
          After logging in, you receive an access token (valid for 1 hour) and a
          refresh token (7 days). Include the access token in API requests:
        </p>
        <div className="my-4 rounded-lg border border-gray-700 bg-gray-900 p-4">
          <code className="text-sm text-gray-300">
            Authorization: Bearer <span className="text-blue-400">eyJhbGciOiJIUzI1NiIs...</span>
          </code>
        </div>
        <p>
          When the access token expires, call <code>POST /api/auth/refresh</code>{" "}
          with your HTTP-only refresh token cookie to get a new access token without
          re-authenticating.
        </p>

        <SubHeading>API Key</SubHeading>
        <p>
          For programmatic access (CLI, CI/CD, Terraform), create an API key in{" "}
          <strong>Dashboard &rarr; API Keys</strong>. API keys inherit your user
          permissions and can optionally have an expiry date.
        </p>
        <div className="my-4 rounded-lg border border-gray-700 bg-gray-900 p-4">
          <code className="text-sm text-gray-300">
            Authorization: Bearer <span className="text-blue-400">ak_d7f3a1b2c4e5...</span>
          </code>
        </div>
        <p>
          The full key is shown only once at creation time. Store it securely.
          API key-authenticated requests are subject to the same rate limits as
          JWT requests (60 req/min per key).
        </p>
      </Step>

      <Step heading="Base URL &amp; Content Type" id="base">
        <div className="my-4 rounded-lg border border-gray-700 bg-gray-900 p-4">
          <code className="text-sm text-blue-400">https://your-domain.com/api</code>
        </div>
        <p>
          All requests use <code>Content-Type: application/json</code>. Request
          and response bodies are JSON.
        </p>
      </Step>

      <Step heading="Response Format" id="response-format">
        <SubHeading>Success</SubHeading>
        <div className="my-4 rounded-lg border border-gray-700 bg-gray-900 p-4">
          <code className="text-sm text-gray-300">
            {"{"}"data": {"{ }"} {"}"}
          </code>
        </div>
        <p>All successful responses are wrapped in a <code>data</code> envelope.</p>

        <SubHeading>Paginated Lists</SubHeading>
        <div className="my-4 rounded-lg border border-gray-700 bg-gray-900 p-4">
          <code className="text-sm text-gray-300">
            {"{"}
            <br />
            &nbsp;&nbsp;"data": [],
            <br />
            &nbsp;&nbsp;"meta": {"{"}
            <br />
            &nbsp;&nbsp;&nbsp;&nbsp;"page": 1,
            <br />
            &nbsp;&nbsp;&nbsp;&nbsp;"limit": 20,
            <br />
            &nbsp;&nbsp;&nbsp;&nbsp;"total": 142,
            <br />
            &nbsp;&nbsp;&nbsp;&nbsp;"totalPages": 8
            <br />
            &nbsp;&nbsp;{"}"}
            <br />
            {"}"}
          </code>
        </div>

        <SubHeading>Errors</SubHeading>
        <div className="my-4 rounded-lg border border-gray-700 bg-gray-900 p-4">
          <code className="text-sm text-gray-300">
            {"{"}"error": {"{"}"code": "<span className="text-red-400">VALIDATION_ERROR</span>", "message": "Human-readable description."{"}"}{"}"}
          </code>
        </div>
      </Step>

      <Step heading="Error Codes" id="error-codes">
        <div className="my-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-gray-400">
                <th className="py-2 pr-4 font-medium">HTTP Status</th>
                <th className="py-2 pr-4 font-medium">Code</th>
                <th className="py-2 font-medium">Meaning</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              {errors.map((e) => (
                <tr key={e.code} className="border-b border-gray-800/50">
                  <td className="py-2 pr-4">{e.status}</td>
                  <td className="py-2 pr-4">
                    <code className="text-xs text-red-400">{e.code}</code>
                  </td>
                  <td className="py-2">{e.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Step>

      <Step heading="Rate Limiting" id="rate-limiting">
        <ul>
          <li>Auth endpoints: 10 requests per minute per IP</li>
          <li>General API: 60 requests per minute per user</li>
          <li>Server creation: 5 requests per minute per user</li>
        </ul>
        <p>
          Rate limit headers are included in all responses. When exceeded, the API
          returns <code>429 Too Many Requests</code>.
        </p>
      </Step>

      <Step heading="Idempotency" id="idempotency">
        <p>
          Server creation supports idempotency via the{" "}
          <code>Idempotency-Key</code> header. Send a unique UUID with your
          creation request — if the request is retried with the same key within 24
          hours, the original response is returned without creating a duplicate
          server.
        </p>
        <div className="my-4 rounded-lg border border-gray-700 bg-gray-900 p-4">
          <code className="text-sm text-gray-300">
            Idempotency-Key: <span className="text-blue-400">550e8400-e29b-41d4-a716-446655440000</span>
          </code>
        </div>
      </Step>

      <Step heading="Endpoint Reference" id="endpoints">
        <div className="space-y-6">
          {endpointGroups.map((group) => (
            <div key={group.label}>
              <SubHeading>{group.label}</SubHeading>
              <div className="mt-2 space-y-1">
                {group.endpoints.map((ep) => (
                  <div key={ep.method + ep.path} className="flex items-center gap-2 text-sm">
                    <span className={`inline-block w-14 rounded px-1.5 py-0.5 text-center text-[11px] font-semibold ${methodColor(ep.method)}`}>
                      {ep.method}
                    </span>
                    <code className="text-gray-300">{ep.path}</code>
                    <span className="ml-auto text-xs text-gray-600">{ep.auth}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Step>
    </>
  );
}

function Step({ heading, id, children }: { heading: string; id: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="text-2xl font-bold tracking-tight" id={id}>
        {heading}
      </h2>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-gray-400">
        {children}
      </div>
    </section>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-6 text-base font-semibold text-gray-200">{children}</h3>
  );
}

function methodColor(method: string): string {
  const map: Record<string, string> = {
    GET: "bg-emerald-500/10 text-emerald-400",
    POST: "bg-blue-500/10 text-blue-400",
    PUT: "bg-amber-500/10 text-amber-400",
    DELETE: "bg-red-500/10 text-red-400",
  };
  return map[method] ?? "bg-gray-500/10 text-gray-400";
}

const errors = [
  { status: 400, code: "VALIDATION_ERROR", desc: "Input failed schema validation" },
  { status: 401, code: "UNAUTHORIZED", desc: "Missing or invalid access token" },
  { status: 401, code: "INVALID_CREDENTIALS", desc: "Email/password wrong" },
  { status: 401, code: "TOKEN_EXPIRED", desc: "Access token expired; use refresh" },
  { status: 401, code: "2FA_REQUIRED", desc: "Account has 2FA; provide TOTP code" },
  { status: 402, code: "INSUFFICIENT_BALANCE", desc: "Wallet balance too low" },
  { status: 403, code: "SERVER_LIMIT_REACHED", desc: "5 active server cap hit" },
  { status: 403, code: "FORBIDDEN", desc: "Lacking required role" },
  { status: 404, code: "NOT_FOUND", desc: "Resource does not exist" },
  { status: 409, code: "INVALID_STATE", desc: "Invalid for current state (e.g. starting a running server)" },
  { status: 409, code: "USERNAME_TAKEN", desc: "Username already registered" },
  { status: 409, code: "EMAIL_TAKEN", desc: "Email already registered" },
  { status: 422, code: "INVALID_REFERRAL_CODE", desc: "Referral code invalid or self-referral" },
  { status: 423, code: "ACCOUNT_LOCKED", desc: "Account locked from too many login attempts" },
  { status: 429, code: "RATE_LIMITED", desc: "Too many requests" },
  { status: 500, code: "INTERNAL_ERROR", desc: "Unhandled server error" },
  { status: 503, code: "NODE_CAPACITY", desc: "No node with sufficient free resources" },
  { status: 502, code: "RUNTIME_UNREACHABLE", desc: "Docker daemon unreachable on target node" },
];

const endpointGroups = [
  {
    label: "Auth",
    endpoints: [
      { method: "POST", path: "/api/auth/register", auth: "Public" },
      { method: "POST", path: "/api/auth/login", auth: "Public" },
      { method: "POST", path: "/api/auth/refresh", auth: "Cookie" },
      { method: "GET", path: "/api/auth/me", auth: "Bearer" },
      { method: "POST", path: "/api/auth/logout", auth: "Bearer" },
      { method: "POST", path: "/api/auth/forgot-password", auth: "Public" },
      { method: "POST", path: "/api/auth/reset-password", auth: "Public" },
      { method: "POST", path: "/api/auth/verify-email", auth: "Public" },
      { method: "POST", path: "/api/auth/2fa/enable", auth: "Bearer" },
      { method: "POST", path: "/api/auth/2fa/disable", auth: "Bearer" },
      { method: "GET", path: "/api/auth/sessions", auth: "Bearer" },
      { method: "DELETE", path: "/api/auth/sessions/:id", auth: "Bearer" },
      { method: "PUT", path: "/api/auth/change-password", auth: "Bearer" },
      { method: "PUT", path: "/api/auth/profile", auth: "Bearer" },
    ],
  },
  {
    label: "Servers",
    endpoints: [
      { method: "GET", path: "/api/servers", auth: "Bearer" },
      { method: "POST", path: "/api/servers", auth: "Bearer" },
      { method: "GET", path: "/api/servers/:id", auth: "Bearer" },
      { method: "DELETE", path: "/api/servers/:id", auth: "Bearer" },
      { method: "POST", path: "/api/servers/:id/start", auth: "Bearer" },
      { method: "POST", path: "/api/servers/:id/stop", auth: "Bearer" },
      { method: "POST", path: "/api/servers/:id/restart", auth: "Bearer" },
      { method: "GET", path: "/api/servers/:id/stats", auth: "Bearer" },
      { method: "POST", path: "/api/servers/:id/tags", auth: "Bearer" },
    ],
  },
  {
    label: "Firewall & DNS",
    endpoints: [
      { method: "GET", path: "/api/servers/:id/firewall", auth: "Bearer" },
      { method: "POST", path: "/api/servers/:id/firewall", auth: "Bearer" },
      { method: "PUT", path: "/api/servers/:id/firewall/:id", auth: "Bearer" },
      { method: "DELETE", path: "/api/servers/:id/firewall/:id", auth: "Bearer" },
      { method: "GET", path: "/api/servers/:id/dns", auth: "Bearer" },
      { method: "POST", path: "/api/servers/:id/dns", auth: "Bearer" },
      { method: "PUT", path: "/api/servers/:id/dns/:id", auth: "Bearer" },
      { method: "DELETE", path: "/api/servers/:id/dns/:id", auth: "Bearer" },
    ],
  },
  {
    label: "Backups & Snapshots",
    endpoints: [
      { method: "GET", path: "/api/servers/:id/backups", auth: "Bearer" },
      { method: "POST", path: "/api/servers/:id/backups", auth: "Bearer" },
      { method: "DELETE", path: "/api/servers/:id/backups/:id", auth: "Bearer" },
      { method: "POST", path: "/api/servers/:id/backups/:id/restore", auth: "Bearer" },
      { method: "GET", path: "/api/servers/:id/backup-schedule", auth: "Bearer" },
      { method: "PUT", path: "/api/servers/:id/backup-schedule", auth: "Bearer" },
      { method: "GET", path: "/api/servers/:id/snapshots", auth: "Bearer" },
    ],
  },
  {
    label: "Billing & Wallet",
    endpoints: [
      { method: "GET", path: "/api/billing/history", auth: "Bearer" },
      { method: "GET", path: "/api/billing/invoices", auth: "Bearer" },
      { method: "POST", path: "/api/wallet/top-up", auth: "Bearer" },
      { method: "GET", path: "/api/wallet/payment-methods", auth: "Bearer" },
      { method: "DELETE", path: "/api/wallet/payment-methods/:id", auth: "Bearer" },
    ],
  },
  {
    label: "Volumes & Networking",
    endpoints: [
      { method: "GET", path: "/api/volumes", auth: "Bearer" },
      { method: "POST", path: "/api/volumes", auth: "Bearer" },
      { method: "DELETE", path: "/api/volumes/:id", auth: "Bearer" },
      { method: "POST", path: "/api/volumes/:id/attach", auth: "Bearer" },
      { method: "POST", path: "/api/volumes/:id/detach", auth: "Bearer" },
      { method: "POST", path: "/api/volumes/:id/resize", auth: "Bearer" },
      { method: "GET", path: "/api/floating-ips", auth: "Bearer" },
      { method: "POST", path: "/api/floating-ips", auth: "Bearer" },
      { method: "DELETE", path: "/api/floating-ips/:id", auth: "Bearer" },
      { method: "GET", path: "/api/private-networks", auth: "Bearer" },
      { method: "POST", path: "/api/private-networks", auth: "Bearer" },
    ],
  },
  {
    label: "API Keys & Misc",
    endpoints: [
      { method: "GET", path: "/api/api-keys", auth: "Bearer" },
      { method: "POST", path: "/api/api-keys", auth: "Bearer" },
      { method: "DELETE", path: "/api/api-keys/:id", auth: "Bearer" },
      { method: "GET", path: "/api/tags", auth: "Bearer" },
      { method: "POST", path: "/api/tags", auth: "Bearer" },
      { method: "DELETE", path: "/api/tags/:id", auth: "Bearer" },
      { method: "GET", path: "/api/ssh-keys", auth: "Bearer" },
      { method: "POST", path: "/api/ssh-keys", auth: "Bearer" },
      { method: "DELETE", path: "/api/ssh-keys/:id", auth: "Bearer" },
      { method: "GET", path: "/api/plans", auth: "Public" },
      { method: "GET", path: "/api/regions", auth: "Public" },
      { method: "GET", path: "/api/images", auth: "Public" },
      { method: "GET", path: "/api/notifications", auth: "Bearer" },
      { method: "PUT", path: "/api/notifications", auth: "Bearer" },
      { method: "GET", path: "/api/notifications/preferences", auth: "Bearer" },
    ],
  },
];

export default function ServersPage() {
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Server Lifecycle</h1>
      <p className="mt-4 text-lg text-gray-400">
        Learn how to manage server instances through their full lifecycle — from
        provisioning to deletion. Each server goes through a defined set of states.
      </p>

      {/* States */}
      <Step heading="Server States" id="states">
        <p>A server instance moves through the following states:</p>
        <div className="my-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-gray-400">
                <th className="py-2 pr-4 font-medium">State</th>
                <th className="py-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              {states.map((s) => (
                <tr key={s.state} className="border-b border-gray-800/50">
                  <td className="py-2 pr-4">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${s.color}`}>
                      {s.state}
                    </span>
                  </td>
                  <td className="py-2">{s.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Step>

      {/* Lifecycle ops */}
      <Step heading="Lifecycle Operations" id="operations">
        <div className="space-y-8">
          {ops.map((op) => (
            <div key={op.action}>
              <SubHeading>{op.action}</SubHeading>
              <p>{op.desc}</p>
              <div className="mt-2 rounded-lg border border-gray-700 bg-gray-900 p-4">
                <code className="text-sm text-blue-400">{op.endpoint}</code>
              </div>
              <ul className="mt-2">
                {op.details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Step>

      {/* Firewall */}
      <Step heading="Firewall Rules" id="firewall">
        <p>
          Each server has its own inbound firewall. Rules are evaluated in priority
          order (lower number = higher priority). The first matching rule determines
          whether traffic is allowed or denied.
        </p>
        <p>
          <strong>Default rules</strong> are created automatically on server
          creation:
        </p>
        <ul>
          <li>Allow SSH (port 22/TCP) from anywhere</li>
          <li>Allow HTTP (port 80/TCP) from anywhere</li>
          <li>Allow HTTPS (port 443/TCP) from anywhere</li>
        </ul>
        <p>
          All other inbound traffic is <strong>denied by default</strong>. You can
          create, update, and delete custom rules from the server&apos;s Firewall
          tab.
        </p>

        <SubHeading>Rule Format</SubHeading>
        <div className="my-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-gray-400">
                <th className="py-2 pr-4 font-medium">Field</th>
                <th className="py-2 pr-4 font-medium">Description</th>
                <th className="py-2 font-medium">Example</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              <tr className="border-b border-gray-800/50">
                <td className="py-2 pr-4 font-medium">protocol</td>
                <td className="py-2 pr-4">TCP, UDP, ICMP, or ALL</td>
                <td className="py-2">TCP</td>
              </tr>
              <tr className="border-b border-gray-800/50">
                <td className="py-2 pr-4 font-medium">portRange</td>
                <td className="py-2 pr-4">Single port or range</td>
                <td className="py-2">3000-4000</td>
              </tr>
              <tr className="border-b border-gray-800/50">
                <td className="py-2 pr-4 font-medium">sourceCidr</td>
                <td className="py-2 pr-4">Source IP range in CIDR notation</td>
                <td className="py-2">10.0.0.0/8</td>
              </tr>
              <tr className="border-b border-gray-800/50">
                <td className="py-2 pr-4 font-medium">action</td>
                <td className="py-2 pr-4">ALLOW or DENY</td>
                <td className="py-2">ALLOW</td>
              </tr>
              <tr className="border-b border-gray-800/50">
                <td className="py-2 pr-4 font-medium">priority</td>
                <td className="py-2 pr-4">Integer; lower = evaluated first</td>
                <td className="py-2">10</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Step>

      {/* Backups */}
      <Step heading="Backups" id="backups">
        <p>
          Backups capture a point-in-time copy of your server&apos;s data volume.
          You can create manual backups at any time or configure an automated
          schedule.
        </p>
        <ul>
          <li>
            <strong>Manual backups</strong> — click &quot;Create Backup&quot; on a
            running server. Stored until you delete them.
          </li>
          <li>
            <strong>Automated backups</strong> — configure a schedule: daily
            retention (7 days default), weekly retention (4 weeks), monthly
            retention (3 months).
          </li>
          <li>
            <strong>Storage limit</strong> — total backup storage cannot exceed 2x
            your server&apos;s allocated disk.
          </li>
          <li>
            <strong>Restore</strong> — stop the server, select a backup, and click
            Restore. The server&apos;s disk is replaced with the backup data.
          </li>
        </ul>
      </Step>

      {/* DNS */}
      <Step heading="DNS Records" id="dns">
        <p>
          Manage forward DNS records (A, AAAA, CNAME, MX, TXT) and reverse DNS (PTR)
          directly from the server&apos;s DNS tab. Record name + type must be unique
          per server.
        </p>
        <ul>
          <li>
            <strong>A record</strong> — maps a hostname to an IPv4 address.
          </li>
          <li>
            <strong>AAAA record</strong> — maps a hostname to an IPv6 address.
          </li>
          <li>
            <strong>CNAME</strong> — aliases one domain to another.
          </li>
          <li>
            <strong>MX record</strong> — mail server routing with priority.
          </li>
          <li>
            <strong>TXT record</strong> — arbitrary text (SPF, DKIM, domain
            verification).
          </li>
          <li>
            <strong>PTR (reverse DNS)</strong> — maps an IP back to a hostname.
            Each server may have exactly one PTR record.
          </li>
        </ul>
      </Step>

      {/* Deleting */}
      <Step heading="Deleting a Server" id="deleting">
        <p>
          To permanently delete a server and release its resources back to the pool:
        </p>
        <ol>
          <li>
            <strong>Stop the server first</strong> — deletion requires the server to
            be in STOPPED state.
          </li>
          <li>
            Click <strong>Delete</strong> and type the hostname to confirm.
          </li>
          <li>
            All resources are freed: vCPU, RAM, disk, and the public IP address
            return to the node&apos;s available pool. All backups and firewall rules
            are deleted.
          </li>
        </ol>
        <Warn title="Warning">
          Deletion is irreversible. All data on the server is permanently lost.
          Make sure you have backups before deleting.
        </Warn>
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

function Warn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="my-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-amber-400">
        {title}
      </p>
      <div className="mt-1 text-sm text-gray-300">{children}</div>
    </div>
  );
}

const states = [
  { state: "CREATING", desc: "The server is being provisioned. A container is being created on the target node.", color: "bg-blue-500/10 text-blue-400" },
  { state: "ACTIVE", desc: "The server is running and accessible. Billing is active.", color: "bg-emerald-500/10 text-emerald-400" },
  { state: "STOPPED", desc: "The container is stopped. Data on disk is preserved. Billing is paused for hourly plans.", color: "bg-gray-500/10 text-gray-400" },
  { state: "ERROR", desc: "An operation failed. Check the server details for error information. Admin is automatically alerted.", color: "bg-red-500/10 text-red-400" },
  { state: "DELETED", desc: "The server has been permanently deleted. All resources are released.", color: "bg-red-500/10 text-red-400" },
];

const ops = [
  {
    action: "Create",
    endpoint: "POST /api/servers",
    desc: "Provision a new server instance. Returns 202 Accepted — provisioning is asynchronous.",
    details: [
      "Requires: planId (or customSpecs), imageId (or snapshotId), regionId, billingModel",
      "Optional: sshKeyId, hostname",
      "Validates server limit (max 5 active), wallet balance, and regional availability",
      "Atomically reserves node capacity and a public IP in a single database transaction",
    ],
  },
  {
    action: "Start",
    endpoint: "POST /api/servers/:serverId/start",
    desc: "Start a stopped server. The container resumes with its existing data and IP.",
    details: ["Server must be in STOPPED state", "Operation is nearly instant"],
  },
  {
    action: "Stop",
    endpoint: "POST /api/servers/:serverId/stop",
    desc: "Stop a running server. Graceful shutdown first; force stop after 30 seconds.",
    details: [
      "Server must be in ACTIVE state",
      "Sends SIGTERM to the container, waits up to 30 seconds for graceful exit",
      "If still running after 30 seconds, sends SIGKILL (force stop)",
      'Optionally pass { "force": true } to skip graceful shutdown',
    ],
  },
  {
    action: "Restart",
    endpoint: "POST /api/servers/:serverId/restart",
    desc: "Restart a running server (stop followed by start).",
    details: ["Server must be in ACTIVE state", "Combines stop + start in sequence"],
  },
  {
    action: "Delete",
    endpoint: "DELETE /api/servers/:serverId",
    desc: "Permanently delete a server. All resources are released.",
    details: [
      "Server must be in STOPPED state",
      "Requires hostname confirmation in request body",
      "Releases: vCPU, RAM, disk, public IP, backups, firewall rules, DNS records",
      "Soft-deletes the record (recoverable by admin if needed)",
    ],
  },
];

"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import BackupsTab from "./BackupsTab";

interface ServerPlan {
  id: string; name: string; slug: string;
  vcpu: number; ramMB: number; diskGB: number;
  priceMonthly: string; priceHourly: string;
}
interface Image { id: string; name: string; slug: string; osType: string; version: string; defaultUser: string; }
interface RegionData { id: string; name: string; slug: string; }
interface NodeData { id: string; name: string; }
interface SSHKeyData { id: string; label: string; publicKey: string; }
interface Tag { id: string; name: string; color: string; }

interface Server {
  id: string; hostname: string; status: string;
  ipAddress: string | null; dockerContainerId: string | null;
  plan: ServerPlan; image: Image | null;
  region: RegionData; node: NodeData;
  sshKey: SSHKeyData | null;
  billingModel: string;
  vcpu: number; ramMB: number; diskGB: number;
  nextBillingAt: string | null; gracePeriodEndsAt: string | null;
  tags: Tag[];
  createdAt: string; updatedAt: string;
}

interface FirewallRule {
  id: string; protocol: string; portRange: string;
  sourceCidr: string; action: string; priority: number;
  description: string | null; createdAt: string;
}

interface DnsRecord {
  id: string; type: string; name: string;
  value: string; ttl: number; priority: number | null;
  createdAt: string;
}

function formatBytes(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(0)} GB`;
  return `${mb} MB`;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    ACTIVE: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    STOPPED: "bg-gray-500/10 text-gray-400 border-gray-500/20",
    CREATING: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    ERROR: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  const color = colors[status] || colors.ERROR;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${color}`}>
      <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${status === "ACTIVE" ? "bg-emerald-400 animate-pulse" : status === "CREATING" ? "bg-amber-400 animate-pulse" : "bg-current"}`} />
      {status}
    </span>
  );
}

type Tab = "overview" | "firewall" | "dns" | "backups";

export default function ServerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const serverId = params.serverId as string;

  const [server, setServer] = useState<Server | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [acting, setActing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const fetchServer = useCallback(async () => {
    try {
      const data = await api.get<Server>(`/servers/${serverId}`);
      setServer(data);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Failed to load server");
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => {
    fetchServer();
  }, [fetchServer]);

  async function handleAction(action: "start" | "stop" | "restart") {
    setActing(true);
    setError("");
    try {
      await api.post(`/servers/${serverId}/${action}`);
      await fetchServer();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || `Failed to ${action} server`);
    } finally {
      setActing(false);
    }
  }

  async function handleDelete() {
    if (!server) return;
    const confirmed = window.confirm(`Permanently delete "${server.hostname}"?`);
    if (!confirmed) return;
    const hostnameConfirm = window.prompt(`Type "${server.hostname}" to confirm:`);
    if (hostnameConfirm !== server.hostname) {
      setError("Hostname did not match.");
      return;
    }
    setActing(true);
    try {
      await api.del(`/servers/${serverId}`);
      router.push("/dashboard/servers");
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Failed to delete server");
      setActing(false);
    }
  }

  if (loading) {
    return (
      <div>
        <Link href="/dashboard/servers" className="text-sm text-gray-400 hover:text-gray-300">&larr; Servers</Link>
        <p className="mt-4 text-gray-400">Loading server...</p>
      </div>
    );
  }

  if (error && !server) {
    return (
      <div>
        <Link href="/dashboard/servers" className="text-sm text-gray-400 hover:text-gray-300">&larr; Servers</Link>
        <div className="mt-6 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">{error}</div>
      </div>
    );
  }

  if (!server) return null;

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "firewall", label: "Firewall" },
    { key: "dns", label: "DNS" },
    { key: "backups", label: "Backups" },
  ];

  return (
    <div>
      <div className="flex items-center gap-4">
        <Link href="/dashboard/servers" className="text-sm text-gray-400 hover:text-gray-300 transition-colors">&larr; Servers</Link>
        <h1 className="text-2xl font-bold">{server.hostname}</h1>
        <StatusBadge status={server.status} />
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">
          {error}
          <button onClick={() => setError("")} className="ml-2 underline hover:text-red-300">Dismiss</button>
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        {server.status === "STOPPED" && (
          <button onClick={() => handleAction("start")} disabled={acting}
            className="rounded-lg border border-emerald-700 px-4 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-950 transition-colors disabled:opacity-50">
            {acting ? "..." : "Start"}
          </button>
        )}
        {server.status === "ACTIVE" && (
          <>
            <button onClick={() => handleAction("stop")} disabled={acting}
              className="rounded-lg border border-amber-700 px-4 py-2 text-sm font-medium text-amber-400 hover:bg-amber-950 transition-colors disabled:opacity-50">
              {acting ? "..." : "Stop"}
            </button>
            <button onClick={() => handleAction("restart")} disabled={acting}
              className="rounded-lg border border-blue-700 px-4 py-2 text-sm font-medium text-blue-400 hover:bg-blue-950 transition-colors disabled:opacity-50">
              {acting ? "..." : "Restart"}
            </button>
          </>
        )}
        {server.status === "STOPPED" && (
          <button onClick={handleDelete} disabled={acting}
            className="rounded-lg border border-red-700 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-950 transition-colors disabled:opacity-50">
            {acting ? "..." : "Delete"}
          </button>
        )}
      </div>

      <div className="mt-6 border-b border-gray-800">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "border-b-2 border-white text-white"
                  : "text-gray-400 hover:text-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-6">
        {activeTab === "overview" && <OverviewTab server={server} />}
        {activeTab === "firewall" && <FirewallTab serverId={serverId} />}
        {activeTab === "dns" && <DnsTab serverId={serverId} />}
        {activeTab === "backups" && <BackupsTab serverId={serverId} />}
      </div>
    </div>
  );
}

function OverviewTab({ server }: { server: Server }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
        <h3 className="text-sm font-semibold text-gray-300">Server Details</h3>
        <dl className="mt-4 space-y-3">
          <Row label="Hostname" value={server.hostname} />
          <Row label="Status" value={server.status} />
          <Row label="IP Address" value={server.ipAddress || "—"} />
          <Row label="Container ID" value={server.dockerContainerId ? server.dockerContainerId.slice(0, 12) : "—"} />
          <Row label="Region" value={`${server.region.name} (${server.region.slug})`} />
          <Row label="Node" value={server.node.name} />
          <Row label="Billing" value={server.billingModel} />
          {server.nextBillingAt && <Row label="Next Billing" value={new Date(server.nextBillingAt).toLocaleDateString()} />}
        </dl>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
        <h3 className="text-sm font-semibold text-gray-300">Resources</h3>
        <dl className="mt-4 space-y-3">
          <Row label="Plan" value={server.plan.name} />
          <Row label="vCPU" value={String(server.vcpu)} />
          <Row label="RAM" value={formatBytes(server.ramMB)} />
          <Row label="Disk" value={`${server.diskGB} GB`} />
          <Row label="Price (Monthly)" value={`$${server.plan.priceMonthly}`} />
          <Row label="Price (Hourly)" value={`$${server.plan.priceHourly}`} />
        </dl>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
        <h3 className="text-sm font-semibold text-gray-300">Image</h3>
        <dl className="mt-4 space-y-3">
          {server.image ? (
            <>
              <Row label="Name" value={server.image.name} />
              <Row label="OS" value={server.image.osType} />
              <Row label="Version" value={server.image.version} />
              <Row label="Default User" value={server.image.defaultUser} />
            </>
          ) : (
            <Row label="Source" value="Snapshot" />
          )}
        </dl>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
        <h3 className="text-sm font-semibold text-gray-300">SSH Access</h3>
        <dl className="mt-4 space-y-3">
          {server.sshKey ? (
            <Row label="SSH Key" value={server.sshKey.label} />
          ) : (
            <Row label="Auth Method" value="Password" />
          )}
          {server.ipAddress && (
            <Row label="SSH Command" value={`ssh ${server.image?.defaultUser || "root"}@${server.ipAddress}`} />
          )}
        </dl>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <dt className="text-gray-400">{label}</dt>
      <dd className="text-gray-200 truncate max-w-[60%] text-right">{value}</dd>
    </div>
  );
}

function FirewallTab({ serverId }: { serverId: string }) {
  const [rules, setRules] = useState<FirewallRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [protocol, setProtocol] = useState("TCP");
  const [portRange, setPortRange] = useState("");
  const [sourceCidr, setSourceCidr] = useState("0.0.0.0/0");
  const [action, setAction] = useState("ALLOW");
  const [priority, setPriority] = useState(10);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchRules = useCallback(async () => {
    try {
      const data = await api.get<FirewallRule[]>(`/servers/${serverId}/firewall`);
      setRules(data);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Failed to load firewall rules");
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await api.post(`/servers/${serverId}/firewall`, {
        protocol, portRange, sourceCidr, action, priority, description: description || undefined,
      });
      setShowForm(false);
      setPortRange("");
      setDescription("");
      await fetchRules();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Failed to add rule");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(ruleId: string) {
    try {
      await api.del(`/servers/${serverId}/firewall/${ruleId}`);
      await fetchRules();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Failed to delete rule");
    }
  }

  if (loading) return <p className="text-gray-400">Loading firewall rules...</p>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300">Firewall Rules</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-800 transition-colors"
        >
          {showForm ? "Cancel" : "Add Rule"}
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {showForm && (
        <form onSubmit={handleAdd} className="mt-4 rounded-lg border border-gray-800 bg-gray-900/50 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="block text-xs text-gray-400">Protocol</label>
              <select value={protocol} onChange={(e) => setProtocol(e.target.value)}
                className="mt-1 block w-full rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-gray-100">
                <option>TCP</option><option>UDP</option><option>ICMP</option><option>ALL</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400">Port</label>
              <input type="text" required value={portRange} onChange={(e) => setPortRange(e.target.value)}
                placeholder="22 or 8000-8100"
                className="mt-1 block w-full rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-gray-100 placeholder-gray-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400">Source CIDR</label>
              <input type="text" required value={sourceCidr} onChange={(e) => setSourceCidr(e.target.value)}
                className="mt-1 block w-full rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-gray-100" />
            </div>
            <div>
              <label className="block text-xs text-gray-400">Action</label>
              <select value={action} onChange={(e) => setAction(e.target.value)}
                className="mt-1 block w-full rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-gray-100">
                <option>ALLOW</option><option>DENY</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs text-gray-400">Priority</label>
              <input type="number" value={priority} onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
                className="mt-1 block w-full rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-gray-100" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-gray-400">Description (optional)</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Web server port"
                className="mt-1 block w-full rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-gray-100 placeholder-gray-500" />
            </div>
          </div>
          <button type="submit" disabled={submitting}
            className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-200 transition-colors disabled:opacity-50">
            {submitting ? "Adding..." : "Add Rule"}
          </button>
        </form>
      )}

      {rules.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">No firewall rules configured.</p>
      ) : (
        <div className="mt-4 space-y-2">
          {rules.map((rule) => (
            <div key={rule.id} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3">
              <div className="flex items-center gap-4 text-sm">
                <span className={`font-mono text-xs ${rule.action === "ALLOW" ? "text-emerald-400" : "text-red-400"}`}>
                  {rule.action}
                </span>
                <span className="text-gray-300">{rule.protocol}</span>
                <span className="text-gray-400">{rule.portRange}</span>
                <span className="text-gray-500">{rule.sourceCidr}</span>
                <span className="text-gray-600">prio {rule.priority}</span>
                {rule.description && <span className="text-gray-500 truncate max-w-[150px]">{rule.description}</span>}
              </div>
              <button onClick={() => handleDelete(rule.id)}
                className="text-xs text-red-400 hover:text-red-300 transition-colors">Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DnsTab({ serverId }: { serverId: string }) {
  const [records, setRecords] = useState<DnsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [type, setType] = useState("A");
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [ttl, setTtl] = useState(3600);
  const [mxPriority, setMxPriority] = useState(10);
  const [submitting, setSubmitting] = useState(false);

  const fetchRecords = useCallback(async () => {
    try {
      const data = await api.get<DnsRecord[]>(`/servers/${serverId}/dns`);
      setRecords(data);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Failed to load DNS records");
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await api.post(`/servers/${serverId}/dns`, {
        type, name, value, ttl,
        priority: type === "MX" ? mxPriority : undefined,
      });
      setShowForm(false);
      setName(""); setValue("");
      await fetchRecords();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Failed to add record");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(recordId: string) {
    try {
      await api.del(`/servers/${serverId}/dns/${recordId}`);
      await fetchRecords();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Failed to delete record");
    }
  }

  if (loading) return <p className="text-gray-400">Loading DNS records...</p>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300">DNS Records</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-gray-800 transition-colors"
        >
          {showForm ? "Cancel" : "Add Record"}
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {showForm && (
        <form onSubmit={handleAdd} className="mt-4 rounded-lg border border-gray-800 bg-gray-900/50 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="block text-xs text-gray-400">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)}
                className="mt-1 block w-full rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-gray-100">
                <option>A</option><option>AAAA</option><option>CNAME</option><option>MX</option><option>TXT</option><option>PTR</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400">Name</label>
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
                placeholder="@ or www"
                className="mt-1 block w-full rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-gray-100 placeholder-gray-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400">Value</label>
              <input type="text" required value={value} onChange={(e) => setValue(e.target.value)}
                placeholder="IP or hostname"
                className="mt-1 block w-full rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-gray-100 placeholder-gray-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400">TTL</label>
              <input type="number" value={ttl} onChange={(e) => setTtl(parseInt(e.target.value) || 3600)}
                className="mt-1 block w-full rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-gray-100" />
            </div>
          </div>
          {type === "MX" && (
            <div>
              <label className="block text-xs text-gray-400">MX Priority</label>
              <input type="number" value={mxPriority} onChange={(e) => setMxPriority(parseInt(e.target.value) || 0)}
                className="mt-1 block w-24 rounded border border-gray-700 bg-gray-800 px-2 py-1.5 text-sm text-gray-100" />
            </div>
          )}
          <button type="submit" disabled={submitting}
            className="rounded-lg bg-white px-4 py-2 text-xs font-semibold text-gray-900 hover:bg-gray-200 transition-colors disabled:opacity-50">
            {submitting ? "Adding..." : "Add Record"}
          </button>
        </form>
      )}

      {records.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">No DNS records configured.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-gray-400">
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Value</th>
                <th className="pb-2 font-medium">TTL</th>
                <th className="pb-2 font-medium">Priority</th>
                <th className="pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-gray-800/50">
                  <td className="py-2 font-mono text-xs text-gray-300">{r.type}</td>
                  <td className="py-2 text-gray-300">{r.name}</td>
                  <td className="py-2 text-gray-400">{r.value}</td>
                  <td className="py-2 text-gray-500">{r.ttl}</td>
                  <td className="py-2 text-gray-500">{r.priority ?? "—"}</td>
                  <td className="py-2 text-right">
                    <button onClick={() => handleDelete(r.id)}
                      className="text-xs text-red-400 hover:text-red-300 transition-colors">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

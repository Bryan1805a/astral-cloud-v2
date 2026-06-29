"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

interface ServerPlan {
  id: string;
  name: string;
  slug: string;
}

interface Region {
  id: string;
  name: string;
  slug: string;
}

interface Image {
  id: string;
  name: string;
  slug: string;
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Server {
  id: string;
  hostname: string;
  status: string;
  ipAddress: string | null;
  plan: ServerPlan;
  image: Image | null;
  region: Region;
  billingModel: string;
  vcpu: number;
  ramMB: number;
  diskGB: number;
  tags: Tag[];
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  STOPPED: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  CREATING: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  STOPPING: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  RESTARTING: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  DELETING: "bg-red-500/10 text-red-400 border-red-500/20",
  DELETED: "bg-red-500/10 text-red-400 border-red-500/20",
  ERROR: "bg-red-500/10 text-red-400 border-red-500/20",
};

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || STATUS_COLORS.ERROR;
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${color}`}>
      <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${status === "ACTIVE" ? "bg-emerald-400 animate-pulse" : status === "CREATING" ? "bg-amber-400 animate-pulse" : "bg-current"}`} />
      {status}
    </span>
  );
}

function formatBytes(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(0)} GB`;
  return `${mb} MB`;
}

export default function ServersPage() {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [actingServer, setActingServer] = useState<string | null>(null);

  const fetchServers = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/servers?${params.toString()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to load servers");
      setServers(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load servers");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  async function handleAction(serverId: string, action: "start" | "stop" | "restart") {
    setActingServer(serverId);
    try {
      await api.post(`/servers/${serverId}/${action}`);
      await fetchServers();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || `Failed to ${action} server`);
    } finally {
      setActingServer(null);
    }
  }

  async function handleDelete(server: Server) {
    const confirmed = window.confirm(
      `Delete "${server.hostname}"?\n\nThis action is irreversible. All data will be permanently lost.`
    );
    if (!confirmed) return;

    const hostnameConfirm = window.prompt(`Type "${server.hostname}" to confirm deletion:`);
    if (hostnameConfirm !== server.hostname) {
      setError("Hostname did not match. Deletion cancelled.");
      return;
    }

    setActingServer(server.id);
    try {
      await api.del(`/servers/${server.id}`);
      await fetchServers();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Failed to delete server");
    } finally {
      setActingServer(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Servers</h1>
          <p className="mt-1 text-sm text-gray-400">Manage your server instances</p>
        </div>
        <Link
          href="/dashboard/servers/create"
          className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200 transition-colors"
        >
          Create Server
        </Link>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">
          {error}
          <button onClick={() => setError("")} className="ml-2 underline hover:text-red-300">Dismiss</button>
        </div>
      )}

      <div className="mt-6 flex gap-2">
        {["", "ACTIVE", "STOPPED", "CREATING", "ERROR"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              statusFilter === s
                ? "border-white bg-white text-gray-900"
                : "border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300"
            }`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-8 text-center text-gray-400">Loading servers...</div>
      ) : servers.length === 0 ? (
        <div className="mt-16 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-800">
            <ServerIcon className="h-6 w-6 text-gray-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-300">No servers yet</h3>
          <p className="mt-1 text-sm text-gray-500">Create your first server to get started</p>
          <Link
            href="/dashboard/servers/create"
            className="mt-6 inline-block rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-200 transition-colors"
          >
            Create Your First Server
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {servers.map((server) => (
            <div
              key={server.id}
              className="rounded-xl border border-gray-800 bg-gray-900/50 p-5 hover:border-gray-700 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Link
                    href={`/dashboard/servers/${server.id}`}
                    className="text-lg font-semibold text-gray-100 hover:text-white transition-colors"
                  >
                    {server.hostname}
                  </Link>
                  <StatusBadge status={server.status} />
                </div>

                <div className="flex items-center gap-2">
                  {server.status === "STOPPED" && (
                    <button
                      onClick={() => handleAction(server.id, "start")}
                      disabled={actingServer === server.id}
                      className="rounded-lg border border-emerald-700 px-3 py-1 text-xs font-medium text-emerald-400 hover:bg-emerald-950 transition-colors disabled:opacity-50"
                    >
                      {actingServer === server.id ? "..." : "Start"}
                    </button>
                  )}
                  {server.status === "ACTIVE" && (
                    <>
                      <button
                        onClick={() => handleAction(server.id, "stop")}
                        disabled={actingServer === server.id}
                        className="rounded-lg border border-amber-700 px-3 py-1 text-xs font-medium text-amber-400 hover:bg-amber-950 transition-colors disabled:opacity-50"
                      >
                        {actingServer === server.id ? "..." : "Stop"}
                      </button>
                      <button
                        onClick={() => handleAction(server.id, "restart")}
                        disabled={actingServer === server.id}
                        className="rounded-lg border border-blue-700 px-3 py-1 text-xs font-medium text-blue-400 hover:bg-blue-950 transition-colors disabled:opacity-50"
                      >
                        {actingServer === server.id ? "..." : "Restart"}
                      </button>
                    </>
                  )}
                  {server.status === "STOPPED" && (
                    <button
                      onClick={() => handleDelete(server)}
                      disabled={actingServer === server.id}
                      className="rounded-lg border border-red-700 px-3 py-1 text-xs font-medium text-red-400 hover:bg-red-950 transition-colors disabled:opacity-50"
                    >
                      {actingServer === server.id ? "..." : "Delete"}
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-gray-400">
                <span>{server.ipAddress || "—"}</span>
                <span>{server.plan.name}</span>
                <span>{server.vcpu} vCPU / {formatBytes(server.ramMB)} RAM / {server.diskGB} GB Disk</span>
                <span className="text-gray-500">{server.region.name} ({server.region.slug})</span>
                <span className="text-gray-500">{server.billingModel}</span>
              </div>

              {server.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {server.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center rounded border px-2 py-0.5 text-xs"
                      style={{ borderColor: tag.color + "40", color: tag.color }}
                    >
                      {tag.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ServerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 17.25v-.228a4.5 4.5 0 00-.12-1.03l-2.268-9.64a3.375 3.375 0 00-3.285-2.602H7.923a3.375 3.375 0 00-3.285 2.602l-2.268 9.64a4.5 4.5 0 00-.12 1.03v.228m19.5 0a3 3 0 01-3 3H5.25a3 3 0 01-3-3m19.5 0a3 3 0 00-3-3H5.25a3 3 0 00-3 3m16.5 0h.008v.008h-.008v-.008zm-3 0h.008v.008h-.008v-.008z" />
    </svg>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Server {
  id: string;
  hostname: string;
  status: string;
  ipAddress: string | null;
  plan: { name: string };
  region: { name: string; slug: string };
  vcpu: number;
  ramMB: number;
  diskGB: number;
  createdAt: string;
}

interface ActivityEvent {
  id: string; action: string; label: string;
  targetType: string; targetId: string;
  result: string; createdAt: string;
}

export default function DashboardOverviewPage() {
  const [servers, setServers] = useState<Server[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    Promise.all([
      fetch("/api/servers", { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json()).then((j) => setServers(j.data || [])),
      fetch("/api/activity", { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json()).then((j) => setActivity(j.data || [])),
    ]).catch(() => {});
  }, []);

  const activeCount = servers.filter((s) => s.status === "ACTIVE").length;
  const stoppedCount = servers.filter((s) => s.status === "STOPPED").length;

  return (
    <div>
      <h1 className="text-2xl font-bold">Overview</h1>
      <p className="mt-1 text-sm text-gray-400">Welcome back</p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <p className="text-sm text-gray-400">Active Servers</p>
          <p className="mt-1 text-3xl font-bold text-emerald-400">{activeCount}</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <p className="text-sm text-gray-400">Stopped Servers</p>
          <p className="mt-1 text-3xl font-bold text-gray-400">{stoppedCount}</p>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <p className="text-sm text-gray-400">Total Servers</p>
          <p className="mt-1 text-3xl font-bold">{servers.length}</p>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Recent Servers</h2>
        <Link
          href="/dashboard/servers"
          className="text-sm text-gray-400 hover:text-gray-300 transition-colors"
        >
          View all &rarr;
        </Link>
      </div>

      {servers.length === 0 ? (
        <div className="mt-6 rounded-xl border border-gray-800 bg-gray-900/50 p-8 text-center">
          <p className="text-gray-400">No servers yet</p>
          <Link
            href="/dashboard/servers/create"
            className="mt-4 inline-block rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-200 transition-colors"
          >
            Create Your First Server
          </Link>
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {servers.slice(0, 5).map((server) => (
            <Link
              key={server.id}
              href={`/dashboard/servers/${server.id}`}
              className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3 hover:border-gray-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="font-medium text-gray-200">{server.hostname}</span>
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                  server.status === "ACTIVE"
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                    : server.status === "STOPPED"
                      ? "border-gray-500/20 bg-gray-500/10 text-gray-400"
                      : "border-amber-500/20 bg-amber-500/10 text-amber-400"
                }`}>
                  {server.status}
                </span>
              </div>
              <div className="text-sm text-gray-400">
                {server.ipAddress || "—"} &middot; {server.plan.name} &middot; {server.region.slug}
              </div>
            </Link>
          ))}
        </div>
      )}

      {activity.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold">Recent Activity</h2>
          <div className="mt-4 space-y-1">
            {activity.map((event) => (
              <div key={event.id} className="flex items-center gap-3 rounded px-3 py-2 text-sm hover:bg-gray-900/30">
                <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                  event.result === "SUCCESS" ? "bg-emerald-400" : "bg-red-400"
                }`} />
                <span className="text-gray-300">{event.label}</span>
                <span className="text-gray-600 text-xs flex-1" />
                <span className="text-gray-600 text-xs">{new Date(event.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

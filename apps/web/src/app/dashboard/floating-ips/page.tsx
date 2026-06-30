"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

interface FloatingIp {
  id: string; ipAddress: string;
  region: { id: string; name: string; slug: string };
  serverId: string | null; serverHostname: string | null;
  assignedAt: string | null; createdAt: string;
}

interface RegionData { id: string; name: string; slug: string; }
interface ServerData { id: string; hostname: string; regionId: string; }

export default function FloatingIpsPage() {
  const [fips, setFips] = useState<FloatingIp[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [regions, setRegions] = useState<RegionData[]>([]);
  const [servers, setServers] = useState<ServerData[]>([]);
  const [regionId, setRegionId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [assignFipId, setAssignFipId] = useState<string | null>(null);
  const [assignServerId, setAssignServerId] = useState("");

  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

  const fetchFips = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: "20" });
      const res = await fetch(`/api/floating-ips?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setFips(json.data || []);
      setTotal(json.meta?.total || 0);
    } catch { /* noop */ }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchFips(page); }, [page, fetchFips]);

  useEffect(() => {
    fetch("/api/regions", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((j) => { setRegions(j.data || []); if (j.data?.length) setRegionId(j.data[0].id); }).catch(() => {});
    fetch("/api/servers", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((j) => setServers(j.data || [])).catch(() => {});
  }, [token]);

  async function handleAllocate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setError("");
    try {
      await api.post("/floating-ips", { regionId });
      setShowForm(false); setSuccess("Floating IP allocated.");
      fetchFips(page);
    } catch (err: unknown) {
      setError((err as { message?: string }).message || "Failed");
    } finally { setSubmitting(false); }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this floating IP?")) return;
    try { await api.del(`/floating-ips/${id}`); fetchFips(page); }
    catch (err: unknown) { setError((err as { message?: string }).message || "Failed"); }
  }

  function startAssign(fip: FloatingIp) {
    const eligible = servers.filter((s) => s.regionId === fip.region.id);
    setAssignFipId(fip.id);
    setAssignServerId(eligible[0]?.id || "");
  }

  async function doAssign() {
    if (!assignFipId || !assignServerId) return;
    setSubmitting(true); setError("");
    try {
      await api.put(`/floating-ips/${assignFipId}`, { serverId: assignServerId });
      setAssignFipId(null); setSuccess("Floating IP assigned.");
      fetchFips(page);
    } catch (err: unknown) { setError((err as { message?: string }).message || "Failed"); }
    finally { setSubmitting(false); }
  }

  async function handleUnassign(id: string) {
    try { await api.post(`/floating-ips/${id}`); fetchFips(page); setSuccess("Floating IP unassigned."); }
    catch (err: unknown) { setError((err as { message?: string }).message || "Failed"); }
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Floating IPs</h1>
          <p className="text-sm text-gray-400">{total} IP{total !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200">
          {showForm ? "Cancel" : "Allocate IP"}
        </button>
      </div>

      {error && <div className="mt-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">{error}<button onClick={() => setError("")} className="ml-2 underline hover:text-red-300">Dismiss</button></div>}
      {success && <div className="mt-4 rounded-lg border border-emerald-800 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-400">{success}<button onClick={() => setSuccess("")} className="ml-2 underline hover:text-emerald-300">Dismiss</button></div>}

      {showForm && (
        <form onSubmit={handleAllocate} className="mt-6 rounded-xl border border-gray-800 bg-gray-900/50 p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Region</label>
            <select value={regionId} onChange={(e) => setRegionId(e.target.value)}
              className="block w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-gray-100">
              {regions.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.slug})</option>)}
            </select>
          </div>
          <button type="submit" disabled={submitting}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200 disabled:opacity-50">
            {submitting ? "Allocating..." : "Allocate Floating IP"}
          </button>
        </form>
      )}

      {assignFipId && (
        <div className="mt-6 rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Assign to Server</h3>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">Server</label>
              <select value={assignServerId} onChange={(e) => setAssignServerId(e.target.value)}
                className="block w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100">
                {servers.filter((s) => {
                  const fip = fips.find((f) => f.id === assignFipId);
                  return fip && s.regionId === fip.region.id;
                }).map((s) => <option key={s.id} value={s.id}>{s.hostname}</option>)}
              </select>
            </div>
            <button onClick={doAssign} disabled={submitting}
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200 disabled:opacity-50">Assign</button>
            <button onClick={() => setAssignFipId(null)}
              className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800">Cancel</button>
          </div>
        </div>
      )}

      {loading ? <p className="mt-6 text-gray-400">Loading...</p> : fips.length === 0 ? <p className="mt-8 text-center text-gray-500">No floating IPs.</p> : (
        <div className="mt-6 space-y-3">
          {fips.map((f) => (
            <div key={f.id} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3">
              <div>
                <span className="font-mono text-sm text-gray-200">{f.ipAddress}</span>
                <div className="mt-0.5 text-xs text-gray-500">
                  {f.region.name} ({f.region.slug})
                  {f.serverHostname ? (
                    <span className="ml-2">
                      assigned to <Link href={`/dashboard/servers/${f.serverId}`} className="text-blue-400 hover:underline">{f.serverHostname}</Link>
                    </span>
                  ) : (
                    <span className="ml-2 text-gray-600">unassigned</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!f.serverId && (
                  <button onClick={() => startAssign(f)}
                    className="rounded border border-blue-700 px-2 py-1 text-xs text-blue-400 hover:bg-blue-950/30">Assign</button>
                )}
                {f.serverId && (
                  <button onClick={() => handleUnassign(f.id)}
                    className="rounded border border-amber-700 px-2 py-1 text-xs text-amber-400 hover:bg-amber-950/30">Unassign</button>
                )}
                {!f.serverId && (
                  <button onClick={() => handleDelete(f.id)}
                    className="rounded border border-red-800 px-2 py-1 text-xs text-red-400 hover:bg-red-950/30">Delete</button>
                )}
              </div>
            </div>
          ))}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-400 pt-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded border border-gray-700 px-3 py-1 disabled:opacity-30">Prev</button>
              <span>Page {page} of {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="rounded border border-gray-700 px-3 py-1 disabled:opacity-30">Next</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

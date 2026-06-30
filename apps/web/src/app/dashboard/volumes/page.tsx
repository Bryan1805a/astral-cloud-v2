"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

interface Volume {
  id: string; name: string; sizeGB: number; status: string;
  region: { id: string; name: string; slug: string };
  serverId: string | null; serverHostname: string | null;
  devicePath: string | null; attachedAt: string | null;
  createdAt: string;
}

interface RegionData { id: string; name: string; slug: string; }
interface ServerData { id: string; hostname: string; }

const STATUS_COLORS: Record<string, string> = {
  CREATING: "border-amber-700 text-amber-400 bg-amber-950/30",
  AVAILABLE: "border-emerald-700 text-emerald-400 bg-emerald-950/30",
  ATTACHED: "border-blue-700 text-blue-400 bg-blue-950/30",
  DETACHING: "border-amber-700 text-amber-400 bg-amber-950/30",
  DELETING: "border-red-700 text-red-400 bg-red-950/30",
  ERROR: "border-red-700 text-red-400 bg-red-950/30",
};

export default function VolumesPage() {
  const [volumes, setVolumes] = useState<Volume[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [regions, setRegions] = useState<RegionData[]>([]);
  const [servers, setServers] = useState<ServerData[]>([]);
  const [name, setName] = useState("");
  const [regionId, setRegionId] = useState("");
  const [sizeGB, setSizeGB] = useState(10);
  const [submitting, setSubmitting] = useState(false);

  const [attachVolumeId, setAttachVolumeId] = useState<string | null>(null);
  const [attachServerId, setAttachServerId] = useState("");

  const [resizeVolumeId, setResizeVolumeId] = useState<string | null>(null);
  const [resizeGB, setResizeGB] = useState(10);

  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

  const fetchVolumes = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: "20" });
      const res = await fetch(`/api/volumes?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setVolumes(json.data || []);
      setTotal(json.meta?.total || 0);
    } catch { /* noop */ }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchVolumes(page); }, [page, fetchVolumes]);

  useEffect(() => {
    fetch("/api/regions", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((j) => { setRegions(j.data || []); if (j.data?.length) setRegionId(j.data[0].id); }).catch(() => {});
    fetch("/api/servers", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((j) => setServers(j.data || [])).catch(() => {});
  }, [token]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setError("");
    try {
      await api.post("/volumes", { name: name.trim(), regionId, sizeGB });
      setName(""); setShowForm(false); setSuccess("Volume created.");
      fetchVolumes(page);
    } catch (err: unknown) {
      setError((err as { message?: string }).message || "Failed to create");
    } finally { setSubmitting(false); }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this volume? Data will be lost.")) return;
    setError("");
    try { await api.del(`/volumes/${id}`); fetchVolumes(page); }
    catch (err: unknown) { setError((err as { message?: string }).message || "Failed to delete"); }
  }

  async function handleAttach(volumeId: string) {
    setError(""); setAttachVolumeId(volumeId); setAttachServerId(servers[0]?.id || "");
  }

  async function doAttach() {
    if (!attachVolumeId || !attachServerId) return;
    setSubmitting(true); setError("");
    try {
      await api.post(`/volumes/${attachVolumeId}/attach`, { serverId: attachServerId });
      setAttachVolumeId(null); setSuccess("Volume attached.");
      fetchVolumes(page);
    } catch (err: unknown) { setError((err as { message?: string }).message || "Failed"); }
    finally { setSubmitting(false); }
  }

  async function handleDetach(volumeId: string) {
    if (!window.confirm("Detach this volume? Unmount from the server first to avoid data corruption.")) return;
    setError("");
    try { await api.post(`/volumes/${volumeId}/detach`); fetchVolumes(page); setSuccess("Volume detached."); }
    catch (err: unknown) { setError((err as { message?: string }).message || "Failed"); }
  }

  function handleResizeStart(volume: Volume) {
    setResizeVolumeId(volume.id); setResizeGB(volume.sizeGB + 5);
  }

  async function doResize() {
    if (!resizeVolumeId) return;
    setSubmitting(true); setError("");
    try {
      await api.put(`/volumes/${resizeVolumeId}/resize`, { sizeGB: resizeGB });
      setResizeVolumeId(null); setSuccess("Volume resized.");
      fetchVolumes(page);
    } catch (err: unknown) { setError((err as { message?: string }).message || "Failed"); }
    finally { setSubmitting(false); }
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Block Volumes</h1>
          <p className="text-sm text-gray-400">{total} volume{total !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200">
          {showForm ? "Cancel" : "Create Volume"}
        </button>
      </div>

      {error && <div className="mt-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">{error}<button onClick={() => setError("")} className="ml-2 underline hover:text-red-300">Dismiss</button></div>}
      {success && <div className="mt-4 rounded-lg border border-emerald-800 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-400">{success}<button onClick={() => setSuccess("")} className="ml-2 underline hover:text-emerald-300">Dismiss</button></div>}

      {showForm && (
        <form onSubmit={handleCreate} className="mt-6 rounded-xl border border-gray-800 bg-gray-900/50 p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
            <input type="text" required maxLength={64} value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. database-volume"
              className="block w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:border-white focus:outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Region</label>
              <select value={regionId} onChange={(e) => setRegionId(e.target.value)}
                className="block w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-gray-100">
                {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Size (GB)</label>
              <input type="number" min={1} max={16384} value={sizeGB} onChange={(e) => setSizeGB(parseInt(e.target.value) || 1)}
                className="block w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-gray-100" />
            </div>
          </div>
          <button type="submit" disabled={submitting}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200 disabled:opacity-50">
            {submitting ? "Creating..." : "Create Volume"}
          </button>
        </form>
      )}

      {attachVolumeId && (
        <div className="mt-6 rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Attach Volume to Server</h3>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">Server</label>
              <select value={attachServerId} onChange={(e) => setAttachServerId(e.target.value)}
                className="block w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100">
                {servers.map((s) => <option key={s.id} value={s.id}>{s.hostname}</option>)}
              </select>
            </div>
            <button onClick={doAttach} disabled={submitting}
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200 disabled:opacity-50">Attach</button>
            <button onClick={() => setAttachVolumeId(null)}
              className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800">Cancel</button>
          </div>
        </div>
      )}

      {resizeVolumeId && (
        <div className="mt-6 rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Resize Volume</h3>
          <div className="flex items-end gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">New Size (GB)</label>
              <input type="number" min={1} max={16384} value={resizeGB} onChange={(e) => setResizeGB(parseInt(e.target.value) || 1)}
                className="block w-40 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100" />
            </div>
            <button onClick={doResize} disabled={submitting}
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200 disabled:opacity-50">Resize</button>
            <button onClick={() => setResizeVolumeId(null)}
              className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-300 hover:bg-gray-800">Cancel</button>
          </div>
        </div>
      )}

      {loading ? <p className="mt-6 text-gray-400">Loading...</p> : volumes.length === 0 ? <p className="mt-8 text-center text-gray-500">No volumes yet.</p> : (
        <div className="mt-6 space-y-3">
          {volumes.map((v) => (
            <div key={v.id} className="rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-gray-200">{v.name}</span>
                    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[v.status] || ""}`}>{v.status}</span>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    {v.sizeGB} GB · {v.region.name} ({v.region.slug})
                    {v.devicePath && <span className="ml-2">{v.devicePath}</span>}
                    {v.serverHostname && <span className="ml-2">attached to <Link href={`/dashboard/servers/${v.serverId}`} className="text-blue-400 hover:underline">{v.serverHostname}</Link></span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {v.status === "AVAILABLE" && (
                    <button onClick={() => handleAttach(v.id)}
                      className="rounded border border-blue-700 px-2 py-1 text-xs text-blue-400 hover:bg-blue-950/30">Attach</button>
                  )}
                  {v.status === "ATTACHED" && (
                    <button onClick={() => handleDetach(v.id)}
                      className="rounded border border-amber-700 px-2 py-1 text-xs text-amber-400 hover:bg-amber-950/30">Detach</button>
                  )}
                  {(v.status === "AVAILABLE" || v.status === "ATTACHED") && (
                    <button onClick={() => handleResizeStart(v)}
                      className="rounded border border-gray-700 px-2 py-1 text-xs text-gray-400 hover:bg-gray-800">Resize</button>
                  )}
                  {v.status !== "CREATING" && v.status !== "DELETING" && v.status !== "DETACHING" && (
                    <button onClick={() => handleDelete(v.id)}
                      className="rounded border border-red-800 px-2 py-1 text-xs text-red-400 hover:bg-red-950/30">Delete</button>
                  )}
                </div>
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

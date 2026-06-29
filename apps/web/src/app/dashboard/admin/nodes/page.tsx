"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Region { id: string; name: string; }
interface Node {
  id: string; name: string; region: Region; dockerEndpoint: string; status: string;
  totalVcpu: number; totalRamMB: number; totalDiskGB: number;
  allocatedVcpu: number; allocatedRamMB: number; allocatedDiskGB: number;
  lastHeartbeatAt: string | null; createdAt: string;
}

function formatMB(mb: number): string { return mb >= 1024 ? `${(mb/1024).toFixed(0)}GB` : `${mb}MB`; }

export default function AdminNodesPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", regionId: "", dockerEndpoint: "unix:///var/run/docker.sock", totalVcpu: 16, totalRamMB: 32768, totalDiskGB: 500 });

  const fetchNodes = async () => {
    try { setNodes(await api.get<Node[]>("/admin/nodes")); } catch { setError("Failed to load"); } finally { setLoading(false); }
  };
  const fetchRegions = async () => { try { setRegions(await api.get<Region[]>("/regions")); } catch { /* noop */ } };

  useEffect(() => { fetchNodes(); fetchRegions(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true); setError("");
    try {
      await api.post("/admin/nodes", form);
      setShowForm(false);
      setForm({ name: "", regionId: "", dockerEndpoint: "unix:///var/run/docker.sock", totalVcpu: 16, totalRamMB: 32768, totalDiskGB: 500 });
      await fetchNodes();
    } catch (err: unknown) { setError((err as { message?: string }).message || "Failed"); }
    finally { setSubmitting(false); }
  }

  async function handleOffline(id: string) {
    if (!window.confirm("Take this node offline?")) return;
    try { await api.del(`/admin/nodes/${id}`); await fetchNodes(); }
    catch (err: unknown) { setError((err as { message?: string }).message || "Failed"); }
  }

  const statusColor = (s: string) => s === "ONLINE" ? "text-emerald-400" : s === "OFFLINE" ? "text-red-400" : "text-amber-400";

  if (loading) return <p className="text-gray-400">Loading...</p>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Nodes</h1><p className="text-sm text-gray-400">{nodes.length} nodes</p></div>
        <button onClick={() => setShowForm(!showForm)} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200">{showForm ? "Cancel" : "Add Node"}</button>
      </div>
      {error && <div className="mt-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">{error}</div>}

      {showForm && (
        <form onSubmit={handleCreate} className="mt-4 rounded-xl border border-gray-800 bg-gray-900/50 p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Input label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <div>
              <label className="block text-xs text-gray-400">Region</label>
              <select value={form.regionId} onChange={(e) => setForm({ ...form, regionId: e.target.value })} required
                className="mt-1 block w-full rounded border border-gray-700 bg-gray-800 px-2.5 py-1.5 text-sm text-gray-100">
                <option value="">Select...</option>
                {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <Input label="Docker Endpoint" value={form.dockerEndpoint} onChange={(v) => setForm({ ...form, dockerEndpoint: v })} />
            <Input label="Total vCPU" type="number" value={form.totalVcpu} onChange={(v) => setForm({ ...form, totalVcpu: Number(v) })} />
            <Input label="Total RAM (MB)" type="number" value={form.totalRamMB} onChange={(v) => setForm({ ...form, totalRamMB: Number(v) })} />
            <Input label="Total Disk (GB)" type="number" value={form.totalDiskGB} onChange={(v) => setForm({ ...form, totalDiskGB: Number(v) })} />
          </div>
          <button type="submit" disabled={submitting} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200 disabled:opacity-50">
            {submitting ? "Creating..." : "Create Node"}
          </button>
        </form>
      )}

      <div className="mt-6 space-y-2">
        {nodes.map((n) => (
          <div key={n.id} className="rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-200">{n.name}</span>
                <span className={`text-xs font-medium ${statusColor(n.status)}`}>{n.status}</span>
                <span className="text-xs text-gray-500">{n.region.name}</span>
              </div>
              <button onClick={() => handleOffline(n.id)} disabled={n.status !== "ONLINE"}
                className="rounded border border-red-700 px-3 py-1 text-xs text-red-400 hover:bg-red-950 disabled:opacity-30">Offline</button>
            </div>
            <div className="mt-1 grid grid-cols-3 gap-2 text-xs text-gray-400">
              <span>CPU: {n.allocatedVcpu}/{n.totalVcpu}</span>
              <span>RAM: {formatMB(n.allocatedRamMB)}/{formatMB(n.totalRamMB)}</span>
              <span>Disk: {n.allocatedDiskGB}/{n.totalDiskGB}GB</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Input({ label, type = "text", value, onChange }: { label: string; type?: string; value: string | number; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs text-gray-400">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} required
        className="mt-1 block w-full rounded border border-gray-700 bg-gray-800 px-2.5 py-1.5 text-sm text-gray-100 focus:border-white focus:outline-none" />
    </div>
  );
}

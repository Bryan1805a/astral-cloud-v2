"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

interface Network {
  id: string; name: string; cidr: string; isActive: boolean;
  region: { id: string; name: string; slug: string };
  serverCount: number; createdAt: string;
}

interface NetworkDetail extends Network {
  servers: { id: string; hostname: string; status: string; privateIp: string; attachedAt: string }[];
}

interface RegionData { id: string; name: string; slug: string; }
interface ServerData { id: string; hostname: string; regionId: string; }

export default function PrivateNetworksPage() {
  const [networks, setNetworks] = useState<Network[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [regions, setRegions] = useState<RegionData[]>([]);
  const [servers, setServers] = useState<ServerData[]>([]);
  const [name, setName] = useState("");
  const [regionId, setRegionId] = useState("");
  const [cidr, setCidr] = useState("10.0.0.0/24");
  const [submitting, setSubmitting] = useState(false);

  const [viewingNetwork, setViewingNetwork] = useState<string | null>(null);
  const [networkDetail, setNetworkDetail] = useState<NetworkDetail | null>(null);
  const [attachServerId, setAttachServerId] = useState("");

  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

  const fetchNetworks = useCallback(async () => {
    try { setNetworks(await api.get<Network[]>("/private-networks")); }
    catch { /* noop */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchNetworks(); }, [fetchNetworks]);

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
      await api.post("/private-networks", { name: name.trim(), regionId, cidr });
      setName(""); setShowForm(false); setSuccess("Network created.");
      fetchNetworks();
    } catch (err: unknown) { setError((err as { message?: string }).message || "Failed"); }
    finally { setSubmitting(false); }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this network?")) return;
    try { await api.del(`/private-networks/${id}`); fetchNetworks(); }
    catch (err: unknown) { setError((err as { message?: string }).message || "Failed"); }
  }

  async function viewNetwork(id: string) {
    try {
      const detail = await api.get<NetworkDetail>(`/private-networks/${id}`);
      setNetworkDetail(detail);
      setViewingNetwork(id);
    } catch { /* noop */ }
  }

  async function handleAttach() {
    if (!viewingNetwork || !attachServerId) return;
    setSubmitting(true); setError("");
    try {
      await api.post(`/private-networks/${viewingNetwork}/`, { serverId: attachServerId });
      setSuccess("Server attached.");
      viewNetwork(viewingNetwork);
    } catch (err: unknown) { setError((err as { message?: string }).message || "Failed"); }
    finally { setSubmitting(false); }
  }

  async function handleDetach(serverId: string) {
    if (!viewingNetwork) return;
    try {
      await api.post(`/private-networks/${viewingNetwork}/detach`, { serverId });
      viewNetwork(viewingNetwork);
    } catch (err: unknown) { setError((err as { message?: string }).message || "Failed"); }
  }

  if (loading) return <div><h1 className="text-2xl font-bold">Private Networks</h1><p className="mt-4 text-gray-400">Loading...</p></div>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Private Networks</h1>
          <p className="text-sm text-gray-400">Virtual private networks for server-to-server communication</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200">
          {showForm ? "Cancel" : "Create Network"}
        </button>
      </div>

      {error && <div className="mt-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">{error}<button onClick={() => setError("")} className="ml-2 underline hover:text-red-300">Dismiss</button></div>}
      {success && <div className="mt-4 rounded-lg border border-emerald-800 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-400">{success}<button onClick={() => setSuccess("")} className="ml-2 underline hover:text-emerald-300">Dismiss</button></div>}

      {showForm && (
        <form onSubmit={handleCreate} className="mt-6 rounded-xl border border-gray-800 bg-gray-900/50 p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Name</label>
            <input type="text" required maxLength={64} value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. web-tier"
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
              <label className="block text-sm font-medium text-gray-300 mb-1">CIDR</label>
              <input type="text" required value={cidr} onChange={(e) => setCidr(e.target.value)}
                placeholder="10.0.0.0/24"
                className="block w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-gray-100 font-mono" />
            </div>
          </div>
          <button type="submit" disabled={submitting}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200 disabled:opacity-50">
            {submitting ? "Creating..." : "Create Network"}
          </button>
        </form>
      )}

      {viewingNetwork && networkDetail && (
        <div className="mt-6 rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-300">{networkDetail.name}</h3>
              <p className="text-xs text-gray-500">{networkDetail.cidr} · {networkDetail.region.name} ({networkDetail.region.slug}) · {networkDetail.serverCount} server{networkDetail.serverCount !== 1 ? "s" : ""}</p>
            </div>
            <button onClick={() => setViewingNetwork(null)}
              className="text-xs text-gray-400 hover:text-gray-300">Close</button>
          </div>

          <div className="flex items-end gap-3 mb-4">
            <div className="flex-1">
              <label className="block text-xs text-gray-400 mb-1">Attach Server</label>
              <select value={attachServerId} onChange={(e) => setAttachServerId(e.target.value)}
                className="block w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100">
                {servers.filter((s) => s.regionId === networkDetail.region.id && !networkDetail.servers.some((ms) => ms.id === s.id)).map((s) => (
                  <option key={s.id} value={s.id}>{s.hostname}</option>
                ))}
              </select>
            </div>
            <button onClick={handleAttach} disabled={submitting}
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200 disabled:opacity-50">Attach</button>
          </div>

          {networkDetail.servers.length === 0 ? (
            <p className="text-xs text-gray-500">No servers attached.</p>
          ) : (
            <div className="space-y-2">
              {networkDetail.servers.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded border border-gray-800 bg-gray-900/30 px-3 py-2">
                  <div className="flex items-center gap-3">
                    <Link href={`/dashboard/servers/${s.id}`} className="text-sm text-blue-400 hover:underline">{s.hostname}</Link>
                    <code className="text-xs text-gray-400">{s.privateIp}</code>
                  </div>
                  <button onClick={() => handleDetach(s.id)}
                    className="rounded border border-red-800 px-2 py-1 text-xs text-red-400 hover:bg-red-950/30">Detach</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {networks.length === 0 ? (
        <p className="mt-8 text-center text-gray-500">No private networks yet.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {networks.map((n) => (
            <div key={n.id} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3">
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-200">{n.name}</span>
                  <code className="text-xs text-gray-500">{n.cidr}</code>
                </div>
                <p className="mt-0.5 text-xs text-gray-500">
                  {n.region.name} ({n.region.slug}) · {n.serverCount} server{n.serverCount !== 1 ? "s" : ""} · {n.isActive ? <span className="text-emerald-400">Active</span> : <span className="text-gray-500">Inactive</span>}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => viewNetwork(n.id)}
                  className="rounded border border-blue-700 px-2 py-1 text-xs text-blue-400 hover:bg-blue-950/30">Manage</button>
                <button onClick={() => handleDelete(n.id)}
                  className="rounded border border-red-800 px-2 py-1 text-xs text-red-400 hover:bg-red-950/30">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

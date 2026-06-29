"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Region { id: string; name: string; slug: string; isActive: boolean; nodeCount: number; serverCount: number; createdAt: string; }

export default function AdminRegionsPage() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "" });

  const fetchRegions = async () => {
    try { setRegions(await api.get<Region[]>("/admin/regions")); } catch { setError("Failed to load"); } finally { setLoading(false); }
  };

  useEffect(() => { fetchRegions(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true); setError("");
    try { await api.post("/admin/regions", form); setShowForm(false); setForm({ name: "", slug: "" }); await fetchRegions(); }
    catch (err: unknown) { setError((err as { message?: string }).message || "Failed"); }
    finally { setSubmitting(false); }
  }

  async function handleDeactivate(id: string) {
    if (!window.confirm("Deactivate this region?")) return;
    try { await api.del(`/admin/regions/${id}`); await fetchRegions(); }
    catch (err: unknown) { setError((err as { message?: string }).message || "Failed"); }
  }

  if (loading) return <p className="text-gray-400">Loading...</p>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Regions</h1><p className="text-sm text-gray-400">{regions.length} regions</p></div>
        <button onClick={() => setShowForm(!showForm)} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200">{showForm ? "Cancel" : "Add Region"}</button>
      </div>
      {error && <div className="mt-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">{error}</div>}

      {showForm && (
        <form onSubmit={handleCreate} className="mt-4 rounded-xl border border-gray-800 bg-gray-900/50 p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Input label="Slug" value={form.slug} onChange={(v) => setForm({ ...form, slug: v })} placeholder="us-west" />
          </div>
          <button type="submit" disabled={submitting} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200 disabled:opacity-50">
            {submitting ? "Creating..." : "Create Region"}
          </button>
        </form>
      )}

      <div className="mt-6 space-y-2">
        {regions.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-200">{r.name}</span>
                <code className="text-xs text-gray-500">{r.slug}</code>
                {!r.isActive && <span className="rounded border border-red-700 px-1.5 py-0.5 text-[10px] text-red-400">Inactive</span>}
              </div>
              <div className="mt-1 text-xs text-gray-400">{r.nodeCount} nodes / {r.serverCount} servers</div>
            </div>
            <button onClick={() => handleDeactivate(r.id)} disabled={!r.isActive}
              className="rounded border border-red-700 px-3 py-1 text-xs text-red-400 hover:bg-red-950 disabled:opacity-30">Deactivate</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs text-gray-400">{label}</label>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} required placeholder={placeholder}
        className="mt-1 block w-full rounded border border-gray-700 bg-gray-800 px-2.5 py-1.5 text-sm text-gray-100 focus:border-white focus:outline-none" />
    </div>
  );
}

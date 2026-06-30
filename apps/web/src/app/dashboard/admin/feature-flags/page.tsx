"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

interface FeatureFlag {
  id: string; key: string; description: string;
  enabled: boolean; rules: unknown;
  updatedAt: string;
}

export default function AdminFeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchFlags = useCallback(async () => {
    try { setFlags(await api.get<FeatureFlag[]>("/admin/feature-flags")); }
    catch { /* noop */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchFlags(); }, [fetchFlags]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setError("");
    try {
      await api.post("/admin/feature-flags", { key: key.trim(), name: key.trim(), description });
      setKey(""); setDescription(""); setShowForm(false);
      fetchFlags();
    } catch (err: unknown) {
      setError((err as { message?: string }).message || "Failed");
    } finally { setSubmitting(false); }
  }

  async function toggleEnabled(flag: FeatureFlag) {
    try { await api.put(`/admin/feature-flags/${flag.id}`, { enabled: !flag.enabled }); fetchFlags(); }
    catch { /* noop */ }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this feature flag?")) return;
    try { await api.del(`/admin/feature-flags/${id}`); fetchFlags(); }
    catch { /* noop */ }
  }

  if (loading) return <div><h1 className="text-2xl font-bold">Feature Flags</h1><p className="mt-4 text-gray-400">Loading...</p></div>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Feature Flags</h1>
          <p className="text-sm text-gray-400">Control feature rollouts</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200">
          {showForm ? "Cancel" : "Add Flag"}
        </button>
      </div>

      {error && <div className="mt-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">{error}<button onClick={() => setError("")} className="ml-2 underline hover:text-red-300">Dismiss</button></div>}

      {showForm && (
        <form onSubmit={handleCreate} className="mt-6 rounded-xl border border-gray-800 bg-gray-900/50 p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Key</label>
              <input type="text" required maxLength={64} value={key} onChange={(e) => setKey(e.target.value)}
                placeholder="e.g. new_dashboard"
                className="block w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500" />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Description</label>
              <input type="text" required maxLength={255} value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="What this flag controls"
                className="block w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500" />
            </div>
          </div>
          <button type="submit" disabled={submitting}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200 disabled:opacity-50">
            {submitting ? "Creating..." : "Create Flag"}
          </button>
        </form>
      )}

      {flags.length === 0 ? (
        <p className="mt-8 text-center text-gray-500">No feature flags defined.</p>
      ) : (
        <div className="mt-6 space-y-2">
          {flags.map((f) => (
            <div key={f.id} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3">
              <div>
                <div className="flex items-center gap-3">
                  <code className="text-sm font-mono text-gray-200">{f.key}</code>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] ${f.enabled ? "bg-emerald-950/50 text-emerald-400 border border-emerald-800" : "bg-gray-800 text-gray-500 border border-gray-700"}`}>
                    {f.enabled ? "ENABLED" : "DISABLED"}
                  </span>
                </div>
                {f.description && <p className="mt-0.5 text-xs text-gray-500">{f.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleEnabled(f)}
                  className={`rounded border px-2 py-1 text-xs ${f.enabled ? "border-amber-700 text-amber-400 hover:bg-amber-950/30" : "border-emerald-700 text-emerald-400 hover:bg-emerald-950/30"}`}>
                  {f.enabled ? "Disable" : "Enable"}
                </button>
                <button onClick={() => handleDelete(f.id)}
                  className="rounded border border-red-800 px-2 py-1 text-xs text-red-400 hover:bg-red-950/30">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

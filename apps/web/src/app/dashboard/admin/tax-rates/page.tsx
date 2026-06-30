"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

interface TaxRate {
  id: string; regionId: string; name: string; rate: string; isActive: boolean;
  region: { id: string; name: string; slug: string };
  createdAt: string;
}

interface RegionData { id: string; name: string; slug: string; }

export default function AdminTaxRatesPage() {
  const [rates, setRates] = useState<TaxRate[]>([]);
  const [regions, setRegions] = useState<RegionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [regionId, setRegionId] = useState("");
  const [name, setName] = useState("");
  const [rate, setRate] = useState("0.00");
  const [submitting, setSubmitting] = useState(false);

  const fetchRates = useCallback(async () => {
    try { setRates(await api.get<TaxRate[]>("/admin/tax-rates")); }
    catch { /* noop */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchRates();
    const token = localStorage.getItem("access_token");
    fetch("/api/regions", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json()).then((j) => { setRegions(j.data || []); if (j.data?.length) setRegionId(j.data[0].id); }).catch(() => {});
  }, [fetchRates]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setError("");
    try {
      await api.post("/admin/tax-rates", { regionId, name: name.trim(), rate });
      setName(""); setRate("0.00"); setShowForm(false);
      fetchRates();
    } catch (err: unknown) {
      setError((err as { message?: string }).message || "Failed");
    } finally { setSubmitting(false); }
  }

  async function toggleActive(r: TaxRate) {
    try { await api.put(`/admin/tax-rates/${r.id}`, { isActive: !r.isActive }); fetchRates(); }
    catch { /* noop */ }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this tax rate?")) return;
    try { await api.del(`/admin/tax-rates/${id}`); fetchRates(); }
    catch { /* noop */ }
  }

  const availableRegions = regions.filter((reg) => !rates.some((r) => r.regionId === reg.id));

  if (loading) return <div><h1 className="text-2xl font-bold">Tax Rates</h1><p className="mt-4 text-gray-400">Loading...</p></div>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tax Rates</h1>
          <p className="text-sm text-gray-400">Configure region-based tax rates</p>
        </div>
        {availableRegions.length > 0 && (
          <button onClick={() => setShowForm(!showForm)}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200">
            {showForm ? "Cancel" : "Add Tax Rate"}
          </button>
        )}
      </div>

      {error && <div className="mt-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">{error}<button onClick={() => setError("")} className="ml-2 underline hover:text-red-300">Dismiss</button></div>}

      {showForm && (
        <form onSubmit={handleCreate} className="mt-6 rounded-xl border border-gray-800 bg-gray-900/50 p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Region</label>
              <select value={regionId} onChange={(e) => setRegionId(e.target.value)}
                className="block w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100">
                {availableRegions.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.slug})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Rate (%)</label>
              <input type="number" step="0.01" min="0" max="100" value={rate} onChange={(e) => setRate(e.target.value)}
                className="block w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Name</label>
            <input type="text" required maxLength={64} value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. US Sales Tax"
              className="block w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500" />
          </div>
          <button type="submit" disabled={submitting}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200 disabled:opacity-50">
            {submitting ? "Adding..." : "Add Tax Rate"}
          </button>
        </form>
      )}

      {rates.length === 0 ? (
        <p className="mt-8 text-center text-gray-500">No tax rates configured.</p>
      ) : (
        <div className="mt-6 space-y-2">
          {rates.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3">
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-200">{r.name}</span>
                  <span className="rounded bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-500">{r.region.slug}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] ${r.isActive ? "bg-emerald-950/50 text-emerald-400 border border-emerald-800" : "bg-gray-800 text-gray-500 border border-gray-700"}`}>
                    {r.isActive ? "ACTIVE" : "INACTIVE"}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-gray-400">{r.rate}%</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleActive(r)}
                  className={`rounded border px-2 py-1 text-xs ${r.isActive ? "border-amber-700 text-amber-400 hover:bg-amber-950/30" : "border-emerald-700 text-emerald-400 hover:bg-emerald-950/30"}`}>
                  {r.isActive ? "Disable" : "Enable"}
                </button>
                <button onClick={() => handleDelete(r.id)}
                  className="rounded border border-red-800 px-2 py-1 text-xs text-red-400 hover:bg-red-950/30">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

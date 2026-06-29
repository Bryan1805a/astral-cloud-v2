"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Region { id: string; name: string; slug: string; }
interface Plan {
  id: string; name: string; slug: string;
  vcpu: number; ramMB: number; diskGB: number; bandwidthMbps: number;
  priceMonthly: string; priceHourly: string;
  maxServers: number | null; isActive: boolean;
  regions: Region[];
  createdAt: string;
}

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", vcpu: 2, ramMB: 2048, diskGB: 25, bandwidthMbps: 100, priceMonthly: "10.00", priceHourly: "0.015", maxServers: "", regionIds: [] as string[] });

  const fetchPlans = async () => {
    try { setPlans(await api.get<Plan[]>("/admin/plans")); } catch { setError("Failed to load plans"); } finally { setLoading(false); }
  };

  const fetchRegions = async () => {
    try { setRegions(await api.get<Region[]>("/regions")); } catch { /* noop */ }
  };

  useEffect(() => { fetchPlans(); fetchRegions(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await api.post("/admin/plans", {
        ...form,
        vcpu: Number(form.vcpu),
        ramMB: Number(form.ramMB),
        diskGB: Number(form.diskGB),
        bandwidthMbps: Number(form.bandwidthMbps),
        maxServers: form.maxServers ? Number(form.maxServers) : null,
      });
      setShowForm(false);
      setForm({ name: "", slug: "", vcpu: 2, ramMB: 2048, diskGB: 25, bandwidthMbps: 100, priceMonthly: "10.00", priceHourly: "0.015", maxServers: "", regionIds: [] });
      await fetchPlans();
    } catch (err: unknown) {
      setError((err as { message?: string }).message || "Failed to create plan");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivate(planId: string) {
    if (!window.confirm("Deactivate this plan?")) return;
    try {
      await api.del(`/admin/plans/${planId}`);
      await fetchPlans();
    } catch (err: unknown) {
      setError((err as { message?: string }).message || "Failed to deactivate");
    }
  }

  if (loading) return <p className="text-gray-400">Loading plans...</p>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Server Plans</h1>
          <p className="mt-1 text-sm text-gray-400">{plans.length} plans</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200">
          {showForm ? "Cancel" : "Add Plan"}
        </button>
      </div>

      {error && <div className="mt-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">{error}</div>}

      {showForm && (
        <form onSubmit={handleCreate} className="mt-4 rounded-xl border border-gray-800 bg-gray-900/50 p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Input label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Input label="Slug" value={form.slug} onChange={(v) => setForm({ ...form, slug: v })} />
            <Input label="vCPU" type="number" value={form.vcpu} onChange={(v) => setForm({ ...form, vcpu: Number(v) })} />
            <Input label="RAM (MB)" type="number" value={form.ramMB} onChange={(v) => setForm({ ...form, ramMB: Number(v) })} />
            <Input label="Disk (GB)" type="number" value={form.diskGB} onChange={(v) => setForm({ ...form, diskGB: Number(v) })} />
            <Input label="Bandwidth (Mbps)" type="number" value={form.bandwidthMbps} onChange={(v) => setForm({ ...form, bandwidthMbps: Number(v) })} />
            <Input label="Price Monthly ($)" value={form.priceMonthly} onChange={(v) => setForm({ ...form, priceMonthly: v })} />
            <Input label="Price Hourly ($)" value={form.priceHourly} onChange={(v) => setForm({ ...form, priceHourly: v })} />
            <Input label="Max Servers (optional)" type="number" value={form.maxServers} onChange={(v) => setForm({ ...form, maxServers: v })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Regions</label>
            <div className="flex flex-wrap gap-2">
              {regions.map((r) => (
                <button key={r.id} type="button" onClick={() => {
                  setForm(f => ({ ...f, regionIds: f.regionIds.includes(r.id) ? f.regionIds.filter(id => id !== r.id) : [...f.regionIds, r.id] }));
                }}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${form.regionIds.includes(r.id) ? "border-white bg-gray-800 text-white" : "border-gray-700 text-gray-400"}`}>
                  {r.name}
                </button>
              ))}
            </div>
          </div>
          <button type="submit" disabled={submitting} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200 disabled:opacity-50">
            {submitting ? "Creating..." : "Create Plan"}
          </button>
        </form>
      )}

      <div className="mt-6 space-y-2">
        {plans.map((p) => (
          <div key={p.id} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-200">{p.name}</span>
                <code className="text-xs text-gray-500">{p.slug}</code>
                {!p.isActive && <span className="rounded border border-red-700 px-1.5 py-0.5 text-[10px] text-red-400">Inactive</span>}
              </div>
              <div className="mt-1 text-xs text-gray-400">
                {p.vcpu}vCPU / {p.ramMB}MB RAM / {p.diskGB}GB Disk / ${p.priceMonthly}/mo
                <span className="ml-2 text-gray-600">{p.regions.map(r => r.slug).join(", ")}</span>
              </div>
            </div>
            <button onClick={() => handleDeactivate(p.id)} disabled={!p.isActive}
              className="rounded border border-red-700 px-3 py-1 text-xs text-red-400 hover:bg-red-950 disabled:opacity-30">
              Deactivate
            </button>
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

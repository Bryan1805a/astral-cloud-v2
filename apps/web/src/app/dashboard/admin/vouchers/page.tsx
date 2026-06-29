"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Voucher {
  id: string; code: string; description: string; discountType: string;
  discountValue: string; maxUses: number | null; currentUses: number;
  maxUsesPerUser: number; minSpend: string | null;
  validFrom: string | null; validUntil: string | null;
  isActive: boolean; createdBy: string; createdAt: string;
}

export default function AdminVouchersPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ code: "", description: "", discountType: "PERCENTAGE" as "PERCENTAGE" | "FIXED_AMOUNT", discountValue: 10, maxUses: "", maxUsesPerUser: 1, minSpend: "", validFrom: "", validUntil: "" });

  const fetchVouchers = async () => {
    try { setVouchers(await api.get<Voucher[]>("/admin/vouchers")); } catch { setError("Failed to load"); } finally { setLoading(false); }
  };

  useEffect(() => { fetchVouchers(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true); setError("");
    try {
      await api.post("/admin/vouchers", {
        code: form.code, description: form.description,
        discountType: form.discountType, discountValue: Number(form.discountValue),
        maxUses: form.maxUses ? Number(form.maxUses) : null,
        maxUsesPerUser: Number(form.maxUsesPerUser),
        minSpend: form.minSpend ? Number(form.minSpend) : null,
        validFrom: form.validFrom || null, validUntil: form.validUntil || null,
      });
      setShowForm(false);
      setForm({ code: "", description: "", discountType: "PERCENTAGE", discountValue: 10, maxUses: "", maxUsesPerUser: 1, minSpend: "", validFrom: "", validUntil: "" });
      await fetchVouchers();
    } catch (err: unknown) { setError((err as { message?: string }).message || "Failed"); }
    finally { setSubmitting(false); }
  }

  async function handleDeactivate(id: string) {
    if (!window.confirm("Deactivate this voucher?")) return;
    try { await api.del(`/admin/vouchers/${id}`); await fetchVouchers(); }
    catch (err: unknown) { setError((err as { message?: string }).message || "Failed"); }
  }

  if (loading) return <p className="text-gray-400">Loading...</p>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Vouchers</h1><p className="text-sm text-gray-400">{vouchers.length} vouchers</p></div>
        <button onClick={() => setShowForm(!showForm)} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200">{showForm ? "Cancel" : "Create Voucher"}</button>
      </div>
      {error && <div className="mt-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">{error}</div>}

      {showForm && (
        <form onSubmit={handleCreate} className="mt-4 rounded-xl border border-gray-800 bg-gray-900/50 p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Input label="Code" value={form.code} onChange={(v) => setForm({ ...form, code: v })} />
            <Input label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
            <div>
              <label className="block text-xs text-gray-400">Type</label>
              <select value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value as "PERCENTAGE" | "FIXED_AMOUNT" })}
                className="mt-1 block w-full rounded border border-gray-700 bg-gray-800 px-2.5 py-1.5 text-sm text-gray-100">
                <option value="PERCENTAGE">Percentage</option>
                <option value="FIXED_AMOUNT">Fixed Amount</option>
              </select>
            </div>
            <Input label={`Value (${form.discountType === "PERCENTAGE" ? "%" : "$"})`} type="number" value={form.discountValue} onChange={(v) => setForm({ ...form, discountValue: Number(v) })} />
            <Input label="Max Uses (optional)" type="number" value={form.maxUses} onChange={(v) => setForm({ ...form, maxUses: v })} />
            <Input label="Max Per User" type="number" value={form.maxUsesPerUser} onChange={(v) => setForm({ ...form, maxUsesPerUser: Number(v) })} />
            <Input label="Min Spend (optional)" type="number" value={form.minSpend} onChange={(v) => setForm({ ...form, minSpend: v })} />
            <Input label="Valid From (optional)" value={form.validFrom} onChange={(v) => setForm({ ...form, validFrom: v })} placeholder="2026-07-01T00:00Z" />
            <Input label="Valid Until (optional)" value={form.validUntil} onChange={(v) => setForm({ ...form, validUntil: v })} placeholder="2026-12-31T23:59Z" />
          </div>
          <button type="submit" disabled={submitting} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200 disabled:opacity-50">
            {submitting ? "Creating..." : "Create Voucher"}
          </button>
        </form>
      )}

      <div className="mt-6 space-y-2">
        {vouchers.map((v) => (
          <div key={v.id} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3">
            <div>
              <div className="flex items-center gap-2">
                <code className="font-mono font-bold text-gray-200">{v.code}</code>
                {!v.isActive && <span className="rounded border border-red-700 px-1.5 py-0.5 text-[10px] text-red-400">Inactive</span>}
              </div>
              <div className="mt-1 text-xs text-gray-400">
                {v.discountType === "PERCENTAGE" ? `${v.discountValue}% off` : `$${v.discountValue} off`} &middot; {v.currentUses}/{v.maxUses || "∞"} used &middot; by {v.createdBy}
              </div>
            </div>
            <button onClick={() => handleDeactivate(v.id)} disabled={!v.isActive}
              className="rounded border border-red-700 px-3 py-1 text-xs text-red-400 hover:bg-red-950 disabled:opacity-30">Deactivate</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Input({ label, type = "text", value, onChange, placeholder }: { label: string; type?: string; value: string | number; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs text-gray-400">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="mt-1 block w-full rounded border border-gray-700 bg-gray-800 px-2.5 py-1.5 text-sm text-gray-100 focus:border-white focus:outline-none" />
    </div>
  );
}

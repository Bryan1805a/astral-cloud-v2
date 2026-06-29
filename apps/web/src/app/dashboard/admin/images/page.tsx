"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Region { id: string; name: string; slug: string; }
interface Image {
  id: string; name: string; slug: string; osType: string; version: string;
  dockerImage: string; diskSizeGB: number; defaultUser: string;
  isActive: boolean; regions: Region[]; createdAt: string;
}

export default function AdminImagesPage() {
  const [images, setImages] = useState<Image[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", version: "", dockerImage: "", diskSizeGB: 5, defaultUser: "root", regionIds: [] as string[] });

  const fetchImages = async () => {
    try { setImages(await api.get<Image[]>("/admin/images")); } catch { setError("Failed to load"); } finally { setLoading(false); }
  };
  const fetchRegions = async () => { try { setRegions(await api.get<Region[]>("/regions")); } catch { /* noop */ } };

  useEffect(() => { fetchImages(); fetchRegions(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await api.post("/admin/images", { ...form, osType: "LINUX" });
      setShowForm(false);
      setForm({ name: "", slug: "", version: "", dockerImage: "", diskSizeGB: 5, defaultUser: "root", regionIds: [] });
      await fetchImages();
    } catch (err: unknown) {
      setError((err as { message?: string }).message || "Failed to create image");
    } finally { setSubmitting(false); }
  }

  async function handleDeactivate(id: string) {
    if (!window.confirm("Deactivate this image?")) return;
    try { await api.del(`/admin/images/${id}`); await fetchImages(); }
    catch (err: unknown) { setError((err as { message?: string }).message || "Failed"); }
  }

  if (loading) return <p className="text-gray-400">Loading...</p>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Image Templates</h1><p className="text-sm text-gray-400">{images.length} images</p></div>
        <button onClick={() => setShowForm(!showForm)} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200">{showForm ? "Cancel" : "Add Image"}</button>
      </div>
      {error && <div className="mt-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">{error}</div>}

      {showForm && (
        <form onSubmit={handleCreate} className="mt-4 rounded-xl border border-gray-800 bg-gray-900/50 p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Input label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Input label="Slug" value={form.slug} onChange={(v) => setForm({ ...form, slug: v })} />
            <Input label="Version" value={form.version} onChange={(v) => setForm({ ...form, version: v })} />
            <Input label="Docker Image" value={form.dockerImage} onChange={(v) => setForm({ ...form, dockerImage: v })} placeholder="registry.astral.cloud/ubuntu:24.04" />
            <Input label="Disk Size (GB)" type="number" value={form.diskSizeGB} onChange={(v) => setForm({ ...form, diskSizeGB: Number(v) })} />
            <Input label="Default User" value={form.defaultUser} onChange={(v) => setForm({ ...form, defaultUser: v })} />
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
            {submitting ? "Creating..." : "Create Image"}
          </button>
        </form>
      )}

      <div className="mt-6 space-y-2">
        {images.map((i) => (
          <div key={i.id} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-200">{i.name}</span>
                <code className="text-xs text-gray-500">{i.slug}</code>
                {!i.isActive && <span className="rounded border border-red-700 px-1.5 py-0.5 text-[10px] text-red-400">Inactive</span>}
              </div>
              <div className="mt-1 text-xs text-gray-400">
                {i.version} / {i.osType} / {i.diskSizeGB}GB / user: {i.defaultUser}
                <span className="ml-2 text-gray-600">{i.regions.map(r => r.slug).join(", ")}</span>
              </div>
            </div>
            <button onClick={() => handleDeactivate(i.id)} disabled={!i.isActive}
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
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} required placeholder={placeholder}
        className="mt-1 block w-full rounded border border-gray-700 bg-gray-800 px-2.5 py-1.5 text-sm text-gray-100 focus:border-white focus:outline-none" />
    </div>
  );
}

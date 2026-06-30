"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

interface Announcement {
  id: string; title: string; body: string; severity: string;
  isActive: boolean; startsAt: string | null; endsAt: string | null;
  createdBy: string; createdAt: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  INFO: "border-blue-700 text-blue-400 bg-blue-950/30",
  WARNING: "border-amber-700 text-amber-400 bg-amber-950/30",
  CRITICAL: "border-red-700 text-red-400 bg-red-950/30",
};

export default function AdminAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [severity, setSeverity] = useState("INFO");
  const [submitting, setSubmitting] = useState(false);

  const fetchAll = useCallback(async () => {
    try { setAnnouncements(await api.get<Announcement[]>("/admin/announcements")); }
    catch { /* noop */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setError("");
    try {
      await api.post("/admin/announcements", { title, body, severity });
      setTitle(""); setBody(""); setSeverity("INFO"); setShowForm(false);
      await fetchAll();
    } catch (err: unknown) {
      setError((err as { message?: string }).message || "Failed to create");
    } finally { setSubmitting(false); }
  }

  async function toggleActive(id: string, current: boolean) {
    try { await api.put(`/admin/announcements/${id}`, { isActive: !current }); fetchAll(); }
    catch { /* noop */ }
  }

  async function handleDelete(id: string, title: string) {
    if (!window.confirm(`Delete "${title}"?`)) return;
    try { await api.del(`/admin/announcements/${id}`); fetchAll(); }
    catch { /* noop */ }
  }

  if (loading) return <div><h1 className="text-2xl font-bold">Announcements</h1><p className="mt-4 text-gray-400">Loading...</p></div>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Announcements</h1>
          <p className="text-sm text-gray-400">Platform-wide notices visible to all users</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200">
          {showForm ? "Cancel" : "New Announcement"}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">
          {error}<button onClick={() => setError("")} className="ml-2 underline hover:text-red-300">Dismiss</button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="mt-6 rounded-xl border border-gray-800 bg-gray-900/50 p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Title</label>
            <input type="text" required maxLength={128} value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Scheduled maintenance on June 15"
              className="block w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:border-white focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Body</label>
            <textarea required rows={4} value={body} onChange={(e) => setBody(e.target.value)}
              placeholder="Describe what users need to know..."
              className="block w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:border-white focus:outline-none resize-y" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Severity</label>
            <select value={severity} onChange={(e) => setSeverity(e.target.value)}
              className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-gray-100">
              <option value="INFO">INFO - General notice</option>
              <option value="WARNING">WARNING - Important update</option>
              <option value="CRITICAL">CRITICAL - Service impact</option>
            </select>
          </div>
          <button type="submit" disabled={submitting}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200 disabled:opacity-50">
            {submitting ? "Creating..." : "Create Announcement"}
          </button>
        </form>
      )}

      {announcements.length === 0 ? (
        <p className="mt-8 text-center text-gray-500">No announcements yet.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {announcements.map((a) => (
            <div key={a.id} className="flex items-start justify-between rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-gray-200">{a.title}</span>
                  <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${SEVERITY_COLORS[a.severity] || ""}`}>
                    {a.severity}
                  </span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] ${a.isActive ? "bg-emerald-950/50 text-emerald-400 border border-emerald-800" : "bg-gray-800 text-gray-500 border border-gray-700"}`}>
                    {a.isActive ? "ACTIVE" : "INACTIVE"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-400 line-clamp-2">{a.body}</p>
                <div className="mt-1 text-xs text-gray-600">
                  {a.createdBy} · {new Date(a.createdAt).toLocaleDateString()}
                  {a.startsAt && <span className="ml-2">from {new Date(a.startsAt).toLocaleDateString()}</span>}
                  {a.endsAt && <span className="ml-2">to {new Date(a.endsAt).toLocaleDateString()}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <button onClick={() => toggleActive(a.id, a.isActive)}
                  className={`rounded border px-2 py-1 text-xs ${a.isActive ? "border-amber-700 text-amber-400 hover:bg-amber-950/30" : "border-emerald-700 text-emerald-400 hover:bg-emerald-950/30"}`}>
                  {a.isActive ? "Deactivate" : "Activate"}
                </button>
                <button onClick={() => handleDelete(a.id, a.title)}
                  className="rounded border border-red-800 px-2 py-1 text-xs text-red-400 hover:bg-red-950/30">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

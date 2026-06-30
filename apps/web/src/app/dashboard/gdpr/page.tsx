"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

interface GdprRequest {
  id: string; type: string; status: string;
  downloadUrl: string | null; completedAt: string | null;
  expiresAt: string | null; createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "border-amber-700 text-amber-400 bg-amber-950/30",
  PROCESSING: "border-blue-700 text-blue-400 bg-blue-950/30",
  COMPLETED: "border-emerald-700 text-emerald-400 bg-emerald-950/30",
  FAILED: "border-red-700 text-red-400 bg-red-950/30",
};

export default function GdprPage() {
  const [requests, setRequests] = useState<GdprRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deleteUsername, setDeleteUsername] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchRequests = useCallback(async () => {
    try { setRequests(await api.get<GdprRequest[]>("/gdpr")); }
    catch { /* noop */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  async function handleExport() {
    setSubmitting(true); setError(""); setSuccess("");
    try {
      const result = await api.post<{ downloadUrl: string }>("/gdpr", { type: "EXPORT" });
      if (result.downloadUrl) {
        window.open(result.downloadUrl, "_blank");
        setSuccess("Your data has been exported and opened in a new tab.");
      }
      fetchRequests();
    } catch (err: unknown) {
      setError((err as { message?: string }).message || "Export failed");
    } finally { setSubmitting(false); }
  }

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    if (!deleteUsername.trim()) return;
    setSubmitting(true); setError(""); setSuccess("");
    try {
      const result = await api.post<{ message: string }>("/gdpr", {
        type: "DELETE", confirmUsername: deleteUsername.trim(),
      });
      setSuccess(result.message);
      setDeleteUsername("");
      fetchRequests();
    } catch (err: unknown) {
      setError((err as { message?: string }).message || "Deletion request failed");
    } finally { setSubmitting(false); }
  }

  if (loading) return <div><h1 className="text-2xl font-bold">Data & Privacy</h1><p className="mt-4 text-gray-400">Loading...</p></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold">Data & Privacy</h1>
      <p className="text-sm text-gray-400">Manage your personal data and privacy settings</p>

      {error && <div className="mt-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">{error}<button onClick={() => setError("")} className="ml-2 underline hover:text-red-300">Dismiss</button></div>}
      {success && <div className="mt-4 rounded-lg border border-emerald-800 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-400">{success}<button onClick={() => setSuccess("")} className="ml-2 underline hover:text-emerald-300">Dismiss</button></div>}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
          <h3 className="text-sm font-semibold text-gray-300">Export Your Data</h3>
          <p className="mt-2 text-sm text-gray-400">Download a machine-readable JSON file containing your profile, servers, and payment history.</p>
          <button onClick={handleExport} disabled={submitting}
            className="mt-4 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200 disabled:opacity-50">
            {submitting ? "Exporting..." : "Export My Data"}
          </button>
        </div>

        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-6">
          <h3 className="text-sm font-semibold text-red-400">Delete Account</h3>
          <p className="mt-2 text-sm text-gray-400">
            Permanently delete your account and all associated data. This action cannot be undone.
            Data is removed within 30 days per GDPR requirements.
          </p>
          <p className="mt-2 text-xs text-amber-400">You must delete all your servers before requesting account deletion.</p>
          <form onSubmit={handleDelete} className="mt-4 space-y-3">
            <input type="text" required value={deleteUsername} onChange={(e) => setDeleteUsername(e.target.value)}
              placeholder="Type your username to confirm"
              className="block w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:border-red-500 focus:outline-none" />
            <button type="submit" disabled={submitting || !deleteUsername.trim()}
              className="rounded-lg border border-red-700 bg-red-950/30 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-950/50 disabled:opacity-50">
              {submitting ? "Processing..." : "Delete My Account"}
            </button>
          </form>
        </div>
      </div>

      {requests.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Request History</h3>
          <div className="space-y-2">
            {requests.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status] || ""}`}>{r.status}</span>
                  <span className="text-sm text-gray-300">{r.type === "EXPORT" ? "Data Export" : "Account Deletion"}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  {r.downloadUrl && r.status === "COMPLETED" && (
                    <a href={r.downloadUrl} target="_blank" className="text-blue-400 hover:underline">Download</a>
                  )}
                  {r.expiresAt && <span>Expires {new Date(r.expiresAt).toLocaleDateString()}</span>}
                  <span>{new Date(r.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

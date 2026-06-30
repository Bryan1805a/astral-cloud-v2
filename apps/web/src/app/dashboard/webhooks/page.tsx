"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

interface WebhookEndpoint {
  id: string; url: string; events: string[]; isActive: boolean;
  secret?: string; deliveryCount: number;
  lastDeliveryAt: string | null; createdAt: string; updatedAt: string;
}

interface Delivery {
  id: string; event: string; status: string;
  responseCode: number | null; attemptCount: number;
  payload: Record<string, unknown>;
  createdAt: string;
}

const EVENT_LABELS: Record<string, string> = {
  "server.created": "Server Created",
  "server.started": "Server Started",
  "server.stopped": "Server Stopped",
  "server.deleted": "Server Deleted",
  "backup.completed": "Backup Completed",
  "backup.failed": "Backup Failed",
  "payment.succeeded": "Payment Succeeded",
  "payment.failed": "Payment Failed",
};

export default function WebhooksPage() {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<string[]>(["server.created"]);
  const [submitting, setSubmitting] = useState(false);

  const [viewingDeliveries, setViewingDeliveries] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);

  const fetchEndpoints = useCallback(async () => {
    try { setEndpoints(await api.get<WebhookEndpoint[]>("/webhooks")); }
    catch { /* noop */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchEndpoints(); }, [fetchEndpoints]);

  async function toggleEvent(e: string) {
    setSelectedEvents((prev) =>
      prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]
    );
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (selectedEvents.length === 0) return;
    setSubmitting(true); setError("");
    try {
      const result = await api.post<WebhookEndpoint>("/webhooks", { url: url.trim(), events: selectedEvents });
      setCreatedSecret(result.secret || null);
      setUrl(""); setSelectedEvents(["server.created"]); setShowForm(false);
      await fetchEndpoints();
      setSuccess("Webhook created. Copy the secret now — it won't be shown again.");
    } catch (err: unknown) {
      setError((err as { message?: string }).message || "Failed");
    } finally { setSubmitting(false); }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this webhook?")) return;
    try { await api.del(`/webhooks/${id}`); fetchEndpoints(); }
    catch (err: unknown) { setError((err as { message?: string }).message || "Failed"); }
  }

  async function toggleActive(endpoint: WebhookEndpoint) {
    try { await api.put(`/webhooks/${endpoint.id}`, { isActive: !endpoint.isActive }); fetchEndpoints(); }
    catch { /* noop */ }
  }

  async function viewDeliveries(endpointId: string) {
    try {
      const data = await api.get<Delivery[]>(`/webhooks/${endpointId}/deliveries`);
      setDeliveries(data);
      setViewingDeliveries(endpointId);
    } catch { /* noop */ }
  }

  if (loading) return <div><h1 className="text-2xl font-bold">Webhooks</h1><p className="mt-4 text-gray-400">Loading...</p></div>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Webhooks</h1>
          <p className="text-sm text-gray-400">Receive event notifications at your own URL</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200">
          {showForm ? "Cancel" : "Add Webhook"}
        </button>
      </div>

      {error && <div className="mt-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">{error}<button onClick={() => setError("")} className="ml-2 underline hover:text-red-300">Dismiss</button></div>}
      {success && <div className="mt-4 rounded-lg border border-emerald-800 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-400">{success}<button onClick={() => setSuccess("")} className="ml-2 underline hover:text-emerald-300">Dismiss</button></div>}

      {createdSecret && (
        <div className="mt-4 rounded-lg border border-amber-800 bg-amber-950/30 px-4 py-3">
          <p className="text-xs text-amber-400 font-semibold">Signing Secret (copy now!)</p>
          <code className="mt-1 block text-xs text-amber-300 break-all">{createdSecret}</code>
          <button onClick={() => setCreatedSecret(null)} className="mt-2 text-xs text-amber-400 hover:underline">Dismiss</button>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="mt-6 rounded-xl border border-gray-800 bg-gray-900/50 p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">URL</label>
            <input type="url" required value={url} onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-server.com/webhooks"
              className="block w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:border-white focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Events</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Object.entries(EVENT_LABELS).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer text-sm text-gray-400 hover:text-gray-300">
                  <input type="checkbox" checked={selectedEvents.includes(key)} onChange={() => toggleEvent(key)}
                    className="rounded border-gray-600 bg-gray-800" />
                  {label}
                </label>
              ))}
            </div>
          </div>
          <button type="submit" disabled={submitting || selectedEvents.length === 0}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200 disabled:opacity-50">
            {submitting ? "Creating..." : "Create Webhook"}
          </button>
        </form>
      )}

      {viewingDeliveries && (
        <div className="mt-6 rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-300">Delivery History</h3>
            <button onClick={() => setViewingDeliveries(null)}
              className="text-xs text-gray-400 hover:text-gray-300">Close</button>
          </div>
          {deliveries.length === 0 ? <p className="text-xs text-gray-500">No deliveries yet.</p> : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {deliveries.map((d) => (
                <div key={d.id} className={`rounded border px-3 py-2 text-xs ${d.status === "DELIVERED" ? "border-emerald-800 bg-emerald-950/20" : "border-red-800 bg-red-950/20"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">{d.event}</span>
                    <span className={d.status === "DELIVERED" ? "text-emerald-400" : "text-red-400"}>{d.status} {d.responseCode ? `(${d.responseCode})` : ""}</span>
                  </div>
                  <div className="mt-1 text-gray-600">{new Date(d.createdAt).toLocaleString()} · {d.attemptCount} attempt{d.attemptCount !== 1 ? "s" : ""}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {endpoints.length === 0 ? (
        <p className="mt-8 text-center text-gray-500">No webhooks configured.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {endpoints.map((ep) => (
            <div key={ep.id} className="rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <code className="text-sm text-gray-200 truncate block max-w-md">{ep.url}</code>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] ${ep.isActive ? "bg-emerald-950/50 text-emerald-400 border border-emerald-800" : "bg-gray-800 text-gray-500 border border-gray-700"}`}>
                      {ep.isActive ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(ep.events as string[]).map((ev) => (
                      <span key={ev} className="rounded border border-gray-700 px-1.5 py-0.5 text-[10px] text-gray-500">{ev}</span>
                    ))}
                  </div>
                  <div className="mt-1 text-xs text-gray-600">{ep.deliveryCount} deliveries{ep.lastDeliveryAt ? ` · last: ${new Date(ep.lastDeliveryAt).toLocaleString()}` : ""}</div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button onClick={() => viewDeliveries(ep.id)}
                    className="rounded border border-gray-700 px-2 py-1 text-xs text-gray-400 hover:bg-gray-800">Log</button>
                  <button onClick={() => toggleActive(ep)}
                    className={`rounded border px-2 py-1 text-xs ${ep.isActive ? "border-amber-700 text-amber-400 hover:bg-amber-950/30" : "border-emerald-700 text-emerald-400 hover:bg-emerald-950/30"}`}>
                    {ep.isActive ? "Disable" : "Enable"}
                  </button>
                  <button onClick={() => handleDelete(ep.id)}
                    className="rounded border border-red-800 px-2 py-1 text-xs text-red-400 hover:bg-red-950/30">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

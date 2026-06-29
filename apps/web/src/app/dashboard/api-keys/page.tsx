"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

interface ApiKey {
  id: string;
  label: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    try {
      const data = await api.get<ApiKey[]>("/api-keys");
      setKeys(data);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Failed to load API keys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim()) return;
    setSubmitting(true);
    setError("");
    setCreatedKey(null);
    try {
      const result = await api.post<{
        id: string;
        label: string;
        key: string;
        keyPrefix: string;
        expiresAt: string | null;
        createdAt: string;
      }>("/api-keys", { label: newLabel.trim() });
      setCreatedKey(result.key);
      setNewLabel("");
      await fetchKeys();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Failed to create API key");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(keyId: string) {
    if (!window.confirm("Revoke this API key? It will immediately stop working.")) return;
    try {
      await api.del(`/api-keys/${keyId}`);
      await fetchKeys();
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || "Failed to revoke key");
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">API Keys</h1>
      <p className="mt-1 text-sm text-gray-400">Manage API keys for programmatic access</p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">
          {error}
          <button onClick={() => setError("")} className="ml-2 underline hover:text-red-300">Dismiss</button>
        </div>
      )}

      {createdKey && (
        <div className="mt-6 rounded-lg border border-emerald-800 bg-emerald-950/50 p-4">
          <p className="text-sm font-medium text-emerald-400">API key created successfully</p>
          <p className="mt-2 text-sm text-gray-300">Copy this key now — it won't be shown again.</p>
          <div className="mt-2 flex items-center gap-3">
            <code className="flex-1 rounded border border-emerald-700 bg-gray-900 px-3 py-2 font-mono text-sm text-emerald-300 break-all">
              {createdKey}
            </code>
            <button
              onClick={() => {
                navigator.clipboard.writeText(createdKey);
              }}
              className="rounded-lg border border-emerald-700 px-3 py-2 text-xs font-medium text-emerald-400 hover:bg-emerald-950 transition-colors"
            >
              Copy
            </button>
          </div>
          <button
            onClick={() => setCreatedKey(null)}
            className="mt-3 text-xs text-gray-400 underline hover:text-gray-300"
          >
            Dismiss
          </button>
        </div>
      )}

      <form onSubmit={handleCreate} className="mt-6 flex gap-3">
        <input
          type="text"
          required
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          maxLength={64}
          className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-gray-100 placeholder-gray-500 focus:border-white focus:outline-none focus:ring-1 focus:ring-white"
          placeholder="Label (e.g. My CI/CD Pipeline)"
        />
        <button
          type="submit"
          disabled={submitting || !newLabel.trim()}
          className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          {submitting ? "Creating..." : "Create Key"}
        </button>
      </form>

      {loading ? (
        <p className="mt-8 text-gray-400">Loading API keys...</p>
      ) : keys.length === 0 ? (
        <p className="mt-8 text-sm text-gray-500">No API keys created yet.</p>
      ) : (
        <div className="mt-6 space-y-2">
          {keys.map((key) => (
            <div key={key.id} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-200">{key.label}</span>
                  <code className="font-mono text-xs text-gray-500">{key.keyPrefix}...</code>
                </div>
                <div className="mt-1 flex gap-4 text-xs text-gray-500">
                  <span>Created: {new Date(key.createdAt).toLocaleDateString()}</span>
                  {key.lastUsedAt && <span>Last used: {new Date(key.lastUsedAt).toLocaleString()}</span>}
                  {key.expiresAt && <span className="text-amber-400">Expires: {new Date(key.expiresAt).toLocaleDateString()}</span>}
                </div>
              </div>
              <button
                onClick={() => handleDelete(key.id)}
                className="rounded-lg border border-red-700 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-950 transition-colors"
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

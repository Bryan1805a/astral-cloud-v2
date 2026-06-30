"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

interface SshKey {
  id: string; label: string; createdAt: string;
}

export default function SshKeysPage() {
  const [keys, setKeys] = useState<SshKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchKeys = useCallback(async () => {
    try { setKeys(await api.get<SshKey[]>("/ssh-keys")); }
    catch { /* noop */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setError("");
    try {
      await api.post("/ssh-keys", { label: label.trim(), publicKey: publicKey.trim() });
      setLabel(""); setPublicKey(""); setShowForm(false);
      setSuccess("SSH key added.");
      fetchKeys();
    } catch (err: unknown) {
      setError((err as { message?: string }).message || "Failed to add key");
    } finally { setSubmitting(false); }
  }

  async function handleDelete(id: string, label: string) {
    if (!window.confirm(`Delete SSH key "${label}"?`)) return;
    setError("");
    try { await api.del(`/ssh-keys/${id}`); fetchKeys(); }
    catch (err: unknown) { setError((err as { message?: string }).message || "Failed to delete"); }
  }

  if (loading) return <div><h1 className="text-2xl font-bold">SSH Keys</h1><p className="mt-4 text-gray-400">Loading...</p></div>;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">SSH Keys</h1>
          <p className="text-sm text-gray-400">Manage SSH public keys for server authentication</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200">
          {showForm ? "Cancel" : "Add SSH Key"}
        </button>
      </div>

      {error && <div className="mt-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">{error}<button onClick={() => setError("")} className="ml-2 underline hover:text-red-300">Dismiss</button></div>}
      {success && <div className="mt-4 rounded-lg border border-emerald-800 bg-emerald-950/50 px-4 py-3 text-sm text-emerald-400">{success}<button onClick={() => setSuccess("")} className="ml-2 underline hover:text-emerald-300">Dismiss</button></div>}

      {showForm && (
        <form onSubmit={handleAdd} className="mt-6 rounded-xl border border-gray-800 bg-gray-900/50 p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Label</label>
            <input type="text" required maxLength={64} value={label} onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. My Laptop"
              className="block w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:border-white focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Public Key</label>
            <textarea required rows={4} value={publicKey} onChange={(e) => setPublicKey(e.target.value)}
              placeholder="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA..."
              className="block w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:border-white focus:outline-none font-mono resize-y" />
          </div>
          <button type="submit" disabled={submitting}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200 disabled:opacity-50">
            {submitting ? "Adding..." : "Add SSH Key"}
          </button>
        </form>
      )}

      {keys.length === 0 ? (
        <div className="mt-8 text-center">
          <p className="text-gray-500">No SSH keys saved.</p>
          <p className="mt-1 text-xs text-gray-600">Add a public key to use passwordless authentication when creating servers.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-2">
          {keys.map((k) => (
            <div key={k.id} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3">
              <div>
                <span className="text-sm font-medium text-gray-200">{k.label}</span>
                <span className="ml-3 text-xs text-gray-500">{new Date(k.createdAt).toLocaleDateString()}</span>
              </div>
              <button onClick={() => handleDelete(k.id, k.label)}
                className="rounded border border-red-800 px-2 py-1 text-xs text-red-400 hover:bg-red-950/30">Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

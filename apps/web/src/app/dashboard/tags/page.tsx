"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";

interface Tag {
  id: string; name: string; color: string | null; serverCount: number; createdAt: string;
}

const PRESET_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#f97316"];

export default function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  const fetchTags = useCallback(async () => {
    try {
      const data = await api.get<Tag[]>("/tags");
      setTags(data);
    } catch { /* noop */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTags(); }, [fetchTags]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true); setError("");
    try {
      await api.post("/tags", { name: newName.trim(), color: newColor });
      setNewName("");
      await fetchTags();
    } catch (err: unknown) {
      setError((err as { message?: string }).message || "Failed to create tag");
    } finally { setCreating(false); }
  }

  function startEdit(tag: Tag) {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color || PRESET_COLORS[0]);
  }

  function cancelEdit() { setEditingId(null); }

  async function handleUpdate(tagId: string) {
    setError("");
    try {
      await api.put(`/tags/${tagId}`, { name: editName.trim(), color: editColor });
      setEditingId(null);
      await fetchTags();
    } catch (err: unknown) {
      setError((err as { message?: string }).message || "Failed to update tag");
    }
  }

  async function handleDelete(tagId: string, name: string) {
    if (!window.confirm(`Delete tag "${name}"? It will be removed from all servers.`)) return;
    setError("");
    try {
      await api.del(`/tags/${tagId}`);
      await fetchTags();
    } catch (err: unknown) {
      setError((err as { message?: string }).message || "Failed to delete tag");
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Tags</h1>
        <p className="mt-4 text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tags</h1>
          <p className="text-sm text-gray-400">Organize your servers with custom tags</p>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">
          {error}
          <button onClick={() => setError("")} className="ml-2 underline hover:text-red-300">Dismiss</button>
        </div>
      )}

      <form onSubmit={handleCreate} className="mt-6 flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs text-gray-400 mb-1">New Tag Name</label>
          <input type="text" required maxLength={32} value={newName} onChange={(e) => setNewName(e.target.value)}
            placeholder="e.g. production"
            className="block w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-white focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Color</label>
          <div className="flex gap-1.5">
            {PRESET_COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setNewColor(c)}
                className={`h-8 w-8 rounded-full border-2 transition-all ${newColor === c ? "border-white scale-110" : "border-transparent"}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>
        <button type="submit" disabled={creating || !newName.trim()}
          className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200 disabled:opacity-50">
          {creating ? "Creating..." : "Add Tag"}
        </button>
      </form>

      {tags.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-gray-500">No tags yet. Create your first tag above.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-2">
          {tags.map((tag) => (
            <div key={tag.id} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3">
              {editingId === tag.id ? (
                <div className="flex flex-1 items-center gap-3">
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={32}
                    className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-sm text-gray-100 focus:border-white focus:outline-none w-40" />
                  <div className="flex gap-1">
                    {PRESET_COLORS.map((c) => (
                      <button key={c} type="button" onClick={() => setEditColor(c)}
                        className={`h-6 w-6 rounded-full border-2 transition-all ${editColor === c ? "border-white scale-110" : "border-transparent"}`}
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                  <div className="flex gap-2 ml-auto">
                    <button onClick={() => handleUpdate(tag.id)}
                      className="rounded bg-white px-3 py-1 text-xs font-semibold text-gray-900 hover:bg-gray-200">Save</button>
                    <button onClick={cancelEdit}
                      className="rounded border border-gray-600 px-3 py-1 text-xs text-gray-400 hover:bg-gray-800">Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <div className="h-4 w-4 rounded-full" style={{ backgroundColor: tag.color || "#6b7280" }} />
                    <span className="text-sm font-medium text-gray-200">{tag.name}</span>
                    <span className="text-xs text-gray-500">{tag.serverCount} server{tag.serverCount !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => startEdit(tag)}
                      className="rounded border border-gray-700 px-2 py-1 text-xs text-gray-400 hover:bg-gray-800">Edit</button>
                    <button onClick={() => handleDelete(tag.id, tag.name)}
                      className="rounded border border-red-800 px-2 py-1 text-xs text-red-400 hover:bg-red-950/30">Delete</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

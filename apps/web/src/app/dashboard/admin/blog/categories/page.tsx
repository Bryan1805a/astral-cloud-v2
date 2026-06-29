"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

interface Category {
  id: string; name: string; slug: string; description: string | null; postCount: number; createdAt: string;
}

export default function AdminBlogCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      const data = await api.get<Category[]>("/admin/blog/categories");
      setCategories(data);
    } catch { /* noop */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  function generateSlug(text: string) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true); setError("");
    try {
      await api.post("/admin/blog/categories", {
        name: name.trim(), slug: slug || generateSlug(name), description: description || undefined,
      });
      setName(""); setSlug(""); setDescription("");
      await fetchCategories();
    } catch (err: unknown) {
      setError((err as { message?: string }).message || "Failed to create category");
    } finally { setCreating(false); }
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete category "${name}"?`)) return;
    setError("");
    try {
      await api.del(`/admin/blog/categories/${id}`);
      await fetchCategories();
    } catch (err: unknown) {
      setError((err as { message?: string }).message || "Failed to delete");
    }
  }

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold">Blog Categories</h1>
        <p className="mt-4 text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold">Blog Categories</h1>
        <Link href="/dashboard/admin/blog/posts" className="text-sm text-gray-400 hover:text-gray-300">Posts</Link>
      </div>
      <p className="text-sm text-gray-400">Organize posts by category</p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">
          {error}
          <button onClick={() => setError("")} className="ml-2 underline hover:text-red-300">Dismiss</button>
        </div>
      )}

      <form onSubmit={handleCreate} className="mt-6 flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs text-gray-400 mb-1">Name</label>
          <input type="text" required maxLength={64} value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Tutorials"
            className="block w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-white focus:outline-none" />
        </div>
        <div className="w-40">
          <label className="block text-xs text-gray-400 mb-1">Slug</label>
          <input type="text" maxLength={64} value={slug} onChange={(e) => setSlug(e.target.value)}
            placeholder={generateSlug(name) || "auto"}
            className="block w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-white focus:outline-none" />
        </div>
        <button type="submit" disabled={creating || !name.trim()}
          className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200 disabled:opacity-50">
          {creating ? "..." : "Add"}
        </button>
      </form>

      {categories.length === 0 ? (
        <p className="mt-8 text-center text-gray-500">No categories yet.</p>
      ) : (
        <div className="mt-6 space-y-2">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3">
              <div>
                <span className="text-sm font-medium text-gray-200">{c.name}</span>
                <span className="ml-2 text-xs text-gray-500">/{c.slug}</span>
                <span className="ml-2 text-xs text-gray-600">{c.postCount} post{c.postCount !== 1 ? "s" : ""}</span>
                {c.description && <p className="mt-0.5 text-xs text-gray-500">{c.description}</p>}
              </div>
              <button onClick={() => handleDelete(c.id, c.name)}
                className="rounded border border-red-800 px-2 py-1 text-xs text-red-400 hover:bg-red-950/30">Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

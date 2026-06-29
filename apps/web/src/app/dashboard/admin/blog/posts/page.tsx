"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

interface Post {
  id: string; title: string; slug: string; status: string;
  excerpt: string | null; coverImageUrl: string | null; tags: string[] | null;
  category: { id: string; name: string; slug: string };
  author: { id: string; username: string };
  publishedAt: string | null; createdAt: string; updatedAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "border-gray-600 text-gray-400 bg-gray-950/30",
  PUBLISHED: "border-emerald-700 text-emerald-400 bg-emerald-950/30",
  ARCHIVED: "border-amber-700 text-amber-400 bg-amber-950/30",
};

export default function AdminBlogPostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  const fetchPosts = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: "20" });
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/admin/blog/posts?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
      });
      const json = await res.json();
      setPosts(json.data || []);
      setTotal(json.meta?.total || 0);
    } catch { /* noop */ }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchPosts(page); }, [page, fetchPosts]);

  async function handleDelete(id: string, title: string) {
    if (!window.confirm(`Delete "${title}"?`)) return;
    try { await api.del(`/admin/blog/posts/${id}`); fetchPosts(page); }
    catch { /* noop */ }
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">Blog Posts</h1>
            <Link href="/dashboard/admin/blog/categories" className="text-sm text-gray-400 hover:text-gray-300">Categories</Link>
          </div>
          <p className="text-sm text-gray-400">{total} posts</p>
        </div>
        <Link href="/dashboard/admin/blog/posts/create"
          className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200">New Post</Link>
      </div>

      <div className="mt-4 flex gap-2">
        {["", "DRAFT", "PUBLISHED", "ARCHIVED"].map((s) => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${statusFilter === s ? "border-white bg-white text-gray-900" : "border-gray-700 text-gray-400 hover:border-gray-600"}`}>
            {s || "All"}
          </button>
        ))}
      </div>

      {loading ? <p className="mt-6 text-gray-400">Loading...</p> : posts.length === 0 ? <p className="mt-6 text-gray-500">No posts.</p> : (
        <div className="mt-4 space-y-2">
          {posts.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <Link href={`/dashboard/admin/blog/posts/${p.id}`}
                    className="font-medium text-gray-200 hover:text-white truncate">{p.title}</Link>
                  <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[p.status] || ""}`}>{p.status}</span>
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  {p.category.name} · {p.slug} · {p.author.username} · {new Date(p.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <Link href={`/dashboard/admin/blog/posts/${p.id}`}
                  className="rounded border border-gray-700 px-2 py-1 text-xs text-gray-400 hover:bg-gray-800">Edit</Link>
                <button onClick={() => handleDelete(p.id, p.title)}
                  className="rounded border border-red-800 px-2 py-1 text-xs text-red-400 hover:bg-red-950/30">Delete</button>
              </div>
            </div>
          ))}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-gray-400 pt-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded border border-gray-700 px-3 py-1 disabled:opacity-30">Prev</button>
              <span>Page {page} of {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="rounded border border-gray-700 px-3 py-1 disabled:opacity-30">Next</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

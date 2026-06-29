"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

interface Post {
  id: string; title: string; slug: string; excerpt: string | null;
  coverImageUrl: string | null; tags: string[] | null;
  category: { id: string; name: string; slug: string };
  author: string; publishedAt: string | null; createdAt: string;
}

interface Category { id: string; name: string; slug: string; }

export default function BlogPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [search, setSearch] = useState("");

  const fetchPosts = useCallback(async (p: number) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: "10" });
    if (categoryFilter) params.set("category", categoryFilter);
    if (search) params.set("search", search);
    const res = await fetch(`/api/blog/posts?${params}`);
    const json = await res.json();
    setPosts(json.data || []);
    setTotal(json.meta?.total || 0);
    setLoading(false);
  }, [categoryFilter, search]);

  useEffect(() => {
    fetchPosts(page);
  }, [page, fetchPosts]);

  useEffect(() => {
    api.get<Category[]>("/admin/blog/categories").then(setCategories).catch(() => {});
  }, []);

  const totalPages = Math.ceil(total / 10);

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800">
        <div className="mx-auto max-w-4xl px-6 py-6 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold tracking-tight">Astral Cloud</Link>
          <Link href="/blog" className="text-sm text-gray-400 hover:text-gray-300">Blog</Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-12">
        <h1 className="text-3xl font-bold">Blog</h1>
        <p className="mt-2 text-gray-400">Updates, tutorials, and announcements from the Astral Cloud team.</p>

        <div className="mt-8 flex items-center gap-3">
          <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search posts..." className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-white focus:outline-none w-64" />
          <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100">
            <option value="">All Categories</option>
            {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
          </select>
        </div>

        {loading ? (
          <p className="mt-12 text-gray-400">Loading...</p>
        ) : posts.length === 0 ? (
          <p className="mt-12 text-gray-500">No posts found.</p>
        ) : (
          <div className="mt-8 space-y-8">
            {posts.map((p) => (
              <article key={p.id} className="border-b border-gray-800 pb-8">
                <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                  <Link href={`/blog?category=${p.category.slug}`} className="hover:text-gray-300">{p.category.name}</Link>
                  <span>·</span>
                  <span>{p.publishedAt ? new Date(p.publishedAt).toLocaleDateString() : new Date(p.createdAt).toLocaleDateString()}</span>
                  <span>·</span>
                  <span>{p.author}</span>
                </div>
                <Link href={`/blog/${p.slug}`} className="group">
                  <h2 className="text-xl font-semibold group-hover:text-white transition-colors">{p.title}</h2>
                </Link>
                {p.excerpt && <p className="mt-2 text-sm text-gray-400 leading-relaxed">{p.excerpt}</p>}
                {p.tags && p.tags.length > 0 && (
                  <div className="mt-3 flex gap-2">
                    {(p.tags as string[]).map((tag) => (
                      <span key={tag} className="rounded-full border border-gray-700 px-2 py-0.5 text-[11px] text-gray-500">{tag}</span>
                    ))}
                  </div>
                )}
              </article>
            ))}
            {totalPages > 1 && (
              <div className="flex items-center justify-between text-sm text-gray-400">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded border border-gray-700 px-3 py-1 disabled:opacity-30">Prev</button>
                <span>Page {page} of {totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                  className="rounded border border-gray-700 px-3 py-1 disabled:opacity-30">Next</button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

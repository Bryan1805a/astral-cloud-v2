"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/lib/api";

interface Post {
  id: string; title: string; slug: string; status: string;
  excerpt: string | null; body: string; coverImageUrl: string | null;
  tags: string[] | null; categoryId: string;
  category: { id: string; name: string; slug: string };
  publishedAt: string | null;
}

interface Category { id: string; name: string; slug: string; }

export default function EditBlogPostPage() {
  const router = useRouter();
  const params = useParams();
  const postId = params.postId as string;

  const [post, setPost] = useState<Post | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api.get<Post>(`/admin/blog/posts/${postId}`),
      fetch("/api/admin/blog/categories", {
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
      }).then(r => r.json()).then(j => setCategories(j.data || [])),
    ]).then(([p]) => {
      setPost(p);
      setTitle(p.title); setSlug(p.slug); setCategoryId(p.categoryId);
      setExcerpt(p.excerpt || ""); setBody(p.body);
      setTags(p.tags ? (p.tags as string[]).join(", ") : "");
      setStatus(p.status);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [postId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setError("");
    try {
      const tagArray = tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
      await api.put(`/admin/blog/posts/${postId}`, {
        title, slug, categoryId,
        excerpt: excerpt || undefined, body,
        tags: tagArray.length > 0 ? tagArray : undefined, status,
      });
      router.push("/dashboard/admin/blog/posts");
    } catch (err: unknown) {
      setError((err as { message?: string }).message || "Failed to update post");
    } finally { setSubmitting(false); }
  }

  const inputClass = "block w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:border-white focus:outline-none";
  const labelClass = "block text-sm font-medium text-gray-300 mb-1";

  if (loading) return <p className="text-gray-400">Loading...</p>;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">Edit Post</h1>
      {post && <p className="mt-1 text-sm text-gray-500">Status: {post.status} · Published: {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : "—"}</p>}
      {error && <div className="mt-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">{error}</div>}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className={labelClass}>Title</label>
          <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Slug</label>
            <input type="text" required value={slug} onChange={(e) => setSlug(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Category</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputClass}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={labelClass}>Excerpt</label>
          <input type="text" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Body (Markdown)</label>
          <textarea required rows={16} value={body} onChange={(e) => setBody(e.target.value)}
            className={`${inputClass} font-mono resize-y`} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Tags <span className="text-gray-500">(comma-separated)</span></label>
            <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputClass}>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
        </div>
        <div className="flex gap-4 pt-2">
          <button type="button" onClick={() => router.back()} className="rounded-lg border border-gray-700 px-5 py-2.5 text-sm text-gray-300 hover:bg-gray-800">Cancel</button>
          <button type="submit" disabled={submitting} className="flex-1 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-200 disabled:opacity-50">
            {submitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

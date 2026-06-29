"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

interface Category { id: string; name: string; slug: string; }

export default function CreateBlogPostPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [categories, setCategories] = useState<Category[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/blog/categories", {
      headers: { Authorization: `Bearer ${localStorage.getItem("access_token")}` },
    }).then(r => r.json()).then(j => { setCategories(j.data || []); if (j.data?.length) setCategoryId(j.data[0].id); }).catch(() => {});
  }, []);

  function generateSlug(text: string) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true); setError("");
    try {
      const tagArray = tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : [];
      await api.post("/admin/blog/posts", {
        title, slug: slug || generateSlug(title), categoryId,
        excerpt: excerpt || undefined, body,
        tags: tagArray.length > 0 ? tagArray : undefined, status,
      });
      router.push("/dashboard/admin/blog/posts");
    } catch (err: unknown) {
      setError((err as { message?: string }).message || "Failed to create post");
    } finally { setSubmitting(false); }
  }

  const inputClass = "block w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-gray-100 placeholder-gray-500 focus:border-white focus:outline-none";
  const labelClass = "block text-sm font-medium text-gray-300 mb-1";

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">New Blog Post</h1>
      {error && <div className="mt-4 rounded-lg border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-400">{error}</div>}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className={labelClass}>Title</label>
          <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder="Post title" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Slug</label>
            <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)}
              className={inputClass} placeholder={generateSlug(title) || "auto-generated"} />
          </div>
          <div>
            <label className={labelClass}>Category</label>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
              className={inputClass}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={labelClass}>Excerpt <span className="text-gray-500">(optional)</span></label>
          <input type="text" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} className={inputClass} placeholder="Brief summary" />
        </div>
        <div>
          <label className={labelClass}>Body (Markdown)</label>
          <textarea required rows={16} value={body} onChange={(e) => setBody(e.target.value)}
            className={`${inputClass} font-mono resize-y`} placeholder="Write your post in Markdown..." />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Tags <span className="text-gray-500">(comma-separated)</span></label>
            <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} className={inputClass} placeholder="tutorial, guide, news" />
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
            {submitting ? "Creating..." : "Create Post"}
          </button>
        </div>
      </form>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface Post {
  id: string; title: string; slug: string; excerpt: string | null;
  body: string; coverImageUrl: string | null; tags: string[] | null;
  category: { id: string; name: string; slug: string };
  author: string; publishedAt: string | null; createdAt: string;
}

export default function BlogPostPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/blog/posts/${slug}`)
      .then((r) => r.json())
      .then((j) => setPost(j.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800">
        <div className="mx-auto max-w-4xl px-6 py-6 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold tracking-tight">Astral Cloud</Link>
          <Link href="/blog" className="text-sm text-gray-400 hover:text-gray-300">Blog</Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-12">
        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : !post ? (
          <div>
            <Link href="/blog" className="text-sm text-gray-400 hover:text-gray-300">&larr; Blog</Link>
            <p className="mt-4 text-gray-500">Post not found.</p>
          </div>
        ) : (
          <article>
            <Link href="/blog" className="text-sm text-gray-400 hover:text-gray-300">&larr; Blog</Link>

            <div className="mt-6 flex items-center gap-3 text-xs text-gray-500">
              <span>{post.category.name}</span>
              <span>·</span>
              <span>{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : new Date(post.createdAt).toLocaleDateString()}</span>
              <span>·</span>
              <span>{post.author}</span>
            </div>

            <h1 className="mt-4 text-3xl font-bold">{post.title}</h1>

            {post.excerpt && <p className="mt-4 text-lg text-gray-400 leading-relaxed">{post.excerpt}</p>}

            {post.tags && post.tags.length > 0 && (
              <div className="mt-4 flex gap-2">
                {(post.tags as string[]).map((tag) => (
                  <span key={tag} className="rounded-full border border-gray-700 px-2 py-0.5 text-[11px] text-gray-500">{tag}</span>
                ))}
              </div>
            )}

            <div className="mt-8 prose prose-invert max-w-none text-gray-300 leading-relaxed whitespace-pre-wrap text-[15px]">
              {post.body}
            </div>
          </article>
        )}
      </div>
    </main>
  );
}

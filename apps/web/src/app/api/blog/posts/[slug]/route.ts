import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, apiSuccess } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: { slug: string } }) {
  const post = await db.blogPost.findFirst({
    where: { slug: params.slug, status: "PUBLISHED" },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      author: { select: { username: true } },
    },
  });

  if (!post) return apiError("NOT_FOUND", "Post not found.");

  return apiSuccess({
    id: post.id, title: post.title, slug: post.slug, excerpt: post.excerpt,
    body: post.body, coverImageUrl: post.coverImageUrl, tags: post.tags,
    category: post.category, author: post.author.username,
    publishedAt: post.publishedAt?.toISOString() || null,
    createdAt: post.createdAt.toISOString(),
  });
}

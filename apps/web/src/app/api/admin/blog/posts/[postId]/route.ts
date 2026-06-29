import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";
import { updateBlogPostSchema } from "@astral/shared";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { postId: string } }) {
  const auth = await authenticateRequest(request);
  if (!auth || (auth.role !== "ADMIN" && auth.role !== "STAFF")) return apiError("FORBIDDEN", "Staff access required.");

  const post = await db.blogPost.findUnique({
    where: { id: params.postId },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      author: { select: { id: true, username: true } },
    },
  });
  if (!post) return apiError("NOT_FOUND", "Post not found.");

  return apiSuccess({
    id: post.id, title: post.title, slug: post.slug, status: post.status,
    excerpt: post.excerpt, body: post.body, coverImageUrl: post.coverImageUrl,
    tags: post.tags, category: post.category, author: post.author,
    categoryId: post.categoryId,
    publishedAt: post.publishedAt?.toISOString() || null,
    createdAt: post.createdAt.toISOString(), updatedAt: post.updatedAt.toISOString(),
  });
}

export async function PUT(request: NextRequest, { params }: { params: { postId: string } }) {
  const auth = await authenticateRequest(request);
  if (!auth || (auth.role !== "ADMIN" && auth.role !== "STAFF")) return apiError("FORBIDDEN", "Staff access required.");

  const post = await db.blogPost.findUnique({ where: { id: params.postId } });
  if (!post) return apiError("NOT_FOUND", "Post not found.");

  const body = await request.json();
  const parsed = updateBlogPostSchema.safeParse(body);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Invalid post data.");

  if (parsed.data.slug && parsed.data.slug !== post.slug) {
    const existing = await db.blogPost.findUnique({ where: { slug: parsed.data.slug } });
    if (existing) return apiError("EMAIL_TAKEN", "A post with this slug already exists.", 409);
  }

  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status === "PUBLISHED" && post.status !== "PUBLISHED") {
    data.publishedAt = new Date();
  }

  const updated = await db.blogPost.update({ where: { id: post.id }, data });

  return apiSuccess({
    id: updated.id, title: updated.title, slug: updated.slug, status: updated.status,
  });
}

export async function DELETE(request: NextRequest, { params }: { params: { postId: string } }) {
  const auth = await authenticateRequest(request);
  if (!auth || (auth.role !== "ADMIN" && auth.role !== "STAFF")) return apiError("FORBIDDEN", "Staff access required.");

  await db.blogPost.delete({ where: { id: params.postId } });
  return apiSuccess({ deleted: true });
}

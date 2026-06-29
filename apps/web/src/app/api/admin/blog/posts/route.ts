import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess, apiPaginated } from "@/lib/errors";
import { createBlogPostSchema } from "@astral/shared";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth || (auth.role !== "ADMIN" && auth.role !== "STAFF")) return apiError("FORBIDDEN", "Staff access required.");

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
  const skip = (page - 1) * limit;
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;

  const [posts, total] = await Promise.all([
    db.blogPost.findMany({
      where, skip, take: limit, orderBy: { createdAt: "desc" },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        author: { select: { id: true, username: true } },
      },
    }),
    db.blogPost.count({ where }),
  ]);

  return apiPaginated(posts.map((p) => ({
    id: p.id, title: p.title, slug: p.slug, status: p.status,
    excerpt: p.excerpt, coverImageUrl: p.coverImageUrl,
    tags: p.tags,
    category: p.category,
    author: p.author,
    publishedAt: p.publishedAt?.toISOString() || null,
    createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(),
  })), { page, limit, total, totalPages: Math.ceil(total / limit) });
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth || (auth.role !== "ADMIN" && auth.role !== "STAFF")) return apiError("FORBIDDEN", "Staff access required.");

  const body = await request.json();
  const parsed = createBlogPostSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid post data.", 400,
      parsed.error.errors.map((e) => ({ field: e.path.join("."), message: e.message })));
  }

  const existingSlug = await db.blogPost.findUnique({ where: { slug: parsed.data.slug } });
  if (existingSlug) return apiError("EMAIL_TAKEN", "A post with this slug already exists.", 409);

  const post = await db.blogPost.create({
    data: {
      ...parsed.data,
      authorId: auth.userId,
      publishedAt: parsed.data.status === "PUBLISHED" ? new Date() : null,
    },
  });

  return apiSuccess({ id: post.id, title: post.title, slug: post.slug, status: post.status }, 201);
}

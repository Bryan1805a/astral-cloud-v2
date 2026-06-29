import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiPaginated } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);
  const skip = (page - 1) * limit;
  const category = searchParams.get("category");
  const search = searchParams.get("search");

  const where: Record<string, unknown> = { status: "PUBLISHED" };
  if (category) where.category = { slug: category };
  if (search) where.OR = [
    { title: { contains: search, mode: "insensitive" } },
    { excerpt: { contains: search, mode: "insensitive" } },
  ];

  const [posts, total] = await Promise.all([
    db.blogPost.findMany({
      where, skip, take: limit, orderBy: { publishedAt: "desc" },
      select: {
        id: true, title: true, slug: true, excerpt: true,
        coverImageUrl: true, tags: true, publishedAt: true, createdAt: true,
        category: { select: { id: true, name: true, slug: true } },
        author: { select: { username: true } },
      },
    }),
    db.blogPost.count({ where }),
  ]);

  return apiPaginated(posts.map((p) => ({
    id: p.id, title: p.title, slug: p.slug, excerpt: p.excerpt,
    coverImageUrl: p.coverImageUrl, tags: p.tags,
    category: p.category, author: p.author.username,
    publishedAt: p.publishedAt?.toISOString() || null,
    createdAt: p.createdAt.toISOString(),
  })), { page, limit, total, totalPages: Math.ceil(total / limit) });
}

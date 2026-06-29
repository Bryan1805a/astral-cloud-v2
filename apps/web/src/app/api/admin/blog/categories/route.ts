import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";
import { createBlogCategorySchema } from "@astral/shared";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth || (auth.role !== "ADMIN" && auth.role !== "STAFF")) return apiError("FORBIDDEN", "Staff access required.");

  const categories = await db.blogCategory.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { posts: true } } },
  });

  return apiSuccess(categories.map((c) => ({
    id: c.id, name: c.name, slug: c.slug, description: c.description,
    postCount: c._count.posts, createdAt: c.createdAt.toISOString(),
  })));
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth || (auth.role !== "ADMIN" && auth.role !== "STAFF")) return apiError("FORBIDDEN", "Staff access required.");

  const body = await request.json();
  const parsed = createBlogCategorySchema.safeParse(body);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Invalid category data.");

  const existing = await db.blogCategory.findUnique({ where: { slug: parsed.data.slug } });
  if (existing) return apiError("EMAIL_TAKEN", "Category slug already exists.", 409);

  const category = await db.blogCategory.create({ data: parsed.data });

  return apiSuccess({
    id: category.id, name: category.name, slug: category.slug,
    description: category.description, postCount: 0,
    createdAt: category.createdAt.toISOString(),
  }, 201);
}

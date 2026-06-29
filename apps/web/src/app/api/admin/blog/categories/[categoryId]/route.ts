import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest, { params }: { params: { categoryId: string } }) {
  const auth = await authenticateRequest(request);
  if (!auth || (auth.role !== "ADMIN" && auth.role !== "STAFF")) return apiError("FORBIDDEN", "Staff access required.");

  const postsWithCategory = await db.blogPost.count({ where: { categoryId: params.categoryId } });
  if (postsWithCategory > 0) return apiError("INVALID_STATE", "Cannot delete a category that has posts. Move or delete them first.");

  await db.blogCategory.delete({ where: { id: params.categoryId } });
  return apiSuccess({ deleted: true });
}

import { db } from "@/lib/db";
import { apiSuccess, apiError } from "@/lib/errors";

export async function GET() {
  try {
    const images = await db.imageTemplate.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
    return apiSuccess(images);
  } catch (error) {
    console.error("Failed to fetch images:", error);
    return apiError("INTERNAL_ERROR", "Failed to fetch image templates.");
  }
}

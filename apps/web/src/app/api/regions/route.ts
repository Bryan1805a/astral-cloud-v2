import { db } from "@/lib/db";
import { apiSuccess, apiError } from "@/lib/errors";

export async function GET() {
  try {
    const regions = await db.region.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
    return apiSuccess(regions);
  } catch (error) {
    console.error("Failed to fetch regions:", error);
    return apiError("INTERNAL_ERROR", "Failed to fetch regions.");
  }
}

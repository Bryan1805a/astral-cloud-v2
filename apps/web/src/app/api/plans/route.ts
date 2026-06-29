import { db } from "@/lib/db";
import { apiSuccess, apiError } from "@/lib/errors";

export async function GET() {
  try {
    const plans = await db.serverPlan.findMany({
      where: { isActive: true },
      orderBy: { priceMonthly: "asc" },
    });
    return apiSuccess(plans);
  } catch (error) {
    console.error("Failed to fetch plans:", error);
    return apiError("INTERNAL_ERROR", "Failed to fetch server plans.");
  }
}

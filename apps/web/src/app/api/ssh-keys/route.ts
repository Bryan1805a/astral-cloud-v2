import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiSuccess, apiError } from "@/lib/errors";

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Authentication required.");

  try {
    const keys = await db.sSHKey.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        label: true,
        createdAt: true,
      },
    });
    return apiSuccess(keys);
  } catch (error) {
    console.error("Failed to fetch SSH keys:", error);
    return apiError("INTERNAL_ERROR", "Failed to fetch SSH keys.");
  }
}

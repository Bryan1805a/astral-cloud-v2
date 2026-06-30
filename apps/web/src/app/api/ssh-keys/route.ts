import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiSuccess, apiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Authentication required.");

  try {
    const keys = await db.sSHKey.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, label: true, createdAt: true },
    });
    return apiSuccess(keys);
  } catch (error) {
    console.error("Failed to fetch SSH keys:", error);
    return apiError("INTERNAL_ERROR", "Failed to fetch SSH keys.");
  }
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Authentication required.");

  const body = await request.json();
  const { label, publicKey } = body;

  if (!label || typeof label !== "string" || label.length > 64) {
    return apiError("VALIDATION_ERROR", "Label is required (max 64 characters).");
  }
  if (!publicKey || typeof publicKey !== "string") {
    return apiError("VALIDATION_ERROR", "Public key is required.");
  }

  const key = await db.sSHKey.create({
    data: { userId: auth.userId, label: label.trim(), publicKey: publicKey.trim() },
  });

  return apiSuccess({ id: key.id, label: key.label, createdAt: key.createdAt.toISOString() }, 201);
}


import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { generateApiKey } from "@/lib/auth";
import { apiError, apiSuccess, authenticateRequest } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const keys = await db.apiKey.findMany({
    where: { userId: auth.userId },
    orderBy: { createdAt: "desc" },
  });

  return apiSuccess(
    keys.map((k) => ({
      id: k.id,
      label: k.label,
      keyPrefix: k.keyPrefix,
      lastUsedAt: k.lastUsedAt?.toISOString() || null,
      expiresAt: k.expiresAt?.toISOString() || null,
      createdAt: k.createdAt.toISOString(),
    }))
  );
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const body = await request.json();
  const { label, expiresAt } = body;

  if (!label || typeof label !== "string" || label.length > 64) {
    return apiError("VALIDATION_ERROR", "Label is required (max 64 characters).");
  }

  const { fullKey, prefix, hash } = generateApiKey();

  const key = await db.apiKey.create({
    data: {
      userId: auth.userId,
      label,
      keyPrefix: prefix,
      keyHash: hash,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    },
  });

  await db.auditLog.create({
    data: {
      userId: auth.userId,
      action: "API_KEY_CREATED",
      targetType: "ApiKey",
      targetId: key.id,
      result: "SUCCESS",
      ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
    },
  });

  return apiSuccess(
    {
      id: key.id,
      label: key.label,
      key: fullKey,
      keyPrefix: key.keyPrefix,
      expiresAt: key.expiresAt?.toISOString() || null,
      createdAt: key.createdAt.toISOString(),
    },
    201
  );
}

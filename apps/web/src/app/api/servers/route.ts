import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getAuthToken, apiError, apiSuccess, apiPaginated } from "@/lib/errors";
import { verifyAccessToken } from "@/lib/auth";
import {
  createServer,
  ServerLimitError,
  InsufficientBalanceError,
  NoNodeAvailableError,
} from "@/lib/services/server.service";
import { ServerStatus } from "@astral/shared";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = getAuthToken(request);
  if (!token) return apiError("UNAUTHORIZED", "Missing authorization token.");

  let payload;
  try {
    payload = await verifyAccessToken(token);
  } catch {
    return apiError("TOKEN_EXPIRED", "Access token has expired.");
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
  const status = searchParams.get("status") as ServerStatus | null;
  const tag = searchParams.get("tag");
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { userId: payload.sub, deletedAt: null };
  if (status) where.status = status;
  if (tag) {
    where.serverTags = { some: { tagId: tag } };
  }

  const [servers, total] = await Promise.all([
    db.serverInstance.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        serverPlan: { select: { id: true, name: true, slug: true } },
        imageTemplate: { select: { id: true, name: true, slug: true } },
        region: { select: { id: true, name: true, slug: true } },
        serverTags: { include: { tag: true } },
      },
    }),
    db.serverInstance.count({ where }),
  ]);

  const data = servers.map((s) => ({
    id: s.id,
    hostname: s.hostname,
    status: s.status,
    ipAddress: s.ipAddress,
    plan: s.serverPlan,
    image: s.imageTemplate,
    region: s.region,
    billingModel: s.billingModel,
    vcpu: s.vcpu,
    ramMB: s.ramMB,
    diskGB: s.diskGB,
    nextBillingAt: s.nextBillingAt?.toISOString() || null,
    tags: s.serverTags.map((st) => ({ id: st.tag.id, name: st.tag.name, color: st.tag.color })),
    createdAt: s.createdAt.toISOString(),
  }));

  return apiPaginated(data, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
}

export async function POST(request: NextRequest) {
  const token = getAuthToken(request);
  if (!token) return apiError("UNAUTHORIZED", "Missing authorization token.");

  let payload;
  try {
    payload = await verifyAccessToken(token);
  } catch {
    return apiError("TOKEN_EXPIRED", "Access token has expired.");
  }

  const body = await request.json();
  const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";

  try {
    const server = await createServer(payload.sub, body, ip);

    return apiSuccess(
      {
        id: server.id,
        hostname: server.hostname,
        status: server.status,
        billingModel: server.billingModel,
        rootPassword: server.rootPassword || undefined,
        createdAt: server.createdAt.toISOString(),
      },
      202
    );
  } catch (error) {
    if (error instanceof ServerLimitError) {
      return apiError("SERVER_LIMIT_REACHED", "Server limit reached. Upgrade your plan or delete an existing server.");
    }
    if (error instanceof InsufficientBalanceError) {
      return apiError("INSUFFICIENT_BALANCE", "Insufficient balance. Please add funds and try again.");
    }
    if (error instanceof NoNodeAvailableError) {
      return apiError("NODE_CAPACITY", "All nodes are currently at capacity. Please try again in a few minutes.");
    }
    if (error instanceof Error) {
      return apiError("VALIDATION_ERROR", error.message);
    }
    console.error("Create server error:", error);
    return apiError("INTERNAL_ERROR", "An unexpected error occurred.");
  }
}

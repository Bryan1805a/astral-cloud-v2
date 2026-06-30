import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess, apiPaginated } from "@/lib/errors";
import { allocateFloatingIpSchema } from "@astral/shared";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
  const skip = (page - 1) * limit;

  const where = { userId: auth.userId };
  const [fips, total] = await Promise.all([
    db.floatingIp.findMany({
      where, skip, take: limit, orderBy: { createdAt: "desc" },
      include: {
        region: { select: { id: true, name: true, slug: true } },
        server: { select: { id: true, hostname: true } },
      },
    }),
    db.floatingIp.count({ where }),
  ]);

  return apiPaginated(fips.map((f) => ({
    id: f.id, ipAddress: f.ipAddress,
    region: f.region,
    serverId: f.serverId, serverHostname: f.server?.hostname || null,
    assignedAt: f.assignedAt?.toISOString() || null,
    createdAt: f.createdAt.toISOString(),
  })), { page, limit, total, totalPages: Math.ceil(total / limit) });
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const body = await request.json();
  const parsed = allocateFloatingIpSchema.safeParse(body);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Region ID required.");

  const region = await db.region.findUnique({ where: { id: parsed.data.regionId } });
  if (!region || !region.isActive) return apiError("NOT_FOUND", "Region not found.");

  const octet3 = Math.floor(Math.random() * 256);
  const octet4 = Math.floor(Math.random() * 254) + 2;
  const ipAddress = `198.51.${octet3}.${octet4}`;

  const fip = await db.floatingIp.create({
    data: { userId: auth.userId, regionId: parsed.data.regionId, ipAddress },
  });

  return apiSuccess({
    id: fip.id, ipAddress: fip.ipAddress, regionId: fip.regionId,
    serverId: null, createdAt: fip.createdAt.toISOString(),
  }, 201);
}

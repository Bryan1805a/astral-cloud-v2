import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";
import { createPrivateNetworkSchema } from "@astral/shared";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const networks = await db.privateNetwork.findMany({
    where: { userId: auth.userId },
    orderBy: { createdAt: "desc" },
    include: {
      region: { select: { id: true, name: true, slug: true } },
      _count: { select: { serverMembers: true } },
    },
  });

  return apiSuccess(networks.map((n) => ({
    id: n.id, name: n.name, cidr: n.cidr, isActive: n.isActive,
    region: n.region, serverCount: n._count.serverMembers,
    createdAt: n.createdAt.toISOString(),
  })));
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const body = await request.json();
  const parsed = createPrivateNetworkSchema.safeParse(body);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Invalid network data.");

  const region = await db.region.findUnique({ where: { id: parsed.data.regionId } });
  if (!region || !region.isActive) return apiError("NOT_FOUND", "Region not found.");

  const existingCidr = await db.privateNetwork.findFirst({
    where: { regionId: parsed.data.regionId, cidr: parsed.data.cidr },
  });
  if (existingCidr) return apiError("EMAIL_TAKEN", "A network with this CIDR already exists in this region.", 409);

  const network = await db.privateNetwork.create({
    data: { userId: auth.userId, regionId: parsed.data.regionId, name: parsed.data.name, cidr: parsed.data.cidr },
  });

  return apiSuccess({
    id: network.id, name: network.name, cidr: network.cidr, isActive: network.isActive,
    createdAt: network.createdAt.toISOString(),
  }, 201);
}

import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";
import { attachToPrivateNetworkSchema } from "@astral/shared";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { networkId: string } }) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const network = await db.privateNetwork.findFirst({
    where: { id: params.networkId, userId: auth.userId },
    include: {
      region: { select: { id: true, name: true, slug: true } },
      serverMembers: { include: { server: { select: { id: true, hostname: true, status: true } } } },
    },
  });
  if (!network) return apiError("NOT_FOUND", "Network not found.");

  return apiSuccess({
    id: network.id, name: network.name, cidr: network.cidr, isActive: network.isActive,
    region: network.region, serverCount: network.serverMembers.length,
    servers: network.serverMembers.map((m) => ({
      id: m.server.id, hostname: m.server.hostname, status: m.server.status,
      privateIp: m.privateIp, attachedAt: m.attachedAt.toISOString(),
    })),
    createdAt: network.createdAt.toISOString(),
  });
}

export async function DELETE(request: NextRequest, { params }: { params: { networkId: string } }) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const network = await db.privateNetwork.findFirst({
    where: { id: params.networkId, userId: auth.userId },
    include: { _count: { select: { serverMembers: true } } },
  });
  if (!network) return apiError("NOT_FOUND", "Network not found.");
  if (network._count.serverMembers > 0) return apiError("INVALID_STATE", "Detach all servers before deleting the network.");

  await db.privateNetwork.delete({ where: { id: network.id } });
  return apiSuccess({ deleted: true });
}

export async function POST(request: NextRequest, { params }: { params: { networkId: string } }) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const network = await db.privateNetwork.findFirst({
    where: { id: params.networkId, userId: auth.userId },
    include: { serverMembers: true },
  });
  if (!network) return apiError("NOT_FOUND", "Network not found.");

  const body = await request.json();
  const parsed = attachToPrivateNetworkSchema.safeParse(body);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Server ID required.");

  const server = await db.serverInstance.findFirst({
    where: { id: parsed.data.serverId, userId: auth.userId, deletedAt: null },
  });
  if (!server) return apiError("NOT_FOUND", "Server not found.");
  if (server.regionId !== network.regionId) return apiError("VALIDATION_ERROR", "Server must be in the same region.");

  const existingMembership = await db.serverPrivateNetwork.findUnique({
    where: { serverId: parsed.data.serverId },
  });
  if (existingMembership) return apiError("INVALID_STATE", "Server is already in a private network.");

  const subnet = network.cidr.split("/")[0];
  const parts = subnet.split(".");
  const usedIps = network.serverMembers.map((m) => m.privateIp);
  let privateIp = "";
  for (let host = 2; host <= 254; host++) {
    const ip = `${parts[0]}.${parts[1]}.${parts[2]}.${host}`;
    if (!usedIps.includes(ip)) { privateIp = ip; break; }
  }
  if (!privateIp) return apiError("NODE_CAPACITY", "No available IPs in this network.");

  const member = await db.serverPrivateNetwork.create({
    data: { serverId: parsed.data.serverId, networkId: network.id, privateIp },
  });

  return apiSuccess({ id: member.id, serverId: member.serverId, privateIp: member.privateIp, attachedAt: member.attachedAt.toISOString() }, 201);
}

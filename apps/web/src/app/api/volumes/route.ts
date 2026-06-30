import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess, apiPaginated } from "@/lib/errors";
import { serverQueue, JobType } from "@/lib/queue";
import { createBlockVolumeSchema } from "@astral/shared";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
  const skip = (page - 1) * limit;

  const where = { userId: auth.userId, deletedAt: null };

  const [volumes, total] = await Promise.all([
    db.blockVolume.findMany({
      where, skip, take: limit, orderBy: { createdAt: "desc" },
      include: {
        region: { select: { id: true, name: true, slug: true } },
        server: { select: { id: true, hostname: true } },
      },
    }),
    db.blockVolume.count({ where }),
  ]);

  return apiPaginated(volumes.map((v) => ({
    id: v.id, name: v.name, sizeGB: v.sizeGB, status: v.status,
    region: v.region,
    serverId: v.serverId, serverHostname: v.server?.hostname || null,
    devicePath: v.devicePath, attachedAt: v.attachedAt?.toISOString() || null,
    createdAt: v.createdAt.toISOString(),
  })), { page, limit, total, totalPages: Math.ceil(total / limit) });
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const body = await request.json();
  const parsed = createBlockVolumeSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid volume data.", 400,
      parsed.error.errors.map((e) => ({ field: e.path.join("."), message: e.message })));
  }

  const region = await db.region.findUnique({ where: { id: parsed.data.regionId } });
  if (!region || !region.isActive) return apiError("NOT_FOUND", "Region not found.");

  const nodes = await db.node.findMany({
    where: { regionId: parsed.data.regionId, status: "ONLINE" },
    orderBy: { allocatedDiskGB: "asc" },
  });
  if (!nodes.length) return apiError("NODE_CAPACITY", "No nodes available in this region.");

  let selectedNode = null;
  for (const node of nodes) {
    if (node.allocatedDiskGB + parsed.data.sizeGB <= node.totalDiskGB) {
      selectedNode = node;
      break;
    }
  }
  if (!selectedNode) return apiError("NODE_CAPACITY", "No nodes with sufficient disk capacity.");

  const volume = await db.$transaction(async (tx) => {
    const v = await tx.blockVolume.create({
      data: {
        userId: auth.userId, regionId: parsed.data.regionId, nodeId: selectedNode!.id,
        name: parsed.data.name, sizeGB: parsed.data.sizeGB, status: "CREATING",
      },
    });
    await tx.node.update({
      where: { id: selectedNode!.id },
      data: { allocatedDiskGB: { increment: parsed.data.sizeGB } },
    });
    return v;
  });

  await serverQueue.add(JobType.VOLUME_CREATE, { type: JobType.VOLUME_CREATE, volumeId: volume.id });

  await db.auditLog.create({
    data: {
      userId: auth.userId, action: "SERVER_CREATED" as never, targetType: "BlockVolume", targetId: volume.id,
      result: "SUCCESS", ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
    },
  });

  return apiSuccess({
    id: volume.id, name: volume.name, sizeGB: volume.sizeGB, status: volume.status,
    createdAt: volume.createdAt.toISOString(),
  }, 201);
}

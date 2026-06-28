import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, apiSuccess, authenticateRequest } from "@/lib/errors";
import { createDnsRecordSchema } from "@astral/shared";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { serverId: string } }
) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const server = await db.serverInstance.findFirst({
    where: { id: params.serverId, userId: auth.userId, deletedAt: null },
  });
  if (!server) return apiError("NOT_FOUND", "Server not found.");

  const records = await db.dnsRecord.findMany({
    where: { serverId: server.id },
    orderBy: { createdAt: "asc" },
  });

  return apiSuccess(
    records.map((r) => ({
      id: r.id,
      type: r.type,
      name: r.name,
      value: r.value,
      ttl: r.ttl,
      priority: r.priority,
      createdAt: r.createdAt.toISOString(),
    }))
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: { serverId: string } }
) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const server = await db.serverInstance.findFirst({
    where: { id: params.serverId, userId: auth.userId, deletedAt: null },
  });
  if (!server) return apiError("NOT_FOUND", "Server not found.");

  const body = await request.json();
  const parsed = createDnsRecordSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid DNS record.", 400,
      parsed.error.errors.map((e) => ({ field: e.path.join("."), message: e.message }))
    );
  }

  const { type, name, value, ttl, priority } = parsed.data;

  const existing = await db.dnsRecord.findFirst({
    where: { serverId: server.id, type, name },
  });
  if (existing) {
    return apiError("INVALID_STATE", "A record with this name and type already exists for this server.");
  }

  if (type === "PTR") {
    const existingPtr = await db.dnsRecord.findFirst({
      where: { serverId: server.id, type: "PTR" },
    });
    if (existingPtr) {
      return apiError("INVALID_STATE", "Each server may have only one PTR (reverse DNS) record.");
    }
  }

  const record = await db.dnsRecord.create({
    data: {
      serverId: server.id,
      type,
      name,
      value,
      ttl: ttl || 3600,
      priority: priority || undefined,
    },
  });

  await db.auditLog.create({
    data: {
      userId: auth.userId,
      action: "DNS_RECORD_CREATED",
      targetType: "DnsRecord",
      targetId: record.id,
      result: "SUCCESS",
      ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
    },
  });

  return apiSuccess(
    {
      id: record.id,
      serverId: record.serverId,
      type: record.type,
      name: record.name,
      value: record.value,
      ttl: record.ttl,
      priority: record.priority,
      createdAt: record.createdAt.toISOString(),
    },
    201
  );
}

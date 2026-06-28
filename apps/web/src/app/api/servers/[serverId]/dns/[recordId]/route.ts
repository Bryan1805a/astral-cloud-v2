import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, apiSuccess, authenticateRequest } from "@/lib/errors";
import { updateDnsRecordSchema } from "@astral/shared";

export const dynamic = "force-dynamic";

export async function PUT(
  request: NextRequest,
  { params }: { params: { serverId: string; recordId: string } }
) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const server = await db.serverInstance.findFirst({
    where: { id: params.serverId, userId: auth.userId, deletedAt: null },
  });
  if (!server) return apiError("NOT_FOUND", "Server not found.");

  const record = await db.dnsRecord.findFirst({
    where: { id: params.recordId, serverId: server.id },
  });
  if (!record) return apiError("NOT_FOUND", "DNS record not found.");

  const body = await request.json();
  const parsed = updateDnsRecordSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid DNS record.", 400,
      parsed.error.errors.map((e) => ({ field: e.path.join("."), message: e.message }))
    );
  }

  const updated = await db.dnsRecord.update({
    where: { id: record.id },
    data: parsed.data,
  });

  await db.auditLog.create({
    data: {
      userId: auth.userId,
      action: "DNS_RECORD_UPDATED",
      targetType: "DnsRecord",
      targetId: record.id,
      result: "SUCCESS",
      ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
    },
  });

  return apiSuccess({
    id: updated.id,
    serverId: updated.serverId,
    type: updated.type,
    name: updated.name,
    value: updated.value,
    ttl: updated.ttl,
    priority: updated.priority,
    createdAt: updated.createdAt.toISOString(),
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { serverId: string; recordId: string } }
) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const server = await db.serverInstance.findFirst({
    where: { id: params.serverId, userId: auth.userId, deletedAt: null },
  });
  if (!server) return apiError("NOT_FOUND", "Server not found.");

  const record = await db.dnsRecord.findFirst({
    where: { id: params.recordId, serverId: server.id },
  });
  if (!record) return apiError("NOT_FOUND", "DNS record not found.");

  await db.dnsRecord.delete({ where: { id: record.id } });

  await db.auditLog.create({
    data: {
      userId: auth.userId,
      action: "DNS_RECORD_DELETED",
      targetType: "DnsRecord",
      targetId: record.id,
      result: "SUCCESS",
      ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
    },
  });

  return apiSuccess({ message: "DNS record deleted." });
}

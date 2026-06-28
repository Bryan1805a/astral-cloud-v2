import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, apiSuccess, authenticateRequest } from "@/lib/errors";
import { updateFirewallRuleSchema } from "@astral/shared";

export const dynamic = "force-dynamic";

export async function PUT(
  request: NextRequest,
  { params }: { params: { serverId: string; ruleId: string } }
) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const server = await db.serverInstance.findFirst({
    where: { id: params.serverId, userId: auth.userId, deletedAt: null },
  });
  if (!server) return apiError("NOT_FOUND", "Server not found.");

  const rule = await db.firewallRule.findFirst({
    where: { id: params.ruleId, serverId: server.id },
  });
  if (!rule) return apiError("NOT_FOUND", "Firewall rule not found.");

  const body = await request.json();
  const parsed = updateFirewallRuleSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid firewall rule.", 400,
      parsed.error.errors.map((e) => ({ field: e.path.join("."), message: e.message }))
    );
  }

  const updated = await db.firewallRule.update({
    where: { id: rule.id },
    data: parsed.data,
  });

  await db.auditLog.create({
    data: {
      userId: auth.userId,
      action: "FIREWALL_RULE_UPDATED",
      targetType: "FirewallRule",
      targetId: rule.id,
      result: "SUCCESS",
      ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
    },
  });

  return apiSuccess({
    id: updated.id,
    serverId: updated.serverId,
    protocol: updated.protocol,
    portRange: updated.portRange,
    sourceCidr: updated.sourceCidr,
    action: updated.action,
    priority: updated.priority,
    description: updated.description,
    createdAt: updated.createdAt.toISOString(),
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { serverId: string; ruleId: string } }
) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const server = await db.serverInstance.findFirst({
    where: { id: params.serverId, userId: auth.userId, deletedAt: null },
  });
  if (!server) return apiError("NOT_FOUND", "Server not found.");

  const rule = await db.firewallRule.findFirst({
    where: { id: params.ruleId, serverId: server.id },
  });
  if (!rule) return apiError("NOT_FOUND", "Firewall rule not found.");

  await db.firewallRule.delete({ where: { id: rule.id } });

  await db.auditLog.create({
    data: {
      userId: auth.userId,
      action: "FIREWALL_RULE_DELETED",
      targetType: "FirewallRule",
      targetId: rule.id,
      result: "SUCCESS",
      ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
    },
  });

  return apiSuccess({ message: "Firewall rule deleted." });
}

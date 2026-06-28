import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiError, apiSuccess, authenticateRequest } from "@/lib/errors";
import { createFirewallRuleSchema } from "@astral/shared";

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

  const rules = await db.firewallRule.findMany({
    where: { serverId: server.id },
    orderBy: { priority: "asc" },
  });

  return apiSuccess(
    rules.map((r) => ({
      id: r.id,
      protocol: r.protocol,
      portRange: r.portRange,
      sourceCidr: r.sourceCidr,
      action: r.action,
      priority: r.priority,
      description: r.description,
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
  const parsed = createFirewallRuleSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Invalid firewall rule.", 400,
      parsed.error.errors.map((e) => ({ field: e.path.join("."), message: e.message }))
    );
  }

  const rule = await db.firewallRule.create({
    data: {
      serverId: server.id,
      protocol: parsed.data.protocol,
      portRange: parsed.data.portRange,
      sourceCidr: parsed.data.sourceCidr,
      action: parsed.data.action,
      priority: parsed.data.priority,
      description: parsed.data.description || undefined,
    },
  });

  await db.auditLog.create({
    data: {
      userId: auth.userId,
      action: "FIREWALL_RULE_CREATED",
      targetType: "FirewallRule",
      targetId: rule.id,
      result: "SUCCESS",
      ipAddress: request.headers.get("x-forwarded-for") || "127.0.0.1",
    },
  });

  return apiSuccess(
    {
      id: rule.id,
      serverId: rule.serverId,
      protocol: rule.protocol,
      portRange: rule.portRange,
      sourceCidr: rule.sourceCidr,
      action: rule.action,
      priority: rule.priority,
      description: rule.description,
      createdAt: rule.createdAt.toISOString(),
    },
    201
  );
}

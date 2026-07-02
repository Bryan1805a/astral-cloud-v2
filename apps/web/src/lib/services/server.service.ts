import { createServerSchema, type CreateServerInput } from "@astral/shared";
import { ServerStatus, BillingModel } from "@astral/shared";
import { db } from "@/lib/db";
import { serverQueue, JobType } from "@/lib/queue";
import { Prisma } from "@prisma/client";
import { notifyServerEvent } from "@/lib/notifications";

export class ServerLimitError extends Error {
  constructor() {
    super("Server limit reached.");
    this.name = "ServerLimitError";
  }
}

export class InsufficientBalanceError extends Error {
  constructor() {
    super("Insufficient balance.");
    this.name = "InsufficientBalanceError";
  }
}

export class NoNodeAvailableError extends Error {
  constructor() {
    super("No capacity available.");
    this.name = "NoNodeAvailableError";
  }
}

export class ServerLockedError extends Error {
  constructor(public lockedBy: string) {
    super(`Server is currently ${lockedBy}`);
    this.name = "ServerLockedError";
  }
}

export class InvalidStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidStateError";
  }
}

function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export async function createServer(userId: string, input: CreateServerInput, ipAddress: string) {
  const parsed = createServerSchema.safeParse(input);
  if (!parsed.success) {
    const messages = parsed.error.errors.map((e) => e.message).join(", ");
    throw new Error(`Validation failed: ${messages}`);
  }
  const data = parsed.data;

  const activeServers = await db.serverInstance.count({
    where: { userId, deletedAt: null, status: { not: "DELETED" } },
  });
  if (activeServers >= 5) {
    throw new ServerLimitError();
  }

  let vcpu: number;
  let ramMB: number;
  let diskGB: number;
  let pricePerPeriod: Prisma.Decimal;

  if (data.planId) {
    const plan = await db.serverPlan.findUnique({ where: { id: data.planId } });
    if (!plan || !plan.isActive) throw new Error("Invalid server plan");
    if (plan.maxServers && activeServers >= plan.maxServers) {
      throw new ServerLimitError();
    }
    vcpu = plan.vcpu;
    ramMB = plan.ramMB;
    diskGB = plan.diskGB;
    pricePerPeriod = data.billingModel === BillingModel.HOURLY ? plan.priceHourly : plan.priceMonthly;
  } else if (data.customSpecs) {
    vcpu = data.customSpecs.vcpu;
    ramMB = data.customSpecs.ramMB;
    diskGB = data.customSpecs.diskGB;
    pricePerPeriod = new Prisma.Decimal(0);
  } else {
    throw new Error("Either planId or customSpecs required");
  }

  if (data.imageId) {
    const image = await db.imageTemplate.findUnique({ where: { id: data.imageId } });
    if (!image || !image.isActive) throw new Error("Invalid image template");
    if (image.diskSizeGB > diskGB) throw new Error("Image disk size exceeds plan disk");
  }

  const region = await db.region.findUnique({ where: { id: data.regionId } });
  if (!region || !region.isActive) throw new Error("Invalid region");

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  const balance = new Prisma.Decimal(user.balance);
  if (balance.lessThan(pricePerPeriod)) {
    throw new InsufficientBalanceError();
  }

  const hostnameExists = await db.serverInstance.findFirst({
    where: { userId, hostname: data.hostname, deletedAt: null },
  });
  if (hostnameExists) throw new Error("Hostname already in use");

  if (data.sshKeyId) {
    const sshKey = await db.sSHKey.findFirst({
      where: { id: data.sshKeyId, userId },
    });
    if (!sshKey) throw new Error("SSH key not found");
  }

  const server = await db.$transaction(async (tx) => {
    const nodes = await tx.node.findMany({
      where: {
        status: "ONLINE",
        regionId: data.regionId,
      },
      orderBy: [
        { allocatedVcpu: "asc" },
      ],
    });

    for (const node of nodes) {
      const freeVcpu = node.totalVcpu - node.allocatedVcpu;
      const freeRamMB = node.totalRamMB - node.allocatedRamMB;
      const freeDiskGB = node.totalDiskGB - node.allocatedDiskGB;

      if (freeVcpu < vcpu || freeRamMB < ramMB || freeDiskGB < diskGB) {
        continue;
      }

      const freeIp = await tx.ipAddress.findFirst({
        where: {
          nodeId: node.id,
          serverId: null,
          type: "IPv4",
        },
      });

      if (!freeIp) continue;

      const rootPassword = data.sshKeyId ? undefined : generatePassword();

      const serverRecord = await tx.serverInstance.create({
        data: {
          userId,
          serverPlanId: data.planId || undefined,
          imageTemplateId: data.imageId || undefined,
          regionId: data.regionId,
          nodeId: node.id,
          sshKeyId: data.sshKeyId || undefined,
          hostname: data.hostname,
          status: "CREATING",
          lockedBy: "CREATING",
          lockedAt: new Date(),
          vcpu,
          ramMB,
          diskGB,
          billingModel: data.billingModel,
          cloudInitScript: data.cloudInitScript || undefined,
          rootPassword,
        },
      });

      const ipUpdate = await tx.ipAddress.updateMany({
        where: {
          id: freeIp.id,
          serverId: null,
        },
        data: {
          serverId: serverRecord.id,
          allocatedAt: new Date(),
        },
      });

      if (ipUpdate.count === 0) continue;

      const nodeUpdate = await tx.node.updateMany({
        where: { id: node.id },
        data: {
          allocatedVcpu: { increment: vcpu },
          allocatedRamMB: { increment: ramMB },
          allocatedDiskGB: { increment: diskGB },
        },
      });

      if (nodeUpdate.count === 0) {
        await tx.ipAddress.updateMany({
          where: { id: freeIp.id, serverId: serverRecord.id },
          data: { serverId: null, allocatedAt: null },
        });
        continue;
      }

      return serverRecord;
    }

    return null;
  });

  if (!server) {
    throw new NoNodeAvailableError();
  }

  await db.auditLog.create({
    data: {
      userId,
      action: "SERVER_CREATED",
      targetType: "ServerInstance",
      targetId: server.id,
      result: "SUCCESS",
      ipAddress,
    },
  });

  await db.firewallRule.createMany({
    data: [
      {
        serverId: server.id,
        protocol: "TCP",
        portRange: "22",
        sourceCidr: "0.0.0.0/0",
        action: "ALLOW",
        priority: 1,
        description: "Default SSH rule",
      },
      {
        serverId: server.id,
        protocol: "TCP",
        portRange: "80",
        sourceCidr: "0.0.0.0/0",
        action: "ALLOW",
        priority: 2,
        description: "Default HTTP rule",
      },
      {
        serverId: server.id,
        protocol: "TCP",
        portRange: "443",
        sourceCidr: "0.0.0.0/0",
        action: "ALLOW",
        priority: 3,
        description: "Default HTTPS rule",
      },
    ],
  });

  await serverQueue.add(JobType.PROVISION, {
    type: JobType.PROVISION,
    serverId: server.id,
  } as const);

  return server;
}

export async function startServer(serverId: string, userId: string, ipAddress: string) {
  const server = await db.serverInstance.findFirst({
    where: { id: serverId, userId, deletedAt: null },
  });

  if (!server) throw new Error("Server not found");
  if (server.status !== ServerStatus.STOPPED) {
    throw new InvalidStateError("Server must be in STOPPED state to start");
  }
  if (server.lockedBy) {
    throw new ServerLockedError(server.lockedBy);
  }

  await db.$transaction(async (tx) => {
    const result = await tx.serverInstance.updateMany({
      where: { id: serverId, lockedBy: null },
      data: { lockedBy: "CREATING", lockedAt: new Date(), status: ServerStatus.CREATING },
    });
    if (result.count === 0) throw new ServerLockedError(server.lockedBy || "unknown");
  });

  await serverQueue.add(JobType.START, {
    type: JobType.START,
    serverId: server.id,
  } as const);

  await db.auditLog.create({
    data: {
      userId,
      action: "SERVER_STARTED",
      targetType: "ServerInstance",
      targetId: serverId,
      result: "SUCCESS",
      ipAddress,
    },
  });

  notifyServerEvent(userId, server.hostname, "started").catch(() => {});

  return server;
}

export async function stopServer(serverId: string, userId: string, force: boolean, ipAddress: string) {
  const server = await db.serverInstance.findFirst({
    where: { id: serverId, userId, deletedAt: null },
  });

  if (!server) throw new Error("Server not found");
  if (server.status !== ServerStatus.ACTIVE) {
    throw new InvalidStateError("Server must be in ACTIVE state to stop");
  }
  if (server.lockedBy) {
    throw new ServerLockedError(server.lockedBy);
  }

  await db.$transaction(async (tx) => {
    const result = await tx.serverInstance.updateMany({
      where: { id: serverId, lockedBy: null },
      data: { lockedBy: "STOPPING", lockedAt: new Date(), status: ServerStatus.STOPPING },
    });
    if (result.count === 0) throw new ServerLockedError(server.lockedBy || "unknown");
  });

  await serverQueue.add(JobType.STOP, {
    type: JobType.STOP,
    serverId: server.id,
  } as const);

  await db.auditLog.create({
    data: {
      userId,
      action: "SERVER_STOPPED",
      targetType: "ServerInstance",
      targetId: serverId,
      result: "SUCCESS",
      ipAddress,
    },
  });

  notifyServerEvent(userId, server.hostname, "stopped").catch(() => {});

  return server;
}

export async function restartServer(serverId: string, userId: string, ipAddress: string) {
  const server = await db.serverInstance.findFirst({
    where: { id: serverId, userId, deletedAt: null },
  });

  if (!server) throw new Error("Server not found");
  if (server.status !== ServerStatus.ACTIVE) {
    throw new InvalidStateError("Server must be in ACTIVE state to restart");
  }
  if (server.lockedBy) {
    throw new ServerLockedError(server.lockedBy);
  }

  await db.$transaction(async (tx) => {
    const result = await tx.serverInstance.updateMany({
      where: { id: serverId, lockedBy: null },
      data: { lockedBy: "RESTARTING", lockedAt: new Date(), status: ServerStatus.RESTARTING },
    });
    if (result.count === 0) throw new ServerLockedError(server.lockedBy || "unknown");
  });

  await serverQueue.add(JobType.RESTART, {
    type: JobType.RESTART,
    serverId: server.id,
  } as const);

  await db.auditLog.create({
    data: {
      userId,
      action: "SERVER_RESTARTED",
      targetType: "ServerInstance",
      targetId: serverId,
      result: "SUCCESS",
      ipAddress,
    },
  });

  notifyServerEvent(userId, server.hostname, "restarted").catch(() => {});

  return server;
}

export async function deleteServer(serverId: string, userId: string, ipAddress: string) {
  const server = await db.serverInstance.findFirst({
    where: { id: serverId, userId, deletedAt: null },
  });

  if (!server) throw new Error("Server not found");
  if (server.status !== ServerStatus.STOPPED) {
    throw new InvalidStateError("Server must be in STOPPED state to delete");
  }
  if (server.lockedBy) {
    throw new ServerLockedError(server.lockedBy);
  }

  await db.$transaction(async (tx) => {
    const result = await tx.serverInstance.updateMany({
      where: { id: serverId, lockedBy: null },
      data: { lockedBy: "DELETING", lockedAt: new Date(), status: ServerStatus.DELETING },
    });
    if (result.count === 0) throw new ServerLockedError(server.lockedBy || "unknown");
  });

  await serverQueue.add(JobType.DELETE, {
    type: JobType.DELETE,
    serverId: server.id,
  } as const);

  await db.auditLog.create({
    data: {
      userId,
      action: "SERVER_DELETED",
      targetType: "ServerInstance",
      targetId: serverId,
      result: "SUCCESS",
      ipAddress,
    },
  });

  notifyServerEvent(userId, server.hostname, "deleted").catch(() => {});

  return server;
}

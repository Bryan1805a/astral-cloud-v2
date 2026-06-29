import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";
import { createBackupScheduleSchema } from "@astral/shared";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: { serverId: string } }) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const server = await db.serverInstance.findFirst({
    where: { id: params.serverId, userId: auth.userId, deletedAt: null },
  });
  if (!server) return apiError("NOT_FOUND", "Server not found.");

  let schedule = await db.backupSchedule.findUnique({
    where: { serverId: params.serverId },
  });

  if (!schedule) {
    schedule = await db.backupSchedule.create({
      data: {
        serverId: params.serverId,
        enabled: false,
        intervalHours: 24,
        retainDaily: 7,
        retainWeekly: 4,
        retainMonthly: 3,
        nextRunAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
  }

  return apiSuccess({
    id: schedule.id,
    enabled: schedule.enabled,
    intervalHours: schedule.intervalHours,
    retainDaily: schedule.retainDaily,
    retainWeekly: schedule.retainWeekly,
    retainMonthly: schedule.retainMonthly,
    nextRunAt: schedule.nextRunAt.toISOString(),
  });
}

export async function PUT(request: NextRequest, { params }: { params: { serverId: string } }) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const server = await db.serverInstance.findFirst({
    where: { id: params.serverId, userId: auth.userId, deletedAt: null },
  });
  if (!server) return apiError("NOT_FOUND", "Server not found.");

  const body = await request.json();
  const parsed = createBackupScheduleSchema.safeParse(body);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Invalid schedule data.");

  const data: Record<string, unknown> = {};
  if (parsed.data.enabled !== undefined) data.enabled = parsed.data.enabled;
  if (parsed.data.intervalHours !== undefined) {
    data.intervalHours = parsed.data.intervalHours;
    data.nextRunAt = new Date(Date.now() + parsed.data.intervalHours * 60 * 60 * 1000);
  }
  if (parsed.data.retainDaily !== undefined) data.retainDaily = parsed.data.retainDaily;
  if (parsed.data.retainWeekly !== undefined) data.retainWeekly = parsed.data.retainWeekly;
  if (parsed.data.retainMonthly !== undefined) data.retainMonthly = parsed.data.retainMonthly;

  const schedule = await db.backupSchedule.upsert({
    where: { serverId: params.serverId },
    create: {
      serverId: params.serverId,
      ...data,
      nextRunAt: new Date(Date.now() + (parsed.data.intervalHours || 24) * 60 * 60 * 1000),
    },
    update: data,
  });

  return apiSuccess({
    id: schedule.id,
    enabled: schedule.enabled,
    intervalHours: schedule.intervalHours,
    retainDaily: schedule.retainDaily,
    retainWeekly: schedule.retainWeekly,
    retainMonthly: schedule.retainMonthly,
    nextRunAt: schedule.nextRunAt.toISOString(),
  });
}

import { Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { createRuntime } from "./runtime/factory";
import { handleProvisionJob } from "./jobs/provision.server.job";
import {
  handleStartJob,
  handleStopJob,
  handleRestartJob,
  handleDeleteJob,
} from "./jobs/lifecycle.job";
import { handleBackupJob } from "./jobs/backup.server.job";

const REDIS_URL = process.env.REDIS_URL || "redis://redis:6379";
const CONTAINER_RUNTIME_DRIVER = process.env.CONTAINER_RUNTIME_DRIVER || "mock";

const connection = { url: REDIS_URL };
const runtime = createRuntime(CONTAINER_RUNTIME_DRIVER);
const db = new PrismaClient();

console.log(`[worker] Starting with runtime: ${CONTAINER_RUNTIME_DRIVER}`);

const worker = new Worker(
  "server-operations",
  async (job) => {
  const { type, serverId, backupId } = job.data as { type: string; serverId: string; backupId?: string };

  console.log(`[worker] Processing job ${job.id}: ${type} for server ${serverId}`);

    switch (type) {
      case "provision":
        await handleProvisionJob(runtime, serverId);
        break;
      case "start":
        await handleStartJob(runtime, serverId);
        break;
      case "stop":
        await handleStopJob(runtime, serverId);
        break;
      case "restart":
        await handleRestartJob(runtime, serverId);
        break;
      case "delete":
        await handleDeleteJob(runtime, serverId);
        break;
      case "backup":
        if (backupId) await handleBackupJob(runtime, serverId, backupId);
        else console.error("[worker] Backup job missing backupId");
        break;
      default:
        console.error(`[worker] Unknown job type: ${type}`);
    }
  },
  {
    connection,
    concurrency: 5,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  }
);

worker.on("completed", (job) => {
  console.log(`[worker] Job ${job.id} completed: ${job.data.type}`);
});

worker.on("failed", (job, error) => {
  console.error(`[worker] Job ${job?.id} failed: ${error.message}`);
});

async function shutdown() {
  console.log("[worker] Shutting down...");
  await worker.close();
  await db.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

console.log("[worker] Worker started. Waiting for jobs...");

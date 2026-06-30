import { Queue } from "bullmq";

const REDIS_URL = process.env.REDIS_URL || "redis://redis:6379";

export const serverQueue = new Queue("server-operations", {
  connection: { url: REDIS_URL },
});

export enum JobType {
  PROVISION = "provision",
  START = "start",
  STOP = "stop",
  RESTART = "restart",
  DELETE = "delete",
  BACKUP = "backup",
  VOLUME_CREATE = "volume-create",
  VOLUME_DELETE = "volume-delete",
}

export interface ProvisionJobData {
  type: JobType.PROVISION;
  serverId: string;
}

export interface LifecycleJobData {
  type: JobType.START | JobType.STOP | JobType.RESTART | JobType.DELETE;
  serverId: string;
}

export interface BackupJobData {
  type: JobType.BACKUP;
  serverId: string;
  backupId: string;
}

export type ServerJobData = ProvisionJobData | LifecycleJobData | BackupJobData;

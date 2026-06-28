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
}

export interface ProvisionJobData {
  type: JobType.PROVISION;
  serverId: string;
}

export interface LifecycleJobData {
  type: JobType.START | JobType.STOP | JobType.RESTART | JobType.DELETE;
  serverId: string;
}

export type ServerJobData = ProvisionJobData | LifecycleJobData;

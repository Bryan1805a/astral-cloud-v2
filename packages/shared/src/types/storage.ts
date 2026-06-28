import type { BackupType, BackupStatus } from "../constants";

export interface Backup {
  id: string;
  serverId: string;
  label: string;
  type: BackupType;
  sizeMB: number;
  status: BackupStatus;
  storagePath: string;
  expiresAt: string | null;
  createdAt: string;
}

export interface BackupSchedule {
  id: string;
  serverId: string;
  enabled: boolean;
  intervalHours: number;
  retainDaily: number;
  retainWeekly: number;
  retainMonthly: number;
  nextRunAt: string;
  createdAt: string;
  updatedAt: string;
}

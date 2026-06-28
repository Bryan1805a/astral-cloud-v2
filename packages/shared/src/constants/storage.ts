export const BackupType = {
  MANUAL: "MANUAL",
  AUTOMATED: "AUTOMATED",
} as const;
export type BackupType = (typeof BackupType)[keyof typeof BackupType];

export const BackupStatus = {
  CREATING: "CREATING",
  AVAILABLE: "AVAILABLE",
  FAILED: "FAILED",
  EXPIRED: "EXPIRED",
} as const;
export type BackupStatus = (typeof BackupStatus)[keyof typeof BackupStatus];

export const BlockVolumeStatus = {
  CREATING: "CREATING",
  AVAILABLE: "AVAILABLE",
  ATTACHED: "ATTACHED",
  DETACHING: "DETACHING",
  DELETING: "DELETING",
  ERROR: "ERROR",
} as const;
export type BlockVolumeStatus = (typeof BlockVolumeStatus)[keyof typeof BlockVolumeStatus];

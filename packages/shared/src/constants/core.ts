export const UserRole = {
  CUSTOMER: "CUSTOMER",
  STAFF: "STAFF",
  ADMIN: "ADMIN",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const UserStatus = {
  ACTIVE: "ACTIVE",
  LOCKED: "LOCKED",
  PENDING_VERIFICATION: "PENDING_VERIFICATION",
  SUSPENDED: "SUSPENDED",
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const ServerStatus = {
  CREATING: "CREATING",
  ACTIVE: "ACTIVE",
  STOPPING: "STOPPING",
  STOPPED: "STOPPED",
  RESTARTING: "RESTARTING",
  DELETING: "DELETING",
  DELETED: "DELETED",
  ERROR: "ERROR",
} as const;
export type ServerStatus = (typeof ServerStatus)[keyof typeof ServerStatus];

export const LockedBy = {
  CREATING: "CREATING",
  STOPPING: "STOPPING",
  RESTARTING: "RESTARTING",
  DELETING: "DELETING",
  BACKING_UP: "BACKING_UP",
  RESTORING: "RESTORING",
} as const;
export type LockedBy = (typeof LockedBy)[keyof typeof LockedBy];

export const BillingModel = {
  MONTHLY: "MONTHLY",
  HOURLY: "HOURLY",
  ANNUAL: "ANNUAL",
} as const;
export type BillingModel = (typeof BillingModel)[keyof typeof BillingModel];

export const NodeStatus = {
  ONLINE: "ONLINE",
  OFFLINE: "OFFLINE",
  MAINTENANCE: "MAINTENANCE",
} as const;
export type NodeStatus = (typeof NodeStatus)[keyof typeof NodeStatus];

export const IpType = {
  IPv4: "IPv4",
  IPv6: "IPv6",
} as const;
export type IpType = (typeof IpType)[keyof typeof IpType];

export const OsType = {
  LINUX: "LINUX",
} as const;
export type OsType = (typeof OsType)[keyof typeof OsType];

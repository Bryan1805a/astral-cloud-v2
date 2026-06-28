import type { ServerStatus, LockedBy, BillingModel, OsType } from "../constants";

export interface ServerPlan {
  id: string;
  name: string;
  slug: string;
  vcpu: number;
  ramMB: number;
  diskGB: number;
  bandwidthMbps: number;
  priceMonthly: string;
  priceHourly: string;
  maxServers: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ImageTemplate {
  id: string;
  name: string;
  slug: string;
  osType: OsType;
  version: string;
  dockerImage: string;
  diskSizeGB: number;
  defaultUser: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Region {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
}

export interface Node {
  id: string;
  name: string;
  regionId: string;
  status: import("../constants").NodeStatus;
  dockerEndpoint: string;
  totalVcpu: number;
  totalRamMB: number;
  totalDiskGB: number;
  allocatedVcpu: number;
  allocatedRamMB: number;
  allocatedDiskGB: number;
  lastHeartbeatAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IpAddress {
  id: string;
  nodeId: string;
  address: string;
  type: import("../constants").IpType;
  serverId: string | null;
  allocatedAt: string | null;
  createdAt: string;
}

export interface ServerInstance {
  id: string;
  userId: string;
  serverPlanId: string | null;
  imageTemplateId: string | null;
  snapshotId: string | null;
  nodeId: string;
  regionId: string;
  sshKeyId: string | null;
  hostname: string;
  status: ServerStatus;
  lockedBy: LockedBy | null;
  lockedAt: string | null;
  ipAddress: string | null;
  dockerContainerId: string | null;
  vcpu: number;
  ramMB: number;
  diskGB: number;
  billingModel: BillingModel;
  rootPassword: string | null;
  cloudInitScript: string | null;
  nextBillingAt: string | null;
  gracePeriodEndsAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CustomSpecs {
  vcpu: number;
  ramMB: number;
  diskGB: number;
}

export interface ServerStats {
  cpuPercent: number;
  ramUsedMB: number;
  ramTotalMB: number;
  ramPercent: number;
  diskUsedGB: number;
  diskTotalGB: number;
  diskPercent: number;
  bandwidthInMbps: number;
  bandwidthOutMbps: number;
  uptimeSeconds: number;
  collectedAt: string;
}

export interface Snapshot {
  id: string;
  userId: string;
  sourceServerId: string | null;
  label: string;
  sizeGB: number;
  createdAt: string;
}

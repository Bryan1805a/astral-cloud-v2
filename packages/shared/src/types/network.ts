import type { FirewallProtocol, FirewallAction, DnsRecordType } from "../constants";

export interface FirewallRule {
  id: string;
  serverId: string;
  protocol: FirewallProtocol;
  portRange: string;
  sourceCidr: string;
  action: FirewallAction;
  priority: number;
  description: string | null;
  createdAt: string;
}

export interface DnsRecord {
  id: string;
  serverId: string;
  type: DnsRecordType;
  name: string;
  value: string;
  ttl: number;
  priority: number | null;
  createdAt: string;
}

export interface PrivateNetwork {
  id: string;
  userId: string;
  regionId: string;
  name: string;
  cidr: string;
  isActive: boolean;
  createdAt: string;
}

export interface ServerPrivateNetwork {
  id: string;
  serverId: string;
  networkId: string;
  privateIp: string;
  attachedAt: string;
}

export interface FloatingIp {
  id: string;
  userId: string;
  regionId: string;
  ipAddress: string;
  serverId: string | null;
  assignedAt: string | null;
  createdAt: string;
}

export interface BlockVolume {
  id: string;
  userId: string;
  regionId: string;
  nodeId: string | null;
  name: string;
  sizeGB: number;
  status: import("../constants").BlockVolumeStatus;
  serverId: string | null;
  devicePath: string | null;
  attachedAt: string | null;
  dockerVolumeId: string | null;
  createdAt: string;
  deletedAt: string | null;
}

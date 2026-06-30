export interface CreateServerParams {
  serverId: string;
  userId: string;
  hostname: string;
  image: string;
  vcpu: number;
  ramMB: number;
  diskGB: number;
  rootPassword?: string;
  sshPublicKey?: string;
  cloudInitScript?: string;
}

export interface CreateServerResult {
  containerId: string;
  ipAddress: string;
}

export interface ServerStatus {
  running: boolean;
  containerId?: string;
  ipAddress?: string;
  state?: string;
}

export interface NodeResources {
  totalVcpu: number;
  totalRamMB: number;
  totalDiskGB: number;
  usedVcpu: number;
  usedRamMB: number;
  usedDiskGB: number;
}

export interface ContainerRuntime {
  createServer(nodeEndpoint: string, params: CreateServerParams): Promise<CreateServerResult>;
  startServer(nodeEndpoint: string, containerId: string): Promise<void>;
  stopServer(nodeEndpoint: string, containerId: string, graceful: boolean): Promise<void>;
  restartServer(nodeEndpoint: string, containerId: string): Promise<void>;
  deleteServer(nodeEndpoint: string, containerId: string): Promise<void>;
  getServerStatus(nodeEndpoint: string, containerId: string): Promise<ServerStatus>;
  getNodeResources(nodeEndpoint: string): Promise<NodeResources>;
  createBackup(nodeEndpoint: string, containerId: string, backupPath: string): Promise<void>;
  restoreBackup(nodeEndpoint: string, backupId: string, targetContainerId: string): Promise<void>;
  deleteBackup(nodeEndpoint: string, backupId: string): Promise<void>;
  createVolume(nodeEndpoint: string, name: string, sizeGB: number): Promise<string>;
  attachVolume(nodeEndpoint: string, volumeId: string, containerId: string, devicePath: string): Promise<void>;
  detachVolume(nodeEndpoint: string, volumeId: string): Promise<void>;
  deleteVolume(nodeEndpoint: string, volumeId: string): Promise<void>;
}

import type { ContainerRuntime, CreateServerParams, CreateServerResult, ServerStatus, NodeResources } from "./types";

let mockCounter = 1000;

export class MockRuntime implements ContainerRuntime {
  async createServer(_nodeEndpoint: string, params: CreateServerParams): Promise<CreateServerResult> {
    const containerId = `mock-${params.serverId.slice(0, 8)}-${mockCounter++}`;
    const ipAddress = `10.0.${Math.floor(mockCounter / 254)}.${mockCounter % 254}`;
    return { containerId, ipAddress };
  }

  async startServer(_nodeEndpoint: string, containerId: string): Promise<void> {
    console.log(`[mock] Starting container ${containerId}`);
  }

  async stopServer(_nodeEndpoint: string, containerId: string, graceful: boolean): Promise<void> {
    console.log(`[mock] Stopping container ${containerId} (graceful=${graceful})`);
  }

  async restartServer(_nodeEndpoint: string, containerId: string): Promise<void> {
    console.log(`[mock] Restarting container ${containerId}`);
  }

  async deleteServer(_nodeEndpoint: string, containerId: string): Promise<void> {
    console.log(`[mock] Deleting container ${containerId}`);
  }

  async getServerStatus(_nodeEndpoint: string, containerId: string): Promise<ServerStatus> {
    return { running: false, ipAddress: undefined, state: "stopped" };
  }

  async getNodeResources(_nodeEndpoint: string): Promise<NodeResources> {
    return {
      totalVcpu: 16,
      totalRamMB: 32768,
      totalDiskGB: 500,
      usedVcpu: 2,
      usedRamMB: 2048,
      usedDiskGB: 25,
    };
  }

  async createBackup(_nodeEndpoint: string, containerId: string, backupPath: string): Promise<void> {
    console.log(`[mock] Creating backup of ${containerId} at ${backupPath}`);
  }

  async restoreBackup(_nodeEndpoint: string, backupId: string, targetContainerId: string): Promise<void> {
    console.log(`[mock] Restoring backup ${backupId} to ${targetContainerId}`);
  }

  async deleteBackup(_nodeEndpoint: string, backupId: string): Promise<void> {
    console.log(`[mock] Deleting backup ${backupId}`);
  }

  async createVolume(_nodeEndpoint: string, name: string, sizeGB: number): Promise<string> {
    const id = `vol-mock-${name}-${sizeGB}`;
    console.log(`[mock] Creating volume ${id} (${sizeGB}GB)`);
    return id;
  }

  async attachVolume(_nodeEndpoint: string, volumeId: string, _containerId: string, devicePath: string): Promise<void> {
    console.log(`[mock] Attaching volume ${volumeId} at ${devicePath}`);
  }

  async detachVolume(_nodeEndpoint: string, volumeId: string): Promise<void> {
    console.log(`[mock] Detaching volume ${volumeId}`);
  }

  async deleteVolume(_nodeEndpoint: string, volumeId: string): Promise<void> {
    console.log(`[mock] Deleting volume ${volumeId}`);
  }

  async createSnapshot(_nodeEndpoint: string, containerId: string, snapshotName: string): Promise<string> {
    const id = `snap-${snapshotName}`;
    console.log(`[mock] Creating snapshot ${id} from ${containerId}`);
    return id;
  }
}

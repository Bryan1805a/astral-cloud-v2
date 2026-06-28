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
    return { running: true, ipAddress: "10.0.0.1", state: "running" };
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
}

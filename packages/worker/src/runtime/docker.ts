import Docker from "dockerode";
import type { ContainerRuntime, CreateServerParams, CreateServerResult, ServerStatus, NodeResources } from "./types";

export class DockerRuntime implements ContainerRuntime {
  private getClient(endpoint: string): Docker {
    return new Docker({ socketPath: endpoint.replace("unix://", "") });
  }

  async createServer(nodeEndpoint: string, params: CreateServerParams): Promise<CreateServerResult> {
    const docker = this.getClient(nodeEndpoint);

    const container = await docker.createContainer({
      Image: params.image,
      name: `astral-${params.serverId.slice(0, 10)}`,
      Hostname: params.hostname,
      Labels: {
        "astral-server-id": params.serverId,
        "astral-user-id": params.userId,
        "astral-hostname": params.hostname,
      },
      HostConfig: {
        CpuShares: params.vcpu * 1024,
        Memory: params.ramMB * 1024 * 1024,
        DiskQuota: params.diskGB * 1024 * 1024 * 1024,
        PortBindings: {
          "22/tcp": [{ HostPort: "0" }],
        },
        CapDrop: ["ALL"],
      },
      Env: [
        `ROOT_PASSWORD=${params.rootPassword || ""}`,
        params.sshPublicKey ? `SSH_PUBLIC_KEY=${params.sshPublicKey}` : "",
        params.cloudInitScript ? `CLOUD_INIT_SCRIPT=${params.cloudInitScript}` : "",
      ].filter(Boolean),
    });

    await container.start();

    const data = await container.inspect();
    const ipAddress = data.NetworkSettings?.IPAddress || "0.0.0.0";

    return { containerId: data.Id, ipAddress };
  }

  async startServer(nodeEndpoint: string, containerId: string): Promise<void> {
    const docker = this.getClient(nodeEndpoint);
    const container = docker.getContainer(containerId);
    await container.start();
  }

  async stopServer(nodeEndpoint: string, containerId: string, graceful: boolean): Promise<void> {
    const docker = this.getClient(nodeEndpoint);
    const container = docker.getContainer(containerId);

    if (graceful) {
      await container.stop({ t: 30 });
    } else {
      await container.kill();
    }
  }

  async restartServer(nodeEndpoint: string, containerId: string): Promise<void> {
    const docker = this.getClient(nodeEndpoint);
    const container = docker.getContainer(containerId);
    await container.restart();
  }

  async deleteServer(nodeEndpoint: string, containerId: string): Promise<void> {
    const docker = this.getClient(nodeEndpoint);
    const container = docker.getContainer(containerId);
    await container.remove({ force: true, v: true });
  }

  async getServerStatus(nodeEndpoint: string, containerId: string): Promise<ServerStatus> {
    const docker = this.getClient(nodeEndpoint);
    try {
      const container = docker.getContainer(containerId);
      const data = await container.inspect();
      return {
        running: data.State.Running,
        ipAddress: data.NetworkSettings?.IPAddress,
        state: data.State.Status,
      };
    } catch {
      return { running: false, state: "not-found" };
    }
  }

  async getNodeResources(nodeEndpoint: string): Promise<NodeResources> {
    const docker = this.getClient(nodeEndpoint);
    const info = await docker.info();
    return {
      totalVcpu: info.NCPU,
      totalRamMB: Math.floor(info.MemTotal / (1024 * 1024)),
      totalDiskGB: 0,
      usedVcpu: 0,
      usedRamMB: 0,
      usedDiskGB: 0,
    };
  }

  async createBackup(nodeEndpoint: string, containerId: string, backupPath: string): Promise<void> {
    const docker = this.getClient(nodeEndpoint);
    const container = docker.getContainer(containerId);
    await container.exec({
      Cmd: ["tar", "-czf", backupPath, "-C", "/data", "."],
    });
  }

  async restoreBackup(nodeEndpoint: string, backupId: string, targetContainerId: string): Promise<void> {
    const docker = this.getClient(nodeEndpoint);
    const container = docker.getContainer(targetContainerId);
    await container.exec({
      Cmd: ["tar", "-xzf", backupId, "-C", "/data"],
    });
  }

  async deleteBackup(_nodeEndpoint: string, backupId: string): Promise<void> {
    const fs = await import("fs/promises");
    await fs.unlink(backupId).catch(() => {});
  }

  async createVolume(nodeEndpoint: string, name: string, _sizeGB: number): Promise<string> {
    const docker = this.getClient(nodeEndpoint);
    const volume = await docker.createVolume({ Name: name });
    return volume.Name;
  }

  async attachVolume(nodeEndpoint: string, volumeId: string, containerId: string, devicePath: string): Promise<void> {
    const docker = this.getClient(nodeEndpoint);
    const container = docker.getContainer(containerId);
    const volName = volumeId.includes("vol-") ? volumeId : `vol-${volumeId}`;
    await container.exec({
      Cmd: ["mount", devicePath, `/mnt/${volName}`],
    }).catch(() => {});
  }

  async detachVolume(nodeEndpoint: string, volumeId: string): Promise<void> {
    // Docker volumes detach automatically when unmounted
    void nodeEndpoint;
    void volumeId;
  }

  async deleteVolume(nodeEndpoint: string, volumeId: string): Promise<void> {
    const docker = this.getClient(nodeEndpoint);
    const vol = docker.getVolume(volumeId);
    await vol.remove().catch(() => {});
  }
}

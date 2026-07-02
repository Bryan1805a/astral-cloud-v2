import Docker from "dockerode";
import type { ContainerRuntime, CreateServerParams, CreateServerResult, ServerStatus, NodeResources } from "./types";

export class DockerRuntime implements ContainerRuntime {
  private getClient(endpoint: string): Docker {
    if (endpoint.startsWith("unix://")) {
      return new Docker({ socketPath: endpoint.replace("unix://", "") });
    }
    if (endpoint.startsWith("tcp://")) {
      const url = new URL(endpoint);
      return new Docker({
        host: url.hostname,
        port: url.port || "2375",
      });
    }
    return new Docker({ socketPath: endpoint });
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
        PortBindings: {
          "22/tcp": [{ HostPort: "0" }],
        },
        CapDrop: ["NET_RAW", "SYS_MODULE", "SYS_RAWIO", "SYS_PTRACE", "SYSLOG"],
        SecurityOpt: ["no-new-privileges:true"],
      },
      Env: [
        `ROOT_PASSWORD=${params.rootPassword || ""}`,
        params.sshPublicKey ? `SSH_PUBLIC_KEY=${params.sshPublicKey}` : "",
        params.cloudInitScript ? `CLOUD_INIT_SCRIPT=${params.cloudInitScript}` : "",
      ].filter(Boolean),
      ExposedPorts: {
        "22/tcp": {},
      },
    });

    await container.start();

    const data = await container.inspect();
    const ports = data.NetworkSettings?.Ports;
    const hostPort = ports?.["22/tcp"]?.[0]?.HostPort || "0";

    return { containerId: data.Id, ipAddress: `localhost:${hostPort}` };
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
        containerId: data.Id,
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
    const memTotal = info.MemTotal || 0;
    return {
      totalVcpu: info.NCPU,
      totalRamMB: Math.floor(memTotal / (1024 * 1024)),
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
    void nodeEndpoint;
    void volumeId;
  }

  async deleteVolume(nodeEndpoint: string, volumeId: string): Promise<void> {
    const docker = this.getClient(nodeEndpoint);
    const vol = docker.getVolume(volumeId);
    await vol.remove().catch(() => {});
  }

  async createSnapshot(nodeEndpoint: string, containerId: string, snapshotName: string): Promise<string> {
    const docker = this.getClient(nodeEndpoint);
    const container = docker.getContainer(containerId);
    const image = await container.commit({ repo: snapshotName });
    return image.Id || snapshotName;
  }
}

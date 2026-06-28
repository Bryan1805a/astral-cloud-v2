# ADR-006: Use Docker Engine as Container Runtime

| Attribute | Value                          |
|-----------|--------------------------------|
| Date      | 2026-06-27                     |
| Status    | Accepted                       |
| Replaces  | (none — original ADR-006 was superseded before implementation) |

## Context

Astral Cloud needs to create, start, stop, and delete containerized server instances on physical nodes. The original design used Proxmox VE as a hypervisor (full VMs via QEMU/KVM), but this required nested virtualization in development (VirtualBox VM → Proxmox → guest VMs), which was prohibitively slow and complex.

We evaluated whether Docker Engine could serve as the container runtime instead, provisioning Ubuntu containers that behave like lightweight VPS instances. The core question: can a Docker container provide an acceptable "VPS experience" — SSH access, persistent storage, resource isolation, networking, and fast provisioning?

## Decision

**Use Docker Engine as the container runtime** for provisioning, starting, stopping, and destroying server instances.

Each "server" is a Docker container running Ubuntu 24.04 with `sshd`, `systemd`, and the standard Ubuntu package ecosystem. Containers are provisioned via the Docker Engine API, with resource limits enforced via cgroups.

All container-runtime-specific code is isolated in `packages/worker/src/runtime/` behind a TypeScript interface (`ContainerRuntime`), allowing future replacement with a different runtime (e.g., Podman, containerd, or even returning to Proxmox).

## Alternatives Considered

| Option             | Rejected because...                                                                                                     |
|--------------------|-------------------------------------------------------------------------------------------------------------------------|
| Proxmox VE (VMs)   | Requires nested virtualization for dev (3 layers: host → VM → Proxmox → VM). Provisioning takes minutes. Poor dev perf. |
| Incus/LXD          | System containers are viable, but LXD client library ecosystem is smaller. Docker has larger community and tooling.      |
| Podman             | Viable alternative but Docker's API is more widely documented. The `ContainerRuntime` interface allows swapping later.   |
| Kubernetes         | Over-engineered for this use case. We don't need pod scheduling, services, or deployments — just isolated containers.    |
| Direct libvirt/QEMU| Building a management layer over libvirt is significant scope creep. No built-in REST API.                               |

## Rationale for Docker Containers as "VPS"

| Concern                | Mitigation                                                                                                              |
|------------------------|-------------------------------------------------------------------------------------------------------------------------|
| **Kernel isolation**   | Containers share the host kernel. For a learning project, this is acceptable. Docker's cgroups and namespaces provide reasonable isolation. Production would use gVisor or Firecracker. |
| **SSH access**         | Ubuntu container runs `sshd` on port 22 (mapped to a host port). Customer SSHes directly into the container.            |
| **Persistent storage** | Docker volumes backed by host filesystem, mounted at `/data`. Volume size is capped via the storage driver.             |
| **Resource limits**    | Docker's `--cpus`, `--memory`, `--storage-opt size=...` enforce CPU, RAM, and disk quotas.                             |
| **Networking**         | Each container gets a Docker bridge network. Port 22 (and other ports per firewall rules) are mapped to host ports.     |
| **Provisioning speed** | Containers start in <5 seconds (vs 3 minutes for VMs). The provisioning timeout drops from 3 minutes to 60 seconds.     |
| **Image management**   | Pre-built Ubuntu container images stored in a private registry or built locally via Dockerfile. Images are tagged by OS version. |

## Consequences

**Positive:**
- Provisioning drops from 3 minutes to <10 seconds — vastly better UX and faster dev iteration.
- No nested virtualization required. Dev environment runs directly on host Docker Engine.
- Docker API is well-documented, battle-tested, and has excellent Node.js client libraries (`dockerode`).
- Resource limits enforced by the Linux kernel (cgroups v2) — reliable and auditable.
- Container images are lightweight (Ubuntu base ~77 MB compressed) vs full VM disk images (GBs).
- Docker's built-in volume management simplifies backup implementation (`docker run --volumes-from`).
- The `ContainerRuntime` interface makes swapping to another runtime (Podman, Firecracker) straightforward.

**Negative:**
- Containers share the host kernel — not true multi-tenant isolation. A kernel exploit could escape. Acceptable for a learning project; production would require gVisor/kata/Firecracker for hardware-level isolation.
- No Windows server support (Windows containers require Windows host — impractical).
- Docker daemon is a single point of failure per node. If Docker is down, all servers on that node are unreachable.
- Some "VPS" features like custom kernel modules or `dmesg` access are impossible in containers.
- Disk quota enforcement depends on the storage driver (overlay2 with `--storage-opt`). Not as battle-tested as QEMU disk images.

## Interface (Abstraction Layer)

```typescript
// packages/worker/src/runtime/types.ts
interface ContainerRuntime {
  createServer(params: CreateServerParams): Promise<CreateServerResult>;
  startServer(nodeName: string, containerId: string): Promise<void>;
  stopServer(nodeName: string, containerId: string, graceful: boolean): Promise<void>;
  restartServer(nodeName: string, containerId: string): Promise<void>;
  deleteServer(nodeName: string, containerId: string): Promise<void>;
  getServerStatus(nodeName: string, containerId: string): Promise<ServerStatus>;
  getNodeResources(nodeName: string): Promise<NodeResources>;
  createBackup(nodeName: string, containerId: string, backupPath: string): Promise<void>;
  restoreBackup(nodeName: string, backupId: string, targetContainerId: string): Promise<void>;
  listBackups(nodeName: string, containerId: string): Promise<BackupInfo[]>;
  deleteBackup(nodeName: string, backupId: string): Promise<void>;
}

// packages/worker/src/runtime/docker/
//   index.ts           — DockerRuntime implements ContainerRuntime
//   client.ts          — dockerode instance management
//   create.ts          — docker create + start logic
//   networking.ts      — port mapping, DNS config
//   volumes.ts         — volume creation, mount, backup
//   resources.ts       — cgroup parsing, resource tracking
//   firewall.ts        — iptables rule management via Docker
```

## Development

For development, the worker connects to the host's Docker daemon (via Docker socket on Linux, or Docker Desktop on Windows/macOS). The `NODE` table is seeded with a single entry pointing to `unix:///var/run/docker.sock` (or `tcp://localhost:2375`).

A mock implementation (`MockRuntime`) returns simulated container IDs and IPs for testing without a running Docker daemon:

```env
CONTAINER_RUNTIME_DRIVER=docker    # or "mock"
```

## Migration Path

If the platform later needs full VM isolation (production scale), the `ContainerRuntime` interface can be implemented against Proxmox VE or Firecracker without changing any business logic, API routes, or database schema. Only the `packages/worker/src/runtime/` package is replaced.

(End of file - total 110 lines)

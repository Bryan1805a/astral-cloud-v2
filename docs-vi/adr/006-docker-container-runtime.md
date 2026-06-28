# ADR-006: Sử Dụng Docker Engine làm Container Runtime

| Attribute | Value                          |
|-----------|--------------------------------|
| Date      | 2026-06-27                     |
| Status    | Accepted                       |
| Replaces  | (none — ADR-006 gốc đã bị thay thế trước khi triển khai) |

## Context

Astral Cloud cần tạo, khởi động, dừng và xóa các server instance được container hóa trên các node vật lý. Thiết kế ban đầu sử dụng Proxmox VE làm hypervisor (VM đầy đủ qua QEMU/KVM), nhưng điều này yêu cầu nested virtualization trong môi trường phát triển (VirtualBox VM → Proxmox → guest VMs), gây chậm và phức tạp đáng kể.

Chúng tôi đã đánh giá liệu Docker Engine có thể phục vụ như container runtime thay thế, provision các Ubuntu container hoạt động giống như các VPS instance nhẹ hay không. Câu hỏi cốt lõi: liệu một Docker container có thể cung cấp trải nghiệm "VPS" chấp nhận được — SSH access, persistent storage, resource isolation, networking, và provisioning nhanh?

## Decision

**Sử dụng Docker Engine làm container runtime** để provisioning, starting, stopping và destroying các server instance.

Mỗi "server" là một Docker container chạy Ubuntu 24.04 với `sshd`, `systemd`, và hệ sinh thái package Ubuntu tiêu chuẩn. Các container được provision qua Docker Engine API, với resource limits được áp dụng qua cgroups.

Tất cả code đặc thù cho container runtime được cô lập trong `packages/worker/src/runtime/` đằng sau một TypeScript interface (`ContainerRuntime`), cho phép thay thế trong tương lai bằng một runtime khác (ví dụ: Podman, containerd, hoặc thậm chí quay lại Proxmox).

## Alternatives Considered

| Option             | Rejected because...                                                                                                     |
|--------------------|-------------------------------------------------------------------------------------------------------------------------|
| Proxmox VE (VMs)   | Yêu cầu nested virtualization cho dev (3 lớp: host → VM → Proxmox → VM). Provisioning mất vài phút. Hiệu năng dev kém. |
| Incus/LXD          | System containers khả thi, nhưng hệ sinh thái thư viện LXD client nhỏ hơn. Docker có cộng đồng và tooling lớn hơn.      |
| Podman             | Giải pháp thay thế khả thi nhưng Docker API được document rộng rãi hơn. Interface `ContainerRuntime` cho phép hoán đổi sau này. |
| Kubernetes         | Over-engineered cho use case này. Chúng tôi không cần pod scheduling, services, hay deployments — chỉ cần các container cô lập. |
| Direct libvirt/QEMU| Xây dựng một lớp quản lý trên libvirt là scope creep đáng kể. Không có REST API tích hợp sẵn.                            |

## Rationale for Docker Containers as "VPS"

| Concern                | Mitigation                                                                                                              |
|------------------------|-------------------------------------------------------------------------------------------------------------------------|
| **Kernel isolation**   | Container chia sẻ host kernel. Đối với một dự án học tập, điều này chấp nhận được. cgroups và namespaces của Docker cung cấp isolation hợp lý. Production sẽ sử dụng gVisor hoặc Firecracker. |
| **SSH access**         | Ubuntu container chạy `sshd` trên port 22 (được map sang host port). Khách hàng SSH trực tiếp vào container.            |
| **Persistent storage** | Docker volumes được hỗ trợ bởi host filesystem, mount tại `/data`. Dung lượng volume được giới hạn qua storage driver. |
| **Resource limits**    | `--cpus`, `--memory`, `--storage-opt size=...` của Docker áp dụng CPU, RAM, và disk quotas.                             |
| **Networking**         | Mỗi container có một Docker bridge network. Port 22 (và các port khác theo firewall rules) được map sang host ports.     |
| **Provisioning speed** | Container khởi động trong <5 giây (so với 3 phút cho VM). Provisioning timeout giảm từ 3 phút xuống 60 giây.            |
| **Image management**   | Ubuntu container images được build sẵn lưu trong private registry hoặc build cục bộ qua Dockerfile. Images được gắn tag theo phiên bản OS. |

## Consequences

**Positive:**
- Provisioning giảm từ 3 phút xuống <10 giây — UX tốt hơn nhiều và dev iteration nhanh hơn.
- Không cần nested virtualization. Môi trường dev chạy trực tiếp trên host Docker Engine.
- Docker API được document đầy đủ, battle-tested, và có thư viện Node.js client xuất sắc (`dockerode`).
- Resource limits được áp dụng bởi Linux kernel (cgroups v2) — đáng tin cậy và có thể kiểm toán.
- Container images nhẹ (Ubuntu base ~77 MB đã nén) so với full VM disk images (GBs).
- Volume management tích hợp sẵn của Docker đơn giản hóa việc triển khai backup (`docker run --volumes-from`).
- Interface `ContainerRuntime` giúp việc hoán đổi sang runtime khác (Podman, Firecracker) trở nên dễ dàng.

**Negative:**
- Container chia sẻ host kernel — không phải multi-tenant isolation thực sự. Một kernel exploit có thể escape. Chấp nhận được cho dự án học tập; production sẽ yêu cầu gVisor/kata/Firecracker để có hardware-level isolation.
- Không hỗ trợ Windows server (Windows containers yêu cầu Windows host — không thực tế).
- Docker daemon là single point of failure trên mỗi node. Nếu Docker ngừng hoạt động, tất cả server trên node đó không thể truy cập.
- Một số tính năng "VPS" như custom kernel modules hoặc `dmesg` access là không thể trong container.
- Disk quota enforcement phụ thuộc vào storage driver (overlay2 với `--storage-opt`). Chưa được battle-tested như QEMU disk images.

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
//   index.ts           — DockerRuntime triển khai ContainerRuntime
//   client.ts          — quản lý dockerode instance
//   create.ts          — logic docker create + start
//   networking.ts      — port mapping, cấu hình DNS
//   volumes.ts         — tạo volume, mount, backup
//   resources.ts       — phân tích cgroup, theo dõi tài nguyên
//   firewall.ts        — quản lý iptables rules qua Docker
```

## Development

Trong môi trường phát triển, worker kết nối đến Docker daemon của host (qua Docker socket trên Linux, hoặc Docker Desktop trên Windows/macOS). Bảng `NODE` được seed với một entry duy nhất trỏ đến `unix:///var/run/docker.sock` (hoặc `tcp://localhost:2375`).

Một mock implementation (`MockRuntime`) trả về container IDs và IPs giả lập để testing mà không cần Docker daemon đang chạy:

```env
CONTAINER_RUNTIME_DRIVER=docker    # hoặc "mock"
```

## Migration Path

Nếu nền tảng sau này cần full VM isolation (production scale), interface `ContainerRuntime` có thể được triển khai dựa trên Proxmox VE hoặc Firecracker mà không thay đổi bất kỳ business logic, API routes, hay database schema nào. Chỉ có package `packages/worker/src/runtime/` được thay thế.

(Hết file - tổng cộng 110 dòng)

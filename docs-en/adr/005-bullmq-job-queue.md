# ADR-005: Use BullMQ for Asynchronous Job Processing

| Attribute | Value                          |
|-----------|--------------------------------|
| Date      | 2026-06-26                     |
| Status    | Accepted                       |
| Author    | Bryan                          |

## Context

VPS provisioning can take up to 3 minutes (BR-07). HTTP request/response cycles should not block for that long. We need a reliable way to:
- Accept a VPS creation request and respond 202 immediately.
- Process the actual VM provisioning asynchronously (call Proxmox VE API, wait for completion).
- Handle retries on transient failures.
- Process notifications (email) without delaying the main API response.
- Support scheduling recurring tasks (billing, health checks).

## Decision

**Use BullMQ with Redis as the job queue system.**

The web app enqueues jobs; a separate worker process dequeues and executes them.

## Alternatives Considered

| Option            | Rejected because...                                                                                                                   |
|-------------------|---------------------------------------------------------------------------------------------------------------------------------------|
| In-process async  | If the web server crashes, in-flight VM creations are lost. No retry.                                                                 |
| RabbitMQ          | Requires managing a separate broker (Erlang runtime). Redis is already in the stack for caching. Heavier operational burden.          |
| SQS / Cloud Tasks | Vendor lock-in. MVP targets self-hosted deployment.                                                                                   |
| pg-boss           | Uses PostgreSQL for queues — workable, but Redis/BullMQ has better monitoring, retry semantics, and throughput for high-volume tasks. |

## Consequences

**Positive:**
- Job persistence: jobs survive Redis or worker restarts.
- Built-in retry with exponential backoff (configurable per job type).
- Delayed jobs for scheduling (e.g., billing at end of month, cleanup tasks).
- Rate limiting per job type (e.g., only N concurrent provisioning jobs across the cluster).
- Bull Board provides a web UI for monitoring queues, failed jobs, and throughput.
- Redis is already in the stack as a cache — no new infrastructure.

**Negative:**
- Redis becomes a critical dependency. If Redis loses data, in-flight jobs are lost (mitigated by Redis AOF persistence).
- Workers must be deployed as a separate process/container — adds one more service to monitor.
- Jobs that exceed retry limits end up in the dead-letter queue and require manual intervention or admin alerts.

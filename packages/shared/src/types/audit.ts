import type { AuditAction, AuditResult } from "../constants";

export interface AuditLog {
  id: string;
  userId: string | null;
  action: AuditAction;
  targetType: string;
  targetId: string;
  result: AuditResult;
  metadata: Record<string, unknown> | null;
  ipAddress: string;
  createdAt: string;
}

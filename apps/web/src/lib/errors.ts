import { NextResponse } from "next/server";

export interface ApiError {
  code: string;
  message: string;
  details?: { field: string; message: string }[];
  data?: Record<string, unknown>;
}

const errorStatusMap: Record<string, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  INVALID_CREDENTIALS: 401,
  TOKEN_EXPIRED: 401,
  INVALID_2FA_CODE: 401,
  TWO_FACTOR_REQUIRED: 401,
  INSUFFICIENT_BALANCE: 402,
  FORBIDDEN: 403,
  SERVER_LIMIT_REACHED: 403,
  NOT_FOUND: 404,
  INVALID_STATE: 409,
  USERNAME_TAKEN: 409,
  EMAIL_TAKEN: 409,
  ACCOUNT_LOCKED: 423,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  RUNTIME_UNREACHABLE: 502,
  NODE_CAPACITY: 503,
};

export function apiError(code: string, message: string, status?: number, details?: { field: string; message: string }[], data?: Record<string, unknown>) {
  const httpStatus = status || errorStatusMap[code] || 500;
  const body: { error: ApiError } = {
    error: { code, message },
  };
  if (details) body.error.details = details;
  if (data) body.error.data = data;
  return NextResponse.json(body, { status: httpStatus });
}

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function apiPaginated<T>(data: T[], meta: { page: number; limit: number; total: number; totalPages: number }) {
  return NextResponse.json({ data, meta });
}

export function getAuthToken(request: Request): string | null {
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

export function extractTokenFromCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

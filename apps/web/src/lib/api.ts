const BASE_URL = "/api";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const body = await res.json();

  if (!res.ok) {
    const error = body.error || { code: "UNKNOWN", message: "Request failed" };
    const err = new Error(error.message) as Error & {
      code: string;
      status: number;
      details?: { field: string; message: string }[];
    };
    err.code = error.code;
    err.status = res.status;
    err.details = error.details;
    throw err;
  }

  return body.data;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

async function requestRaw<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const body = await res.json();

  if (!res.ok) {
    const error = body.error || { code: "UNKNOWN", message: "Request failed" };
    const err = new Error(error.message) as Error & {
      code: string;
      status: number;
      details?: { field: string; message: string }[];
    };
    err.code = error.code;
    err.status = res.status;
    err.details = error.details;
    throw err;
  }

  return body;
}

export const api = {
  get: <T>(path: string) => request<T>(path),

  getPaginated: async <T>(path: string) => {
    return requestRaw<PaginatedResponse<T>>(path);
  },

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    }),

  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

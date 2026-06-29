import { NextRequest } from "next/server";
import { getAuthToken, apiError, apiSuccess } from "@/lib/errors";
import { verifyAccessToken } from "@/lib/auth";
import { stopServer, InvalidStateError, ServerLockedError } from "@/lib/services/server.service";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: { serverId: string } }
) {
  const token = getAuthToken(request);
  if (!token) return apiError("UNAUTHORIZED", "Missing authorization token.");

  let payload;
  try {
    payload = await verifyAccessToken(token);
  } catch {
    return apiError("TOKEN_EXPIRED", "Access token has expired.");
  }

  const body = await request.json().catch(() => ({ force: false }));
  const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";

  try {
    await stopServer(params.serverId, payload.sub, body.force || false, ip);

    return apiSuccess({
      id: params.serverId,
      status: "STOPPING",
    });
  } catch (error) {
    if (error instanceof InvalidStateError) {
      return apiError("INVALID_STATE", "This server cannot be stopped because it is not currently running.");
    }
    if (error instanceof ServerLockedError) {
      return apiError("INVALID_STATE", `Server is currently ${error.lockedBy}`);
    }
    if (error instanceof Error) {
      return apiError("VALIDATION_ERROR", error.message);
    }
    console.error("Stop server error:", error);
    return apiError("INTERNAL_ERROR", "An unexpected error occurred.");
  }
}

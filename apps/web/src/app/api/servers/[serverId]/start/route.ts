import { NextRequest } from "next/server";
import { getAuthToken, apiError, apiSuccess } from "@/lib/errors";
import { verifyAccessToken } from "@/lib/auth";
import { startServer, InvalidStateError, ServerLockedError } from "@/lib/services/server.service";

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

  const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";

  try {
    await startServer(params.serverId, payload.sub, ip);

    return apiSuccess({
      id: params.serverId,
      status: "STARTING",
    });
  } catch (error) {
    if (error instanceof InvalidStateError) {
      return apiError("INVALID_STATE", "This server cannot be started because it is not in a stopped state.");
    }
    if (error instanceof ServerLockedError) {
      return apiError("INVALID_STATE", `Server is currently ${error.lockedBy}`);
    }
    if (error instanceof Error) {
      return apiError("VALIDATION_ERROR", error.message);
    }
    console.error("Start server error:", error);
    return apiError("INTERNAL_ERROR", "An unexpected error occurred.");
  }
}

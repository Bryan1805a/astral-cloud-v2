import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const tos = await db.termsAcceptance.findFirst({
    where: { userId: auth.userId, termsType: "TOS" },
    orderBy: { acceptedAt: "desc" },
  });
  const privacy = await db.termsAcceptance.findFirst({
    where: { userId: auth.userId, termsType: "PRIVACY_POLICY" },
    orderBy: { acceptedAt: "desc" },
  });

  return apiSuccess({
    tosAccepted: !!tos,
    privacyAccepted: !!privacy,
    tosVersion: tos?.version || null,
    privacyVersion: privacy?.version || null,
  });
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth) return apiError("UNAUTHORIZED", "Missing authorization.");

  const body = await request.json();
  const { termsType, version } = body;

  if (!termsType || !version) return apiError("VALIDATION_ERROR", "Terms type and version required.");

  await db.termsAcceptance.create({
    data: { userId: auth.userId, termsType, version },
  });

  return apiSuccess({ accepted: true, termsType, version }, 201);
}

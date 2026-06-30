import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";
import { updateTaxRateSchema } from "@astral/shared";

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest, { params }: { params: { rateId: string } }) {
  const auth = await authenticateRequest(request);
  if (!auth || auth.role !== "ADMIN") return apiError("FORBIDDEN", "Admin access required.");

  const rate = await db.taxRate.findUnique({ where: { id: params.rateId } });
  if (!rate) return apiError("NOT_FOUND", "Tax rate not found.");

  const body = await request.json();
  const parsed = updateTaxRateSchema.safeParse(body);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Invalid data.");

  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.rate !== undefined) data.rate = parsed.data.rate;
  if (body.isActive !== undefined) data.isActive = body.isActive;

  const updated = await db.taxRate.update({ where: { id: rate.id }, data });
  return apiSuccess({ id: updated.id, name: updated.name, rate: updated.rate.toString() });
}

export async function DELETE(request: NextRequest, { params }: { params: { rateId: string } }) {
  const auth = await authenticateRequest(request);
  if (!auth || auth.role !== "ADMIN") return apiError("FORBIDDEN", "Admin access required.");

  await db.taxRate.delete({ where: { id: params.rateId } });
  return apiSuccess({ deleted: true });
}

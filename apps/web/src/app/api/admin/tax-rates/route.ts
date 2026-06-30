import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";
import { createTaxRateSchema } from "@astral/shared";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth || auth.role !== "ADMIN") return apiError("FORBIDDEN", "Admin access required.");

  const rates = await db.taxRate.findMany({
    orderBy: { name: "asc" },
    include: { region: { select: { id: true, name: true, slug: true } } },
  });

  return apiSuccess(rates.map((r) => ({
    id: r.id, regionId: r.regionId, name: r.name,
    rate: r.rate.toString(), isActive: r.isActive,
    region: r.region,
    createdAt: r.createdAt.toISOString(),
  })));
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth || auth.role !== "ADMIN") return apiError("FORBIDDEN", "Admin access required.");

  const body = await request.json();
  const parsed = createTaxRateSchema.safeParse(body);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Invalid data.");

  const existing = await db.taxRate.findUnique({ where: { regionId: parsed.data.regionId } });
  if (existing) return apiError("EMAIL_TAKEN", "This region already has a tax rate.", 409);

  const rate = await db.taxRate.create({
    data: { regionId: parsed.data.regionId, name: parsed.data.name, rate: parsed.data.rate },
  });

  return apiSuccess({
    id: rate.id, name: rate.name, rate: rate.rate.toString(),
    regionId: rate.regionId, createdAt: rate.createdAt.toISOString(),
  }, 201);
}

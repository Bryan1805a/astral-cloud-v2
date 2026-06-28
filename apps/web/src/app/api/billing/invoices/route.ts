import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getAuthToken, apiError, apiPaginated } from "@/lib/errors";
import { verifyAccessToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = getAuthToken(request);
  if (!token) return apiError("UNAUTHORIZED", "Missing authorization token.");

  let payload;
  try {
    payload = await verifyAccessToken(token);
  } catch {
    return apiError("TOKEN_EXPIRED", "Access token has expired.");
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
  const skip = (page - 1) * limit;

  const [invoices, total] = await Promise.all([
    db.invoice.findMany({
      where: { userId: payload.sub },
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    db.invoice.count({ where: { userId: payload.sub } }),
  ]);

  const data = invoices.map((i) => ({
    id: i.id,
    invoiceNumber: i.invoiceNumber,
    subtotal: i.subtotal.toString(),
    taxAmount: i.taxAmount.toString(),
    discountAmount: i.discountAmount.toString(),
    total: i.total.toString(),
    currency: i.currency,
    status: i.status,
    pdfUrl: i.pdfUrl,
    createdAt: i.createdAt.toISOString(),
  }));

  return apiPaginated(data, {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
}

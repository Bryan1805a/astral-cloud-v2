import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";
import { createEmailTemplateSchema } from "@astral/shared";

export const dynamic = "force-dynamic";

const DEFAULTS = [
  { code: "email.verification", name: "Email Verification", subject: "Verify your email — Astral Cloud", htmlBody: "<p>Click the link below to verify your email.</p><p>{{verifyLink}}</p>", variables: ["verifyLink"] },
  { code: "email.password_reset", name: "Password Reset", subject: "Reset your password — Astral Cloud", htmlBody: "<p>Click the link below to reset your password.</p><p>{{resetLink}}</p>", variables: ["resetLink"] },
  { code: "email.server_created", name: "Server Created", subject: "Server {{hostname}} is ready", htmlBody: "<p>Your server <strong>{{hostname}}</strong> has been provisioned and is ready.</p><p>IP: {{ipAddress}}</p>", variables: ["hostname", "ipAddress"] },
  { code: "email.payment_received", name: "Payment Received", subject: "Payment of ${{amount}} received", htmlBody: "<p>Your payment of <strong>${{amount}}</strong> has been received. Thank you!</p>", variables: ["amount"] },
];

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth || auth.role !== "ADMIN") return apiError("FORBIDDEN", "Admin access required.");

  for (const tpl of DEFAULTS) {
    await db.emailTemplate.upsert({
      where: { code: tpl.code },
      create: { ...tpl, variables: tpl.variables },
      update: {},
    });
  }

  const templates = await db.emailTemplate.findMany({
    orderBy: { name: "asc" },
  });

  return apiSuccess(templates.map((t) => ({
    id: t.id, code: t.code, name: t.name, subject: t.subject,
    htmlBody: t.htmlBody, textBody: t.textBody,
    variables: t.variables, isActive: t.isActive,
    updatedAt: t.updatedAt.toISOString(),
  })));
}

export async function POST(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth || auth.role !== "ADMIN") return apiError("FORBIDDEN", "Admin access required.");

  const body = await request.json();
  const parsed = createEmailTemplateSchema.safeParse(body);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Invalid template data.");

  const existing = await db.emailTemplate.findUnique({ where: { code: parsed.data.code } });
  if (existing) return apiError("EMAIL_TAKEN", "A template with this code already exists.", 409);

  const template = await db.emailTemplate.create({
    data: { ...parsed.data, variables: parsed.data.variables || [] },
  });

  return apiSuccess({ id: template.id, code: template.code, name: template.name }, 201);
}

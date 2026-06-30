import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";
import { updateEmailTemplateSchema } from "@astral/shared";

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest, { params }: { params: { templateId: string } }) {
  const auth = await authenticateRequest(request);
  if (!auth || auth.role !== "ADMIN") return apiError("FORBIDDEN", "Admin access required.");

  const template = await db.emailTemplate.findUnique({ where: { id: params.templateId } });
  if (!template) return apiError("NOT_FOUND", "Template not found.");

  const body = await request.json();
  const parsed = updateEmailTemplateSchema.safeParse(body);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Invalid template data.");

  const data: Record<string, unknown> = {};
  if (parsed.data.code !== undefined) data.code = parsed.data.code;
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.subject !== undefined) data.subject = parsed.data.subject;
  if (parsed.data.htmlBody !== undefined) data.htmlBody = parsed.data.htmlBody;
  if (parsed.data.textBody !== undefined) data.textBody = parsed.data.textBody;
  if (parsed.data.variables !== undefined) data.variables = parsed.data.variables;
  if (body.isActive !== undefined) data.isActive = body.isActive;

  const updated = await db.emailTemplate.update({ where: { id: template.id }, data });
  return apiSuccess({ id: updated.id, code: updated.code, name: updated.name, isActive: updated.isActive });
}

export async function DELETE(request: NextRequest, { params }: { params: { templateId: string } }) {
  const auth = await authenticateRequest(request);
  if (!auth || auth.role !== "ADMIN") return apiError("FORBIDDEN", "Admin access required.");

  await db.emailTemplate.delete({ where: { id: params.templateId } });
  return apiSuccess({ deleted: true });
}

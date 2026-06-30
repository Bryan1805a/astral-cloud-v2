import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, apiError, apiSuccess } from "@/lib/errors";

export const dynamic = "force-dynamic";

const DEFAULT_SETTINGS = [
  { key: "platform.name", value: "Astral Cloud", type: "STRING" as const, label: "Platform Name", description: "The name of the platform displayed site-wide.", isImmutable: false },
  { key: "platform.contact_email", value: "support@astral.cloud", type: "STRING" as const, label: "Contact Email", description: "Support email shown to customers.", isImmutable: false },
  { key: "platform.allow_registration", value: "true", type: "BOOLEAN" as const, label: "Allow Registration", description: "Enable or disable new user sign-ups.", isImmutable: false },
  { key: "platform.maintenance_mode", value: "false", type: "BOOLEAN" as const, label: "Maintenance Mode", description: "Show maintenance banner and disable actions.", isImmutable: false },
  { key: "billing.default_currency", value: "USD", type: "STRING" as const, label: "Default Currency", description: "ISO 4217 currency code for billing.", isImmutable: true },
  { key: "servers.max_per_user", value: "5", type: "NUMBER" as const, label: "Max Servers Per User", description: "Default limit for concurrent servers per customer.", isImmutable: false },
  { key: "servers.provisioning_timeout", value: "60", type: "NUMBER" as const, label: "Provisioning Timeout (sec)", description: "Max seconds before provisioning is marked failed.", isImmutable: false },
  { key: "referral.credit_amount", value: "10", type: "NUMBER" as const, label: "Referral Credit Amount", description: "Credits awarded to referrer and referee (USD).", isImmutable: false },
];

export async function GET(request: NextRequest) {
  const auth = await authenticateRequest(request);
  if (!auth || auth.role !== "ADMIN") return apiError("FORBIDDEN", "Admin access required.");

  for (const setting of DEFAULT_SETTINGS) {
    await db.systemSetting.upsert({
      where: { key: setting.key },
      create: setting,
      update: {},
    });
  }

  const settings = await db.systemSetting.findMany({
    orderBy: { key: "asc" },
  });

  return apiSuccess(settings.map((s) => ({
    id: s.id, key: s.key, value: s.value, type: s.type,
    label: s.label, description: s.description,
    isImmutable: s.isImmutable,
    updatedAt: s.updatedAt.toISOString(),
  })));
}

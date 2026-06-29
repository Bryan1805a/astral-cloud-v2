import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { generateSecret, generateURI } from "otplib";
import { verify as verifyOTP } from "otplib";
import { db } from "./db";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "astral-cloud-dev-secret-change-in-production-min-32-chars"
);

const REFRESH_SECRET = new TextEncoder().encode(
  process.env.REFRESH_SECRET || "astral-cloud-refresh-secret-change-in-production"
);

export interface JwtPayload {
  sub: string;
  role: string;
  type: "access" | "refresh";
  iat?: number;
  exp?: number;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createAccessToken(userId: string, role: string): Promise<string> {
  return new SignJWT({ sub: userId, role, type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(JWT_SECRET);
}

export async function createRefreshToken(userId: string, role: string): Promise<string> {
  return new SignJWT({ sub: userId, role, type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(REFRESH_SECRET);
}

export async function createTempToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId, role: "CUSTOMER", type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(JWT_SECRET);
}

export async function verifyAccessToken(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, JWT_SECRET);
  return payload as unknown as JwtPayload;
}

export async function verifyRefreshToken(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, REFRESH_SECRET);
  return payload as unknown as JwtPayload;
}

export async function createSession(
  userId: string,
  refreshTokenHash: string,
  ipAddress: string,
  userAgent?: string
) {
  const maxSessions = 5;
  const sessions = await db.session.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  if (sessions.length >= maxSessions) {
    await db.session.delete({ where: { id: sessions[0].id } });
  }

  return db.session.create({
    data: {
      userId,
      refreshTokenHash,
      userAgent: userAgent || null,
      ipAddress,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "127.0.0.1";
}

function sha256(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

export function generateApiKey(): { fullKey: string; prefix: string; hash: string } {
  const secret = randomBytes(32).toString("hex");
  const fullKey = `ak_${secret}`;
  const prefix = fullKey.slice(0, 8);
  const hash = sha256(fullKey);
  return { fullKey, prefix, hash };
}

export async function verifyApiKey(key: string): Promise<{ userId: string; role: string } | null> {
  const hash = sha256(key);
  const apiKey = await db.apiKey.findFirst({
    where: { keyHash: hash },
    include: { user: { select: { id: true, role: true, status: true, deletedAt: true } } },
  });

  if (!apiKey) return null;
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;
  if (!apiKey.user || apiKey.user.deletedAt || apiKey.user.status !== "ACTIVE") return null;

  await db.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });

  return { userId: apiKey.user.id, role: apiKey.user.role };
}

export function generateTOTPSecret(): string {
  return generateSecret();
}

export function generateTOTPUri(secret: string, email: string): string {
  return generateURI({ secret, label: email, issuer: "Astral Cloud" });
}

export async function verifyTOTP(secret: string, token: string): Promise<boolean> {
  try {
    const result: unknown = await verifyOTP({ secret, token });
    return result === true;
  } catch {
    return false;
  }
}

export function generateBackupCodes(): string[] {
  return Array.from({ length: 5 }, () =>
    `${randomBytes(4).toString("hex")}-${randomBytes(4).toString("hex")}`
  );
}

export async function createResetToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const hash = sha256(token);
  const payload = JSON.stringify({ hash, expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() });
  await db.systemSetting.upsert({
    where: { key: `reset_${userId}` },
    update: { value: payload },
    create: { key: `reset_${userId}`, value: payload, label: `Password reset for ${userId}`, type: "JSON" },
  });
  return token;
}

export async function verifyResetToken(userId: string, token: string): Promise<boolean> {
  const setting = await db.systemSetting.findUnique({ where: { key: `reset_${userId}` } });
  if (!setting) return false;
  const data = JSON.parse(setting.value);
  if (new Date(data.expiresAt) < new Date()) {
    await db.systemSetting.delete({ where: { id: setting.id } }).catch(() => {});
    return false;
  }
  return sha256(token) === data.hash;
}

export async function consumeResetToken(userId: string): Promise<void> {
  await db.systemSetting.delete({ where: { key: `reset_${userId}` } }).catch(() => {});
}

export async function createVerificationToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const hash = sha256(token);
  const payload = JSON.stringify({ hash, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() });
  await db.systemSetting.upsert({
    where: { key: `verify_${userId}` },
    update: { value: payload },
    create: { key: `verify_${userId}`, value: payload, label: `Email verify for ${userId}`, type: "JSON" },
  });
  return token;
}

export async function verifyEmailToken(token: string): Promise<string | null> {
  const settings = await db.systemSetting.findMany({ where: { key: { startsWith: "verify_" } } });
  for (const setting of settings) {
    try {
      const data = JSON.parse(setting.value);
      if (new Date(data.expiresAt) < new Date()) continue;
      if (sha256(token) === data.hash) {
        await db.systemSetting.delete({ where: { id: setting.id } });
        return setting.key.replace("verify_", "");
      }
    } catch { continue; }
  }
  return null;
}

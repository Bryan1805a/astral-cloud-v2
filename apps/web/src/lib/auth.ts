import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
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

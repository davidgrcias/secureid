import { randomUUID } from "node:crypto";
import { env } from "../config/env";
import { cache } from "../config/redis";
import { pool, query } from "../config/database";
import { ApiError } from "../middleware/error.middleware";
import { generateSecureToken } from "../utils/crypto";
import { comparePassword, hashPassword } from "../utils/password";
import {
  createAccessToken,
  createRefreshToken,
  verifyRefreshToken,
  type JwtRefreshPayload
} from "../utils/token";
import { sendPasswordResetEmail } from "./email.service";
import type { AuthTokens, RequestMeta, SafeUser } from "../types";

type DbUserRow = {
  id: string;
  email: string;
  phone: string | null;
  password_hash: string;
  full_name: string;
  avatar_url: string | null;
  kyc_status: string;
  role: string;
  org_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

type DbSessionRow = {
  id: string;
  user_id: string;
  refresh_token: string;
  expires_at: Date | string;
};

const RESET_PASSWORD_CACHE_PREFIX = "password-reset";

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapSafeUser(user: DbUserRow): SafeUser {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    fullName: user.full_name,
    avatarUrl: user.avatar_url,
    kycStatus: user.kyc_status,
    role: user.role,
    orgId: user.org_id,
    createdAt: toIsoString(user.created_at),
    updatedAt: toIsoString(user.updated_at)
  };
}

function parseDurationToMs(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) {
    return 7 * 24 * 60 * 60 * 1000;
  }

  const amount = Number(match[1]);
  const unit = match[2];

  switch (unit) {
    case "s":
      return amount * 1000;
    case "m":
      return amount * 60 * 1000;
    case "h":
      return amount * 60 * 60 * 1000;
    case "d":
      return amount * 24 * 60 * 60 * 1000;
    default:
      return 7 * 24 * 60 * 60 * 1000;
  }
}

function buildRefreshSessionExpiryDate(): Date {
  return new Date(Date.now() + parseDurationToMs(env.JWT_REFRESH_EXPIRES_IN));
}

function buildAuthTokens(userId: string, sessionId: string): AuthTokens {
  return {
    accessToken: createAccessToken(userId, sessionId),
    refreshToken: createRefreshToken(userId, sessionId)
  };
}

async function createSession(
  userId: string,
  tokens: AuthTokens,
  meta: RequestMeta
): Promise<{ sessionId: string; tokens: AuthTokens }> {
  const sessionId = randomUUID();
  const nextTokens = {
    ...tokens,
    refreshToken: createRefreshToken(userId, sessionId),
    accessToken: createAccessToken(userId, sessionId)
  };

  await query(
    `
      INSERT INTO sessions (id, user_id, refresh_token, ip_address, user_agent, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [
      sessionId,
      userId,
      nextTokens.refreshToken,
      meta.ipAddress,
      meta.userAgent,
      buildRefreshSessionExpiryDate()
    ]
  );

  return { sessionId, tokens: nextTokens };
}

async function getUserByIdentifier(identifier: string): Promise<DbUserRow | null> {
  const result = await query<DbUserRow>(
    `
      SELECT
        id,
        email,
        phone,
        password_hash,
        full_name,
        avatar_url,
        kyc_status,
        role,
        org_id,
        created_at,
        updated_at
      FROM users
      WHERE email = $1 OR phone = $1
      LIMIT 1
    `,
    [identifier]
  );

  return result.rows[0] ?? null;
}

function extractResetUserId(resetCacheValue: unknown): string | null {
  if (!resetCacheValue) {
    return null;
  }

  if (typeof resetCacheValue === "object" && resetCacheValue !== null && "userId" in resetCacheValue) {
    const candidate = (resetCacheValue as { userId?: unknown }).userId;
    return typeof candidate === "string" ? candidate : null;
  }

  if (typeof resetCacheValue === "string") {
    try {
      const parsed = JSON.parse(resetCacheValue) as { userId?: unknown };
      return typeof parsed.userId === "string" ? parsed.userId : null;
    } catch {
      return null;
    }
  }

  return null;
}

export async function registerUser(
  input: { fullName: string; email: string; phone?: string; password: string },
  meta: RequestMeta
): Promise<{ user: SafeUser; tokens: AuthTokens }> {
  const existingUser = await query<{ id: string }>(
    `
      SELECT id
      FROM users
      WHERE email = $1 OR ($2::text IS NOT NULL AND phone = $2)
      LIMIT 1
    `,
    [input.email, input.phone ?? null]
  );

  if (existingUser.rows[0]) {
    throw new ApiError(409, "Email atau nomor telepon sudah terdaftar.");
  }

  const passwordHash = await hashPassword(input.password);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const insertUserResult = await client.query<DbUserRow>(
      `
        INSERT INTO users (email, phone, password_hash, full_name)
        VALUES ($1, $2, $3, $4)
        RETURNING
          id,
          email,
          phone,
          password_hash,
          full_name,
          avatar_url,
          kyc_status,
          role,
          org_id,
          created_at,
          updated_at
      `,
      [input.email, input.phone ?? null, passwordHash, input.fullName]
    );

    const user = insertUserResult.rows[0];
    if (!user) {
      throw new ApiError(500, "Gagal membuat akun.");
    }

    const sessionId = randomUUID();
    const tokens = buildAuthTokens(user.id, sessionId);

    await client.query(
      `
        INSERT INTO sessions (id, user_id, refresh_token, ip_address, user_agent, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        sessionId,
        user.id,
        tokens.refreshToken,
        meta.ipAddress,
        meta.userAgent,
        buildRefreshSessionExpiryDate()
      ]
    );

    await client.query("COMMIT");

    return {
      user: mapSafeUser(user),
      tokens
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function loginUser(
  input: { identifier: string; password: string },
  meta: RequestMeta
): Promise<{ user: SafeUser; tokens: AuthTokens }> {
  const user = await getUserByIdentifier(input.identifier);

  if (!user) {
    throw new ApiError(401, "Email/nomor HP atau kata sandi tidak valid.");
  }

  const isPasswordValid = await comparePassword(input.password, user.password_hash);
  if (!isPasswordValid) {
    throw new ApiError(401, "Email/nomor HP atau kata sandi tidak valid.");
  }

  const sessionId = randomUUID();
  const tokens = buildAuthTokens(user.id, sessionId);

  await query(
    `
      INSERT INTO sessions (id, user_id, refresh_token, ip_address, user_agent, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [
      sessionId,
      user.id,
      tokens.refreshToken,
      meta.ipAddress,
      meta.userAgent,
      buildRefreshSessionExpiryDate()
    ]
  );

  return {
    user: mapSafeUser(user),
    tokens
  };
}

export async function refreshUserToken(
  refreshToken: string
): Promise<{ tokens: AuthTokens; user: SafeUser }> {
  let payload: JwtRefreshPayload;

  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new ApiError(401, "Refresh token tidak valid.");
  }

  const sessionResult = await query<DbSessionRow>(
    `
      SELECT id, user_id, refresh_token, expires_at
      FROM sessions
      WHERE id = $1 AND user_id = $2
      LIMIT 1
    `,
    [payload.sessionId, payload.userId]
  );

  const session = sessionResult.rows[0];
  if (!session || session.refresh_token !== refreshToken) {
    throw new ApiError(401, "Sesi login tidak ditemukan.");
  }

  const isExpired = new Date(session.expires_at).getTime() <= Date.now();
  if (isExpired) {
    await query("DELETE FROM sessions WHERE id = $1", [session.id]);
    throw new ApiError(401, "Sesi login sudah kedaluwarsa.");
  }

  const tokens = buildAuthTokens(payload.userId, payload.sessionId);

  await query(
    `
      UPDATE sessions
      SET refresh_token = $1,
          expires_at = $2
      WHERE id = $3
    `,
    [tokens.refreshToken, buildRefreshSessionExpiryDate(), payload.sessionId]
  );

  const userResult = await query<DbUserRow>(
    `
      SELECT
        id,
        email,
        phone,
        password_hash,
        full_name,
        avatar_url,
        kyc_status,
        role,
        org_id,
        created_at,
        updated_at
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [payload.userId]
  );

  const user = userResult.rows[0];
  if (!user) {
    throw new ApiError(404, "Pengguna tidak ditemukan.");
  }

  return { tokens, user: mapSafeUser(user) };
}

export async function logoutUser(userId: string, sessionId: string): Promise<void> {
  await query("DELETE FROM sessions WHERE id = $1 AND user_id = $2", [sessionId, userId]);
}

export async function requestPasswordReset(email: string): Promise<{ resetToken?: string }> {
  const result = await query<{ id: string }>(
    `
      SELECT id
      FROM users
      WHERE email = $1
      LIMIT 1
    `,
    [email]
  );

  const user = result.rows[0];
  if (!user) {
    return {};
  }

  const resetToken = generateSecureToken(32);
  const cacheKey = `${RESET_PASSWORD_CACHE_PREFIX}:${resetToken}`;
  const resetUrl = `${env.CORS_ORIGIN.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(resetToken)}`;

  await cache.set(cacheKey, { userId: user.id }, env.PASSWORD_RESET_TTL_SECONDS);

  try {
    await sendPasswordResetEmail({
      to: email,
      resetUrl
    });
  } catch {
    // Keep response generic and avoid leaking delivery errors to clients.
  }

  if (env.NODE_ENV !== "production") {
    return { resetToken };
  }

  return {};
}

export async function resetUserPassword(input: { token: string; password: string }): Promise<void> {
  const cacheKey = `${RESET_PASSWORD_CACHE_PREFIX}:${input.token}`;
  const resetCachePayload = await cache.get<unknown>(cacheKey);
  const userId = extractResetUserId(resetCachePayload);

  if (!userId) {
    throw new ApiError(400, "Token reset tidak valid atau sudah kedaluwarsa.");
  }

  const nextPasswordHash = await hashPassword(input.password);

  await query(
    `
      UPDATE users
      SET password_hash = $1,
          updated_at = NOW()
      WHERE id = $2
    `,
    [nextPasswordHash, userId]
  );

  await query("DELETE FROM sessions WHERE user_id = $1", [userId]);
  await cache.del(cacheKey);
}

export async function getSafeUserById(userId: string): Promise<SafeUser> {
  const result = await query<DbUserRow>(
    `
      SELECT
        id,
        email,
        phone,
        password_hash,
        full_name,
        avatar_url,
        kyc_status,
        role,
        org_id,
        created_at,
        updated_at
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [userId]
  );

  const user = result.rows[0];
  if (!user) {
    throw new ApiError(404, "Pengguna tidak ditemukan.");
  }

  return mapSafeUser(user);
}

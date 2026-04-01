import { query } from "../config/database";
import { ApiError } from "../middleware/error.middleware";
import type { SafeUser } from "../types";

type DbUserRow = {
  id: string;
  email: string;
  phone: string | null;
  full_name: string;
  avatar_url: string | null;
  kyc_status: string;
  role: string;
  org_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

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

export async function getCurrentUserProfile(userId: string): Promise<SafeUser> {
  const result = await query<DbUserRow>(
    `
      SELECT
        id,
        email,
        phone,
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

export async function updateCurrentUserProfile(
  userId: string,
  input: { fullName?: string; phone?: string }
): Promise<SafeUser> {
  if (input.phone) {
    const duplicatePhone = await query<{ id: string }>(
      `
        SELECT id
        FROM users
        WHERE phone = $1 AND id <> $2
        LIMIT 1
      `,
      [input.phone, userId]
    );

    if (duplicatePhone.rows[0]) {
      throw new ApiError(409, "Nomor HP sudah digunakan akun lain.");
    }
  }

  const result = await query<DbUserRow>(
    `
      UPDATE users
      SET
        full_name = COALESCE($2, full_name),
        phone = COALESCE($3, phone),
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        email,
        phone,
        full_name,
        avatar_url,
        kyc_status,
        role,
        org_id,
        created_at,
        updated_at
    `,
    [userId, input.fullName ?? null, input.phone ?? null]
  );

  const user = result.rows[0];
  if (!user) {
    throw new ApiError(404, "Pengguna tidak ditemukan.");
  }

  return mapSafeUser(user);
}

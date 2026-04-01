import { randomUUID } from "node:crypto";
import { pool, query } from "../config/database";
import { ApiError } from "../middleware/error.middleware";
import { createNotification } from "./notification.service";

type DbUserOrgRow = {
  id: string;
  full_name: string;
  email: string;
  org_id: string | null;
};

type DbMemberRow = {
  id: string;
  org_id: string;
  user_id: string;
  role: string;
  status: string;
  joined_at: Date | string;
  user_email: string;
  user_full_name: string;
};

export type TeamMemberRecord = {
  id: string;
  orgId: string;
  userId: string;
  role: string;
  status: string;
  joinedAt: string;
  email: string;
  fullName: string;
};

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapMember(row: DbMemberRow): TeamMemberRecord {
  return {
    id: row.id,
    orgId: row.org_id,
    userId: row.user_id,
    role: row.role,
    status: row.status,
    joinedAt: toIsoString(row.joined_at),
    email: row.user_email,
    fullName: row.user_full_name
  };
}

async function ensureOrgForUser(userId: string): Promise<{ orgId: string }> {
  const userResult = await query<DbUserOrgRow>(
    `
      SELECT id, full_name, email, org_id
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [userId]
  );

  const user = userResult.rows[0];
  if (!user) {
    throw new ApiError(404, "Pengguna tidak ditemukan.");
  }

  if (user.org_id) {
    const membership = await query<{ id: string }>(
      `
        SELECT id
        FROM org_members
        WHERE org_id = $1 AND user_id = $2
        LIMIT 1
      `,
      [user.org_id, userId]
    );

    if (!membership.rows[0]) {
      await query(
        `
          INSERT INTO org_members (org_id, user_id, role, status)
          VALUES ($1, $2, 'owner', 'active')
        `,
        [user.org_id, userId]
      );
    }

    return { orgId: user.org_id };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const orgResult = await client.query<{ id: string }>(
      `
        INSERT INTO organizations (id, name, plan)
        VALUES ($1, $2, 'business')
        RETURNING id
      `,
      [randomUUID(), `Org ${user.full_name}`]
    );

    const orgId = orgResult.rows[0]?.id;
    if (!orgId) {
      throw new ApiError(500, "Gagal membuat organisasi.");
    }

    await client.query(
      `
        UPDATE users
        SET org_id = $2,
            role = 'business',
            updated_at = NOW()
        WHERE id = $1
      `,
      [userId, orgId]
    );

    await client.query(
      `
        INSERT INTO org_members (org_id, user_id, role, status)
        VALUES ($1, $2, 'owner', 'active')
      `,
      [orgId, userId]
    );

    await client.query("COMMIT");
    return { orgId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listTeamMembers(actorUserId: string): Promise<TeamMemberRecord[]> {
  const { orgId } = await ensureOrgForUser(actorUserId);

  const result = await query<DbMemberRow>(
    `
      SELECT
        om.id,
        om.org_id,
        om.user_id,
        om.role,
        om.status,
        om.joined_at,
        u.email AS user_email,
        u.full_name AS user_full_name
      FROM org_members om
      JOIN users u ON u.id = om.user_id
      WHERE om.org_id = $1
      ORDER BY om.joined_at ASC
    `,
    [orgId]
  );

  return result.rows.map(mapMember);
}

export async function inviteTeamMember(
  actorUserId: string,
  input: { email: string; role: "admin" | "signer" | "viewer" }
): Promise<TeamMemberRecord> {
  const { orgId } = await ensureOrgForUser(actorUserId);

  const targetResult = await query<{ id: string; full_name: string; email: string }>(
    `
      SELECT id, full_name, email
      FROM users
      WHERE email = $1
      LIMIT 1
    `,
    [input.email]
  );

  const targetUser = targetResult.rows[0];
  if (!targetUser) {
    throw new ApiError(404, "User belum terdaftar. Minta user membuat akun terlebih dahulu.");
  }

  if (targetUser.id === actorUserId) {
    throw new ApiError(400, "Tidak dapat mengundang akun sendiri.");
  }

  const insertResult = await query<DbMemberRow>(
    `
      INSERT INTO org_members (org_id, user_id, role, status)
      VALUES ($1, $2, $3, 'active')
      ON CONFLICT (org_id, user_id)
      DO UPDATE SET role = EXCLUDED.role, status = 'active'
      RETURNING
        id,
        org_id,
        user_id,
        role,
        status,
        joined_at,
        (SELECT email FROM users WHERE id = org_members.user_id) AS user_email,
        (SELECT full_name FROM users WHERE id = org_members.user_id) AS user_full_name
    `,
    [orgId, targetUser.id, input.role]
  );

  await query(
    `
      UPDATE users
      SET org_id = $2,
          role = CASE WHEN role = 'personal' THEN 'business' ELSE role END,
          updated_at = NOW()
      WHERE id = $1
    `,
    [targetUser.id, orgId]
  );

  const member = insertResult.rows[0];
  if (!member) {
    throw new ApiError(500, "Gagal menambahkan anggota tim.");
  }

  await createNotification({
    userId: targetUser.id,
    type: "system",
    title: "Anda diundang ke tim SecureID",
    body: "Buka dashboard untuk melihat akses organisasi baru Anda.",
    actionUrl: "/dashboard/team"
  });

  return mapMember(member);
}

export async function updateTeamMemberRole(
  actorUserId: string,
  memberId: string,
  role: "owner" | "admin" | "signer" | "viewer"
): Promise<TeamMemberRecord> {
  const { orgId } = await ensureOrgForUser(actorUserId);

  const memberResult = await query<DbMemberRow>(
    `
      UPDATE org_members
      SET role = $3
      WHERE id = $1 AND org_id = $2
      RETURNING
        id,
        org_id,
        user_id,
        role,
        status,
        joined_at,
        (SELECT email FROM users WHERE id = org_members.user_id) AS user_email,
        (SELECT full_name FROM users WHERE id = org_members.user_id) AS user_full_name
    `,
    [memberId, orgId, role]
  );

  const member = memberResult.rows[0];
  if (!member) {
    throw new ApiError(404, "Anggota tim tidak ditemukan.");
  }

  return mapMember(member);
}

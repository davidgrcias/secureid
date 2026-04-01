import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { pool, query } from "../config/database";
import { ApiError } from "./error.middleware";

type DbOrgMemberRoleRow = {
  org_id: string;
  role: string;
};

type DbUserOrgRow = {
  id: string;
  full_name: string;
  org_id: string | null;
};

async function ensureOrgMembership(userId: string): Promise<DbOrgMemberRoleRow | null> {
  const membershipResult = await query<DbOrgMemberRoleRow>(
    `
      SELECT om.org_id, om.role
      FROM org_members om
      WHERE om.user_id = $1
        AND om.status = 'active'
      LIMIT 1
    `,
    [userId]
  );

  const membership = membershipResult.rows[0];
  if (membership) {
    return membership;
  }

  const userResult = await query<DbUserOrgRow>(
    `
      SELECT id, full_name, org_id
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [userId]
  );

  const user = userResult.rows[0];
  if (!user) {
    return null;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let orgId = user.org_id;

    if (!orgId) {
      orgId = randomUUID();

      await client.query(
        `
          INSERT INTO organizations (id, name, plan)
          VALUES ($1, $2, 'business')
        `,
        [orgId, `Org ${user.full_name}`]
      );

      await client.query(
        `
          UPDATE users
          SET org_id = $2,
              role = 'business',
              updated_at = NOW()
          WHERE id = $1
        `,
        [user.id, orgId]
      );
    }

    await client.query(
      `
        INSERT INTO org_members (org_id, user_id, role, status)
        VALUES ($1, $2, 'owner', 'active')
        ON CONFLICT (org_id, user_id)
        DO UPDATE SET status = 'active'
      `,
      [orgId, user.id]
    );

    await client.query("COMMIT");

    return {
      org_id: orgId,
      role: "owner"
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export function requireOrgRoles(allowedRoles: Array<"owner" | "admin" | "signer" | "viewer">) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.auth) {
        throw new ApiError(401, "Tidak terautentikasi.");
      }

      const membership = await ensureOrgMembership(req.auth.userId);
      if (!membership) {
        throw new ApiError(403, "Akses organisasi belum tersedia.");
      }

      if (!allowedRoles.includes(membership.role as "owner" | "admin" | "signer" | "viewer")) {
        throw new ApiError(403, "Anda tidak memiliki izin untuk aksi ini.");
      }

      req.org = {
        orgId: membership.org_id,
        role: membership.role
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}

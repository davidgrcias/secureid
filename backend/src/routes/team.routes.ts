import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.middleware";
import { ApiError } from "../middleware/error.middleware";
import { requireOrgRoles } from "../middleware/rbac.middleware";
import { inviteTeamMember, listTeamMembers, updateTeamMemberRole } from "../services/team.service";

const router = Router();

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "signer", "viewer"])
});

const updateRoleSchema = z.object({
  role: z.enum(["owner", "admin", "signer", "viewer"])
});

function parseBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(400, "Validasi payload gagal.", parsed.error.flatten().fieldErrors);
  }

  return parsed.data;
}

router.get("/", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      throw new ApiError(401, "Tidak terautentikasi.");
    }

    const members = await listTeamMembers(req.auth.userId);
    res.status(200).json({ data: members });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/invite",
  authMiddleware,
  requireOrgRoles(["owner", "admin"]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth) {
        throw new ApiError(401, "Tidak terautentikasi.");
      }

      const payload = parseBody(inviteSchema, req.body);
      const member = await inviteTeamMember(req.auth.userId, payload);

      res.status(201).json({
        message: "Anggota tim berhasil ditambahkan.",
        data: member
      });
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  "/members/:id/role",
  authMiddleware,
  requireOrgRoles(["owner"]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth) {
        throw new ApiError(401, "Tidak terautentikasi.");
      }

      const payload = parseBody(updateRoleSchema, req.body);
      const member = await updateTeamMemberRole(req.auth.userId, req.params.id, payload.role);

      res.status(200).json({
        message: "Role anggota berhasil diperbarui.",
        data: member
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

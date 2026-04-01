import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.middleware";
import { ApiError } from "../middleware/error.middleware";
import { getCurrentUserProfile, updateCurrentUserProfile } from "../services/user.service";

const router = Router();

const updateProfileSchema = z.object({
  fullName: z.string().min(2, "Nama minimal 2 karakter.").optional(),
  phone: z.string().min(8).max(32).optional()
});

function parseBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(400, "Validasi payload gagal.", parsed.error.flatten().fieldErrors);
  }

  return parsed.data;
}

router.get("/me", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      throw new ApiError(401, "Tidak terautentikasi.");
    }

    const user = await getCurrentUserProfile(req.auth.userId);
    res.status(200).json({
      data: user
    });
  } catch (error) {
    next(error);
  }
});

router.put("/me", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      throw new ApiError(401, "Tidak terautentikasi.");
    }

    const payload = parseBody(updateProfileSchema, req.body);
    const user = await updateCurrentUserProfile(req.auth.userId, payload);

    res.status(200).json({
      message: "Profil berhasil diperbarui.",
      data: user
    });
  } catch (error) {
    next(error);
  }
});

export default router;

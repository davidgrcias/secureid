import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.middleware";
import { ApiError } from "../middleware/error.middleware";
import {
  listUserNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead
} from "../services/notification.service";

const router = Router();

const listQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20)
});

function parseQuery<T>(schema: z.ZodSchema<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new ApiError(400, "Validasi query gagal.", parsed.error.flatten().fieldErrors);
  }

  return parsed.data;
}

router.get("/", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      throw new ApiError(401, "Tidak terautentikasi.");
    }

    const query = parseQuery(listQuerySchema, req.query);
    const notifications = await listUserNotifications(req.auth.userId, query.limit ?? 20);

    res.status(200).json({ data: notifications });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/read", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      throw new ApiError(401, "Tidak terautentikasi.");
    }

    const notification = await markNotificationAsRead(req.auth.userId, req.params.id);
    res.status(200).json({ data: notification });
  } catch (error) {
    next(error);
  }
});

router.patch("/read-all", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      throw new ApiError(401, "Tidak terautentikasi.");
    }

    await markAllNotificationsAsRead(req.auth.userId);
    res.status(200).json({ message: "Semua notifikasi ditandai sudah dibaca." });
  } catch (error) {
    next(error);
  }
});

export default router;

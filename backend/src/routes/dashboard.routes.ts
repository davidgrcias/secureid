import { Router, type NextFunction, type Request, type Response } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { ApiError } from "../middleware/error.middleware";
import { getDashboardSummary } from "../services/dashboard.service";

const router = Router();

router.get("/summary", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      throw new ApiError(401, "Tidak terautentikasi.");
    }

    const data = await getDashboardSummary(req.auth.userId);
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
});

export default router;

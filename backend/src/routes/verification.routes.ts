import path from "node:path";
import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.middleware";
import { ApiError } from "../middleware/error.middleware";
import { uploadImage } from "../middleware/upload.middleware";
import {
  getVerificationOverview,
  submitLivenessVerification,
  uploadVerificationFile
} from "../services/verification.service";

const router = Router();

const uploadBodySchema = z.object({
  type: z.enum(["ktp_photo", "selfie"]),
  side: z.enum(["front", "back"]).optional()
});

const livenessBodySchema = z.object({
  passed: z.boolean(),
  steps: z.array(z.string().min(1)).min(1),
  score: z.number().min(0).max(1).optional()
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

    const data = await getVerificationOverview(req.auth.userId);
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/upload",
  authMiddleware,
  uploadImage.single("file"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.auth) {
        throw new ApiError(401, "Tidak terautentikasi.");
      }

      if (!req.file) {
        throw new ApiError(400, "File verifikasi wajib diunggah.");
      }

      const body = parseBody(uploadBodySchema, req.body);
      const filePath = path.relative(process.cwd(), req.file.path).replace(/\\/g, "/");

      const data = await uploadVerificationFile({
        userId: req.auth.userId,
        type: body.type,
        filePath,
        metadata: body.side ? { side: body.side } : undefined
      });

      res.status(201).json({
        message: "File verifikasi berhasil disimpan.",
        data
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post("/liveness", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      throw new ApiError(401, "Tidak terautentikasi.");
    }

    const body = parseBody(livenessBodySchema, req.body);
    const data = await submitLivenessVerification({
      userId: req.auth.userId,
      passed: body.passed,
      steps: body.steps,
      score: body.score
    });

    res.status(201).json({
      message: "Hasil liveness check berhasil direkam.",
      data
    });
  } catch (error) {
    next(error);
  }
});

export default router;

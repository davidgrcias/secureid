import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.middleware";
import { ApiError } from "../middleware/error.middleware";
import { createUserSignature, listUserSignatures } from "../services/signature.service";

const router = Router();

const createSignatureSchema = z.object({
  type: z.enum(["draw", "type", "upload"]),
  value: z.string().min(1),
  fontFamily: z.string().max(120).optional(),
  isDefault: z.boolean().optional()
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

    const signatures = await listUserSignatures(req.auth.userId);
    res.status(200).json({ data: signatures });
  } catch (error) {
    next(error);
  }
});

router.post("/", authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth) {
      throw new ApiError(401, "Tidak terautentikasi.");
    }

    const payload = parseBody(createSignatureSchema, req.body);
    const created = await createUserSignature(req.auth.userId, payload);

    res.status(201).json({
      message: "Signature berhasil disimpan.",
      data: created
    });
  } catch (error) {
    next(error);
  }
});

export default router;

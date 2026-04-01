import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { ApiError } from "../middleware/error.middleware";
import { publicSigningRateLimiter } from "../middleware/rateLimiter.middleware";
import {
  completePublicSigning,
  getPublicSigningDocument,
  getPublicSigningSession
} from "../services/sign.service";

const router = Router();

const completeSigningSchema = z.object({
  fields: z
    .array(
      z.object({
        fieldId: z.string().uuid(),
        value: z.string().optional()
      })
    )
    .min(1),
  signature: z
    .object({
      type: z.enum(["draw", "type", "upload"]),
      value: z.string().min(1),
      fontFamily: z.string().optional()
    })
    .optional()
});

function parseBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(400, "Validasi payload gagal.", parsed.error.flatten().fieldErrors);
  }

  return parsed.data;
}

router.get("/:token", publicSigningRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getPublicSigningSession(req.params.token);
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
});

router.get("/:token/document", publicSigningRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const document = await getPublicSigningDocument(req.params.token);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(document.originalFilename)}"`);
    res.sendFile(document.absolutePath);
  } catch (error) {
    next(error);
  }
});

router.post("/:token/complete", publicSigningRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = parseBody(completeSigningSchema, req.body);

    const result = await completePublicSigning({
      token: req.params.token,
      fields: payload.fields,
      signature: payload.signature,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] ?? null
    });

    res.status(200).json({
      message: "Proses tanda tangan berhasil.",
      data: result
    });
  } catch (error) {
    next(error);
  }
});

export default router;
